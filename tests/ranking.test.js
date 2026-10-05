/* 랭킹 규칙과 부정 사용 검사 테스트 — 실행: npm test */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

require('../js/util.js');
require('../js/data.js');
require('../js/engine.js');
require('../js/rank-rules.js');

const { engine: E, data: D, util: U, rank: K } = globalThis.SC;

const at = (key, hh = 12, mm = 0) => new Date(`${key}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`);
const DAY = '2026-10-05'; // 월요일
const save = (state, amount, now = at(DAY), extra = {}) =>
  E.addRecord(state, { item: '후드티', amount: String(amount), reason: '이미 비슷한 옷이 있음', ...extra }, now);
const ctxOf = (key, hh = 12) => ({ today: key, nowMs: at(key, hh).getTime() });
const codes = (flags) => flags.map((f) => f.code).sort();
const entryOf = (state, now) => K.normEntry(JSON.parse(JSON.stringify(K.buildEntry(state, now))));
const proofOf = (state, now) => K.normProof(JSON.parse(JSON.stringify(K.buildProof(state, now))));

/** 같은 결과가 나오는 난수 (mulberry32) */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 규칙대로만 플레이하는 가상 플레이어. style: 'casual'(들쭉날쭉) | 'max'(매일 한도까지 + 가치가 높은 것만 구매)
 * 마지막 날짜와 상태를 돌려줍니다.
 */
function simulate(days, seed, style) {
  const rand = rng(seed);
  const start = '2026-03-02';
  let state = E.createState(at(start, 9));
  E.completeOnboarding(state, { nickname: '테스터' }, at(start, 9));
  let key = start;
  for (let i = 0; i < days; i++) {
    key = U.addDays(start, i);
    const roll = rand();
    if (style === 'casual' && roll < 0.15) continue; // 쉬는 날
    if (style === 'casual' && roll < 0.22) {
      E.addCheckin(state, at(key, 21));
    } else {
      const n = style === 'max' ? 2 : 1 + Math.floor(rand() * 3);
      for (let j = 0; j < n; j++) {
        const amount = style === 'max' ? 30000 : [3000, 5000, 12000, 18000, 49000, 120000][Math.floor(rand() * 6)];
        save(state, amount, at(key, 10 + j * 3, Math.floor(rand() * 50)));
      }
    }
    while (state.pendingBonuses.length) E.claimBonus(state, rand() < 0.5 || style === 'max' ? 'lucky' : 'discount', at(key, 20));
    let d = E.derive(state, at(key, 20));
    for (const r of D.REGIONS) {
      if (!state.regions.includes(r.id) && d.cityLevel >= r.level) {
        E.unlockRegion(state, r.id, at(key, 20));
        d = E.derive(state, at(key, 20));
      }
    }
    // 살 수 있는 것 사기 / 업그레이드
    for (let guard = 0; guard < 30; guard++) {
      d = E.derive(state, at(key, 20, 30));
      const options = D.ITEMS.filter((it) => it.price > 0 && it.cat !== 'skin' && E.unlockStatus(it, d).unlocked && E.priceFor(state, it).final <= d.balance);
      const upgrades = state.buildings.map((b) => E.upgradeInfo(state, b.uid)).filter((u) => u && u.upgradable && u.cost <= d.balance);
      if (!options.length && !upgrades.length) break;
      if (upgrades.length && (style === 'max' || rand() < 0.4)) {
        const u = style === 'max' ? upgrades.sort((a, b) => a.cost - b.cost)[0] : upgrades[Math.floor(rand() * upgrades.length)];
        E.upgradeItem(state, u.building.uid, at(key, 20, 31));
        continue;
      }
      if (!options.length) break;
      const it = style === 'max' ? options.sort((a, b) => b.value / b.price - a.value / a.price)[0] : options[Math.floor(rand() * options.length)];
      const slot = E.firstEmptySlot(state);
      const placeable = it.cat !== 'vehicle';
      E.buyItem(state, it.id, placeable && slot ? slot : {}, at(key, 20, 32));
    }
    if (rand() < 0.3) state = E.normalizeState(JSON.parse(JSON.stringify(state)), at(key, 22)); // 앱을 껐다 켜기
  }
  return { state, key };
}

test('주 시작일: 월요일 기준', () => {
  assert.equal(U.weekStart('2026-10-05'), '2026-10-05');
  assert.equal(U.weekStart('2026-10-11'), '2026-10-05');
  assert.equal(U.weekStart('2026-10-12'), '2026-10-12');
  assert.equal(U.weekStart('2026-01-01'), '2025-12-29');
});

