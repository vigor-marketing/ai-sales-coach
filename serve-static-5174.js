// Production static server for port 5174
// Serves built frontend + proxies API to backend
const http = require('http');
const fs = require('fs');
const path = require('path');

const dist = path.resolve('apps/web/dist');
const port = 5174;
const mime = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.json': 'application/json',
  '.wasm': 'application/wasm',
};

http.createServer((req, res) => {
  // Proxy /api requests to backend
  if (req.url.startsWith('/api')) {
    const opts = {
      hostname: '127.0.0.1',
      port: 3000,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: 'localhost:3000' },
    };
    const proxy = http.request(opts, (pr) => {
      res.writeHead(pr.statusCode, pr.headers);
      pr.pipe(res);
    });
    req.pipe(proxy);
    proxy.on('error', () => { res.writeHead(502); res.end('Backend unavailable'); });
    return;
  }

  // Serve static files
  let filePath = path.join(dist, req.url === '/' ? 'index.html' : req.url);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(dist, 'index.html');
  }
  const ext = path.extname(filePath);
  res.writeHead(200, {
    'Content-Type': mime[ext] || 'application/octet-stream',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache',
  });
  fs.createReadStream(filePath).pipe(res);
}).listen(port, '0.0.0.0', () => {
  console.log(`[5174] Production server ready - http://192.168.1.117:${port}`);
});
