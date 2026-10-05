/* 게임 규칙 단위 테스트 — 실행: npm test (node --test) */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

require('../js/util.js');
require('../js/data.js');
require('../js/engine.js');

const { engine: E, data: D, util: U } = globalThis.SC;

/** 현지 시간 정오 — 시간대와 상관없이 날짜 키가 그대로 나오도록 */
const at = (key, hh = 12, mm = 0) => new Date(`${key}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`);
const DAY = '2026-10-05';
const save = (state, amount, now = at(DAY), extra = {}) =>
  E.addRecord(state, { item: '후드티', amount: String(amount), reason: '이미 비슷한 옷이 있음', ...extra }, now);
const fresh = () => E.createState(at(DAY));
const richState = (tokens = 100000) => {
  const s = fresh();
  s.wallet.bonusTotal = tokens;
  E.refresh(s, at(DAY));
  return s;
};

test('금액 입력 검사: 빈 값, 문자, 음수, 소수, 0원, 너무 큰 값', () => {
  const cases = [
    ['', 'empty'],
    ['   ', 'empty'],
    [null, 'empty'],
    ['abc', 'notNumber'],
    ['12abc', 'notNumber'],
    ['1e5', 'notNumber'],
    ['원', 'notNumber'],
    ['5만', 'notNumber'],
    ['-5000', 'negative'],
    ['- 500', 'negative'],
    ['-1.5', 'negative'],
    ['1.5', 'decimal'],
    ['49000.', 'decimal'],
    ['0', 'zero'],
    ['000', 'zero'],
    ['-0', 'zero'],
    ['100000001', 'tooLarge'],
    ['99999999999999999999', 'tooLarge'],
    [NaN, 'notNumber'],
  ];
  for (const [input, code] of cases) {
    const r = E.parseAmount(input);
    assert.equal(r.ok, false, `${JSON.stringify(input)} 는 오류여야 함`);
    assert.equal(r.code, code, `${JSON.stringify(input)} → ${r.code}`);
    assert.ok(r.message && r.message.length > 5);
  }
});

test('금액 입력 검사: 쉼표, ₩, 원, 전각 숫자 허용', () => {
  const ok = [
    ['49,000', 49000],
    ['₩49,000', 49000],
    ['49000원', 49000],
    [' 5 000 ', 5000],
    ['１２３４', 1234],
    ['0049000', 49000],
    [5000, 5000],
    ['100000000', 100000000],
  ];
  for (const [input, value] of ok) {
    const r = E.parseAmount(input);
    assert.equal(r.ok, true, `${JSON.stringify(input)} 는 정상이어야 함`);
    assert.equal(r.value, value);
  }
});

test('기획서 4. TOKEN 계산: 1,000원 = 10 TOKEN (예외 처리 표)', () => {
  const table = [
    [999, 0],
    [1000, 10],
    [1999, 10],
    [5000, 50],
    [5500, 50],
    [9999, 90],
    [10000, 100],
    [20000, 200],
    [30000, 300],
    [40000, 400],
    [49900, 490],
    [50000, 500],
    [100000, 500],
  ];
  for (const [amount, tokens] of table) {
    const s = fresh();
    const r = save(s, amount);
    assert.equal(r.tokens, tokens, `${amount}원 → ${tokens} TOKEN`);
    assert.equal(r.recognized, Math.min(amount, 50000));
    assert.equal(E.derive(s, at(DAY)).saveTokens, tokens);
  }
});

test('기획서 8. 하루 제한: 20,000원 × 3 → 200, 200, 100 TOKEN', () => {
  const s = fresh();
  const a = save(s, 20000, at(DAY, 9));
  const b = save(s, 20000, at(DAY, 10));
  const c = save(s, 20000, at(DAY, 11));
  assert.deepEqual([a.tokens, b.tokens, c.tokens], [200, 200, 100]);
  assert.equal(c.recognized, 10000);
  assert.equal(c.remainingBefore, 10000);
  assert.equal(c.capped, true);
  const d1 = save(s, 30000, at(DAY, 12));
  assert.equal(d1.tokens, 0, '한도를 다 쓴 뒤에는 0 TOKEN');
  assert.equal(d1.recognized, 0);
  const d = E.derive(s, at(DAY, 13));
  assert.equal(d.todayTokens, 500);
  assert.equal(d.todayRecognized, 50000);
  assert.equal(d.todaySaved, 90000, '오늘 절약 금액은 실제 입력 금액 합계');
  assert.equal(d.remainingToday, 0);
  // 다음 날에는 다시 50,000원까지 인정
  const next = save(s, 50000, at('2026-10-06'));
  assert.equal(next.tokens, 500);
});

