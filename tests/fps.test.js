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
    assert.equal(p.drones + p.runners + p.brutes + p.bombers + p.bosses, p.total);
    assert.equal(p.bombers > 0, n >= 4, '자폭 드론은 4웨이브부터');
    assert.equal(p.bosses, n % 5 === 0 ? 1 : 0, '지휘관은 5웨이브마다');
    if (!p.bosses) assert.ok(p.total > prev);
    else assert.equal(p.brutes, 0, '지휘관 웨이브에는 중장갑이 없어요');
    prev = p.total;
    assert.ok(p.drones >= 0 && p.runners >= 0);
    assert.ok(p.maxAlive <= 14 && p.spawnGap >= 0.45);
    if (n < 3) assert.equal(p.brutes, 0);
    else assert.ok(p.brutes + p.bosses >= 1);
    const order = R.spawnOrder(p, M.rng(n));
    assert.equal(order.length, p.total);
    assert.equal(order.filter((t) => t === 'brute').length, p.brutes);
    assert.equal(order.filter((t) => t === 'bomber').length, p.bombers);
    assert.equal(order.filter((t) => t === 'boss').length, p.bosses);
    if (p.bosses) assert.equal(order.indexOf('boss'), 3, '지휘관은 네 번째쯤');
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

test('적: 지휘관은 중장갑 모델을 키운 모습이고, 히트박스도 같은 비율이에요', () => {
  const boss = R.ENEMIES.boss, brute = R.ENEMIES.brute;
  assert.equal(boss.model, 'brute');
  assert.ok(boss.boss && boss.scale > 1 && boss.fan > 1);
  for (let i = 0; i < 3; i++) {
    assert.ok(Math.abs(boss.body[i] - brute.body[i] * boss.scale) < 1e-9, 'body ' + i);
    assert.ok(Math.abs(boss.head[i] - brute.head[i] * boss.scale) < 1e-9, 'head ' + i);
  }
  assert.ok(boss.head[0] + boss.head[2] < L.WALL_H, '천장보다 낮아요');
  assert.ok(boss.radius * 2 < L.CELL, '한 칸 통로를 지나갈 수 있어요');
  // 모든 적은 이름·점수·히트박스가 있어요
  for (const [k, d] of Object.entries(R.ENEMIES)) {
    assert.ok(d.name && d.score > 0 && d.hp > 0 && d.body.length === 3 && d.head.length === 3, k);
    assert.ok(['shoot', 'melee', 'explode'].includes(d.attack), k);
  }
});

test('강화: 아무것도 안 고르면 무기 값이 그대로예요', () => {
  const none = R.upgradeMods({});
  assert.equal(none.maxHp, R.PLAYER.maxHp);
  assert.equal(none.leech, 0);
  for (const w of R.WEAPONS) {
    const st = R.weaponStats(w, none);
    for (const k of ['damage', 'mag', 'reload', 'fireDelay', 'holdDelay', 'pellets', 'headMul', 'recoil', 'spread', 'bloom', 'maxSpread', 'falloff']) {
      assert.ok(Math.abs(st[k] - w[k]) < 1e-9, w.id + '.' + k);
    }
    assert.deepEqual(R.weaponStats(w), st, '강화 없이 불러도 같아요');
  }
});

