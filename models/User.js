const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true, minlength: 3, maxlength: 30 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, required: true, enum: ['reporter', 'editor'], index: true }
}, { timestamps: true });

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
