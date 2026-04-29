const axios = require("axios");
const mongoose = require("mongoose");
require("dotenv").config();
const connectDB = require("../config/db");
const { getCookie, loadCookie } = require("../controllers/cookie.controller");

async function runTest() {
  try {
    console.log("🔍 Checking Fancy Markets for Event: 35533331...");
    await connectDB();
    await loadCookie();
    const cookie = getCookie();
    if (!cookie) {
      console.log("❌ No cookie found in memory/DB.");
      process.exit(1);
    }

    const jsessionid = cookie.split("JSESSIONID=")[1]?.split(";")[0];
    const eventId = "35533331";
    const url = "https://bxawscf.gu21go76.xyz/exchange/member/playerService/queryFancyBetMarkets";

    const payload = new URLSearchParams({
      eventId: String(eventId),
      version: "0",
      oddsSettingVersion: "0",
      selectionTs: "0"
    }).toString();

    console.log("🚀 Fetching from Provider API...");
    const res = await axios.post(url, payload, {
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

    const responseData = res.data.data || res.data;
    if (responseData && responseData.fancyBetMarkets) {
      const markets = responseData.fancyBetMarkets;
      console.log(`✅ Received ${markets.length} markets.`);
      
      const targetId = 2984664;
      const targetMarket = markets.find(m => m.marketId == targetId);
      
      if (targetMarket) {
        console.log("🎯 FOUND TARGET MARKET BY ID:");
        console.log(JSON.stringify(targetMarket, null, 2));
      } else {
        console.log(`❌ Market ID ${targetId} NOT FOUND in provider response.`);
        
        const byName = markets.filter(m => m.marketName.toLowerCase().includes("toss") || m.marketName.toLowerCase().includes("mi will win"));
        if (byName.length > 0) {
          console.log("🔍 FOUND SIMILAR MARKETS BY NAME:");
          byName.forEach(m => console.log(JSON.stringify(m, null, 2)));
        } else {
          console.log("❌ No markets found with 'Toss' or 'MI Will Win' in the name.");
        }
      }
    } else {
      console.log("❌ Invalid response format from provider:", JSON.stringify(res.data).substring(0, 200));
    }

    process.exit(0);
  } catch (err) {
    console.error("💀 ERROR:", err.message);
    if (err.response) console.log("Response Data:", JSON.stringify(err.response.data));
    process.exit(1);
  }
}

runTest();
