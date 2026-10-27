/* SECTOR ZERO — 화면 표시: 체력, 탄약, 점수, 레이더, 피격 방향, 알림 */
(function (root) {
  'use strict';
  const SZ = (root.SZ = root.SZ || {});

  const $ = (id) => document.getElementById(id);
  const fmt = (n) => Math.round(n).toLocaleString('ko-KR');

  let el = {};
  const last = {};
  let radarCtx = null;
  let mapImg = null;
  let bannerTimer = 0;
  let hitTimer = 0;
  const dmgPool = [];

  /** 값이 바뀔 때만 DOM을 고쳐요 */
  function text(key, node, value) {
    if (last[key] === value) return;
    last[key] = value;
    node.textContent = value;
  }
  function toggle(key, node, show) {
    if (last[key] === show) return;
    last[key] = show;
    node.hidden = !show;
  }

  function init() {
    el = {
      hud: $('hud'),
      score: $('h-score'),
      combo: $('h-combo'),
      wave: $('h-wave'),
      left: $('h-left'),
      hp: $('h-hp'),
      hpbar: $('h-hpbar'),
      healthBox: document.querySelector('.hud-health'),
      ammo: $('h-ammo'),
      reserve: $('h-reserve'),
      wname: $('h-wname'),
      cal: $('h-cal'),
      slots: Array.from(document.querySelectorAll('.slots li')),
      cross: $('crosshair'),
      hit: $('hitmarker'),
      ring: $('reload-ring'),
      ringArc: document.querySelector('#reload-ring circle.arc'),
      prompt: $('prompt'),
      banner: $('banner'),
      bannerTitle: document.querySelector('#banner b'),
      bannerSub: document.querySelector('#banner span'),
      feed: $('feed'),
      dmg: $('dmg'),
      vignette: $('vignette'),
      radar: $('radar'),
    };
    radarCtx = el.radar.getContext('2d');
    for (let i = 0; i < 6; i++) {
      const d = document.createElement('i');
      el.dmg.appendChild(d);
      dmgPool.push({ node: d, t: 0, ang: 0 });
    }
  }

  /** 레이더용 맵 그림 (칸마다 4px) */
  function setLevel(lv) {
    const L = SZ.level;
    const k = 4;
    mapImg = document.createElement('canvas');
    mapImg.width = lv.w * k;
    mapImg.height = lv.h * k;
    const c = mapImg.getContext('2d');
    c.fillStyle = 'rgba(120, 200, 230, 0.10)';
    c.fillRect(0, 0, mapImg.width, mapImg.height);
    for (let z = 0; z < lv.h; z++) {
      for (let x = 0; x < lv.w; x++) {
        const h = L.heightAt(lv, x, z);
        if (h >= L.WALL_H) c.fillStyle = 'rgba(160, 225, 255, 0.75)';
        else if (h > 0) c.fillStyle = 'rgba(160, 225, 255, 0.32)';
        else continue;
        c.fillRect(x * k, z * k, k, k);
      }
    }
  }

  function show(on) {
    el.hud.hidden = !on;
  }

  /** 매 프레임 상태 반영. s: game.snapshot() */
  function update(s, dt) {
    text('score', el.score, fmt(s.score));
    const comboOn = s.combo > 1;
    toggle('comboOn', el.combo, comboOn);
    if (comboOn) text('combo', el.combo, '콤보 ×' + s.comboMul.toFixed(2).replace(/0$/, '').replace(/\.0$/, ''));
    text('wave', el.wave, String(s.wave));
    text('left', el.left, String(s.left));
    text('hp', el.hp, String(Math.ceil(s.hp)));
    const hpPct = Math.max(0, s.hp / s.maxHp);
    if (last.hpPct !== hpPct) {
      last.hpPct = hpPct;
      el.hpbar.style.transform = 'scaleX(' + hpPct + ')';
      el.healthBox.classList.toggle('low', hpPct <= 0.3);
    }
    text('ammo', el.ammo, String(s.ammo));
    text('reserve', el.reserve, s.reserve === Infinity ? '/ ∞' : '/ ' + s.reserve);
    text('wname', el.wname, s.weaponName);
    text('cal', el.cal, s.caliber);
    if (last.slot !== s.slot) {
      last.slot = s.slot;
      el.slots.forEach((li, i) => li.classList.toggle('on', i === s.slot));
    }
    el.ammo.classList.toggle('empty', s.ammo === 0);

    // 조준선: 탄 퍼짐만큼 벌어져요
    const gap = Math.round(Math.max(3, s.spreadPx));
    if (last.gap !== gap) {
      last.gap = gap;
      el.cross.style.setProperty('--gap', gap + 'px');
    }
    const crossHidden = s.aim > 0.85 && s.weaponId !== 'shotgun';
    el.cross.classList.toggle('ads', crossHidden);

    // 재장전 원
    toggle('ring', el.ring, s.reloading);
    if (s.reloading && el.ringArc) el.ringArc.style.strokeDashoffset = String(100 - Math.round(s.reloadPct * 100));

    let prompt = '';
    if (s.ammo === 0 && !s.reloading) prompt = s.reserve > 0 ? (s.touch ? '장전 버튼으로 재장전' : 'R 키로 재장전') : '탄약 없음 · 다른 무기로 바꾸세요';
    else if (s.hint) prompt = s.hint;
    toggle('promptOn', el.prompt, !!prompt);
    if (prompt) text('prompt', el.prompt, prompt);

    // 빨간 테두리: 맞은 직후 + 체력이 낮을 때 깜빡임
    const low = hpPct <= 0.3 && s.hp > 0 ? 0.35 + 0.25 * Math.sin(s.time * 6) : 0;
    const v = Math.min(1, s.hurt * 0.9 + low);
    if (Math.abs((last.vig || 0) - v) > 0.01) {
      last.vig = v;
      el.vignette.style.opacity = v.toFixed(2);
    }

    if (hitTimer > 0) {
      hitTimer -= dt;
      if (hitTimer <= 0) el.hit.className = 'hitmarker';
    }
    if (bannerTimer > 0) {
      bannerTimer -= dt;
      if (bannerTimer <= 0) el.banner.classList.remove('on');
    }
    for (const d of dmgPool) {
      if (d.t <= 0) continue;
      d.t -= dt;
      const rel = s.yaw - d.ang;
      d.node.style.transform = 'rotate(' + (rel * 180) / Math.PI + 'deg)';
      d.node.style.opacity = Math.max(0, Math.min(1, d.t * 1.5)).toFixed(2);
    }
    drawRadar(s);
  }

  function drawRadar(s) {
    const c = radarCtx;
    const cv = el.radar;
    const size = cv.width;
    const half = size / 2;
    const scale = (half - 6) / 22; // 반지름 22m
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, size, size);
    c.save();
    c.beginPath();
    c.arc(half, half, half - 2, 0, Math.PI * 2);
    c.clip();
    c.fillStyle = 'rgba(6, 12, 16, 0.72)';
    c.fillRect(0, 0, size, size);
    c.translate(half, half);
    c.rotate(s.yaw);
    c.translate(-s.px * scale, -s.pz * scale);
    if (mapImg) {
      const k = (SZ.level.CELL * scale) / 4;
      c.imageSmoothingEnabled = false;
      c.drawImage(mapImg, 0, 0, mapImg.width * k, mapImg.height * k);
    }
    for (const p of s.pickups) {
      c.fillStyle = p.kind === 'health' ? '#5ee08a' : '#ffc14d';
      c.fillRect(p.x * scale - 3, p.z * scale - 3, 6, 6);
    }
    for (const e of s.enemies) {
      c.fillStyle = e.type === 'brute' ? '#ff9a3c' : '#ff4a3d';
      c.beginPath();
      c.arc(e.x * scale, e.z * scale, e.type === 'brute' ? 5 : 3.5, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
    // 가운데: 나 (위쪽이 보는 방향)
    c.fillStyle = '#e6f6ff';
    c.beginPath();
    c.moveTo(half, half - 7);
    c.lineTo(half + 5, half + 5);
    c.lineTo(half, half + 2);
    c.lineTo(half - 5, half + 5);
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(69, 214, 255, 0.5)';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(half, half, half - 2, 0, Math.PI * 2);
    c.stroke();
  }

  /** 명중 표시: kind = 'hit' | 'crit' | 'kill' */
  function hit(kind) {
    el.hit.className = 'hitmarker on ' + kind;
    // 같은 클래스를 다시 줘도 애니메이션이 처음부터 돌도록
    void el.hit.offsetWidth;
    hitTimer = kind === 'kill' ? 0.32 : 0.16;
  }

  /** 맞은 방향 표시: worldYaw = 공격이 날아온 쪽을 보는 요 */
  function damageFrom(worldYaw) {
    let slot = dmgPool.find((d) => d.t <= 0) || dmgPool.reduce((a, b) => (a.t < b.t ? a : b));
    slot.t = 1.1;
    slot.ang = worldYaw;
  }

  function banner(title, sub, dur) {
    el.bannerTitle.textContent = title;
    el.bannerSub.textContent = sub || '';
    el.banner.hidden = false;
    el.banner.classList.remove('on');
    void el.banner.offsetWidth;
    el.banner.classList.add('on');
    bannerTimer = dur || 2.4;
  }

  /** 오른쪽 알림 줄 (처치, 보급) */
  function feed(msg, kind) {
    const row = document.createElement('p');
    row.className = 'feed-row ' + (kind || '');
    row.textContent = msg;
    el.feed.appendChild(row);
    while (el.feed.children.length > 5) el.feed.firstChild.remove();
    setTimeout(() => row.classList.add('out'), 1700);
    setTimeout(() => row.remove(), 2200);
  }

  function reset() {
    Object.keys(last).forEach((k) => delete last[k]);
    el.feed.textContent = '';
    dmgPool.forEach((d) => {
      d.t = 0;
      d.node.style.opacity = '0';
    });
    el.banner.classList.remove('on');
    bannerTimer = 0;
    el.vignette.style.opacity = '0';
  }

  SZ.hud = { init, setLevel, show, update, hit, damageFrom, banner, feed, reset };
})(typeof window !== 'undefined' ? window : globalThis);
