const axios = require("axios");
const httpClient = require("../utils/httpClient");
const Event = require("../models/Event");
const { getCookie } = require("../controllers/cookie.controller");
const { EVENTS_API, DEFAULT_ORIGIN, DEFAULT_REFERER } = require("../config/config");

async function fetchAndSaveEvents() {
    try {
        const cookie = getCookie();
        if (!cookie) {
            console.log("⚠️ SKIPPING IN-PLAY FETCH: Cookie not ready");
            return;
        }

        const queryPass = cookie.split("JSESSIONID=")[1]?.split(";")[0];
        if (!queryPass) {
            console.log("⚠️ INVALID JSESSIONID IN COOKIE");
            return;
        }

        // 🕵️ Expert URL Refactor: semicolon jsessionid
        const exactUrl = `${EVENTS_API};jsessionid=${queryPass}`;

        const body = new URLSearchParams({
            type: "inplay",
            eventType: "-1",
            eventTs: "-1",
            marketTs: "-1",
            selectionTs: "-1",
            collectEventIds: "",
            queryPass: queryPass // Dynamic from cookie
        }).toString();

        const res = await httpClient.post(exactUrl, body, {
            headers: {
                "Authorization": queryPass,
                "Origin": DEFAULT_ORIGIN,
                "Referer": DEFAULT_REFERER,
                "X-Requested-With": "XMLHttpRequest",
                "Cookie": cookie,
                "Source": "1"
            },
            timeout: 20000,
            validateStatus: (status) => status >= 200 && status < 505
        });

        const eventList = res.data?.events || [];

        if (!Array.isArray(eventList)) {
            console.log("⚠️ UNEXPECTED IN-PLAY RESPONSE:", JSON.stringify(res.data).substring(0, 200));
            return;
        }

        if (eventList.length === 0) {
            console.log("ℹ️ NO IN-PLAY EVENTS FOUND");
            return;
        }

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
                        rawData: event,
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

        const currentEventIds = eventList.map(e => String(e.id));
        const deleteResult = await Event.deleteMany({ eventId: { $nin: currentEventIds } });

        if (deleteResult.deletedCount > 0) {
            console.log(`🗑️ REMOVED ${deleteResult.deletedCount} OLD EVENTS FROM MONGODB`);
        }

    } catch (e) {
        console.log("❌ IN-PLAY FETCH ERROR:", e.message);
    }
}

const { fetchStream } = require("./stream.service");

async function updateLiveStreams() {
    try {
        const events = await Event.find({ "rawData.streamingChannel": { $exists: true, $ne: null } });

        if (events.length === 0) return;

        console.log(`🔄 UPDATING STREAMS FOR ${events.length} EVENTS...`);

        for (const event of events) {
            try {
                const streamData = await fetchStream(event.eventId, true);
                if (streamData) {
                    await Event.updateOne(
                        { eventId: event.eventId },
                        {
                            $set: {
                                streamUrl: streamData.url || streamData.streamingUrl || null,
                                "rawData.streamData": streamData,
                                updatedAt: new Date()
                            }
                        }
                    );
                }
            } catch (err) {
                console.log(`⚠️ FAILED TO UPDATE STREAM FOR ${event.name}: ${err.message}`);
            }
        }
        console.log("✅ FINISHED UPDATING STREAMS");

    } catch (e) {
        console.error("❌ ERROR IN updateLiveStreams:", e.message);
    }
}

module.exports = { fetchAndSaveEvents, updateLiveStreams };
