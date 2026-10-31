import test from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { createGameServer } from '../server/src/network/GameServer.js';
import { Match } from '../server/src/game/Match.js';
import { Player } from '../server/src/players/Player.js';
import { PHYS } from '../shared/src/constants.js';
import { FLAG, SP, BTN } from '../shared/src/messages.js';

class TestClient {
  constructor(port) {
    this.ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    this.msgs = [];
    this.waiters = [];
    this.seq = 0;
    this.ws.on('message', (d) => {
      const m = JSON.parse(d.toString());
      this.msgs.push(m);
      if (m.t === 'room') this.room = m;
      if (m.t === 'welcome') this.welcome = m;
      if (m.t === 's') this.snap = m;
      if (m.t === 'result') this.result = m;
      for (const w of [...this.waiters]) if (w.pred(m)) { this.waiters.splice(this.waiters.indexOf(w), 1); w.resolve(m); }
    });
    this.open = new Promise((r) => this.ws.on('open', r));
  }
  send(m) { this.ws.send(JSON.stringify(m)); }
  wait(pred, ms = 8000) {
    const found = this.msgs.find(pred);
    if (found) return Promise.resolve(found);
    return new Promise((resolve, reject) => {
      const w = { pred, resolve };
      this.waiters.push(w);
      setTimeout(() => reject(new Error('timeout waiting ' + pred.toString())), ms);
    });
  }
  next(pred, ms) { this.msgs = []; return this.wait(pred, ms); }
  input(mx, mz, buttons = 0) { this.send({ t: 'i', d: [[++this.seq, mx, mz, buttons]] }); }
  me() { return this.snap && this.snap.p.find((p) => p[0] === this.welcome.you); }
  close() { this.ws.close(); }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let game, port;
test.before(async () => {
  game = createGameServer({ port: 0, host: '127.0.0.1' });
  port = await game.listen();
});
test.after(() => game.close());

test('방 만들기 → 코드로 참가 → 준비 → 시작 → 동기화 → 탈락 → 우승 → 다시 하기', async () => {
  const host = new TestClient(port);
  const guest = new TestClient(port);
  await Promise.all([host.open, guest.open]);

  host.send({ t: 'create', name: '호스트', look: { color: 'red' } });
  const w1 = await host.wait((m) => m.t === 'welcome');
  assert.match(w1.code, /^[A-Z0-9]{4}$/);

  // 잘못된 코드
  guest.send({ t: 'join', code: 'ZZZZ', name: '게스트' });
  const err = await guest.wait((m) => m.t === 'error');
  assert.ok(err.msg.includes('찾을 수 없'));

  guest.send({ t: 'join', code: w1.code.toLowerCase(), name: '게스트', look: { color: 'red' } });
  const w2 = await guest.wait((m) => m.t === 'welcome');
  assert.equal(w2.code, w1.code);
  await host.wait((m) => m.t === 'room' && m.players.length === 2);
  assert.equal(host.room.hostId, w1.you);
  const colors = host.room.players.map((p) => p.look.color);
  assert.notEqual(colors[0], colors[1], '색상이 겹치지 않게 배정');

  // 게스트가 준비하지 않으면 시작 불가
  host.send({ t: 'start' });
  const e2 = await host.wait((m) => m.t === 'error' && m.msg.includes('준비'));
  assert.ok(e2);
  // 게스트는 시작 권한 없음
  guest.send({ t: 'start' });
  await guest.wait((m) => m.t === 'error' && m.msg.includes('방장'));

  guest.send({ t: 'ready', ready: true });
  await host.wait((m) => m.t === 'room' && m.players.find((p) => p.id === w2.you)?.ready);
  host.send({ t: 'start' });
  await host.wait((m) => m.t === 'room' && m.phase === 'countdown');
  await guest.wait((m) => m.t === 'room' && m.phase === 'countdown');
  await host.next((m) => m.t === 'room' && m.phase === 'playing', 5000);

  // 위치 동기화: 호스트가 움직이면 게스트도 같은 위치를 본다
  const start = host.me();
  const sx = start[SP.X], sz = start[SP.Z];
  const r = Math.hypot(sx, sz);
  // 경기장 바깥쪽으로 달려 떨어진다
  for (let i = 0; i < 150; i++) { host.input(sx / r, sz / r, i === 5 ? BTN.JUMP : 0); await sleep(1000 / 60); }
  const elim = await guest.wait((m) => m.t === 'elim' && m.id === w1.you, 6000);
  assert.equal(elim.rank, 2);
  const res = await guest.wait((m) => m.t === 'result');
  assert.deepEqual(res.winners, [w2.you]);
  assert.equal(res.draw, false);
  assert.equal(res.ranking[0].id, w2.you);
  assert.equal(res.ranking[1].rank, 2);
  assert.ok(res.duration > 1);
  assert.equal(res.eliminated[0].id, w1.you);
  const gSnap = guest.snap.p.find((p) => p[0] === w1.you);
  assert.ok(gSnap[SP.FLAGS] & FLAG.OUT, '게스트 화면에서도 OUT');

  // 다시 하기: 방장이 누르면 즉시 새 경기
  host.send({ t: 'rematch' });
  await guest.wait((m) => m.t === 'room' && m.phase === 'countdown' && m.matchNo === 2);
  host.close(); guest.close();
});

test('입력 순서 번호(ack)가 스냅샷에 반영되고 서버가 입력 속도를 제한한다', async () => {
  const a = new TestClient(port), b = new TestClient(port);
  await Promise.all([a.open, b.open]);
  a.send({ t: 'create', name: 'A' });
  const w = await a.wait((m) => m.t === 'welcome');
  b.send({ t: 'join', code: w.code, name: 'B' });
  await b.wait((m) => m.t === 'welcome');
  b.send({ t: 'ready', ready: true });
  await a.wait((m) => m.t === 'room' && m.players.length === 2 && m.players[1].ready);
  a.send({ t: 'start' });
  await a.wait((m) => m.t === 'room' && m.phase === 'playing', 6000);
  const p0 = a.me();
  // 1초 분량(60개) 입력을 한꺼번에 보내도 서버는 큐 제한 때문에 순간이동하지 않는다
  for (let i = 0; i < 60; i++) a.input(0, 0, 0);
  const dirx = -p0[SP.X] / 11, dirz = -p0[SP.Z] / 11;
  const burst = [];
  for (let i = 0; i < 60; i++) burst.push([++a.seq, dirx, dirz, 0]);
  a.send({ t: 'i', d: burst });
  await sleep(300);
  const p1 = a.me();
  const moved = Math.hypot(p1[SP.X] - p0[SP.X], p1[SP.Z] - p0[SP.Z]);
  // 60개 입력이 모두 즉시 처리됐다면 약 7.5m 이동했을 것. 정상 속도(0.3초 ≈ 2.3m) 이내여야 한다.
  assert.ok(moved < 3, `순간이동 방지 (이동 ${moved})`);
  assert.ok(a.snap.ack > 0 && a.snap.ack <= a.seq);
  a.close(); b.close();
});

test('연결이 끊겨도 토큰으로 재접속(새로고침)하면 같은 플레이어로 복귀한다', async () => {
  const a = new TestClient(port), b = new TestClient(port);
  await Promise.all([a.open, b.open]);
  a.send({ t: 'create', name: 'A' });
  const wa = await a.wait((m) => m.t === 'welcome');
  b.send({ t: 'join', code: wa.code, name: 'B' });
  const wb = await b.wait((m) => m.t === 'welcome');
  b.close();
  await a.wait((m) => m.t === 'room' && m.players.find((p) => p.id === wb.you && !p.connected));
  const b2 = new TestClient(port);
  await b2.open;
  b2.send({ t: 'resume', token: wb.token });
  const w = await b2.wait((m) => m.t === 'welcome');
  assert.equal(w.you, wb.you);
  assert.equal(w.code, wa.code);
  await a.wait((m) => m.t === 'room' && m.players.find((p) => p.id === wb.you && p.connected));
  // 잘못된 토큰
  const c = new TestClient(port);
  await c.open;
  c.send({ t: 'resume', token: 'nope' });
  const e = await c.wait((m) => m.t === 'error');
  assert.ok(e.resumeFailed);

  // 방장이 나가면 방장이 넘어간다
  a.send({ t: 'leave' });
  await b2.wait((m) => m.t === 'room' && m.hostId === wb.you);
  a.close(); b2.close(); c.close();
});

test('경기 중 끊긴 플레이어도 재접속하면 경기를 계속한다', async () => {
  const a = new TestClient(port), b = new TestClient(port);
  await Promise.all([a.open, b.open]);
  a.send({ t: 'create', name: 'A' });
  const wa = await a.wait((m) => m.t === 'welcome');
  b.send({ t: 'join', code: wa.code, name: 'B' });
  const wb = await b.wait((m) => m.t === 'welcome');
  b.send({ t: 'ready', ready: true });
  await a.wait((m) => m.t === 'room' && m.players.length === 2 && m.players[1].ready);
  a.send({ t: 'start' });
  await a.wait((m) => m.t === 'room' && m.phase === 'playing', 6000);
  b.close();
  await a.wait((m) => m.t === 's' && m.p.find((p) => p[0] === wb.you)[SP.FLAGS] & FLAG.DISCONNECTED);
  const b2 = new TestClient(port);
  await b2.open;
  b2.send({ t: 'resume', token: wb.token });
  await b2.wait((m) => m.t === 'room' && m.phase === 'playing');
  await b2.wait((m) => m.t === 'tiles');
  await b2.wait((m) => m.t === 's');
  const me = b2.me();
  assert.ok(!(me[SP.FLAGS] & FLAG.OUT));
  a.close(); b2.close();
});

test('봇 추가: 방장 혼자서도 봇과 대전할 수 있다', async () => {
  const a = new TestClient(port);
  await a.open;
  a.send({ t: 'create', name: 'Solo' });
  await a.wait((m) => m.t === 'welcome');
  a.send({ t: 'addBot' });
  a.send({ t: 'addBot' });
  await a.wait((m) => m.t === 'room' && m.players.length === 3);
  a.send({ t: 'removeBot' });
  await a.wait((m) => m.t === 'room' && m.players.length === 2);
  a.send({ t: 'start' });
  await a.wait((m) => m.t === 'room' && m.phase === 'playing', 6000);
  await sleep(1500);
  const bot = a.snap.p.find((p) => p[0] !== a.welcome.you);
  assert.ok(Math.hypot(bot[SP.VX], bot[SP.VZ]) > 0 || bot[SP.FLAGS] & FLAG.OUT, '봇이 움직인다');
  a.close();
});

test('최대 8명 제한', async () => {
  const cs = [];
  const h = new TestClient(port); await h.open;
  h.send({ t: 'create', name: 'H' });
  const w = await h.wait((m) => m.t === 'welcome');
  for (let i = 0; i < 7; i++) h.send({ t: 'addBot' });
  await h.wait((m) => m.t === 'room' && m.players.length === 8);
  const x = new TestClient(port); await x.open; cs.push(x);
  x.send({ t: 'join', code: w.code, name: 'X' });
  const e = await x.wait((m) => m.t === 'error');
  assert.ok(e.msg.includes('가득'));
  h.close(); cs.forEach((c) => c.close());
});

// ---- 시뮬레이션 단위 검증 ----
function mkPlayers(n) {
  return Array.from({ length: n }, (_, i) => { const p = new Player({ name: 'P' + i }); p.connected = true; return p; });
}

test('동시 탈락: 마지막 두 명이 같은 틱에 떨어지면 공동 우승(무승부)으로 처리된다', () => {
  const ps = mkPlayers(3);
  const m = new Match(ps, { rand: () => 0.5 });
  m.step();
  ps[0].state.y = PHYS.elimY + 0.01; ps[0].state.grounded = false; ps[0].state.vy = -10; ps[0].state.x = 30;
  m.step();
  assert.equal(ps[0].rank, 3);
  for (const p of [ps[1], ps[2]]) { p.state.y = PHYS.elimY + 0.01; p.state.grounded = false; p.state.vy = -10; p.state.x = 30; }
  m.step();
  assert.ok(m.over);
  assert.equal(ps[1].rank, 1);
  assert.equal(ps[2].rank, 1);
});

test('모든 플레이어가 동시에 떨어져도 오류 없이 종료된다', () => {
  const ps = mkPlayers(8);
  const m = new Match(ps);
  m.step();
  for (const p of ps) { p.state.y = PHYS.elimY + 0.01; p.state.grounded = false; p.state.vy = -10; p.state.x = 40; }
  m.step();
  assert.ok(m.over);
  assert.ok(ps.every((p) => p.rank === 1));
  assert.equal(m.aliveCount(), 0);
});

test('봇끼리 대전하면 결국 승자가 결정된다 (경기장 축소 포함)', () => {
  const ps = Array.from({ length: 6 }, (_, i) => { const p = new Player({ name: 'B' + i, isBot: true }); return p; });
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const m = new Match(ps, { rand });
  let ticks = 0;
  while (!m.over && ticks < 60 * 200) { m.step(); ticks++; }
  assert.ok(m.over, '경기 종료');
  assert.ok(m.t < 190, `경기 시간 ${m.t}`);
  const winners = ps.filter((p) => p.rank === 1);
  assert.ok(winners.length >= 1);
  assert.ok(m.director.events.length >= 0);
});

test('입력이 끊기면 서버는 잠깐만 마지막 입력을 유지하고 멈춘다', () => {
  const p = new Player({ name: 'X' });
  p.pushInputs([[1, 1, 0, 0]]);
  assert.equal(p.takeInput().mx, 1);
  for (let i = 0; i < 8; i++) assert.equal(p.takeInput().mx, 1);
  assert.equal(p.takeInput().mx, 0);
});
