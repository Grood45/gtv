const axios = require('axios');
const redisClient = require('../utils/redis');
const { getCookie, generateCookie } = require('../controllers/cookie.controller');
const { login } = require('../controllers/auth.controller');
const { FULL_MARKETS_API } = require('../config/config');

const CACHE_KEY_PREFIX = 'full_markets:';

/**
 * Fetch Full Markets for a specific event ID and market ID and cache in Redis
 * @param {string|number} eventId - The ID of the event
 * @param {string} marketId - The ID of the market
 */
async function fetchAndCacheFullMarkets(eventId, marketId, retry = true) {
    try {
        const cookie = getCookie();
        if (!cookie) {
            throw new Error("COOKIE_NOT_READY");
        }

        const queryPass = cookie.split("JSESSIONID=")[1]?.split(";")[0];
        if (!queryPass) {
            throw new Error("INVALID_COOKIE_FORMAT");
        }

        const body = new URLSearchParams({
            eventId: String(eventId),
            marketId: String(marketId),
            queryPass: queryPass
        }).toString();

        const res = await axios.post(FULL_MARKETS_API, body, {
            headers: {
                "Host": "saapipl.gu21go76.xyz",
                "Accept": "application/json, text/javascript, */*; q=0.01",
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "Origin": "https://bxawscf.skyinplay.com",
                "Referer": "https://bxawscf.skyinplay.com/",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "X-Requested-With": "XMLHttpRequest",
                "Cookie": cookie
            },
            timeout: 10000,
            validateStatus: (status) => status >= 200 && status < 500
        });

        if (res.status === 410 || (res.data && res.data.message === "You have logged out!! Please login and try again!!")) {
            throw new Error("NOT_AUTHORIZED");
        }

        if (res.data) {
            const cacheKey = `${CACHE_KEY_PREFIX}${eventId}:${marketId}`;
            // Cache for 2 seconds for real-time accuracy
            await redisClient.set(cacheKey, JSON.stringify(res.data), {
                EX: 2
            });
            console.log(`✅ [REDIS] Cached Full Markets for event: ${eventId}, market: ${marketId}`);
            return res.data;
        }

    } catch (error) {
        console.error(`❌ Error fetching Full Markets for event ${eventId}:`, error.message);

        // 🔄 SELF-HEALING: Retry ONCE if unauthorized
        if (retry && (
            error.message === "NOT_AUTHORIZED" || 
            error.message === "COOKIE_NOT_READY" ||
            error.response?.status === 401 ||
            error.response?.status === 410
        )) {
            console.log(`🚑 [FULL_MARKETS] Self-healing activated for event ${eventId}...`);
            try {
                const token = await login();
                await generateCookie(token);
                return await fetchAndCacheFullMarkets(eventId, marketId, false);
            } catch (retryErr) {
                console.error("❌ Self-healing failed for full markets:", retryErr.message);
            }
        }
    }
    return null;
}

async function getCachedFullMarkets(eventId, marketId) {
    try {
        const cacheKey = `${CACHE_KEY_PREFIX}${eventId}:${marketId}`;
        const cachedData = await redisClient.get(cacheKey);
        return cachedData ? JSON.parse(cachedData) : null;
    } catch (error) {
        console.error(`❌ Error getting cached Full Markets for event ${eventId}:`, error.message);
        return null;
    }
}

module.exports = {
    fetchAndCacheFullMarkets,
    getCachedFullMarkets
};
