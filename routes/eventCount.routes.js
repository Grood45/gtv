const express = require('express');
const router = express.Router();
const { getLiveEventCounts } = require('../controllers/eventCount.controller');

router.get('/event-count', getLiveEventCounts);

module.exports = router;
