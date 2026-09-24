const crypto = require('crypto');
const mongoose = require('mongoose');
const Article = require('../models/Article');

const EDITABLE_STATUSES = ['draft', 'returned', 'published'];

function slugify(value) {
  const base = String(value || 'story').toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '').slice(0, 60);
  return `${base || 'story'}-${crypto.randomBytes(3).toString('hex')}`;
}

function publicVersion(article) {
  return {
    title: article.title,
    excerpt: article.excerpt,
    content: article.content,
    category: article.category,
    image: article.image
  };
}

function articleWorkflowStatus(article) {
  if (article.workflowStatus) return article.workflowStatus;
  return article.status === 'published' && article.approved ? 'published' : article.status || 'draft';
}

function ensureWorkingCopy(article) {
  if (!article.workingCopy || !article.workingCopy.title) {
    article.workingCopy = article.status === 'published' && article.approved
      ? publicVersion(article)
      : { title: '', excerpt: '', content: [], category: 'World', image: '' };
  }
}

async function listReporterArticles(reporterId, { status = 'all', sort = 'newest' } = {}) {
  const filter = { reporter: reporterId };
  if (status !== 'all') filter.workflowStatus = status;
  return Article.find(filter).sort({ updatedAt: sort === 'oldest' ? 1 : -1 }).lean();
}

async function createReporterArticle(reporterId, username) {
  const article = await Article.create({
    title: 'Untitled story',
    slug: slugify('untitled-story'),
    excerpt: '',
    content: [],
    category: 'World',
    author: username,
    image: '',
    publishedAt: new Date(),
    reporter: reporterId,
    status: 'draft',
    approved: false,
    workflowStatus: 'draft',
    workingCopy: { title: '', excerpt: '', content: [], category: 'World', image: '' }
  });
  return article;
}

async function findOwnedArticle(articleId, reporterId) {
  if (!mongoose.isValidObjectId(articleId)) return null;
  return Article.findOne({ _id: articleId, reporter: reporterId });
}

async function beginReporterEdit(articleId, reporterId) {
  const article = await findOwnedArticle(articleId, reporterId);
  if (!article || !EDITABLE_STATUSES.includes(articleWorkflowStatus(article))) return null;
  ensureWorkingCopy(article);
  if (articleWorkflowStatus(article) === 'published') article.workflowStatus = 'draft';
  await article.save();
  return article;
}

async function saveReporterDraft(articleId, reporterId, workingCopy) {
  const article = await findOwnedArticle(articleId, reporterId);
  if (!article || !EDITABLE_STATUSES.includes(articleWorkflowStatus(article))) return null;
  ensureWorkingCopy(article);
  if (articleWorkflowStatus(article) === 'published') article.workflowStatus = 'draft';
  article.workingCopy = workingCopy;
  await article.save();
  return article;
}

async function submitReporterArticle(articleId, reporterId) {
  const article = await findOwnedArticle(articleId, reporterId);
  if (!article || !['draft', 'returned'].includes(articleWorkflowStatus(article))) return null;
  article.workflowStatus = 'pending';
  article.submittedAt = new Date();
  article.reviewNote = '';
  await article.save();
  return article;
}

async function deleteReporterDraft(articleId, reporterId) {
  if (!mongoose.isValidObjectId(articleId)) return false;
  const result = await Article.deleteOne({
    _id: articleId,
    reporter: reporterId,
    status: 'draft',
    approved: false,
    workflowStatus: 'draft'
  });
  return result.deletedCount === 1;
}

module.exports = {
  articleWorkflowStatus,
  beginReporterEdit,
  createReporterArticle,
  deleteReporterDraft,
  listReporterArticles,
  publicVersion,
  saveReporterDraft,
  submitReporterArticle
};
