/**
 * metrics.routes.js
 * Exposes aggregated repair metrics for the dashboard.
 */

const router = require('express').Router();
const { logger } = require('../utils/logger');

// GET /api/metrics/logs  – recent log entries
router.get('/logs', (req, res) => {
  const n = parseInt(req.query.n) || 100;
  res.json(logger.getLogs(n));
});

module.exports = router;
