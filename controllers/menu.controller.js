const { fetchMenuData } = require('../services/menu.service');

async function queryMenu(req, res) {
    try {
        let {
            eventType = "-1",
            competitionId = "-2",
            eventId = "-1",
            region = "",
            isManualAddCompetition = "false"
        } = req.query;

        // 🛡️ Expert Sanitization: Prevent injection and bad payloads
        // Only allow digits and negative sign for IDs
        eventType = String(eventType).replace(/[^0-9\-]/g, '');
        competitionId = String(competitionId).replace(/[^0-9\-]/g, '');
        eventId = String(eventId).replace(/[^0-9\-]/g, '');
        // Validate manual add competition flag securely
        isManualAddCompetition = isManualAddCompetition === 'true' ? 'true' : 'false';

        console.log("➡️ [MENU_CONTROLLER] Received Request with query:", req.query);
        const data = await fetchMenuData({
            eventType,
            competitionId,
            eventId,
            region,
            isManualAddCompetition
        });
        console.log("⬅️ [MENU_CONTROLLER] fetchMenuData returned:", data ? "Has Data" : "No Data");

        if (!data) {
            return res.status(500).json({ 
                success: false, 
                message: "Failed to fetch menu data from provider" 
            });
        }

        return res.json(data);
    } catch (error) {
        console.error("❌ [MENU_CONTROLLER] Error:", error.message);
        return res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
}

module.exports = { queryMenu };
