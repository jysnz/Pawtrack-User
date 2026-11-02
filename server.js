const http = require('http');
const fs = require('fs');
const path = require('path');
const autoSync = require('./scripts/auto-sync');


const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

// The data lives in Supabase (the app talks to it directly); this server only serves the app and the git tools

const server = http.createServer((req, res) => {
  // Global CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = req.url.split('?')[0];

  // API: Health & Status Check
  if (parsedUrl === '/api/health' || parsedUrl === '/api/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'PawTrack Pet Owner Portal',
      port: PORT,
      timestamp: new Date().toISOString(),
      database: 'Supabase',
      git: autoSync.getStatusSummary()
    }));
    return;
  }

  // API: Git Status Query
  if (parsedUrl === '/api/git/status' || parsedUrl === '/api/git-status') {
    const summary = autoSync.getStatusSummary();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(summary));
    return;
  }

  // API: Git Manual Sync / Force Push Trigger
  if ((parsedUrl === '/api/git/sync' || parsedUrl === '/api/git-sync') && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = body ? JSON.parse(body) : {};
        const result = autoSync.performSync(payload.message);
        broadcastSSE({ type: 'git_synced', result, timestamp: Date.now() });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // API: Git Auto-Sync Status (GET)
  if (parsedUrl === '/api/git/status' && req.method === 'GET') {
    try {
      const status = autoSync.getStatusSummary();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, status }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // API: Git Manual Sync Trigger (POST)
  if (parsedUrl === '/api/git/sync' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = body ? JSON.parse(body) : {};
        const result = autoSync.performSync(payload.commitMessage || payload.message);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // API 2: Full State Sync (GET)
  // Static File Serving
  // Admin console lives at /admin (trailing slash keeps its relative asset paths working)
  if (parsedUrl === '/admin') {
    res.writeHead(301, { Location: '/admin/' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '') });
    res.end();
    return;
  }

  let safeUrl = parsedUrl;
  if (safeUrl.endsWith('/')) safeUrl += 'index.html';

  const filePath = path.join(PUBLIC_DIR, safeUrl);

  // Never serve dotfiles/dotfolders (.env, .git)
  const relativeParts = path.relative(PUBLIC_DIR, filePath).split(path.sep);
  if (relativeParts.some(part => part.startsWith('.'))) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
    return;
  }

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn('\n[NOTICE] Port ' + PORT + ' is already in use.');
    console.warn('PawTrack Pet Owner service is already running on http://localhost:' + PORT);
  } else {
    console.error('Server encountered an error:', err);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n==================================================');
  console.log('  🐾 PawTrack Pet Owner Portal Server Running');
  console.log('  Local URL:    http://localhost:' + PORT);
  console.log('  Health API:   http://localhost:' + PORT + '/api/health');
  console.log('  Git Status:   http://localhost:' + PORT + '/api/git/status');
  console.log('  Git Sync:     POST http://localhost:' + PORT + '/api/git/sync');
  console.log('==================================================\n');
});
