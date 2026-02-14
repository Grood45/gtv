const { fetchStream } = require("../services/stream.service");

const { unwrapFastOdds } = require("../utils/stream.utils");

async function gliveHandler(req, res) {
  try {
    const data = await fetchStream(req.params.matchId);

    // Unwrap FastOdds URL if present
    if (data && data.streamingUrl) {
      data.streamingUrl = await unwrapFastOdds(data.streamingUrl);
    }

    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

module.exports = { gliveHandler };
