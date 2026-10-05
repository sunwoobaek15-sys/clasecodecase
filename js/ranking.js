/* SAVE CITY — 공유 랭킹 연결
 * Claude 아티팩트로 열었을 때만 켜져요. (공유 데이터베이스 db, 보는 사람 정보 user 기능 사용)
 * 파일로 열거나 GitHub Pages로 열면 window.claude가 없어서 랭킹 메뉴가 나타나지 않아요.
 */
(function (root) {
  'use strict';
  const SC = root.SC;
  const U = SC.util;
  const K = SC.rank;

  const SYNC_DELAY = 2500;
  const LIST_LIMIT = 1000;
  const RETRY_LATER_MS = 30000;

  const rk = {
    status: 'none', // none: 기능 없음 | loading: 연결 중 | ready: 사용 가능 | off: 이 화면에서는 쓸 수 없음
    db: null,
    user: null,
    me: null,
    isOwner: false,
    canWrite: null, // true | false | null(알 수 없음 → 써 보고 판단)
    writeBlocked: false,
    players: new Map(), // id → { id, entry }
    mods: new Map(), // id → 판정
    proofs: new Map(), // id → 상세 기록 (관리자만)
    loaded: { ranking: false, mod: false, proofs: false },
    listenError: null,
    syncing: false,
    syncError: null,
    again: false,
  };

  const listeners = [];
  const entryCache = new WeakMap();
  const proofCache = new WeakMap();
  const unsubs = {};
  const resubscribes = {};
  let syncTimer = null;
  let retryTimer = null;
  let notifyTimer = null;
  let proofsWanted = false;

  function app() {
    return SC.app;
  }

  function changed() {
    if (notifyTimer) return;
    notifyTimer = setTimeout(() => {
      notifyTimer = null;
      listeners.forEach((fn) => {
        try {
          fn();
        } catch (e) {
          if (root.console) console.error(e);
        }
      });
    }, 120);
  }

  function code(e) {
    return (e && typeof e.code === 'string' && e.code) || 'unavailable';
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /** 쓰기 한 번. 잠깐 끊긴 경우(unavailable)에만 한 번 더 시도해요. */
  async function write(fn) {
    try {
      return await fn();
    } catch (e) {
      if (code(e) !== 'unavailable') throw e;
      await wait(400 + Math.random() * 800);
      return fn();
    }
  }

  /* ---------------- 구독 ---------------- */

  function readEntry(doc) {
    const data = doc.data();
    if (!data) return null;
    let e = entryCache.get(data);
    if (!e) {
      e = K.normEntry(data);
      entryCache.set(data, e);
    }
    return e;
  }

  function listenError(name, e) {
    const c = code(e);
    if (c === 'revoked' || c === 'not_granted' || c === 'capability_disabled' || c === 'capability_removed') {
      rk.status = 'off';
      changed();
      return;
    }
    rk.listenError = c;
    changed();
    // 연결이 끊긴 구독은 새로 만드는 수밖에 없어요. (몇 번만)
    if ((c === 'unavailable' || c === 'queue_overflow') && (resubscribes[name] || 0) < 3) {
      resubscribes[name] = (resubscribes[name] || 0) + 1;
      unsubs[name] = null;
      setTimeout(() => subscribe(name), 5000 * resubscribes[name]);
    }
  }

  function subscribe(name) {
    if (rk.status !== 'ready' || !rk.db) return;
    if (unsubs[name]) unsubs[name]();
    const q = rk.db.collection(name).limit(LIST_LIMIT);
    unsubs[name] = q.onSnapshot(
      (snap) => {
        rk.listenError = null;
        if (name === 'ranking') {
          const next = new Map();
          snap.docs.forEach((doc) => {
            const e = doc.exists && readEntry(doc);
            if (e) next.set(doc.id, { id: doc.id, entry: e });
          });
          rk.players = next;
        } else if (name === 'mod') {
          const next = new Map();
          snap.docs.forEach((doc) => {
            const m = doc.exists && K.normMod(doc.data());
            if (m) next.set(doc.id, m);
          });
          rk.mods = next;
          noticeMyMod();
        } else if (name === 'proofs') {
          const next = new Map();
          snap.docs.forEach((doc) => {
            const data = doc.exists && doc.data();
            if (!data) return;
            let p = proofCache.get(data);
            if (p === undefined) {
              p = K.normProof(data);
              proofCache.set(data, p);
            }
            if (p) next.set(doc.id, p);
          });
          rk.proofs = next;
        }
        rk.loaded[name] = true;
        changed();
      },
      (e) => listenError(name, e)
    );
  }

  /* ---------------- 시작 ---------------- */

  async function init() {
    const claude = root.claude;
    if (!claude || typeof claude.use !== 'function') {
      rk.status = 'none';
      return;
    }
    rk.status = 'loading';
    changed();
    let db = null;
    let user = null;
    try {
      [db, user] = await Promise.all([claude.use('db'), claude.use('user')]);
    } catch (e) {
      db = null;
    }
    if (!db) {
      rk.status = 'off';
      changed();
      return;
    }
    rk.db = db;
    rk.user = user;
    if (user) {
      try {
        const [id, owner, can] = await Promise.all([user.id(), user.isOwner(), user.can('data.write')]);
        rk.me = SC.engine.validUid(id) ? id : null;
        rk.isOwner = owner === true;
        rk.canWrite = can === true ? true : can === false ? false : null;
      } catch (e) {
        /* 읽기 실패는 '모름'으로 둡니다 */
      }
    }
    rk.status = 'ready';
    subscribe('ranking');
    subscribe('mod');
    if (rk.isOwner || proofsWanted) ensureProofs();
    changed();
    // 참가 중이면 이 기기의 최신 데이터로 맞춰 둡니다 (바뀐 것이 있을 때만 올려요).
    if (joined()) schedule(800);
  }

  /** 상세 기록은 관리자만 구독해요. (다른 사람은 규칙상 읽을 수도 없어요) */
  function ensureProofs() {
    proofsWanted = true;
    if (rk.status === 'ready' && rk.isOwner && !unsubs.proofs) subscribe('proofs');
  }

  /* ---------------- 내 상태 ---------------- */

  function joined() {
    const s = app() && app().state;
    return !!(s && s.ranking.joined && rk.me && s.ranking.uid === rk.me);
  }

  function ctx() {
    return { today: U.dateKey(new Date()), nowMs: Date.now() };
  }

  function players() {
    const out = [];
    rk.players.forEach((p) => out.push({ id: p.id, entry: p.entry, mod: rk.mods.get(p.id) || null }));
    return out;
  }

  function board(cat) {
    return K.leaderboard(players(), cat, ctx());
  }

  /** 내 랭킹 정보: 참가 여부, 올라간 카드, 보이는지, 관리자 판정, 순위 */
  function mine(cat) {
    const p = rk.me ? rk.players.get(rk.me) : null;
    const mod = rk.me ? rk.mods.get(rk.me) || null : null;
    const out = { joined: joined(), entry: p ? p.entry : null, mod, vis: null, rank: null, count: 0 };
    if (p) out.vis = K.visibility(p.entry, mod, ctx());
    const rows = board(cat || 'week');
    out.count = rows.length;
    const row = rows.find((r) => r.id === rk.me);
    if (row) out.rank = row.rank;
    return out;
  }

  /** 관리자에게 보낸 판정이 바뀌었으면 한 번 알려 줘요. */
  function noticeMyMod() {
    const a = app();
    if (!a || !a.state || !joined()) return;
    const m = rk.mods.get(rk.me);
    if (!m || !m.at || m.at === a.state.ranking.seenMod) return;
    const first = !a.state.ranking.seenMod;
    a.state.ranking.seenMod = m.at;
    a.persist();
    if (first && m.status === 'ok') return;
    const reason = m.reason ? K.MOD_REASON_MAP[m.reason].label : '';
    const msg = m.message ? ' — ' + U.esc(m.message) : '';
    if (m.status === 'warned') SC.ui.toast('<b>랭킹 관리자 경고</b> ' + U.esc(reason) + msg, { type: 'error', icon: '⚠️', duration: 8000, action: { label: '보기', onClick: () => a.navigate('ranking') } });
    else if (m.status === 'hidden') SC.ui.toast('<b>랭킹에서 제외됐어요</b> ' + U.esc(reason) + msg, { type: 'error', icon: '🚫', duration: 8000, action: { label: '보기', onClick: () => a.navigate('ranking') } });
    else SC.ui.toast('<b>랭킹 관리자가 정상으로 확인했어요.</b>', { type: 'success', icon: '✅' });
  }

  /* ---------------- 동기화 ---------------- */

  /** 게임 데이터가 바뀐 뒤 잠시 기다렸다가 한 번에 올려요. */
  function schedule(ms) {
    if (rk.status !== 'ready' || !joined()) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => syncNow(), ms == null ? SYNC_DELAY : ms);
  }

  /** → true(올림 또는 바뀐 것 없음) | false(실패) */
  async function syncNow(o) {
    o = o || {};
    const a = app();
    if (rk.status !== 'ready' || !joined()) return false;
    if (rk.syncing) {
      rk.again = true;
      return false;
    }
    clearTimeout(syncTimer);
    const now = new Date();
    const entry = K.buildEntry(a.state, now);
    const proof = K.buildProof(a.state, now);
    const h = K.contentHash(entry, proof);
    // 바뀐 것이 없으면 쓰지 않아요. (랭킹에서 내 카드가 지워졌을 때만 다시 올려요)
    if (!o.force && h === a.state.ranking.lastHash && (!rk.loaded.ranking || rk.players.has(rk.me))) return true;
    rk.syncing = true;
    changed();
    try {
      // 상세 기록을 먼저 올려야 관리자가 랭킹 카드와 함께 볼 수 있어요.
      await write(() => rk.db.doc('proofs/' + rk.me).set(proof));
      await write(() => rk.db.doc('ranking/' + rk.me).set(entry));
      K.markSynced(a.state, h, now);
      a.persist();
      rk.syncError = null;
      return true;
    } catch (e) {
      rk.syncError = code(e);
      if (rk.syncError === 'invalid_argument') rk.writeBlocked = true;
      if (rk.syncError === 'revoked') rk.status = 'off';
      if (rk.syncError === 'resource_exhausted' || rk.syncError === 'unavailable') {
        clearTimeout(retryTimer);
        retryTimer = setTimeout(() => schedule(0), RETRY_LATER_MS);
      }
      return false;
    } finally {
      rk.syncing = false;
      changed();
      if (rk.again) {
        rk.again = false;
        schedule();
      }
    }
  }

  /** 오류 코드를 사람이 읽는 문장으로 */
  function errorText(c) {
    switch (c) {
      case 'invalid_argument':
        return '이 공유 권한으로는 랭킹에 기록을 올릴 수 없어요. 게시자에게 참여(Contributor) 이상 권한을 요청해 주세요.';
      case 'quota_exceeded':
        return '랭킹 저장 공간이 가득 찼어요. 관리자에게 알려 주세요.';
      case 'resource_exhausted':
        return '요청이 너무 많아요. 잠시 뒤에 자동으로 다시 시도할게요.';
      case 'revoked':
        return '이 화면의 랭킹 사용 권한이 바뀌었어요. 페이지를 새로 열어 주세요.';
      default:
        return '랭킹 서버에 연결하지 못했어요. 잠시 뒤에 다시 시도할게요.';
    }
  }

  /** 참가할 수 없는 이유 (없으면 '') */
  function joinBlockReason() {
    if (rk.status !== 'ready') return '지금은 랭킹을 쓸 수 없어요.';
    if (!rk.me) return 'Claude에 로그인한 계정에서만 랭킹에 참가할 수 있어요.';
    if (rk.canWrite === false || rk.writeBlocked) return '보기 전용 권한이라 랭킹을 볼 수만 있어요. 참가하려면 게시자에게 참여(Contributor) 이상 권한을 요청해 주세요.';
    return '';
  }

  async function join() {
    const a = app();
    const block = joinBlockReason();
    if (block) throw new Error(block);
    const res = a.commit((s, now) => K.markJoined(s, rk.me, now), { render: false });
    if (!res) throw new Error('참가 정보를 저장하지 못했어요.');
    const ok = await syncNow({ force: true });
    if (!ok) {
      a.commit((s) => K.markLeft(s), { render: false });
      throw new Error(errorText(rk.syncError));
    }
    return true;
  }

  /** 내 랭킹 카드와 상세 기록을 지우고 참가를 그만둬요. */
  async function leave() {
    const a = app();
    if (rk.status !== 'ready' || !rk.me) throw new Error('지금은 랭킹에 연결되어 있지 않아요.');
    clearTimeout(syncTimer);
    try {
      await write(() => rk.db.doc('ranking/' + rk.me).delete());
      await write(() => rk.db.doc('proofs/' + rk.me).delete());
    } catch (e) {
      throw new Error(errorText(code(e)));
    }
    if (a.state.ranking.joined) a.commit((s) => K.markLeft(s), { render: false });
    changed();
    return true;
  }

  /** 기기 시계가 뒤로 간 것을 찾았을 때 (참가 중일 때만 알려요) */
  function onClockEvent(ev) {
    if (!joined()) return;
    SC.ui.toast('기기 시계가 ' + U.fmt(ev.back) + '분 뒤로 바뀐 것을 확인했어요. 랭킹 관리자에게 표시돼요.', { type: 'error', icon: '⏰', duration: 6000 });
    schedule();
  }

  /* ---------------- 관리자 ---------------- */

  async function setMod(id, status, o) {
    if (!rk.isOwner) throw new Error('관리자만 할 수 있어요.');
    const doc = K.buildMod(rk.mods.get(id) || null, status, o, new Date());
    try {
      await write(() => rk.db.doc('mod/' + id).set(doc));
    } catch (e) {
      throw new Error(errorText(code(e)));
    }
    return doc;
  }

  /** 그만둔 사람의 랭킹 카드·상세 기록 정리 */
  async function removePlayer(id) {
    if (!rk.isOwner) throw new Error('관리자만 할 수 있어요.');
    try {
      await write(() => rk.db.doc('ranking/' + id).delete());
      await write(() => rk.db.doc('proofs/' + id).delete());
    } catch (e) {
      throw new Error(errorText(code(e)));
    }
  }

  /** 관리자 화면용 플레이어 목록 (위험도 포함) */
  function audits() {
    const c = ctx();
    return players().map((p) => {
      const proof = rk.loaded.proofs ? rk.proofs.get(p.id) || null : undefined;
      const all = K.auditPlayer(p.entry, proof, c);
      const flags = K.openFlags(all, p.mod);
      const vis = K.visibility(p.entry, p.mod, c);
      return { id: p.id, entry: p.entry, mod: p.mod, proof, flags, allFlags: all, risk: K.riskOf(flags), vis };
    });
  }

  /** 확인이 필요한(자동 숨김된) 참가자 수. 이미 제외한 사람은 빼요. */
  function reviewCount() {
    return audits().filter((a) => a.risk === 'high' && !(a.mod && a.mod.status === 'hidden')).length;
  }

  /** Claude 계정 이름 (보는 사람마다 다를 수 있어 저장하지 않고 그릴 때마다 물어봐요) */
  async function names(ids) {
    if (!rk.user || !ids.length || typeof rk.user.profiles !== 'function') return {};
    try {
      const ps = await rk.user.profiles(ids);
      const out = {};
      ids.forEach((id) => (out[id] = (ps && ps[id] && ps[id].name) || ''));
      return out;
    } catch (e) {
      return {};
    }
  }

  /** 사이드바처럼 처음부터 있는 메뉴를 기능 상태에 맞게 보이거나 숨겨요. */
  function updateChrome() {
    if (typeof document === 'undefined') return;
    const on = rk.status === 'ready';
    document.querySelectorAll('[data-feature="ranking"]').forEach((el) => (el.hidden = !on));
    document.querySelectorAll('[data-feature="admin"]').forEach((el) => (el.hidden = !(on && rk.isOwner)));
  }

  SC.ranking = {
    get status() {
      return rk.status;
    },
    get me() {
      return rk.me;
    },
    get isOwner() {
      return rk.isOwner;
    },
    get syncing() {
      return rk.syncing;
    },
    get syncError() {
      return rk.syncError;
    },
    get listenError() {
      return rk.listenError;
    },
    get loaded() {
      return rk.loaded;
    },
    available: () => rk.status === 'ready',
    init,
    onChange: (fn) => listeners.push(fn),
    joined,
    players,
    board,
    mine,
    schedule,
    syncNow,
    join,
    leave,
    joinBlockReason,
    errorText,
    onClockEvent,
    ensureProofs,
    setMod,
    removePlayer,
    audits,
    reviewCount,
    names,
    updateChrome,
  };
})(window);
