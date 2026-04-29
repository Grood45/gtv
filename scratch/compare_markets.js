const axios = require("axios");
const mongoose = require("mongoose");
require("dotenv").config();
const connectDB = require("../config/db");
const { getCookie, loadCookie } = require("../controllers/cookie.controller");

async function runComparison() {
  try {
    console.log("📊 Starting Market Comparison for Event: 35533331...");
    
    // 1. Fetch Fastodds Data
    console.log("🌐 Fetching from Fastodds (User Site)...");
    const fastoddsUrl = "https://fastodds.online/live/nw/v1/fancy/35533331";
    const fastoddsRes = await axios.get(fastoddsUrl);
    const fastoddsMarkets = fastoddsRes.data.data.fancyBetMarkets || [];
    console.log(`✅ Fastodds has ${fastoddsMarkets.length} markets.`);

    // 2. Fetch Provider Data
    await connectDB();
    await loadCookie();
    const cookie = getCookie();
    const jsessionid = cookie.split("JSESSIONID=")[1]?.split(";")[0];
    const providerUrl = "https://bxawscf.gu21go76.xyz/exchange/member/playerService/queryFancyBetMarkets";
    
    console.log("🚀 Fetching from Direct Provider...");
    const providerRes = await axios.post(providerUrl, new URLSearchParams({
      eventId: "35533331",
      version: "0",
      oddsSettingVersion: "0",
      selectionTs: "0"
    }).toString(), {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Authorization': jsessionid,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookie,
        'Origin': 'https://bigwin.live',
        'Referer': 'https://bigwin.live/',
        'X-Requested-With': 'XMLHttpRequest',
        'Source': '1',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
      }
    });

    const providerData = providerRes.data.data || providerRes.data;
    const providerMarkets = providerData.fancyBetMarkets || [];
    console.log(`✅ Provider has ${providerMarkets.length} markets.`);

    // 3. Compare
    const fastoddsIds = new Set(fastoddsMarkets.map(m => m.marketId));
    const providerIds = new Set(providerMarkets.map(m => m.marketId));

    const missingInProvider = fastoddsMarkets.filter(m => !providerIds.has(m.marketId));
    const newInProvider = providerMarkets.filter(m => !fastoddsIds.has(m.marketId));

    console.log("\n--- COMPARISON RESULTS ---");
    console.log(`Total Markets in Fastodds: ${fastoddsMarkets.length}`);
    console.log(`Total Markets in Provider: ${providerMarkets.length}`);
    console.log(`Markets in Fastodds but MISSING in Provider: ${missingInProvider.length}`);
    console.log(`Markets in Provider but NEW/NOT in Fastodds: ${newInProvider.length}`);

    if (missingInProvider.length > 0) {
      console.log("\n⚠️ Sample markets in Fastodds that are GONE from Provider:");
      missingInProvider.slice(0, 10).forEach(m => {
        console.log(`- ${m.marketName} (ID: ${m.marketId}, Status in Fastodds: ${m.status})`);
      });
    }

    process.exit(0);
  } catch (err) {
    console.error("💀 ERROR:", err.message);
    process.exit(1);
  }
}

runComparison();
