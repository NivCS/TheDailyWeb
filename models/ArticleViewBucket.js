const mongoose = require('mongoose');

const articleViewBucketSchema = new mongoose.Schema({
  article: { type: mongoose.Schema.Types.ObjectId, ref: 'Article', required: true },
  hourStart: { type: Date, required: true },
  shard: { type: Number, required: true, min: 0, max: 7 },
  views: { type: Number, required: true, min: 0, default: 0 }
}, { versionKey: false, timestamps: false });

articleViewBucketSchema.index({ article: 1, hourStart: 1, shard: 1 }, { unique: true });
articleViewBucketSchema.index({ article: 1, hourStart: 1 });

module.exports = mongoose.models.ArticleViewBucket || mongoose.model('ArticleViewBucket', articleViewBucketSchema);
