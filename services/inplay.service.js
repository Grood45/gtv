const axios = require("axios");
const Event = require("../models/Event");
const { getCookie } = require("../controllers/cookie.controller");


const INPLAY_API = "https://bxawscf.skyinplay.com/exchange/member/playerService/queryEvents";

async function fetchAndSaveEvents() {
    try {
        const cookie = getCookie();
        if (!cookie) {
            console.log("⚠️ SKIPPING IN-PLAY FETCH: Cookie not ready");
            return;
        }

        // Extract JSESSIONID value for queryPass
        // Cookie format: "JSESSIONID=xyz.node" -> we need "xyz.node"
        const queryPass = cookie.split("JSESSIONID=")[1].split(";")[0];

        const body = new URLSearchParams({
            type: "inplay",
            eventType: "-1",
            eventTs: "-1",
            marketTs: "-1",
            selectionTs: "-1",
            collectEventIds: "",
            queryPass: queryPass // Dynamic from cookie
        }).toString();

        const res = await axios.post(INPLAY_API, body, {
            headers: {
                "Host": "bxawscf.skyinplay.com",
                "Accept": "application/json, text/javascript, */*; q=0.01",
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "Origin": "https://bxawscf.skyinplay.com",
                "Referer": "https://bxawscf.skyinplay.com/exchange/member/inplay",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "X-Requested-With": "XMLHttpRequest",
                "Cookie": cookie
            },
            timeout: 20000
        });

        // Correct Path based on logs: res.data.events
        const eventList = res.data?.events || [];

        if (!Array.isArray(eventList)) {
            console.log("⚠️ UNEXPECTED IN-PLAY RESPONSE:", JSON.stringify(res.data).substring(0, 200));
            return;
        }

        if (eventList.length === 0) {
            console.log("ℹ️ NO IN-PLAY EVENTS FOUND");
            return;
        }

        // Bulk Upsert (Update if exists, Insert if new)
        const operations = eventList.map(event => ({
            updateOne: {
                filter: { eventId: String(event.id) },
                update: {
                    $set: {
                        eventId: String(event.id),
                        name: event.eventName || event.name,
                        eventType: String(event.eventType),
                        marketId: String(event.marketId || ""),
                        openDate: event.openDate ? new Date(event.openDate) : new Date(),
                        rawData: event, // This still has original data
                        updatedAt: new Date()
                    }
                },
                upsert: true
            }
        }));

        if (operations.length > 0) {
            await Event.bulkWrite(operations);
            console.log(`✅ SAVED ${operations.length} EVENTS TO MONGODB`);
        }

    } catch (e) {
        if (e.response) {
            console.log("❌ IN-PLAY FETCH ERROR:", e.response.status);
        } else {
            console.log("❌ IN-PLAY FETCH ERROR:", e.message);
        }
    }
}

module.exports = { fetchAndSaveEvents };
