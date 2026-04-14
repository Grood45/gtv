const redisClient = require('../utils/redis');
const httpClient = require('../utils/httpClient');
const { getNextProxy, parseProxy } = require('./proxy.service');
const { getCookie, generateCookie } = require('../controllers/cookie.controller');
const { login } = require('../controllers/auth.controller');
const { BOOKMAKER_API, DEFAULT_ORIGIN, DEFAULT_REFERER } = require('../config/config');

const CACHE_KEY_PREFIX = 'bookmaker:';
const L1_CACHE = new Map();
const L1_TTL = 1500; // 1.5s TTL for Bookmaker

/**
 * Fetch Bookmaker Markets for a specific event ID and cache in Redis + L1
 */
async function fetchAndCacheBookmaker(eventId, retry = true) {
    try {
        const cookie = getCookie();
        if (!cookie) throw new Error("COOKIE_NOT_READY");

        const queryPass = cookie.split("JSESSIONID=")[1]?.split(";")[0];
        if (!queryPass) throw new Error("INVALID_COOKIE_FORMAT");

        // 🕵️ URL-based JSessionID for modern Cloudflare bypass
        const exactUrl = `${BOOKMAKER_API};jsessionid=${queryPass}`;

        const body = new URLSearchParams({
            eventId: String(eventId),
            queryPass: queryPass
        }).toString();

        const proxyUrl = getNextProxy();
        console.log(`📡 [BOOKMAKER] Fetching fresh data for Event: ${eventId}`);

        const config = {
            headers: {
                "Authorization": queryPass,
                "Cookie": cookie,
                "Origin": DEFAULT_ORIGIN,
                "Referer": DEFAULT_REFERER,
                "X-Requested-With": "XMLHttpRequest",
                "Source": "1"
            },
            validateStatus: (status) => status === 200 || status === 410
        };

        if (proxyUrl) config.proxy = parseProxy(proxyUrl);

        const res = await httpClient.post(exactUrl, body, config);

        if (res.status === 410 || (res.data && res.data.message === "You have logged out!! Please login and try again!!")) {
            throw new Error("NOT_AUTHORIZED");
        }

        if (res.data) {
            const cacheKey = `${CACHE_KEY_PREFIX}${eventId}`;
            const envelope = { savedAt: Date.now(), payload: res.data };
            L1_CACHE.set(cacheKey, { data: res.data, expiry: Date.now() + L1_TTL });
            await redisClient.set(cacheKey, JSON.stringify(envelope), { EX: 86400 }); // 24H Backup Profile
            console.log(`✅ [BOOKMAKER] Cache updated (SelectionTS: ${res.data?.selectionTs || 'N/A'})`);
            return res.data;
        }

    } catch (error) {
        if (retry && (error.message === "NOT_AUTHORIZED" || error.message === "COOKIE_NOT_READY")) {
            try {
                const token = await login();
                await generateCookie(token);
                await new Promise(r => setTimeout(r, 200));
                return await fetchAndCacheBookmaker(eventId, false);
            } catch (e) {}
        }
        
        // STALE-IF-ERROR FALLBACK TRIGGER
        try {
            const cacheKey = `${CACHE_KEY_PREFIX}${eventId}`;
            const backup = await redisClient.get(cacheKey);
            if (backup) {
                const envelope = JSON.parse(backup);
                console.log(`🛡️ [BOOKMAKER] API Failed (${error.message}). Returning STALE 24H Backup for Event: ${eventId}`);
                return envelope.payload || envelope;
            }
        } catch (fallbackError) {}

        console.error(`❌ [BOOKMAKER] Error ${eventId}:`, error.message);
    }
    return null;
}

async function getCachedBookmaker(eventId) {
    const cacheKey = `${CACHE_KEY_PREFIX}${eventId}`;
    const l1Entry = L1_CACHE.get(cacheKey);
    if (l1Entry && l1Entry.expiry > Date.now()) return l1Entry.data;

    try {
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
            const envelope = JSON.parse(cachedData);
            if (envelope.savedAt && envelope.payload) {
                if (Date.now() - envelope.savedAt < 2000) { // Fresh (< 2s)
                    L1_CACHE.set(cacheKey, { data: envelope.payload, expiry: Date.now() + L1_TTL });
                    return envelope.payload;
                }
                return null; // Return null so fetchAndCache triggers
            }
            L1_CACHE.set(cacheKey, { data: envelope, expiry: Date.now() + L1_TTL });
            return envelope; // Legacy fallback
        }
    } catch (e) {}
    return null;
}

module.exports = {
    fetchAndCacheBookmaker,
    getCachedBookmaker
};
