// 레이스 코스 정의와 지형 질의. 박스(정지/이동/경사), 회전 막대, 범퍼, 체크포인트, 결승선.
// 서버 물리와 클라이언트 예측·렌더링이 같은 데이터를 쓴다.
import { PHYS } from './constants.js';

// 박스: 중심(x,z), 반폭(w,d), 바닥 y0, 윗면 y1. ramp가 있으면 z 방향으로 윗면 높이가 변한다.
// move가 있으면 x/z = 중심 + a * sin(t * speed + phase)
export const RACE = {
  name: 'race',
  finishZ: 126,
  timeLimit: 150,
  bounds: { x0: -10, x1: 10, z0: -7, z1: 140 },
  boxes: [
    { id: 'start', x: 0, z: 0, w: 7, d: 6, y0: -1.2, y1: 0, color: 0x9b8cff },
    { id: 'bumpfield', x: 0, z: 23, w: 6, d: 17, y0: -1.2, y1: 0, color: 0x6fe3c4 },
    { id: 'mv1', x: 0, z: 43.5, w: 1.8, d: 1.8, y0: -0.6, y1: 0, color: 0xffd23f, move: { ax: 4, az: 0, speed: 1.1, phase: 0 } },
    { id: 'mv2', x: 0, z: 48, w: 1.8, d: 1.8, y0: -0.6, y1: 0, color: 0xff9a3c, move: { ax: 4, az: 0, speed: 1.1, phase: 2.1 } },
    { id: 'mv3', x: 0, z: 52.5, w: 1.8, d: 1.8, y0: -0.6, y1: 0, color: 0xffd23f, move: { ax: 4, az: 0, speed: 1.1, phase: 4.2 } },
    { id: 'spin', x: 0, z: 68, w: 7, d: 12, y0: -1.2, y1: 0, color: 0xff8fa8 },
    { id: 'ramp', x: 0, z: 86, w: 5, d: 6, y0: -1.2, y1: 3, ramp: { h0: 0, h1: 3 }, color: 0x5ec8ff },
    { id: 'deck', x: 0, z: 99, w: 7, d: 7, y0: 1.8, y1: 3, color: 0xa66bff },
    { id: 'piston1', x: 0, z: 95.5, w: 1.1, d: 1.1, y0: 3, y1: 5, color: 0xff4d6d, wall: true, move: { ax: 5.6, az: 0, speed: 1.25, phase: 0 } },
    { id: 'piston2', x: 0, z: 99.5, w: 1.1, d: 1.1, y0: 3, y1: 5, color: 0xff4d6d, wall: true, move: { ax: 5.6, az: 0, speed: 1.25, phase: 2.2 } },
    { id: 'piston3', x: 0, z: 103.5, w: 1.1, d: 1.1, y0: 3, y1: 5, color: 0xff4d6d, wall: true, move: { ax: 5.6, az: 0, speed: 1.25, phase: 4.4 } },
    { id: 'bridgeL', x: -4, z: 114, w: 0.95, d: 8, y0: 2.5, y1: 3, color: 0xffd23f, move: { ax: 1.1, az: 0, speed: 1.6, phase: 0 } },
    { id: 'bridgeC', x: 0, z: 114, w: 0.75, d: 8, y0: 2.5, y1: 3, color: 0x52d273 },
    { id: 'bridgeR', x: 4, z: 114, w: 0.95, d: 8, y0: 2.5, y1: 3, color: 0xffd23f, move: { ax: 1.1, az: 0, speed: 1.6, phase: 3.1 } },
    { id: 'finish', x: 0, z: 131, w: 8, d: 9, y0: 1.8, y1: 3, color: 0xffd84f },
  ],
  // 범퍼: 닿으면 튕겨낸다 (push=0이면 단순 기둥)
  bumpers: [
    { x: -3, z: 14, r: 1.0, top: 1.6, push: 12 },
    { x: 3, z: 18, r: 1.0, top: 1.6, push: 12 },
    { x: 0, z: 24, r: 1.1, top: 1.6, push: 12 },
    { x: -3.6, z: 29, r: 1.0, top: 1.6, push: 12 },
    { x: 3.6, z: 31, r: 1.0, top: 1.6, push: 12 },
    { x: 0, z: 36, r: 1.0, top: 1.6, push: 12 },
    { x: 0, z: 62, r: 0.6, top: 1.5, push: 4 },
    { x: 0, z: 74, r: 0.6, top: 1.5, push: 4 },
  ],
  sweepers: [
    { x: 0, z: 62, base: 0, r0: 0.6, r1: 6.6, y0: 0.2, y1: 0.95, half: 0.3, speed: 1.5, dir: 1, phase: 0 },
    { x: 0, z: 74, base: 0, r0: 0.6, r1: 6.6, y0: 0.2, y1: 0.95, half: 0.3, speed: 1.5, dir: -1, phase: 1.2 },
  ],
  checkpoints: [
    { z: -99, x: 0, sz: 0, y: 0 },
    // 움직이는 발판 직전: 여기서 떨어져도 출발선까지 돌아가지 않는다
    { z: 38, x: 0, sz: 38.6, y: 0 },
    { z: 56, x: 0, sz: 57.5, y: 0 },
    { z: 80, x: 0, sz: 79, y: 0 },
    { z: 106, x: 0, sz: 105, y: 3 },
  ],
  // 봇 경로점
  path: [[0, 8], [0, 39.5], [0, 57], [0, 80], [0, 92.5], [0, 106], [0, 123], [0, 128]],
};

