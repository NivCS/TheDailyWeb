const crypto = require('crypto');
const Session = require('../models/Session');

const COOKIE_NAME = 'dailyweb_session';

function tokenDigest(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getCookie(req, name) {
  const prefix = `${name}=`;
  const item = String(req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return item ? item.slice(prefix.length) : '';
}

function sessionCookie(token, maxAge) {
  const attributes = ['Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAge}`];
  if (process.env.NODE_ENV === 'production') attributes.push('Secure');
  return `${COOKIE_NAME}=${token}; ${attributes.join('; ')}`;
}

function clearSessionCookie(res) {
  res.set('Set-Cookie', sessionCookie('', 0));
}

async function loadUser(req, res, next) {
  try {
    const token = getCookie(req, COOKIE_NAME);
    req.user = null;
    if (!/^[a-f0-9]{64}$/i.test(token)) return next();

    const session = await Session.findOne({ tokenHash: tokenDigest(token), expiresAt: { $gt: new Date() } })
      .populate('user', 'username role')
      .lean();
    if (session?.user) {
      req.user = { id: String(session.user._id), username: session.user.username, role: session.user.role };
    } else if (token) {
      clearSessionCookie(res);
    }
    next();
  } catch (error) {
    next(error);
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.redirect('/login');
    if (req.user.role !== role) return res.status(403).render('access-denied', { pageTitle: 'Access denied' });
    next();
  };
}

module.exports = { COOKIE_NAME, tokenDigest, sessionCookie, clearSessionCookie, loadUser, requireRole };