test('강화: 고를수록 세지고, 최대 단계를 넘지 않아요', () => {
  const rifle = R.WEAPONS.find((w) => w.id === 'rifle');
  const sg = R.WEAPONS.find((w) => w.id === 'shotgun');
  const pistol = R.WEAPONS.find((w) => w.id === 'pistol');
  const one = R.upgradeMods({ dmg: 1, rate: 1, reload: 1, mag: 1, crit: 1, steady: 1, pellets: 1, armor: 1, leech: 1, speed: 1, scavenge: 1 });
  const st = R.weaponStats(rifle, one);
  assert.ok(st.damage > rifle.damage && st.fireDelay < rifle.fireDelay && st.reload < rifle.reload);
  assert.ok(st.mag > rifle.mag && Number.isInteger(st.mag));
  assert.ok(st.headMul > rifle.headMul && st.recoil < rifle.recoil && st.spread < rifle.spread);
  assert.equal(R.weaponStats(sg, one).pellets, sg.pellets + 3, '산탄총만 알이 늘어요');
  assert.equal(R.weaponStats(pistol, one).pellets, 1);
  assert.equal(R.weaponStats(sg, one).spread, sg.spread, '산탄 퍼짐은 그대로 (알이 모여 버리지 않게)');
  assert.ok(one.maxHp > R.PLAYER.maxHp && one.leech > 0 && one.speed > 1);
  // 최대 단계를 넘겨도 최대 단계 값
  const lots = {};
  const maxed = {};
  for (const u of R.UPGRADES) {
    lots[u.id] = u.max + 5;
    maxed[u.id] = u.max;
  }
  assert.deepEqual(R.upgradeMods(lots), R.upgradeMods(maxed));
});

