// 로컬 설정/프로필 저장 (브라우저별)
import { sanitizeLook, COLORS } from '../../shared/src/looks.js';

const KEY = 'knockout.settings.v1';
const DEFAULTS = {
  name: '',
  look: { color: COLORS[Math.floor(Math.random() * COLORS.length)].id, hat: 'party', outfit: 'none', acc: 'none', emote: 'jump' },
  sfx: 0.8,
  quality: 'auto',
  sensitivity: 1,
  invertY: false,
  shake: true,
  showFps: false,
};

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { ...DEFAULTS, ...raw, look: sanitizeLook({ ...DEFAULTS.look, ...(raw.look || {}) }) };
  } catch {
    return { ...DEFAULTS };
  }
}

export const settings = load();

export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch {}
}

export const isTouch = () => matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

export function resolvedQuality() {
  if (settings.quality !== 'auto') return settings.quality;
  const small = Math.min(screen.width, screen.height) < 700;
  const cores = navigator.hardwareConcurrency || 4;
  if (isTouch() && (small || cores <= 4)) return 'low';
  if (isTouch()) return 'medium';
  return 'high';
}

// 탭(세션)별 재접속 토큰 — 새로고침해도 같은 플레이어로 복귀
const TKEY = 'knockout.session';
export const session = {
  get() { try { return JSON.parse(sessionStorage.getItem(TKEY) || 'null'); } catch { return null; } },
  set(v) { try { sessionStorage.setItem(TKEY, JSON.stringify(v)); } catch {} },
  clear() { try { sessionStorage.removeItem(TKEY); } catch {} },
};