export function boxCenter(b, t, out) {
  if (b.move) {
    const s = Math.sin(t * b.move.speed + b.move.phase);
    const c = Math.cos(t * b.move.speed + b.move.phase);
    out.x = b.x + b.move.ax * s;
    out.z = b.z + b.move.az * s;
    out.vx = b.move.ax * c * b.move.speed;
    out.vz = b.move.az * c * b.move.speed;
  } else {
    out.x = b.x; out.z = b.z; out.vx = 0; out.vz = 0;
  }
  return out;
}

export function boxTop(b, z) {
  if (!b.ramp) return b.y1;
  const k = Math.min(1, Math.max(0, (z - (b.z - b.d)) / (b.d * 2)));
  return b.ramp.h0 + (b.ramp.h1 - b.ramp.h0) * k;
}

const _c = { x: 0, z: 0, vx: 0, vz: 0 };

export function courseGroundAt(course, world, x, z, y, out) {
  out.h = -Infinity; out.vx = 0; out.vz = 0; out.mover = -1;
  const boxes = course.boxes;
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    boxCenter(b, world.t, _c);
    if (Math.abs(x - _c.x) > b.w || Math.abs(z - _c.z) > b.d) continue;
    const top = boxTop(b, z);
    const tol = b.move ? PHYS.stepUp + 0.2 : PHYS.stepUp;
    if (y >= top - tol && top > out.h) {
      out.h = top;
      out.vx = _c.vx; out.vz = _c.vz;
      out.mover = b.move ? i : -1;
    }
  }
  for (const m of course.bumpers) {
    const dx = x - m.x, dz = z - m.z;
    if (dx * dx + dz * dz <= m.r * m.r && y >= m.top - PHYS.stepUp && m.top > out.h) { out.h = m.top; out.vx = 0; out.vz = 0; out.mover = -1; }
  }
  return out;
}

