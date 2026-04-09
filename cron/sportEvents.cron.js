const cron = require('node-cron');
const { refreshAllSportEvents } = require('../services/sportEvents.service');

// Refresh specific sport events every 2 minutes
cron.schedule('*/2 * * * *', async () => {
    console.log('⏰ Running Sport Specific Events (Cricket/Soccer/Tennis) refresh cron...');
    await refreshAllSportEvents();
});

module.exports = {};
