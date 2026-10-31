import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createGameServer } from './network/GameServer.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, '../../client/dist');
const port = Number(process.env.PORT) || 3001;

const game = createGameServer({ port, staticDir: fs.existsSync(dist) ? dist : null, host: process.env.HOST || '0.0.0.0' });
game.listen().then((p) => {
  console.log(`KNOCKOUT 서버 실행 중: http://localhost:${p}  (WebSocket: ws://localhost:${p}/ws)`);
  if (!fs.existsSync(dist)) console.log('client/dist 가 없어 정적 파일은 제공하지 않습니다. 개발 시에는 npm run dev 를 사용하세요.');
});

const shutdown = () => game.close().then(() => process.exit(0));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
