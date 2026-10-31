// 서버 측 AI 플레이어. 사람과 똑같이 입력만 만들어 물리 시뮬레이션에 넣는다.
import { groundAt, TILE, tileIndexAt, activeEvent, sweeperAngle } from '../../../shared/src/arena.js';
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
    if (this.target && s.grounded && dist < 3.6 && dist > 1.0 && this.rand() < 0.05 * this.skill) {
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
