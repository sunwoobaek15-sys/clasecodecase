// 서버 측 AI 플레이어. 사람과 똑같이 입력만 만들어 물리 시뮬레이션에 넣는다.
import { groundAt, TILE, tileIndexAt, activeEvent, sweeperAngle } from '../../../shared/src/arena.js';
import { boxCenter } from '../../../shared/src/course.js';
import { BTN } from '../../../shared/src/messages.js';
import { SWEEPER } from '../../../shared/src/constants.js';

const _g = { h: 0, vx: 0, vz: 0, mover: -1 };

function safeAt(world, x, z, y) {
  groundAt(world, x, z, y + 0.5, _g);
  if (_g.h === -Infinity) return false;
  const ti = tileIndexAt(x, z);
  if (ti >= 0 && world.tiles[ti] === TILE.WARN) return false;
  return true;
}

export class BotBrain {
  constructor(rand = Math.random) {
    this.rand = rand;
    this.target = null;
    this.retargetIn = 0;
    this.wander = rand() * Math.PI * 2;
    this.jumpHold = 0;
    this.skill = 0.55 + rand() * 0.35;
  }

  think(self, others, world, dt) {
    const s = self.state;
    const out = { mx: 0, mz: 0, buttons: 0 };
    if (!s.alive) return out;

    this.retargetIn -= dt;
    if (this.retargetIn <= 0 || !this.target || !this.target.state.alive) {
      this.retargetIn = 1 + this.rand() * 1.5;
      let best = null, bestD = Infinity;
      for (const o of others) {
        if (o === self || !o.state.alive || !o.inMatch) continue;
        const d = Math.hypot(o.state.x - s.x, o.state.z - s.z) * (0.7 + this.rand() * 0.6);
        if (d < bestD) { bestD = d; best = o; }
      }
      this.target = best;
    }

    let dx = 0, dz = 0;
    if (this.target) {
      const t = this.target.state;
      dx = t.x - s.x; dz = t.z - s.z;
    } else {
      this.wander += (this.rand() - 0.5) * dt * 2;
      dx = Math.cos(this.wander); dz = Math.sin(this.wander);
    }
    const dist = Math.hypot(dx, dz) || 1;
    dx /= dist; dz /= dist;

    // 앞쪽 바닥이 위험하면 중앙 쪽으로 방향을 튼다
    const look = 2.2 + Math.hypot(s.vx, s.vz) * 0.25;
    if (!safeAt(world, s.x + dx * look, s.z + dz * look, s.y) || !safeAt(world, s.x + s.vx * 0.3, s.z + s.vz * 0.3, s.y)) {
      // 가장 가까운 안전한 방향 탐색
      let bestA = null, bestScore = -Infinity;
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const cx = Math.cos(a), cz = Math.sin(a);
        if (!safeAt(world, s.x + cx * 2.5, s.z + cz * 2.5, s.y)) continue;
        const ex = s.x + cx * 2.5, ez = s.z + cz * 2.5;
        const score = -(ex * ex + ez * ez) + (cx * dx + cz * dz) * 4;
        if (score > bestScore) { bestScore = score; bestA = a; }
      }
      if (bestA !== null) { dx = Math.cos(bestA); dz = Math.sin(bestA); }
      else { const r = Math.hypot(s.x, s.z) || 1; dx = -s.x / r; dz = -s.z / r; }
    }
    out.mx = dx; out.mz = dz;

    // 상대가 가깝고 정면이면 대시 공격
    this.dashWait = (this.dashWait ?? 1.5) - dt;
    if (this.target && s.grounded && this.dashWait <= 0 && dist < 3.6 && dist > 1.0 && this.rand() < 0.03 * this.skill) {
      this.dashWait = 1.2 + this.rand() * 1.8;
      const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
      const t = this.target.state;
      const tx = (t.x - s.x) / dist, tz = (t.z - s.z) / dist;
      if (fx * tx + fz * tz > 0.85 && safeAt(world, s.x + tx * 5, s.z + tz * 5, s.y)) out.buttons |= BTN.DASH;
    }

