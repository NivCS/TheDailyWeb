require('dotenv').config();

const mongoose = require('mongoose');
const Article = require('../models/Article');

async function removeReadingTime() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  const result = await Article.collection.updateMany(
    { readingTimeMinutes: { $exists: true } },
    { $unset: { readingTimeMinutes: '' } }
  );
  console.log(JSON.stringify({ matchedArticles: result.matchedCount, updatedArticles: result.modifiedCount }, null, 2));
}

removeReadingTime()
  .catch((error) => {
    console.error(`Reading-time removal failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });
