const mongoose = require('mongoose');

const weatherCacheSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed, default: null },
  fetchedAt: { type: Date, default: new Date(0) },
  refreshLockUntil: { type: Date, default: new Date(0) }
}, { versionKey: false });

module.exports = mongoose.models.WeatherCache || mongoose.model('WeatherCache', weatherCacheSchema);
