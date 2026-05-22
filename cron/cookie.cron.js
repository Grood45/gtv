const cron = require("node-cron");
const { login } = require("../controllers/auth.controller");
const { generateCookie } = require("../controllers/cookie.controller");

async function refreshAuthAndCookie() {
  console.log("♻️ AUTH + COOKIE CRON START");

  try {
    const cookie = await generateCookie();
    if (cookie) {
      console.log("✅ CRON: COOKIE UPDATED SUCCESSFULLY");
    } else {
      console.log("⚠️ CRON: COOKIE NOT UPDATED");
    }
  } catch (e) {
    console.log("❌ CRON ERROR:", e.message);
  }
}

// ⏰ EVERY 9 MINUTES
cron.schedule("*/9 * * * *", refreshAuthAndCookie);

module.exports = { refreshAuthAndCookie };
