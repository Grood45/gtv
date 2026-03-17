const axios = require('axios');
const redisClient = require('../utils/redis');
const { getCookie, generateCookie } = require('../controllers/cookie.controller');
const { login } = require('../controllers/auth.controller');
const { SPORT_EVENTS_API } = require('../config/config');

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

        const body = new URLSearchParams({
            eventType: String(sportId),
            eventTs: "-1",
            marketTs: "-1",
            selectionTs: "-1",
            collectEventIds: "",
            queryPass: queryPass
        }).toString();

        const res = await axios.post(SPORT_EVENTS_API, body, {
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
            timeout: 20000,
            validateStatus: (status) => status >= 200 && status < 500
        });

        if (res.status === 410 || (res.data && res.data.message === "You have logged out!! Please login and try again!!")) {
            throw new Error("NOT_AUTHORIZED");
        }

        if (res.data) {
            const cacheKey = `${CACHE_KEY_PREFIX}${sportId}`;
            await redisClient.set(cacheKey, JSON.stringify(res.data), {
                EX: 600 // 10 minutes safety TTL
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
