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
  if (['pending', 'returned', 'published'].includes(article.workflowStatus)) return article.workflowStatus;
  if (article.status === 'pending') return 'pending';
  if (article.workflowStatus === 'draft' && article.status === 'published' && article.approved
    && article.workingCopy?.title && sameArticleVersion(publicVersion(article), article.workingCopy)) return 'published';
  if (article.workflowStatus === 'draft' && article.status === 'published' && article.approved && !article.workingCopy?.title) return 'published';
  return article.workflowStatus || (article.status === 'published' && article.approved ? 'published' : article.status || 'draft');
}

function ensureWorkingCopy(article) {
  if (!article.workingCopy || !article.workingCopy.title) {
    article.workingCopy = article.status === 'published' && article.approved
      ? publicVersion(article)
      : { title: '', excerpt: '', content: [], category: 'World', image: '' };
  }
}

function sameArticleVersion(left, right) {
  if (!left || !right) return false;
  const scalarFieldsMatch = ['title', 'excerpt', 'category', 'image']
    .every((field) => String(left[field] || '').trim() === String(right[field] || '').trim());
  const paragraphs = (value) => (Array.isArray(value) ? value : [])
    .flatMap((paragraph) => String(paragraph || '').split(/\r?\n/))
    .map((paragraph) => paragraph.trim()).filter(Boolean);
  return scalarFieldsMatch && JSON.stringify(paragraphs(left.content)) === JSON.stringify(paragraphs(right.content));
}

async function listReporterArticles(reporterId, { status = 'all', sort = 'newest' } = {}) {
  const articles = await Article.find({ reporter: reporterId }).sort({ updatedAt: sort === 'oldest' ? 1 : -1 }).lean();
  return status === 'all' ? articles : articles.filter((article) => articleWorkflowStatus(article) === status);
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
  const currentStatus = articleWorkflowStatus(article);
  const missingPublicWorkingCopy = article.status === 'published' && article.approved && !article.workingCopy?.title;
  ensureWorkingCopy(article);
  if (currentStatus === 'published' && missingPublicWorkingCopy && article.workflowStatus === 'draft') article.workflowStatus = 'published';
  return article;
}

async function saveReporterDraft(articleId, reporterId, workingCopy) {
  const article = await findOwnedArticle(articleId, reporterId);
  if (!article || !EDITABLE_STATUSES.includes(articleWorkflowStatus(article))) return null;
  const currentStatus = articleWorkflowStatus(article);
  ensureWorkingCopy(article);
  const hasPublicVersion = article.status === 'published' && article.approved;
  if (hasPublicVersion && ['published', 'draft'].includes(currentStatus)) {
    if (sameArticleVersion(publicVersion(article), workingCopy)) {
      article.workflowStatus = 'published';
      workingCopy = publicVersion(article);
    } else {
      article.workflowStatus = 'draft';
    }
  }
  article.workingCopy = workingCopy;
  await article.save();
  return article;
}

async function submitReporterArticle(articleId, reporterId, workingCopy) {
  const article = await findOwnedArticle(articleId, reporterId);
  if (!article || !['draft', 'returned'].includes(articleWorkflowStatus(article))) return null;
  article.workflowStatus = 'pending';
  article.submittedCopy = workingCopy;
  article.submittedAt = new Date();
  article.reviewNote = '';
  await article.save();
  return article;
}

async function removeReporterDraft(articleId, reporterId) {
  if (!mongoose.isValidObjectId(articleId)) return false;
  const article = await findOwnedArticle(articleId, reporterId);
  if (!article) return false;
  const status = articleWorkflowStatus(article);

  if (article.status === 'published' && article.approved && status === 'draft') {
    article.workflowStatus = 'published';
    article.workingCopy = publicVersion(article);
    article.reviewNote = '';
    await article.save();
    return { action: 'restored' };
  }

  if (article.status === 'draft' && !article.approved && status === 'draft') {
    const result = await Article.deleteOne({ _id: articleId, reporter: reporterId, status: 'draft', approved: false, workflowStatus: 'draft' });
    return result.deletedCount === 1 ? { action: 'deleted' } : false;
  }
  return false;
}

module.exports = {
  articleWorkflowStatus,
  beginReporterEdit,
  createReporterArticle,
  removeReporterDraft,
  listReporterArticles,
  publicVersion,
  sameArticleVersion,
  saveReporterDraft,
  submitReporterArticle
};
