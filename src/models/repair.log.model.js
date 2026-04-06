/**
 * repair.log.model.js
 * Stores history of every repair run for auditing and metrics.
 */

const mongoose = require('mongoose');

const RepairLogSchema = new mongoose.Schema(
  {
    sourceNode:  { type: String, required: true },
    targetNode:  { type: String, required: true },
    repaired:    { type: Number, default: 0 },
    durationMs:  { type: Number },
    triggeredBy: { type: String, default: 'background' },   // 'background' | 'api' | 'shell'
    diff: {
      differing:     [{ local: String, remote: String }],
      missingLocal:  [String],
      missingRemote: [String],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('RepairLog', RepairLogSchema);
