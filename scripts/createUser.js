require('dotenv').config();

const mongoose = require('mongoose');
const readline = require('readline');
const User = require('../models/User');
const { hashPassword } = require('../services/passwords');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (question) => new Promise((resolve) => rl.question(question, resolve));

function askSecret(question) {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    const output = process.stdout;
    if (!input.isTTY || typeof input.setRawMode !== 'function') {
      return reject(new Error('Run this command in an interactive terminal so the password can be entered privately.'));
    }
    output.write(question);
    input.setRawMode(true);
    input.resume();
    let value = '';
    const onData = (chunk) => {
      for (const character of chunk.toString('utf8')) {
        if (character === '\u0003') {
          cleanup();
          output.write('\n');
          reject(new Error('Account creation cancelled.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          cleanup();
          output.write('\n');
          resolve(value);
          return;
        }
        if (character === '\u0008' || character === '\u007f') {
          value = value.slice(0, -1);
          output.write('\b \b');
        } else if (character >= ' ') {
          value += character;
          output.write('*');
        }
      }
    };
    const cleanup = () => {
      input.off('data', onData);
      input.setRawMode(false);
      input.pause();
    };
    input.on('data', onData);
  });
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required. Add it to your local .env file.');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });

  const username = (await ask('Username (3-30 letters, numbers, dots, underscores, or hyphens): ')).trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw new Error('Username format is invalid.');
  const role = (await ask('Role (reporter/editor): ')).trim().toLowerCase();
  if (!['reporter', 'editor'].includes(role)) throw new Error('Role must be reporter or editor.');
  rl.close();
  const password = await askSecret('Password (at least 10 characters): ');
  if (password.length < 10 || password.length > 200) throw new Error('Password must contain 10 to 200 characters.');
  const confirmation = await askSecret('Confirm password: ');
  if (password !== confirmation) throw new Error('Passwords do not match.');

  await User.create({ username, role, passwordHash: await hashPassword(password) });
  console.log(`Created ${role} account "${username}".`);
}

main()
  .catch((error) => {
    console.error(`Could not create account: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await mongoose.disconnect().catch(() => {});
  });