test('랭킹 카드: 인정 금액(하루 50,000원) 기준으로 계산', () => {
  const s = E.createState(at('2026-10-04'));
  save(s, 70000, at('2026-10-04')); // 지난주 일요일 → 50,000 인정
  save(s, 30000, at(DAY, 9));
  save(s, 40000, at(DAY, 10)); // 오늘 인정 20,000
  E.addCheckin(s, at('2026-10-06'));
  const e = K.buildEntry(s, at('2026-10-06', 20));
  assert.equal(e.week, '2026-10-05');
  assert.equal(e.weekSaved, 50000);
  assert.equal(e.total, 100000);
  assert.equal(e.days, 3);
  assert.equal(e.saveDays, 2);
  assert.equal(e.records, 3);
  assert.equal(e.streak, 3);
  assert.equal(e.last, '2026-10-06');
  assert.equal(e.earned, 1000);
  assert.deepEqual(codes(K.publicCheck(K.normEntry(e), ctxOf('2026-10-06'))), []);
});

test('상세 기록에는 이유·메모를 보내지 않아요', () => {
  const s = E.createState(at(DAY));
  save(s, 5000, at(DAY), { reason: '비밀 이유 문장', memo: '개인 메모 내용' });
  const json = JSON.stringify(K.buildProof(s, at(DAY, 13)));
  assert.ok(!json.includes('비밀 이유'));
  assert.ok(!json.includes('개인 메모'));
  assert.ok(json.includes('후드티'));
});

test('규칙대로 플레이하면 어떤 검사에도 걸리지 않아요 (가상 플레이 여러 판)', () => {
  for (const [style, seed, days] of [
    ['casual', 1, 160],
    ['casual', 7, 90],
    ['casual', 42, 220],
    ['max', 3, 200],
    ['max', 11, 60],
  ]) {
    const { state, key } = simulate(days, seed, style);
    const now = at(key, 23);
    const e = entryOf(state, now);
    const p = proofOf(state, now);
    const c = ctxOf(key, 23);
    assert.deepEqual(codes(K.publicCheck(e, c)), [], style + seed + ' 공개 검사');
    const audit = K.auditPlayer(e, p, c).filter((f) => f.level === 'high');
    assert.deepEqual(codes(audit), [], style + seed + ' 관리자 검사');
    assert.ok(K.visibility(e, null, c).visible);
    assert.ok(e.level > 1 && e.total > 0);
  }
});

test('랭킹 숫자를 직접 고치면 검사에 걸려요', () => {
  const { state, key } = simulate(40, 5, 'casual');
  const now = at(key, 23);
  const c = ctxOf(key, 23);
  const base = K.buildEntry(state, now);
  const check = (patch) => codes(K.publicCheck(K.normEntry(Object.assign({}, base, patch)), c));
  assert.ok(check({ total: base.total + 5000000 }).includes('cap'));
  assert.ok(check({ weekSaved: 400000 }).includes('cap'));
  assert.ok(check({ earned: base.earned + 100000 }).includes('tokens'));
  assert.ok(check({ bonus: 999999 }).includes('bonus'));
  assert.ok(check({ spent: base.earned + base.bonus + 1 }).includes('spent'));
  assert.ok(check({ value: 999999 }).includes('value'));
  assert.ok(check({ level: 50 }).includes('level'));
  assert.ok(check({ streak: base.days + 5, longest: base.days + 5 }).includes('streak'));
  assert.ok(check({ days: 999 }).includes('days'));
  assert.ok(check({ syncedAt: new Date(now.getTime() + 3 * 86400000).toISOString() }).includes('future'));
  assert.ok(check({ last: U.addDays(key, 5) }).includes('future'));
  assert.ok(check({ level: 'abc' }).includes('malformed'));
  assert.ok(check({ v: 99 }).includes('malformed'));
});