test('강화: 고를 카드는 서로 다르고, 다 채운 강화는 안 나와요', () => {
  const rand = M.rng(7);
  for (let i = 0; i < 50; i++) {
    const offer = R.offerUpgrades({}, rand);
    assert.equal(offer.length, 3);
    assert.equal(new Set(offer.map((u) => u.id)).size, 3);
    offer.forEach((u) => assert.ok(u.name && u.desc && R.UPGRADE_CATS[u.cat], u.id));
  }
  const almost = {};
  for (const u of R.UPGRADES) almost[u.id] = u.max;
  almost.dmg = 0;
  almost.leech = 1;
  const left = R.offerUpgrades(almost, rand).map((u) => u.id).sort();
  assert.deepEqual(left, ['dmg', 'leech'], '남은 것만 나와요');
  almost.dmg = R.UPGRADE_BY_ID.dmg.max;
  almost.leech = R.UPGRADE_BY_ID.leech.max;
  assert.equal(R.offerUpgrades(almost, rand).length, 0, '다 채우면 고를 게 없어요');
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

/* ---------- 총 애니메이션 (anim.js) ---------- */
require('../fps/js/anim.js');
const AN = globalThis.SZ.anim;
const ROOT_CH = ['x', 'y', 'z', 'rx', 'ry', 'rz'];
const ctxFor = (id, action, u) => ({ id, action, u, aim: 0, sprint: 0, bobPhase: 0, bobAmt: 0, swayX: 0, swayY: 0, strafe: 0, vy: 0, onGround: true, land: 0, time: 0 });
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const restSpin = (v) => near(((v % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), 0) || near(((v % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), 2 * Math.PI);

test('총 애니메이션: 모든 동작의 자세 값이 유한한 수예요', () => {
  for (const [id, set] of Object.entries(AN.ANIMS)) {
    for (const [name, a] of Object.entries(set)) {
      for (let u = 0; u <= 1.0001; u += 0.02) {
        const r = AN.sampleObj(a.root, u, [...ROOT_CH, 'spin'], {});
        const l = AN.sampleObj(a.left, u, ROOT_CH, {});
        for (const v of [...Object.values(r), ...Object.values(l), AN.sampleNum(a.slide, u), AN.sampleNum(a.bolt, u), AN.sampleNum(a.pump, u), AN.sampleNum(a.mag, u)]) {
          assert.ok(Number.isFinite(v), `${id}.${name} u=${u.toFixed(2)}`);
        }
      }
      for (const keys of [a.root, a.left, a.slide, a.bolt, a.pump, a.mag, a.magMode, a.hold, a.events]) {
        if (!keys) continue;
        for (let i = 1; i < keys.length; i++) assert.ok(keys[i][0] >= keys[i - 1][0], `${id}.${name} 키 순서`);
      }
    }
  }
});

test('총 애니메이션: 재장전·살펴보기·꺼내기·펌프는 쉬는 자세에서 끝나요 (끊김 없이 이어져요)', () => {
  for (const [id, set] of Object.entries(AN.ANIMS)) {
    for (const name of ['reload', 'inspect', 'draw', 'pump', 'rack']) {
      const a = set[name];
      if (!a) continue;
      const r = AN.sampleObj(a.root, 1, [...ROOT_CH, 'spin'], {});
      const l = AN.sampleObj(a.left, 1, ROOT_CH, {});
      for (const c of ROOT_CH) {
        assert.ok(near(r[c], 0), `${id}.${name} 총 ${c}`);
        assert.ok(near(l[c], 0), `${id}.${name} 왼손 ${c}`);
      }
      assert.ok(restSpin(r.spin), `${id}.${name} 회전은 한 바퀴 단위로 끝나요`);
      for (const k of ['slide', 'bolt', 'pump', 'mag']) assert.ok(near(AN.sampleNum(a[k], 1), 0), `${id}.${name} ${k}`);
      assert.equal(AN.step(a.magMode, 1, 'gun'), 'gun');
      assert.equal(AN.step(a.hold, 1, null), null);
      if (name !== 'draw') {
        const r0 = AN.sampleObj(a.root, 0, ROOT_CH, {});
        if (name !== 'rack') for (const c of ROOT_CH) assert.ok(near(r0[c], 0), `${id}.${name} 시작 ${c}`);
      }
    }
  }
});

test('총 애니메이션: 산탄 넣기는 끊김 없이 반복되고, 들어가기·마무리와 이어져요', () => {
  const sg = AN.ANIMS.shotgun;
  const at = (a, u) => [AN.sampleObj(a.root, u, ROOT_CH, {}), AN.sampleObj(a.left, u, ROOT_CH, {})];
  const same = ([r1, l1], [r2, l2], msg) => {
    for (const c of ROOT_CH) {
      assert.ok(near(r1[c], r2[c]), msg + ' 총 ' + c);
      assert.ok(near(l1[c], l2[c]), msg + ' 왼손 ' + c);
    }
  };
  same(at(sg.shell, 0), at(sg.shell, 1), '한 발 시작 = 끝');
  same(at(sg.shellEnter, 1), at(sg.shell, 0), '들어가기 끝 = 한 발 시작');
  same(at(sg.shell, 1), at(sg.rack, 0), '한 발 끝 = 마무리 시작');
});

test('총 애니메이션: 탄창이 손 ↔ 총으로 넘어갈 때 제자리에 있어요', () => {
  for (const id of ['pistol', 'rifle']) {
    const a = AN.ANIMS[id].reload;
    const g = AN.GEOM[id];
    // 손에서 총으로 넘어가는 순간 (마지막 'gun' 단계)
    assert.ok(a.magMode.some(([, m]) => m === 'hand'), id + ' 새 탄창은 손에 들고 와요');
    const handToGun = a.magMode.filter(([, m]) => m === 'gun').pop()[0];
    const left = AN.sampleObj(a.left, handToGun, ROOT_CH, {});
    assert.ok(near(left.rx, 0) && near(left.ry, 0) && near(left.rz, 0), id + ' 손은 바로 서 있어요');
    const off = AN.sampleNum(a.mag, handToGun);
    const ay = Math.cos(g.mag.rx), az = Math.sin(g.mag.rx);
    const fromHand = [g.left[0] + left.x, g.left[1] + left.y + ay * AN.MAG_GRIP, g.left[2] + left.z + az * AN.MAG_GRIP];
    const inGun = [g.mag.seat[0], g.mag.seat[1] + ay * off, g.mag.seat[2] + az * off];
    for (let i = 0; i < 3; i++) assert.ok(near(fromHand[i], inGun[i], 1e-3), `${id} 탄창 위치 ${i}: ${fromHand[i]} vs ${inGun[i]}`);
  }
});

test('총 애니메이션: 사건(소리·탄창 떨어뜨리기)은 순서대로 한 번씩 일어나요', () => {
  for (const [id, set] of Object.entries(AN.ANIMS)) {
    for (const [name, a] of Object.entries(set)) {
      if (!a.events) continue;
      const vm = AN.create();
      const seen = [];
      for (let u = 0; u <= 1.00001; u += 0.01) seen.push(...AN.update(vm, 1 / 60, ctxFor(id, name, Math.min(1, u))));
      assert.deepEqual(seen, a.events.map(([, n]) => n), `${id}.${name}`);
    }
  }
  assert.ok(AN.ANIMS.rifle.reload.events.some(([, n]) => n === 'dropMag'));
  assert.ok(AN.ANIMS.pistol.reload.events.some(([, n]) => n === 'dropMag'));
  assert.ok(AN.ANIMS.shotgun.pump.events.some(([, n]) => n === 'ejectShell'));
});

test('총 애니메이션: 쏘면 크게 튀었다가 스프링처럼 제자리로 돌아와요', () => {
  for (const id of ['pistol', 'rifle', 'shotgun']) {
    const vm = AN.create();
    AN.update(vm, 1 / 60, ctxFor(id, null, 0));
    const restZ = vm.pose.z, restRx = vm.pose.rx;
    AN.fire(vm, id, 0);
    AN.update(vm, 1 / 120, ctxFor(id, null, 0));
    assert.ok(vm.pose.z - restZ > AN.KICK[id].z * 0.8, id + ' 뒤로 튀어요');
    assert.ok(vm.pose.rx - restRx > AN.KICK[id].rx * 0.5, id + ' 총구가 들려요');
    for (let i = 0; i < 90; i++) AN.update(vm, 1 / 60, ctxFor(id, null, 0));
    assert.ok(near(vm.pose.z, restZ, 1e-3) && near(vm.pose.rx, restRx, 1e-3), id + ' 1.5초 뒤 제자리');
  }
  assert.ok(AN.KICK.shotgun.rx > AN.KICK.pistol.rx && AN.KICK.pistol.rx > AN.KICK.rifle.rx, '산탄총 > 권총 > 소총 반동');
});

test('총 애니메이션: 정조준하면 가늠쇠가 화면 가운데로 와요', () => {
  for (const id of ['pistol', 'rifle', 'shotgun']) {
    const vm = AN.create();
    const c = Object.assign(ctxFor(id, null, 0), { aim: 1 });
    for (let i = 0; i < 60; i++) AN.update(vm, 1 / 60, c);
    assert.ok(Math.abs(vm.pose.x - AN.GEOM[id].ads[0]) < 0.01, id);
    assert.ok(Math.abs(vm.pose.y - AN.GEOM[id].ads[1]) < 0.01, id);
  }
});

/* ---------- 3D 모델 (fps/assets/*.glb) ---------- */
require('../fps/js/gltf.js');
require('../fps/js/assets-data.js');
const GL = globalThis.SZ.gltf;
const fs = require('node:fs');
const path = require('node:path');
const ASSET_DIR = path.join(__dirname, '..', 'fps', 'assets');
const loadGLB = (key) => {
  const b = fs.readFileSync(path.join(ASSET_DIR, key + '.glb'));
  return GL.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
};
const names = (g) => new Set(g.nodes.map((n) => n.name));
const nodeT = (g, name) => {
  const n = g.nodes.find((x) => x.name === name);
  return [n.local[12], n.local[13], n.local[14]];
};

test('3D 모델: 묶음(assets-data.js)이 GLB 파일과 같아요 — 다르면 npm run assets:pack', () => {
  const keys = Object.keys(globalThis.SZ.ASSET_DATA).sort();
  assert.deepEqual(keys, ['guns/hands', 'guns/pistol', 'guns/rifle', 'guns/shotgun', 'props/casings', 'robots/bomber', 'robots/brute', 'robots/drone', 'robots/runner']);
  for (const k of keys) {
    const file = fs.readFileSync(path.join(ASSET_DIR, k + '.glb'));
    assert.ok(Buffer.from(globalThis.SZ.ASSET_DATA[k], 'base64').equals(file), k);
  }
});

test('3D 모델: 게임이 움직이는 부품 이름이 다 있어요', () => {
  const need = {
    'guns/pistol': ['slide', 'magazine', 'muzzle', 'eject'],
    'guns/rifle': ['bolt', 'magazine', 'muzzle', 'eject'],
    'guns/shotgun': ['pump', 'muzzle', 'eject'],
    'guns/hands': ['hand_r', 'hand_l'],
    'props/casings': ['casing_9mm', 'casing_556', 'shell_12g'],
    'robots/drone': ['body', 'eye', 'pod_l', 'pod_r', 'antenna'],
    'robots/bomber': ['body', 'core', 'duct_l', 'duct_r', 'rotor_l', 'rotor_r'],
    'robots/runner': ['hips', 'torso', 'head', 'arm_l', 'arm_r', 'fore_l', 'fore_r', 'thigh_l', 'thigh_r', 'shin_l', 'shin_r', 'foot_l', 'foot_r'],
    'robots/brute': ['hips', 'torso', 'head', 'shoulder_l', 'shoulder_r', 'cannon_l', 'cannon_r', 'barrels_l', 'barrels_r', 'thigh_l', 'thigh_r', 'shin_l', 'shin_r', 'foot_l', 'foot_r'],
  };
  for (const [k, list] of Object.entries(need)) {
    const n = names(loadGLB(k));
    for (const name of list) assert.ok(n.has(name), `${k}: ${name}`);
  }
});

test('3D 모델: 총구·탄피 구멍·탄창 자리가 애니메이션 값(GEOM)과 같아요', () => {
  for (const id of ['pistol', 'rifle', 'shotgun']) {
    const g = loadGLB('guns/' + id);
    const geo = AN.GEOM[id];
    const close = (a, b, msg) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-4, `${id} ${msg} ${a} vs ${b}`));
    close(nodeT(g, 'muzzle'), geo.muzzle, '총구');
    close(nodeT(g, 'eject'), geo.eject, '탄피 구멍');
    if (geo.mag) {
      close(nodeT(g, 'magazine'), geo.mag.seat, '탄창 자리');
      const m = g.nodes.find((x) => x.name === 'magazine').local;
      // 탄창의 위쪽(+y)이 GEOM 기울기와 같은 방향
      assert.ok(Math.abs(m[5] - Math.cos(geo.mag.rx)) < 1e-4 && Math.abs(m[6] - Math.sin(geo.mag.rx)) < 1e-4, id + ' 탄창 기울기');
    }
    if (geo.bolt) {
      const b = nodeT(g, 'bolt');
      assert.ok(Math.hypot(b[0] - geo.bolt[0], b[1] - geo.bolt[1], b[2] - geo.bolt[2]) < 0.012, id + ' 장전 손잡이');
    }
  }
});

test('3D 모델: 로봇 크기가 히트박스와 맞고, 삼각형 수가 넉넉하지 않아요', () => {
  const R = globalThis.SZ.rules.ENEMIES;
  const top = (t) => R[t].head[0] + R[t].head[2];
  for (const t of ['runner', 'brute']) {
    const b = GL.bounds(loadGLB('robots/' + t));
    assert.ok(Math.abs(b.lo[1]) < 0.06, t + ' 발이 바닥에');
    assert.ok(b.hi[1] > top(t) - 0.2 && b.hi[1] < top(t) + 0.15, `${t} 키 ${b.hi[1].toFixed(2)} vs 머리 히트박스 위 ${top(t)}`);
  }
  const d = GL.bounds(loadGLB('robots/drone'));
  assert.ok(d.hi[0] - d.lo[0] > 0.8 && d.hi[0] - d.lo[0] < 1.2, '드론 폭');
  // 자폭 드론: 몸통 히트박스 안에 들어가고, 빨간 코어(치명타)가 맨 위
  const bm = GL.bounds(loadGLB('robots/bomber'));
  const bd = R.bomber;
  assert.ok(bm.hi[0] - bm.lo[0] > 0.6 && bm.hi[0] - bm.lo[0] < 2 * bd.body[1] + 0.25, '자폭 드론 폭 ' + (bm.hi[0] - bm.lo[0]).toFixed(2));
  assert.ok(Math.abs(bm.hi[1] - (bd.head[0] + bd.head[2])) < 0.06, '자폭 드론 코어 높이 ' + bm.hi[1].toFixed(3));
  for (const k of Object.keys(globalThis.SZ.ASSET_DATA)) {
    const tris = GL.triangles(loadGLB(k));
    assert.ok(tris > 100 && tris < (k.startsWith('robots') ? 5000 : 10000), `${k}: ${tris} 삼각형`);
  }
});

test('3D 모델 만들기 도구: 닫힌 도형은 모든 면이 바깥을 봐요 (뒷면 지우기에 안 사라져요)', async () => {
  const G3 = await import('../scripts/assets/geom.mjs');
  const W = [1, 1, 1];
  const shapes = [
    G3.box(0.4, 0.2, 0.3, W, 0.03),
    G3.cylinder('z', 0.1, 0.06, -0.2, 0.2, 12, W),
    G3.cylinder('x', 0.1, 0.05, 0.2, -0.2, 10, W),
    G3.lathe('y', [[0, -0.2], [0.2, -0.18], [0.3, 0], [0.2, 0.18], [0, 0.2]], 16, W),
    G3.sphere(0.2, 12, 8, W),
    G3.extrude(G3.circle(0.1, 6), -0.05, 0.05, 'x', W, 0.01),
  ];
  for (const m of shapes) {
    for (let k = 0; k < m.i.length; k += 3) {
      const v = [0, 1, 2].map((j) => [m.p[m.i[k + j] * 3], m.p[m.i[k + j] * 3 + 1], m.p[m.i[k + j] * 3 + 2]]);
      const cr = G3.cross(G3.sub(v[1], v[0]), G3.sub(v[2], v[0]));
      if (Math.hypot(...cr) < 1e-12) continue;
      const c = [0, 1, 2].map((j) => (v[0][j] + v[1][j] + v[2][j]) / 3);
      assert.ok(G3.dot(cr, c) > 0, '삼각형이 안쪽을 봐요');
    }
  }
  // 오목한 다각형도 삼각형으로 나눠요 (U자 방아쇠울: 꼭짓점 10개 → 8개)
  assert.equal(G3.triangulate([[0, 0], [1, 0], [1, 1], [0.8, 1], [0.8, 0.2], [0.2, 0.2], [0.2, 1], [0, 1]]).length, 6);
});

test('GLB 쓰기 ↔ 읽기: 노드 이름·자리·재질 빛이 그대로예요', async () => {
  const G3 = await import('../scripts/assets/geom.mjs');
  const { writeGLB } = await import('../scripts/assets/glb.mjs');
  const glb = writeGLB({
    materials: [{ name: 'paint', color: [1, 1, 1] }, { name: 'glow', color: [0, 0, 0], emissive: [3, 0.4, 0.2] }],
    nodes: [
      { name: 'root', t: [0, 0.5, 0], children: [1], prims: [{ mesh: G3.box(0.1, 0.1, 0.1, [0.5, 0.25, 1]), mat: 0 }] },
      { name: 'child', t: [0.1, 0, -0.2], r: [0.3, 0, 0], prims: [{ mesh: G3.sphere(0.05, 8, 6, [1, 1, 1]), mat: 1 }] },
    ],
    roots: [0],
  });
  const g = GL.parse(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength));
  assert.deepEqual(g.nodes.map((n) => n.name), ['root', 'child']);
  assert.deepEqual(g.nodes[0].children, [1]);
  const W = GL.worldMatrices(g);
  assert.ok(Math.abs(W[1][13] - 0.5) < 1e-6 && Math.abs(W[1][14] + 0.2) < 1e-6, '자식 위치 = 부모 + 자기');
  assert.ok(Math.abs(g.nodes[1].local[6] - Math.sin(0.3)) < 1e-5, '회전(쿼터니언)');
  assert.deepEqual(g.materials[1].emissive.map((v) => +v.toFixed(3)), [3, 0.4, 0.2]);
  const col = g.meshes[0][0].colors;
  assert.ok(Math.abs(col[0] - 0.5) < 0.01 && Math.abs(col[2] - 1) < 0.01, '꼭짓점 색');
});
