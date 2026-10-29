/* 게임 관리자
 * - 4개 미니게임 목록(catalog)과 실제로 구현된 게임 등록(register)
 * - 게임 화면 공통 UI: HUD(점수/시간/하트), 일시정지, 카운트다운, 결과 화면
 * - 키보드/터치 입력, 고정 시간 간격 게임 루프
 * 각 미니게임은 이 파일이 넘겨주는 api 만 사용하고, 다른 게임 코드에는 의존하지 않는다. */
(function (KK) {
  'use strict';

  const CATALOG = [
    { id: 'kimchi-run', country: 'korea', color: '#e8473b', num: '01' },
    { id: 'pavlova-dash', country: 'nz', color: '#25a98f', num: '02' },
    { id: 'palace-builder', country: 'korea', color: '#3a6fd8', num: '03' },
    { id: 'kiwi-forest-rescue', country: 'nz', color: '#4c9a2a', num: '04' },
  ];
  const registry = new Map();

  /* ---------- 게임 루프: 1/60초 고정 간격으로 update, 화면마다 render ---------- */
  function createLoop(update, render) {
    const STEP = 1 / 60;
    let acc = 0;
    let last = 0;
    let raf = 0;
    let running = false;
    function frame(now) {
      if (!running) return;
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.25) dt = 0.25; // 탭 전환 등으로 멈췄다 돌아와도 한꺼번에 계산하지 않음
      acc += dt;
      while (acc >= STEP && running) {
        update(STEP);
        acc -= STEP;
      }
      render();
      if (running) raf = requestAnimationFrame(frame);
    }
    return {
      start() {
        if (running) return;
        running = true;
        acc = 0;
        last = performance.now();
        raf = requestAnimationFrame(frame);
      },
      stop() {
        running = false;
        cancelAnimationFrame(raf);
      },
      get running() {
        return running;
      },
    };
  }

  /* ---------- 입력: 키보드 + 화면 버튼을 같은 이름(left/right/jump/action)으로 묶는다 ---------- */
  const KEYMAP = {
    ArrowLeft: ['left'],
    KeyA: ['left'],
    ArrowRight: ['right'],
    KeyD: ['right'],
    ArrowUp: ['jump', 'up'],
    KeyW: ['jump', 'up'],
    Space: ['jump', 'action'],
    ArrowDown: ['down'],
    KeyS: ['down'],
    Enter: ['action'],
  };

  function createInput() {
    const down = new Map();
    const pressed = new Set();
    const sources = new Map();
    function press(src, names) {
      if (sources.has(src)) return;
      sources.set(src, names);
      names.forEach((n) => {
        down.set(n, (down.get(n) || 0) + 1);
        pressed.add(n);
      });
    }
    function release(src) {
      const names = sources.get(src);
      if (!names) return;
      sources.delete(src);
      names.forEach((n) => {
        const v = (down.get(n) || 1) - 1;
        if (v <= 0) down.delete(n);
        else down.set(n, v);
      });
    }
    const onKeyDown = (e) => {
      const names = KEYMAP[e.code];
      if (!names || e.altKey || e.ctrlKey || e.metaKey) return;
      if (document.querySelector('.modal-backdrop')) return;
      e.preventDefault();
      if (e.repeat) return;
      press('k:' + e.code, names);
    };
    const onKeyUp = (e) => {
      if (KEYMAP[e.code]) release('k:' + e.code);
    };
    const reset = () => {
      sources.clear();
      down.clear();
      pressed.clear();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', reset);
    return {
      isDown: (n) => down.has(n),
      consume(n) {
        const had = pressed.has(n);
        pressed.delete(n);
        return had;
      },
      pulse(n) {
        pressed.add(n);
      },
      press,
      release,
      clear() {
        pressed.clear();
      },
      reset,
      destroy() {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('blur', reset);
        reset();
      },
    };
  }

  const CONTROLS = {
    left: { icon: 'left', input: ['left'], side: 'l', aria: 'ctrl.left' },
    right: { icon: 'right', input: ['right'], side: 'l', aria: 'ctrl.right' },
    jump: { icon: 'up', input: ['jump'], side: 'r', label: 'ctrl.jump', big: true },
    mix: { icon: 'spoon', input: ['action'], side: 'r', label: 'ctrl.mix', big: true },
    drop: { icon: 'down', input: ['action'], side: 'r', label: 'ctrl.drop', big: true },
  };

  /* ---------- 게임 화면 하나를 만든다 (라우터가 호출) ---------- */
  function mount(root, id) {
    const def = registry.get(id);
    if (!def) return null;
    const { el, button, icon, formatNum, bump } = KK.ui;
    const t = KK.i18n.t;
    const meta = CATALOG.find((g) => g.id === id) || {};
    const W = def.width;
    const H = def.height;

    /* HUD */
    const scoreVal = el('span', { class: 'hud-value', text: '0' });
    const timeVal = el('span', { class: 'hud-value', text: '--' });
    const timeBox = el('div', { class: 'hud-stat hud-time' }, el('span', { class: 'hud-label', text: t('hud.time') }), timeVal);
    const heartsBox = el('div', { class: 'hud-hearts', role: 'img' });
    const tracker = el('div', { class: 'hud-tracker' });
    const pauseBtn = button({ icon: 'pause', cls: 'hud-btn', aria: t('hud.pause'), title: t('hud.pause'), onClick: () => pause() });
    const hudEl = el(
      'header',
      { class: 'hud' },
      el(
        'div',
        { class: 'hud-row' },
        pauseBtn,
        el('div', { class: 'hud-title', text: t(`game.${id}.name`) }),
        el('div', { class: 'hud-stats' }, el('div', { class: 'hud-stat' }, el('span', { class: 'hud-label', text: t('hud.score') }), scoreVal), timeBox, heartsBox)
      ),
      tracker
    );

    const canvas = el('canvas', { class: 'game-canvas', 'aria-label': t(`game.${id}.name`) });
    const bannerLayer = el('div', { class: 'banner-layer', 'aria-live': 'polite' });
    const controls = el('div', { class: 'touch-controls' });
    const stage = el('div', { class: 'stage' }, el('div', { class: 'canvas-wrap' }, canvas, bannerLayer), controls);
    const overlay = el('div', { class: 'overlay hidden' });
    const screen = el('div', { class: 'game-screen', 'data-game': id, style: `--accent:${meta.color || '#ff6b4a'}` }, hudEl, stage, overlay);
    root.append(screen);

    const ctx2d = canvas.getContext('2d');
    const view = { scale: 1, dpr: 1 };
    const input = createInput();
    let instance = null;
    let state = 'intro'; // intro | countdown | playing | paused | result
    let timers = [];
    let finished = false;

    function later(fn, ms) {
      const tid = setTimeout(fn, ms);
      timers.push(tid);
      return tid;
    }
    function clearTimers() {
      timers.forEach(clearTimeout);
      timers = [];
    }

    /* 캔버스를 화면에 맞게 (비율 유지) */
    function fit() {
      const r = stage.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const s = Math.min(r.width / W, r.height / H);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      view.scale = s;
      view.dpr = dpr;
      canvas.style.width = Math.floor(W * s) + 'px';
      canvas.style.height = Math.floor(H * s) + 'px';
      canvas.width = Math.round(W * s * dpr);
      canvas.height = Math.round(H * s * dpr);
      screen.classList.toggle('portrait', r.height > r.width * 1.1);
      if (instance) instance.render();
    }
    const ro = new ResizeObserver(fit);
    ro.observe(stage);

    let lastHearts = null;
    const trackerChips = {};
    const hud = {
      setScore(n) {
        const s = formatNum(n);
        if (scoreVal.textContent !== s) {
          scoreVal.textContent = s;
          bump(scoreVal);
        }
      },
      setTime(sec) {
        if (sec == null) {
          timeBox.hidden = true;
          return;
        }
        timeBox.hidden = false;
        const s = String(Math.max(0, Math.ceil(sec)));
        if (timeVal.textContent !== s) timeVal.textContent = s;
        timeBox.classList.toggle('warn', sec <= 10);
      },
      setHearts(n, max) {
        heartsBox.innerHTML = '';
        heartsBox.setAttribute('aria-label', `${t('hud.lives')} ${n}/${max}`);
        for (let i = 0; i < max; i++) heartsBox.insertAdjacentHTML('beforeend', icon('heart', i < n ? 'full' : 'empty'));
        if (lastHearts != null && n < lastHearts) bump(heartsBox);
        lastHearts = n;
      },
      setTracker(items) {
        tracker.innerHTML = '';
        items.forEach((it) => {
          const count = el('span', { class: 'track-count', text: `${it.have}/${it.need}` });
          const chip = el('div', { class: 'track-chip', title: it.label, 'data-id': it.id }, el('img', { src: it.icon, alt: it.label }), count);
          trackerChips[it.id] = { chip, count };
          tracker.append(chip);
        });
      },
      updateTracker(itemId, have, need) {
        const c = trackerChips[itemId];
        if (!c) return;
        c.count.textContent = `${Math.min(have, need)}/${need}`;
        c.chip.classList.toggle('done', have >= need);
        bump(c.chip);
      },
      banner(text, kind, ms) {
        const b = el('div', { class: 'banner banner-' + (kind || 'info'), text });
        bannerLayer.append(b);
        setTimeout(() => b.remove(), ms || 1600);
      },
    };

    function setControls(list) {
      input.reset();
      controls.innerHTML = '';
      const left = el('div', { class: 'ctrl-group left' });
      const right = el('div', { class: 'ctrl-group right' });
      list.forEach((name) => {
        const c = CONTROLS[name];
        const b = el('button', { class: 'ctrl-btn' + (c.big ? ' big' : ''), type: 'button', 'aria-label': t(c.aria || c.label), 'data-ctrl': name });
        b.innerHTML = icon(c.icon) + (c.label ? `<span>${t(c.label)}</span>` : '');
        const src = (e) => `p:${e.pointerId}:${name}`;
        b.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          try {
            b.setPointerCapture(e.pointerId);
          } catch (err) {
            /* 일부 브라우저는 지원하지 않음 */
          }
          input.press(src(e), c.input);
          b.classList.add('active');
        });
        const up = (e) => {
          input.release(src(e));
          b.classList.remove('active');
        };
        b.addEventListener('pointerup', up);
        b.addEventListener('pointercancel', up);
        b.addEventListener('lostpointercapture', up);
        b.addEventListener('contextmenu', (e) => e.preventDefault());
        (c.side === 'l' ? left : right).append(b);
      });
      controls.append(left, right);
    }

    canvas.addEventListener('pointerdown', (e) => {
      if (state !== 'playing') return;
      e.preventDefault();
      input.pulse('tap');
    });

    /* 포인터 위치 (게임 좌표). 마우스는 움직이기만 해도, 터치는 누르고 있는 동안 갱신된다.
     * 캔버스 바깥(세로 화면의 빈 공간)에서 끌어도 가로 위치를 따라간다. */
    const pointer = { x: W / 2, y: H / 2, down: false, version: 0, presses: 0, releases: 0, pressX: 0, pressY: 0 };
    const toGame = (e) => {
      const r = canvas.getBoundingClientRect();
      pointer.x = Math.max(0, Math.min(W, ((e.clientX - r.left) / r.width) * W));
      pointer.y = Math.max(0, Math.min(H, ((e.clientY - r.top) / r.height) * H));
      pointer.version += 1;
    };
    // presses/releases 는 누를 때/뗄 때마다 1씩 늘어난다 (아주 빠른 탭도 놓치지 않도록)
    stage.addEventListener('pointerdown', (e) => {
      if (state !== 'playing' || e.target.closest('.ctrl-btn')) return;
      pointer.down = true;
      toGame(e);
      pointer.pressX = pointer.x;
      pointer.pressY = pointer.y;
      pointer.presses += 1;
    });
    stage.addEventListener('pointermove', (e) => {
      if (state !== 'playing' || e.target.closest('.ctrl-btn')) return;
      if (pointer.down || e.pointerType === 'mouse') toGame(e);
    });
    const pointerUp = (e) => {
      if (!pointer.down) return;
      if (e && e.clientX != null) toGame(e);
      pointer.down = false;
      pointer.releases += 1;
    };
    stage.addEventListener('pointerup', pointerUp);
    stage.addEventListener('pointercancel', pointerUp);
    stage.addEventListener('pointerleave', pointerUp);

    const api = {
      width: W,
      height: H,
      input,
      pointer,
      hud,
      t,
      audio: KK.audio,
      setControls,
      loop: createLoop,
      beginFrame() {
        const k = view.scale * view.dpr;
        ctx2d.setTransform(k, 0, 0, k, 0, 0);
        return ctx2d;
      },
      finish(result) {
        if (finished) return;
        finished = true;
        showResult(result);
      },
    };

    function createInstance() {
      finished = false;
      lastHearts = null;
      hud.setScore(0);
      instance = def.create(api);
      fit();
    }

    /* ----- 오버레이 화면들 ----- */
    function openOverlay(panel, cls) {
      overlay.className = 'overlay ' + (cls || '');
      overlay.innerHTML = '';
      overlay.append(panel);
      const first = panel.querySelector('.btn-primary');
      if (first) first.focus({ preventScroll: true });
    }
    function closeOverlay() {
      overlay.className = 'overlay hidden';
      overlay.innerHTML = '';
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    }

    function showIntro() {
      state = 'intro';
      const info = def.intro(t);
      const panel = el(
        'div',
        { class: 'panel intro-panel' },
        el('div', { class: 'intro-art', html: KK.art.cards[id] || '' }),
        el('h2', { class: 'panel-title', text: t(`game.${id}.name`) }),
        el('section', { class: 'intro-sec' }, el('h3', { text: t('intro.goal') }), el('p', { text: info.goal })),
        info.items
          ? el(
              'section',
              { class: 'intro-sec' },
              el('h3', { text: t('intro.collect') }),
              el(
                'ul',
                { class: 'intro-items' },
                info.items.map((it) => el('li', null, el('img', { src: it.icon, alt: '' }), el('span', null, el('b', { text: it.label }), it.sub ? el('small', { text: it.sub }) : null)))
              )
            )
          : null,
        el(
          'section',
          { class: 'intro-sec' },
          el('h3', { text: t('intro.controls') }),
          el('ul', { class: 'intro-ctrl' }, info.controls.map((line) => el('li', { text: line })))
        ),
        el('p', { class: 'rotate-tip', text: t('tip.rotate') }),
        el(
          'div',
          { class: 'btn-row' },
          button({ label: t('intro.back'), icon: 'back', cls: 'btn-ghost', onClick: () => KK.router.go('menu') }),
          button({ label: t('intro.start'), icon: 'play', cls: 'btn-primary', onClick: () => countdown() })
        )
      );
      const art = panel.querySelector('.intro-art svg');
      if (art) art.setAttribute('preserveAspectRatio', 'xMidYMid slice');
      openOverlay(panel, 'scroll');
    }

    function countdown() {
      clearTimers();
      state = 'countdown';
      const num = el('div', { class: 'count-num' });
      openOverlay(el('div', { class: 'count-wrap' }, num), 'clear');
      const steps = ['3', '2', '1', t('count.go')];
      steps.forEach((s, i) =>
        later(() => {
          num.textContent = s;
          bump(num);
          KK.audio.play(i === 3 ? 'go' : 'count');
        }, i * 650)
      );
      later(() => {
        closeOverlay();
        input.reset();
        state = 'playing';
        instance.start();
      }, steps.length * 650 - 150);
    }

    function pause() {
      if (state === 'countdown') {
        // 카운트다운 중에는 처음부터 다시 세도록 멈춘다
        clearTimers();
      } else if (state === 'playing') {
        instance.pause();
      } else return;
      state = 'paused';
      input.reset();
      const panel = el(
        'div',
        { class: 'panel pause-panel' },
        el('h2', { class: 'panel-title', text: t('pause.title') }),
        el(
          'div',
          { class: 'btn-col' },
          button({ label: t('pause.resume'), icon: 'play', cls: 'btn-primary', onClick: () => resume() }),
          button({ label: t('pause.restart'), icon: 'restart', cls: 'btn-secondary', onClick: () => restart() }),
          button({ label: t('pause.quit'), icon: 'home', cls: 'btn-ghost', onClick: () => KK.router.go('menu') })
        )
      );
      openOverlay(panel);
    }

    function resume() {
      if (state !== 'paused') return;
      if (instance.started) {
        closeOverlay();
        input.reset();
        state = 'playing';
        instance.resume();
      } else {
        countdown();
      }
    }

    function restart() {
      clearTimers();
      closeOverlay();
      if (instance) instance.destroy();
      input.reset();
      createInstance();
      countdown();
    }

    function showResult(result) {
      clearTimers();
      state = 'result';
      instance.pause();
      input.reset();
      setControls([]);
      const rec = KK.save.record(id, result, def.badges);
      const scoreEl = el('div', { class: 'result-score', text: '0' });
      const panel = el(
        'div',
        { class: 'panel result-panel ' + (result.completed ? 'win' : 'lose') },
        el('div', { class: 'result-ribbon', text: result.title }),
        result.subtitle ? el('p', { class: 'result-sub', text: result.subtitle }) : null,
        el(
          'div',
          { class: 'result-score-wrap' },
          el('span', { class: 'result-score-label', text: t('result.score') }),
          scoreEl,
          rec.isBest ? el('span', { class: 'new-best', text: t('result.newBest') }) : null
        ),
        el(
          'ul',
          { class: 'breakdown' },
          result.breakdown.map((r) => el('li', null, el('span', { text: r.label }), el('b', { class: r.value < 0 ? 'neg' : null, text: (r.value < 0 ? '−' : '+') + formatNum(Math.abs(r.value)) })))
        ),
        el(
          'p',
          { class: 'result-best' },
          `${t('result.best')}: ${formatNum(rec.best)}`,
          typeof result.time === 'number' && result.completed ? ` · ${t('result.time')}: ${t('records.seconds', { s: result.time.toFixed(1) })}` : ''
        ),
        rec.newBadges.length
          ? el('section', { class: 'result-badges' }, el('h3', { text: t('result.newBadges') }), rec.newBadges.map((b) => KK.ui.badgeEl(b, true, meta.color)))
          : null,
        result.fact
          ? el('section', { class: 'fact-card' }, el('h3', { text: `${t('result.didYouKnow')} · ${result.fact.title}` }), el('p', { text: result.fact.text }))
          : null,
        el(
          'div',
          { class: 'btn-row' },
          button({ label: t('result.menu'), icon: 'home', cls: 'btn-ghost', onClick: () => KK.router.go('menu') }),
          button({ label: t('result.again'), icon: 'restart', cls: 'btn-primary', onClick: () => restart() })
        )
      );
      openOverlay(panel, 'scroll');
      KK.ui.countUp(scoreEl, result.score, 1000);
      if (rec.newBadges.length) later(() => KK.audio.play('badge'), 900);
      if (result.completed) confetti(overlay);
    }

    function confetti(host) {
      const colors = ['#ff6b4a', '#ffc93c', '#7bc043', '#4cc3ff', '#ff7eb6', '#ffffff'];
      const layer = el('div', { class: 'confetti', 'aria-hidden': 'true' });
      for (let i = 0; i < 46; i++) {
        const p = el('i');
        p.style.left = Math.random() * 100 + '%';
        p.style.background = colors[i % colors.length];
        p.style.animationDelay = Math.random() * 0.6 + 's';
        p.style.animationDuration = 1.8 + Math.random() * 1.4 + 's';
        p.style.transform = `rotate(${Math.random() * 360}deg)`;
        layer.append(p);
      }
      host.prepend(layer);
    }

    /* 키보드 단축키 / 화면 전환 시 자동 일시정지 */
    const onKey = (e) => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (document.querySelector('.modal-backdrop')) return;
        if (state === 'playing' || state === 'countdown') pause();
        else if (state === 'paused') resume();
      }
    };
    const onHide = () => {
      if (document.hidden) pause();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onHide);

    createInstance();
    showIntro();

    const session = {
      id,
      get state() {
        return state;
      },
      get instance() {
        return instance;
      },
      pause,
      resume,
      restart,
      destroy() {
        clearTimers();
        if (instance) instance.destroy();
        instance = null;
        input.destroy();
        ro.disconnect();
        window.removeEventListener('keydown', onKey);
        document.removeEventListener('visibilitychange', onHide);
        screen.remove();
        if (KK.games.session === session) KK.games.session = null;
      },
    };
    KK.games.session = session;
    return session;
  }

  KK.games = {
    catalog: CATALOG,
    session: null,
    register(def) {
      registry.set(def.id, def);
    },
    get(id) {
      return registry.get(id) || null;
    },
    allBadges() {
      const out = [];
      CATALOG.forEach((g) => {
        const d = registry.get(g.id);
        if (d && d.badges) d.badges.forEach((b) => out.push(b));
      });
      return out;
    },
    mount,
  };
})(window.KK);
