const express = require('express');
const router = express.Router();
const { getFullMarkets } = require('../controllers/fullMarkets.controller');

// GET /nw/v1/fullMarkets/:eventId/:marketId
router.get('/:eventId/:marketId', getFullMarkets);

module.exports = router;
