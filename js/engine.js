/* SAVE CITY — 게임 규칙 엔진. 화면(DOM)과 분리된 순수 로직이라 Node 테스트로 검증합니다. */
(function (root) {
  'use strict';
  const SC = (root.SC = root.SC || {});
  const U = SC.util;
  const D = SC.data;
  const R = D.RULES;

  const SCHEMA_VERSION = 1;
  const CHECKIN_ITEM = '오늘은 절약 없음';
  const CATEGORY_IDS = new Set(D.CATEGORIES.map((c) => c.id));
  const PLACEABLE = new Set(['building', 'decoration', 'landmark', 'special']);
  const BONUS_KINDS = new Set(['bonus', 'streak', 'achievement']);
  const COLLECTIBLE = D.ITEMS.filter((i) => !(i.cat === 'skin' && i.price === 0)).map((i) => i.id);
  const COLLECTIBLE_SET = new Set(COLLECTIBLE);

  class GameError extends Error {
    constructor(code, message, info) {
      super(message);
      this.name = 'GameError';
      this.code = code;
      this.info = info || {};
    }
  }

  /* ------------------------------------------------------------------ *
   * TOKEN 계산 규칙 (기획서 4, 8)
   * ------------------------------------------------------------------ */

  const AMOUNT_ERRORS = {
    empty: '절약한 금액을 입력해주세요.',
    notNumber: '숫자만 입력해주세요. (예: 49000)',
    negative: '음수는 입력할 수 없어요. 절약한 금액을 입력해주세요.',
    decimal: '원 단위 정수로 입력해주세요. 소수점은 쓸 수 없어요.',
    zero: '0원은 절약 금액으로 기록할 수 없어요. 절약한 게 없는 날은 아래의 "0원으로 오늘 기록하기"를 눌러 주세요.',
    tooLarge: '금액이 너무 커요. 1억 원 이하로 입력해주세요.',
  };

  function amountError(code) {
    return { ok: false, code, message: AMOUNT_ERRORS[code] };
  }

  /** 사용자가 입력한 금액 문자열을 검사합니다. "49,000", "₩49000", "49000원" 모두 허용 */
  function parseAmount(raw) {
    if (raw === null || raw === undefined) return amountError('empty');
    if (typeof raw === 'number' && !Number.isFinite(raw)) return amountError('notNumber');
    let s = String(raw).trim();
    if (!s) return amountError('empty');
    s = s.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
    s = s.replace(/[\s,_]/g, '').replace(/^[₩￦\\]/, '').replace(/원$/, '');
    if (!s) return amountError('notNumber');
    const negative = /^[-−–]/.test(s);
    const body = s.replace(/^[-−–+]/, '');
    if (/^(\d+\.\d*|\.\d+)$/.test(body)) return amountError(negative ? 'negative' : 'decimal');
    if (!/^\d+$/.test(body)) return amountError('notNumber');
    if (negative) return amountError(/^0+$/.test(body) ? 'zero' : 'negative');
    if (body.replace(/^0+/, '').length > 12) return amountError('tooLarge');
    const value = Number(body);
    if (value === 0) return amountError('zero');
    if (value > R.MAX_INPUT) return amountError('tooLarge');
    return { ok: true, value };
  }

  /** token = floor(recognizedAmount / 1000) * 10 */
  function tokensFor(recognized) {
    return Math.floor(Math.max(0, recognized) / R.WON_PER_UNIT) * R.TOKENS_PER_UNIT;
  }

  /** recognizedAmount = min(inputAmount, 오늘 남은 인정 금액) */
  function recognize(amount, usedToday) {
    const remaining = Math.max(0, R.DAILY_CAP - Math.max(0, usedToday || 0));
    return Math.min(Math.max(0, amount), remaining);
  }

  /* ------------------------------------------------------------------ *
   * 상태 생성 / 검증
   * ------------------------------------------------------------------ */

  function createState(now) {
    now = now || new Date();
    const iso = now.toISOString();
    return {
      schemaVersion: SCHEMA_VERSION,
      createdAt: iso,
      updatedAt: iso,
      user: { nickname: '시민', avatar: '🐷', titleId: 'newbie', onboarded: false },
      // 화면에서 바로 쓰는 요약 값 (원본 데이터에서 매번 다시 계산해 저장)
      token: 0,
      totalSaved: 0,
      todaySaved: 0,
      todayDate: U.dateKey(now),
      streak: 0,
      longestStreak: 0,
      cityLevel: 1,
      cityValue: 0,
      // 원본 데이터
      history: [],
      buildings: [],
      buildingLevels: {},
      vehicles: [],
      skins: { owned: ['default'], active: 'default' },
      regions: ['village'],
      achievements: {},
      collection: {},
      wallet: { bonusTotal: 0, spentTotal: 0 },
      coupons: 0,
      pendingBonuses: [],
      bonusDays: {},
      streakRewards: {},
      ledger: [],
      counters: { seq: 0, upgrades: 0, lucky: 0, discounts: 0 },
      settings: { sound: false, sfx: true, animation: true, theme: 'system' },
    };
  }

  const arr = (v) => (Array.isArray(v) ? v : []);
  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const nonNegInt = (v) => {
    const n = U.toInt(v, 0);
    return n > 0 ? n : 0;
  };
  const isoOr = (v, fb) => (U.isIso(v) ? new Date(v).toISOString() : fb);
  const RESERVED_IDS = new Set(['__proto__', 'constructor', 'prototype']);
  const validId = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v) && !RESERVED_IDS.has(v);

  function bySeq(a, b) {
    return a.seq - b.seq || String(a.createdAt).localeCompare(String(b.createdAt)) || String(a.id).localeCompare(String(b.id));
  }

  function normalizeRecord(r) {
    if (!r || typeof r !== 'object' || !validId(r.id) || !U.isDateKey(r.date)) return null;
    const kind = r.kind === 'checkin' ? 'checkin' : 'save';
    const amount = kind === 'checkin' ? 0 : U.toInt(r.amount, 0);
    if (kind === 'save' && !(amount >= 1 && amount <= R.MAX_INPUT)) return null;
    return {
      id: r.id,
      seq: nonNegInt(r.seq),
      date: r.date,
      createdAt: isoOr(r.createdAt, r.date + 'T12:00:00.000Z'),
      updatedAt: U.isIso(r.updatedAt) ? new Date(r.updatedAt).toISOString() : null,
      kind,
      item: kind === 'checkin' ? CHECKIN_ITEM : U.cleanText(r.item, R.ITEM_MAX) || '절약',
      category: kind === 'checkin' ? 'checkin' : CATEGORY_IDS.has(r.category) ? r.category : 'etc',
      amount,
      recognized: 0,
      tokens: 0,
      reason: kind === 'checkin' ? '' : U.cleanText(r.reason, R.REASON_MAX),
      memo: U.cleanMultiline(r.memo, R.MEMO_MAX),
      hasImage: kind === 'save' && r.hasImage === true,
    };
  }

  /** 저장된 데이터(손상되었거나 오래된 것 포함)를 안전한 상태로 바꿉니다. */
  function normalizeState(raw, now) {
    now = now || new Date();
    const s = createState(now);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return refresh(s, now);

    s.createdAt = isoOr(raw.createdAt, s.createdAt);

    const u = obj(raw.user);
    s.user.nickname = U.cleanText(u.nickname, R.NICK_MAX) || s.user.nickname;
    s.user.avatar = D.AVATARS.includes(u.avatar) ? u.avatar : s.user.avatar;
    s.user.titleId = typeof u.titleId === 'string' ? u.titleId : 'newbie';
    s.user.onboarded = u.onboarded === true;

    const regions = arr(raw.regions);
    s.regions = D.REGIONS.map((r) => r.id).filter((id) => id === 'village' || regions.includes(id));

    const seen = new Set();
    for (const r of arr(raw.history)) {
      const rec = normalizeRecord(r);
      if (!rec || seen.has(rec.id)) continue;
      seen.add(rec.id);
      s.history.push(rec);
    }
    s.history.sort(bySeq);
    s.history.forEach((r, i) => (r.seq = i + 1));
    recomputeAll(s);

    const uids = new Set();
    const occupied = new Set();
    for (const b of arr(raw.buildings)) {
      if (!b || typeof b !== 'object') continue;
      const item = D.ITEM_MAP[b.itemId];
      if (!item || !PLACEABLE.has(item.cat) || !validId(b.uid) || uids.has(b.uid)) continue;
      uids.add(b.uid);
      const entry = { uid: b.uid, itemId: item.id, region: null, slot: null, at: isoOr(b.at, s.createdAt) };
      const region = D.REGION_MAP[b.region];
      if (region && s.regions.includes(region.id) && Number.isInteger(b.slot) && region.tiles[b.slot] === 'plot') {
        const key = region.id + ':' + b.slot;
        if (!occupied.has(key)) {
          occupied.add(key);
          entry.region = region.id;
          entry.slot = b.slot;
        }
      }
      s.buildings.push(entry);
    }
    const levels = obj(raw.buildingLevels);
    for (const b of s.buildings) {
      if (D.ITEM_MAP[b.itemId].cat === 'building') {
        s.buildingLevels[b.uid] = U.clamp(U.toInt(levels[b.uid], 1), 1, R.MAX_BUILDING_LEVEL);
      }
    }

    for (const v of arr(raw.vehicles)) {
      const item = v && D.ITEM_MAP[v.itemId];
      if (!item || item.cat !== 'vehicle' || !validId(v.uid) || uids.has(v.uid)) continue;
      uids.add(v.uid);
      s.vehicles.push({ uid: v.uid, itemId: item.id, at: isoOr(v.at, s.createdAt) });
    }

    const sk = obj(raw.skins);
    const ownedSkins = arr(sk.owned);
    s.skins.owned = D.ITEMS.filter((i) => i.cat === 'skin' && (i.price === 0 || ownedSkins.includes(i.id))).map((i) => i.id);
    s.skins.active = s.skins.owned.includes(sk.active) ? sk.active : 'default';

    const ach = obj(raw.achievements);
    for (const id of Object.keys(ach)) if (D.ACHIEVEMENT_MAP[id]) s.achievements[id] = isoOr(ach[id], s.createdAt);

    const col = obj(raw.collection);
    for (const id of Object.keys(col)) if (COLLECTIBLE_SET.has(id)) s.collection[id] = isoOr(col[id], s.createdAt);
    for (const b of s.buildings) markCollected(s, b.itemId, b.at);
    for (const v of s.vehicles) markCollected(s, v.itemId, v.at);
    for (const id of s.skins.owned) markCollected(s, id, s.createdAt);

    const w = obj(raw.wallet);
    s.wallet.bonusTotal = nonNegInt(w.bonusTotal);
    s.wallet.spentTotal = nonNegInt(w.spentTotal);
    s.coupons = Math.min(nonNegInt(raw.coupons), R.MAX_COUPONS);

    const bd = obj(raw.bonusDays);
    for (const k of Object.keys(bd)) {
      if (U.isDateKey(k) && (bd[k] === 'lucky' || bd[k] === 'discount' || bd[k] === 'pending')) s.bonusDays[k] = bd[k];
    }
    s.pendingBonuses = Object.keys(s.bonusDays)
      .filter((k) => s.bonusDays[k] === 'pending')
      .sort();

    const sr = obj(raw.streakRewards);
    for (const k of Object.keys(sr)) {
      if (/^\d{4}-\d{2}-\d{2}:\d{1,3}$/.test(k)) s.streakRewards[k] = isoOr(sr[k], s.createdAt);
    }

    for (const e of arr(raw.ledger).slice(-R.LEDGER_MAX)) {
      if (!e || typeof e !== 'object' || !D.LEDGER_KINDS[e.kind]) continue;
      const delta = U.toInt(e.delta, 0);
      if (!delta) continue;
      const at = isoOr(e.at, s.createdAt);
      s.ledger.push({
        id: validId(e.id) ? e.id : U.uid('l'),
        at,
        date: U.isDateKey(e.date) ? e.date : U.dateKey(new Date(at)),
        kind: e.kind,
        label: U.cleanText(e.label, 60),
        delta,
      });
    }

    const c = obj(raw.counters);
    s.counters.seq = s.history.length;
    s.counters.upgrades = nonNegInt(c.upgrades);
    s.counters.lucky = nonNegInt(c.lucky);
    s.counters.discounts = nonNegInt(c.discounts);

    const st = obj(raw.settings);
    s.settings.sound = st.sound === true;
    s.settings.sfx = st.sfx !== false;
    s.settings.animation = st.animation !== false;
    s.settings.theme = st.theme === 'light' || st.theme === 'dark' ? st.theme : 'system';

    if (!unlockedTitles(s).includes(s.user.titleId)) s.user.titleId = 'newbie';

    const bal = balanceOf(s);
    if (bal < 0) s.wallet.spentTotal += bal;

    s.longestStreak = nonNegInt(raw.longestStreak);
    s.updatedAt = isoOr(raw.updatedAt, s.createdAt);
    return refresh(s, now);
  }

  function markCollected(state, itemId, at) {
    if (COLLECTIBLE_SET.has(itemId) && !state.collection[itemId]) state.collection[itemId] = at || new Date().toISOString();
  }

  /* ------------------------------------------------------------------ *
   * 하루 인정 금액 재계산
   * ------------------------------------------------------------------ */

  /** 같은 날짜의 기록을 입력 순서대로 다시 계산합니다 (하루 최대 50,000원). */
  function recomputeDay(state, date) {
    const recs = state.history.filter((r) => r.date === date).sort(bySeq);
    let used = 0;
    for (const r of recs) {
      const rec = recognize(r.amount, used);
      r.recognized = rec;
      r.tokens = tokensFor(rec);
      used += rec;
    }
  }

  function recomputeAll(state) {
    const dates = new Set(state.history.map((r) => r.date));
    dates.forEach((d) => recomputeDay(state, d));
  }

  function dayRecognized(state, date) {
    let n = 0;
    for (const r of state.history) if (r.date === date) n += r.recognized;
    return n;
  }

  function simulateDay(state, date, change) {
    const recs = state.history.filter((r) => r.date === date && r.id !== change.remove).sort(bySeq);
    let used = 0;
    let total = 0;
    const byId = {};
    for (const r of recs) {
      const amount = r.id === change.id ? change.amount : r.amount;
      const rec = recognize(amount, used);
      const tk = tokensFor(rec);
      used += rec;
      total += tk;
      byId[r.id] = { recognized: rec, tokens: tk };
    }
    return { total, byId };
  }

  function dayTokens(state, date) {
    let n = 0;
    for (const r of state.history) if (r.date === date) n += r.tokens;
    return n;
  }

  function balanceOf(state) {
    let saveTokens = 0;
    for (const r of state.history) saveTokens += r.tokens;
    return saveTokens + state.wallet.bonusTotal - state.wallet.spentTotal;
  }

  /* ------------------------------------------------------------------ *
   * STREAK (기획서 16, 17)
   * ------------------------------------------------------------------ */

  /** 기록한 날짜 집합으로 연속 기록을 계산합니다. 하루에 여러 번 기록해도 +1만 증가합니다. */
  function streakInfo(dateSet, today) {
    const sorted = Array.from(dateSet).sort();
    let longest = 0;
    let run = 0;
    let prev = null;
    for (const d of sorted) {
      run = prev && U.dayDiff(prev, d) === 1 ? run + 1 : 1;
      if (run > longest) longest = run;
      prev = d;
    }
    const yesterday = U.addDays(today, -1);
    const anchor = dateSet.has(today) ? today : dateSet.has(yesterday) ? yesterday : null;
    let current = 0;
    let start = null;
    if (anchor) {
      let d = anchor;
      while (dateSet.has(d)) {
        current++;
        start = d;
        d = U.addDays(d, -1);
      }
    }
    return { current, longest, start, recordedToday: dateSet.has(today), alive: !!anchor };
  }

  function nextStreakMilestone(current) {
    return D.STREAK_TRACK.find((m) => m > current) || null;
  }

  /* ------------------------------------------------------------------ *
   * 도시 가치 / 레벨 (기획서 11~15)
   * ------------------------------------------------------------------ */

  function itemValue(item, level) {
    return item.cat === 'building' ? item.value * (level || 1) : item.value;
  }

  function levelOf(state, b) {
    return D.ITEM_MAP[b.itemId].cat === 'building' ? state.buildingLevels[b.uid] || 1 : null;
  }

  /** 업그레이드 비용: 가격 × 현재 레벨 ÷ 3 (10 단위 반올림). 작은 상점 Lv.2 → 200 TOKEN */
  function upgradeCost(item, level) {
    return Math.max(10, Math.round((item.price * level) / 3 / 10) * 10);
  }

  function cityStats(state) {
    const c = { value: 0, buildings: 0, decorations: 0, landmarks: 0, specials: 0, vehicles: 0, upgrades: 0, maxLevel: 0, placed: 0, stored: 0, maxLevelByItem: {} };
    for (const b of state.buildings) {
      const item = D.ITEM_MAP[b.itemId];
      if (!item) continue;
      const lvl = item.cat === 'building' ? state.buildingLevels[b.uid] || 1 : 1;
      c.value += itemValue(item, lvl);
      if (item.cat === 'building') {
        c.buildings++;
        c.upgrades += lvl - 1;
        if (lvl > c.maxLevel) c.maxLevel = lvl;
        if (lvl > (c.maxLevelByItem[item.id] || 0)) c.maxLevelByItem[item.id] = lvl;
      } else if (item.cat === 'decoration') c.decorations++;
      else if (item.cat === 'landmark') c.landmarks++;
      else if (item.cat === 'special') c.specials++;
      if (b.region) c.placed++;
      else c.stored++;
    }
    for (const v of state.vehicles) {
      const item = D.ITEM_MAP[v.itemId];
      if (!item) continue;
      c.value += item.value;
      c.vehicles++;
    }
    return c;
  }

  /** 도시 경험치: 건물 수, 업그레이드, 도시 가치, 해금 지역, 업적으로 계산 */
  function xpParts(city, regionsCount, achievements) {
    return [
      { key: 'value', label: '도시 가치 ÷ 10', xp: Math.floor(city.value / 10) },
      { key: 'buildings', label: '건물·랜드마크 × 5', xp: (city.buildings + city.landmarks) * 5 },
      { key: 'decorations', label: '장식 × 2', xp: (city.decorations + city.specials) * 2 },
      { key: 'vehicles', label: '탈것 × 3', xp: city.vehicles * 3 },
      { key: 'upgrades', label: '업그레이드 × 4', xp: city.upgrades * 4 },
      { key: 'regions', label: '추가 지역 × 30', xp: Math.max(0, regionsCount - 1) * 30 },
      { key: 'achievements', label: '업적 × 15', xp: achievements * 15 },
    ];
  }

  function levelThreshold(L) {
    return 20 * (L - 1) + 3 * (L - 1) * (L - 2);
  }

  function levelInfo(xp) {
    let L = 1;
    while (L < R.MAX_CITY_LEVEL && xp >= levelThreshold(L + 1)) L++;
    const floor = levelThreshold(L);
    const next = L < R.MAX_CITY_LEVEL ? levelThreshold(L + 1) : null;
    return { level: L, xp, floor, next, pct: next ? (xp - floor) / (next - floor) : 1, toNext: next ? next - xp : 0 };
  }

  function collectionStats(state) {
    const groups = {};
    for (const g of D.COLLECTION_GROUPS) groups[g.id] = { owned: 0, total: 0 };
    let owned = 0;
    for (const id of COLLECTIBLE) {
      const item = D.ITEM_MAP[id];
      const g = groups[item.cat];
      g.total++;
      if (state.collection[id]) {
        g.owned++;
        owned++;
      }
    }
    for (const k of Object.keys(groups)) groups[k].pct = groups[k].total ? Math.floor((groups[k].owned / groups[k].total) * 100) : 0;
    return { owned, total: COLLECTIBLE.length, pct: Math.floor((owned / COLLECTIBLE.length) * 100), groups };
  }

  /* ------------------------------------------------------------------ *
   * 파생 값 (화면에 보여 줄 모든 숫자)
   * ------------------------------------------------------------------ */

  function derive(state, now) {
    now = now || new Date();
    const today = U.dateKey(now);
    const month = U.monthKey(today);
    const t = {
      records: 0,
      checkins: 0,
      totalSaved: 0,
      totalRecognized: 0,
      saveTokens: 0,
      todaySaved: 0,
      todayRecognized: 0,
      todayTokens: 0,
      todayCount: 0,
      monthSaved: 0,
      maxSingle: 0,
      smallSaves: 0,
      memos: 0,
      photos: 0,
    };
    const cats = new Set();
    const dayRec = {};
    const dates = new Set();
    for (const r of state.history) {
      dates.add(r.date);
      if (r.date === today) t.todayCount++;
      if (r.kind === 'checkin') {
        t.checkins++;
        continue;
      }
      t.records++;
      t.totalSaved += r.amount;
      t.totalRecognized += r.recognized;
      t.saveTokens += r.tokens;
      if (r.date === today) {
        t.todaySaved += r.amount;
        t.todayRecognized += r.recognized;
        t.todayTokens += r.tokens;
      }
      if (U.monthKey(r.date) === month) t.monthSaved += r.amount;
      if (r.amount > t.maxSingle) t.maxSingle = r.amount;
      if (r.amount <= 5000) t.smallSaves++;
      if (r.memo) t.memos++;
      if (r.hasImage) t.photos++;
      cats.add(r.category);
      dayRec[r.date] = (dayRec[r.date] || 0) + r.recognized;
    }
    let maxDayRecognized = 0;
    for (const k in dayRec) if (dayRec[k] > maxDayRecognized) maxDayRecognized = dayRec[k];

    const streak = streakInfo(dates, today);
    const city = cityStats(state);
    const achievementsCount = Object.keys(state.achievements).length;
    const parts = xpParts(city, state.regions.length, achievementsCount);
    const xp = parts.reduce((n, p) => n + p.xp, 0);
    const level = levelInfo(xp);
    let todayBonus = 0;
    for (let i = state.ledger.length - 1; i >= 0; i--) {
      const e = state.ledger[i];
      if (e.date === today && BONUS_KINDS.has(e.kind)) todayBonus += e.delta;
    }
    return Object.assign(t, {
      today,
      month,
      categories: cats.size,
      maxDayRecognized,
      remainingToday: Math.max(0, R.DAILY_CAP - t.todayRecognized),
      todayBonus,
      streak,
      longestStreak: Math.max(state.longestStreak || 0, streak.longest),
      city,
      cityValue: city.value,
      xp,
      xpParts: parts,
      cityLevel: level.level,
      level,
      achievementsCount,
      collection: collectionStats(state),
      balance: t.saveTokens + state.wallet.bonusTotal - state.wallet.spentTotal,
      skinsOwned: state.skins.owned.filter((id) => id !== 'default').length,
      regionsCount: state.regions.length,
      spent: state.wallet.spentTotal,
      pendingBonuses: state.pendingBonuses.length,
    });
  }

  /** 기획서 23. 데이터 저장 항목 중 요약 값을 원본에서 다시 계산해 둡니다. */
  function refresh(state, now, d) {
    d = d || derive(state, now);
    state.token = d.balance;
    state.totalSaved = d.totalSaved;
    state.todaySaved = d.todaySaved;
    state.todayDate = d.today;
    state.streak = d.streak.current;
    state.longestStreak = d.longestStreak;
    state.cityLevel = d.cityLevel;
    state.cityValue = d.cityValue;
    return state;
  }

  /* ------------------------------------------------------------------ *
   * 업적
   * ------------------------------------------------------------------ */

  const METRICS = {
    records: (d) => d.records,
    saveTokens: (d) => d.saveTokens,
    totalRecognized: (d) => d.totalRecognized,
    maxDayRecognized: (d) => d.maxDayRecognized,
    maxSingle: (d) => d.maxSingle,
    smallSaves: (d) => d.smallSaves,
    categories: (d) => d.categories,
    memos: (d) => d.memos,
    photos: (d) => d.photos,
    longestStreak: (d) => d.longestStreak,
    checkins: (d) => d.checkins,
    buildings: (d) => d.city.buildings,
    upgrades: (d) => d.city.upgrades,
    maxBuildingLevel: (d) => d.city.maxLevel,
    decorations: (d) => d.city.decorations + d.city.specials,
    vehicles: (d) => d.city.vehicles,
    landmarks: (d) => d.city.landmarks,
    cityValue: (d) => d.city.value,
    cityLevel: (d) => d.cityLevel,
    regions: (d) => d.regionsCount,
    skins: (d) => d.skinsOwned,
    spent: (d) => d.spent,
    collectionPct: (d) => d.collection.pct,
  };

  function metricValue(a, d) {
    const f = METRICS[a.metric];
    return f ? f(d) : 0;
  }

  /** 시작부터 1인 값(도시 레벨, 지역 수)은 진행률을 1에서부터 셉니다. */
  const METRIC_BASE = { cityLevel: 1, regions: 1 };

  function achievementProgress(state, a, d) {
    const done = !!state.achievements[a.id];
    const value = done ? a.target : Math.min(metricValue(a, d), a.target);
    const base = METRIC_BASE[a.metric] || 0;
    const pct = done ? 1 : a.target > base ? Math.max(0, (value - base) / (a.target - base)) : 0;
    return { done, value, target: a.target, pct, at: state.achievements[a.id] || null };
  }

  function unlockedTitles(state) {
    const ids = ['newbie'];
    for (const a of D.ACHIEVEMENTS) if (state.achievements[a.id] && a.reward.title) ids.push(a.reward.title);
    return D.TITLES.filter((t) => ids.includes(t.id)).map((t) => t.id);
  }

  /* ------------------------------------------------------------------ *
   * 상점 / 해금
   * ------------------------------------------------------------------ */

  function unlockStatus(item, d) {
    if (!item) return { unlocked: false, text: '없는 아이템이에요.' };
    if (item.cat === 'special') return { unlocked: false, special: true, text: item.desc };
    const u = item.unlock;
    if (!u) return { unlocked: true, text: '' };
    if (u.level && d.cityLevel < u.level) return { unlocked: false, text: '도시 LEVEL ' + u.level + ' 필요', needLevel: u.level };
    if (u.item) {
      const cur = d.city.maxLevelByItem[u.item] || 0;
      if (cur < u.itemLevel) return { unlocked: false, text: D.ITEM_MAP[u.item].name + ' Lv.' + u.itemLevel + ' 필요' };
    }
    return { unlocked: true, text: '' };
  }

  function unlockRule(item) {
    const u = item.unlock;
    if (item.cat === 'special') return item.desc;
    if (!u) return '처음부터 열려 있어요';
    if (u.level) return '도시 LEVEL ' + u.level + '에서 해금';
    return D.ITEM_MAP[u.item].name + ' Lv.' + u.itemLevel + '에서 해금';
  }

  function isDiscountable(item) {
    return item.cat === 'building' || item.cat === 'landmark';
  }

  function priceFor(state, item) {
    const coupon = isDiscountable(item) && state.coupons > 0;
    const final = coupon ? Math.round((item.price * (100 - R.DISCOUNT_PERCENT)) / 100) : item.price;
    return { base: item.price, final, coupon, saved: item.price - final };
  }

  function unlockedItemIds(d) {
    return new Set(D.ITEMS.filter((i) => i.cat !== 'special' && i.price > 0 && unlockStatus(i, d).unlocked).map((i) => i.id));
  }

  function availableRegionIds(state, d) {
    return new Set(D.REGIONS.filter((r) => !state.regions.includes(r.id) && d.cityLevel >= r.level).map((r) => r.id));
  }

  function ownedCount(state, itemId) {
    const item = D.ITEM_MAP[itemId];
    if (!item) return 0;
    if (item.cat === 'vehicle') return state.vehicles.filter((v) => v.itemId === itemId).length;
    if (item.cat === 'skin') return state.skins.owned.includes(itemId) ? 1 : 0;
    return state.buildings.filter((b) => b.itemId === itemId).length;
  }

  /* ------------------------------------------------------------------ *
   * 도시 배치 도우미
   * ------------------------------------------------------------------ */

  function findBuilding(state, uid) {
    return state.buildings.find((b) => b.uid === uid) || null;
  }

  function placedMap(state, regionId) {
    const m = {};
    for (const b of state.buildings) if (b.region === regionId) m[b.slot] = b;
    return m;
  }

  function emptySlots(state, regionId) {
    const region = D.REGION_MAP[regionId];
    if (!region || !state.regions.includes(regionId)) return [];
    const m = placedMap(state, regionId);
    const out = [];
    region.tiles.forEach((t, i) => {
      if (t === 'plot' && !m[i]) out.push(i);
    });
    return out;
  }

  function firstEmptySlot(state) {
    for (const r of D.REGIONS) {
      if (!state.regions.includes(r.id)) continue;
      const e = emptySlots(state, r.id);
      if (e.length) return { region: r.id, slot: e[0] };
    }
    return null;
  }

  function inventory(state) {
    return state.buildings.filter((b) => !b.region);
  }

  function validatePlacement(state, regionId, slot, ignoreUid) {
    const region = D.REGION_MAP[regionId];
    if (!region) throw new GameError('badRegion', '없는 지역이에요.');
    if (!state.regions.includes(regionId)) throw new GameError('regionLocked', '아직 열리지 않은 지역이에요.');
    if (!Number.isInteger(slot) || region.tiles[slot] !== 'plot') throw new GameError('badSlot', '여기에는 지을 수 없어요. 빈 땅을 골라 주세요.');
    const occ = state.buildings.find((b) => b.region === regionId && b.slot === slot && b.uid !== ignoreUid);
    if (occ) throw new GameError('occupied', '이미 다른 건물이 있는 자리예요.');
  }

  /* ------------------------------------------------------------------ *
   * 공통 처리
   * ------------------------------------------------------------------ */

  function addLedger(state, now, kind, label, delta) {
    if (!delta) return;
    state.ledger.push({ id: U.uid('l'), at: now.toISOString(), date: U.dateKey(now), kind, label: U.cleanText(label, 60), delta });
    if (state.ledger.length > R.LEDGER_MAX) state.ledger.splice(0, state.ledger.length - R.LEDGER_MAX);
  }

  function addOwnedItem(state, itemId, now) {
    const uid = U.uid('b');
    state.buildings.push({ uid, itemId, region: null, slot: null, at: now.toISOString() });
    if (D.ITEM_MAP[itemId].cat === 'building') state.buildingLevels[uid] = 1;
    markCollected(state, itemId, now.toISOString());
    return uid;
  }

  function grantReward(state, reward, now, label, kind) {
    const out = {};
    if (reward.tokens) {
      state.wallet.bonusTotal += reward.tokens;
      addLedger(state, now, kind, label, reward.tokens);
      out.tokens = reward.tokens;
    }
    if (reward.special) {
      out.special = reward.special;
      out.uid = addOwnedItem(state, reward.special, now);
    }
    if (reward.title) out.title = reward.title;
    return out;
  }

  function snapshot(state, now) {
    const d = derive(state, now);
    return { level: d.cityLevel, unlocked: unlockedItemIds(d), available: availableRegionIds(state, d) };
  }

  /** 행동 이후: 업적 확인 → 보상 → 레벨업·해금 이벤트 계산 → 요약 값 갱신 */
  function settle(state, now, before) {
    const events = [];
    let d = derive(state, now);
    for (let guard = 0; guard < 25; guard++) {
      const newly = D.ACHIEVEMENTS.filter((a) => !state.achievements[a.id] && metricValue(a, d) >= a.target);
      if (!newly.length) break;
      for (const a of newly) {
        state.achievements[a.id] = now.toISOString();
        const reward = grantReward(state, a.reward, now, '업적: ' + a.name, 'achievement');
        events.push({ type: 'achievement', id: a.id, reward });
      }
      d = derive(state, now);
    }
    if (before) {
      if (d.cityLevel > before.level) events.push({ type: 'levelUp', from: before.level, to: d.cityLevel });
      const regions = D.REGIONS.filter((r) => !state.regions.includes(r.id) && d.cityLevel >= r.level && !before.available.has(r.id));
      for (const r of regions) events.push({ type: 'regionAvailable', id: r.id });
      const now2 = unlockedItemIds(d);
      const fresh = Array.from(now2).filter((id) => !before.unlocked.has(id));
      if (fresh.length) events.push({ type: 'itemsUnlocked', ids: fresh });
    }
    state.updatedAt = now.toISOString();
    refresh(state, now, d);
    return { events, derived: d };
  }

  /**
   * STREAK 보상은 연속 기록 한 번(run)에 목표마다 한 번만 줍니다.
   * 키는 '보상 받은 날짜:목표일수'. 지금 이어지는 연속 기록 기간 안에 같은 목표 보상이 있으면 다시 주지 않아요.
   * (예전 기록을 지워 시작일이 바뀌어도 중복 지급되지 않음)
   */
  function streakRewardGiven(state, m, runStart) {
    return Object.keys(state.streakRewards).some((k) => {
      const i = k.lastIndexOf(':');
      return Number(k.slice(i + 1)) === m && k.slice(0, i) >= runStart;
    });
  }

  function applyStreakRewards(state, now, events) {
    const today = U.dateKey(now);
    const sk = streakInfo(new Set(state.history.map((r) => r.date)), today);
    if (!sk.recordedToday) return;
    for (const m of Object.keys(D.STREAK_REWARDS).map(Number).sort((a, b) => a - b)) {
      if (sk.current < m || streakRewardGiven(state, m, sk.start)) continue;
      state.streakRewards[today + ':' + m] = now.toISOString();
      const reward = grantReward(state, D.STREAK_REWARDS[m], now, m + '일 연속 기록 보상', 'streak');
      events.push({ type: 'streakReward', days: m, reward });
    }
  }

  function guessCategory(item) {
    for (const [id, re] of D.CATEGORY_HINTS) if (re.test(item)) return id;
    return 'etc';
  }

  /** SAVE 화면 입력 검사. 오류가 있으면 GameError('invalid', …, { errors }) */
  function validateRecordInput(input) {
    input = input || {};
    const errors = {};
    const item = U.cleanText(input.item, R.ITEM_MAX);
    if (!item) errors.item = '무엇을 절약했는지 적어 주세요. (예: 후드티)';
    const p = parseAmount(input.amount);
    if (!p.ok) errors.amount = p.message;
    const reason = U.cleanText(input.reason, R.REASON_MAX);
    if (!reason) errors.reason = '왜 사지 않았는지 적어 주세요. (예: 이미 비슷한 옷이 있음)';
    const memo = U.cleanMultiline(input.memo, R.MEMO_MAX);
    const keys = Object.keys(errors);
    if (keys.length) throw new GameError('invalid', errors[keys[0]], { errors, amountCode: p.code });
    const category = CATEGORY_IDS.has(input.category) ? input.category : guessCategory(item);
    return { item, amount: p.value, reason, memo, category };
  }

  function findRecord(state, id) {
    const rec = state.history.find((r) => r.id === id);
    if (!rec) throw new GameError('notFound', '기록을 찾을 수 없어요. 이미 삭제되었을 수 있어요.');
    return rec;
  }

  function fail(code, message, info) {
    throw new GameError(code, message, info);
  }

  /* ------------------------------------------------------------------ *
   * 행동 (상태를 바꾸고 결과/이벤트를 돌려줌)
   * ------------------------------------------------------------------ */

  /**
   * 그날 TOKEN을 받은 기록이 생기면 보너스를 하나 제안하고, 그런 기록이 모두 사라지면 받지 않은 보너스를 거둬요.
   * 새로 제안했으면 true.
   */
  function syncBonusForDay(state, date) {
    const earned = state.history.some((r) => r.date === date && r.tokens > 0);
    const status = state.bonusDays[date];
    if (!earned && status === 'pending') {
      delete state.bonusDays[date];
      state.pendingBonuses = state.pendingBonuses.filter((x) => x !== date);
    } else if (earned && !status) {
      state.bonusDays[date] = 'pending';
      state.pendingBonuses.push(date);
      state.pendingBonuses.sort();
      return true;
    }
    return false;
  }

  function previewSave(state, amountRaw, now) {
    const today = U.dateKey(now || new Date());
    const used = dayRecognized(state, today);
    const remaining = Math.max(0, R.DAILY_CAP - used);
    const p = parseAmount(amountRaw);
    if (!p.ok) return { ok: false, code: p.code, message: p.message, remaining, used };
    const recognized = recognize(p.value, used);
    return { ok: true, amount: p.value, recognized, tokens: tokensFor(recognized), remaining, used, capped: p.value > recognized };
  }

  function addRecord(state, input, now) {
    now = now || new Date();
    const v = validateRecordInput(input);
    const before = snapshot(state, now);
    const today = U.dateKey(now);
    const used = dayRecognized(state, today);
    const recognized = recognize(v.amount, used);
    const tokens = tokensFor(recognized);
    const id = validId(input.id) && !state.history.some((r) => r.id === input.id) ? input.id : U.uid('r');
    const rec = {
      id,
      seq: ++state.counters.seq,
      date: today,
      createdAt: now.toISOString(),
      updatedAt: null,
      kind: 'save',
      item: v.item,
      category: v.category,
      amount: v.amount,
      recognized,
      tokens,
      reason: v.reason,
      memo: v.memo,
      hasImage: input.hasImage === true,
    };
    state.history.push(rec);
    addLedger(state, now, 'save', '절약: ' + v.item, tokens);
    const bonusOffered = syncBonusForDay(state, today);
    const events = [];
    applyStreakRewards(state, now, events);
    const res = settle(state, now, before);
    return {
      record: rec,
      recognized,
      tokens,
      capped: v.amount > recognized,
      remainingBefore: Math.max(0, R.DAILY_CAP - used),
      bonusOffered,
      events: events.concat(res.events),
      derived: res.derived,
    };
  }

  /** 기획서 17. 절약이 없는 날도 '0원 기록'으로 하루 상태를 남겨 STREAK을 지킵니다. */
  function addCheckin(state, now) {
    now = now || new Date();
    const today = U.dateKey(now);
    if (state.history.some((r) => r.date === today)) fail('alreadyRecorded', '오늘은 이미 기록했어요. STREAK이 지켜지고 있어요!');
    const before = snapshot(state, now);
    const rec = {
      id: U.uid('r'),
      seq: ++state.counters.seq,
      date: today,
      createdAt: now.toISOString(),
      updatedAt: null,
      kind: 'checkin',
      item: CHECKIN_ITEM,
      category: 'checkin',
      amount: 0,
      recognized: 0,
      tokens: 0,
      reason: '',
      memo: '',
      hasImage: false,
    };
    state.history.push(rec);
    const events = [];
    applyStreakRewards(state, now, events);
    const res = settle(state, now, before);
    return { record: rec, tokens: 0, events: events.concat(res.events), derived: res.derived };
  }

  function previewEdit(state, id, amountRaw) {
    const rec = findRecord(state, id);
    const p = parseAmount(amountRaw);
    if (!p.ok) return { ok: false, code: p.code, message: p.message };
    const sim = simulateDay(state, rec.date, { id, amount: p.value });
    const delta = sim.total - dayTokens(state, rec.date);
    const balanceAfter = balanceOf(state) + delta;
    let othersRecognized = 0;
    for (const k of Object.keys(sim.byId)) if (k !== id) othersRecognized += sim.byId[k].recognized;
    return { ok: true, amount: p.value, recognized: sim.byId[id].recognized, tokens: sim.byId[id].tokens, oldTokens: rec.tokens, delta, balanceAfter, othersRecognized, capped: p.value > sim.byId[id].recognized };
  }

  function updateRecord(state, id, input, now) {
    now = now || new Date();
    const rec = findRecord(state, id);
    if (rec.kind === 'checkin') fail('notEditable', '0원 기록은 수정할 수 없어요. 필요하면 삭제해 주세요.');
    const v = validateRecordInput(input);
    const sim = simulateDay(state, rec.date, { id, amount: v.amount });
    const delta = sim.total - dayTokens(state, rec.date);
    const balance = balanceOf(state);
    if (balance + delta < 0) {
      fail('insufficientTokens', '이미 사용한 TOKEN이 있어서 금액을 이만큼 줄일 수 없어요. TOKEN ' + U.fmt(-(balance + delta)) + '개가 더 필요해요.', { need: -(balance + delta), delta, balance });
    }
    const before = snapshot(state, now);
    rec.item = v.item;
    rec.category = v.category;
    rec.amount = v.amount;
    rec.reason = v.reason;
    rec.memo = v.memo;
    if (typeof input.hasImage === 'boolean') rec.hasImage = input.hasImage;
    rec.updatedAt = now.toISOString();
    recomputeDay(state, rec.date);
    addLedger(state, now, 'edit', '기록 수정: ' + v.item, delta);
    const bonusOffered = syncBonusForDay(state, rec.date);
    const res = settle(state, now, before);
    return { record: rec, delta, bonusOffered, events: res.events, derived: res.derived };
  }

  function previewDelete(state, id) {
    const rec = findRecord(state, id);
    const sim = simulateDay(state, rec.date, { remove: id });
    const delta = sim.total - dayTokens(state, rec.date);
    const balance = balanceOf(state);
    return { delta, balance, balanceAfter: balance + delta, ok: balance + delta >= 0, need: Math.max(0, -(balance + delta)) };
  }

  function deleteRecord(state, id, now) {
    now = now || new Date();
    const rec = findRecord(state, id);
    const p = previewDelete(state, id);
    if (!p.ok) {
      fail('insufficientTokens', '이 기록으로 받은 TOKEN을 돌려줘야 하는데, 이미 사용해서 ' + U.fmt(p.need) + '개가 부족해요. TOKEN을 더 모은 뒤 삭제할 수 있어요.', p);
    }
    const before = snapshot(state, now);
    state.history.splice(state.history.indexOf(rec), 1);
    recomputeDay(state, rec.date);
    addLedger(state, now, 'delete', '기록 삭제: ' + rec.item, p.delta);
    syncBonusForDay(state, rec.date);
    const res = settle(state, now, before);
    return { record: rec, delta: p.delta, events: res.events, derived: res.derived };
  }

  function setRecordImage(state, id, hasImage, now) {
    const rec = findRecord(state, id);
    if (rec.kind !== 'save') return { record: rec, events: [] };
    rec.hasImage = !!hasImage;
    const res = settle(state, now || new Date(), snapshot(state, now));
    return { record: rec, events: res.events };
  }

  /** 기획서 21. 펀(Fun) 요소 — 그날 첫 TOKEN 기록 뒤 보너스 하나를 고릅니다. (무작위 아님) */
  function claimBonus(state, choice, now) {
    now = now || new Date();
    if (choice !== 'lucky' && choice !== 'discount') fail('invalid', '보너스를 다시 골라 주세요.');
    if (!state.pendingBonuses.length) fail('noBonus', '받을 수 있는 보너스가 없어요.');
    const before = snapshot(state, now);
    const date = state.pendingBonuses.shift();
    state.bonusDays[date] = choice;
    if (choice === 'lucky') {
      state.wallet.bonusTotal += R.LUCKY_BONUS;
      state.counters.lucky++;
      addLedger(state, now, 'bonus', 'LUCKY BONUS', R.LUCKY_BONUS);
    } else {
      state.coupons = Math.min(state.coupons + 1, R.MAX_COUPONS);
      state.counters.discounts++;
    }
    const res = settle(state, now, before);
    return { choice, date, events: res.events, derived: res.derived };
  }

  function buyItem(state, itemId, opts, now) {
    now = now || new Date();
    opts = opts || {};
    const item = D.ITEM_MAP[itemId];
    if (!item || item.cat === 'special' || !(item.price > 0)) fail('notForSale', '구매할 수 없는 아이템이에요.');
    const d = derive(state, now);
    const st = unlockStatus(item, d);
    if (!st.unlocked) fail('locked', '아직 잠겨 있어요. (' + st.text + ')');
    if (item.cat === 'skin' && state.skins.owned.includes(item.id)) fail('owned', '이미 가지고 있는 스킨이에요.');
    const placing = opts.region !== undefined && opts.region !== null;
    if (placing) {
      if (!PLACEABLE.has(item.cat)) fail('badSlot', '이 아이템은 땅에 놓을 수 없어요.');
      validatePlacement(state, opts.region, opts.slot);
    }
    const price = priceFor(state, item);
    if (d.balance < price.final) {
      fail('insufficientTokens', 'TOKEN이 ' + U.fmt(price.final - d.balance) + '개 부족해요.', { need: price.final - d.balance });
    }
    const before = snapshot(state, now);
    if (price.coupon) state.coupons--;
    state.wallet.spentTotal += price.final;
    addLedger(state, now, 'purchase', '구매: ' + item.name, -price.final);
    let uid = null;
    const iso = now.toISOString();
    if (item.cat === 'vehicle') {
      uid = U.uid('v');
      state.vehicles.push({ uid, itemId: item.id, at: iso });
      markCollected(state, item.id, iso);
    } else if (item.cat === 'skin') {
      state.skins.owned.push(item.id);
      state.skins.owned = D.ITEMS.filter((i) => i.cat === 'skin' && state.skins.owned.includes(i.id)).map((i) => i.id);
      state.skins.active = item.id;
      markCollected(state, item.id, iso);
    } else {
      uid = addOwnedItem(state, item.id, now);
      if (placing) {
        const b = findBuilding(state, uid);
        b.region = opts.region;
        b.slot = opts.slot;
      }
    }
    const res = settle(state, now, before);
    return { item, uid, price, placed: placing, events: res.events, derived: res.derived };
  }

  function placeItem(state, uid, regionId, slot, now) {
    now = now || new Date();
    const b = findBuilding(state, uid);
    if (!b) fail('notFound', '건물을 찾을 수 없어요.');
    if (b.region === regionId && b.slot === slot) return { building: b, events: [] };
    validatePlacement(state, regionId, slot, uid);
    const before = snapshot(state, now);
    b.region = regionId;
    b.slot = slot;
    const res = settle(state, now, before);
    return { building: b, events: res.events };
  }

  function storeItem(state, uid, now) {
    now = now || new Date();
    const b = findBuilding(state, uid);
    if (!b) fail('notFound', '건물을 찾을 수 없어요.');
    b.region = null;
    b.slot = null;
    const res = settle(state, now, snapshot(state, now));
    return { building: b, events: res.events };
  }

  function upgradeInfo(state, uid) {
    const b = findBuilding(state, uid);
    if (!b) return null;
    const item = D.ITEM_MAP[b.itemId];
    if (item.cat !== 'building') return { upgradable: false, item, building: b };
    const level = state.buildingLevels[uid] || 1;
    if (level >= R.MAX_BUILDING_LEVEL) return { upgradable: false, max: true, item, building: b, level, value: itemValue(item, level) };
    return { upgradable: true, item, building: b, level, cost: upgradeCost(item, level), value: itemValue(item, level), nextValue: itemValue(item, level + 1) };
  }

  function upgradeItem(state, uid, now) {
    now = now || new Date();
    const info = upgradeInfo(state, uid);
    if (!info) fail('notFound', '건물을 찾을 수 없어요.');
    if (!info.upgradable) fail(info.max ? 'maxLevel' : 'notUpgradable', info.max ? '이미 최고 레벨(Lv.5)이에요.' : '이 아이템은 업그레이드할 수 없어요.');
    const balance = balanceOf(state);
    if (balance < info.cost) fail('insufficientTokens', 'TOKEN이 ' + U.fmt(info.cost - balance) + '개 부족해요.', { need: info.cost - balance });
    const before = snapshot(state, now);
    state.wallet.spentTotal += info.cost;
    state.buildingLevels[uid] = info.level + 1;
    state.counters.upgrades++;
    addLedger(state, now, 'upgrade', '업그레이드: ' + info.item.name + ' Lv.' + (info.level + 1), -info.cost);
    const res = settle(state, now, before);
    return { level: info.level + 1, cost: info.cost, valueGain: info.nextValue - info.value, events: res.events, derived: res.derived };
  }

  function unlockRegion(state, regionId, now) {
    now = now || new Date();
    const region = D.REGION_MAP[regionId];
    if (!region) fail('badRegion', '없는 지역이에요.');
    if (state.regions.includes(regionId)) fail('alreadyUnlocked', '이미 열린 지역이에요.');
    const d = derive(state, now);
    if (d.cityLevel < region.level) fail('locked', '도시 LEVEL ' + region.level + '이 되면 열 수 있어요. (지금 LEVEL ' + d.cityLevel + ')');
    const before = snapshot(state, now);
    state.regions = D.REGIONS.map((r) => r.id).filter((id) => id === regionId || state.regions.includes(id));
    const res = settle(state, now, before);
    return { region, events: res.events, derived: res.derived };
  }

  function applySkin(state, skinId, now) {
    now = now || new Date();
    if (!state.skins.owned.includes(skinId)) fail('notOwned', '먼저 상점에서 스킨을 구매해 주세요.');
    state.skins.active = skinId;
    const res = settle(state, now, snapshot(state, now));
    return { skin: skinId, events: res.events };
  }

  function updateProfile(state, patch, now) {
    now = now || new Date();
    patch = patch || {};
    if ('nickname' in patch) {
      const n = U.cleanText(patch.nickname, R.NICK_MAX);
      if (!n) fail('invalid', '닉네임을 1~' + R.NICK_MAX + '자로 입력해 주세요.', { errors: { nickname: '닉네임을 입력해 주세요.' } });
      state.user.nickname = n;
    }
    if ('avatar' in patch) {
      if (!D.AVATARS.includes(patch.avatar)) fail('invalid', '캐릭터를 다시 골라 주세요.');
      state.user.avatar = patch.avatar;
    }
    if ('titleId' in patch) {
      if (!unlockedTitles(state).includes(patch.titleId)) fail('locked', '아직 얻지 못한 칭호예요.');
      state.user.titleId = patch.titleId;
    }
    state.updatedAt = now.toISOString();
    return { user: state.user };
  }

  function completeOnboarding(state, patch, now) {
    updateProfile(state, patch || {}, now);
    state.user.onboarded = true;
    return { user: state.user };
  }

  function setSettings(state, patch) {
    patch = patch || {};
    for (const k of ['sound', 'sfx', 'animation']) if (typeof patch[k] === 'boolean') state.settings[k] = patch[k];
    if (patch.theme === 'system' || patch.theme === 'light' || patch.theme === 'dark') state.settings.theme = patch.theme;
    return { settings: state.settings };
  }

  /** 앱을 열 때 날짜 변경·새 업적을 반영합니다. */
  function settleOnLoad(state, now) {
    return settle(state, now || new Date(), snapshot(state, now));
  }

  /* ------------------------------------------------------------------ *
   * 홈 화면 목표 추천
   * ------------------------------------------------------------------ */

  function nextGoals(state, d) {
    const goals = [];
    if (!d.records) {
      goals.push({ kind: 'save', icon: '📝', title: '첫 절약 기록하기', text: '참은 소비 하나를 기록하면 TOKEN을 받아요.', action: 'save' });
    }
    const shopItems = D.ITEMS.filter((i) => (i.cat === 'building' || i.cat === 'landmark') && unlockStatus(i, d).unlocked).sort((a, b) => a.price - b.price);
    const affordable = shopItems.filter((i) => priceFor(state, i).final <= d.balance);
    const target = shopItems.find((i) => priceFor(state, i).final > d.balance && ownedCount(state, i.id) === 0) || shopItems.find((i) => priceFor(state, i).final > d.balance);
    if (affordable.length && firstEmptySlot(state)) {
      const best = affordable[affordable.length - 1];
      goals.push({ kind: 'build', icon: '🏗️', title: best.name + ' 지을 수 있어요', text: '지금 TOKEN으로 바로 지을 수 있어요.', action: 'shop', itemId: best.id });
    } else if (target) {
      const need = priceFor(state, target).final - d.balance;
      goals.push({ kind: 'target', icon: '🎯', title: target.name + '까지 ' + U.fmt(need) + ' TOKEN', text: '약 ' + U.fmt(Math.ceil(need / 10) * 1000) + '원을 절약하면 돼요.', action: 'shop', itemId: target.id, pct: d.balance / priceFor(state, target).final });
    }
    let best = null;
    for (const a of D.ACHIEVEMENTS) {
      if (state.achievements[a.id]) continue;
      const pct = achievementProgress(state, a, d).pct;
      if (!best || pct > best.pct) best = { a, pct };
    }
    if (best) {
      goals.push({ kind: 'achievement', icon: best.a.icon, title: '업적: ' + best.a.name, text: best.a.desc, action: 'achievements', pct: best.pct });
    }
    return goals.slice(0, 3);
  }

  SC.engine = {
    SCHEMA_VERSION,
    CHECKIN_ITEM,
    GameError,
    AMOUNT_ERRORS,
    parseAmount,
    tokensFor,
    recognize,
    createState,
    normalizeState,
    derive,
    refresh,
    streakInfo,
    nextStreakMilestone,
    levelThreshold,
    levelInfo,
    itemValue,
    levelOf,
    upgradeCost,
    upgradeInfo,
    cityStats,
    collectionStats,
    COLLECTIBLE,
    metricValue,
    achievementProgress,
    unlockedTitles,
    unlockStatus,
    unlockRule,
    priceFor,
    isDiscountable,
    ownedCount,
    findBuilding,
    placedMap,
    emptySlots,
    firstEmptySlot,
    inventory,
    validatePlacement,
    balanceOf,
    dayRecognized,
    guessCategory,
    validateRecordInput,
    previewSave,
    previewEdit,
    previewDelete,
    addRecord,
    addCheckin,
    updateRecord,
    deleteRecord,
    setRecordImage,
    syncBonusForDay,
    claimBonus,
    buyItem,
    placeItem,
    storeItem,
    upgradeItem,
    unlockRegion,
    applySkin,
    updateProfile,
    completeOnboarding,
    setSettings,
    settleOnLoad,
    nextGoals,
  };
})(typeof window !== 'undefined' ? window : globalThis);
