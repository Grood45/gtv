const mongoose = require("mongoose");
require("dotenv").config();
const Event = require("./models/Event");
const { fetchStream } = require("./services/stream.service");
const { loadCookie } = require("./controllers/cookie.controller");

async function debugEvent() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const cookie = await loadCookie();

        console.log("✅ DB Connected & Cookie Loaded");

        // Test a specific event ID for better debugging
        const targetEventId = "35260777";
        const targetEvent = await Event.findOne({ eventId: targetEventId });

        if (!targetEvent) {
            console.log(`❌ EVENT ${targetEventId} NOT FOUND IN DB`);
            return;
        }

        const channelId = targetEvent.rawData.streamingChannel;
        const eventId = targetEvent.eventId;

        console.log(`\n🔍 TESTING EVENT: ${targetEvent.name}`);
        console.log(`- Channel ID: ${channelId}`);
        console.log(`- Event ID: ${eventId}`);

        const idsToTest = [
            { label: "Channel ID", id: channelId },
            { label: "Event ID", id: eventId }
        ];

        // Extract queryPass from cookie (logic from inplay.service.js)
        const queryPass = cookie.split("JSESSIONID=")[1].split(";")[0];
        console.log("🔑 Query Pass:", queryPass);

        for (const item of idsToTest) {
            if (!item.id || item.id === "0") continue;

            console.log(`\n👉 Trying with ${item.label}: ${item.id}`);
            try {
                // We need to bypass the service to get full axios response
                const axios = require("axios");
                const { STREAM_API } = require("./config/config");

                const res = await axios.post(
                    STREAM_API,
                    new URLSearchParams({
                        matchId: item.id,
                        queryPass: queryPass // 👈 ADDED THIS
                    }).toString(),
                    {
                        headers: {
                            "Host": "bxawscf.skyinplay.com",
                            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                            Cookie: cookie,
                            "X-Requested-With": "XMLHttpRequest",
                            Origin: "https://bxawscf.skyinplay.com",
                            Referer: "https://bxawscf.skyinplay.com/exchange/member/fullMarket",
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
                        },
                        timeout: 15000,
                    }
                );

                console.log("✅ STATUS:", res.status);
                // console.log("✅ HEADERS:", JSON.stringify(res.headers, null, 2));
                console.log("✅ API DATA:", res.data);

            } catch (e) {
                console.log("❌ FETCH FAILED:", e.message);
                if (e.response) {
                    console.log("Response Status:", e.response.status);
                    console.log("Response Data:", e.response.data);
                }
            }
        }
    } catch (e) {
        console.error("❌ DEBUG ERROR:", e);
    } finally {
        process.exit();
    }
}

debugEvent();
