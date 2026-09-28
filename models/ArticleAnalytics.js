const mongoose = require('mongoose');

const articleAnalyticsSchema = new mongoose.Schema({
  article: { type: mongoose.Schema.Types.ObjectId, ref: 'Article', required: true, unique: true },
  viewsAtTrackingStart: { type: Number, required: true, min: 0, default: 0 },
  trackingStartedAt: { type: Date, required: true, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.models.ArticleAnalytics || mongoose.model('ArticleAnalytics', articleAnalyticsSchema);
