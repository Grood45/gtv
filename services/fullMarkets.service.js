const redisClient = require('../utils/redis');
const httpClient = require('../utils/httpClient');
const { getNextProxy, parseProxy } = require('./proxy.service');
const { getCookie, generateCookie } = require('../controllers/cookie.controller');
const { login } = require('../controllers/auth.controller');
const { FULL_MARKETS_API, DEFAULT_ORIGIN, DEFAULT_REFERER } = require('../config/config');

const CACHE_KEY_PREFIX = 'full_markets:';
const L1_CACHE = new Map();
const L1_TTL = 800; // 800ms TTL

/**
 * Fetch Full Markets for a specific event ID and market ID and cache in Redis + L1
 */
async function fetchAndCacheFullMarkets(eventId, marketId, retry = true) {
    try {
        const cookie = getCookie();
        if (!cookie) throw new Error("COOKIE_NOT_READY");

        const queryPass = cookie.split("JSESSIONID=")[1]?.split(";")[0];
        if (!queryPass) throw new Error("INVALID_COOKIE_FORMAT");

        // 🕵️ Expert URL Refactor: Include ;jsessionid in the URL path
        const exactUrl = `${FULL_MARKETS_API};jsessionid=${queryPass}`;

        const body = new URLSearchParams({
            eventId: String(eventId),
            marketId: String(marketId),
            queryPass: queryPass
        }).toString();

        const proxyUrl = getNextProxy();
        console.log(`📡 [FULL_MARKETS] Fetching fresh data for Market: ${marketId} (Event: ${eventId})`);
        
        const config = {
            headers: {
                "Authorization": queryPass,
                "Cookie": cookie,
                "Origin": DEFAULT_ORIGIN,
                "Referer": DEFAULT_REFERER,
                "X-Requested-With": "XMLHttpRequest",
                "Source": "1"
            },
            validateStatus: (status) => status >= 200 && status < 500
        };

        if (proxyUrl) config.proxy = parseProxy(proxyUrl);

        const res = await httpClient.post(exactUrl, body, config);

        if (res.status === 410 || (res.data && res.data.message === "You have logged out!! Please login and try again!!")) {
            throw new Error("NOT_AUTHORIZED");
        }

        if (res.data) {
            const cacheKey = `${CACHE_KEY_PREFIX}${eventId}:${marketId}`;
            L1_CACHE.set(cacheKey, { data: res.data, expiry: Date.now() + L1_TTL });
            await redisClient.set(cacheKey, JSON.stringify(res.data), { EX: 2 });
            console.log(`✅ [FULL_MARKETS] Cache updated (SelectionTS: ${res.data?.selectionTs || 'N/A'})`);
            return res.data;
        }

    } catch (error) {
        if (retry && (error.message === "NOT_AUTHORIZED" || error.message === "COOKIE_NOT_READY")) {
            try {
                const token = await login();
                await generateCookie(token);
                await new Promise(r => setTimeout(r, 200));
                return await fetchAndCacheFullMarkets(eventId, marketId, false);
            } catch (e) {}
        }
        console.error(`❌ [FULL_MARKETS] Error ${eventId}:`, error.message);
    }
    return null;
}

async function getCachedFullMarkets(eventId, marketId) {
    const cacheKey = `${CACHE_KEY_PREFIX}${eventId}:${marketId}`;
    const l1Entry = L1_CACHE.get(cacheKey);
    if (l1Entry && l1Entry.expiry > Date.now()) return l1Entry.data;

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

module.exports = { fetchAndCacheFullMarkets, getCachedFullMarkets };
