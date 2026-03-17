const cron = require('node-cron');
const Event = require('../models/Event');

/**
 * Cleanup Cron Job: Deletes events older than 24 hours
 * Runs every day at midnight (00:00)
 */
cron.schedule('0 0 * * *', async () => {
    console.log('⏰ Running Database Cleanup Cron (Removing stale events)...');
    try {
        const threshold = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
        const result = await Event.deleteMany({
            updatedAt: { $lt: threshold }
        });
        console.log(`✅ Cleanup Complete: Removed ${result.deletedCount} old events.`);
    } catch (error) {
        console.error('❌ Database Cleanup Error:', error.message);
    }
});

console.log('✅ Daily Database Cleanup Cron Registered');
