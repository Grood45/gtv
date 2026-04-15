const resultService = require('../services/result.service');

async function getFancyResult(req, res) {
    try {
        const { eventId } = req.query;

        if (!eventId) {
            return res.status(400).json({
                success: false,
                message: "Missing eventId query parameter"
            });
        }

        const data = await resultService.fetchFancyResult(eventId);
        res.json({
            success: true,
            data
        });

    } catch (error) {
        console.error("❌ Fancy Result Controller Error:", error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

async function getEventResults(req, res) {
    try {
        const { type = "today", sportId = "4" } = req.query;

        const data = await resultService.fetchEventResults(type, sportId);
        res.json({
            success: true,
            data
        });

    } catch (error) {
        console.error("❌ Event Results Controller Error:", error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

module.exports = {
    getFancyResult,
    getEventResults
};
