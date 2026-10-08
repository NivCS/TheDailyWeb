const mongoose = require('mongoose');
const User = require('../models/User');
const Session = require('../models/Session');
const Article = require('../models/Article');
const ArticlePublicationEvent = require('../models/ArticlePublicationEvent');
const Comment = require('../models/Comment');
const { hashPassword } = require('../services/passwords');

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function listUsers(search = '') {
  const users = await User.find().select('username displayName role createdAt updatedAt').sort({ username: 1 }).lean();
  if (!search) return users;
  const query = search.toLocaleLowerCase();
  return users.filter((user) => [user.username, user.displayName]
    .some((value) => String(value || '').toLocaleLowerCase().includes(query)));
}

async function createUser({ username, displayName, role, password }) {
  const passwordHash = await hashPassword(password);
  const user = await User.create({ username, displayName, role, passwordHash });
  return user;
}

async function updateUser(userId, { role }, actingUserId) {
  if (!mongoose.isValidObjectId(userId)) return { status: 'not_found' };
  const session = await mongoose.startSession();
  let result = { status: 'not_found' };

  try {
    await session.withTransaction(async () => {
      const user = await User.findById(userId).session(session);
      if (!user) return;
      const isSelf = String(user._id) === String(actingUserId);
      if (isSelf && role !== user.role) {
        result = { status: 'self_role_change' };
        return;
      }
      if (user.role === 'editor' && role !== 'editor') {
        const editorCount = await User.countDocuments({ role: 'editor' }).session(session);
        if (editorCount <= 1) {
          result = { status: 'last_editor' };
          return;
        }
      }

      const roleChanged = user.role !== role;
      user.role = role;
      await user.save({ session });
      if (roleChanged) await Session.deleteMany({ user: user._id }, { session });
      result = { status: 'updated', user };
    });
    return result;
  } finally {
    await session.endSession();
  }
}

async function deleteUser(userId, actingUserId) {
  if (!mongoose.isValidObjectId(userId)) return { status: 'not_found' };
  const session = await mongoose.startSession();
  let result = { status: 'not_found' };

  try {
    await session.withTransaction(async () => {
      const user = await User.findById(userId).session(session);
      if (!user) return;
      if (String(user._id) === String(actingUserId)) {
        result = { status: 'self_delete' };
        return;
      }
      if (user.role === 'editor') {
        const editorCount = await User.countDocuments({ role: 'editor' }).session(session);
        if (editorCount <= 1) {
          result = { status: 'last_editor' };
          return;
        }
      }

      await Session.deleteMany({ user: user._id }, { session });
      // Preserve articles and their visible bylines while clearing references to the deleted account.
      await Article.updateMany({ reporter: user._id }, { $unset: { reporter: 1 } }, { session });
      await ArticlePublicationEvent.updateMany({ editor: user._id }, { $unset: { editor: 1 } }, { session });
      await Comment.updateMany({ updatedBy: user._id }, { $unset: { updatedBy: 1 } }, { session });
      await User.deleteOne({ _id: user._id }, { session });
      result = { status: 'deleted', userId: String(user._id), username: user.username };
    });
    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = { createUser, deleteUser, listUsers, updateUser };
