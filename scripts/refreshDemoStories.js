require('dotenv').config();

const mongoose = require('mongoose');
mongoose.set('autoIndex', false);

const Article = require('../models/Article');
const ArticlePublicationEvent = require('../models/ArticlePublicationEvent');
const { storyFor, submittedStory, revisionImageFor } = require('./seedDemoData');

function copyFields(story) {
  const { topicDetails: _topicDetails, ...fields } = story;
  return fields;
}

async function refresh() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to change demo stories in production.');

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000, autoIndex: false });
  const articles = await Article.find({ slug: /-\d{3}$/ }).lean();
  const fixtureIndexes = new Set(articles.map((article) => Number(article.slug.match(/-(\d{3})$/)?.[1])));
  if (articles.length !== 500 || fixtureIndexes.size !== 500 || !fixtureIndexes.has(1) || !fixtureIndexes.has(500)) {
    throw new Error(`Expected exactly the 500 numbered demo articles, found ${articles.length}.`);
  }

  const articleOps = [];
  const eventOps = [];
  for (const article of articles) {
    const fixtureNumber = Number(article.slug.match(/-(\d{3})$/)[1]);
    const index = fixtureNumber - 1;
    const story = storyFor(index);
    const hasPublicVersion = article.status === 'published' && article.approved === true;
    const hasRevision = ['pending', 'returned'].includes(article.workflowStatus);
    const revision = submittedStory(
      story,
      index,
      hasPublicVersion && hasRevision ? revisionImageFor(index) : story.image
    );
    const update = { category: story.category };
    const unset = {};

    if (hasPublicVersion) {
      Object.assign(update, copyFields(story), {
        workingCopy: hasRevision ? copyFields(revision) : copyFields(story)
      });
      if (hasRevision) update.submittedCopy = copyFields(revision);
      else unset.submittedCopy = 1;
    } else {
      Object.assign(update, {
        title: 'Untitled story', excerpt: '', content: [], image: '', publishedAt: null,
        workingCopy: copyFields(hasRevision ? revision : story)
      });
      if (hasRevision) update.submittedCopy = copyFields(revision);
      else unset.submittedCopy = 1;
    }
    const operation = { $set: update };
    if (Object.keys(unset).length) operation.$unset = unset;
    articleOps.push({ updateOne: { filter: { _id: article._id }, update: operation } });

    const events = await ArticlePublicationEvent.find({ article: article._id }).sort({ eventAt: 1 }).select('_id eventType').lean();
    let updateOrdinal = 0;
    for (const event of events) {
      const articleTitle = event.eventType === 'publication'
        ? story.title
        : `${story.title} — follow-up ${++updateOrdinal}`;
      eventOps.push({ updateOne: { filter: { _id: event._id }, update: { $set: { articleTitle } } } });
    }
  }

  if (articleOps.length) await Article.collection.bulkWrite(articleOps, { ordered: true });
  if (eventOps.length) await ArticlePublicationEvent.collection.bulkWrite(eventOps, { ordered: true });

  const summary = {
    refreshedArticles: articleOps.length,
    publicationEventTitlesRefreshed: eventOps.length,
    published: await Article.countDocuments({ status: 'published', approved: true }),
    pending: await Article.countDocuments({ workflowStatus: 'pending' }),
    drafts: await Article.countDocuments({ workflowStatus: 'draft', status: 'draft' }),
    returned: await Article.countDocuments({ workflowStatus: 'returned' }),
    nonDemoArticles: await Article.countDocuments({ slug: { $not: /-\d{3}$/ } })
  };
  console.log(JSON.stringify(summary, null, 2));
}

refresh()
  .catch((error) => {
    console.error(`Demo story refresh failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });
