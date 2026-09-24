const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, KEY_LENGTH);
  return `${salt}:${key.toString('hex')}`;
}

async function verifyPassword(password, storedHash) {
  if (typeof storedHash !== 'string') return false;
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !/^[a-f0-9]{128}$/i.test(keyHex || '')) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const actual = await scrypt(password, salt, KEY_LENGTH);
  return crypto.timingSafeEqual(expected, actual);
}

module.exports = { hashPassword, verifyPassword };
