// Serves dist/ locally at http://localhost:4321 (like the real host does).
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const PORT = Number(process.env.PORT || 4321);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.xml': 'application/xml', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.wasm': 'application/wasm', '.pf_meta': 'application/octet-stream' };

http.createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname).normalize('NFC');
  let file = path.join(DIST, p);
  if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
  try {
    const st = await fs.stat(file);
    if (st.isDirectory()) {
      if (!p.endsWith('/')) { res.writeHead(301, { Location: encodeURI(p + '/') }); return res.end(); }
      file = path.join(file, 'index.html');
    }
    const body = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    const body = await fs.readFile(path.join(DIST, '404.html')).catch(() => 'Not found');
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(body);
  }
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
