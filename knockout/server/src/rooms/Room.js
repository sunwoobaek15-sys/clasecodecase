// 방: 대기실, 경기 진행 단계, 메시지 처리, 상태 브로드캐스트.
import { C2S, S2C, PHASE, ERR } from '../../../shared/src/messages.js';
import { COUNTDOWN_SEC, RESULTS_SEC, RECONNECT_GRACE_SEC, MAX_PLAYERS, MIN_PLAYERS, SNAPSHOT_RATE, TICK_RATE, NAME_MAX } from '../../../shared/src/constants.js';
import { COLORS, sanitizeLook, randomLook } from '../../../shared/src/looks.js';
import { Player } from '../players/Player.js';
import { Match } from '../game/Match.js';
import { ROUNDS } from '../../../shared/src/constants.js';

const INTRO_MS = 3500;
const ROUND_END_MS = 4500;

const SNAP_EVERY = Math.round(TICK_RATE / SNAPSHOT_RATE);
const BOT_NAMES = ['말랑이', '통통이', '데굴이', '퐁퐁이', '쿵쿵이', '뿅뿅이', '몽글이', '방울이'];

export function cleanName(name) {
  return String(name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, NAME_MAX);
}

export class Room {
  constructor(code, manager, opts = {}) {
    this.code = code;
    this.manager = manager;
    this.opts = opts;
    this.rand = opts.rand || Math.random;
    this.now = opts.now || (() => Date.now());
    this.players = [];
    this.hostId = null;
    this.phase = PHASE.LOBBY;
    this.phaseEndsAt = 0;
    this.match = null;
    this.results = null;
    this.matchNo = 0;
    this.lastTilesSent = '';
    this.mode = 'show';
    this.show = null;
  }

  get humans() { return this.players.filter((p) => !p.isBot); }
  find(id) { return this.players.find((p) => p.id === id); }
  isEmpty() { return this.humans.length === 0; }

  // ---------- 참가/퇴장 ----------
  addHuman(name, look, conn) {
    if (this.players.length >= MAX_PLAYERS) return { error: ERR.ROOM_FULL };
    const p = new Player({ name, look: this.uniqueLook(look) });
    p.conn = conn;
    p.connected = true;
    this.players.push(p);
    if (!this.hostId) this.hostId = p.id;
    this.manager.registerToken(p.token, this, p);
    this.welcome(p);
    this.broadcastRoom();
    return { player: p };
  }

  uniqueLook(look, self = null) {
    const l = sanitizeLook(look);
    const taken = new Set(this.players.filter((p) => p !== self).map((p) => p.look.color));
    if (taken.has(l.color)) {
      const free = COLORS.find((c) => !taken.has(c.id));
      if (free) l.color = free.id;
    }
    return l;
  }

  addBot() {
    if (this.players.length >= MAX_PLAYERS) return ERR.ROOM_FULL;
    const used = new Set(this.players.map((p) => p.name));
    const name = BOT_NAMES.find((n) => !used.has('🤖' + n)) || '봇';
    const p = new Player({ name: '🤖' + name, look: this.uniqueLook(randomLook(this.rand)), isBot: true });
    p.ready = true;
    this.players.push(p);
    this.broadcastRoom();
    return null;
  }

  removePlayer(p, reason = 'leave') {
    const idx = this.players.indexOf(p);
    if (idx < 0) return;
    if (this.match && this.phase !== PHASE.RESULTS) this.match.forfeit(p);
    // 경기 중이면 결과 기록을 위해 참가자 목록에는 남겨 두고 방 목록에서만 제거
    this.players.splice(idx, 1);
    this.manager.unregisterToken(p.token);
    if (p.conn) {
      p.send({ t: S2C.KICKED, reason });
      p.conn.player = null;
      p.conn = null;
    }
    if (this.hostId === p.id) {
      const next = this.humans.find((h) => h.connected) || this.humans[0];
      this.hostId = next ? next.id : null;
    }
    if (this.isEmpty()) {
      this.manager.destroy(this);
      return;
    }
    this.broadcastRoom();
  }

  onDisconnect(p) {
    p.connected = false;
    p.conn = null;
    p.disconnectedAt = this.now();
    p.ready = false;
    if (this.hostId === p.id) {
      const next = this.humans.find((h) => h.connected);
      if (next) this.hostId = next.id;
    }
    this.broadcastRoom();
  }

