const { fetchStream } = require("../services/stream.service");

async function gliveHandler(req, res) {
  try {
    console.log(`[GLIVE_HIT] Requesting stream for Match ID: ${req.params.matchId}`);
    const data = await fetchStream(req.params.matchId);

    if (data && data.streamingUrl) {
      console.log(`✅ [GLIVE_SUCCESS] Stream obtained for Match ${req.params.matchId}: ${data.streamingUrl}`);
    } else {
      console.log(`⚠️ [GLIVE_EMPTY] No stream URL returned for Match ${req.params.matchId}`);
    }

    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

module.exports = { gliveHandler };
