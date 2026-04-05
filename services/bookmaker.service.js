const redisClient = require('../utils/redis');
const httpClient = require('../utils/httpClient');
const { getNextProxy, parseProxy } = require('./proxy.service');
const { getCookie, generateCookie } = require('../controllers/cookie.controller');
const { login } = require('../controllers/auth.controller');
const { BOOKMAKER_API } = require('../config/config');

const CACHE_KEY_PREFIX = 'bookmaker:';

// 🚀 L1 MEMORY CACHE
const L1_CACHE = new Map();
const L1_TTL = 1500; // 1.5s TTL for Bookmaker

/**
 * Fetch Bookmaker Markets for a specific event ID and cache in Redis + L1
 * @param {string|number} eventId - The ID of the event
 */
async function fetchAndCacheBookmaker(eventId, retry = true) {
    try {
        const cookie = getCookie();
        if (!cookie) throw new Error("COOKIE_NOT_READY");

        const queryPass = cookie.split("JSESSIONID=")[1]?.split(";")[0];
        if (!queryPass) throw new Error("INVALID_COOKIE_FORMAT");

        const body = new URLSearchParams({
            eventId: String(eventId),
            queryPass: queryPass
        }).toString();

        const proxyUrl = getNextProxy();
        console.log(`📡 [BOOKMAKER] Fetching fresh data for Event: ${eventId}`);

        const config = {
            headers: {
                "Host": "saapipl.gu21go76.xyz",
                "Origin": "https://bxawscf.skyinplay.com",
                "Referer": "https://bxawscf.skyinplay.com/",
                "Cookie": cookie,
                "X-Requested-With": "XMLHttpRequest",
                "source": "1"
            },
            validateStatus: (status) => status >= 200 && status < 500
        };

        if (proxyUrl) config.proxy = parseProxy(proxyUrl);

        const res = await httpClient.post(BOOKMAKER_API, body, config);

        if (res.status === 410 || (res.data && res.data.message === "You have logged out!! Please login and try again!!")) {
            throw new Error("NOT_AUTHORIZED");
        }

        if (res.data) {
            const cacheKey = `${CACHE_KEY_PREFIX}${eventId}`;
            
            // 1. Update L1
            L1_CACHE.set(cacheKey, { data: res.data, expiry: Date.now() + L1_TTL });

            // 2. Update Redis L2
            await redisClient.set(cacheKey, JSON.stringify(res.data), { EX: 2 });
            console.log(`✅ [BOOKMAKER] Cache updated (SelectionTS: ${res.data?.selectionTs || 'N/A'})`);
            
            return res.data;
        }

    } catch (error) {
        if (retry && (error.message === "NOT_AUTHORIZED" || error.message === "COOKIE_NOT_READY")) {
            try {
                const token = await login();
                await generateCookie(token);
                // 🚀 Expert Buffer: Allow session to propagate (200ms)
                await new Promise(r => setTimeout(r, 200));
                return await fetchAndCacheBookmaker(eventId, false);
            } catch (e) {}
        }
        console.error(`❌ [BOOKMAKER] Error ${eventId}:`, error.message);
    }
    return null;
}

async function getCachedBookmaker(eventId) {
    const cacheKey = `${CACHE_KEY_PREFIX}${eventId}`;

    // Try L1
    const l1Entry = L1_CACHE.get(cacheKey);
    if (l1Entry && l1Entry.expiry > Date.now()) return l1Entry.data;

    // Fallback Redis
    try {
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
            const data = JSON.parse(cachedData);
            L1_CACHE.set(cacheKey, { data, expiry: Date.now() + L1_TTL });
            return data;
        }
    } catch (e) {}

    return null;
}

module.exports = {
    fetchAndCacheBookmaker,
    getCachedBookmaker
};
