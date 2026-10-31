// 3D 월드와 경기 진행 표현을 총괄: 캐릭터 동기화, 로컬 입력 예측 틱, 카메라, 이펙트, HUD 데이터.
import * as THREE from 'three';
import { DT, PHYS, GHOST } from '../../../shared/src/constants.js';
import { BTN, FLAG, PHASE } from '../../../shared/src/messages.js';
import { groundAt, daisHeight, TILES } from '../../../shared/src/arena.js';
import { EV } from '../../../shared/src/physics.js';
import { EVENT_INFO } from '../../../shared/src/events.js';
import { colorHex } from '../../../shared/src/looks.js';
import { createRenderer, createScene } from './SceneSetup.js';
import { ArenaView } from '../arena/ArenaView.js';
import { CourseView } from '../arena/CourseView.js';
import { GhostCloud } from '../characters/GhostCloud.js';
import { RACE } from '../../../shared/src/course.js';
import { Character } from '../characters/Character.js';
import { CameraRig } from '../camera/CameraRig.js';
import { Effects } from '../fx/Effects.js';
import { NetSync } from '../network/NetSync.js';
import { sfx } from '../audio/Sfx.js';
import { settings } from '../settings.js';
import { view } from '../view.js';

const _g = { h: 0, vx: 0, vz: 0, mover: -1 };
const MENU_NPCS = [
  { id: 'npc1', look: { color: 'blue', hat: 'crown', outfit: 'cape', acc: 'none', emote: 'dance' } },
  { id: 'npc2', look: { color: 'yellow', hat: 'propeller', outfit: 'overalls', acc: 'glasses', emote: 'wave' } },
  { id: 'npc3', look: { color: 'green', hat: 'beanie', outfit: 'scarf', acc: 'bowtie', emote: 'flex' } },
];

export class Game {
  constructor(container, quality, input) {
    this.quality = quality;
    this.input = input;
    this.renderer = createRenderer(container, quality);
    this.env = createScene(quality);
    this.scene = this.env.scene;
    this.camera = new THREE.PerspectiveCamera(55, view.width / view.height, 0.1, 900);
    this.rig = new CameraRig(this.camera);
    this.arena = new ArenaView(this.scene, quality);
    this.course = new CourseView(this.scene);
    this.clouds = new Map();
    this.fx = new Effects(this.scene, quality);
    this.sync = new NetSync();
    this.chars = new Map();
    this.prev = new Map(); // 원격 플래그 변화 추적
    this.mode = 'menu';
    this.time = 0;
    this.acc = 0;
    this.youId = null;
    this.room = null;
    this.sendInputs = null; // App이 설정
    this.onLocalEvent = null;
    this.announced = new Set();
    this.specIdx = 0;
    this.overview = false;
    this.ghostT = 0;
    this.fpsT = 0; this.fpsN = 0; this.fps = 0;
    this.countdownEnd = 0;
    this.lastCount = null;
    this.outAt = 0;
    this.tmpState = {};

    this.arena.onCrumble = (t) => {
      const am = (t.a0 + t.a1) / 2, rm = (t.r0 + t.r1) / 2;
      this.fx.burst(Math.cos(am) * rm, 0, Math.sin(am) * rm, { count: 10, speed: 4, color: 0x9a7462, size: 0.25, life: 0.8 });
      sfx.crumble(0.6);
    };

    view.onChange(() => this.resize());
    this.resize();
  }

  resize() {
    this.camera.aspect = view.width / view.height;
    // 세로 화면에서는 시야를 넓혀 경기장이 잘 보이게 한다
    this.camera.fov = this.camera.aspect < 0.8 ? 72 : 55;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(view.width, view.height);
  }

  // ---------- 캐릭터 관리 ----------
  ensureChar(id, name, look) {
    let c = this.chars.get(id);
    if (!c) {
      c = new Character({ id, name, look, isLocal: id === this.youId, castShadow: this.quality === 'high' });
      this.scene.add(c.root);
      this.scene.add(c.shadow);
      this.chars.set(id, c);
    } else {
      c.setLook(look);
      if (c.isLocal !== (id === this.youId)) { c.isLocal = id === this.youId; c.labelDrawn = false; }
    }
    return c;
  }

