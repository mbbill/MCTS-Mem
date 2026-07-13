// Tests for the web-viewer JSON serializer (src/api.js). It is built on the same
// model as the terminal view/show, so these assert the shape the browser relies on.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as h from './helpers.js';
import { treeJson, nodeJson } from '../src/api.js';

test('treeJson: serializes the structural tree without heavy detail entries', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const { root } = treeJson(t.root);
    assert.equal(root.name, 'acorn');
    assert.equal(root.items, undefined);

    const pc = root.children.find((c) => c.name === 'page-cache');
    assert.ok(pc, 'page-cache is a child of acorn');
    assert.equal(pc.facts, undefined);
    assert.equal(pc.moves, undefined);

    // alternatives are separate from children, and flagged inAlt
    assert.equal(pc.children.length, 0);
    assert.equal(pc.alts.length, 1);
    assert.equal(pc.alts[0].name, 'write-through');
    assert.equal(pc.alts[0].inAlt, true);

    // lightweight semantic counts remain on the structural payload
    assert.deepEqual(pc.counts, { facts: 1, moves: 1, alts: 1, children: 0 });
    assert.equal(pc.weight, 'normal');
    assert.deepEqual(pc.provenance, { code: 2, sourced: 0, uncertain: 0 });
  } finally {
    t.cleanup();
  }
});

test('nodeJson: serializes one node details lazily, including resolved links', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const { node: pc } = nodeJson(t.root, 'acorn/page-cache');
    assert.equal(pc.name, 'page-cache');
    assert.ok(pc.items.length >= 1 && pc.items[0].startsWith('Reads go'));

    // a fact, parsed with provenance + cleaned claim text
    assert.equal(pc.facts.length, 1);
    assert.equal(pc.facts[0].provenance, 'code');
    assert.equal(pc.facts[0].kind, 'measurement');
    assert.ok(pc.facts[0].text.includes('batching at eviction'));
    assert.ok(!/\(code\)/.test(pc.facts[0].text), 'provenance tag stripped from text');

    // a move, with its verb and resolved [[link]] target
    assert.equal(pc.moves.length, 1);
    assert.equal(pc.moves[0].isMove, true);
    assert.equal(pc.moves[0].verb, 'replaced');
    assert.equal(pc.moves[0].targetName, 'write-through');
    assert.ok(pc.moves[0].target.endsWith('write-through'));

    // counts, provenance distribution, graduated fact files
    assert.deepEqual(pc.counts, { facts: 1, moves: 1, alts: 1, children: 0 });
    assert.deepEqual(pc.provenance, { code: 2, sourced: 0, uncertain: 0 });
    assert.ok(pc.factFiles.includes('stall'));
  } finally {
    t.cleanup();
  }
});

test('nodeJson: weight reflects fact density (fought-over / normal / unweighed)', () => {
  const facts5 = Array.from({ length: 5 }, (_, i) => `- 2031-01-0${i + 1} statement: fact ${i} (code).`).join('\n\n');
  const files = {
    'r.md': '- root.\n',
    'r/fought.md': `- x.\n\n## Facts\n\n${facts5}\n`,
    'r/thin.md': '- y.\n\n## Facts\n\n- 2031-02-01 statement: one (code).\n',
    'r/bare.md': '- z.\n',
  };
  const t = h.tmpTree(files);
  try {
    assert.equal(nodeJson(t.root, 'r/fought').node.weight, 'fought-over'); // >= 5 facts
    assert.equal(nodeJson(t.root, 'r/thin').node.weight, 'normal'); // some signal, < 5
    assert.equal(nodeJson(t.root, 'r/bare').node.weight, 'unweighed'); // no facts/moves/alts
  } finally {
    t.cleanup();
  }
});

test('treeJson: throws when the tree has no single root', () => {
  const t = h.tmpTree({ 'a.md': '- one.\n', 'b.md': '- two.\n' });
  try {
    assert.throws(() => treeJson(t.root), /top-level node/);
  } finally {
    t.cleanup();
  }
});
