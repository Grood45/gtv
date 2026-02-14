const Event = require("../models/Event");
const { fetchStream } = require("../services/stream.service");

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
