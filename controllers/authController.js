const crypto = require('crypto');
const User = require('../models/User');
const Session = require('../models/Session');
const { verifyPassword } = require('../services/passwords');
const { COOKIE_NAME, tokenDigest, sessionCookie, clearSessionCookie } = require('../middleware/authentication');

const SESSION_DAYS = 7;

function loginPage(req, res) {
  if (req.user) return res.redirect(req.user.role === 'editor' ? '/editor' : '/reporter');
  res.render('login', {
    pageTitle: 'Sign in | The Daily Web',
    errorMessage: req.query.error === 'invalid' ? 'The username or password is incorrect.' : ''
  });
}

async function login(req, res, next) {
  try {
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!/^[a-z0-9._-]{3,30}$/.test(username) || !password || password.length > 200) {
      return res.redirect('/login?error=invalid');
    }

    const user = await User.findOne({ username }).select('+passwordHash');
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return res.redirect('/login?error=invalid');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    await Session.create({ tokenHash: tokenDigest(token), user: user._id, expiresAt });
    res.set('Set-Cookie', sessionCookie(token, SESSION_DAYS * 24 * 60 * 60));
    res.redirect(user.role === 'editor' ? '/editor' : '/reporter');
  } catch (error) {
    next(error);
  }
}

async function logout(req, res, next) {
  try {
    const token = String(req.headers.cookie || '').split(';').map((part) => part.trim())
      .find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
    if (token && /^[a-f0-9]{64}$/i.test(token)) {
      await Session.deleteOne({ tokenHash: tokenDigest(token) });
    }
    clearSessionCookie(res);
    res.redirect('/');
  } catch (error) {
    next(error);
  }
}

function renderWorkspace(req, res, roleLabel, heading, workspaceMessage) {
  res.render('workspace', { pageTitle: `${heading} | The Daily Web`, heading, roleLabel, username: req.user.username, workspaceMessage, activeNav: heading === 'Impact analytics' ? 'analytics' : 'editor' });
}

function editorHome(req, res) {
  renderWorkspace(req, res, 'Editor', 'Editor workspace', 'Your protected editor area is ready for the article workflow implementation.');
}

function editorArticles(req, res) {
  const heading = req.query.status === 'pending' ? 'Review queue' : 'All articles';
  renderWorkspace(req, res, 'Editor', heading, 'Article review, publishing, and management tools will be implemented in the next project step.');
}

function editorAnalytics(req, res) {
  renderWorkspace(req, res, 'Editor', 'Impact analytics', 'Article view analytics will be implemented in the next project step.');
}

module.exports = { loginPage, login, logout, editorHome, editorArticles, editorAnalytics };
