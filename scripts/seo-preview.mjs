/* global URL, Request, console */
import { Buffer } from 'node:buffer';
import { gzipSync } from 'node:zlib';
// Serve the real Vercel production bundle locally, without a dev toolbar.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import handler from '../.vercel/output/_functions/entry.mjs';
const root = resolve('.vercel/output/static');
const types = {
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1:4381');
    const file = resolve(root, '.' + decodeURIComponent(url.pathname));
    if (
      file.startsWith(root + '/') &&
      (await stat(file)
        .then((s) => s.isFile())
        .catch(() => false))
    ) {
      res.setHeader(
        'content-type',
        types[extname(file)] || 'application/octet-stream',
      );
      const body = await readFile(file);
      if (/\.(css|js|svg)$/.test(file)) {
        res.setHeader('content-encoding', 'gzip');
        res.end(gzipSync(body));
      } else res.end(body);
      return;
    }
    const response = await handler.fetch(
      new Request(url, { headers: req.headers }),
    );
    const headers = Object.fromEntries(response.headers);
    const body = Buffer.from(await response.arrayBuffer());
    if (headers['content-type']?.includes('text/')) {
      headers['content-encoding'] = 'gzip';
      delete headers['content-length'];
      res.writeHead(response.status, headers);
      res.end(gzipSync(body));
    } else {
      res.writeHead(response.status, headers);
      res.end(body);
    }
  } catch (error) {
    console.error(error);
    res.writeHead(500);
    res.end('Preview error');
  }
}).listen(4381, '127.0.0.1', () =>
  console.log('Production bundle: http://127.0.0.1:4381'),
);
