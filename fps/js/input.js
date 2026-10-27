/* SECTOR ZERO — 입력: 키보드·마우스(포인터 잠금, 안 되면 끌어서 보기)와 터치 조작 */
(function (root) {
  'use strict';
  const SZ = (root.SZ = root.SZ || {});

  const GAME_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);
  let lockedAt = 0;

  const input = {
    keys: new Set(),
    pressed: new Set(),
    fire: false,
    firePressed: false,
    aim: false,
    aimToggle: false,
    lookX: 0,
    lookY: 0,
    touchLookX: 0,
    touchLookY: 0,
    wheel: 0,
    moveX: 0,
    moveY: 0,
    touchSprint: false,
    locked: false,
    everLocked: false,
    dragLook: false,
    touch: false,
    rotation: 0, // 화면을 90°(또는 -90°) 돌려 가로로 보여 줄 때 터치 좌표도 같이 돌려요
    active: false, // 게임 중일 때만 키 기본 동작을 막아요
    canvas: null,
    onLockChange: null,
    onLockError: null,
    onTouchStart: null,
  };

  function down(code) {
    return input.keys.has(code);
  }

  function requestLock() {
    const c = input.canvas;
    if (!c || !c.requestPointerLock || input.touch) {
      if (input.onLockError) input.onLockError();
      return;
    }
    try {
      const r = c.requestPointerLock();
      if (r && typeof r.catch === 'function') r.catch(() => input.onLockError && input.onLockError());
    } catch (e) {
      if (input.onLockError) input.onLockError();
    }
  }

  function exitLock() {
    if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
  }

  function clearHeld() {
    input.keys.clear();
    input.fire = false;
    input.aim = false;
    input.moveX = input.moveY = 0;
    input.touchSprint = false;
  }

  /* ---------- 터치 ---------- */
  /** 화면 좌표 → 돌아간 게임 화면 안의 좌표 */
  function local(e) {
    const W = root.innerWidth, H = root.innerHeight;
    if (input.rotation === 90) return [e.clientY, W - e.clientX];
    if (input.rotation === -90) return [H - e.clientY, e.clientX];
    return [e.clientX, e.clientY];
  }

  function initTouch(rootEl) {
    if (!rootEl) return;
    const stick = rootEl.querySelector('.stick');
    const knob = stick && stick.querySelector('i');
    const RADIUS = 56;
    const roles = new Map(); // pointerId → {role, x, y, ox, oy}

    const setStick = (px, py, ox, oy) => {
      let dx = px - ox, dy = py - oy;
      const d = Math.hypot(dx, dy);
      const k = d > RADIUS ? RADIUS / d : 1;
      dx *= k;
      dy *= k;
      input.moveX = dx / RADIUS;
      input.moveY = dy / RADIUS;
      input.touchSprint = d > RADIUS * 1.25;
      if (knob) knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    };

    rootEl.addEventListener('pointerdown', (e) => {
      const el = e.target.closest('[data-zone],[data-t]');
      if (!el) return;
      e.preventDefault();
      const role = el.dataset.zone || el.dataset.t;
      try {
        el.setPointerCapture(e.pointerId);
      } catch (err) {
        /* 일부 브라우저는 캡처를 못 해요 */
      }
      const [lx, ly] = local(e);
      roles.set(e.pointerId, { role, x: lx, y: ly, ox: lx, oy: ly, el });
      if (role === 'move' && stick) {
        stick.style.left = lx + 'px';
        stick.style.top = ly + 'px';
        stick.classList.add('on');
        setStick(lx, ly, lx, ly);
      } else if (role === 'fire') {
        input.fire = true;
        input.firePressed = true;
      } else if (role === 'aim') input.aimToggle = !input.aimToggle;
      else if (role === 'jump') input.pressed.add('Space');
      else if (role === 'reload') input.pressed.add('KeyR');
      else if (role === 'swap') input.wheel += 1;
      else if (role === 'pause') input.pressed.add('Pause');
      el.classList.add('held');
    });
    rootEl.addEventListener('pointermove', (e) => {
      const r = roles.get(e.pointerId);
      if (!r) return;
      e.preventDefault();
      const [lx, ly] = local(e);
      if (r.role === 'move') setStick(lx, ly, r.ox, r.oy);
      else if (r.role === 'look' || r.role === 'fire') {
        input.touchLookX += lx - r.x;
        input.touchLookY += ly - r.y;
      }
      r.x = lx;
      r.y = ly;
    });
    const end = (e) => {
      const r = roles.get(e.pointerId);
      if (!r) return;
      roles.delete(e.pointerId);
      r.el.classList.remove('held');
      if (r.role === 'move') {
        input.moveX = input.moveY = 0;
        input.touchSprint = false;
        if (stick) stick.classList.remove('on');
        if (knob) knob.style.transform = '';
      } else if (r.role === 'fire') input.fire = false;
    };
    rootEl.addEventListener('pointerup', end);
    rootEl.addEventListener('pointercancel', end);
    rootEl.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  function init(canvas, touchRoot) {
    input.canvas = canvas;
    root.addEventListener('keydown', (e) => {
      if (input.active && (GAME_KEYS.has(e.code) || (e.code.startsWith('Digit') && !e.target.closest('input')))) e.preventDefault();
      if (!e.repeat) input.pressed.add(e.code);
      input.keys.add(e.code);
    });
    root.addEventListener('keyup', (e) => input.keys.delete(e.code));
    root.addEventListener('blur', clearHeld);

    canvas.addEventListener('mousedown', (e) => {
      if (!input.active) return;
      if (e.button === 0) {
        input.fire = true;
        input.firePressed = true;
      } else if (e.button === 2) input.aim = true;
    });
    root.addEventListener('mouseup', (e) => {
      if (e.button === 0) input.fire = false;
      else if (e.button === 2) input.aim = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('mousemove', (e) => {
      const mx = e.movementX || 0;
      const my = e.movementY || 0;
      // 잠금 직후나 한 번에 너무 크게 튀는 값은 브라우저가 커서를 옮기며 생긴 가짜 움직임이에요
      if (input.locked && (performance.now() - lockedAt < 150 || Math.abs(mx) > 250 || Math.abs(my) > 250)) return;
      if (input.locked || (input.dragLook && input.active && (e.buttons & 3))) {
        input.lookX += mx;
        input.lookY += my;
      }
    });
    canvas.addEventListener(
      'wheel',
      (e) => {
        if (!input.active) return;
        e.preventDefault();
        input.wheel += e.deltaY > 0 ? 1 : e.deltaY < 0 ? -1 : 0;
      },
      { passive: false }
    );
    document.addEventListener('pointerlockchange', () => {
      input.locked = document.pointerLockElement === canvas;
      lockedAt = performance.now();
      if (input.locked) input.everLocked = true;
      else {
        input.fire = false;
        input.aim = false;
      }
      if (input.onLockChange) input.onLockChange(input.locked);
    });
    document.addEventListener('pointerlockerror', () => input.onLockError && input.onLockError());

    // 처음 화면을 터치하면 터치 조작으로 바꿔요
    const markTouch = (e) => {
      if (e.pointerType !== 'touch' || input.touch) return;
      input.touch = true;
      if (input.onTouchStart) input.onTouchStart();
    };
    root.addEventListener('pointerdown', markTouch, true);
    if (root.matchMedia && root.matchMedia('(pointer: coarse)').matches && !root.matchMedia('(pointer: fine)').matches) input.touch = true;
    initTouch(touchRoot);
  }

  /** 프레임 끝: 한 번만 쓰는 입력 비우기 */
  function endFrame() {
    input.pressed.clear();
    input.firePressed = false;
    input.lookX = input.lookY = 0;
    input.touchLookX = input.touchLookY = 0;
    input.wheel = 0;
  }

  Object.assign(input, { init, down, requestLock, exitLock, endFrame, clearHeld });
  SZ.input = input;
})(typeof window !== 'undefined' ? window : globalThis);
