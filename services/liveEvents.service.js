const axios = require('axios');
const redisClient = require('../utils/redis');
const { getCookie } = require('../controllers/cookie.controller');
const { EVENTS_API, DEFAULT_ORIGIN, DEFAULT_REFERER } = require('../config/config');

const CACHE_KEYS = {
    INPLAY: 'events:inplay',
    TODAY: 'events:today',
    TOMORROW: 'events:tomorrow'
};

/**
 * Fetch events from Skyinplay API and cache in Redis
 * @param {string} type - 'inplay', 'today', or 'tomorrow'
 */
async function fetchAndCacheEvents(type) {
    try {
        const cookie = getCookie();
        if (!cookie) {
            console.log(`⚠️ Cookie not ready, skipping ${type} events fetch`);
            return null;
        }

        const queryPass = cookie.split("JSESSIONID=")[1]?.split(";")[0];
        if (!queryPass) {
            console.log(`⚠️ Invalid cookie format, skipping ${type} events fetch`);
            return null;
        }

        // Clean URL (no semicolon for Bigwin compatibility)
        const exactUrl = EVENTS_API;

        const body = new URLSearchParams({
            type: type, // 'inplay', 'today', 'tomorrow'
            eventType: "-1",
            eventTs: "-1",
            marketTs: "-1",
            selectionTs: "-1",
            collectEventIds: "",
            queryPass: queryPass
        }).toString();

        const res = await axios.post(exactUrl, body, {
            headers: {
                "Accept": "application/json, text/plain, */*",
                "Authorization": queryPass,
                "Origin": DEFAULT_ORIGIN,
                "Referer": DEFAULT_REFERER,
                "X-Requested-With": "XMLHttpRequest",
                "Cookie": cookie,
                "Content-Type": "application/x-www-form-urlencoded",
                "Source": "1",
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36"
            },
            timeout: 20000,
            validateStatus: (status) => status === 200
        });

        if (res.data) {
            const cacheKey = CACHE_KEYS[type.toUpperCase()];
            await redisClient.set(cacheKey, JSON.stringify(res.data), {
                EX: 86400 // 24 Hours Backup TTL
            });
            console.log(`✅ [REDIS] Cached ${type} events`);
            return res.data;
        }

    } catch (error) {
        console.error(`❌ Error fetching ${type} events:`, error.message);
    }
    return null;
}

async function refreshAllEvents() {
    console.log('🌐 Refreshing All Events (Inplay, Today, Tomorrow)...');
    await Promise.all([
        fetchAndCacheEvents('inplay'),
        fetchAndCacheEvents('today'),
        fetchAndCacheEvents('tomorrow')
    ]);
}

async function getCachedEvents(type) {
    try {
        const cacheKey = CACHE_KEYS[type.toUpperCase()];
        const cachedData = await redisClient.get(cacheKey);
        return cachedData ? JSON.parse(cachedData) : null;
    } catch (error) {
        console.error(`❌ Error getting cached ${type} events:`, error.message);
        return null;
    }
}

module.exports = {
    fetchAndCacheEvents,
    refreshAllEvents,
    getCachedEvents
};
