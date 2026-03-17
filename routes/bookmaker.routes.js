const express = require('express');
const router = express.Router();
const { getBookmakerMarkets } = require('../controllers/bookmaker.controller');

// GET /nw/v1/bookmaker/:eventId
router.get('/:eventId', getBookmakerMarkets);

module.exports = router;
