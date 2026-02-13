const cron = require("node-cron");
const { fetchAndSaveEvents } = require("../services/inplay.service");

// ⏰ EVERY 1 MINUTE
cron.schedule("* * * * *", fetchAndSaveEvents);

module.exports = {};
