const mongoose = require('mongoose');

const articlePublicationEventSchema = new mongoose.Schema({
  article: { type: mongoose.Schema.Types.ObjectId, ref: 'Article', required: true },
  eventAt: { type: Date, required: true },
  eventType: { type: String, required: true, enum: ['publication', 'update'] },
  editor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  articleTitle: { type: String, required: true },
  eventKey: { type: String, required: true, unique: true }
}, { timestamps: true });

articlePublicationEventSchema.index({ article: 1, eventAt: 1 });

module.exports = mongoose.models.ArticlePublicationEvent || mongoose.model('ArticlePublicationEvent', articlePublicationEventSchema);