test('상세 기록과 랭킹 숫자가 다르거나 하루 한도를 넘으면 관리자 검사에 걸려요', () => {
  const { state, key } = simulate(30, 9, 'casual');
  const now = at(key, 23);
  const c = ctxOf(key, 23);
  const e = entryOf(state, now);
  const p = proofOf(state, now);
  assert.deepEqual(codes(K.auditPlayer(e, p, c).filter((f) => f.level === 'high')), []);
  const p2 = JSON.parse(JSON.stringify(p));
  p2.daily[p2.daily.length - 1].r += 1000;
  assert.ok(codes(K.auditPlayer(e, p2, c)).includes('mismatch'));
  const p3 = JSON.parse(JSON.stringify(p));
  p3.daily[0].r = 80000;
  assert.ok(codes(K.auditPlayer(e, p3, c)).includes('cap'));
  assert.ok(codes(K.auditPlayer(e, null, c)).includes('noProof'));
  assert.ok(!codes(K.auditPlayer(e, undefined, c)).includes('noProof'), '불러오는 중에는 표시하지 않음');
});

test('의심 패턴: 큰 금액, 매일 최대치, 짧은 시간에 몰아서 기록', () => {
  const s = E.createState(at('2026-09-20'));
  for (let i = 0; i < 10; i++) save(s, 50000, at(U.addDays('2026-09-20', i), 9));
  save(s, 2000000, at('2026-09-30', 9, 30));
  for (let i = 0; i < 10; i++) save(s, 1000, at('2026-09-30', 10, i));
  const now = at('2026-09-30', 12);
  const flags = K.auditPlayer(entryOf(s, now), proofOf(s, now), ctxOf('2026-09-30', 12));
  const c = codes(flags);
  assert.ok(c.includes('bigClaim'));
  assert.ok(c.includes('alwaysMax'));
  assert.ok(c.includes('burst'));
  assert.equal(K.riskOf(flags), 'mid');
});

test('기기 시계: 5분 넘게 뒤로 가면 한 번만 기록', () => {
  const s = E.createState(at(DAY, 12));
  assert.equal(E.observeClock(s, at(DAY, 13)), null);
  assert.equal(E.observeClock(s, at(DAY, 12, 57)), null, '3분 차이는 무시');
  const ev = E.observeClock(s, at(DAY, 9));
  assert.ok(ev);
  assert.equal(ev.back, 237);
  assert.equal(E.observeClock(s, at(DAY, 9, 1)), null, '같은 되돌림은 한 번만');
  assert.equal(s.security.clockBack, 1);
  E.observeClock(s, at('2026-10-09', 9));
  assert.ok(E.observeClock(s, at(DAY, 9, 30)));
  assert.equal(s.security.clockBack, 2);
  const restored = E.normalizeState(JSON.parse(JSON.stringify(s)), at(DAY, 10));
  assert.equal(restored.security.clockBack, 2);
  assert.equal(restored.security.clockEvents.length, 2);
  const e = K.normEntry(K.buildEntry(s, at(DAY, 10)));
  assert.equal(e.clock, 2);
  const flags = K.publicCheck(e, ctxOf(DAY));
  assert.ok(flags.some((f) => f.key === 'clock:2' && f.level === 'high'));
});

test('기록 순서와 시각이 거꾸로면 시계 조작 흔적으로 셉니다', () => {
  const s = E.createState(at('2026-10-01'));
  save(s, 5000, at('2026-10-07'));
  save(s, 5000, at('2026-10-03')); // 시계를 되돌린 뒤 기록
  save(s, 5000, at('2026-10-03', 13));
  assert.equal(K.timeReversals(s.history), 1);
  assert.ok(codes(K.publicCheck(entryOf(s, at('2026-10-07', 14)), ctxOf('2026-10-07', 14))).includes('order'));
});

test('저장 데이터 변조: 자동으로 숨기고, 관리자가 확인하면 보이고, 다시 바꾸면 또 숨겨요', () => {
  const s = E.createState(at(DAY));
  save(s, 10000, at(DAY));
  E.markTampered(s, at(DAY, 13));
  const c = ctxOf(DAY, 14);
  let e = entryOf(s, at(DAY, 14));
  let vis = K.visibility(e, null, c);
  assert.equal(vis.visible, false);
  assert.equal(vis.reason, 'auto');
  const mod = K.normMod(K.buildMod(null, 'ok', { allow: vis.flags.map((f) => f.key) }, at(DAY, 15)));
  assert.equal(K.visibility(e, mod, c).visible, true);
  E.markTampered(s, at(DAY, 16));
  e = entryOf(s, at(DAY, 16));
  vis = K.visibility(e, mod, c);
  assert.equal(vis.visible, false);
  assert.ok(vis.flags.some((f) => f.key === 'tampered:2'));
});

