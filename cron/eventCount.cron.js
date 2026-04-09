const cron = require('node-cron');
const { fetchAndSaveEventCounts } = require('../services/eventCount.service');

// Refresh data every 1 minute
// professional choice for high-speed dynamic data refresh
cron.schedule('* * * * *', async () => {
    console.log('⏰ Running Live Event Count refresh cron...');
    await fetchAndSaveEventCounts();
});

module.exports = {};
