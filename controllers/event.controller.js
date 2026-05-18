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
        let streamUrl = event.streamUrl;

        console.log(`[EVENT_HIT] User requested stream for: ${event.name} (ID: ${eventId}, Channel: ${streamingChannel})`);

        // 3. ON-DEMAND FETCH: Fetch fresh URL every time if streamingChannel is valid
        if (streamingChannel && streamingChannel !== "0") {
            console.log(`🎥 [FETCH_START] Fetching fresh stream for ${event.name} (${streamingChannel})...`);

            try {
                const streamData = await fetchStream(streamingChannel);
                if (streamData && streamData.streamingUrl) {
                    streamUrl = streamData.streamingUrl;

                    // ⚡ UPDATE DB (Always update with fresh link)
                    await Event.updateOne(
                        { eventId },
                        {
                            $set: {
                                streamUrl: streamUrl,
                                updatedAt: new Date()
                            }
                        }
                    );
                    console.log(`✅ [FETCH_SUCCESS] Stream URL found: ${streamUrl}`);
                } else {
                    console.log(`⚠️ [FETCH_EMPTY] API returned success but no URL for channel: ${streamingChannel}`);
                }
            } catch (err) {
                console.log(`❌ [FETCH_ERROR] Failed for ${event.name}: ${err.message}`);
                // Fallback to old streamUrl if fetch fails
            }
        } else if (streamingChannel === "0") {
            console.log(`🚫 [FETCH_SKIP] Channel is "0" for ${event.name} - No streaming available.`);
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
                streamUrl: streamUrl,

            }
        });

    } catch (e) {
        console.log("❌ EVENT API ERROR:", e.message);
        res.status(500).json({ success: false, error: e.message });
    }
}

async function getPlayerIframe(req, res) {
    try {
        const { eventId } = req.params;

        // 1. Find Event in DB
        const event = await Event.findOne({ eventId });
        if (!event) {
            return res.send("<h2 style='color:white; text-align:center; font-family:sans-serif; margin-top:20px;'>Event not found</h2>");
        }

        // 2. Extract Streaming Channel
        const streamingChannel = event.rawData?.streamingChannel;
        let streamUrl = event.streamUrl;

        // 3. Fetch Fresh Stream URL
        if (streamingChannel && streamingChannel !== "0") {
            try {
                const streamData = await fetchStream(streamingChannel);
                if (streamData && streamData.streamingUrl) {
                    streamUrl = streamData.streamingUrl;
                    
                    // Update DB with fresh link
                    await Event.updateOne(
                        { eventId },
                        { $set: { streamUrl: streamUrl, updatedAt: new Date() } }
                    );
                }
            } catch (err) {
                console.log(`❌ [PLAYER_FETCH_ERROR] ${err.message}`);
            }
        }

        // 4. Build HTML
        if (!streamUrl || streamUrl === "") {
            return res.send("<h2 style='color:white; text-align:center; font-family:sans-serif; margin-top:20px;'>Match will start soon...</h2>");
        }

        const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Live Player - ${event.name}</title>
            <style>
                body, html {
                    margin: 0; padding: 0; width: 100vw; height: 100vh;
                    background-color: #080808; overflow: hidden;
                    font-family: 'Arial', sans-serif;
                }
                .tv-box { width: 100%; height: 100%; position: relative; }
                iframe { width: 100%; height: 100%; border: none; display: block; }
                
                /* Loading Screen CSS */
                #loading-screen {
                    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                    background-color: #080808; display: flex; flex-direction: column;
                    justify-content: center; align-items: center; z-index: 100;
                    transition: opacity 0.5s ease;
                }
                .loader-text {
                    color: #fff; font-size: 16px; margin-bottom: 20px;
                    letter-spacing: 2px; text-transform: uppercase; font-weight: bold;
                }
                .progress-container {
                    width: 80%; max-width: 400px; height: 6px;
                    background: #2a2a35; border-radius: 10px;
                    overflow: hidden; box-shadow: 0 0 15px rgba(0,0,0,0.5);
                }
                .progress-bar {
                    width: 0%; height: 100%;
                    background: linear-gradient(90deg, #ff3366, #ff9933);
                    border-radius: 10px; transition: width 0.1s linear;
                }
                .percentage {
                    color: #ff9933; font-weight: bold; font-size: 22px; margin-top: 15px;
                }
            </style>
            <script>
                // Continuous smooth loading from 0% to 100%
                let progress = 0;
                let loaderInterval = setInterval(() => {
                    if (progress < 100) {
                        progress += 1;
                        document.getElementById('progress-bar').style.width = progress + '%';
                        document.getElementById('percentage').innerText = progress + '%';
                    }
                    
                    // As soon as it hits 100%, hide it
                    if (progress === 100) {
                        hideLoader();
                    }
                }, 60); // 60ms * 100 = 6 seconds exact load time

                let loaderHidden = false;
                function hideLoader() {
                    if(loaderHidden) return;
                    loaderHidden = true;
                    
                    progress = 100;
                    let pbar = document.getElementById('progress-bar');
                    let ptext = document.getElementById('percentage');
                    if(pbar) pbar.style.width = '100%';
                    if(ptext) ptext.innerText = '100%';
                    
                    let loader = document.getElementById('loading-screen');
                    if(loader) {
                        loader.style.opacity = '0';
                        setTimeout(() => { loader.style.display = 'none'; }, 500);
                    }
                    clearInterval(loaderInterval);
                }
            </script>
        </head>
        <body>
            <div class="tv-box" bis_skin_checked="1">
                <!-- Loader -->
                <div id="loading-screen">
                    <div class="loader-text">Connecting to Live Stream...</div>
                    <div class="progress-container">
                        <div class="progress-bar" id="progress-bar"></div>
                    </div>
                    <div class="percentage" id="percentage">0%</div>
                </div>
                
                <!-- Video Player -->
                <iframe id="gliveStreamingIframe" src="${streamUrl}" allowfullscreen onload="hideLoader()"></iframe>
            </div>
        </body>
        </html>
        `;

        res.set('Content-Type', 'text/html');
        // Prevent caching so the iframe gets a fresh token on reload
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        // Allow framing
        res.set('X-Frame-Options', 'ALLOWALL'); 
        
        return res.send(html);

    } catch (e) {
        console.log("❌ PLAYER API ERROR:", e.message);
        res.status(500).send("<h2 style='color:white; text-align:center; font-family:sans-serif; margin-top:20px;'>Internal Server Error</h2>");
    }
}

module.exports = { getEventStream, getPlayerIframe };
