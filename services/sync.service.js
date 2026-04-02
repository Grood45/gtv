const { trackEvent, trackMarket, getActiveSyncTasks } = require('../utils/syncTracker');
const { getFancyOdds } = require('./fancy.service');
const { fetchAndCacheBookmaker } = require('./bookmaker.service');
const { fetchAndCacheFullMarkets } = require('./fullMarkets.service');

const SYNC_INTERVAL_MS = 1500; // 1.5 Seconds for ultra-fast sync
const MAX_CONCURRENT_MATCHES = 15; // Limit to 15 active matches to avoid IP bans

let isSyncRunning = false;

async function startBackgroundSync() {
    if (isSyncRunning) return;
    isSyncRunning = true;
    console.log(`🚀 [SYNC] Background Sync Started (Interval: ${SYNC_INTERVAL_MS}ms)`);

    while (isSyncRunning) {
        try {
            const startTime = Date.now();
            const { eventIds, marketPairs } = await getActiveSyncTasks();

            if (eventIds.length === 0 && marketPairs.length === 0) {
                 // No active users, sleep and check again
                 await new Promise(resolve => setTimeout(resolve, SYNC_INTERVAL_MS));
                 continue;
            }

            // Cap the number of synced items to prevent IP bans
            const limitedEventIds = eventIds.slice(0, MAX_CONCURRENT_MATCHES);
            const limitedMarketPairs = marketPairs.slice(0, MAX_CONCURRENT_MATCHES);

            console.log(`🔄 [SYNC] Syncing ${limitedEventIds.length} Events and ${limitedMarketPairs.length} Markets...`);

            // 1. Sync Fancy & Bookmaker
            const fancyPromises = limitedEventIds.map(eventId => 
                getFancyOdds(eventId, true).catch(e => console.error(`❌ [SYNC_FANCY] Error ${eventId}:`, e.message))
            );

            const bookmakerPromises = limitedEventIds.map(eventId => 
                fetchAndCacheBookmaker(eventId, true).catch(e => console.error(`❌ [SYNC_BOOKMAKER] Error ${eventId}:`, e.message))
            );

            // 2. Sync Full Markets (Match Odds)
            const marketPromises = limitedMarketPairs.map(([eventId, marketId]) => 
                fetchAndCacheFullMarkets(eventId, marketId, true).catch(e => console.error(`❌ [SYNC_MARKET] Error ${marketId}:`, e.message))
            );

            // Execute all sync tasks in parallel
            await Promise.allSettled([...fancyPromises, ...bookmakerPromises, ...marketPromises]);

            const duration = Date.now() - startTime;
            const remainingDelay = Math.max(0, SYNC_INTERVAL_MS - duration);
            
            await new Promise(resolve => setTimeout(resolve, remainingDelay));

        } catch (error) {
            console.error('❌ [SYNC_INTERVAL_ERROR]:', error.message);
            await new Promise(resolve => setTimeout(resolve, SYNC_INTERVAL_MS));
        }
    }
}

function stopBackgroundSync() {
    isSyncRunning = false;
    console.log('🛑 [SYNC] Background Sync Stopped');
}

module.exports = {
    startBackgroundSync,
    stopBackgroundSync
};
