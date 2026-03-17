const { getCachedBookmaker, fetchAndCacheBookmaker } = require('../services/bookmaker.service');

async function getBookmakerMarkets(req, res) {
    const { eventId } = req.params;
    
    if (!eventId) {
        return res.status(400).json({ success: false, message: 'Event ID is required' });
    }

    try {
        let data = await getCachedBookmaker(eventId);

        // Cache miss recovery
        if (!data) {
            console.log(`⚡ Cache miss for Bookmaker event ${eventId}, fetching fresh data...`);
            data = await fetchAndCacheBookmaker(eventId);
        }

        if (!data) {
            return res.status(503).json({ 
                success: false, 
                message: 'Bookmaker data not available, please try again soon' 
            });
        }

        res.json(data);
    } catch (error) {
        console.error(`❌ Controller Error (Bookmaker Event ${eventId}):`, error.message);
        res.status(500).json({ success: false, error: error.message });
    }
}

module.exports = {
    getBookmakerMarkets
};
