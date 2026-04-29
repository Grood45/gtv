const redis = require('../utils/redis');

async function checkCache() {
    const eventId = '35510579';
    const marketId = '1.257050891';
    const cacheKey = `full_markets:${eventId}:${marketId}`;

    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
        const envelope = JSON.parse(cachedData);
        console.log('Cache Found!');
        console.log('Saved At:', new Date(envelope.savedAt).toLocaleString());
        console.log('Age (seconds):', (Date.now() - envelope.savedAt) / 1000);
        // console.log('Payload Summary:', JSON.stringify(envelope.payload).substring(0, 200));
    } else {
        console.log('Cache NOT Found for', cacheKey);
    }

    const activeEvents = await redis.zRange('active_sync_events', 0, -1, { WITHSCORES: true });
    const activeMarkets = await redis.zRange('active_sync_markets', 0, -1, { WITHSCORES: true });

    console.log('\nActive Events:', activeEvents);
    console.log('Active Markets:', activeMarkets);

    process.exit(0);
}

checkCache().catch(err => {
    console.error(err);
    process.exit(1);
});
