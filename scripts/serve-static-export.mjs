import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3000);
const repoName = 'sanskrit-keyboard';
const basePath = `/${repoName}`;
const outDir = join(process.cwd(), 'out');

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.ttf': 'font/ttf',
};

function sendNotFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}

function serveFile(filePath, res) {
  const ext = extname(filePath);
  const contentType = contentTypes[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  createReadStream(filePath).pipe(res);
}

function resolveTarget(pathname) {
  if (pathname === '/' || pathname === '') {
    return { redirect: `${basePath}/` };
  }

  if (!pathname.startsWith(basePath)) {
    return null;
  }

  const relativePath = pathname.slice(basePath.length).replace(/^\/+/, '');
  const safePath = normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
  const directPath = join(outDir, safePath);

  if (existsSync(directPath) && statSync(directPath).isFile()) {
    return { filePath: directPath };
  }

  const indexPath = join(outDir, safePath, 'index.html');
  if (existsSync(indexPath)) {
    return { filePath: indexPath };
  }

  if (!extname(safePath)) {
    const htmlPath = join(outDir, `${safePath}.html`);
    if (existsSync(htmlPath)) {
      return { filePath: htmlPath };
    }
  }

  return null;
}

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const target = resolveTarget(url.pathname);

  if (!target) {
    sendNotFound(res);
    return;
  }

  if (target.redirect) {
    res.writeHead(302, { Location: target.redirect });
    res.end();
    return;
  }

  serveFile(target.filePath, res);
});

server.listen(port, host, () => {
  console.log(`Static export preview running at http://${host}:${port}${basePath}/`);
});
