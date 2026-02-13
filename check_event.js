const mongoose = require("mongoose");
require("dotenv").config();
const Event = require("./models/Event");

async function checkEvent() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const eventId = "35250288";
        const event = await Event.findOne({ eventId });

        if (event) {
            console.log(`✅ Event ${eventId} FOUND:`, event.name);
            console.log("Stream URL:", event.streamUrl);
            console.log("Updated At:", event.updatedAt);
        } else {
            console.log(`❌ Event ${eventId} NOT FOUND locally.`);
        }
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

checkEvent();
