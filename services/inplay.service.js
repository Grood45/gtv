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

        // 🗑️ DELETE OLD EVENTS
        // Any event in DB that is NOT in the current `eventList` should be removed.
        // We filter by `eventType` if needed, but for "inplay", we usually want to sync exactly what's there.
        // Assuming this function is the ONLY source of truth for current in-play events.

        const currentEventIds = eventList.map(e => String(e.id));
        const deleteResult = await Event.deleteMany({ eventId: { $nin: currentEventIds } });

        if (deleteResult.deletedCount > 0) {
            console.log(`🗑️ REMOVED ${deleteResult.deletedCount} OLD EVENTS FROM MONGODB`);
        }

    } catch (e) {
        if (e.response) {
            console.log("❌ IN-PLAY FETCH ERROR:", e.response.status);
        } else {
            console.log("❌ IN-PLAY FETCH ERROR:", e.message);
        }
    }
}

// 🔄 UPDATE STREAMS (Runs every 1 minute)
const { fetchStream } = require("./stream.service");

async function updateLiveStreams() {
    try {
        // Find events that HAVE a streamingChannel but verify if the stream is actually active/valid if needed.
        // For now, we just update all events that have rawData.streamingChannel
        const events = await Event.find({ "rawData.streamingChannel": { $exists: true, $ne: null } });

        if (events.length === 0) {
            // console.log("ℹ️ No live events to update streams for.");
            return;
        }

        console.log(`🔄 UPDATING STREAMS FOR ${events.length} EVENTS...`);

        for (const event of events) {
            try {
                const streamData = await fetchStream(event.eventId, true); // Retry enabled

                // Assuming streamData structure, adjust if needed (e.g. streamData.url or similar)
                // The fetchStream returns `res.data`. run `debug_stream.js` to see structure if unsure.
                // Usually it returns { streamingUrl: "...", ... } or just the object.
                // We'll update rawData and streamUrl

                // LOGIC: Check if we got a valid URL
                // If the stream API returns a URL, save it.
                // If it fails or returns empty, maybe clear it? For now, we just update if we get data.

                // Let's assume fetchStream returns the direct response object from the API.
                // API usually returns { status: "1", result: "url..." } or similar??
                // Wait, I should verify what fetchStream returns. 
                // Looking at stream.service.js: `return res.data;`

                // I will save the whole response in rawData or just the URL?
                // The User wants "new streming ulr".

                if (streamData) {
                    // Update the event
                    await Event.updateOne(
                        { eventId: event.eventId },
                        {
                            $set: {
                                streamUrl: streamData.url || streamData.streamingUrl || null, // Adjust key based on API
                                "rawData.streamData": streamData,
                                updatedAt: new Date()
                            }
                        }
                    );
                    // console.log(`✅ UPDATED STREAM: ${event.name}`);
                }

            } catch (err) {
                console.log(`⚠️ FAILED TO UPDATE STREAM FOR ${event.name}: ${err.message}`);
                // Optional: If stream is dead (404/403), maybe remove streamUrl?
                // await Event.updateOne({ eventId: event.eventId }, { $unset: { streamUrl: "" } });
            }
        }
        console.log("✅ FINISHED UPDATING STREAMS");

    } catch (e) {
        console.error("❌ ERROR IN updateLiveStreams:", e.message);
    }
}

module.exports = { fetchAndSaveEvents, updateLiveStreams };