test('관리자 판정: 제외하면 숨기고, 경고는 순위에 남고, 기록은 10개까지', () => {
  const s = E.createState(at(DAY));
  save(s, 10000, at(DAY));
  const e = entryOf(s, at(DAY, 13));
  const c = ctxOf(DAY, 14);
  let mod = null;
  mod = K.normMod(K.buildMod(mod, 'hidden', { reason: 'fake', message: '<b>거짓</b> 기록' }, at(DAY, 14)));
  assert.equal(mod.status, 'hidden');
  assert.equal(mod.reason, 'fake');
  assert.equal(K.visibility(e, mod, c).reason, 'hidden');
  assert.equal(K.leaderboard([{ id: 'u1', entry: e, mod }], 'week', c).length, 0);
  mod = K.normMod(K.buildMod(mod, 'warned', { reason: 'nope', message: 'x'.repeat(200) }, at(DAY, 15)));
  assert.equal(mod.reason, 'other');
  assert.equal(mod.message.length, K.MOD_MESSAGE_MAX);
  assert.equal(K.leaderboard([{ id: 'u1', entry: e, mod }], 'week', c).length, 1);
  for (let i = 0; i < 15; i++) mod = K.normMod(K.buildMod(mod, i % 2 ? 'ok' : 'warned', {}, at(DAY, 16)));
  assert.equal(mod.history.length, 10);
  assert.equal(K.normMod({ status: 'banned' }), null);
  assert.throws(() => K.buildMod(null, 'banned', {}), /판정/);
});

test('순위: 같은 값은 같은 순위, 지난주 기록과 끊긴 STREAK은 0으로', () => {
  const mk = (patch) =>
    K.normEntry(
      Object.assign(
        { v: 1, nick: '시민', avatar: '🐷', title: 'newbie', level: 1, xp: 0, value: 0, total: 0, week: '2026-10-05', weekSaved: 0, streak: 0, longest: 0, last: null, days: 0, saveDays: 0, records: 0, earned: 0, bonus: 0, spent: 0, since: '2026-09-01', tampered: 0, clock: 0, order: 0, syncedAt: at(DAY).toISOString() },
        patch
      )
    );
  const base = { days: 10, saveDays: 10, records: 10, total: 300000, earned: 3000 };
  const players = [
    { id: 'a', entry: mk({ ...base, nick: '가', weekSaved: 100000, streak: 3, longest: 5, last: DAY }) },
    { id: 'b', entry: mk({ ...base, nick: '나', weekSaved: 100000, streak: 2, longest: 2, last: '2026-10-05' }) },
    { id: 'e', entry: mk({ ...base, nick: '마', weekSaved: 1000, streak: 7, longest: 7, last: '2026-10-04' }) }, // 이틀 전이 마지막 → 끊김
    { id: 'c', entry: mk({ ...base, nick: '다', weekSaved: 150000, week: '2026-09-28', streak: 9, longest: 9, last: '2026-10-01' }) },
    { id: 'd', entry: mk({ ...base, nick: '라', weekSaved: 50000, total: 999999999 }) }, // 자동 숨김
  ];
  const c = ctxOf('2026-10-06');
  const week = K.leaderboard(players, 'week', c);
  assert.deepEqual(
    week.map((r) => [r.id, r.rank, r.value]),
    [
      ['a', 1, 100000],
      ['b', 1, 100000],
      ['e', 3, 1000],
      ['c', 4, 0],
    ]
  );
  const streak = K.leaderboard(players, 'streak', c);
  assert.deepEqual(
    streak.map((r) => [r.id, r.value]),
    [
      ['a', 3],
      ['b', 2],
      ['c', 0],
      ['e', 0],
    ]
  );
});

test('다른 사람이 올린 이상한 데이터는 안전하게 정리돼요', () => {
  const e = K.normEntry({ v: 1, nick: '<img src=x onerror=alert(1)>' + 'x'.repeat(40), avatar: 'javascript:', title: '__proto__', level: -3, total: '9', week: 'nope', syncedAt: 'yesterday', constructor: 1 });
  assert.equal(e.malformed, true);
  assert.equal(e.avatar, '🙂');
  assert.equal(e.title, 'newbie');
  assert.equal(e.level, 0);
  assert.ok(Array.from(e.nick).length <= D.RULES.NICK_MAX);
  assert.equal(K.normEntry(null).malformed, true);
  assert.equal(K.normEntry([1, 2]).malformed, true);
  assert.equal(K.normProof({ v: 2 }), null);
  const p = K.normProof({ v: 1, daily: [{ d: '2026-10-05', r: -5 }, { d: 'bad' }], recent: [{ d: '2026-10-05', at: 'x' }], tz: 99999 });
  assert.equal(p.daily.length, 1);
  assert.equal(p.daily[0].r, 0);
  assert.equal(p.recent.length, 0);
  assert.equal(p.tz, 0);
});

