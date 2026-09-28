const Article = require('../models/Article');
const ArticleAnalytics = require('../models/ArticleAnalytics');
const ArticleViewBucket = require('../models/ArticleViewBucket');

function escapeRegex(value) {
  return value.replace(/[.*+?^\x24{}()|[\]\\]/g, '\\$&');
}

function withViewTotals(pipeline) {
  return pipeline.concat([
    { $lookup: {
      from: ArticleAnalytics.collection.name,
      localField: '_id',
      foreignField: 'article',
      as: 'analytics'
    } },
    { $lookup: {
      from: ArticleViewBucket.collection.name,
      let: { articleId: '$_id' },
      pipeline: [
        { $match: { $expr: { $eq: ['$article', '$$articleId'] } } },
        { $group: { _id: null, views: { $sum: '$views' } } }
      ],
      as: 'countedViews'
    } },
    { $addFields: {
      views: { $add: [
        { $ifNull: [{ $arrayElemAt: ['$analytics.viewsAtTrackingStart', 0] }, 0] },
        { $ifNull: [{ $arrayElemAt: ['$countedViews.views', 0] }, 0] }
      ] }
    } },
    { $project: { analytics: 0, countedViews: 0 } }
  ]);
}

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
  const pageStages = [{ $match: filter }];
  if (sort === 'popular') pageStages.push(...withViewTotals([]));
  pageStages.push({ $sort: order }, { $skip: safeOffset }, { $limit: safeLimit });
  const [articles, total] = await Promise.all([
    Article.aggregate(sort === 'popular' ? pageStages : withViewTotals(pageStages)),
    Article.countDocuments(filter)
  ]);
  return { articles, total, offset: safeOffset, limit: safeLimit, hasMore: safeOffset + safeLimit < total };
}

async function findPublishedArticle(id) {
  const articles = await Article.aggregate(withViewTotals([
    { $match: { status: 'published', approved: true, publishedAt: { $lte: new Date() }, slug: id } },
    { $limit: 1 }
  ]));
  return articles[0] || null;
}

module.exports = { listPublishedArticles, findPublishedArticle };
