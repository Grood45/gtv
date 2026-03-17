const cron = require('node-cron');
const { fetchAndSaveEventCounts } = require('../services/eventCount.service');

// Refresh data every 5 minutes
// professional choice for dynamic data refresh
cron.schedule('*/5 * * * *', async () => {
    console.log('⏰ Running Live Event Count refresh cron...');
    await fetchAndSaveEventCounts();
});

module.exports = {};
