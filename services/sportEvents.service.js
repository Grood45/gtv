const axios = require('axios');
const redisClient = require('../utils/redis');
const httpClient = require('../utils/httpClient');
const { getCookie, generateCookie } = require('../controllers/cookie.controller');
const { login } = require('../controllers/auth.controller');
const { SPORT_EVENTS_API, DEFAULT_ORIGIN, DEFAULT_REFERER } = require('../config/config');

const CACHE_KEY_PREFIX = 'sport_events:';

/**
 * Fetch events for a specific sport ID and cache in Redis
 * @param {string|number} sportId - The ID of the sport (1: Soccer, 2: Tennis, 4: Cricket, 137: E-Soccer)
 */
async function fetchAndCacheSportEvents(sportId, retry = true) {
    try {
        const cookie = getCookie();
        if (!cookie) {
            throw new Error("COOKIE_NOT_READY");
        }

        const queryPass = cookie.split("JSESSIONID=")[1]?.split(";")[0];
        if (!queryPass) {
            throw new Error("INVALID_COOKIE_FORMAT");
        }

        // 🕵️ Expert URL Refactor: semicolon jsessionid
        const exactUrl = `${SPORT_EVENTS_API};jsessionid=${queryPass}`;

        const body = new URLSearchParams({
            eventType: String(sportId),
            eventTs: "-1",
            marketTs: "-1",
            selectionTs: "-1",
            collectEventIds: "",
            queryPass: queryPass
        }).toString();

        const res = await httpClient.post(exactUrl, body, {
            headers: {
                "Authorization": queryPass,
                "Origin": DEFAULT_ORIGIN,
                "Referer": DEFAULT_REFERER,
                "X-Requested-With": "XMLHttpRequest",
                "Cookie": cookie,
                "Source": "1"
            },
            timeout: 20000,
            validateStatus: (status) => status === 200
        });

        if (res.status === 410 || (res.data && res.data.message === "You have logged out!! Please login and try again!!")) {
            throw new Error("NOT_AUTHORIZED");
        }

        if (res.data) {
            const cacheKey = `${CACHE_KEY_PREFIX}${sportId}`;
            await redisClient.set(cacheKey, JSON.stringify(res.data), {
                EX: 86400 // 24 Hours Backup TTL
            });
            console.log(`✅ [REDIS] Cached events for sport ID: ${sportId}`);
            return res.data;
        }

    } catch (error) {
        console.error(`❌ Error fetching sport events for ID ${sportId}:`, error.message);

        // 🔄 SELF-HEALING: Retry ONCE if unauthorized
        if (retry && (
            error.message === "NOT_AUTHORIZED" || 
            error.message === "COOKIE_NOT_READY" ||
            error.response?.status === 401 ||
            error.response?.status === 410
        )) {
            console.log(`🚑 [SPORT_EVENTS] Self-healing activated for sport ${sportId}...`);
            try {
                const token = await login();
                await generateCookie(token);
                // 🚀 Propagation delay for listing API too
                await new Promise(r => setTimeout(r, 200));
                return await fetchAndCacheSportEvents(sportId, false);
            } catch (retryErr) {
                console.error("❌ Self-healing failed for sport events:", retryErr.message);
            }
        }
    }
    return null;
}

async function getCachedSportEvents(sportId) {
    try {
        const cacheKey = `${CACHE_KEY_PREFIX}${sportId}`;
        const cachedData = await redisClient.get(cacheKey);
        return cachedData ? JSON.parse(cachedData) : null;
    } catch (error) {
        console.error(`❌ Error getting cached sport events for ID ${sportId}:`, error.message);
        return null;
    }
}

async function refreshAllSportEvents() {
    const sportIds = [1, 2, 4, 137];
    console.log(`🌐 Refreshing Sport Events for IDs: ${sportIds.join(', ')}...`);
    for (const id of sportIds) {
        await fetchAndCacheSportEvents(id);
        // Small delay to avoid hammering
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}

module.exports = {
    fetchAndCacheSportEvents,
    getCachedSportEvents,
    refreshAllSportEvents
};
