const { getCachedFullMarkets, fetchAndCacheFullMarkets } = require('../services/fullMarkets.service');

async function getFullMarkets(req, res) {
    const { eventId, marketId } = req.params;
    
    if (!eventId || !marketId) {
        return res.status(400).json({ success: false, message: 'Both eventId and marketId are required' });
    }

    try {
        let data = await getCachedFullMarkets(eventId, marketId);

        // Cache miss recovery
        if (!data) {
            console.log(`⚡ Cache miss for Full Markets event ${eventId}, fetch initial...`);
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
