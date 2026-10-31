import { Room, cleanName } from './Room.js';
import { C2S, S2C, ERR } from '../../../shared/src/messages.js';
import { ROOM_CODE_LENGTH } from '../../../shared/src/constants.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class RoomManager {
  constructor(opts = {}) {
    this.opts = opts;
    this.rooms = new Map();
    this.tokens = new Map();
  }

  newCode() {
    for (;;) {
      let c = '';
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
      if (!this.rooms.has(c)) return c;
    }
  }

  registerToken(token, room, player) { this.tokens.set(token, { room, player }); }
  unregisterToken(token) { this.tokens.delete(token); }

  destroy(room) {
    for (const p of room.players) this.tokens.delete(p.token);
    this.rooms.delete(room.code);
  }

  update() {
    for (const room of [...this.rooms.values()]) room.update();
  }

  /** 연결(conn)에서 온 메시지를 처리. conn.player가 있으면 방으로 전달. */
  handle(conn, msg) {
    if (!msg || typeof msg.t !== 'string') return;
    if (msg.t === C2S.PING) {
      conn.send(JSON.stringify({ t: S2C.PONG, c: msg.c, s: Date.now() }));
      return;
    }
    if (conn.player) {
      const { room, player } = conn.player;
      if (msg.t === C2S.CREATE || msg.t === C2S.JOIN || msg.t === C2S.RESUME) {
        // 다른 방으로 이동하려면 먼저 현재 방에서 나간다
        room.removePlayer(player);
        conn.player = null;
      } else {
        room.handle(player, msg);
        if (msg.t === C2S.LEAVE) conn.player = null;
        return;
      }
    }
    const err = (m) => conn.send(JSON.stringify({ t: S2C.ERROR, msg: m, fatal: true }));
    if (msg.t === C2S.CREATE) {
      const name = cleanName(msg.name);
      if (!name) return err(ERR.BAD_NAME);
      const room = new Room(this.newCode(), this, this.opts);
      this.rooms.set(room.code, room);
      const { player } = room.addHuman(name, msg.look, conn);
      conn.player = { room, player };
    } else if (msg.t === C2S.JOIN) {
      const name = cleanName(msg.name);
      if (!name) return err(ERR.BAD_NAME);
      const room = this.rooms.get(String(msg.code || '').toUpperCase().trim());
      if (!room) return err(ERR.ROOM_NOT_FOUND);
      const r = room.addHuman(name, msg.look, conn);
      if (r.error) return err(r.error);
      conn.player = { room, player: r.player };
    } else if (msg.t === C2S.RESUME) {
      const entry = this.tokens.get(String(msg.token || ''));
      if (!entry || this.rooms.get(entry.room.code) !== entry.room) {
        conn.send(JSON.stringify({ t: S2C.ERROR, msg: ERR.RESUME_FAILED, resumeFailed: true }));
        return;
      }
      entry.room.resume(entry.player, conn);
      conn.player = { room: entry.room, player: entry.player };
    }
  }

  disconnect(conn) {
    if (!conn.player) return;
    const { room, player } = conn.player;
    conn.player = null;
    if (player.conn === conn) room.onDisconnect(player);
  }
}
