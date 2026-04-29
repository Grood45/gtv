const axios = require('axios');
const redisClient = require('../utils/redis');
const { getValidCookie, generateCookie } = require('../controllers/cookie.controller');
const { login } = require('../controllers/auth.controller');
const { FANCY_RESULT_API, EVENT_RESULTS_API, DEFAULT_ORIGIN, DEFAULT_REFERER } = require('../config/config');

const FANCY_CACHE_PREFIX = 'result:fancy:';
const EVENT_CACHE_PREFIX = 'result:event:';
const CACHE_TTL = 600; // 10 minutes

// 🛡️ STAMPEDE LOCK (Mutex Map)
const inFlightRequests = new Map();

/**
 * Helper to check if response data is useful/valid
 * Returns true if data is an array with at least one item
 */
function isValidData(data) {
    if (!data) return false;
    if (Array.isArray(data)) return data.length > 0;
    if (typeof data === 'object') return Object.keys(data).length > 0;
    return false;
}

/**
 * Fetch results for a specific Fancy market
 * @param {string|number} eventId - The ID of the event
 */
async function fetchFancyResult(eventId, retry = true) {
    const lockKey = `fancy:${eventId}`;

    // 🛡️ 1. STAMPEDE LOCK
    if (inFlightRequests.has(lockKey)) {
        return inFlightRequests.get(lockKey);
    }

    const fetchPromise = (async () => {
        try {
            const cacheKey = `${FANCY_CACHE_PREFIX}${eventId}`;
            
            // 🔎 2. CHECK CACHE FIRST
            const cachedData = await redisClient.get(cacheKey);
            
            // Note: Even if we have cache, we might want to refresh, 
            // but for now let's serve cache if it exists.
            if (cachedData && isValidData(JSON.parse(cachedData))) {
                // If it's valid data, return it immediately
                return JSON.parse(cachedData);
            }

            // 🍪 3. GET ROBUST COOKIE
            const cookie = await getValidCookie();
            if (!cookie) throw new Error("COOKIE_NOT_READY");

            const queryPass = cookie.split("JSESSIONID=")[1]?.split(";")[0];
            if (!queryPass) throw new Error("INVALID_COOKIE_FORMAT");

            const exactUrl = FANCY_RESULT_API;
            const body = new URLSearchParams({
                eventId: String(eventId),
                marketGroup: "1"
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
                timeout: 15000, // Reduced timeout for better UX
                validateStatus: (status) => status === 200 || status === 410
            });

            if (res.status === 410 || (res.data && res.data.message === "You have logged out!! Please login and try again!!")) {
                throw new Error("NOT_AUTHORIZED");
            }

            // 🛡️ 4. EXPERT SYNC: Always update cache with fresh provider data (even if empty)
            // This prevents "stuck" markets when the provider settles and removes them.
            console.log(`✅ [FANCY_RESULT] Fresh data received for ${eventId}. Updating cache.`);
            await redisClient.set(cacheKey, JSON.stringify(res.data), { EX: CACHE_TTL });
            return res.data;

        } catch (error) {
            console.error(`❌ Error fetching fancy results for event ID ${eventId}:`, error.message);

            // 🔄 SELF-HEALING: Retry ONCE if unauthorized
            if (retry && (
                error.message === "NOT_AUTHORIZED" || 
                error.message === "COOKIE_NOT_READY" ||
                error.response?.status === 401 ||
                error.response?.status === 410
            )) {
                console.log(`🚑 [FANCY_RESULT] Self-healing activated for event ${eventId}...`);
                try {
                    await login();
                    await generateCookie();
                    return await fetchFancyResult(eventId, false);
                } catch (retryErr) {
                    console.error("❌ Self-healing failed for fancy result:", retryErr.message);
                }
            }
            throw error;
        }
    })();

    inFlightRequests.set(lockKey, fetchPromise);
    try {
        return await fetchPromise;
    } finally {
        inFlightRequests.delete(lockKey);
    }
}

/**
 * Fetch general event results
 * @param {string} type - Timeframe ("today" or "yesterday")
 * @param {string|number} sportId - The ID of the sport
 */
async function fetchEventResults(type = "today", sportId = "4", retry = true) {
    const lockKey = `event:${type}:${sportId}`;

    // 🛡️ 1. STAMPEDE LOCK
    if (inFlightRequests.has(lockKey)) {
        return inFlightRequests.get(lockKey);
    }

    const fetchPromise = (async () => {
        try {
            const cacheKey = `${EVENT_CACHE_PREFIX}${type}:${sportId}`;

            // 🔎 2. CHECK CACHE FIRST
            const cachedData = await redisClient.get(cacheKey);
            if (cachedData && isValidData(JSON.parse(cachedData))) {
                return JSON.parse(cachedData);
            }

            // 🍪 3. GET ROBUST COOKIE
            const cookie = await getValidCookie();
            if (!cookie) throw new Error("COOKIE_NOT_READY");

            const queryPass = cookie.split("JSESSIONID=")[1]?.split(";")[0];
            if (!queryPass) throw new Error("INVALID_COOKIE_FORMAT");

            const exactUrl = EVENT_RESULTS_API;
            const body = new URLSearchParams({
                type: String(type),
                sport: String(sportId)
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

            // 🛡️ 4. SMART GUARD
            if (isValidData(res.data)) {
                await redisClient.set(cacheKey, JSON.stringify(res.data), { EX: CACHE_TTL });
                return res.data;
            } else if (cachedData) {
                return JSON.parse(cachedData);
            }
            
            return res.data;

        } catch (error) {
            console.error(`❌ Error fetching event results for sport ${sportId} (${type}):`, error.message);

            // 🔄 SELF-HEALING
            if (retry && (
                error.message === "NOT_AUTHORIZED" || 
                error.message === "COOKIE_NOT_READY" ||
                error.response?.status === 401 ||
                error.response?.status === 410
            )) {
                console.log(`🚑 [EVENT_RESULTS] Self-healing activated...`);
                try {
                    await login();
                    await generateCookie();
                    return await fetchEventResults(type, sportId, false);
                } catch (retryErr) {
                    console.error("❌ Self-healing failed for event results:", retryErr.message);
                }
            }
            throw error;
        }
    })();

    inFlightRequests.set(lockKey, fetchPromise);
    try {
        return await fetchPromise;
    } finally {
        inFlightRequests.delete(lockKey);
    }
}

module.exports = {
    fetchFancyResult,
    fetchEventResults
};