  resume(p, conn) {
    if (p.conn && p.conn !== conn) {
      try { p.conn.player = null; p.conn.close(4000, 'replaced'); } catch {}
    }
    p.conn = conn;
    p.connected = true;
    p.disconnectedAt = 0;
    p.resetInputs();
    if (!this.find(this.hostId) || !this.find(this.hostId).connected) this.hostId = p.id;
    this.welcome(p);
    this.broadcastRoom();
  }

  welcome(p) {
    p.send({ t: S2C.WELCOME, you: p.id, token: p.token, code: this.code, lastSeq: p.lastSeq });
    p.send(this.roomMessage());
    if (this.match) {
      p.send({ t: S2C.TILES, s: this.match.world.tiles.join('') });
      p.send({ t: S2C.EVENTS, list: this.match.director.list() });
      if (this.results) p.send({ t: S2C.RESULT, ...this.results });
      if (this.roundOutcome && this.phase === PHASE.ROUND_END) p.send({ t: S2C.ROUND_END, ...this.roundOutcome });
    }
  }

  // ---------- 메시지 ----------
  handle(p, msg) {
    switch (msg.t) {
      case C2S.INPUT:
        p.pushInputs(msg.d);
        return;
      case C2S.READY:
        if (this.phase !== PHASE.LOBBY) return;
        p.ready = !!msg.ready;
        this.broadcastRoom();
        return;
      case C2S.LOOK:
        p.look = this.uniqueLook(msg.look, p);
        this.broadcastRoom();
        return;
      case C2S.NAME: {
        const n = cleanName(msg.name);
        if (n) { p.name = n; this.broadcastRoom(); }
        return;
      }
      case C2S.ADD_BOT:
        if (p.id !== this.hostId) return this.error(p, ERR.NOT_HOST);
        if (this.phase !== PHASE.LOBBY) return this.error(p, ERR.BAD_PHASE);
        { const e = this.addBot(); if (e) this.error(p, e); }
        return;
      case C2S.REMOVE_BOT: {
        if (p.id !== this.hostId) return this.error(p, ERR.NOT_HOST);
        if (this.phase !== PHASE.LOBBY) return this.error(p, ERR.BAD_PHASE);
        const bot = msg.id ? this.find(msg.id) : [...this.players].reverse().find((b) => b.isBot);
        if (bot && bot.isBot) this.removePlayer(bot);
        return;
      }
      case C2S.MODE:
        if (p.id !== this.hostId) return this.error(p, ERR.NOT_HOST);
        if (this.phase !== PHASE.LOBBY) return;
        this.mode = msg.mode === 'classic' ? 'classic' : 'show';
        this.broadcastRoom();
        return;
      case C2S.START:
        if (p.id !== this.hostId) return this.error(p, ERR.NOT_HOST);
        if (this.phase !== PHASE.LOBBY) return this.error(p, ERR.BAD_PHASE);
        { const e = this.canStart(); if (e) return this.error(p, e); }
        this.startMatch();
        return;
      case C2S.REMATCH:
        if (this.phase !== PHASE.RESULTS) return;
        p.rematchVote = true;
        if (p.id === this.hostId || this.humans.filter((h) => h.connected).every((h) => h.rematchVote)) {
          if (this.participants().length >= MIN_PLAYERS) this.startMatch();
          else this.toLobby();
        } else this.broadcastRoom();
        return;
      case C2S.TO_LOBBY:
        if (this.phase !== PHASE.RESULTS) return;
        if (p.id === this.hostId) this.toLobby();
        return;
      case C2S.LEAVE:
        this.removePlayer(p);
        return;
    }
  }

  error(p, msg) {
    p.send({ t: S2C.ERROR, msg });
  }

  participants() {
    return this.players.filter((p) => p.isBot || p.connected);
  }

  canStart() {
    const parts = this.participants();
    if (parts.length < MIN_PLAYERS) return ERR.NOT_ENOUGH;
    if (parts.some((p) => !p.isBot && p.id !== this.hostId && !p.ready)) return ERR.NOT_READY;
    return null;
  }

  // ---------- 경기 단계 ----------
  /** 인원에 따른 라운드 구성. 쇼: 레이스 → 서바이벌 → 결승 */
  static planRounds(n, mode) {
    if (mode === 'classic') return [{ type: 'classic', quota: 1 }];
    if (n <= 2) return [{ type: 'race', quota: 1 }];
    const q1 = Math.min(n - 1, Math.max(2, Math.ceil(n * 0.6)));
    const rounds = [{ type: 'race', quota: q1 }];
    if (q1 >= 3) rounds.push({ type: 'survival', quota: Math.min(q1 - 1, Math.max(2, Math.ceil(q1 * 0.5))) });
    rounds.push({ type: 'final', quota: 1 });
    return rounds;
  }