test('하루 절약 TOKEN은 어떤 입력 순서에서도 500을 넘지 않는다', () => {
  let seed = 7;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const s = fresh();
  for (let i = 0; i < 300; i++) {
    const day = U.addDays('2026-09-01', Math.floor(rand() * 20));
    const amount = 1 + Math.floor(rand() * 70000);
    save(s, amount, at(day, 8 + (i % 10)));
  }
  const perDay = {};
  for (const r of s.history) {
    perDay[r.date] = perDay[r.date] || { tokens: 0, rec: 0 };
    perDay[r.date].tokens += r.tokens;
    perDay[r.date].rec += r.recognized;
    assert.equal(r.tokens, Math.floor(r.recognized / 1000) * 10);
  }
  for (const k of Object.keys(perDay)) {
    assert.ok(perDay[k].tokens <= 500, `${k}: ${perDay[k].tokens}`);
    assert.ok(perDay[k].rec <= 50000);
  }
});

test('필수 입력이 비면 기록되지 않고 필드별 오류를 돌려준다', () => {
  const s = fresh();
  assert.throws(
    () => E.addRecord(s, { item: '', amount: '-1', reason: '' }, at(DAY)),
    (e) => e.code === 'invalid' && !!(e.info.errors.item && e.info.errors.amount && e.info.errors.reason)
  );
  assert.equal(s.history.length, 0);
  assert.equal(s.token, 0);
});

test('카테고리를 고르지 않으면 항목 이름으로 추측한다', () => {
  const s = fresh();
  assert.equal(save(s, 5000, at(DAY), { item: '아이스 아메리카노' }).record.category, 'cafe');
  assert.equal(save(s, 5000, at(DAY), { item: '치킨 배달' }).record.category, 'food');
  assert.equal(save(s, 5000, at(DAY), { item: '무언가' }).record.category, 'etc');
  assert.equal(save(s, 5000, at(DAY), { item: '무언가', category: 'game' }).record.category, 'game');
});

test('STREAK: 하루 여러 번 기록해도 +1, 끊기면 다시 1부터', () => {
  const s = fresh();
  save(s, 1000, at('2026-10-01', 9));
  save(s, 1000, at('2026-10-01', 20));
  save(s, 1000, at('2026-10-02'));
  save(s, 1000, at('2026-10-03'));
  let d = E.derive(s, at('2026-10-03'));
  assert.equal(d.streak.current, 3);
  // 다음 날 아직 기록 전이어도 연속 기록은 살아 있다
  d = E.derive(s, at('2026-10-04'));
  assert.equal(d.streak.current, 3);
  assert.equal(d.streak.recordedToday, false);
  // 하루를 건너뛰면 0
  d = E.derive(s, at('2026-10-05'));
  assert.equal(d.streak.current, 0);
  save(s, 1000, at('2026-10-05'));
  d = E.derive(s, at('2026-10-05'));
  assert.equal(d.streak.current, 1);
  assert.equal(d.longestStreak, 3);
});

test('기획서 17. 0원 기록은 STREAK을 지키지만 TOKEN은 없다', () => {
  const s = fresh();
  save(s, 3000, at('2026-10-04'));
  const r = E.addCheckin(s, at('2026-10-05'));
  assert.equal(r.record.kind, 'checkin');
  assert.equal(r.record.tokens, 0);
  const d = E.derive(s, at('2026-10-05'));
  assert.equal(d.streak.current, 2);
  assert.equal(d.records, 1, '0원 기록은 절약 기록 수에 포함하지 않음');
  assert.equal(d.checkins, 1);
  assert.ok(s.achievements.checkin_1);
  assert.throws(() => E.addCheckin(s, at('2026-10-05', 18)), (e) => e.code === 'alreadyRecorded');
});

