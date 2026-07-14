// `mcts-mem serve` — a tiny zero-dependency web server (node:http only). It
// serves the built viewer (web-viewer/) and a live tree API. The tree is read
// from disk on every /api/tree request, so edits show up on a browser reload.
//
// The request handler is split out (createHandler) so it can be unit-tested with
// mock req/res — no socket. opts.dist / opts.quiet make serve() testable too.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { treeJson, nodeJson } from './api.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIST = path.join(here, '..', 'web-viewer');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.map': 'application/json',
};

export function createHandler(root, dist = DEFAULT_DIST) {
  return (req, res) => {
    const url = new URL(req.url, 'http://localhost');

    if (url.pathname === '/api/tree') {
      try {
        const body = JSON.stringify(treeJson(root)); // serialize BEFORE writing headers
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(body);
      } catch (e) {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    if (url.pathname === '/api/node') {
      try {
        const p = url.searchParams.get('path');
        if (!p) throw new Error('missing ?path=...');
        const body = JSON.stringify(nodeJson(root, p)); // serialize BEFORE writing headers
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(body);
      } catch (e) {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    // static assets from dist, with an SPA / placeholder fallback
    const hasDist = fs.existsSync(path.join(dist, 'index.html'));
    let file = path.join(dist, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
    const rDist = path.resolve(dist);
    const resolved = path.resolve(file);
    if (resolved !== rDist && !resolved.startsWith(rDist + path.sep)) { res.writeHead(403); res.end(); return; }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      if (hasDist) file = path.join(dist, 'index.html'); // SPA fallback
      else { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(placeholder()); return; }
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  };
}

export function serve(root, opts = {}) {
  const port = opts.port ?? 4173;
  const dist = opts.dist || DEFAULT_DIST;
  const log = opts.quiet ? () => {} : (...a) => console.log(...a);
  const warn = opts.quiet ? () => {} : (...a) => console.error(...a);

  // Validate once at startup so tree problems are visible immediately, but keep
  // serving (the error also surfaces per-request and in the UI).
  try { treeJson(root); }
  catch (e) { warn(`warning: tree at "${root}" is not servable yet: ${e.message}`); }

  const server = http.createServer(createHandler(root, dist));
  server.on('error', (e) => {
    warn(`mcts-mem serve: ${e.code === 'EADDRINUSE' ? `port ${port} is in use — try --port <n>` : e.message}`);
    if (!opts.quiet) process.exit(1);
  });
  server.listen(port, '127.0.0.1', () => {
    log(`mcts-mem serve  →  http://localhost:${server.address().port}   (tree: ${path.resolve(root)})`);
    if (!fs.existsSync(path.join(dist, 'index.html'))) {
      log('viewer UI not built yet — serving a placeholder; the API is live at /api/tree');
    }
  });
  return server;
}

function placeholder() {
  return `<!doctype html><html><head><meta charset="utf-8"><title>mcts-mem</title>
<style>body{font:15px/1.6 system-ui,sans-serif;max-width:640px;margin:64px auto;padding:0 24px;color:#222}
code{background:#f4f4f4;padding:2px 6px;border-radius:4px;font-size:90%}a{color:#2b6cb0}</style></head>
<body><h1>mcts-mem</h1>
<p>The tree API is live at <a href="/api/tree">/api/tree</a>.</p>
<p>The viewer UI isn't built yet. Build it with <code>cd viewer &amp;&amp; npm install &amp;&amp; npm run build</code>, then restart <code>mcts-mem serve</code>.</p>
</body></html>`;
}
