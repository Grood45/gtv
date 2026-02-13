const axios = require("axios");
const mongoose = require("mongoose");
require("dotenv").config();
const Event = require("./models/Event");

const API_URL = "http://localhost:4000/glivestreaming/v1/event";

async function testApi() {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        // 1. Get an existing event ID from DB
        const event = await Event.findOne();
        if (!event) {
            console.log("❌ No events in DB to test with. Wait for cron to run.");
            return;
        }

        console.log(`🔍 Testing API for Event: ${event.name} (ID: ${event.eventId})`);

        // 2. Call API
        const res = await axios.get(`${API_URL}/${event.eventId}`);

        console.log("✅ API Response Status:", res.status);
        console.log("📄 API Response Data:");
        console.log(JSON.stringify(res.data, null, 2));

        if (res.data.success && res.data.data.eventId === event.eventId) {
            console.log("🎉 API WORKING CORRECTLY!");
        } else {
            console.log("⚠️ API RESPONSE MISMATCH");
        }

    } catch (e) {
        console.error("❌ API TEST FAILED:", e.message);
        if (e.response) {
            console.log("Response Data:", e.response.data);
        }
    } finally {
        process.exit();
    }
}

testApi();
