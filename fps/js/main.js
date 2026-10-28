/* SECTOR ZERO — 시작: 메뉴 화면, 설정, 결과 화면을 게임과 이어요 */
(function (root) {
  'use strict';
  const SZ = root.SZ;
  const $ = (id) => document.getElementById(id);
  const SCREENS = ['s-title', 's-pause', 's-over', 's-settings', 's-error', 's-upgrade'];
  const fmt = (n) => Math.round(n).toLocaleString('ko-KR');
  let settingsBack = 's-title';
  let pausedAt = 0;
  let upgradeAt = 0;

  function showScreen(id) {
    SCREENS.forEach((s) => ($(s).hidden = s !== id));
    const first = id && $(id).querySelector('.btn.primary');
    if (first && !SZ.input.touch) first.focus({ preventScroll: true });
  }

  function renderBest() {
    const b = SZ.game.store.best;
    const el = $('best');
    el.textContent = '';
    if (!b) {
      el.textContent = '최고 기록 없음 · 첫 작전을 시작하세요';
      return;
    }
    el.append('최고 기록 ');
    const strong = document.createElement('b');
    strong.textContent = fmt(b.score) + '점';
    el.append(strong, ' · 웨이브 ' + b.wave + ' · 처치 ' + (b.kills || 0));
  }

  function renderResult(r) {
    $('r-score').textContent = fmt(r.score);
    $('r-wave').textContent = String(r.wave);
    $('r-kills').textContent = String(r.kills);
    $('r-crits').textContent = String(r.crits);
    $('r-acc').textContent = Math.round(r.accuracy * 100) + '%';
    const sec = Math.floor(r.time);
    $('r-time').textContent = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
    $('r-record').textContent = fmt(SZ.game.store.best ? SZ.game.store.best.score : r.score);
    $('r-best').hidden = !r.best;
    upgradeSummary($('r-upg'), r.upgrades);
  }

  /* ---------- 강화 ---------- */
  /** 고른 강화 목록: "강화 탄두 2 · 빠른 손" */
  function upgradeSummary(el, ids) {
    el.textContent = '';
    if (!ids || !ids.length) return;
    const count = {};
    ids.forEach((id) => (count[id] = (count[id] || 0) + 1));
    el.append('강화 ');
    Object.keys(count).forEach((id, i) => {
      if (i) el.append(' · ');
      const b = document.createElement('b');
      b.textContent = SZ.rules.UPGRADE_BY_ID[id].name + (count[id] > 1 ? ' ' + count[id] : '');
      el.append(b);
    });
  }

  function renderUpgrade() {
    const game = SZ.game;
    const offer = game.offer || [];
    const lv = game.player.upg;
    $('up-eyebrow').textContent = '웨이브 ' + game.waveNumber() + ' 클리어';
    const box = $('up-cards');
    box.textContent = '';
    offer.forEach((u, i) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'up-card ' + u.cat;
      card.dataset.i = String(i);
      const key = document.createElement('kbd');
      key.className = 'up-key';
      key.textContent = String(i + 1);
      const cat = document.createElement('span');
      cat.className = 'up-cat';
      cat.textContent = SZ.rules.UPGRADE_CATS[u.cat];
      const name = document.createElement('b');
      name.className = 'up-name';
      name.textContent = u.name;
      const desc = document.createElement('span');
      desc.className = 'up-desc';
      desc.textContent = u.desc;
      const pips = document.createElement('span');
      pips.className = 'up-pips';
      pips.setAttribute('aria-label', '단계 ' + ((lv[u.id] || 0) + 1) + ' / ' + u.max);
      for (let k = 0; k < u.max; k++) {
        const pip = document.createElement('i');
        if (k < (lv[u.id] || 0)) pip.className = 'on';
        else if (k === (lv[u.id] || 0)) pip.className = 'next';
        pips.append(pip);
      }
      card.append(key, cat, name, desc, pips);
      box.append(card);
    });
  }

  /** 강화 고르기 (화면이 뜨자마자 누른 클릭·키는 무시해요: 쏘던 손이 잘못 고르지 않게) */
  function chooseUpgrade(i) {
    if (Date.now() - upgradeAt < 600) return;
    if (!SZ.game.pickUpgrade(i)) return;
    showScreen(null);
    // 마우스 잠금이 응답 없이 끝나면 멈춘 화면에 갇히지 않게 일시정지 화면을 보여 줘요
    setTimeout(() => {
      if (SZ.game.state === 'upgrade' && !SZ.game.offer) SZ.game.pause();
    }, 1500);
  }

  /* ---------- 설정 ---------- */
  function syncSettings() {
    const s = SZ.game.store.settings;
    $('set-sens').value = s.sens;
    $('set-volume').value = s.volume;
    $('set-fov').value = s.fov;
    $('set-quality').value = s.quality;
    $('set-invert').checked = s.invertY;
    $('set-orient').value = s.orient;
    $('out-sens').textContent = Number(s.sens).toFixed(1);
    $('out-volume').textContent = Math.round(s.volume * 100) + '%';
    $('out-fov').textContent = s.fov + '°';
  }
  function readSettings() {
    const s = SZ.game.store.settings;
    s.sens = Number($('set-sens').value);
    s.volume = Number($('set-volume').value);
    s.fov = Number($('set-fov').value);
    s.quality = $('set-quality').value;
    s.invertY = $('set-invert').checked;
    s.orient = $('set-orient').value;
    SZ.audio.setVolume(s.volume);
    SZ.game.autoScale = 1;
    SZ.game.saveStore();
    syncSettings();
    applyOrientation();
  }
  function openSettings(back) {
    settingsBack = back;
    syncSettings();
    showScreen('s-settings');
  }

  /**
   * 휴대폰을 세워 들었을 때(앱이 세로로 고정된 경우 포함) 게임 전체를 90° 돌려 가로 화면으로 보여 줘요.
   * 기기를 실제로 눕혀서 화면이 가로가 되면 돌리지 않아요.
   */
  function applyOrientation() {
    const app = $('app');
    const mode = SZ.game.store.settings.orient;
    const W = root.innerWidth, H = root.innerHeight;
    const rotate = SZ.input.touch && mode !== 'off' && H > W;
    document.body.classList.toggle('rotated', rotate);
    // 높이가 낮은 가로 화면(돌린 화면 포함): 메뉴를 촘촘하게
    document.body.classList.toggle('short', (rotate ? W : H) <= 460);
    if (rotate) {
      app.style.width = H + 'px';
      app.style.height = W + 'px';
      app.style.transform = mode === 'left' ? 'translate(' + W + 'px, 0) rotate(90deg)' : 'translate(0, ' + H + 'px) rotate(-90deg)';
    } else {
      app.style.width = app.style.height = app.style.transform = '';
    }
    SZ.input.rotation = rotate ? (mode === 'left' ? 90 : -90) : 0;
    $('rot-side').textContent = mode === 'right' ? '오른쪽' : '왼쪽';
    SZ.game.resize();
  }

  /** 휴대폰: 전체 화면 + 가로 고정을 시도해요 (안 되는 브라우저는 화면을 돌려서 보여 줘요) */
  function tryFullscreen() {
    const d = document.documentElement;
    if (!SZ.input.touch || document.fullscreenElement || !d.requestFullscreen) return;
    const lock = () => {
      const o = root.screen && root.screen.orientation;
      if (SZ.game.store.settings.orient === 'off' || !o || !o.lock) return;
      try {
        const p = o.lock('landscape');
        if (p && p.catch) p.catch(() => {});
      } catch (e) {
        /* 가로 고정은 없어도 돼요 */
      }
    };
    try {
      const p = d.requestFullscreen({ navigationUI: 'hide' });
      if (p && p.then) p.then(lock, () => {});
    } catch (e) {
      /* 전체 화면은 없어도 돼요 */
    }
  }

  function boot() {
    const game = SZ.game;
    game.onStateChange = (s) => {
      document.body.dataset.state = s;
      if (s === 'title') {
        renderBest();
        showScreen('s-title');
      } else if (s === 'playing' || s === 'dying') showScreen(null);
      else if (s === 'paused') {
        pausedAt = Date.now();
        $('pause-hint').textContent = '';
        showScreen('s-pause');
      } else if (s === 'over') {
        renderResult(game.result);
        showScreen('s-over');
      } else if (s === 'upgrade') {
        upgradeAt = Date.now();
        renderUpgrade();
        showScreen('s-upgrade');
      }
      if (s === 'paused') upgradeSummary($('pause-upg'), game.upgradesTaken());
      $('touch').hidden = !(SZ.input.touch && s === 'playing');
    };
    game.onLockRetry = () => {
      if (game.state === 'playing' || (game.state === 'upgrade' && !game.offer)) game.pause();
      $('pause-hint').textContent = '마우스를 잠그지 못했어요. 잠시 후 계속하기를 다시 눌러 주세요.';
    };
    SZ.input.onTouchStart = () => {
      document.body.classList.add('touch');
      applyOrientation();
      game.onStateChange(game.state);
    };

    let ok = false;
    try {
      ok = game.init({ canvas: $('view'), touchRoot: $('touch') });
    } catch (e) {
      console.error(e);
      ok = false;
    }
    if (!ok) {
      document.body.dataset.state = 'error';
      showScreen('s-error');
      return;
    }
    if (SZ.input.touch) document.body.classList.add('touch');
    applyOrientation();
    $('view').addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      document.body.dataset.state = 'error';
      $('s-error').querySelector('.body').textContent = '그래픽 장치가 초기화됐어요. 페이지를 새로 고침해 주세요.';
      showScreen('s-error');
    });

    $('b-start').addEventListener('click', () => {
      tryFullscreen();
      game.start();
    });
    $('b-settings').addEventListener('click', () => openSettings('s-title'));
    $('b-resume').addEventListener('click', () => {
      tryFullscreen();
      game.resume();
    });
    $('b-pause-settings').addEventListener('click', () => openSettings('s-pause'));
    $('b-quit').addEventListener('click', () => game.quit());
    $('b-retry').addEventListener('click', () => {
      tryFullscreen();
      game.start();
    });
    $('b-menu').addEventListener('click', () => game.quit());
    $('up-cards').addEventListener('click', (e) => {
      const card = e.target.closest('.up-card');
      if (card) chooseUpgrade(Number(card.dataset.i));
    });
    root.addEventListener('keydown', (e) => {
      if (game.state !== 'upgrade' || !game.offer) return;
      const n = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[e.code];
      if (n === undefined) return;
      e.preventDefault();
      chooseUpgrade(n);
    });
    $('settings-form').addEventListener('submit', (e) => {
      e.preventDefault();
      showScreen(settingsBack);
    });
    $('settings-form').addEventListener('input', readSettings);
    $('settings-form').addEventListener('change', readSettings);
    $('b-settings-reset').addEventListener('click', () => {
      Object.assign(game.store.settings, game.DEFAULTS);
      syncSettings();
      readSettings();
    });
    // 일시정지 화면에서 Esc를 한 번 더 누르면 이어 가요 (마우스 잠금이 필요 없을 때만: Esc는 잠금을 다시 걸 수 없어요)
    root.addEventListener('keydown', (e) => {
      if (e.code !== 'Escape') return;
      if (!$('s-settings').hidden) showScreen(settingsBack);
      else if (game.state === 'paused' && (SZ.input.dragLook || SZ.input.touch) && Date.now() - pausedAt > 400) game.resume();
    });
    $('b-flip').addEventListener('click', () => {
      const s = game.store.settings;
      s.orient = s.orient === 'right' ? 'left' : 'right';
      game.saveStore();
      applyOrientation();
    });
    root.addEventListener('resize', applyOrientation);
    root.addEventListener('orientationchange', () => setTimeout(applyOrientation, 120));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
