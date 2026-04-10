# Anti-Entropy Control Plane

Distributed anti-entropy repair system using Merkle trees, Express, MongoDB, Git, and Unix background processes.

## Project Structure

```
anti-entropy/
├── src/
│   ├── server.js                   ← Express API server (entry point)
│   ├── routes/
│   │   ├── repair.routes.js        ← POST /api/repair/trigger, /cluster, /scan
│   │   ├── node.routes.js          ← GET  /api/nodes
│   │   ├── git.routes.js           ← POST /api/git/commit, GET /history, /diff
│   │   └── metrics.routes.js       ← GET  /api/metrics/logs
│   ├── services/
│   │   ├── repair.service.js       ← Merkle tree comparison + repair logic
│   │   ├── background.worker.js    ← Unix background process (setInterval daemon)
│   │   └── git.service.js          ← Git policy tracking (commit, history, diff)
│   ├── models/
│   │   ├── replica.model.js        ← MongoDB: replica data records
│   │   └── repair.log.model.js     ← MongoDB: repair audit log
│   └── utils/
│       ├── merkle.tree.js          ← Merkle tree with bandwidth-efficient diff
│       └── logger.js               ← Structured logger with in-memory ring buffer
├── scripts/
│   └── anti_entropy_cron.sh        ← Shell scheduler / Unix daemon
├── config/
│   └── schedule.config.js          ← Repair schedule (Git-tracked)
├── public/
│   └── index.html                  ← Dashboard SPA
├── logs/                           ← Runtime log files
└── package.json
```

## Quick Start

```bash
npm install
npm start          # starts server on :3000
# open http://localhost:3000
```

## Shell Scheduler

```bash
# Run as daemon (loops forever)
bash scripts/anti_entropy_cron.sh

# Run once
bash scripts/anti_entropy_cron.sh --once

# Custom interval
bash scripts/anti_entropy_cron.sh --interval 120
```

## API Endpoints

| Method | Path                        | Description                          |
|--------|-----------------------------|--------------------------------------|
| POST   | /api/repair/trigger         | On-demand repair between two nodes   |
| POST   | /api/repair/cluster         | Repair all node pairs                |
| GET    | /api/repair/scan            | MongoDB mismatch scan                |
| GET    | /api/repair/tree/:nodeId    | Serialised Merkle tree for a node    |
| GET    | /api/repair/worker          | Background worker status             |
| POST   | /api/git/commit             | Commit current policy to Git         |
| GET    | /api/git/history            | Policy commit history                |
| GET    | /api/git/diff               | Latest policy diff                   |
| GET    | /api/metrics/logs           | Recent structured log entries        |

## How It Works

1. **Express** exposes REST endpoints to trigger repairs on-demand or get tree snapshots.
2. **Node.js** builds Merkle trees from MongoDB records and compares them — only differing subtrees are transmitted, reducing bandwidth.
3. **MongoDB** stores replica records and repair audit logs; the scan endpoint aggregates cross-node divergence.
4. **Shell script** (`anti_entropy_cron.sh`) acts as a cron-style daemon, calling the Express API at configured intervals.
5. **Git** tracks every change to `schedule.config.js` so the full policy evolution is versioned.
6. **Unix background process** (`background.worker.js`) runs inside Node.js using `setInterval`, mimicking a Unix daemon with PID-guard logic in the shell script.


## Project By: Aditya Gupta

### What This Project Does
- Detects data inconsistencies across MongoDB replica nodes
- Uses Merkle Trees for bandwidth-efficient comparison
- Auto-repairs drifted nodes every 30 seconds
- Tracks all policy changes via Git
- Beautiful real-time dashboard

### Tech Stack
- Node.js + Express
- MongoDB Atlas
- Merkle Tree Algorithm
- Shell Scripts
- Git Version Control