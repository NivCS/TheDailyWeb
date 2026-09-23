const mongoose = require('mongoose');

const articleSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, index: true },
  excerpt: { type: String, required: true, trim: true },
  content: { type: [String], required: true },
  category: { type: String, required: true, index: true },
  author: { type: String, required: true },
  image: { type: String, required: true },
  publishedAt: { type: Date, required: true, index: true },
  views: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ['draft', 'pending', 'published'], default: 'draft', index: true },
  approved: { type: Boolean, default: false, index: true }
}, { timestamps: true });

module.exports = mongoose.models.Article || mongoose.model('Article', articleSchema);
