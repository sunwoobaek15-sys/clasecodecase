/* SAVE CITY — 화면 공통 부품: 아이콘, 모달/시트, 확인 창, 토스트, 축하 효과 */
(function (root) {
  'use strict';
  const SC = (root.SC = root.SC || {});
  const U = SC.util;

  /* ---------------- 아이콘 (24×24, currentColor) ---------------- */
  const ICON_PATHS = {
    home: '<path d="M3.5 10.5 12 3.8l8.5 6.7"/><path d="M5.5 9.2V20h5v-5.5h3V20h5V9.2"/>',
    city: '<path d="M3 20.5h18"/><path d="M5 20.5V9l5-2.5v14"/><path d="M10 20.5V4h8v16.5"/><path d="M13 7.5h2M13 11h2M13 14.5h2M7 11.5h1M7 15h1"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    shop: '<path d="M5 8h14l-1.2 12.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8Z"/><path d="M9 10V6.5a3 3 0 0 1 6 0V10"/>',
    user: '<circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5c1.2-4 4.2-6 7.5-6s6.3 2 7.5 6"/>',
    history: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4.5v4h4"/><path d="M12 8v4.5l3 2"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0Z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4"/><path d="M12 13v4M8.5 20.5h7M9.5 17h5v3.5h-5z"/>',
    chart: '<path d="M4 20.5h16"/><path d="M6.5 17v-5M11 17V7M15.5 17v-8M20 17v-3"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    next: '<path d="M9 5l7 7-7 7"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    image: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="m4 17 5-4.5 4 3.5 3-2.5 4.5 3.5"/>',
    trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7"/><path d="M6.5 7l1 13h9l1-13"/><path d="M10 11v5.5M14 11v5.5"/>',
    edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16Z"/><path d="M13.5 6.5l4 4"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.4"/>',
    box: '<path d="M3.5 7.5 12 3.5l8.5 4v9l-8.5 4-8.5-4Z"/><path d="M3.5 7.5 12 11.5l8.5-4M12 11.5v9"/>',
    move: '<path d="M12 3v18M3 12h18"/><path d="m9 5.5 3-2.5 3 2.5M9 18.5l3 2.5 3-2.5M5.5 9 3 12l2.5 3M18.5 9 21 12l-2.5 3"/>',
    up: '<path d="M12 19V6M6 11.5 12 5.5l6 6"/>',
    spark: '<path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.9L12 18.5l-1.8-5.8L4.5 10.8 10.2 9Z"/>',
    search: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/>',
    music: '<path d="M9 18V5.5l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/>',
    volume: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    motion: '<path d="M4 12h3l2.5-6 5 12 2.5-6h3"/>',
    moon: '<path d="M19.5 14.5A7.5 7.5 0 1 1 9.5 4.5a6 6 0 0 0 10 10Z"/>',
    help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.5M12 16.6v.4"/>',
    fire: '<path d="M12 21c-3.6 0-6-2.4-6-5.8 0-3.7 3-5.2 3.6-9.2 2.4 1.4 3.4 3.6 3.4 5.5 1-.6 1.6-1.6 1.8-2.8 1.9 1.6 3.2 3.9 3.2 6.5 0 3.4-2.4 5.8-6 5.8Z"/>',
    gift: '<rect x="4" y="9" width="16" height="11.5" rx="1.6"/><path d="M3 9h18M12 9v11.5"/><path d="M12 9c-1.6-3.6-5.6-3.8-5.6-1.6S10 9 12 9Zm0 0c1.6-3.6 5.6-3.8 5.6-1.6S14 9 12 9Z"/>',
    tag: '<path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.4 1.4 0 0 1 0 2l-6.2 6.2a1.4 1.4 0 0 1-2 0Z"/><circle cx="8" cy="8" r="1.4"/>',
    map: '<path d="M3.5 6.5 9 4l6 2.5L20.5 4v13.5L15 20l-6-2.5-5.5 2.5Z"/><path d="M9 4v13.5M15 6.5V20"/>',
  };

  function icon(name, cls) {
    return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (ICON_PATHS[name] || '') + '</svg>';
  }

  /** TOKEN 동전 아이콘 */
  function coin(cls) {
    return '<svg class="coin' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10" fill="#f5b301"/><circle cx="12" cy="12" r="7.6" fill="#ffd23f"/><path d="M8.6 9.2 10 15l2-4.6L14 15l1.4-5.8M8 11.6h8" stroke="#a86b00" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  /* ---------------- 오버레이 (모달 / 시트) ---------------- */

  const stack = [];
  let lastFocusBeforeOpen = null;

  function overlayRoot() {
    let el = document.getElementById('overlay-root');
    if (!el) {
      el = document.createElement('div');
      el.id = 'overlay-root';
      document.body.appendChild(el);
    }
    return el;
  }

  function focusables(el) {
    return Array.from(el.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(
      (x) => x.offsetParent !== null || x === document.activeElement
    );
  }

  /**
   * opts: { title, body(html), actions:[{label, kind, onClick(close)→false면 유지, id}], kind:'modal'|'sheet',
   *         dismissible(기본 true), className, onOpen(el, close), onClose(), labelledBy }
   */
  function open(opts) {
    const id = U.uid('dlg');
    const kind = opts.kind || 'modal';
    const dismissible = opts.dismissible !== false;
    const wrap = document.createElement('div');
    wrap.className = 'overlay overlay-' + kind;
    wrap.setAttribute('role', 'presentation');
    const actions = (opts.actions || [])
      .map((a, i) => '<button type="button" class="btn ' + (a.kind ? 'btn-' + a.kind : 'btn-secondary') + (a.block ? ' btn-block' : '') + '" data-dlg-action="' + i + '"' + (a.id ? ' id="' + a.id + '"' : '') + (a.disabled ? ' disabled' : '') + '>' + a.label + '</button>')
      .join('');
    wrap.innerHTML =
      '<div class="dialog dialog-' + kind + (opts.className ? ' ' + opts.className : '') + '" role="dialog" aria-modal="true"' + (opts.title ? ' aria-labelledby="' + id + '-t"' : ' aria-label="' + U.esc(opts.label || '알림') + '"') + ' tabindex="-1">' +
      (kind === 'sheet' ? '<div class="sheet-grip" aria-hidden="true"></div>' : '') +
      (opts.title || dismissible
        ? '<div class="dialog-head">' + (opts.title ? '<h2 class="dialog-title" id="' + id + '-t">' + opts.title + '</h2>' : '<span></span>') + (dismissible ? '<button type="button" class="icon-btn dialog-close" data-dlg-close aria-label="닫기">' + icon('close') + '</button>' : '') + '</div>'
        : '') +
      '<div class="dialog-body">' + (opts.body || '') + '</div>' +
      (actions ? '<div class="dialog-actions">' + actions + '</div>' : '') +
      '</div>';
    const dialog = wrap.firstElementChild;
    let closed = false;
    const entry = { wrap, dialog, dismissible, close, opts };

    function close(result) {
      if (closed) return;
      closed = true;
      const idx = stack.indexOf(entry);
      if (idx >= 0) stack.splice(idx, 1);
      wrap.classList.add('leaving');
      const remove = () => wrap.remove();
      if (document.documentElement.classList.contains('no-anim')) remove();
      else setTimeout(remove, 180);
      if (!stack.length) {
        document.documentElement.classList.remove('modal-open');
        if (lastFocusBeforeOpen && lastFocusBeforeOpen.isConnected) {
          try {
            lastFocusBeforeOpen.focus({ preventScroll: true });
          } catch (e) {
            /* 무시 */
          }
        }
      } else {
        const top = stack[stack.length - 1];
        top.dialog.focus({ preventScroll: true });
      }
      if (opts.onClose) opts.onClose(result);
    }

    wrap.addEventListener('click', (e) => {
      if (e.target === wrap && dismissible) {
        close();
        return;
      }
      if (e.target.closest('[data-dlg-close]')) {
        close();
        return;
      }
      const btn = e.target.closest('[data-dlg-action]');
      if (btn && wrap.contains(btn)) {
        const a = (opts.actions || [])[Number(btn.dataset.dlgAction)];
        if (!a) return;
        if (SC.audio) SC.audio.play('tap');
        const r = a.onClick ? a.onClick(close, dialog) : undefined;
        if (r !== false) close(a.value);
      }
    });

    if (!stack.length) lastFocusBeforeOpen = document.activeElement;
    stack.push(entry);
    document.documentElement.classList.add('modal-open');
    overlayRoot().appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('shown'));
    if (opts.onOpen) opts.onOpen(dialog, close);
    const f = opts.focus ? dialog.querySelector(opts.focus) : null;
    try {
      (f || dialog).focus({ preventScroll: true });
    } catch (e) {
      /* 무시 */
    }
    return { el: dialog, close };
  }

  function topEntry() {
    return stack[stack.length - 1] || null;
  }

  document.addEventListener('keydown', (e) => {
    const top = topEntry();
    if (!top) return;
    if (e.key === 'Escape' && top.dismissible) {
      e.preventDefault();
      top.close();
    } else if (e.key === 'Tab') {
      const list = focusables(top.dialog);
      if (!list.length) {
        e.preventDefault();
        top.dialog.focus();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === top.dialog)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  function closeAll() {
    while (stack.length) stack[stack.length - 1].close();
  }

  /** 확인 창 (window.confirm 대신 사용) → Promise<boolean> */
  function confirmBox(o) {
    return new Promise((resolve) => {
      let answered = false;
      open({
        title: o.title,
        body: '<p class="confirm-text">' + o.message + '</p>',
        className: 'dialog-confirm',
        actions: [
          { label: o.cancelLabel || '취소', kind: 'secondary', onClick: () => ((answered = true), resolve(false)) },
          { label: o.confirmLabel || '확인', kind: o.danger ? 'danger' : 'primary', id: o.confirmId, onClick: () => ((answered = true), resolve(true)) },
        ],
        onClose: () => {
          if (!answered) resolve(false);
        },
        focus: o.danger ? '[data-dlg-action="0"]' : '[data-dlg-action="1"]',
      });
    });
  }

  function alertBox(o) {
    return new Promise((resolve) => {
      open({
        title: o.title,
        body: '<p class="confirm-text">' + o.message + '</p>',
        className: 'dialog-confirm',
        actions: [{ label: o.okLabel || '확인', kind: 'primary' }],
        onClose: () => resolve(true),
        focus: '[data-dlg-action="0"]',
      });
    });
  }

  /* ---------------- 토스트 ---------------- */

  function toast(message, o) {
    o = o || {};
    let rootEl = document.getElementById('toast-root');
    if (!rootEl) {
      rootEl = document.createElement('div');
      rootEl.id = 'toast-root';
      rootEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(rootEl);
    }
    while (rootEl.children.length >= 3) rootEl.firstElementChild.remove();
    const el = document.createElement('div');
    el.className = 'toast toast-' + (o.type || 'info');
    el.setAttribute('role', o.type === 'error' ? 'alert' : 'status');
    el.innerHTML = (o.icon ? '<span class="toast-icon" aria-hidden="true">' + o.icon + '</span>' : '') + '<span class="toast-msg">' + message + '</span>' + (o.action ? '<button type="button" class="toast-btn">' + o.action.label + '</button>' : '');
    if (o.action) {
      el.querySelector('.toast-btn').addEventListener('click', () => {
        el.remove();
        o.action.onClick();
      });
    }
    rootEl.appendChild(el);
    requestAnimationFrame(() => el.classList.add('shown'));
    const ms = o.duration || (o.action ? 4800 : 2600);
    setTimeout(() => {
      el.classList.remove('shown');
      setTimeout(() => el.remove(), 250);
    }, ms);
    return el;
  }

  /* ---------------- 축하 효과 ---------------- */

  function animOn() {
    return !document.documentElement.classList.contains('no-anim');
  }

  function confetti(n) {
    if (!animOn()) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'confetti';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    const dpr = Math.min(2, root.devicePixelRatio || 1);
    const W = root.innerWidth;
    const H = root.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const g = canvas.getContext('2d');
    g.scale(dpr, dpr);
    const colors = ['#ffc83d', '#2f6bff', '#4cd27e', '#ff6b8a', '#8b5cf6', '#ff9f43'];
    const parts = [];
    for (let i = 0; i < (n || 90); i++) {
      parts.push({
        x: W / 2 + (Math.random() - 0.5) * 80,
        y: H * 0.35,
        vx: (Math.random() - 0.5) * 9,
        vy: -Math.random() * 9 - 3,
        r: 3 + Math.random() * 4,
        c: colors[i % colors.length],
        a: Math.random() * Math.PI,
        va: (Math.random() - 0.5) * 0.3,
        coin: i % 7 === 0,
      });
    }
    const start = performance.now();
    function frame(now) {
      const t = now - start;
      g.clearRect(0, 0, W, H);
      for (const p of parts) {
        p.vy += 0.28;
        p.x += p.vx;
        p.y += p.vy;
        p.a += p.va;
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.a);
        g.globalAlpha = Math.max(0, 1 - t / 1700);
        if (p.coin) {
          g.fillStyle = '#f5b301';
          g.beginPath();
          g.ellipse(0, 0, p.r * 1.4, p.r * 1.4 * Math.abs(Math.cos(p.a * 2)) + 1, 0, 0, Math.PI * 2);
          g.fill();
        } else {
          g.fillStyle = p.c;
          g.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
        }
        g.restore();
      }
      if (t < 1800) requestAnimationFrame(frame);
      else canvas.remove();
    }
    requestAnimationFrame(frame);
  }

  /** 숫자가 올라가는 효과 */
  function countUp(el, from, to, ms) {
    if (!el) return;
    if (!animOn() || from === to) {
      el.textContent = U.fmt(to);
      return;
    }
    const start = performance.now();
    const dur = ms || 700;
    function frame(now) {
      const k = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = U.fmt(Math.round(from + (to - from) * e));
      if (k < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function progressBar(pct, o) {
    o = o || {};
    const v = Math.max(0, Math.min(1, pct || 0));
    return '<div class="progress' + (o.cls ? ' ' + o.cls : '') + '" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(v * 100) + '"' + (o.label ? ' aria-label="' + U.esc(o.label) + '"' : '') + '><span style="width:' + (v * 100).toFixed(1) + '%"></span></div>';
  }

  SC.ui = {
    icon,
    coin,
    open,
    sheet: (o) => open(Object.assign({ kind: 'sheet' }, o)),
    closeAll,
    hasOpen: () => stack.length > 0,
    confirm: confirmBox,
    alert: alertBox,
    toast,
    confetti,
    countUp,
    progressBar,
  };
})(typeof window !== 'undefined' ? window : globalThis);