test('STREAK 보상: 7일 +100, 14일 +250, 30일 특별 장식 (한 번씩만)', () => {
  const s = fresh();
  const start = '2026-09-01';
  const rewards = [];
  for (let i = 0; i < 30; i++) {
    const r = E.addCheckin(s, at(U.addDays(start, i)));
    for (const ev of r.events) if (ev.type === 'streakReward') rewards.push([i + 1, ev.days, ev.reward]);
  }
  assert.deepEqual(
    rewards.map((x) => [x[0], x[1]]),
    [
      [7, 7],
      [14, 14],
      [30, 30],
    ]
  );
  assert.equal(rewards[0][2].tokens, 100);
  assert.equal(rewards[1][2].tokens, 250);
  assert.equal(rewards[2][2].special, 'golden_piggy');
  assert.ok(s.buildings.some((b) => b.itemId === 'golden_piggy' && b.region === null), '황금 저금통이 보관함에 들어옴');
  const streakBonus = s.ledger.filter((e) => e.kind === 'streak').reduce((n, e) => n + e.delta, 0);
  assert.equal(streakBonus, 350);
  // 같은 날 다시 기록해도 보상은 중복되지 않음
  const again = save(s, 1000, at(U.addDays(start, 29), 20));
  assert.equal(again.events.filter((e) => e.type === 'streakReward').length, 0);
});

test('기획서 21. 첫 TOKEN 기록 보너스: 하루 한 번, LUCKY +20 또는 할인 쿠폰', () => {
  const s = fresh();
  assert.equal(save(s, 500).bonusOffered, false, '0 TOKEN 기록은 보너스 없음');
  const first = save(s, 5000);
  assert.equal(first.bonusOffered, true);
  assert.equal(save(s, 5000).bonusOffered, false);
  const before = E.derive(s, at(DAY)).balance;
  E.claimBonus(s, 'lucky', at(DAY));
  assert.equal(E.derive(s, at(DAY)).balance, before + 20);
  assert.throws(() => E.claimBonus(s, 'lucky', at(DAY)), (e) => e.code === 'noBonus');
  // 다음 날 할인 쿠폰
  assert.equal(save(s, 2000, at('2026-10-06')).bonusOffered, true);
  E.claimBonus(s, 'discount', at('2026-10-06'));
  assert.equal(s.coupons, 1);
});

test('CITY DISCOUNT 쿠폰은 다음 건물 구매에만 10% 적용', () => {
  const s = richState(5000);
  s.coupons = 1;
  const tree = E.buyItem(s, 'tree', {}, at(DAY));
  assert.equal(tree.price.final, 50, '장식은 할인 안 됨');
  assert.equal(s.coupons, 1);
  const house = E.buyItem(s, 'house', {}, at(DAY));
  assert.equal(house.price.final, 90);
  assert.equal(house.price.coupon, true);
  assert.equal(s.coupons, 0);
  assert.equal(E.buyItem(s, 'house', {}, at(DAY)).price.final, 100);
});

test('상점: TOKEN 부족, 잠긴 아이템, 판매하지 않는 아이템', () => {
  const s = fresh();
  assert.throws(() => E.buyItem(s, 'house', {}, at(DAY)), (e) => e.code === 'insufficientTokens' && e.info.need === 100);
  s.wallet.bonusTotal = 10000;
  assert.throws(() => E.buyItem(s, 'cafe', {}, at(DAY)), (e) => e.code === 'locked');
  assert.throws(() => E.buyItem(s, 'golden_piggy', {}, at(DAY)), (e) => e.code === 'notForSale');
  assert.throws(() => E.buyItem(s, 'nope', {}, at(DAY)), (e) => e.code === 'notForSale');
  assert.equal(s.wallet.spentTotal, 0, '실패한 구매는 TOKEN을 쓰지 않음');
});

test('건설과 배치: 빈 땅, 도로, 겹침, 이동, 보관', () => {
  const s = richState(10000);
  const village = D.REGION_MAP.village;
  const road = village.tiles.indexOf('road');
  const plot = village.tiles.indexOf('plot');
  assert.throws(() => E.buyItem(s, 'house', { region: 'village', slot: road }, at(DAY)), (e) => e.code === 'badSlot');
  const a = E.buyItem(s, 'house', { region: 'village', slot: plot }, at(DAY));
  assert.equal(E.findBuilding(s, a.uid).slot, plot);
  assert.throws(() => E.buyItem(s, 'tree', { region: 'village', slot: plot }, at(DAY)), (e) => e.code === 'occupied');
  assert.throws(() => E.buyItem(s, 'tree', { region: 'commerce', slot: plot }, at(DAY)), (e) => e.code === 'regionLocked');
  const b = E.buyItem(s, 'tree', {}, at(DAY));
  assert.equal(E.inventory(s).length, 1);
  assert.throws(() => E.placeItem(s, b.uid, 'village', plot, at(DAY)), (e) => e.code === 'occupied');
  const other = E.emptySlots(s, 'village')[0];
  E.placeItem(s, b.uid, 'village', other, at(DAY));
  assert.equal(E.inventory(s).length, 0);
  E.storeItem(s, a.uid, at(DAY));
  assert.equal(E.findBuilding(s, a.uid).region, null);
  assert.equal(E.emptySlots(s, 'village').length, village.plots - 1);
});

