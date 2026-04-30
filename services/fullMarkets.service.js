const axios = require('axios');
const redisClient = require('../utils/redis');
const { getCookie, generateCookie } = require('../controllers/cookie.controller');
const { login } = require('../controllers/auth.controller');
const { FULL_MARKETS_API, DEFAULT_ORIGIN, DEFAULT_REFERER } = require('../config/config');

const CACHE_KEY_PREFIX = 'full_markets:';
const L1_CACHE = new Map();
const L1_TTL = 800; // 800ms TTL

// 🛡️ STAMPEDE LOCK (Mutex Map)
const inFlightRequests = new Map();

/**
 * Fetch Full Markets for a specific event ID and market ID and cache in Redis + L1
 */
async function fetchAndCacheFullMarkets(eventId, marketId, retry = true) {
    const lockKey = `${eventId}:${marketId}`;
    
    // 🛡️ 1. STAMPEDE LOCK: If an identical request is already mid-flight, await it instead of firing a 9Wicket request.
    if (inFlightRequests.has(lockKey)) {
        return inFlightRequests.get(lockKey);
    }

    const fetchPromise = (async () => {
        try {
        const cookie = getCookie();
        if (!cookie) throw new Error("COOKIE_NOT_READY");

        const queryPass = cookie.split("JSESSIONID=")[1]?.split(";")[0];
        if (!queryPass) throw new Error("INVALID_COOKIE_FORMAT");

        const exactUrl = FULL_MARKETS_API;

        const body = new URLSearchParams({
            eventId: String(eventId),
            marketId: String(marketId),
            queryPass: queryPass
        }).toString();

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
            timeout: 15000,
            validateStatus: (status) => status === 200 || status === 410
        });

        if (res.status === 410 || (res.data && res.data.message === "You have logged out!! Please login and try again!!")) {
            throw new Error("NOT_AUTHORIZED");
        }

        // 🛡️ 2. EXPERT SYNC: Always update cache if status is 200, even if data is empty
        const finalData = res.data || { market: null };
        const cacheKey = `${CACHE_KEY_PREFIX}${eventId}:${marketId}`;
        const envelope = { savedAt: Date.now(), payload: finalData };
        L1_CACHE.set(cacheKey, { data: finalData, expiry: Date.now() + L1_TTL });
        await redisClient.set(cacheKey, JSON.stringify(envelope), { EX: 86400 });
        return finalData;

    } catch (error) {
        if (retry && (error.message === "NOT_AUTHORIZED" || error.message === "COOKIE_NOT_READY")) {
            try {
                const token = await login();
                await generateCookie();
                await new Promise(r => setTimeout(r, 200));
                return await fetchAndCacheFullMarkets(eventId, marketId, false);
            } catch (e) {}
        }
        
        // STALE-IF-ERROR FALLBACK (Limited to 10s)
        try {
            const cacheKey = `${CACHE_KEY_PREFIX}${eventId}:${marketId}`;
            const backupStr = await redisClient.get(cacheKey);
            if (backupStr) {
                const envelope = JSON.parse(backupStr);
                if (Date.now() - envelope.savedAt < 1000) {
                    return envelope.payload || envelope;
                }
            }
        } catch (fallbackError) {}
        
        console.error(`❌ [FULL_MARKETS] Error ${eventId}:`, error.message);
    }
    return null;
    })();

    // Set the lock
    inFlightRequests.set(lockKey, fetchPromise);
    
    try {
        const result = await fetchPromise;
        return result;
    } finally {
        // Clear the lock immediately after the promise resolves or rejects
        inFlightRequests.delete(lockKey);
    }
}

async function getCachedFullMarkets(eventId, marketId) {
    const cacheKey = `${CACHE_KEY_PREFIX}${eventId}:${marketId}`;
    const l1Entry = L1_CACHE.get(cacheKey);
    if (l1Entry && l1Entry.expiry > Date.now()) return l1Entry.data;

    try {
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
            const envelope = JSON.parse(cachedData);
            if (envelope.payload) {
                L1_CACHE.set(cacheKey, { data: envelope.payload, expiry: Date.now() + L1_TTL });
                return envelope.payload; // Always return from cache, ignore age bounds to prevent stampede
            }
            L1_CACHE.set(cacheKey, { data: envelope, expiry: Date.now() + L1_TTL });
            return envelope; // Legacy fallback
        }
    } catch (e) {}
    return null;
}

module.exports = { fetchAndCacheFullMarkets, getCachedFullMarkets };
