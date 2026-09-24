const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  article: { type: mongoose.Schema.Types.ObjectId, ref: 'Article', required: true, index: true },
  author: { type: String, required: true, trim: true, maxlength: 40 },
  body: { type: String, required: true, trim: true, maxlength: 1000 }
}, { timestamps: true });

commentSchema.index({ article: 1, createdAt: 1 });

module.exports = mongoose.models.Comment || mongoose.model('Comment', commentSchema);
