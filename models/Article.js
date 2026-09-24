const mongoose = require('mongoose');

const workingCopySchema = new mongoose.Schema({
  title: { type: String, default: '' },
  excerpt: { type: String, default: '' },
  content: { type: [String], default: [] },
  category: { type: String, default: 'World' },
  image: { type: String, default: '' }
}, { _id: false });

const articleSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, index: true },
  excerpt: { type: String, default: '', trim: true },
  content: { type: [String], required: true },
  category: { type: String, required: true, index: true },
  author: { type: String, required: true },
  image: { type: String, default: '' },
  publishedAt: { type: Date, required: true, index: true },
  views: { type: Number, default: 0, min: 0 },
  // `status` and `approved` describe the public version; workflowStatus tracks the reporter's current working copy.
  status: { type: String, enum: ['draft', 'pending', 'published'], default: 'draft', index: true },
  approved: { type: Boolean, default: false, index: true },
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  workflowStatus: { type: String, enum: ['draft', 'pending', 'returned', 'published'], default: 'draft', index: true },
  workingCopy: { type: workingCopySchema, default: () => ({}) },
  reviewNote: { type: String, default: '' },
  submittedAt: { type: Date }
}, { timestamps: true });

articleSchema.index({ reporter: 1, workflowStatus: 1, updatedAt: -1 });

module.exports = mongoose.models.Article || mongoose.model('Article', articleSchema);
