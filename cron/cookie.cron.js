const cron = require("node-cron");
const { login } = require("../controllers/auth.controller");
const { generateCookie } = require("../controllers/cookie.controller");

async function refreshAuthAndCookie() {
  console.log("♻️ AUTH + COOKIE CRON START");

  try {
    // 🔹 STEP 1: AUTH
    const token = await login();
    if (!token) {
      console.log("❌ AUTH FAILED – COOKIE SKIPPED");
      return;
    }
    console.log("✅ AUTH TOKEN RECEIVED");

    // 🔹 STEP 2: COOKIE (5 second delay)
    setTimeout(async () => {
      try {
        const cookie = await generateCookie(token);
        if (cookie) {
          console.log("✅ COOKIE UPDATED SUCCESSFULLY");
        } else {
          console.log("⚠️ COOKIE NOT UPDATED – USING OLD COOKIE");
        }
      } catch (e) {
        console.log("❌ COOKIE ERROR AFTER DELAY:", e.message);
      }
    }, 5000); // 5 seconds delay

  } catch (e) {
    console.log("❌ AUTH CRON ERROR:", e.message);
  }
}

// ⏰ EVERY 9 MINUTES
cron.schedule("*/9 * * * *", refreshAuthAndCookie);

module.exports = { refreshAuthAndCookie };
