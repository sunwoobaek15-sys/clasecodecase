/* GAME 01 — KIMCHI RUN
 * 한국 시장 골목을 달리며 김치 재료(배추, 무, 마늘, 고춧가루, 소금)를 모으고,
 * 다 모으면 부엌에서 양념을 버무려 김치를 완성하는 러너 게임.
 * 모든 그림은 Canvas 로 직접 그린다 (외부 이미지 없음). */
(function (KK) {
  'use strict';

  const W = 960;
  const H = 540;
  const GROUND = 456;
  const TIME_LIMIT = 60;
  const MAX_HEARTS = 3;
  const GRAVITY = 2300;
  const JUMP_V = 860;
  const DJUMP_V = 740;
  const OUT = '#3b2620';

  const ING = [
    { id: 'cabbage', need: 3, points: 100 },
    { id: 'radish', need: 2, points: 80 },
    { id: 'garlic', need: 3, points: 60 },
    { id: 'chili', need: 2, points: 120 },
    { id: 'salt', need: 2, points: 70 },
  ];
  const ING_BY_ID = {};
  ING.forEach((i) => (ING_BY_ID[i.id] = i));
  const OBST = { crate: { w: 56, h: 52 }, jar: { w: 58, h: 70 }, stack: { w: 56, h: 100 } };

  KK.i18n.add({
    en: {
      'kr.goal': 'Run through the market lane and collect every ingredient on the list before time runs out. Then mix the seasoning and make kimchi!',
      'kr.ctrlKeys': 'Keyboard: ← → or A D to move, Space / ↑ to jump. Press jump again in the air for a double jump. P or Esc pauses.',
      'kr.ctrlTouch': 'Touch: ◀ ▶ buttons to move, JUMP to jump (tap twice for a double jump). You can also tap the game screen to jump.',
      'kr.avoid': 'Avoid wooden crates and onggi jars — each bump costs a heart. Grab a floating heart to heal.',
      'kr.ing.cabbage': 'Napa cabbage',
      'kr.ing.radish': 'Korean radish',
      'kr.ing.garlic': 'Garlic',
      'kr.ing.chili': 'Chili powder',
      'kr.ing.salt': 'Salt',
      'kr.sub.cabbage': 'baechu · 배추',
      'kr.sub.radish': 'mu · 무',
      'kr.sub.garlic': 'maneul · 마늘',
      'kr.sub.chili': 'gochugaru · 고춧가루',
      'kr.sub.salt': 'sogeum · 소금',
      'kr.heart': 'Heart',
      'kr.extra': 'Extra',
      'kr.combo': 'Combo ×{n}',
      'kr.allCollected': 'All ingredients collected!',
      'kr.toKitchen': "Let's make kimchi!",
      'kr.step.salt': 'Step 1 · Salt the cabbage',
      'kr.step.mix': 'Step 2 · Mix the seasoning!',
      'kr.step.spread': 'Step 3 · Spread the seasoning and pack the jar',
      'kr.step.done': 'Kimchi complete!',
      'kr.mixPrompt': 'Tap fast or press SPACE to mix!',
      'kr.perfect': 'Perfect mix!',
      'kr.goodMix': 'Nicely mixed!',
      'kr.timeUp': "Time's up!",
      'kr.crashed': 'Out of hearts!',
      'kr.resultWin': 'Kimchi complete!',
      'kr.resultFail': 'No kimchi this time',
      'kr.missing': 'Still needed: {list}',
      'kr.bd.ingredients': 'Ingredients',
      'kr.bd.combo': 'Combo bonus',
      'kr.bd.mix': 'Mixing bonus',
      'kr.bd.time': 'Time bonus',
      'kr.bd.hearts': 'Heart bonus',
      'kr.factTitle': 'Kimjang',
      'kr.fact':
        'Kimjang — making and sharing kimchi together before winter — was added to UNESCO’s list of the Intangible Cultural Heritage of Humanity in 2013. Napa cabbage is salted first, then coated with a seasoning paste of gochugaru (red chili powder), garlic, radish and other ingredients.',
      'badge.kr_first.name': 'First Kimchi',
      'badge.kr_first.desc': 'Complete Kimchi Run.',
      'badge.kr_flawless.name': 'Flawless Run',
      'badge.kr_flawless.desc': 'Make kimchi without losing a heart.',
      'badge.kr_speed.name': 'Speedy Chef',
      'badge.kr_speed.desc': 'Collect everything within 35 seconds.',
      'badge.kr_combo.name': 'Combo Collector',
      'badge.kr_combo.desc': 'Reach a ×10 collection combo.',
      'badge.kr_mix.name': 'Perfect Seasoning',
      'badge.kr_mix.desc': 'Get a perfect mix in the kitchen.',
    },
    ko: {
      'kr.goal': '제한 시간 안에 시장 골목을 달리며 목록에 있는 재료를 모두 모으세요. 그다음 양념을 버무려 김치를 완성해요!',
      'kr.ctrlKeys': '키보드: ← → 또는 A D로 이동, Space / ↑로 점프. 공중에서 한 번 더 누르면 2단 점프. P 또는 Esc로 일시정지.',
      'kr.ctrlTouch': '터치: ◀ ▶ 버튼으로 이동, 점프 버튼으로 점프 (두 번 누르면 2단 점프). 게임 화면을 탭해도 점프해요.',
      'kr.avoid': '나무 상자와 옹기를 피하세요. 부딪히면 하트가 하나 줄어요. 떠 있는 하트를 먹으면 회복돼요.',
      'kr.ing.cabbage': '배추',
      'kr.ing.radish': '무',
      'kr.ing.garlic': '마늘',
      'kr.ing.chili': '고춧가루',
      'kr.ing.salt': '소금',
      'kr.sub.cabbage': 'Napa cabbage',
      'kr.sub.radish': 'Korean radish',
      'kr.sub.garlic': 'Garlic',
      'kr.sub.chili': 'Red chili powder',
      'kr.sub.salt': 'Salt',
      'kr.heart': '하트',
      'kr.extra': '추가',
      'kr.combo': '콤보 ×{n}',
      'kr.allCollected': '재료를 모두 모았어요!',
      'kr.toKitchen': '이제 김치를 담가요!',
      'kr.step.salt': '1단계 · 배추 절이기',
      'kr.step.mix': '2단계 · 양념 버무리기!',
      'kr.step.spread': '3단계 · 양념 바르고 옹기에 담기',
      'kr.step.done': '김치 완성!',
      'kr.mixPrompt': '화면을 빠르게 탭하거나 SPACE를 눌러 섞어요!',
      'kr.perfect': '완벽한 양념!',
      'kr.goodMix': '잘 섞였어요!',
      'kr.timeUp': '시간 종료!',
      'kr.crashed': '하트를 모두 잃었어요!',
      'kr.resultWin': '김치 완성!',
      'kr.resultFail': '이번엔 김치를 못 만들었어요',
      'kr.missing': '부족한 재료: {list}',
      'kr.bd.ingredients': '재료 점수',
      'kr.bd.combo': '연속 수집 보너스',
      'kr.bd.mix': '버무리기 보너스',
      'kr.bd.time': '남은 시간 보너스',
      'kr.bd.hearts': '하트 보너스',
      'kr.factTitle': '김장',
      'kr.fact':
        '겨울을 앞두고 여럿이 함께 김치를 담가 나누는 김장 문화는 2013년 유네스코 인류무형문화유산에 등재되었어요. 배추를 먼저 소금에 절인 뒤, 고춧가루·마늘·무 등으로 만든 양념을 골고루 발라 만들어요.',
      'badge.kr_first.name': '첫 김치',
      'badge.kr_first.desc': '김치 런을 완성했어요.',
      'badge.kr_flawless.name': '무사고 달리기',
      'badge.kr_flawless.desc': '하트를 잃지 않고 김치를 완성했어요.',
      'badge.kr_speed.name': '스피드 셰프',
      'badge.kr_speed.desc': '35초 안에 재료를 모두 모았어요.',
      'badge.kr_combo.name': '콤보 수집가',
      'badge.kr_combo.desc': '연속 수집 ×10을 달성했어요.',
      'badge.kr_mix.name': '완벽한 양념',
      'badge.kr_mix.desc': '부엌에서 완벽하게 버무렸어요.',
    },
  });

  /* =====================================================================
   * 그림 도구
   * ===================================================================== */
  function ell(c, x, y, rx, ry, rot) {
    c.beginPath();
    c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot || 0, 0, Math.PI * 2);
  }
  function rrect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function fs(c, fill) {
    c.fillStyle = fill;
    c.fill();
    c.stroke();
  }
  function hex(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mixColor(a, b, k) {
    const A = hex(a);
    const B = hex(b);
    const m = (i) => Math.round(A[i] + (B[i] - A[i]) * k);
    return `rgb(${m(0)},${m(1)},${m(2)})`;
  }
  function text(c, str, x, y, size, fill, o) {
    o = o || {};
    c.save();
    c.font = `${o.weight || 700} ${size}px ${KK.ui.FONT}`;
    c.textAlign = o.align || 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.lineWidth = o.lw || size * 0.22;
    c.strokeStyle = o.stroke || OUT;
    c.strokeText(str, x, y);
    c.fillStyle = fill;
    c.fillText(str, x, y);
    c.restore();
  }
  function star(c, x, y, r, rot) {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = rot + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.45 : r;
      c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    c.closePath();
  }

  /* ----- 재료 그림 (단위 좌표 -1..1 에 그린 뒤 크기를 맞춘다) ----- */
  const ITEM_ART = {
    cabbage(c) {
      c.rotate(-0.45);
      ell(c, 0, 0.12, 0.5, 0.86);
      fs(c, '#f2f5dc');
      c.beginPath();
      c.moveTo(-0.5, 0.08);
      c.bezierCurveTo(-0.62, -0.62, -0.28, -0.98, 0, -0.98);
      c.bezierCurveTo(0.28, -0.98, 0.62, -0.62, 0.5, 0.08);
      c.quadraticCurveTo(0.34, 0.3, 0.17, 0.06);
      c.quadraticCurveTo(0, 0.32, -0.17, 0.06);
      c.quadraticCurveTo(-0.34, 0.3, -0.5, 0.08);
      c.closePath();
      fs(c, '#79c957');
      c.beginPath();
      c.moveTo(-0.2, 0.02);
      c.bezierCurveTo(-0.32, -0.45, -0.12, -0.8, 0.04, -0.84);
      c.bezierCurveTo(0.24, -0.6, 0.22, -0.2, 0.12, 0.04);
      c.closePath();
      c.fillStyle = '#a5df7a';
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,.9)';
      c.lineWidth = 0.07;
      c.beginPath();
      c.moveTo(0, 0.1);
      c.lineTo(0, -0.72);
      c.moveTo(-0.24, 0.1);
      c.quadraticCurveTo(-0.3, -0.2, -0.34, -0.48);
      c.moveTo(0.24, 0.1);
      c.quadraticCurveTo(0.3, -0.2, 0.34, -0.48);
      c.stroke();
      c.strokeStyle = 'rgba(160,175,120,.6)';
      c.beginPath();
      c.moveTo(-0.22, 0.4);
      c.lineTo(-0.2, 0.78);
      c.moveTo(0.22, 0.4);
      c.lineTo(0.2, 0.78);
      c.stroke();
    },
    radish(c) {
      c.fillStyle = '#5fb84a';
      [
        [-0.22, -0.82, -0.5],
        [0, -0.9, 0],
        [0.22, -0.82, 0.5],
      ].forEach(([x, y, r]) => {
        ell(c, x, y, 0.15, 0.32, r);
        fs(c, '#5fb84a');
      });
      c.beginPath();
      c.moveTo(-0.4, -0.52);
      c.quadraticCurveTo(-0.44, 0.45, -0.12, 0.8);
      c.quadraticCurveTo(0, 0.96, 0.12, 0.8);
      c.quadraticCurveTo(0.44, 0.45, 0.4, -0.52);
      c.quadraticCurveTo(0, -0.68, -0.4, -0.52);
      c.closePath();
      const g = c.createLinearGradient(0, -0.6, 0, 0.9);
      g.addColorStop(0, '#bfe58e');
      g.addColorStop(0.38, '#eef7e0');
      g.addColorStop(1, '#ffffff');
      fs(c, g);
      c.strokeStyle = 'rgba(120,140,100,.45)';
      c.lineWidth = 0.05;
      c.beginPath();
      c.moveTo(-0.22, 0.1);
      c.lineTo(-0.1, 0.1);
      c.moveTo(0.08, 0.34);
      c.lineTo(0.2, 0.34);
      c.moveTo(-0.16, 0.52);
      c.lineTo(-0.06, 0.52);
      c.stroke();
      c.strokeStyle = OUT;
      c.lineWidth = 0.06;
      c.beginPath();
      c.moveTo(0, 0.9);
      c.lineTo(0.05, 1.02);
      c.stroke();
    },
    garlic(c) {
      c.beginPath();
      c.moveTo(0, -0.9);
      c.bezierCurveTo(0.1, -0.6, 0.76, -0.36, 0.72, 0.2);
      c.bezierCurveTo(0.68, 0.76, -0.68, 0.76, -0.72, 0.2);
      c.bezierCurveTo(-0.76, -0.36, -0.1, -0.6, 0, -0.9);
      c.closePath();
      fs(c, '#fbf5e8');
      c.lineWidth = 0.06;
      c.strokeStyle = '#d6c2a4';
      c.beginPath();
      c.moveTo(0, -0.6);
      c.quadraticCurveTo(-0.38, 0.1, -0.16, 0.64);
      c.moveTo(0, -0.6);
      c.quadraticCurveTo(0.38, 0.1, 0.16, 0.64);
      c.moveTo(0, -0.6);
      c.lineTo(0, 0.68);
      c.stroke();
      c.strokeStyle = 'rgba(176,112,176,.55)';
      c.lineWidth = 0.08;
      c.beginPath();
      c.moveTo(-0.5, -0.05);
      c.quadraticCurveTo(-0.56, 0.3, -0.4, 0.5);
      c.moveTo(0.5, -0.05);
      c.quadraticCurveTo(0.56, 0.3, 0.4, 0.5);
      c.stroke();
      c.strokeStyle = '#b89c78';
      c.lineWidth = 0.05;
      c.beginPath();
      for (let i = -2; i <= 2; i++) {
        c.moveTo(i * 0.08, 0.66);
        c.lineTo(i * 0.12, 0.82);
      }
      c.stroke();
    },
    chili(c) {
      c.beginPath();
      c.moveTo(-0.34, -0.42);
      c.quadraticCurveTo(-0.86, 0.05, -0.62, 0.72);
      c.quadraticCurveTo(0, 0.98, 0.62, 0.72);
      c.quadraticCurveTo(0.86, 0.05, 0.34, -0.42);
      c.closePath();
      fs(c, '#d8362c');
      c.beginPath();
      c.moveTo(0.3, -0.3);
      c.quadraticCurveTo(0.7, 0.1, 0.52, 0.66);
      c.quadraticCurveTo(0.58, 0.1, 0.2, -0.3);
      c.closePath();
      c.fillStyle = 'rgba(0,0,0,.16)';
      c.fill();
      c.beginPath();
      c.moveTo(-0.42, -0.42);
      c.lineTo(-0.52, -0.7);
      c.quadraticCurveTo(0, -0.6, 0.52, -0.7);
      c.lineTo(0.42, -0.42);
      c.closePath();
      fs(c, '#e64a3d');
      ell(c, 0, -0.68, 0.38, 0.12);
      fs(c, '#ff6a3d');
      c.strokeStyle = '#f3cf73';
      c.lineWidth = 0.14;
      c.beginPath();
      c.moveTo(-0.42, -0.45);
      c.lineTo(0.42, -0.45);
      c.stroke();
      c.strokeStyle = OUT;
      c.lineWidth = 0.07;
      ell(c, 0, 0.24, 0.32, 0.3);
      fs(c, '#fff4dc');
      c.beginPath();
      c.moveTo(-0.16, 0.1);
      c.quadraticCurveTo(0.22, 0.06, 0.14, 0.44);
      c.quadraticCurveTo(0.04, 0.2, -0.18, 0.2);
      c.closePath();
      c.fillStyle = '#e0362b';
      c.fill();
      c.strokeStyle = '#3e9a3a';
      c.lineWidth = 0.08;
      c.beginPath();
      c.moveTo(-0.17, 0.15);
      c.lineTo(-0.27, 0.06);
      c.stroke();
    },
    salt(c) {
      c.beginPath();
      c.moveTo(-0.72, -0.06);
      c.bezierCurveTo(-0.6, -0.62, -0.2, -0.82, 0.02, -0.78);
      c.bezierCurveTo(0.3, -0.76, 0.62, -0.55, 0.72, -0.06);
      c.closePath();
      fs(c, '#ffffff');
      c.fillStyle = '#a9d8ff';
      [
        [-0.35, -0.3],
        [0, -0.56],
        [0.3, -0.26],
        [-0.08, -0.2],
        [0.46, -0.42],
        [-0.5, -0.12],
      ].forEach(([x, y]) => {
        c.save();
        c.translate(x, y);
        c.rotate(0.6);
        c.fillRect(-0.06, -0.06, 0.12, 0.12);
        c.restore();
      });
      c.beginPath();
      c.moveTo(-0.88, -0.1);
      c.lineTo(0.88, -0.1);
      c.bezierCurveTo(0.84, 0.5, 0.45, 0.74, 0, 0.74);
      c.bezierCurveTo(-0.45, 0.74, -0.84, 0.5, -0.88, -0.1);
      c.closePath();
      fs(c, '#b8773d');
      c.strokeStyle = '#8d5426';
      c.lineWidth = 0.06;
      c.beginPath();
      c.moveTo(-0.78, 0.12);
      c.lineTo(0.78, 0.12);
      c.moveTo(-0.4, 0.34);
      c.quadraticCurveTo(0, 0.42, 0.4, 0.34);
      c.stroke();
      c.fillStyle = '#fff';
      star(c, 0.58, -0.74, 0.16, 0);
      c.fill();
    },
    heart(c) {
      c.beginPath();
      c.moveTo(0, 0.8);
      c.bezierCurveTo(-1.0, 0.1, -0.75, -0.85, 0, -0.35);
      c.bezierCurveTo(0.75, -0.85, 1.0, 0.1, 0, 0.8);
      c.closePath();
      fs(c, '#ff4f6d');
      ell(c, -0.38, -0.3, 0.14, 0.1, -0.6);
      c.fillStyle = 'rgba(255,255,255,.75)';
      c.fill();
    },
  };

  function drawItem(c, type, x, y, size, rot) {
    c.save();
    c.translate(x, y);
    if (rot) c.rotate(rot);
    const k = size / 2;
    c.scale(k, k);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.strokeStyle = OUT;
    c.lineWidth = 0.09;
    ITEM_ART[type](c);
    c.restore();
  }

  const iconCache = {};
  function iconURL(type) {
    if (!iconCache[type]) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 96;
      const c = cv.getContext('2d');
      drawItem(c, type, 48, 50, 80);
      iconCache[type] = cv.toDataURL();
    }
    return iconCache[type];
  }
  const jarIconCache = {};
  function jarIconURL() {
    if (!jarIconCache.v) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 96;
      const c = cv.getContext('2d');
      drawOnggi(c, 48, 88, 64, 72, { lid: 1, kimchi: true });
      jarIconCache.v = cv.toDataURL();
    }
    return jarIconCache.v;
  }

  /* ----- 장애물: 나무 상자, 옹기 ----- */
  function drawCrate(c, x, bottom, w, h) {
    c.save();
    c.lineJoin = 'round';
    c.strokeStyle = OUT;
    c.lineWidth = 3;
    rrect(c, x, bottom - h, w, h, 4);
    fs(c, '#c98a4b');
    c.strokeStyle = '#a2622d';
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(x + 7, bottom - h + 7);
    c.lineTo(x + w - 7, bottom - 7);
    c.moveTo(x + w - 7, bottom - h + 7);
    c.lineTo(x + 7, bottom - 7);
    c.stroke();
    c.strokeStyle = OUT;
    c.lineWidth = 2.5;
    c.strokeRect(x + 5, bottom - h + 5, w - 10, h - 10);
    c.fillStyle = 'rgba(255,255,255,.18)';
    c.fillRect(x + 4, bottom - h + 3, w - 8, 4);
    c.restore();
  }
  function drawOnggi(c, cx, bottom, w, h, o) {
    o = o || {};
    const top = bottom - h;
    c.save();
    c.lineJoin = 'round';
    c.strokeStyle = OUT;
    c.lineWidth = o.lw || 3;
    c.beginPath();
    c.moveTo(cx - w * 0.3, bottom);
    c.bezierCurveTo(cx - w * 0.62, bottom - h * 0.45, cx - w * 0.56, top + h * 0.14, cx - w * 0.3, top + h * 0.1);
    c.lineTo(cx + w * 0.3, top + h * 0.1);
    c.bezierCurveTo(cx + w * 0.56, top + h * 0.14, cx + w * 0.62, bottom - h * 0.45, cx + w * 0.3, bottom);
    c.closePath();
    const g = c.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
    g.addColorStop(0, '#86502e');
    g.addColorStop(0.5, '#5d321b');
    g.addColorStop(1, '#3d1f0f');
    fs(c, g);
    c.strokeStyle = '#b07246';
    c.lineWidth = Math.max(1.5, w * 0.035);
    c.beginPath();
    const by = bottom - h * 0.52;
    c.moveTo(cx - w * 0.48, by);
    for (let i = 0; i <= 8; i++) c.quadraticCurveTo(cx - w * 0.48 + (i + 0.5) * w * 0.12, by + (i % 2 ? 5 : -5) * (w / 60), cx - w * 0.48 + (i + 1) * w * 0.12, by);
    c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.28)';
    c.lineWidth = w * 0.08;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(cx - w * 0.3, top + h * 0.28);
    c.quadraticCurveTo(cx - w * 0.44, bottom - h * 0.45, cx - w * 0.3, bottom - h * 0.18);
    c.stroke();
    c.strokeStyle = OUT;
    c.lineWidth = o.lw || 3;
    if (o.kimchi) {
      c.beginPath();
      c.moveTo(cx - w * 0.3, top + h * 0.12);
      c.quadraticCurveTo(cx - w * 0.2, top - h * 0.16, cx, top - h * 0.02);
      c.quadraticCurveTo(cx + w * 0.18, top - h * 0.2, cx + w * 0.3, top + h * 0.12);
      c.closePath();
      fs(c, '#e8473b');
    }
    const lid = o.lid == null ? 1 : o.lid;
    if (lid > 0) {
      c.save();
      c.globalAlpha = Math.min(1, lid);
      const ly = top + h * 0.1 - (1 - lid) * h * 0.5;
      ell(c, cx, ly, w * 0.34, h * 0.08);
      fs(c, '#4a2414');
      ell(c, cx, ly - h * 0.06, w * 0.07, h * 0.04);
      fs(c, '#4a2414');
      c.restore();
    }
    c.restore();
  }
  function drawObstacle(c, ob) {
    if (ob.type === 'crate') drawCrate(c, ob.x, GROUND, ob.w, ob.h);
    else if (ob.type === 'stack') {
      drawCrate(c, ob.x, GROUND, ob.w, ob.h / 2);
      drawCrate(c, ob.x + 3, GROUND - ob.h / 2, ob.w - 6, ob.h / 2);
    } else drawOnggi(c, ob.x + ob.w / 2, GROUND, ob.w, ob.h);
  }

  /* ----- 주인공: 김장 셰프 (빨간 두건, 노란 앞치마, 분홍 고무장갑) ----- */
  function drawChef(c, x, y, pose, tm, o) {
    o = o || {};
    c.save();
    c.translate(x, y);
    if (o.scale) c.scale(o.scale, o.scale);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    const ph = tm * 15;
    let legA = 0;
    let legB = 0;
    let armA = 0.15;
    let armB = -0.15;
    let bob = 0;
    let lean = 0;
    if (pose === 'run') {
      legA = Math.sin(ph) * 0.8;
      legB = -legA;
      armA = -legA * 0.9;
      armB = legA * 0.9;
      bob = -Math.abs(Math.cos(ph)) * 4;
      lean = 0.08;
    } else if (pose === 'jump') {
      legA = -0.9;
      legB = 0.55;
      armA = -2.4;
      armB = -0.7;
    } else if (pose === 'fall') {
      legA = 0.35;
      legB = -0.25;
      armA = -1.3;
      armB = -2.0;
    } else if (pose === 'cheer') {
      const w = Math.sin(tm * 12) * 0.25;
      armA = -2.75 + w;
      armB = 2.75 - w;
      bob = -Math.abs(Math.sin(tm * 7)) * 10;
      legA = -0.15;
      legB = 0.15;
    } else if (pose === 'dizzy') {
      armA = 0.5;
      armB = -0.5;
      lean = Math.sin(tm * 6) * 0.14;
    } else if (pose === 'mix') {
      armA = -1.1 + Math.sin(tm * 18) * 0.5;
      armB = -0.9 + Math.cos(tm * 18) * 0.4;
    }
    c.translate(0, bob);
    c.rotate(lean);

    const limb = (hx, hy, ang, len, col, w, end) => {
      c.save();
      c.translate(hx, hy);
      c.rotate(ang);
      c.strokeStyle = OUT;
      c.lineWidth = w + 4;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(0, len);
      c.stroke();
      c.strokeStyle = col;
      c.lineWidth = w;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(0, len);
      c.stroke();
      c.strokeStyle = OUT;
      c.lineWidth = 2.5;
      if (end === 'shoe') {
        ell(c, 4, len + 3, 8.5, 5);
        fs(c, '#e8473b');
      } else {
        ell(c, 0, len + 2, 6.5, 6.5);
        fs(c, '#ff7eb6');
      }
      c.restore();
    };

    // 뒤쪽 팔·다리
    limb(-3, -28, legB, 22, '#2f3d63', 8, 'shoe');
    limb(-6, -55, armB, 18, '#3270c8', 8, 'hand');
    // 몸통 + 앞치마
    c.strokeStyle = OUT;
    c.lineWidth = 3;
    rrect(c, -16, -62, 32, 38, 11);
    fs(c, '#3f7fe0');
    rrect(c, -13, -50, 26, 30, 7);
    fs(c, '#ffd23f');
    c.beginPath();
    c.moveTo(-9, -50);
    c.lineTo(-7, -60);
    c.moveTo(9, -50);
    c.lineTo(7, -60);
    c.stroke();
    rrect(c, -6, -38, 12, 8, 2);
    fs(c, '#ffb531');
    // 앞쪽 다리
    limb(4, -28, legA, 22, '#334570', 8, 'shoe');

    // 머리
    const hy = -80;
    const flap = Math.sin(tm * 18) * 3;
    c.strokeStyle = OUT;
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(-15, hy - 8);
    c.quadraticCurveTo(-28, hy - 14 + flap, -34, hy - 4 + flap);
    c.lineTo(-24, hy - 2);
    c.quadraticCurveTo(-30, hy + 6 - flap, -30, hy + 10 - flap);
    c.lineTo(-14, hy - 2);
    c.closePath();
    fs(c, '#e8473b');
    ell(c, -2, hy - 1, 22, 21);
    fs(c, '#2b1d16');
    ell(c, 5, hy + 2, 18, 18);
    fs(c, '#ffd6b0');
    c.beginPath();
    c.moveTo(-14, hy - 6);
    c.quadraticCurveTo(0, hy - 24, 22, hy - 6);
    c.quadraticCurveTo(14, hy - 9, 10, hy - 4);
    c.quadraticCurveTo(4, hy - 9, -2, hy - 4);
    c.quadraticCurveTo(-8, hy - 8, -14, hy - 6);
    c.closePath();
    c.fillStyle = '#2b1d16';
    c.fill();
    c.strokeStyle = '#e8473b';
    c.lineWidth = 7;
    c.beginPath();
    c.arc(1, hy + 1, 21, Math.PI * 1.08, Math.PI * 1.9);
    c.stroke();
    c.fillStyle = '#fff';
    [1.25, 1.5, 1.75].forEach((a) => {
      ell(c, 1 + Math.cos(a * Math.PI) * 21, hy + 1 + Math.sin(a * Math.PI) * 21, 1.8, 1.8);
      c.fill();
    });
    // 얼굴
    c.fillStyle = OUT;
    if (pose === 'dizzy') {
      c.strokeStyle = OUT;
      c.lineWidth = 2.2;
      [
        [7, hy + 2],
        [16, hy + 2],
      ].forEach(([ex, ey]) => {
        c.beginPath();
        c.moveTo(ex - 3, ey - 3);
        c.lineTo(ex + 3, ey + 3);
        c.moveTo(ex + 3, ey - 3);
        c.lineTo(ex - 3, ey + 3);
        c.stroke();
      });
    } else if (o.blink) {
      c.strokeStyle = OUT;
      c.lineWidth = 2.2;
      c.beginPath();
      c.moveTo(4, hy + 2);
      c.lineTo(10, hy + 2);
      c.moveTo(13, hy + 2);
      c.lineTo(19, hy + 2);
      c.stroke();
    } else {
      ell(c, 7, hy + 1, 2.4, 3.6);
      c.fill();
      ell(c, 16, hy + 1, 2.6, 3.8);
      c.fill();
      c.fillStyle = '#fff';
      ell(c, 8, hy - 0.5, 0.9, 0.9);
      c.fill();
      ell(c, 17, hy - 0.5, 0.9, 0.9);
      c.fill();
    }
    c.fillStyle = 'rgba(255,120,140,.55)';
    ell(c, 19, hy + 8, 4, 2.6);
    c.fill();
    ell(c, 3, hy + 8, 3, 2.2);
    c.fill();
    c.strokeStyle = OUT;
    c.lineWidth = 2;
    c.beginPath();
    if (pose === 'dizzy' || pose === 'hurt') c.arc(12, hy + 13, 3, Math.PI * 1.15, Math.PI * 1.85);
    else if (pose === 'cheer' || pose === 'jump') {
      c.arc(12, hy + 9, 4.2, 0.1, Math.PI - 0.1);
      c.closePath();
      c.fillStyle = '#c2413b';
      c.fill();
    } else c.arc(12, hy + 9, 3.4, 0.25, Math.PI - 0.25);
    c.stroke();

    // 앞쪽 팔
    limb(6, -55, armA, 18, '#3f7fe0', 8, 'hand');

    if (pose === 'dizzy') {
      for (let i = 0; i < 3; i++) {
        const a = tm * 5 + (i * Math.PI * 2) / 3;
        c.fillStyle = '#ffd23f';
        c.strokeStyle = OUT;
        c.lineWidth = 1.5;
        star(c, Math.cos(a) * 22 + 4, hy - 26 + Math.sin(a) * 6, 6, a);
        c.fill();
        c.stroke();
      }
    }
    c.restore();
  }

  /* ----- 배경 (시장 골목, 한옥, 돌담, 산) ----- */
  const HOUSES = [
    { x: 0, w: 360, win: 3 },
    { x: 470, w: 280, win: 2 },
    { x: 860, w: 420, win: 4 },
    { x: 1340, w: 300, win: 2 },
  ];
  const HOUSE_TILE = 1760;
  const TREES = [
    { x: 400, s: 1 },
    { x: 1290, s: 0.85 },
  ];
  const CLOUDS = [
    { x: 80, y: 70, s: 1 },
    { x: 420, y: 120, s: 0.7 },
    { x: 700, y: 60, s: 0.9 },
    { x: 1080, y: 100, s: 0.8 },
  ];

  function mountainY(x, layer) {
    const P = (Math.PI * 2) / 1920;
    if (layer === 0) return 250 - 60 * Math.sin(x * P * 2 + 1) - 34 * Math.sin(x * P * 5) - 14 * Math.sin(x * P * 11 + 2);
    return 300 - 40 * Math.sin(x * P * 3 + 2) - 26 * Math.sin(x * P * 7 + 1) - 10 * Math.sin(x * P * 13);
  }

  function drawHanok(c, x, w, base, win) {
    const wallH = 74;
    const rb = base - 12 - wallH;
    c.save();
    c.lineJoin = 'round';
    c.strokeStyle = OUT;
    c.lineWidth = 2.5;
    c.fillStyle = '#bdb4a4';
    c.fillRect(x - 6, base - 14, w + 12, 14);
    c.strokeRect(x - 6, base - 14, w + 12, 14);
    c.fillStyle = '#fbf3e3';
    c.fillRect(x + 6, rb, w - 12, wallH + 2);
    const gap = (w - 12) / win;
    for (let i = 0; i < win; i++) {
      const wx = x + 6 + i * gap + gap * 0.18;
      const ww = gap * 0.64;
      c.fillStyle = '#f3dcae';
      c.fillRect(wx, rb + 14, ww, wallH - 24);
      c.strokeStyle = '#b07e3c';
      c.lineWidth = 1.4;
      c.beginPath();
      for (let k = 1; k < 4; k++) {
        c.moveTo(wx + (ww * k) / 4, rb + 14);
        c.lineTo(wx + (ww * k) / 4, rb + wallH - 10);
      }
      for (let k = 1; k < 4; k++) {
        c.moveTo(wx, rb + 14 + ((wallH - 24) * k) / 4);
        c.lineTo(wx + ww, rb + 14 + ((wallH - 24) * k) / 4);
      }
      c.stroke();
      c.strokeStyle = OUT;
      c.lineWidth = 2;
      c.strokeRect(wx, rb + 14, ww, wallH - 24);
    }
    c.fillStyle = '#6b4129';
    for (let i = 0; i <= win; i++) c.fillRect(x + 4 + i * gap, rb, 8, wallH);
    c.fillRect(x + 4, rb, w - 8, 9);
    // 지붕 (처마 끝이 위로 휜 기와지붕)
    const rh = 50;
    const roof = () => {
      c.beginPath();
      c.moveTo(x - 34, rb - 16);
      c.quadraticCurveTo(x + w * 0.05, rb - rh * 0.5, x + w * 0.16, rb - rh);
      c.lineTo(x + w * 0.84, rb - rh);
      c.quadraticCurveTo(x + w * 0.95, rb - rh * 0.5, x + w + 34, rb - 16);
      c.quadraticCurveTo(x + w / 2, rb + 8, x - 34, rb - 16);
      c.closePath();
    };
    roof();
    c.fillStyle = '#4b5263';
    c.fill();
    c.save();
    c.clip();
    c.strokeStyle = '#626a7d';
    c.lineWidth = 4;
    c.beginPath();
    for (let k = x - 30; k < x + w + 34; k += 13) {
      c.moveTo(k, rb - rh);
      c.lineTo(k + (k - (x + w / 2)) * 0.12, rb + 6);
    }
    c.stroke();
    c.restore();
    c.strokeStyle = OUT;
    c.lineWidth = 2.5;
    roof();
    c.stroke();
    c.beginPath();
    c.moveTo(x + w * 0.14, rb - rh + 2);
    c.quadraticCurveTo(x + w * 0.12, rb - rh - 14, x + w * 0.2, rb - rh - 10);
    c.lineTo(x + w * 0.8, rb - rh - 10);
    c.quadraticCurveTo(x + w * 0.88, rb - rh - 14, x + w * 0.86, rb - rh + 2);
    c.closePath();
    fs(c, '#30353f');
    c.restore();
  }

  function drawPersimmonTree(c, x, base, s) {
    c.save();
    c.translate(x, base);
    c.scale(s, s);
    c.strokeStyle = OUT;
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(-8, 0);
    c.quadraticCurveTo(-4, -60, -14, -110);
    c.lineTo(4, -112);
    c.quadraticCurveTo(6, -60, 8, 0);
    c.closePath();
    fs(c, '#7a5236');
    [
      [-40, -130, 46],
      [10, -160, 54],
      [44, -120, 40],
      [-6, -112, 40],
    ].forEach(([cx, cy, r]) => {
      ell(c, cx, cy, r, r * 0.8);
      fs(c, '#5aa055');
    });
    c.fillStyle = '#ff8a1f';
    [
      [-46, -126],
      [-10, -168],
      [22, -140],
      [48, -116],
      [4, -110],
      [-30, -100],
    ].forEach(([px, py]) => {
      ell(c, px, py, 6, 6);
      fs(c, '#ff8a1f');
    });
    c.restore();
  }

  function drawCloud(c, x, y, s) {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    c.fillStyle = 'rgba(255,255,255,.92)';
    ell(c, 0, 0, 46, 22);
    c.fill();
    ell(c, 30, -12, 34, 24);
    c.fill();
    ell(c, -30, -6, 28, 18);
    c.fill();
    ell(c, 60, 4, 26, 16);
    c.fill();
    c.restore();
  }

  function drawStreet(c, scroll, tm) {
    const sky = c.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, '#8fd6ff');
    sky.addColorStop(0.7, '#dff3ff');
    sky.addColorStop(1, '#fff3dc');
    c.fillStyle = sky;
    c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(255,240,180,.55)';
    ell(c, 820, 90, 70, 70);
    c.fill();
    c.fillStyle = '#fff6c8';
    ell(c, 820, 90, 42, 42);
    c.fill();
    CLOUDS.forEach((cl) => {
      const span = W + 360;
      const x = ((((cl.x - scroll * 0.05 - tm * 8) % span) + span) % span) - 180;
      drawCloud(c, x, cl.y, cl.s);
    });
    [
      ['#a7d3c4', 0.12, 0],
      ['#7fb7a0', 0.25, 1],
    ].forEach(([col, k, layer]) => {
      const off = scroll * k;
      c.beginPath();
      c.moveTo(0, GROUND);
      for (let x = 0; x <= W + 20; x += 20) c.lineTo(x, mountainY(x + off, layer));
      c.lineTo(W, GROUND);
      c.closePath();
      c.fillStyle = col;
      c.fill();
    });
    // 한옥 줄
    const hOff = (scroll * 0.45) % HOUSE_TILE;
    for (let rep = 0; rep < 2; rep++) {
      const base = rep * HOUSE_TILE - hOff;
      TREES.forEach((tr) => {
        const x = base + tr.x;
        if (x > -120 && x < W + 120) drawPersimmonTree(c, x, GROUND - 40, tr.s);
      });
      HOUSES.forEach((hs) => {
        const x = base + hs.x;
        if (x + hs.w + 40 > 0 && x - 40 < W) drawHanok(c, x, hs.w, GROUND - 40, hs.win);
      });
    }
    // 돌담
    const wOff = (scroll * 0.7) % 64;
    c.fillStyle = '#d9d0c0';
    c.fillRect(0, GROUND - 40, W, 40);
    c.strokeStyle = '#b3a892';
    c.lineWidth = 2;
    for (let row = 0; row < 3; row++) {
      const yy = GROUND - 40 + row * 13 + 2;
      for (let x = -64 - wOff + (row % 2) * 32; x < W + 64; x += 64) {
        rrect(c, x + 2, yy, 58, 11, 5);
        c.stroke();
      }
    }
    c.fillStyle = '#4b5263';
    c.fillRect(0, GROUND - 48, W, 10);
    c.strokeStyle = OUT;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, GROUND - 38);
    c.lineTo(W, GROUND - 38);
    c.stroke();
    // 길
    c.fillStyle = '#e8c48e';
    c.fillRect(0, GROUND, W, H - GROUND);
    c.fillStyle = '#c99a5e';
    c.fillRect(0, GROUND, W, 6);
    const gOff = scroll % 96;
    c.strokeStyle = '#d4ab73';
    c.lineWidth = 3;
    c.beginPath();
    for (let row = 0; row < 3; row++) {
      const yy = GROUND + 12 + row * 26;
      c.moveTo(0, yy + 22);
      c.lineTo(W, yy + 22);
      for (let x = -96 - gOff + (row % 2) * 48; x < W + 96; x += 96) {
        c.moveTo(x, yy);
        c.lineTo(x, yy + 22);
      }
    }
    c.stroke();
  }

  /* ----- 부엌 장면용 그림 ----- */
  function drawCabbageHalf(c, x, y, L, red, rot) {
    c.save();
    c.translate(x, y);
    c.rotate(rot || 0);
    const h = L * 0.36;
    c.lineJoin = 'round';
    c.strokeStyle = OUT;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(-L / 2, h * 0.3);
    c.quadraticCurveTo(-L / 2 - 6, -h, -L * 0.1, -h);
    c.quadraticCurveTo(L * 0.4, -h * 1.05, L / 2, -h * 0.2);
    c.quadraticCurveTo(L * 0.55, h * 0.4, L * 0.38, h * 0.5);
    c.lineTo(-L / 2 + 8, h * 0.5);
    c.closePath();
    fs(c, mixColor('#f4f6de', '#e0442f', red * 0.9));
    c.beginPath();
    c.moveTo(L * 0.12, -h * 0.98);
    c.quadraticCurveTo(L * 0.42, -h * 1.02, L / 2, -h * 0.2);
    c.quadraticCurveTo(L * 0.55, h * 0.4, L * 0.38, h * 0.5);
    c.quadraticCurveTo(L * 0.3, 0, L * 0.12, -h * 0.98);
    c.closePath();
    fs(c, mixColor('#86cf5c', '#b9321f', red * 0.85));
    c.strokeStyle = mixColor('#fff7c2', '#ff8a5c', red);
    c.lineWidth = 2.5;
    c.beginPath();
    for (let i = 1; i <= 3; i++) {
      const k = i / 4;
      c.moveTo(-L / 2 + 8, h * 0.5 - h * 1.3 * k);
      c.quadraticCurveTo(-L * 0.1, -h * k * 1.25, L * 0.22, h * 0.5 - h * 1.35 * k);
    }
    c.stroke();
    if (red > 0.05) {
      c.fillStyle = `rgba(200,30,20,${0.5 * red})`;
      for (let i = 0; i < 10; i++) {
        ell(c, -L * 0.4 + ((i * 37) % 80) * (L / 100), -h * 0.6 + ((i * 53) % 60) * (h / 60), 2.4, 2.4);
        c.fill();
      }
    }
    c.restore();
  }

  function drawBasin(c, cx, cy, fill, fillColor) {
    c.save();
    c.lineJoin = 'round';
    c.strokeStyle = OUT;
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(cx - 230, cy);
    c.lineTo(cx - 170, cy + 92);
    c.quadraticCurveTo(cx, cy + 118, cx + 170, cy + 92);
    c.lineTo(cx + 230, cy);
    c.closePath();
    const g = c.createLinearGradient(cx - 230, 0, cx + 230, 0);
    g.addColorStop(0, '#f0483c');
    g.addColorStop(0.6, '#d8352a');
    g.addColorStop(1, '#b8271e');
    fs(c, g);
    ell(c, cx, cy, 232, 44);
    fs(c, '#e8423a');
    ell(c, cx, cy + 4, 212, 36);
    fs(c, '#a91f17');
    if (fill) {
      ell(c, cx, cy + 8, 198, 28);
      c.fillStyle = fillColor;
      c.fill();
    }
    c.restore();
  }

  /* =====================================================================
   * 게임 본체
   * ===================================================================== */
  function create(api) {
    const { input, hud, t } = api;
    const audio = api.audio;
    const rand = (a, b) => a + Math.random() * (b - a);
    const loop = api.loop(update, render);

    const S = {
      phase: 'ready', // ready | run | outro | fade | cook | over | done
      time: 0,
      elapsed: 0,
      timeLeft: TIME_LIMIT,
      scroll: 0,
      speed: 300,
      hearts: MAX_HEARTS,
      have: {},
      extras: 0,
      ingPts: 0,
      comboPts: 0,
      combo: 0,
      maxCombo: 0,
      hits: 0,
      nextOb: 760,
      nextItem: 260,
      nextHeart: 14,
      obstacles: [],
      items: [],
      parts: [],
      shake: 0,
      fade: 0,
      overReason: null,
      overT: 0,
      outroT: 0,
      step: null,
      stepT: 0,
      mixP: 0,
      mixDone: false,
      mixDoneT: 0,
      perfect: false,
      spin: 0,
      spinV: 0,
      taps: 0,
      completeTime: null,
      lastShownTime: null,
      player: { x: 200, y: GROUND, vy: 0, onGround: true, jumps: 0, coyote: 0, buffer: 0, inv: 0, blinkT: 2 },
    };
    ING.forEach((i) => (S.have[i.id] = 0));

    hud.setTime(TIME_LIMIT);
    hud.setHearts(S.hearts, MAX_HEARTS);
    hud.setScore(0);
    hud.setTracker(ING.map((i) => ({ id: i.id, icon: iconURL(i.id), label: t('kr.ing.' + i.id), have: 0, need: i.need })));
    api.setControls(['left', 'right', 'jump']);

    /* ----- 진행 ----- */
    function allCollected() {
      return ING.every((i) => S.have[i.id] >= i.need);
    }
    function missingList() {
      return ING.filter((i) => S.have[i.id] < i.need)
        .map((i) => `${t('kr.ing.' + i.id)} ×${i.need - S.have[i.id]}`)
        .join(', ');
    }
    function liveScore() {
      return S.ingPts + S.comboPts;
    }

    function burst(x, y, colors, n, power) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = rand(0.4, 1) * (power || 260);
        S.parts.push({ kind: 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, life: rand(0.4, 0.8), max: 0.8, size: rand(3, 7), color: colors[i % colors.length], g: 600 });
      }
    }
    function floatText(str, x, y, color, size) {
      S.parts.push({ kind: 'text', str, x, y, vx: 0, vy: -70, life: 1.1, max: 1.1, size: size || 26, color: color || '#fff', g: 0 });
    }

    function spawnObstacle(type, x) {
      if (!type) {
        const r = Math.random();
        type = S.elapsed < 8 ? (r < 0.55 ? 'crate' : 'jar') : r < 0.4 ? 'crate' : r < 0.72 ? 'jar' : 'stack';
      }
      const d = OBST[type];
      const ob = { type, x: x == null ? W + 40 : x, w: d.w, h: d.h, hit: false };
      S.obstacles.push(ob);
      return ob;
    }

    function pickType() {
      const needed = ING.filter((i) => S.have[i.id] < i.need);
      if (needed.length && Math.random() < 0.8) {
        let total = 0;
        needed.forEach((i) => (total += i.need - S.have[i.id]));
        let r = Math.random() * total;
        for (const i of needed) {
          r -= i.need - S.have[i.id];
          if (r <= 0) return i.id;
        }
        return needed[0].id;
      }
      return ING[Math.floor(Math.random() * ING.length)].id;
    }

    function spawnItem(type, x, y) {
      type = type || pickType();
      x = x == null ? W + 40 : x;
      if (y == null) {
        const near = S.obstacles.find((ob) => Math.abs(ob.x + ob.w / 2 - x) < 100);
        if (near) y = GROUND - near.h - 62;
        else {
          const r = Math.random();
          y = r < 0.5 ? GROUND - 34 : r < 0.85 ? GROUND - 120 : GROUND - 178;
        }
      }
      const it = { type, x, y, bob: Math.random() * 6, needed: type !== 'heart' && S.have[type] < ING_BY_ID[type].need };
      S.items.push(it);
      return it;
    }

    function jump() {
      const P = S.player;
      if (P.onGround || P.coyote > 0) {
        P.vy = -JUMP_V;
        P.onGround = false;
        P.coyote = 0;
        P.jumps = 1;
        audio.play('jump');
        burst(P.x - 10, GROUND, ['#d7b07a', '#f1dcb4'], 6, 120);
        return true;
      }
      if (P.jumps < 2) {
        P.vy = -DJUMP_V;
        P.jumps = 2;
        audio.play('doubleJump');
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          S.parts.push({ kind: 'ring', x: P.x, y: P.y - 6, vx: Math.cos(a) * 140, vy: Math.sin(a) * 40, life: 0.35, max: 0.35, size: 5, color: '#ffffff', g: 0 });
        }
        return true;
      }
      return false;
    }

    function collect(it) {
      const P = S.player;
      if (it.type === 'heart') {
        S.hearts = Math.min(MAX_HEARTS, S.hearts + 1);
        hud.setHearts(S.hearts, MAX_HEARTS);
        floatText('+1 ' + t('kr.heart'), it.x, it.y - 30, '#ff8fa3');
        burst(it.x, it.y, ['#ff4f6d', '#ffd1dc'], 14);
        audio.play('heart');
        return;
      }
      const def = ING_BY_ID[it.type];
      const needed = S.have[it.type] < def.need;
      let pts = def.points;
      if (needed) S.have[it.type] += 1;
      else {
        S.extras += 1;
        pts = Math.round(def.points / 2);
      }
      S.combo += 1;
      S.maxCombo = Math.max(S.maxCombo, S.combo);
      const cb = S.combo > 1 ? Math.min(100, (S.combo - 1) * 10) : 0;
      S.ingPts += pts;
      S.comboPts += cb;
      hud.setScore(liveScore());
      hud.updateTracker(it.type, S.have[it.type], def.need);
      floatText(`+${pts}`, it.x, it.y - 34, '#fff7c2', 28);
      floatText(needed ? t('kr.ing.' + it.type) : t('kr.extra'), it.x, it.y - 6, '#ffffff', 18);
      if (S.combo >= 3) floatText(t('kr.combo', { n: S.combo }), P.x, P.y - 120, '#ffd23f', 22);
      burst(it.x, it.y, ['#ffd23f', '#ffffff', '#7bc043', '#ff6b4a'], 16);
      audio.play('collect', S.combo);
      if (allCollected()) startOutro();
    }

    function hit(ob) {
      const P = S.player;
      ob.hit = true;
      S.hearts -= 1;
      S.hits += 1;
      S.combo = 0;
      P.inv = 1.3;
      P.x = Math.max(80, P.x - 40);
      S.shake = 12;
      hud.setHearts(S.hearts, MAX_HEARTS);
      burst(P.x + 20, P.y - 40, ['#ffffff', '#ffd23f', '#c98a4b'], 14, 300);
      audio.play('hit');
      if (S.hearts <= 0) gameOver('crash');
    }

    function startOutro() {
      S.phase = 'outro';
      S.outroT = 0;
      S.completeTime = S.elapsed;
      S.player.inv = 99;
      S.obstacles.forEach((ob) => burst(ob.x + ob.w / 2, GROUND - ob.h / 2, ['#ffffff', '#f3e2c4'], 8, 160));
      S.obstacles = [];
      S.items.forEach((it) => burst(it.x, it.y, ['#ffffff'], 5, 120));
      S.items = [];
      hud.banner(t('kr.allCollected'), 'win', 1800);
      audio.play('success');
    }

    function gameOver(reason) {
      if (S.phase !== 'run') return;
      S.phase = 'over';
      S.overReason = reason;
      S.overT = 0;
      hud.banner(reason === 'time' ? t('kr.timeUp') : t('kr.crashed'), 'lose', 1700);
      audio.play('fail');
    }

    function setStep(step) {
      S.step = step;
      S.stepT = 0;
      if (step === 'mix') {
        api.setControls(['mix']);
        input.clear();
      } else api.setControls([]);
    }

    function finish(completed) {
      if (S.phase === 'done') return;
      S.phase = 'done';
      const breakdown = [
        { label: t('kr.bd.ingredients'), value: S.ingPts },
        { label: t('kr.bd.combo'), value: S.comboPts },
      ];
      let score = S.ingPts + S.comboPts;
      if (completed) {
        const mixB = Math.round(S.mixP * 250) + (S.perfect ? 100 : 0);
        const timeB = Math.ceil(S.timeLeft) * 15;
        const heartB = S.hearts * 150;
        breakdown.push({ label: t('kr.bd.mix'), value: mixB }, { label: t('kr.bd.time'), value: timeB }, { label: t('kr.bd.hearts'), value: heartB });
        score += mixB + timeB + heartB;
      }
      api.finish({
        completed,
        score,
        time: completed ? S.completeTime : null,
        title: completed ? t('kr.resultWin') : t('kr.resultFail'),
        subtitle: completed ? null : `${S.overReason === 'time' ? t('kr.timeUp') : t('kr.crashed')} ${t('kr.missing', { list: missingList() })}`,
        breakdown,
        stats: { hits: S.hits, maxCombo: S.maxCombo, perfectMix: S.perfect, timeUsed: S.completeTime },
        fact: { title: t('kr.factTitle'), text: t('kr.fact') },
      });
    }

    /* ----- update ----- */
    function update(dt) {
      S.time += dt;
      if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 40);
      for (let i = S.parts.length - 1; i >= 0; i--) {
        const p = S.parts[i];
        p.life -= dt;
        if (p.life <= 0) {
          S.parts.splice(i, 1);
          continue;
        }
        p.vy += p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      if (S.phase === 'run' || S.phase === 'outro' || S.phase === 'over') updateRun(dt);
      else if (S.phase === 'fade') {
        S.fade = Math.min(1, S.fade + dt * 2.2);
        if (S.fade >= 1) {
          S.phase = 'cook';
          S.parts = [];
          setStep('salt');
          hud.banner(t('kr.toKitchen'), 'win', 1500);
        }
      } else if (S.phase === 'cook') updateCook(dt);
    }

    function updateRun(dt) {
      const P = S.player;
      if (S.phase === 'run') {
        S.elapsed += dt;
        S.timeLeft = Math.max(0, S.timeLeft - dt);
        const shown = Math.ceil(S.timeLeft);
        if (shown !== S.lastShownTime) {
          S.lastShownTime = shown;
          hud.setTime(S.timeLeft);
        }
      }
      if (S.phase === 'over') S.speed = Math.max(0, S.speed - 700 * dt);
      else S.speed = 300 + Math.min(130, S.elapsed * 2.2);
      S.scroll += S.speed * dt;

      // 이동/점프
      if (S.phase === 'run') {
        const dir = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
        P.x = Math.min(600, Math.max(80, P.x + dir * 300 * dt));
        const j = input.consume('jump');
        const tp = input.consume('tap');
        if (j || tp) P.buffer = 0.13;
      } else if (S.phase === 'outro') {
        P.x += (Math.min(W + 120, P.x + 400) - P.x) * dt * (S.outroT > 0.6 ? 1.6 : 0.2);
      }
      input.consume('action');
      P.buffer -= dt;
      if (P.buffer > 0 && S.phase === 'run' && jump()) P.buffer = 0;
      P.vy += GRAVITY * dt;
      P.y += P.vy * dt;
      if (P.y >= GROUND) {
        if (!P.onGround && P.vy > 300) {
          burst(P.x, GROUND, ['#d7b07a', '#f1dcb4'], 5, 90);
          audio.play('land');
        }
        P.y = GROUND;
        P.vy = 0;
        P.onGround = true;
        P.jumps = 0;
        P.coyote = 0.09;
      } else {
        if (P.onGround) P.jumps = Math.max(P.jumps, 1);
        P.onGround = false;
        P.coyote -= dt;
      }
      P.inv -= dt;
      P.blinkT -= dt;
      if (P.blinkT < -0.12) P.blinkT = rand(1.8, 3.6);

      // 생성
      if (S.phase === 'run') {
        S.nextOb -= S.speed * dt;
        if (S.nextOb <= 0) {
          spawnObstacle();
          S.nextOb = rand(440, 780);
        }
        S.nextItem -= S.speed * dt;
        if (S.nextItem <= 0) {
          spawnItem();
          S.nextItem = rand(240, 400);
        }
        S.nextHeart -= dt;
        if (S.nextHeart <= 0) {
          S.nextHeart = rand(12, 18);
          if (S.hearts < MAX_HEARTS) spawnItem('heart', W + 40, GROUND - 150);
        }
      }

      // 이동 + 충돌
      const px0 = P.x - 17;
      const px1 = P.x + 17;
      const py0 = P.y - 92;
      const py1 = P.y;
      for (let i = S.obstacles.length - 1; i >= 0; i--) {
        const ob = S.obstacles[i];
        ob.x -= S.speed * dt;
        if (ob.x + ob.w < -60) {
          S.obstacles.splice(i, 1);
          continue;
        }
        if (S.phase === 'run' && !ob.hit && P.inv <= 0) {
          const m = 7;
          if (px1 > ob.x + m && px0 < ob.x + ob.w - m && py1 > GROUND - ob.h + m && py0 < GROUND) hit(ob);
        }
      }
      for (let i = S.items.length - 1; i >= 0; i--) {
        const it = S.items[i];
        it.x -= S.speed * dt;
        it.bob += dt;
        if (it.x < -40) {
          if (it.needed && S.have[it.type] < ING_BY_ID[it.type].need) S.combo = 0;
          S.items.splice(i, 1);
          continue;
        }
        if (S.phase !== 'run') continue;
        const iy = it.y + Math.sin(it.bob * 4) * 5;
        const cx = Math.max(px0, Math.min(it.x, px1));
        const cy = Math.max(py0, Math.min(iy, py1));
        if ((cx - it.x) * (cx - it.x) + (cy - iy) * (cy - iy) < 26 * 26) {
          S.items.splice(i, 1);
          collect(it);
          if (S.phase !== 'run') break;
        }
      }

      if (S.phase === 'run' && S.timeLeft <= 0) gameOver('time');

      if (S.phase === 'outro') {
        S.outroT += dt;
        if (S.outroT > 1.7) {
          S.phase = 'fade';
          S.fade = 0;
          audio.play('whoosh');
        }
      } else if (S.phase === 'over') {
        S.overT += dt;
        if (S.overT > 1.9) finish(false);
      }
    }

    function updateCook(dt) {
      S.stepT += dt;
      if (S.fade > 0) S.fade = Math.max(0, S.fade - dt * 2);
      const st = S.step;
      if (st === 'salt') {
        if (Math.random() < dt * 40) S.parts.push({ kind: 'dot', x: rand(400, 470), y: 205, vx: rand(-30, 30), vy: rand(60, 120), life: 0.9, max: 0.9, size: rand(2, 4), color: '#ffffff', g: 500 });
        if (S.stepT > 0.3 && S.stepT - dt <= 0.3) audio.play('pour');
        if (S.stepT > 2.4) setStep('mix');
      } else if (st === 'mix') {
        const tapped = [input.consume('action'), input.consume('jump'), input.consume('tap')].some(Boolean);
        if (tapped && !S.mixDone) {
          S.taps += 1;
          S.mixP = Math.min(1, S.mixP + 0.075);
          S.spinV = Math.min(16, S.spinV + 3.2);
          audio.play('mix');
          burst(rand(380, 580), 345, ['#d8321f', '#ff7a4d', '#ffffff'], 4, 160);
        }
        S.spinV *= Math.pow(0.25, dt);
        S.spin += (S.spinV + 0.6) * dt;
        if (!S.mixDone && S.mixP >= 1) {
          S.mixDone = true;
          S.perfect = true;
          hud.banner(t('kr.perfect'), 'win', 1200);
          audio.play('success');
        } else if (!S.mixDone && S.stepT > 6.5) {
          S.mixDone = true;
          hud.banner(t('kr.goodMix'), 'info', 1200);
        }
        if (S.mixDone) {
          S.mixDoneT += dt;
          if (S.mixDoneT > 1.0) setStep('spread');
        }
      } else if (st === 'spread') {
        if (S.stepT > 1.5 && S.stepT - dt <= 1.5) audio.play('whoosh');
        if (S.stepT > 3.0) {
          setStep('done');
          audio.play('fanfare');
          burst(480, 300, ['#ff6b4a', '#ffd23f', '#7bc043', '#4cc3ff', '#ff7eb6'], 50, 520);
        }
      } else if (st === 'done') {
        if (Math.random() < dt * 14)
          S.parts.push({ kind: 'conf', x: rand(0, W), y: -10, vx: rand(-40, 40), vy: rand(120, 220), life: 3, max: 3, size: rand(5, 9), color: ['#ff6b4a', '#ffd23f', '#7bc043', '#4cc3ff', '#ff7eb6'][Math.floor(rand(0, 5))], g: 30, rot: rand(0, 6) });
        if (S.stepT > 3.4) finish(true);
      }
    }

    /* ----- render ----- */
    function render() {
      const c = api.beginFrame();
      c.save();
      if (S.shake > 0) c.translate(rand(-S.shake, S.shake), rand(-S.shake, S.shake) * 0.6);
      if (S.phase === 'cook' || (S.phase === 'done' && S.step)) renderKitchen(c);
      else renderStreet(c);
      renderParts(c);
      c.restore();
      if (S.fade > 0) {
        c.fillStyle = `rgba(255,248,236,${S.fade})`;
        c.fillRect(0, 0, W, H);
      }
    }

    function renderStreet(c) {
      drawStreet(c, S.scroll, S.time);
      S.obstacles.forEach((ob) => drawObstacle(c, ob));
      S.items.forEach((it) => {
        const iy = it.y + Math.sin(it.bob * 4) * 5;
        c.fillStyle = it.type === 'heart' ? 'rgba(255,120,150,.28)' : 'rgba(255,255,255,.45)';
        ell(c, it.x, iy, 30, 30);
        c.fill();
        drawItem(c, it.type, it.x, iy, it.type === 'heart' ? 40 : 50, Math.sin(it.bob * 3) * 0.12);
      });
      const P = S.player;
      const airH = GROUND - P.y;
      c.fillStyle = 'rgba(60,40,20,.22)';
      ell(c, P.x, GROUND + 4, Math.max(8, 24 - airH * 0.06), 6);
      c.fill();
      const flicker = P.inv > 0 && S.phase === 'run' && Math.floor(P.inv * 12) % 2 === 0;
      if (!flicker) {
        let pose = 'run';
        if (S.phase === 'ready') pose = 'idle';
        else if (S.phase === 'over') pose = 'dizzy';
        else if (!P.onGround) pose = P.vy < 0 ? 'jump' : 'fall';
        else if (S.phase === 'outro' && S.outroT < 0.6) pose = 'cheer';
        drawChef(c, P.x, P.y, pose, S.time, { blink: P.blinkT < 0 });
      }
    }

    function renderKitchen(c) {
      // 벽과 창
      const wall = c.createLinearGradient(0, 0, 0, 400);
      wall.addColorStop(0, '#ffeacb');
      wall.addColorStop(1, '#ffd9a6');
      c.fillStyle = wall;
      c.fillRect(0, 0, W, H);
      c.strokeStyle = OUT;
      c.lineWidth = 3;
      c.fillStyle = '#bfe7ff';
      c.fillRect(70, 50, 190, 150);
      c.fillStyle = '#9fd18a';
      c.fillRect(70, 150, 190, 50);
      c.strokeStyle = '#8d5a35';
      c.lineWidth = 3;
      c.beginPath();
      for (let i = 1; i < 4; i++) {
        c.moveTo(70 + (190 * i) / 4, 50);
        c.lineTo(70 + (190 * i) / 4, 200);
      }
      for (let i = 1; i < 3; i++) {
        c.moveTo(70, 50 + (150 * i) / 3);
        c.lineTo(260, 50 + (150 * i) / 3);
      }
      c.stroke();
      c.strokeStyle = OUT;
      c.lineWidth = 7;
      c.strokeRect(70, 50, 190, 150);
      // 벽에 걸린 마른 고추 줄
      c.strokeStyle = '#8a6a3a';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(820, 40);
      c.lineTo(820, 230);
      c.stroke();
      for (let i = 0; i < 8; i++) {
        c.save();
        c.translate(820 + (i % 2 ? 8 : -8), 60 + i * 22);
        c.rotate(i % 2 ? 0.5 : -0.5 + Math.PI);
        c.beginPath();
        c.moveTo(0, -4);
        c.quadraticCurveTo(22, -4, 26, 6);
        c.quadraticCurveTo(14, 4, 0, 5);
        c.closePath();
        c.fillStyle = '#c8261c';
        c.strokeStyle = OUT;
        c.lineWidth = 1.5;
        c.fill();
        c.stroke();
        c.restore();
      }
      // 바닥/작업대
      c.fillStyle = '#c98b55';
      c.fillRect(0, 400, W, H - 400);
      c.strokeStyle = '#a86d3c';
      c.lineWidth = 3;
      c.beginPath();
      for (let y = 430; y < H; y += 34) {
        c.moveTo(0, y);
        c.lineTo(W, y);
      }
      c.stroke();
      c.fillStyle = '#8f5a30';
      c.fillRect(0, 396, W, 8);

      const st = S.step;
      const T = S.stepT;

      if (st === 'salt') {
        drawBasin(c, 480, 330, false);
        drawCabbageHalf(c, 420, 335, 130, 0, -0.08);
        drawCabbageHalf(c, 540, 338, 130, 0, 0.08);
        c.save();
        c.translate(440, 200 + Math.sin(T * 6) * 3);
        c.rotate(0.9);
        drawItem(c, 'salt', 0, 0, 90);
        c.restore();
        text(c, t('kr.step.salt'), W / 2, 60, 34, '#ffffff');
      } else if (st === 'mix') {
        const col = mixColor('#f7b98d', '#d02a1a', S.mixP);
        drawBasin(c, 480, 330, true, col);
        for (let i = 0; i < 18; i++) {
          const a = S.spin * 1.4 + (i / 18) * Math.PI * 2;
          const r = 60 + (i % 3) * 45;
          const x = 480 + Math.cos(a) * r;
          const y = 338 + Math.sin(a) * r * 0.14;
          c.save();
          c.translate(x, y);
          c.rotate(a);
          if (i % 3 === 0) {
            c.fillStyle = mixColor('#ffffff', '#ff9a7a', S.mixP);
            c.fillRect(-10, -2.5, 20, 5);
          } else if (i % 3 === 1) {
            c.fillStyle = '#fff3d6';
            ell(c, 0, 0, 5, 4);
            c.fill();
          } else {
            c.fillStyle = '#9b1408';
            ell(c, 0, 0, 3, 3);
            c.fill();
          }
          c.restore();
        }
        // 나무 주걱
        c.save();
        const sa = Math.sin(S.spin * 2) * 0.5;
        c.translate(480 + Math.sin(S.spin * 2) * 80, 330);
        c.rotate(sa * 0.6 - 0.3);
        c.strokeStyle = OUT;
        c.lineWidth = 3;
        rrect(c, -7, -180, 14, 170, 6);
        fs(c, '#d9a45f');
        ell(c, 0, -6, 20, 30);
        fs(c, '#d9a45f');
        c.restore();
        // 진행 막대
        c.save();
        c.strokeStyle = OUT;
        c.lineWidth = 4;
        rrect(c, 330, 112, 300, 30, 15);
        fs(c, '#fff4e2');
        if (S.mixP > 0) {
          rrect(c, 334, 116, Math.max(22, 292 * S.mixP), 22, 11);
          c.fillStyle = S.mixP >= 1 ? '#7bc043' : '#e8473b';
          c.fill();
        }
        c.restore();
        text(c, `${Math.round(S.mixP * 100)}%`, 480, 128, 20, '#ffffff', { lw: 4 });
        text(c, t('kr.step.mix'), W / 2, 60, 34, '#ffffff');
        if (!S.mixDone) {
          const pulse = 1 + Math.sin(S.time * 8) * 0.06;
          text(c, t('kr.mixPrompt'), W / 2, 175, 22 * pulse, '#ffd23f');
        }
      } else if (st === 'spread') {
        const red = Math.min(1, T / 1.4);
        drawBasin(c, 400, 330, true, '#d02a1a');
        const jarIn = Math.min(1, T / 0.5);
        drawOnggi(c, 770, 470, 170 * jarIn, 190 * jarIn, { lid: 0, lw: 4 });
        [
          [340, 335, -0.08],
          [460, 338, 0.08],
        ].forEach(([x, y, r], i) => {
          const k = Math.max(0, Math.min(1, (T - 1.5 - i * 0.35) / 0.7));
          if (k >= 1) return;
          const ex = 770;
          const ey = 300;
          const xx = x + (ex - x) * k;
          const yy = y + (ey - y) * k - Math.sin(k * Math.PI) * 140;
          drawCabbageHalf(c, xx, yy, 130 * (1 - k * 0.4), red, r + k * 3);
        });
        if (T > 2.2) {
          c.save();
          c.globalAlpha = Math.min(1, (T - 2.2) * 3);
          drawOnggi(c, 770, 470, 170, 190, { lid: 0, lw: 4, kimchi: true });
          c.restore();
        }
        text(c, t('kr.step.spread'), W / 2, 60, 30, '#ffffff');
      } else if (st === 'done') {
        c.save();
        c.translate(560, 330);
        c.rotate(S.time * 0.5);
        c.fillStyle = 'rgba(255,230,120,.45)';
        for (let i = 0; i < 12; i++) {
          c.rotate((Math.PI * 2) / 12);
          c.beginPath();
          c.moveTo(0, 0);
          c.lineTo(-40, -420);
          c.lineTo(40, -420);
          c.closePath();
          c.fill();
        }
        c.restore();
        const lid = Math.min(1, T / 0.6);
        const sc = 1 + Math.max(0, 0.25 - T) * 1.2;
        drawOnggi(c, 560, 470, 200 * sc, 230 * sc, { lid, lw: 4, kimchi: true });
        for (let i = 0; i < 6; i++) {
          const a = S.time * 2 + i;
          c.fillStyle = '#fff6b0';
          star(c, 560 + Math.cos(a) * 150, 300 + Math.sin(a * 1.3) * 110, 9 + Math.sin(a * 3) * 3, a);
          c.fill();
        }
        const pop = Math.min(1, T * 3);
        text(c, t('kr.step.done'), W / 2, 76, 58 * (0.6 + pop * 0.4), '#ffd23f', { lw: 12 });
      }
      const chefPose = st === 'done' ? 'cheer' : st === 'mix' ? 'mix' : 'idle';
      drawChef(c, 150, 470, chefPose, S.time, { scale: 1.5 });
    }

    function renderParts(c) {
      S.parts.forEach((p) => {
        const a = Math.max(0, Math.min(1, p.life / (p.max * 0.5)));
        c.globalAlpha = a;
        if (p.kind === 'text') text(c, p.str, p.x, p.y, p.size, p.color, { lw: p.size * 0.25 });
        else if (p.kind === 'ring') {
          c.strokeStyle = p.color;
          c.lineWidth = 3;
          ell(c, p.x, p.y, p.size, p.size);
          c.stroke();
        } else if (p.kind === 'conf') {
          c.save();
          c.translate(p.x, p.y);
          c.rotate(p.rot + p.life * 4);
          c.fillStyle = p.color;
          c.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          c.restore();
        } else {
          c.fillStyle = p.color;
          ell(c, p.x, p.y, p.size, p.size);
          c.fill();
        }
      });
      c.globalAlpha = 1;
    }

    render();

    return {
      started: false,
      start() {
        this.started = true;
        S.phase = 'run';
        loop.start();
      },
      pause() {
        loop.stop();
        render();
      },
      resume() {
        if (S.phase !== 'done') loop.start();
      },
      destroy() {
        loop.stop();
      },
      render,
      // 테스트용: 상태 확인과 장애물/아이템 배치
      debug: {
        get state() {
          return S;
        },
        get running() {
          return loop.running;
        },
        spawnObstacle,
        spawnItem,
      },
    };
  }

  KK.games.register({
    id: 'kimchi-run',
    width: W,
    height: H,
    create,
    intro(t) {
      return {
        goal: t('kr.goal'),
        items: ING.map((i) => ({ icon: iconURL(i.id), label: `${t('kr.ing.' + i.id)} ×${i.need}`, sub: t('kr.sub.' + i.id) })),
        controls: [t('kr.ctrlKeys'), t('kr.ctrlTouch'), t('kr.avoid')],
      };
    },
    badges: [
      { id: 'kr_first', icon: jarIconURL, test: (r) => r.completed },
      { id: 'kr_flawless', icon: () => iconURL('heart'), test: (r) => r.completed && r.stats.hits === 0 },
      { id: 'kr_speed', icon: () => iconURL('chili'), test: (r) => r.completed && r.stats.timeUsed <= 35 },
      { id: 'kr_combo', icon: () => iconURL('garlic'), test: (r) => r.stats.maxCombo >= 10 },
      { id: 'kr_mix', icon: () => iconURL('cabbage'), test: (r) => r.completed && r.stats.perfectMix },
    ],
  });
})(window.KK);