  pruneChars(keep) {
    for (const [id, c] of this.chars) if (!keep.has(id)) { c.dispose(); this.chars.delete(id); this.prev.delete(id); }
  }

  // ---------- 모드 전환 ----------
  setMenu(look) {
    this.mode = 'menu';
    this.setMap(false);
    this.clearClouds();
    this.roundKey = null;
    this.room = null;
    this.arena.reset();
    this.sync.reset();
    this.sync.setEvents([]);
    const keep = new Set(['me', ...MENU_NPCS.map((n) => n.id)]);
    this.pruneChars(keep);
    const me = this.ensureChar('me', settings.name || '나', look);
    me.isLocal = true;
    MENU_NPCS.forEach((n, i) => {
      const c = this.ensureChar(n.id, '', n.look);
      c.label.visible = false;
      c.playEmote(n.look.emote);
    });
    me.label.visible = false;
  }

  updateMenuLook(look) {
    const me = this.chars.get('me');
    if (me) me.setLook(look);
  }

  setMap(race) {
    this.sync.world.course = race ? RACE : null;
    this.arena.root.visible = !race;
    this.course.root.visible = race;
  }

  clearClouds() {
    for (const c of this.clouds.values()) c.dispose();
    this.clouds.clear();
  }

  setRoom(room, youId) {
    const prevPhase = this.room && this.room.phase;
    const prevMatch = this.room && this.room.matchNo;
    this.room = room;
    this.youId = youId;
    const inGamePhase = room.phase !== PHASE.LOBBY;
    if (room.phase === PHASE.LOBBY) {
      if (this.mode !== 'lobby') { this.arena.reset(); this.sync.reset(); this.sync.setEvents([]); this.setMap(false); this.clearClouds(); this.roundKey = null; }
      this.mode = 'lobby';
    } else {
      const roundKey = room.matchNo + ':' + (room.round ? room.round.idx : 0);
      if ((room.phase === PHASE.INTRO || room.phase === PHASE.COUNTDOWN) && this.roundKey !== roundKey) {
        this.roundKey = roundKey;
        this.beginMatch(room);
      }
      this.mode = room.phase === PHASE.RESULTS ? 'results' : 'match';
    }
    const show = new Set();
    for (const p of room.players) {
      if (inGamePhase && !p.inMatch) continue;
      show.add(p.id);
      const c = this.ensureChar(p.id, p.name, p.look);
      c.label.visible = true;
      if (room.phase === PHASE.LOBBY) c.stopEmote();
    }
    // 경기 중 나간 참가자의 캐릭터도 결과까지 남겨 둔다
    if (inGamePhase && this.sync.latest()) for (const id of this.sync.latest().players.keys()) if (this.chars.has(id)) show.add(id);
    this.pruneChars(show);
    if (room.phase === PHASE.COUNTDOWN) this.countdownEnd = performance.now() / 1000 + room.remain;
  }

  beginMatch(room) {
    this.round = room.round;
    this.setMap(room.round && room.round.type === 'race');
    this.clearClouds();
    this.arena.reset();
    this.sync.reset();
    this.sync.setEvents([]);
    this.announced.clear();
    this.prev.clear();
    this.lastCount = null;
    this.outAt = 0;
    this.overview = false;
    this.specIdx = 0;
    this.camSnapped = false;
    for (const c of this.chars.values()) { c.stopEmote(); c.outT = -1; }
  }

  isGhost() {
    const l = this.sync.latest();
    return !!(l && l.ghosts.has(this.youId));
  }

  isSpectator() {
    if (!this.room) return false;
    const me = this.room.players.find((p) => p.id === this.youId);
    return !me || !me.inMatch;
  }

  // ---------- 네트워크 이벤트 ----------
  onSnapshot(m, rtt) {
    this.sync.onSnapshot(m, this.youId, rtt);
  }

