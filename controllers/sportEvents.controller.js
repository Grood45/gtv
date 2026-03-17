const { getCachedSportEvents, fetchAndCacheSportEvents } = require('../services/sportEvents.service');

async function getSportEvents(req, res) {
    const { sportId } = req.params;
    
    if (!sportId) {
        return res.status(400).json({ success: false, message: 'Sport ID is required' });
    }

    try {
        let data = await getCachedSportEvents(sportId);

        // Cache miss recovery
        if (!data) {
            console.log(`⚡ Cache miss for sport ${sportId}, fetching fresh data...`);
            data = await fetchAndCacheSportEvents(sportId);
        }

        if (!data) {
            return res.status(503).json({ 
                success: false, 
                message: 'Data not available, please try again soon' 
            });
        }

        res.json(data);
    } catch (error) {
        console.error(`❌ Controller Error (Sport ${sportId}):`, error.message);
        res.status(500).json({ success: false, error: error.message });
    }
}

module.exports = {
    getSportEvents
};
