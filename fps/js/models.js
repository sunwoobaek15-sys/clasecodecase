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

  /* 로봇 GLB 자세: 관절 노드마다 돌리는 값 (그릴 때마다 덮어써요) */
  const OV = {
    drone: { eye: { em: [0, 0, 0] }, pod_l: { rx: 0 }, pod_r: { rx: 0 }, antenna: { em: [0, 0, 0] } },
    runner: { hips: { y: 0 }, torso: { rx: 0 }, head: { rx: 0, em: [0, 0, 0] } },
    brute: { hips: { y: 0 }, head: { ry: 0 } },
  };
  for (const s of ['l', 'r']) {
    for (const n of ['thigh', 'shin', 'foot', 'arm', 'fore']) OV.runner[n + '_' + s] = { rx: 0, rz: 0 };
    OV.runner['fore_' + s].em = [0, 0, 0];
    for (const n of ['thigh', 'shin', 'foot', 'cannon']) OV.brute[n + '_' + s] = { rx: 0 };
    OV.brute['barrels_' + s] = { rz: 0, em: [0, 0, 0] };
  }
  const EN_OPTS = { em: null, ov: null };

  function poseDrone(e, t, ov) {
    const pulse = 0.5 + Math.sin(t * 6 + e.seed) * 0.25 + (e.windup > 0 ? 1.4 : 0);
    ov.eye.em[0] = pulse;
    ov.eye.em[1] = pulse * 0.15;
    const vec = -(e.tilt || 0) * 2.2 + Math.sin(t * 3 + e.seed) * 0.04;
    ov.pod_l.rx = vec;
    ov.pod_r.rx = vec;
    ov.antenna.em[0] = Math.sin(t * 9 + e.seed) > 0.6 ? 1.6 : 0;
  }

  function poseRunner(e, t, ov) {
    const ph = e.phase || 0, stride = Math.min(1, e.moveAmt || 0), swing = e.swing || 0;
    ov.hips.y = Math.abs(Math.sin(ph)) * 0.035 * stride;
    ov.torso.rx = -0.32 - swing * 0.25;
    ov.head.rx = 0.26 + swing * 0.1;
    // 베기 예고: 칼날을 뒤로 드는 동안 눈이 번쩍여요
    const warn = swing < 0 ? Math.min(1, -swing * 2.5) : 0;
    ov.head.em[0] = warn * 3;
    ov.head.em[1] = warn * 0.5;
    ov.head.em[2] = warn * 0.3;
    for (const [s, sg] of [['l', -1], ['r', 1]]) {
      const p = ph + (sg > 0 ? 0 : Math.PI);
      const th = Math.sin(p) * 0.75 * stride;
      const sh = -(Math.max(0, Math.cos(p)) * 0.9 * stride) - 0.15;
      ov['thigh_' + s].rx = th;
      ov['shin_' + s].rx = sh;
      ov['foot_' + s].rx = -(th + sh) * 0.85;
      // 팔: 걸음과 반대로 흔들고, 공격할 때 칼날을 앞으로 크게 휘둘러요
      ov['arm_' + s].rx = 0.5 + Math.sin(ph + (sg > 0 ? Math.PI : 0)) * 0.35 * stride + swing * 1.5;
      ov['arm_' + s].rz = sg * 0.12;
      ov['fore_' + s].rx = 0.35 + swing * 0.7;
      // 베기 직전: 칼날 테두리가 확 밝아져요
      ov['fore_' + s].em[0] = e.swingT > 0 ? 2.4 : 0;
      ov['fore_' + s].em[1] = e.swingT > 0 ? 0.5 : 0;
    }
  }

  function poseBrute(e, t, ov) {
    const ph = e.phase || 0, stride = Math.min(1, e.moveAmt || 0);
    ov.hips.y = Math.abs(Math.sin(ph)) * 0.04 * stride;
    ov.head.ry = Math.sin(t * 0.7 + e.seed) * 0.15;
    const glow = e.windup > 0 ? 2.2 : e.burstLeft > 0 ? 1.4 : 0;
    for (const [s, sg] of [['l', -1], ['r', 1]]) {
      const p = ph + (sg > 0 ? 0 : Math.PI);
      const th = Math.sin(p) * 0.35 * stride;
      const sh = -Math.max(0, Math.cos(p)) * 0.45 * stride - 0.05;
      ov['thigh_' + s].rx = th;
      ov['shin_' + s].rx = sh;
      ov['foot_' + s].rx = -(th + sh) * 0.9;
      ov['cannon_' + s].rx = e.aimPitch || 0;
      const b = ov['barrels_' + s];
      b.rz = sg * (e.spin || 0);
      b.em[0] = glow * 0.6;
      b.em[1] = glow * 0.25;
    }
  }
  const POSE = { drone: poseDrone, runner: poseRunner, brute: poseBrute };

  function enemy(e, t) {
    const m = model('robots/' + e.type);
    if (!m) {
      ENEMY_DRAW[e.type](e, t);
      return;
    }
    const grow = Math.min(1, e.spawnT * 1.3);
    m4.identity(P);
    m4.translate(P, e.x, e.y, e.z);
    m4.rotateY(P, e.yaw);
    if (e.type === 'drone') {
      m4.rotateX(P, e.tilt || 0);
      m4.rotateZ(P, e.roll || 0);
    }
    m4.scale(P, grow, grow, grow);
    const ov = OV[e.type];
    POSE[e.type](e, t, ov);
    EN_OPTS.em = flashOf(e);
    EN_OPTS.ov = ov;
    R.drawModel(m, P, EN_OPTS);
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

  /* ---------------- 3D 모델 (GLB) ---------------- */
  // assets-data.js에 묶인 GLB를 읽어요. 없거나 깨진 모델은 예전 상자 모델로 그려요.
  const MODELS = {};
  function loadModels() {
    const data = SZ.ASSET_DATA || {};
    for (const key of Object.keys(data)) {
      try {
        MODELS[key] = R.createModel(SZ.gltf.parse(SZ.gltf.fromBase64(data[key])));
      } catch (err) {
        if (root.console) root.console.warn('3D 모델을 읽지 못했어요: ' + key, err);
      }
    }
  }
  const model = (key) => MODELS[key] || null;
  const nodeOf = (m, name) => (m && m.byName.has(name) ? m.byName.get(name) : -1);

  /** 조각 하나를 가리키는 값 (떨어지는 탄창·탄피·부서진 로봇 부품) → {model, node, center, size} */
  function nodeRef(key, name) {
    const m = model(key);
    const i = nodeOf(m, name);
    if (i < 0) return null;
    const n = m.nodes[i];
    return { model: key, node: i, center: n.center, size: n.size };
  }

  /** 부서질 때 날아갈 로봇 부품: 가만히 있는 자세에서 부품 가운데 위치(로봇 기준)와 크기 */
  const PART_NAMES = {
    drone: ['body', 'pod_l', 'pod_r', 'antenna', 'eye'],
    runner: ['head', 'torso', 'hips', 'arm_l', 'arm_r', 'fore_l', 'fore_r', 'thigh_l', 'thigh_r', 'shin_l', 'shin_r', 'foot_l', 'foot_r'],
    brute: ['head', 'torso', 'hips', 'shoulder_l', 'shoulder_r', 'cannon_l', 'cannon_r', 'barrels_l', 'barrels_r', 'thigh_l', 'thigh_r', 'shin_l', 'shin_r'],
  };
  const partCache = {};
  function partsOf(type) {
    if (partCache[type]) return partCache[type];
    const key = 'robots/' + type;
    const m = model(key);
    const out = [];
    if (m) {
      for (const name of PART_NAMES[type] || []) {
        const i = nodeOf(m, name);
        if (i < 0 || m.nodes[i].mesh < 0) continue;
        const n = m.nodes[i];
        const W = m.rest[i];
        const c = n.center;
        out.push({
          model: key,
          node: i,
          center: c,
          size: n.size,
          at: [W[0] * c[0] + W[4] * c[1] + W[8] * c[2] + W[12], W[1] * c[0] + W[5] * c[1] + W[9] * c[2] + W[13], W[2] * c[0] + W[6] * c[1] + W[10] * c[2] + W[14]],
        });
      }
    }
    return (partCache[type] = out);
  }

  /* 손 자리: 오른손은 손잡이 가운데와 기울기, 왼손은 손 모양 회전 (권총은 옆에서 감싸요) */
  const HAND_FIT = {
    pistol: { r: [0, -0.072, 0.006], rrx: -0.22, l: [0.2, 0.5, -0.75] },
    rifle: { r: [0, -0.082, -0.034], rrx: -0.17, l: [0, 0, 0] },
    shotgun: { r: [0, -0.062, 0.046], rrx: -0.5, l: [0, 0, 0] },
  };
  const VM_OV = { slide: { z: 0 }, bolt: { z: 0 }, pump: { z: 0 }, magazine: { y: 0, hide: false } };
  const VM_OPTS = { ov: VM_OV };

  /** 상자 탄창 (가운데 기준) + 바닥판 — 모델이 없을 때 */
  function magBox(base, size) {
    part(base, 0, 0, 0, size[0], size[1], size[2], 'metal', MAG_TINT, null, 0.4);
    part(base, 0, -size[1] / 2 - 0.005, 0, size[0] + 0.008, 0.012, size[2] + 0.008, 'metal', [0.2, 0.2, 0.22], null, 0.5);
  }

  /** 상자 산탄 한 발 (빨간 몸통 + 놋쇠 밑동) — 모델이 없을 때 */
  function shellBox(base, x, y, z) {
    part(base, x, y, z, 0.022, 0.022, 0.05, 'metal', [0.75, 0.1, 0.08], null, 0.5);
    part(base, x, y, z + 0.031, 0.024, 0.024, 0.014, 'metal', [0.9, 0.7, 0.3], null, 0.9);
  }

  /** GLB 총 (슬라이드·장전 손잡이·펌프·탄창이 움직여요). 그렸으면 true */
  function gunGLB(pose) {
    const gm = model('guns/' + pose.id);
    if (!gm) return false;
    VM_OV.slide.z = pose.slide * 0.045;
    VM_OV.bolt.z = pose.bolt;
    VM_OV.pump.z = pose.pump;
    VM_OV.magazine.hide = pose.magMode !== 'gun';
    VM_OV.magazine.y = pose.magOff;
    R.drawModel(gm, GUN, VM_OPTS);
    return true;
  }

  /** GLB 손·팔과 왼손에 든 탄창·산탄 (ROOT·HAND 행렬이 준비된 뒤에). 그렸으면 true */
  function handsGLB(pose, geo) {
    const hm = model('guns/hands');
    if (!hm) return false;
    const fit = HAND_FIT[pose.id];
    m4.copy(P, ROOT);
    m4.translate(P, fit.r[0], fit.r[1], fit.r[2]);
    m4.rotateX(P, fit.rrx);
    R.drawModel(hm, P, null, nodeOf(hm, 'hand_r'), true);
    m4.copy(P, HAND);
    if (fit.l[1]) m4.rotateY(P, fit.l[1]);
    if (fit.l[0]) m4.rotateX(P, fit.l[0]);
    if (fit.l[2]) m4.rotateZ(P, fit.l[2]);
    R.drawModel(hm, P, null, nodeOf(hm, 'hand_l'), true);
    const gm = model('guns/' + pose.id);
    if (pose.magMode === 'hand' && geo.mag) {
      m4.copy(P, HAND);
      m4.rotateX(P, geo.mag.rx);
      m4.translate(P, 0, SZ.anim.MAG_GRIP, 0);
      if (gm && nodeOf(gm, 'magazine') >= 0) R.drawModel(gm, P, null, nodeOf(gm, 'magazine'), true);
      else magBox(P, geo.mag.size);
    }
    if (pose.hold === 'shell') {
      const pm = model('props/casings');
      const i = nodeOf(pm, 'shell_12g');
      if (i >= 0) {
        m4.copy(P, HAND);
        m4.translate(P, 0, 0.045, -0.02);
        R.drawModel(pm, P, null, i, true);
      } else shellBox(HAND, 0, 0.045, -0.02);
    }
    return true;
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
    const glb = gunGLB(pose);
    for (const q of glb ? [] : g.parts) {
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
      if (pose.magMode === 'gun' && !glb) {
        m4.copy(P, GUN);
        m4.translate(P, magAx, m.seat[1] + magAy, m.seat[2] + magAz);
        m4.rotateX(P, m.rx);
        magBox(P, m.size);
      }
    }
    // 왼손 자리 (재장전할 때 따로 움직여요)
    const L = geo.left, lp = pose.left;
    m4.copy(HAND, ROOT);
    m4.translate(HAND, L[0] + lp.x, L[1] + lp.y, L[2] + lp.z + (pose.id === 'shotgun' ? pose.pump : 0));
    m4.rotateY(HAND, lp.ry);
    m4.rotateX(HAND, lp.rx);
    m4.rotateZ(HAND, lp.rz);
    if (!handsGLB(pose, geo)) {
      // 상자 모델: 오른손·소매, 왼손·팔, 손에 든 탄창·산탄
      const h = g.glove;
      part(ROOT, h[0], h[1], h[2], h[3] * 0.85, h[4] * 0.85, h[5] * 0.85, 'metal', GLOVE, null, 0.1);
      part(ROOT, 0.035, -0.16, 0.13, 0.07, 0.07, 0.26, 'metal', SLEEVE, null, 0.05, 0.62, 0.12);
      part(HAND, 0, 0, 0, 0.058, 0.06, 0.085, 'metal', GLOVE, null, 0.1);
      part(HAND, -0.05, -0.095, 0.13, 0.06, 0.06, 0.25, 'metal', SLEEVE, null, 0.05, 0.75, 0.42);
      if (pose.magMode === 'hand' && geo.mag) {
        m4.copy(P, HAND);
        m4.rotateX(P, geo.mag.rx);
        m4.translate(P, 0, SZ.anim.MAG_GRIP, 0);
        magBox(P, geo.mag.size);
      }
      if (pose.hold === 'shell') shellBox(HAND, 0, 0.045, -0.02);
    }
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

  /** 부서진 조각, 떨어진 탄창, 탄피. d.ref(모델 조각)가 있으면 그 3D 조각으로, 없으면 상자로 */
  const DEBRIS_OPTS = { em: null, noChildren: true };
  const hotEm = [0, 0, 0];
  function debris(d) {
    m4.identity(P);
    m4.translate(P, d.x, d.y, d.z);
    m4.rotateY(P, d.ry);
    m4.rotateX(P, d.rx);
    const m = d.ref && model(d.ref.model);
    if (m) {
      const c = d.ref.center;
      m4.translate(P, -c[0], -c[1], -c[2]);
      hotEm[0] = d.hot * 1.2;
      hotEm[1] = d.hot * 0.4;
      DEBRIS_OPTS.em = d.hot > 0 ? hotEm : null;
      R.drawModel(m, P, DEBRIS_OPTS, d.ref.node, true);
      return;
    }
    if (d.dims) m4.scale(P, d.dims[0], d.dims[1], d.dims[2]);
    else m4.scale(P, d.s, d.s * 0.7, d.s * 1.2);
    R.box(P, 'metal', d.tint, d.hot > 0 ? [d.hot * 1.2, d.hot * 0.4, 0] : null, d.spec || 0.5, 0);
  }

  SZ.models = {
    bind(renderer) {
      R = renderer;
      loadModels();
    },
    nodeRef,
    partsOf,
    loaded: () => Object.keys(MODELS),
    enemy,
    pickup,
    viewmodel,
    debris,
    GUNS,
  };
})(typeof window !== 'undefined' ? window : globalThis);