  onFx(list) {
    for (const f of list) {
      const mine = f.a === this.youId || f.b === this.youId || f.id === this.youId;
      const d = this.distToCam(f.x, f.y, f.z);
      const vol = Math.max(0.15, Math.min(1, 18 / (d + 4)));
      if (f.k === 'hit') {
        this.fx.hit(f.x, f.y, f.z, f.pw, f.d);
        if (this.sync.world.course) this.course.bump(f.x, f.z);
        sfx.hit(f.pw, mine ? 1 : vol);
        if (mine && settings.shake) this.rig.shake(Math.min(0.6, 0.12 + f.pw * 0.02));
      } else if (f.k === 'bw') {
        this.fx.bombWarn(f.x, f.y, f.z, f.f, GHOST.radius);
        sfx.bombWarn(vol);
      } else if (f.k === 'bx') {
        this.fx.explosion(f.x, f.y, f.z);
        sfx.boom(Math.max(vol, 0.4));
        const L = this.sync.local;
        if (settings.shake && L && L.alive && Math.hypot(L.x - f.x, L.z - f.z) < 6) this.rig.shake(0.6);
      } else if (f.k === 'finish') {
        this.fx.confetti(f.x, f.y, f.z);
        if (mine) { sfx.finish(); if (this.onFinish) this.onFinish(f.n); } else sfx.qualify();
        if (this.onFeed) this.onFeed(f);
      } else if (f.k === 'respawn') {
        this.fx.burst(f.x, f.y + 1, f.z, { count: 16, speed: 4, colors: [0xffffff, 0x8ff7ff], size: 0.15, life: 0.5 });
        if (mine) sfx.respawn();
      } else if (f.k === 'swept') {
        this.fx.hit(f.x, f.y, f.z, 14, true);
        sfx.boing(mine ? 1 : vol);
        if (this.sync.world.course) this.course.bump(f.x, f.z);
        if (mine && settings.shake) this.rig.shake(0.5);
      }
    }
  }

  onElim(m) {
    const c = this.chars.get(m.id);
    const st = this.sync.sample(m.id, this.tmpState) || { x: m.x, y: PHYS.elimY, z: m.z };
    const color = c ? colorHex(c.look.color) : 0xffffff;
    this.fx.elim(st.x, Math.max(st.y, -12), st.z, color);
    sfx.elim(m.id === this.youId ? 1 : 0.6);
    if (m.id === this.youId) {
      this.outAt = performance.now() / 1000;
      sfx.lose();
    }
  }

  distToCam(x, y, z) {
    const p = this.camera.position;
    return Math.hypot(p.x - x, p.y - y, p.z - z);
  }

  // ---------- 로컬 입력 ----------
  fixedTick() {
    const raw = this.input.sample();
    if (this.sync.phase === PHASE.PLAYING && this.isGhost()) {
      const { fx, fz, rx, rz } = this.rig.basis();
      const mx = fx * raw.y + rx * raw.x, mz = fz * raw.y + rz * raw.x;
      return this.sync.tickGhost({ mx, mz, buttons: raw.dash ? BTN.DASH : 0 }, GHOST.speed, this.sync.world.course ? RACE.bounds : null);
    }
    if (!this.sync.canPredict() || this.isSpectator()) return null;
    const { fx, fz, rx, rz } = this.rig.basis();
    const mx = fx * raw.y + rx * raw.x;
    const mz = fz * raw.y + rz * raw.x;
    const buttons = (raw.jump ? BTN.JUMP : 0) | (raw.dash ? BTN.DASH : 0);
    const { ev, packet } = this.sync.tickLocal({ mx, mz, buttons }, this.rtt || 0.08);
    const L = this.sync.local;
    if (ev & EV.JUMP) sfx.jump();
    if (ev & EV.LAND) { sfx.land(Math.min(1, L.landSpeed / 14)); if (L.landSpeed > 8) this.fx.land(L.x, L.y, L.z, 1); }
    if (ev & EV.DASH) { sfx.dash(); }
    return packet;
  }

