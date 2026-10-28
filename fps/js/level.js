/* SECTOR ZERO — 맵: 격자 데이터, 충돌, 광선 판정, 적 길찾기 (DOM·WebGL 없는 순수 로직) */
(function (root) {
  'use strict';
  const SZ = (root.SZ = root.SZ || {});

  const CELL = 2; // 한 칸 = 2m
  const WALL_H = 4; // 벽·천장 높이 4m

  /*
   * # 콘크리트 벽   = 기술 패널 벽   c 낮은 상자(1m, 점프로 올라감)   C 높은 상자(2m)
   * . 바닥   L 천장 조명   P 플레이어 시작   S 적 출현 지점   H 구급상자   A 탄약 상자
   * 가운데가 원자로 홀(아레나), 네 모서리가 적이 들어오는 격납고, 그 사이를 복도와 홀이 이어요.
   * 바깥 홀 네 곳에도 출현 지점이 있어서 적이 여러 방향에서 와요.
   */
  const MAP = [
    '################################',
    '#S..c.#Cc......A.......cC#.c..S#',
    '#.....#c...S............c#.....#',
    '#..L......#...L..L...#......L..#',
    '#c....#......c....c......#....c#',
    '#....S#..................#S....#',
    '###.##=========..=========##.###',
    '#Cc...=Cc..............cC=...cC#',
    '#c....=c................c=....c#',
    '#.....=.........H........=.....#',
    '#..#..=...L.cc....cc.L...=..#..#',
    '#.S...=..................=.....#',
    '#.....=...c..........c...=.....#',
    '#....c=...c..L....L..c...=c....#',
    '#..L..=..................=..L..#',
    '#..............==.............A#',
    '#H.............==..............#',
    '#..L..=..................=..L..#',
    '#....c=...c..L....L..c...=c....#',
    '#.....=...c..........c...=.....#',
    '#.....=........P.........=...S.#',
    '#..#..=...L.cc....cc.L...=..#..#',
    '#.....=........A.........=.....#',
    '#c....=c................c=....c#',
    '#Cc...=Cc..............cC=...cC#',
    '###.##=========..=========##.###',
    '#....S#..................#S....#',
    '#c....#......c....c......#....c#',
    '#..L......#...L..L...#......L..#',
    '#.....#c............S...c#.....#',
    '#S..c.#Cc.......H......cC#.c..S#',
    '################################',
  ];

  const HEIGHT = { '#': WALL_H, '=': WALL_H, c: 1, C: 2 };
  const MATERIAL = { '#': 'concrete', '=': 'panel', c: 'crate', C: 'crate' };

  /** 칸 위치에 따라 조명 색을 고릅니다: 원자로 둘레는 청록, 격납고는 주황, 나머지는 흰색 */
  function lampColor(cx, cz, w, h) {
    const inArena = cx > 6 && cx < w - 7 && cz > 6 && cz < h - 7;
    const inBay = (cx < 6 || cx > w - 7) && (cz < 6 || cz > h - 7);
    if (inArena && Math.abs(cx - w / 2) < 5 && Math.abs(cz - h / 2) < 5) return [0.35, 0.85, 1.25];
    if (inBay) return [1.3, 0.62, 0.28];
    if (inArena) return [1.0, 1.0, 1.1];
    return [0.95, 0.98, 1.15];
  }

  function create(rows) {
    rows = rows || MAP;
    const h = rows.length;
    const w = rows[0].length;
    const heights = new Float32Array(w * h);
    const chars = [];
    const lv = { w, h, heights, chars, player: null, spawns: [], pickups: [], lamps: [] };
    for (let z = 0; z < h; z++) {
      if (rows[z].length !== w) throw new Error('맵 ' + z + '번째 줄의 길이가 달라요.');
      for (let x = 0; x < w; x++) {
        const ch = rows[z][x];
        chars.push(ch);
        heights[z * w + x] = HEIGHT[ch] || 0;
        const px = (x + 0.5) * CELL;
        const pz = (z + 0.5) * CELL;
        if (ch === 'P') lv.player = { x: px, z: pz };
        else if (ch === 'S') lv.spawns.push({ x: px, z: pz });
        else if (ch === 'H') lv.pickups.push({ x: px, z: pz, kind: 'health' });
        else if (ch === 'A') lv.pickups.push({ x: px, z: pz, kind: 'ammo' });
        else if (ch === 'L') lv.lamps.push({ x: px, y: WALL_H - 0.35, z: pz, color: lampColor(x, z, w, h) });
      }
    }
    if (!lv.player) throw new Error('맵에 플레이어 시작 지점(P)이 없어요.');
    return lv;
  }

  const cellOf = (v) => Math.floor(v / CELL);

  /** 칸 높이 (맵 밖은 벽) */
  function heightAt(lv, cx, cz) {
    if (cx < 0 || cz < 0 || cx >= lv.w || cz >= lv.h) return WALL_H;
    return lv.heights[cz * lv.w + cx];
  }
  function charAt(lv, cx, cz) {
    if (cx < 0 || cz < 0 || cx >= lv.w || cz >= lv.h) return '#';
    return lv.chars[cz * lv.w + cx];
  }
  const heightAtPos = (lv, x, z) => heightAt(lv, cellOf(x), cellOf(z));

  /** 정사각형 몸통(중심 x,z / 반폭 r)이 걸치는 칸 중 가장 높은 곳 */
  function maxHeightUnder(lv, x, z, r) {
    const x0 = cellOf(x - r), x1 = cellOf(x + r), z0 = cellOf(z - r), z1 = cellOf(z + r);
    let m = 0;
    for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) m = Math.max(m, heightAt(lv, cx, cz));
    return m;
  }

  /** 발 높이 feet에서 몸통이 들어갈 수 없는 칸에 걸치는지 */
  function blocked(lv, x, z, r, feet) {
    return maxHeightUnder(lv, x, z, r) > feet + 0.02;
  }

  const EPS = 1e-4;

  /**
   * 축을 하나씩 나눠 움직이고, 막히면 벽 면에 딱 붙여 세웁니다. (벽을 따라 미끄러지듯 움직여요)
   * body: {x, z} — 직접 바뀝니다. 돌려주는 값: 어느 축이 막혔는지
   */
  function slide(lv, body, dx, dz, r, feet) {
    let hitX = false, hitZ = false;
    if (dx !== 0) {
      let nx = body.x + dx;
      if (blocked(lv, nx, body.z, r, feet)) {
        hitX = true;
        nx = dx > 0 ? Math.min(nx, cellOf(nx + r) * CELL - r - EPS) : Math.max(nx, (cellOf(nx - r) + 1) * CELL + r + EPS);
        if ((dx > 0 && nx < body.x) || (dx < 0 && nx > body.x) || blocked(lv, nx, body.z, r, feet)) nx = body.x;
      }
      body.x = nx;
    }
    if (dz !== 0) {
      let nz = body.z + dz;
      if (blocked(lv, body.x, nz, r, feet)) {
        hitZ = true;
        nz = dz > 0 ? Math.min(nz, cellOf(nz + r) * CELL - r - EPS) : Math.max(nz, (cellOf(nz - r) + 1) * CELL + r + EPS);
        if ((dz > 0 && nz < body.z) || (dz < 0 && nz > body.z) || blocked(lv, body.x, nz, r, feet)) nz = body.z;
      }
      body.z = nz;
    }
    return { hitX, hitZ };
  }

  /**
   * 광선 판정 (격자 DDA). 벽, 상자 옆면·윗면, 바닥, 천장에 처음 닿는 곳.
   * 방향 (dx,dy,dz)는 길이 1. 닿지 않으면 null.
   */
  function raycast(lv, ox, oy, oz, dx, dy, dz, maxDist) {
    let cx = cellOf(ox), cz = cellOf(oz);
    const stepX = dx > 0 ? 1 : -1;
    const stepZ = dz > 0 ? 1 : -1;
    const adx = Math.abs(dx), adz = Math.abs(dz);
    const tDeltaX = adx > 1e-9 ? CELL / adx : Infinity;
    const tDeltaZ = adz > 1e-9 ? CELL / adz : Infinity;
    let tMaxX = adx > 1e-9 ? (dx > 0 ? (cx + 1) * CELL - ox : ox - cx * CELL) / adx : Infinity;
    let tMaxZ = adz > 1e-9 ? (dz > 0 ? (cz + 1) * CELL - oz : oz - cz * CELL) / adz : Infinity;
    let tEnter = 0, nx = 0, nz = 0;
    const out = (t, hx, hy, hz) => ({ t, x: ox + dx * t, y: oy + dy * t, z: oz + dz * t, nx: hx, ny: hy, nz: hz, cx, cz });
    for (let i = 0; i < 512; i++) {
      const tExit = Math.min(tMaxX, tMaxZ);
      const hgt = heightAt(lv, cx, cz);
      if (tEnter > maxDist) return null;
      if (oy + dy * tEnter < hgt) return out(tEnter, nx, 0, nz);
      if (dy < 0) {
        const tt = (hgt - oy) / dy;
        if (tt >= tEnter && tt <= tExit) return tt <= maxDist ? out(tt, 0, 1, 0) : null;
      } else if (dy > 0) {
        const tc = (WALL_H - oy) / dy;
        if (tc >= tEnter && tc <= tExit) return tc <= maxDist ? out(tc, 0, -1, 0) : null;
      }
      if (tExit > maxDist) return null;
      if (tMaxX < tMaxZ) {
        cx += stepX;
        tEnter = tMaxX;
        tMaxX += tDeltaX;
        nx = -stepX;
        nz = 0;
      } else {
        cz += stepZ;
        tEnter = tMaxZ;
        tMaxZ += tDeltaZ;
        nx = 0;
        nz = -stepZ;
      }
    }
    return null;
  }

  /** 두 점 사이가 뚫려 있는지 (상자 위로는 볼 수 있어요) */
  function lineOfSight(lv, ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const d = Math.hypot(dx, dy, dz);
    if (d < 1e-6) return true;
    return !raycast(lv, ax, ay, az, dx / d, dy / d, dz / d, d);
  }

  /** 땅 위를 걷는 적이 지나갈 수 있는 칸 */
  const walkable = (lv, cx, cz) => heightAt(lv, cx, cz) === 0;

  /**
   * 플레이어 칸에서 퍼져 나가는 거리 지도 (너비 우선 탐색). 걸을 수 없는 칸은 -1.
   * 플레이어가 상자 위에 있어도 그 칸에서 시작해서, 적들이 상자 둘레로 모여들어요.
   */
  function flowField(lv, tx, tz, field) {
    const n = lv.w * lv.h;
    field = field || new Int16Array(n);
    field.fill(-1);
    const sx = Math.max(0, Math.min(lv.w - 1, cellOf(tx)));
    const sz = Math.max(0, Math.min(lv.h - 1, cellOf(tz)));
    const queue = flowField._q && flowField._q.length >= n ? flowField._q : (flowField._q = new Int32Array(n));
    let head = 0, tail = 0;
    field[sz * lv.w + sx] = 0;
    queue[tail++] = sz * lv.w + sx;
    while (head < tail) {
      const i = queue[head++];
      const cx = i % lv.w, cz = (i / lv.w) | 0;
      const d = field[i] + 1;
      if (cx > 0 && field[i - 1] < 0 && walkable(lv, cx - 1, cz)) { field[i - 1] = d; queue[tail++] = i - 1; }
      if (cx < lv.w - 1 && field[i + 1] < 0 && walkable(lv, cx + 1, cz)) { field[i + 1] = d; queue[tail++] = i + 1; }
      if (cz > 0 && field[i - lv.w] < 0 && walkable(lv, cx, cz - 1)) { field[i - lv.w] = d; queue[tail++] = i - lv.w; }
      if (cz < lv.h - 1 && field[i + lv.w] < 0 && walkable(lv, cx, cz + 1)) { field[i + lv.w] = d; queue[tail++] = i + lv.w; }
    }
    return field;
  }

  const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

  /**
   * 거리 지도에서 다음에 갈 칸의 중심 → {x, z} (더 가까운 칸이 없으면 null)
   * 대각선은 양옆 칸이 모두 비어 있을 때만 (모서리에 걸리지 않게)
   */
  function nextStep(lv, field, x, z) {
    const cx = cellOf(x), cz = cellOf(z);
    if (cx < 0 || cz < 0 || cx >= lv.w || cz >= lv.h) return null;
    const here = field[cz * lv.w + cx];
    let best = here < 0 ? 32767 : here, bx = -1, bz = -1;
    for (const [ox, oz] of NEIGHBORS) {
      const nx = cx + ox, nz = cz + oz;
      if (nx < 0 || nz < 0 || nx >= lv.w || nz >= lv.h) continue;
      const v = field[nz * lv.w + nx];
      if (v < 0) continue;
      if (ox !== 0 && oz !== 0 && (!walkable(lv, cx + ox, cz) || !walkable(lv, cx, cz + oz))) continue;
      if (v < best) {
        best = v;
        bx = nx;
        bz = nz;
      }
    }
    if (bx < 0) return null;
    return { x: (bx + 0.5) * CELL, z: (bz + 0.5) * CELL, dist: best };
  }

  SZ.level = {
    CELL,
    WALL_H,
    MAP,
    MATERIAL,
    create,
    cellOf,
    heightAt,
    heightAtPos,
    charAt,
    maxHeightUnder,
    blocked,
    slide,
    raycast,
    lineOfSight,
    walkable,
    flowField,
    nextStep,
  };
})(typeof window !== 'undefined' ? window : globalThis);
