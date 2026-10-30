/* GAME 04 — KIWI FOREST RESCUE
 * 밤의 뉴질랜드 숲(옆으로 넓은 탐험 맵)을 돌아다니며 키위의 먹이(지렁이, 딱정벌레 애벌레)와
 * 둥지 재료(고사리, 이끼, 마른 잎)를 모아 굴(서식지)로 옮긴다.
 * 가방에는 5개까지만 들어가서 여러 번 오가야 한다. 스토트(북방족제비)와 개울을 조심!
 * 서식지가 완성되면 날지 못하는 새 키위가 걸어와 둥지에 자리 잡는다.
 * 다른 게임 코드와 독립된 파일이며, 모든 그림은 Canvas 로 직접 그린다. */
(function (KK) {
  'use strict';

  const W = 960;
  const H = 540;
  const LEVEL_W = 3200;
  const GROUND = 452;
  const TIME_LIMIT = 100;
  const MAX_HEARTS = 3;
  const BAG_MAX = 5;
  const GRAVITY = 2200;
  const JUMP_V = 800;
  const SPEED = 260;
  const BURROW_X = 130;
  const HOME_ZONE = 250;
  const OUT = '#1c1a2a';

  const NEEDS = [
    { id: 'worm', need: 4, points: 60, kind: 'food' },
    { id: 'grub', need: 3, points: 60, kind: 'food' },
    { id: 'fern', need: 3, points: 50, kind: 'nest' },
    { id: 'moss', need: 2, points: 50, kind: 'nest' },
    { id: 'leaf', need: 3, points: 50, kind: 'nest' },
  ];
  const NEED_BY_ID = {};
  NEEDS.forEach((n) => (NEED_BY_ID[n.id] = n));
  const TOTAL_NEED = NEEDS.reduce((a, n) => a + n.need, 0);

  const SEGS = [
    [0, 900],
    [1000, 1700],
    [1790, 2500],
    [2600, 3200],
  ];
  const PLATS = [
    { x: 300, y: 362, w: 140, k: 'log' },
    { x: 560, y: 302, w: 120, k: 'rock' },
    { x: 1150, y: 342, w: 160, k: 'log' },
    { x: 1400, y: 284, w: 130, k: 'rock' },
    { x: 1950, y: 352, w: 140, k: 'log' },
    { x: 2200, y: 292, w: 150, k: 'rock' },
    { x: 2750, y: 332, w: 150, k: 'log' },
    { x: 2980, y: 272, w: 140, k: 'rock' },
  ];
  const G = GROUND - 20;
  const ITEMS = [
    ['leaf', 270, G],
    ['worm', 480, G],
    ['fern', 370, 336],
    ['moss', 620, 276],
    ['worm', 800, G],
    ['grub', 1080, G],
    ['leaf', 1230, 316],
    ['fern', 1465, 258],
    ['worm', 1600, G],
    ['grub', 1870, G],
    ['leaf', 2020, 326],
    ['moss', 2275, 266],
    ['worm', 2420, G],
    ['grub', 2700, G],
    ['fern', 2825, 306],
    ['leaf', 3050, 246],
    ['worm', 3130, G],
    ['moss', 2950, G],
  ];
  const STOATS = [
    [600, 880, 90],
    [1250, 1680, 100],
    [1820, 2480, 110],
    [2620, 3150, 120],
  ];

  KK.i18n.add({
    en: {
      'kf.goal': 'Explore the night forest and gather food and nest materials for a kiwi. Your bag holds 5 things — carry them back to the burrow and put them in to build a safe home!',
      'kf.ctrlKeys': 'Keyboard: ← → or A D to walk, Space / ↑ to jump, ↓ or S at the burrow to put things in. P or Esc pauses.',
      'kf.ctrlTouch': 'Touch: ◀ ▶ to walk, JUMP to jump, PLACE at the burrow to put things in.',
      'kf.avoid': 'Watch out for stoats and jump over the streams — each one costs a heart. The map at the top shows where things are.',
      'kf.item.worm': 'Earthworm',
      'kf.item.grub': 'Beetle grub',
      'kf.item.fern': 'Fern frond',
      'kf.item.moss': 'Moss',
      'kf.item.leaf': 'Dry leaves',
      'kf.sub.worm': 'food · kiwi sniff them out',
      'kf.sub.grub': 'food · lives in rotting logs',
      'kf.sub.fern': 'soft nest lining',
      'kf.sub.moss': 'soft nest lining',
      'kf.sub.leaf': 'nest lining',
      'kf.bag': 'Bag',
      'kf.habitat': 'Habitat {p}%',
      'kf.bagFull': 'Bag full! Take it to the burrow.',
      'kf.spare': 'Spare +20',
      'kf.goHome': 'Go back to the burrow to put things in.',
      'kf.atHome': 'Press ↓ / PLACE to put things in the burrow',
      'kf.stoat': 'Stoat!',
      'kf.splash': 'Splash!',
      'kf.combo': 'Streak ×{n}',
      'kf.complete': 'The habitat is ready!',
      'kf.kiwiCome': 'Here comes a kiwi…',
      'kf.home': 'Home sweet home!',
      'kf.factsTitle': 'Meet the kiwi',
      'kf.fact1': 'Kiwi are flightless birds found only in New Zealand. Their tiny wings are hidden under hair-like feathers, and they have no tail.',
      'kf.fact2': 'Kiwi are mostly active at night. Their nostrils are at the tip of their long beak, so they can sniff out worms and grubs in the ground.',
      'kf.fact3': 'A kiwi egg is huge — up to about 20% of the mother’s body weight. Kiwi nest in burrows, hollow logs or thick plants.',
      'kf.tapContinue': 'Tap or press SPACE to continue',
      'kf.timeUp': "Time's up!",
      'kf.crashed': 'Out of hearts!',
      'kf.resultWin': 'Kiwi rescued!',
      'kf.resultFail': 'The habitat is not ready yet',
      'kf.left': 'Habitat {p}% · Still needed: {list}',
      'kf.bd.items': 'Items found',
      'kf.bd.combo': 'Streak bonus',
      'kf.bd.nest': 'Put in the burrow',
      'kf.bd.time': 'Time bonus',
      'kf.bd.hearts': 'Heart bonus',
      'kf.factTitle': 'Protecting kiwi',
      'kf.fact':
        'Introduced predators such as stoats, cats and dogs are a big threat to kiwi, especially to young chicks. Predator control, protected sanctuaries and programmes that hatch eggs safely are helping kiwi numbers recover in many places. People from New Zealand are often called “Kiwis” after this national bird.',
      'badge.kf_first.name': 'Kiwi Rescuer',
      'badge.kf_first.desc': 'Complete Kiwi Forest Rescue.',
      'badge.kf_safe.name': 'Stoat Dodger',
      'badge.kf_safe.desc': 'Finish without getting hurt.',
      'badge.kf_trips.name': 'Smart Packer',
      'badge.kf_trips.desc': 'Finish in only 3 trips to the burrow.',
      'badge.kf_fast.name': 'Night Sprinter',
      'badge.kf_fast.desc': 'Finish with 30 seconds or more left.',
      'badge.kf_explorer.name': 'Forest Explorer',
      'badge.kf_explorer.desc': 'Find all 18 items in the forest.',
    },
    ko: {
      'kf.goal': '밤의 숲을 탐험하며 키위의 먹이와 둥지 재료를 모아요. 가방에는 5개까지 들어가요. 굴로 가져가 넣어서 안전한 보금자리를 만들어 주세요!',
      'kf.ctrlKeys': '키보드: ← → 또는 A D로 걷기, Space / ↑로 점프, 굴 앞에서 ↓ 또는 S로 넣기. P 또는 Esc로 일시정지.',
      'kf.ctrlTouch': '터치: ◀ ▶로 걷기, 점프 버튼으로 점프, 굴 앞에서 넣기 버튼.',
      'kf.avoid': '스토트(북방족제비)를 조심하고 개울은 뛰어넘어요. 부딪히거나 빠지면 하트가 줄어요. 위쪽 지도에 물건 위치가 보여요.',
      'kf.item.worm': '지렁이',
      'kf.item.grub': '딱정벌레 애벌레',
      'kf.item.fern': '고사리 잎',
      'kf.item.moss': '이끼',
      'kf.item.leaf': '마른 잎',
      'kf.sub.worm': '먹이 · 키위가 냄새로 찾아요',
      'kf.sub.grub': '먹이 · 썩은 통나무에 살아요',
      'kf.sub.fern': '푹신한 둥지 깔개',
      'kf.sub.moss': '푹신한 둥지 깔개',
      'kf.sub.leaf': '둥지 깔개',
      'kf.bag': '가방',
      'kf.habitat': '서식지 {p}%',
      'kf.bagFull': '가방이 꽉 찼어요! 굴로 가져가요.',
      'kf.spare': '여분 +20',
      'kf.goHome': '굴로 돌아가서 넣어요.',
      'kf.atHome': '↓ 또는 넣기 버튼으로 굴에 넣어요',
      'kf.stoat': '스토트!',
      'kf.splash': '풍덩!',
      'kf.combo': '연속 ×{n}',
      'kf.complete': '서식지 완성!',
      'kf.kiwiCome': '키위가 오고 있어요…',
      'kf.home': '새 보금자리 도착!',
      'kf.factsTitle': '키위를 소개해요',
      'kf.fact1': '키위는 뉴질랜드에만 사는 날지 못하는 새예요. 털 같은 깃털 속에 아주 작은 날개가 숨어 있고, 꼬리가 없어요.',
      'kf.fact2': '키위는 주로 밤에 활동해요. 콧구멍이 긴 부리 끝에 있어서 땅속의 지렁이와 애벌레를 냄새로 찾아내요.',
      'kf.fact3': '키위 알은 엄청 커요. 어미 몸무게의 최대 약 20%나 돼요! 키위는 굴, 속이 빈 통나무, 빽빽한 수풀에 둥지를 틀어요.',
      'kf.tapContinue': '탭하거나 SPACE를 눌러 계속',
      'kf.timeUp': '시간 종료!',
      'kf.crashed': '하트를 모두 잃었어요!',
      'kf.resultWin': '키위 구조 성공!',
      'kf.resultFail': '서식지가 아직 완성되지 않았어요',
      'kf.left': '서식지 {p}% · 부족한 것: {list}',
      'kf.bd.items': '찾은 물건',
      'kf.bd.combo': '연속 수집 보너스',
      'kf.bd.nest': '굴에 넣기',
      'kf.bd.time': '남은 시간 보너스',
      'kf.bd.hearts': '하트 보너스',
      'kf.factTitle': '키위 지키기',
      'kf.fact':
        '스토트(북방족제비), 고양이, 개처럼 사람이 들여온 포식자는 키위, 특히 어린 새끼에게 큰 위협이에요. 포식자 관리, 보호 구역, 알을 안전하게 부화시키는 프로그램 덕분에 여러 곳에서 키위 수가 다시 늘고 있어요. 뉴질랜드 사람들을 이 나라의 상징인 새 이름을 따서 "키위"라고 부르기도 해요.',
      'badge.kf_first.name': '키위 구조대',
      'badge.kf_first.desc': '키위 숲 구조대를 완성했어요.',
      'badge.kf_safe.name': '스토트 피하기 달인',
      'badge.kf_safe.desc': '한 번도 다치지 않고 완성했어요.',
      'badge.kf_trips.name': '똑똑한 짐꾼',
      'badge.kf_trips.desc': '굴에 3번만 다녀와서 완성했어요.',
      'badge.kf_fast.name': '밤의 달리기 선수',
      'badge.kf_fast.desc': '30초 이상 남기고 완성했어요.',
      'badge.kf_explorer.name': '숲 탐험가',
      'badge.kf_explorer.desc': '숲속 물건 18개를 모두 찾았어요.',
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
  function text(c, str, x, y, size, fill, o) {
    o = o || {};
    c.save();
    c.font = `${o.weight || 700} ${size}px ${KK.ui.FONT}`;
    c.textAlign = o.align || 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    if (o.lw !== 0) {
      c.lineWidth = o.lw || size * 0.22;
      c.strokeStyle = o.stroke || OUT;
      c.strokeText(str, x, y);
    }
    c.fillStyle = fill;
    c.fillText(str, x, y);
    c.restore();
  }
  function wrapLines(c, str, maxW) {
    const words = str.split(' ');
    const lines = [];
    let line = '';
    words.forEach((w) => {
      const test = line ? line + ' ' + w : w;
      if (c.measureText(test).width <= maxW) line = test;
      else {
        if (line) lines.push(line);
        line = w;
      }
    });
    if (line) lines.push(line);
    return lines;
  }

  /* ----- 물건 그림 (단위 좌표 -1..1) ----- */
  const ART = {
    worm(c, tm) {
      const k = Math.sin((tm || 0) * 6) * 0.15;
      c.lineCap = 'round';
      c.strokeStyle = OUT;
      c.lineWidth = 0.42;
      const path = () => {
        c.beginPath();
        c.moveTo(-0.8, 0.2);
        c.bezierCurveTo(-0.4, -0.5 - k, -0.1, 0.6 + k, 0.25, 0.0);
        c.quadraticCurveTo(0.5, -0.45 - k, 0.8, -0.2);
      };
      path();
      c.stroke();
      c.strokeStyle = '#e58a8f';
      c.lineWidth = 0.28;
      path();
      c.stroke();
      c.strokeStyle = '#c96a72';
      c.lineWidth = 0.05;
      [-0.5, -0.2, 0.1, 0.4].forEach((x) => {
        c.beginPath();
        c.moveTo(x, -0.1);
        c.lineTo(x + 0.05, 0.12);
        c.stroke();
      });
      c.fillStyle = OUT;
      ell(c, 0.78, -0.24, 0.04, 0.04);
      c.fill();
    },
    grub(c) {
      c.beginPath();
      c.arc(0, 0.05, 0.6, Math.PI * 0.15, Math.PI * 1.55);
      c.lineWidth = 0.5;
      c.strokeStyle = OUT;
      c.stroke();
      c.lineWidth = 0.36;
      c.strokeStyle = '#fbf0d2';
      c.stroke();
      c.strokeStyle = '#d9c39a';
      c.lineWidth = 0.05;
      for (let i = 0; i < 6; i++) {
        const a = Math.PI * 0.3 + i * 0.22;
        c.beginPath();
        c.moveTo(Math.cos(a) * 0.43, 0.05 + Math.sin(a) * 0.43);
        c.lineTo(Math.cos(a) * 0.77, 0.05 + Math.sin(a) * 0.77);
        c.stroke();
      }
      c.strokeStyle = OUT;
      c.lineWidth = 0.08;
      ell(c, 0.48, -0.5, 0.2, 0.18);
      fs(c, '#a0602e');
    },
    fern(c) {
      c.strokeStyle = OUT;
      c.lineWidth = 0.1;
      c.beginPath();
      c.moveTo(-0.1, 0.95);
      c.quadraticCurveTo(-0.15, -0.2, 0.25, -0.85);
      c.stroke();
      c.strokeStyle = '#4c9a2a';
      c.lineWidth = 0.06;
      c.stroke();
      for (let i = 0; i < 7; i++) {
        const tt = 0.12 + i * 0.12;
        const x = -0.1 + (-0.05 + 0.4 * tt * tt) * 1.2 - 0.02;
        const y = 0.95 - tt * 1.8;
        const len = 0.55 * (1 - tt * 0.7);
        [-1, 1].forEach((sg) => {
          c.save();
          c.translate(x, y);
          c.rotate(sg * 1.1 - 0.2);
          ell(c, 0, -len / 2, 0.09, len / 2);
          c.fillStyle = '#6cc04a';
          c.strokeStyle = OUT;
          c.lineWidth = 0.05;
          c.fill();
          c.stroke();
          c.restore();
        });
      }
    },
    moss(c) {
      ell(c, 0, 0.45, 0.75, 0.32);
      fs(c, '#8f8a80');
      c.fillStyle = '#5aa63a';
      [
        [-0.45, 0.05, 0.3],
        [-0.1, -0.12, 0.36],
        [0.32, 0.0, 0.32],
        [0.0, 0.18, 0.4],
      ].forEach(([x, y, r]) => {
        ell(c, x, y, r, r * 0.8);
        fs(c, '#5aa63a');
      });
      c.fillStyle = '#8fd46a';
      [
        [-0.4, -0.05],
        [-0.05, -0.3],
        [0.3, -0.12],
        [0.1, 0.1],
      ].forEach(([x, y]) => {
        ell(c, x, y, 0.07, 0.05);
        c.fill();
      });
    },
    leaf(c) {
      const leaf = (rot, col) => {
        c.save();
        c.rotate(rot);
        c.beginPath();
        c.moveTo(0, 0.85);
        c.quadraticCurveTo(-0.55, 0.1, 0, -0.85);
        c.quadraticCurveTo(0.55, 0.1, 0, 0.85);
        c.closePath();
        fs(c, col);
        c.strokeStyle = 'rgba(80,40,10,.6)';
        c.lineWidth = 0.05;
        c.beginPath();
        c.moveTo(0, 0.8);
        c.lineTo(0, -0.7);
        c.stroke();
        c.restore();
      };
      c.strokeStyle = OUT;
      c.lineWidth = 0.08;
      leaf(-0.5, '#c97a2c');
      c.strokeStyle = OUT;
      c.lineWidth = 0.08;
      leaf(0.4, '#e2a14a');
    },
  };

  function drawItem(c, type, x, y, size, tm) {
    c.save();
    c.translate(x, y);
    c.scale(size / 2, size / 2);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.strokeStyle = OUT;
    c.lineWidth = 0.09;
    ART[type](c, tm);
    c.restore();
  }

  /* ----- 키위 새 (날지 못함: 날개·꼬리 없이 걸어 다닌다) ----- */
  function drawKiwi(c, x, y, s, tm, o) {
    o = o || {};
    c.save();
    c.translate(x, y);
    c.scale(o.flip ? -s : s, s);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    const walk = o.walk ? Math.sin(tm * 10) : 0;
    const probe = o.probe ? 0.5 + Math.sin(tm * 6) * 0.15 : 0;
    // 다리
    c.strokeStyle = '#c9934a';
    c.lineWidth = 5;
    [
      [-8, walk * 6],
      [8, -walk * 6],
    ].forEach(([dx, sw]) => {
      c.beginPath();
      c.moveTo(dx, -18);
      c.lineTo(dx + sw, 0);
      c.lineTo(dx + sw + 8, 0);
      c.moveTo(dx + sw, 0);
      c.lineTo(dx + sw - 5, 2);
      c.stroke();
    });
    // 몸통
    c.strokeStyle = OUT;
    c.lineWidth = 3;
    ell(c, 0, -34, 32, 24, -0.08 + probe * 0.25);
    fs(c, '#8a5a33');
    c.strokeStyle = '#6b4325';
    c.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const fx = -22 + i * 8;
      const fy = -40 + (i % 2) * 10;
      c.beginPath();
      c.moveTo(fx, fy);
      c.quadraticCurveTo(fx + 4, fy - 5, fx + 8, fy);
      c.stroke();
    }
    // 머리 + 부리
    c.save();
    c.translate(26, -46);
    c.rotate(probe);
    c.strokeStyle = OUT;
    c.lineWidth = 3;
    ell(c, 0, 0, 13, 12);
    fs(c, '#8a5a33');
    c.strokeStyle = OUT;
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(10, 4);
    c.quadraticCurveTo(26, 14, 34, 32);
    c.stroke();
    c.strokeStyle = '#ecd49c';
    c.lineWidth = 3.5;
    c.stroke();
    c.fillStyle = OUT;
    ell(c, 4, -3, 2.6, 2.6);
    c.fill();
    c.fillStyle = '#fff';
    ell(c, 5, -4, 0.9, 0.9);
    c.fill();
    c.strokeStyle = '#3a2416';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(-2, -4);
    c.lineTo(-8, -10);
    c.moveTo(1, -6);
    c.lineTo(-2, -13);
    c.stroke();
    c.restore();
    c.restore();
  }

  /* ----- 레인저 아이 (헤드램프) ----- */
  function drawRanger(c, x, y, pose, tm, o) {
    o = o || {};
    c.save();
    c.translate(x, y);
    c.scale(o.face || 1, 1);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    const walk = o.walk || 0;
    const legA = pose === 'walk' ? Math.sin(walk) * 0.7 : pose === 'jump' ? -0.6 : 0;
    const bob = pose === 'walk' ? -Math.abs(Math.cos(walk)) * 3 : pose === 'cheer' ? -Math.abs(Math.sin(tm * 7)) * 10 : 0;
    c.translate(0, bob);
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
      c.stroke();
      c.strokeStyle = OUT;
      c.lineWidth = 2.5;
      if (end === 'boot') {
        ell(c, 4, len + 3, 9, 5);
        fs(c, '#5a3b26');
      } else {
        ell(c, 0, len + 2, 5.5, 5.5);
        fs(c, '#ffd6b0');
      }
      c.restore();
    };
    // 가방 (채운 만큼 불룩)
    const fill = o.bag || 0;
    c.strokeStyle = OUT;
    c.lineWidth = 3;
    rrect(c, -26 - fill * 2, -66, 16 + fill * 2, 30, 6);
    fs(c, '#3f7d4a');
    limb(-4, -28, -legA, 22, '#30405a', 8, 'boot');
    limb(-7, -56, pose === 'cheer' ? 2.7 : legA * 0.8, 18, '#ff8a1f', 7, 'hand');
    c.strokeStyle = OUT;
    c.lineWidth = 3;
    rrect(c, -15, -62, 30, 36, 10);
    fs(c, '#ff8a1f');
    c.fillStyle = '#fff3a0';
    c.fillRect(-15, -48, 30, 5);
    limb(4, -28, legA, 22, '#30405a', 8, 'boot');
    // 머리 + 모자 + 헤드램프
    const hy = -80;
    ell(c, 2, hy, 17, 17);
    fs(c, '#ffd6b0');
    c.beginPath();
    c.moveTo(-17, hy - 2);
    c.quadraticCurveTo(-14, hy - 22, 4, hy - 21);
    c.quadraticCurveTo(20, hy - 20, 20, hy - 6);
    c.lineTo(28, hy - 5);
    c.lineTo(20, hy - 1);
    c.lineTo(-17, hy - 2);
    c.closePath();
    fs(c, '#2f6b3a');
    ell(c, 14, hy - 9, 4, 4);
    fs(c, '#fff7b0');
    c.fillStyle = OUT;
    if (pose === 'hurt') {
      c.strokeStyle = OUT;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(6, hy + 1);
      c.lineTo(11, hy + 3);
      c.moveTo(16, hy + 1);
      c.lineTo(11, hy + 3);
      c.stroke();
    } else {
      ell(c, 8, hy + 1, 2.3, 3.3);
      c.fill();
      ell(c, 15, hy + 1, 2.3, 3.3);
      c.fill();
    }
    c.fillStyle = 'rgba(255,120,140,.5)';
    ell(c, 17, hy + 8, 3.4, 2.2);
    c.fill();
    c.strokeStyle = OUT;
    c.lineWidth = 2;
    c.beginPath();
    if (pose === 'hurt') c.arc(11, hy + 12, 3, Math.PI * 1.15, Math.PI * 1.85);
    else c.arc(11, hy + 8, 3.4, 0.2, Math.PI - 0.2);
    c.stroke();
    limb(6, -56, pose === 'cheer' ? -2.7 : -legA * 0.8, 18, '#ff8a1f', 7, 'hand');
    c.restore();
  }

  /* ----- 스토트 (북방족제비: 갈색 몸, 크림색 배, 꼬리 끝이 검다) ----- */
  function drawStoat(c, x, y, dir, tm) {
    c.save();
    c.translate(x, y);
    c.scale(dir, 1);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    const run = Math.sin(tm * 16);
    c.strokeStyle = OUT;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(-26, -14);
    c.quadraticCurveTo(-44, -26 + run * 3, -52, -16);
    c.stroke();
    c.strokeStyle = '#a26a3c';
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(-26, -14);
    c.quadraticCurveTo(-40, -22 + run * 3, -46, -18);
    c.stroke();
    c.fillStyle = '#1a1414';
    ell(c, -50, -17, 6, 4.5, -0.4);
    c.fill();
    c.strokeStyle = OUT;
    c.lineWidth = 3;
    [-16, 14].forEach((dx, i) => {
      const sw = (i ? -run : run) * 5;
      c.beginPath();
      c.moveTo(dx, -8);
      c.lineTo(dx + sw, 0);
      c.stroke();
    });
    rrect(c, -30, -24, 52, 18, 9);
    fs(c, '#a26a3c');
    c.fillStyle = '#f2e3c4';
    rrect(c, -22, -12, 38, 6, 3);
    c.fill();
    ell(c, 26, -22, 12, 9);
    fs(c, '#a26a3c');
    ell(c, 22, -30, 4, 4);
    fs(c, '#a26a3c');
    c.fillStyle = '#f2e3c4';
    ell(c, 30, -17, 7, 4);
    c.fill();
    c.fillStyle = OUT;
    ell(c, 36, -21, 2.4, 2.4);
    c.fill();
    c.restore();
  }

  /* ----- 숲 배경 ----- */
  const STARS = [];
  for (let i = 0; i < 60; i++) STARS.push([(i * 173) % W, (i * 67) % 230, (i % 3) + 1]);
  const TREES = [];
  for (let i = 0; i < 22; i++) TREES.push([i * 160 + ((i * 53) % 70), 0.8 + ((i * 37) % 30) / 60, i % 3]);
  const FERNS = [];
  for (let i = 0; i < 40; i++) FERNS.push([i * 85 + ((i * 41) % 50), 0.6 + ((i * 29) % 40) / 80]);
  const GLOW = [];
  for (let i = 0; i < 70; i++) GLOW.push([(i * 137) % LEVEL_W, GROUND + 12 + ((i * 31) % 70), i * 0.7]);

  function onGround(x) {
    return SEGS.some((s) => x >= s[0] && x <= s[1]);
  }

  function drawTreeFern(c, x, base, s, col) {
    c.save();
    c.translate(x, base);
    c.scale(s, s);
    c.fillStyle = col;
    c.fillRect(-6, -150, 12, 150);
    c.strokeStyle = col;
    c.lineWidth = 5;
    for (let i = 0; i < 9; i++) {
      const a = Math.PI + (i / 8) * Math.PI;
      c.beginPath();
      c.moveTo(0, -150);
      c.quadraticCurveTo(Math.cos(a) * 60, -150 + Math.sin(a) * 50, Math.cos(a) * 95, -150 + Math.sin(a) * 30 + 40);
      c.stroke();
    }
    c.restore();
  }

  function drawForest(c, cam, tm) {
    const sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#0b1636');
    sky.addColorStop(0.6, '#163e52');
    sky.addColorStop(1, '#1d4d4a');
    c.fillStyle = sky;
    c.fillRect(0, 0, W, H);
    STARS.forEach(([x, y, r], i) => {
      c.globalAlpha = 0.5 + Math.sin(tm * 2 + i) * 0.3;
      c.fillStyle = '#ffffff';
      ell(c, x, y, r * 0.8, r * 0.8);
      c.fill();
    });
    c.globalAlpha = 1;
    c.fillStyle = 'rgba(255,248,210,.25)';
    ell(c, 780, 90, 60, 60);
    c.fill();
    c.fillStyle = '#fff6d6';
    ell(c, 780, 90, 36, 36);
    c.fill();
    // 먼 언덕
    c.fillStyle = '#123a3e';
    c.beginPath();
    c.moveTo(0, H);
    for (let x = 0; x <= W + 40; x += 40) {
      const wx = x + cam * 0.15;
      c.lineTo(x, 300 - Math.sin(wx * 0.004) * 50 - Math.sin(wx * 0.011) * 20);
    }
    c.lineTo(W, H);
    c.closePath();
    c.fill();
    // 중간 나무와 나무고사리
    TREES.forEach(([tx, s, k]) => {
      const x = tx * 1.0 - cam * 0.5;
      const span = LEVEL_W * 0.5 + W;
      const sx = ((x % span) + span) % span - 100;
      if (sx < -150 || sx > W + 150) return;
      if (k === 0) drawTreeFern(c, sx, GROUND + 10, s, '#0f2f2c');
      else {
        c.fillStyle = '#0f2f2c';
        c.fillRect(sx - 12 * s, 120, 24 * s, GROUND - 110);
        ell(c, sx, 140, 80 * s, 60 * s);
        c.fill();
        ell(c, sx - 50 * s, 180, 60 * s, 40 * s);
        c.fill();
        ell(c, sx + 50 * s, 175, 60 * s, 42 * s);
        c.fill();
      }
    });
  }

  function drawGroundLayer(c, tm) {
    // 개울
    for (let i = 0; i < SEGS.length - 1; i++) {
      const x0 = SEGS[i][1];
      const x1 = SEGS[i + 1][0];
      const wg = c.createLinearGradient(0, GROUND + 20, 0, H);
      wg.addColorStop(0, '#2f7fb0');
      wg.addColorStop(1, '#174a6a');
      c.fillStyle = wg;
      c.fillRect(x0, GROUND + 26, x1 - x0, H - GROUND);
      c.strokeStyle = 'rgba(255,255,255,.45)';
      c.lineWidth = 2;
      c.beginPath();
      for (let x = x0 + 6; x < x1 - 10; x += 22) {
        const yy = GROUND + 34 + Math.sin(tm * 3 + x) * 3;
        c.moveTo(x, yy);
        c.quadraticCurveTo(x + 6, yy - 3, x + 12, yy);
      }
      c.stroke();
    }
    // 땅
    SEGS.forEach(([a, b]) => {
      c.fillStyle = '#3a2c22';
      c.fillRect(a, GROUND, b - a, H - GROUND);
      c.fillStyle = '#2f7a3a';
      c.fillRect(a, GROUND - 4, b - a, 12);
      c.strokeStyle = OUT;
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(a, GROUND - 4);
      c.lineTo(b, GROUND - 4);
      c.moveTo(a, GROUND - 4);
      c.lineTo(a, H);
      c.moveTo(b, GROUND - 4);
      c.lineTo(b, H);
      c.stroke();
    });
    GLOW.forEach(([x, y, ph]) => {
      if (!onGround(x)) return;
      c.fillStyle = `rgba(150,255,220,${0.35 + Math.sin(tm * 2 + ph) * 0.3})`;
      ell(c, x, y, 2, 2);
      c.fill();
    });
    FERNS.forEach(([x, s]) => {
      if (!onGround(x) || x < 260) return;
      c.save();
      c.translate(x, GROUND - 2);
      c.scale(s, s);
      c.strokeStyle = '#3f9a4a';
      c.lineWidth = 3;
      for (let i = -2; i <= 2; i++) {
        c.beginPath();
        c.moveTo(0, 0);
        c.quadraticCurveTo(i * 10, -30, i * 22, -26 + Math.abs(i) * 6);
        c.stroke();
      }
      c.restore();
    });
    // 발판 (통나무, 바위)
    PLATS.forEach((p) => {
      c.save();
      c.strokeStyle = OUT;
      c.lineWidth = 3;
      if (p.k === 'log') {
        rrect(c, p.x, p.y, p.w, 22, 11);
        fs(c, '#7a5232');
        c.strokeStyle = '#5c3b22';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(p.x + 14, p.y + 8);
        c.lineTo(p.x + p.w - 20, p.y + 8);
        c.moveTo(p.x + 24, p.y + 15);
        c.lineTo(p.x + p.w - 30, p.y + 15);
        c.stroke();
        c.strokeStyle = OUT;
        c.lineWidth = 3;
        ell(c, p.x + p.w, p.y + 11, 7, 11);
        fs(c, '#c79a62');
        c.fillStyle = '#4c9a2a';
        ell(c, p.x + p.w * 0.4, p.y + 2, 18, 5);
        c.fill();
        // 받침 기둥
        c.fillStyle = '#4a3424';
        c.fillRect(p.x + 18, p.y + 22, 10, GROUND - p.y - 22);
        c.fillRect(p.x + p.w - 30, p.y + 22, 10, GROUND - p.y - 22);
      } else {
        c.beginPath();
        c.moveTo(p.x, p.y + 12);
        c.quadraticCurveTo(p.x + 4, p.y - 2, p.x + 26, p.y);
        c.lineTo(p.x + p.w - 20, p.y);
        c.quadraticCurveTo(p.x + p.w, p.y, p.x + p.w, p.y + 18);
        c.lineTo(p.x + p.w - 8, GROUND);
        c.lineTo(p.x + 10, GROUND);
        c.closePath();
        fs(c, '#5d6370');
        c.fillStyle = '#4c9a2a';
        ell(c, p.x + p.w * 0.5, p.y + 1, p.w * 0.35, 5);
        c.fill();
      }
      c.restore();
    });
  }

  function drawBurrow(c, dep, tm) {
    const x = BURROW_X;
    c.save();
    c.strokeStyle = OUT;
    c.lineWidth = 3;
    c.lineJoin = 'round';
    // 큰 나무와 뿌리
    c.beginPath();
    c.moveTo(x - 110, GROUND);
    c.quadraticCurveTo(x - 60, GROUND - 40, x - 40, GROUND - 300);
    c.lineTo(x + 40, GROUND - 300);
    c.quadraticCurveTo(x + 60, GROUND - 40, x + 120, GROUND);
    c.closePath();
    fs(c, '#4a3424');
    c.fillStyle = '#1f4a2c';
    [
      [x - 60, GROUND - 330, 90],
      [x + 50, GROUND - 350, 100],
      [x, GROUND - 400, 90],
    ].forEach(([cx, cy, r]) => {
      ell(c, cx, cy, r, r * 0.7);
      fs(c, '#1f4a2c');
    });
    // 굴 입구
    ell(c, x, GROUND - 22, 52, 36);
    fs(c, '#140e0c');
    // 둥지 깔개 (넣은 만큼 보인다)
    const nestCols = { leaf: '#d38a3a', moss: '#5aa63a', fern: '#6cc04a' };
    let k = 0;
    ['leaf', 'moss', 'fern'].forEach((id) => {
      for (let i = 0; i < dep[id]; i++) {
        c.fillStyle = nestCols[id];
        ell(c, x - 32 + ((k * 23) % 64), GROUND - 6 - (k % 3) * 5, 13, 6, (k % 2 ? 0.3 : -0.3));
        c.fill();
        k++;
      }
    });
    // 먹이 자리
    for (let i = 0; i < dep.worm; i++) drawItem(c, 'worm', x + 70 + i * 14, GROUND - 8, 16, tm + i);
    for (let i = 0; i < dep.grub; i++) drawItem(c, 'grub', x + 76 + i * 16, GROUND - 22, 14);
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
      phase: 'ready', // ready | run | over | finale | facts | done
      time: 0,
      elapsed: 0,
      timeLeft: TIME_LIMIT,
      hearts: MAX_HEARTS,
      cam: 0,
      bag: [],
      deposited: {},
      collected: {},
      found: 0,
      itemPts: 0,
      comboPts: 0,
      nestPts: 0,
      combo: 0,
      maxCombo: 0,
      hits: 0,
      trips: 0,
      items: ITEMS.map(([type, x, y], i) => ({ id: i, type, x, y, taken: false, ph: i })),
      stoats: STOATS.map(([a, b, sp]) => ({ min: a, max: b, x: (a + b) / 2, dir: 1, speed: sp })),
      parts: [],
      flyers: [],
      depositQ: [],
      depositT: 0,
      hintT: 0,
      overT: 0,
      overReason: null,
      finT: 0,
      factIdx: 0,
      factT: 0,
      completeTime: null,
      lastShownTime: null,
      shake: 0,
      player: { x: 170, y: GROUND, vy: 0, onGround: true, face: 1, inv: 0, coyote: 0, buffer: 0, walk: 0, moving: false, safeX: 170 },
    };
    NEEDS.forEach((n) => {
      S.deposited[n.id] = 0;
      S.collected[n.id] = 0;
    });

    hud.setTime(TIME_LIMIT);
    hud.setHearts(S.hearts, MAX_HEARTS);
    hud.setScore(0);
    hud.setTracker(NEEDS.map((n) => ({ id: n.id, icon: iconURL(n.id), label: t('kf.item.' + n.id), have: 0, need: n.need })));
    api.setControls(['left', 'right', 'place', 'jump']);

    const depositedTotal = () => NEEDS.reduce((a, n) => a + Math.min(n.need, S.deposited[n.id]), 0);
    const habitatPct = () => Math.round((depositedTotal() / TOTAL_NEED) * 100);
    const liveScore = () => S.itemPts + S.comboPts + S.nestPts;
    const atHome = () => S.player.x < HOME_ZONE;

    function burst(x, y, colors, n, power) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = rand(0.4, 1) * (power || 220);
        S.parts.push({ kind: 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: rand(0.4, 0.8), max: 0.8, size: rand(2, 5), color: colors[i % colors.length], g: 500, world: true });
      }
    }
    function floatText(str, x, y, color, size) {
      S.parts.push({ kind: 'text', str, x, y, vx: 0, vy: -55, life: 1.2, max: 1.2, size: size || 22, color: color || '#fff', g: 0, world: true });
    }

    function pickUp(it) {
      const P = S.player;
      const n = NEED_BY_ID[it.type];
      if (S.collected[it.type] >= n.need) {
        it.taken = true;
        S.found += 1;
        S.itemPts += 20;
        hud.setScore(liveScore());
        floatText(t('kf.spare'), it.x, it.y - 30, '#bff0ff', 18);
        burst(it.x, it.y, ['#bff0ff', '#ffffff'], 8);
        audio.play('collect', 0);
        return;
      }
      if (S.bag.length >= BAG_MAX) {
        if (S.hintT <= 0) {
          floatText(t('kf.bagFull'), P.x, P.y - 120, '#ffd23f', 18);
          audio.play('land');
          S.hintT = 1.4;
        }
        return;
      }
      it.taken = true;
      S.found += 1;
      S.bag.push(it.type);
      S.collected[it.type] += 1;
      S.combo += 1;
      S.maxCombo = Math.max(S.maxCombo, S.combo);
      const cb = S.combo > 1 ? Math.min(100, (S.combo - 1) * 10) : 0;
      S.itemPts += n.points;
      S.comboPts += cb;
      hud.setScore(liveScore());
      hud.updateTracker(it.type, S.collected[it.type], n.need);
      floatText(`+${n.points + cb}`, it.x, it.y - 34, '#fff2a8', 24);
      floatText(t('kf.item.' + it.type), it.x, it.y - 10, '#ffffff', 16);
      if (S.combo >= 3) floatText(t('kf.combo', { n: S.combo }), P.x, P.y - 130, '#ffd23f', 18);
      burst(it.x, it.y, ['#ffd23f', '#ffffff', '#8fd46a'], 12);
      audio.play('collect', S.combo);
    }

    function hurt(reason) {
      const P = S.player;
      S.hearts -= 1;
      S.hits += 1;
      S.combo = 0;
      P.inv = 1.6;
      S.shake = 10;
      hud.setHearts(S.hearts, MAX_HEARTS);
      floatText(t(reason === 'water' ? 'kf.splash' : 'kf.stoat'), P.x, P.y - 110, '#ff9a9a', 24);
      audio.play('hit');
      if (S.hearts <= 0) gameOver('crash');
    }

    function deposit() {
      if (!S.bag.length || S.depositQ.length) return;
      S.trips += 1;
      S.depositQ = S.bag.slice();
      S.bag = [];
      S.depositT = 0;
    }

    function gameOver(reason) {
      if (S.phase !== 'run') return;
      S.phase = 'over';
      S.overReason = reason;
      S.overT = 0;
      hud.banner(reason === 'time' ? t('kf.timeUp') : t('kf.crashed'), 'lose', 1700);
      audio.play('fail');
    }

    function complete() {
      S.phase = 'finale';
      S.finT = 0;
      S.completeTime = S.elapsed;
      api.setControls([]);
      hud.banner(t('kf.complete'), 'win', 1800);
      audio.play('fanfare');
      burst(BURROW_X, GROUND - 40, ['#ffd23f', '#8fd46a', '#ffffff', '#ff7eb6'], 40, 360);
    }

    function finish(completed) {
      if (S.phase === 'done') return;
      S.phase = 'done';
      const breakdown = [
        { label: t('kf.bd.items'), value: S.itemPts },
        { label: t('kf.bd.combo'), value: S.comboPts },
        { label: t('kf.bd.nest'), value: S.nestPts },
      ];
      let score = liveScore();
      if (completed) {
        const timeB = Math.ceil(S.timeLeft) * 10;
        const heartB = S.hearts * 150;
        breakdown.push({ label: t('kf.bd.time'), value: timeB }, { label: t('kf.bd.hearts'), value: heartB });
        score += timeB + heartB;
      }
      const list = NEEDS.filter((n) => S.deposited[n.id] < n.need)
        .map((n) => `${t('kf.item.' + n.id)} ×${n.need - S.deposited[n.id]}`)
        .join(', ');
      api.finish({
        completed,
        score,
        time: completed ? S.completeTime : null,
        title: completed ? t('kf.resultWin') : t('kf.resultFail'),
        subtitle: completed ? null : `${S.overReason === 'time' ? t('kf.timeUp') : t('kf.crashed')} ${t('kf.left', { p: habitatPct(), list })}`,
        breakdown,
        stats: { hits: S.hits, trips: S.trips, found: S.found, timeLeft: S.timeLeft, maxCombo: S.maxCombo },
        fact: { title: t('kf.factTitle'), text: t('kf.fact') },
      });
    }

    /* ----- update ----- */
    function update(dt) {
      S.time += dt;
      if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 40);
      S.hintT -= dt;
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
      for (let i = S.flyers.length - 1; i >= 0; i--) {
        S.flyers[i].k += dt * 3;
        if (S.flyers[i].k >= 1) S.flyers.splice(i, 1);
      }
      if (S.phase === 'run' || S.phase === 'over') updateRun(dt);
      else if (S.phase === 'finale') updateFinale(dt);
      else if (S.phase === 'facts') updateFacts(dt);
      const target = Math.max(0, Math.min(LEVEL_W - W, (S.phase === 'finale' || S.phase === 'facts' ? 0 : S.player.x - W * 0.4)));
      S.cam += (target - S.cam) * Math.min(1, dt * 6);
    }

    function updateRun(dt) {
      const P = S.player;
      const running = S.phase === 'run';
      if (running) {
        S.elapsed += dt;
        S.timeLeft = Math.max(0, S.timeLeft - dt);
        const shown = Math.ceil(S.timeLeft);
        if (shown !== S.lastShownTime) {
          S.lastShownTime = shown;
          hud.setTime(S.timeLeft);
        }
      }
      let dir = 0;
      if (running) {
        dir = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
        if (dir) P.face = dir;
        if (input.consume('jump') || input.consume('tap')) P.buffer = 0.13;
        if (input.consume('down')) {
          if (atHome() && S.bag.length) deposit();
          else if (S.bag.length && S.hintT <= 0) {
            floatText(t('kf.goHome'), P.x, P.y - 120, '#ffd23f', 17);
            S.hintT = 1.4;
          }
        }
      }
      input.consume('action');
      P.moving = dir !== 0;
      P.buffer -= dt;
      if (P.buffer > 0 && (P.onGround || P.coyote > 0) && running) {
        P.vy = -JUMP_V;
        P.onGround = false;
        P.coyote = 0;
        P.buffer = 0;
        audio.play('jump');
      }
      // 이동 + 착지 (통나무/바위는 위에서만 올라설 수 있다)
      P.x = Math.max(20, Math.min(LEVEL_W - 20, P.x + dir * SPEED * dt));
      P.walk += Math.abs(dir) * dt * 12;
      P.vy += GRAVITY * dt;
      let ny = P.y + P.vy * dt;
      let landed = false;
      if (P.vy >= 0) {
        if (onGround(P.x) && P.y <= GROUND && ny >= GROUND) {
          ny = GROUND;
          landed = true;
        }
        PLATS.forEach((p) => {
          if (!landed && P.x + 10 > p.x && P.x - 10 < p.x + p.w && P.y <= p.y + 1 && ny >= p.y) {
            ny = p.y;
            landed = true;
          }
        });
      }
      P.y = ny;
      if (landed) {
        if (!P.onGround && P.vy > 400) audio.play('land');
        P.vy = 0;
        P.onGround = true;
        P.coyote = 0.09;
        if (P.y === GROUND && SEGS.some((s) => P.x > s[0] + 30 && P.x < s[1] - 30)) P.safeX = P.x;
      } else {
        P.onGround = false;
        P.coyote -= dt;
      }
      P.inv -= dt;

      // 개울에 빠짐
      if (P.y > GROUND + 60) {
        burst(P.x, GROUND + 30, ['#7fd0ff', '#ffffff'], 16, 260);
        P.x = P.safeX;
        P.y = GROUND;
        P.vy = 0;
        if (running) hurt('water');
      }

      // 물건 줍기
      if (running) {
        S.items.forEach((it) => {
          if (it.taken) return;
          if (Math.abs(it.x - P.x) < 30 && it.y > P.y - 100 && it.y < P.y + 10) pickUp(it);
        });
      }

      // 스토트
      S.stoats.forEach((s) => {
        const sp = s.speed + S.elapsed * 0.4;
        if (S.phase === 'run') s.x += s.dir * sp * dt;
        if (s.x > s.max) {
          s.x = s.max;
          s.dir = -1;
        } else if (s.x < s.min) {
          s.x = s.min;
          s.dir = 1;
        }
        if (running && P.inv <= 0 && Math.abs(s.x - P.x) < 36 && P.y > GROUND - 34) {
          hurt('stoat');
          P.vy = -420;
          P.x = Math.max(20, P.x + (P.x < s.x ? -40 : 40));
        }
      });

      // 굴에 넣기 (하나씩 날아간다)
      if (S.depositQ.length) {
        S.depositT -= dt;
        if (S.depositT <= 0) {
          S.depositT = 0.16;
          const type = S.depositQ.shift();
          S.deposited[type] += 1;
          S.nestPts += 30;
          hud.setScore(liveScore());
          S.flyers.push({ type, x0: P.x, y0: P.y - 50, x1: BURROW_X, y1: GROUND - 20, k: 0 });
          audio.play('collect', 4);
          if (!S.depositQ.length) {
            floatText(t('kf.habitat', { p: habitatPct() }), BURROW_X + 20, GROUND - 150, '#8fffb0', 24);
            if (depositedTotal() >= TOTAL_NEED && S.phase === 'run') complete();
          }
        }
      }

      if (running && S.timeLeft <= 0) gameOver('time');
      if (S.phase === 'over') {
        S.overT += dt;
        if (S.overT > 1.9) finish(false);
      }
    }

    function updateFinale(dt) {
      S.finT += dt;
      input.consume('tap');
      input.consume('jump');
      input.consume('action');
      input.consume('down');
      if (S.finT > 0.8 && S.finT - dt <= 0.8) hud.banner(t('kf.kiwiCome'), 'info', 1500);
      if (S.finT > 6.4 && S.finT - dt <= 6.4) {
        hud.banner(t('kf.home'), 'win', 1500);
        audio.play('success');
        for (let i = 0; i < 6; i++) S.parts.push({ kind: 'heart', x: BURROW_X + 60 + rand(-30, 30), y: GROUND - 80, vx: rand(-20, 20), vy: rand(-80, -40), life: 1.6, max: 1.6, size: 8, color: '#ff7eb6', g: 0, world: true });
      }
      if (S.finT > 8.2) {
        S.phase = 'facts';
        S.factIdx = 0;
        S.factT = 0;
      }
    }

    function kiwiPos() {
      // 오른쪽에서 걸어와 굴 앞에서 땅을 콕콕 찌르고(냄새 맡기) 굴로 들어간다
      const T = S.finT;
      if (T < 1.0) return { x: 640, walk: false, probe: false, alpha: Math.max(0, T) };
      if (T < 4.0) return { x: 640 - ((T - 1.0) / 3.0) * 420, walk: true, probe: false, alpha: 1 };
      if (T < 5.6) return { x: 220, walk: false, probe: true, alpha: 1 };
      if (T < 6.4) return { x: 220 - ((T - 5.6) / 0.8) * 80, walk: true, probe: false, alpha: 1 };
      return { x: 140, walk: false, probe: false, alpha: 1, inNest: true };
    }

    function updateFacts(dt) {
      S.factT += dt;
      S.finT += dt;
      const go = [input.consume('jump'), input.consume('action'), input.consume('tap'), input.consume('down')].some(Boolean);
      if (go && S.factT > 0.3) {
        audio.play('click');
        S.factIdx += 1;
        S.factT = 0;
        if (S.factIdx >= 3) finish(true);
      } else if (S.factT > 7) {
        S.factIdx += 1;
        S.factT = 0;
        if (S.factIdx >= 3) finish(true);
      }
    }

    /* ----- render ----- */
    const dark = document.createElement('canvas');
    dark.width = W / 2;
    dark.height = H / 2;
    const dctx = dark.getContext('2d');

    function render() {
      const c = api.beginFrame();
      c.save();
      if (S.shake > 0) c.translate(rand(-S.shake, S.shake), rand(-S.shake, S.shake) * 0.5);
      drawForest(c, S.cam, S.time);
      c.save();
      c.translate(-Math.round(S.cam), 0);
      drawGroundLayer(c, S.time);
      drawBurrow(c, S.deposited, S.time);
      S.items.forEach((it) => {
        if (it.taken || it.x < S.cam - 60 || it.x > S.cam + W + 60) return;
        const y = it.y + Math.sin(S.time * 3 + it.ph) * 4;
        c.fillStyle = 'rgba(255,250,200,.18)';
        ell(c, it.x, y, 24, 24);
        c.fill();
        drawItem(c, it.type, it.x, y, 38, S.time + it.ph);
      });
      S.stoats.forEach((s) => {
        if (s.x < S.cam - 80 || s.x > S.cam + W + 80) return;
        drawStoat(c, s.x, GROUND, s.dir, S.phase === 'run' ? S.time : 0);
      });
      const P = S.player;
      const flicker = P.inv > 0 && S.phase === 'run' && Math.floor(P.inv * 12) % 2 === 0;
      if (S.phase !== 'finale' && S.phase !== 'facts' && !(S.phase === 'done' && S.completeTime != null) && !flicker) {
        let pose = 'idle';
        if (S.phase === 'over') pose = 'hurt';
        else if (!P.onGround) pose = 'jump';
        else if (P.moving) pose = 'walk';
        drawRanger(c, P.x, P.y, pose, S.time, { face: P.face, walk: P.walk, bag: S.bag.length });
      }
      if (S.phase === 'finale' || S.phase === 'facts' || (S.phase === 'done' && S.completeTime != null)) {
        drawRanger(c, 330, GROUND, 'cheer', S.time, { face: -1, bag: 0 });
        const k = kiwiPos();
        c.globalAlpha = k.alpha;
        drawKiwi(c, k.x, GROUND, k.inNest ? 0.9 : 1, S.time, { flip: true, walk: k.walk, probe: k.probe });
        c.globalAlpha = 1;
      }
      S.flyers.forEach((f) => {
        const e = f.k;
        drawItem(c, f.type, f.x0 + (f.x1 - f.x0) * e, f.y0 + (f.y1 - f.y0) * e - Math.sin(e * Math.PI) * 80, 30, S.time);
      });
      c.restore();

      // 밤의 어둠 + 헤드램프
      const sx = P.x - S.cam;
      dctx.globalCompositeOperation = 'source-over';
      dctx.clearRect(0, 0, dark.width, dark.height);
      dctx.fillStyle = S.phase === 'finale' || S.phase === 'facts' ? 'rgba(6,10,34,.25)' : 'rgba(6,10,34,.5)';
      dctx.fillRect(0, 0, dark.width, dark.height);
      dctx.globalCompositeOperation = 'destination-out';
      const lx = S.phase === 'finale' || S.phase === 'facts' ? (BURROW_X + 80 - S.cam) / 2 : (sx + P.face * 40) / 2;
      const ly = (S.phase === 'finale' || S.phase === 'facts' ? GROUND - 60 : P.y - 60) / 2;
      const g = dctx.createRadialGradient(lx, ly, 10, lx, ly, 150);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      dctx.fillStyle = g;
      dctx.fillRect(0, 0, dark.width, dark.height);
      c.drawImage(dark, 0, 0, W, H);

      // 어둠 위에 보이는 것: 물건의 반짝임, 스토트의 눈빛
      c.save();
      c.translate(-Math.round(S.cam), 0);
      S.items.forEach((it) => {
        if (it.taken) return;
        const a = 0.35 + Math.sin(S.time * 4 + it.ph) * 0.2;
        c.fillStyle = `rgba(255,245,170,${a})`;
        ell(c, it.x + 14, it.y - 16, 3, 3);
        c.fill();
      });
      if (S.phase === 'run') {
        S.stoats.forEach((s) => {
          c.fillStyle = 'rgba(255,240,120,.9)';
          ell(c, s.x + s.dir * 36, GROUND - 21, 2.4, 2.4);
          c.fill();
        });
      }
      S.parts.forEach((p) => {
        c.globalAlpha = Math.max(0, Math.min(1, p.life / (p.max * 0.5)));
        if (p.kind === 'text') text(c, p.str, p.x, p.y, p.size, p.color, { lw: p.size * 0.25 });
        else if (p.kind === 'heart') {
          c.fillStyle = p.color;
          c.beginPath();
          c.moveTo(p.x, p.y + 6);
          c.bezierCurveTo(p.x - 10, p.y - 2, p.x - 6, p.y - 10, p.x, p.y - 4);
          c.bezierCurveTo(p.x + 6, p.y - 10, p.x + 10, p.y - 2, p.x, p.y + 6);
          c.fill();
        } else {
          c.fillStyle = p.color;
          ell(c, p.x, p.y, p.size, p.size);
          c.fill();
        }
      });
      c.globalAlpha = 1;
      c.restore();
      c.restore();

      if (S.phase === 'run' || S.phase === 'over' || S.phase === 'ready') renderHud(c);
      if (S.phase === 'facts') renderFacts(c);
    }

    function renderHud(c) {
      const P = S.player;
      // 가방
      c.save();
      c.strokeStyle = OUT;
      c.lineWidth = 3;
      rrect(c, 12, 10, 236, 50, 14);
      fs(c, 'rgba(255,250,235,.92)');
      c.restore();
      text(c, t('kf.bag'), 44, 35, 15, OUT, { lw: 0 });
      for (let i = 0; i < BAG_MAX; i++) {
        const x = 90 + i * 32;
        c.strokeStyle = OUT;
        c.lineWidth = 2;
        ell(c, x, 35, 14, 14);
        c.fillStyle = i < S.bag.length ? '#fff3cf' : '#e6dccb';
        c.fill();
        c.stroke();
        if (i < S.bag.length) drawItem(c, S.bag[i], x, 35, 22, S.time);
      }
      // 서식지 완성도
      const pct = habitatPct();
      c.save();
      c.strokeStyle = OUT;
      c.lineWidth = 3;
      rrect(c, W - 214, 14, 200, 30, 15);
      fs(c, 'rgba(255,255,255,.92)');
      if (pct > 0) {
        rrect(c, W - 211, 17, Math.max(24, 194 * (pct / 100)), 24, 12);
        c.fillStyle = '#3fae4d';
        c.fill();
      }
      c.restore();
      text(c, t('kf.habitat', { p: pct }), W - 114, 29, 15, '#ffffff', { lw: 4 });
      // 미니맵
      const mx = 290;
      const mw = 380;
      const my = 30;
      c.save();
      c.strokeStyle = 'rgba(255,255,255,.7)';
      c.lineWidth = 4;
      c.beginPath();
      SEGS.forEach(([a, b]) => {
        c.moveTo(mx + (a / LEVEL_W) * mw, my);
        c.lineTo(mx + (b / LEVEL_W) * mw, my);
      });
      c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.5)';
      c.lineWidth = 2;
      c.strokeRect(mx + (S.cam / LEVEL_W) * mw, my - 10, (W / LEVEL_W) * mw, 20);
      c.fillStyle = '#7a5232';
      ell(c, mx + (BURROW_X / LEVEL_W) * mw, my, 7, 7);
      c.fill();
      S.items.forEach((it) => {
        if (it.taken) return;
        c.fillStyle = S.collected[it.type] >= NEED_BY_ID[it.type].need ? 'rgba(200,230,255,.6)' : '#ffd23f';
        ell(c, mx + (it.x / LEVEL_W) * mw, my - 5, 2.6, 2.6);
        c.fill();
      });
      S.stoats.forEach((s) => {
        c.fillStyle = '#ff6b6b';
        ell(c, mx + (s.x / LEVEL_W) * mw, my + 5, 2.6, 2.6);
        c.fill();
      });
      c.fillStyle = '#ff8a1f';
      c.strokeStyle = OUT;
      c.lineWidth = 1.5;
      ell(c, mx + (P.x / LEVEL_W) * mw, my, 5, 5);
      c.fill();
      c.stroke();
      c.restore();
      if (atHome() && S.bag.length && S.phase === 'run') text(c, t('kf.atHome'), W / 2, 96, 20, '#ffd23f', { lw: 5 });
    }

    function renderFacts(c) {
      const i = Math.min(2, S.factIdx);
      const bw = 560;
      const bx = W / 2 - bw / 2 + 120;
      const by = 90;
      c.save();
      c.strokeStyle = OUT;
      c.lineWidth = 4;
      rrect(c, bx, by, bw, 190, 20);
      fs(c, 'rgba(255,250,235,.96)');
      c.restore();
      text(c, `${t('kf.factsTitle')} · ${i + 1}/3`, bx + bw / 2, by + 28, 20, '#2f6b3a', { lw: 0 });
      c.save();
      c.font = `500 18px ${KK.ui.FONT}`;
      c.fillStyle = OUT;
      c.textBaseline = 'top';
      wrapLines(c, t('kf.fact' + (i + 1)), bw - 48)
        .slice(0, 5)
        .forEach((ln, k) => c.fillText(ln, bx + 24, by + 56 + k * 25));
      c.restore();
      text(c, t('kf.tapContinue'), bx + bw / 2, by + 220, 18, '#ffd23f', { lw: 5 });
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
      // 테스트용
      debug: {
        get state() {
          return S;
        },
        get running() {
          return loop.running;
        },
        teleport(x, y) {
          S.player.x = x;
          S.player.y = y == null ? GROUND : y;
          S.player.vy = 0;
          S.cam = Math.max(0, Math.min(LEVEL_W - W, x - W * 0.4));
        },
        itemsOf(type) {
          return S.items.filter((it) => it.type === type && !it.taken).map((it) => [it.x, it.y]);
        },
        PLATS,
        SEGS,
        GROUND,
      },
    };
  }

  const iconCache = {};
  function iconURL(type) {
    if (!iconCache[type]) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 96;
      const c = cv.getContext('2d');
      if (type === 'kiwi') drawKiwi(c, 40, 86, 1.05, 0, { flip: false });
      else drawItem(c, type, 48, 50, 76, 0);
      iconCache[type] = cv.toDataURL();
    }
    return iconCache[type];
  }

  KK.games.register({
    id: 'kiwi-forest-rescue',
    width: W,
    height: H,
    create,
    intro(t) {
      return {
        goal: t('kf.goal'),
        items: NEEDS.map((n) => ({ icon: iconURL(n.id), label: `${t('kf.item.' + n.id)} ×${n.need}`, sub: t('kf.sub.' + n.id) })),
        controls: [t('kf.ctrlKeys'), t('kf.ctrlTouch'), t('kf.avoid')],
      };
    },
    badges: [
      { id: 'kf_first', icon: () => iconURL('kiwi'), test: (r) => r.completed },
      { id: 'kf_safe', icon: () => iconURL('fern'), test: (r) => r.completed && r.stats.hits === 0 },
      { id: 'kf_trips', icon: () => iconURL('leaf'), test: (r) => r.completed && r.stats.trips <= 3 },
      { id: 'kf_fast', icon: () => iconURL('worm'), test: (r) => r.completed && r.stats.timeLeft >= 30 },
      { id: 'kf_explorer', icon: () => iconURL('moss'), test: (r) => r.stats.found >= ITEMS.length },
    ],
  });
})(window.KK);
