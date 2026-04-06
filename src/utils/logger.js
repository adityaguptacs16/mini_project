/**
 * logger.js
 * Structured logger with timestamp and level prefix.
 */

const fs   = require('fs');
const path = require('path');

const LOG_DIR  = path.join(__dirname, '../../logs');
const LOG_FILE = path.join(LOG_DIR, 'anti-entropy.log');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const MIN_LEVEL = LEVELS[process.env.LOG_LEVEL?.toUpperCase()] ?? LEVELS.INFO;

// In-memory ring buffer (last 500 entries) for the dashboard
const ringBuffer = [];
const RING_SIZE  = 500;

function write(level, ...args) {
  if (LEVELS[level] < MIN_LEVEL) return;

  const ts      = new Date().toISOString();
  const message = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  const line    = `[${ts}] [${level.padEnd(5)}] ${message}`;

  // Console output with colours
  const colours = { DEBUG: '\x1b[36m', INFO: '\x1b[32m', WARN: '\x1b[33m', ERROR: '\x1b[31m' };
  console.log(`${colours[level] ?? ''}${line}\x1b[0m`);

  // File output
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch (_) {}

  // Ring buffer for dashboard
  ringBuffer.push({ ts, level, message });
  if (ringBuffer.length > RING_SIZE) ringBuffer.shift();
}

const logger = {
  debug : (...a) => write('DEBUG', ...a),
  info  : (...a) => write('INFO',  ...a),
  warn  : (...a) => write('WARN',  ...a),
  error : (...a) => write('ERROR', ...a),
  getLogs: (n = 100) => ringBuffer.slice(-n),
};

module.exports = { logger };
