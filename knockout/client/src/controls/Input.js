// 키보드/마우스/터치 입력 통합. 카메라 기준 이동 방향으로 변환은 Game에서 한다.
import { settings, isTouch } from '../settings.js';
import { view } from '../view.js';

export class Input {
  constructor(dom, uiRoot) {
    this.dom = dom;
    this.keys = new Set();
    this.jumpHeld = false;
    this.dashQueued = false;
    this.moveX = 0; // 오른쪽 +
    this.moveY = 0; // 앞쪽 +
    this.lookDX = 0;
    this.lookDY = 0;
    this.enabled = false;
    this.touch = isTouch();
    this.dragging = false;
    this.onEscape = null;

    addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.code === 'Escape') { this.onEscape && this.onEscape(); return; }
      if (!this.enabled) return;
      if (['Space', 'ShiftLeft', 'ShiftRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) this.dashQueued = true;
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.jumpHeld = false; });

    // 마우스: 드래그(또는 포인터 잠금)로 카메라 회전
    dom.addEventListener('mousedown', (e) => {
      if (!this.enabled || this.touch) return;
      this.dragging = true;
      if (e.button === 0 && dom.requestPointerLock && settings.pointerLock !== false) {
        try { const r = dom.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch {}
      }
    });
    addEventListener('mouseup', () => { this.dragging = false; });
    addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      if (document.pointerLockElement === dom || this.dragging) {
        this.lookDX += e.movementX * 0.0035 * settings.sensitivity;
        this.lookDY += e.movementY * 0.0025 * settings.sensitivity * (settings.invertY ? -1 : 1);
      }
    });

    if (this.touch) this.setupTouch(uiRoot);
  }

  setupTouch(uiRoot) {
    const layer = document.createElement('div');
    layer.className = 'touch';
    layer.innerHTML = `
      <div class="stick-hint">이동<br/>드래그</div>
      <div class="stick-base"><div class="stick-knob"></div></div>
      <div class="tbtn dash" data-b="dash">대시</div>
      <div class="tbtn jump" data-b="jump">점프</div>`;
    layer.style.display = 'none';
    uiRoot.appendChild(layer);
    this.touchLayer = layer;
    const base = layer.querySelector('.stick-base');
    const knob = layer.querySelector('.stick-knob');
    const hint = layer.querySelector('.stick-hint');
    this.dashBtn = layer.querySelector('.dash');
    const jumpBtn = layer.querySelector('.jump');
    let stickId = null, cx = 0, cy = 0, lookId = null, lx = 0, ly = 0;
    const R = 60;

    const onStart = (e) => {
      if (!this.enabled) return;
      for (const t of e.changedTouches) {
        const el = t.target;
        if (el.closest && el.closest('.tbtn')) continue;
        if (el.closest && el.closest('button, .panel, .hud-menu, .spectate')) continue;
        const pt = view.toLocal(t.clientX, t.clientY);
        if (pt.x < view.width * 0.45 && stickId === null) {
          stickId = t.identifier; cx = pt.x; cy = pt.y;
          base.style.display = 'block';
          base.style.left = cx + 'px'; base.style.top = cy + 'px';
          knob.style.transform = 'translate(0,0)';
          hint.style.display = 'none';
        } else if (lookId === null) {
          lookId = t.identifier; lx = pt.x; ly = pt.y;
        }
      }
    };
    const onMove = (e) => {
      for (const t of e.changedTouches) {
        const pt = view.toLocal(t.clientX, t.clientY);
        if (t.identifier === stickId) {
          let dx = pt.x - cx, dy = pt.y - cy;
          const l = Math.hypot(dx, dy);
          if (l > R) { dx = (dx / l) * R; dy = (dy / l) * R; }
          knob.style.transform = `translate(${dx}px, ${dy}px)`;
          const k = Math.min(1, l / R);
          this.touchMove = { x: (dx / R), y: (-dy / R), k };
        } else if (t.identifier === lookId) {
          this.lookDX += (pt.x - lx) * 0.006 * settings.sensitivity;
          this.lookDY += (pt.y - ly) * 0.004 * settings.sensitivity * (settings.invertY ? -1 : 1);
          lx = pt.x; ly = pt.y;
        }
      }
      if (e.cancelable) e.preventDefault();
    };
    const onEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) { stickId = null; this.touchMove = null; base.style.display = 'none'; hint.style.display = ''; }
        if (t.identifier === lookId) lookId = null;
      }
    };
    addEventListener('touchstart', onStart, { passive: true });
    addEventListener('touchmove', onMove, { passive: false });
    addEventListener('touchend', onEnd);
    addEventListener('touchcancel', onEnd);

    const press = (el, down) => el.classList.toggle('pressed', down);
    jumpBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.touchJump = true; press(jumpBtn, true); }, { passive: false });
    const jumpUp = (e) => { e.preventDefault(); this.touchJump = false; press(jumpBtn, false); };
    jumpBtn.addEventListener('touchend', jumpUp, { passive: false });
    jumpBtn.addEventListener('touchcancel', jumpUp, { passive: false });
    this.dashBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.dashQueued = true; press(this.dashBtn, true); }, { passive: false });
    this.dashBtn.addEventListener('touchend', (e) => { e.preventDefault(); press(this.dashBtn, false); }, { passive: false });
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) {
      this.keys.clear();
      this.dashQueued = false;
      this.touchMove = null;
      this.touchJump = false;
      if (document.pointerLockElement) document.exitPointerLock();
    }
    if (this.touchLayer) this.touchLayer.style.display = on ? '' : 'none';
  }

  /** 이번 틱의 입력을 샘플링 */
  sample() {
    let x = 0, y = 0;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    if (this.touchMove) { x = this.touchMove.x; y = this.touchMove.y; const tl = Math.hypot(x, y); if (tl > 1) { x /= tl; y /= tl; } }
    const jump = k.has('Space') || !!this.touchJump;
    const dash = this.dashQueued;
    this.dashQueued = false;
    return { x, y, jump, dash };
  }

  takeLook() {
    const d = { dx: this.lookDX, dy: this.lookDY };
    this.lookDX = 0; this.lookDY = 0;
    return d;
  }

  setDashLabel(ghost) {
    if (this.dashBtn && this.dashGhost !== ghost) { this.dashGhost = ghost; this.dashBtn.textContent = ghost ? '⚡폭탄' : '대시'; }
  }

  setDashCooldown(frac) {
    if (this.dashBtn) this.dashBtn.style.setProperty('--p', `${Math.round(frac * 360)}deg`);
  }
}
