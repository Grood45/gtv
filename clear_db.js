const mongoose = require("mongoose");
require("dotenv").config();

async function clearDB() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ Connected to MongoDB");

        // Use the same model
        const Event = require("./models/Event");
        
        console.log("🗑️ Deleting all old events to free up space...");
        const result = await Event.deleteMany({});
        console.log(`✅ Deleted ${result.deletedCount} events!`);

        console.log("🔌 Disconnecting...");
        await mongoose.disconnect();
        console.log("✅ Done! You can restart your server now.");
    } catch (e) {
        console.error("❌ Error:", e);
    }
}

clearDB();
