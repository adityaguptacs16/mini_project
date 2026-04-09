/**
 * schedule.config.js
 * Anti-entropy repair schedule.
 * Edit this file to change repair windows; changes are tracked by Git.
 */

module.exports = {
  // Repair jobs – each runs in a background Unix process
  jobs: [
    {
      label:      'frequent-light-repair',
      intervalMs: 30_000,          // every 30 s  (demo)
      description: 'Light, frequent repair pass – checks hottest data',
    },
    {
      label:      'full-cluster-repair',
      intervalMs: 120_000,         // every 2 min (demo; production: hours)
      description: 'Full cluster-wide repair sweep',
    },
  ],

  // Maximum concurrent repairs
  maxConcurrent: 2,

  // Jitter window (ms) to avoid thundering herd across nodes
  jitterMs: 5_000,
};
