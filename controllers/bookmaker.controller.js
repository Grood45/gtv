const { getCachedBookmaker, fetchAndCacheBookmaker } = require('../services/bookmaker.service');
const { trackEvent } = require('../utils/syncTracker');

async function getBookmakerMarkets(req, res) {
    const { eventId } = req.params;
    
    if (!eventId) {
        return res.status(400).json({ success: false, message: 'Event ID is required' });
    }

    try {
        // 🎯 1. Ping Sync Tracker
        trackEvent(eventId).catch(e => console.error("❌ Sync Tracker Error (Bookmaker):", e.message));

        // 🎯 2. Try Cache First
        let data = await getCachedBookmaker(eventId);

        // 🎯 3. Cache Miss Recovery (Worker will handle subsequent refreshes)
        if (!data) {
            console.log(`⚡ [BOOKMAKER] Cache miss for event ${eventId}, fetching fresh data...`);
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
