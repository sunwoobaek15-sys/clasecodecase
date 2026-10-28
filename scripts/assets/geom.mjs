// 3D 모델을 코드로 만드는 도구
// 옆모습(2D 외곽선)을 두께만큼 밀어내기, 원기둥, 회전체, 구를 만들고 옮기고 돌려서 합쳐요.
// 좌표: x 오른쪽, y 위, -z 앞 (게임과 같아요). 색은 꼭짓점마다 [r, g, b] (0~1).

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/* ---------- 4x4 행렬 (열 우선) ---------- */
export const M4 = {
  ident: () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  mul(a, b) {
    const r = new Array(16).fill(0);
    for (let c = 0; c < 4; c++) for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) r[c * 4 + i] += a[k * 4 + i] * b[c * 4 + k];
    return r;
  },
  T: (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1],
  S: (x, y, z) => [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1],
  RX(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
  },
  RY(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
  },
  RZ(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  },
  /** 게임과 같은 순서: 이동 → Y 회전 → X 회전 → Z 회전 */
  TR(t, r) {
    let m = M4.T(t[0], t[1], t[2]);
    if (r) {
      if (r[1]) m = M4.mul(m, M4.RY(r[1]));
      if (r[0]) m = M4.mul(m, M4.RX(r[0]));
      if (r[2]) m = M4.mul(m, M4.RZ(r[2]));
    }
    return m;
  },
  point: (m, p) => [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ],
  dir: (m, d) => [m[0] * d[0] + m[4] * d[1] + m[8] * d[2], m[1] * d[0] + m[5] * d[1] + m[9] * d[2], m[2] * d[0] + m[6] * d[1] + m[10] * d[2]],
};

/** 게임과 같은 순서(Y → X → Z)의 오일러 각 → 쿼터니언 [x, y, z, w] */
export function quat(r) {
  const q = (ax, a) => {
    const s = Math.sin(a / 2);
    return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(a / 2)];
  };
  const qm = (a, b) => [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
  return qm(qm(q([0, 1, 0], r[1] || 0), q([1, 0, 0], r[0] || 0)), q([0, 0, 1], r[2] || 0));
}

