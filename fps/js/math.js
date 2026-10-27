/* SECTOR ZERO — 3D 수학: 4x4 행렬(열 우선, WebGL 순서)과 작은 도우미 */
(function (root) {
  'use strict';
  const SZ = (root.SZ = root.SZ || {});

  const m4 = {
    create() {
      return m4.identity(new Float32Array(16));
    },
    identity(out) {
      out.fill(0);
      out[0] = out[5] = out[10] = out[15] = 1;
      return out;
    },
    copy(out, a) {
      out.set(a);
      return out;
    },
    perspective(out, fovy, aspect, near, far) {
      const f = 1 / Math.tan(fovy / 2);
      const nf = 1 / (near - far);
      out.fill(0);
      out[0] = f / aspect;
      out[5] = f;
      out[10] = (far + near) * nf;
      out[11] = -1;
      out[14] = 2 * far * near * nf;
      return out;
    },
    /** out = a × b */
    multiply(out, a, b) {
      const r = m4._tmp;
      for (let c = 0; c < 4; c++) {
        const b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
        for (let i = 0; i < 4; i++) r[c * 4 + i] = a[i] * b0 + a[4 + i] * b1 + a[8 + i] * b2 + a[12 + i] * b3;
      }
      out.set(r);
      return out;
    },
    /** m = m × 이동 */
    translate(m, x, y, z) {
      m[12] += m[0] * x + m[4] * y + m[8] * z;
      m[13] += m[1] * x + m[5] * y + m[9] * z;
      m[14] += m[2] * x + m[6] * y + m[10] * z;
      m[15] += m[3] * x + m[7] * y + m[11] * z;
      return m;
    },
    scale(m, x, y, z) {
      for (let i = 0; i < 4; i++) {
        m[i] *= x;
        m[4 + i] *= y;
        m[8 + i] *= z;
      }
      return m;
    },
    rotateX(m, a) {
      const s = Math.sin(a), c = Math.cos(a);
      for (let i = 0; i < 4; i++) {
        const a1 = m[4 + i], a2 = m[8 + i];
        m[4 + i] = a1 * c + a2 * s;
        m[8 + i] = a2 * c - a1 * s;
      }
      return m;
    },
    rotateY(m, a) {
      const s = Math.sin(a), c = Math.cos(a);
      for (let i = 0; i < 4; i++) {
        const a0 = m[i], a2 = m[8 + i];
        m[i] = a0 * c - a2 * s;
        m[8 + i] = a0 * s + a2 * c;
      }
      return m;
    },
    rotateZ(m, a) {
      const s = Math.sin(a), c = Math.cos(a);
      for (let i = 0; i < 4; i++) {
        const a0 = m[i], a1 = m[4 + i];
        m[i] = a0 * c + a1 * s;
        m[4 + i] = a1 * c - a0 * s;
      }
      return m;
    },
    /** 점 (x,y,z)를 m으로 옮긴 결과를 out 배열에 */
    point(out, m, x, y, z) {
      out[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
      out[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
      out[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
      return out;
    },
    _tmp: new Float32Array(16),
  };

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  /** 프레임 속도와 상관없이 같은 비율로 다가가는 보간 */
  const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
  /** 각도 차이를 -π..π로 */
  const angleDiff = (a, b) => {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  };
  /** 바라보는 방향 → 요(yaw). 요 0은 -Z 쪽을 봐요. */
  const yawTo = (dx, dz) => Math.atan2(-dx, -dz);

  /** 시드를 고정할 수 있는 난수 (mulberry32) */
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  SZ.math = { m4, clamp, lerp, damp, angleDiff, yawTo, rng };
})(typeof window !== 'undefined' ? window : globalThis);
