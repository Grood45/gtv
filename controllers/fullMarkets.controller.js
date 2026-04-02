const { getCachedFullMarkets, fetchAndCacheFullMarkets } = require('../services/fullMarkets.service');
const { trackMarket } = require('../utils/syncTracker');

async function getFullMarkets(req, res) {
    const { eventId, marketId } = req.params;
    
    if (!eventId || !marketId) {
        return res.status(400).json({ success: false, message: 'Both eventId and marketId are required' });
    }

    try {
        // 🎯 1. Ping Sync Tracker (Track eventId:marketId pair)
        trackMarket(eventId, marketId).catch(e => console.error("❌ Sync Tracker Error (Full Markets):", e.message));

        // 🎯 2. Try Cache First
        let data = await getCachedFullMarkets(eventId, marketId);

        // 🎯 3. Cache Miss Recovery (Worker will handle sync every 1.5s)
        if (!data) {
            console.log(`⚡ [FULL_MARKETS] Cache miss for event ${eventId}, fetch initial...`);
            data = await fetchAndCacheFullMarkets(eventId, marketId);
        }

        if (!data) {
            return res.status(503).json({ 
                success: false, 
                message: 'Full Markets data not available, please try again soon' 
            });
        }

        res.json(data);
    } catch (error) {
        console.error(`❌ Controller Error (Full Markets Event ${eventId}):`, error.message);
        res.status(500).json({ success: false, error: error.message });
    }
}

module.exports = {
    getFullMarkets
};
