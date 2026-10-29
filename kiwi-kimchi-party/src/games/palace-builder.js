/* GAME 03 — PALACE BUILDER
 * 한국 궁궐 전각(정전)을 아래에서 위로 짓는 배치 게임.
 * ① 아래쪽 재료 줄에서 필요한 재료를 탭해서 모은다 (유리·철골·플라스틱 같은 현대 재료는 함정)
 * ② 재료가 다 모인 부재(기단, 기둥, 공포, 단청, 기와지붕, 잡상)를 건물 실루엣의 제자리로 끌어다 놓는다
 * ③ 완성되면 각 건축 요소의 이름과 짧은 설명을 보여 준다.
 * 다른 게임 코드와 독립된 파일이며, 모든 그림은 Canvas 로 직접 그린다. */
(function (KK) {
  'use strict';

  const W = 960;
  const H = 540;
  const CX = 330;
  const G = 432;
  const TIME_LIMIT = 90;
  const BELT_Y = 494;
  const GRAB = { x: 70, w: 110 };
  const OUT = '#2e2a3a';
  const PANEL = { x: 636, y: 10, w: 314, h: 436 };

  // 아래에서 위로 짓는 순서
  const PARTS = [
    { id: 'platform', mat: 'stone', need: 3, slots: [[CX - 255, G - 58, 510, 62]], anchor: [CX + 215, G - 30] },
    { id: 'pillars', mat: 'log', need: 3, slots: [[CX - 192, G - 192, 384, 140]], anchor: [CX + 172, 318] },
    { id: 'brackets', mat: 'bracket', need: 2, slots: [[CX - 205, 198, 410, 54]], anchor: [CX + 170, 226] },
    { id: 'dancheong', mat: 'paint', need: 2, slots: [[CX - 205, 198, 410, 54]], anchor: [CX + 115, 213] },
    { id: 'roof', mat: 'tile', need: 3, slots: [[CX - 288, 94, 576, 118]], anchor: [CX + 215, 176] },
    {
      id: 'japsang',
      mat: 'figure',
      need: 2,
      slots: [
        [CX - 278, 108, 140, 74],
        [CX + 138, 108, 140, 74],
      ],
      anchor: [CX + 214, 150],
    },
  ];
  const PART_BY_ID = {};
  PARTS.forEach((p, i) => {
    p.index = i;
    PART_BY_ID[p.id] = p;
  });
  const MATS = ['stone', 'log', 'bracket', 'paint', 'tile', 'figure'];
  const MAT_PART = {};
  PARTS.forEach((p) => (MAT_PART[p.mat] = p));
  const MODERN = ['glass', 'steel', 'plastic'];

  KK.i18n.add({
    en: {
      'pb.goal': 'Build a traditional Korean palace hall from the ground up! Tap the right materials on the moving line, then drag each finished part onto its place on the building.',
      'pb.ctrlTouch': 'Touch / mouse: tap a material on the moving line to collect it. Drag a glowing part onto the building (or tap the part, then tap its place).',
      'pb.ctrlKeys': 'Keyboard: Space grabs the item inside the yellow box. ↑ picks a ready part, ← → choose a place, ↓ puts the part there. P or Esc pauses.',
      'pb.avoid': 'Glass, steel beams and plastic were not used in traditional palace halls — skip them! Mistakes lower your craftsmanship score.',
      'pb.part.platform': 'Stone platform',
      'pb.part.pillars': 'Wooden pillars',
      'pb.part.brackets': 'Bracket sets',
      'pb.part.dancheong': 'Dancheong paint',
      'pb.part.roof': 'Tiled roof',
      'pb.part.japsang': 'Roof guardians',
      'pb.ko.platform': 'gidan · 기단',
      'pb.ko.pillars': 'gidung · 기둥',
      'pb.ko.brackets': 'gongpo · 공포',
      'pb.ko.dancheong': 'dancheong · 단청',
      'pb.ko.roof': 'giwa · 기와',
      'pb.ko.japsang': 'japsang · 잡상',
      'pb.desc.platform': 'A raised stone base that lifts the hall above damp ground and makes it look grand.',
      'pb.desc.pillars': 'Wooden columns stand on cornerstones (choseok) and hold up the heavy roof.',
      'pb.desc.brackets': 'Interlocking wooden brackets on top of the pillars spread the roof’s weight and hold up the deep eaves.',
      'pb.desc.dancheong': 'Colourful painted patterns decorate the wood and help protect it from weather and insects.',
      'pb.desc.roof': 'Fired clay tiles cover the gently curved roof; its corners sweep upward.',
      'pb.desc.japsang': 'Small clay figures lined up on palace roof ridges, believed to guard the hall from bad spirits.',
      'pb.mat.stone': 'Granite block',
      'pb.mat.log': 'Timber',
      'pb.mat.bracket': 'Bracket block',
      'pb.mat.paint': 'Dancheong paint',
      'pb.mat.tile': 'Roof tile',
      'pb.mat.figure': 'Clay figure',
      'pb.mat.glass': 'Glass pane',
      'pb.mat.steel': 'Steel beam',
      'pb.mat.plastic': 'Plastic bucket',
      'pb.parts': 'Parts',
      'pb.progress': 'Build {p}%',
      'pb.ready': 'Drag to the building!',
      'pb.placed': 'Placed',
      'pb.grab': 'SPACE / TAP',
      'pb.modern': 'Not used in a traditional hall!',
      'pb.enough': 'Already enough',
      'pb.order': 'Build from the ground up!',
      'pb.wrongSpot': 'That part goes somewhere else.',
      'pb.combo': 'Combo ×{n}',
      'pb.complete': 'Palace hall complete!',
      'pb.admire': 'Parts of a palace hall',
      'pb.tapContinue': 'Tap or press SPACE to continue',
      'pb.timeUp': "Time's up!",
      'pb.resultWin': 'Palace hall complete!',
      'pb.resultFail': 'The hall is unfinished',
      'pb.built': 'Built {p}% · Still to place: {list}',
      'pb.bd.materials': 'Materials',
      'pb.bd.combo': 'Combo bonus',
      'pb.bd.parts': 'Parts placed',
      'pb.bd.mistakes': 'Mistakes',
      'pb.bd.craft': 'Craftsmanship bonus',
      'pb.bd.time': 'Time bonus',
      'pb.factTitle': 'Gyeongbokgung Palace',
      'pb.fact':
        'Gyeongbokgung in Seoul was first built in 1395 as the main royal palace of the Joseon dynasty. Its throne hall, Geunjeongjeon, stands on a two-tier stone platform. Palace halls like it combine wooden pillars, bracket sets, colourful dancheong and curved tiled roofs with small japsang figures on the ridges.',
      'badge.pb_first.name': 'First Palace Hall',
      'badge.pb_first.desc': 'Complete Palace Builder.',
      'badge.pb_master.name': 'Master Carpenter',
      'badge.pb_master.desc': 'Finish the hall with no mistakes.',
      'badge.pb_combo.name': 'Sharp Eye',
      'badge.pb_combo.desc': 'Collect 8 materials in a row.',
      'badge.pb_fast.name': 'Swift Builder',
      'badge.pb_fast.desc': 'Finish with 30 seconds or more left.',
      'badge.pb_tradition.name': 'Tradition Keeper',
      'badge.pb_tradition.desc': 'Finish without picking any modern material.',
    },
    ko: {
      'pb.goal': '한국 전통 궁궐 전각을 아래부터 차례대로 지어요! 움직이는 재료 줄에서 알맞은 재료를 탭해 모으고, 완성된 부재를 건물의 제자리로 끌어다 놓아요.',
      'pb.ctrlTouch': '터치/마우스: 재료 줄의 재료를 탭하면 모아져요. 빛나는 부재를 건물로 끌어다 놓거나, 부재를 탭한 다음 놓을 자리를 탭해요.',
      'pb.ctrlKeys': '키보드: Space로 노란 상자 안의 재료를 잡아요. ↑로 준비된 부재 고르기, ← →로 자리 고르기, ↓로 놓기. P 또는 Esc로 일시정지.',
      'pb.avoid': '유리, 철골, 플라스틱은 전통 궁궐 건물에 쓰지 않았어요. 건너뛰세요! 실수하면 솜씨 점수가 줄어요.',
      'pb.part.platform': '기단',
      'pb.part.pillars': '기둥',
      'pb.part.brackets': '공포',
      'pb.part.dancheong': '단청',
      'pb.part.roof': '기와지붕',
      'pb.part.japsang': '잡상',
      'pb.ko.platform': 'Stone platform',
      'pb.ko.pillars': 'Wooden pillars',
      'pb.ko.brackets': 'Bracket sets',
      'pb.ko.dancheong': 'Painted patterns',
      'pb.ko.roof': 'Tiled roof',
      'pb.ko.japsang': 'Roof guardians',
      'pb.desc.platform': '건물을 땅보다 높여 습기를 막고 웅장해 보이게 하는 돌 받침이에요.',
      'pb.desc.pillars': '주춧돌(초석) 위에 세운 나무 기둥이 무거운 지붕을 받쳐요.',
      'pb.desc.brackets': '기둥 위에 짜 맞춘 나무 부재로, 지붕의 무게를 나누고 길게 뻗은 처마를 받쳐요.',
      'pb.desc.dancheong': '나무에 칠한 화려한 무늬로, 건물을 꾸미고 비바람과 벌레로부터 나무를 보호해요.',
      'pb.desc.roof': '흙을 구워 만든 기와가 부드럽게 휜 지붕을 덮어요. 처마 끝은 위로 들려 있어요.',
      'pb.desc.japsang': '궁궐 지붕 마루에 줄지어 올린 작은 흙 인형으로, 나쁜 기운을 막아 준다고 믿었어요.',
      'pb.mat.stone': '화강암 돌',
      'pb.mat.log': '목재',
      'pb.mat.bracket': '공포 부재',
      'pb.mat.paint': '단청 안료',
      'pb.mat.tile': '기와',
      'pb.mat.figure': '잡상 인형',
      'pb.mat.glass': '유리판',
      'pb.mat.steel': '철골',
      'pb.mat.plastic': '플라스틱 양동이',
      'pb.parts': '건축 부재',
      'pb.progress': '건설 {p}%',
      'pb.ready': '건물로 끌어다 놓아요!',
      'pb.placed': '완료',
      'pb.grab': 'SPACE / 탭',
      'pb.modern': '전통 궁궐에는 쓰지 않았어요!',
      'pb.enough': '이미 충분해요',
      'pb.order': '아래부터 차례대로 지어요!',
      'pb.wrongSpot': '그 자리가 아니에요!',
      'pb.combo': '콤보 ×{n}',
      'pb.complete': '궁궐 전각 완성!',
      'pb.admire': '궁궐 전각의 구성',
      'pb.tapContinue': '탭하거나 SPACE를 눌러 계속',
      'pb.timeUp': '시간 종료!',
      'pb.resultWin': '궁궐 전각 완성!',
      'pb.resultFail': '아직 다 짓지 못했어요',
      'pb.built': '건설 {p}% · 남은 부재: {list}',
      'pb.bd.materials': '재료 점수',
      'pb.bd.combo': '연속 수집 보너스',
      'pb.bd.parts': '부재 배치',
      'pb.bd.mistakes': '실수',
      'pb.bd.craft': '솜씨 보너스',
      'pb.bd.time': '남은 시간 보너스',
      'pb.factTitle': '경복궁',
      'pb.fact':
        '서울의 경복궁은 1395년 조선의 으뜸 궁궐(법궁)로 처음 지어졌어요. 정전인 근정전은 두 단으로 된 돌 기단 위에 서 있어요. 이런 궁궐 전각은 나무 기둥과 공포, 화려한 단청, 곡선이 아름다운 기와지붕, 그리고 지붕 마루 위의 작은 잡상이 어우러져 있어요.',
      'badge.pb_first.name': '첫 궁궐',
      'badge.pb_first.desc': '궁궐 짓기를 완성했어요.',
      'badge.pb_master.name': '도편수',
      'badge.pb_master.desc': '실수 없이 전각을 완성했어요.',
      'badge.pb_combo.name': '매의 눈',
      'badge.pb_combo.desc': '재료 8개를 연속으로 모았어요.',
      'badge.pb_fast.name': '날쌘 목수',
      'badge.pb_fast.desc': '30초 이상 남기고 완성했어요.',
      'badge.pb_tradition.name': '전통 지킴이',
      'badge.pb_tradition.desc': '현대 재료를 하나도 고르지 않고 완성했어요.',
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
    // 띄어쓰기 단위로 줄바꿈 (긴 단어는 글자 단위)
    const words = str.split(' ');
    const lines = [];
    let line = '';
    words.forEach((w) => {
      const test = line ? line + ' ' + w : w;
      if (c.measureText(test).width <= maxW) line = test;
      else {
        if (line) lines.push(line);
        if (c.measureText(w).width > maxW) {
          let part = '';
          for (const ch of w) {
            if (c.measureText(part + ch).width > maxW) {
              lines.push(part);
              part = ch;
            } else part += ch;
          }
          line = part;
        } else line = w;
      }
    });
    if (line) lines.push(line);
    return lines;
  }

  /* ----- 재료 그림 (단위 좌표 -1..1) ----- */
  const ART = {
    stone(c) {
      c.beginPath();
      c.moveTo(-0.85, -0.2);
      c.lineTo(-0.5, -0.6);
      c.lineTo(0.85, -0.6);
      c.lineTo(0.85, 0.45);
      c.lineTo(0.5, 0.75);
      c.lineTo(-0.85, 0.75);
      c.closePath();
      fs(c, '#cfc8bb');
      c.beginPath();
      c.moveTo(-0.85, -0.2);
      c.lineTo(-0.5, -0.6);
      c.lineTo(0.85, -0.6);
      c.lineTo(0.5, -0.2);
      c.closePath();
      fs(c, '#e6e0d4');
      c.beginPath();
      c.moveTo(0.5, -0.2);
      c.lineTo(0.85, -0.6);
      c.lineTo(0.85, 0.45);
      c.lineTo(0.5, 0.75);
      c.closePath();
      fs(c, '#aea698');
      c.fillStyle = '#8c8578';
      [
        [-0.5, 0.1],
        [-0.1, 0.3],
        [0.2, 0.05],
        [-0.3, 0.5],
        [0.25, 0.5],
        [0.68, 0.1],
      ].forEach(([x, y]) => {
        ell(c, x, y, 0.05, 0.04);
        c.fill();
      });
    },
    log(c) {
      c.save();
      c.rotate(-0.25);
      rrect(c, -0.85, -0.32, 1.5, 0.64, 0.12);
      fs(c, '#c8894f');
      c.strokeStyle = '#a56a35';
      c.lineWidth = 0.06;
      c.beginPath();
      c.moveTo(-0.7, -0.1);
      c.lineTo(0.4, -0.1);
      c.moveTo(-0.6, 0.14);
      c.lineTo(0.5, 0.14);
      c.stroke();
      c.strokeStyle = OUT;
      c.lineWidth = 0.09;
      ell(c, 0.66, 0, 0.24, 0.34);
      fs(c, '#efc58c');
      c.strokeStyle = '#c08a4c';
      c.lineWidth = 0.05;
      ell(c, 0.66, 0, 0.14, 0.2);
      c.stroke();
      ell(c, 0.66, 0, 0.05, 0.08);
      c.stroke();
      c.restore();
    },
    bracket(c) {
      const step = (y, w, h, col) => {
        rrect(c, -w / 2, y, w, h, 0.05);
        fs(c, col);
      };
      step(-0.75, 1.7, 0.3, '#d9a86e');
      step(-0.45, 1.2, 0.3, '#cf9a5c');
      step(-0.15, 0.8, 0.3, '#d9a86e');
      step(0.15, 0.5, 0.55, '#c88f52');
      c.strokeStyle = '#a56a35';
      c.lineWidth = 0.05;
      c.beginPath();
      c.moveTo(-0.6, -0.6);
      c.lineTo(0.6, -0.6);
      c.stroke();
    },
    paint(c) {
      c.beginPath();
      c.moveTo(-0.75, -0.2);
      c.lineTo(0.75, -0.2);
      c.lineTo(0.6, 0.75);
      c.lineTo(-0.6, 0.75);
      c.closePath();
      fs(c, '#f2e6d0');
      ell(c, 0, -0.2, 0.75, 0.2);
      fs(c, '#2f9a7a');
      c.fillStyle = '#e4473a';
      c.fillRect(-0.62, 0.05, 1.24, 0.14);
      c.fillStyle = '#ffd34d';
      c.fillRect(-0.6, 0.22, 1.2, 0.1);
      c.fillStyle = '#3a6fd8';
      c.fillRect(-0.58, 0.36, 1.16, 0.12);
      c.save();
      c.rotate(0.5);
      rrect(c, 0.05, -1.05, 0.16, 0.95, 0.05);
      fs(c, '#c8894f');
      ell(c, 0.13, -0.1, 0.12, 0.18);
      fs(c, '#2f9a7a');
      c.restore();
    },
    tile(c) {
      c.beginPath();
      c.moveTo(-0.8, 0.5);
      c.lineTo(-0.8, -0.05);
      c.quadraticCurveTo(-0.8, -0.55, 0.0, -0.55);
      c.lineTo(0.55, -0.55);
      c.lineTo(0.55, 0.5);
      c.closePath();
      fs(c, '#5d6577');
      c.strokeStyle = '#7b8496';
      c.lineWidth = 0.06;
      c.beginPath();
      c.moveTo(-0.6, -0.15);
      c.quadraticCurveTo(-0.55, -0.4, -0.1, -0.42);
      c.stroke();
      c.strokeStyle = OUT;
      c.lineWidth = 0.09;
      ell(c, 0.55, -0.02, 0.32, 0.52);
      fs(c, '#4b5263');
      c.strokeStyle = '#8a93a6';
      c.lineWidth = 0.05;
      ell(c, 0.55, -0.02, 0.2, 0.34);
      c.stroke();
      c.fillStyle = '#8a93a6';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ell(c, 0.55 + Math.cos(a) * 0.1, -0.02 + Math.sin(a) * 0.17, 0.04, 0.06, a);
        c.fill();
      }
    },
    figure(c) {
      c.beginPath();
      c.moveTo(-0.55, 0.8);
      c.quadraticCurveTo(-0.6, 0.0, -0.25, -0.15);
      c.lineTo(0.3, -0.15);
      c.quadraticCurveTo(0.62, 0.0, 0.55, 0.8);
      c.closePath();
      fs(c, '#8d7f72');
      ell(c, 0, -0.45, 0.4, 0.38);
      fs(c, '#a0928a');
      c.beginPath();
      c.moveTo(-0.32, -0.7);
      c.lineTo(-0.38, -0.98);
      c.lineTo(-0.12, -0.8);
      c.moveTo(0.32, -0.7);
      c.lineTo(0.38, -0.98);
      c.lineTo(0.12, -0.8);
      c.fillStyle = '#a0928a';
      c.fill();
      c.stroke();
      c.fillStyle = OUT;
      ell(c, -0.14, -0.48, 0.06, 0.08);
      c.fill();
      ell(c, 0.14, -0.48, 0.06, 0.08);
      c.fill();
      c.lineWidth = 0.06;
      c.beginPath();
      c.arc(0, -0.32, 0.1, 0.2, Math.PI - 0.2);
      c.stroke();
      c.strokeStyle = '#6f6359';
      c.beginPath();
      c.moveTo(-0.3, 0.3);
      c.lineTo(0.3, 0.3);
      c.stroke();
    },
    glass(c) {
      rrect(c, -0.7, -0.85, 1.4, 1.7, 0.08);
      fs(c, 'rgba(150,215,255,.75)');
      c.strokeStyle = '#ffffff';
      c.lineWidth = 0.1;
      c.beginPath();
      c.moveTo(-0.4, -0.4);
      c.lineTo(-0.05, -0.75);
      c.moveTo(-0.45, 0.0);
      c.lineTo(0.3, -0.75);
      c.stroke();
      c.strokeStyle = '#7f8fa6';
      c.lineWidth = 0.12;
      rrect(c, -0.7, -0.85, 1.4, 1.7, 0.08);
      c.stroke();
    },
    steel(c) {
      c.beginPath();
      c.moveTo(-0.85, -0.55);
      c.lineTo(0.85, -0.55);
      c.lineTo(0.85, -0.32);
      c.lineTo(0.15, -0.32);
      c.lineTo(0.15, 0.32);
      c.lineTo(0.85, 0.32);
      c.lineTo(0.85, 0.55);
      c.lineTo(-0.85, 0.55);
      c.lineTo(-0.85, 0.32);
      c.lineTo(-0.15, 0.32);
      c.lineTo(-0.15, -0.32);
      c.lineTo(-0.85, -0.32);
      c.closePath();
      fs(c, '#8a96a8');
      c.fillStyle = 'rgba(255,255,255,.4)';
      c.fillRect(-0.8, -0.52, 1.6, 0.08);
    },
    plastic(c) {
      c.beginPath();
      c.moveTo(-0.65, -0.45);
      c.lineTo(0.65, -0.45);
      c.lineTo(0.48, 0.8);
      c.lineTo(-0.48, 0.8);
      c.closePath();
      fs(c, '#ff4fa3');
      ell(c, 0, -0.45, 0.65, 0.16);
      fs(c, '#ff86c2');
      c.lineWidth = 0.08;
      c.beginPath();
      c.arc(0, -0.45, 0.7, Math.PI * 1.05, Math.PI * 1.95);
      c.stroke();
      c.fillStyle = 'rgba(255,255,255,.45)';
      c.fillRect(-0.4, -0.2, 0.12, 0.8);
    },
  };

  function drawMat(c, type, x, y, size, rot) {
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

  /* ----- 궁궐 전각 (부분별로 그리기 / 빈 자리는 점선 실루엣) ----- */
  const GHOST_FILL = 'rgba(70,90,150,.13)';
  function style(c, ghost) {
    c.lineJoin = 'round';
    c.lineCap = 'round';
    if (ghost) {
      c.setLineDash([7, 6]);
      c.strokeStyle = 'rgba(70,90,150,.75)';
      c.lineWidth = 2.5;
    } else {
      c.setLineDash([]);
      c.strokeStyle = OUT;
      c.lineWidth = 3;
    }
  }
  const col = (ghost, color) => (ghost ? GHOST_FILL : color);

  const HALL = {
    platform(c, ghost) {
      style(c, ghost);
      c.beginPath();
      c.rect(CX - 250, G - 28, 500, 28);
      fs(c, col(ghost, '#cfc8bb'));
      c.beginPath();
      c.rect(CX - 220, G - 52, 440, 24);
      fs(c, col(ghost, '#dcd5c8'));
      c.beginPath();
      c.rect(CX - 34, G - 52, 68, 52);
      fs(c, col(ghost, '#e6e0d4'));
      if (!ghost) {
        c.strokeStyle = '#a79f91';
        c.lineWidth = 2;
        c.beginPath();
        for (let y = G - 46; y < G; y += 9) {
          c.moveTo(CX - 32, y);
          c.lineTo(CX + 32, y);
        }
        for (let x = CX - 240; x < CX + 250; x += 50) {
          if (Math.abs(x - CX) < 40) continue;
          c.moveTo(x, G - 28);
          c.lineTo(x, G);
        }
        for (let x = CX - 205; x < CX + 220; x += 55) {
          if (Math.abs(x - CX) < 40) continue;
          c.moveTo(x, G - 52);
          c.lineTo(x, G - 28);
        }
        c.stroke();
      }
    },
    pillars(c, ghost, painted) {
      style(c, ghost);
      const xs = [-170, -60, 60, 170];
      const top = G - 185;
      const base = G - 52;
      // 문 (창호)
      [
        [-170, -60],
        [-60, 60],
        [60, 170],
      ].forEach(([a, b]) => {
        const x0 = CX + a + 10;
        const x1 = CX + b - 10;
        c.beginPath();
        c.rect(x0, top + 16, x1 - x0, base - 10 - top - 16);
        fs(c, col(ghost, '#f3e1b6'));
        if (!ghost) {
          c.strokeStyle = '#b07e3c';
          c.lineWidth = 1.6;
          c.beginPath();
          const n = 4;
          const wv = (x1 - x0) / n;
          for (let i = 1; i < n; i++) {
            c.moveTo(x0 + wv * i, top + 16);
            c.lineTo(x0 + wv * i, base - 10);
          }
          for (let y = top + 30; y < base - 12; y += 14) {
            c.moveTo(x0, y);
            c.lineTo(x1, y);
          }
          c.stroke();
          style(c, false);
          c.beginPath();
          c.rect(x0, top + 16, x1 - x0, base - 10 - top - 16);
          c.stroke();
        }
      });
      xs.forEach((dx) => {
        const x = CX + dx;
        style(c, ghost);
        c.beginPath();
        c.moveTo(x - 17, base);
        c.lineTo(x + 17, base);
        c.lineTo(x + 12, base - 10);
        c.lineTo(x - 12, base - 10);
        c.closePath();
        fs(c, col(ghost, '#bdb5a7'));
        c.beginPath();
        c.rect(x - 10, top, 20, base - 10 - top);
        fs(c, col(ghost, painted ? '#b8332a' : '#c58c55'));
        if (!ghost) {
          c.fillStyle = 'rgba(255,255,255,.18)';
          c.fillRect(x - 7, top + 4, 4, base - 18 - top);
        }
      });
    },
    brackets(c, ghost, painted) {
      style(c, ghost);
      const beamY = G - 200;
      c.beginPath();
      c.rect(CX - 195, beamY, 390, 16);
      fs(c, col(ghost, painted ? '#2f9a7a' : '#c99a62'));
      if (painted && !ghost) {
        for (let x = CX - 185; x < CX + 190; x += 30) {
          c.fillStyle = '#ffd34d';
          ell(c, x, beamY + 8, 5, 5);
          c.fill();
          c.fillStyle = '#e4473a';
          ell(c, x, beamY + 8, 2.4, 2.4);
          c.fill();
        }
        c.fillStyle = '#3a6fd8';
        c.fillRect(CX - 195, beamY + 13, 390, 3);
        c.fillStyle = '#e4473a';
        c.fillRect(CX - 195, beamY, 390, 3);
        style(c, false);
        c.strokeRect(CX - 195, beamY, 390, 16);
      }
      [-170, -115, -60, 0, 60, 115, 170].forEach((dx) => {
        const x = CX + dx;
        style(c, ghost);
        const steps = [
          [18, beamY - 8],
          [30, beamY - 16],
          [42, beamY - 24],
        ];
        steps.forEach(([w, y]) => {
          c.beginPath();
          c.rect(x - w / 2, y, w, 8);
          fs(c, col(ghost, painted ? '#2f9a7a' : '#d2a46c'));
        });
        if (painted && !ghost) {
          c.fillStyle = '#e4473a';
          c.fillRect(x - 21, beamY - 24, 42, 2.5);
          c.fillStyle = '#ffd34d';
          c.fillRect(x - 15, beamY - 16, 30, 2.5);
        }
      });
    },
    dancheongGhost(c) {
      style(c, true);
      c.beginPath();
      rrect(c, CX - 200, G - 228, 400, 46, 10);
      c.fillStyle = 'rgba(47,154,122,.12)';
      c.fill();
      c.stroke();
      c.setLineDash([]);
      drawMat(c, 'paint', CX, G - 205, 30);
    },
    roof(c, ghost) {
      style(c, ghost);
      if (!ghost) {
        c.beginPath();
        c.moveTo(CX - 262, 182);
        c.quadraticCurveTo(CX - 190, 214, CX, 216);
        c.quadraticCurveTo(CX + 190, 214, CX + 262, 182);
        c.lineTo(CX + 262, 176);
        c.lineTo(CX - 262, 176);
        c.closePath();
        c.fillStyle = '#2b2f3a';
        c.fill();
      }
      const roofPath = () => {
        c.beginPath();
        c.moveTo(CX - 280, 172);
        c.quadraticCurveTo(CX - 200, 208, CX, 210);
        c.quadraticCurveTo(CX + 200, 208, CX + 280, 172);
        c.quadraticCurveTo(CX + 220, 160, CX + 150, 120);
        c.lineTo(CX - 150, 120);
        c.quadraticCurveTo(CX - 220, 160, CX - 280, 172);
        c.closePath();
      };
      roofPath();
      c.fillStyle = col(ghost, '#4b5263');
      c.fill();
      if (!ghost) {
        c.save();
        c.clip();
        c.strokeStyle = '#626b80';
        c.lineWidth = 5;
        c.beginPath();
        for (let x = CX - 290; x < CX + 290; x += 13) {
          c.moveTo(x * 0.45 + CX * 0.55, 118);
          c.lineTo(x, 214);
        }
        c.stroke();
        c.restore();
      }
      style(c, ghost);
      roofPath();
      c.stroke();
      // 용마루와 내림마루
      c.beginPath();
      c.moveTo(CX - 162, 122);
      c.lineTo(CX - 166, 100);
      c.lineTo(CX - 150, 106);
      c.lineTo(CX + 150, 106);
      c.lineTo(CX + 166, 100);
      c.lineTo(CX + 162, 122);
      c.closePath();
      fs(c, col(ghost, '#30353f'));
      if (!ghost) {
        c.strokeStyle = '#30353f';
        c.lineWidth = 7;
        c.beginPath();
        c.moveTo(CX - 152, 121);
        c.quadraticCurveTo(CX - 220, 150, CX - 268, 168);
        c.moveTo(CX + 152, 121);
        c.quadraticCurveTo(CX + 220, 150, CX + 268, 168);
        c.stroke();
      }
    },
    japsang(c, ghost) {
      [-1, 1].forEach((sgn) => {
        [0.42, 0.56, 0.7, 0.84].forEach((tt) => {
          const x = CX + sgn * (152 + (268 - 152) * tt);
          const y = 121 + (168 - 121) * tt - 2 - Math.sin(tt * Math.PI) * 6;
          if (ghost) {
            style(c, true);
            ell(c, x, y - 9, 7, 9);
            c.fillStyle = GHOST_FILL;
            c.fill();
            c.stroke();
          } else drawMat(c, 'figure', x, y - 9, 20);
        });
      });
      c.setLineDash([]);
    },
  };

  function drawHall(c, placed) {
    const painted = !!placed.dancheong;
    c.save();
    HALL.platform(c, !placed.platform);
    HALL.pillars(c, !placed.pillars, painted);
    HALL.brackets(c, !placed.brackets, painted);
    if (!placed.dancheong) HALL.dancheongGhost(c);
    HALL.roof(c, !placed.roof);
    HALL.japsang(c, !placed.japsang);
    c.restore();
  }

  /* ----- 목수 캐릭터 ----- */
  function drawCarpenter(c, x, y, pose, tm) {
    c.save();
    c.translate(x, y);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    let bob = 0;
    if (pose === 'cheer') bob = -Math.abs(Math.sin(tm * 7)) * 10;
    c.translate(0, bob);
    const limb = (hx, hy, ang, len, colr, w) => {
      c.save();
      c.translate(hx, hy);
      c.rotate(ang);
      c.strokeStyle = OUT;
      c.lineWidth = w + 4;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(0, len);
      c.stroke();
      c.strokeStyle = colr;
      c.lineWidth = w;
      c.stroke();
      c.restore();
    };
    limb(-6, -30, 0.08, 26, '#6b4a2f', 9);
    limb(6, -30, -0.08, 26, '#6b4a2f', 9);
    c.strokeStyle = OUT;
    c.lineWidth = 2.5;
    ell(c, -8, -2, 9, 4.5);
    fs(c, '#3b3b44');
    ell(c, 8, -2, 9, 4.5);
    fs(c, '#3b3b44');
    rrect(c, -16, -68, 32, 42, 10);
    fs(c, '#f4ecd8');
    c.beginPath();
    c.moveTo(-16, -40);
    c.lineTo(16, -40);
    c.lineTo(14, -26);
    c.lineTo(-14, -26);
    c.closePath();
    fs(c, '#8a5a33');
    // 팔 + 나무망치
    const swing = pose === 'idle' ? Math.sin(tm * 5) * 0.4 : 0;
    if (pose === 'cheer') {
      limb(-12, -62, 2.7, 18, '#f4ecd8', 8);
      limb(12, -62, -2.7, 18, '#f4ecd8', 8);
    } else if (pose === 'oops') {
      limb(-12, -62, 0.2, 18, '#f4ecd8', 8);
      limb(12, -62, -2.6, 18, '#f4ecd8', 8);
    } else {
      limb(-12, -62, 0.2, 18, '#f4ecd8', 8);
      c.save();
      c.translate(12, -62);
      c.rotate(-1.2 + swing);
      c.strokeStyle = OUT;
      c.lineWidth = 12;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(0, 18);
      c.stroke();
      c.strokeStyle = '#f4ecd8';
      c.lineWidth = 8;
      c.stroke();
      c.strokeStyle = OUT;
      c.lineWidth = 2.5;
      rrect(c, -2, 16, 4, 20, 1.5);
      fs(c, '#a56a35');
      rrect(c, -9, 34, 18, 12, 3);
      fs(c, '#c8894f');
      c.restore();
    }
    // 머리
    const hy = -84;
    ell(c, 0, hy, 17, 17);
    fs(c, '#ffd9b5');
    c.beginPath();
    c.arc(0, hy - 2, 17.5, Math.PI * 1.05, Math.PI * 1.95);
    c.closePath();
    c.fillStyle = '#2b1d16';
    c.fill();
    c.strokeStyle = '#3a6fd8';
    c.lineWidth = 5;
    c.beginPath();
    c.arc(0, hy - 1, 17, Math.PI * 1.08, Math.PI * 1.92);
    c.stroke();
    c.fillStyle = OUT;
    if (pose === 'oops') {
      c.strokeStyle = OUT;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(-8, hy + 1);
      c.lineTo(-3, hy + 3);
      c.moveTo(8, hy + 1);
      c.lineTo(3, hy + 3);
      c.stroke();
      c.fillStyle = '#7cc4ff';
      c.beginPath();
      c.moveTo(19, hy - 12);
      c.quadraticCurveTo(24, hy - 4, 19, hy - 2);
      c.quadraticCurveTo(15, hy - 4, 19, hy - 12);
      c.fill();
    } else {
      ell(c, -6, hy + 2, 2.3, 3.3);
      c.fill();
      ell(c, 6, hy + 2, 2.3, 3.3);
      c.fill();
    }
    c.fillStyle = 'rgba(255,120,140,.5)';
    ell(c, -10, hy + 8, 3.2, 2.2);
    c.fill();
    ell(c, 10, hy + 8, 3.2, 2.2);
    c.fill();
    c.strokeStyle = OUT;
    c.lineWidth = 2;
    c.beginPath();
    if (pose === 'oops') c.arc(0, hy + 12, 3, Math.PI * 1.15, Math.PI * 1.85);
    else c.arc(0, hy + 8, 3.6, 0.2, Math.PI - 0.2);
    c.stroke();
    c.restore();
  }

  /* ----- 배경: 궁궐 마당 ----- */
  function drawCourt(c, tm) {
    const sky = c.createLinearGradient(0, 0, 0, 330);
    sky.addColorStop(0, '#8fd0ff');
    sky.addColorStop(1, '#eaf7ff');
    c.fillStyle = sky;
    c.fillRect(0, 0, W, H);
    [
      [140, 60, 1],
      [480, 40, 0.8],
      [820, 80, 0.9],
    ].forEach(([cx, cy, s], i) => {
      const x = ((cx + tm * (5 + i * 2)) % (W + 240)) - 120;
      c.fillStyle = 'rgba(255,255,255,.9)';
      ell(c, x, cy, 42 * s, 15 * s);
      c.fill();
      ell(c, x + 24 * s, cy - 9 * s, 26 * s, 16 * s);
      c.fill();
    });
    c.fillStyle = '#95c6b0';
    c.beginPath();
    c.moveTo(0, 300);
    c.quadraticCurveTo(160, 150, 330, 230);
    c.quadraticCurveTo(470, 120, 640, 240);
    c.quadraticCurveTo(800, 180, 960, 260);
    c.lineTo(960, 330);
    c.lineTo(0, 330);
    c.closePath();
    c.fill();
    c.fillStyle = '#76ad94';
    c.beginPath();
    c.moveTo(0, 320);
    c.quadraticCurveTo(220, 240, 420, 300);
    c.quadraticCurveTo(700, 230, 960, 300);
    c.lineTo(960, 340);
    c.lineTo(0, 340);
    c.closePath();
    c.fill();
    // 행각(담장)
    c.fillStyle = '#efe4cf';
    c.fillRect(0, 318, W, 72);
    c.fillStyle = '#b8332a';
    for (let x = 20; x < W; x += 70) c.fillRect(x, 318, 8, 72);
    c.fillStyle = '#4b5263';
    c.beginPath();
    c.moveTo(-10, 322);
    c.lineTo(W + 10, 322);
    c.lineTo(W + 10, 306);
    c.lineTo(-10, 306);
    c.closePath();
    c.fill();
    c.fillStyle = '#30353f';
    c.fillRect(-10, 300, W + 20, 7);
    // 박석 마당
    c.fillStyle = '#ddd6c7';
    c.fillRect(0, 390, W, 70);
    c.strokeStyle = '#c4bba8';
    c.lineWidth = 2;
    c.beginPath();
    for (let row = 0; row < 3; row++) {
      const y = 396 + row * 22;
      for (let x = -40 + (row % 2) * 30; x < W; x += 62) {
        c.moveTo(x, y);
        c.lineTo(x + 50 + ((x * 7) % 9), y + 3);
      }
    }
    c.stroke();
  }

  function drawBelt(c, offset) {
    c.save();
    c.strokeStyle = OUT;
    c.lineWidth = 3;
    c.fillStyle = '#7a5a40';
    c.fillRect(0, 458, W, 82);
    c.fillStyle = '#a47b55';
    c.fillRect(0, 462, W, 64);
    c.strokeStyle = '#8a6544';
    c.lineWidth = 3;
    c.beginPath();
    for (let x = -60 + (offset % 60); x < W + 60; x += 60) {
      c.moveTo(x, 462);
      c.lineTo(x, 526);
    }
    c.stroke();
    c.fillStyle = '#5a3f2a';
    c.fillRect(0, 526, W, 14);
    c.fillStyle = '#c9a274';
    for (let x = 20 - (offset % 40); x < W + 40; x += 40) {
      ell(c, x, 533, 5, 5);
      c.fill();
    }
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
      phase: 'ready', // ready | run | celebrate | admire | over | done
      time: 0,
      elapsed: 0,
      timeLeft: TIME_LIMIT,
      have: {},
      placed: {},
      matPts: 0,
      comboPts: 0,
      partPts: 0,
      penalty: 0,
      mistakes: 0,
      modern: 0,
      combo: 0,
      maxCombo: 0,
      items: [],
      flyers: [],
      parts: [],
      beltOffset: 0,
      nextItem: 0.3,
      selected: null,
      drag: null,
      slotCursor: 0,
      keyMode: false,
      pPress: pointer.presses,
      pRel: pointer.releases,
      pose: 'idle',
      poseT: 0,
      overT: 0,
      celebrateT: 0,
      admireT: 0,
      shown: 0,
      completeTime: null,
      lastShownTime: null,
      shake: 0,
    };
    MATS.forEach((m) => (S.have[m] = 0));

    hud.setTime(TIME_LIMIT);
    hud.setHearts(0, 0);
    hud.setScore(0);
    hud.setTracker([]);
    api.setControls([]);

    const placedCount = () => PARTS.filter((p) => S.placed[p.id]).length;
    const isReady = (p) => !S.placed[p.id] && S.have[p.mat] >= p.need;
    const liveScore = () => Math.max(0, S.matPts + S.comboPts + S.partPts - S.penalty);
    const cardRect = (i) => [PANEL.x + 10, PANEL.y + 46 + i * 64, PANEL.w - 20, 58];
    const inRect = (x, y, r) => x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3];
    const inPartSlot = (p, x, y) => p.slots.some((r) => inRect(x, y, r));

    function burst(x, y, colors, n, power) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = rand(0.4, 1) * (power || 240);
        S.parts.push({ kind: 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: rand(0.4, 0.8), max: 0.8, size: rand(3, 6), color: colors[i % colors.length], g: 500 });
      }
    }
    function floatText(str, x, y, color, size) {
      S.parts.push({ kind: 'text', str, x, y, vx: 0, vy: -55, life: 1.2, max: 1.2, size: size || 22, color: color || '#fff', g: 0 });
    }
    function react(pose) {
      S.pose = pose;
      S.poseT = 1.1;
    }
    function mistake(msg, x, y) {
      S.mistakes += 1;
      S.penalty += 25;
      S.combo = 0;
      S.shake = 6;
      floatText(`${msg} −25`, x, y, '#ffb3a8', 20);
      audio.play('fail');
      react('oops');
      hud.setScore(liveScore());
    }

    /* ----- 재료 줄 ----- */
    function pickType() {
      if (Math.random() < 0.2) return MODERN[Math.floor(Math.random() * MODERN.length)];
      const needed = PARTS.filter((p) => !S.placed[p.id] && S.have[p.mat] < p.need);
      if (needed.length && Math.random() < 0.85) {
        // 아래쪽 부재 재료가 조금 더 자주 나온다
        const w = needed.map((p, i) => (p.need - S.have[p.mat]) * (needed.length - i + 1));
        let r = Math.random() * w.reduce((a, b) => a + b, 0);
        for (let i = 0; i < needed.length; i++) {
          r -= w[i];
          if (r <= 0) return needed[i].mat;
        }
        return needed[0].mat;
      }
      return MATS[Math.floor(Math.random() * MATS.length)];
    }
    function spawnItem(type, x) {
      const it = { type: type || pickType(), x: x == null ? W + 40 : x, bob: rand(0, 6) };
      S.items.push(it);
      return it;
    }
    function beltSpeed() {
      return 115 + Math.min(70, S.elapsed * 0.9);
    }

    function collect(it) {
      const idx = S.items.indexOf(it);
      if (idx >= 0) S.items.splice(idx, 1);
      if (MODERN.includes(it.type)) {
        S.modern += 1;
        burst(it.x, BELT_Y, ['#9fd6ff', '#ffffff'], 10, 200);
        mistake(t('pb.modern'), it.x, BELT_Y - 60);
        return;
      }
      const part = MAT_PART[it.type];
      if (S.placed[part.id] || S.have[it.type] >= part.need) {
        floatText(t('pb.enough'), it.x, BELT_Y - 50, '#ffffff', 18);
        audio.play('land');
        return;
      }
      S.have[it.type] += 1;
      S.combo += 1;
      S.maxCombo = Math.max(S.maxCombo, S.combo);
      const cb = S.combo > 1 ? Math.min(80, (S.combo - 1) * 10) : 0;
      S.matPts += 40;
      S.comboPts += cb;
      hud.setScore(liveScore());
      floatText(`+${40 + cb}`, it.x, BELT_Y - 60, '#fff2a8', 24);
      floatText(t('pb.mat.' + it.type), it.x, BELT_Y - 36, '#ffffff', 16);
      if (S.combo >= 3) floatText(t('pb.combo', { n: S.combo }), it.x, BELT_Y - 88, '#ffd23f', 18);
      burst(it.x, BELT_Y, ['#ffd23f', '#ffffff', '#2f9a7a'], 10);
      audio.play('collect', S.combo);
      const r = cardRect(part.index);
      S.flyers.push({ type: it.type, x0: it.x, y0: BELT_Y, x1: r[0] + 30, y1: r[1] + 29, k: 0 });
      if (isReady(part)) {
        audio.play('success');
        if (!S.selected) S.selected = part.id;
      }
    }

    function grabZoneItem() {
      let best = null;
      let bd = 1e9;
      S.items.forEach((it) => {
        const d = Math.abs(it.x - (GRAB.x + GRAB.w / 2));
        if (it.x >= GRAB.x - 10 && it.x <= GRAB.x + GRAB.w + 10 && d < bd) {
          bd = d;
          best = it;
        }
      });
      return best;
    }

    /* ----- 배치 ----- */
    function tryPlace(partId, x, y) {
      const part = PART_BY_ID[partId];
      if (!part || !isReady(part)) return false;
      const target = inPartSlot(part, x, y) ? part : PARTS.find((p) => !S.placed[p.id] && p !== part && inPartSlot(p, x, y));
      if (!target) return false; // 빈 곳에 놓으면 그냥 취소
      if (target !== part) {
        mistake(t('pb.wrongSpot'), x, y - 20);
        return false;
      }
      const missing = PARTS.slice(0, part.index).find((p) => !S.placed[p.id]);
      if (missing) {
        mistake(t('pb.order'), x, y - 20);
        return false;
      }
      S.placed[part.id] = true;
      S.partPts += 150;
      S.selected = PARTS.find((p) => isReady(p)) ? PARTS.find((p) => isReady(p)).id : null;
      hud.setScore(liveScore());
      const r = part.slots[0];
      floatText(`${t('pb.part.' + part.id)} +150`, r[0] + r[2] / 2, r[1] - 6, '#ffd23f', 24);
      burst(r[0] + r[2] / 2, r[1] + r[3] / 2, ['#ffd23f', '#ffffff', '#e4473a', '#2f9a7a'], 26, 320);
      audio.play('success');
      react('cheer');
      if (placedCount() === PARTS.length) complete();
      return true;
    }

    function complete() {
      S.phase = 'celebrate';
      S.celebrateT = 0;
      S.completeTime = S.elapsed;
      S.items = [];
      S.drag = null;
      S.selected = null;
      audio.play('fanfare');
      burst(CX, 200, ['#ff6b4a', '#ffd23f', '#7bc043', '#4cc3ff', '#ff7eb6'], 60, 520);
    }

    function gameOver() {
      if (S.phase !== 'run') return;
      S.phase = 'over';
      S.overT = 0;
      S.drag = null;
      hud.banner(t('pb.timeUp'), 'lose', 1700);
      audio.play('fail');
      react('oops');
    }

    function finish(completed) {
      if (S.phase === 'done') return;
      S.phase = 'done';
      const breakdown = [
        { label: t('pb.bd.materials'), value: S.matPts },
        { label: t('pb.bd.combo'), value: S.comboPts },
        { label: t('pb.bd.parts'), value: S.partPts },
      ];
      if (S.penalty) breakdown.push({ label: t('pb.bd.mistakes'), value: -S.penalty });
      let score = S.matPts + S.comboPts + S.partPts - S.penalty;
      if (completed) {
        const craft = Math.round(500 * Math.max(0, 1 - S.mistakes * 0.1));
        const timeB = Math.ceil(S.timeLeft) * 10;
        breakdown.push({ label: t('pb.bd.craft'), value: craft }, { label: t('pb.bd.time'), value: timeB });
        score += craft + timeB;
      }
      score = Math.max(0, score);
      const pct = Math.round((placedCount() / PARTS.length) * 100);
      api.finish({
        completed,
        score,
        time: completed ? S.completeTime : null,
        title: completed ? t('pb.resultWin') : t('pb.resultFail'),
        subtitle: completed
          ? null
          : `${t('pb.timeUp')} ${t('pb.built', {
              p: pct,
              list: PARTS.filter((p) => !S.placed[p.id])
                .map((p) => t('pb.part.' + p.id))
                .join(', '),
            })}`,
        breakdown,
        stats: { mistakes: S.mistakes, modern: S.modern, maxCombo: S.maxCombo, timeLeft: S.timeLeft },
        fact: { title: t('pb.factTitle'), text: t('pb.fact') },
      });
    }

    /* ----- 입력 처리 ----- */
    function onPress(x, y) {
      if (S.phase === 'admire') {
        advanceAdmire();
        return;
      }
      if (S.phase !== 'run') return;
      S.keyMode = false;
      // 부재 카드
      for (const p of PARTS) {
        if (inRect(x, y, cardRect(p.index)) && isReady(p)) {
          S.selected = p.id;
          S.drag = { part: p.id, x, y, sx: x, sy: y, moved: false };
          audio.play('click');
          return;
        }
      }
      // 재료 줄
      let hit = null;
      let bd = 40 * 40;
      S.items.forEach((it) => {
        const d = (it.x - x) * (it.x - x) + (BELT_Y - y) * (BELT_Y - y);
        if (d < bd) {
          bd = d;
          hit = it;
        }
      });
      if (hit) {
        collect(hit);
        return;
      }
      // 부재를 고른 뒤 건물의 자리를 탭
      if (S.selected && y < 450 && x < PANEL.x) tryPlace(S.selected, x, y);
    }
    function onRelease(x, y) {
      const d = S.drag;
      S.drag = null;
      if (!d || S.phase !== 'run') return;
      if (Math.hypot(x - d.sx, y - d.sy) < 14) return; // 탭 = 선택만
      tryPlace(d.part, x, y);
    }

    function keyboard() {
      const ready = PARTS.filter(isReady);
      if (input.consume('up')) {
        input.consume('jump'); // ↑/W 는 'jump' 로도 들어오므로 재료 잡기로 처리하지 않는다
        S.keyMode = true;
        if (ready.length) {
          const i = ready.findIndex((p) => p.id === S.selected);
          S.selected = ready[(i + 1) % ready.length].id;
          audio.play('click');
        }
      }
      const open = PARTS.filter((p) => !S.placed[p.id]);
      if (S.slotCursor >= open.length) S.slotCursor = 0;
      if (input.consume('left')) {
        S.keyMode = true;
        S.slotCursor = (S.slotCursor + open.length - 1) % open.length;
      }
      if (input.consume('right')) {
        S.keyMode = true;
        S.slotCursor = (S.slotCursor + 1) % open.length;
      }
      if (input.consume('down')) {
        S.keyMode = true;
        const target = open[S.slotCursor];
        if (S.selected && target) {
          const r = target.slots[0];
          tryPlace(S.selected, r[0] + r[2] / 2, r[1] + r[3] / 2);
        }
      }
    }

    /* ----- update ----- */
    function update(dt) {
      S.time += dt;
      if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 40);
      S.poseT -= dt;
      if (S.poseT <= 0) S.pose = 'idle';
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
        S.flyers[i].k += dt * 2.6;
        if (S.flyers[i].k >= 1) S.flyers.splice(i, 1);
      }

      // 포인터 누름/뗌
      if (pointer.presses !== S.pPress) {
        S.pPress = pointer.presses;
        onPress(pointer.pressX, pointer.pressY);
      }
      if (S.drag) {
        S.drag.x = pointer.x;
        S.drag.y = pointer.y;
      }
      if (pointer.releases !== S.pRel) {
        S.pRel = pointer.releases;
        onRelease(pointer.x, pointer.y);
      }

      if (S.phase === 'run') {
        S.elapsed += dt;
        S.timeLeft = Math.max(0, S.timeLeft - dt);
        const shown = Math.ceil(S.timeLeft);
        if (shown !== S.lastShownTime) {
          S.lastShownTime = shown;
          hud.setTime(S.timeLeft);
        }
        keyboard();
        if (input.consume('jump')) {
          S.keyMode = true;
          const it = grabZoneItem();
          if (it) collect(it);
        }
        input.consume('action');
        input.consume('tap');
        const sp = beltSpeed();
        S.beltOffset -= sp * dt;
        S.nextItem -= dt;
        if (S.nextItem <= 0) {
          S.nextItem = (95 + rand(0, 40)) / sp;
          spawnItem();
        }
        for (let i = S.items.length - 1; i >= 0; i--) {
          const it = S.items[i];
          it.x -= sp * dt;
          it.bob += dt;
          if (it.x < -50) S.items.splice(i, 1);
        }
        if (S.timeLeft <= 0) gameOver();
      } else if (S.phase === 'over') {
        S.overT += dt;
        if (S.overT > 1.9) finish(false);
      } else if (S.phase === 'celebrate') {
        S.celebrateT += dt;
        if (Math.random() < dt * 14) S.parts.push({ kind: 'conf', x: rand(0, W), y: -10, vx: rand(-40, 40), vy: rand(120, 220), life: 3, max: 3, size: rand(5, 9), color: ['#ff6b4a', '#ffd23f', '#7bc043', '#4cc3ff', '#ff7eb6'][Math.floor(rand(0, 5))], g: 30, rot: rand(0, 6) });
        if (S.celebrateT > 2.4) {
          S.phase = 'admire';
          S.admireT = 0;
          S.shown = 0;
          input.clear();
        }
      } else if (S.phase === 'admire') {
        S.admireT += dt;
        if (S.shown < PARTS.length && S.admireT > 0.15 + S.shown * 0.9) {
          S.shown += 1;
          audio.play('count');
        }
        // 화면 탭은 포인터(onPress)로 이미 처리하므로 'tap' 신호는 버린다 (한 번 탭에 두 번 넘어가지 않도록)
        input.consume('tap');
        if ([input.consume('jump'), input.consume('action')].some(Boolean)) advanceAdmire();
        if (S.shown >= PARTS.length && S.admireT > PARTS.length * 0.9 + 6) finish(true);
      }
    }

    function advanceAdmire() {
      if (S.shown < PARTS.length) {
        S.shown = PARTS.length;
        S.admireT = PARTS.length * 0.9 + 0.2;
      } else finish(true);
    }

    /* ----- render ----- */
    function render() {
      const c = api.beginFrame();
      c.save();
      if (S.shake > 0) c.translate(rand(-S.shake, S.shake), rand(-S.shake, S.shake) * 0.5);
      drawCourt(c, S.time);
      const admire = S.phase === 'admire' || (S.phase === 'done' && S.shown > 0);
      if (S.phase === 'celebrate' || admire) {
        c.save();
        c.translate(CX, 260);
        c.rotate(S.time * 0.4);
        c.fillStyle = 'rgba(255,236,150,.35)';
        for (let i = 0; i < 12; i++) {
          c.rotate((Math.PI * 2) / 12);
          c.beginPath();
          c.moveTo(0, 0);
          c.lineTo(-40, -460);
          c.lineTo(40, -460);
          c.closePath();
          c.fill();
        }
        c.restore();
      }
      drawHall(c, S.placed);
      if (S.phase === 'run' || S.phase === 'ready' || S.phase === 'over') renderSlots(c);
      drawCarpenter(c, 600, 452, S.phase === 'celebrate' ? 'cheer' : S.pose, S.time);
      if (admire) renderLabels(c);
      else {
        drawBelt(c, S.beltOffset);
        renderBelt(c);
        renderPanel(c);
        renderProgress(c);
      }
      S.flyers.forEach((f) => {
        const e = 1 - Math.pow(1 - f.k, 2);
        drawMat(c, f.type, f.x0 + (f.x1 - f.x0) * e, f.y0 + (f.y1 - f.y0) * e - Math.sin(f.k * Math.PI) * 60, 40 - f.k * 10);
      });
      if (S.drag && Math.hypot(S.drag.x - S.drag.sx, S.drag.y - S.drag.sy) >= 14) {
        const p = PART_BY_ID[S.drag.part];
        c.globalAlpha = 0.9;
        drawMat(c, p.mat, S.drag.x, S.drag.y, 64, Math.sin(S.time * 6) * 0.08);
        c.globalAlpha = 1;
      }
      renderParts(c);
      if (S.phase === 'celebrate') text(c, t('pb.complete'), CX, 50, 44, '#ffd23f', { lw: 10 });
      c.restore();
    }

    function renderSlots(c) {
      const sel = S.drag ? S.drag.part : S.selected;
      const open = PARTS.filter((p) => !S.placed[p.id]);
      if (sel) {
        const p = PART_BY_ID[sel];
        const hover = S.drag && inPartSlot(p, S.drag.x, S.drag.y);
        p.slots.forEach((r) => {
          c.save();
          c.strokeStyle = hover ? '#ffb000' : 'rgba(255,200,40,.85)';
          c.lineWidth = hover ? 6 : 4;
          c.setLineDash(hover ? [] : [10, 8]);
          c.lineDashOffset = -S.time * 30;
          rrect(c, r[0], r[1], r[2], r[3], 12);
          c.stroke();
          if (hover) {
            c.fillStyle = 'rgba(255,210,60,.18)';
            c.fill();
          }
          c.restore();
        });
      }
      if (S.keyMode && open.length) {
        const p = open[Math.min(S.slotCursor, open.length - 1)];
        const r = p.slots[0];
        const bx = r[0] + r[2] / 2;
        const by = r[1] - 6 + Math.sin(S.time * 6) * 4;
        c.save();
        c.fillStyle = '#3a6fd8';
        c.strokeStyle = OUT;
        c.lineWidth = 2.5;
        c.beginPath();
        c.moveTo(bx - 12, by - 18);
        c.lineTo(bx + 12, by - 18);
        c.lineTo(bx, by);
        c.closePath();
        c.fill();
        c.stroke();
        c.restore();
      }
    }

    function renderBelt(c) {
      c.save();
      c.strokeStyle = '#ffd23f';
      c.lineWidth = 4;
      c.setLineDash([8, 6]);
      rrect(c, GRAB.x, 462, GRAB.w, 64, 10);
      c.stroke();
      c.setLineDash([]);
      c.restore();
      text(c, t('pb.grab'), GRAB.x + GRAB.w / 2, 452, 12, '#ffd23f', { lw: 3 });
      S.items.forEach((it) => {
        const modern = MODERN.includes(it.type);
        c.fillStyle = modern ? 'rgba(255,255,255,.35)' : 'rgba(255,248,220,.6)';
        ell(c, it.x, BELT_Y, 30, 26);
        c.fill();
        drawMat(c, it.type, it.x, BELT_Y + Math.sin(it.bob * 4) * 2, 46);
      });
    }

    function renderPanel(c) {
      c.save();
      c.strokeStyle = OUT;
      c.lineWidth = 3;
      rrect(c, PANEL.x, PANEL.y, PANEL.w, PANEL.h, 16);
      fs(c, 'rgba(255,248,232,.94)');
      c.restore();
      text(c, t('pb.parts'), PANEL.x + 18, PANEL.y + 24, 20, OUT, { align: 'left', lw: 0 });
      PARTS.forEach((p) => {
        const r = cardRect(p.index);
        const ready = isReady(p);
        const placed = S.placed[p.id];
        const sel = S.selected === p.id;
        c.save();
        c.strokeStyle = sel ? '#3a6fd8' : ready ? '#ffb000' : 'rgba(46,42,58,.35)';
        c.lineWidth = sel ? 4 : ready ? 3.5 : 2;
        rrect(c, r[0], r[1], r[2], r[3], 12);
        c.fillStyle = placed ? '#e3f4d8' : ready ? `rgba(255,236,170,${0.75 + Math.sin(S.time * 6) * 0.2})` : '#ffffff';
        c.fill();
        c.stroke();
        c.restore();
        c.globalAlpha = placed ? 0.55 : 1;
        drawMat(c, p.mat, r[0] + 30, r[1] + 29, 40);
        c.globalAlpha = 1;
        c.save();
        c.font = `700 16px ${KK.ui.FONT}`;
        c.fillStyle = OUT;
        c.textBaseline = 'middle';
        c.fillText(t('pb.part.' + p.id), r[0] + 58, r[1] + 18);
        c.font = `600 12px ${KK.ui.FONT}`;
        c.fillStyle = '#6b5f78';
        const sub = placed ? '✓ ' + t('pb.placed') : ready ? t('pb.ready') : t('pb.ko.' + p.id);
        c.fillStyle = placed ? '#2c6b1a' : ready ? '#b06a00' : '#6b5f78';
        c.fillText(sub, r[0] + 58, r[1] + 40);
        c.restore();
        // 재료 칸
        for (let k = 0; k < p.need; k++) {
          const filled = placed || k < S.have[p.mat];
          const bx = r[0] + r[2] - 16 - (p.need - 1 - k) * 18;
          c.strokeStyle = OUT;
          c.lineWidth = 2;
          ell(c, bx, r[1] + 18, 7, 7);
          c.fillStyle = filled ? '#ffb000' : '#efe7da';
          c.fill();
          c.stroke();
        }
      });
    }

    function renderProgress(c) {
      const pct = Math.round((placedCount() / PARTS.length) * 100);
      c.save();
      c.strokeStyle = OUT;
      c.lineWidth = 3;
      rrect(c, 14, 12, 196, 30, 15);
      fs(c, 'rgba(255,255,255,.92)');
      if (pct > 0) {
        rrect(c, 17, 15, Math.max(24, 190 * (pct / 100)), 24, 12);
        c.fillStyle = '#2f9a7a';
        c.fill();
      }
      c.restore();
      text(c, t('pb.progress', { p: pct }), 112, 27, 15, '#ffffff', { lw: 4 });
    }

    function renderLabels(c) {
      text(c, t('pb.admire'), CX, 40, 30, '#ffffff');
      const bx = 636;
      const bw = 312;
      const top = 14;
      const bh = 82;
      for (let i = 0; i < S.shown; i++) {
        const p = PARTS[i];
        // 건물처럼 위쪽 부재(지붕)가 위에 오도록 거꾸로 쌓는다 → 선이 엇갈리지 않음
        const y = top + (PARTS.length - 1 - i) * (bh + 6);
        c.save();
        c.strokeStyle = '#ffffff';
        c.lineWidth = 2;
        c.setLineDash([4, 4]);
        c.beginPath();
        c.moveTo(p.anchor[0], p.anchor[1]);
        c.lineTo(bx, y + bh / 2);
        c.stroke();
        c.setLineDash([]);
        c.fillStyle = '#ffd23f';
        c.strokeStyle = OUT;
        ell(c, p.anchor[0], p.anchor[1], 6, 6);
        c.fill();
        c.stroke();
        c.lineWidth = 3;
        rrect(c, bx, y, bw, bh, 12);
        fs(c, 'rgba(255,248,232,.97)');
        c.font = `700 16px ${KK.ui.FONT}`;
        c.fillStyle = '#b8332a';
        c.textBaseline = 'top';
        c.fillText(`${t('pb.part.' + p.id)} · ${t('pb.ko.' + p.id)}`, bx + 12, y + 8);
        c.font = `500 13px ${KK.ui.FONT}`;
        c.fillStyle = OUT;
        wrapLines(c, t('pb.desc.' + p.id), bw - 24)
          .slice(0, 3)
          .forEach((ln, k) => c.fillText(ln, bx + 12, y + 30 + k * 16));
        c.restore();
      }
      if (S.shown >= PARTS.length) text(c, t('pb.tapContinue'), CX, 520, 20, '#ffd23f', { lw: 5 });
    }

    function renderParts(c) {
      S.parts.forEach((p) => {
        c.globalAlpha = Math.max(0, Math.min(1, p.life / (p.max * 0.5)));
        if (p.kind === 'text') text(c, p.str, p.x, p.y, p.size, p.color, { lw: p.size * 0.25 });
        else if (p.kind === 'conf') {
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
        S.pPress = pointer.presses;
        S.pRel = pointer.releases;
        loop.start();
      },
      pause() {
        loop.stop();
        S.drag = null;
        render();
      },
      resume() {
        if (S.phase !== 'done') {
          S.pPress = pointer.presses;
          S.pRel = pointer.releases;
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
        spawnItem,
        give(mat, n) {
          for (let i = 0; i < (n || 1); i++) collect({ type: mat, x: 300 });
        },
        slotCenter(id) {
          const r = PART_BY_ID[id].slots[0];
          return [r[0] + r[2] / 2, r[1] + r[3] / 2];
        },
        cardCenter(id) {
          const r = cardRect(PART_BY_ID[id].index);
          return [r[0] + r[2] / 2, r[1] + r[3] / 2];
        },
        BELT_Y,
      },
    };
  }

  const iconCache = {};
  function iconURL(type) {
    if (!iconCache[type]) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 96;
      const c = cv.getContext('2d');
      if (type === 'hall') {
        c.save();
        c.translate(48, 50);
        c.scale(0.16, 0.16);
        c.translate(-CX, -270);
        drawHall(c, { platform: 1, pillars: 1, brackets: 1, dancheong: 1, roof: 1, japsang: 1 });
        c.restore();
      } else drawMat(c, type, 48, 50, 80);
      iconCache[type] = cv.toDataURL();
    }
    return iconCache[type];
  }

  KK.games.register({
    id: 'palace-builder',
    width: W,
    height: H,
    create,
    intro(t) {
      return {
        goal: t('pb.goal'),
        items: PARTS.map((p) => ({ icon: iconURL(p.mat), label: t('pb.part.' + p.id), sub: `${t('pb.ko.' + p.id)} · ${t('pb.mat.' + p.mat)} ×${p.need}` })),
        controls: [t('pb.ctrlTouch'), t('pb.ctrlKeys'), t('pb.avoid')],
      };
    },
    badges: [
      { id: 'pb_first', icon: () => iconURL('hall'), test: (r) => r.completed },
      { id: 'pb_master', icon: () => iconURL('bracket'), test: (r) => r.completed && r.stats.mistakes === 0 },
      { id: 'pb_combo', icon: () => iconURL('stone'), test: (r) => r.stats.maxCombo >= 8 },
      { id: 'pb_fast', icon: () => iconURL('tile'), test: (r) => r.completed && r.stats.timeLeft >= 30 },
      { id: 'pb_tradition', icon: () => iconURL('paint'), test: (r) => r.completed && r.stats.modern === 0 },
    ],
  });
})(window.KK);
