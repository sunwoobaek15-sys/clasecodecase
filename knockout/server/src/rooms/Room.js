// 방: 대기실, 경기 진행 단계, 메시지 처리, 상태 브로드캐스트.
import { C2S, S2C, PHASE, ERR } from '../../../shared/src/messages.js';
import { COUNTDOWN_SEC, RESULTS_SEC, RECONNECT_GRACE_SEC, MAX_PLAYERS, MIN_PLAYERS, SNAPSHOT_RATE, TICK_RATE, NAME_MAX } from '../../../shared/src/constants.js';
import { COLORS, sanitizeLook, randomLook } from '../../../shared/src/looks.js';
import { Player } from '../players/Player.js';
import { Match } from '../game/Match.js';

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
    if (this.match && p.inMatch && this.phase !== PHASE.RESULTS) this.match.forfeit(p);
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
  startMatch() {
    const parts = this.participants();
    for (const p of this.players) { p.inMatch = parts.includes(p); p.rematchVote = false; }
    this.match = new Match(parts, { rand: this.rand, events: this.opts.events !== false });
    this.matchNo++;
    this.results = null;
    this.phase = PHASE.COUNTDOWN;
    this.phaseEndsAt = this.now() + COUNTDOWN_SEC * 1000;
    this.lastTilesSent = '';
    this.broadcast({ t: S2C.TILES, s: this.match.world.tiles.join('') });
    this.broadcast({ t: S2C.EVENTS, list: [] });
    this.broadcastRoom();
  }

  finishMatch() {
    const m = this.match;
    const ranking = m.players
      .map((p) => ({ id: p.id, name: p.name, look: p.look, isBot: p.isBot, rank: p.rank || 1, elimAt: p.elimAt ? Math.round(p.elimAt * 10) / 10 : null }))
      .sort((a, b) => a.rank - b.rank || (b.elimAt ?? 1e9) - (a.elimAt ?? 1e9));
    const winners = ranking.filter((r) => r.rank === 1);
    this.results = {
      winners: winners.map((w) => w.id),
      draw: winners.length !== 1,
      ranking,
      duration: Math.round(m.t * 10) / 10,
      eliminated: m.players.filter((p) => p.elimAt).sort((a, b) => a.elimAt - b.elimAt).map((p) => ({ id: p.id, name: p.name, at: Math.round(p.elimAt * 10) / 10, rank: p.rank })),
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

    if (this.phase === PHASE.COUNTDOWN) {
      this.match.step(true);
      if (now >= this.phaseEndsAt) {
        this.phase = PHASE.PLAYING;
        this.match.players.forEach((p) => p.resetInputs());
        this.broadcastRoom();
      }
    } else if (this.phase === PHASE.PLAYING) {
      this.match.step(false);
      this.flushMatchMessages();
      if (this.match.over) this.finishMatch();
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
    const pj = JSON.stringify(m.snapshotPlayers());
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
