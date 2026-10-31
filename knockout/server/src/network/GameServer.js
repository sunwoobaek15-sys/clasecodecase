// HTTP(정적 파일) + WebSocket 서버와 고정 틱 게임 루프.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import { RoomManager } from '../rooms/RoomManager.js';
import { DT } from '../../../shared/src/constants.js';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2',
};

export function createGameServer({ port = 3001, staticDir = null, host = '0.0.0.0' } = {}) {
  const manager = new RoomManager();

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, rooms: manager.rooms.size }));
      return;
    }
    if (!staticDir) { res.writeHead(404); res.end('KNOCKOUT server'); return; }
    let file = path.normalize(path.join(staticDir, decodeURIComponent(url.pathname)));
    if (!file.startsWith(staticDir)) { res.writeHead(403); res.end(); return; }
    fs.stat(file, (e, st) => {
      if (e || st.isDirectory()) file = path.join(staticDir, 'index.html');
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not found — run "npm run build" first'); return; }
        const ext = path.extname(file);
        res.writeHead(200, {
          'content-type': MIME[ext] || 'application/octet-stream',
          'cache-control': file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
        });
        res.end(data);
      });
    });
  });

  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });
  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('message', (data) => {
      let msg;
      try { msg = JSON.parse(data.toString()); } catch { return; }
      try { manager.handle(ws, msg); } catch (e) { console.error('handle error', e); }
    });
    ws.on('close', () => manager.disconnect(ws));
    ws.on('error', () => {});
  });

  // 끊긴 연결 감지 (하트비트)
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false;
      ws.ping();
    }
  }, 5000);

  // 고정 60Hz 시뮬레이션 루프 (누적기로 드리프트 보정)
  let last = performance.now();
  let acc = 0;
  const loop = setInterval(() => {
    const now = performance.now();
    acc += (now - last) / 1000;
    last = now;
    if (acc > 0.25) acc = 0.25;
    while (acc >= DT) {
      acc -= DT;
      try { manager.update(); } catch (e) { console.error('tick error', e); }
    }
  }, 4);

  return {
    manager,
    server,
    listen: () => new Promise((resolve) => server.listen(port, host, () => resolve(server.address().port))),
    close: () => new Promise((resolve) => {
      clearInterval(loop);
      clearInterval(heartbeat);
      for (const ws of wss.clients) ws.terminate();
      wss.close();
      server.close(() => resolve());
    }),
  };
}
