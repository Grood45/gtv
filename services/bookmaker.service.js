const axios = require('axios');
const redisClient = require('../utils/redis');
const { getCookie, generateCookie } = require('../controllers/cookie.controller');
const { login } = require('../controllers/auth.controller');
const { BOOKMAKER_API, DEFAULT_ORIGIN, DEFAULT_REFERER } = require('../config/config');

const CACHE_KEY_PREFIX = 'bookmaker:';
const L1_CACHE = new Map();
const L1_TTL = 1000; // 1s TTL for Bookmaker

// 🛡️ STAMPEDE LOCK (Mutex Map)
const inFlightRequests = new Map();

/**
 * Fetch Bookmaker markets for a specific event ID and cache in Redis
 */
async function fetchAndCacheBookmaker(eventId, retry = true) {
    const lockKey = String(eventId);
    
    // 🛡️ 1. STAMPEDE LOCK
    if (inFlightRequests.has(lockKey)) {
        return inFlightRequests.get(lockKey);
    }

    const fetchPromise = (async () => {
        try {
        const cookie = getCookie();
        if (!cookie) throw new Error("COOKIE_NOT_READY");

        const queryPass = cookie.split("JSESSIONID=")[1]?.split(";")[0];
        if (!queryPass) throw new Error("INVALID_COOKIE_FORMAT");

        const exactUrl = BOOKMAKER_API;

        const body = new URLSearchParams({
            eventId: String(eventId),
            queryPass: queryPass
        }).toString();

        console.log(`📡 [BOOKMAKER] Fetching fresh data for Event: ${eventId}`);

        const res = await axios.post(exactUrl, body, {
            headers: {
                "Accept": "application/json, text/plain, */*",
                "Authorization": queryPass,
                "Cookie": cookie,
                "Content-Type": "application/x-www-form-urlencoded",
                "Origin": DEFAULT_ORIGIN,
                "Referer": DEFAULT_REFERER,
                "X-Requested-With": "XMLHttpRequest",
                "Source": "1",
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36"
            },
            validateStatus: (status) => status === 200 || status === 410
        });

        if (res.status === 410 || (res.data && res.data.message === "You have logged out!! Please login and try again!!")) {
            throw new Error("NOT_AUTHORIZED");
        }

        if (res.data) {
            const cacheKey = `${CACHE_KEY_PREFIX}${eventId}`;
            const envelope = { savedAt: Date.now(), payload: res.data };
            L1_CACHE.set(cacheKey, { data: res.data, expiry: Date.now() + L1_TTL });
            await redisClient.set(cacheKey, JSON.stringify(envelope), { EX: 86400 });
            return res.data;
        }

    } catch (error) {
        if (retry && (error.message === "NOT_AUTHORIZED" || error.message === "COOKIE_NOT_READY")) {
            try {
                const token = await login();
                await generateCookie();
                await new Promise(r => setTimeout(r, 200));
                return await fetchAndCacheBookmaker(eventId, false);
            } catch (e) {}
        }
        
        // STALE-IF-ERROR FALLBACK
        try {
            const cacheKey = `${CACHE_KEY_PREFIX}${eventId}`;
            const backup = await redisClient.get(cacheKey);
            if (backup) {
                const envelope = JSON.parse(backup);
                return envelope.payload || envelope;
            }
        } catch (fError) {}
        
        console.error(`❌ [BOOKMAKER] Error ${eventId}:`, error.message);
    }
    return null;
    })();

    inFlightRequests.set(lockKey, fetchPromise);
    
    try {
        return await fetchPromise;
    } finally {
        inFlightRequests.delete(lockKey);
    }
}

async function getCachedBookmaker(eventId) {
    const cacheKey = `${CACHE_KEY_PREFIX}${eventId}`;
    const l1Entry = L1_CACHE.get(cacheKey);
    if (l1Entry && l1Entry.expiry > Date.now()) return l1Entry.data;

    try {
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
            const envelope = JSON.parse(cachedData);
            if (envelope.payload) {
                L1_CACHE.set(cacheKey, { data: envelope.payload, expiry: Date.now() + L1_TTL });
                return envelope.payload;
            }
        }
    } catch (e) {}
    return null;
}

module.exports = { fetchAndCacheBookmaker, getCachedBookmaker };
