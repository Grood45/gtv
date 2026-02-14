const Event = require("../models/Event");
const { fetchStream } = require("../services/stream.service");
const axios = require("axios");

async function getPlayerPage(req, res) {
    try {
        const { eventId } = req.params;
        const event = await Event.findOne({ eventId });

        if (!event) return res.status(404).send("Event not found");

        // 1. Get Fresh Stream URL (Server-Side Logic)
        let streamUrl = event.streamUrl;
        const streamingChannel = event.rawData?.streamingChannel;
        // Smart Cache: 4 mins expiry
        const EXPIRY_TIME = 4 * 60 * 1000;
        const isExpired = !event.updatedAt || (Date.now() - new Date(event.updatedAt).getTime() > EXPIRY_TIME);

        // If no URL or expired, fetch NEW one
        if ((!streamUrl || streamUrl.length < 10 || isExpired) && streamingChannel) {
            console.log(`🌐 SSR: Fetching fresh stream for ${event.name}`);
            const data = await fetchStream(streamingChannel);
            if (data?.streamingUrl) {
                streamUrl = data.streamingUrl;
                // Save to DB so next user gets same link
                await Event.updateOne({ eventId }, { $set: { streamUrl, updatedAt: new Date() } });
            }
        }

        // ⚡ SPECIAL FIX: Unwrap "fastodds.online" wrapper
        // The wrapper blocks embedding (X-Frame-Options), but the inner iframe allows it.
        if (streamUrl && streamUrl.includes("fastodds.online")) {
            console.log(`🔓 Unwrapping FastOdds Encrypted Stream: ${streamUrl}`);
            try {
                const response = await axios.get(streamUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    }
                });

                // Extract src="..." from the first iframe found
                const match = response.data.match(/<iframe\s+src="([^"]+)"/);
                if (match && match[1]) {
                    const innerUrl = match[1];
                    console.log(`✅ Unwrapped URL: ${innerUrl}`);
                    streamUrl = innerUrl;

                    // Optional: Update DB with the unwrapped URL to save future fetches? 
                    // No, let's keep the original source in DB as "source of truth" and unwrap on fly,
                    // or valid tokens might expire if we just store the final link forever.
                    // Actually, the inner link likely has a token too. Let's just use it for now.
                } else {
                    console.log("⚠️ Could not find inner iframe in FastOdds wrapper.");
                }
            } catch (err) {
                console.log(`❌ Failed to unwrap FastOdds: ${err.message}`);
            }
        }

        if (!streamUrl) return res.send("Stream Not Available (Source Offline)");

        // 2. Inject URL directly into HTML
        const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${event.name} | Live Stream</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
    body {
        margin: 0;
        background: #000;
        font-family: Arial, sans-serif;
        color: white;
        text-align: center;
        overflow: hidden; 
    }
    
    .player {
        width: 100vw;
        height: 100vh;
        position: relative;
    }

    iframe {
        width: 100%;
        height: 100%;
        border: none;
        background: transparent;
    }
</style>
</head>
<body>

<div class="player">
    <iframe src="${streamUrl}" allowfullscreen></iframe>
</div>

</body>
</html>
        `;

        res.send(html);

    } catch (e) {
        console.error("❌ PLAYER SSR ERROR:", e.message);
        res.status(500).send("Player Error");
    }
}

module.exports = { getPlayerPage };
