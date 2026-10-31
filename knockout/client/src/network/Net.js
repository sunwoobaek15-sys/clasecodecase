// WebSocket 연결, 자동 재연결, 세션 복구(resume), 핑/RTT 측정.
import { C2S, S2C } from '../../../shared/src/messages.js';
import { session } from '../settings.js';

function serverUrl() {
  const env = import.meta.env.VITE_SERVER_URL;
  if (env) return env.replace(/\/$/, '') + (env.endsWith('/ws') ? '' : '/ws');
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws`;
}

export class Net {
  constructor() {
    this.ws = null;
    this.handlers = {};
    this.connected = false;
    this.retry = 0;
    this.rtt = 0.08;
    this.youId = null;
    this.code = null;
    this.wantSession = false; // 방에 들어가 있는 동안 true → 끊기면 자동 복구
    this.queue = [];
    this.pingTimer = null;
    this.closedByUs = false;
  }

  on(type, fn) { (this.handlers[type] ||= []).push(fn); }
  emit(type, data) { for (const fn of this.handlers[type] || []) fn(data); }

  connect() {
    if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) return;
    const ws = new WebSocket(serverUrl());
    this.ws = ws;
    ws.onopen = () => {
      this.connected = true;
      this.retry = 0;
      this.emit('open');
      const s = session.get();
      if (this.wantSession && s && s.token) this.sendNow({ t: C2S.RESUME, token: s.token });
      for (const m of this.queue.splice(0)) this.sendNow(m);
      clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => this.sendNow({ t: C2S.PING, c: performance.now() }), 2000);
      this.sendNow({ t: C2S.PING, c: performance.now() });
    };
    ws.onmessage = (e) => {
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === S2C.PONG) {
        const rtt = (performance.now() - m.c) / 1000;
        this.rtt = this.rtt * 0.8 + rtt * 0.2;
        this.emit('ping', this.rtt);
        return;
      }
      if (m.t === S2C.WELCOME) {
        this.youId = m.you;
        this.code = m.code;
        this.wantSession = true;
        session.set({ token: m.token, code: m.code });
      }
      if (m.t === S2C.ERROR && m.resumeFailed) {
        this.wantSession = false;
        session.clear();
      }
      if (m.t === S2C.KICKED) {
        this.wantSession = false;
        session.clear();
      }
      this.emit(m.t, m);
    };
    ws.onclose = () => {
      clearInterval(this.pingTimer);
      const was = this.connected;
      this.connected = false;
      if (this.ws === ws) this.ws = null;
      this.emit('close', { was });
      // 지수 백오프 재연결
      const delay = Math.min(5000, 400 * 2 ** this.retry++);
      setTimeout(() => this.connect(), delay);
    };
    ws.onerror = () => {};
  }

  sendNow(m) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m));
  }

  send(m) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m));
    else if (m.t !== C2S.INPUT) this.queue.push(m);
  }

  /** 새로고침 직후 이전 방으로 복귀 시도 */
  tryResume() {
    const s = session.get();
    if (!s || !s.token) return false;
    this.wantSession = true;
    if (this.connected) this.sendNow({ t: C2S.RESUME, token: s.token });
    return true;
  }

  leave() {
    this.send({ t: C2S.LEAVE });
    this.wantSession = false;
    this.youId = null;
    this.code = null;
    session.clear();
  }
}