test('업그레이드: 작은 상점 Lv.2 → 도시 가치 150, 업그레이드 비용 200 (기획서 11 예시)', () => {
  const shop = D.ITEM_MAP.shop;
  assert.equal(E.itemValue(shop, 2), 150);
  assert.equal(E.upgradeCost(shop, 2), 200);
  assert.equal(E.upgradeCost(D.ITEM_MAP.house, 1), 30);
  const s = richState(2000);
  const { uid } = E.buyItem(s, 'house', {}, at(DAY));
  const valueBefore = E.derive(s, at(DAY)).cityValue;
  const up = E.upgradeItem(s, uid, at(DAY));
  assert.equal(up.level, 2);
  assert.equal(up.cost, 30);
  assert.equal(E.derive(s, at(DAY)).cityValue, valueBefore + 25);
  E.upgradeItem(s, uid, at(DAY));
  E.upgradeItem(s, uid, at(DAY));
  E.upgradeItem(s, uid, at(DAY));
  assert.equal(s.buildingLevels[uid], 5);
  assert.throws(() => E.upgradeItem(s, uid, at(DAY)), (e) => e.code === 'maxLevel');
  assert.ok(s.achievements.max_level);
  // Lv.5 작은 집 → 벚꽃나무 장식 해금
  assert.equal(E.unlockStatus(D.ITEM_MAP.sakura, E.derive(s, at(DAY))).unlocked, true);
  const tree = E.buyItem(s, 'tree', {}, at(DAY));
  assert.throws(() => E.upgradeItem(s, tree.uid, at(DAY)), (e) => e.code === 'notUpgradable');
});

test('업그레이드 TOKEN 부족 시 실패하고 아무것도 바뀌지 않음', () => {
  const s = richState(100);
  const { uid } = E.buyItem(s, 'house', {}, at(DAY));
  s.wallet.spentTotal += E.derive(s, at(DAY)).balance; // 업적 보상까지 모두 써서 잔액 0
  const spent = s.wallet.spentTotal;
  assert.throws(() => E.upgradeItem(s, uid, at(DAY)), (e) => e.code === 'insufficientTokens');
  assert.equal(s.buildingLevels[uid], 1);
  assert.equal(s.wallet.spentTotal, spent);
});

test('기록 수정: 같은 날 다른 기록의 인정 금액까지 다시 계산', () => {
  const s = fresh();
  const a = save(s, 20000, at(DAY, 9)).record;
  save(s, 20000, at(DAY, 10));
  const c = save(s, 20000, at(DAY, 11)).record;
  assert.equal(c.recognized, 10000);
  const pv = E.previewEdit(s, a.id, '5000');
  assert.equal(pv.tokens, 50);
  assert.equal(pv.delta, -50);
  const r = E.updateRecord(s, a.id, { item: '후드티', amount: '5,000', reason: '수정함', memo: '메모' }, at(DAY, 12));
  assert.equal(r.delta, -50);
  assert.equal(a.tokens, 50);
  assert.equal(c.recognized, 20000, '앞 기록이 줄면 뒤 기록이 더 인정됨');
  assert.equal(E.derive(s, at(DAY)).todayTokens, 450);
  assert.equal(a.memo, '메모');
  assert.ok(a.updatedAt);
});

