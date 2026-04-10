const express = require('express');
const router = express.Router();
const { queryMenu } = require('../controllers/menu.controller');

router.get('/menu', queryMenu);

module.exports = router;
