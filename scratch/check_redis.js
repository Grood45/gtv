const redisClient = require("../utils/redis");
require("dotenv").config();

async function checkRedis() {
  const eventId = "35533331";
  const cacheKey = `fancy_odds:${eventId}`;
  
  const data = await redisClient.get(cacheKey);
  if (!data) {
    console.log(`❌ No data in Redis for ${cacheKey}`);
  } else {
    const envelope = JSON.parse(data);
    const markets = envelope.payload?.data?.fancyBetMarkets || envelope.payload?.fancyBetMarkets || [];
    console.log(`✅ Redis has ${markets.length} markets for ${eventId}`);
    console.log(`Saved At: ${new Date(envelope.savedAt).toLocaleString()}`);
    
    // Check for market 2984664
    const target = markets.find(m => m.marketId == 2984664);
    if (target) {
      console.log("🎯 Market 2984664 is in Redis!");
    } else {
      console.log("❌ Market 2984664 is NOT in Redis.");
    }
  }
  process.exit(0);
}

checkRedis();
