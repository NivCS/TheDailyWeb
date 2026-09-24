const mongoose = require('mongoose');

const commentRateLimitSchema = new mongoose.Schema({
  deviceHash: { type: String, required: true, unique: true },
  windowStartedAt: { type: Date, required: true },
  count: { type: Number, required: true, min: 1 }
}, { timestamps: true });

commentRateLimitSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.models.CommentRateLimit || mongoose.model('CommentRateLimit', commentRateLimitSchema);
