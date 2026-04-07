/**
 * background.worker.js
 * Unix-style background process that runs scheduled anti-entropy repair windows.
 * Reads schedule from config and fires repair jobs at configured intervals.
 */

const { runClusterRepair } = require('./repair.service');
const { logger }           = require('../utils/logger');
const schedule             = require('../../config/schedule.config');

let timers   = [];
let running  = false;
let runCount = 0;

const history = [];          // last 50 runs

// ── Worker ────────────────────────────────────────────────────────────────────

async function _executeRepairWindow(label) {
  if (running) {
    logger.warn(`[BG] Skipping window "${label}" – previous run still active`);
    return;
  }

  running = true;
  runCount++;
  const start = Date.now();
  logger.info(`[BG] Repair window "${label}" starting (run #${runCount})`);

  try {
    const result = await runClusterRepair();
    const duration = Date.now() - start;

    const entry = {
      runId:     runCount,
      label,
      startedAt: new Date(start),
      durationMs: duration,
      status:    'success',
      result,
    };

    history.push(entry);
    if (history.length > 50) history.shift();

    logger.info(`[BG] Window "${label}" complete in ${duration}ms`);
  } catch (err) {
    logger.error(`[BG] Window "${label}" failed:`, err.message);
    history.push({ runId: runCount, label, status: 'error', error: err.message, startedAt: new Date(start) });
  } finally {
    running = false;
  }
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

function startBackgroundWorker() {
  logger.info('[BG] Starting background anti-entropy worker');

  for (const job of schedule.jobs) {
    const ms     = job.intervalMs;
    const label  = job.label;

    logger.info(`[BG] Scheduling "${label}" every ${ms / 1000}s`);

    // Initial delay jitter to avoid thundering herd
    const jitter = Math.floor(Math.random() * 3000);
    const t = setInterval(() => _executeRepairWindow(label), ms);
    setTimeout(() => _executeRepairWindow(label), jitter);   // fire once on start

    timers.push(t);
  }
}

function stopBackgroundWorker() {
  logger.info('[BG] Stopping background worker');
  timers.forEach(clearInterval);
  timers = [];
}

function triggerManualRun(label = 'manual') {
  return _executeRepairWindow(label);
}

function getWorkerStatus() {
  return {
    running,
    runCount,
    scheduledJobs: schedule.jobs.length,
    history: history.slice(-10),
  };
}

module.exports = { startBackgroundWorker, stopBackgroundWorker, triggerManualRun, getWorkerStatus };
