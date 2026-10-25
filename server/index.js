import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Room } from './room.js';
import { logError, logInfo } from './posthog-logs.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATIC = {
  '/shared/': path.join(ROOT, 'shared'),
  '/': path.join(ROOT, 'public'),
};
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

async function serveStatic(req, res) {
  const url = new URL(req.url, 'http://localhost');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  for (const [prefix, dir] of Object.entries(STATIC)) {
    if (!pathname.startsWith(prefix)) continue;
    const file = path.join(dir, pathname.slice(prefix.length));
    if (!file.startsWith(dir + path.sep)) break;
    try {
      const body = await readFile(file);
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(body);
      return;
    } catch {
      break;
    }
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/posthog-config.js') {
    const config = JSON.stringify({
      projectToken: process.env.POSTHOG_PROJECT_TOKEN,
      host: process.env.POSTHOG_HOST,
      isDevelopment: process.env.NODE_ENV !== 'production',
    }).replace(/</g, '\\u003c');
    res.writeHead(200, {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Cache-Control': 'no-cache',
    });
    res.end(`window.__POSTHOG_CONFIG__ = ${config};`);
    return;
  }
  serveStatic(req, res).catch(() => {
    res.writeHead(500);
    res.end();
  });
});

const rooms = new Map();
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

function newCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () => CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0]).join('');
  } while (rooms.has(code));
  return code;
}

function createRoom(opts) {
  const code = newCode();
  const room = new Room(code, opts, () => rooms.delete(code));
  rooms.set(code, room);
  return room;
}

const cleanName = (n) => String(n ?? '').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 16) || 'Player';

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws.room = null;
  const send = (msg) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(msg));

  ws.on('message', (raw) => {
    try {
      onMessage(raw);
    } catch (err) {
      logError('websocket_message_handling_failed', { error_type: err?.name ?? 'Error' });
      console.error('message handling failed:', err);
    }
  });

  function onMessage(raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!msg || typeof msg.t !== 'string') return;

    if (msg.t === 'create' || msg.t === 'practice' || msg.t === 'tutorial' || msg.t === 'join') {
      ws.room?.leave(ws);
      ws.room = null;
      let room;
      if (msg.t === 'join') {
        room = rooms.get(String(msg.code ?? '').toUpperCase().trim());
        if (!room) return send({ t: 'error', msg: 'Room not found. Check the code.' });
        if (room.full) return send({ t: 'error', msg: 'That room is already full.' });
      } else {
        room = createRoom(msg.t === 'tutorial' ? { tutorial: true }
          : msg.t === 'practice' ? { bot: String(msg.difficulty ?? 'normal') } : {});
      }
      room.join(ws, cleanName(msg.name));
      ws.room = room;
      return;
    }

    ws.room?.handle(ws, msg);
  }

  ws.on('close', () => {
    ws.room?.leave(ws);
    ws.room = null;
  });
});

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => {
  logInfo('typezone_server_started', { port: PORT });
  console.log(`TypeZone running at http://localhost:${PORT}`);
});
