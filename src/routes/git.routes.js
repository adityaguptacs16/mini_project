/**
 * git.routes.js
 * Endpoints for policy tracking via Git.
 */

const router = require('express').Router();
const { commitPolicy, getHistory, getDiff, getRepairFrequency } = require('../services/git.service');

router.post('/commit',    async (req, res) => res.json(await commitPolicy(req.body.message || 'Update anti-entropy policy')));
router.get('/history',    async (req, res) => res.json(await getHistory(req.query.limit)));
router.get('/diff',       async (req, res) => res.json(await getDiff(req.query.a, req.query.b)));
router.get('/frequency',  async (req, res) => res.json(await getRepairFrequency()));

module.exports = router;
