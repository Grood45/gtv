const cron = require('node-cron');
const { refreshAllEvents } = require('../services/liveEvents.service');

// Refresh data every 7 minutes for real-time accuracy
// professional choice: keeps Redis fresh without over-hitting source API
cron.schedule('*/7 * * * *', async () => {
    console.log('⏰ Running Live Events (Tri-API) refresh cron...');
    await refreshAllEvents();
});

module.exports = {};
