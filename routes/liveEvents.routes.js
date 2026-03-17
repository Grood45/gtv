const express = require('express');
const router = express.Router();
const { 
    getInplayEvents, 
    getTodayEvents, 
    getTomorrowEvents 
} = require('../controllers/liveEvents.controller');

router.get('/inplay', getInplayEvents);
router.get('/today', getTodayEvents);
router.get('/tomorrow', getTomorrowEvents);

module.exports = router;
