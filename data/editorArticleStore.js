const mongoose = require('mongoose');
const Article = require('../models/Article');
const { articleWorkflowStatus, publicVersion } = require('./reporterArticleStore');
function validId(id) { return mongoose.isValidObjectId(id); }
function pendingFilter(id) {
  return { _id: id, $or: [{ workflowStatus: 'pending' }, { workflowStatus: { $exists: false }, status: 'pending' }, { workflowStatus: 'draft', status: 'pending' }] };
}
function editorVersion(article) {
  const workingCopy = article.workingCopy?.toObject ? article.workingCopy.toObject() : article.workingCopy;
  if (article.status === 'published' && article.approved && articleWorkflowStatus(article) === 'published') return publicVersion(article);
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
async function approveEditorArticle(id, workingCopy) {
  if (!validId(id)) return null;
  return Article.findOneAndUpdate(pendingFilter(id), { $set: {
    title: workingCopy.title, excerpt: workingCopy.excerpt, content: workingCopy.content,
    category: workingCopy.category, image: workingCopy.image, workingCopy,
    status: 'published', approved: true, workflowStatus: 'published',
    publishedAt: new Date(), reviewNote: ''
  } }, { new: true, runValidators: true }).lean();
}
async function savePublishedEditorChanges(id, workingCopy) {
  if (!validId(id)) return null;
  const article = await Article.findOneAndUpdate(
    { _id: id, status: 'published', approved: true, workflowStatus: { $ne: 'pending' } },
    { $set: {
      title: workingCopy.title, excerpt: workingCopy.excerpt, content: workingCopy.content,
      category: workingCopy.category, image: workingCopy.image, publishedAt: new Date()
    } },
    { new: true, runValidators: true }
  ).lean();
  if (!article) return null;

  // Keep an author's active draft separate from the editor's published revision.
  const reporterDraftExists = ['draft', 'returned'].includes(article.workflowStatus) && article.workingCopy?.title;
  if (reporterDraftExists) return article;

  return Article.findOneAndUpdate(
    { _id: id, status: 'published', approved: true, workflowStatus: { $ne: 'pending' } },
    { $set: { workingCopy, workflowStatus: 'published' } },
    { new: true, runValidators: true }
  ).lean();
}

async function returnEditorArticle(id, note) {
  if (!validId(id)) return null;
  return Article.findOneAndUpdate(pendingFilter(id), { $set: { workflowStatus: 'returned', reviewNote: note } }, { new: true, runValidators: true }).lean();
}
async function deleteEditorArticle(id) {
  if (!validId(id)) return false;
  const result = await Article.deleteOne({ _id: id });
  return result.deletedCount === 1;
}
module.exports = {
  approveEditorArticle, deleteEditorArticle, findEditorArticle, listEditorArticles,
  returnEditorArticle, saveEditorChanges, savePublishedEditorChanges
};
