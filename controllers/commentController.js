const { findPublishedArticle } = require('../data/articleStore');
const {
  listArticleComments, reserveGuestComment, createArticleComment,
  updateArticleComment, deleteArticleComment, WINDOW_MS, GUEST_COMMENT_LIMIT
} = require('../data/commentStore');
const mongoose = require('mongoose');
const logger = require('../services/logger');

const LIMIT_MESSAGE = `You can post up to ${GUEST_COMMENT_LIMIT} comments per minute from this device. Please try again in a minute.`;

async function list(req, res, next) {
  try {
    const article = await findPublishedArticle(req.params.id);
    if (!article) return res.status(404).json({ error: 'This story could not be found.' });
    const comments = await listArticleComments(article._id);
    res.json({ comments });
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const article = await findPublishedArticle(req.params.id);
    if (!article) return res.status(404).json({ error: 'This story could not be found.' });

    const author = String(req.body.author || '').trim().slice(0, 40) || 'Guest';
    const body = String(req.body.body || '').trim();
    if (!body) return res.status(400).json({ error: 'Write a comment before submitting.' });
    if (body.length > 1000) return res.status(400).json({ error: 'Comments must be 1,000 characters or fewer.' });

    if (!req.user) {
      const allowed = await reserveGuestComment(req.commentDeviceHash);
      if (!allowed) {
        res.set('Retry-After', String(Math.ceil(WINDOW_MS / 1000)));
        return res.status(429).json({ error: LIMIT_MESSAGE });
      }
    }

    const comment = await createArticleComment({ articleId: article._id, author, body });
    res.status(201).json({ comment });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.commentId)) return res.status(404).json({ error: 'This comment could not be found.' });
    const article = await findPublishedArticle(req.params.id);
    if (!article) return res.status(404).json({ error: 'This story could not be found.' });
    const body = String(req.body?.body || '').trim();
    if (!body) return res.status(400).json({ error: 'A comment cannot be empty.' });
    if (body.length > 1000) return res.status(400).json({ error: 'Comments must be 1,000 characters or fewer.' });

    const comment = await updateArticleComment(article._id, req.params.commentId, body, req.user.id);
    if (!comment) return res.status(404).json({ error: 'This comment could not be found.' });
    logger.info('comment_edited', {
      requestId: req.requestId, actorId: req.user.id, actorRole: req.user.role,
      articleId: String(article._id), commentId: String(comment._id)
    });
    res.json({ comment: { ...comment, wasEdited: true } });
  } catch (error) { next(error); }
}

async function remove(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.commentId)) return res.status(404).json({ error: 'This comment could not be found.' });
    const article = await findPublishedArticle(req.params.id);
    if (!article) return res.status(404).json({ error: 'This story could not be found.' });
    const comment = await deleteArticleComment(article._id, req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'This comment could not be found.' });
    logger.info('comment_deleted', {
      requestId: req.requestId, actorId: req.user.id, actorRole: req.user.role,
      articleId: String(article._id), commentId: String(comment._id)
    });
    res.json({ deleted: true });
  } catch (error) { next(error); }
}

module.exports = { list, create, update, remove };
