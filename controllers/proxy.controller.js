const axios = require("axios");
const Event = require("../models/Event");
const { fetchStream } = require("../services/stream.service");

// Helper to get base URL
function getBaseUrl(fullUrl) {
    if (!fullUrl) return "";
    const parts = fullUrl.split("/");
    parts.pop(); // Remove filename
    return parts.join("/");
}

// 🕵️ STEALTH HEADERS (Mimic a Real Browser)
const STREAM_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://live.skyinplay.com/",
    "Origin": "https://live.skyinplay.com",
    "Accept": "*/*",
    "Connection": "keep-alive"
};

async function proxyPlaylist(req, res) {
    try {
        const { eventId } = req.params;

        // 1. Get Event & Stream URL
        const event = await Event.findOne({ eventId });
        if (!event) return res.status(404).send("Event not found");

        let streamUrl = event.streamUrl;

        // ⚡ If no stream URL, try to fetch one immediately
        const streamingChannel = event.rawData?.streamingChannel;
        if ((!streamUrl || streamUrl.length < 10) && streamingChannel) {
            console.log(`📡 PROXY: Fetching fresh URL for ${event.name}`);
            const data = await fetchStream(streamingChannel);
            if (data?.streamingUrl) {
                streamUrl = data.streamingUrl;
                await Event.updateOne({ eventId }, { $set: { streamUrl, updatedAt: new Date() } });
            }
        }

        if (!streamUrl) return res.status(404).send("No stream available");

        // 2. Fetch the m3u8 content (With Stealth Headers)
        const response = await axios.get(streamUrl, {
            headers: STREAM_HEADERS,
            responseType: 'text',
            timeout: 5000
        });

        let m3u8Content = response.data;

        // 3. Rewrite Links
        const baseUrl = getBaseUrl(streamUrl);
        const lines = m3u8Content.split("\n");
        const newLines = lines.map(line => {
            if (line.trim() === "" || line.startsWith("#")) return line;

            let segmentUrl = line.trim();
            if (!segmentUrl.startsWith("http")) {
                segmentUrl = `${baseUrl}/${segmentUrl}`;
            }

            const encodedSegment = encodeURIComponent(segmentUrl);
            // Use Short Cache for Playlist (so player refreshes often)
            return `/glivestreaming/v1/proxy/segment/${encodedSegment}`;
        });

        // 4. Return Modified Playlist
        res.set("Content-Type", "application/vnd.apple.mpegurl");
        res.set("Cache-Control", "no-cache, no-store, must-revalidate");
        res.send(newLines.join("\n"));

    } catch (e) {
        console.error("❌ PROXY PLAYLIST ERROR:", e.message);
        res.status(500).send("Proxy Error");
    }
}

async function proxySegment(req, res) {
    try {
        const { segmentUrl } = req.params;
        const decodedUrl = decodeURIComponent(segmentUrl);

        if (!decodedUrl) return res.status(400).send("Invalid segment");

        // 1. Pipe the Stream (Low Memory Usage)
        const response = await axios({
            method: 'get',
            url: decodedUrl,
            headers: STREAM_HEADERS, // 🕵️ Send Stealth Headers
            responseType: 'stream',   // ⚡ Stream directly (Don't load in RAM)
            timeout: 10000
        });

        // 2. Forward Headers
        res.set("Content-Type", "video/MP2T");
        res.set("Cache-Control", "public, max-age=31536000"); // Cache segments aggressively (they don't change)

        // 3. Pipe Data
        response.data.pipe(res);

    } catch (e) {
        // console.error("❌ PROXY SEGMENT ERROR:", e.message);
        res.status(500).end();
    }
}

module.exports = { proxyPlaylist, proxySegment };
