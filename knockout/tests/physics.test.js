import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayerState, stepPlayer, resolvePlayerCollisions, EV } from '../shared/src/physics.js';
import { createWorld, applyEvents, TILE, tileIndexAt, RAISED, MOVERS, moverState, DAIS } from '../shared/src/arena.js';
import { DT, PHYS } from '../shared/src/constants.js';
import { BTN } from '../shared/src/messages.js';

const run = (p, input, ticks, world = createWorld()) => {
  let ev = 0;
  for (let i = 0; i < ticks; i++) { ev |= stepPlayer(p, input, DT, world); world.t += DT; }
  return ev;
};

test('이동: 가속 후 최고 속도에 도달하고 입력을 떼면 감속한다', () => {
  const p = createPlayerState(-8, 0);
  run(p, { mx: 1, mz: 0, buttons: 0 }, 6);
  assert.ok(p.vx > 3 && p.vx < PHYS.moveSpeed, '가속 중');
  run(p, { mx: 1, mz: 0, buttons: 0 }, 30);
  assert.ok(Math.abs(p.vx - PHYS.moveSpeed) < 1e-6, '최고 속도');
  run(p, { mx: 0, mz: 0, buttons: 0 }, 15);
  assert.equal(p.vx, 0, '정지');
  assert.ok(p.yaw > 1.4 && p.yaw < 1.7, '진행 방향(+x)을 바라본다');
});

test('점프: 점프 후 착지하고, 짧게 누르면 낮게 뛴다', () => {
  const p = createPlayerState(-9, 0);
  let maxY = 0, ev = 0;
  for (let i = 0; i < 90; i++) { ev |= stepPlayer(p, { mx: 0, mz: 0, buttons: BTN.JUMP }, DT, createWorld()); maxY = Math.max(maxY, p.y); }
  assert.ok(ev & EV.JUMP && ev & EV.LAND);
  assert.ok(p.grounded && p.y === 0);
  assert.ok(maxY > 1.6 && maxY < 1.95, `최대 높이 ${maxY}`);

  const q = createPlayerState(-9, 0);
  let maxQ = 0;
  for (let i = 0; i < 90; i++) { stepPlayer(q, { mx: 0, mz: 0, buttons: i < 4 ? BTN.JUMP : 0 }, DT, createWorld()); maxQ = Math.max(maxQ, q.y); }
  assert.ok(maxQ < maxY * 0.75, `짧은 점프 ${maxQ} < ${maxY}`);
});

test('점프는 버튼을 누를 때마다 한 번만 (누르고 있으면 반복하지 않음)', () => {
  const p = createPlayerState(-9, 0);
  let jumps = 0;
  for (let i = 0; i < 200; i++) if (stepPlayer(p, { mx: 0, mz: 0, buttons: BTN.JUMP }, DT, createWorld()) & EV.JUMP) jumps++;
  assert.equal(jumps, 1);
});

test('대시: 빠르게 이동하고 쿨타임 동안 다시 쓸 수 없다', () => {
  const p = createPlayerState(-10, 0);
  const w = createWorld();
  assert.ok(stepPlayer(p, { mx: 1, mz: 0, buttons: BTN.DASH }, DT, w) & EV.DASH);
  assert.ok(p.vx >= PHYS.dashSpeed - 1e-6);
  assert.ok(p.dashCd > PHYS.dashCooldown - 0.05);
  run(p, { mx: 0, mz: 0, buttons: 0 }, 30, w);
  assert.equal(stepPlayer(p, { mx: 1, mz: 0, buttons: BTN.DASH }, DT, w) & EV.DASH, 0, '쿨타임 중 대시 불가');
  run(p, { mx: 0, mz: 0, buttons: 0 }, Math.ceil(PHYS.dashCooldown / DT), w);
  assert.ok(stepPlayer(p, { mx: 0, mz: 1, buttons: BTN.DASH }, DT, w) & EV.DASH, '쿨타임 후 대시 가능');
});

test('대시 거리는 일정하다', () => {
  const a = createPlayerState(-13, 0), b = createPlayerState(-14, 0);
  stepPlayer(a, { mx: 1, mz: 0, buttons: BTN.DASH }, DT, createWorld());
  stepPlayer(b, { mx: 1, mz: 0, buttons: BTN.DASH }, DT, createWorld());
  run(a, { mx: 0, mz: 0, buttons: 0 }, 60); run(b, { mx: 0, mz: 0, buttons: 0 }, 60);
  assert.ok(Math.abs((a.x + 13) - (b.x + 14)) < 1e-9 && a.x + 13 > 4, `${a.x} ${b.x}`);
});

const mk = (key, x, z) => Object.assign(createPlayerState(x, z), { key });

test('충돌: 대시로 부딪히면 상대가 충돌 방향으로 크게 밀려난다', () => {
  const a = mk('a', -12, 0), b = mk('b', -10, 0);
  const w = createWorld();
  stepPlayer(a, { mx: 1, mz: 0, buttons: BTN.DASH }, DT, w);
  const cd = new Map();
  let hit = null;
  for (let i = 0; i < 12 && !hit; i++) {
    stepPlayer(a, { mx: 1, mz: 0, buttons: 0 }, DT, w);
    stepPlayer(b, { mx: 0, mz: 0, buttons: 0 }, DT, w);
    resolvePlayerCollisions([a, b], cd, DT, (x, y, power) => { hit = power; });
  }
  assert.ok(hit, '충돌 발생');
  assert.ok(b.vx > 14, `피해자 속도 ${b.vx}`);
  assert.ok(Math.abs(b.vz) < 1e-6, '방향 유지');
  assert.ok(b.vy > 0 && !b.grounded, '살짝 떠오른다');
  assert.ok(b.stun > 0, '경직');
  assert.ok(a.vx < b.vx * 0.5, '공격자는 반동이 작다');
  assert.equal(a.dashT, 0, '충돌하면 대시 종료');
});

