/* SAVE CITY — 공통 도우미 (날짜, 숫자, 문자열). 브라우저와 Node 테스트에서 함께 사용합니다. */
(function (root) {
  'use strict';
  const SC = (root.SC = root.SC || {});

  const DAY_MS = 86400000;
  const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

  const pad2 = (n) => String(n).padStart(2, '0');

  // 보이지 않는 문자(제로폭 공백, 줄 구분자 등)는 코드에 직접 쓰지 않고 코드 포인트로 만듭니다.
  const INVISIBLE = String.fromCharCode(0x200b, 0x2028, 0x2029, 0xfeff);
  const CONTROL_CHARS = new RegExp('[\\u0000-\\u001F\\u007F' + INVISIBLE + ']', 'g');
  const CONTROL_CHARS_KEEP_NL = new RegExp('[\\u0000-\\u0009\\u000B-\\u001F\\u007F' + INVISIBLE + ']', 'g');

  /** 기기 현지 시간 기준 날짜 키 'YYYY-MM-DD' */
  function dateKey(d) {
    d = d instanceof Date ? d : new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function keyToUTC(key) {
    const p = key.split('-').map(Number);
    return Date.UTC(p[0], p[1] - 1, p[2]);
  }

  function utcToKey(ms) {
    const d = new Date(ms);
    return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
  }

  function isDateKey(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const ms = keyToUTC(s);
    return !isNaN(ms) && utcToKey(ms) === s;
  }

  function addDays(key, n) {
    return utcToKey(keyToUTC(key) + n * DAY_MS);
  }

  /** b - a (일 단위) */
  function dayDiff(a, b) {
    return Math.round((keyToUTC(b) - keyToUTC(a)) / DAY_MS);
  }

  function weekday(key) {
    return WEEKDAYS[new Date(keyToUTC(key)).getUTCDay()];
  }

  /** 그 주의 월요일 날짜 키 (주간 랭킹은 월요일에 새로 시작) */
  function weekStart(key) {
    const dow = new Date(keyToUTC(key)).getUTCDay();
    return addDays(key, -((dow + 6) % 7));
  }

  /** '2026-10-05' → '2026.10.05' */
  function dotDate(key) {
    return String(key).replace(/-/g, '.');
  }

  function monthKey(key) {
    return String(key).slice(0, 7);
  }

  function addMonths(mKey, n) {
    const p = mKey.split('-').map(Number);
    const d = new Date(Date.UTC(p[0], p[1] - 1 + n, 1));
    return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1);
  }

  /** 49000 → '49,000' (환경과 상관없이 같은 결과) */
  function fmt(n) {
    const v = Math.round(Number(n) || 0);
    const s = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return v < 0 ? '-' + s : s;
  }

  function won(n) {
    return '₩' + fmt(n);
  }

  function signed(n) {
    const v = Math.round(Number(n) || 0);
    return (v > 0 ? '+' : '') + fmt(v);
  }

  /** 차트용 짧은 표기: 12000 → '12K' */
  function compact(n) {
    const v = Math.round(Number(n) || 0);
    if (Math.abs(v) >= 1000000) return trimZero((v / 1000000).toFixed(1)) + 'M';
    if (Math.abs(v) >= 1000) return trimZero((v / 1000).toFixed(1)) + 'K';
    return String(v);
  }

  function trimZero(s) {
    return s.replace(/\.0$/, '');
  }

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);
  }

  /** 코드 포인트 기준으로 자르기 (이모지가 깨지지 않도록) */
  function cut(s, max) {
    const chars = Array.from(s);
    return chars.length > max ? chars.slice(0, max).join('') : s;
  }

  /** 한 줄 입력 정리: 제어문자 제거, 공백 정리, 길이 제한 */
  function cleanText(s, max) {
    if (s == null) return '';
    const t = String(s)
      .replace(CONTROL_CHARS, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return cut(t, max || 100);
  }

  /** 여러 줄 입력 정리 (줄바꿈 유지, 빈 줄 최대 1개) */
  function cleanMultiline(s, max) {
    if (s == null) return '';
    const t = String(s)
      .replace(/\r\n?/g, '\n')
      .replace(CONTROL_CHARS_KEEP_NL, ' ')
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return cut(t, max || 200);
  }

  /** 받침에 따라 조사 고르기: josa('카페', '을', '를') → '카페를' */
  function josa(word, withFinal, withoutFinal) {
    const code = String(word).charCodeAt(String(word).length - 1);
    if (code < 0xac00 || code > 0xd7a3) return word + withoutFinal;
    return word + ((code - 0xac00) % 28 ? withFinal : withoutFinal);
  }

  /** '으로/로': 받침이 없거나 ㄹ 받침이면 '로' */
  function ro(word) {
    const code = String(word).charCodeAt(String(word).length - 1);
    if (code < 0xac00 || code > 0xd7a3) return word + '로';
    const fin = (code - 0xac00) % 28;
    return word + (fin === 0 || fin === 8 ? '로' : '으로');
  }

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function toInt(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : fallback === undefined ? 0 : fallback;
  }

  function isIso(s) {
    return typeof s === 'string' && s.length <= 40 && !isNaN(Date.parse(s));
  }

  function randomPart() {
    const c = root.crypto;
    if (c && typeof c.getRandomValues === 'function') {
      const a = new Uint32Array(2);
      c.getRandomValues(a);
      return a[0].toString(36) + a[1].toString(36);
    }
    return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  }

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + randomPart().slice(0, 8);
  }

  /** 짧은 해시(cyrb53). 암호용이 아니라 내용이 바뀌었는지 알아보는 용도예요. */
  function hash(str, seed) {
    seed = seed || 0;
    let h1 = 0xdeadbeef ^ seed;
    let h2 = 0x41c6ce57 ^ seed;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }

  SC.util = {
    DAY_MS,
    WEEKDAYS,
    dateKey,
    isDateKey,
    addDays,
    dayDiff,
    weekday,
    weekStart,
    dotDate,
    monthKey,
    addMonths,
    fmt,
    won,
    signed,
    compact,
    esc,
    cut,
    cleanText,
    cleanMultiline,
    josa,
    ro,
    clamp,
    toInt,
    isIso,
    uid,
    hash,
  };
})(typeof window !== 'undefined' ? window : globalThis);