test('기록 삭제: TOKEN 회수, 이미 쓴 TOKEN이 있으면 막고 데이터는 그대로', () => {
  const s = fresh();
  const r = save(s, 49000).record;
  const balance0 = E.derive(s, at(DAY)).balance; // 490 + 업적 보상
  E.buyItem(s, 'house', {}, at(DAY));
  E.buyItem(s, 'house', {}, at(DAY));
  E.buyItem(s, 'house', {}, at(DAY));
  const balance1 = E.derive(s, at(DAY)).balance;
  assert.ok(balance1 < 490);
  const pv = E.previewDelete(s, r.id);
  assert.equal(pv.ok, false);
  assert.throws(() => E.deleteRecord(s, r.id, at(DAY)), (e) => e.code === 'insufficientTokens' && e.info.need === 490 - balance1);
  assert.equal(s.history.length, 1, '실패하면 기록이 남아 있음');
  assert.equal(E.derive(s, at(DAY)).balance, balance1);
  // 금액을 줄이는 수정도 같은 규칙
  assert.throws(() => E.updateRecord(s, r.id, { item: '후드티', amount: '1000', reason: 'x' }, at(DAY)), (e) => e.code === 'insufficientTokens');
  assert.equal(r.amount, 49000);
  assert.ok(balance0 > balance1);

  const s2 = fresh();
  const r2 = save(s2, 12000).record;
  const before = E.derive(s2, at(DAY)).balance;
  const del = E.deleteRecord(s2, r2.id, at(DAY));
  assert.equal(del.delta, -120);
  assert.equal(E.derive(s2, at(DAY)).balance, before - 120);
  assert.equal(s2.history.length, 0);
  assert.throws(() => E.deleteRecord(s2, r2.id, at(DAY)), (e) => e.code === 'notFound');
});

test('0원 기록은 수정할 수 없고 삭제는 가능', () => {
  const s = fresh();
  const c = E.addCheckin(s, at(DAY)).record;
  assert.throws(() => E.updateRecord(s, c.id, { item: 'x', amount: '1000', reason: 'y' }, at(DAY)), (e) => e.code === 'notEditable');
  assert.equal(E.deleteRecord(s, c.id, at(DAY)).delta, 0);
});

test('업적: 첫 절약 → TOKEN과 칭호, 진행률 계산', () => {
  const s = fresh();
  const r = save(s, 10000);
  const ids = r.events.filter((e) => e.type === 'achievement').map((e) => e.id);
  assert.ok(ids.includes('first_save'));
  assert.ok(ids.includes('first_token'));
  assert.ok(E.unlockedTitles(s).includes('sprout'));
  const d = E.derive(s, at(DAY));
  assert.equal(d.balance, 100 + 50 + 10);
  const p = E.achievementProgress(s, D.ACHIEVEMENT_MAP.saved_100k, d);
  assert.equal(p.done, false);
  assert.equal(p.value, 10000);
  assert.equal(p.pct, 0.1);
  assert.ok(D.ACHIEVEMENTS.length >= 30, '업적은 30개 이상');
  assert.equal(new Set(D.ACHIEVEMENTS.map((a) => a.id)).size, D.ACHIEVEMENTS.length);
  for (const a of D.ACHIEVEMENTS) {
    assert.equal(typeof E.metricValue(a, d), 'number', a.id);
    if (a.reward.special) assert.equal(D.ITEM_MAP[a.reward.special].cat, 'special');
    if (a.reward.title) assert.ok(D.TITLE_MAP[a.reward.title], a.reward.title);
  }
});

test('도시 레벨: 경험치 기준이 단조 증가하고 지역 해금은 레벨 조건을 따른다', () => {
  for (let L = 2; L <= D.RULES.MAX_CITY_LEVEL; L++) assert.ok(E.levelThreshold(L) > E.levelThreshold(L - 1));
  assert.equal(E.levelInfo(0).level, 1);
  assert.equal(E.levelInfo(E.levelThreshold(10)).level, 10);
  assert.equal(E.levelInfo(E.levelThreshold(10) - 1).level, 9);

  const s = richState(100000);
  assert.throws(() => E.unlockRegion(s, 'commerce', at(DAY)), (e) => e.code === 'locked');
  let sawLevelUp = false;
  for (let i = 0; i < 20; i++) {
    const { uid, events } = E.buyItem(s, 'house', {}, at(DAY));
    if (events.some((e) => e.type === 'levelUp')) sawLevelUp = true;
    for (let k = 0; k < 4; k++) E.upgradeItem(s, uid, at(DAY));
  }
  assert.ok(sawLevelUp);
  const d = E.derive(s, at(DAY));
  assert.ok(d.cityLevel >= 10, `레벨 ${d.cityLevel}`);
  const r = E.unlockRegion(s, 'commerce', at(DAY));
  assert.ok(r.events.some((e) => e.type === 'achievement' && e.id === 'pioneer'));
  assert.deepEqual(s.regions, ['village', 'commerce']);
  assert.throws(() => E.unlockRegion(s, 'commerce', at(DAY)), (e) => e.code === 'alreadyUnlocked');
});

