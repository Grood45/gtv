const redisClient = require('../utils/redis');
const httpClient = require('../utils/httpClient');
const { getCookie, generateCookie } = require('../controllers/cookie.controller');
const { login } = require('../controllers/auth.controller');
const { FANCY_RESULT_API, EVENT_RESULTS_API, DEFAULT_ORIGIN, DEFAULT_REFERER } = require('../config/config');
const { getNextProxy, parseProxy } = require('./proxy.service');

const FANCY_CACHE_PREFIX = 'result:fancy:';
const EVENT_CACHE_PREFIX = 'result:event:';
const CACHE_TTL = 600; // 10 minutes

// 🛡️ STAMPEDE LOCK (Mutex Map)
const inFlightRequests = new Map();

/**
 * Fetch results for a specific Fancy market
 * @param {string|number} eventId - The ID of the event
 */
async function fetchFancyResult(eventId, retry = true) {
    const lockKey = `fancy:${eventId}`;

    // 🛡️ 1. STAMPEDE LOCK: If an identical request is already mid-flight, await it.
    if (inFlightRequests.has(lockKey)) {
        return inFlightRequests.get(lockKey);
    }

    const fetchPromise = (async () => {
        try {
            // 🔎 2. CHECK CACHE FIRST
            const cacheKey = `${FANCY_CACHE_PREFIX}${eventId}`;
            const cachedData = await redisClient.get(cacheKey);
            if (cachedData) {
                // console.log(`💾 [FANCY_RESULT] Serving from cache: ${eventId}`);
                return JSON.parse(cachedData);
            }

            const cookie = getCookie();
            if (!cookie) throw new Error("COOKIE_NOT_READY");

            const queryPass = cookie.split("JSESSIONID=")[1]?.split(";")[0];
            if (!queryPass) throw new Error("INVALID_COOKIE_FORMAT");

            const exactUrl = `${FANCY_RESULT_API};jsessionid=${queryPass}`;

            const body = new URLSearchParams({
                eventId: String(eventId),
                marketGroup: "1"
            }).toString();

            const proxyUrl = getNextProxy();
            const config = {
                headers: {
                    "Authorization": queryPass,
                    "Cookie": cookie,
                    "Origin": DEFAULT_ORIGIN,
                    "Referer": DEFAULT_REFERER,
                    "X-Requested-With": "XMLHttpRequest",
                    "Source": "1"
                },
                timeout: 20000,
                validateStatus: (status) => status === 200 || status === 410
            };

            if (proxyUrl) config.proxy = parseProxy(proxyUrl);

            const res = await httpClient.post(exactUrl, body, config);

            if (res.status === 410 || (res.data && res.data.message === "You have logged out!! Please login and try again!!")) {
                throw new Error("NOT_AUTHORIZED");
            }

            // ✅ 3. CACHE SUCCESSFUL RESPONSE
            if (res.data) {
                await redisClient.set(cacheKey, JSON.stringify(res.data), { EX: CACHE_TTL });
                // console.log(`✅ [FANCY_RESULT] Cache updated for event ${eventId}`);
            }

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
                    const token = await login();
                    await generateCookie(token);
                    await new Promise(r => setTimeout(r, 200));
                    return await fetchFancyResult(eventId, false);
                } catch (retryErr) {
                    console.error("❌ Self-healing failed for fancy result:", retryErr.message);
                }
            }
            throw error;
        }
    })();

    // Set the lock
    inFlightRequests.set(lockKey, fetchPromise);
    
    try {
        return await fetchPromise;
    } finally {
        // Clear the lock immediately after resolution/rejection
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
            // 🔎 2. CHECK CACHE FIRST
            const cacheKey = `${EVENT_CACHE_PREFIX}${type}:${sportId}`;
            const cachedData = await redisClient.get(cacheKey);
            if (cachedData) {
                // console.log(`💾 [EVENT_RESULTS] Serving from cache: ${sportId} (${type})`);
                return JSON.parse(cachedData);
            }

            const cookie = getCookie();
            if (!cookie) throw new Error("COOKIE_NOT_READY");

            const queryPass = cookie.split("JSESSIONID=")[1]?.split(";")[0];
            if (!queryPass) throw new Error("INVALID_COOKIE_FORMAT");

            const exactUrl = `${EVENT_RESULTS_API};jsessionid=${queryPass}`;

            const body = new URLSearchParams({
                type: String(type),
                sport: String(sportId)
            }).toString();

            const proxyUrl = getNextProxy();
            const config = {
                headers: {
                    "Authorization": queryPass,
                    "Cookie": cookie,
                    "Origin": DEFAULT_ORIGIN,
                    "Referer": DEFAULT_REFERER,
                    "X-Requested-With": "XMLHttpRequest",
                    "Source": "1"
                },
                timeout: 20000,
                validateStatus: (status) => status === 200 || status === 410
            };

            if (proxyUrl) config.proxy = parseProxy(proxyUrl);

            const res = await httpClient.post(exactUrl, body, config);

            if (res.status === 410 || (res.data && res.data.message === "You have logged out!! Please login and try again!!")) {
                throw new Error("NOT_AUTHORIZED");
            }

            // ✅ 3. CACHE SUCCESSFUL RESPONSE
            if (res.data) {
                await redisClient.set(cacheKey, JSON.stringify(res.data), { EX: CACHE_TTL });
                // console.log(`✅ [EVENT_RESULTS] Cache updated for sport ${sportId}`);
            }

            return res.data;

        } catch (error) {
            console.error(`❌ Error fetching event results for sport ${sportId} (${type}):`, error.message);

            // 🔄 SELF-HEALING: Retry ONCE if unauthorized
            if (retry && (
                error.message === "NOT_AUTHORIZED" || 
                error.message === "COOKIE_NOT_READY" ||
                error.response?.status === 401 ||
                error.response?.status === 410
            )) {
                console.log(`🚑 [EVENT_RESULTS] Self-healing activated...`);
                try {
                    const token = await login();
                    await generateCookie(token);
                    await new Promise(r => setTimeout(r, 200));
                    return await fetchEventResults(type, sportId, false);
                } catch (retryErr) {
                    console.error("❌ Self-healing failed for event results:", retryErr.message);
                }
            }
            throw error;
        }
    })();

    // Set the lock
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
