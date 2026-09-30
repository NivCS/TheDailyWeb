const express = require('express');
const { current } = require('../controllers/weatherController');

const router = express.Router();
router.get('/', current);

module.exports = router;
