const mongoose = require("mongoose");
require("dotenv").config();
const Event = require("./models/Event");

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ Database Connected");

        // CLEANUP: Delete bad data if any
        const deleteRes = await Event.deleteMany({ eventId: null });
        if (deleteRes.deletedCount > 0) {
            console.log(`🧹 Cleaned up ${deleteRes.deletedCount} bad events (eventId: null)`);
        }

        const total = await Event.countDocuments();
        console.log(`📊 Total Events in DB: ${total}`);

        const targetId = -11023089;
        // Check both number and string just in case
        const event = await Event.findOne({
            $or: [
                { eventId: targetId },
                { eventId: String(targetId) }
            ]
        });

        if (event) {
            console.log("✅ TARGET EVENT FOUND:", event.name);
            console.log(JSON.stringify(event, null, 2));
        } else {
            console.log("❌ TARGET EVENT NOT FOUND");

            // Show one event to debug structure
            const anyEvent = await Event.findOne();
            if (anyEvent) {
                console.log("Example of an event in DB:", JSON.stringify(anyEvent, null, 2));
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

check();
