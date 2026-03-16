const { getFancyOdds } = require('../services/fancy.service');

async function getFancyData(req, res) {
    try {
        const { eventId } = req.params;
        
        if (!eventId) {
            return res.status(400).json({ success: false, message: 'eventId is required' });
        }

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
