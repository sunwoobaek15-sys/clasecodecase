// 앱 진입점: 로딩 → 메뉴/대기실/경기/결과 화면 흐름과 네트워크 이벤트 연결
import './style.css';
import { tryFullscreenLandscape } from './view.js';
import { settings, saveSettings, resolvedQuality, session, isTouch } from './settings.js';
import { Net } from './network/Net.js';
import { UI } from './ui/UI.js';
import { sfx } from './audio/Sfx.js';
import { C2S, S2C, PHASE } from '../../shared/src/messages.js';
import { sanitizeLook } from '../../shared/src/looks.js';

const loadingEl = document.getElementById('loading');
const setProgress = (p, text) => {
  document.getElementById('loading-fill').style.width = p + '%';
  if (text) document.getElementById('loading-text').textContent = text;
};

class App {
  constructor(Game, Input) {
    this.net = new Net();
    this.ui = new UI(document.getElementById('ui'), this);
    this.input = new Input(document.getElementById('stage'), document.getElementById('ui'));
    this.game = new Game(document.getElementById('stage'), resolvedQuality(), this.input);
    this.game.sendInputs = (packets) => this.net.send({ t: C2S.INPUT, d: packets });
    this.game.onAnnounce = (info, e) => {
      this.ui.banner(info.title, info.desc, true, 2600);
      sfx.warn();
      if (e.type === 'wind') setTimeout(() => sfx.wind(), 2400);
    };
    this.game.onFinish = (n) => this.ui.banner('완주!', `${n}등으로 결승선 통과 · 이제 ⚡방해꾼으로 활약하세요`, false, 3000);
    this.game.onFeed = (f) => {
      const p = this.room && this.room.players.find((q) => q.id === f.id);
      this.ui.feed(`🏁 ${p ? p.name : '?'} 완주! (${f.n}등)`);
    };
    this.room = null;
    this.youId = null;
    this.results = null;
    this.practice = false;
    this.goUntil = 0;
    this.input.onEscape = () => {
      if (this.ui.modalOpen()) this.ui.closeModal();
      else if (this.room) this.ui.showPause(this.room.phase !== PHASE.LOBBY);
    };
    this.bindNet();
    this.net.connect();
    if (!this.net.tryResume()) this.toMenu();
    else this.toMenu(true);
    let last = performance.now();
    const loop = (t) => {
      const dt = (t - last) / 1000;
      last = t;
      this.frame(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    // 첫 터치/클릭에서 오디오 활성화 (브라우저 정책)
    const unlock = () => sfx.unlock();
    addEventListener('pointerdown', unlock);
    addEventListener('keydown', unlock);
  }

  myLook() { return settings.look; }
  takenColors() {
    if (!this.room) return new Set();
    return new Set(this.room.players.filter((p) => p.id !== this.youId).map((p) => p.look.color));
  }

  toMenu(resuming = false) {
    this.room = null;
    this.results = null;
    this.input.setEnabled(false);
    this.game.setMenu(settings.look);
    this.game.customizing = false;
    this.ui.closeModal();
    this.ui.showMenu(resuming ? '이전 방에 다시 연결하는 중...' : '');
  }

  bindNet() {
    const n = this.net;
    n.on('open', () => this.ui.netWarning(false));
    n.on('close', () => { if (this.room) this.ui.netWarning(true); });
    n.on('ping', (rtt) => { this.game.rtt = rtt; });
    n.on(S2C.WELCOME, (m) => {
      this.youId = m.you;
      this.game.youId = m.you;
      this.ui.netWarning(false);
      if (this.practice) {
        this.practice = false;
        for (let i = 0; i < 3; i++) n.send({ t: C2S.ADD_BOT });
        n.send({ t: C2S.START });
      }
    });
    n.on(S2C.ROOM, (m) => this.onRoom(m));
    n.on(S2C.SNAPSHOT, (m) => this.game.onSnapshot(m, n.rtt));
    n.on(S2C.TILES, (m) => { this.game.sync.setTiles(m.s); this.game.arena.setTiles(this.game.sync.world.tiles); });
    n.on(S2C.EVENTS, (m) => this.game.sync.setEvents(m.list));
    n.on(S2C.FX, (m) => this.game.onFx(m.list));
    n.on(S2C.ELIM, (m) => {
      this.game.onElim(m);
      const p = this.room && this.room.players.find((q) => q.id === m.id);
      const name = p ? p.name : '플레이어';
      this.ui.feed(`💥 ${name} 탈락! (${m.rank}위)`);
      if (m.id === this.youId) {
        this.ui.showOut();
        const r = this.room && this.room.round;
        if (r && r.type !== 'final' && r.type !== 'classic') setTimeout(() => this.ui.toast('⚡ 번개 구름 방해꾼이 되었습니다! 조준하고 폭탄을 떨어뜨리세요', 3500), 1200);
      }
    });
    n.on(S2C.ROUND_END, (m) => {
      this.ui.showRoundEnd(m, this.room, this.youId);
      if (m.qualified.includes(this.youId)) sfx.qualify();
      else if (m.eliminated.includes(this.youId)) sfx.lose();
    });
    n.on(S2C.RESULT, (m) => {
      this.results = m;
      this.game.results = m;
      const won = m.winners.includes(this.youId);
      sfx.end();
      setTimeout(() => (won ? sfx.win() : null), 500);
      for (const id of m.winners) {
        const c = this.game.chars.get(id);
        if (c) this.game.fx.confetti(c.root.position.x, c.root.position.y, c.root.position.z);
      }
    });
    n.on(S2C.ERROR, (m) => {
      if (m.resumeFailed) { this.toMenu(); return; }
      if (!this.room) this.ui.menuError(m.msg);
      else this.ui.toast(m.msg);
    });
    n.on(S2C.KICKED, (m) => {
      if (m.reason === 'timeout') this.ui.toast('연결이 너무 오래 끊겨 방에서 나갔습니다.');
      this.toMenu();
    });
  }

  onRoom(m) {
    const prev = this.room;
    this.room = m;
    this.game.setRoom(m, this.youId);
    const me = m.players.find((p) => p.id === this.youId);
    if (m.phase === PHASE.LOBBY) {
      this.input.setEnabled(false);
      if (this.ui.screen !== 'lobby') {
        this.ui.closeModal();
        this.ui.showLobby(m, this.youId);
      } else {
        this.ui.updateLobby(m, this.youId);
        if (this.ui.customOpen) this.ui.renderCustomize(settings.look, this.takenColors());
      }
      // 서버가 색상을 바꿨다면(중복) 로컬 프로필에도 반영
      if (me && me.look.color !== settings.look.color) { settings.look = sanitizeLook(me.look); saveSettings(); }
    } else if (m.phase === PHASE.INTRO || m.phase === PHASE.COUNTDOWN || m.phase === PHASE.PLAYING || m.phase === PHASE.ROUND_END) {
      if (this.ui.screen !== 'hud' || (prev && prev.matchNo !== m.matchNo)) { this.ui.showHud(); this.game.customizing = false; }
      if (m.phase === PHASE.INTRO && (!prev || prev.phase !== PHASE.INTRO)) {
        this.ui.showIntro(m.round, !!me && !me.inMatch);
        sfx.start();
      }
      if (m.phase === PHASE.PLAYING && prev && prev.phase === PHASE.COUNTDOWN) { this.goUntil = performance.now() + 800; sfx.start(); }
      // 선수뿐 아니라 방해꾼도 조작한다
      this.input.setEnabled(m.phase === PHASE.PLAYING && !!me && !this.ui.modalOpen());
    } else if (m.phase === PHASE.RESULTS) {
      this.input.setEnabled(false);
      if (this.results) this.ui.showResults(this.results, m, this.youId);
    }
  }

  action(act, data) {
    const n = this.net;
    switch (act) {
      case 'create':
      case 'practice': {
        const { name } = this.ui.menuValues();
        if (!name) return this.ui.menuError('닉네임을 입력해 주세요.');
        settings.name = name; saveSettings();
        this.practice = act === 'practice';
        n.send({ t: C2S.CREATE, name, look: settings.look });
        if (!n.connected) this.ui.menuError('서버에 연결하는 중... 잠시 후 자동으로 진행됩니다.');
        return;
      }
      case 'join': {
        const { name, code } = this.ui.menuValues();
        if (!name) return this.ui.menuError('닉네임을 입력해 주세요.');
        if (code.length !== 4) return this.ui.menuError('4자리 방 코드를 입력해 주세요.');
        settings.name = name; saveSettings();
        n.send({ t: C2S.JOIN, code, name, look: settings.look });
        return;
      }
      case 'customize':
        this.game.customizing = true;
        this.ui.showCustomize(settings.look, this.takenColors());
        return;
      case 'closeCustomize':
        this.game.customizing = false;
        this.ui.hideCustomize();
        return;
      case 'customTab':
        this.ui.customTab = data.k;
        this.ui.renderCustomize(settings.look, this.takenColors());
        return;
      case 'look':
        settings.look = sanitizeLook({ ...settings.look, [data.k]: data.v });
        saveSettings();
        if (this.room) n.send({ t: C2S.LOOK, look: settings.look });
        else this.game.updateMenuLook(settings.look);
        if (data.k === 'emote') {
          const c = this.game.chars.get(this.room ? this.youId : 'me');
          if (c) { c.playEmote(data.v); setTimeout(() => c.emote === data.v && c.stopEmote(), 1800); }
        }
        this.ui.renderCustomize(settings.look, this.takenColors());
        return;
      case 'settings': this.ui.showSettings(); return;
      case 'fullscreen':
        tryFullscreenLandscape().then((ok) => { if (!ok) this.ui.toast('이 브라우저에서는 전체 화면을 쓸 수 없어 화면을 돌려서 가로로 보여 줍니다.'); });
        return;
      case 'setSeg': this.ui.setSeg(data.k, data.v); return;
      case 'closeModal':
        this.ui.closeModal();
        if (this.room && this.room.phase === PHASE.PLAYING) this.onRoom(this.room);
        return;
      case 'pause': this.ui.showPause(true); this.input.setEnabled(false); return;
      case 'ready': {
        const me = this.room.players.find((p) => p.id === this.youId);
        n.send({ t: C2S.READY, ready: !(me && me.ready) });
        return;
      }
      case 'start': n.send({ t: C2S.START }); return;
      case 'mode': n.send({ t: C2S.MODE, mode: data.v }); return;
      case 'addBot': n.send({ t: C2S.ADD_BOT }); return;
      case 'removeBot': n.send({ t: C2S.REMOVE_BOT, id: data.id }); return;
      case 'leave':
        n.leave();
        this.toMenu();
        return;
      case 'copyCode':
        this.copy(this.room.code, '방 코드를 복사했습니다!');
        return;
      case 'shareLink': {
        const url = `${location.origin}${location.pathname}?room=${this.room.code}`;
        if (navigator.share && isTouch()) navigator.share({ title: 'KNOCKOUT', text: `KNOCKOUT 방 코드 ${this.room.code}`, url }).catch(() => {});
        else this.copy(url, '초대 링크를 복사했습니다!');
        return;
      }
      case 'specPrev': this.game.specIdx--; this.game.overview = false; return;
      case 'specNext': this.game.specIdx++; this.game.overview = false; return;
      case 'specAll': this.game.overview = !this.game.overview; return;
      case 'rematch': n.send({ t: C2S.REMATCH }); return;
      case 'toLobby': n.send({ t: C2S.TO_LOBBY }); return;
    }
  }

  copy(text, msg) {
    const done = () => this.ui.toast(msg);
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, () => this.ui.toast(text));
    else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch { this.ui.toast(text); }
      ta.remove();
    }
  }

