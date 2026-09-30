const Article = require('../models/Article');

function escapeRegex(value) {
  return value.replace(/[.*+?^\x24{}()|[\]\\]/g, '\\$&');
}

const PUBLIC_ARTICLE_FIELDS = {
  _id: 1, title: 1, slug: 1, excerpt: 1, category: 1, author: 1,
  image: 1, publishedAt: 1, readingTimeMinutes: 1, views: 1
};

async function listPublishedArticles({ search = '', category = '', readState = 'all', viewedIds = [], sort = 'date', offset = 0, limit = 20 }) {
  const safeLimit = Math.min(Math.max(Math.floor(Number(limit) || 20), 1), 20);
  const safeOffset = Math.max(Math.floor(Number(offset) || 0), 0);
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
  const pageStages = [
    { $match: filter }, { $sort: order }, { $skip: safeOffset }, { $limit: safeLimit },
    { $project: { ...PUBLIC_ARTICLE_FIELDS, views: { $ifNull: ['$views', 0] }, readingTimeMinutes: { $ifNull: ['$readingTimeMinutes', 1] } } }
  ];
  const [articles, total] = await Promise.all([
    Article.aggregate(pageStages),
    Article.countDocuments(filter)
  ]);
  return { articles, total, offset: safeOffset, limit: safeLimit, hasMore: safeOffset + safeLimit < total };
}

async function findPublishedArticle(id) {
  const articles = await Article.aggregate([
    { $match: { status: 'published', approved: true, publishedAt: { $lte: new Date() }, slug: id } },
    { $limit: 1 },
    { $project: { ...PUBLIC_ARTICLE_FIELDS, content: 1, views: { $ifNull: ['$views', 0] }, readingTimeMinutes: { $ifNull: ['$readingTimeMinutes', 1] } } }
  ]);
  return articles[0] || null;
}

module.exports = { listPublishedArticles, findPublishedArticle };
