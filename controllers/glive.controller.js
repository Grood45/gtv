const { fetchStream } = require("../services/stream.service");

async function gliveHandler(req, res) {
  try {
    const data = await fetchStream(req.params.matchId);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

module.exports = { gliveHandler };
