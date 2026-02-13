const mongoose = require("mongoose");
const axios = require("axios");
require("dotenv").config();
const Event = require("./models/Event");

const API_URL = "http://localhost:4000/glivestreaming/v1/event";

async function testExpiry() {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        const eventId = "35250288";
        const event = await Event.findOne({ eventId });
        if (!event) {
            console.log(`❌ Event ${eventId} not found.`);
            process.exit();
        }

        console.log(`\n🧪 Testing Expiration Logic for: ${event.name}`);
        console.log(`Original UpdatedAt: ${event.updatedAt}`);

        // 1. Manually expire the event (set updatedAt to 1 hour ago)
        const oldDate = new Date(Date.now() - 60 * 60 * 1000);
        await Event.updateOne({ _id: event._id }, { $set: { updatedAt: oldDate } });
        console.log(`✅ Manually expired event to: ${oldDate}`);

        // 2. Call API
        console.log("📞 Calling API (Expect 'Expired URL' fetch log in server console)...");
        const res = await axios.get(`${API_URL}/${event.eventId}`);

        // 3. Verify Result
        const updatedEvent = await Event.findById(event._id);
        console.log(`New UpdatedAt: ${updatedEvent.updatedAt}`);

        if (updatedEvent.updatedAt > oldDate) {
            console.log("🎉 SUCCESS: Event was refreshed automatically!");
        } else {
            console.log("⚠️ FAILURE: Event was NOT refreshed.");
        }

    } catch (e) {
        console.error("❌ TEST FAILED:", e.message);
        if (e.response) {
            console.error("Response Status:", e.response.status);
            console.error("Response Data:", JSON.stringify(e.response.data, null, 2));
        } else if (e.code) {
            console.error("Error Code:", e.code);
        }
    } finally {
        process.exit();
    }
}

testExpiry();
