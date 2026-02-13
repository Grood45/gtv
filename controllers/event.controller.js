const Event = require("../models/Event");
const { fetchStream } = require("../services/stream.service");

async function getEventStream(req, res) {
    try {
        const { eventId } = req.params;

        // 1. Find Event in DB
        const event = await Event.findOne({ eventId });

        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Event not found"
            });
        }

        // 2. Extract Streaming Channel
        const streamingChannel = event.rawData?.streamingChannel;
        let streamUrl = event.streamUrl; // ⚡ Check existing URL

        // 3. ON-DEMAND FETCH: If no URL or it's old/broken, fetch fresh
        // (For now, we just check if it's missing)
        if (!streamUrl && streamingChannel && streamingChannel !== "0") {
            console.log(`🎥 ON-DEMAND STREAM FETCH for ${event.name} (${streamingChannel})...`);
            try {
                const streamData = await fetchStream(streamingChannel);
                if (streamData && streamData.streamingUrl) {
                    streamUrl = streamData.streamingUrl;

                    // ⚡ UPDATE DB (Cache for next user)
                    await Event.updateOne(
                        { eventId },
                        { $set: { streamUrl: streamUrl } }
                    );
                    console.log("✅ Stream Cached in DB.");
                }
            } catch (err) {
                console.log(`⚠️ On-Demand Fetch Failed: ${err.message}`);
            }
        }

        // 4. Return JSON
        res.json({
            success: true,
            data: {
                eventId: event.eventId,
                name: event.name,
                eventType: event.eventType,
                score: event.rawData?.scores,
                streamingChannel: streamingChannel,
                streamUrl: streamUrl
            }
        });

    } catch (e) {
        console.log("❌ EVENT API ERROR:", e.message);
        res.status(500).json({ success: false, error: e.message });
    }
}

module.exports = { getEventStream };
