const Article = require('../models/Article');
const sampleArticles = require('./sampleArticles');

const isDatabaseReady = () => Article.db.readyState === 1;

async function seedSampleArticles() {
  if (!isDatabaseReady()) return;
  await Article.bulkWrite(sampleArticles.map((article) => ({
    updateOne: {
      filter: { slug: article.slug },
      update: { $setOnInsert: article },
      upsert: true
    }
  })));
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function listPublishedArticles({ search = '', category = '', readState = 'all', viewedIds = [], sort = 'date', offset = 0, limit = 20 }) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 20);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const normalizedSearch = String(search).trim();

  if (!isDatabaseReady()) {
    let results = sampleArticles.filter((article) => article.status === 'published' && article.approved && article.publishedAt <= new Date());
    if (normalizedSearch) {
      const query = normalizedSearch.toLowerCase();
      results = results.filter((article) => `${article.title} ${article.excerpt} ${article.category} ${article.author}`.toLowerCase().includes(query));
    }
    if (category) results = results.filter((article) => article.category === category);
    const seen = new Set(viewedIds);
    if (readState === 'read') results = results.filter((article) => seen.has(article.slug));
    if (readState === 'unread') results = results.filter((article) => !seen.has(article.slug));
    results.sort(sort === 'popular'
      ? (a, b) => b.views - a.views || b.publishedAt - a.publishedAt
      : (a, b) => b.publishedAt - a.publishedAt);
    const total = results.length;
    return { articles: results.slice(safeOffset, safeOffset + safeLimit), total, offset: safeOffset, limit: safeLimit, hasMore: safeOffset + safeLimit < total };
  }

  const filter = { status: 'published', approved: true, publishedAt: { $lte: new Date() } };
  if (normalizedSearch) {
    const pattern = new RegExp(escapeRegex(normalizedSearch), 'i');
    filter.$or = [{ title: pattern }, { excerpt: pattern }, { category: pattern }, { author: pattern }];
  }
  if (category) filter.category = category;
  if (readState === 'read' || readState === 'unread') {
    const readFilter = readState === 'read' ? '$in' : '$nin';
    filter.slug = { [readFilter]: viewedIds };
  }
  const order = sort === 'popular' ? { views: -1, publishedAt: -1 } : { publishedAt: -1 };
  const [articles, total] = await Promise.all([
    Article.find(filter).sort(order).skip(safeOffset).limit(safeLimit).lean(),
    Article.countDocuments(filter)
  ]);
  return { articles, total, offset: safeOffset, limit: safeLimit, hasMore: safeOffset + safeLimit < total };
}

async function findPublishedArticle(id) {
  const filter = { status: 'published', approved: true, publishedAt: { $lte: new Date() } };
  if (isDatabaseReady()) {
    return Article.findOne({ ...filter, slug: id }).lean();
  }
  return sampleArticles.find((article) => article.slug === id && article.status === 'published' && article.approved) || null;
}

module.exports = { seedSampleArticles, listPublishedArticles, findPublishedArticle };
