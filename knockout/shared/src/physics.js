// 캐릭터 이동/점프/대시 물리와 플레이어 간 충돌·넉백.
// stepPlayer는 서버(권위)와 클라이언트(예측)가 동일하게 실행한다.
import { PHYS, KNOCK, WIND } from './constants.js';
import { BTN } from './messages.js';
import { groundAt, pushOutWalls, sweeperHit, windVector } from './arena.js';

export const EV = { JUMP: 1, LAND: 2, DASH: 4, SWEPT: 8, FELL: 16 };

export function createPlayerState(x = 0, z = 0, yaw = 0) {
  return {
    x, y: 0, z, vx: 0, vy: 0, vz: 0, yaw,
    grounded: true, dashT: 0, dashCd: 0, stun: 0,
    coyote: 0, jumpBuf: 0, jumpHeld: false, jumpCut: false,
    alive: true, mover: -1, landSpeed: 0,
  };
}

const _g = { h: 0, vx: 0, vz: 0, mover: -1 };
const _w = { x: 0, z: 0 };

function angleLerp(a, b, k) {
  let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * Math.min(1, k);
}

/**
 * 플레이어 한 명을 dt만큼 진행한다.
 * input: { mx, mz, buttons } — mx/mz는 월드 기준 이동 방향 (길이 ≤ 1)
 * 반환: EV 비트마스크
 */
