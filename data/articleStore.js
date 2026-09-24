const Article = require('../models/Article');
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function listPublishedArticles({ search = '', category = '', readState = 'all', viewedIds = [], sort = 'date', offset = 0, limit = 20 }) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 20);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const normalizedSearch = String(search).trim();
  const filter = { status: 'published', approved: true, publishedAt: { $lte: new Date() } };

  if (normalizedSearch) {
    const pattern = new RegExp(escapeRegex(normalizedSearch), 'i');
    filter.$or = [{ title: pattern }, { excerpt: pattern }, { category: pattern }, { author: pattern }];
  }
  if (category) filter.category = category;
  if (readState === 'read' || readState === 'unread') {
    filter.slug = { [readState === 'read' ? '$in' : '$nin']: viewedIds };
  }

  const order = sort === 'popular' ? { views: -1, publishedAt: -1 } : { publishedAt: -1 };
  const [articles, total] = await Promise.all([
    Article.find(filter).sort(order).skip(safeOffset).limit(safeLimit).lean(),
    Article.countDocuments(filter)
  ]);
  return { articles, total, offset: safeOffset, limit: safeLimit, hasMore: safeOffset + safeLimit < total };
}

async function findPublishedArticle(id) {
  const filter = { status: 'published', approved: true, publishedAt: { $lte: new Date() }, slug: id };
  return Article.findOne(filter).lean();
}

module.exports = { listPublishedArticles, findPublishedArticle };