/** 박스 옆면에 막히거나 움직이는 벽(피스톤)에 밀린다 */
export function coursePushOut(course, world, p, radius) {
  for (const b of course.boxes) {
    boxCenter(b, world.t, _c);
    const top = boxTop(b, p.z);
    if (p.y >= top - PHYS.stepUp || p.y + PHYS.height <= b.y0) continue;
    const dx = p.x - _c.x, dz = p.z - _c.z;
    const px = b.w + radius - Math.abs(dx), pz = b.d + radius - Math.abs(dz);
    if (px <= 0 || pz <= 0) continue;
    if (px < pz) {
      const s = Math.sign(dx) || 1;
      p.x += s * px;
      if (p.vx * s < 0) p.vx = 0;
      // 움직이는 벽에 밀리면 벽 속도를 받는다
      if (_c.vx * s > 0) p.vx = Math.max(p.vx * s, _c.vx * s * 1.4) * s;
    } else {
      const s = Math.sign(dz) || 1;
      p.z += s * pz;
      if (p.vz * s < 0) p.vz = 0;
      if (_c.vz * s > 0) p.vz = Math.max(p.vz * s, _c.vz * s * 1.4) * s;
    }
  }
}

/** 범퍼·회전 막대 충돌. 맞으면 true */
export function courseHazards(course, world, p, radius) {
  let hit = false;
  for (const m of course.bumpers) {
    if (p.y >= m.top - PHYS.stepUp || p.y + PHYS.height < 0) continue;
    const dx = p.x - m.x, dz = p.z - m.z;
    const minD = m.r + radius;
    const d2 = dx * dx + dz * dz;
    if (d2 >= minD * minD) continue;
    const d = Math.sqrt(d2) || 1e-4;
    const nx = dx / d, nz = dz / d;
    p.x = m.x + nx * minD; p.z = m.z + nz * minD;
    const vn = p.vx * nx + p.vz * nz;
    if (m.push > 0) {
      p.vx += nx * (m.push - Math.min(0, vn)); p.vz += nz * (m.push - Math.min(0, vn));
      p.vy = Math.max(p.vy, 3.5);
      p.grounded = false; p.mover = -1; p.jumping = false; p.jumpCut = false;
      p.stun = Math.max(p.stun, 0.35);
      p.dashT = 0;
      hit = true;
    } else if (vn < 0) { p.vx -= vn * nx; p.vz -= vn * nz; }
  }
  for (const s of course.sweepers) {
    // 방금 막대에 맞았으면 잠시 막대와 상호작용하지 않는다 (연속 피격 방지)
    if (p.hitCd > 0) break;
    const ly = p.y - s.base;
    if (ly > s.y1 || ly + PHYS.height < s.y0) continue;
    const base = world.t * s.speed * s.dir + s.phase;
    const rx = p.x - s.x, rz = p.z - s.z;
    for (let k = 0; k < 2; k++) {
      const a = base + k * Math.PI;
      const ax = Math.cos(a), az = Math.sin(a);
      const along = rx * ax + rz * az;
      if (along < s.r0 || along > s.r1 + radius) continue;
      const perp = -rx * az + rz * ax;
      if (Math.abs(perp) > s.half + radius) continue;
      const tx = -az * s.dir, tz = ax * s.dir;
      const side = Math.sign(perp * s.dir) || 1;
      const push = s.half + radius - Math.abs(perp);
      p.x += tx * side * (push + 0.02); p.z += tz * side * (push + 0.02);
      if (side > 0) {
        // 레이스에서는 맞아도 코스 밖으로 바로 날아가지 않을 정도로만 밀어낸다 (연속 피격은 hitCd로 방지)
        const sp = 3 + along * s.speed * 0.7;
        p.vx = tx * sp + ax * 1.5; p.vz = tz * sp + az * 1.5;
        p.vy = Math.max(p.vy, 7.4);
        p.hitCd = 1.0;
        p.grounded = false; p.mover = -1; p.jumping = false; p.jumpCut = false;
        p.stun = Math.max(p.stun, 0.45);
        p.dashT = 0;
        hit = true;
      }
    }
  }
  return hit;
}

export function checkpointFor(course, z) {
  let cp = 0;
  for (let i = 0; i < course.checkpoints.length; i++) if (z >= course.checkpoints[i].z) cp = i;
  return cp;
}
