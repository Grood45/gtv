const redisClient = require('./redis');

const ACTIVE_EVENTS_KEY = 'active_sync_events';
const ACTIVE_MARKETS_KEY = 'active_sync_markets';
const SYNC_EXPIRY_MS = 30000; // 30 seconds of inactivity before stopping sync

/**
 * Track an active event for Fancy/Bookmaker sync.
 * @param {string|number} eventId 
 */
async function trackEvent(eventId) {
    const now = Date.now();
    await redisClient.zAdd(ACTIVE_EVENTS_KEY, {
        score: now,
        value: String(eventId)
    });
}

/**
 * Track an active market for Full Markets sync.
 * @param {string|number} eventId 
 * @param {string} marketId 
 */
async function trackMarket(eventId, marketId) {
    const now = Date.now();
    const key = `${eventId}:${marketId}`;
    await redisClient.zAdd(ACTIVE_MARKETS_KEY, {
        score: now,
        value: key
    });
}

/**
 * Get active sync tasks and cleanup expired ones.
 * @returns {Promise<{eventIds: string[], marketPairs: string[][]}>}
 */
async function getActiveSyncTasks() {
    const now = Date.now();
    const expiryThreshold = now - SYNC_EXPIRY_MS;

    // 1. Cleanup expired
    await redisClient.zRemRangeByScore(ACTIVE_EVENTS_KEY, '-inf', expiryThreshold);
    await redisClient.zRemRangeByScore(ACTIVE_MARKETS_KEY, '-inf', expiryThreshold);

    // 2. Fetch current active
    const eventIds = await redisClient.zRange(ACTIVE_EVENTS_KEY, 0, -1);
    const marketKeys = await redisClient.zRange(ACTIVE_MARKETS_KEY, 0, -1);

    const marketPairs = marketKeys.map(key => key.split(':'));

    return {
        eventIds,
        marketPairs
    };
}

module.exports = {
    trackEvent,
    trackMarket,
    getActiveSyncTasks
};
