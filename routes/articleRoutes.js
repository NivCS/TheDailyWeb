const express = require('express');
const { list, detail } = require('../controllers/articleController');
const comments = require('../controllers/commentController');
const { ensureCommentDevice } = require('../middleware/commentDevice');

const router = express.Router();
router.get('/', list);
router.get('/:id/comments', ensureCommentDevice, comments.list);
router.post('/:id/comments', ensureCommentDevice, comments.create);
router.get('/:id', detail);

module.exports = router;
