const express = require('express');
const { list, detail } = require('../controllers/articleController');

const router = express.Router();
router.get('/', list);
router.get('/:id', detail);

module.exports = router;