test('참가 상태 저장: 계정이 바뀌면 동기화 기록을 새로 시작하고, 잘못된 값은 버려요', () => {
  const s = E.createState(at(DAY));
  assert.throws(() => K.markJoined(s, '', at(DAY)), /로그인/);
  assert.throws(() => K.markJoined(s, 'a/b', at(DAY)), /로그인/);
  K.markJoined(s, 'u_abc', at(DAY));
  K.markSynced(s, 'abc123', at(DAY, 13));
  assert.equal(s.ranking.syncs.length, 1);
  K.markJoined(s, 'u_other', at(DAY, 14));
  assert.equal(s.ranking.syncs.length, 0);
  assert.equal(s.ranking.lastHash, null);
  for (let i = 0; i < 30; i++) K.markSynced(s, 'h' + i, at(DAY, 15));
  assert.equal(s.ranking.syncs.length, K.SYNC_LOG_MAX);
  const r = E.normalizeState(JSON.parse(JSON.stringify(s)), at(DAY, 16));
  assert.equal(r.ranking.joined, true);
  assert.equal(r.ranking.uid, 'u_other');
  K.markLeft(r);
  assert.equal(r.ranking.joined, false);
  const bad = E.normalizeState({ ranking: { joined: true, uid: '../x', syncs: ['nope', 5] }, security: { tampered: 'yes', clockBack: -4, clockEvents: [{ at: 'x' }] } }, at(DAY));
  assert.equal(bad.ranking.joined, false);
  assert.equal(bad.ranking.uid, null);
  assert.deepEqual(bad.ranking.syncs, []);
  assert.equal(bad.security.tampered, false);
  assert.equal(bad.security.clockBack, 0);
});

test('내용이 같으면 해시도 같아요 (올린 시각은 상관없음)', () => {
  const s = E.createState(at(DAY));
  save(s, 10000, at(DAY));
  const h1 = K.contentHash(K.buildEntry(s, at(DAY, 13)), K.buildProof(s, at(DAY, 13)));
  const h2 = K.contentHash(K.buildEntry(s, at(DAY, 18)), K.buildProof(s, at(DAY, 18)));
  assert.equal(h1, h2);
  save(s, 1000, at(DAY, 19));
  assert.notEqual(h1, K.contentHash(K.buildEntry(s, at(DAY, 19)), K.buildProof(s, at(DAY, 19))));
});

test('저장 확인값(seal): 게임 밖에서 고치면 알아봐요', () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    key: (i) => Array.from(store.keys())[i] || null,
    get length() {
      return store.size;
    },
  };
  require('../js/storage.js');
  const S = globalThis.SC.storage;
  assert.equal(S.init(), true);
  const s = E.createState(at(DAY));
  save(s, 10000, at(DAY));
  assert.equal(S.save(s), true);
  let loaded = S.load();
  assert.equal(loaded.status, 'ok');
  assert.equal(loaded.sealOk, true);
  assert.equal(E.normalizeState(loaded.raw, at(DAY)).history.length, 1);
  // 값을 직접 고침
  const before = store.get(S.KEY);
  store.set(S.KEY, before.replace(/"bonusTotal":\d+/, '"bonusTotal":99999'));
  assert.notEqual(store.get(S.KEY), before);
  loaded = S.load();
  assert.equal(loaded.sealOk, false);
  // 확인값을 통째로 지움 (예전에 확인값을 붙인 데이터)
  store.set(S.KEY, JSON.stringify(s));
  assert.equal(S.load().sealOk, false);
  // 확인값이 생기기 전의 예전 데이터
  const legacy = JSON.parse(JSON.stringify(s));
  delete legacy.security;
  store.set(S.KEY, JSON.stringify(legacy));
  assert.equal(S.load().sealOk, null);
  delete globalThis.localStorage;
});

test('짧은 시간 안의 기록 수 세기', () => {
  assert.equal(K.maxInWindow([], 1000), 0);
  assert.equal(K.maxInWindow([0, 500, 900, 2000, 2100], 1000), 3);
  assert.equal(K.maxInWindow([5, NaN, 1], 10), 2);
});
