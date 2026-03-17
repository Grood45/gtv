const cron = require('node-cron');
const { refreshAllSportEvents } = require('../services/sportEvents.service');

// Refresh specific sport events every 5 minutes
cron.schedule('*/5 * * * *', async () => {
    console.log('⏰ Running Sport Specific Events (Cricket/Soccer/Tennis) refresh cron...');
    await refreshAllSportEvents();
});

module.exports = {};