  frame(dt) {
    this.game.frame(dt);
    const room = this.room;
    if (!room) return;
    const nowS = performance.now() / 1000;
    if (room.phase === PHASE.COUNTDOWN) {
      const remain = this.game.countdownEnd - nowS;
      const n = Math.max(1, Math.ceil(remain));
      if (n !== this.lastCount) { this.lastCount = n; this.ui.countdown(String(n)); sfx.countdown(false); }
    } else if (this.lastCount !== null) {
      this.lastCount = null;
      if (room.phase === PHASE.PLAYING) { this.ui.countdown('GO!'); sfx.countdown(true); setTimeout(() => this.ui.countdown(''), 800); }
      else this.ui.countdown('');
    }
    if ((room.phase === PHASE.PLAYING || room.phase === PHASE.COUNTDOWN || room.phase === PHASE.ROUND_END) && this.game.hudState) {
      const h = this.game.hudState;
      this.ui.updateHud(h);
      this.input.setDashCooldown(h.dashFrac);
      this.input.setDashLabel(!!h.ghost);
      this.ui.windArrow(h.windDeg);
      const spec = this.game.spectating;
      const specName = spec ? this.game.chars.get(spec)?.name : null;
      this.ui.spectate(room.phase === PHASE.PLAYING && !h.ghost && (spec || this.game.isSpectator()) ? specName || '전체' : null, this.game.isSpectator());
    }
    if (room.phase === PHASE.RESULTS) {
      this.resultsEnd ??= nowS + room.remain;
      this.ui.setResultsRemain(this.resultsEnd - nowS);
    } else this.resultsEnd = null;
  }
}

async function main() {
  try {
    setProgress(15, '3D 엔진 불러오는 중...');
    const [{ Game }, { Input }] = await Promise.all([import('./game/Game.js'), import('./controls/Input.js')]);
    setProgress(65, '경기장 만드는 중...');
    await new Promise((r) => setTimeout(r, 30));
    if (document.fonts && document.fonts.load) await Promise.race([document.fonts.load('20px Jua'), new Promise((r) => setTimeout(r, 1500))]);
    window.app = new App(Game, Input);
    setProgress(100, '준비 완료!');
    setTimeout(() => loadingEl.classList.add('hide'), 250);
    setTimeout(() => loadingEl.remove(), 900);
  } catch (e) {
    console.error(e);
    setProgress(100, '불러오기에 실패했습니다: ' + (e && e.message ? e.message : e) + ' — 새로고침해 주세요.');
  }
}
main();
