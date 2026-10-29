/* GAME 02 — PAVLOVA DASH
 * 뉴질랜드 여름 해변에서 쟁반을 들고 좌우로 움직이며 떨어지는 머랭, 크림, 과일을 받는다.
 * 비구름의 빗방울과 탄 머랭은 피해야 한다. 재료를 모두 모으면 피크닉 테이블에서
 * 움직이는 토핑을 타이밍 맞춰 떨어뜨려 파블로바를 장식한다.
 * Kimchi Run 과 코드를 공유하지 않는 독립 파일이며, 모든 그림은 Canvas 로 직접 그린다. */
(function (KK) {
  'use strict';

  const W = 960;
  const H = 540;
  const FLOOR = 522;
  const PLATE_Y = 394;
  const PLATE_HALF = 70;
  const TIME_LIMIT = 60;
  const MAX_HEARTS = 3;
  const OUT = '#3a2a3e';

  const ING = [
    { id: 'meringue', need: 3, points: 100 },
    { id: 'cream', need: 3, points: 80 },
    { id: 'kiwi', need: 3, points: 90 },
    { id: 'strawberry', need: 3, points: 70 },
    { id: 'passion', need: 2, points: 110 },
  ];
  const ING_BY_ID = {};
  ING.forEach((i) => (ING_BY_ID[i.id] = i));
  const TOPPINGS = ['kiwi', 'strawberry', 'kiwi', 'strawberry', 'passion'];
  const TARGETS = [-62, 56, -6, -34, 72];
  const PAV_CX = 480;
  const PAV_BOTTOM = 372;
  const PAV_W = 250;
  const PAV_H = 84;

  KK.i18n.add({
    en: {
      'pd.goal': 'Hold the tray and catch everything you need for a pavlova before time runs out. Then decorate it at the picnic table!',
      'pd.ctrlKeys': 'Keyboard: ← → or A D to move the tray. Space drops toppings while decorating. P or Esc pauses.',
      'pd.ctrlTouch': 'Touch / mouse: drag anywhere on the screen to slide the tray (or use ◀ ▶). Tap or press DROP to place toppings.',
      'pd.avoid': 'Dodge raindrops from the grey cloud — rain makes meringue soggy and costs a heart. Burnt meringue loses points.',
      'pd.ing.meringue': 'Meringue',
      'pd.ing.cream': 'Whipped cream',
      'pd.ing.kiwi': 'Kiwifruit',
      'pd.ing.strawberry': 'Strawberry',
      'pd.ing.passion': 'Passionfruit',
      'pd.sub.meringue': 'baked egg white & sugar',
      'pd.sub.cream': 'soft and fluffy',
      'pd.sub.kiwi': 'a fruit, not the bird!',
      'pd.sub.strawberry': 'a sweet summer berry',
      'pd.sub.passion': 'tangy topping',
      'pd.heart': 'Heart',
      'pd.extra': 'Extra',
      'pd.soggy': 'Soggy!',
      'pd.burnt': 'Burnt!',
      'pd.streak': 'Sweet streak ×{m}',
      'pd.allCollected': 'Everything collected!',
      'pd.toTable': "Let's build the pavlova!",
      'pd.step.base': 'Step 1 · Set down the meringue base',
      'pd.step.cream': 'Step 2 · Spread the whipped cream',
      'pd.step.top': 'Step 3 · Drop each topping on the target!',
      'pd.step.done': 'Pavlova complete!',
      'pd.topPrompt': 'Tap or press SPACE when the fruit is over the ring',
      'pd.perfect': 'Perfect!',
      'pd.good': 'Good!',
      'pd.oops': 'Oops!',
      'pd.timeUp': "Time's up!",
      'pd.crashed': 'Too soggy!',
      'pd.resultWin': 'Pavlova complete!',
      'pd.resultFail': 'No pavlova this time',
      'pd.missing': 'Still needed: {list}',
      'pd.bd.ingredients': 'Ingredients',
      'pd.bd.streak': 'Sweet streak bonus',
      'pd.bd.burnt': 'Burnt meringue',
      'pd.bd.deco': 'Decorating bonus',
      'pd.bd.time': 'Time bonus',
      'pd.bd.hearts': 'Heart bonus',
      'pd.factTitle': 'Pavlova',
      'pd.fact':
        'Pavlova is a meringue dessert with a crisp shell and a soft, marshmallow-like centre, usually topped with whipped cream and fresh fruit such as kiwifruit, strawberries and passionfruit. It is named after the Russian ballerina Anna Pavlova, who toured New Zealand and Australia in the 1920s — and both countries say they invented it! Christmas falls in summer in New Zealand, and pavlova is a favourite at summer celebrations.',
      'badge.pd_first.name': 'First Pavlova',
      'badge.pd_first.desc': 'Complete Pavlova Dash.',
      'badge.pd_sunny.name': 'Sunny Day',
      'badge.pd_sunny.desc': 'Make a pavlova without catching any rain.',
      'badge.pd_streak.name': 'Sweet Streak',
      'badge.pd_streak.desc': 'Reach a ×3 sweet streak.',
      'badge.pd_decorator.name': 'Master Decorator',
      'badge.pd_decorator.desc': 'Land all 5 toppings perfectly.',
      'badge.pd_fast.name': 'Speedy Baker',
      'badge.pd_fast.desc': 'Collect everything within 40 seconds.',
    },
    ko: {
      'pd.goal': '쟁반을 들고 제한 시간 안에 파블로바 재료를 모두 받아요. 그다음 피크닉 테이블에서 파블로바를 장식해요!',
      'pd.ctrlKeys': '키보드: ← → 또는 A D로 쟁반 이동. 장식할 때 Space로 토핑 놓기. P 또는 Esc로 일시정지.',
      'pd.ctrlTouch': '터치/마우스: 화면 아무 곳이나 끌면 쟁반이 따라와요 (◀ ▶ 버튼도 가능). 탭하거나 놓기 버튼으로 토핑을 놓아요.',
      'pd.avoid': '회색 구름에서 떨어지는 빗방울을 피하세요. 머랭이 눅눅해져 하트가 줄어요. 탄 머랭을 받으면 점수가 깎여요.',
      'pd.ing.meringue': '머랭',
      'pd.ing.cream': '생크림',
      'pd.ing.kiwi': '키위',
      'pd.ing.strawberry': '딸기',
      'pd.ing.passion': '패션프루트',
      'pd.sub.meringue': '달걀흰자와 설탕으로 구워요',
      'pd.sub.cream': '부드럽게 휘핑한 크림',
      'pd.sub.kiwi': '새가 아니라 과일이에요!',
      'pd.sub.strawberry': '달콤한 여름 과일',
      'pd.sub.passion': '새콤한 토핑',
      'pd.heart': '하트',
      'pd.extra': '추가',
      'pd.soggy': '눅눅해졌어요!',
      'pd.burnt': '탔어요!',
      'pd.streak': '달콤 연속 ×{m}',
      'pd.allCollected': '재료를 모두 모았어요!',
      'pd.toTable': '파블로바를 만들어요!',
      'pd.step.base': '1단계 · 머랭 받침 놓기',
      'pd.step.cream': '2단계 · 생크림 펴 바르기',
      'pd.step.top': '3단계 · 토핑을 표시에 맞춰 떨어뜨려요!',
      'pd.step.done': '파블로바 완성!',
      'pd.topPrompt': '과일이 고리 위에 오면 탭하거나 SPACE를 눌러요',
      'pd.perfect': '완벽해요!',
      'pd.good': '좋아요!',
      'pd.oops': '아쉬워요!',
      'pd.timeUp': '시간 종료!',
      'pd.crashed': '너무 눅눅해졌어요!',
      'pd.resultWin': '파블로바 완성!',
      'pd.resultFail': '이번엔 파블로바를 못 만들었어요',
      'pd.missing': '부족한 재료: {list}',
      'pd.bd.ingredients': '재료 점수',
      'pd.bd.streak': '달콤 연속 보너스',
      'pd.bd.burnt': '탄 머랭 감점',
      'pd.bd.deco': '장식 보너스',
      'pd.bd.time': '남은 시간 보너스',
      'pd.bd.hearts': '하트 보너스',
      'pd.factTitle': '파블로바',
      'pd.fact':
        '파블로바는 겉은 바삭하고 속은 마시멜로처럼 부드러운 머랭 디저트로, 보통 생크림과 키위·딸기·패션프루트 같은 신선한 과일을 올려 먹어요. 1920년대에 뉴질랜드와 호주를 순회 공연한 러시아 발레리나 안나 파블로바의 이름을 땄고, 두 나라 모두 자기 나라가 원조라고 말해요! 뉴질랜드는 크리스마스가 여름이라 파블로바가 여름 축제와 모임에서 사랑받아요.',
      'badge.pd_first.name': '첫 파블로바',
      'badge.pd_first.desc': '파블로바 대시를 완성했어요.',
      'badge.pd_sunny.name': '맑은 날',
      'badge.pd_sunny.desc': '빗방울을 한 번도 받지 않고 완성했어요.',
      'badge.pd_streak.name': '달콤 연속',
      'badge.pd_streak.desc': '달콤 연속 ×3을 달성했어요.',
      'badge.pd_decorator.name': '장식의 달인',
      'badge.pd_decorator.desc': '토핑 5개를 모두 완벽하게 올렸어요.',
      'badge.pd_fast.name': '스피드 제빵사',
      'badge.pd_fast.desc': '40초 안에 재료를 모두 모았어요.',
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
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.lineWidth = o.lw || size * 0.22;
    c.strokeStyle = o.stroke || OUT;
    c.strokeText(str, x, y);
    c.fillStyle = fill;
    c.fillText(str, x, y);
    c.restore();
  }
  function sparkle(c, x, y, r) {
    c.beginPath();
    c.moveTo(x, y - r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.quadraticCurveTo(x, y, x, y + r);
    c.quadraticCurveTo(x, y, x - r, y);
    c.quadraticCurveTo(x, y, x, y - r);
    c.closePath();
  }

  /* ----- 재료/방해물 그림 (단위 좌표 -1..1) ----- */
  const ART = {
    meringue(c) {
      c.beginPath();
      c.moveTo(-0.9, 0.2);
      c.bezierCurveTo(-0.95, -0.3, -0.62, -0.5, -0.42, -0.42);
      c.quadraticCurveTo(-0.32, -0.86, -0.12, -0.48);
      c.quadraticCurveTo(0.04, -0.96, 0.2, -0.48);
      c.quadraticCurveTo(0.4, -0.82, 0.52, -0.4);
      c.bezierCurveTo(0.76, -0.48, 0.95, -0.28, 0.9, 0.2);
      c.quadraticCurveTo(0.86, 0.62, 0, 0.64);
      c.quadraticCurveTo(-0.86, 0.62, -0.9, 0.2);
      c.closePath();
      const g = c.createLinearGradient(0, -0.9, 0, 0.64);
      g.addColorStop(0, '#fffdf6');
      g.addColorStop(0.6, '#fbefd8');
      g.addColorStop(1, '#efcf98');
      fs(c, g);
      c.strokeStyle = '#e6c58e';
      c.lineWidth = 0.06;
      c.beginPath();
      [-0.55, -0.2, 0.18, 0.55].forEach((x) => {
        c.moveTo(x, -0.18);
        c.quadraticCurveTo(x + 0.08, 0.15, x, 0.5);
      });
      c.stroke();
    },
    cream(c) {
      c.fillStyle = '#fffaf0';
      ell(c, 0, 0.02, 0.62, 0.26);
      fs(c, '#fffaf0');
      ell(c, 0, -0.24, 0.48, 0.22);
      fs(c, '#fffaf0');
      ell(c, 0, -0.48, 0.32, 0.18);
      fs(c, '#fffaf0');
      c.beginPath();
      c.moveTo(-0.14, -0.6);
      c.quadraticCurveTo(0.04, -0.96, 0.22, -0.9);
      c.quadraticCurveTo(0.12, -0.72, 0.18, -0.58);
      c.closePath();
      fs(c, '#fffaf0');
      c.beginPath();
      c.moveTo(-0.8, 0.1);
      c.lineTo(0.8, 0.1);
      c.quadraticCurveTo(0.72, 0.82, 0, 0.82);
      c.quadraticCurveTo(-0.72, 0.82, -0.8, 0.1);
      c.closePath();
      fs(c, '#6fc3ff');
      c.strokeStyle = '#ffffff';
      c.lineWidth = 0.08;
      c.beginPath();
      c.moveTo(-0.62, 0.36);
      c.quadraticCurveTo(0, 0.44, 0.62, 0.36);
      c.stroke();
    },
    kiwi(c) {
      ell(c, 0, 0, 0.9, 0.9);
      fs(c, '#8a5a2b');
      ell(c, 0, 0, 0.78, 0.78);
      c.fillStyle = '#7fc742';
      c.fill();
      ell(c, 0, 0, 0.55, 0.55);
      c.fillStyle = '#a9dd63';
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,.45)';
      c.lineWidth = 0.04;
      c.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        c.moveTo(Math.cos(a) * 0.28, Math.sin(a) * 0.28);
        c.lineTo(Math.cos(a) * 0.72, Math.sin(a) * 0.72);
      }
      c.stroke();
      ell(c, 0, 0, 0.26, 0.2);
      c.fillStyle = '#f4ffd8';
      c.fill();
      c.fillStyle = '#2a1a12';
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ell(c, Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0.06, 0.035, a);
        c.fill();
      }
    },
    strawberry(c) {
      c.beginPath();
      c.moveTo(0, 0.92);
      c.bezierCurveTo(-0.62, 0.6, -0.86, -0.1, -0.6, -0.45);
      c.quadraticCurveTo(0, -0.68, 0.6, -0.45);
      c.bezierCurveTo(0.86, -0.1, 0.62, 0.6, 0, 0.92);
      c.closePath();
      fs(c, '#ff4d5e');
      ell(c, -0.32, -0.12, 0.12, 0.22, 0.4);
      c.fillStyle = 'rgba(255,255,255,.5)';
      c.fill();
      c.fillStyle = '#ffe58a';
      [
        [-0.3, 0.12],
        [0.05, -0.05],
        [0.35, 0.1],
        [-0.12, 0.42],
        [0.2, 0.42],
        [0.02, 0.68],
        [-0.45, -0.25],
        [0.4, -0.28],
      ].forEach(([x, y]) => {
        ell(c, x, y, 0.045, 0.07);
        c.fill();
      });
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = Math.PI + (i / 9) * Math.PI;
        const r = i % 2 ? 0.2 : 0.55;
        c.lineTo(Math.cos(a) * r, -0.5 + Math.sin(a) * r * 0.55);
      }
      c.closePath();
      fs(c, '#3fae4d');
    },
    passion(c) {
      ell(c, 0, 0.06, 0.88, 0.82);
      fs(c, '#6b3a7a');
      ell(c, 0, 0, 0.7, 0.62);
      c.fillStyle = '#fff1cf';
      c.fill();
      ell(c, 0, 0.02, 0.58, 0.5);
      c.fillStyle = '#ffbf2e';
      c.fill();
      [
        [-0.28, -0.1],
        [0.05, -0.22],
        [0.3, 0.02],
        [-0.08, 0.16],
        [0.22, 0.28],
        [-0.3, 0.25],
      ].forEach(([x, y]) => {
        ell(c, x, y, 0.1, 0.08);
        c.fillStyle = '#ffd86a';
        c.fill();
        ell(c, x, y, 0.045, 0.045);
        c.fillStyle = '#1e140f';
        c.fill();
      });
    },
    rain(c) {
      c.beginPath();
      c.moveTo(0, -0.95);
      c.bezierCurveTo(0.2, -0.5, 0.72, 0.02, 0.72, 0.36);
      c.bezierCurveTo(0.72, 0.9, -0.72, 0.9, -0.72, 0.36);
      c.bezierCurveTo(-0.72, 0.02, -0.2, -0.5, 0, -0.95);
      c.closePath();
      fs(c, '#4aa8ff');
      ell(c, -0.3, 0.1, 0.1, 0.2, 0.3);
      c.fillStyle = 'rgba(255,255,255,.8)';
      c.fill();
      c.fillStyle = OUT;
      ell(c, -0.18, 0.36, 0.07, 0.09);
      c.fill();
      ell(c, 0.22, 0.36, 0.07, 0.09);
      c.fill();
      c.lineWidth = 0.07;
      c.beginPath();
      c.moveTo(-0.34, 0.2);
      c.lineTo(-0.08, 0.27);
      c.moveTo(0.38, 0.2);
      c.lineTo(0.12, 0.27);
      c.moveTo(-0.12, 0.62);
      c.quadraticCurveTo(0.02, 0.52, 0.16, 0.62);
      c.stroke();
    },
    burnt(c) {
      c.beginPath();
      c.moveTo(-0.85, 0.3);
      c.bezierCurveTo(-0.9, -0.2, -0.6, -0.38, -0.4, -0.3);
      c.quadraticCurveTo(-0.25, -0.62, -0.05, -0.32);
      c.quadraticCurveTo(0.15, -0.66, 0.35, -0.3);
      c.bezierCurveTo(0.7, -0.36, 0.9, -0.15, 0.85, 0.3);
      c.quadraticCurveTo(0.8, 0.66, 0, 0.68);
      c.quadraticCurveTo(-0.8, 0.66, -0.85, 0.3);
      c.closePath();
      fs(c, '#5a3a24');
      c.fillStyle = '#2b1a12';
      [
        [-0.4, 0.1],
        [0.2, 0.25],
        [0.5, -0.02],
        [-0.1, -0.05],
      ].forEach(([x, y]) => {
        ell(c, x, y, 0.12, 0.08);
        c.fill();
      });
      c.strokeStyle = 'rgba(90,90,100,.75)';
      c.lineWidth = 0.1;
      c.beginPath();
      c.moveTo(-0.15, -0.5);
      c.bezierCurveTo(-0.45, -0.75, 0.15, -0.8, -0.1, -1.05);
      c.moveTo(0.3, -0.45);
      c.bezierCurveTo(0.05, -0.7, 0.55, -0.75, 0.32, -0.98);
      c.stroke();
    },
    heart(c) {
      c.beginPath();
      c.moveTo(0, 0.8);
      c.bezierCurveTo(-1.0, 0.1, -0.75, -0.85, 0, -0.35);
      c.bezierCurveTo(0.75, -0.85, 1.0, 0.1, 0, 0.8);
      c.closePath();
      fs(c, '#ff4f8b');
      ell(c, -0.38, -0.3, 0.14, 0.1, -0.6);
      c.fillStyle = 'rgba(255,255,255,.75)';
      c.fill();
    },
  };

  function drawItem(c, type, x, y, size, rot) {
    c.save();
    c.translate(x, y);
    if (rot) c.rotate(rot);
    c.scale(size / 2, size / 2);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.strokeStyle = OUT;
    c.lineWidth = 0.09;
    ART[type](c);
    c.restore();
  }

  /* ----- 파블로바 (받침 + 크림 + 토핑) ----- */
  function drawPavlova(c, cx, bottom, w, h, cream, toppings, o) {
    o = o || {};
    const top = bottom - h;
    c.save();
    c.lineJoin = 'round';
    c.strokeStyle = OUT;
    c.lineWidth = o.lw || 3;
    c.beginPath();
    c.moveTo(cx - w / 2, bottom - h * 0.12);
    c.lineTo(cx - w / 2 + w * 0.03, top + h * 0.14);
    const n = 7;
    const seg = (w * 0.94) / n;
    let px = cx - w / 2 + w * 0.03;
    for (let i = 0; i < n; i++) {
      c.quadraticCurveTo(px + seg / 2, top - h * 0.16, px + seg, top + h * 0.06);
      px += seg;
    }
    c.lineTo(cx + w / 2, bottom - h * 0.12);
    c.quadraticCurveTo(cx, bottom + h * 0.16, cx - w / 2, bottom - h * 0.12);
    c.closePath();
    const g = c.createLinearGradient(0, top, 0, bottom);
    g.addColorStop(0, '#fffcf4');
    g.addColorStop(0.6, '#fbeed6');
    g.addColorStop(1, '#eccb92');
    fs(c, g);
    c.strokeStyle = '#e4c38c';
    c.lineWidth = Math.max(1.5, w * 0.012);
    c.beginPath();
    for (let i = 1; i < n; i++) {
      const x = cx - w / 2 + w * 0.03 + seg * i;
      c.moveTo(x, top + h * 0.3);
      c.quadraticCurveTo(x + seg * 0.15, bottom - h * 0.4, x, bottom - h * 0.08);
    }
    c.stroke();
    c.strokeStyle = OUT;
    c.lineWidth = o.lw || 3;
    if (cream > 0) {
      // 생크림: 가운데 크림 위에 동글동글한 크림을 둘러 짠 모양
      const rx = (w / 2 - w * 0.07) * (0.35 + 0.65 * cream);
      const ry = h * 0.17;
      const cy = top + h * 0.04;
      c.lineWidth = Math.max(1.5, (o.lw || 3) * 0.8);
      ell(c, cx, cy, rx, ry);
      fs(c, '#ffffff');
      const n = 4 + Math.round(9 * cream);
      const r = Math.max(4, h * 0.13);
      const blobs = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + 0.2;
        blobs.push([cx + Math.cos(a) * rx * 0.86, cy + Math.sin(a) * ry * 0.8]);
      }
      blobs.sort((p, q) => p[1] - q[1]);
      blobs.forEach(([bx, by]) => {
        ell(c, bx, by - r * 0.35, r * 1.2, r);
        fs(c, '#ffffff');
        c.fillStyle = '#fff6e2';
        ell(c, bx - r * 0.35, by - r * 0.6, r * 0.4, r * 0.25);
        c.fill();
      });
      c.lineWidth = o.lw || 3;
    }
    (toppings || []).forEach((tp) => drawItem(c, tp.type, tp.x, tp.y, tp.size || w * 0.15, tp.rot || 0));
    c.restore();
  }

  const iconCache = {};
  function iconURL(type) {
    if (!iconCache[type]) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 96;
      const c = cv.getContext('2d');
      if (type === 'pavlova') {
        drawPavlova(c, 48, 72, 84, 34, 1, [
          { type: 'kiwi', x: 32, y: 40, size: 20 },
          { type: 'strawberry', x: 52, y: 34, size: 20 },
          { type: 'passion', x: 66, y: 42, size: 18 },
        ], { lw: 2 });
      } else drawItem(c, type, 48, 50, 80);
      iconCache[type] = cv.toDataURL();
    }
    return iconCache[type];
  }

  /* ----- 주인공: 쟁반을 머리 위로 든 해변 제빵사 ----- */
  function drawKid(c, x, pose, tm, o) {
    o = o || {};
    c.save();
    c.translate(x, FLOOR);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    const walk = o.walk || 0;
    const legA = pose === 'walk' ? Math.sin(walk) * 0.6 : 0;
    let bob = pose === 'walk' ? -Math.abs(Math.cos(walk)) * 3 : 0;
    if (pose === 'cheer') bob = -Math.abs(Math.sin(tm * 7)) * 12;
    c.translate(0, bob);
    c.rotate(o.lean || 0);

    const leg = (hx, ang) => {
      c.save();
      c.translate(hx, -36);
      c.rotate(ang);
      c.strokeStyle = OUT;
      c.lineWidth = 12;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(0, 30);
      c.stroke();
      c.strokeStyle = '#a8673e';
      c.lineWidth = 8;
      c.stroke();
      c.strokeStyle = OUT;
      c.lineWidth = 2.5;
      ell(c, 3, 34, 10, 4);
      fs(c, '#3a8dde');
      c.restore();
    };
    leg(-7, -legA);
    leg(7, legA);
    c.strokeStyle = OUT;
    c.lineWidth = 3;
    rrect(c, -17, -46, 34, 16, 6);
    fs(c, '#ff9a3c');
    rrect(c, -18, -82, 36, 40, 12);
    fs(c, '#2ec4b6');
    c.strokeStyle = '#ffffff';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(-15, -66);
    c.lineTo(15, -66);
    c.moveTo(-15, -56);
    c.lineTo(15, -56);
    c.stroke();
    // 팔 (쟁반을 받치거나, 환호)
    const arm = (sx, hx, hy) => {
      c.strokeStyle = OUT;
      c.lineWidth = 11;
      c.beginPath();
      c.moveTo(sx, -76);
      c.quadraticCurveTo(sx * 1.6, -100, hx, hy);
      c.stroke();
      c.strokeStyle = '#a8673e';
      c.lineWidth = 7;
      c.stroke();
      c.strokeStyle = OUT;
      c.lineWidth = 2.5;
      ell(c, hx, hy, 6, 6);
      fs(c, '#a8673e');
    };
    const py = PLATE_Y - FLOOR + 8;
    if (pose === 'cheer') {
      const w = Math.sin(tm * 12) * 6;
      arm(-14, -36 + w, -130);
      arm(14, 36 - w, -130);
    } else {
      arm(-14, -46, py);
      arm(14, 46, py);
    }
    // 머리 (곱슬머리)
    const hy = -102;
    c.fillStyle = '#2a1a14';
    c.strokeStyle = OUT;
    c.lineWidth = 2.5;
    [
      [-16, hy - 6, 9],
      [-10, hy - 16, 10],
      [2, hy - 20, 10],
      [14, hy - 15, 10],
      [19, hy - 4, 8],
      [-19, hy + 4, 7],
    ].forEach(([hx, hhy, r]) => {
      ell(c, hx, hhy, r, r);
      fs(c, '#2a1a14');
    });
    ell(c, 0, hy, 18, 18);
    fs(c, '#a8673e');
    c.fillStyle = '#2a1a14';
    [
      [-10, hy - 13, 7],
      [2, hy - 16, 8],
      [12, hy - 12, 7],
    ].forEach(([hx, hhy, r]) => {
      ell(c, hx, hhy, r, r * 0.8);
      c.fill();
    });
    c.fillStyle = OUT;
    if (pose === 'soggy' || o.blink) {
      c.strokeStyle = OUT;
      c.lineWidth = 2.2;
      c.beginPath();
      c.moveTo(-9, hy + 1);
      c.lineTo(-3, hy + 1);
      c.moveTo(3, hy + 1);
      c.lineTo(9, hy + 1);
      c.stroke();
    } else {
      ell(c, -6, hy, 2.6, 3.6);
      c.fill();
      ell(c, 6, hy, 2.6, 3.6);
      c.fill();
      c.fillStyle = '#fff';
      ell(c, -5, hy - 1.5, 0.9, 0.9);
      c.fill();
      ell(c, 7, hy - 1.5, 0.9, 0.9);
      c.fill();
    }
    c.fillStyle = 'rgba(255,110,120,.5)';
    ell(c, -11, hy + 7, 3.6, 2.4);
    c.fill();
    ell(c, 11, hy + 7, 3.6, 2.4);
    c.fill();
    c.strokeStyle = OUT;
    c.lineWidth = 2;
    c.beginPath();
    if (pose === 'soggy') c.arc(0, hy + 12, 3.5, Math.PI * 1.15, Math.PI * 1.85);
    else c.arc(0, hy + 7, 4, 0.2, Math.PI - 0.2);
    c.stroke();
    if (pose === 'soggy') {
      c.fillStyle = '#6fc3ff';
      [
        [-20, hy - 24],
        [22, hy - 20],
      ].forEach(([dx, dy], i) => {
        const yy = dy + ((tm * 40 + i * 9) % 18);
        c.beginPath();
        c.moveTo(dx, yy - 6);
        c.quadraticCurveTo(dx + 4, yy, dx, yy + 3);
        c.quadraticCurveTo(dx - 4, yy, dx, yy - 6);
        c.fill();
      });
    }
    c.restore();
  }

  function drawTray(c, x, y) {
    c.save();
    c.lineJoin = 'round';
    c.strokeStyle = OUT;
    c.lineWidth = 3;
    ell(c, x, y + 4, PLATE_HALF + 4, 14);
    fs(c, '#d6ecff');
    ell(c, x, y, PLATE_HALF, 11);
    fs(c, '#ffffff');
    c.fillStyle = '#7cc4ff';
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      ell(c, x + Math.cos(a) * (PLATE_HALF - 7), y + Math.sin(a) * 7.5, 2.4, 1.6);
      c.fill();
    }
    c.restore();
  }

  // 쟁반 위에 모인 재료가 쌓여 보이게 그린다
  function drawPile(c, x, y, have) {
    const m = Math.min(3, have.meringue);
    let top = y;
    if (m > 0) {
      const w = 56 + m * 16;
      const h = 12 + m * 7;
      drawPavlova(c, x, y + 2, w, h, Math.min(1, have.cream / 3), null, { lw: 2.5 });
      top = y - h + 4;
    } else if (have.cream > 0) {
      for (let i = 0; i < Math.min(3, have.cream); i++) drawItem(c, 'cream', x - 30 + i * 30, y - 12, 28);
      top = y - 16;
    }
    const slots = {
      kiwi: [-28, 6, 30],
      strawberry: [-12, 22, -38],
      passion: [14, -4],
    };
    ['kiwi', 'strawberry', 'passion'].forEach((k) => {
      for (let i = 0; i < Math.min(slots[k].length, have[k]); i++) drawItem(c, k, x + slots[k][i], top - 6 - (i % 2) * 4, 22, (i - 1) * 0.3);
    });
  }

  /* ----- 배경: 뉴질랜드 여름 해변과 포후투카와 나무 ----- */
  const SAND_DOTS = [];
  for (let i = 0; i < 90; i++) SAND_DOTS.push([(i * 197) % W, 372 + ((i * 89) % 160), 1 + (i % 3)]);

  function drawPohutukawa(c, x, base, s, flip) {
    c.save();
    c.translate(x, base);
    c.scale(flip ? -s : s, s);
    c.strokeStyle = OUT;
    c.lineWidth = 3;
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(-14, 0);
    c.quadraticCurveTo(-6, -70, -40, -130);
    c.lineTo(-24, -136);
    c.quadraticCurveTo(4, -100, 10, -150);
    c.lineTo(24, -146);
    c.quadraticCurveTo(18, -70, 16, 0);
    c.closePath();
    fs(c, '#7a5a44');
    [
      [-60, -150, 56],
      [0, -190, 66],
      [60, -160, 52],
      [-20, -130, 46],
      [40, -120, 40],
    ].forEach(([cx, cy, r]) => {
      ell(c, cx, cy, r, r * 0.72);
      fs(c, '#2f7a4f');
    });
    for (let i = 0; i < 22; i++) {
      const a = i * 2.4;
      const rr = 30 + ((i * 37) % 60);
      const fx = Math.cos(a) * rr * 1.1;
      const fy = -160 + Math.sin(a) * rr * 0.55;
      c.fillStyle = '#e8283a';
      ell(c, fx, fy, 7, 6);
      c.fill();
      c.fillStyle = '#ff6a6a';
      ell(c, fx - 1.5, fy - 1.5, 3, 2.5);
      c.fill();
    }
    c.restore();
  }

  function drawBeach(c, tm) {
    const sky = c.createLinearGradient(0, 0, 0, 300);
    sky.addColorStop(0, '#7fd3ff');
    sky.addColorStop(1, '#ffe6f0');
    c.fillStyle = sky;
    c.fillRect(0, 0, W, 300);
    c.fillStyle = 'rgba(255,240,170,.5)';
    ell(c, 150, 86, 64, 64);
    c.fill();
    c.fillStyle = '#fff2b0';
    ell(c, 150, 86, 40, 40);
    c.fill();
    [
      [260, 70, 1],
      [620, 110, 0.8],
      [860, 60, 0.9],
    ].forEach(([cx, cy, s], i) => {
      const x = ((cx + tm * (6 + i * 3)) % (W + 240)) - 120;
      c.fillStyle = 'rgba(255,255,255,.95)';
      ell(c, x, cy, 44 * s, 18 * s);
      c.fill();
      ell(c, x + 26 * s, cy - 10 * s, 30 * s, 20 * s);
      c.fill();
      ell(c, x - 24 * s, cy - 4 * s, 24 * s, 14 * s);
      c.fill();
    });
    c.strokeStyle = '#55617a';
    c.lineWidth = 2.5;
    c.lineCap = 'round';
    [0, 1].forEach((i) => {
      const gx = ((tm * (40 + i * 15) + i * 400) % (W + 200)) - 100;
      const gy = 120 + i * 40 + Math.sin(tm * 2 + i) * 8;
      const f = Math.sin(tm * 8 + i) * 4;
      c.beginPath();
      c.moveTo(gx - 12, gy - f);
      c.quadraticCurveTo(gx - 6, gy - 8, gx, gy);
      c.quadraticCurveTo(gx + 6, gy - 8, gx + 12, gy - f);
      c.stroke();
    });
    c.fillStyle = '#7cc49a';
    c.beginPath();
    c.moveTo(560, 300);
    c.quadraticCurveTo(640, 236, 720, 270);
    c.quadraticCurveTo(800, 240, 900, 300);
    c.closePath();
    c.fill();
    const sea = c.createLinearGradient(0, 296, 0, 362);
    sea.addColorStop(0, '#3cc6d6');
    sea.addColorStop(1, '#2aa3c4');
    c.fillStyle = sea;
    c.fillRect(0, 296, W, 66);
    c.strokeStyle = 'rgba(255,255,255,.55)';
    c.lineWidth = 2.5;
    for (let row = 0; row < 3; row++) {
      const yy = 308 + row * 18;
      const ph = tm * (1 + row * 0.4);
      c.beginPath();
      for (let x = -20; x <= W + 20; x += 40) {
        const xx = x + ((ph * 30) % 40);
        c.moveTo(xx, yy);
        c.quadraticCurveTo(xx + 10, yy - 4, xx + 20, yy);
      }
      c.stroke();
    }
    c.fillStyle = '#f7e2ae';
    c.fillRect(0, 360, W, H - 360);
    c.fillStyle = 'rgba(255,255,255,.85)';
    c.beginPath();
    c.moveTo(0, 364);
    for (let x = 0; x <= W; x += 30) c.quadraticCurveTo(x + 15, 356 + Math.sin(tm * 2 + x * 0.05) * 4, x + 30, 364);
    c.lineTo(W, 370);
    c.lineTo(0, 370);
    c.closePath();
    c.fill();
    c.fillStyle = '#e8cd92';
    SAND_DOTS.forEach(([x, y, r]) => {
      ell(c, x, y, r, r * 0.7);
      c.fill();
    });
    drawPohutukawa(c, 30, 380, 1, false);
    drawPohutukawa(c, 940, 386, 0.9, true);
  }

  function drawCloud(c, x, y, angry) {
    c.save();
    c.strokeStyle = OUT;
    c.lineWidth = 3;
    c.fillStyle = '#9aa3b5';
    [
      [-34, 6, 26],
      [0, -6, 34],
      [36, 4, 26],
    ].forEach(([dx, dy, r]) => {
      ell(c, x + dx, y + dy, r, r * 0.8);
      fs(c, '#9aa3b5');
    });
    c.beginPath();
    c.moveTo(x - 56, y + 18);
    c.lineTo(x + 58, y + 18);
    c.stroke();
    ell(c, x - 4, y + 4, 54, 16);
    c.fill();
    c.fillStyle = OUT;
    ell(c, x - 12, y + 2, 3, 4);
    c.fill();
    ell(c, x + 12, y + 2, 3, 4);
    c.fill();
    c.lineWidth = 2.2;
    c.beginPath();
    if (angry) {
      c.moveTo(x - 18, y - 6);
      c.lineTo(x - 7, y - 3);
      c.moveTo(x + 18, y - 6);
      c.lineTo(x + 7, y - 3);
    }
    c.moveTo(x - 5, y + 12);
    c.quadraticCurveTo(x, y + 8, x + 5, y + 12);
    c.stroke();
    c.restore();
  }

  function drawTable(c) {
    c.save();
    c.strokeStyle = OUT;
    c.lineWidth = 3;
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(70, 420);
    c.lineTo(890, 420);
    c.lineTo(950, 540);
    c.lineTo(10, 540);
    c.closePath();
    c.fillStyle = '#ffffff';
    c.fill();
    c.save();
    c.clip();
    c.fillStyle = 'rgba(232,40,58,.75)';
    for (let i = -10; i < 20; i++) {
      c.beginPath();
      c.moveTo(70 + i * 60, 420);
      c.lineTo(100 + i * 60, 420);
      c.lineTo(100 + i * 72 + (i - 7) * 10, 540);
      c.lineTo(70 + i * 72 + (i - 7) * 10, 540);
      c.closePath();
      c.fill();
    }
    c.fillStyle = 'rgba(232,40,58,.45)';
    for (let r = 0; r < 4; r++) c.fillRect(0, 430 + r * 30, W, 14);
    c.restore();
    c.stroke();
    // 케이크 받침
    ell(c, PAV_CX, 448, 70, 14);
    fs(c, '#d9f0ff');
    rrect(c, PAV_CX - 14, 384, 28, 64, 6);
    fs(c, '#e8f6ff');
    ell(c, PAV_CX, PAV_BOTTOM + 8, 160, 22);
    fs(c, '#ffffff');
    ell(c, PAV_CX, PAV_BOTTOM + 4, 150, 18);
    fs(c, '#f2faff');
    c.restore();
  }

  /* =====================================================================
   * 게임 본체
   * ===================================================================== */
  function create(api) {
    const { input, hud, t, pointer } = api;
    const audio = api.audio;
    const rand = (a, b) => a + Math.random() * (b - a);
    const loop = api.loop(update, render);

    const S = {
      phase: 'ready', // ready | run | outro | fade | build | over | done
      time: 0,
      elapsed: 0,
      timeLeft: TIME_LIMIT,
      hearts: MAX_HEARTS,
      have: {},
      extras: 0,
      ingPts: 0,
      streakPts: 0,
      penalty: 0,
      streak: 0,
      mult: 1,
      maxMult: 1,
      soggy: 0,
      burnt: 0,
      items: [],
      parts: [],
      nextItem: 0.6,
      nextHeart: 16,
      cloud: { x: -120, dir: 1, active: false, next: 6, drop: 1.5 },
      shake: 0,
      fade: 0,
      overReason: null,
      overT: 0,
      outroT: 0,
      completeTime: null,
      lastShownTime: null,
      step: null,
      stepT: 0,
      topIdx: 0,
      swingT: 0,
      falling: null,
      placed: [],
      waitNext: 0,
      decoPts: 0,
      perfects: 0,
      player: { x: W / 2, vx: 0, walk: 0, hurtT: 0, blinkT: 2, target: null, pv: pointer.version },
    };
    ING.forEach((i) => (S.have[i.id] = 0));

    hud.setTime(TIME_LIMIT);
    hud.setHearts(S.hearts, MAX_HEARTS);
    hud.setScore(0);
    hud.setTracker(ING.map((i) => ({ id: i.id, icon: iconURL(i.id), label: t('pd.ing.' + i.id), have: 0, need: i.need })));
    api.setControls(['left', 'right']);

    function allCollected() {
      return ING.every((i) => S.have[i.id] >= i.need);
    }
    function missingList() {
      return ING.filter((i) => S.have[i.id] < i.need)
        .map((i) => `${t('pd.ing.' + i.id)} ×${i.need - S.have[i.id]}`)
        .join(', ');
    }
    function liveScore() {
      return Math.max(0, S.ingPts + S.streakPts - S.penalty);
    }
    function burst(x, y, colors, n, power) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = rand(0.4, 1) * (power || 240);
        S.parts.push({ kind: i % 3 ? 'dot' : 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: rand(0.4, 0.8), max: 0.8, size: rand(3, 7), color: colors[i % colors.length], g: 500 });
      }
    }
    function floatText(str, x, y, color, size) {
      S.parts.push({ kind: 'text', str, x, y, vx: 0, vy: -60, life: 1.1, max: 1.1, size: size || 26, color: color || '#fff', g: 0 });
    }

    function fallSpeed() {
      return 170 + Math.min(150, S.elapsed * 3);
    }

    function pickType() {
      const needed = ING.filter((i) => S.have[i.id] < i.need);
      if (needed.length && Math.random() < 0.78) {
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

    function spawn(type, x, y, vy) {
      const it = {
        type,
        bx: x == null ? rand(70, W - 70) : x,
        x: 0,
        y: y == null ? -30 : y,
        vy: vy == null ? fallSpeed() * rand(0.9, 1.1) : vy,
        sway: type === 'rain' ? 0 : rand(0, 22),
        ph: rand(0, 6),
        rot: rand(-0.3, 0.3),
        spin: rand(-1.5, 1.5),
        needed: !!ING_BY_ID[type] && S.have[type] < ING_BY_ID[type].need,
      };
      it.x = it.bx;
      S.items.push(it);
      return it;
    }

    function catchItem(it) {
      const P = S.player;
      if (it.type === 'rain') {
        S.hearts -= 1;
        S.soggy += 1;
        S.streak = 0;
        S.mult = 1;
        P.hurtT = 1.0;
        S.shake = 10;
        hud.setHearts(S.hearts, MAX_HEARTS);
        floatText(t('pd.soggy'), P.x, PLATE_Y - 60, '#9fd6ff', 26);
        burst(it.x, PLATE_Y, ['#4aa8ff', '#bfe3ff', '#ffffff'], 16, 260);
        audio.play('hit');
        if (S.hearts <= 0) gameOver('soggy');
        return;
      }
      if (it.type === 'burnt') {
        S.penalty += 50;
        S.burnt += 1;
        S.streak = 0;
        S.mult = 1;
        S.shake = 6;
        hud.setScore(liveScore());
        floatText(`${t('pd.burnt')} −50`, P.x, PLATE_Y - 60, '#ffb199', 24);
        burst(it.x, PLATE_Y, ['#5a3a24', '#9aa3b5'], 12, 200);
        audio.play('fail');
        return;
      }
      if (it.type === 'heart') {
        S.hearts = Math.min(MAX_HEARTS, S.hearts + 1);
        hud.setHearts(S.hearts, MAX_HEARTS);
        floatText('+1 ' + t('pd.heart'), it.x, PLATE_Y - 50, '#ff9fc4');
        burst(it.x, PLATE_Y, ['#ff4f8b', '#ffd1e1'], 14);
        audio.play('heart');
        return;
      }
      const def = ING_BY_ID[it.type];
      const needed = S.have[it.type] < def.need;
      const base = needed ? def.points : Math.round(def.points / 2);
      if (needed) S.have[it.type] += 1;
      else S.extras += 1;
      S.streak += 1;
      const newMult = Math.min(3, 1 + Math.floor(S.streak / 5) * 0.5);
      if (newMult > S.mult) {
        floatText(t('pd.streak', { m: newMult }), P.x, PLATE_Y - 110, '#ffd23f', 26);
        audio.play('success');
      }
      S.mult = newMult;
      S.maxMult = Math.max(S.maxMult, S.mult);
      const pts = Math.round(base * S.mult);
      S.ingPts += base;
      S.streakPts += pts - base;
      hud.setScore(liveScore());
      hud.updateTracker(it.type, S.have[it.type], def.need);
      floatText(`+${pts}`, it.x, PLATE_Y - 70, '#fff7c2', 28);
      floatText(needed ? t('pd.ing.' + it.type) : t('pd.extra'), it.x, PLATE_Y - 42, '#ffffff', 18);
      burst(it.x, PLATE_Y - 10, ['#ffd23f', '#ffffff', '#ff7eb6', '#7bc043'], 14);
      audio.play('collect', S.streak);
      if (allCollected()) startOutro();
    }

    function startOutro() {
      S.phase = 'outro';
      S.outroT = 0;
      S.completeTime = S.elapsed;
      S.items.forEach((it) => burst(it.x, it.y, ['#ffffff'], 5, 120));
      S.items = [];
      S.cloud.active = false;
      hud.banner(t('pd.allCollected'), 'win', 1800);
      audio.play('success');
    }

    function gameOver(reason) {
      if (S.phase !== 'run') return;
      S.phase = 'over';
      S.overReason = reason;
      S.overT = 0;
      hud.banner(reason === 'time' ? t('pd.timeUp') : t('pd.crashed'), 'lose', 1700);
      audio.play('fail');
    }

    function setStep(step) {
      S.step = step;
      S.stepT = 0;
      api.setControls(step === 'top' ? ['drop'] : []);
      input.clear();
    }

    function finish(completed) {
      if (S.phase === 'done') return;
      S.phase = 'done';
      const breakdown = [
        { label: t('pd.bd.ingredients'), value: S.ingPts },
        { label: t('pd.bd.streak'), value: S.streakPts },
      ];
      if (S.penalty) breakdown.push({ label: t('pd.bd.burnt'), value: -S.penalty });
      let score = S.ingPts + S.streakPts - S.penalty;
      if (completed) {
        const timeB = Math.ceil(S.timeLeft) * 15;
        const heartB = S.hearts * 150;
        breakdown.push({ label: t('pd.bd.deco'), value: S.decoPts }, { label: t('pd.bd.time'), value: timeB }, { label: t('pd.bd.hearts'), value: heartB });
        score += S.decoPts + timeB + heartB;
      }
      score = Math.max(0, score);
      api.finish({
        completed,
        score,
        time: completed ? S.completeTime : null,
        title: completed ? t('pd.resultWin') : t('pd.resultFail'),
        subtitle: completed ? null : `${S.overReason === 'time' ? t('pd.timeUp') : t('pd.crashed')} ${t('pd.missing', { list: missingList() })}`,
        breakdown,
        stats: { soggy: S.soggy, burnt: S.burnt, maxMult: S.maxMult, perfects: S.perfects, timeUsed: S.completeTime },
        fact: { title: t('pd.factTitle'), text: t('pd.fact') },
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
          S.phase = 'build';
          S.parts = [];
          setStep('base');
          hud.banner(t('pd.toTable'), 'win', 1500);
        }
      } else if (S.phase === 'build') updateBuild(dt);
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

      // 쟁반 이동: 키보드/버튼이 우선, 아니면 포인터를 따라간다
      const prevX = P.x;
      if (S.phase === 'run') {
        const dir = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
        if (pointer.version !== P.pv) {
          P.pv = pointer.version;
          P.target = pointer.x;
        }
        if (dir) {
          P.target = null;
          P.x += dir * 640 * dt;
        } else if (P.target != null) {
          const d = P.target - P.x;
          const step = Math.min(Math.abs(d), 1000 * dt);
          P.x += Math.sign(d) * step;
          if (Math.abs(d) < 1) P.target = null;
        }
        P.x = Math.max(70, Math.min(W - 70, P.x));
      }
      input.consume('jump');
      input.consume('tap');
      input.consume('action');
      P.vx = (P.x - prevX) / dt;
      P.walk += Math.abs(P.x - prevX) * 0.05;
      P.hurtT -= dt;
      P.blinkT -= dt;
      if (P.blinkT < -0.12) P.blinkT = rand(1.8, 3.6);

      // 생성
      if (S.phase === 'run') {
        S.nextItem -= dt;
        if (S.nextItem <= 0) {
          S.nextItem = Math.max(0.42, 0.8 - S.elapsed * 0.006) * rand(0.85, 1.15);
          if (S.elapsed > 10 && Math.random() < 0.09) spawn('burnt');
          else spawn(pickType());
        }
        S.nextHeart -= dt;
        if (S.nextHeart <= 0) {
          S.nextHeart = rand(14, 20);
          if (S.hearts < MAX_HEARTS) spawn('heart');
        }
        const cl = S.cloud;
        if (!cl.active) {
          cl.next -= dt;
          if (cl.next <= 0) {
            cl.active = true;
            cl.dir = Math.random() < 0.5 ? 1 : -1;
            cl.x = cl.dir > 0 ? -90 : W + 90;
            cl.drop = 0.8;
          }
        } else {
          cl.x += cl.dir * (70 + S.elapsed * 0.8) * dt;
          cl.drop -= dt;
          if (cl.drop <= 0 && cl.x > 40 && cl.x < W - 40) {
            cl.drop = rand(0.9, 1.6);
            spawn('rain', cl.x, 70, 230 + S.elapsed * 2);
          }
          if (cl.x < -120 || cl.x > W + 120) {
            cl.active = false;
            cl.next = rand(3, 6);
          }
        }
      } else if (S.cloud.active) {
        S.cloud.x += S.cloud.dir * 260 * dt;
      }

      // 낙하 + 받기
      for (let i = S.items.length - 1; i >= 0; i--) {
        const it = S.items[i];
        const prevY = it.y;
        it.y += it.vy * dt;
        it.ph += dt;
        it.x = it.bx + Math.sin(it.ph * 2.2) * it.sway;
        it.rot += it.spin * dt;
        const line = PLATE_Y - 6;
        if (S.phase === 'run' && prevY < line && it.y >= line && Math.abs(it.x - P.x) < PLATE_HALF + 8) {
          S.items.splice(i, 1);
          catchItem(it);
          if (S.phase !== 'run') break;
          continue;
        }
        if (it.y > FLOOR + 10) {
          if (it.needed && S.have[it.type] < ING_BY_ID[it.type].need && S.phase === 'run') {
            S.streak = 0;
            S.mult = 1;
          }
          burst(it.x, FLOOR + 6, it.type === 'rain' ? ['#4aa8ff', '#bfe3ff'] : ['#e8cd92', '#ffffff'], 6, 120);
          S.items.splice(i, 1);
        }
      }

      if (S.phase === 'run' && S.timeLeft <= 0) gameOver('time');

      if (S.phase === 'outro') {
        S.outroT += dt;
        if (S.outroT > 1.8) {
          S.phase = 'fade';
          S.fade = 0;
          audio.play('whoosh');
        }
      } else if (S.phase === 'over') {
        S.overT += dt;
        if (S.overT > 1.9) finish(false);
      }
    }

    function topSurfaceY() {
      return PAV_BOTTOM - PAV_H - 4;
    }

    function updateBuild(dt) {
      S.stepT += dt;
      if (S.fade > 0) S.fade = Math.max(0, S.fade - dt * 2);
      const st = S.step;
      if (st === 'base') {
        if (S.stepT > 0.55 && S.stepT - dt <= 0.55) {
          audio.play('land');
          burst(PAV_CX, PAV_BOTTOM, ['#ffffff', '#fbeed6'], 14, 220);
        }
        if (S.stepT > 1.6) setStep('cream');
      } else if (st === 'cream') {
        if (S.stepT > 0.2 && S.stepT - dt <= 0.2) audio.play('pour');
        if (S.stepT > 1.8) {
          setStep('top');
          S.topIdx = 0;
          S.swingT = 0;
        }
      } else if (st === 'top') {
        const tapped = [input.consume('action'), input.consume('jump'), input.consume('tap')].some(Boolean);
        if (S.falling) {
          const f = S.falling;
          f.vy += 1900 * dt;
          f.y += f.vy * dt;
          f.rot += dt * 4;
          if (f.y >= topSurfaceY()) landTopping(f);
        } else if (S.waitNext > 0) {
          S.waitNext -= dt;
          if (S.waitNext <= 0) {
            if (S.topIdx >= TOPPINGS.length) setStep('done');
            S.swingT = 0;
          }
        } else if (S.topIdx < TOPPINGS.length) {
          S.swingT += dt;
          if (tapped || S.swingT > 4.5) {
            S.falling = { type: TOPPINGS[S.topIdx], x: swingX(), y: 130, vy: 0, rot: 0 };
            audio.play('jump');
          }
        }
        if (S.step === 'done') {
          audio.play('fanfare');
          burst(PAV_CX, 260, ['#ff6b4a', '#ffd23f', '#7bc043', '#4cc3ff', '#ff7eb6'], 50, 520);
        }
      } else if (st === 'done') {
        if (Math.random() < dt * 14)
          S.parts.push({ kind: 'conf', x: rand(0, W), y: -10, vx: rand(-40, 40), vy: rand(120, 220), life: 3, max: 3, size: rand(5, 9), color: ['#ff6b4a', '#ffd23f', '#7bc043', '#4cc3ff', '#ff7eb6'][Math.floor(rand(0, 5))], g: 30, rot: rand(0, 6) });
        if (S.stepT > 3.4) finish(true);
      }
    }

    function swingX() {
      const spd = 1.5 + S.topIdx * 0.35;
      return PAV_CX + Math.sin(S.swingT * spd) * 220;
    }

    function landTopping(f) {
      const target = PAV_CX + TARGETS[S.topIdx];
      const d = Math.abs(f.x - target);
      let grade;
      let pts;
      if (d < 20) {
        grade = 'perfect';
        pts = 80;
        S.perfects += 1;
      } else if (d < 46) {
        grade = 'good';
        pts = 40;
      } else {
        grade = 'oops';
        pts = 10;
      }
      S.decoPts += pts;
      const x = Math.max(PAV_CX - 100, Math.min(PAV_CX + 100, f.x));
      S.placed.push({ type: f.type, x, y: topSurfaceY() + 4 - (S.topIdx % 2) * 6, size: 40, rot: (Math.random() - 0.5) * 0.6 });
      floatText(`${t('pd.' + grade)} +${pts}`, x, topSurfaceY() - 50, grade === 'perfect' ? '#ffd23f' : grade === 'good' ? '#bff0a6' : '#ffd1dc', 26);
      burst(x, topSurfaceY(), grade === 'perfect' ? ['#ffd23f', '#ffffff', '#ff7eb6'] : ['#ffffff'], grade === 'perfect' ? 18 : 6, 220);
      audio.play(grade === 'oops' ? 'land' : 'collect', grade === 'perfect' ? 8 : 2);
      S.falling = null;
      S.topIdx += 1;
      S.waitNext = 0.55;
      input.clear();
    }

    /* ----- render ----- */
    function render() {
      const c = api.beginFrame();
      c.save();
      if (S.shake > 0) c.translate(rand(-S.shake, S.shake), rand(-S.shake, S.shake) * 0.6);
      if (S.step) renderBuild(c);
      else renderBeach(c);
      renderParts(c);
      c.restore();
      if (S.fade > 0) {
        c.fillStyle = `rgba(255,246,250,${S.fade})`;
        c.fillRect(0, 0, W, H);
      }
    }

    function renderBeach(c) {
      drawBeach(c, S.time);
      const P = S.player;
      // 떨어질 위치 그림자
      S.items.forEach((it) => {
        const k = Math.max(0, Math.min(1, it.y / PLATE_Y));
        c.fillStyle = `rgba(80,60,40,${0.08 + k * 0.12})`;
        ell(c, it.x, FLOOR + 4, 8 + k * 12, 3 + k * 2);
        c.fill();
      });
      c.fillStyle = 'rgba(80,60,40,.22)';
      ell(c, P.x, FLOOR + 4, 34, 7);
      c.fill();
      let pose = 'idle';
      if (S.phase === 'over' || P.hurtT > 0) pose = 'soggy';
      else if (S.phase === 'outro') pose = 'cheer';
      else if (Math.abs(P.vx) > 20) pose = 'walk';
      const lean = Math.max(-0.12, Math.min(0.12, P.vx / 5000));
      drawKid(c, P.x, pose, S.time, { walk: P.walk, lean, blink: P.blinkT < 0 });
      if (pose !== 'cheer') {
        const tx = P.x + lean * -60;
        drawTray(c, tx, PLATE_Y);
        drawPile(c, tx, PLATE_Y - 4, S.have);
      } else {
        drawTray(c, P.x, PLATE_Y - 30 - Math.abs(Math.sin(S.time * 7)) * 10);
        drawPile(c, P.x, PLATE_Y - 34 - Math.abs(Math.sin(S.time * 7)) * 10, S.have);
      }
      S.items.forEach((it) => {
        if (it.type !== 'rain') {
          c.fillStyle = it.type === 'burnt' ? 'rgba(60,40,30,.18)' : 'rgba(255,255,255,.5)';
          ell(c, it.x, it.y, 28, 28);
          c.fill();
        }
        drawItem(c, it.type, it.x, it.y, it.type === 'rain' ? 34 : it.type === 'heart' ? 38 : 48, it.type === 'rain' ? 0 : it.rot);
      });
      if (S.cloud.active || (S.phase !== 'run' && S.cloud.x > -120 && S.cloud.x < W + 120 && S.elapsed > 0)) drawCloud(c, S.cloud.x, 52, true);
    }

    function renderBuild(c) {
      drawBeach(c, S.time);
      c.fillStyle = 'rgba(255,190,120,.18)';
      c.fillRect(0, 0, W, H);
      const st = S.step;
      const T = S.stepT;
      if (st === 'done') {
        c.save();
        c.translate(PAV_CX, 300);
        c.rotate(S.time * 0.5);
        c.fillStyle = 'rgba(255,240,150,.45)';
        for (let i = 0; i < 12; i++) {
          c.rotate((Math.PI * 2) / 12);
          c.beginPath();
          c.moveTo(0, 0);
          c.lineTo(-40, -440);
          c.lineTo(40, -440);
          c.closePath();
          c.fill();
        }
        c.restore();
      }
      drawTable(c);
      let bottom = PAV_BOTTOM;
      if (st === 'base') {
        const k = Math.min(1, T / 0.55);
        bottom = -60 + (PAV_BOTTOM + 60) * k * k;
        if (T > 0.55) bottom = PAV_BOTTOM - Math.abs(Math.sin((T - 0.55) * 9)) * 16 * Math.max(0, 1 - (T - 0.55) * 2);
      }
      const cream = st === 'base' ? 0 : st === 'cream' ? Math.min(1, T / 1.4) : 1;
      drawPavlova(c, PAV_CX, bottom, PAV_W, PAV_H, cream, S.placed);

      if (st === 'cream' && T < 1.5) {
        c.save();
        c.translate(PAV_CX - 120 + cream * 240, topSurfaceY() - 30 + Math.sin(T * 12) * 4);
        c.rotate(-0.5);
        c.strokeStyle = OUT;
        c.lineWidth = 3;
        rrect(c, -8, -110, 16, 110, 6);
        fs(c, '#d9a45f');
        ell(c, 0, 8, 22, 12);
        fs(c, '#e6eef7');
        c.restore();
      }
      if (st === 'top') {
        if (S.topIdx < TOPPINGS.length && !S.falling && S.waitNext <= 0) {
          const tx = PAV_CX + TARGETS[S.topIdx];
          const pulse = 1 + Math.sin(S.time * 8) * 0.08;
          c.save();
          c.setLineDash([6, 6]);
          c.strokeStyle = '#ff4f8b';
          c.lineWidth = 4;
          ell(c, tx, topSurfaceY() + 4, 24 * pulse, 10 * pulse);
          c.stroke();
          c.setLineDash([]);
          c.restore();
          const sx = swingX();
          c.strokeStyle = 'rgba(58,42,62,.35)';
          c.lineWidth = 2;
          c.setLineDash([4, 8]);
          c.beginPath();
          c.moveTo(sx, 160);
          c.lineTo(sx, topSurfaceY() - 10);
          c.stroke();
          c.setLineDash([]);
          drawItem(c, TOPPINGS[S.topIdx], sx, 130, 52, Math.sin(S.time * 4) * 0.2);
        }
        if (S.falling) drawItem(c, S.falling.type, S.falling.x, S.falling.y, 52, S.falling.rot);
        for (let i = 0; i < TOPPINGS.length; i++) {
          const done = i < S.topIdx;
          c.globalAlpha = done ? 0.35 : 1;
          drawItem(c, TOPPINGS[i], 380 + i * 50, 196, 34);
          c.globalAlpha = 1;
        }
        text(c, t('pd.step.top'), W / 2, 50, 30, '#ffffff');
        text(c, t('pd.topPrompt'), W / 2, 86, 19, '#ffd23f');
      } else if (st === 'base') text(c, t('pd.step.base'), W / 2, 56, 32, '#ffffff');
      else if (st === 'cream') text(c, t('pd.step.cream'), W / 2, 56, 32, '#ffffff');
      else if (st === 'done') {
        for (let i = 0; i < 7; i++) {
          const a = S.time * 2 + i;
          c.fillStyle = '#fff6b0';
          sparkle(c, PAV_CX + Math.cos(a) * 190, 270 + Math.sin(a * 1.3) * 90, 10 + Math.sin(a * 3) * 4);
          c.fill();
        }
        const pop = Math.min(1, T * 3);
        text(c, t('pd.step.done'), W / 2, 72, 56 * (0.6 + pop * 0.4), '#ff8ab8', { lw: 12 });
      }
      drawKid(c, 800, st === 'done' ? 'cheer' : 'idle', S.time, { blink: S.player.blinkT < 0 });
      if (st !== 'done') {
        drawTray(c, 800, PLATE_Y);
      }
    }

    function renderParts(c) {
      S.parts.forEach((p) => {
        c.globalAlpha = Math.max(0, Math.min(1, p.life / (p.max * 0.5)));
        if (p.kind === 'text') text(c, p.str, p.x, p.y, p.size, p.color, { lw: p.size * 0.25 });
        else if (p.kind === 'spark') {
          c.fillStyle = p.color;
          sparkle(c, p.x, p.y, p.size * 1.4);
          c.fill();
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
        S.player.pv = pointer.version;
        loop.start();
      },
      pause() {
        loop.stop();
        render();
      },
      resume() {
        if (S.phase !== 'done') {
          S.player.pv = pointer.version;
          loop.start();
        }
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
        spawn,
        swingX,
        targetX: (i) => PAV_CX + TARGETS[i],
      },
    };
  }

  KK.games.register({
    id: 'pavlova-dash',
    width: W,
    height: H,
    create,
    intro(t) {
      return {
        goal: t('pd.goal'),
        items: ING.map((i) => ({ icon: iconURL(i.id), label: `${t('pd.ing.' + i.id)} ×${i.need}`, sub: t('pd.sub.' + i.id) })),
        controls: [t('pd.ctrlKeys'), t('pd.ctrlTouch'), t('pd.avoid')],
      };
    },
    badges: [
      { id: 'pd_first', icon: () => iconURL('pavlova'), test: (r) => r.completed },
      { id: 'pd_sunny', icon: () => iconURL('cream'), test: (r) => r.completed && r.stats.soggy === 0 },
      { id: 'pd_streak', icon: () => iconURL('strawberry'), test: (r) => r.stats.maxMult >= 3 },
      { id: 'pd_decorator', icon: () => iconURL('kiwi'), test: (r) => r.completed && r.stats.perfects === 5 },
      { id: 'pd_fast', icon: () => iconURL('passion'), test: (r) => r.completed && r.stats.timeUsed <= 40 },
    ],
  });
})(window.KK);
