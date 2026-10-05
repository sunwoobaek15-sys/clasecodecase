/* SAVE CITY — 랭킹 규칙과 부정 사용 검사 (DOM 없는 순수 로직이라 Node 테스트로 검증합니다)
 *
 * 공유 데이터베이스 구조 (Claude 아티팩트의 db 기능)
 *   ranking/<사용자 id>  누구나 읽는 랭킹 카드 (본인만 쓰기)
 *   proofs/<사용자 id>   관리자(게시자)와 본인만 읽는 상세 기록 (본인만 쓰기)
 *   mod/<사용자 id>      관리자 판정: 정상 확인 · 경고 · 랭킹 제외 (누구나 읽기, 관리자만 쓰기)
 */
(function (root) {
  'use strict';
  const SC = (root.SC = root.SC || {});
  const U = SC.util;
  const D = SC.data;
  const E = SC.engine;
  const R = D.RULES;

  const FORMAT = 1;
  const PROOF_RECENT = 60; // 관리자에게 보여 줄 최근 절약 기록 수
  const PROOF_DAYS = 400; // 날짜별 합계를 보내는 최대 일수
  const SYNC_LOG_MAX = 20;
  const FUTURE_SLACK_MS = 12 * 3600000; // 기기 시계 차이를 감안한 여유
  const DAY_TOKEN_CAP = R.DAILY_TOKEN_CAP;
  const WEEK_CAP = R.DAILY_CAP * 7;

  const CATS = [
    { id: 'week', label: '이번 주', title: '이번 주 절약', desc: '이번 주(월~일) 인정된 절약 금액이에요. 월요일에 새로 시작해요.' },
    { id: 'total', label: '누적', title: '누적 절약', desc: '지금까지 인정된 절약 금액이에요. (하루 최대 50,000원)' },
    { id: 'city', label: '도시', title: '도시 LEVEL', desc: '도시 LEVEL 순서예요. 같으면 도시 가치가 높은 쪽이 앞서요.' },
    { id: 'streak', label: 'STREAK', title: '연속 기록', desc: '지금 이어지고 있는 연속 기록 일수예요.' },
  ];
  const CAT_MAP = CATS.reduce((m, c) => ((m[c.id] = c), m), Object.create(null));

  /** 관리자가 고르는 판정 사유 */
  const MOD_REASONS = [
    { id: 'tamper', label: '저장 데이터 변조' },
    { id: 'clock', label: '기기 시계 조작' },
    { id: 'fake', label: '사실과 다른 절약 기록' },
    { id: 'pattern', label: '비정상적인 기록 패턴' },
    { id: 'other', label: '기타' },
  ];
  const MOD_REASON_MAP = MOD_REASONS.reduce((m, r) => ((m[r.id] = r), m), Object.create(null));
  const MOD_STATUSES = ['ok', 'warned', 'hidden'];
  const MOD_MESSAGE_MAX = 80;
  const MOD_HISTORY_MAX = 10;

  /* ------------------------------------------------------------------ *
   * 게임 규칙으로 가능한 최댓값 (데이터에서 계산)
   * ------------------------------------------------------------------ */

  /** 업적 TOKEN 보상 합계 (업적은 한 번씩만 받아요) */
  const ACH_TOKENS = D.ACHIEVEMENTS.reduce((n, a) => n + (a.reward.tokens || 0), 0);
  /** 보상으로만 받는 특별 장식의 도시 가치 합계. STREAK 보상 장식은 연속 기록 한 번마다 다시 받을 수 있어요. */
  const SPECIAL_VALUE = D.ITEMS.filter((i) => i.cat === 'special').reduce((n, i) => n + i.value, 0);
  const STREAK_SPECIALS = Object.keys(D.STREAK_REWARDS)
    .map(Number)
    .filter((m) => D.STREAK_REWARDS[m].special)
    .map((m) => ({ every: m, value: D.ITEM_MAP[D.STREAK_REWARDS[m].special].value }));
  function specialValue(days) {
    return STREAK_SPECIALS.reduce((n, s) => n + s.value * Math.floor(days / s.every), SPECIAL_VALUE);
  }
  function specialCount(days) {
    return STREAK_SPECIALS.reduce((n, s) => n + Math.floor(days / s.every), D.ITEMS.filter((i) => i.cat === 'special').length);
  }

  /** TOKEN 1개를 써서 얻을 수 있는 도시 가치의 최댓값 (할인 쿠폰, 업그레이드 포함) */
  const VALUE_PER_TOKEN = (function () {
    let best = 0;
    for (const item of D.ITEMS) {
      if (!(item.price > 0) || item.cat === 'skin') continue;
      const base = E.isDiscountable(item) ? Math.round((item.price * (100 - R.DISCOUNT_PERCENT)) / 100) : item.price;
      let cost = base;
      best = Math.max(best, E.itemValue(item, 1) / cost);
      if (item.cat === 'building') {
        for (let L = 1; L < R.MAX_BUILDING_LEVEL; L++) {
          cost += E.upgradeCost(item, L);
          best = Math.max(best, E.itemValue(item, L + 1) / cost);
        }
      }
    }
    return best;
  })();

  /** TOKEN 1개로 얻을 수 있는 도시 경험치의 최댓값 (가장 싼 업그레이드 기준, 여유 포함) */
  const XP_PER_TOKEN = (function () {
    let best = 0;
    for (const item of D.ITEMS) {
      if (!(item.price > 0) || item.cat === 'skin') continue;
      const per = item.cat === 'building' || item.cat === 'landmark' ? 5 : item.cat === 'vehicle' ? 3 : 2;
      best = Math.max(best, per / item.price);
      if (item.cat === 'building') best = Math.max(best, 4 / E.upgradeCost(item, 1));
    }
    return best;
  })();
  const xpFixed = (days) => (D.REGIONS.length - 1) * 30 + D.ACHIEVEMENTS.length * 15 + specialCount(days) * 2;

  /** 보너스 TOKEN(업적·STREAK·LUCKY BONUS)으로 받을 수 있는 최댓값 */
  function maxBonus(days, saveDays) {
    const s7 = (D.STREAK_REWARDS[7] && D.STREAK_REWARDS[7].tokens) || 0;
    const s14 = (D.STREAK_REWARDS[14] && D.STREAK_REWARDS[14].tokens) || 0;
    return ACH_TOKENS + s7 * Math.floor(days / 7) + s14 * Math.floor(days / 14) + R.LUCKY_BONUS * saveDays;
  }

  /* ------------------------------------------------------------------ *
   * 내 데이터 → 랭킹 카드 / 상세 기록
   * ------------------------------------------------------------------ */

  /** 기록 순서대로 봤을 때 날짜나 시각이 거꾸로 간 횟수 (시계를 되돌린 흔적) */
  function timeReversals(history) {
    let n = 0;
    for (let i = 1; i < history.length; i++) {
      const a = history[i - 1];
      const b = history[i];
      if (a.date > b.date || Date.parse(a.createdAt) > Date.parse(b.createdAt) + E.CLOCK_TOLERANCE_MS) n++;
    }
    return n;
  }

  /** 누구나 볼 수 있는 랭킹 카드 */
  function buildEntry(state, now) {
    now = now || new Date();
    const d = E.derive(state, now);
    const week = U.weekStart(d.today);
    const weekEnd = U.addDays(week, 6);
    let weekSaved = 0;
    let last = null;
    const days = new Set();
    const saveDays = new Set();
    for (const r of state.history) {
      days.add(r.date);
      if (!last || r.date > last) last = r.date;
      if (r.kind !== 'save') continue;
      saveDays.add(r.date);
      if (r.date >= week && r.date <= weekEnd) weekSaved += r.recognized;
    }
    return {
      v: FORMAT,
      nick: state.user.nickname,
      avatar: state.user.avatar,
      title: state.user.titleId,
      level: d.cityLevel,
      xp: d.xp,
      value: d.cityValue,
      total: d.totalRecognized,
      week,
      weekSaved,
      streak: d.streak.current,
      longest: d.longestStreak,
      last,
      days: days.size,
      saveDays: saveDays.size,
      records: d.records,
      earned: d.saveTokens,
      bonus: state.wallet.bonusTotal,
      spent: state.wallet.spentTotal,
      since: U.dateKey(new Date(state.createdAt)),
      tampered: state.security.tamperCount,
      clock: state.security.clockBack,
      order: timeReversals(state.history),
      syncedAt: now.toISOString(),
    };
  }

  /** 관리자(게시자)와 본인만 보는 상세 기록. 이유·메모·사진은 보내지 않아요. */
  function buildProof(state, now) {
    now = now || new Date();
    const byDay = {};
    for (const r of state.history) {
      const x = byDay[r.date] || (byDay[r.date] = { d: r.date, n: 0, a: 0, r: 0, k: 0, c: 0 });
      if (r.kind === 'save') {
        x.n++;
        x.a += r.amount;
        x.r += r.recognized;
        x.k += r.tokens;
      } else x.c++;
    }
    const daily = Object.keys(byDay)
      .sort()
      .map((k) => byDay[k]);
    const saves = state.history.filter((r) => r.kind === 'save');
    const c = E.cityStats(state);
    return {
      v: FORMAT,
      tz: -now.getTimezoneOffset(),
      createdAt: state.createdAt,
      daysTotal: daily.length,
      daily: daily.slice(-PROOF_DAYS),
      recent: saves.slice(-PROOF_RECENT).map((r) => ({ d: r.date, at: r.createdAt, ed: r.updatedAt, i: r.item, c: r.category, a: r.amount, r: r.recognized, k: r.tokens })),
      clockEvents: state.security.clockEvents.slice(),
      tamperedAt: state.security.tamperedAt,
      wallet: { bonus: state.wallet.bonusTotal, spent: state.wallet.spentTotal, coupons: state.coupons, lucky: state.counters.lucky, discounts: state.counters.discounts },
      city: { buildings: c.buildings, landmarks: c.landmarks, decorations: c.decorations, specials: c.specials, vehicles: c.vehicles, upgrades: c.upgrades, regions: state.regions.length, achievements: Object.keys(state.achievements).length },
      syncs: state.ranking.syncs.concat([now.toISOString()]).slice(-SYNC_LOG_MAX),
    };
  }

  /** 내용이 바뀌었을 때만 다시 올리기 위한 해시 (올린 시각은 빼고 계산) */
  function contentHash(entry, proof) {
    const e = Object.assign({}, entry, { syncedAt: null });
    const p = Object.assign({}, proof, { syncs: null });
    return U.hash(JSON.stringify(e) + '|' + JSON.stringify(p));
  }

  /* ------------------------------------------------------------------ *
   * 내 기기의 참가 상태 (state.ranking)
   * ------------------------------------------------------------------ */

  function markJoined(state, uid, now) {
    if (!E.validUid(uid)) throw new E.GameError('noId', '로그인한 계정에서만 랭킹에 참가할 수 있어요.');
    now = now || new Date();
    const rk = state.ranking;
    if (rk.uid !== uid) {
      rk.lastHash = null;
      rk.syncs = [];
      rk.seenMod = null;
    }
    rk.joined = true;
    rk.uid = uid;
    rk.joinedAt = now.toISOString();
    return rk;
  }

  function markLeft(state) {
    const rk = state.ranking;
    rk.joined = false;
    rk.lastHash = null;
    rk.lastSyncAt = null;
    rk.syncs = [];
    return rk;
  }

  function markSynced(state, hashValue, now) {
    now = now || new Date();
    const rk = state.ranking;
    rk.lastHash = hashValue;
    rk.lastSyncAt = now.toISOString();
    rk.syncs.push(rk.lastSyncAt);
    if (rk.syncs.length > SYNC_LOG_MAX) rk.syncs.splice(0, rk.syncs.length - SYNC_LOG_MAX);
    return rk;
  }

  /* ------------------------------------------------------------------ *
   * 다른 사람이 올린 데이터 정리 (믿을 수 없는 입력)
   * ------------------------------------------------------------------ */

  const ENTRY_INTS = ['level', 'xp', 'value', 'total', 'weekSaved', 'streak', 'longest', 'days', 'saveDays', 'records', 'earned', 'bonus', 'spent', 'tampered', 'clock', 'order'];
  const isCount = (v) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 1e12;

  /** 랭킹 카드를 안전한 값으로 바꿉니다. 형식이 틀리면 malformed: true */
  function normEntry(raw) {
    raw = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    let malformed = raw.v !== FORMAT;
    const e = { v: FORMAT };
    for (const k of ENTRY_INTS) {
      if (isCount(raw[k])) e[k] = raw[k];
      else {
        e[k] = 0;
        malformed = true;
      }
    }
    e.nick = U.cleanText(typeof raw.nick === 'string' ? raw.nick : '', R.NICK_MAX) || '시민';
    e.avatar = D.AVATARS.includes(raw.avatar) ? raw.avatar : '🙂';
    e.title = typeof raw.title === 'string' && D.TITLE_MAP[raw.title] ? raw.title : 'newbie';
    e.week = U.isDateKey(raw.week) ? raw.week : null;
    e.last = U.isDateKey(raw.last) ? raw.last : null;
    e.since = U.isDateKey(raw.since) ? raw.since : null;
    e.syncedAt = U.isIso(raw.syncedAt) ? new Date(raw.syncedAt).toISOString() : null;
    if (!e.week || !e.since || !e.syncedAt || (raw.last !== null && !e.last)) malformed = true;
    e.malformed = malformed;
    return e;
  }

  /** 상세 기록 정리. 없거나 형식이 틀리면 null */
  function normProof(raw) {
    if (!raw || typeof raw !== 'object' || raw.v !== FORMAT) return null;
    const list = (v, max) => (Array.isArray(v) ? v.slice(-max) : []);
    const int = (v) => (isCount(v) ? v : 0);
    const daily = list(raw.daily, PROOF_DAYS)
      .filter((x) => x && U.isDateKey(x.d))
      .map((x) => ({ d: x.d, n: int(x.n), a: int(x.a), r: int(x.r), k: int(x.k), c: int(x.c) }));
    const recent = list(raw.recent, PROOF_RECENT)
      .filter((x) => x && U.isDateKey(x.d) && U.isIso(x.at))
      .map((x) => ({
        d: x.d,
        at: new Date(x.at).toISOString(),
        ed: U.isIso(x.ed) ? new Date(x.ed).toISOString() : null,
        i: U.cleanText(typeof x.i === 'string' ? x.i : '', R.ITEM_MAX) || '절약',
        c: D.CATEGORY_MAP[x.c] ? x.c : 'etc',
        a: int(x.a),
        r: int(x.r),
        k: int(x.k),
      }));
    const w = raw.wallet && typeof raw.wallet === 'object' ? raw.wallet : {};
    const c = raw.city && typeof raw.city === 'object' ? raw.city : {};
    return {
      tz: Number.isInteger(raw.tz) && Math.abs(raw.tz) <= 1080 ? raw.tz : 0,
      createdAt: U.isIso(raw.createdAt) ? new Date(raw.createdAt).toISOString() : null,
      daysTotal: int(raw.daysTotal),
      daily,
      recent,
      clockEvents: list(raw.clockEvents, SYNC_LOG_MAX)
        .filter((x) => x && U.isIso(x.at))
        .map((x) => ({ at: new Date(x.at).toISOString(), back: int(x.back) })),
      tamperedAt: U.isIso(raw.tamperedAt) ? new Date(raw.tamperedAt).toISOString() : null,
      wallet: { bonus: int(w.bonus), spent: int(w.spent), coupons: int(w.coupons), lucky: int(w.lucky), discounts: int(w.discounts) },
      city: { buildings: int(c.buildings), landmarks: int(c.landmarks), decorations: int(c.decorations), specials: int(c.specials), vehicles: int(c.vehicles), upgrades: int(c.upgrades), regions: int(c.regions), achievements: int(c.achievements) },
      syncs: list(raw.syncs, SYNC_LOG_MAX)
        .filter((x) => U.isIso(x))
        .map((x) => new Date(x).toISOString()),
    };
  }

  /** 관리자 판정 정리 */
  function normMod(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (!MOD_STATUSES.includes(raw.status)) return null;
    return {
      status: raw.status,
      reason: typeof raw.reason === 'string' && MOD_REASON_MAP[raw.reason] ? raw.reason : null,
      message: U.cleanText(typeof raw.message === 'string' ? raw.message : '', MOD_MESSAGE_MAX),
      at: U.isIso(raw.at) ? new Date(raw.at).toISOString() : null,
      allow: Array.isArray(raw.allow) ? raw.allow.filter((x) => typeof x === 'string' && x.length <= 40).slice(0, 40) : [],
      history: Array.isArray(raw.history)
        ? raw.history
            .filter((h) => h && MOD_STATUSES.includes(h.status) && U.isIso(h.at))
            .slice(-MOD_HISTORY_MAX)
            .map((h) => ({ status: h.status, reason: MOD_REASON_MAP[h.reason] ? h.reason : null, at: new Date(h.at).toISOString() }))
        : [],
    };
  }

  /** 관리자 판정 문서 만들기 (관리자 화면에서 사용) */
  function buildMod(prev, status, o, now) {
    o = o || {};
    now = now || new Date();
    if (!MOD_STATUSES.includes(status)) throw new E.GameError('invalid', '판정을 다시 골라 주세요.');
    const at = now.toISOString();
    const reason = status === 'ok' ? null : MOD_REASON_MAP[o.reason] ? o.reason : 'other';
    const history = ((prev && prev.history) || []).concat([{ status, reason, at }]).slice(-MOD_HISTORY_MAX);
    return {
      status,
      reason,
      message: status === 'ok' ? '' : U.cleanText(o.message || '', MOD_MESSAGE_MAX),
      at,
      // '정상 확인'은 지금 보이는 의심 항목을 허용해요. 새 흔적이 생기면 다시 표시돼요.
      allow: status === 'ok' ? (o.allow || []).slice(0, 40) : (prev && prev.allow) || [],
      history,
    };
  }

  /* ------------------------------------------------------------------ *
   * 부정 사용 검사
   * ------------------------------------------------------------------ */

  function flag(list, level, code, key, text) {
    list.push({ level, code, key: key || code, text });
  }

  /**
   * 랭킹 카드만으로 하는 검사 (누구나 같은 결과). 'high' 항목이 있으면 랭킹에서 자동으로 숨겨요.
   * ctx: { today: 보는 사람의 날짜 키, nowMs: 보는 사람의 현재 시각 }
   */
  function publicCheck(e, ctx) {
    const flags = [];
    const today = ctx.today;
    const nowMs = ctx.nowMs;
    if (e.malformed) flag(flags, 'high', 'malformed', 'malformed', '랭킹 데이터 형식이 올바르지 않아요.');
    if (e.tampered > 0) flag(flags, 'high', 'tampered', 'tampered:' + e.tampered, '저장 데이터가 게임 밖에서 바뀐 흔적이 있어요. (' + e.tampered + '회)');
    if (e.clock > 0) flag(flags, 'high', 'clock', 'clock:' + e.clock, '기기 시계를 과거로 되돌린 흔적이 있어요. (' + e.clock + '회)');
    if (e.order > 0) flag(flags, 'high', 'order', 'order:' + e.order, '앞선 기록보다 이전 날짜·시각으로 저장된 기록이 있어요. (' + e.order + '건)');

    const future =
      (e.syncedAt && Date.parse(e.syncedAt) > nowMs + FUTURE_SLACK_MS) || (e.since && U.dayDiff(today, e.since) > 1) || (e.last && U.dayDiff(today, e.last) > 1);
    if (future) flag(flags, 'high', 'future', 'future', '미래 날짜의 기록이 있어요. 기기 시계를 앞으로 돌렸을 수 있어요.');

    if (e.weekSaved > WEEK_CAP || e.total > R.DAILY_CAP * e.saveDays || e.weekSaved > e.total) {
      flag(flags, 'high', 'cap', 'cap', '하루 인정 한도(50,000원)로는 나올 수 없는 절약 금액이에요.');
    }
    if (e.earned > DAY_TOKEN_CAP * e.saveDays || e.earned > Math.floor(e.total / 100)) {
      flag(flags, 'high', 'tokens', 'tokens', '절약 금액에 비해 받은 TOKEN이 너무 많아요.');
    }
    const span = e.since ? Math.max(1, U.dayDiff(e.since, today) + 2) : 0;
    if (e.saveDays > e.days || e.saveDays > e.records || e.days > span || (e.records > 0 && e.saveDays === 0)) {
      flag(flags, 'high', 'days', 'days', '기록한 날짜 수가 게임을 시작한 뒤 지난 날짜와 맞지 않아요.');
    }
    if (e.streak > e.longest || e.longest > e.days) flag(flags, 'high', 'streak', 'streak', '기록한 날짜 수로는 나올 수 없는 STREAK이에요.');
    if (e.bonus > maxBonus(e.days, e.saveDays)) flag(flags, 'high', 'bonus', 'bonus', '받을 수 있는 보너스 TOKEN보다 많아요.');
    if (e.spent > e.earned + e.bonus) flag(flags, 'high', 'spent', 'spent', '받은 TOKEN보다 많이 썼어요.');
    if (e.value > e.spent * VALUE_PER_TOKEN + specialValue(e.days)) flag(flags, 'high', 'value', 'value', '쓴 TOKEN으로는 만들 수 없는 도시 가치예요.');
    if (e.xp > e.value / 10 + e.spent * XP_PER_TOKEN + xpFixed(e.days) || e.level !== E.levelInfo(e.xp).level) {
      flag(flags, 'high', 'level', 'level', '도시 LEVEL이 도시 데이터와 맞지 않아요.');
    }
    return flags;
  }

  /** 관리자 전용 검사: 랭킹 카드 + 상세 기록 (proof: null = 없음, undefined = 아직 불러오는 중) */
  function auditPlayer(e, proof, ctx) {
    const flags = publicCheck(e, ctx);
    if (proof === undefined) return flags;
    if (!proof) {
      flag(flags, 'mid', 'noProof', 'noProof', '상세 기록이 아직 올라오지 않았어요.');
      return flags;
    }
    if (proof.daily.some((x) => x.r > R.DAILY_CAP || x.k > DAY_TOKEN_CAP)) {
      if (!flags.some((f) => f.code === 'cap')) flag(flags, 'high', 'cap', 'cap', '하루 인정 한도(50,000원)를 넘은 날이 있어요.');
    }
    if (proof.daysTotal <= proof.daily.length) {
      let total = 0;
      let saves = 0;
      let saveDays = 0;
      let weekSaved = 0;
      const weekEnd = e.week ? U.addDays(e.week, 6) : null;
      for (const x of proof.daily) {
        total += x.r;
        saves += x.n;
        if (x.n) saveDays++;
        if (e.week && x.d >= e.week && x.d <= weekEnd) weekSaved += x.r;
      }
      if (total !== e.total || saves !== e.records || saveDays !== e.saveDays || proof.daily.length !== e.days || weekSaved !== e.weekSaved) {
        flag(flags, 'high', 'mismatch', 'mismatch', '랭킹 숫자와 상세 기록의 합계가 달라요.');
      }
    }
    if (proof.recent.some((x) => Date.parse(x.at) > ctx.nowMs + FUTURE_SLACK_MS)) {
      if (!flags.some((f) => f.code === 'future')) flag(flags, 'high', 'future', 'future', '미래 시각으로 저장된 기록이 있어요.');
    }
    const big = proof.recent.filter((x) => x.a >= 1000000).length;
    if (big) flag(flags, 'mid', 'bigClaim', 'bigClaim', '한 번에 100만 원 이상 절약했다는 기록이 ' + big + '건 있어요. (인정은 하루 50,000원까지)');
    const recentDays = proof.daily.filter((x) => x.n > 0).slice(-14);
    const maxed = recentDays.filter((x) => x.r >= R.DAILY_CAP).length;
    if (recentDays.length >= 7 && maxed / recentDays.length >= 0.8) {
      flag(flags, 'mid', 'alwaysMax', 'alwaysMax', '최근 ' + recentDays.length + '일 중 ' + maxed + '일을 하루 최대치(50,000원)로 채웠어요.');
    }
    const burst = maxInWindow(proof.recent.map((x) => Date.parse(x.at)), 10 * 60000);
    if (burst >= 10) flag(flags, 'mid', 'burst', 'burst', '10분 안에 절약 기록 ' + burst + '건을 연달아 남겼어요.');
    return flags;
  }

  /** 정렬된 시각 목록에서 window(ms) 안에 들어가는 최대 개수 */
  function maxInWindow(times, windowMs) {
    const t = times.filter(Number.isFinite).sort((a, b) => a - b);
    let best = 0;
    let j = 0;
    for (let i = 0; i < t.length; i++) {
      while (t[i] - t[j] > windowMs) j++;
      best = Math.max(best, i - j + 1);
    }
    return best;
  }

  /** 관리자가 허용하지 않은 항목만 */
  function openFlags(flags, mod) {
    const allow = (mod && mod.allow) || [];
    return flags.filter((f) => !allow.includes(f.key));
  }

  /** 'high' | 'mid' | 'ok' */
  function riskOf(flags) {
    if (flags.some((f) => f.level === 'high')) return 'high';
    if (flags.some((f) => f.level === 'mid')) return 'mid';
    return 'ok';
  }

  /**
   * 랭킹에 보일지: 관리자가 제외했거나, 허용하지 않은 'high' 항목이 있으면 숨겨요.
   * → { visible, reason: null | 'hidden' | 'auto', flags(열린 항목) }
   */
  function visibility(e, mod, ctx) {
    const flags = openFlags(publicCheck(e, ctx), mod);
    if (mod && mod.status === 'hidden') return { visible: false, reason: 'hidden', flags };
    if (flags.some((f) => f.level === 'high')) return { visible: false, reason: 'auto', flags };
    return { visible: true, reason: null, flags };
  }

  /* ------------------------------------------------------------------ *
   * 순위 계산
   * ------------------------------------------------------------------ */

  /** 연속 기록이 아직 이어지는지 (마지막 기록이 어제나 오늘, 시간대 차이 하루 허용) */
  function streakAlive(e, today) {
    if (!e.last) return false;
    const gap = U.dayDiff(e.last, today);
    return gap <= 1 && gap >= -1;
  }

  /** 순위에 쓰는 값 [주 값, 동점일 때 비교할 값] */
  function rankValue(e, cat, today) {
    switch (cat) {
      case 'week':
        return [e.week === U.weekStart(today) ? e.weekSaved : 0, e.total];
      case 'total':
        return [e.total, e.saveDays];
      case 'city':
        return [e.level, e.value];
      case 'streak':
        return [streakAlive(e, today) ? e.streak : 0, e.longest];
      default:
        return [0, 0];
    }
  }

  /**
   * players: [{ id, entry(normEntry 결과), mod(normMod 결과 또는 null) }]
   * → 보이는 사람만 순서대로 [{ id, entry, value, sub, rank }]. 같은 값이면 같은 순위 (1, 2, 2, 4)
   */
  function leaderboard(players, cat, ctx) {
    const rows = [];
    for (const p of players) {
      if (!visibility(p.entry, p.mod, ctx).visible) continue;
      const v = rankValue(p.entry, cat, ctx.today);
      rows.push({ id: p.id, entry: p.entry, value: v[0], sub: v[1] });
    }
    rows.sort((a, b) => b.value - a.value || b.sub - a.sub || a.entry.nick.localeCompare(b.entry.nick) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    rows.forEach((r, i) => {
      const prev = rows[i - 1];
      r.rank = prev && prev.value === r.value && prev.sub === r.sub ? prev.rank : i + 1;
    });
    return rows;
  }

  SC.rank = {
    FORMAT,
    CATS,
    CAT_MAP,
    MOD_REASONS,
    MOD_REASON_MAP,
    MOD_MESSAGE_MAX,
    PROOF_RECENT,
    PROOF_DAYS,
    SYNC_LOG_MAX,
    VALUE_PER_TOKEN,
    XP_PER_TOKEN,
    maxBonus,
    timeReversals,
    buildEntry,
    buildProof,
    contentHash,
    markJoined,
    markLeft,
    markSynced,
    normEntry,
    normProof,
    normMod,
    buildMod,
    publicCheck,
    auditPlayer,
    maxInWindow,
    openFlags,
    riskOf,
    visibility,
    streakAlive,
    rankValue,
    leaderboard,
  };
})(typeof window !== 'undefined' ? window : globalThis);
