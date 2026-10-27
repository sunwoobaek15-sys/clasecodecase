/* SECTOR ZERO 단위 테스트 — 맵, 충돌, 광선 판정, 길찾기, 규칙 (실행: npm test) */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

require('../fps/js/math.js');
require('../fps/js/level.js');
require('../fps/js/rules.js');
require('../fps/js/textures.js');

const { level: L, rules: R, math: M } = globalThis.SZ;
const lv = L.create();
const SOLID = (lv, cx, cz) => L.heightAt(lv, cx, cz) > 0;

test('맵: 모든 줄 길이가 같고 바깥은 벽으로 막혀 있어요', () => {
  const w = L.MAP[0].length;
  L.MAP.forEach((row, z) => assert.equal(row.length, w, z + '번째 줄'));
  for (let i = 0; i < w; i++) {
    assert.equal(L.heightAt(lv, i, 0), L.WALL_H);
    assert.equal(L.heightAt(lv, i, lv.h - 1), L.WALL_H);
  }
  for (let i = 0; i < lv.h; i++) {
    assert.equal(L.heightAt(lv, 0, i), L.WALL_H);
    assert.equal(L.heightAt(lv, lv.w - 1, i), L.WALL_H);
  }
  assert.equal(L.MAP.join('').split('P').length - 1, 1, '시작 지점은 하나');
  assert.ok(lv.spawns.length >= 4, '적 출현 지점이 넉넉해요');
  assert.ok(lv.lamps.length > 0);
});

test('맵: 걸을 수 있는 모든 칸, 출현 지점, 아이템이 시작 지점과 이어져 있어요', () => {
  const field = L.flowField(lv, lv.player.x, lv.player.z);
  for (let z = 0; z < lv.h; z++) {
    for (let x = 0; x < lv.w; x++) {
      if (!SOLID(lv, x, z)) assert.ok(field[z * lv.w + x] >= 0, `(${x}, ${z}) 칸에 갈 수 없어요`);
    }
  }
  for (const p of [...lv.spawns, ...lv.pickups]) assert.ok(field[L.cellOf(p.z) * lv.w + L.cellOf(p.x)] > 0);
});

test('길찾기: 출현 지점에서 한 걸음씩 가면 플레이어에게 닿아요', () => {
  const field = L.flowField(lv, lv.player.x, lv.player.z);
  for (const s of lv.spawns) {
    let x = s.x, z = s.z, steps = 0;
    let d = field[L.cellOf(z) * lv.w + L.cellOf(x)];
    while (d > 0 && steps < 200) {
      const n = L.nextStep(lv, field, x, z);
      assert.ok(n, '다음 칸이 있어요');
      assert.ok(n.dist < d, '거리가 줄어요');
      x = n.x;
      z = n.z;
      d = n.dist;
      steps++;
    }
    assert.equal(d, 0);
  }
});

test('광선: 정면 원자로 벽, 바닥, 천장에 맞는 거리', () => {
  const { x, z } = lv.player; // (31, 41) 원자로 남쪽 면은 z = 34
  const front = L.raycast(lv, x, 1.6, z, 0, 0, -1, 100);
  assert.ok(front);
  assert.ok(Math.abs(front.t - (z - 34)) < 1e-6);
  assert.equal(front.nz, 1);
  const s = Math.SQRT1_2;
  const down = L.raycast(lv, x, 1.6, z, 0, -s, -s, 100);
  assert.ok(Math.abs(down.y) < 1e-6 && down.ny === 1);
  const up = L.raycast(lv, x, 1.6, z, 0, s, -s, 100);
  assert.ok(Math.abs(up.y - L.WALL_H) < 1e-6 && up.ny === -1);
  assert.equal(L.raycast(lv, x, 1.6, z, 0, 0, -1, 3), null, '사거리 밖이면 null');
});

test('광선: 낮은 상자(1m) 위로는 지나가고, 아래로는 막혀요', () => {
  // 상자 c 가 (12, 10) 칸에 있어요 → x 24..26, z 20..22
  assert.equal(L.charAt(lv, 12, 10), 'c');
  const z = 21;
  assert.ok(L.lineOfSight(lv, 20, 1.5, z, 30, 1.5, z), '1.5m 높이는 상자 위로 보여요');
  assert.ok(!L.lineOfSight(lv, 20, 0.5, z, 30, 0.5, z), '0.5m 높이는 상자에 막혀요');
  const hit = L.raycast(lv, 20, 0.5, z, 1, 0, 0, 100);
  assert.ok(Math.abs(hit.x - 24) < 1e-6 && hit.nx === -1);
});