test('레벨업하면 새로 열린 상점 아이템을 알려 준다', () => {
  const s = richState(100000);
  const seen = new Set();
  for (let i = 0; i < 8; i++) {
    const { uid, events } = E.buyItem(s, 'house', {}, at(DAY));
    for (const e of events) if (e.type === 'itemsUnlocked') e.ids.forEach((id) => seen.add(id));
    for (let k = 0; k < 4; k++) {
      const up = E.upgradeItem(s, uid, at(DAY));
      for (const e of up.events) if (e.type === 'itemsUnlocked') e.ids.forEach((id) => seen.add(id));
    }
  }
  assert.ok(seen.has('cafe') && seen.has('shop'), 'LEVEL 5 상업 건물 해금');
  assert.ok(seen.has('sakura'), '작은 집 Lv.5 → 벚꽃나무');
});

test('스킨: 구매 시 바로 적용, 중복 구매 불가, 가진 스킨만 적용', () => {
  const s = richState(100000);
  for (let i = 0; i < 6; i++) {
    const { uid } = E.buyItem(s, 'house', {}, at(DAY));
    E.upgradeItem(s, uid, at(DAY));
  }
  assert.ok(E.derive(s, at(DAY)).cityLevel >= 3);
  E.buyItem(s, 'spring', {}, at(DAY));
  assert.equal(s.skins.active, 'spring');
  assert.throws(() => E.buyItem(s, 'spring', {}, at(DAY)), (e) => e.code === 'owned');
  E.applySkin(s, 'default', at(DAY));
  assert.equal(s.skins.active, 'default');
  assert.throws(() => E.applySkin(s, 'night', at(DAY)), (e) => e.code === 'notOwned');
  assert.ok(s.achievements.first_skin);
});

test('탈것은 도시 가치에 더해지고 도감에 기록된다', () => {
  const s = richState(1000);
  E.buyItem(s, 'bicycle', {}, at(DAY));
  const d = E.derive(s, at(DAY));
  assert.equal(d.city.vehicles, 1);
  assert.equal(d.cityValue, 250);
  assert.ok(s.collection.bicycle);
  assert.ok(s.achievements.first_vehicle);
});

test('저장 데이터 복구: 손상된 값, 조작된 TOKEN, 중복·잘못된 항목', () => {
  const now = at(DAY);
  assert.equal(E.normalizeState(null, now).token, 0);
  assert.equal(E.normalizeState('garbage', now).history.length, 0);
  assert.equal(E.normalizeState([1, 2], now).history.length, 0);

  const s = fresh();
  save(s, 20000);
  const { uid } = E.buyItem(s, 'house', { region: 'village', slot: 0 }, at(DAY));
  const raw = JSON.parse(JSON.stringify(s));
  raw.token = 999999; // 조작
  raw.history.push(JSON.parse(JSON.stringify(raw.history[0]))); // 중복 id
  raw.history.push({ id: 'bad', date: 'yesterday', amount: 5 });
  raw.history.push({ id: 'neg', date: DAY, amount: -5000, kind: 'save' });
  raw.buildings.push({ uid: 'b_dup', itemId: 'house', region: 'village', slot: 0 }); // 같은 자리
  raw.buildings.push({ uid: 'b_road', itemId: 'house', region: 'village', slot: 2 }); // 도로
  raw.buildings.push({ uid: 'b_x', itemId: 'unknown' });
  raw.buildingLevels[uid] = 99;
  raw.user.titleId = 'king';
  raw.user.nickname = '<img src=x onerror=alert(1)>'.repeat(3);
  raw.settings = { sound: 'yes', theme: 'neon' };
  const n = E.normalizeState(raw, now);
  assert.equal(n.history.length, 1);
  assert.equal(n.token, E.derive(n, now).balance);
  assert.notEqual(n.token, 999999);
  assert.equal(n.buildings.find((b) => b.uid === 'b_dup').region, null, '겹친 건물은 보관함으로');
  assert.equal(n.buildings.find((b) => b.uid === 'b_road').region, null, '도로 위 건물은 보관함으로');
  assert.equal(n.buildings.some((b) => b.uid === 'b_x'), false);
  assert.equal(n.buildingLevels[uid], 5);
  assert.equal(n.user.titleId, 'newbie', '얻지 못한 칭호는 기본값');
  assert.ok(Array.from(n.user.nickname).length <= D.RULES.NICK_MAX);
  assert.equal(n.settings.sound, false);
  assert.equal(n.settings.theme, 'system');
});

