const express = require('express');
const { list, detail } = require('../controllers/articleController');
const comments = require('../controllers/commentController');
const { ensureCommentDevice } = require('../middleware/commentDevice');
const { requireRole } = require('../middleware/authentication');

const router = express.Router();
router.get('/', list);
router.get('/:id/comments', ensureCommentDevice, comments.list);
router.post('/:id/comments', ensureCommentDevice, comments.create);
router.put('/:id/comments/:commentId', requireRole('editor'), comments.update);
router.delete('/:id/comments/:commentId', requireRole('editor'), comments.remove);
router.get('/:id', detail);

module.exports = router;
