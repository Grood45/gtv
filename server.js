const express = require("express");
const { PORT } = require("./config/config");
const { login, loadToken } = require("./controllers/auth.controller");
const { generateCookie, loadCookie } = require("./controllers/cookie.controller");
const Event = require("./models/Event"); // ✅ Fix missing model

// 🔹 Start cron jobs (auth + cookie)
require("./cron/cookie.cron");
require("./cron/inplay.cron");
require("./cron/eventCount.cron");
require("./cron/liveEvents.cron");
require("./cron/sportEvents.cron");
require("./cron/cleanup.cron");

const { gliveHandler } = require("./controllers/glive.controller");
const { getEventStream } = require("./controllers/event.controller");
const fancyRoutes = require("./routes/fancy.routes");
const eventCountRoutes = require("./routes/eventCount.routes");
const liveEventsRoutes = require("./routes/liveEvents.routes");
const sportEventsRoutes = require("./routes/sportEvents.routes");
const bookmakerRoutes = require("./routes/bookmaker.routes");
const fullMarketsRoutes = require("./routes/fullMarkets.routes");
const { startBackgroundSync } = require("./services/sync.service");

const app = express();

// 🔹 Trust Proxy (Required for Nginx + Rate Limit)
app.set("trust proxy", 1);

// ================= OPTIMIZATION & SECURITY =================
const helmet = require("helmet");
const compression = require("compression");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      connectSrc: ["'self'", "https://cdn.jsdelivr.net", "https://*.skyinplay.com"],
      imgSrc: ["'self'", "data:", "https:"],
      mediaSrc: ["'self'", "blob:", "https:"],
      frameSrc: ["'self'", "https:"] // 🟢 ALLOW EXTERNAL IFRAMES
    }
  }
})); // Security Headers
app.use(compression()); // Gzip Compression
app.use(cors()); // Allow Cross-Origin Requests

// Rate Limiting (Prevent Abuse)
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // Reduced to 1 minute for faster recovery
  max: 1000, // Increased limit for normal users
  message: "Too many requests, please try again after a minute.",
  skip: (req) => req.path.startsWith("/nw/v1") // 🟢 UNLIMITED FOR OPTIMIZED CLIENT API
});
// app.use(limiter); // 🛡️ Temporarily disabled for debugging
// ========================================================

app.get("/", (req, res) => res.send("GLIVE SERVER IS RUNNING"));

// ================= API ROUTE =================
app.get("/glivestreaming/v1/glive/:matchId", gliveHandler);
app.get("/glivestreaming/v1/event/:eventId", getEventStream);
app.use("/glivestreaming/v1/fancy", fancyRoutes); // Legacy support
app.use("/nw/v1/fancy", fancyRoutes); // Optimized path
app.use("/nw/v1", eventCountRoutes);
app.use("/nw/v1", liveEventsRoutes);
app.use("/nw/v1/sport", sportEventsRoutes);
app.use("/nw/v1/bookmaker", bookmakerRoutes);
app.use("/nw/v1/fullMarkets", fullMarketsRoutes);

const { getCookie } = require("./controllers/cookie.controller");
const { getToken } = require("./controllers/auth.controller");



// (Proxy routes removed as requested)

// 🛠️ TEST PAGE (Generates Iframe)
app.get("/test", (req, res) => {
  res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>GLive Embed Tester</title>
            <style>
                body { font-family: sans-serif; padding: 20px; text-align: center; background: #f0f0f0; }
                input { padding: 10px; width: 300px; font-size: 16px; border: 1px solid #ccc; border-radius: 5px; }
                button { padding: 10px 20px; font-size: 16px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; }
                button:hover { background: #0056b3; }
                #result { margin-top: 20px; }
                textarea { width: 80%; height: 60px; margin-top: 10px; font-family: monospace; }
                iframe { margin-top: 20px; border: 2px solid #000; background: #000; }
            </style>
        </head>
        <body>
            <h1>GLive Embed Generator</h1>
            <p>Enter Event ID to generate Iframe and watch stream.</p>
            <input type="text" id="eventId" placeholder="Enter Event ID (e.g., 35254881)" value="35254881" />
            <button onclick="generate()">Play Stream</button>
            
            <div id="result" style="display:none;">
                <h3>Copy This Code:</h3>
                <textarea id="code" readonly></textarea>
                <h3>Preview:</h3>
                <div id="preview"></div>
            </div>

            <script>
                function generate() {
                    var id = document.getElementById('eventId').value.trim();
                    if(!id) return alert("Please enter Event ID");
                    
                    var url = window.location.origin + "/embed/" + id;
                    var code = '<iframe src="' + url + '" width="100%" height="450px" frameborder="0" allowfullscreen></iframe>';
                    
                    document.getElementById('code').value = code;
                    document.getElementById('preview').innerHTML = code;
                    document.getElementById('result').style.display = 'block';
                }
            </script>
        </body>
        </html>
    `);
});

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

    // 🚀 3️⃣ START BACKGROUND SYNC (Wait 5s to ensure everything is stable)
    setTimeout(() => {
       startBackgroundSync();
    }, 5000);

  } catch (e) {
    console.log("❌ WARMUP FAILED:", e.message);
  }
})();

// ================= START SERVER =================
app.listen(PORT, "0.0.0.0", 2048, () => {
  console.log(`🚀 GLIVE RUNNING ON PORT ${PORT}`);
});
