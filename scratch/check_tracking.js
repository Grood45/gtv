const redis = require('../utils/redis');

async function checkTracking() {
    const eventId = '35510579';
    const marketId = '1.257050891';
    const marketKey = `${eventId}:${marketId}`;

    const activeEvents = await redis.zRange('active_sync_events', 0, -1, { WITHSCORES: true });
    const activeMarkets = await redis.zRange('active_sync_markets', 0, -1, { WITHSCORES: true });

    console.log('Active Events:', activeEvents);
    console.log('Active Markets:', activeMarkets);

    const isEventTracked = activeEvents.some(e => e.value === eventId);
    const isMarketTracked = activeMarkets.some(m => m.value === marketKey);

    console.log(`\nChecking Event ${eventId}: ${isEventTracked ? 'YES' : 'NO'}`);
    console.log(`Checking Market ${marketKey}: ${isMarketTracked ? 'YES' : 'NO'}`);

    process.exit(0);
}

checkTracking().catch(err => {
    console.error(err);
    process.exit(1);
});
