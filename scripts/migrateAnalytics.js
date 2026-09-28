require('dotenv').config();

const mongoose = require('mongoose');
const Article = require('../models/Article');
const ArticleAnalytics = require('../models/ArticleAnalytics');
const ArticleViewBucket = require('../models/ArticleViewBucket');
const ArticlePublicationEvent = require('../models/ArticlePublicationEvent');

const HOUR_MS = 60 * 60 * 1000;
function hourStart(date) {
  return new Date(Math.floor(date.getTime() / HOUR_MS) * HOUR_MS);
}

async function migrate() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  await Promise.all([ArticleAnalytics.createIndexes(), ArticleViewBucket.createIndexes(), ArticlePublicationEvent.createIndexes()]);

  const database = mongoose.connection.db;
  const analyticsCollection = database.collection(ArticleAnalytics.collection.name);
  const articleCollection = database.collection(Article.collection.name);
  const eventCollection = database.collection(ArticlePublicationEvent.collection.name);
  const migrationAt = new Date();
  const articles = await articleCollection.find({}, {
    projection: { views: 1, status: 1, approved: 1, publishedAt: 1, title: 1, createdAt: 1 }
  }).toArray();

  const analyticsRows = await analyticsCollection.find({}).toArray();
  const analyticsByArticle = new Map(analyticsRows.map((row) => [String(row.article), row]));
  const analyticsOps = articles.map((article) => {
    const existing = analyticsByArticle.get(String(article._id));
    const startAt = existing?.trackingStartedAt || existing?.baselineAt || article.publishedAt || article.createdAt || migrationAt;
    const totalViews = Number(existing?.viewsAtTrackingStart ?? existing?.totalViews ?? existing?.baselineViews ?? article.views) || 0;
    return {
      updateOne: {
        filter: { article: article._id },
        update: { $setOnInsert: { article: article._id, viewsAtTrackingStart: Math.max(0, totalViews), trackingStartedAt: startAt } },
        upsert: true
      }
    };
  });
  if (analyticsOps.length) await analyticsCollection.bulkWrite(analyticsOps, { ordered: false });

  const fieldConversions = analyticsRows
    .filter((row) => row.baselineViews !== undefined || row.baselineAt !== undefined || row.totalViews !== undefined)
    .map((row) => ({
      updateOne: {
        filter: { _id: row._id, $or: [{ baselineViews: { $exists: true } }, { baselineAt: { $exists: true } }, { totalViews: { $exists: true } }] },
        update: {
          $set: {
            viewsAtTrackingStart: Math.max(0, Number(row.viewsAtTrackingStart ?? row.totalViews ?? row.baselineViews) || 0),
            trackingStartedAt: row.trackingStartedAt || row.baselineAt || migrationAt
          },
          $unset: { baselineViews: '', baselineAt: '', totalViews: '' }
        }
      }
    }));
  if (fieldConversions.length) await analyticsCollection.bulkWrite(fieldConversions, { ordered: false });
  const articlesWithOldViews = await articleCollection.find({ views: { $exists: true } }, {
    projection: { _id: 1, views: 1 }
  }).toArray();
  const viewOps = articlesWithOldViews.map((article) => ({
    updateOne: {
      filter: { article: article._id },
      update: { $max: { viewsAtTrackingStart: Math.max(0, Number(article.views) || 0) } }
    }
  }));
  if (viewOps.length) await analyticsCollection.bulkWrite(viewOps, { ordered: false });
  const removedArticleViews = await articleCollection.updateMany({ views: { $exists: true } }, { $unset: { views: '' } });

  const oldEvents = await eventCollection.find({ eventType: { $in: ['legacy', 'initial'] } }).toArray();
  const convertedEvents = oldEvents.map((event) => ({
    updateOne: {
      filter: { _id: event._id },
      update: {
        $set: {
          eventType: 'publication',
          eventKey: 'publication-' + String(event.article) + '-' + new Date(event.eventAt).getTime()
        }
      }
    }
  }));
  if (convertedEvents.length) await eventCollection.bulkWrite(convertedEvents, { ordered: false });

  const articleIdsWithEvents = new Set((await eventCollection.distinct('article')).map(String));
  const eventOps = articles
    .filter((article) => article.status === 'published' && article.approved && article.publishedAt && !articleIdsWithEvents.has(String(article._id)))
    .map((article) => {
      const eventKey = 'publication-' + String(article._id) + '-' + new Date(article.publishedAt).getTime();
      return {
        updateOne: {
          filter: { eventKey },
          update: { $setOnInsert: {
            article: article._id,
            eventAt: article.publishedAt,
            eventType: 'publication',
            articleTitle: article.title,
            eventKey
          } },
          upsert: true
        }
      };
    });
  if (eventOps.length) await eventCollection.bulkWrite(eventOps, { ordered: false });

  const records = await analyticsCollection.countDocuments();
  const remainingOldFields = await analyticsCollection.countDocuments({ $or: [{ baselineViews: { $exists: true } }, { baselineAt: { $exists: true } }, { totalViews: { $exists: true } }] });
  const remainingArticleViews = await articleCollection.countDocuments({ views: { $exists: true } });
  const remainingOldEvents = await eventCollection.countDocuments({ eventType: { $in: ['legacy', 'initial'] } });
  if (remainingOldFields || remainingArticleViews || remainingOldEvents) throw new Error('Migration verification failed; old analytics fields or event types remain.');

  const totals = await analyticsCollection.aggregate([{ $group: { _id: null, totalViews: { $sum: '$viewsAtTrackingStart' } } }]).toArray();
  console.log('Analytics migration complete: ' + records + ' article analytics records; ' +
    (totals[0]?.totalViews || 0) + ' existing views carried forward; ' + eventOps.length +
    ' publication dates; ' + removedArticleViews.modifiedCount + ' article counters removed; ' + remainingArticleViews + ' article view fields remain.');
}

migrate()
  .catch((error) => {
    console.error('Analytics migration failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });
