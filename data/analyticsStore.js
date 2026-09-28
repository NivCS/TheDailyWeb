const crypto = require('crypto');
const mongoose = require('mongoose');
const Article = require('../models/Article');
const ArticleAnalytics = require('../models/ArticleAnalytics');
const ArticleViewBucket = require('../models/ArticleViewBucket');
const ArticlePublicationEvent = require('../models/ArticlePublicationEvent');

const HOUR_MS = 60 * 60 * 1000;
const COUNTER_SHARDS = 8;
const RANGE_HOURS = { '24h': 24, '7d': 168, '30d': 720, '90d': 2160 };

function hourStart(date) {
  return new Date(Math.floor(date.getTime() / HOUR_MS) * HOUR_MS);
}

async function recordArticleView(articleId, viewedAt = new Date()) {
  if (!mongoose.isValidObjectId(articleId)) return false;
  const bucket = hourStart(viewedAt);
  const shard = crypto.randomInt(COUNTER_SHARDS);
  const filter = { article: articleId, hourStart: bucket, shard };

  try {
    await ArticleViewBucket.updateOne(filter, { $inc: { views: 1 } }, { upsert: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
    await ArticleViewBucket.updateOne(filter, { $inc: { views: 1 } });
  }
  return true;
}

async function recordPublicationEvent({ articleId, eventAt, eventType, editorId, title, eventKey, session }) {
  await ArticleAnalytics.updateOne(
    { article: articleId },
    { $setOnInsert: { article: articleId, viewsAtTrackingStart: 0, trackingStartedAt: eventAt } },
    { upsert: true, session }
  );
  await ArticlePublicationEvent.create([{
    article: articleId, eventAt, eventType, editor: editorId, articleTitle: title, eventKey
  }], { session });
}

async function listAnalyticsArticles() {
  return Article.find({ status: 'published', approved: true })
    .select('_id title author publishedAt')
    .sort({ title: 1 })
    .lean();
}

async function getArticleAnalytics(articleId, range = '30d') {
  if (!mongoose.isValidObjectId(articleId)) return null;
  const article = await Article.findOne({ _id: articleId, status: 'published', approved: true })
    .select('_id title author publishedAt')
    .lean();
  if (!article) return null;

  const now = new Date();
  const currentHour = hourStart(now);
  const hours = RANGE_HOURS[range] || RANGE_HOURS['30d'];
  const rangeStart = new Date(currentHour.getTime() - hours * HOUR_MS);
  const analytics = await ArticleAnalytics.findOne({ article: article._id })
    .select('viewsAtTrackingStart trackingStartedAt')
    .lean();
  const trackingStartedAt = analytics?.trackingStartedAt || article.publishedAt;
  const graphStart = Math.max(rangeStart.getTime(), trackingStartedAt.getTime());
  const firstHour = hourStart(new Date(graphStart));

  const [priorRows, bucketRows, eventRows] = await Promise.all([
    ArticleViewBucket.aggregate([
      { $match: { article: article._id, hourStart: { $lt: firstHour } } },
      { $group: { _id: null, views: { $sum: '$views' } } }
    ]),
    ArticleViewBucket.aggregate([
      { $match: { article: article._id, hourStart: { $gte: firstHour, $lte: currentHour } } },
      { $group: { _id: '$hourStart', views: { $sum: '$views' } } },
      { $sort: { _id: 1 } }
    ]),
    ArticlePublicationEvent.find({ article: article._id, eventAt: { $gte: new Date(graphStart), $lte: now } })
      .sort({ eventAt: 1 })
      .populate('editor', 'username')
      .lean()
  ]);

  const countsByHour = new Map(bucketRows.map((row) => [row._id.getTime(), row.views]));
  let cumulativeViews = (analytics?.viewsAtTrackingStart || 0) + (priorRows[0]?.views || 0);
  const points = [{ at: new Date(graphStart).toISOString(), totalViews: cumulativeViews }];
  let rangeViews = 0;
  for (let at = firstHour.getTime(); at <= currentHour.getTime(); at += HOUR_MS) {
    const views = countsByHour.get(at) || 0;
    cumulativeViews += views;
    rangeViews += views;
    points.push({
      at: new Date(Math.min(at + HOUR_MS, now.getTime())).toISOString(),
      totalViews: cumulativeViews
    });
  }

  const publicationEvents = eventRows.map((event) => ({
    eventAt: event.eventAt.toISOString(),
    eventType: event.eventType,
    articleTitle: event.articleTitle,
    editor: event.editor?.username || ''
  }));

  return {
    article: { id: String(article._id), title: article.title, author: article.author },
    range,
    rangeStart: rangeStart.toISOString(),
    rangeEnd: now.toISOString(),
    trackingStartedAt: trackingStartedAt.toISOString(),
    totalViews: cumulativeViews,
    rangeViews,
    points,
    publicationEvents
  };
}

module.exports = { getArticleAnalytics, listAnalyticsArticles, recordArticleView, recordPublicationEvent, RANGE_HOURS };