  startMatch() {
    const parts = this.participants();
    for (const p of this.players) p.rematchVote = false;
    this.matchNo++;
    this.results = null;
    this.show = {
      rounds: Room.planRounds(parts.length, this.mode),
      idx: -1,
      members: new Set(parts.map((p) => p.id)),
      active: new Set(parts.map((p) => p.id)),
      groups: [],
      names: new Map(parts.map((p) => [p.id, { name: p.name, look: p.look, isBot: p.isBot }])),
      time: 0,
    };
    this.startRound(0);
  }

  startRound(idx) {
    const show = this.show;
    show.idx = idx;
    const round = show.rounds[idx];
    // 쇼 멤버 중 접속 중인 사람은 모두 참가: 통과자는 선수, 나머지는 방해꾼
    // 도중에 들어온 사람도 방해꾼으로 참여한다
    const roster = this.players.filter((p) => p.isBot || p.connected);
    for (const p of roster) {
      p.roundActive = show.active.has(p.id);
      p.inMatch = p.roundActive;
    }
    this.match = new Match(roster, { rand: this.rand, events: this.opts.events !== false, type: round.type, quota: round.quota });
    this.roundOutcome = null;
    this.phase = PHASE.INTRO;
    this.phaseEndsAt = this.now() + (this.opts.introMs ?? INTRO_MS);
    this.lastTilesSent = '';
    this.broadcast({ t: S2C.TILES, s: this.match.world.tiles.join('') });
    this.broadcast({ t: S2C.EVENTS, list: [] });
    this.broadcastRoom();
  }

  endRound() {
    const show = this.show;
    const m = this.match;
    const out = m.outcome();
    show.time += m.t;
    const round = show.rounds[show.idx];
    const qualified = out.qualified.filter((id) => show.active.has(id));
    const eliminated = [];
    const firstGroup = show.groups.length;
    for (const g of out.groups) {
      const ids = g.filter((id) => show.active.has(id));
      if (ids.length) { show.groups.push({ ids, round: show.idx }); eliminated.push(...ids); }
    }
    // 결과에 없는(나간) 참가자도 탈락 처리
    const leftover = [...show.active].filter((id) => !qualified.includes(id) && !eliminated.includes(id));
    if (leftover.length) { show.groups.splice(firstGroup, 0, { ids: leftover, round: show.idx }); eliminated.push(...leftover); }
    show.active = new Set(qualified);
    const last = show.idx >= show.rounds.length - 1 || show.active.size <= 1;
    this.roundOutcome = { type: round.type, idx: show.idx, qualified, eliminated, last };
    this.phase = PHASE.ROUND_END;
    this.phaseEndsAt = this.now() + (this.opts.roundEndMs ?? ROUND_END_MS);
    this.broadcast({ t: S2C.ROUND_END, ...this.roundOutcome });
    this.broadcastRoom();
  }

  afterRoundEnd() {
    const show = this.show;
    if (!this.roundOutcome.last && show.active.size >= 2) return this.startRound(show.idx + 1);
    this.finishShow();
  }

  finishShow() {
    const show = this.show;
    const winners = [...show.active];
    const ranking = [];
    const info = (id) => show.names.get(id) || { name: '?', look: {}, isBot: false };
    const roundName = (i) => ROUNDS[show.rounds[i].type].name;
    for (const id of winners) ranking.push({ id, ...info(id), rank: 1, label: '챔피언 🏆' });
    let rank = winners.length + 1;
    for (let i = show.groups.length - 1; i >= 0; i--) {
      const g = show.groups[i];
      for (const id of g.ids) ranking.push({ id, ...info(id), rank, label: `${roundName(g.round)} 탈락` });
      rank += g.ids.length;
    }
    this.results = {
      winners,
      draw: winners.length !== 1,
      ranking,
      duration: Math.round(show.time * 10) / 10,
      rounds: show.rounds.map((r) => ROUNDS[r.type].name),
      eliminated: show.groups.flatMap((g) => g.ids.map((id) => ({ id, name: info(id).name, round: g.round }))),
      matchNo: this.matchNo,
    };
    this.phase = PHASE.RESULTS;
    this.phaseEndsAt = this.now() + RESULTS_SEC * 1000;
    for (const p of this.players) { p.rematchVote = false; if (!p.isBot) p.ready = false; }
    this.broadcast({ t: S2C.RESULT, ...this.results });
    this.broadcastRoom();
  }

