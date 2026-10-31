// 모든 DOM UI 화면. 게임 로직은 App 콜백으로 전달한다.
import { COLORS, HATS, OUTFITS, ACCESSORIES, EMOTES, colorHex } from '../../../shared/src/looks.js';
import { MIN_PLAYERS, MAX_PLAYERS, NAME_MAX, ROUNDS } from '../../../shared/src/constants.js';
import { settings, saveSettings, isTouch } from '../settings.js';
import { sfx } from '../audio/Sfx.js';
import { OFFLINE } from '../network/LocalServer.js';
import { applyOrientation } from '../view.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class UI {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    this.layers = {};
    for (const name of ['main', 'hud', 'modal', 'toast']) {
      const el = document.createElement('div');
      el.className = 'layer-' + name;
      root.appendChild(el);
      this.layers[name] = el;
    }
    this.screen = null;
    this.customTab = 'color';
    this.customOpen = false;
    root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el || el.disabled) return;
      sfx.unlock();
      sfx.click();
      this.app.action(el.dataset.act, el.dataset);
    });
    root.addEventListener('input', (e) => {
      const el = e.target;
      if (el.dataset.set) this.onSetting(el);
    });
  }

  // ---------- 메인 메뉴 ----------
  showMenu(err = '') {
    this.screen = 'menu';
    this.customOpen = false;
    document.body.classList.remove('customizing');
    this.layers.hud.innerHTML = '';
    const code = new URLSearchParams(location.search).get('room') || '';
    this.layers.main.innerHTML = `
      <div class="screen menu">
        <div>
          <div class="logo">KNOCK<span>OUT</span></div>
          <div class="tag">밀어내고, 버티고, 살아남아라!</div>
        </div>
        <div class="panel col">
          <label class="field">닉네임
            <input class="text" id="name" maxlength="${NAME_MAX}" placeholder="이름을 입력하세요" value="${esc(settings.name)}" autocomplete="off" />
          </label>
          ${OFFLINE ? `
          <button class="btn yellow block" data-act="practice">🤖 봇과 바로 시작</button>
          <button class="btn block" data-act="create">방 만들기 (봇 인원 직접 선택)</button>
          <div class="hint">오프라인 버전: 이 기기에서 봇과 대전합니다. 친구와 온라인 대전은 서버 버전에서 방 코드로 할 수 있어요.</div>` : `
          <button class="btn block" data-act="create">방 만들기</button>
          <div class="row">
            <input class="text code" id="code" maxlength="4" placeholder="코드" value="${esc(code)}" autocomplete="off" />
            <button class="btn blue" data-act="join">참가</button>
          </div>
          <button class="btn yellow block" data-act="practice">🤖 봇과 연습하기</button>`}
          <div class="err" id="menu-err">${esc(err)}</div>
          <div class="menu-foot">
            <button class="btn gray small grow" data-act="customize">👕 꾸미기</button>
            <button class="btn gray small grow" data-act="settings">⚙️ 설정</button>
            ${isTouch() && document.documentElement.requestFullscreen ? '<button class="btn gray small" data-act="fullscreen" title="전체 화면">⛶</button>' : ''}
          </div>
        </div>
      </div>`;
    const nameEl = this.root.querySelector('#name');
    nameEl.addEventListener('input', () => { settings.name = nameEl.value; saveSettings(); });
    const codeEl = this.root.querySelector('#code');
    if (codeEl) codeEl.addEventListener('input', () => { codeEl.value = codeEl.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
    if (codeEl) codeEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.app.action('join', {}); });
    if (codeEl && code && settings.name) codeEl.focus();
  }

  menuValues() {
    return {
      name: (this.root.querySelector('#name')?.value || '').trim(),
      code: (this.root.querySelector('#code')?.value || '').trim().toUpperCase(),
    };
  }

  menuError(msg) {
    const el = this.root.querySelector('#menu-err');
    if (el) el.textContent = msg;
    else this.toast(msg);
  }

  // ---------- 꾸미기 패널 ----------
  showCustomize(look, takenColors = new Set()) {
    this.customOpen = true;
    document.body.classList.add('customizing');
    this.renderCustomize(look, takenColors);
  }

  hideCustomize() {
    this.customOpen = false;
    document.body.classList.remove('customizing');
    const el = this.layers.main.querySelector('.custom');
    if (el) el.remove();
    const cls = this.layers.main.querySelector('.menu');
    if (cls) cls.style.display = '';
  }

  renderCustomize(look, takenColors = new Set()) {
    if (!this.customOpen) return;
    let el = this.layers.main.querySelector('.custom');
    if (!el) {
      el = document.createElement('div');
      el.className = 'custom';
      this.layers.main.appendChild(el);
    }
    const menu = this.layers.main.querySelector('.menu');
    if (menu) menu.style.display = 'none';
    const tabs = [['color', '색상'], ['hat', '모자'], ['outfit', '의상'], ['acc', '액세서리'], ['emote', '승리 모션']];
    const lists = { color: COLORS, hat: HATS, outfit: OUTFITS, acc: ACCESSORIES, emote: EMOTES };
    const list = lists[this.customTab];
    const opts = list.map((o) => {
      const on = look[this.customTab] === o.id;
      const taken = this.customTab === 'color' && takenColors.has(o.id) && !on;
      const sw = this.customTab === 'color' ? `<span class="swatch" style="background:${hex(o.hex)}"></span>` : '';
      return `<button class="opt ${on ? 'on' : ''} ${taken ? 'taken' : ''}" data-act="look" data-k="${this.customTab}" data-v="${o.id}" ${taken ? 'disabled' : ''}>${sw}${esc(o.name)}</button>`;
    }).join('');
    el.innerHTML = `
      <div class="panel">
        <div class="row"><h2 class="grow" style="margin:0">캐릭터 꾸미기</h2><button class="btn gray small" data-act="closeCustomize">완료</button></div>
        <div class="tabs">${tabs.map(([k, n]) => `<button class="tab ${k === this.customTab ? 'on' : ''}" data-act="customTab" data-k="${k}">${n}</button>`).join('')}</div>
        <div class="opts">${opts}</div>
        <div class="hint">${this.customTab === 'emote' ? '우승했을 때 보여줄 동작입니다.' : '외형만 바뀌며 능력치에는 영향이 없습니다.'}</div>
      </div>`;
  }

  // ---------- 대기실 ----------
  showLobby(room, youId) {
    this.screen = 'lobby';
    this.layers.hud.innerHTML = '';
    if (!this.layers.main.querySelector('.lobby')) {
      this.layers.main.innerHTML = `<div class="screen lobby"><div class="side"></div></div>`;
      if (this.customOpen) this.renderCustomize(this.app.myLook(), this.app.takenColors());
    }
    this.updateLobby(room, youId);
  }

  updateLobby(room, youId) {
    const side = this.layers.main.querySelector('.lobby .side');
    if (!side) return;
    const me = room.players.find((p) => p.id === youId);
    const isHost = room.hostId === youId;
    const parts = room.players.filter((p) => p.isBot || p.connected);
    const notReady = parts.filter((p) => !p.isBot && p.id !== room.hostId && !p.ready);
    let startHint = '';
    if (parts.length < MIN_PLAYERS) startHint = `최소 ${MIN_PLAYERS}명이 필요합니다. 친구를 초대하거나 봇을 추가하세요.`;
    else if (notReady.length) startHint = `준비 대기 중: ${notReady.map((p) => esc(p.name)).join(', ')}`;
    else startHint = '모두 준비 완료!';
    const canStart = parts.length >= MIN_PLAYERS && !notReady.length;
    const list = room.players.map((p) => {
      const badges = [];
      if (p.id === youId) badges.push('<span class="badge me">나</span>');
      if (p.id === room.hostId) badges.push('<span class="badge host">👑 방장</span>');
      else if (!p.connected) badges.push('<span class="badge off">연결 끊김</span>');
      else if (p.isBot || p.ready) badges.push('<span class="badge ready">준비 완료</span>');
      else badges.push('<span class="badge">대기 중</span>');
      const kick = isHost && p.isBot ? `<button class="btn gray small" style="min-height:30px;padding:2px 10px" data-act="removeBot" data-id="${p.id}">✕</button>` : '';
      return `<li><span class="dot" style="background:${hex(colorHex(p.look.color))}"></span><span class="nm">${esc(p.name)}</span>${badges.join('')}${kick}</li>`;
    }).join('');
    side.innerHTML = `
      <div class="panel col">
        <div class="row" style="justify-content:space-between">
          <div>
            <div class="hint">방 코드</div>
            <div class="roomcode"><span class="code">${esc(room.code)}</span></div>
          </div>
          ${OFFLINE ? '<div class="hint">오프라인 연습 방</div>' : `<div class="col" style="gap:6px">
            <button class="btn blue small" data-act="copyCode">코드 복사</button>
            <button class="btn blue small" data-act="shareLink">초대 링크</button>
          </div>`}
        </div>
        <div class="row" style="justify-content:space-between"><b style="font-weight:400;font-size:18px">참가자 ${room.players.length}/${MAX_PLAYERS}</b>
          ${isHost ? `<button class="btn yellow small" data-act="addBot" ${room.players.length >= MAX_PLAYERS ? 'disabled' : ''}>🤖 봇 추가</button>` : ''}</div>
        <ul class="plist">${list}</ul>
      </div>
      <div class="panel col">
        <div class="row" style="justify-content:space-between;gap:8px;flex-wrap:wrap">
          <b style="font-weight:400;font-size:17px">게임 모드</b>
          ${isHost ? `<div class="seg">
            <button class="${room.mode !== 'classic' ? 'on' : ''}" data-act="mode" data-v="show">🏆 쇼 (3라운드)</button>
            <button class="${room.mode === 'classic' ? 'on' : ''}" data-act="mode" data-v="classic">⚔️ 클래식</button></div>`
            : `<span class="badge">${room.mode === 'classic' ? '⚔️ 클래식' : '🏆 쇼 (3라운드)'}</span>`}
        </div>
        <div class="hint">${room.mode === 'classic' ? '한 판 승부: 경기장에서 마지막까지 살아남기' : '레이스 → 넉아웃 아레나 → 결승. 탈락해도 ⚡번개 구름 방해꾼으로 계속 참여!'}</div>
        <div class="hint">${isHost ? startHint : (me && me.ready ? '방장이 시작하기를 기다리는 중...' : '준비 버튼을 눌러 주세요!')}</div>
        <div class="lobby-actions">
          ${isHost
            ? `<button class="btn green wide" data-act="start" ${canStart ? '' : 'disabled'}>게임 시작!</button>`
            : `<button class="btn ${me && me.ready ? 'gray' : 'green'} wide" data-act="ready">${me && me.ready ? '준비 취소' : '준비 완료!'}</button>`}
          <button class="btn blue" data-act="customize">👕 꾸미기</button>
          <button class="btn gray" data-act="leave">나가기</button>
        </div>
      </div>`;
  }

  // ---------- HUD ----------
  showHud() {
    this.screen = 'hud';
    this.customOpen = false;
    document.body.classList.remove('customizing');
    this.layers.main.innerHTML = '';
    this.layers.hud.innerHTML = `
      <div class="hud screen" style="padding:0">
        <div class="hud-top"><div class="pill" id="h-alive">생존 <b>-</b></div><div class="pill" id="h-time">0:00</div></div>
        <div class="hud-alive" id="h-dots"></div>
        <button class="btn gray icon-btn hud-menu" data-act="pause">☰</button>
        <div class="hud-feed" id="h-feed"></div>
        <div id="h-banner"></div>
        <div id="h-center"></div>
        <div id="h-wind"></div>
        <div id="h-spec"></div>
        <div id="h-ghost"></div>
        ${isTouch() ? '' : `<div class="dash-meter" id="h-dash"><span>대시<br/>SHIFT</span></div>
        <div class="keys-help">WASD 이동 · SPACE 점프 · SHIFT 대시<br/>마우스 클릭/드래그: 카메라 · ESC: 메뉴</div>`}
        <div class="fps" id="h-fps" style="display:${settings.showFps ? '' : 'none'}"></div>
      </div>`;
    this.hud = {
      alive: this.root.querySelector('#h-alive'), time: this.root.querySelector('#h-time'), dots: this.root.querySelector('#h-dots'),
      feed: this.root.querySelector('#h-feed'), banner: this.root.querySelector('#h-banner'), center: this.root.querySelector('#h-center'),
      wind: this.root.querySelector('#h-wind'), spec: this.root.querySelector('#h-spec'), ghost: this.root.querySelector('#h-ghost'), dash: this.root.querySelector('#h-dash'), fps: this.root.querySelector('#h-fps'),
    };
    this.lastHud = {};
  }

  hudSet(key, html) {
    if (!this.hud || this.lastHud[key] === html) return;
    this.lastHud[key] = html;
    this.hud[key].innerHTML = html;
  }

  updateHud({ alive, total, time, players, dashFrac, dashReady, fps, round, finished, ghost }) {
    if (!this.hud) return;
    const rn = round ? `<span style="opacity:.75">R${round.idx + 1}</span> ` : '';
    if (round && round.type === 'race') this.hudSet('alive', `${rn}완주 <b>${finished}</b> / ${round.quota}명 통과`);
    else if (round && round.type === 'survival') this.hudSet('alive', `${rn}생존 <b>${alive}</b> · ${round.quota}명 남으면 통과`);
    else this.hudSet('alive', `${rn}생존 <b>${alive}</b> / ${total}`);
    this.hudSet('ghost', ghost ? `<div class="ghost-hint">⚡ 방해꾼 모드 — ${isTouch() ? '조이스틱: 조준 · 대시 버튼: 번개 폭탄' : 'WASD: 조준 · SHIFT: 번개 폭탄'}</div>` : '');
    if (this.hud.dash && this.lastHud.dashLabel !== ghost) { this.lastHud.dashLabel = ghost; this.hud.dash.querySelector('span').innerHTML = ghost ? '폭탄<br/>SHIFT' : '대시<br/>SHIFT'; }
    this.hudSet('time', fmtTime(time));
    this.hudSet('dots', players.map((p) => `<span class="alive-dot ${p.out ? 'out' : ''}" style="background:${hex(colorHex(p.color))}" title="${esc(p.name)}"></span>`).join(''));
    if (this.hud.dash) {
      this.hud.dash.style.setProperty('--p', `${Math.round(dashFrac * 360)}deg`);
      this.hud.dash.classList.toggle('ready', dashReady);
    }
    if (this.hud.fps && settings.showFps) this.hud.fps.textContent = fps;
  }

  feed(text) {
    if (!this.hud) return;
    const el = document.createElement('div');
    el.className = 'feed-item';
    el.textContent = text;
    this.hud.feed.prepend(el);
    while (this.hud.feed.children.length > 4) this.hud.feed.lastChild.remove();
    setTimeout(() => el.remove(), 4500);
  }

  banner(big, small = '', warn = false, ms = 2600) {
    if (!this.hud) return;
    clearTimeout(this.bannerTimer);
    this.hud.banner.innerHTML = `<div class="banner ${warn ? 'warn' : ''}"><div class="big">${esc(big)}</div><div class="small">${esc(small)}</div></div>`;
    this.bannerTimer = setTimeout(() => { if (this.hud) this.hud.banner.innerHTML = ''; }, ms);
  }

  countdown(text) {
    if (!this.hud) return;
    this.hud.center.innerHTML = text ? `<div class="countdown"><span>${esc(text)}</span></div>` : '';
  }

  showIntro(round, ghost) {
    if (!this.hud || !round) return;
    const info = ROUNDS[round.type];
    const goal = round.type === 'race' ? `상위 ${round.quota}명 통과` : round.type === 'survival' ? `${round.quota}명 남을 때까지 생존` : '최후의 1명이 챔피언';
    this.hud.center.innerHTML = `<div class="intro-card">
      <div class="intro-round">ROUND ${round.idx + 1} / ${round.total}</div>
      <div class="intro-name">${esc(info.name)}</div>
      <div class="intro-desc">${esc(info.desc)}</div>
      <div class="intro-goal">🎯 ${esc(goal)}</div>
      ${ghost ? '<div class="intro-ghost">⚡ 당신은 번개 구름 방해꾼! 선수들 머리 위로 폭탄을 떨어뜨리세요.</div>' : ''}
    </div>`;
  }

  showRoundEnd(o, room, youId) {
    if (!this.hud) return;
    const name = (id) => esc(room.players.find((p) => p.id === id)?.name ?? '?');
    const passed = o.qualified.includes(youId);
    const wasIn = passed || o.eliminated.includes(youId);
    const title = o.last ? '경기 종료!' : !wasIn ? '라운드 종료' : passed ? '통과! 🎉' : '탈락...';
    this.hud.center.innerHTML = `<div class="intro-card ${wasIn && !passed ? 'lost' : ''}">
      <div class="intro-round">${esc(ROUNDS[o.type].name)}</div>
      <div class="intro-name">${title}</div>
      <div class="intro-desc">✅ 통과: ${o.qualified.map(name).join(', ') || '-'}</div>
      ${o.eliminated.length ? `<div class="intro-desc" style="opacity:.8">❌ 탈락: ${o.eliminated.map(name).join(', ')}</div>` : ''}
      ${wasIn && !passed && !o.last ? '<div class="intro-ghost">다음 라운드부터 ⚡방해꾼으로 참여합니다!</div>' : ''}
    </div>`;
  }

  clearCenter() { if (this.hud) this.hud.center.innerHTML = ''; }

  showOut() {
    if (!this.hud) return;
    this.hud.center.innerHTML = `<div class="out-banner">OUT!</div>`;
    setTimeout(() => { if (this.hud && this.hud.center.querySelector('.out-banner')) this.hud.center.innerHTML = ''; }, 2200);
  }

  windArrow(deg) {
    if (!this.hud) return;
    if (deg === null) { this.hudSet('wind', ''); return; }
    const html = `<div class="wind-arrow" style="transform:rotate(${Math.round(deg)}deg)">⬆</div>`;
    if (this.lastHud.wind !== html) { this.lastHud.wind = html; this.hud.wind.innerHTML = html; }
  }

  spectate(name, waiting = false) {
    if (!this.hud) return;
    if (name === null) { this.hudSet('spec', ''); return; }
    this.hudSet('spec', `<div class="spectate">
      <button class="btn gray small" data-act="specPrev">◀</button>
      <div class="pill">${waiting ? '다음 경기를 기다리는 중 · ' : ''}관전 중: <b>${esc(name)}</b></div>
      <button class="btn gray small" data-act="specNext">▶</button>
      <button class="btn gray small" data-act="specAll">전체</button></div>`);
  }

  // ---------- 결과 ----------
  showResults(res, room, youId) {
    this.screen = 'results';
    this.hud = null;
    this.layers.hud.innerHTML = '';
    const winners = res.ranking.filter((r) => r.rank === 1);
    const meWon = res.winners.includes(youId);
    const isHost = room.hostId === youId;
    const humans = room.players.filter((p) => !p.isBot && p.connected);
    const votes = humans.filter((p) => p.rematch).length;
    const myVote = room.players.find((p) => p.id === youId)?.rematch;
    const title = res.draw ? (winners.length ? '공동 우승!' : '무승부!') : `${winners[0]?.name ?? ''} 우승!`;
    const sub = res.draw ? winners.map((w) => w.name).join(', ') + ' 동시 생존/탈락' : meWon ? '축하합니다! 최후의 생존자!' : '다음엔 꼭 이겨 봐요!';
    const rows = res.ranking.map((r) => `
      <li class="${r.rank === 1 ? 'first' : ''}"><span class="rk">${r.rank}</span><span class="dot" style="width:18px;height:18px;border-radius:50%;background:${hex(colorHex(r.look.color))}"></span>
      <span class="grow">${esc(r.name)}${r.id === youId ? ' (나)' : ''}</span><span class="tm">${r.label ? esc(r.label) : r.elimAt != null ? `${fmtTime(r.elimAt)} 탈락` : '생존 🏆'}</span></li>`).join('');
    const elimList = res.rounds ? res.rounds.map(esc).join(' → ') : res.eliminated.length ? res.eliminated.map((e) => `${esc(e.name)}`).join(' → ') : '없음';
    this.layers.main.innerHTML = `
      <div class="screen results">
        <div class="winner-title"><div class="crown">${res.draw ? '🤝' : '🏆'}</div><div class="big">${esc(title)}</div><div class="small">${esc(sub)}</div></div>
        <div class="panel">
          <div class="stats"><span>⏱ 플레이 시간 ${fmtTime(res.duration)}</span><span>${res.rounds ? '🎬 라운드' : '💥 탈락 순서'}: ${elimList}</span></div>
          <ul class="rank-list">${rows}</ul>
          <div class="row">
            <button class="btn green grow" data-act="rematch" ${myVote && !isHost ? 'disabled' : ''}>다시 하기${!isHost && humans.length > 1 ? ` (${votes}/${humans.length})` : ''}</button>
            <button class="btn blue grow" data-act="toLobby" ${isHost ? '' : 'disabled'} title="${isHost ? '' : '방장이 선택합니다'}">대기실로</button>
          </div>
          <div class="hint" style="margin-top:10px">${isHost ? '방장이 다시 하기를 누르면 바로 새 경기가 시작됩니다.' : '모두가 다시 하기를 누르거나 방장이 선택하면 진행됩니다.'} <span id="res-remain"></span></div>
        </div>
      </div>`;
  }

  setResultsRemain(sec) {
    const el = this.root.querySelector('#res-remain');
    if (el) el.textContent = `(${Math.ceil(sec)}초 후 대기실로)`;
  }

  // ---------- 모달 ----------
  showSettings() {
    const seg = (key, opts) => `<div class="seg">${opts.map(([v, n]) => `<button class="${settings[key] === v ? 'on' : ''}" data-act="setSeg" data-k="${key}" data-v="${v}">${n}</button>`).join('')}</div>`;
    this.layers.modal.innerHTML = `
      <div class="screen modal">
        <div class="panel">
          <h2>설정</h2>
          <div class="setting">효과음 <input type="range" min="0" max="1" step="0.05" value="${settings.sfx}" data-set="sfx" /></div>
          <div class="setting">카메라 감도 <input type="range" min="0.3" max="2.5" step="0.1" value="${settings.sensitivity}" data-set="sensitivity" /></div>
          <div class="setting">그래픽 품질 ${seg('quality', [['auto', '자동'], ['low', '낮음'], ['medium', '보통'], ['high', '높음']])}</div>
          <div class="setting">카메라 상하 반전 ${seg('invertY', [[false, '끔'], [true, '켬']])}</div>
          <div class="setting">화면 흔들림 ${seg('shake', [[true, '켬'], [false, '끔']])}</div>
          <div class="setting">FPS 표시 ${seg('showFps', [[false, '끔'], [true, '켬']])}</div>
          ${isTouch() ? `<div class="setting">모바일 화면 ${seg('orientation', [['landscape', '가로 고정'], ['auto', '기기 방향 따름']])}</div>` : ''}
          <div class="hint" style="margin:10px 0">그래픽 품질 변경은 새로고침 후 적용됩니다.</div>
          <button class="btn block" data-act="closeModal">닫기</button>
        </div>
      </div>`;
  }

  showPause(inMatch) {
    this.layers.modal.innerHTML = `
      <div class="screen modal">
        <div class="panel col" style="width:min(340px,100%)">
          <h2>일시 메뉴</h2>
          <div class="hint">온라인 경기는 멈추지 않습니다.</div>
          <button class="btn green block" data-act="closeModal">계속하기</button>
          <button class="btn blue block" data-act="settings">설정</button>
          <button class="btn gray block" data-act="leave">${inMatch ? '경기 나가기' : '방 나가기'}</button>
        </div>
      </div>`;
  }

  closeModal() { this.layers.modal.innerHTML = ''; }
  modalOpen() { return !!this.layers.modal.innerHTML; }

  onSetting(el) {
    const k = el.dataset.set;
    settings[k] = Number(el.value);
    saveSettings();
    if (k === 'sfx') { sfx.setVolume(settings.sfx); sfx.jump(); }
  }

  setSeg(k, v) {
    settings[k] = v === 'true' ? true : v === 'false' ? false : v;
    saveSettings();
    this.showSettings();
    if (k === 'showFps' && this.hud) this.hud.fps.style.display = settings.showFps ? '' : 'none';
    if (k === 'orientation') applyOrientation();
  }

  netWarning(on, text = '서버와 연결이 끊겼습니다. 다시 연결하는 중...') {
    let el = this.layers.toast.querySelector('.netwarn');
    if (!on) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.className = 'netwarn'; this.layers.toast.appendChild(el); }
    el.textContent = text;
  }

  toast(text, ms = 2200) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    this.layers.toast.appendChild(el);
    setTimeout(() => el.remove(), ms);
  }
}
