const { trackEvent, trackMarket, getActiveSyncTasks } = require('../utils/syncTracker');
const { getFancyOdds } = require('./fancy.service');
const { fetchAndCacheBookmaker } = require('./bookmaker.service');
const { fetchAndCacheFullMarkets } = require('./fullMarkets.service');

// 🚀 PULSE CONFIGURATION (Expert Level Timing - High Performance)
const PULSE_MATCH_ODDS = 500;   // 500ms for Match Odds (Real-time Feel)
const PULSE_BOOKMAKER = 1000;    // 1s for Bookmaker
const PULSE_FANCY = 1000;        // 1s for Fancy
const SYNC_LOOP_TICK = 250;      // 250ms master tick (4 updates per second)

const MAX_CONCURRENT_MATCHES = 20; // Slightly higher for multi-pulse

// Track last-run times to maintain separate "pulses"
const lastRunTimes = new Map();

let isSyncRunning = false;

/**
 * 🕵️ Expert Sync Orchestrator
 * Uses a pulse-based model where each market type has its own frequency.
 * Includes 'Jitter' to prevent robotic rhythm detection.
 */
async function startBackgroundSync() {
    if (isSyncRunning) return;
    isSyncRunning = true;
    console.log(`🚀 [SYNC] Expert Pulse-Based Sync Started (Tick: ${SYNC_LOOP_TICK}ms)`);

    while (isSyncRunning) {
        try {
            const now = Date.now();
            const { eventIds, marketPairs } = await getActiveSyncTasks();

            if (eventIds.length === 0 && marketPairs.length === 0) {
                 await new Promise(resolve => setTimeout(resolve, 1000)); // Idling
                 continue;
            }

            const syncTasks = [];

            // 1. MATCH ODDS PULSE (Ultra-Fast)
            const dueMarkets = marketPairs.filter(([eventId, marketId]) => {
                const key = `market:${marketId}`;
                const lastRun = lastRunTimes.get(key) || 0;
                // Add jitter: ±20ms
                const jitter = Math.floor(Math.random() * 40) - 20; 
                return (now - lastRun) >= (PULSE_MATCH_ODDS + jitter);
            }).slice(0, MAX_CONCURRENT_MATCHES);

            dueMarkets.forEach(([eventId, marketId]) => {
                const key = `market:${marketId}`;
                lastRunTimes.set(key, now);
                syncTasks.push(fetchAndCacheFullMarkets(eventId, marketId, true));
            });

            // 2. BOOKMAKER PULSE (Standard)
            const dueBookmakers = eventIds.filter(eventId => {
                const key = `bm:${eventId}`;
                const lastRun = lastRunTimes.get(key) || 0;
                const jitter = Math.floor(Math.random() * 100) - 50; 
                return (now - lastRun) >= (PULSE_BOOKMAKER + jitter);
            }).slice(0, 10);

            dueBookmakers.forEach(eventId => {
                lastRunTimes.set(`bm:${eventId}`, now);
                syncTasks.push(fetchAndCacheBookmaker(eventId, true));
            });

            // 3. FANCY PULSE (Standard)
            const dueFancy = eventIds.filter(eventId => {
                const key = `fancy:${eventId}`;
                const lastRun = lastRunTimes.get(key) || 0;
                const jitter = Math.floor(Math.random() * 100) - 50; 
                return (now - lastRun) >= (PULSE_FANCY + jitter);
            }).slice(0, 10);

            dueFancy.forEach(eventId => {
                lastRunTimes.set(`fancy:${eventId}`, now);
                syncTasks.push(getFancyOdds(eventId, true, true));
            });

            // Parallel Execution
            if (syncTasks.length > 0) {
                // 📝 Optimized Logging: Only log pulse details every 10 seconds to reduce I/O pressure
                if (now % 10000 < SYNC_LOOP_TICK) {
                    console.log(`🔄 [SYNC] Pulse: ${syncTasks.length} tasks matching due times.`);
                }
                await Promise.allSettled(syncTasks); // 🚀 CRITICAL: We now AWAIT to prevent socket explosion
            }

            // Small master tick to keep CPU usage low
            await new Promise(resolve => setTimeout(resolve, SYNC_LOOP_TICK));

            // Clean up stale lastRunTimes (older than 1 minute)
            if (now % 60000 < 500) {
                 for (const [key, time] of lastRunTimes) {
                     if (now - time > 60000) lastRunTimes.delete(key);
                 }
            }

        } catch (error) {
            console.error('❌ [SYNC_TICK_ERROR]:', error.message);
            await new Promise(resolve => setTimeout(resolve, 1000));
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