test('저장 데이터 복구: 사용한 TOKEN이 받은 TOKEN보다 많으면 잔액 0으로 맞춤', () => {
  const raw = JSON.parse(JSON.stringify(fresh()));
  raw.wallet = { bonusTotal: 100, spentTotal: 500 };
  const n = E.normalizeState(raw, at(DAY));
  assert.equal(E.derive(n, at(DAY)).balance, 0);
});

test('저장 → 불러오기 왕복 후 같은 결과', () => {
  const s = fresh();
  save(s, 49000, at('2026-10-03'));
  save(s, 18000, at('2026-10-04'));
  E.claimBonus(s, 'discount', at('2026-10-04'));
  save(s, 12000, at('2026-10-05'));
  E.buyItem(s, 'house', { region: 'village', slot: 0 }, at(DAY));
  const copy = E.normalizeState(JSON.parse(JSON.stringify(s)), at(DAY));
  const a = E.derive(s, at(DAY));
  const b = E.derive(copy, at(DAY));
  for (const k of ['balance', 'totalSaved', 'totalRecognized', 'cityValue', 'cityLevel', 'xp', 'records', 'achievementsCount']) {
    assert.equal(b[k], a[k], k);
  }
  assert.equal(b.streak.current, 3);
  assert.equal(copy.coupons, s.coupons);
  assert.equal(s.coupons, 0, '할인 쿠폰은 작은 집 구매에 사용됨');
  assert.deepEqual(copy.pendingBonuses, s.pendingBonuses);
  // 기획서 23. 저장 항목
  for (const key of ['user', 'token', 'totalSaved', 'todaySaved', 'streak', 'longestStreak', 'cityLevel', 'cityValue', 'buildings', 'buildingLevels', 'regions', 'achievements', 'history', 'settings']) {
    assert.ok(key in copy, key);
  }
});

test('TOKEN 내역은 최대 개수를 넘지 않는다', () => {
  const s = fresh();
  for (let i = 0; i < 60; i++) save(s, 1000, at(U.addDays('2026-01-01', i)));
  assert.ok(s.ledger.length <= D.RULES.LEDGER_MAX);
  assert.ok(s.ledger.every((e) => e.delta !== 0));
});

test('이번 달 절약 / 누적 절약 금액', () => {
  const s = fresh();
  save(s, 10000, at('2026-09-30'));
  save(s, 12000, at('2026-10-01'));
  save(s, 70000, at('2026-10-05'));
  const d = E.derive(s, at('2026-10-05'));
  assert.equal(d.monthSaved, 82000);
  assert.equal(d.totalSaved, 92000);
  assert.equal(d.totalRecognized, 72000);
});

test('지역 지도: 모든 지역에 빈 땅과 도로가 있다', () => {
  for (const r of D.REGIONS) {
    assert.equal(r.tiles.length, 36, r.id);
    assert.ok(r.plots >= 16, `${r.id} plots ${r.plots}`);
    assert.ok(r.tiles.includes('road'));
  }
});

test('홈 화면 목표 추천', () => {
  const s = fresh();
  let goals = E.nextGoals(s, E.derive(s, at(DAY)));
  assert.equal(goals[0].kind, 'save');
  save(s, 30000);
  goals = E.nextGoals(s, E.derive(s, at(DAY)));
  assert.ok(goals.some((g) => g.kind === 'build'));
});

test('STREAK 보상: 예전 기록을 지워 시작일이 바뀌어도 같은 보상을 다시 주지 않는다', () => {
  const s = fresh();
  const start = '2026-09-01';
  const firstIds = [];
  for (let i = 0; i < 8; i++) {
    const r = E.addCheckin(s, at(U.addDays(start, i)));
    firstIds.push(r.record.id);
  }
  const bonus = () => s.ledger.filter((e) => e.kind === 'streak').reduce((n, e) => n + e.delta, 0);
  assert.equal(bonus(), 100);
  // 8일째: 첫날 기록을 지우고 다시 기록해도 7일 보상은 그대로 한 번
  E.deleteRecord(s, firstIds[0], at(U.addDays(start, 7), 20));
  save(s, 1000, at(U.addDays(start, 7), 21));
  assert.equal(bonus(), 100);
  // 30일을 채운 뒤 첫 기록을 지워도 황금 저금통은 하나
  for (let i = 8; i < 31; i++) E.addCheckin(s, at(U.addDays(start, i)));
  E.deleteRecord(s, firstIds[1], at(U.addDays(start, 30), 20));
  save(s, 1000, at(U.addDays(start, 30), 21));
  assert.equal(s.buildings.filter((b) => b.itemId === 'golden_piggy').length, 1);
  assert.equal(bonus(), 350);
});

