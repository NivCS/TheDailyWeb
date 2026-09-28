const mongoose = require('mongoose');
const Article = require('../models/Article');
const ArticleAnalytics = require('../models/ArticleAnalytics');
const ArticleViewBucket = require('../models/ArticleViewBucket');
const ArticlePublicationEvent = require('../models/ArticlePublicationEvent');
const { recordPublicationEvent } = require('./analyticsStore');
const { articleWorkflowStatus, publicVersion } = require('./reporterArticleStore');
function validId(id) { return mongoose.isValidObjectId(id); }
function pendingFilter(id) {
  return { _id: id, $or: [{ workflowStatus: 'pending' }, { workflowStatus: { $exists: false }, status: 'pending' }, { workflowStatus: 'draft', status: 'pending' }] };
}
function editorVersion(article) {
  const workingCopy = article.workingCopy?.toObject ? article.workingCopy.toObject() : article.workingCopy;
  if (article.status === 'published' && article.approved && articleWorkflowStatus(article) === 'published') return publicVersion(article);
  if (articleWorkflowStatus(article) === 'returned' && article.submittedCopy?.title) {
    const submittedCopy = article.submittedCopy?.toObject ? article.submittedCopy.toObject() : article.submittedCopy;
    return {
      title: submittedCopy.title || '', excerpt: submittedCopy.excerpt || '',
      content: Array.isArray(submittedCopy.content) ? submittedCopy.content : [],
      category: submittedCopy.category || article.category || 'World', image: submittedCopy.image || ''
    };
  }
  if (workingCopy?.title) return {
    title: workingCopy.title || '', excerpt: workingCopy.excerpt || '',
    content: Array.isArray(workingCopy.content) ? workingCopy.content : [],
    category: workingCopy.category || article.category || 'World', image: workingCopy.image || ''
  };
  if (article.status === 'published' && article.approved) return publicVersion(article);
  const hasLegacySubmission = article.title !== 'Untitled story'
    || article.excerpt || article.image || (Array.isArray(article.content) && article.content.length);
  if (articleWorkflowStatus(article) === 'pending' && hasLegacySubmission) return publicVersion(article);
  return { title: '', excerpt: '', content: [], category: article.category || 'World', image: '' };
}
async function listEditorArticles() {
  const articles = await Article.find({}).sort({ updatedAt: -1, submittedAt: -1 }).lean();
  return articles.map((article) => ({
    ...article, workflowStatus: articleWorkflowStatus(article), workingCopy: editorVersion(article),
    hasPublicVersion: article.status === 'published' && article.approved === true
  }));
}
async function findEditorArticle(id) {
  if (!validId(id)) return null;
  const article = await Article.findById(id).lean();
  if (!article) return null;
  return {
    ...article, workflowStatus: articleWorkflowStatus(article), workingCopy: editorVersion(article),
    hasPublicVersion: article.status === 'published' && article.approved === true
  };
}
async function saveEditorChanges(id, workingCopy) {
  if (!validId(id)) return null;
  return Article.findOneAndUpdate(pendingFilter(id), { $set: { workingCopy } }, { new: true, runValidators: true }).lean();
}
async function approveEditorArticle(id, workingCopy, editorId) {
  if (!validId(id)) return null;
  const session = await mongoose.startSession();
  const eventAt = new Date();
  const eventKey = require('crypto').randomUUID();
  let updated = null;

  try {
    await session.withTransaction(async () => {
      const current = await Article.findOne(pendingFilter(id)).session(session).lean();
      if (!current) return;
      const article = await Article.findOneAndUpdate(
        { ...pendingFilter(id), updatedAt: current.updatedAt },
        { $set: {
          title: workingCopy.title, excerpt: workingCopy.excerpt, content: workingCopy.content,
          category: workingCopy.category, image: workingCopy.image, workingCopy,
          status: 'published', approved: true, workflowStatus: 'published',
          publishedAt: eventAt, reviewNote: ''
        }, $unset: { submittedCopy: 1 } },
        { new: true, runValidators: true, session }
      ).lean();
      if (!article) return;

      const eventType = current.status === 'published' && current.approved ? 'update' : 'publication';
      await recordPublicationEvent({
        articleId: article._id, eventAt, eventType, editorId,
        title: article.title, eventKey, session
      });
      updated = article;
    });
    return updated;
  } finally {
    await session.endSession();
  }
}
async function savePublishedEditorChanges(id, workingCopy, editorId) {
  if (!validId(id)) return null;
  const session = await mongoose.startSession();
  const eventAt = new Date();
  const eventKey = require('crypto').randomUUID();
  let updated = null;

  try {
    await session.withTransaction(async () => {
      const filter = {
        _id: id, status: 'published', approved: true,
        workflowStatus: { $nin: ['pending', 'returned'] }
      };
      const current = await Article.findOne(filter).session(session).lean();
      if (!current) return;

      const reporterDraftExists = ['draft', 'returned'].includes(current.workflowStatus) && current.workingCopy?.title;
      const set = {
        title: workingCopy.title, excerpt: workingCopy.excerpt, content: workingCopy.content,
        category: workingCopy.category, image: workingCopy.image, publishedAt: eventAt
      };
      if (!reporterDraftExists) {
        set.workingCopy = workingCopy;
        set.workflowStatus = 'published';
      }

      const article = await Article.findOneAndUpdate(
        { ...filter, updatedAt: current.updatedAt },
        { $set: set },
        { new: true, runValidators: true, session }
      ).lean();
      if (!article) return;

      await recordPublicationEvent({
        articleId: article._id, eventAt, eventType: 'update', editorId,
        title: article.title, eventKey, session
      });
      updated = article;
    });
    return updated;
  } finally {
    await session.endSession();
  }
}
async function returnEditorArticle(id, note) {
  if (!validId(id)) return null;
  const article = await Article.findOne(pendingFilter(id)).lean();
  if (!article) return null;
  const submittedCopy = article.submittedCopy?.title
    ? article.submittedCopy
    : article.workingCopy?.title ? article.workingCopy : publicVersion(article);
  return Article.findOneAndUpdate(
    { ...pendingFilter(id), updatedAt: article.updatedAt },
    { $set: { workflowStatus: 'returned', reviewNote: note, submittedCopy } },
    { new: true, runValidators: true }
  ).lean();
}
async function deleteEditorArticle(id) {
  if (!validId(id)) return false;
  const session = await mongoose.startSession();

  try {
    let deleted = false;
    await session.withTransaction(async () => {
      const result = await Article.deleteOne({ _id: id, workflowStatus: { $ne: 'returned' } }, { session });
      if (!result.deletedCount) return;
      await ArticleAnalytics.deleteOne({ article: id }, { session });
      await ArticleViewBucket.deleteMany({ article: id }, { session });
      await ArticlePublicationEvent.deleteMany({ article: id }, { session });
      deleted = true;
    });
    return deleted;
  } finally {
    await session.endSession();
  }
}
module.exports = {
  approveEditorArticle, deleteEditorArticle, findEditorArticle, listEditorArticles,
  returnEditorArticle, saveEditorChanges, savePublishedEditorChanges
};
