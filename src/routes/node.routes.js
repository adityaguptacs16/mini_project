const router = require('express').Router();
const { REPLICAS } = require('../services/repair.service');
const mongoose = require('mongoose');
const crypto = require('crypto');

router.get('/', async (req, res) => {
  try {
    // Direct connection to correct database
    const uri = process.env.MONGO_URI || 'mongodb+srv://adityahupta1605_db_user:aditya16@miniproject.0vawmke.mongodb.net/anti_entropy';
    
    // Use separate connection to make sure correct DB
    const conn = await mongoose.createConnection(uri).asPromise();
    const collection = conn.db.collection('replicarecords');

    const nodes = await Promise.all(
      Object.values(REPLICAS).map(async (node) => {
        const records = await collection.find({ nodeId: node.id }).toArray();
        const count = records.length;

        const nodeARecords = await collection.find({ nodeId: 'node-A' }).toArray();

        const nodeHash = crypto.createHash('sha256')
          .update(records.map(r => `${r.key}:${r.value}`).sort().join('|'))
          .digest('hex');

        const nodeAHash = crypto.createHash('sha256')
          .update(nodeARecords.map(r => `${r.key}:${r.value}`).sort().join('|'))
          .digest('hex');

        const healthy = node.id === 'node-A' ? true : nodeHash === nodeAHash;

        return {
          id: node.id,
          healthy,
          records: count,
          rootHash: nodeHash,
        };
      })
    );

    await conn.close();
    res.json({ nodes });

  } catch (err) {
    console.error('[NODE ROUTE ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const node = REPLICAS[req.params.id];
    if (!node) return res.status(404).json({ error: 'Node not found' });
    
    const uri = process.env.MONGO_URI;
    const conn = await mongoose.createConnection(uri).asPromise();
    const count = await conn.db.collection('replicarecords').countDocuments({ nodeId: req.params.id });
    await conn.close();
    
    res.json({ ...node, records: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;