  // ---------- 프레임 ----------
  frame(dtReal) {
    const dt = Math.min(0.05, dtReal);
    this.time += dt;
    this.fpsT += dtReal; this.fpsN++;
    if (this.fpsT > 0.5) { this.fps = Math.round(this.fpsN / this.fpsT); this.fpsT = 0; this.fpsN = 0; }

    const look = this.input.takeLook();
    if (this.mode === 'match' || this.mode === 'results') this.rig.rotate(look.dx, look.dy);

    // 고정 틱 예측 (60Hz)
    if (this.mode === 'match') {
      this.acc += dtReal;
      if (this.acc > 0.25) this.acc = 0.25;
      const packets = [];
      while (this.acc >= DT) {
        this.acc -= DT;
        const p = this.fixedTick();
        if (p) packets.push(p);
      }
      if (packets.length && this.sendInputs) this.sendInputs(packets);
    } else this.acc = 0;
    this.sync.decayVisual(dt);

    const world = this.sync.world;
    if (this.mode === 'match' || this.mode === 'results') world.t = this.sync.displayTime();

    if (this.mode === 'menu') this.frameMenu(dt);
    else if (this.mode === 'lobby') this.frameLobby(dt);
    else this.frameMatch(dt, world);

    if (this.arena.root.visible) this.arena.update(dt, world, this.time);
    this.course.update(dt, world);
    this.fx.update(dt);
    this.env.update(dt, this.time);
    this.renderer.render(this.scene, this.camera);
  }

  frameMenu(dt) {
    const spots = [{ id: 'me', x: 0, z: 0.6, yaw: 0 }, { id: 'npc1', x: -2.2, z: -0.6, yaw: 0.4 }, { id: 'npc2', x: 2.2, z: -0.6, yaw: -0.4 }, { id: 'npc3', x: 0, z: -2.1, yaw: 0 }];
    for (const s of spots) {
      const c = this.chars.get(s.id);
      if (!c) continue;
      const y = daisHeight(Math.hypot(s.x, s.z));
      c.update(dt, { x: s.x, y, z: s.z, vx: 0, vy: 0, vz: 0, yaw: s.yaw, grounded: true, groundY: y });
    }
    const me = this.chars.get('me');
    this.lobbyCamera(dt, me ? me.root.position : null, { x: 0, y: 1.2, z: 0.2 }, 8.5);
  }

  /** 대기실/메뉴 카메라: 가로 화면에서는 패널 옆, 세로 화면에서는 패널 위에 캐릭터가 보이도록 */
  lobbyCamera(dt, myPos, center, dist) {
    const wide = view.width > view.height * 1.1;
    let focus, d, look;
    if (this.customizing && myPos) {
      d = wide ? 5.2 : 6.5;
      focus = { x: myPos.x + (wide ? 0.5 : 0), y: myPos.y, z: myPos.z };
      look = new THREE.Vector3(0, wide ? 0 : -1.6, 0);
    } else {
      d = wide ? dist : dist + 4;
      focus = { x: center.x - (wide ? d * 0.42 : 0), y: center.y - 0.6, z: center.z };
      look = new THREE.Vector3(0, wide ? 0.3 : -3.2, 0);
    }
    this.rig.update(dt, { mode: 'lobby', focus, yaw: 0, dist: d, lookOffset: look });
  }

  frameLobby(dt) {
    const players = this.room ? this.room.players : [];
    const n = players.length;
    players.forEach((p, i) => {
      const c = this.chars.get(p.id);
      if (!c) return;
      // 반원 형태로 정렬 (간격 고정, 이름표는 높이를 엇갈리게)
      const R = 4.5, step = 1.55 / R;
      const a = (i - (n - 1) / 2) * step;
      const x = Math.sin(a) * R, z = -Math.cos(a) * R + 4.2;
      c.label.position.y = 2.45 + (n > 4 && i % 2 ? 0.5 : 0);
      const y = daisHeight(Math.hypot(x, z));
      let status = '', color = '#ffffff';
      if (p.id === this.room.hostId) { status = '👑 방장'; color = '#ffd23f'; }
      else if (!p.connected) { status = '연결 끊김'; color = '#ff9aa9'; }
      else if (p.ready || p.isBot) { status = '준비 완료'; color = '#7ef0a8'; }
      else { status = '대기 중'; color = '#dfe3f5'; }
      c.setLabel(p.name, status, color);
      c.label.visible = true;
      if ((p.ready || p.isBot) && !c.wasReady) c.playEmote('jump');
      if (!(p.ready || p.isBot)) c.stopEmote();
      if (c.emote && c.emoteT > 0.9) c.stopEmote();
      c.wasReady = p.ready || p.isBot;
      c.update(dt, { x, y, z, vx: 0, vy: 0, vz: 0, yaw: -a * 0.6, grounded: true, groundY: y });
    });
    const mine = this.chars.get(this.youId);
    this.lobbyCamera(dt, mine ? mine.root.position : null, { x: 0, y: 1.2, z: 0.8 }, 9.5);
  }