    // 회전 막대가 다가오면 점프
    const sw = activeEvent(world, 'sweeper');
    if (sw && s.grounded) {
      const r = Math.hypot(s.x, s.z);
      if (r > SWEEPER.r0 - 0.5 && r < SWEEPER.r1 + 0.5) {
        const base = sweeperAngle(sw, world.t);
        const pa = Math.atan2(s.z, s.x);
        for (let k = 0; k < 2; k++) {
          let d = (pa - (base + k * Math.PI)) * (sw.dir || 1);
          d = ((d % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
          const timeToHit = d / SWEEPER.speed;
          if (timeToHit < 0.32 + (1 - this.skill) * 0.1 && this.rand() < 0.5 + this.skill * 0.5) this.jumpHold = 0.35;
        }
      }
    }
    if (this.jumpHold > 0) { this.jumpHold -= dt; out.buttons |= BTN.JUMP; }
    return out;
  }
}

// ---------- 레이스 AI ----------
const _r = { h: 0, vx: 0, vz: 0, mover: -1 };
const BRIDGES = ['bridgeL', 'bridgeC', 'bridgeR'];

BotBrain.prototype.thinkRace = function thinkRace(self, others, world, dt) {
  const s = self.state;
  const out = { mx: 0, mz: 0, buttons: 0 };
  if (!s.alive) return out;
  const c = world.course;
  this.lane ??= (this.rand() - 0.5) * 3;
  this.bridge ??= BRIDGES[Math.floor(this.rand() * 3)];
  this.hesitate = Math.max(0, (this.hesitate || 0) - dt);

  let wp = c.path.find(([, z]) => z > s.z + 0.8) || c.path[c.path.length - 1];
  let tx = wp[0] + (s.z < 38 || (s.z > 56 && s.z < 80) ? this.lane : 0), tz = wp[1];
  // 움직이는 발판 구간: 바로 앞 발판을 노린다
  if (s.z > 37 && s.z < 56) {
    let best = null;
    for (const b of c.boxes) {
      if (!b.move || b.z < 40 || b.z > 56 || b.z - b.d < s.z - 0.3) continue;
      if (!best || b.z < best.z) best = b;
    }
    if (best) { const ctr = boxCenter(best, world.t + 0.35, {}); tx = ctr.x; tz = best.z; }
    else { tx = 0; tz = 58; }
  }
  // 다리 구간: 고른 다리를 따라간다
  if (s.z > 103 && s.z < 123) {
    const b = c.boxes.find((q) => q.id === this.bridge);
    const ctr = boxCenter(b, world.t + 0.2, {});
    tx = ctr.x; tz = s.z > 121 ? 128 : 123;
  }
  let dx = tx - s.x, dz = tz - s.z;
  const dl = Math.hypot(dx, dz) || 1;
  dx /= dl; dz /= dl;

  const speed = Math.hypot(s.vx, s.vz);
  const look = 0.9 + speed * 0.1;
  groundAt(world, s.x + dx * look, s.z + dz * look, s.y + 0.6, _r);
  const gapAhead = _r.h === -Infinity || _r.h < s.y - 1.5;
  const wallAhead = _r.h !== -Infinity && _r.h > s.y + 0.45;
  let jump = false;
  if (s.grounded && gapAhead) {
    // 착지 지점이 있을 때만 점프, 아니면 가장자리에서 기다린다
    const saved = world.t;
    world.t = saved + 0.45;
    let landing = false;
    for (const dist of [2.6, 3.4, 4.2]) {
      groundAt(world, s.x + dx * dist, s.z + dz * dist, s.y + 0.8, _r);
      if (_r.h !== -Infinity && _r.h > s.y - 1.2 && _r.h < s.y + 1.2) { landing = true; break; }
    }
    world.t = saved;
    if (landing && this.hesitate <= 0) jump = true;
    else { dx *= 0.05; dz *= 0.05; if (!this.hesitate) this.hesitate = 0.1 + this.rand() * 0.3 * (1 - this.skill); }
  } else if (s.grounded && wallAhead && _r.h < s.y + 1.6) jump = true;

  // 회전 막대 피하기
  for (const sw of c.sweepers) {
    const rx = s.x - sw.x, rz = s.z - sw.z;
    const r = Math.hypot(rx, rz);
    if (r < sw.r0 || r > sw.r1 + 0.6 || !s.grounded) continue;
    const pa = Math.atan2(rz, rx);
    const base = world.t * sw.speed * sw.dir + sw.phase;
    for (let k = 0; k < 2; k++) {
      let d = (pa - (base + k * Math.PI)) * sw.dir;
      d = ((d % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      if (d / sw.speed < 0.3 && this.rand() < 0.4 + this.skill * 0.6) jump = true;
    }
  }
  if (jump) this.jumpHold = 0.33;
  out.mx = dx; out.mz = dz;
  if (this.jumpHold > 0) { this.jumpHold -= dt; out.buttons |= BTN.JUMP; }

  // 가까운 상대에게 몸통 박치기
  this.dashWait = (this.dashWait ?? 2) - dt;
  if (s.grounded && this.dashWait <= 0 && !gapAhead) {
    for (const o of others) {
      if (o === self || !o.state.alive) continue;
      const ox = o.state.x - s.x, oz = o.state.z - s.z;
      const od = Math.hypot(ox, oz);
      if (od < 3 && od > 0.8 && (ox * Math.sin(s.yaw) + oz * Math.cos(s.yaw)) / od > 0.8 && this.rand() < 0.04 * this.skill) {
        out.buttons |= BTN.DASH;
        this.dashWait = 2 + this.rand() * 2;
        break;
      }
    }
  }
  return out;
};

// ---------- 방해꾼(번개 구름) AI ----------
export class GhostBrain {
  constructor(rand = Math.random) {
    this.rand = rand;
    this.target = null;
    this.retarget = 0;
    this.delay = 1 + rand() * 2;
  }

  think(g, players, world, dt) {
    const out = { mx: 0, mz: 0, buttons: 0 };
    this.retarget -= dt;
    this.delay -= dt;
    if (this.retarget <= 0 || !this.target || !this.target.state.alive) {
      const alive = players.filter((p) => p.state.alive);
      // 레이스에서는 선두를 노리는 경향
      alive.sort((a, b) => b.state.z - a.state.z);
      this.target = alive.length ? alive[Math.floor(this.rand() ** 2 * alive.length)] : null;
      this.retarget = 3 + this.rand() * 3;
    }
    if (!this.target) return out;
    const t = this.target.state;
    const tx = t.x + t.vx * 0.8, tz = t.z + t.vz * 0.8;
    const dx = tx - g.x, dz = tz - g.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.4) { out.mx = dx / Math.max(d, 1); out.mz = dz / Math.max(d, 1); }
    if (d < 1.4 && g.cd <= 0 && this.delay <= 0) { out.buttons |= BTN.DASH; this.delay = 1.5 + this.rand() * 3; }
    return out;
  }
}
