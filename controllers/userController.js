const logger = require('../services/logger');
const { createUser, deleteUser, listUsers, updateUser } = require('../data/userStore');

const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/;
const ROLES = ['reporter', 'editor'];

function noticeText(code) {
  return ({
    created: 'User account created.',
    updated: 'User account updated.',
    deleted: 'User account deleted.',
    username_taken: 'That username is already in use.',
    invalid_user: 'Enter a valid username, role, and password of at least 10 characters.',
    invalid_update: 'Choose a valid role.',
    self_role_change: 'You cannot change your own role.',
    self_delete: 'You cannot delete your own account.',
    last_editor: 'The last editor account cannot be removed or changed to Reporter.',
    not_found: 'That user account could not be found.'
  })[code] || '';
}

async function renderUsers(req, res, next, { notice = '' } = {}) {
  try {
    const search = String(req.query.search || '').trim().slice(0, 120);
    const users = await listUsers(search);
    res.render('editor-users', {
      pageTitle: 'Manage users | The Daily Web',
      currentUser: req.user,
      activeNav: 'users',
      search,
      users,
      notice: notice || noticeText(String(req.query.notice || '')),
      isError: Boolean(req.query.error)
    });
  } catch (error) { next(error); }
}

function editorUsersPage(req, res, next) {
  return renderUsers(req, res, next);
}

async function create(req, res, next) {
  const username = String(req.body.username || '').trim().toLowerCase();
  const displayName = String(req.body.displayName || '').trim();
  const role = String(req.body.role || 'reporter');
  const password = String(req.body.password || '');
  if (!USERNAME_PATTERN.test(username) || !ROLES.includes(role)
    || password.length < 10 || password.length > 200 || displayName.length > 80) {
    return res.redirect('/editor/users?error=1&notice=invalid_user');
  }

  try {
    const user = await createUser({ username, displayName, role, password });
    logger.info('user_created', { requestId: req.requestId, actorId: req.user.id, actorRole: req.user.role, targetUserId: String(user._id), role });
    res.redirect('/editor/users?notice=created');
  } catch (error) {
    if (error.code === 11000) return res.redirect('/editor/users?error=1&notice=username_taken');
    next(error);
  }
}

async function update(req, res, next) {
  const role = String(req.body.role || '');
  if (!ROLES.includes(role)) {
    return res.redirect('/editor/users?error=1&notice=invalid_update');
  }

  try {
    const result = await updateUser(req.params.id, { role }, req.user.id);
    if (result.status !== 'updated') {
      return res.redirect(`/editor/users?error=1&notice=${encodeURIComponent(result.status)}`);
    }
    logger.info('user_updated', { requestId: req.requestId, actorId: req.user.id, actorRole: req.user.role, targetUserId: String(result.user._id), role });
    res.redirect('/editor/users?notice=updated');
  } catch (error) { next(error); }
}

async function remove(req, res, next) {
  try {
    const result = await deleteUser(req.params.id, req.user.id);
    if (result.status !== 'deleted') {
      return res.redirect(`/editor/users?error=1&notice=${encodeURIComponent(result.status)}`);
    }
    logger.info('user_deleted', { requestId: req.requestId, actorId: req.user.id, actorRole: req.user.role, targetUserId: result.userId });
    res.redirect('/editor/users?notice=deleted');
  } catch (error) { next(error); }
}

module.exports = { create, delete: remove, editorUsersPage, update };
