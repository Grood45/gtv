const express = require('express');
const { getFancyData } = require('../controllers/fancy.controller');
const router = express.Router();

router.get('/:eventId', getFancyData);

module.exports = router;
