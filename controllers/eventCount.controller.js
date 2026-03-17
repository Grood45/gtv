const { getCachedEventCounts, fetchAndSaveEventCounts } = require('../services/eventCount.service');

async function getLiveEventCounts(req, res) {
    try {
        let data = await getCachedEventCounts();

        // If cache miss (e.g., server just started and cron hasn't run), fetch immediately
        if (!data) {
            console.log('⚡ Cache miss in controller, fetching fresh data...');
            data = await fetchAndSaveEventCounts();
        }

        if (!data) {
            return res.status(503).json({ 
                success: false, 
                message: 'Data not available yet, please try again in a few seconds' 
            });
        }

        res.json(data);
    } catch (error) {
        console.error('❌ Controller Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
}

module.exports = {
    getLiveEventCounts
};
