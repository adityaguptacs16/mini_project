/**
 * repair.routes.js
 * Express endpoints that trigger on-demand and cluster-wide repairs.
 */

const router  = require('express').Router();
const { runRepair, runClusterRepair, scanForMismatches, getTreeSnapshot, REPLICAS } = require('../services/repair.service');
const { triggerManualRun, getWorkerStatus } = require('../services/background.worker');
const { logger } = require('../utils/logger');

// POST /api/repair/trigger  – on-demand repair between two nodes
router.post('/trigger', async (req, res) => {
  const { sourceNode, targetNode } = req.body;

  if (!sourceNode || !targetNode) {
    return res.status(400).json({ error: 'sourceNode and targetNode are required' });
  }
  if (!REPLICAS[sourceNode] || !REPLICAS[targetNode]) {
    return res.status(404).json({ error: 'Unknown node', knownNodes: Object.keys(REPLICAS) });
  }

  try {
    logger.info(`[API] Manual repair triggered: ${sourceNode} → ${targetNode}`);
    const result = await runRepair(sourceNode, targetNode);
    res.json(result);
  } catch (err) {
    logger.error('[API] Repair failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/repair/cluster  – repair all node pairs
router.post('/cluster', async (req, res) => {
  try {
    logger.info('[API] Cluster repair triggered');
    const result = await runClusterRepair();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/repair/manual-window  – fire next background window immediately
router.post('/manual-window', async (req, res) => {
  try {
    await triggerManualRun('api-triggered');
    res.json({ status: 'queued' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/repair/scan  – MongoDB mismatch scan
router.get('/scan', async (req, res) => {
  try {
    const report = await scanForMismatches();
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/repair/tree/:nodeId  – serialised Merkle tree for a node
router.get('/tree/:nodeId', async (req, res) => {
  try {
    const uri = process.env.MONGO_URI;
    const conn = await require('mongoose').createConnection(uri).asPromise();
    const records = await conn.db.collection('replicarecords').find({ nodeId: req.params.nodeId }).toArray();
    await conn.close();

    const { MerkleTree, sha256 } = require('../utils/merkle.tree');
    const leaves = records.map(r => ({
      id: r.key,
      hash: sha256(`${r.key}:${r.value}`),
    }));

    const tree = new MerkleTree(leaves);
    res.json({
      nodeId: req.params.nodeId,
      rootHash: tree.getRootHash(),
      nodeCount: leaves.length,
      levels: tree.serialize().levels,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/repair/worker  – background worker status
router.get('/worker', (req, res) => {
  res.json(getWorkerStatus());
});

module.exports = router;