export function stepPlayer(p, input, dt, world) {
  let ev = 0;
  if (!p.alive) return 0;

  let mx = input.mx || 0, mz = input.mz || 0;
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }
  const hasMove = len > 0.08;
  const jump = (input.buttons & BTN.JUMP) !== 0;
  const dash = (input.buttons & BTN.DASH) !== 0;

  p.dashCd = Math.max(0, p.dashCd - dt);
  p.stun = Math.max(0, p.stun - dt);
  const control = p.stun > 0 ? PHYS.stunControl : 1;

  // 대시
  if (dash && p.dashCd <= 0 && p.stun < 0.15 && p.dashT <= 0) {
    let dx = mx, dz = mz;
    if (!hasMove) { dx = Math.sin(p.yaw); dz = Math.cos(p.yaw); }
    const dl = Math.hypot(dx, dz) || 1;
    dx /= dl; dz /= dl;
    p.vx = dx * PHYS.dashSpeed;
    p.vz = dz * PHYS.dashSpeed;
    if (p.vy < 0) p.vy *= 0.3;
    p.dashT = PHYS.dashTime;
    p.dashCd = PHYS.dashCooldown;
    p.yaw = Math.atan2(dx, dz);
    ev |= EV.DASH;
  }

  if (p.dashT > 0) {
    p.dashT = Math.max(0, p.dashT - dt);
    if (p.vy < -1.5) p.vy = -1.5; // 공중 대시는 살짝 떠간다
  } else {
    const speed = Math.hypot(p.vx, p.vz);
    if (speed > PHYS.moveSpeed * 1.05) {
      // 넉백/대시 이후 미끄러짐 — 마찰로 서서히 감속
      const k = p.grounded ? PHYS.slideFrictionGround : PHYS.slideFrictionAir;
      const f = Math.exp(-k * dt);
      p.vx *= f; p.vz *= f;
      const steer = PHYS.airAccel * control * dt;
      p.vx += mx * steer; p.vz += mz * steer;
    } else {
      const tx = mx * PHYS.moveSpeed, tz = mz * PHYS.moveSpeed;
      const acc = (p.grounded ? (hasMove ? PHYS.groundAccel : PHYS.groundDecel) : PHYS.airAccel) * control;
      const dvx = tx - p.vx, dvz = tz - p.vz;
      const dl = Math.hypot(dvx, dvz);
      const maxDv = acc * dt;
      if (dl <= maxDv) { p.vx = tx; p.vz = tz; } else { p.vx += (dvx / dl) * maxDv; p.vz += (dvz / dl) * maxDv; }
    }
    if (hasMove && p.stun <= 0) p.yaw = angleLerp(p.yaw, Math.atan2(mx, mz), PHYS.turnRate * dt);
  }

  // 점프 (버퍼 + 코요테 타임 + 가변 높이)
  if (jump && !p.jumpHeld) p.jumpBuf = PHYS.jumpBuffer;
  else p.jumpBuf = Math.max(0, p.jumpBuf - dt);
  p.coyote = p.grounded ? PHYS.coyoteTime : Math.max(0, p.coyote - dt);
  if (p.jumpBuf > 0 && p.coyote > 0 && p.stun < 0.2) {
    p.vy = PHYS.jumpVel;
    p.grounded = false;
    p.coyote = 0;
    p.jumpBuf = 0;
    p.jumpCut = false;
    p.mover = -1;
    ev |= EV.JUMP;
  }
  if (!jump && p.vy > 0) p.jumpCut = true;
  p.jumpHeld = jump;

  // 바람: 공중에서는 가속, 지면에서는 마찰과 무관한 일정한 표류
  windVector(world, _w);
  if (!p.grounded) { p.vx += _w.x * WIND.airAccel * dt; p.vz += _w.z * WIND.airAccel * dt; }

  // 중력
  if (!p.grounded) {
    let g = PHYS.gravity;
    if (p.vy < 0) g *= PHYS.fallGravityMul;
    else if (p.jumpCut) g *= PHYS.jumpCutMul;
    p.vy -= g * dt;
    if (p.vy < -40) p.vy = -40;
  }

  // 움직이는 발판 운반
  let carryX = 0, carryZ = 0;
  if (p.grounded && p.mover >= 0) {
    groundAt(world, p.x, p.z, p.y, _g);
    if (_g.mover === p.mover) { carryX = _g.vx; carryZ = _g.vz; }
  }

  if (p.grounded) { carryX += _w.x * WIND.groundDrift; carryZ += _w.z * WIND.groundDrift; }

  const px = p.x, pz = p.z;
  p.x += (p.vx + carryX) * dt;
  p.z += (p.vz + carryZ) * dt;
  p.y += p.vy * dt;

  if (p.y > PHYS.belowFloorY) pushOutWalls(world, p, PHYS.radius);
  if (sweeperHit(world, p, PHYS.radius)) ev |= EV.SWEPT;

  // 지면 판정
  if (p.y > PHYS.belowFloorY) {
    groundAt(world, p.x, p.z, p.y, _g);
    if (p.grounded) {
      if (_g.h !== -Infinity && _g.h >= p.y - PHYS.snapDown && _g.h <= p.y + PHYS.stepUp) {
        p.y = _g.h;
        p.vy = 0;
        p.mover = _g.mover;
      } else {
        p.grounded = false;
        p.mover = -1;
      }
    } else if (p.vy <= 0 && _g.h !== -Infinity && p.y <= _g.h && p.y >= _g.h - 0.6) {
      p.landSpeed = -p.vy;
      p.y = _g.h;
      p.vy = 0;
      p.grounded = true;
      p.jumpCut = false;
      p.mover = _g.mover;
      ev |= EV.LAND;
    } else if (_g.h !== -Infinity && p.y < _g.h - 0.6) {
      // 바닥 판 내부로 파고드는 것을 막는다 (가장자리 아래에서 다시 올라오는 경우)
      p.x = px; p.z = pz;
      p.vx *= -0.2; p.vz *= -0.2;
    }
  } else {
    p.grounded = false;
    p.mover = -1;
  }

  if (p.y < PHYS.elimY) {
    p.alive = false;
    ev |= EV.FELL;
  }
  return ev;
}

/**
 * 모든 플레이어 쌍의 충돌을 해결한다 (서버 권위).
 * pairCd: Map<string, number> — 쌍별 넉백 쿨다운
 * onHit(a, b, power, x, y, z)
 */