/* ---------- 2D 다각형 ---------- */
export function area2(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

function inTri(p, a, b, c) {
  const d1 = (p[0] - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (p[1] - b[1]);
  const d2 = (p[0] - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (p[1] - c[1]);
  const d3 = (p[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (p[1] - a[1]);
  const neg = d1 < -1e-12 || d2 < -1e-12 || d3 < -1e-12;
  const pos = d1 > 1e-12 || d2 > 1e-12 || d3 > 1e-12;
  return !(neg && pos);
}

/** 오목한 다각형도 삼각형으로 (귀 자르기) → [[i, j, k], ...] */
export function triangulate(poly) {
  const ccw = area2(poly) > 0;
  const idx = poly.map((_, i) => i);
  const out = [];
  let guard = 0;
  while (idx.length > 3 && guard++ < 10000) {
    let cut = false;
    for (let i = 0; i < idx.length; i++) {
      const ia = idx[(i + idx.length - 1) % idx.length], ib = idx[i], ic = idx[(i + 1) % idx.length];
      const a = poly[ia], b = poly[ib], c = poly[ic];
      const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      if (ccw ? cr <= 1e-12 : cr >= -1e-12) continue;
      let blocked = false;
      for (const j of idx) {
        if (j === ia || j === ib || j === ic) continue;
        if (inTri(poly[j], a, b, c)) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      out.push([ia, ib, ic]);
      idx.splice(i, 1);
      cut = true;
      break;
    }
    if (!cut) break;
  }
  if (idx.length === 3) out.push([idx[0], idx[1], idx[2]]);
  return out;
}

/** 다각형을 안쪽으로 d만큼 줄이기 (모서리 깎기에 써요) */
export function inset(poly, d) {
  const ccw = area2(poly) > 0;
  const n = poly.length;
  return poly.map((p, i) => {
    const a = poly[(i + n - 1) % n], c = poly[(i + 1) % n];
    const e1 = norm([p[0] - a[0], p[1] - a[1], 0]), e2 = norm([c[0] - p[0], c[1] - p[1], 0]);
    // 안쪽 법선 (반시계면 왼쪽)
    const n1 = ccw ? [-e1[1], e1[0]] : [e1[1], -e1[0]];
    const n2 = ccw ? [-e2[1], e2[0]] : [e2[1], -e2[0]];
    let m = [n1[0] + n2[0], n1[1] + n2[1]];
    const ml = Math.hypot(m[0], m[1]) || 1;
    m = [m[0] / ml, m[1] / ml];
    const cosHalf = Math.max(0.35, m[0] * n1[0] + m[1] * n1[1]);
    const k = d / cosHalf;
    return [p[0] + m[0] * k, p[1] + m[1] * k];
  });
}

/** 모서리를 깎은 사각형 (깎지 않으면 ch = 0) */
export function rect(a0, b0, a1, b1, ch = 0) {
  if (!ch) return [[a0, b0], [a1, b0], [a1, b1], [a0, b1]];
  return [[a0 + ch, b0], [a1 - ch, b0], [a1, b0 + ch], [a1, b1 - ch], [a1 - ch, b1], [a0 + ch, b1], [a0, b1 - ch], [a0, b0 + ch]];
}

/** 원 둘레 점 n개 */
export function circle(r, n, ca = 0, cb = 0, phase = 0) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2;
    out.push([ca + Math.cos(a) * r, cb + Math.sin(a) * r]);
  }
  return out;
}

/** (a, b, w) → (x, y, z). axis: 밀어내는 방향 */
const AXES = {
  x: (a, b, w) => [w, b, a], // a = z, b = y (옆모습)
  y: (a, b, w) => [a, w, b], // a = x, b = z (위에서 본 모습)
  z: (a, b, w) => [a, b, w], // a = x, b = y (앞에서 본 단면)
};

/* ---------- 메시 ---------- */
export class Mesh {
  constructor() {
    this.p = [];
    this.n = [];
    this.c = [];
    this.i = [];
  }
  get vcount() {
    return this.p.length / 3;
  }
  get tcount() {
    return this.i.length / 3;
  }
  vert(p, n, c) {
    this.p.push(p[0], p[1], p[2]);
    this.n.push(n[0], n[1], n[2]);
    this.c.push(c[0], c[1], c[2]);
    return this.vcount - 1;
  }
  /** 면 하나: 점 배열(볼록), 면 법선 또는 점마다 법선. 법선 쪽에서 반시계가 되도록 자동으로 맞춰요 */
  face(pts, n, col, tris) {
    const perVert = Array.isArray(n[0]);
    const base = this.vcount;
    pts.forEach((p, k) => this.vert(p, perVert ? n[k] : n, col));
    tris = tris || pts.slice(2).map((_, k) => [0, k + 1, k + 2]);
    for (const [a, b, c] of tris) {
      const pa = pts[a], pb = pts[b], pc = pts[c];
      const fn = perVert ? add(add(n[a], n[b]), n[c]) : n;
      const flip = dot(cross(sub(pb, pa), sub(pc, pa)), fn) < 0;
      if (flip) this.i.push(base + a, base + c, base + b);
      else this.i.push(base + a, base + b, base + c);
    }
    return this;
  }
  merge(m) {
    const base = this.vcount;
    this.p.push(...m.p);
    this.n.push(...m.n);
    this.c.push(...m.c);
    for (const k of m.i) this.i.push(k + base);
    return this;
  }
  /** 행렬로 옮기고 돌리기 (법선도 같이) */
  transform(m) {
    for (let k = 0; k < this.p.length; k += 3) {
      const p = M4.point(m, [this.p[k], this.p[k + 1], this.p[k + 2]]);
      const n = norm(M4.dir(m, [this.n[k], this.n[k + 1], this.n[k + 2]]));
      this.p[k] = p[0];
      this.p[k + 1] = p[1];
      this.p[k + 2] = p[2];
      this.n[k] = n[0];
      this.n[k + 1] = n[1];
      this.n[k + 2] = n[2];
    }
    return this;
  }
  at(t, r) {
    return this.transform(M4.TR(t, r));
  }
  /** 거울 (x를 뒤집기) — 면 방향도 뒤집어요 */
  mirrorX() {
    for (let k = 0; k < this.p.length; k += 3) {
      this.p[k] = -this.p[k];
      this.n[k] = -this.n[k];
    }
    for (let k = 0; k < this.i.length; k += 3) {
      const t = this.i[k + 1];
      this.i[k + 1] = this.i[k + 2];
      this.i[k + 2] = t;
    }
    return this;
  }
  clone() {
    const m = new Mesh();
    m.p = this.p.slice();
    m.n = this.n.slice();
    m.c = this.c.slice();
    m.i = this.i.slice();
    return m;
  }
  bounds() {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let k = 0; k < this.p.length; k += 3) {
      for (let j = 0; j < 3; j++) {
        lo[j] = Math.min(lo[j], this.p[k + j]);
        hi[j] = Math.max(hi[j], this.p[k + j]);
      }
    }
    return { lo, hi };
  }
}

/**
 * 2D 외곽선을 w0 ~ w1 두께로 밀어내기. axis 'x'면 poly는 옆모습 [z, y].
 * bevel > 0 이면 앞뒤 가장자리를 비스듬히 깎아서 모서리에 빛이 맺혀요.
 */
export function extrude(poly, w0, w1, axis, col, bevel = 0) {
  const map = AXES[axis];
  const m = new Mesh();
  const ccw = area2(poly) > 0;
  const b = Math.max(0, Math.min(bevel, Math.abs(w1 - w0) / 2 - 1e-5));
  const capPoly = b > 0 ? inset(poly, b) : poly;
  const tris = triangulate(capPoly);
  const lo = Math.min(w0, w1), hi = Math.max(w0, w1);
  // 앞뒤 뚜껑
  m.face(capPoly.map(([a, c]) => map(a, c, hi)), map(0, 0, 1), col, tris);
  m.face(capPoly.map(([a, c]) => map(a, c, lo)), map(0, 0, -1), col, tris);
  // 옆면 (+ 깎은 띠)
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n];
    const da = q[0] - p[0], db = q[1] - p[1];
    const l = Math.hypot(da, db) || 1;
    const o = ccw ? [db / l, -da / l] : [-db / l, da / l];
    const sideN = map(o[0], o[1], 0);
    m.face([map(p[0], p[1], lo + b), map(q[0], q[1], lo + b), map(q[0], q[1], hi - b), map(p[0], p[1], hi - b)], sideN, col);
    if (b > 0) {
      const ip = capPoly[i], iq = capPoly[(i + 1) % n];
      m.face([map(p[0], p[1], hi - b), map(q[0], q[1], hi - b), map(iq[0], iq[1], hi), map(ip[0], ip[1], hi)], norm(add(sideN, map(0, 0, 1))), col);
      m.face([map(p[0], p[1], lo + b), map(q[0], q[1], lo + b), map(iq[0], iq[1], lo), map(ip[0], ip[1], lo)], norm(add(sideN, map(0, 0, -1))), col);
    }
  }
  return m;
}

/** 모서리를 깎은 상자 (가운데 기준 크기 sx, sy, sz) */
export function box(sx, sy, sz, col, bevel = 0) {
  const ch = Math.min(bevel, sx / 2 - 1e-5, sy / 2 - 1e-5);
  return extrude(rect(-sx / 2, -sy / 2, sx / 2, sy / 2, ch), -sz / 2, sz / 2, 'z', col, Math.min(bevel, sz / 2 - 1e-5));
}

/** 원기둥·원뿔대. axis 방향으로 w0 ~ w1, 반지름 r0 → r1 */
export function cylinder(axis, r0, r1, w0, w1, segs, col, opts = {}) {
  const map = AXES[axis];
  const m = new Mesh();
  const smooth = opts.smooth !== false;
  const slope = (r0 - r1) / (w1 - w0 || 1);
  const ring = (r, w) => circle(r, segs, 0, 0, opts.phase || 0).map(([a, b]) => map(a, b, w));
  const A = ring(r0, w0), B = ring(r1, w1);
  for (let i = 0; i < segs; i++) {
    const j = (i + 1) % segs;
    const ang = (k) => (opts.phase || 0) + (k / segs) * Math.PI * 2;
    const nrm = (a) => norm(map(Math.cos(a), Math.sin(a), slope));
    if (smooth) m.face([A[i], A[j], B[j], B[i]], [nrm(ang(i)), nrm(ang(j)), nrm(ang(j)), nrm(ang(i))], col);
    else m.face([A[i], A[j], B[j], B[i]], nrm(ang(i + 0.5)), col);
  }
  if (opts.caps !== false) {
    const dir = Math.sign(w1 - w0) || 1;
    if (r0 > 0) m.face(A, map(0, 0, -dir), col);
    if (r1 > 0) m.face(B, map(0, 0, dir), col);
  }
  return m;
}

/**
 * 회전체: 단면 [[r, w], ...]을 axis 둘레로 돌려요 (총열 끝, 드론 몸통, 관절).
 * smooth: 단면 꺾임도 부드럽게. 아니면 고리마다 각진 띠가 생겨요.
 */
export function lathe(axis, profile, segs, col, opts = {}) {
  const map = AXES[axis];
  const m = new Mesh();
  const segN = [];
  for (let k = 0; k < profile.length - 1; k++) {
    const [r0, w0] = profile[k], [r1, w1] = profile[k + 1];
    const dr = r1 - r0, dw = w1 - w0;
    const l = Math.hypot(dr, dw) || 1;
    segN.push([dw / l, -dr / l]); // (반지름 방향, 축 방향)
  }
  const vN = profile.map((_, k) => {
    const a = segN[Math.max(0, k - 1)], b = segN[Math.min(segN.length - 1, k)];
    const s = [a[0] + b[0], a[1] + b[1]];
    const l = Math.hypot(s[0], s[1]) || 1;
    return [s[0] / l, s[1] / l];
  });
  const P = (r, w, i) => {
    const a = (opts.phase || 0) + (i / segs) * Math.PI * 2;
    return map(Math.cos(a) * r, Math.sin(a) * r, w);
  };
  const N = (n2, i) => {
    const a = (opts.phase || 0) + (i / segs) * Math.PI * 2;
    return norm(map(Math.cos(a) * n2[0], Math.sin(a) * n2[0], n2[1]));
  };
  for (let k = 0; k < profile.length - 1; k++) {
    const [r0, w0] = profile[k], [r1, w1] = profile[k + 1];
    if (r0 === 0 && r1 === 0) continue;
    const n0 = opts.smooth ? vN[k] : segN[k], n1 = opts.smooth ? vN[k + 1] : segN[k];
    for (let i = 0; i < segs; i++) {
      const j = i + 1;
      const pts = [P(r0, w0, i), P(r0, w0, j), P(r1, w1, j), P(r1, w1, i)];
      const ns = [N(n0, i), N(n0, j), N(n1, j), N(n1, i)];
      if (r0 === 0) m.face([pts[0], pts[2], pts[3]], [ns[0], ns[2], ns[3]], col);
      else if (r1 === 0) m.face([pts[0], pts[1], pts[2]], [ns[0], ns[1], ns[2]], col);
      else m.face(pts, ns, col);
    }
  }
  return m;
}

/** 구 (가운데 기준) */
export function sphere(r, segs, rings, col) {
  const prof = [];
  for (let k = 0; k <= rings; k++) {
    const a = -Math.PI / 2 + (k / rings) * Math.PI;
    prof.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  prof[0][0] = 0;
  prof[rings][0] = 0;
  return lathe('y', prof, segs, col, { smooth: true });
}

/** 여러 메시를 하나로 */
export function join(...ms) {
  const out = new Mesh();
  for (const m of ms.flat()) if (m) out.merge(m);
  return out;
}
