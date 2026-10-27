/* SECTOR ZERO — 질감: 이미지 파일 없이 픽셀을 계산해서 만듭니다 (알파 = 1 일반 면, 1보다 작으면 스스로 빛나는 부분) */
(function (root) {
  'use strict';
  const SZ = (root.SZ = root.SZ || {});

  function hash(x, y, seed) {
    let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  /** 이음매 없이 반복되는 값 노이즈 (freq 칸으로 나눠 부드럽게 잇기) */
  function noise(u, v, freq, seed) {
    const x = u * freq, y = v * freq;
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const w = (i) => ((i % freq) + freq) % freq;
    const a = hash(w(x0), w(y0), seed), b = hash(w(x0 + 1), w(y0), seed);
    const c = hash(w(x0), w(y0 + 1), seed), d = hash(w(x0 + 1), w(y0 + 1), seed);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }
  function fbm(u, v, freq, seed, oct) {
    let s = 0, amp = 0.5, tot = 0;
    for (let i = 0; i < (oct || 4); i++) {
      s += noise(u, v, freq << i, seed + i * 17) * amp;
      tot += amp;
      amp *= 0.5;
    }
    return s / tot;
  }

  function make(size, fn) {
    const data = new Uint8Array(size * size * 4);
    const px = [0, 0, 0, 255];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        px[3] = 255;
        fn(x, y, px, size);
        const i = (y * size + x) * 4;
        data[i] = Math.max(0, Math.min(255, px[0]));
        data[i + 1] = Math.max(0, Math.min(255, px[1]));
        data[i + 2] = Math.max(0, Math.min(255, px[2]));
        data[i + 3] = Math.max(0, Math.min(255, px[3]));
      }
    }
    return { size, data };
  }

  const set = (px, r, g, b) => {
    px[0] = r;
    px[1] = g;
    px[2] = b;
  };

  /** 거푸집 자국이 남은 콘크리트 벽 (한 장 = 2m × 2m, 1m 판 4장) */
  function concrete(S) {
    return make(S, (x, y, px) => {
      const u = x / S, v = y / S;
      const n = fbm(u, v, 4, 11, 5);
      const spots = noise(u, v, 32, 5);
      let k = 74 + n * 46 + (spots > 0.82 ? -10 : 0);
      const half = S / 2;
      const gx = x % half, gy = y % half;
      if (gx < 2 || gy < 2) k -= 26;
      else if (gx < 4 || gy < 4) k += 8;
      // 거푸집 볼트 구멍
      const hx = gx - half / 4, hy = gy - half / 4;
      for (const [ax, ay] of [[0, 0], [half / 2, 0], [0, half / 2], [half / 2, half / 2]]) {
        const ddx = hx - ax, ddy = hy - ay;
        const r2 = ddx * ddx + ddy * ddy;
        if (r2 < 9) k -= 30;
        else if (r2 < 16) k += 6;
      }
      // 아래로 흘러내린 얼룩
      const drip = noise(u, 0, 24, 3) * fbm(u, v * 0.25, 2, 8, 2);
      k -= drip * 22;
      set(px, k * 0.96, k * 0.99, k * 1.06);
    });
  }

  /** 기술 패널 벽: 금속판, 리벳, 청록색 빛 띠 */
  function panel(S) {
    return make(S, (x, y, px) => {
      const u = x / S, v = y / S;
      const n = fbm(u, v, 8, 21, 4);
      const brushed = noise(u * 0.1, v, 64, 4);
      let r = 46, g = 54, b = 64;
      const k = n * 22 + brushed * 10;
      r += k;
      g += k;
      b += k;
      const q = S / 4;
      const gx = x % (S / 2), gy = y % q;
      // 판 이음매
      if (gx < 2 || gy < 2) {
        r -= 22;
        g -= 22;
        b -= 22;
      } else if (gx < 3 || gy < 3) {
        r += 14;
        g += 14;
        b += 16;
      }
      // 리벳
      const rx = (x % (S / 2)) - 7, ry = (y % q) - 7;
      const rx2 = (x % (S / 2)) - (S / 2 - 7);
      if (rx * rx + ry * ry < 5 || rx2 * rx2 + ry * ry < 5) {
        r += 30;
        g += 30;
        b += 32;
      }
      // 빛 띠 (빛나는 부분은 알파로 표시)
      const band = y >= S * 0.46 && y < S * 0.5;
      if (band) {
        set(px, 70, 220, 255);
        px[3] = 40;
        return;
      }
      const bandEdge = y >= S * 0.44 && y < S * 0.52;
      if (bandEdge) {
        r = 24;
        g = 30;
        b = 36;
      }
      // 작은 주황 표시등
      const lx = x - S * 0.84, ly = y - S * 0.2;
      if (lx * lx + ly * ly < 6) {
        set(px, 255, 150, 50);
        px[3] = 60;
        return;
      }
      set(px, r, g, b);
    });
  }

  /** 바닥: 1m 철판 타일과 미끄럼 방지 무늬 (타일마다 밝기가 조금씩 달라요) */
  function floor(S) {
    return make(S, (x, y, px) => {
      const u = x / S, v = y / S;
      const n = fbm(u, v, 6, 31, 5);
      const half = S / 2;
      const tx = Math.floor(x / half), ty = Math.floor(y / half);
      const gx = x % half, gy = y % half;
      let k = 50 + n * 34 + (hash(tx, ty, 77) - 0.5) * 14;
      // 다이아몬드 미끄럼 방지 무늬
      const d1 = (gx + gy) % 12, d2 = (gx - gy + 1200) % 12;
      if ((d1 < 2 && gy % 12 < 7) || (d2 < 2 && gy % 12 >= 6)) k += 11;
      let r = k * 0.95, g = k * 0.98, b = k * 1.04;
      if (gx < 2 || gy < 2) {
        r *= 0.45;
        g *= 0.45;
        b *= 0.45;
      } else if (gx < 4 || gy < 4) {
        r += 10;
        g += 10;
        b += 10;
      }
      // 모서리 나사
      const cx = gx < half / 2 ? gx - 8 : gx - (half - 8), cy = gy < half / 2 ? gy - 8 : gy - (half - 8);
      if (cx * cx + cy * cy < 7) {
        r += 26;
        g += 26;
        b += 26;
      }
      set(px, r, g, b);
    });
  }

  /** 문턱·원자로 둘레 바닥: 닳은 경고 줄무늬 */
  function hazard(S) {
    return make(S, (x, y, px) => {
      const u = x / S, v = y / S;
      const n = fbm(u, v, 6, 33, 4);
      const stripe = (x + y) % (S / 4) < S / 8;
      let r, g, b;
      if (stripe) {
        r = 160 + n * 40;
        g = 118 + n * 30;
        b = 26;
      } else r = g = b = 26 + n * 18;
      const wear = fbm(u, v, 12, 9, 3);
      if (wear > 0.56) {
        const w = Math.min(1, (wear - 0.56) * 6);
        r = r * (1 - w * 0.5) + 34 * w * 0.5;
        g = g * (1 - w * 0.5) + 34 * w * 0.5;
        b = b * (1 - w * 0.5) + 36 * w * 0.5;
      }
      const gx = x % (S / 2), gy = y % (S / 2);
      if (gx < 2 || gy < 2) {
        r *= 0.5;
        g *= 0.5;
        b *= 0.5;
      }
      set(px, r, g, b);
    });
  }

  /** 천장: 어두운 격자 패널과 환기구 */
  function ceiling(S) {
    return make(S, (x, y, px) => {
      const u = x / S, v = y / S;
      const n = fbm(u, v, 4, 41, 3);
      const half = S / 2;
      const gx = x % half, gy = y % half;
      let k = 34 + n * 18;
      if (gx < 3 || gy < 3) k = 18;
      if (x < half && y < half && gx > 12 && gx < half - 12 && gy > 12 && gy < half - 12) {
        k = (gy % 8) < 4 ? 14 : 40 + n * 10;
      }
      set(px, k * 0.95, k, k * 1.08);
    });
  }

  /** 군용 상자: 테두리, X자 보강대, 표시 글자 대신 노란 띠 (한 장 = 1m) */
  function crate(S) {
    return make(S, (x, y, px) => {
      const u = x / S, v = y / S;
      const n = fbm(u, v, 8, 51, 4);
      let r = 66 + n * 30, g = 78 + n * 30, b = 52 + n * 18;
      const edge = Math.min(x, y, S - 1 - x, S - 1 - y);
      const diag = Math.min(Math.abs(x - y), Math.abs(x - (S - 1 - y)));
      if (edge < S * 0.09 || diag < S * 0.05) {
        r += 22;
        g += 24;
        b += 14;
        if (edge < 2 || (edge >= S * 0.09 - 2 && edge < S * 0.09)) {
          r -= 40;
          g -= 40;
          b -= 30;
        }
      } else if (edge < S * 0.11 || (diag >= S * 0.05 && diag < S * 0.065)) {
        r -= 30;
        g -= 30;
        b -= 24;
      }
      if (y > S * 0.42 && y < S * 0.5 && edge >= S * 0.11 && diag >= S * 0.065) {
        r = 190 + n * 30;
        g = 160 + n * 20;
        b = 40;
      }
      set(px, r, g, b);
    });
  }

  /** 로봇·총에 쓰는 금속 (색은 그릴 때 입혀요) */
  function metal(S) {
    return make(S, (x, y, px) => {
      const u = x / S, v = y / S;
      const n = fbm(u, v, 4, 61, 3);
      const streak = noise(u, v * 0.05, 64, 7);
      let k = 150 + n * 50 + streak * 30;
      const gx = x % (S / 2), gy = y % (S / 2);
      if (gx < 2 || gy < 2) k -= 60;
      set(px, k, k, k);
    });
  }

  function white() {
    return make(4, (x, y, px) => set(px, 255, 255, 255));
  }

  /** 불꽃·빛 번짐용 둥근 점 */
  function glow(S) {
    return make(S, (x, y, px) => {
      const dx = (x + 0.5) / S - 0.5, dy = (y + 0.5) / S - 0.5;
      const d = Math.sqrt(dx * dx + dy * dy) * 2;
      const a = Math.max(0, 1 - d);
      set(px, 255, 255, 255);
      px[3] = Math.round(255 * Math.pow(a, 1.8));
    });
  }

  /** 모든 질감 만들기 → {이름: {size, data}} */
  function build() {
    return {
      concrete: concrete(256),
      panel: panel(256),
      floor: floor(256),
      hazard: hazard(256),
      ceiling: ceiling(128),
      crate: crate(128),
      metal: metal(128),
      white: white(),
      glow: glow(64),
    };
  }

  SZ.textures = { build, noise, fbm };
})(typeof window !== 'undefined' ? window : globalThis);
