// 경기장 정의와 지형 질의 함수. 서버 물리와 클라이언트 예측/렌더링이 같은 정의를 쓴다.
import { PHYS, SWEEPER } from './constants.js';

const TAU = Math.PI * 2;

export const ARENA_RADIUS = 16;
export const DAIS = { top: 1.2, flatR: 2.5, slopeR: 5.5 };

// 바닥은 동심원 링을 섹터로 나눈 타일로 구성된다. 이벤트로 타일이 경고(1) → 붕괴(2) 될 수 있다.
export const RINGS = [
  { r0: 0, r1: 6, n: 1 },
  { r0: 6, r1: 10, n: 8 },
  { r0: 10, r1: 13, n: 12 },
  { r0: 13, r1: 16, n: 16 },
];

export const TILES = [];
export const RING_START = [];
for (let ri = 0; ri < RINGS.length; ri++) {
  const ring = RINGS[ri];
  RING_START.push(TILES.length);
  for (let i = 0; i < ring.n; i++) {
    TILES.push({ index: TILES.length, ring: ri, sector: i, r0: ring.r0, r1: ring.r1, a0: (i / ring.n) * TAU, a1: ((i + 1) / ring.n) * TAU });
  }
}
export const TILE_COUNT = TILES.length;
export const TILE = { OK: 0, WARN: 1, GONE: 2 };

export function tileIndexAt(x, z) {
  const r = Math.hypot(x, z);
  for (let ri = 0; ri < RINGS.length; ri++) {
    const ring = RINGS[ri];
    if (r < ring.r1) {
      if (ring.n === 1) return RING_START[ri];
      let a = Math.atan2(z, x);
      if (a < 0) a += TAU;
      const s = Math.min(ring.n - 1, Math.floor((a / TAU) * ring.n));
      return RING_START[ri] + s;
    }
  }
  return -1;
}

export function daisHeight(r) {
  if (r <= DAIS.flatR) return DAIS.top;
  if (r >= DAIS.slopeR) return 0;
  const k = (r - DAIS.flatR) / (DAIS.slopeR - DAIS.flatR);
  return DAIS.top * 0.5 * (1 + Math.cos(Math.PI * k));
}

// 높이가 다른 고정 플랫폼 (기둥형). 소속 타일이 붕괴하면 함께 사라진다.
export const RAISED = [0, 2, 4, 6].map((k) => {
  const a = ((k + 0.5) / 8) * TAU;
  const x = Math.cos(a) * 8;
  const z = Math.sin(a) * 8;
  return { x, z, r: 1.7, top: k % 4 === 0 ? 1.5 : 0.8, tile: tileIndexAt(x, z) };
});

// 경기장 밖을 공전하는 움직이는 발판
export const MOVERS = [
  { orbitR: 20.2, r: 2.4, speed: 0.22, phase: 0, bob: 0.35, thick: 0.6 },
  { orbitR: 20.2, r: 2.4, speed: 0.22, phase: Math.PI, bob: 0.35, thick: 0.6 },
];

export function moverState(m, t, out = {}) {
  const a = m.phase + m.speed * t;
  out.x = Math.cos(a) * m.orbitR;
  out.z = Math.sin(a) * m.orbitR;
  out.top = 0.15 + Math.sin(t * 1.3 + m.phase) * m.bob;
  out.vx = -Math.sin(a) * m.orbitR * m.speed;
  out.vz = Math.cos(a) * m.orbitR * m.speed;
  return out;
}

export function createWorld() {
  return { t: 0, tiles: new Array(TILE_COUNT).fill(TILE.OK), events: [], moversOffAt: Infinity };
}

/** 이벤트 목록이 바뀌면 호출해 파생 값을 갱신한다. */
export function applyEvents(world, events) {
  world.events = events;
  world.moversOffAt = Infinity;
  for (const e of events) if (e.movers) world.moversOffAt = Math.min(world.moversOffAt, e.start);
}

export function moversActive(world) {
  return world.t < world.moversOffAt;
}

export function tileSolid(world, idx) {
  return idx >= 0 && world.tiles[idx] !== TILE.GONE;
}

const _m = {};

/**
 * 발 아래 지면 높이를 구한다. 지면이 없으면 h = -Infinity.
 * out: { h, vx, vz, mover } — vx,vz는 움직이는 발판의 운반 속도
 */