export function resolvePlayerCollisions(players, pairCd, dt, onHit) {
  for (const [k, v] of pairCd) {
    if (v - dt <= 0) pairCd.delete(k); else pairCd.set(k, v - dt);
  }
  const R2 = PHYS.radius * 2;
  for (let i = 0; i < players.length; i++) {
    const a = players[i];
    if (!a.alive) continue;
    for (let j = i + 1; j < players.length; j++) {
      const b = players[j];
      if (!b.alive) continue;
      if (Math.abs(a.y - b.y) > PHYS.height * 0.85) continue;
      let dx = b.x - a.x, dz = b.z - a.z;
      let d = Math.hypot(dx, dz);
      if (d >= R2) continue;
      if (d < 1e-4) { dx = Math.sin(i * 7.1 + j); dz = Math.cos(i * 7.1 + j); d = 1; }
      const nx = dx / d, nz = dz / d;
      const overlap = R2 - Math.min(d, R2);
      a.x -= nx * overlap * 0.5; a.z -= nz * overlap * 0.5;
      b.x += nx * overlap * 0.5; b.z += nz * overlap * 0.5;

      const van = a.vx * nx + a.vz * nz;
      const vbn = b.vx * nx + b.vz * nz;
      const closing = van - vbn;
      const key = a.key < b.key ? a.key + '|' + b.key : b.key + '|' + a.key;
      const aDash = a.dashT > 0, bDash = b.dashT > 0;
      if (pairCd.has(key) || (closing < KNOCK.minClosing && !aDash && !bDash)) {
        // 부드러운 접촉: 서로 파고드는 속도만 제거
        if (closing > 0) {
          const m = closing * 0.5;
          a.vx -= nx * m; a.vz -= nz * m;
          b.vx += nx * m; b.vz += nz * m;
        }
        continue;
      }
      pairCd.set(key, KNOCK.pairCooldown);

      // 각자 상대를 향해 들고 온 운동량으로 상대를 민다
      const aPush = Math.max(0, van), bPush = Math.max(0, -vbn);
      let toB = KNOCK.baseBump + aPush * KNOCK.speedFactor + (aDash ? KNOCK.dashBonus : 0);
      let toA = KNOCK.baseBump + bPush * KNOCK.speedFactor + (bDash ? KNOCK.dashBonus : 0);
      // 대시 공격자는 반동이 작다
      if (aDash && !bDash) toA *= KNOCK.dashRecoil;
      if (bDash && !aDash) toB *= KNOCK.dashRecoil;
      if (!b.grounded) toB *= KNOCK.airBonus;
      if (!a.grounded) toA *= KNOCK.airBonus;

      // 법선 방향 속도를 교환(반발) 후 넉백을 더한다
      const e = KNOCK.restitution;
      const vaN = (van + vbn) * 0.5 - (van - vbn) * 0.5 * e;
      const vbN = (van + vbn) * 0.5 + (van - vbn) * 0.5 * e;
      a.vx += (vaN - van) * nx - nx * toA; a.vz += (vaN - van) * nz - nz * toA;
      b.vx += (vbN - vbn) * nx + nx * toB; b.vz += (vbN - vbn) * nz + nz * toB;

      applyHitReaction(a, toA);
      applyHitReaction(b, toB);
      if (aDash) a.dashT = 0;
      if (bDash) b.dashT = 0;
      if (onHit) onHit(a, b, Math.max(toA, toB), (a.x + b.x) / 2, (a.y + b.y) / 2 + 0.8, (a.z + b.z) / 2, aDash || bDash);
    }
  }
}

function applyHitReaction(p, power) {
  const pop = Math.min(KNOCK.popMax, KNOCK.popBase + power * KNOCK.popFactor);
  if (p.grounded) {
    p.vy = pop;
    p.grounded = false;
    p.mover = -1;
  } else {
    p.vy = Math.max(p.vy, pop * 0.6);
  }
  p.stun = Math.max(p.stun, Math.min(KNOCK.stunMax, KNOCK.stunBase + power * KNOCK.stunFactor));
}
