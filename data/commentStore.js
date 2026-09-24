const Comment = require('../models/Comment');
const CommentRateLimit = require('../models/CommentRateLimit');

const WINDOW_MS = 60 * 1000;
const GUEST_COMMENT_LIMIT = 3;

async function listArticleComments(articleId) {
  return Comment.find({ article: articleId })
    .sort({ createdAt: 1 })
    .limit(200)
    .select('author body createdAt')
    .lean();
}

async function reserveGuestComment(deviceHash, now = new Date()) {
  const cutoff = new Date(now.getTime() - WINDOW_MS);
  const expired = { $lte: ['$windowStartedAt', cutoff] };
  const updateWindow = [
    { $set: {
      windowStartedAt: { $cond: [expired, now, '$windowStartedAt'] },
      count: { $cond: [expired, 1, { $add: ['$count', 1] }] }
    } }
  ];

  try {
    const reserved = await CommentRateLimit.findOneAndUpdate(
      { deviceHash, $or: [{ windowStartedAt: { $lte: cutoff } }, { count: { $lt: GUEST_COMMENT_LIMIT } }] },
      updateWindow,
      { new: true, upsert: false }
    );
    if (reserved) return true;

    try {
      await CommentRateLimit.create({ deviceHash, windowStartedAt: now, count: 1 });
      return true;
    } catch (error) {
      if (error.code !== 11000) throw error;
      const retry = await CommentRateLimit.findOneAndUpdate(
        { deviceHash, $or: [{ windowStartedAt: { $lte: cutoff } }, { count: { $lt: GUEST_COMMENT_LIMIT } }] },
        updateWindow,
        { new: true, upsert: false }
      );
      return Boolean(retry);
    }
  } catch (error) {
    throw error;
  }
}

async function createArticleComment({ articleId, author, body }) {
  const comment = await Comment.create({ article: articleId, author, body });
  return { _id: comment._id, author: comment.author, body: comment.body, createdAt: comment.createdAt };
}

module.exports = { listArticleComments, reserveGuestComment, createArticleComment, WINDOW_MS, GUEST_COMMENT_LIMIT };