  frameMatch(dt, world) {
    const sync = this.sync;
    const latest = sync.latest();
    const ids = latest ? [...latest.players.keys()] : [];
    const states = new Map();
    const youPlaying = !this.isSpectator();

    for (const id of ids) {
      const c = this.chars.get(id);
      if (!c) continue;
      let s;
      if (id === this.youId && sync.canPredict()) {
        const L = sync.local;
        s = { x: L.x + sync.vis.x, y: L.y + sync.vis.y, z: L.z + sync.vis.z, vx: L.vx, vy: L.vy, vz: L.vz, yaw: L.yaw, grounded: L.grounded, dashing: L.dashT > 0, stunned: L.stun > 0, out: !L.alive, dashCd: L.dashCd };
      } else {
        const r = sync.sample(id, {});
        if (!r) continue;
        s = { ...r, grounded: !!(r.flags & FLAG.GROUNDED), dashing: !!(r.flags & FLAG.DASHING), stunned: !!(r.flags & FLAG.STUNNED), out: !!(r.flags & FLAG.OUT), disc: !!(r.flags & FLAG.DISCONNECTED) };
        if (id === this.youId && sync.local) s.dashCd = sync.local.dashCd;
        this.remoteFx(id, s, c);
      }
      groundAt(world, s.x, s.z, s.y + 0.3, _g);
      s.groundY = _g.h;
      states.set(id, s);

      // 대시 잔상
      if (s.dashing && this.time - (c.lastGhost || 0) > 0.035) { c.lastGhost = this.time; this.fx.ghost(c, colorHex(c.look.color)); }
      c.label.position.y = 2.45;
      // 이름표 상태
      const p = this.room && this.room.players.find((q) => q.id === id);
      const name = p ? p.name : c.name;
      s.finished = !!(s.flags & FLAG.FINISHED);
      if (s.finished) c.setLabel(name, '완주!', '#ffe14d');
      else if (s.out) c.setLabel(name, 'OUT', '#ff9aa9');
      else if (s.disc) c.setLabel(name, '연결 끊김', '#ffcf9a');
      else if (s.stunned) c.setLabel(name, '💫', '#ffffff');
      else c.setLabel(name, '');
      // 승리 모션
      if (this.mode === 'results' && this.results && this.results.winners.includes(id) && !s.out) {
        if (!c.emote) c.playEmote(c.look.emote);
      }
      c.update(dt, s);
    }

    // HUD용 데이터
    this.hudState = this.collectHud(states, world);

    // 방해꾼 구름
    const latestG = latest ? latest.ghosts : new Map();
    for (const [id, c] of this.clouds) if (!latestG.has(id)) { c.dispose(); this.clouds.delete(id); }
    for (const id of latestG.keys()) {
      let cloud = this.clouds.get(id);
      const p = this.room && this.room.players.find((q) => q.id === id);
      if (!cloud) {
        if (!p) continue;
        cloud = new GhostCloud(id, p.look, p.name, id === this.youId);
        cloud.addTo(this.scene);
        this.clouds.set(id, cloud);
      }
      const g = id === this.youId && sync.ghost ? sync.ghost : sync.sampleGhost(id);
      if (!g) continue;
      groundAt(world, g.x, g.z, 50, _g);
      cloud.update(dt, g.x, g.z, _g.h, 1 - g.cd / GHOST.cooldown, GHOST.height);
    }
    if (this.hudState) {
      const mg = sync.ghost;
      this.hudState.ghost = !!mg && this.mode === 'match';
      if (mg) { this.hudState.dashFrac = 1 - Math.min(1, mg.cd / GHOST.cooldown); this.hudState.dashReady = mg.cd <= 0; }
    }

    // 카메라 대상
    const aliveIds = ids.filter((id) => states.get(id) && !states.get(id).out);
    let focusId = this.youId;
    const me = states.get(this.youId);
    const meOut = !youPlaying || !me || (me.out && performance.now() / 1000 - this.outAt > 1.6);
    if (this.mode === 'results' && this.results) {
      const w = this.results.winners.find((id) => states.get(id)) || ids[0];
      const ws = states.get(w);
      this.rig.update(dt, { mode: 'results', focus: ws && !ws.out ? ws : { x: 0, y: 1.2, z: 0 } });
      return;
    }
    if (sync.ghost && this.mode === 'match' && !this.spectateOverride) {
      groundAt(world, sync.ghost.x, sync.ghost.z, 50, _g);
      const gf = { x: sync.ghost.x, y: _g.h === -Infinity ? 0 : _g.h, z: sync.ghost.z };
      if (!this.camSnapped) { this.rig.snapTo(gf); if (world.course) this.rig.yaw = Math.PI; this.camSnapped = true; }
      const others = [];
      for (const s of states.values()) if (!s.out) others.push(s);
      this.spectating = null;
      this.rig.update(dt, { mode: 'follow', focus: gf, others, ghost: true, race: !!world.course });
      return;
    }
    if (meOut) {
      if (!aliveIds.length) focusId = null;
      else { this.specIdx = ((this.specIdx % aliveIds.length) + aliveIds.length) % aliveIds.length; focusId = aliveIds[this.specIdx]; }
      this.spectating = focusId;
    } else this.spectating = null;
    const fs = focusId && states.get(focusId);
    const focus = fs ? { x: fs.x, y: fs.y, z: fs.z } : { x: 0, y: 0, z: 0 };
    if (!this.camSnapped && fs) { this.rig.snapTo(focus); if (world.course) this.rig.yaw = Math.PI; this.camSnapped = true; }
    const others = [];
    for (const [id, s] of states) if (id !== focusId && !s.out) others.push(s);
    this.rig.update(dt, { mode: 'follow', focus, others, overview: (this.overview || !fs) && !world.course, falling: fs && fs.y < -0.8, race: !!world.course });
  }

