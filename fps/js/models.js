/* SECTOR ZERO — 모델: 적 로봇, 손에 든 총, 아이템을 상자 조각으로 그립니다 */
(function (root) {
  'use strict';
  const SZ = (root.SZ = root.SZ || {});
  const { m4 } = SZ.math;

  const M = m4.create();
  const P = m4.create();
  const Q = m4.create();

  let R = null; // 렌더러

  /** 부모 행렬 base 안에서 (x,y,z)에 크기 (sx,sy,sz) 상자 */
  function part(base, x, y, z, sx, sy, sz, tex, tint, emit, spec, rx, ry, rz) {
    m4.copy(M, base);
    m4.translate(M, x, y, z);
    if (ry) m4.rotateY(M, ry);
    if (rx) m4.rotateX(M, rx);
    if (rz) m4.rotateZ(M, rz);
    m4.scale(M, sx, sy, sz);
    R.box(M, tex, tint, emit, spec === undefined ? 0.4 : spec, 0);
  }
  /** 빛나는 조각 (색 = 빛 색, k = 밝기 비율, extra = 더 밝게 더할 빛) */
  function lightPart(base, x, y, z, sx, sy, sz, col, k, extra) {
    m4.copy(M, base);
    m4.translate(M, x, y, z);
    m4.scale(M, sx, sy, sz);
    const c = k === undefined || k === 1 ? col : [col[0] * k, col[1] * k, col[2] * k];
    R.box(M, 'white', c, extra || null, 0, 1);
  }

  const add = (a, b) => (a ? (b ? [a[0] + b[0], a[1] + b[1], a[2] + b[2]] : a) : b);

  /* ---------------- 적 ---------------- */

  /** 적 공통 빛: 맞았을 때 하얗게, 나타날 때 청록색 */
  function flashOf(e) {
    let em = null;
    if (e.flash > 0) em = [e.flash * 6, e.flash * 6, e.flash * 6];
    if (e.spawnT < 1) em = add(em, [0.1 * (1 - e.spawnT), 0.9 * (1 - e.spawnT), 1.2 * (1 - e.spawnT)]);
    return em;
  }

  function drone(e, t) {
    const em = flashOf(e);
    const grow = Math.min(1, e.spawnT * 1.3);
    m4.identity(P);
    m4.translate(P, e.x, e.y, e.z);
    m4.rotateY(P, e.yaw);
    m4.rotateX(P, e.tilt || 0);
    m4.rotateZ(P, e.roll || 0);
    m4.scale(P, grow, grow, grow);
    const hull = [0.34, 0.36, 0.4], dark = [0.14, 0.15, 0.17];
    part(P, 0, 0, 0, 0.7, 0.42, 0.7, 'metal', hull, em, 0.7);
    part(P, 0, 0.26, 0.05, 0.46, 0.12, 0.46, 'metal', [0.24, 0.26, 0.3], em, 0.6);
    part(P, 0, -0.25, 0, 0.36, 0.1, 0.36, 'metal', dark, em, 0.4);
    part(P, 0, 0.02, -0.355, 0.36, 0.26, 0.06, 'metal', [0.07, 0.07, 0.08], em, 0.8);
    const charge = e.windup > 0 ? 1.4 : 0;
    const pulse = 0.5 + Math.sin(t * 6 + e.seed) * 0.25 + charge;
    lightPart(P, 0, 0.02, -0.39, 0.2, 0.1, 0.02, [1, 0.18, 0.12], 1, [pulse, pulse * 0.15, 0]);
    for (const s of [-1, 1]) {
      part(P, s * 0.47, 0, 0.02, 0.2, 0.26, 0.52, 'metal', [0.27, 0.29, 0.33], em, 0.6);
      lightPart(P, s * 0.47, -0.14, 0.02, 0.12, 0.03, 0.34, [1, 0.5, 0.15]);
    }
    part(P, 0.16, 0.42, 0.16, 0.025, 0.26, 0.025, 'metal', dark, em, 0.3);
    lightPart(P, 0.16, 0.56, 0.16, 0.04, 0.04, 0.04, [1, 0.2, 0.15], 0.6 + 0.4 * Math.sin(t * 9 + e.seed));
  }

  function runner(e, t) {
    const em = flashOf(e);
    const grow = Math.min(1, e.spawnT * 1.3);
    m4.identity(P);
    m4.translate(P, e.x, e.y, e.z);
    m4.rotateY(P, e.yaw);
    m4.scale(P, grow, grow, grow);
    const body = [0.3, 0.31, 0.33], dark = [0.13, 0.13, 0.15], joint = [0.2, 0.2, 0.22];
    const ph = e.phase || 0;
    const stride = Math.min(1, e.moveAmt || 0);
    for (const s of [-1, 1]) {
      const p = ph + (s > 0 ? 0 : Math.PI);
      m4.copy(Q, P);
      m4.translate(Q, s * 0.16, 0.92, 0);
      m4.rotateX(Q, Math.sin(p) * 0.75 * stride);
      part(Q, 0, -0.23, 0, 0.15, 0.48, 0.17, 'metal', joint, em, 0.4);
      m4.translate(Q, 0, -0.45, 0);
      m4.rotateX(Q, -(Math.max(0, Math.cos(p)) * 0.9 * stride) - 0.15);
      part(Q, 0, -0.22, 0, 0.12, 0.46, 0.12, 'metal', body, em, 0.5);
      part(Q, 0, -0.45, -0.06, 0.15, 0.06, 0.26, 'metal', dark, em, 0.3);
    }
    part(P, 0, 0.92, 0, 0.46, 0.2, 0.32, 'metal', dark, em, 0.4);
    m4.copy(Q, P);
    m4.translate(Q, 0, 1.0, 0);
    m4.rotateX(Q, -0.32 - (e.swing || 0) * 0.25);
    part(Q, 0, 0.26, 0, 0.58, 0.52, 0.42, 'metal', body, em, 0.6);
    part(Q, 0, 0.3, 0.2, 0.42, 0.36, 0.08, 'metal', dark, em, 0.4);
    lightPart(Q, 0, 0.32, -0.215, 0.18, 0.06, 0.02, [1, 0.2, 0.12]);
    // 팔과 칼날: 공격할 때 앞으로 휘둘러요
    const swing = e.swing || 0;
    for (const s of [-1, 1]) {
      m4.copy(Q, P);
      m4.translate(Q, s * 0.38, 1.38, -0.05);
      m4.rotateX(Q, -0.5 * swing * 2.2 + Math.sin(ph + (s > 0 ? Math.PI : 0)) * 0.35 * stride + 0.25);
      part(Q, 0, -0.24, 0, 0.11, 0.5, 0.13, 'metal', joint, em, 0.5);
      part(Q, 0, -0.56, -0.07, 0.035, 0.36, 0.17, 'metal', [0.7, 0.72, 0.75], add(em, swing > 0 ? [swing * 0.8, 0.05, 0] : null), 0.9);
    }
    part(P, 0, 1.62, -0.12, 0.34, 0.26, 0.38, 'metal', [0.22, 0.23, 0.25], em, 0.6);
    part(P, 0, 1.63, -0.315, 0.3, 0.09, 0.02, 'metal', [0.06, 0.06, 0.07], em, 0.9);
    lightPart(P, 0, 1.63, -0.33, 0.22, 0.03, 0.015, [1, 0.15, 0.1]);
  }

  function brute(e, t) {
    const em = flashOf(e);
    const grow = Math.min(1, e.spawnT * 1.3);
    m4.identity(P);
    m4.translate(P, e.x, e.y, e.z);
    m4.rotateY(P, e.yaw);
    m4.scale(P, grow, grow, grow);
    const paint = [0.46, 0.38, 0.16], dark = [0.15, 0.15, 0.16], steel = [0.32, 0.33, 0.35];
    const ph = e.phase || 0;
    const stride = Math.min(1, e.moveAmt || 0);
    for (const s of [-1, 1]) {
      m4.copy(Q, P);
      m4.translate(Q, s * 0.36, 0.98, 0);
      m4.rotateX(Q, Math.sin(ph + (s > 0 ? 0 : Math.PI)) * 0.35 * stride);
      part(Q, 0, -0.47, 0, 0.36, 0.95, 0.42, 'metal', steel, em, 0.5);
      part(Q, 0, -0.93, -0.08, 0.42, 0.1, 0.6, 'metal', dark, em, 0.3);
    }
    const bob = Math.abs(Math.sin(ph)) * 0.04 * stride;
    part(P, 0, 0.98 + bob, 0, 0.95, 0.28, 0.6, 'metal', dark, em, 0.4);
    part(P, 0, 1.56 + bob, 0, 1.25, 0.9, 0.85, 'metal', paint, em, 0.45);
    part(P, 0, 1.55 + bob, -0.44, 0.8, 0.5, 0.06, 'metal', [0.3, 0.25, 0.1], em, 0.5);
    lightPart(P, 0, 1.75 + bob, -0.475, 0.5, 0.05, 0.02, [1, 0.55, 0.1], 0.8);
    for (const s of [-1, 1]) {
      part(P, s * 0.82, 1.93 + bob, 0, 0.5, 0.36, 0.95, 'metal', paint, em, 0.5);
      m4.copy(Q, P);
      m4.translate(Q, s * 0.86, 1.48 + bob, 0);
      m4.rotateX(Q, e.aimPitch || 0);
      part(Q, 0, 0, -0.25, 0.32, 0.32, 0.95, 'metal', steel, em, 0.6);
      part(Q, 0, 0, -0.62, 0.38, 0.38, 0.12, 'metal', dark, em, 0.5);
      const glow = e.windup > 0 ? 2.2 : 0.5;
      R.box(m4.scale(m4.translate(m4.copy(M, Q), 0, 0, -0.69), 0.18, 0.18, 0.03), 'white', [1, 0.5, 0.1], [glow * 0.6, glow * 0.25, 0], 0, 1);
    }
    part(P, 0, 2.2 + bob, -0.1, 0.5, 0.38, 0.5, 'metal', steel, em, 0.6);
    lightPart(P, 0, 2.22 + bob, -0.36, 0.38, 0.08, 0.02, [1, 0.45, 0.08]);
  }

  const ENEMY_DRAW = { drone, runner, brute };

  function enemy(e, t) {
    ENEMY_DRAW[e.type](e, t);
  }

  /* ---------------- 아이템 ---------------- */

  function pickup(p, t) {
    m4.identity(P);
    const bob = Math.sin(t * 2.4 + p.x) * 0.08;
    m4.translate(P, p.x, 0.5 + bob + (p.baseY || 0), p.z);
    m4.rotateY(P, t * 1.4 + p.z);
    const s = p.spot ? 1 : 0.85;
    m4.scale(P, s, s, s);
    if (p.kind === 'health') {
      part(P, 0, 0, 0, 0.55, 0.34, 0.55, 'metal', [0.82, 0.85, 0.88], null, 0.6);
      const g = [0.25, 1, 0.5];
      lightPart(P, 0, 0.175, 0, 0.34, 0.02, 0.1, g);
      lightPart(P, 0, 0.175, 0, 0.1, 0.02, 0.34, g);
      for (const z of [-0.28, 0.28]) {
        lightPart(P, 0, 0, z, 0.26, 0.08, 0.01, g);
        lightPart(P, 0, 0, z, 0.08, 0.26, 0.01, g);
      }
    } else {
      part(P, 0, 0, 0, 0.62, 0.32, 0.4, 'crate', [0.75, 0.85, 0.6], null, 0.3);
      for (const z of [-0.205, 0.205]) lightPart(P, 0, 0.02, z, 0.5, 0.06, 0.01, [1, 0.72, 0.15]);
      for (let i = -1; i <= 1; i++) part(P, i * 0.14, 0.22, 0, 0.06, 0.12, 0.06, 'metal', [0.9, 0.7, 0.3], null, 0.9);
    }
  }

  /* ---------------- 손에 든 총 ---------------- */
  /*
   * 총 좌표: x 오른쪽, y 위, -z 앞. hip: 허리 사격 위치, ads: 조준 위치(가늠쇠가 화면 가운데), muzzle: 총구
   */
  const GUNS = {
    pistol: {
      hip: [0.19, -0.19, -0.46],
      ads: [0, -0.066, -0.34],
      muzzle: [0, 0.035, -0.27],
      parts: [
        [0, 0.035, -0.12, 0.045, 0.05, 0.25, [0.34, 0.35, 0.38], 0.8],
        [0, -0.005, -0.1, 0.04, 0.032, 0.2, [0.14, 0.14, 0.15], 0.4],
        [0, -0.075, -0.015, 0.04, 0.125, 0.058, [0.11, 0.11, 0.12], 0.2, 0.22],
        [0, -0.036, -0.07, 0.012, 0.03, 0.055, [0.1, 0.1, 0.1], 0.3],
        [0, 0.035, -0.249, 0.022, 0.022, 0.01, [0.05, 0.05, 0.05], 0.3],
        [0, 0.066, -0.02, 0.032, 0.014, 0.012, [0.08, 0.08, 0.08], 0.3],
      ],
      lights: [[0, 0.066, -0.235, 0.008, 0.012, 0.01, [0.3, 1, 0.5]]],
      glove: [[0, -0.08, 0.0, 0.06, 0.1, 0.08], [-0.05, -0.09, -0.01, 0.05, 0.09, 0.08]],
    },
    rifle: {
      hip: [0.18, -0.2, -0.44],
      ads: [0, -0.082, -0.3],
      muzzle: [0, 0.01, -0.7],
      parts: [
        [0, 0, -0.15, 0.06, 0.08, 0.36, [0.3, 0.32, 0.3], 0.5],
        [0, 0.005, -0.42, 0.066, 0.07, 0.24, [0.22, 0.24, 0.21], 0.4],
        [0, 0.01, -0.6, 0.022, 0.022, 0.18, [0.08, 0.08, 0.09], 0.7],
        [0, -0.095, -0.2, 0.045, 0.13, 0.07, [0.12, 0.12, 0.12], 0.3, -0.18],
        [0, -0.02, 0.1, 0.05, 0.075, 0.2, [0.13, 0.14, 0.13], 0.3],
        [0, -0.075, -0.05, 0.04, 0.1, 0.05, [0.1, 0.1, 0.1], 0.2, 0.3],
        [0, 0.048, -0.22, 0.03, 0.014, 0.34, [0.1, 0.1, 0.11], 0.5],
        [0, 0.078, -0.17, 0.046, 0.048, 0.07, [0.12, 0.12, 0.13], 0.6],
      ],
      lights: [[0, 0.082, -0.2, 0.006, 0.006, 0.004, [1, 0.15, 0.1]], [0.034, 0.0, -0.36, 0.004, 0.02, 0.06, [0.25, 0.85, 1]]],
      glove: [[0, -0.08, -0.04, 0.06, 0.1, 0.08]],
    },
    shotgun: {
      hip: [0.18, -0.2, -0.44],
      ads: [0, -0.052, -0.32],
      muzzle: [0, 0.02, -0.72],
      parts: [
        [0, 0, -0.12, 0.066, 0.085, 0.3, [0.26, 0.25, 0.24], 0.5],
        [0, 0.02, -0.46, 0.036, 0.036, 0.5, [0.1, 0.1, 0.11], 0.8],
        [0, -0.024, -0.42, 0.03, 0.03, 0.44, [0.12, 0.12, 0.13], 0.6],
        [0, -0.035, 0.12, 0.056, 0.09, 0.22, [0.34, 0.21, 0.11], 0.2],
        [0, -0.075, 0.0, 0.045, 0.1, 0.055, [0.3, 0.19, 0.1], 0.2, 0.4],
      ],
      pump: [0, -0.03, -0.42, 0.058, 0.052, 0.17, [0.36, 0.22, 0.12], 0.2],
      lights: [[0, 0.043, -0.69, 0.01, 0.01, 0.01, [1, 0.8, 0.3]]],
      glove: [[0, -0.08, 0.0, 0.06, 0.1, 0.08]],
    },
  };

  const GLOVE = [0.16, 0.15, 0.14];
  const SLEEVE = [0.2, 0.22, 0.2];

  /**
   * 손에 든 총. cam: 카메라 월드 행렬, v: {id, offset:[x,y,z], kick, tilt, roll, pump, yaw}
   * 돌려주는 값: 총구의 월드 위치
   */
  function viewmodel(cam, v, muzzleOut) {
    const g = GUNS[v.id];
    m4.copy(P, cam);
    m4.translate(P, v.offset[0], v.offset[1], v.offset[2]);
    m4.rotateY(P, v.yaw || 0);
    m4.rotateX(P, (v.kick || 0) * 0.12 + (v.tilt || 0));
    m4.rotateZ(P, v.roll || 0);
    m4.translate(P, 0, 0, (v.kick || 0) * 0.05);
    for (const p of g.parts) part(P, p[0], p[1], p[2], p[3], p[4], p[5], 'metal', p[6], null, p[7], p[8] || 0);
    if (g.pump) {
      const p = g.pump;
      part(P, p[0], p[1], p[2] + (v.pump || 0) * 0.08, p[3], p[4], p[5], 'metal', p[6], null, p[7]);
    }
    for (const l of g.lights) lightPart(P, l[0], l[1], l[2], l[3], l[4], l[5], l[6]);
    for (const h of g.glove) part(P, h[0], h[1], h[2], h[3] * 0.85, h[4] * 0.85, h[5] * 0.85, 'metal', GLOVE, null, 0.1);
    // 오른팔: 손목에서 화면 오른쪽 아래로
    part(P, 0.035, -0.16, 0.13, 0.07, 0.07, 0.26, 'metal', SLEEVE, null, 0.05, 0.62, 0.12);
    if (v.id !== 'pistol') {
      // 왼손: 총열 덮개(산탄총은 펌프)를 잡고, 팔은 왼쪽 아래로
      const lz = v.id === 'shotgun' ? -0.42 + (v.pump || 0) * 0.08 : -0.42;
      part(P, -0.012, -0.055, lz, 0.07, 0.05, 0.1, 'metal', GLOVE, null, 0.1);
      part(P, -0.075, -0.15, lz + 0.15, 0.06, 0.06, 0.26, 'metal', SLEEVE, null, 0.05, 0.75, 0.42);
    }
    if (muzzleOut) m4.point(muzzleOut, P, g.muzzle[0], g.muzzle[1], g.muzzle[2]);
    return muzzleOut;
  }

  /** 부서진 조각 */
  function debris(d) {
    m4.identity(P);
    m4.translate(P, d.x, d.y, d.z);
    m4.rotateY(P, d.ry);
    m4.rotateX(P, d.rx);
    m4.scale(P, d.s, d.s * 0.7, d.s * 1.2);
    R.box(P, 'metal', d.tint, d.hot > 0 ? [d.hot * 1.2, d.hot * 0.4, 0] : null, 0.5, 0);
  }

  SZ.models = {
    bind(renderer) {
      R = renderer;
    },
    enemy,
    pickup,
    viewmodel,
    debris,
    GUNS,
  };
})(typeof window !== 'undefined' ? window : globalThis);
