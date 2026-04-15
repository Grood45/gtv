const express = require('express');
const router = express.Router();
const resultsController = require('../controllers/results.controller');

// GET /nw/v1/result/fancy?eventId=...
router.get('/fancy', resultsController.getFancyResult);

// GET /nw/v1/result/event?type=today&sportId=4
router.get('/event', resultsController.getEventResults);

module.exports = router;
