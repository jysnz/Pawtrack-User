const http = require('http');
const fs = require('fs');
const path = require('path');
const autoSync = require('./scripts/auto-sync');


// Preferred port. If it is taken (another dev server running), the next free one is used automatically.
const BASE_PORT = parseInt(process.env.PORT, 10) || 3000;
const MAX_PORT_ATTEMPTS = 20;
let PORT = BASE_PORT;
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

// Bind dual-stack ('::' accepts IPv4 and IPv6) so http://localhost works however the browser resolves it.
// Binding IPv4 only made Chrome (which tries ::1 first) hit whatever else owned that port on IPv6.
let HOST = '::';

server.on('error', (err) => {
  if ((err.code === 'EAFNOSUPPORT' || err.code === 'EADDRNOTAVAIL') && HOST === '::') {
    HOST = '0.0.0.0'; // IPv6 disabled on this machine
    startListening();
    return;
  }
  if (err.code === 'EADDRINUSE') {
    if (PORT - BASE_PORT + 1 >= MAX_PORT_ATTEMPTS) {
      console.error('\n[ERROR] Ports ' + BASE_PORT + '-' + PORT + ' are all in use. Free one up or set PORT=<number>.');
      process.exit(1);
    }
    console.warn('[NOTICE] Port ' + PORT + ' is already in use, trying ' + (PORT + 1) + '...');
    PORT += 1;
    startListening();
  } else {
    console.error('Server encountered an error:', err);
  }
});

function startListening() {
  server.listen(PORT, HOST);
}

server.on('listening', () => {
  console.log('\n==================================================');
  console.log('  🐾 PawTrack Pet Owner Portal Server Running');
  if (PORT !== BASE_PORT) console.log('  (port ' + BASE_PORT + ' was busy, switched to ' + PORT + ')');
  console.log('  Local URL:    http://localhost:' + PORT);
  console.log('  Admin:        http://localhost:' + PORT + '/admin/');
  console.log('  Health API:   http://localhost:' + PORT + '/api/health');
  console.log('  Git Status:   http://localhost:' + PORT + '/api/git/status');
  console.log('  Git Sync:     POST http://localhost:' + PORT + '/api/git/sync');
  console.log('==================================================\n');
  openBrowserIfRequested();
});

// Opens the browser at the port that was actually bound (never a hardcoded one).
// Enabled with `--open` or PAWTRACK_OPEN=1. PAWTRACK_OPEN may also be a comma-separated list of paths, e.g. "/,/admin/".
function openBrowserIfRequested() {
  const flag = process.env.PAWTRACK_OPEN;
  if (!process.argv.includes('--open') && !flag) return;
  const paths = (flag && flag !== '1' && flag.toLowerCase() !== 'true' ? flag.split(',') : ['/'])
    .map(p => p.trim())
    .filter(Boolean);

  const { spawn } = require('child_process');
  paths.forEach(p => {
    const url = 'http://localhost:' + PORT + (p.startsWith('/') ? p : '/' + p);
    const [cmd, args] =
      process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url]] :
      process.platform === 'darwin' ? ['open', [url]] :
      ['xdg-open', [url]];
    try {
      const child = spawn(cmd, args, { stdio: 'ignore', detached: true, windowsVerbatimArguments: true });
      child.on('error', () => console.log('  Open this in your browser: ' + url));
      child.unref();
    } catch (e) {
      console.log('  Open this in your browser: ' + url);
    }
  });
}

startListening();
