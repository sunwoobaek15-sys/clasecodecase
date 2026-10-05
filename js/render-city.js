/* SAVE CITY — 아이소메트릭 도시 그림 (SVG). 이미지 파일 없이 코드로 건물·장식·탈것을 그립니다. */
(function (root) {
  'use strict';
  const SC = (root.SC = root.SC || {});
  const D = SC.data;

  const HW = 32; // 타일 가로 절반
  const HH = 16; // 타일 세로 절반
  const N = D.RULES.GRID;
  const SLAB = 14; // 땅 두께

  /* ---------------- 색 ---------------- */

  function parse(hex) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.replace(/./g, (x) => x + x);
    const v = parseInt(h, 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  function toHex(c) {
    return '#' + c.map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
  }
  function shade(hex, amt) {
    return toHex(parse(hex).map((x) => (amt >= 0 ? x + (255 - x) * amt : x * (1 + amt))));
  }
  function mix(a, b, t) {
    const x = parse(a);
    const y = parse(b);
    return toHex(x.map((v, i) => v + (y[i] - v) * t));
  }

  const BASE = {
    sky: ['#cdeaff', '#f3faff'],
    ground: {
      grass: ['#88d571', '#7dcc66'],
      paved: ['#e3e8ef', '#d9dfe8'],
      plaza: ['#ecdcc2', '#e2d0b4'],
      concrete: ['#c9cdd5', '#bec3cc'],
      neon: ['#353d80', '#2f3775'],
    },
    tuft: '#5daf4b',
    road: '#5a6378',
    roadLine: '#f6f8fc',
    curb: '#cfd5df',
    water: '#5ac4f1',
    waterHi: '#bdeeff',
    edgeL: '#a06d47',
    edgeR: '#7f5436',
    lip: '#6cbc57',
    canopy: ['#48b45b', '#63ca6d', '#36994b'],
    trunk: '#8a5a3c',
    wallShade: 0,
    window: '#c4e4ff',
    lit: null,
    snow: false,
    night: false,
    gold: false,
    petals: false,
  };

  const SKINS = {
    default: {},
    spring: { sky: ['#ffe2ef', '#fff6fa'], ground: { grass: ['#a1e18e', '#95d881'] }, canopy: ['#f5a3c5', '#fbc2d9', '#ea8bb2'], tuft: '#f19fc0', petals: true },
    autumn: { sky: ['#ffe3c2', '#fff5e8'], ground: { grass: ['#cfc066', '#c4b45a'] }, canopy: ['#ee8936', '#f5ad46', '#d45e29'], tuft: '#b58d2e', lip: '#b9a24e' },
    winter: {
      sky: ['#d2e2f3', '#f2f7fd'],
      ground: { grass: ['#f4f8fd', '#eaf1f9'], paved: ['#eef3f8', '#e6edf4'], plaza: ['#f3f0ea', '#ebe7de'], concrete: ['#e5eaf0', '#dce2ea'] },
      canopy: ['#e6f2f7', '#ffffff', '#cde2eb'],
      tuft: '#d3e3f1',
      lip: '#ffffff',
      road: '#737c8f',
      snow: true,
    },
    night: {
      sky: ['#0b1238', '#29346f'],
      ground: { grass: ['#2e6b3c', '#296136'], paved: ['#3c4360', '#363c59'], plaza: ['#4b4459', '#453e52'], concrete: ['#3b404f', '#353a49'], neon: ['#1c204b', '#181c44'] },
      road: '#242939',
      roadLine: '#8e98ba',
      water: '#1e4b78',
      waterHi: '#5292c9',
      edgeL: '#4b3525',
      edgeR: '#3b291c',
      lip: '#2e6b3c',
      canopy: ['#2b6b3a', '#357c45', '#235b30'],
      tuft: '#3d7e49',
      wallShade: -0.42,
      lit: '#ffd76a',
      night: true,
    },
    gold: {
      sky: ['#fff0bd', '#fffaea'],
      ground: { grass: ['#e8cf69', '#ddc35c'], paved: ['#f4e7bf', '#ecdcab'] },
      road: '#8d6e27',
      roadLine: '#fff2b9',
      edgeL: '#b78627',
      edgeR: '#966b1c',
      lip: '#e1c050',
      canopy: ['#dfb23b', '#f1cb53', '#c89b26'],
      tuft: '#caa63b',
      gold: true,
    },
  };

  function palette(skinId) {
    const s = SKINS[skinId] || {};
    return Object.assign({}, BASE, s, { ground: Object.assign({}, BASE.ground, s.ground || {}) });
  }

  function wallC(pal, c) {
    if (pal.gold) c = mix(c, '#f2c94c', 0.3);
    if (pal.wallShade) c = shade(c, pal.wallShade);
    return c;
  }
  function roofC(pal, c) {
    if (pal.snow) return mix(c, '#ffffff', 0.72);
    if (pal.gold) c = mix(c, '#f2b705', 0.35);
    if (pal.wallShade) c = shade(c, pal.wallShade * 0.8);
    return c;
  }
  function winC(pal, c) {
    return pal.lit || c || pal.window;
  }

  /* ---------------- 그리기 도구 ---------------- */

  const r1 = (n) => Math.round(n * 10) / 10;
  const pt = (p) => r1(p[0]) + ',' + r1(p[1]);

  function Painter(c, r, pal) {
    this.c = c;
    this.r = r;
    this.pal = pal;
    this.parts = [];
    this.minY = Infinity;
  }
  Painter.prototype.P = function (u, v, z) {
    const x = (this.c + u - this.r - v) * HW;
    const y = (this.c + u + this.r + v) * HH - (z || 0);
    if (y < this.minY) this.minY = y;
    return [x, y];
  };
  Painter.prototype.add = function (s) {
    this.parts.push(s);
  };
  Painter.prototype.poly = function (pts, fill, attrs) {
    this.parts.push('<polygon points="' + pts.map(pt).join(' ') + '" fill="' + fill + '"' + (attrs ? ' ' + attrs : '') + '/>');
  };
  Painter.prototype.circle = function (p, r, fill, attrs) {
    this.minY = Math.min(this.minY, p[1] - r);
    this.parts.push('<circle cx="' + r1(p[0]) + '" cy="' + r1(p[1]) + '" r="' + r1(r) + '" fill="' + fill + '"' + (attrs ? ' ' + attrs : '') + '/>');
  };
  Painter.prototype.ellipse = function (p, rx, ry, fill, attrs) {
    this.minY = Math.min(this.minY, p[1] - ry);
    this.parts.push('<ellipse cx="' + r1(p[0]) + '" cy="' + r1(p[1]) + '" rx="' + r1(rx) + '" ry="' + r1(ry) + '" fill="' + fill + '"' + (attrs ? ' ' + attrs : '') + '/>');
  };
  Painter.prototype.line = function (a, b, stroke, w, attrs) {
    this.minY = Math.min(this.minY, a[1], b[1]);
    this.parts.push('<line x1="' + r1(a[0]) + '" y1="' + r1(a[1]) + '" x2="' + r1(b[0]) + '" y2="' + r1(b[1]) + '" stroke="' + stroke + '" stroke-width="' + w + '" stroke-linecap="round"' + (attrs ? ' ' + attrs : '') + '/>');
  };
  Painter.prototype.text = function (p, s, size, attrs) {
    this.minY = Math.min(this.minY, p[1] - size);
    this.parts.push('<text x="' + r1(p[0]) + '" y="' + r1(p[1]) + '" font-size="' + size + '" text-anchor="middle" dominant-baseline="central"' + (attrs ? ' ' + attrs : '') + '>' + s + '</text>');
  };
  Painter.prototype.svg = function () {
    return this.parts.join('');
  };

  /** 직육면체: 바닥 (u0,v0)~(u0+du,v0+dv), 높이 z~z+h. 보이는 면(왼쪽 앞, 오른쪽 앞, 윗면)만 그림 */
  Painter.prototype.block = function (u0, v0, du, dv, z, h, color, o) {
    o = o || {};
    const u1 = u0 + du;
    const v1 = v0 + dv;
    const z1 = z + h;
    const P = this.P.bind(this);
    this.poly([P(u0, v1, z), P(u1, v1, z), P(u1, v1, z1), P(u0, v1, z1)], o.left || color);
    this.poly([P(u1, v1, z), P(u1, v0, z), P(u1, v0, z1), P(u1, v1, z1)], o.right || shade(color, -0.17));
    if (!o.noTop) this.poly([P(u0, v0, z1), P(u1, v0, z1), P(u1, v1, z1), P(u0, v1, z1)], o.top || shade(color, 0.18));
    return { u0, v0, u1, v1, du, dv, z, z1, h };
  };
  /** 왼쪽 앞면(+v 면) 위 사각형: s는 면의 가로 위치 0~1, t는 높이(px) */
  Painter.prototype.onLeft = function (b, s1, s2, t1, t2, fill, attrs) {
    const P = this.P.bind(this);
    const ua = b.u0 + s1 * b.du;
    const ub = b.u0 + s2 * b.du;
    this.poly([P(ua, b.v1, b.z + t1), P(ub, b.v1, b.z + t1), P(ub, b.v1, b.z + t2), P(ua, b.v1, b.z + t2)], fill, attrs);
  };
  /** 오른쪽 앞면(+u 면) 위 사각형: s=0이 앞 모서리 */
  Painter.prototype.onRight = function (b, s1, s2, t1, t2, fill, attrs) {
    const P = this.P.bind(this);
    const va = b.v1 - s1 * b.dv;
    const vb = b.v1 - s2 * b.dv;
    this.poly([P(b.u1, va, b.z + t1), P(b.u1, vb, b.z + t1), P(b.u1, vb, b.z + t2), P(b.u1, va, b.z + t2)], fill, attrs);
  };
  /** 창문 격자 */
  Painter.prototype.windows = function (b, face, rows, cols, o) {
    o = Object.assign({ m: 0.14, gap: 0.1, t0: 4, rowH: 9, winH: 5, color: '#c4e4ff' }, o);
    const w = (1 - 2 * o.m - (cols - 1) * o.gap) / cols;
    const fn = face === 'left' ? this.onLeft : this.onRight;
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const s1 = o.m + j * (w + o.gap);
        const t1 = o.t0 + i * o.rowH;
        if (t1 + o.winH > b.h - 1) continue;
        fn.call(this, b, s1, s1 + w, t1, t1 + o.winH, o.color);
      }
    }
  };
  /** 박공지붕 (용마루가 u 방향) */
  Painter.prototype.gable = function (b, rh, color, gableWall, over) {
    over = over == null ? 0.05 : over;
    const P = this.P.bind(this);
    const u0 = b.u0 - over;
    const u1 = b.u1 + over;
    const v0 = b.v0 - over;
    const v1 = b.v1 + over;
    const vc = (b.v0 + b.v1) / 2;
    const z = b.z1;
    this.poly([P(u0, v0, z), P(u1, v0, z), P(u1, vc, z + rh), P(u0, vc, z + rh)], shade(color, -0.28));
    this.poly([P(b.u1, b.v1, z), P(b.u1, b.v0, z), P(b.u1, vc, z + rh)], gableWall);
    this.poly([P(u0, v1, z), P(u1, v1, z), P(u1, vc, z + rh), P(u0, vc, z + rh)], color);
    this.poly([P(u1, v1, z), P(u1, v1, z - 1.6), P(u0, v1, z - 1.6), P(u0, v1, z)], shade(color, -0.25));
    return { ridgeZ: z + rh, vc };
  };
  /** 피라미드 지붕 */
  Painter.prototype.pyramid = function (b, rh, color, over) {
    over = over || 0;
    const P = this.P.bind(this);
    const u0 = b.u0 - over;
    const u1 = b.u1 + over;
    const v0 = b.v0 - over;
    const v1 = b.v1 + over;
    const apex = P((b.u0 + b.u1) / 2, (b.v0 + b.v1) / 2, b.z1 + rh);
    const z = b.z1;
    this.poly([P(u0, v0, z), P(u1, v0, z), apex], shade(color, -0.3));
    this.poly([P(u0, v1, z), P(u0, v0, z), apex], shade(color, -0.3));
    this.poly([P(u0, v1, z), P(u1, v1, z), apex], color);
    this.poly([P(u1, v1, z), P(u1, v0, z), apex], shade(color, -0.18));
    return apex;
  };
  /** 면에서 바깥으로 비스듬히 튀어나온 줄무늬 차양 */
  Painter.prototype.awning = function (b, face, zTop, zBot, out, colors, n) {
    const P = this.P.bind(this);
    for (let j = 0; j < n; j++) {
      const s1 = j / n;
      const s2 = (j + 1) / n;
      const fill = colors[j % colors.length];
      if (face === 'left') {
        const ua = b.u0 + s1 * b.du;
        const ub = b.u0 + s2 * b.du;
        this.poly([P(ua, b.v1, b.z + zTop), P(ub, b.v1, b.z + zTop), P(ub, b.v1 + out, b.z + zBot), P(ua, b.v1 + out, b.z + zBot)], fill);
      } else {
        const va = b.v1 - s1 * b.dv;
        const vb = b.v1 - s2 * b.dv;
        this.poly([P(b.u1, va, b.z + zTop), P(b.u1, vb, b.z + zTop), P(b.u1 + out, vb, b.z + zBot), P(b.u1 + out, va, b.z + zBot)], shade(fill, -0.12));
      }
    }
  };
  Painter.prototype.shadow = function (k, u, v) {
    const p = this.P(u == null ? 0.56 : u, v == null ? 0.56 : v, 0);
    this.ellipse(p, 27 * k, 13 * k, '#000', 'opacity=".13"');
  };
  /** 지붕 위에 떠 있는 동그란 간판 */
  Painter.prototype.badge = function (z, emoji, ring) {
    const p = this.P(0.5, 0.5, z);
    this.circle(p, 7.5, '#ffffff', 'stroke="' + (ring || '#2f6bff') + '" stroke-width="1.6"');
    this.text([p[0], p[1] + 0.5], emoji, 8.5);
  };

  /* ---------------- 장식 ---------------- */

  function tree(p, u, v, s, colors) {
    s = s || 1;
    const pal = p.pal;
    colors = colors || pal.canopy;
    const g = p.P(u, v, 0);
    p.ellipse([g[0] + 3 * s, g[1] + 1.5 * s], 10 * s, 4.5 * s, '#000', 'opacity=".14"');
    p.add('<rect x="' + r1(g[0] - 1.8 * s) + '" y="' + r1(g[1] - 11 * s) + '" width="' + r1(3.6 * s) + '" height="' + r1(11 * s) + '" rx="1" fill="' + pal.trunk + '"/>');
    p.circle([g[0], g[1] - 20 * s], 10 * s, colors[0]);
    p.circle([g[0] - 5.5 * s, g[1] - 14 * s], 7.5 * s, colors[2]);
    p.circle([g[0] + 5.5 * s, g[1] - 15 * s], 7.5 * s, colors[1]);
    p.circle([g[0] - 3 * s, g[1] - 24 * s], 3.2 * s, shade(colors[1], 0.35), 'opacity=".8"');
    if (pal.snow) p.ellipse([g[0], g[1] - 27 * s], 7 * s, 3.2 * s, '#ffffff');
    if (pal.petals && colors === pal.canopy) {
      p.circle([g[0] + 9 * s, g[1] - 3 * s], 1.2 * s, colors[0]);
      p.circle([g[0] - 8 * s, g[1] - 1 * s], 1.1 * s, colors[1]);
    }
  }

  function lampPost(p, u, v, s) {
    s = s || 1;
    const g = p.P(u, v, 0);
    const lit = p.pal.night;
    p.line([g[0], g[1]], [g[0], g[1] - 26 * s], '#4b5368', 2 * s);
    p.line([g[0], g[1] - 26 * s], [g[0] + 4 * s, g[1] - 28 * s], '#4b5368', 1.6 * s);
    if (lit) p.circle([g[0] + 4.5 * s, g[1] - 27 * s], 9 * s, '#ffe17a', 'opacity=".35"');
    p.circle([g[0] + 4.5 * s, g[1] - 27 * s], 3 * s, lit ? '#fff2b0' : '#ffd84d');
    p.ellipse([g[0], g[1]], 3 * s, 1.4 * s, '#4b5368');
  }

  function flowerBed(p, u0, v0, du, dv) {
    p.block(u0, v0, du, dv, 0, 3, '#8a5a3c', { top: '#6f8f3a' });
    const colors = ['#ff6b8a', '#ffd93b', '#b48cff', '#ff9f43', '#ffffff', '#ff5c5c'];
    let k = 0;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const q = p.P(u0 + du * (0.2 + 0.3 * i), v0 + dv * (0.2 + 0.3 * j), 4.5);
        p.circle(q, 2.2, colors[k++ % colors.length]);
      }
    }
  }

  function pedestal(p, k, h, color) {
    const m = (1 - k) / 2;
    return p.block(m, m, k, k, 0, h, wallC(p.pal, color || '#c9ced8'));
  }

  const DECOR = {
    tree(p) {
      tree(p, 0.5, 0.5, 1.05);
    },
    sakura(p) {
      tree(p, 0.5, 0.5, 1.1, ['#f7a6c7', '#ffd0e2', '#ec8cb4']);
      const g = p.P(0.5, 0.5, 0);
      p.circle([g[0] + 12, g[1] - 4], 1.4, '#f7a6c7');
      p.circle([g[0] - 11, g[1] + 1], 1.3, '#ffd0e2');
      p.circle([g[0] + 6, g[1] + 4], 1.2, '#ec8cb4');
    },
    bench(p) {
      const wood = wallC(p.pal, '#b9773f');
      p.shadow(0.55);
      p.block(0.24, 0.47, 0.06, 0.06, 0, 4, '#5b616f');
      p.block(0.7, 0.47, 0.06, 0.06, 0, 4, '#5b616f');
      p.block(0.22, 0.4, 0.56, 0.2, 4, 2, wood);
      p.block(0.22, 0.36, 0.56, 0.05, 6, 6, shade(wood, -0.08));
      if (p.pal.snow) p.block(0.22, 0.4, 0.56, 0.2, 6, 0.8, '#ffffff');
    },
    lamp(p) {
      lampPost(p, 0.5, 0.5, 1.15);
    },
    flower(p) {
      flowerBed(p, 0.16, 0.16, 0.68, 0.68);
    },
    parasol(p) {
      const g = p.P(0.5, 0.5, 0);
      p.shadow(0.6);
      p.ellipse([g[0], g[1] - 7], 10, 4.5, wallC(p.pal, '#ffffff'));
      p.line([g[0], g[1]], [g[0], g[1] - 7], '#8a5a3c', 2);
      p.line([g[0], g[1] - 7], [g[0], g[1] - 27], '#6b7280', 1.6);
      const c1 = wallC(p.pal, '#ff5c5c');
      p.add('<path d="M' + r1(g[0] - 17) + ' ' + r1(g[1] - 21) + ' Q' + r1(g[0]) + ' ' + r1(g[1] - 40) + ' ' + r1(g[0] + 17) + ' ' + r1(g[1] - 21) + ' Z" fill="' + c1 + '"/>');
      p.add('<path d="M' + r1(g[0] - 6) + ' ' + r1(g[1] - 22) + ' Q' + r1(g[0]) + ' ' + r1(g[1] - 37) + ' ' + r1(g[0] + 6) + ' ' + r1(g[1] - 22) + ' Z" fill="#ffffff" opacity=".85"/>');
      p.minY = Math.min(p.minY, g[1] - 34);
      p.circle([g[0] - 8, g[1] - 9], 2.6, '#7a4b2a');
      p.circle([g[0] + 8, g[1] - 9], 2.6, '#7a4b2a');
    },
    fountain(p) {
      const g = p.P(0.5, 0.5, 0);
      p.ellipse([g[0], g[1] + 1], 22, 10.5, wallC(p.pal, '#b8bfcc'));
      p.ellipse([g[0], g[1] - 1], 22, 10.5, wallC(p.pal, '#d9dee7'));
      p.ellipse([g[0], g[1] - 1], 18, 8, p.pal.snow ? '#dff3ff' : p.pal.water);
      p.add('<rect x="' + r1(g[0] - 3) + '" y="' + r1(g[1] - 14) + '" width="6" height="13" rx="2" fill="' + wallC(p.pal, '#c9ced8') + '"/>');
      p.ellipse([g[0], g[1] - 14], 7, 3, wallC(p.pal, '#e3e7ee'));
      p.add('<path class="spray" d="M' + r1(g[0]) + ' ' + r1(g[1] - 14) + ' C' + r1(g[0] - 2) + ' ' + r1(g[1] - 30) + ' ' + r1(g[0] - 10) + ' ' + r1(g[1] - 26) + ' ' + r1(g[0] - 12) + ' ' + r1(g[1] - 4) + ' M' + r1(g[0]) + ' ' + r1(g[1] - 14) + ' C' + r1(g[0] + 2) + ' ' + r1(g[1] - 30) + ' ' + r1(g[0] + 10) + ' ' + r1(g[1] - 26) + ' ' + r1(g[0] + 12) + ' ' + r1(g[1] - 4) + '" stroke="' + p.pal.waterHi + '" stroke-width="2.2" fill="none" stroke-linecap="round"/>');
      p.minY = Math.min(p.minY, g[1] - 30);
      p.circle([g[0], g[1] - 29], 2.4, p.pal.waterHi);
    },
    neon(p) {
      const g = p.P(0.5, 0.5, 0);
      p.shadow(0.5);
      p.line([g[0] - 7, g[1]], [g[0] - 7, g[1] - 14], '#4b5368', 2);
      p.line([g[0] + 7, g[1]], [g[0] + 7, g[1] - 14], '#4b5368', 2);
      p.add('<rect x="' + r1(g[0] - 16) + '" y="' + r1(g[1] - 32) + '" width="32" height="18" rx="5" fill="#1d1b3a"/>');
      p.add('<rect x="' + r1(g[0] - 14) + '" y="' + r1(g[1] - 30) + '" width="28" height="14" rx="4" fill="none" stroke="#ff4fd8" stroke-width="1.6"/>');
      p.text([g[0], g[1] - 22.6], 'SALE', 8, 'fill="#7ff3ff" font-weight="700" font-family="system-ui,sans-serif"');
      p.minY = Math.min(p.minY, g[1] - 32);
    },
    statue(p) {
      const b = pedestal(p, 0.42, 9, '#c9ced8');
      const g = p.P(0.5, 0.5, b.z1);
      const bronze = p.pal.snow ? '#9db7c4' : '#4fa3a0';
      p.add('<path d="M' + r1(g[0] - 6) + ' ' + r1(g[1]) + ' L' + r1(g[0] - 4) + ' ' + r1(g[1] - 15) + ' L' + r1(g[0] + 4) + ' ' + r1(g[1] - 15) + ' L' + r1(g[0] + 6) + ' ' + r1(g[1]) + ' Z" fill="' + bronze + '"/>');
      p.line([g[0] + 4, g[1] - 13], [g[0] + 9, g[1] - 22], bronze, 2.6);
      p.circle([g[0], g[1] - 19], 4.2, shade(bronze, 0.1));
      p.circle([g[0] + 9.5, g[1] - 23.5], 2.2, '#ffd84d');
    },
    golden_piggy(p) {
      const b = pedestal(p, 0.5, 6, '#e9d7a8');
      const g = p.P(0.5, 0.5, b.z1);
      const gold = '#f5b301';
      const hi = '#ffd75a';
      p.add('<rect x="' + r1(g[0] - 8) + '" y="' + r1(g[1] - 6) + '" width="3" height="6" rx="1" fill="' + shade(gold, -0.2) + '"/><rect x="' + r1(g[0] + 5) + '" y="' + r1(g[1] - 6) + '" width="3" height="6" rx="1" fill="' + shade(gold, -0.2) + '"/>');
      p.ellipse([g[0], g[1] - 13], 13, 10, gold);
      p.ellipse([g[0] - 3, g[1] - 16], 6, 4, hi, 'opacity=".8"');
      p.add('<path d="M' + r1(g[0] + 3) + ' ' + r1(g[1] - 21) + ' l3 -5 l3 5 Z" fill="' + shade(gold, -0.12) + '"/>');
      p.ellipse([g[0] + 12.5, g[1] - 12], 3.6, 3, shade(gold, -0.08));
      p.circle([g[0] + 12, g[1] - 12], 0.8, '#7a4f00');
      p.circle([g[0] + 6, g[1] - 16], 1.1, '#3a2600');
      p.line([g[0] - 4, g[1] - 22], [g[0] + 1, g[1] - 22], '#7a4f00', 1.4);
      p.circle([g[0] - 15, g[1] - 26], 1.6, '#ffffff');
      p.circle([g[0] + 15, g[1] - 30], 1.2, '#fff7c0');
    },
    trophy(p) {
      const b = pedestal(p, 0.46, 8, '#5b616f');
      const g = p.P(0.5, 0.5, b.z1);
      const gold = '#f5b301';
      p.add('<rect x="' + r1(g[0] - 6) + '" y="' + r1(g[1] - 4) + '" width="12" height="4" rx="1" fill="' + shade(gold, -0.2) + '"/>');
      p.add('<rect x="' + r1(g[0] - 1.6) + '" y="' + r1(g[1] - 10) + '" width="3.2" height="6" fill="' + gold + '"/>');
      p.add('<path d="M' + r1(g[0] - 9) + ' ' + r1(g[1] - 26) + ' h18 q0 15 -9 16 q-9 -1 -9 -16 Z" fill="' + gold + '"/>');
      p.add('<path d="M' + r1(g[0] - 9) + ' ' + r1(g[1] - 23) + ' q-6 0 -5 5 q1 4 6 4 M' + r1(g[0] + 9) + ' ' + r1(g[1] - 23) + ' q6 0 5 5 q-1 4 -6 4" stroke="' + gold + '" stroke-width="2" fill="none"/>');
      p.ellipse([g[0] - 3, g[1] - 21], 2, 4, '#ffe58f', 'opacity=".8"');
      p.minY = Math.min(p.minY, g[1] - 27);
    },
    rainbow(p) {
      const g = p.P(0.5, 0.5, 0);
      const colors = ['#ff5c5c', '#ff9f43', '#ffd93b', '#4cd27e', '#4aa8ff', '#8b5cf6'];
      colors.forEach((c, i) => {
        const R = 20 - i * 2.6;
        p.add('<path d="M' + r1(g[0] - R) + ' ' + r1(g[1] - 2) + ' A' + R + ' ' + R + ' 0 0 1 ' + r1(g[0] + R) + ' ' + r1(g[1] - 2) + '" stroke="' + c + '" stroke-width="2.8" fill="none"/>');
      });
      p.minY = Math.min(p.minY, g[1] - 24);
      p.circle([g[0] - 19, g[1] - 1], 5, '#ffffff');
      p.circle([g[0] - 14, g[1]], 4, '#f1f5fb');
      p.circle([g[0] + 19, g[1] - 1], 5, '#ffffff');
      p.circle([g[0] + 14, g[1]], 4, '#f1f5fb');
    },
    star_monument(p) {
      pedestal(p, 0.56, 6, '#c9ced8');
      const b2 = p.block(0.33, 0.33, 0.34, 0.34, 6, 14, wallC(p.pal, '#e3e7ee'));
      const g = p.P(0.5, 0.5, b2.z1 + 12);
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const R = i % 2 ? 4.6 : 11;
        pts.push([g[0] + R * Math.cos(a), g[1] + R * Math.sin(a)]);
      }
      p.circle(g, 14, '#ffe17a', 'opacity=".35"');
      p.poly(pts, '#ffd23f', 'stroke="#f5a700" stroke-width="1"');
    },
  };

  /* ---------------- 건물 (Lv.1~5) ---------------- */

  const BUILD = {
    house(p, L) {
      const pal = p.pal;
      const wall = wallC(pal, ['#fff3de', '#fff1e4', '#f1f6ff', '#fff0f6', '#fffbe6'][L - 1]);
      const roof = roofC(pal, ['#ef5b5b', '#ff8a3d', '#22aea0', '#7b6cf6', '#e9ad06'][L - 1]);
      const win = winC(pal);
      const k = 0.6 + 0.03 * (L - 1);
      const m = (1 - k) / 2;
      const floors = L >= 3 ? 2 : 1;
      const h = 14 + (floors - 1) * 11;
      p.shadow(0.62 + 0.03 * L);
      const b = p.block(m, m, k, k, 0, h, wall);
      p.onLeft(b, 0.58, 0.8, 0, 8.5, wallC(pal, '#8a5a3c'));
      p.circle(p.P(b.u0 + 0.76 * b.du, b.v1, 4.5), 0.7, '#ffd84d');
      for (let f = 0; f < floors; f++) {
        p.onLeft(b, 0.14, 0.4, 3.5 + f * 11, 8.5 + f * 11, win);
        p.onRight(b, 0.16, 0.4, 3.5 + f * 11, 8.5 + f * 11, win);
        p.onRight(b, 0.6, 0.84, 3.5 + f * 11, 8.5 + f * 11, win);
      }
      if (floors === 2) p.onLeft(b, 0.52, 0.86, 14.5, 19.5, win);
      if (L >= 3) {
        p.onLeft(b, 0.1, 0.44, 2, 3.2, '#5fb04d');
        p.circle(p.P(b.u0 + 0.18 * b.du, b.v1 + 0.01, 3.4), 1, '#ff6b8a');
        p.circle(p.P(b.u0 + 0.3 * b.du, b.v1 + 0.01, 3.4), 1, '#ffd93b');
      }
      const g = p.gable(b, 11 + L, roof, shade(wall, -0.17));
      if (L >= 2) {
        const cz = b.z1 + (g.ridgeZ - b.z1) * 0.35;
        p.block(b.u0 + k * 0.62, b.v1 - k * 0.2, 0.08, 0.08, cz, 9, wallC(pal, '#b5523b'), { top: '#5b4636' });
      }
      if (L >= 4) {
        const bal = p.block(b.u0 + k * 0.1, b.v1, k * 0.4, 0.07, 11, 1.5, wallC(pal, '#ffffff'));
        p.onLeft(bal, 0, 1, 1.5, 4, wallC(pal, '#ffffff'), 'opacity=".75"');
      }
      if (L >= 5) {
        const top = p.P(b.u0 + k * 0.5, g.vc, g.ridgeZ);
        p.line(top, [top[0], top[1] - 13], '#6b7280', 1.2);
        p.poly([[top[0], top[1] - 13], [top[0] + 8, top[1] - 10.5], [top[0], top[1] - 8]], '#ff5c5c');
        p.text([top[0] - 6, top[1] - 12], '★', 7, 'fill="#ffd23f"');
      }
    },

    shop(p, L, opts) {
      opts = opts || {};
      const pal = p.pal;
      const wall = wallC(pal, opts.wall || '#ffffff');
      const awn = (opts.awning || ['#2f6bff', '#ffffff']).map((c) => wallC(pal, c));
      const win = winC(pal);
      const k = 0.7 + 0.02 * (L - 1);
      const m = (1 - k) / 2;
      const floors = L >= 3 ? 2 : 1;
      const h = 15 + (floors - 1) * 10 + (L >= 4 ? 3 : 0);
      p.shadow(0.7 + 0.03 * L);
      const b = p.block(m, m, k, k, 0, h, wall, { top: roofC(pal, opts.roof || '#d7dde8') });
      p.onLeft(b, 0.08, 0.92, 1.5, 9, win);
      p.onLeft(b, 0.36, 0.38, 1.5, 9, wall);
      p.onLeft(b, 0.64, 0.66, 1.5, 9, wall);
      p.onRight(b, 0.32, 0.62, 0, 9, wallC(pal, opts.door || '#8a5a3c'));
      if (floors === 2) {
        p.windows(b, 'left', 1, 3, { t0: 15, winH: 5, color: win });
        p.windows(b, 'right', 1, 2, { t0: 15, winH: 5, color: win, m: 0.2, gap: 0.2 });
      }
      p.awning(b, 'left', 12.5, 9.5, 0.12, awn, 6);
      if (L >= 2) p.awning(b, 'right', 12.5, 9.5, 0.12, awn, 6);
      if (L >= 4) {
        p.block(b.u0 + 0.08, b.v0 + 0.08, 0.14, 0.14, h, 3, '#8a5a3c', { top: '#5fb04d' });
        p.block(b.u1 - 0.22, b.v0 + 0.1, 0.12, 0.12, h, 5, '#aab2c0');
      }
      p.badge(h + 10, opts.emoji || '🏪', L >= 5 ? '#f5b301' : opts.ring || '#2f6bff');
      if (L >= 5) {
        const t = p.P(b.u0 + k * 0.5, b.v1, h);
        p.text([t[0] - 14, t[1] - 4], '★', 6, 'fill="#ffd23f"');
      }
    },

    cafe(p, L) {
      BUILD.shop(p, L, { wall: '#f7e3c6', awning: ['#8b5a3c', '#fff4e3'], emoji: '☕', ring: '#8b5a3c', roof: '#c9a27a', door: '#5b3a24' });
    },

    park(p, L) {
      const pal = p.pal;
      const grass = pal.snow ? '#eef5fb' : pal.gold ? '#e2c65d' : shade(pal.ground.grass[0], -0.05);
      const b = p.block(0.05, 0.05, 0.9, 0.9, 0, 3, shade(grass, -0.18), { top: grass });
      const path = wallC(pal, '#ead7b5');
      const P = p.P.bind(p);
      p.poly([P(0.42, 0.05, 3.1), P(0.58, 0.05, 3.1), P(0.58, 0.95, 3.1), P(0.42, 0.95, 3.1)], path);
      if (L >= 2) p.poly([P(0.05, 0.42, 3.1), P(0.95, 0.42, 3.1), P(0.95, 0.58, 3.1), P(0.05, 0.58, 3.1)], path);
      const items = [];
      items.push(['tree', 0.2, 0.2]);
      items.push(['tree', 0.22, 0.8]);
      if (L >= 2) items.push(['tree', 0.8, 0.22]);
      if (L >= 3) items.push(['fountain', 0.5, 0.5]);
      if (L >= 4) items.push(['flower', 0.66, 0.66]);
      if (L >= 4) items.push(['tree', 0.32, 0.34]);
      if (L >= 5) items.push(['lamp', 0.84, 0.6]);
      if (L >= 5) items.push(['lamp', 0.6, 0.84]);
      items.sort((a, c) => a[1] + a[2] - (c[1] + c[2]));
      for (const it of items) {
        if (it[0] === 'tree') tree(p, it[1], it[2], 0.6);
        else if (it[0] === 'lamp') lampPost(p, it[1], it[2], 0.75);
        else if (it[0] === 'flower') flowerBed(p, it[1], it[2], 0.22, 0.22);
        else if (it[0] === 'fountain') {
          const g = P(0.5, 0.5, 3);
          p.ellipse(g, 11, 5.2, wallC(pal, '#d9dee7'));
          p.ellipse(g, 8.6, 3.8, pal.snow ? '#dff3ff' : pal.water);
          p.line(g, [g[0], g[1] - 9], pal.waterHi, 2);
          p.circle([g[0], g[1] - 10], 2, pal.waterHi);
        }
      }
      if (L >= 5) p.badge(30, '🌳', '#3dbe6b');
      return b;
    },

    market(p, L) {
      const pal = p.pal;
      const wall = wallC(pal, '#eefaf2');
      const win = winC(pal);
      const k = 0.84;
      const m = (1 - k) / 2;
      const h = 18 + (L - 1) * 3;
      p.shadow(0.9);
      const b = p.block(m, m, k, k, 0, h, wall, { top: roofC(pal, '#cfd6e0') });
      p.onLeft(b, 0, 1, h - 5, h, wallC(pal, '#2fbf71'));
      p.onRight(b, 0, 1, h - 5, h, wallC(pal, '#27a862'));
      p.onLeft(b, 0.1, 0.9, 1.5, 10, win);
      for (let i = 1; i < 5; i++) p.onLeft(b, 0.1 + i * 0.16 - 0.01, 0.1 + i * 0.16 + 0.01, 1.5, 10, wall);
      p.onRight(b, 0.12, 0.88, 2, 9, win, 'opacity=".9"');
      if (L >= 3) {
        p.block(b.u0 + 0.1, b.v0 + 0.1, 0.16, 0.12, h, 5, '#aab2c0');
        p.block(b.u0 + 0.32, b.v0 + 0.08, 0.12, 0.12, h, 4, '#aab2c0');
      }
      if (L >= 5) {
        const P = p.P.bind(p);
        for (let i = 0; i < 3; i++) {
          const u = b.u0 + 0.5 + i * 0.1;
          p.poly([P(u, b.v0 + 0.5, h + 0.2), P(u + 0.08, b.v0 + 0.5, h + 0.2), P(u + 0.08, b.v1 - 0.06, h + 0.2), P(u, b.v1 - 0.06, h + 0.2)], '#3156a8');
        }
      }
      p.badge(h + 10, '🛒', '#2fbf71');
    },

    office(p, L) {
      const pal = p.pal;
      const glass = pal.night ? '#3b5aa0' : wallC(pal, '#78adff');
      const k = 0.6;
      const m = (1 - k) / 2;
      const h = 40 + (L - 1) * 12;
      p.shadow(0.72);
      const b = p.block(m, m, k, k, 0, h, glass, { right: shade(glass, -0.2), top: wallC(pal, '#d6e4f7') });
      const band = pal.night ? '#ffd76a' : '#e3f0ff';
      for (let t = 5; t < h - 4; t += 7) {
        p.onLeft(b, 0.06, 0.94, t, t + 3.2, band, 'opacity="' + (pal.night ? '.75' : '.55') + '"');
        p.onRight(b, 0.06, 0.94, t, t + 3.2, band, 'opacity="' + (pal.night ? '.6' : '.4') + '"');
      }
      p.onLeft(b, 0.35, 0.65, 0, 5, wallC(pal, '#2d4f86'));
      p.block(b.u0 + 0.12, b.v0 + 0.12, 0.2, 0.18, h, 5, wallC(pal, '#b7c2d3'));
      if (L >= 3) {
        const c = p.P(b.u0 + 0.42, b.v0 + 0.36, h + 0.3);
        p.ellipse(c, 6.5, 3.2, '#4b5368');
        p.text([c[0], c[1] + 0.2], 'H', 4.5, 'fill="#ffffff" font-weight="700" font-family="system-ui,sans-serif"');
      }
      if (L >= 5) {
        const a = p.P(b.u0 + 0.15, b.v0 + 0.2, h + 5);
        p.line(a, [a[0], a[1] - 16], '#6b7280', 1.4);
        p.circle([a[0], a[1] - 16], 1.8, '#ff4d4d');
      }
    },

    hotel(p, L) {
      const pal = p.pal;
      const wall = wallC(pal, '#f6ead6');
      const win = winC(pal, '#9fcbf5');
      const k = 0.66;
      const m = (1 - k) / 2;
      const h = 50 + (L - 1) * 11;
      p.shadow(0.76);
      const b = p.block(m, m, k, k, 0, h, wall, { top: roofC(pal, '#c0392b') });
      p.windows(b, 'left', Math.floor((h - 8) / 7), 3, { t0: 9, rowH: 7, winH: 3.6, color: win });
      p.windows(b, 'right', Math.floor((h - 8) / 7), 3, { t0: 9, rowH: 7, winH: 3.6, color: win });
      p.onLeft(b, 0.32, 0.68, 0, 6.5, wallC(pal, '#7a4b2a'));
      p.onLeft(b, 0, 1, h - 3, h, wallC(pal, '#c0392b'));
      p.onRight(b, 0, 1, h - 3, h, wallC(pal, '#a83226'));
      p.onRight(b, 0.42, 0.58, h - 26, h - 5, wallC(pal, '#c0392b'));
      const s = p.P(b.u1, b.v1 - 0.5 * b.dv, h - 15.5);
      p.text(s, 'H', 7, 'fill="#ffffff" font-weight="700" font-family="system-ui,sans-serif"');
      if (L >= 3) p.awning(b, 'left', 9, 7, 0.1, [wallC(pal, '#c0392b'), wallC(pal, '#e74c3c')], 4);
      if (L >= 5) {
        const P = p.P.bind(p);
        p.poly([P(b.u0 + 0.1, b.v0 + 0.1, h + 0.2), P(b.u1 - 0.1, b.v0 + 0.1, h + 0.2), P(b.u1 - 0.1, b.v1 - 0.25, h + 0.2), P(b.u0 + 0.1, b.v1 - 0.25, h + 0.2)], pal.snow ? '#dff3ff' : '#58c3f0');
      }
      p.badge(h + 10, '🏨', L >= 5 ? '#f5b301' : '#c0392b');
    },

    mall(p, L) {
      const pal = p.pal;
      const wall = wallC(pal, '#ffe3ef');
      const win = winC(pal);
      const k = 0.88;
      const m = (1 - k) / 2;
      const h = 26 + (L - 1) * 5;
      p.shadow(0.95);
      const b = p.block(m, m, k, k, 0, h, wall, { top: roofC(pal, '#e6d2de') });
      p.onLeft(b, 0.3, 0.7, 0, 12, win);
      p.onLeft(b, 0.49, 0.51, 0, 12, wall);
      p.windows(b, 'left', 1, 4, { t0: 16, winH: 5, color: win, m: 0.08, gap: 0.06 });
      const bannerColors = ['#ff6b8a', '#ffd93b', '#4aa8ff', '#4cd27e'];
      for (let i = 0; i < 4; i++) p.onRight(b, 0.1 + i * 0.22, 0.2 + i * 0.22, 6, h - 4, wallC(pal, bannerColors[i]));
      let top = h;
      if (L >= 3) {
        const b2 = p.block(0.25, 0.25, 0.5, 0.5, h, 12, wallC(pal, '#ffd0e4'), { top: roofC(pal, '#e6d2de') });
        p.windows(b2, 'left', 1, 3, { t0: 3, winH: 5, color: win });
        top = b2.z1;
      }
      if (L >= 5) {
        const c = p.P(0.5, 0.5, top);
        p.add('<path d="M' + r1(c[0] - 12) + ' ' + r1(c[1]) + ' A12 12 0 0 1 ' + r1(c[0] + 12) + ' ' + r1(c[1]) + ' Z" fill="' + (pal.night ? '#ffd76a' : '#bfe6ff') + '" stroke="#ffffff" stroke-width="1"/>');
        p.minY = Math.min(p.minY, c[1] - 12);
        top += 12;
      }
      p.badge(top + 10, '🛍️', '#ff6b8a');
    },

    tower(p, L) {
      const pal = p.pal;
      const glass = pal.night ? '#2f4f8f' : wallC(pal, '#6aa8e8');
      const frame = wallC(pal, '#2d4f86');
      p.shadow(0.76);
      const b1 = p.block(0.2, 0.2, 0.6, 0.6, 0, 44, glass, { right: shade(glass, -0.22), top: frame });
      const lit = pal.night ? '#ffd76a' : '#dff0ff';
      for (let i = 1; i < 6; i++) {
        p.onLeft(b1, i * 0.166 - 0.012, i * 0.166 + 0.012, 3, 42, frame);
        p.onRight(b1, i * 0.166 - 0.012, i * 0.166 + 0.012, 3, 42, frame);
      }
      for (let t = 6; t < 42; t += 9) p.onLeft(b1, 0.04, 0.96, t, t + 2.5, lit, 'opacity=".5"');
      const h2 = 30 + (L - 1) * 14;
      const b2 = p.block(0.28, 0.28, 0.44, 0.44, 44, h2, glass, { right: shade(glass, -0.22), top: frame });
      for (let i = 1; i < 4; i++) {
        p.onLeft(b2, i * 0.25 - 0.015, i * 0.25 + 0.015, 2, h2 - 2, frame);
        p.onRight(b2, i * 0.25 - 0.015, i * 0.25 + 0.015, 2, h2 - 2, frame);
      }
      for (let t = 5; t < h2 - 3; t += 9) p.onRight(b2, 0.04, 0.96, t, t + 2.5, lit, 'opacity=".45"');
      const topZ = 44 + h2;
      if (L >= 5) {
        p.pyramid({ u0: 0.36, v0: 0.36, u1: 0.64, v1: 0.64, z1: topZ }, 12, '#f5b301');
        const a = p.P(0.5, 0.5, topZ + 12);
        p.line(a, [a[0], a[1] - 14], '#c9ced8', 1.4);
        p.circle([a[0], a[1] - 14], 1.8, '#ff4d4d');
      } else {
        const a = p.P(0.5, 0.5, topZ);
        p.line(a, [a[0], a[1] - 10 - L * 2], '#9aa3b5', 1.4);
        p.circle([a[0], a[1] - 10 - L * 2], 1.6, '#ff4d4d');
      }
    },
  };

  /* ---------------- 랜드마크 ---------------- */

  const LANDMARK = {
    monument(p) {
      const pal = p.pal;
      p.shadow(0.7);
      p.block(0.18, 0.18, 0.64, 0.64, 0, 6, wallC(pal, '#cfd5df'));
      p.block(0.28, 0.28, 0.44, 0.44, 6, 5, wallC(pal, '#e3e7ee'));
      const ob = p.block(0.4, 0.4, 0.2, 0.2, 11, 48, wallC(pal, '#f1f3f7'), { right: wallC(pal, '#cfd5df') });
      p.pyramid(ob, 9, '#f5b301');
      p.onLeft(ob, 0.2, 0.8, 34, 38, '#f5b301');
    },
    clocktower(p) {
      const pal = p.pal;
      const brick = wallC(pal, '#c8664b');
      p.shadow(0.72);
      p.block(0.22, 0.22, 0.56, 0.56, 0, 16, brick);
      const s = p.block(0.3, 0.3, 0.4, 0.4, 16, 52, wallC(pal, '#f3e6cf'), { right: wallC(pal, '#ddcdb0') });
      p.onLeft(s, 0.38, 0.62, -16, -4, wallC(pal, '#7a4b2a'));
      p.windows(s, 'left', 2, 2, { t0: 6, rowH: 10, winH: 5, color: winC(pal) });
      const face = (side) => {
        const pts = [];
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2;
          const sx = 0.5 + 0.38 * Math.cos(a);
          const tz = 41 + 11.5 * Math.sin(a);
          pts.push(side === 'left' ? p.P(s.u0 + sx * s.du, s.v1, s.z + tz) : p.P(s.u1, s.v1 - sx * s.dv, s.z + tz));
        }
        p.poly(pts, '#ffffff', 'stroke="#d4a017" stroke-width="1.6"');
        const c = side === 'left' ? p.P(s.u0 + 0.5 * s.du, s.v1, s.z + 41) : p.P(s.u1, s.v1 - 0.5 * s.dv, s.z + 41);
        p.line(c, [c[0], c[1] - 6], '#3a3a4a', 1.2);
        p.line(c, [c[0] + (side === 'left' ? 4 : -4), c[1] + 1], '#3a3a4a', 1.2);
      };
      face('left');
      const apex = p.pyramid(s, 20, roofC(pal, '#2c7a6b'), 0.04);
      p.line(apex, [apex[0], apex[1] - 7], '#f5b301', 1.6);
      p.circle([apex[0], apex[1] - 8], 2, '#f5b301');
    },
    ferris(p) {
      const pal = p.pal;
      p.shadow(0.85);
      p.block(0.15, 0.3, 0.7, 0.4, 0, 4, wallC(pal, '#cfd5df'));
      const hub = p.P(0.5, 0.5, 46);
      const g1 = p.P(0.3, 0.5, 4);
      const g2 = p.P(0.7, 0.5, 4);
      p.line(g1, hub, '#5b6477', 2.6);
      p.line(g2, hub, '#5b6477', 2.6);
      const R = 36;
      const cabins = ['#ff6b8a', '#ffd93b', '#4aa8ff', '#4cd27e', '#b48cff', '#ff9f43', '#ff5c5c', '#2fbf71'];
      let spokes = '';
      let pods = '';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const x = hub[0] + R * Math.cos(a);
        const y = hub[1] + R * Math.sin(a);
        spokes += '<line x1="' + r1(hub[0]) + '" y1="' + r1(hub[1]) + '" x2="' + r1(x) + '" y2="' + r1(y) + '" stroke="#9aa3b5" stroke-width="1"/>';
        pods += '<circle cx="' + r1(x) + '" cy="' + r1(y) + '" r="4.2" fill="' + wallC(pal, cabins[i]) + '" stroke="#ffffff" stroke-width="1"/>';
      }
      p.add('<g class="spin" style="transform-origin:' + r1(hub[0]) + 'px ' + r1(hub[1]) + 'px"><circle cx="' + r1(hub[0]) + '" cy="' + r1(hub[1]) + '" r="' + R + '" fill="none" stroke="' + (pal.night ? '#ffd76a' : '#e9eef6') + '" stroke-width="2.4"/>' + spokes + pods + '</g>');
      p.minY = Math.min(p.minY, hub[1] - R - 5);
      p.circle(hub, 3.5, '#5b6477');
    },
    savetower(p) {
      const pal = p.pal;
      p.shadow(0.8);
      p.block(0.2, 0.2, 0.6, 0.6, 0, 14, wallC(pal, '#2f6bff'), { top: wallC(pal, '#9cc0ff') });
      p.block(0.24, 0.24, 0.52, 0.52, 14, 4, wallC(pal, '#ffffff'));
      const sh = p.block(0.42, 0.42, 0.16, 0.16, 18, 70, wallC(pal, '#e9eef6'), { right: wallC(pal, '#c9d2e0') });
      for (let t = 6; t < 68; t += 10) p.onLeft(sh, 0.1, 0.9, t, t + 2, '#2f6bff', 'opacity=".55"');
      const c = p.P(0.5, 0.5, 98);
      p.circle(c, 17, '#ffe17a', 'opacity="' + (pal.night ? '.5' : '.25') + '"');
      p.circle(c, 13, '#f5b301', 'stroke="#c98a00" stroke-width="2"');
      p.circle(c, 9.5, '#ffd23f');
      p.text([c[0], c[1] + 0.5], '₩', 11, 'fill="#9a6400" font-weight="800" font-family="system-ui,sans-serif"');
      p.line([c[0], c[1] - 13], [c[0], c[1] - 26], '#c9ced8', 1.6);
      p.circle([c[0], c[1] - 26], 1.8, '#ff4d4d');
    },
    spaceport(p) {
      const pal = p.pal;
      const g = p.P(0.5, 0.5, 0);
      p.ellipse([g[0], g[1] + 1], 27, 13, wallC(pal, '#4b5368'));
      p.ellipse([g[0], g[1] - 2], 27, 13, wallC(pal, '#9aa3b5'));
      p.ellipse([g[0], g[1] - 2], 18, 8.5, '#2c3470');
      p.ellipse([g[0], g[1] - 2], 18, 8.5, 'none', 'stroke="#5ef2ff" stroke-width="1.4"');
      const base = g[1] - 6;
      p.add('<path d="M' + r1(g[0] - 7) + ' ' + r1(base) + ' L' + r1(g[0] - 7) + ' ' + r1(base - 44) + ' Q' + r1(g[0]) + ' ' + r1(base - 64) + ' ' + r1(g[0] + 7) + ' ' + r1(base - 44) + ' L' + r1(g[0] + 7) + ' ' + r1(base) + ' Z" fill="#f4f6fb" stroke="#c9d2e0" stroke-width="1"/>');
      p.add('<path d="M' + r1(g[0] - 7) + ' ' + r1(base - 44) + ' Q' + r1(g[0]) + ' ' + r1(base - 64) + ' ' + r1(g[0] + 7) + ' ' + r1(base - 44) + ' Z" fill="#ff5c5c"/>');
      p.add('<path d="M' + r1(g[0] - 7) + ' ' + r1(base - 10) + ' l-7 10 h7 Z M' + r1(g[0] + 7) + ' ' + r1(base - 10) + ' l7 10 h-7 Z" fill="#ff5c5c"/>');
      p.circle([g[0], base - 32], 3.4, '#5ef2ff', 'stroke="#2c3470" stroke-width="1"');
      p.ellipse([g[0], base - 22], 20, 6, 'none', 'stroke="#5ef2ff" stroke-width="1.8" opacity=".85"');
      p.minY = Math.min(p.minY, base - 64);
    },
  };

  /* ---------------- 탈것 ---------------- */

  const VEHICLE_SPEED = { bicycle: 0.32, car: 0.55, taxi: 0.6, bus: 0.42, flycar: 0.8 };

  function carBody(p, axis, len, wid, body, cabin, o) {
    o = o || {};
    const z = o.z || 0;
    const L = axis === 'u' ? len : wid;
    const W = axis === 'u' ? wid : len;
    if (!o.noWheels) {
      const wl = axis === 'u' ? [[-len / 2 + 0.08, wid / 2], [len / 2 - 0.08, wid / 2]] : [[wid / 2, -len / 2 + 0.08], [wid / 2, len / 2 - 0.08]];
      for (const w of wl) p.ellipse(p.P(w[0], w[1], z + 1.4), 2.2, 1.6, '#1f2433');
    }
    const b = p.block(-L / 2, -W / 2, L, W, z + 1.5, o.h || 5, body);
    const cl = axis === 'u' ? (o.cabinLen || len * 0.5) : wid * 0.84;
    const cw = axis === 'u' ? wid * 0.84 : (o.cabinLen || len * 0.5);
    p.block(-cl / 2 + (axis === 'u' ? -0.02 : 0), -cw / 2 + (axis === 'v' ? -0.02 : 0), cl, cw, b.z1, o.cabinH || 4, cabin, { top: shade(body, 0.12) });
    return b;
  }

  function drawVehicle(itemId, axis, pal) {
    const p = new Painter(0, 0, pal);
    if (itemId === 'bicycle') {
      const d = axis === 'u' ? [3.6, 1.8] : [-3.6, 1.8];
      const c = p.P(0, 0, 0);
      p.ellipse([c[0] + 1, c[1] + 0.5], 7, 2.6, '#000', 'opacity=".15"');
      p.circle([c[0] - d[0], c[1] - d[1] - 2.6], 2.6, 'none', 'stroke="#1f2433" stroke-width="1.2"');
      p.circle([c[0] + d[0], c[1] + d[1] - 2.6], 2.6, 'none', 'stroke="#1f2433" stroke-width="1.2"');
      p.line([c[0] - d[0], c[1] - d[1] - 2.6], [c[0] + d[0], c[1] + d[1] - 2.6], '#2f6bff', 1.4);
      p.line([c[0], c[1] - 3], [c[0], c[1] - 10], '#ff6b6b', 3);
      p.circle([c[0], c[1] - 12.5], 2.4, '#ffd7b0');
      p.add('<path d="M' + r1(c[0] - 2.6) + ' ' + r1(c[1] - 13.2) + ' a2.6 2.6 0 0 1 5.2 0 Z" fill="#2f6bff"/>');
    } else if (itemId === 'car') {
      p.ellipse(p.P(0, 0, 0), 11, 5, '#000', 'opacity=".14"');
      carBody(p, axis, 0.4, 0.24, wallC(pal, '#ff5a5f'), '#dff1ff');
    } else if (itemId === 'taxi') {
      p.ellipse(p.P(0, 0, 0), 11, 5, '#000', 'opacity=".14"');
      const b = carBody(p, axis, 0.42, 0.24, wallC(pal, '#ffc83d'), '#dff1ff');
      p.block(-0.035, -0.035, 0.07, 0.07, b.z1 + 4, 2.4, '#ff5c5c');
    } else if (itemId === 'bus') {
      p.ellipse(p.P(0, 0, 0), 18, 7, '#000', 'opacity=".14"');
      const len = 0.78;
      const wid = 0.28;
      const L = axis === 'u' ? len : wid;
      const W = axis === 'u' ? wid : len;
      const wl = axis === 'u' ? [[-len / 2 + 0.1, wid / 2], [len / 2 - 0.12, wid / 2]] : [[wid / 2, -len / 2 + 0.1], [wid / 2, len / 2 - 0.12]];
      for (const w of wl) p.ellipse(p.P(w[0], w[1], 1.4), 2.4, 1.7, '#1f2433');
      const body = wallC(pal, '#2fbf71');
      const b = p.block(-L / 2, -W / 2, L, W, 1.5, 11, body, { top: '#f4f6fb' });
      const glass = pal.night ? '#ffd76a' : '#dff1ff';
      if (axis === 'u') {
        p.onLeft(b, 0.06, 0.94, 5, 9, glass);
        p.onRight(b, 0.1, 0.9, 4.5, 9.5, glass);
      } else {
        p.onRight(b, 0.06, 0.94, 5, 9, glass);
        p.onLeft(b, 0.1, 0.9, 4.5, 9.5, glass);
      }
    } else if (itemId === 'flycar') {
      p.ellipse(p.P(0, 0, 0), 9, 4, '#000', 'opacity=".18"');
      p.ellipse(p.P(0, 0, 10), 10, 4.5, '#5ef2ff', 'opacity=".35"');
      carBody(p, axis, 0.38, 0.24, wallC(pal, '#8b5cf6'), '#7ff3ff', { z: 12, noWheels: true });
    }
    return p;
  }

  /** 도로 위 직선 구간(3칸 이상) 찾기 */
  function routesFor(region) {
    const routes = [];
    const road = (c, r) => c >= 0 && r >= 0 && c < N && r < N && region.tiles[r * N + c] === 'road';
    for (let r = 0; r < N; r++) {
      let c = 0;
      while (c < N) {
        if (!road(c, r)) {
          c++;
          continue;
        }
        let e = c;
        while (road(e + 1, r)) e++;
        if (e - c >= 2) routes.push({ axis: 'u', line: r, a: c, b: e });
        c = e + 1;
      }
    }
    for (let c = 0; c < N; c++) {
      let r = 0;
      while (r < N) {
        if (!road(c, r)) {
          r++;
          continue;
        }
        let e = r;
        while (road(c, e + 1)) e++;
        if (e - r >= 2) routes.push({ axis: 'v', line: c, a: r, b: e });
        r = e + 1;
      }
    }
    return routes;
  }

  /* ---------------- 아이템 하나 그리기 ---------------- */

  function drawItem(p, itemId, level) {
    const item = D.ITEM_MAP[itemId];
    if (!item) return;
    if (item.cat === 'building') BUILD[itemId](p, level || 1);
    else if (item.cat === 'landmark') LANDMARK[itemId](p);
    else if (DECOR[itemId]) DECOR[itemId](p);
  }

  /* ---------------- 땅 ---------------- */

  function tileFill(pal, region, i, kind) {
    const c = i % N;
    const r = Math.floor(i / N);
    if (kind === 'road') return pal.road;
    if (kind === 'water') return pal.water;
    const g = pal.ground[region.ground] || pal.ground.grass;
    return g[(c + r) % 2];
  }

  function groundSvg(region, pal, o) {
    o = o || {};
    const p = new Painter(0, 0, pal);
    const P = p.P.bind(p);
    // 땅 두께 (옆면)
    p.poly([P(0, N, 0), P(N, N, 0), P(N, N, -SLAB), P(0, N, -SLAB)], pal.edgeL);
    p.poly([P(N, N, 0), P(N, 0, 0), P(N, 0, -SLAB), P(N, N, -SLAB)], pal.edgeR);
    p.poly([P(0, N, 0), P(N, N, 0), P(N, N, -3), P(0, N, -3)], region.ground === 'grass' ? pal.lip : shade(pal.edgeL, 0.25));
    p.poly([P(N, N, 0), P(N, 0, 0), P(N, 0, -3), P(N, N, -3)], region.ground === 'grass' ? shade(pal.lip, -0.12) : shade(pal.edgeR, 0.2));
    const tiles = [];
    const marks = [];
    region.tiles.forEach((kind, i) => {
      const c = i % N;
      const r = Math.floor(i / N);
      const pts = [P(c, r, 0), P(c + 1, r, 0), P(c + 1, r + 1, 0), P(c, r + 1, 0)].map(pt).join(' ');
      const cls = 'tile tile-' + kind + (o.interactive && kind === 'plot' ? (o.placed && o.placed[i] ? ' tile-used' : ' tile-empty') : '');
      tiles.push('<polygon class="' + cls + '"' + (o.interactive ? ' data-slot="' + i + '"' : '') + ' points="' + pts + '" fill="' + tileFill(pal, region, i, kind) + '"/>');
      if (kind === 'road') {
        const isRoad = (cc, rr) => cc >= 0 && rr >= 0 && cc < N && rr < N && region.tiles[rr * N + cc] === 'road';
        const horiz = isRoad(c - 1, r) || isRoad(c + 1, r);
        const vert = isRoad(c, r - 1) || isRoad(c, r + 1);
        if (horiz && !vert) marks.push(dash(P(c + 0.08, r + 0.5, 0), P(c + 0.92, r + 0.5, 0), pal.roadLine));
        else if (vert && !horiz) marks.push(dash(P(c + 0.5, r + 0.08, 0), P(c + 0.5, r + 0.92, 0), pal.roadLine));
        else if (horiz && vert) {
          for (let k = 0; k < 3; k++) {
            marks.push('<line x1="' + pt(P(c + 0.12, r + 0.28 + k * 0.22, 0)).replace(',', '" y1="') + '" x2="' + pt(P(c + 0.24, r + 0.28 + k * 0.22, 0)).replace(',', '" y2="') + '" stroke="' + pal.roadLine + '" stroke-width="2.2" opacity=".55"/>');
          }
        }
      } else if (kind === 'water') {
        const cpt = P(c + 0.5, r + 0.5, 0);
        marks.push('<path class="wave" d="M' + r1(cpt[0] - 14) + ' ' + r1(cpt[1] - 2) + ' q4 -3 8 0 t8 0 M' + r1(cpt[0] - 4) + ' ' + r1(cpt[1] + 5) + ' q4 -3 8 0 t8 0" stroke="' + pal.waterHi + '" stroke-width="1.6" fill="none" stroke-linecap="round"/>');
      } else if (region.ground === 'grass' && !o.interactive && (c * 7 + r * 3) % 5 === 0 && !(o.placed && o.placed[i])) {
        const q = P(c + 0.3, r + 0.62, 0);
        marks.push('<path d="M' + r1(q[0]) + ' ' + r1(q[1]) + ' l1.5 -4 l1.2 4 l1.6 -3.4 l1 3.4" stroke="' + pal.tuft + '" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>');
      } else if (region.ground === 'neon') {
        marks.push('<polygon points="' + [P(c + 0.06, r + 0.06, 0), P(c + 0.94, r + 0.06, 0), P(c + 0.94, r + 0.94, 0), P(c + 0.06, r + 0.94, 0)].map(pt).join(' ') + '" fill="none" stroke="#5ef2ff" stroke-width=".8" opacity=".45"/>');
      }
    });
    return p.svg() + '<g class="tiles">' + tiles.join('') + '</g><g class="marks" pointer-events="none">' + marks.join('') + '</g>';
  }

  function dash(a, b, color) {
    return '<line x1="' + r1(a[0]) + '" y1="' + r1(a[1]) + '" x2="' + r1(b[0]) + '" y2="' + r1(b[1]) + '" stroke="' + color + '" stroke-width="1.6" stroke-dasharray="5 4" opacity=".85"/>';
  }

  /* ---------------- 지도 전체 ---------------- */

  /**
   * opts: { regionId, state, skin, interactive, selectedSlot, placing, vehicles(bool), title }
   * 반환: SVG 문자열
   */
  function renderMap(o) {
    const region = D.REGION_MAP[o.regionId];
    const pal = palette(o.skin);
    const state = o.state;
    const placed = {};
    if (state) for (const b of state.buildings) if (b.region === region.id) placed[b.slot] = b;

    const ground = groundSvg(region, pal, { interactive: o.interactive, placed });
    let minY = -24;

    // 선택 표시와 빈 땅 + 표시
    let overlay = '';
    const P0 = new Painter(0, 0, pal);
    if (o.interactive) {
      region.tiles.forEach((kind, i) => {
        if (kind !== 'plot' || placed[i]) return;
        const c = i % N;
        const r = Math.floor(i / N);
        const q = P0.P(c + 0.5, r + 0.5, 0);
        overlay += '<g class="plus" pointer-events="none"><line x1="' + r1(q[0] - 4) + '" y1="' + r1(q[1]) + '" x2="' + r1(q[0] + 4) + '" y2="' + r1(q[1]) + '"/><line x1="' + r1(q[0]) + '" y1="' + r1(q[1] - 4) + '" x2="' + r1(q[0]) + '" y2="' + r1(q[1] + 4) + '"/></g>';
      });
    }
    if (o.selectedSlot != null && region.tiles[o.selectedSlot] === 'plot') {
      const c = o.selectedSlot % N;
      const r = Math.floor(o.selectedSlot / N);
      overlay += '<polygon class="sel" pointer-events="none" points="' + [P0.P(c, r, 0), P0.P(c + 1, r, 0), P0.P(c + 1, r + 1, 0), P0.P(c, r + 1, 0)].map(pt).join(' ') + '"/>';
    }

    // 건물 (깊이 순서대로)
    const depthGroups = [];
    for (let d = 0; d <= 2 * N - 2; d++) depthGroups.push([]);
    Object.keys(placed).forEach((slot) => {
      const b = placed[slot];
      const s = Number(slot);
      const c = s % N;
      const r = Math.floor(s / N);
      const p = new Painter(c, r, pal);
      const level = state.buildingLevels[b.uid] || 1;
      drawItem(p, b.itemId, level);
      minY = Math.min(minY, p.minY);
      const sel = o.selectedSlot === s ? ' selected' : '';
      depthGroups[c + r].push('<g class="obj' + sel + '"' + (o.interactive ? ' data-slot="' + s + '" data-uid="' + b.uid + '"' : '') + '>' + p.svg() + '</g>');
    });

    // 탈것
    let vehicles = '';
    if (o.vehicles && state && state.vehicles.length) {
      const routes = routesFor(region);
      if (routes.length) {
        const list = state.vehicles.slice(-10);
        list.forEach((v, i) => {
          const route = routes[i % routes.length];
          const speed = VEHICLE_SPEED[v.itemId] || 0.5;
          const shape = drawVehicle(v.itemId, route.axis, pal);
          minY = Math.min(minY, shape.minY - 4);
          vehicles += '<g class="vehicle" data-axis="' + route.axis + '" data-line="' + route.line + '" data-a="' + route.a + '" data-b="' + route.b + '" data-speed="' + speed + '" data-phase="' + ((i * 0.37) % 1).toFixed(2) + '">' + shape.svg() + '</g>';
        });
      }
    }

    const groups = depthGroups.map((g, d) => '<g data-depth="' + d + '">' + g.join('') + '</g>').join('');
    const top = Math.floor(Math.min(minY, -24) - 8);
    const bottom = N * 2 * HH + SLAB + 8;
    const left = -N * HW - 8;
    const width = N * 2 * HW + 16;
    const height = bottom - top;
    const cls = 'city-svg' + (o.placing ? ' placing' : '') + (o.interactive ? ' interactive' : '');
    return (
      '<svg class="' + cls + '" viewBox="' + left + ' ' + top + ' ' + width + ' ' + height + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + (o.title || region.name + ' 지도') + '" data-region="' + region.id + '">' +
      ground +
      overlay +
      '<g class="objs">' + groups + '</g>' +
      (vehicles ? '<g class="vehicle-pool">' + vehicles + '</g>' : '') +
      '</svg>'
    );
  }

  /** 상점/도감용 작은 그림 */
  function renderThumb(itemId, level, skinId) {
    const item = D.ITEM_MAP[itemId];
    const pal = palette(skinId);
    if (!item) return '';
    if (item.cat === 'skin') return renderSkinThumb(itemId);
    const p = new Painter(0, 0, pal);
    const P = p.P.bind(p);
    const ground = item.cat === 'vehicle' ? pal.road : pal.ground.grass[0];
    p.poly([P(0, 0, 0), P(1, 0, 0), P(1, 1, 0), P(0, 1, 0)], ground);
    p.poly([P(0, 1, 0), P(1, 1, 0), P(1, 1, -5), P(0, 1, -5)], item.cat === 'vehicle' ? shade(pal.road, -0.3) : pal.edgeL);
    p.poly([P(1, 1, 0), P(1, 0, 0), P(1, 0, -5), P(1, 1, -5)], item.cat === 'vehicle' ? shade(pal.road, -0.4) : pal.edgeR);
    if (item.cat === 'vehicle') {
      p.add(dash(P(0.08, 0.5, 0), P(0.92, 0.5, 0), pal.roadLine));
      const v = drawVehicle(itemId, 'u', pal);
      const off = P(0.5, 0.5, 0);
      p.add('<g transform="translate(' + r1(off[0]) + ' ' + r1(off[1]) + ')">' + v.svg() + '</g>');
      p.minY = Math.min(p.minY, off[1] + v.minY);
    } else {
      drawItem(p, itemId, level || 1);
    }
    const top = Math.floor(Math.min(p.minY, 0) - 4);
    const h = 2 * HH + 5 + 4 - top;
    const box = Math.max(h, 2 * HW + 8);
    const left = -box / 2;
    return '<svg class="thumb-svg" viewBox="' + r1(left) + ' ' + top + ' ' + r1(box) + ' ' + h + '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + p.svg() + '</svg>';
  }

  /** 스킨 미리보기: 작은 2×2 마을 */
  function renderSkinThumb(skinId) {
    const pal = palette(skinId);
    const parts = [];
    const P = new Painter(0, 0, pal);
    const PP = P.P.bind(P);
    parts.push('<polygon points="' + [PP(0, 2, 0), PP(2, 2, 0), PP(2, 2, -6), PP(0, 2, -6)].map(pt).join(' ') + '" fill="' + pal.edgeL + '"/>');
    parts.push('<polygon points="' + [PP(2, 2, 0), PP(2, 0, 0), PP(2, 0, -6), PP(2, 2, -6)].map(pt).join(' ') + '" fill="' + pal.edgeR + '"/>');
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        const road = c === 1 && r === 1;
        parts.push('<polygon points="' + [PP(c, r, 0), PP(c + 1, r, 0), PP(c + 1, r + 1, 0), PP(c, r + 1, 0)].map(pt).join(' ') + '" fill="' + (road ? pal.road : pal.ground.grass[(c + r) % 2]) + '"/>');
      }
    }
    const a = new Painter(0, 0, pal);
    BUILD.house(a, 2);
    const b = new Painter(1, 0, pal);
    tree(b, 0.5, 0.5, 1);
    const c = new Painter(0, 1, pal);
    lampPost(c, 0.5, 0.5, 1);
    const top = Math.floor(Math.min(a.minY, b.minY, c.minY) - 6);
    const h = 4 * HH + 6 + 6 - top;
    const box = Math.max(h, 4 * HW + 10);
    return (
      '<svg class="thumb-svg" viewBox="' + r1(-box / 2) + ' ' + top + ' ' + r1(box) + ' ' + h + '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<rect x="' + r1(-box / 2) + '" y="' + top + '" width="' + r1(box) + '" height="' + h + '" fill="' + pal.sky[0] + '" opacity=".6"/>' +
      parts.join('') + a.svg() + b.svg() + c.svg() +
      '</svg>'
    );
  }

  /* ---------------- 탈것 움직이기 ---------------- */

  /** 지도 SVG 안의 탈것을 도로 위로 움직입니다. stop 함수를 돌려줍니다. */
  function animate(svg, isEnabled) {
    if (!svg) return () => {};
    const pool = svg.querySelector('.vehicle-pool');
    const groups = Array.from(svg.querySelectorAll('.objs > g[data-depth]'));
    if (!pool || !groups.length) return () => {};
    const cars = Array.from(pool.querySelectorAll('.vehicle')).map((el) => ({
      el,
      axis: el.dataset.axis,
      line: Number(el.dataset.line),
      a: Number(el.dataset.a),
      b: Number(el.dataset.b),
      speed: Number(el.dataset.speed),
      phase: Number(el.dataset.phase),
      depth: -1,
    }));
    const LANE = 0.17;
    const TURN = 0.35;
    let raf = 0;
    let running = true;
    const start = performance.now();
    function place(car, t) {
      const len = car.b - car.a;
      const total = 2 * len;
      const s = (((t * car.speed + car.phase * total) % total) + total) % total;
      const fwd = s < len;
      const x = fwd ? s : s - len;
      const along = fwd ? car.a + 0.5 + x : car.b + 0.5 - x;
      const lane = fwd ? LANE : -LANE;
      const blend = x < TURN ? -lane + (2 * lane * x) / TURN : lane;
      const u = car.axis === 'u' ? along : car.line + 0.5 + blend;
      const v = car.axis === 'u' ? car.line + 0.5 + blend : along;
      car.el.setAttribute('transform', 'translate(' + r1((u - v) * HW) + ' ' + r1((u + v) * HH) + ')');
      const depth = Math.max(0, Math.min(groups.length - 1, Math.round(u + v - 1)));
      if (depth !== car.depth) {
        groups[depth].appendChild(car.el);
        car.depth = depth;
      }
    }
    function frame(now) {
      if (!running) return;
      if (!svg.isConnected) {
        running = false;
        return;
      }
      const t = (now - start) / 1000;
      if (!isEnabled || isEnabled()) for (const car of cars) place(car, t);
      raf = requestAnimationFrame(frame);
    }
    for (const car of cars) place(car, 0);
    raf = requestAnimationFrame(frame);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }

  SC.cityArt = {
    HW,
    HH,
    palette,
    SKINS,
    renderMap,
    renderThumb,
    renderSkinThumb,
    routesFor,
    animate,
    shade,
    mix,
  };
})(typeof window !== 'undefined' ? window : globalThis);
