

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');

const repairRoutes = require('./routes/repair.routes');
const nodeRoutes = require('./routes/node.routes');
const gitRoutes = require('./routes/git.routes');
const metricsRoutes = require('./routes/metrics.routes');

const { logger } = require('./utils/logger');
const { startBackgroundWorker } = require('./services/background.worker');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Request logger
app.use((req, res, next) => {
  logger.info(`[HTTP] ${req.method} ${req.url}`);
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/repair',  repairRoutes);
app.use('/api/nodes',   nodeRoutes);
app.use('/api/git',     gitRoutes);
app.use('/api/metrics', metricsRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date() }));

// Serve dashboard SPA for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ── MongoDB ───────────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/anti_entropy';

mongoose.connect(MONGO_URI)
  .then(() => {
    logger.info('[DB] MongoDB connected');
    startBackgroundWorker();
    app.listen(PORT, () => logger.info(`[SERVER] Listening on http://localhost:${PORT}`));
  })
  .catch(err => {
    logger.error('[DB] MongoDB connection failed:', err.message);
    logger.warn('[SERVER] Starting without DB (demo mode)');
    startBackgroundWorker();
    app.listen(PORT, () => logger.info(`[SERVER] Listening on http://localhost:${PORT}`));
  });

module.exports = app;