  remoteFx(id, s, c) {
    const pv = this.prev.get(id);
    this.prev.set(id, { grounded: s.grounded, dashing: s.dashing, vy: s.vy });
    if (!pv) return;
    const d = this.distToCam(s.x, s.y, s.z);
    const vol = Math.max(0.1, Math.min(0.7, 14 / (d + 4)));
    if (s.dashing && !pv.dashing) sfx.dash(vol);
    if (!s.grounded && pv.grounded && s.vy > 5) sfx.jump(vol);
    if (s.grounded && !pv.grounded && pv.vy < -8) { sfx.land(vol); this.fx.land(s.x, s.y, s.z, 0.6); }
  }

  collectHud(states, world) {
    const roster = [];
    let alive = 0;
    for (const [id, s] of states) {
      const c = this.chars.get(id);
      if (!s.out) alive++;
      roster.push({ name: c ? c.name : '', color: c ? c.look.color : 'white', out: s.out && !s.finished, done: s.finished });
    }
    const me = states.get(this.youId);
    const cd = me && me.dashCd !== undefined ? me.dashCd : 0;
    // 이벤트 알림
    for (const e of world.events) {
      if (world.t >= e.announce && !this.announced.has(e.id)) {
        this.announced.add(e.id);
        const info = e.movers ? EVENT_INFO.movers : EVENT_INFO[e.type];
        if (info && this.onAnnounce) this.onAnnounce(info, e);
      }
    }
    let wind = null;
    for (const e of world.events) if (e.type === 'wind' && world.t >= e.announce && world.t < e.end) wind = e;
    let windDeg = null;
    if (wind) {
      const { fx, fz, rx, rz } = this.rig.basis();
      const wx = Math.cos(wind.angle), wz = Math.sin(wind.angle);
      windDeg = (Math.atan2(wx * rx + wz * rz, wx * fx + wz * fz) * 180) / Math.PI;
    }
    let finished = 0;
    for (const s of states.values()) if (s.finished) finished++;
    return {
      alive, total: states.size, time: Math.max(0, world.t), players: roster, finished, round: this.round,
      dashFrac: 1 - Math.min(1, cd / PHYS.dashCooldown), dashReady: cd <= 0, windDeg, fps: this.fps,
    };
  }
}
