const cron = require('node-cron');
const { fetchMenuData } = require('../services/menu.service');

// Run every 1 hour to keep the main Sports List fresh in DB
cron.schedule('0 * * * *', async () => {
    console.log('⏰ [CRON] Refreshing Main Sports List (OcerMenu)...');
    try {
        await fetchMenuData({
            eventType: "-1",
            competitionId: "-2",
            eventId: "-1",
            region: "",
            isManualAddCompetition: "false"
        });
    } catch (e) {
        console.error('❌ [CRON] Failed to refresh sports list:', e.message);
    }
});

module.exports = {};
