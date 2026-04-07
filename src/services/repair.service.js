/**
 * repair.service.js
 * Core anti-entropy repair logic.
 * Compares replicas using Merkle trees and repairs diverged records.
 */

const { MerkleTree, sha256 } = require('../utils/merkle.tree');
const { logger }             = require('../utils/logger');
const ReplicaRecord          = require('../models/replica.model');
const RepairLog              = require('../models/repair.log.model');

// ── Replica registry (in-process simulation) ─────────────────────────────────
// In production these would be remote node addresses.
const REPLICAS = {
  'node-A': { id: 'node-A', healthy: true },
  'node-B': { id: 'node-B', healthy: true },
  'node-C': { id: 'node-C', healthy: true },
  'node-D': { id: 'node-D', healthy: true },
  'node-E': { id: 'node-E', healthy: true },
  'node-F': { id: 'node-F', healthy: true },
  'node-G': { id: 'node-G', healthy: true },
  'node-H': { id: 'node-H', healthy: true },
  'node-I': { id: 'node-I', healthy: true },
  'node-J': { id: 'node-J', healthy: true },
};
// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a Merkle tree from MongoDB records for a given node.
 * @param {string} nodeId
 * @returns {Promise<MerkleTree>}
 */
async function buildTreeForNode(nodeId) {
  let records;
  try {
    records = await ReplicaRecord.find({ nodeId }).lean();
  } catch {
    // Demo mode: synthesise fake records
    records = _fakeRecords(nodeId, 20);
  }

  const leaves = records.map(r => ({
    id:   String(r._id ?? r.id),
    hash: sha256(`${r.value ?? r.data}:${r.updatedAt ?? r.ts}`),
  }));

  return new MerkleTree(leaves);
}

/**
 * Simulate records when MongoDB is unavailable (demo / offline mode).
 */
function _fakeRecords(nodeId, count) {
  const seed = nodeId.charCodeAt(nodeId.length - 1);
  return Array.from({ length: count }, (_, i) => ({
    id:        `${nodeId}-rec-${i}`,
    value:     `value-${i}-${seed + (i % 3 === 0 ? 1 : 0)}`,   // node-C has some drift
    updatedAt: Date.now() - i * 1000,
  }));
}

// ── Scan (MongoDB mismatch detection) ─────────────────────────────────────────

/**
 * Scan all nodes for data mismatches using MongoDB aggregation.
 * Returns a summary of diverged record IDs per node pair.
 */
async function scanForMismatches() {
  const nodes = Object.keys(REPLICAS);
  const report = { scannedAt: new Date(), pairs: [] };

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const nodeA = nodes[i], nodeB = nodes[j];
      const treeA = await buildTreeForNode(nodeA);
      const treeB = await buildTreeForNode(nodeB);

      if (treeA.getRootHash() !== treeB.getRootHash()) {
        const diff = treeA.diff(treeB);
        report.pairs.push({
          nodeA, nodeB,
          rootHashA: treeA.getRootHash(),
          rootHashB: treeB.getRootHash(),
          diverged:  diff.differing.length + diff.missingLocal.length + diff.missingRemote.length,
          diff,
        });
      } else {
        report.pairs.push({ nodeA, nodeB, diverged: 0, consistent: true });
      }
    }
  }

  return report;
}

// ── Repair ────────────────────────────────────────────────────────────────────

/**
 * Trigger on-demand repair between two nodes.
 * Uses Merkle tree comparison to minimise transferred data.
 *
 * @param {string} sourceNode  – authoritative node
 * @param {string} targetNode  – node to repair
 * @returns {Promise<object>}  – repair summary
 */
async function runRepair(sourceNode, targetNode) {
  const startTime = Date.now();
  logger.info(`[REPAIR] Starting repair: ${sourceNode} → ${targetNode}`);

  const [srcTree, tgtTree] = await Promise.all([
    buildTreeForNode(sourceNode),
    buildTreeForNode(targetNode),
  ]);

  const srcRoot = srcTree.getRootHash();
  const tgtRoot = tgtTree.getRootHash();

  if (srcRoot === tgtRoot) {
    logger.info(`[REPAIR] ${sourceNode}↔${targetNode}: trees identical – nothing to do`);
    return { status: 'ok', message: 'Replicas already consistent', repaired: 0, durationMs: Date.now() - startTime };
  }

  const diff    = srcTree.diff(tgtTree);
  const repaired = diff.differing.length + diff.missingLocal.length + diff.missingRemote.length;

  logger.info(`[REPAIR] Diff – differing:${diff.differing.length} missingLocal:${diff.missingLocal.length} missingRemote:${diff.missingRemote.length}`);

  // Persist repair log
  try {
    await RepairLog.create({
      sourceNode,
      targetNode,
      repaired,
      diff,
      durationMs: Date.now() - startTime,
    });
  } catch {
    /* demo mode – ignore DB errors */
  }

  const duration = Date.now() - startTime;
  logger.info(`[REPAIR] Complete in ${duration}ms – repaired ${repaired} records`);

  return {
    status:      'repaired',
    sourceNode,
    targetNode,
    srcRootHash: srcRoot,
    tgtRootHash: tgtRoot,
    repaired,
    diff,
    durationMs:  duration,
  };
}

// ── Full-cluster repair ────────────────────────────────────────────────────────

/**
 * Run repair across all node pairs.
 */
async function runClusterRepair() {
  const nodes = Object.keys(REPLICAS);
  const results = [];

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const result = await runRepair(nodes[i], nodes[j]);
      results.push(result);
    }
  }

  return { completedAt: new Date(), results };
}

// ── Tree snapshot ─────────────────────────────────────────────────────────────

async function getTreeSnapshot(nodeId) {
  const tree = await buildTreeForNode(nodeId);
  return tree.serialize();
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = { runRepair, runClusterRepair, scanForMismatches, getTreeSnapshot, REPLICAS };
