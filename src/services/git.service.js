/**
 * git.service.js
 * Tracks anti-entropy policy evolution using Git.
 * Commits policy changes, lists history, and shows diffs.
 */

const { exec } = require('child_process');
const util     = require('util');
const path     = require('path');
const fs       = require('fs');
const { logger } = require('../utils/logger');

const execAsync  = util.promisify(exec);
const POLICY_DIR = path.join(__dirname, '../../config');
const POLICY_FILE = path.join(POLICY_DIR, 'schedule.config.js');

// ── Ensure git repo ───────────────────────────────────────────────────────────

async function ensureRepo() {
  const gitDir = path.join(POLICY_DIR, '../.git');
  if (!fs.existsSync(gitDir)) {
    const root = path.join(POLICY_DIR, '..');
    await execAsync(`git init && git config user.email "anti-entropy@system" && git config user.name "AntiEntropy Bot"`, { cwd: root });
    logger.info('[GIT] Initialised repository');
  }
}

// ── Commit policy ─────────────────────────────────────────────────────────────

/**
 * Commit the current schedule.config.js as a policy change.
 * @param {string} message  – commit message
 */
async function commitPolicy(message) {
  const root = path.join(POLICY_DIR, '..');
  await ensureRepo();

  try {
    const { stdout } = await execAsync(
      `git add config/schedule.config.js && git commit -m "${message.replace(/"/g, "'")}"`,
      { cwd: root }
    );
    logger.info('[GIT] Policy committed:', stdout.split('\n')[0]);
    return { success: true, output: stdout };
  } catch (err) {
    const msg = err.stderr || err.message;
    if (msg.includes('nothing to commit')) {
      return { success: true, output: 'Nothing to commit – policy unchanged' };
    }
    logger.error('[GIT] Commit failed:', msg);
    return { success: false, error: msg };
  }
}

// ── History ───────────────────────────────────────────────────────────────────

async function getHistory(limit = 20) {
  const root = path.join(POLICY_DIR, '..');
  await ensureRepo();

  try {
    const { stdout } = await execAsync(
      `git log --oneline -${limit} -- config/schedule.config.js`,
      { cwd: root }
    );

    const commits = stdout.trim().split('\n').filter(Boolean).map(line => {
      const [hash, ...rest] = line.split(' ');
      return { hash, message: rest.join(' ') };
    });

    return { commits };
  } catch {
    return { commits: [], note: 'No commits yet or git unavailable' };
  }
}

// ── Diff ──────────────────────────────────────────────────────────────────────

async function getDiff(commitA = 'HEAD~1', commitB = 'HEAD') {
  const root = path.join(POLICY_DIR, '..');
  try {
    const { stdout } = await execAsync(
      `git diff ${commitA} ${commitB} -- config/schedule.config.js`,
      { cwd: root }
    );
    return { diff: stdout || 'No difference' };
  } catch {
    return { diff: 'Git diff unavailable' };
  }
}

// ── Repair frequency stats ────────────────────────────────────────────────────

async function getRepairFrequency() {
  const root = path.join(POLICY_DIR, '..');
  try {
    const { stdout } = await execAsync(
      `git log --format="%ad" --date=short -- config/schedule.config.js | sort | uniq -c`,
      { cwd: root }
    );

    const byDay = stdout.trim().split('\n').filter(Boolean).map(line => {
      const [count, date] = line.trim().split(/\s+/);
      return { date, changes: parseInt(count) };
    });

    return { byDay };
  } catch {
    return { byDay: [] };
  }
}

module.exports = { commitPolicy, getHistory, getDiff, getRepairFrequency };
