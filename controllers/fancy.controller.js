const { getFancyOdds } = require('../services/fancy.service');
const { trackEvent } = require('../utils/syncTracker');

async function getFancyData(req, res) {
    try {
        const { eventId } = req.params;
        
        if (!eventId) {
            return res.status(400).json({ success: false, message: 'eventId is required' });
        }

        // 🎯 1. Ping Sync Tracker (Mark event as active for background polling)
        trackEvent(eventId).catch(e => console.error("❌ Sync Tracker Error:", e.message));

        // 🎯 2. Get Data (Service will prioritize Redis cache updated by Sync Worker)
        const data = await getFancyOdds(eventId);

        res.json({
            success: true,
            data
        });
    } catch (e) {
        console.error("❌ FANCY CONTROLLER ERROR:", e.message);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
}

module.exports = { getFancyData };
