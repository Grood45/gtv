const resultService = require('../services/result.service');
const connectDB = require('../config/db');

async function testFetch() {
    try {
        console.log("🚀 Connecting to DB...");
        await connectDB();
        
        const eventId = "35514299";
        console.log(`📡 Fetching data for Event ID: ${eventId}...`);
        
        const data = await resultService.fetchFancyResult(eventId);
        
        console.log("✅ Response Data:");
        console.log(JSON.stringify(data, null, 2));
        
        process.exit(0);
    } catch (error) {
        console.error("❌ Fetch Failed:", error.message);
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", error.response.data);
        }
        process.exit(1);
    }
}

testFetch();
