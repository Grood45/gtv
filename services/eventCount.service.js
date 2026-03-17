const axios = require('axios');
const redisClient = require('../utils/redis');
const { getCookie } = require('../controllers/cookie.controller');
const { LIVE_EVENT_COUNT_API } = require('../config/config');

const CACHE_KEY = 'live_event_counts';

async function fetchAndSaveEventCounts() {
    try {
        console.log('🌐 Fetching Live Event Counts from API...');

        const cookie = getCookie();
        if (!cookie) {
            console.log('⚠️ Cookie not ready, skipping event count fetch');
            return null;
        }

        // Extract JSESSIONID for the URL parameter if needed, or just use the cookie header
        let jsessionid = cookie.split('JSESSIONID=')[1]?.split(';')[0];
        const apiUrl = jsessionid ? `${LIVE_EVENT_COUNT_API};jsessionid=${jsessionid}` : LIVE_EVENT_COUNT_API;

        const response = await axios.get(apiUrl, {
            headers: {
                'Cookie': cookie,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Origin': 'https://www.gugobet.net',
                'Referer': 'https://www.gugobet.net/'
            },
            timeout: 10000
        });

        const data = response.data;

        if (data) {
            // Save to Redis (no TTL since cron updates it, or maybe a 10 min safety TTL)
            await redisClient.set(CACHE_KEY, JSON.stringify(data), {
                EX: 600 // 10 minutes safety TTL
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
