/**
 * merkle.tree.js
 * Efficient Merkle tree for replica comparison.
 * Reduces sync bandwidth by only transmitting differing subtrees.
 */

const crypto = require('crypto');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * SHA-256 hash of an arbitrary value.
 * @param {*} data
 * @returns {string} hex digest
 */
function sha256(data) {
  return crypto
    .createHash('sha256')
    .update(typeof data === 'string' ? data : JSON.stringify(data))
    .digest('hex');
}

// ── MerkleNode ────────────────────────────────────────────────────────────────

class MerkleNode {
  constructor(hash, left = null, right = null, data = null) {
    this.hash  = hash;
    this.left  = left;
    this.right = right;
    this.data  = data;   // leaf: original record id
  }

  isLeaf() { return this.left === null && this.right === null; }
}

// ── MerkleTree ────────────────────────────────────────────────────────────────

class MerkleTree {
  /**
   * @param {Array<{id: string, hash: string}>} records  – sorted by id
   */
  constructor(records = []) {
    this.records = [...records].sort((a, b) => a.id.localeCompare(b.id));
    this.root    = this._build(this.records);
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  _build(records) {
    if (records.length === 0) return new MerkleNode(sha256('empty'));

    // Leaf nodes
    let nodes = records.map(r => new MerkleNode(sha256(r.hash), null, null, r.id));

    // Bottom-up pairing
    while (nodes.length > 1) {
      const next = [];
      for (let i = 0; i < nodes.length; i += 2) {
        const left  = nodes[i];
        const right = nodes[i + 1] || left;          // duplicate last if odd
        const combined = new MerkleNode(
          sha256(left.hash + right.hash),
          left,
          right
        );
        next.push(combined);
      }
      nodes = next;
    }

    return nodes[0];
  }

  // ── Root hash ──────────────────────────────────────────────────────────────

  getRootHash() {
    return this.root ? this.root.hash : null;
  }

  // ── Proof ─────────────────────────────────────────────────────────────────

  /**
   * Generate inclusion proof for a record id.
   * @param {string} id
   * @returns {Array<{hash: string, direction: 'left'|'right'}>|null}
   */
  getProof(id) {
    const proof = [];
    const found = this._findProof(this.root, id, proof);
    return found ? proof : null;
  }

  _findProof(node, id, proof) {
    if (!node || node.isLeaf()) return node && node.data === id;

    // Try left subtree
    if (this._findProof(node.left, id, proof)) {
      proof.push({ hash: node.right.hash, direction: 'right' });
      return true;
    }
    // Try right subtree
    if (this._findProof(node.right, id, proof)) {
      proof.push({ hash: node.left.hash, direction: 'left' });
      return true;
    }
    return false;
  }

  // ── Diff ──────────────────────────────────────────────────────────────────

  /**
   * Compare two trees and return leaf IDs that differ.
   * Bandwidth-efficient: stops recursion when subtree hashes match.
   *
   * @param {MerkleTree} other
   * @returns {{ missingLocal: string[], missingRemote: string[], differing: string[] }}
   */
  diff(other) {
    const result = { missingLocal: [], missingRemote: [], differing: [] };
    this._diff(this.root, other.root, result);
    return result;
  }

  _diff(a, b, result) {
    // Both absent
    if (!a && !b) return;

    // One absent
    if (!a) { this._collectLeaves(b, result.missingLocal);  return; }
    if (!b) { this._collectLeaves(a, result.missingRemote); return; }

    // Hashes match → subtree identical, skip
    if (a.hash === b.hash) return;

    // Both leaves → same position, different content
    if (a.isLeaf() && b.isLeaf()) {
      result.differing.push({ local: a.data, remote: b.data });
      return;
    }

    // Recurse into children
    this._diff(a.left,  b.left,  result);
    this._diff(a.right, b.right, result);
  }

  _collectLeaves(node, arr) {
    if (!node) return;
    if (node.isLeaf()) { arr.push(node.data); return; }
    this._collectLeaves(node.left,  arr);
    this._collectLeaves(node.right, arr);
  }

  // ── Serialise ─────────────────────────────────────────────────────────────

  /**
   * Compact representation for network transmission.
   * Only transmits hashes (not full data), enabling bandwidth-efficient sync.
   */
  serialize() {
    return {
      rootHash: this.getRootHash(),
      nodeCount: this.records.length,
      levels: this._serializeLevels()
    };
  }

  _serializeLevels() {
    const levels = [];
    let current = [this.root];
    while (current.length > 0) {
      levels.push(current.map(n => ({ hash: n.hash, isLeaf: n.isLeaf(), data: n.data })));
      const next = [];
      for (const n of current) {
        if (n.left)  next.push(n.left);
        if (n.right && n.right !== n.left) next.push(n.right);
      }
      current = next;
    }
    return levels;
  }
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = { MerkleTree, sha256 };
