const fs = require('fs');
const path = require('path');

const LOG_DIRECTORY = path.join(__dirname, '..', 'logs');
const ACTIVE_LOG = path.join(LOG_DIRECTORY, 'app.log');
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ROTATED_FILES = 3;

function rotateIfNeeded(incomingBytes) {
  let currentBytes = 0;
  try {
    currentBytes = fs.statSync(ACTIVE_LOG).size;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  if (currentBytes === 0 || currentBytes + incomingBytes <= MAX_FILE_BYTES) return;

  const oldest = `${ACTIVE_LOG}.${ROTATED_FILES}`;
  try { fs.unlinkSync(oldest); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  for (let index = ROTATED_FILES - 1; index >= 1; index -= 1) {
    const source = `${ACTIVE_LOG}.${index}`;
    const destination = `${ACTIVE_LOG}.${index + 1}`;
    try { fs.renameSync(source, destination); } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  try { fs.renameSync(ACTIVE_LOG, `${ACTIVE_LOG}.1`); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function errorFields(error) {
  if (!(error instanceof Error)) return { error: String(error) };
  return {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    }
  };
}

function write(level, event, fields = {}) {
  const record = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...fields
  };
  const line = `${JSON.stringify(record)}\n`;

  process.stdout.write(line);
  try {
    fs.mkdirSync(LOG_DIRECTORY, { recursive: true });
    rotateIfNeeded(Buffer.byteLength(line));
    fs.appendFileSync(ACTIVE_LOG, line, { encoding: 'utf8' });
  } catch (error) {
    process.stderr.write(`Logging to file failed: ${error.message}\n`);
  }
}

module.exports = {
  debug(event, fields) { write('debug', event, fields); },
  info(event, fields) { write('info', event, fields); },
  warn(event, fields) { write('warn', event, fields); },
  error(event, error, fields = {}) { write('error', event, { ...fields, ...errorFields(error) }); }
};
