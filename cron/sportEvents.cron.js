const cron = require('node-cron');
const { refreshAllSportEvents } = require('../services/sportEvents.service');

// Refresh specific sport events every 3 minutes
cron.schedule('*/3 * * * *', async () => {
    console.log('⏰ Running Sport Specific Events (Cricket/Soccer/Tennis) refresh cron...');
    await refreshAllSportEvents();
});

module.exports = {};