test('STREAK이 끊겼다가 새로 7일을 채우면 7일 보상을 다시 받는다', () => {
  const s = fresh();
  for (let i = 0; i < 7; i++) E.addCheckin(s, at(U.addDays('2026-08-01', i)));
  for (let i = 0; i < 7; i++) E.addCheckin(s, at(U.addDays('2026-08-20', i)));
  const sum = s.ledger.filter((e) => e.kind === 'streak').reduce((n, e) => n + e.delta, 0);
  assert.equal(sum, 200);
});

test('받지 않은 보너스: TOKEN 기록을 지우면 사라지고, 수정으로 TOKEN이 생기면 새로 생긴다', () => {
  const s = fresh();
  const r = save(s, 1000);
  assert.deepEqual(s.pendingBonuses, [DAY]);
  E.deleteRecord(s, r.record.id, at(DAY, 13));
  assert.deepEqual(s.pendingBonuses, []);
  assert.throws(() => E.claimBonus(s, 'lucky', at(DAY, 14)), (e) => e.code === 'noBonus');
  const small = save(s, 500);
  assert.equal(small.bonusOffered, false);
  const up = E.updateRecord(s, small.record.id, { item: '후드티', amount: '3000', reason: 'x' }, at(DAY, 15));
  assert.equal(up.bonusOffered, true);
  assert.deepEqual(s.pendingBonuses, [DAY]);
  // 이미 받은 보너스는 기록을 지워도 그대로
  E.claimBonus(s, 'lucky', at(DAY, 16));
  E.deleteRecord(s, small.record.id, at(DAY, 17));
  assert.equal(s.bonusDays[DAY], 'lucky');
});

test('기록 수정 미리보기: 같은 날 다른 기록이 쓰는 인정 금액을 정확히 알려 준다', () => {
  const s = fresh();
  const a = save(s, 40000, at(DAY, 9)).record;
  save(s, 20000, at(DAY, 10));
  const pv = E.previewEdit(s, a.id, '10000');
  assert.equal(pv.recognized, 10000);
  assert.equal(pv.othersRecognized, 20000, '뒤 기록은 한도가 풀려 20,000원 전부 인정');
  assert.equal(pv.delta, -300 + 100);
});

test('조작된 저장 데이터의 __proto__ / constructor 키를 무시한다', () => {
  const s = fresh();
  save(s, 20000);
  const raw = JSON.parse(JSON.stringify(s));
  raw.buildings.push({ uid: '__proto__', itemId: 'house', region: 'village', slot: 0 });
  raw.buildings.push({ uid: 'constructor', itemId: 'house' });
  raw.buildings.push({ uid: 'b_ok', itemId: 'constructor' });
  raw.buildingLevels = JSON.parse('{"__proto__": 5, "b_ok": 3}');
  raw.achievements = JSON.parse('{"constructor": "2026-10-05T00:00:00.000Z", "first_save": "2026-10-05T00:00:00.000Z"}');
  raw.ledger.push({ id: 'l1', kind: 'constructor', label: 'x', delta: 5, at: '2026-10-05T00:00:00.000Z', date: DAY });
  raw.regions = ['village', 'constructor', '__proto__'];
  const n = E.normalizeState(raw, at(DAY));
  assert.equal(n.buildings.length, 0);
  assert.deepEqual(Object.keys(n.achievements), ['first_save']);
  assert.ok(n.ledger.every((e) => e.kind !== 'constructor'));
  assert.deepEqual(n.regions, ['village']);
  const d = E.derive(n, at(DAY));
  assert.ok(Number.isFinite(d.cityValue) && Number.isFinite(d.xp));
  assert.equal(Object.getPrototypeOf(n.buildingLevels), Object.prototype);
});
