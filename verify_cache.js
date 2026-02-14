const mongoose = require("mongoose");
const Event = require("./models/Event");
const { getEventStream } = require("./controllers/event.controller");
require("dotenv").config();

// MOCK Express Request/Response
const mockReq = (eventId) => ({ params: { eventId } });
const mockRes = () => {
    const res = {};
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => { res.data = data; return res; };
    return res;
};

async function verifyCache() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ DB Connected");

        // 🔑 Ensure Auth
        const { loadToken, login } = require("./controllers/auth.controller");
        const { loadCookie, generateCookie } = require("./controllers/cookie.controller");

        let token = await loadToken();
        let cookie = await loadCookie();

        if (!token || !cookie) {
            console.log("🔑 Logging in for verification...");
            token = await login();
            await generateCookie(token);
        }
        console.log("✅ Auth Ready");

        // 1. Find a suitable event
        const event = await Event.findOne({
            "rawData.streamingChannel": { $exists: true, $ne: "0" }
        });
        if (!event) {
            console.log("❌ No suitable event found for testing (Channel != 0).");
            return;
        }
        const eventId = event.eventId;
        console.log(`🔍 Testing on Event: ${event.name} (${eventId})`);

        // 2. Clear current cache (force update)
        await Event.updateOne({ eventId }, { $set: { updatedAt: new Date("2000-01-01") } }); // Make it very old
        console.log("🔄 Cache Cleared (Set to old date)");

        // 3. First Hit (Should trigger FETCH)
        console.log("\n▶️ 1st Request (Should FETCH)...");
        const res1 = mockRes();
        await getEventStream(mockReq(eventId), res1);

        // LOG FULL RESPONSE TO DEBUG
        console.log("DEBUG RES 1:", JSON.stringify(res1.data, null, 2));

        const link1 = res1.data?.data?.streamUrl;
        console.log("🔗 Link 1:", link1 ? "GOT LINK" : "NO LINK");

        // 4. Second Hit immediately (Should be SAME - CACHE HIT)
        console.log("\n▶️ 2nd Request (Immediate - Should be CACHED)...");
        const res2 = mockRes();
        await getEventStream(mockReq(eventId), res2);
        const link2 = res2.data?.data?.streamUrl;
        console.log("🔗 Link 2:", link2 ? "GOT LINK" : "NO LINK");

        if (link1 === link2) {
            console.log("✅ SUCCESS: Links MATCH (Cache is working)");
        } else {
            console.log("❌ FAILURE: Links DO NOT MATCH (Cache failed)");
        }

        // 5. Wait 16 Seconds (Expire Cache)
        console.log("\n⏳ Waiting 16 seconds for expiry...");
        await new Promise(r => setTimeout(r, 16000));

        // 6. Third Hit (Should trigger NEW FETCH)
        console.log("\n▶️ 3rd Request (After 16s - Should FETCH NEW)...");
        const res3 = mockRes();
        await getEventStream(mockReq(eventId), res3);
        const link3 = res3.data?.data?.streamUrl;
        console.log("🔗 Link 3:", link3 ? "GOT LINK" : "NO LINK");

        // Note: It's possible the API returns same link if it hasn't changed on provider side, 
        // but our logic ran the fetch. We check logs for "ON-DEMAND STREAM FETCH".
        console.log("✅ Test Completed. Check console logs above for 'ON-DEMAND STREAM FETCH' messages.");

    } catch (e) {
        console.error("❌ ERROR:", e);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

// Mocking console.log to capture internal logs of controller
const originalLog = console.log;
console.log = function (...args) {
    originalLog(...args); // Print to terminal
};

verifyCache();
