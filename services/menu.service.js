const axios = require('axios');
const redisClient = require('../utils/redis');
const httpClient = require('../utils/httpClient');
const SystemConfig = require('../models/SystemConfig');
const { getCookie, generateCookie } = require('../controllers/cookie.controller');
const { login } = require('../controllers/auth.controller');
const { OCER_MENU_API, DEFAULT_ORIGIN, DEFAULT_REFERER } = require('../config/config');

const CACHE_KEY_PREFIX = 'menu:';
const activeRequests = new Map(); // 🔒 Enterprise In-Flight Lock

/**
 * Determine cache TTL and key based on parameters
 */
function getMenuContext(params) {
    const { eventType, competitionId, eventId } = params;
    
    // Level 1: Sports List
    if (eventType === "-1" && competitionId === "-2" && eventId === "-1") {
        return { level: 'sports', key: 'sports_list', ttl: 0 }; // Indefinite in MongoDB
    }
    
    // Level 4: Markets for Event
    if (eventId !== "-1") {
        return { level: 'markets', key: `markets:${eventId}`, ttl: 120 }; // 2 Minutes
    }

    // Level 3: Events for Competition
    if (competitionId !== "-2") {
        return { level: 'events', key: `events:${competitionId}`, ttl: 300 }; // 5 Minutes
    }

    // Level 2: Competitions for Sport
    if (eventType !== "-1") {
        return { level: 'competitions', key: `competitions:${eventType}`, ttl: 1800 }; // 30 Minutes
    }

    return { level: 'unknown', key: 'unknown', ttl: 60 };
}

/**
 * Core function to fetch from provider with internal retry (NO LOCKS HERE)
 */
async function coreFetch(params, retry = true) {
    try {
        const cookie = getCookie();
        if (!cookie) throw new Error("COOKIE_NOT_READY");

        const jsessionid = cookie.split("JSESSIONID=")[1]?.split(";")[0];
        if (!jsessionid) throw new Error("INVALID_COOKIE_FORMAT");

        const exactUrl = `${OCER_MENU_API};jsessionid=${jsessionid}`;
        
        const body = new URLSearchParams({
            eventType: params.eventType || "-1",
            competitionId: params.competitionId || "-2",
            eventId: params.eventId || "-1",
            region: params.region || "",
            isManualAddCompetition: params.isManualAddCompetition || "false",
            queryPass: jsessionid
        }).toString();

        const res = await httpClient.post(exactUrl, body, {
            headers: {
                "Authorization": jsessionid,
                "Origin": "https://www.gu21go76.xyz",
                "Referer": "https://www.gu21go76.xyz/",
                "X-Requested-With": "XMLHttpRequest",
                "Cookie": cookie,
                "Source": "1",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            },
            timeout: 20000,
            validateStatus: (status) => status >= 200 && status < 505
        });

        if (
            res.status === 410 || 
            (res.data && (res.data.status === "1001" || res.data.message === "You have logged out!! Please login and try again!!"))
        ) {
            throw new Error("NOT_AUTHORIZED");
        }

        return res.data;
    } catch (error) {
        // 🚑 INTERNAL SELF-HEALING (Keeps waiting clients in line)
        if (retry && (
            error.message === "NOT_AUTHORIZED" || 
            error.message === "COOKIE_NOT_READY" ||
            error.response?.status === 401 ||
            error.response?.status === 410
        )) {
            console.log(`🚑 [MENU_SERVICE] Self-healing activated...`);
            try {
                const token = await login();
                await generateCookie(token);
                await new Promise(r => setTimeout(r, 200));
                return await coreFetch(params, false); // Retry once WITHOUT lock rules
            } catch (retryErr) {
                console.error("❌ [MENU_SERVICE] Self-healing failed:", retryErr.message);
            }
        }
        throw error;
    }
}

/**
 * Main function to fetch menu data with hybrid storage & PROMISE LOCKS
 */
async function fetchMenuData(params) {
    const context = getMenuContext(params);
    const cacheKey = `${CACHE_KEY_PREFIX}${context.key}`;

    // 🕒 1. Check Hot Storage (Redis/MongoDB) first
    try {
        console.log(`[MENU_SERVICE] Checking storage for level: ${context.level}`);
        if (context.level === 'sports') {
            const doc = await SystemConfig.findOne({ key: 'MENU_SPORTS_LIST' });
            if (doc && doc.value) { console.log(`[MENU_SERVICE] Served from DB`); return doc.value; }
        } else {
            const cached = await redisClient.get(cacheKey);
            if (cached) { console.log(`[MENU_SERVICE] Served from Redis`); return JSON.parse(cached); }
        }
    } catch (err) {
        console.error(`⚠️ [MENU_SERVICE] Cache Read Error:`, err.message);
    }

    console.log(`[MENU_SERVICE] Cache miss, checking lock`);
    // 🔒 2. Prevent Thundering Herd
    // If a request for this exact key is already flying, wait in line!
    if (activeRequests.has(cacheKey)) {
        console.log(`[MENU_SERVICE] 🧍‍♂️ Line mein wait kar raha hai (Awaiting active promise).`);
        return activeRequests.get(cacheKey);
    }

    console.log(`[MENU_SERVICE] 🚀 Going to fetch from provider (1st Request)`);
    // Create a new promise for the fetch
    const fetchPromise = (async () => {
        try {
            const providerData = await coreFetch(params, true);

            if (providerData) {
                // 3. Save to Storage (MongoDB / Redis)
                try {
                    if (context.level === 'sports') {
                        await SystemConfig.findOneAndUpdate(
                            { key: 'MENU_SPORTS_LIST' },
                            { value: providerData },
                            { upsert: true }
                        );
                    } else {
                        await redisClient.set(cacheKey, JSON.stringify(providerData), {
                            EX: context.ttl
                        });
                    }
                } catch (saveErr) {
                    console.error("⚠️ [MENU_SERVICE] Failed to save cache:", saveErr.message);
                }
                return providerData;
            }
        } finally {
            // 🔓 Always Open the Lock Gate when DONE!
            activeRequests.delete(cacheKey);
        }
    })();

    // Store the flying promise so other requests can stand in line
    activeRequests.set(cacheKey, fetchPromise);

    try {
        return await fetchPromise;
    } catch (error) {
        console.error(`❌ [MENU_SERVICE] Fetch Error:`, error.message);
        
        // 🔄 4. GRACEFUL DEGRADATION: Try to serve stale data if provider totally fails
        try {
            if (context.level === 'sports') {
                const doc = await SystemConfig.findOne({ key: 'MENU_SPORTS_LIST' });
                if (doc && doc.value) return doc.value;
            }
        } catch (staleErr) {}
    }
    return null;
}

module.exports = { fetchMenuData };
