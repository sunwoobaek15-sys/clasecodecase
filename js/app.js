/* SAVE CITY — 앱 뼈대: 상태 저장, 화면 전환, 공통 팝업, 축하 연출 */
(function (root) {
  'use strict';
  const SC = (root.SC = root.SC || {});
  const U = SC.util;
  const D = SC.data;
  const E = SC.engine;
  const ui = SC.ui;
  const V = SC.view;

  SC.screens = SC.screens || {};

  const ROUTES = ['home', 'save', 'city', 'shop', 'profile', 'history', 'achievements', 'stats', 'settings'];
  const NAV_OF = {
    home: 'home',
    save: 'save',
    city: 'city',
    shop: 'shop',
    profile: 'profile',
    history: 'history',
    achievements: 'achievements',
    stats: 'stats',
    settings: 'settings',
    record: 'history',
    edit: 'history',
  };
  const TAB_OF = { history: 'profile', achievements: 'profile', stats: 'profile', settings: 'profile' };

  const app = {
    state: null,
    d: null,
    route: { name: 'home', param: null },
    view: {
      cityRegion: 'village',
      citySlot: null,
      placing: null,
      zoom: false,
      shopTab: 'building',
      historyTab: 'records',
      historyQuery: '',
      historyLimit: 50,
      ledgerLimit: 100,
      achTab: 'list',
      saveDraft: null,
      editDraft: null,
    },
    actions: {},
    current: null,
    storageStatus: 'ok',
  };
  SC.app = app;

  /* ---------------- 저장 ---------------- */

  let warnedSave = false;
  function persist() {
    E.refresh(app.state, new Date());
    const ok = SC.storage.save(app.state);
    if (!ok && SC.storage.available && !warnedSave) {
      warnedSave = true;
      ui.toast('저장 공간이 부족해서 저장하지 못했어요. 사진이 많은 기록을 지우면 도움이 돼요.', { type: 'error', duration: 5000 });
    }
    if (ok) warnedSave = false;
    return ok;
  }
  app.persist = persist;

  /**
   * 상태를 바꾸는 모든 행동은 여기를 거칩니다. 실패하면 이전 상태로 되돌립니다.
   * fn(state, now) → 결과. GameError는 토스트로 안내합니다.
   */
  app.commit = function (fn, o) {
    o = o || {};
    const backup = JSON.stringify(app.state);
    try {
      const res = fn(app.state, new Date());
      persist();
      if (o.render !== false) app.render();
      return res || {};
    } catch (e) {
      app.state = JSON.parse(backup);
      if (e && e.name === 'GameError') {
        if (o.onError) o.onError(e);
        else {
          SC.audio.play('error');
          ui.toast(U.esc(e.message), { type: 'error' });
        }
        return null;
      }
      if (root.console) console.error(e);
      ui.toast('문제가 생겨서 처리하지 못했어요. 다시 시도해 주세요.', { type: 'error' });
      return null;
    }
  };

  /* ---------------- 화면 전환 ---------------- */

  function parseHash(h) {
    h = String(h || '').replace(/^#\/?/, '');
    const m = h.match(/^(record|edit)-([A-Za-z0-9_-]{1,64})$/);
    if (m) return { name: m[1], param: m[2] };
    return { name: ROUTES.includes(h) ? h : 'home', param: null };
  }
  function routeKey(r) {
    return r.param ? r.name + '-' + r.param : r.name;
  }

  app.navigate = function (name, param, o) {
    o = o || {};
    if (!SC.screens[name]) name = 'home';
    const r = { name, param: param || null };
    if (o.view) Object.assign(app.view, o.view);
    ui.closeAll();
    const changed = routeKey(r) !== routeKey(app.route);
    app.route = r;
    if (changed) {
      if (name !== 'city') app.view.placing = null;
      try {
        const h = '#' + routeKey(r);
        if (root.location.hash !== h) root.history.pushState(null, '', h);
      } catch (e) {
        /* 주소를 바꿀 수 없는 환경에서도 화면은 바뀝니다 */
      }
    }
    app.render({ scrollTop: changed || o.scrollTop });
  };

  function onLocationChange() {
    const r = parseHash(root.location.hash);
    if (routeKey(r) === routeKey(app.route)) return;
    ui.closeAll();
    app.route = r;
    app.view.placing = null;
    app.render({ scrollTop: true });
  }

  /* ---------------- 그리기 ---------------- */

  function renderChrome(d) {
    const s = app.state;
    document.querySelectorAll('[data-bind="token"]').forEach((el) => (el.textContent = U.fmt(d.balance)));
    document.querySelectorAll('[data-bind="streak"]').forEach((el) => (el.textContent = d.streak.current));
    document.querySelectorAll('[data-bind="level"]').forEach((el) => (el.textContent = d.cityLevel));
    document.querySelectorAll('[data-bind="nickname"]').forEach((el) => (el.textContent = s.user.nickname));
    document.querySelectorAll('[data-bind="avatar"]').forEach((el) => (el.textContent = s.user.avatar));
    const navKey = NAV_OF[app.route.name] || 'home';
    const tabKey = TAB_OF[navKey] || navKey;
    document.querySelectorAll('.tabbar [data-nav]').forEach((el) => {
      const on = el.dataset.nav === tabKey;
      el.classList.toggle('active', on);
      if (on) el.setAttribute('aria-current', 'page');
      else el.removeAttribute('aria-current');
    });
    document.querySelectorAll('.sidebar [data-nav]').forEach((el) => {
      const on = el.dataset.nav === navKey;
      el.classList.toggle('active', on);
      if (on) el.setAttribute('aria-current', 'page');
      else el.removeAttribute('aria-current');
    });
    const banner = document.getElementById('storage-banner');
    if (banner) banner.hidden = app.storageStatus !== 'unavailable';
  }

  app.render = function (o) {
    o = o || {};
    const now = new Date();
    const d = E.derive(app.state, now);
    app.d = d;
    renderChrome(d);
    let screen = SC.screens[app.route.name];
    if (!screen) {
      app.route = { name: 'home', param: null };
      screen = SC.screens.home;
    }
    const main = document.getElementById('screen');
    if (app.current && app.current.unmount) {
      try {
        app.current.unmount();
      } catch (e) {
        /* 무시 */
      }
    }
    const ctx = { state: app.state, d, app, param: app.route.param, view: app.view, now };
    main.innerHTML = screen.render(ctx);
    main.dataset.screen = app.route.name;
    app.current = screen;
    if (screen.mount) screen.mount(main, ctx);
    try {
      document.title = (screen.title ? screen.title(ctx) + ' · ' : '') + 'SAVE CITY';
    } catch (e) {
      /* 무시 */
    }
    if (o.scrollTop) {
      root.scrollTo(0, 0);
      try {
        main.focus({ preventScroll: true });
      } catch (e) {
        /* 무시 */
      }
    }
  };

  /** 화면 일부만 다시 그리기 (입력 중인 폼을 지우지 않도록) */
  app.refreshChrome = function () {
    app.d = E.derive(app.state, new Date());
    renderChrome(app.d);
  };

  /* ---------------- 공통 클릭 처리 ---------------- */

  document.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-nav]');
    if (nav && !nav.disabled) {
      e.preventDefault();
      SC.audio.play('tap');
      const view = {};
      if (nav.dataset.tab) {
        const t = nav.dataset.nav;
        if (t === 'shop') view.shopTab = nav.dataset.tab;
        if (t === 'history') view.historyTab = nav.dataset.tab;
        if (t === 'achievements') view.achTab = nav.dataset.tab;
      }
      if (nav.dataset.region) view.cityRegion = nav.dataset.region;
      app.navigate(nav.dataset.nav, nav.dataset.param || null, { view });
      return;
    }
    const act = e.target.closest('[data-action]');
    if (act && !act.disabled && act.getAttribute('aria-disabled') !== 'true') {
      const fn = app.actions[act.dataset.action];
      if (fn) {
        e.preventDefault();
        fn(act, e);
      }
    }
  });

  /* ---------------- 설정 적용 ---------------- */

  const darkQuery = root.matchMedia ? root.matchMedia('(prefers-color-scheme: dark)') : null;
  app.isDark = function () {
    const t = app.state.settings.theme;
    return t === 'dark' || (t === 'system' && !!(darkQuery && darkQuery.matches));
  };

  app.applySettings = function () {
    const s = app.state.settings;
    const html = document.documentElement;
    if (s.theme === 'system') html.removeAttribute('data-theme');
    else html.setAttribute('data-theme', s.theme);
    html.classList.toggle('no-anim', !s.animation);
    SC.audio.configure({ sound: s.sound, sfx: s.sfx });
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', app.isDark() ? '#0c1330' : '#2f6bff');
  };

  /* ---------------- 축하 / 이벤트 안내 ---------------- */

  /** 업적, 레벨업, 지역 해금, 새 아이템을 알려 줍니다. */
  app.celebrate = function (events, o) {
    o = o || {};
    if (!events || !events.length) return;
    const ach = events.filter((e) => e.type === 'achievement');
    const lvl = events.filter((e) => e.type === 'levelUp').pop();
    const regions = events.filter((e) => e.type === 'regionAvailable');
    const items = [];
    events.filter((e) => e.type === 'itemsUnlocked').forEach((e) => e.ids.forEach((id) => items.includes(id) || items.push(id)));
    const streaks = events.filter((e) => e.type === 'streakReward');

    const milestone = lvl && D.LEVEL_ROADMAP.some((r) => r.level > lvl.from && r.level <= lvl.to);
    if (lvl && !milestone && !regions.length && !items.length) {
      SC.audio.play('unlock');
      ui.toast('<b>도시 LEVEL ' + lvl.to + ' 달성!</b> 도시가 성장했어요.', { icon: '🏙️', type: 'success' });
    }
    if (milestone || regions.length || (lvl && items.length)) {
      let body = '<div class="levelup">';
      if (lvl) body += '<div class="levelup-badge"><span>CITY LEVEL</span><strong>' + lvl.to + '</strong></div><p class="levelup-text">도시가 성장했어요!</p>';
      const road = D.LEVEL_ROADMAP.filter((r) => lvl && r.level > lvl.from && r.level <= lvl.to);
      road.forEach((r) => (body += '<p class="levelup-road">🎉 <b>LV ' + r.level + ' ' + r.title + '</b> — ' + r.text + '</p>'));
      if (regions.length) {
        body += '<div class="levelup-section"><h3>새 지역을 열 수 있어요</h3>' + regions.map((r) => '<p>🗺️ ' + V.regionName(D.REGION_MAP[r.id]) + '</p>').join('') + '</div>';
      }
      if (items.length) {
        body += '<div class="levelup-section"><h3>새로 해금된 아이템</h3><div class="mini-items">' + items.map((id) => '<div class="mini-item">' + V.thumb(id, 1, app.state.skins.active) + '<span>' + D.ITEM_MAP[id].name + '</span></div>').join('') + '</div></div>';
      }
      if (ach.length && !o.skipAchievements) {
        body += '<div class="levelup-section"><h3>달성한 업적</h3>' + ach.map((a) => achLine(a)).join('') + '</div>';
      }
      body += '</div>';
      const actions = [];
      if (regions.length) actions.push({ label: '지역 열러 가기', kind: 'sun', onClick: () => app.navigate('city', null, { view: { cityRegion: regions[0].id } }) });
      else if (items.length) actions.push({ label: '상점 보기', kind: 'secondary', onClick: () => app.navigate('shop', null, { view: { shopTab: D.ITEM_MAP[items[0]].cat === 'special' ? 'decoration' : D.ITEM_MAP[items[0]].cat } }) });
      actions.push({ label: '좋아요', kind: 'primary' });
      SC.audio.play('unlock');
      ui.confetti(110);
      ui.open({ title: lvl ? '레벨 업!' : '새 지역 해금 가능', body, actions, className: 'dialog-celebrate' });
      return;
    }
    if (!o.skipAchievements) {
      ach.slice(0, 3).forEach((a, i) => {
        const def = D.ACHIEVEMENT_MAP[a.id];
        setTimeout(() => {
          SC.audio.play('unlock');
          ui.toast('<b>업적 달성: ' + def.name + '</b> ' + V.rewardText(a.reward), { icon: def.icon, type: 'success', action: { label: '보기', onClick: () => app.navigate('achievements', null, { view: { achTab: 'list' } }) } });
        }, i * 500);
      });
      if (ach.length > 3) ui.toast('업적 ' + (ach.length - 3) + '개를 더 달성했어요!', { icon: '🏅', type: 'success' });
    }
    if (!o.skipStreak) {
      streaks.forEach((s) => ui.toast('<b>' + s.days + '일 연속 기록 보상!</b> ' + V.rewardText(s.reward), { icon: '🔥', type: 'success' }));
    }
    if (items.length) {
      const names = items.map((id) => D.ITEM_MAP[id].name).join(', ');
      ui.toast('<b>새로 해금:</b> ' + U.esc(names), { icon: '🔓', type: 'success', action: { label: '상점', onClick: () => app.navigate('shop', null, { view: { shopTab: D.ITEM_MAP[items[0]].cat } }) } });
    }
  };

  function achLine(a) {
    const def = D.ACHIEVEMENT_MAP[a.id];
    return '<p class="ach-line"><span aria-hidden="true">' + def.icon + '</span> <b>' + def.name + '</b> <small>' + V.rewardText(a.reward) + '</small></p>';
  }
  app.achLine = achLine;

  /* ---------------- 공통 팝업 ---------------- */

  /** 기획서 21. 펀 요소: 첫 기록 보너스 고르기 */
  app.bonusChoicesHtml = function () {
    return (
      '<div class="bonus-grid">' +
      '<button type="button" class="bonus-card bonus-lucky" data-action="bonus:pick" data-choice="lucky"><span class="bonus-emoji" aria-hidden="true">🍀</span><strong>LUCKY BONUS!</strong><span>+' + D.RULES.LUCKY_BONUS + ' TOKEN</span></button>' +
      '<button type="button" class="bonus-card bonus-discount" data-action="bonus:pick" data-choice="discount"><span class="bonus-emoji" aria-hidden="true">🏷️</span><strong>CITY DISCOUNT!</strong><span>다음 건물 구매 비용 -' + D.RULES.DISCOUNT_PERCENT + '%</span></button>' +
      '</div>'
    );
  };

  app.openBonus = function () {
    if (!app.state.pendingBonuses.length) {
      ui.toast('받을 보너스가 없어요.', { type: 'info' });
      return;
    }
    ui.open({
      title: '오늘의 기록 보너스',
      body: '<div class="bonus-box"><p class="bonus-intro">절약 기록 보너스예요. 하나를 골라 주세요!</p>' + app.bonusChoicesHtml() + '</div>',
      className: 'dialog-bonus',
    });
  };

  app.actions['bonus:pick'] = function (btn) {
    const choice = btn.dataset.choice;
    const res = app.commit((s, now) => E.claimBonus(s, choice, now));
    if (!res) return;
    SC.audio.play('coin');
    const box = btn.closest('.bonus-box');
    const msg =
      choice === 'lucky'
        ? '<div class="bonus-done">🍀 <b>LUCKY BONUS!</b> TOKEN ' + D.RULES.LUCKY_BONUS + '개를 받았어요.</div>'
        : '<div class="bonus-done">🏷️ <b>CITY DISCOUNT!</b> 다음 건물을 ' + D.RULES.DISCOUNT_PERCENT + '% 싸게 살 수 있어요. (할인 쿠폰 ' + app.state.coupons + '장)</div>';
    if (box) box.innerHTML = msg;
    if (app.state.pendingBonuses.length && box) {
      box.insertAdjacentHTML('beforeend', '<p class="bonus-more">받지 않은 보너스가 ' + app.state.pendingBonuses.length + '개 더 있어요.</p>' + app.bonusChoicesHtml());
    }
    app.celebrate(res.events);
  };

  /** 기획서 16, 17. STREAK 안내 */
  app.openStreakInfo = function () {
    const d = app.d || E.derive(app.state, new Date());
    const cur = d.streak.current;
    const track = D.STREAK_TRACK.map((m) => {
      const reward = D.STREAK_REWARDS[m];
      const done = cur >= m;
      return '<li class="' + (done ? 'done' : '') + '"><span class="medal">' + (reward ? (reward.special ? '👑' : '🎁') : '🪙') + '</span><span>' + m + '일</span></li>';
    }).join('');
    const next = E.nextStreakMilestone(cur);
    ui.open({
      title: '연속 기록 STREAK',
      body:
        '<div class="streak-now big"><span aria-hidden="true">🔥</span><strong>' + cur + '일</strong> 연속 <small>최장 ' + d.longestStreak + '일</small></div>' +
        '<ol class="streak-track">' + track + '</ol>' +
        '<ul class="rule-list">' +
        '<li><b>7일 연속</b> → +100 TOKEN</li><li><b>14일 연속</b> → +250 TOKEN</li><li><b>30일 연속</b> → 특별 장식품 (황금 저금통)</li>' +
        '</ul>' +
        '<ul class="rule-list muted-list">' +
        '<li>하루에 여러 번 기록해도 STREAK은 하루 최대 +1만 늘어요.</li>' +
        '<li>기록이 없는 날이 생기면 STREAK이 0으로 돌아가요.</li>' +
        '<li>절약한 게 없는 날은 SAVE 화면의 <b>0원으로 오늘 기록하기</b>로 STREAK을 지킬 수 있어요. (TOKEN은 없어요)</li>' +
        '</ul>' +
        (next ? '<p class="hint">다음 목표: <b>' + next + '일</b> (' + (next - cur) + '일 남음)</p>' : '<p class="hint">모든 STREAK 목표를 달성했어요!</p>') +
        (d.streak.recordedToday ? '<p class="ok-line">✓ 오늘 기록 완료</p>' : ''),
      actions: d.streak.recordedToday ? [{ label: '확인', kind: 'primary' }] : [{ label: '오늘 기록하기', kind: 'sun', onClick: () => app.navigate('save') }, { label: '닫기', kind: 'secondary' }],
    });
  };

  /** 기획서 14. 도시 레벨 안내 */
  app.openLevelInfo = function () {
    const d = app.d || E.derive(app.state, new Date());
    const parts = d.xpParts.map((p) => '<tr><th scope="row">' + p.label + '</th><td>' + U.fmt(p.xp) + ' XP</td></tr>').join('');
    const road = D.LEVEL_ROADMAP.map((r) => '<li class="' + (d.cityLevel >= r.level ? 'done' : '') + '"><b>LV ' + r.level + '</b> ' + r.title + '<small>' + r.text + '</small></li>').join('');
    ui.open({
      title: '도시 LEVEL ' + d.cityLevel,
      body:
        ui.progressBar(d.level.pct, { label: '다음 레벨까지 진행률' }) +
        '<p class="hint">' + (d.level.next ? '다음 레벨까지 ' + U.fmt(d.level.toNext) + ' XP 남았어요. (현재 ' + U.fmt(d.xp) + ' XP)' : '최고 레벨이에요!') + '</p>' +
        '<p>도시 LEVEL은 <b>건물 수, 업그레이드, 도시 가치, 해금 지역, 업적</b>으로 올라가요.</p>' +
        '<div class="table-wrap"><table class="xp-table"><tbody>' + parts + '</tbody><tfoot><tr><th scope="row">합계</th><td>' + U.fmt(d.xp) + ' XP</td></tr></tfoot></table></div>' +
        '<h3 class="sub">레벨 로드맵</h3><ol class="roadmap">' + road + '</ol>',
      actions: [{ label: '확인', kind: 'primary' }],
    });
  };

  app.actions['app:streak'] = () => app.openStreakInfo();
  app.actions['app:level'] = () => app.openLevelInfo();
  app.actions['app:bonus'] = () => app.openBonus();

  /* ---------------- 처음 시작 안내 ---------------- */

  app.openOnboarding = function (again) {
    const avatars = D.AVATARS.map(
      (a, i) => '<label class="avatar-opt"><input type="radio" name="ob-avatar" value="' + a + '"' + (a === app.state.user.avatar || (!i && !D.AVATARS.includes(app.state.user.avatar)) ? ' checked' : '') + '><span>' + a + '</span></label>'
    ).join('');
    let started = false;
    const start = (dialog) => {
      if (started) return;
      started = true;
      const nick = dialog ? dialog.querySelector('#ob-nick').value : '';
      const av = dialog ? (dialog.querySelector('input[name="ob-avatar"]:checked') || {}).value : null;
      const patch = {};
      if (U.cleanText(nick, D.RULES.NICK_MAX)) patch.nickname = nick;
      if (av) patch.avatar = av;
      app.commit((s, now) => E.completeOnboarding(s, patch, now));
    };
    ui.open({
      title: again ? '게임 방법' : 'SAVE CITY에 오신 걸 환영해요!',
      className: 'dialog-onboard',
      body:
        '<p class="ob-lead">돈을 아끼는 행동을 할수록 게임 속 도시가 자라요.</p>' +
        '<ol class="ob-steps">' +
        '<li><span class="ob-ic" aria-hidden="true">💰</span><div><b>현실에서 절약해요</b><small>사고 싶던 걸 참거나 더 싸게 해결했나요?</small></div></li>' +
        '<li><span class="ob-ic" aria-hidden="true">📝</span><div><b>SAVE에 기록해요</b><small>1,000원 = 10 TOKEN · 하루 최대 50,000원(500 TOKEN)까지 인정</small></div></li>' +
        '<li><span class="ob-ic" aria-hidden="true">🏙️</span><div><b>TOKEN으로 도시를 지어요</b><small>건물을 짓고 업그레이드하면 도시 LEVEL이 올라가요</small></div></li>' +
        '<li><span class="ob-ic" aria-hidden="true">🏆</span><div><b>업적과 새 지역을 모아요</b><small>매일 기록하면 STREAK 보상도 받아요</small></div></li>' +
        '</ol>' +
        (again
          ? ''
          : '<div class="field"><label for="ob-nick">닉네임 <span class="opt">(선택, 최대 ' + D.RULES.NICK_MAX + '자)</span></label><input id="ob-nick" class="input" maxlength="' + D.RULES.NICK_MAX + '" placeholder="시민" autocomplete="nickname"></div>' +
            '<div class="field"><span class="label">캐릭터</span><div class="avatar-grid" role="radiogroup" aria-label="캐릭터">' + avatars + '</div></div>') +
        '<p class="fineprint">TOKEN은 게임 속 포인트예요. 실제 돈이 아니고, 돈으로 바꾸거나 충전할 수 없어요.</p>',
      actions: [{ label: again ? '확인' : '시작하기', kind: 'sun', block: true, onClick: (close, dialog) => (again ? undefined : start(dialog)) }],
      onClose: () => {
        if (!again && !started) start(null);
      },
    });
  };

  /* ---------------- 날짜 변경, 다른 창, 시작 ---------------- */

  function checkDay() {
    if (!app.state || !app.d) return;
    if (U.dateKey(new Date()) !== app.d.today) {
      const res = E.settleOnLoad(app.state, new Date());
      persist();
      if (!ui.hasOpen() && !(app.current && app.current.keepOnTick)) app.render();
      else app.refreshChrome();
      app.celebrate(res.events);
    }
  }

  function reloadFromStorage() {
    const loaded = SC.storage.load();
    if (loaded.status !== 'ok') return;
    app.state = E.normalizeState(loaded.raw, new Date());
    app.applySettings();
    if (!ui.hasOpen()) app.render();
    else app.refreshChrome();
    ui.toast('다른 창에서 바뀐 내용을 불러왔어요.', { type: 'info' });
  }

  function registerServiceWorker() {
    try {
      if (!('serviceWorker' in navigator)) return;
      const host = root.location.hostname;
      if (root.location.protocol !== 'https:' && host !== 'localhost' && host !== '127.0.0.1') return;
      if (root.top !== root.self) return;
      navigator.serviceWorker.register('sw.js').catch(() => {});
    } catch (e) {
      /* 지원하지 않는 환경 */
    }
  }

  app.start = function (hotData) {
    hotData = hotData || {};
    SC.storage.init();
    const loaded = SC.storage.load();
    const now = new Date();
    app.storageStatus = loaded.status;
    if (loaded.status === 'ok') app.state = E.normalizeState(loaded.raw, now);
    else {
      app.state = E.createState(now);
      const reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) app.state.settings.animation = false;
    }
    const res = E.settleOnLoad(app.state, now);
    persist();
    app.applySettings();
    if (hotData.view) Object.assign(app.view, hotData.view, { saveDraft: null, editDraft: null, placing: null });
    app.route = parseHash(hotData.route ? '#' + hotData.route : root.location.hash);
    app.render();

    root.addEventListener('hashchange', onLocationChange);
    root.addEventListener('popstate', onLocationChange);
    root.addEventListener('storage', (e) => {
      if (e.key === SC.storage.KEY) reloadFromStorage();
    });
    document.addEventListener('visibilitychange', () => {
      SC.audio.syncVisibility();
      if (document.visibilityState === 'visible') checkDay();
    });
    setInterval(checkDay, 30000);
    if (darkQuery && darkQuery.addEventListener) {
      darkQuery.addEventListener('change', () => {
        app.applySettings();
        if (app.route.name === 'settings') app.render();
      });
    }
    const unlockAudio = () => {
      SC.audio.unlock();
      root.removeEventListener('pointerdown', unlockAudio, true);
      root.removeEventListener('keydown', unlockAudio, true);
    };
    root.addEventListener('pointerdown', unlockAudio, true);
    root.addEventListener('keydown', unlockAudio, true);

    if (loaded.status === 'unavailable') {
      ui.toast('이 브라우저에서는 저장 기능이 꺼져 있어요. 창을 닫으면 기록이 사라질 수 있어요.', { type: 'error', duration: 6000 });
    } else if (loaded.status === 'corrupt') {
      ui.toast('저장된 데이터를 읽을 수 없어서 새로 시작했어요. 이전 데이터는 따로 보관했어요.', { type: 'error', duration: 6000 });
    }
    if (!app.state.user.onboarded) app.openOnboarding(false);
    else app.celebrate(res.events);

    SC.images.probe().then((ok) => {
      if (ok) SC.images.prune(app.state.history.filter((r) => r.hasImage).map((r) => r.id));
      if (app.route.name === 'save' || app.route.name === 'edit' || app.route.name === 'record') {
        if (app.current && app.current.onImagesReady) app.current.onImagesReady(ok);
      }
    });
    registerServiceWorker();

    const hot = root.claude && root.claude.hot;
    if (hot && typeof hot.snapshot === 'function') {
      try {
        hot.snapshot(() => ({
          route: routeKey(app.route),
          view: { cityRegion: app.view.cityRegion, shopTab: app.view.shopTab, historyTab: app.view.historyTab, achTab: app.view.achTab, zoom: app.view.zoom },
        }));
      } catch (e) {
        /* 무시 */
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