  toLobby() {
    this.phase = PHASE.LOBBY;
    this.match = null;
    this.results = null;
    this.show = null;
    for (const p of this.players) { p.inMatch = false; p.rematchVote = false; if (!p.isBot) p.ready = false; }
    this.broadcastRoom();
  }

  // ---------- 틱 ----------
  update() {
    const now = this.now();
    // 재접속 유예 시간이 지난 플레이어 정리 (경기 중에는 결과까지 유지)
    for (const p of [...this.players]) {
      if (!p.isBot && !p.connected && now - p.disconnectedAt > RECONNECT_GRACE_SEC * 1000) {
        if (this.phase === PHASE.LOBBY || this.phase === PHASE.RESULTS || !p.inMatch || !p.state.alive) {
          this.removePlayer(p, 'timeout');
          if (this.manager.rooms.get(this.code) !== this) return;
        }
      }
    }
    if (!this.humans.some((h) => h.connected) && this.humans.every((h) => now - h.disconnectedAt > RECONNECT_GRACE_SEC * 1000)) {
      this.manager.destroy(this);
      return;
    }

    if (this.phase === PHASE.INTRO) {
      this.match.step(true);
      if (now >= this.phaseEndsAt) {
        this.phase = PHASE.COUNTDOWN;
        this.phaseEndsAt = now + COUNTDOWN_SEC * 1000;
        this.broadcastRoom();
      }
    } else if (this.phase === PHASE.COUNTDOWN) {
      this.match.step(true);
      if (now >= this.phaseEndsAt) {
        this.phase = PHASE.PLAYING;
        this.match.players.forEach((p) => p.resetInputs());
        this.broadcastRoom();
      }
    } else if (this.phase === PHASE.PLAYING) {
      this.match.step(false);
      this.flushMatchMessages();
      if (this.match.over) this.endRound();
    } else if (this.phase === PHASE.ROUND_END) {
      this.match.step(true);
      this.flushMatchMessages();
      if (now >= this.phaseEndsAt) this.afterRoundEnd();
    } else if (this.phase === PHASE.RESULTS) {
      this.match.step(true);
      if (now >= this.phaseEndsAt) this.toLobby();
    }
    if (this.match && this.phase !== PHASE.LOBBY && this.match.tick % SNAP_EVERY === 0) this.sendSnapshot();
  }

  flushMatchMessages() {
    const m = this.match;
    if (m.director.tilesChanged) {
      m.director.tilesChanged = false;
      const s = m.world.tiles.join('');
      if (s !== this.lastTilesSent) { this.lastTilesSent = s; this.broadcast({ t: S2C.TILES, s }); }
    }
    if (m.director.changed) {
      m.director.changed = false;
      this.broadcast({ t: S2C.EVENTS, list: m.director.list() });
    }
    if (m.fx.length) { this.broadcast({ t: S2C.FX, list: m.fx }); m.fx = []; }
    if (m.elims.length) {
      for (const e of m.elims) this.broadcast({ t: S2C.ELIM, ...e, alive: m.aliveCount() });
      m.elims = [];
    }
  }

  sendSnapshot() {
    const m = this.match;
    const pj = JSON.stringify(m.snapshotPlayers()) + ',"g":' + JSON.stringify(m.snapshotGhosts());
    const head = '{"t":"s","mt":' + Math.round(m.t * 1000) / 1000 + ',"ph":"' + this.phase + '","ack":';
    for (const p of this.players) {
      if (p.isBot || !p.connected) continue;
      p.send(head + p.lastSeq + ',"p":' + pj + '}');
    }
  }

  roomMessage() {
    const now = this.now();
    return {
      t: S2C.ROOM,
      code: this.code,
      phase: this.phase,
      hostId: this.hostId,
      remain: this.phaseEndsAt ? Math.max(0, (this.phaseEndsAt - now) / 1000) : 0,
      matchNo: this.matchNo,
      mode: this.mode,
      round: this.show && this.show.idx >= 0 ? { idx: this.show.idx, total: this.show.rounds.length, ...this.show.rounds[this.show.idx] } : null,
      outcome: this.phase === PHASE.ROUND_END ? this.roundOutcome : null,
      players: this.players.map((p) => p.publicInfo()),
    };
  }

  broadcastRoom() {
    this.broadcast(this.roomMessage());
  }

  broadcast(msg) {
    const s = JSON.stringify(msg);
    for (const p of this.players) if (!p.isBot) p.send(s);
  }
}
