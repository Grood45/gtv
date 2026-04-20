const axios = require('axios');
const redisClient = require('../utils/redis');
const { getCookie } = require('../controllers/cookie.controller');
const { LIVE_EVENT_COUNT_API, DEFAULT_ORIGIN, DEFAULT_REFERER } = require('../config/config');

const CACHE_KEY = 'live_event_counts';

async function fetchAndSaveEventCounts() {
    try {
        console.log('🌐 Fetching Live Event Counts from API...');

        const cookie = getCookie();
        if (!cookie) {
            console.log('⚠️ Cookie not ready, skipping event count fetch');
            return null;
        }

        const jsessionid = cookie.split('JSESSIONID=')[1]?.split(';')[0];
        if (!jsessionid) {
            console.log('⚠️ Invalid cookie format, skipping event count fetch');
            return null;
        }

        // Clean URL (no semicolon for Bigwin compatibility)
        const apiUrl = LIVE_EVENT_COUNT_API;

        const res = await axios.get(apiUrl, {
            headers: {
                "Accept": "application/json, text/plain, */*",
                "Authorization": jsessionid,
                "Cookie": cookie,
                "Origin": DEFAULT_ORIGIN,
                "Referer": DEFAULT_REFERER,
                "Source": "1",
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
                "X-Requested-With": "XMLHttpRequest"
            },
            timeout: 15000,
            validateStatus: (status) => status === 200
        });

        const data = res.data;

        if (data) {
            await redisClient.set(CACHE_KEY, JSON.stringify(data), {
                EX: 86400 // 24 Hours Backup TTL
            });
            console.log('✅ Live Event Counts updated in Redis');
            return data;
        }

    } catch (error) {
        console.error('❌ Error fetching Live Event Counts:', error.message);
    }
    return null;
}

async function getCachedEventCounts() {
    try {
        const cachedData = await redisClient.get(CACHE_KEY);
        return cachedData ? JSON.parse(cachedData) : null;
    } catch (error) {
        console.error('❌ Error getting cached event counts:', error.message);
        return null;
    }
}

module.exports = {
    fetchAndSaveEventCounts,
    getCachedEventCounts
};
