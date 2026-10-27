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
   * 총 좌표: x 오른쪽, y 위, -z 앞. 위치·탄창 자리 같은 값은 anim.js의 GEOM에 있어요.
   * 부품 g: 'slide' 권총 슬라이드, 'bolt' 소총 장전 손잡이, 'pump' 산탄총 펌프 — 애니메이션에 따라 앞뒤로 움직여요.
   */
  const DARK = [0.05, 0.05, 0.055];
  const GUNS = {
    pistol: {
      parts: [
        { p: [0, 0.035, -0.12], s: [0.045, 0.05, 0.25], c: [0.34, 0.35, 0.38], sp: 0.8, g: 'slide' },
        { p: [0.0232, 0.042, -0.095], s: [0.003, 0.016, 0.045], c: DARK, sp: 0.3, g: 'slide' },
        { p: [0.0232, 0.035, -0.02], s: [0.003, 0.03, 0.004], c: DARK, sp: 0.3, g: 'slide' },
        { p: [0.0232, 0.035, -0.01], s: [0.003, 0.03, 0.004], c: DARK, sp: 0.3, g: 'slide' },
        { p: [0, 0.035, -0.249], s: [0.022, 0.022, 0.01], c: DARK, sp: 0.3, g: 'slide' },
        { p: [0, 0.066, -0.02], s: [0.032, 0.014, 0.012], c: [0.08, 0.08, 0.08], sp: 0.3, g: 'slide' },
        { p: [0, 0.066, -0.235], s: [0.008, 0.012, 0.01], c: [0.3, 1, 0.5], light: true, g: 'slide' },
        { p: [0, -0.005, -0.1], s: [0.04, 0.032, 0.2], c: [0.14, 0.14, 0.15], sp: 0.4 },
        { p: [0, -0.075, -0.015], s: [0.04, 0.125, 0.058], c: [0.11, 0.11, 0.12], sp: 0.2, rx: 0.22 },
        { p: [0, -0.036, -0.07], s: [0.012, 0.03, 0.055], c: [0.1, 0.1, 0.1], sp: 0.3 },
      ],
      glove: [0, -0.08, 0.0, 0.06, 0.1, 0.08],
    },
    rifle: {
      parts: [
        { p: [0, 0, -0.15], s: [0.06, 0.08, 0.36], c: [0.3, 0.32, 0.3], sp: 0.5 },
        { p: [0.0305, 0.018, -0.12], s: [0.004, 0.022, 0.06], c: DARK, sp: 0.3 },
        { p: [0.0305, 0.014, -0.03], s: [0.003, 0.008, 0.1], c: DARK, sp: 0.3 },
        { p: [0.037, 0.014, -0.06], s: [0.022, 0.016, 0.03], c: [0.62, 0.62, 0.64], sp: 0.9, g: 'bolt' },
        { p: [0, 0.005, -0.42], s: [0.066, 0.07, 0.24], c: [0.22, 0.24, 0.21], sp: 0.4 },
        { p: [0, 0.01, -0.6], s: [0.022, 0.022, 0.18], c: [0.08, 0.08, 0.09], sp: 0.7 },
        { p: [0, 0.01, -0.69], s: [0.032, 0.032, 0.045], c: [0.12, 0.12, 0.13], sp: 0.7 },
        { p: [0, -0.02, 0.1], s: [0.05, 0.075, 0.2], c: [0.13, 0.14, 0.13], sp: 0.3 },
        { p: [0, -0.075, -0.05], s: [0.04, 0.1, 0.05], c: [0.1, 0.1, 0.1], sp: 0.2, rx: 0.3 },
        { p: [0, 0.048, -0.22], s: [0.03, 0.014, 0.34], c: [0.1, 0.1, 0.11], sp: 0.5 },
        { p: [0, 0.078, -0.17], s: [0.046, 0.048, 0.07], c: [0.12, 0.12, 0.13], sp: 0.6 },
        { p: [0, 0.082, -0.2], s: [0.006, 0.006, 0.004], c: [1, 0.15, 0.1], light: true },
        { p: [0.034, 0.0, -0.36], s: [0.004, 0.02, 0.06], c: [0.25, 0.85, 1], light: true },
      ],
      glove: [0, -0.08, -0.04, 0.06, 0.1, 0.08],
    },
    shotgun: {
      parts: [
        { p: [0, 0, -0.12], s: [0.066, 0.085, 0.3], c: [0.26, 0.25, 0.24], sp: 0.5 },
        { p: [0.0335, 0.02, -0.1], s: [0.004, 0.03, 0.07], c: DARK, sp: 0.3 },
        { p: [0, -0.0435, -0.16], s: [0.04, 0.003, 0.07], c: DARK, sp: 0.3 },
        { p: [0, 0.02, -0.46], s: [0.036, 0.036, 0.5], c: [0.1, 0.1, 0.11], sp: 0.8 },
        { p: [0, -0.024, -0.42], s: [0.03, 0.03, 0.44], c: [0.12, 0.12, 0.13], sp: 0.6 },
        { p: [0, -0.035, 0.12], s: [0.056, 0.09, 0.22], c: [0.34, 0.21, 0.11], sp: 0.2 },
        { p: [0, -0.075, 0.0], s: [0.045, 0.1, 0.055], c: [0.3, 0.19, 0.1], sp: 0.2, rx: 0.4 },
        { p: [0, -0.03, -0.42], s: [0.058, 0.052, 0.17], c: [0.36, 0.22, 0.12], sp: 0.2, g: 'pump' },
        { p: [0, 0.043, -0.69], s: [0.01, 0.01, 0.01], c: [1, 0.8, 0.3], light: true },
      ],
      glove: [0, -0.08, 0.0, 0.06, 0.1, 0.08],
    },
  };

  const GLOVE = [0.16, 0.15, 0.14];
  const SLEEVE = [0.2, 0.22, 0.2];
  const MAG_TINT = [0.11, 0.11, 0.12];
  const ROOT = m4.create();
  const GUN = m4.create();
  const HAND = m4.create();

  /** 탄창 (가운데 기준) + 바닥판 */
  function magBox(base, size) {
    part(base, 0, 0, 0, size[0], size[1], size[2], 'metal', MAG_TINT, null, 0.4);
    part(base, 0, -size[1] / 2 - 0.005, 0, size[0] + 0.008, 0.012, size[2] + 0.008, 'metal', [0.2, 0.2, 0.22], null, 0.5);
  }

  /** 산탄 한 발 (빨간 몸통 + 놋쇠 밑동) */
  function shellBox(base, x, y, z) {
    part(base, x, y, z, 0.022, 0.022, 0.05, 'metal', [0.75, 0.1, 0.08], null, 0.5);
    part(base, x, y, z + 0.031, 0.024, 0.024, 0.014, 'metal', [0.9, 0.7, 0.3], null, 0.9);
  }

  /**
   * 손에 든 총. cam: 카메라 월드 행렬, pose: anim.js가 만든 자세
   * out(있으면): muzzle 총구, eject 탄피 나가는 곳, mag 탄창 가운데 (월드 좌표), right·up (총의 방향)
   */
  function viewmodel(cam, pose, out) {
    const g = GUNS[pose.id];
    const geo = SZ.anim.GEOM[pose.id];
    m4.copy(ROOT, cam);
    m4.translate(ROOT, pose.x, pose.y, pose.z);
    m4.rotateY(ROOT, pose.ry);
    m4.rotateX(ROOT, pose.rx);
    m4.rotateZ(ROOT, pose.rz);
    // 총은 손가락을 축으로 돌 수 있어요 (손은 그대로)
    m4.copy(GUN, ROOT);
    if (pose.spin) {
      const v = geo.pivot;
      m4.translate(GUN, v[0], v[1], v[2]);
      m4.rotateX(GUN, pose.spin);
      m4.translate(GUN, -v[0], -v[1], -v[2]);
    }
    for (const q of g.parts) {
      const dz = q.g === 'slide' ? pose.slide * 0.045 : q.g === 'bolt' ? pose.bolt : q.g === 'pump' ? pose.pump : 0;
      if (q.light) lightPart(GUN, q.p[0], q.p[1], q.p[2] + dz, q.s[0], q.s[1], q.s[2], q.c);
      else part(GUN, q.p[0], q.p[1], q.p[2] + dz, q.s[0], q.s[1], q.s[2], 'metal', q.c, null, q.sp, q.rx || 0);
    }
    // 꽂힌 탄창: 탄창 축을 따라 빠지고 들어가요
    let magAx = 0, magAy = 0, magAz = 0;
    if (geo.mag) {
      const m = geo.mag;
      magAy = Math.cos(m.rx) * pose.magOff;
      magAz = Math.sin(m.rx) * pose.magOff;
      magAx = m.seat[0];
      if (pose.magMode === 'gun') {
        m4.copy(P, GUN);
        m4.translate(P, magAx, m.seat[1] + magAy, m.seat[2] + magAz);
        m4.rotateX(P, m.rx);
        magBox(P, m.size);
      }
    }
    // 오른손과 소매 (손잡이를 쥐고 있어요)
    const h = g.glove;
    part(ROOT, h[0], h[1], h[2], h[3] * 0.85, h[4] * 0.85, h[5] * 0.85, 'metal', GLOVE, null, 0.1);
    part(ROOT, 0.035, -0.16, 0.13, 0.07, 0.07, 0.26, 'metal', SLEEVE, null, 0.05, 0.62, 0.12);
    // 왼손과 팔 (재장전할 때 따로 움직여요)
    const L = geo.left, lp = pose.left;
    m4.copy(HAND, ROOT);
    m4.translate(HAND, L[0] + lp.x, L[1] + lp.y, L[2] + lp.z + (pose.id === 'shotgun' ? pose.pump : 0));
    m4.rotateY(HAND, lp.ry);
    m4.rotateX(HAND, lp.rx);
    m4.rotateZ(HAND, lp.rz);
    part(HAND, 0, 0, 0, 0.058, 0.06, 0.085, 'metal', GLOVE, null, 0.1);
    part(HAND, -0.05, -0.095, 0.13, 0.06, 0.06, 0.25, 'metal', SLEEVE, null, 0.05, 0.75, 0.42);
    if (pose.magMode === 'hand' && geo.mag) {
      m4.copy(P, HAND);
      m4.rotateX(P, geo.mag.rx);
      m4.translate(P, 0, SZ.anim.MAG_GRIP, 0);
      magBox(P, geo.mag.size);
    }
    if (pose.hold === 'shell') shellBox(HAND, 0, 0.045, -0.02);
    if (out) {
      m4.point(out.muzzle, GUN, geo.muzzle[0], geo.muzzle[1], geo.muzzle[2]);
      m4.point(out.eject, GUN, geo.eject[0], geo.eject[1], geo.eject[2] + (pose.id === 'pistol' ? pose.slide * 0.045 : 0));
      if (geo.mag) m4.point(out.mag, GUN, magAx, geo.mag.seat[1] + magAy, geo.mag.seat[2] + magAz);
      out.right[0] = GUN[0];
      out.right[1] = GUN[1];
      out.right[2] = GUN[2];
      out.up[0] = GUN[4];
      out.up[1] = GUN[5];
      out.up[2] = GUN[6];
    }
    return out;
  }

  /** 부서진 조각, 떨어진 탄창, 탄피 (dims가 있으면 그 크기 그대로) */
  function debris(d) {
    m4.identity(P);
    m4.translate(P, d.x, d.y, d.z);
    m4.rotateY(P, d.ry);
    m4.rotateX(P, d.rx);
    if (d.dims) m4.scale(P, d.dims[0], d.dims[1], d.dims[2]);
    else m4.scale(P, d.s, d.s * 0.7, d.s * 1.2);
    R.box(P, 'metal', d.tint, d.hot > 0 ? [d.hot * 1.2, d.hot * 0.4, 0] : null, d.spec || 0.5, 0);
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
