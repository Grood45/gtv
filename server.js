const express = require("express");
const { PORT } = require("./config/config");
const { login, loadToken } = require("./controllers/auth.controller");
const { generateCookie, loadCookie } = require("./controllers/cookie.controller");

// 🔹 Start cron jobs (auth + cookie)
require("./cron/cookie.cron");
require("./cron/inplay.cron");

const { gliveHandler } = require("./controllers/glive.controller");
const { getEventStream } = require("./controllers/event.controller");

const app = express();

// ================= OPTIMIZATION & SECURITY =================
const helmet = require("helmet");
const compression = require("compression");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

app.use(helmet()); // Security Headers
app.use(compression()); // Gzip Compression
app.use(cors()); // Allow Cross-Origin Requests

// Rate Limiting (Prevent Abuse)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per windowMs
  message: "Too many requests from this IP, please try again after 15 minutes."
});
app.use(limiter);
// ========================================================

app.get("/", (req, res) => res.send("GLIVE SERVER IS RUNNING"));

// ================= API ROUTE =================
app.get("/glivestreaming/v1/glive/:matchId", gliveHandler);
app.get("/glivestreaming/v1/event/:eventId", getEventStream);

const { getCookie } = require("./controllers/cookie.controller");
const { getToken } = require("./controllers/auth.controller");

app.get("/debug/status", (req, res) => {
  res.json({
    cookie: getCookie() ? "READY" : "MISSING",
    token: getToken() ? "READY" : "MISSING",
    env: process.env.NODE_ENV || "development"
  });
});

app.get("/debug/events", async (req, res) => {
  try {
    const total = await Event.countDocuments();
    const events = await Event.find({}, "eventId name streamUrl").limit(10).sort({ updatedAt: -1 }).lean();
    res.json({ total, latest: events });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ================= WARMUP ON SERVER START =================
const connectDB = require("./config/db");

(async () => {
  try {
    console.log("⚡ WARMUP START");
    await connectDB();

    // 1️⃣ FAST STARTUP: Load from DB
    const loadedToken = await loadToken();
    const loadedCookie = await loadCookie();

    if (loadedToken && loadedCookie) {
      console.log("🚀 SYSTEM READY (FAST START)");
    } else {
      console.log("⚠️ CACHE MISS - DOING FRESH LOGIN...");
      // 2️⃣ Fallback: Fresh Login
      const token = await login();
      await generateCookie(token);
      console.log("✅ SYSTEM READY (FRESH LOGIN)");
    }

    console.log("✅ SYSTEM READY: TOKEN & COOKIE SET");
  } catch (e) {
    console.log("❌ WARMUP FAILED:", e.message);
  }
})();

// ================= START SERVER =================
app.listen(PORT, () => {
  console.log(`🚀 GLIVE RUNNING ON PORT ${PORT}`);
});
