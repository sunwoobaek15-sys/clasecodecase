// 화면 방향 관리: 모바일을 세로로 들고 있거나 화면 회전이 잠겨 있어도 게임을 가로로 보여 준다.
// 세로 화면이면 #app 전체를 90도 돌리고, 터치 좌표를 회전된 좌표계로 변환한다.
import { settings, isTouch } from './settings.js';

const app = document.getElementById('app');
const listeners = [];

export const view = {
  width: innerWidth,
  height: innerHeight,
  rotated: false,

  /** 화면(client) 좌표 → 게임 화면 좌표 */
  toLocal(cx, cy) {
    return this.rotated ? { x: cy, y: this.screenW - cx } : { x: cx, y: cy };
  },

  /** 화면 좌표 이동량 → 게임 화면 이동량 */
  deltaLocal(dx, dy) {
    return this.rotated ? { x: dy, y: -dx } : { x: dx, y: dy };
  },

  onChange(fn) { listeners.push(fn); },
};

export function wantLandscape() {
  return isTouch() && settings.orientation !== 'auto';
}

export function applyOrientation() {
  const W = innerWidth, H = innerHeight;
  const rotate = wantLandscape() && H > W;
  view.rotated = rotate;
  view.screenW = W;
  view.width = rotate ? H : W;
  view.height = rotate ? W : H;
  document.body.classList.toggle('force-landscape', rotate);
  if (rotate) {
    app.style.width = H + 'px';
    app.style.height = W + 'px';
    app.style.transform = `translateX(${W}px) rotate(90deg)`;
  } else {
    app.style.width = '';
    app.style.height = '';
    app.style.transform = '';
  }
  for (const fn of listeners) fn(view);
}

/** 안드로이드 등에서는 전체 화면 + 방향 고정으로 진짜 가로 모드를 시도한다 (실패하면 회전 방식 유지) */
export async function tryFullscreenLandscape() {
  try {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape');
    return true;
  } catch {
    return false;
  }
}

addEventListener('resize', () => applyOrientation());
addEventListener('orientationchange', () => setTimeout(applyOrientation, 150));
applyOrientation();