test('충돌: 걷기 정면 충돌은 서로를 비슷하게 밀어내고 대시보다 약하다', () => {
  const a = mk('a', -0.5, 0), b = mk('b', 0.5, 0);
  a.vx = 7.5; b.vx = -7.5;
  resolvePlayerCollisions([a, b], new Map(), DT);
  assert.ok(a.vx < -3 && b.vx > 3);
  assert.ok(Math.abs(a.vx + b.vx) < 1e-6, '대칭');
  assert.ok(b.vx < 14);
});

test('충돌: 대각선 방향 충돌은 그 방향으로 밀린다', () => {
  const a = mk('a', 0, 0), b = mk('b', 0.7, 0.7);
  a.vx = 6; a.vz = 6;
  resolvePlayerCollisions([a, b], new Map(), DT);
  assert.ok(b.vx > 2 && Math.abs(b.vx - b.vz) < 1e-6);
});

test('충돌: 공중 충돌은 넉백이 더 크다', () => {
  const g1 = mk('a', -0.5, 0), g2 = mk('b', 0.5, 0); g1.vx = 6;
  const a1 = mk('a', -0.5, 0), a2 = mk('b', 0.5, 0); a1.vx = 6; a2.grounded = false; a2.y = 0.5; a1.y = 0.5; a1.grounded = false;
  resolvePlayerCollisions([g1, g2], new Map(), DT);
  resolvePlayerCollisions([a1, a2], new Map(), DT);
  assert.ok(a2.vx > g2.vx);
});

test('충돌: 쌍별 쿨다운으로 연속 충돌이 한 번에 폭주하지 않는다', () => {
  const a = mk('a', -0.5, 0), b = mk('b', 0.5, 0); a.vx = 7;
  const cd = new Map();
  let hits = 0;
  for (let i = 0; i < 5; i++) { a.x = -0.5; b.x = 0.5; a.vx = 7; resolvePlayerCollisions([a, b], cd, DT, () => hits++); }
  assert.equal(hits, 1);
});

test('경사면: 중앙 단상으로 걸어 올라간다', () => {
  const p = createPlayerState(-8, 0);
  run(p, { mx: 1, mz: 0, buttons: 0 }, 70);
  assert.ok(p.grounded);
  assert.ok(Math.abs(p.y - DAIS.top) < 1e-6, `y=${p.y}`);
});

test('높은 플랫폼: 옆면은 막히고 점프하면 올라간다', () => {
  const r = RAISED[0]; // top 1.5
  const start = { x: r.x - 4, z: r.z };
  const p = createPlayerState(start.x, start.z);
  run(p, { mx: 1, mz: 0, buttons: 0 }, 60);
  assert.ok(p.x < r.x - r.r, '옆면에 막힘');
  assert.equal(p.y, 0);
  const q = createPlayerState(start.x, start.z);
  run(q, { mx: 1, mz: 0, buttons: 0 }, 12);
  run(q, { mx: 1, mz: 0, buttons: BTN.JUMP }, 30);
  run(q, { mx: 0, mz: 0, buttons: 0 }, 30);
  assert.ok(Math.abs(q.y - r.top) < 1e-6 && q.grounded, `플랫폼 위 y=${q.y}`);
});

test('가장자리 밖으로 걸어 나가면 떨어져 탈락한다', () => {
  const p = createPlayerState(14, 0);
  const ev = run(p, { mx: 1, mz: 0, buttons: 0 }, 200);
  assert.ok(ev & EV.FELL);
  assert.equal(p.alive, false);
});

test('붕괴한 바닥 위에서는 떨어진다', () => {
  const w = createWorld();
  const p = createPlayerState(11.5, 0.5);
  w.tiles[tileIndexAt(11.5, 0.5)] = TILE.GONE;
  run(p, { mx: 0, mz: 0, buttons: 0 }, 120, w);
  assert.equal(p.alive, false);
  const q = createPlayerState(11.5, 0.5);
  const w2 = createWorld();
  w2.tiles[tileIndexAt(11.5, 0.5)] = TILE.WARN;
  run(q, { mx: 0, mz: 0, buttons: 0 }, 120, w2);
  assert.ok(q.alive && q.grounded, '경고 단계는 아직 단단하다');
});

test('움직이는 발판이 위에 선 플레이어를 운반한다', () => {
  const w = createWorld();
  const m = moverState(MOVERS[0], 0, {});
  const p = createPlayerState(m.x, m.z);
  p.y = m.top;
  run(p, { mx: 0, mz: 0, buttons: 0 }, 120, w);
  const m2 = moverState(MOVERS[0], w.t, {});
  assert.ok(p.alive && p.grounded);
  assert.ok(Math.hypot(p.x - m2.x, p.z - m2.z) < 0.6, '발판과 함께 이동');
});

test('회전 막대에 맞으면 날아간다', () => {
  const w = createWorld();
  applyEvents(w, [{ type: 'sweeper', start: 0, end: 10, dir: 1, phase: 0 }]);
  const p = createPlayerState(10 * Math.cos(0.3), 10 * Math.sin(0.3));
  const ev = run(p, { mx: 0, mz: 0, buttons: 0 }, 40, w);
  assert.ok(ev & EV.SWEPT);
});

test('바람이 플레이어를 민다', () => {
  const w = createWorld();
  applyEvents(w, [{ type: 'wind', start: 0, end: 10, angle: 0 }]);
  const p = createPlayerState(-8, 0);
  run(p, { mx: 0, mz: 0, buttons: 0 }, 90, w);
  assert.ok(p.x > -7.5);
});
