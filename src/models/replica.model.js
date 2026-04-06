/**
 * replica.model.js
 * Mongoose schema for replica data records.
 * Each document represents a single data item on a node.
 */

const mongoose = require('mongoose');

const ReplicaRecordSchema = new mongoose.Schema(
  {
    nodeId:    { type: String, required: true, index: true },
    key:       { type: String, required: true },
    value:     { type: mongoose.Schema.Types.Mixed, required: true },
    checksum:  { type: String },                    // pre-computed hash
    syncedAt:  { type: Date,   default: null },
    version:   { type: Number, default: 1 },
  },
  { timestamps: true }
);

// Compound index for efficient cross-node scans
ReplicaRecordSchema.index({ nodeId: 1, key: 1 }, { unique: true });

// Pre-save: compute checksum
ReplicaRecordSchema.pre('save', function (next) {
  const crypto = require('crypto');
  this.checksum = crypto
    .createHash('sha256')
    .update(JSON.stringify({ key: this.key, value: this.value, version: this.version }))
    .digest('hex');
  next();
});

module.exports = mongoose.model('ReplicaRecord', ReplicaRecordSchema);
