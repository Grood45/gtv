const cron = require("node-cron");
const { fetchAndSaveEvents } = require("../services/inplay.service");

// ⏰ EVERY 1 MINUTE (Fetch Events)
cron.schedule("* * * * *", fetchAndSaveEvents);

// ⏰ EVERY 1 MINUTE (Update Streams)
// ⚠️ DISABLED: We use "Smart On-Demand Fetching" now. Running this for 64+ events causes "Logged off" errors.
// const { updateLiveStreams } = require("../services/inplay.service");
// cron.schedule("* * * * *", updateLiveStreams);

module.exports = {};
