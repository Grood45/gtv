const express = require('express');
const router = express.Router();
const { getSportEvents } = require('../controllers/sportEvents.controller');

// GET /nw/v1/sport/:sportId
router.get('/:sportId', getSportEvents);

module.exports = router;