export function groundAt(world, x, z, y, out) {
  out.h = -Infinity;
  out.vx = 0;
  out.vz = 0;
  out.mover = -1;
  const idx = tileIndexAt(x, z);
  if (idx >= 0 && world.tiles[idx] !== TILE.GONE) {
    out.h = daisHeight(Math.hypot(x, z));
  }
  for (const p of RAISED) {
    if (!tileSolid(world, p.tile)) continue;
    const dx = x - p.x, dz = z - p.z;
    if (dx * dx + dz * dz <= p.r * p.r && y >= p.top - PHYS.stepUp && p.top > out.h) out.h = p.top;
  }
  for (let i = 0; moversActive(world) && i < MOVERS.length; i++) {
    const m = moverState(MOVERS[i], world.t, _m);
    const dx = x - m.x, dz = z - m.z;
    if (dx * dx + dz * dz <= MOVERS[i].r * MOVERS[i].r && y >= m.top - PHYS.stepUp - 0.2 && m.top > out.h) {
      out.h = m.top;
      out.vx = m.vx;
      out.vz = m.vz;
      out.mover = i;
    }
  }
  return out;
}

/** 원통형 장애물(플랫폼 옆면)에 대해 수평으로 밀어낸다. */
export function pushOutWalls(world, p, radius) {
  for (const c of RAISED) {
    if (!tileSolid(world, c.tile)) continue;
    if (p.y >= c.top - PHYS.stepUp || p.y + PHYS.height < 0) continue;
    pushCircle(p, c.x, c.z, c.r + radius);
  }
  for (let i = 0; moversActive(world) && i < MOVERS.length; i++) {
    const m = moverState(MOVERS[i], world.t, _m);
    const top = m.top;
    if (p.y >= top - PHYS.stepUp - 0.2 || p.y + PHYS.height < top - MOVERS[i].thick) continue;
    pushCircle(p, m.x, m.z, MOVERS[i].r + radius);
  }
}

function pushCircle(p, cx, cz, minD) {
  const dx = p.x - cx, dz = p.z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= minD * minD) return;
  const d = Math.sqrt(d2) || 1e-4;
  const nx = dx / d, nz = dz / d;
  p.x = cx + nx * minD;
  p.z = cz + nz * minD;
  const vn = p.vx * nx + p.vz * nz;
  if (vn < 0) {
    p.vx -= vn * nx;
    p.vz -= vn * nz;
  }
}

export function activeEvent(world, type) {
  for (const e of world.events) if (e.type === type && world.t >= e.start && world.t < e.end) return e;
  return null;
}

export function sweeperAngle(e, t) {
  return (t - e.start) * SWEEPER.speed * (e.dir || 1) + (e.phase || 0);
}

export function windVector(world, out) {
  const e = activeEvent(world, 'wind');
  out.x = 0;
  out.z = 0;
  if (!e) return out;
  // 시작/끝에서 부드럽게 강해지고 약해진다
  const ramp = Math.min(1, (world.t - e.start) / 1.2, (e.end - world.t) / 1.2);
  out.x = Math.cos(e.angle) * ramp;
  out.z = Math.sin(e.angle) * ramp;
  return out;
}

/**
 * 회전 장애물 충돌. 맞으면 회전 방향으로 넉백한다. 충돌 시 true.
 */
export function sweeperHit(world, p, radius) {
  const e = activeEvent(world, 'sweeper');
  if (!e) return false;
  if (p.y > SWEEPER.y1 || p.y + PHYS.height < SWEEPER.y0) return false;
  const base = sweeperAngle(e, world.t);
  for (let k = 0; k < 2; k++) {
    const a = base + k * Math.PI;
    const ax = Math.cos(a), az = Math.sin(a);
    const along = p.x * ax + p.z * az;
    if (along < SWEEPER.r0 - radius || along > SWEEPER.r1 + radius) continue;
    const perp = -p.x * az + p.z * ax; // 회전 방향(+)으로의 거리
    if (Math.abs(perp) > SWEEPER.halfWidth + radius) continue;
    const dir = e.dir || 1;
    // 팔의 회전 방향 쪽 단위벡터
    const tx = -az * dir, tz = ax * dir;
    const side = Math.sign(perp * dir) || 1;
    // 팔 앞쪽으로 밀어낸다
    const push = SWEEPER.halfWidth + radius - Math.abs(perp);
    p.x += tx * side * (push + 0.02);
    p.z += tz * side * (push + 0.02);
    if (side > 0) {
      p.vx = tx * SWEEPER.push + ax * 2.5;
      p.vz = tz * SWEEPER.push + az * 2.5;
      p.vy = Math.max(p.vy, SWEEPER.pop);
      p.grounded = false;
      p.stun = Math.max(p.stun, SWEEPER.stun);
      p.dashT = 0;
      return true;
    }
  }
  return false;
}
