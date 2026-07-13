// Tests for the `mcts-mem serve` request handler (src/serve.js). Driven with a
// mock req/res so there is no real socket — fast and no lingering handles.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { Writable } from 'node:stream';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as h from './helpers.js';
import { createHandler } from '../src/serve.js';

class MockRes extends Writable {
  constructor() {
    super();
    this.statusCode = 0;
    this.headers = {};
    this._chunks = [];
  }
  writeHead(code, headers) {
    this.statusCode = code;
    if (headers) for (const k of Object.keys(headers)) this.headers[k.toLowerCase()] = headers[k];
    return this;
  }
  _write(chunk, _enc, cb) {
    this._chunks.push(Buffer.from(chunk));
    cb();
  }
  get body() {
    return Buffer.concat(this._chunks).toString();
  }
}

// run a request through the handler and resolve once the response is fully written
async function call(root, url, dist = '/no/such/dist') {
  const res = new MockRes();
  const done = once(res, 'finish');
  createHandler(root, dist)({ url, method: 'GET' }, res);
  await done;
  return res;
}

function tmpDist(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-dist-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return dir;
}

test('serve: /api/tree returns the serialized tree as JSON', async () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const res = await call(t.root, '/api/tree');
    assert.equal(res.statusCode, 200);
    assert.match(res.headers['content-type'], /application\/json/);
    const body = JSON.parse(res.body);
    assert.equal(body.root.name, 'acorn');
    assert.ok(body.root.children.some((c) => c.name === 'page-cache'));
  } finally {
    t.cleanup();
  }
});

test('serve: /api/node returns one node details lazily', async () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const res = await call(t.root, '/api/node?path=acorn%2Fpage-cache');
    assert.equal(res.statusCode, 200);
    assert.match(res.headers['content-type'], /application\/json/);
    const body = JSON.parse(res.body);
    assert.equal(body.node.name, 'page-cache');
    assert.ok(body.node.items[0].startsWith('Reads go'));
    assert.equal(body.node.facts.length, 1);
    assert.equal(body.node.moves.length, 1);
  } finally {
    t.cleanup();
  }
});

test('serve: /api/node returns 404 for a missing node path', async () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const res = await call(t.root, '/api/node?path=acorn%2Fmissing');
    assert.equal(res.statusCode, 404);
    assert.match(JSON.parse(res.body).error, /node not found/);
  } finally {
    t.cleanup();
  }
});

test('serve: a non-servable tree yields 500 (headers not pre-sent before serialize)', async () => {
  const t = h.tmpTree({ 'a.md': '- one.\n', 'b.md': '- two.\n' }); // two roots → treeJson throws
  try {
    const res = await call(t.root, '/api/tree');
    assert.equal(res.statusCode, 500);
    assert.match(JSON.parse(res.body).error, /top-level node/);
  } finally {
    t.cleanup();
  }
});

test('serve: serves the placeholder page when no dist is built', async () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const res = await call(t.root, '/'); // dist points nowhere
    assert.equal(res.statusCode, 200);
    assert.match(res.headers['content-type'], /text\/html/);
    assert.match(res.body, /API is live/);
  } finally {
    t.cleanup();
  }
});

test('serve: serves built assets and SPA-falls back to index.html', async () => {
  const t = h.tmpTree(h.validFiles());
  const dist = tmpDist({
    'index.html': '<!doctype html><div id="root"></div>',
    'assets/app.js': 'console.log(1)',
  });
  try {
    assert.match((await call(t.root, '/', dist)).body, /id="root"/);

    const asset = await call(t.root, '/assets/app.js', dist);
    assert.equal(asset.statusCode, 200);
    assert.match(asset.headers['content-type'], /javascript/);

    // an unknown route is not a real file → SPA fallback to index.html
    assert.match((await call(t.root, '/deep/route', dist)).body, /id="root"/);
  } finally {
    fs.rmSync(dist, { recursive: true, force: true });
    t.cleanup();
  }
});

test('serve: blocks path traversal out of dist (403)', async () => {
  const t = h.tmpTree(h.validFiles());
  const dist = tmpDist({ 'index.html': '<div id="root"></div>' });
  try {
    // %2f keeps the ../ encoded so the handler (not a URL client) resolves it
    const res = await call(t.root, '/..%2f..%2fpackage.json', dist);
    assert.equal(res.statusCode, 403);
  } finally {
    fs.rmSync(dist, { recursive: true, force: true });
    t.cleanup();
  }
});
