const { getCachedEvents, fetchAndCacheEvents } = require('../services/liveEvents.service');

async function getInplayEvents(req, res) {
    await handleEventRequest(req, res, 'inplay');
}

async function getTodayEvents(req, res) {
    await handleEventRequest(req, res, 'today');
}

async function getTomorrowEvents(req, res) {
    await handleEventRequest(req, res, 'tomorrow');
}

async function handleEventRequest(req, res, type) {
    try {
        let data = await getCachedEvents(type);

        // Cache miss recovery
        if (!data) {
            console.log(`⚡ Cache miss for ${type}, fetching fresh data...`);
            data = await fetchAndCacheEvents(type);
        }

        if (!data) {
            return res.status(503).json({ 
                success: false, 
                message: 'Data not available, please try again soon' 
            });
        }

        res.json(data);
    } catch (error) {
        console.error(`❌ Controller Error (${type}):`, error.message);
        res.status(500).json({ success: false, error: error.message });
    }
}

module.exports = {
    getInplayEvents,
    getTodayEvents,
    getTomorrowEvents
};
