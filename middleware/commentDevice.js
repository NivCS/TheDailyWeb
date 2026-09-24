const crypto = require('crypto');

const COOKIE_NAME = 'dailyweb_device';
const DEVICE_ID_PATTERN = /^[a-f0-9-]{36}$/i;

function getCookie(req, name) {
  const prefix = `${name}=`;
  const item = String(req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return item ? item.slice(prefix.length) : '';
}

function ensureCommentDevice(req, res, next) {
  let deviceId = getCookie(req, COOKIE_NAME);
  if (!DEVICE_ID_PATTERN.test(deviceId)) {
    deviceId = crypto.randomUUID();
    const attributes = ['Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=31536000'];
    if (process.env.NODE_ENV === 'production') attributes.push('Secure');
    res.append('Set-Cookie', `${COOKIE_NAME}=${deviceId}; ${attributes.join('; ')}`);
  }
  req.commentDeviceHash = crypto.createHash('sha256').update(deviceId).digest('hex');
  next();
}

module.exports = { ensureCommentDevice };