test('충돌: 벽에 부딪히면 벽 면에 딱 붙어 멈추고, 상자는 올라선 높이에 따라 달라요', () => {
  const r = 0.32;
  // 시작 지점에서 북쪽 원자로 면(z=34)으로 크게 걸어가기
  const body = { x: lv.player.x, z: 35 };
  const hitN = L.slide(lv, body, 0, -1.5, r, 0);
  assert.ok(hitN.hitZ);
  assert.ok(Math.abs(body.z - (34 + r)) < 1e-3, '벽 면에 붙어요');
  assert.ok(!L.blocked(lv, body.x, body.z, r, 0));
  // 낮은 상자: 바닥에서는 막히고, 1m 높이에서는 지나가요
  const a = { x: 23.5, z: 21 };
  L.slide(lv, a, 1, 0, r, 0);
  assert.ok(a.x <= 24 - r + 1e-3);
  const b = { x: 23.5, z: 21 };
  L.slide(lv, b, 1, 0, r, 1.0);
  assert.ok(Math.abs(b.x - 24.5) < 1e-9);
  assert.equal(L.maxHeightUnder(lv, b.x, b.z, r), 1);
});

test('규칙: 웨이브가 커질수록 적이 늘고, 중장갑은 3웨이브부터', () => {
  let prev = 0;
  for (let n = 1; n <= 20; n++) {
    const p = R.wavePlan(n);
    assert.equal(p.drones + p.runners + p.brutes, p.total);
    assert.ok(p.total > prev);
    prev = p.total;
    assert.ok(p.drones >= 0 && p.runners >= 0);
    assert.ok(p.maxAlive <= 14 && p.spawnGap >= 0.45);
    if (n < 3) assert.equal(p.brutes, 0);
    else assert.ok(p.brutes >= 1);
    const order = R.spawnOrder(p, M.rng(n));
    assert.equal(order.length, p.total);
    assert.equal(order.filter((t) => t === 'brute').length, p.brutes);
    assert.ok(!order.slice(0, 2).includes('brute'), '처음 두 마리는 중장갑이 아니에요');
  }
});

test('규칙: 콤보 점수, 치명타, 산탄총 거리 감소', () => {
  assert.equal(R.killScore('drone', false, 1), 100);
  assert.equal(R.killScore('drone', true, 1), 150);
  assert.equal(R.killScore('runner', false, 3), 180);
  assert.equal(R.comboMul(100), 3);
  const sg = R.WEAPONS.find((w) => w.id === 'shotgun');
  assert.equal(R.damageAt(sg, 5), sg.damage);
  assert.ok(R.damageAt(sg, 30) < sg.damage);
  assert.ok(R.damageAt(sg, 500) >= sg.damage * 0.3 - 1e-9);
  const rifle = R.WEAPONS.find((w) => w.id === 'rifle');
  assert.equal(R.damageAt(rifle, 80), rifle.damage);
});

test('규칙: 머리를 맞히면 치명타, 빗나가면 null', () => {
  const runner = { type: 'runner', x: 0, y: 0, z: -10 };
  const head = R.rayEnemy(0, 1.62, 0, 0, 0, -1, runner);
  assert.ok(head && head.crit);
  const body = R.rayEnemy(0, 0.8, 0, 0, 0, -1, runner);
  assert.ok(body && !body.crit);
  assert.ok(Math.abs(body.t - (10 - R.ENEMIES.runner.body[1])) < 1e-9);
  assert.equal(R.rayEnemy(0, 1.62, 0, 1, 0, 0, runner), null);
  const drone = { type: 'drone', x: 0, y: 1.9, z: -8 };
  assert.ok(R.rayEnemy(0, 1.9, 0, 0, 0, -1, drone).crit, '드론 코어');
});

test('무기: 탄창과 예비 탄약 값이 말이 돼요', () => {
  R.WEAPONS.forEach((w, i) => {
    assert.equal(w.slot, i + 1);
    assert.ok(w.mag > 0 && w.damage > 0 && w.fireDelay > 0 && w.reload > 0);
    assert.ok(w.reserve <= w.maxReserve);
    assert.ok(w.holdDelay >= w.fireDelay);
  });
});

test('질감: 크기가 2의 거듭제곱이라 반복해서 붙일 수 있어요', () => {
  const t = SZ.textures.build();
  for (const [name, { size, data }] of Object.entries(t)) {
    assert.equal(size & (size - 1), 0, name);
    assert.equal(data.length, size * size * 4, name);
  }
});

test('수학: 행렬 곱과 회전이 맞아요', () => {
  const m = M.m4.create();
  M.m4.translate(m, 1, 2, 3);
  M.m4.rotateY(m, Math.PI / 2);
  const p = M.m4.point([0, 0, 0], m, 0, 0, -1);
  // 요 90°는 -X 쪽을 봐요: (1,2,3)에서 앞으로 1m → (0,2,3)
  assert.ok(Math.abs(p[0]) < 1e-6 && Math.abs(p[1] - 2) < 1e-6 && Math.abs(p[2] - 3) < 1e-6);
  assert.ok(Math.abs(M.yawTo(-1, 0) - Math.PI / 2) < 1e-9);
  assert.ok(Math.abs(M.angleDiff(3, -3) - (2 * Math.PI - 6)) < 1e-9);
});
