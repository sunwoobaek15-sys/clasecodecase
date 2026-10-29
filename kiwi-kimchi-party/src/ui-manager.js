/* 공통 UI 도우미: DOM 생성, 아이콘, 버튼, 확인 창, 숫자 애니메이션 */
(function (KK) {
  'use strict';

  const FONT = "'Fredoka', 'Jua', 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', system-ui, sans-serif";

  function el(tag, props) {
    const n = document.createElement(tag);
    if (props) {
      for (const k in props) {
        const v = props[k];
        if (v == null || v === false) continue;
        if (k === 'class') n.className = v;
        else if (k === 'text') n.textContent = v;
        else if (k === 'html') n.innerHTML = v;
        else if (k === 'on') for (const ev in v) n.addEventListener(ev, v[ev]);
        else if (k === 'style') n.style.cssText = v;
        else n.setAttribute(k, v === true ? '' : v);
      }
    }
    for (let i = 2; i < arguments.length; i++) append(n, arguments[i]);
    return n;
  }
  function append(n, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach((x) => append(n, x));
    else n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }

  const S = 'fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"';
  const ICONS = {
    pause: '<rect x="6.5" y="5" width="4" height="14" rx="1.4" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1.4" fill="currentColor"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
    back: `<path d="M15 5l-7 7 7 7" ${S}/>`,
    home: `<path d="M4 11.5 12 4.5l8 7M6.5 9.8V19h4v-5h3v5h4V9.8" ${S}/>`,
    restart: `<path d="M19 12a7 7 0 1 1-2.1-5" ${S}/><path d="M18.5 3.8v4h-4" ${S}/>`,
    soundOn: `<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" ${S}/>`,
    soundOff: `<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M16 9.5l5 5M21 9.5l-5 5" ${S}/>`,
    globe: `<circle cx="12" cy="12" r="8.2" ${S}/><path d="M3.8 12h16.4M12 3.8c2.6 2.4 2.6 14 0 16.4M12 3.8c-2.6 2.4-2.6 14 0 16.4" ${S}/>`,
    trophy: `<path d="M7.5 4.5h9v4.5a4.5 4.5 0 0 1-9 0zM7.5 6.5H4.5a3 3 0 0 0 3 3.5M16.5 6.5h3a3 3 0 0 1-3 3.5M12 13.5v3.5M8.5 19.5h7" ${S}/>`,
    left: '<path d="M15.5 4.5 7 12l8.5 7.5z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
    right: '<path d="M8.5 4.5 17 12l-8.5 7.5z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
    up: '<path d="M4.5 15.5 12 7l7.5 8.5z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
    spoon: `<ellipse cx="8" cy="8" rx="3.6" ry="4.6" transform="rotate(-45 8 8)" fill="currentColor"/><path d="M10.5 10.5l8.5 8.5" ${S} stroke-width="3"/>`,
    lock: `<rect x="5.5" y="10.5" width="13" height="9.5" rx="2.2" fill="currentColor"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" ${S}/>`,
    check: `<path d="M5 12.5l4.5 4.5L19 7.5" ${S} stroke-width="3.2"/>`,
    star: '<path d="M12 3.5l2.6 5.5 6 .7-4.4 4.1 1.2 5.9L12 16.8l-5.4 2.9 1.2-5.9-4.4-4.1 6-.7z" fill="currentColor"/>',
    heart: '<path d="M12 20.5s-8-4.8-8-10.8A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 8 2.5c0 6-8 10.8-8 10.8z"/>',
    clock: `<circle cx="12" cy="12" r="8" ${S}/><path d="M12 7.5V12l3 2" ${S}/>`,
  };

  function icon(name, cls) {
    return `<svg class="ico ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;
  }

  function button(o) {
    const b = el('button', { class: 'btn ' + (o.cls || ''), type: 'button', 'aria-label': o.aria, disabled: o.disabled, title: o.title });
    if (o.icon) b.insertAdjacentHTML('beforeend', icon(o.icon));
    if (o.label != null) b.append(el('span', { class: 'btn-label', text: o.label }));
    b.addEventListener('click', (e) => {
      KK.audio.play('click');
      if (o.onClick) o.onClick(e);
    });
    return b;
  }

  function formatNum(n) {
    return Math.round(n).toLocaleString(KK.i18n.lang === 'ko' ? 'ko-KR' : 'en-NZ');
  }

  function countUp(node, to, ms) {
    ms = ms || 900;
    const start = performance.now();
    function step(now) {
      if (!node.isConnected && now - start > 50) return;
      const p = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      node.textContent = formatNum(to * e);
      if (p < 1) requestAnimationFrame(step);
    }
    node.textContent = formatNum(0);
    requestAnimationFrame(step);
  }

  function bump(node) {
    node.classList.remove('bump');
    void node.offsetWidth;
    node.classList.add('bump');
  }

  /** 확인 창. 버튼을 누르면 true/false 로 끝나는 Promise 를 돌려준다. */
  function confirmDialog(o) {
    return new Promise((resolve) => {
      const close = (v) => {
        document.removeEventListener('keydown', onKey);
        back.remove();
        resolve(v);
      };
      const onKey = (e) => {
        if (e.key === 'Escape') close(false);
      };
      const back = el(
        'div',
        { class: 'modal-backdrop', role: 'dialog', 'aria-modal': 'true' },
        el(
          'div',
          { class: 'panel modal' },
          el('h2', { class: 'panel-title', text: o.title }),
          el('p', { class: 'modal-text', text: o.text }),
          el(
            'div',
            { class: 'btn-row' },
            button({ label: o.no, cls: 'btn-ghost', onClick: () => close(false) }),
            button({ label: o.yes, cls: 'btn-danger', onClick: () => close(true) })
          )
        )
      );
      document.addEventListener('keydown', onKey);
      document.body.append(back);
      back.querySelector('.btn-danger').focus();
    });
  }

  /** 배지 메달 (게임 색상 + 그림) */
  function badgeEl(b, unlocked, color) {
    const medal = el('div', { class: 'medal', style: `--accent:${color || '#ff6b4a'}` }, el('img', { src: b.icon(), alt: '' }));
    if (!unlocked) medal.insertAdjacentHTML('beforeend', `<span class="medal-lock">${icon('lock')}</span>`);
    return el(
      'div',
      { class: 'badge' + (unlocked ? '' : ' locked') },
      medal,
      el('div', { class: 'badge-text' }, el('b', { text: KK.i18n.t(`badge.${b.id}.name`) }), el('span', { text: KK.i18n.t(`badge.${b.id}.desc`) }))
    );
  }

  KK.ui = { FONT, el, icon, button, formatNum, countUp, bump, confirm: confirmDialog, badgeEl };
})(window.KK);
