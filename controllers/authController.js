const crypto = require('crypto');
const User = require('../models/User');
const Session = require('../models/Session');
const { verifyPassword } = require('../services/passwords');
const { COOKIE_NAME, tokenDigest, sessionCookie, clearSessionCookie } = require('../middleware/authentication');
const logger = require('../services/logger');

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
      logger.warn('login_failed', { requestId: req.requestId, reason: 'invalid_credentials' });
      return res.redirect('/login?error=invalid');
    }

    const user = await User.findOne({ username }).select('+passwordHash');
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      logger.warn('login_failed', { requestId: req.requestId, reason: 'invalid_credentials' });
      return res.redirect('/login?error=invalid');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    await Session.create({ tokenHash: tokenDigest(token), user: user._id, expiresAt });
    res.set('Set-Cookie', sessionCookie(token, SESSION_DAYS * 24 * 60 * 60));
    logger.info('login_succeeded', { requestId: req.requestId, userId: String(user._id), role: user.role });
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
      const session = await Session.findOneAndDelete({ tokenHash: tokenDigest(token) }).select('user').lean();
      if (session?.user) logger.info('logout_succeeded', { requestId: req.requestId, userId: String(session.user) });
    }
    clearSessionCookie(res);
    res.redirect('/');
  } catch (error) {
    next(error);
  }
}

module.exports = { loginPage, login, logout };
