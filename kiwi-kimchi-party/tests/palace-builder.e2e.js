/* Palace Builder 브라우저 자동 테스트 (Playwright)
 * 실행: node tests/palace-builder.e2e.js
 * 실제 마우스 클릭/끌기, 키보드, 휴대폰 터치로 재료를 모으고 부재를 배치해 본다. */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const SHOTS = process.env.SHOTS || path.resolve(__dirname, 'screenshots');
let failures = 0;
let passes = 0;

function check(name, cond, extra) {
  if (cond) {
    passes++;
    console.log('  ✓ ' + name);
  } else {
    failures++;
    console.log('  ✗ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : ''));
  }
}
const wait = (page, ms) => page.waitForTimeout(ms);
const S = (page) =>
  page.evaluate(() => {
    const s = KK.games.session.instance.debug.state;
    return {
      phase: s.phase, timeLeft: s.timeLeft, have: { ...s.have }, placed: { ...s.placed }, items: s.items.length,
      score: Math.max(0, s.matPts + s.comboPts + s.partPts - s.penalty), matPts: s.matPts, comboPts: s.comboPts, partPts: s.partPts,
      penalty: s.penalty, mistakes: s.mistakes, combo: s.combo, selected: s.selected, shown: s.shown, drag: !!s.drag,
    };
  });
// 게임 좌표 → 화면 좌표
async function toPage(page, gx, gy) {
  const r = await page.$eval('.game-canvas', (c) => { const b = c.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
  return { x: r.x + (gx / 960) * r.w, y: r.y + (gy / 540) * r.h };
}
const dbg = (page, fn, arg) => page.evaluate(([fn, arg]) => new Function('d', 'arg', fn)(KK.games.session.instance.debug, arg), [fn, arg]);
// 재료 줄을 멈추고 비운 뒤 원하는 재료 하나만 놓는다
async function placeOnBelt(page, type, x) {
  await dbg(page, 'd.state.items = []; d.state.nextItem = 999; d.spawnItem(arg[0], arg[1]);', [type, x]);
}
async function clickGame(page, gx, gy) {
  const p = await toPage(page, gx, gy);
  await page.mouse.click(p.x, p.y);
}
async function dragPart(page, partId, gx, gy) {
  const from = await dbg(page, 'return d.cardCenter(arg);', partId);
  const a = await toPage(page, from[0], from[1]);
  const b = await toPage(page, gx, gy);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(a.x + ((b.x - a.x) * i) / 8, a.y + ((b.y - a.y) * i) / 8);
    await page.waitForTimeout(20);
  }
  await page.mouse.up();
  await page.waitForTimeout(80);
}
const slot = (page, id) => dbg(page, 'return d.slotCenter(arg);', id);

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text()) && errors.push(m.text()));

  console.log('\n[메뉴 → Palace Builder]');
  await page.goto(URL);
  await page.waitForSelector('.game-card');
  check('Palace Builder 카드에 PLAY 버튼', !!(await page.$('[data-game="palace-builder"] .btn-play')));
  await page.click('[data-game="palace-builder"] .btn-play');
  await page.waitForSelector('.intro-panel');
  const intro = await page.textContent('.intro-panel');
  check('소개: 부재 6종', ['Stone platform', 'Wooden pillars', 'Bracket sets', 'Dancheong paint', 'Tiled roof', 'Roof guardians'].every((w) => intro.includes(w)));
  await page.click('.intro-panel .btn-primary');
  await page.waitForFunction(() => KK.games.session.state === 'playing', null, { timeout: 5000 });
  await wait(page, 1500);
  let s = await S(page);
  check('게임 시작, 재료 줄에 재료가 나옴', s.phase === 'run' && s.items > 0, s);
  const x0 = await dbg(page, 'return d.state.items[0].x;');
  await wait(page, 300);
  const x1 = await dbg(page, 'return d.state.items.length ? d.state.items[0].x : -1;');
  check('재료 줄이 왼쪽으로 움직임', x1 < x0, { x0, x1 });
  await page.screenshot({ path: path.join(SHOTS, 'pb-run.png') });

  console.log('\n[재료 모으기]');
  await placeOnBelt(page, 'stone', 420);
  let ix = await dbg(page, 'return d.state.items[0].x;');
  await clickGame(page, ix, 494);
  await wait(page, 60);
  s = await S(page);
  check('마우스 클릭으로 화강암 모으기', s.have.stone === 1 && s.matPts === 40, s);
  await placeOnBelt(page, 'glass', 420);
  ix = await dbg(page, 'return d.state.items[0].x;');
  await clickGame(page, ix, 494);
  await wait(page, 60);
  s = await S(page);
  check('현대 재료(유리) → 실수, −25', s.mistakes === 1 && s.penalty === 25 && s.combo === 0, s);
  await placeOnBelt(page, 'stone', 125);
  await page.keyboard.press('Space');
  await wait(page, 60);
  s = await S(page);
  check('Space 로 노란 상자 안 재료 잡기', s.have.stone === 2, s.have);
  await placeOnBelt(page, 'stone', 125);
  await page.keyboard.press('ArrowUp');
  await wait(page, 60);
  check('↑ 키는 재료를 잡지 않음', (await S(page)).items === 1);
  await page.keyboard.press('Space');
  await wait(page, 60);
  s = await S(page);
  check('콤보 보너스 (2번째 +10)', s.have.stone === 3 && s.comboPts === 10, s);
  check('기단 준비 완료 → 자동 선택', s.selected === 'platform', s.selected);
  await placeOnBelt(page, 'stone', 420);
  ix = await dbg(page, 'return d.state.items[0].x;');
  await clickGame(page, ix, 494);
  await wait(page, 60);
  s = await S(page);
  check('이미 충분한 재료는 점수 없음', s.have.stone === 3 && s.matPts === 120, s);

  console.log('\n[배치 규칙]');
  await dbg(page, 'd.state.items = []; d.state.nextItem = 999; d.give("log", 3);');
  let p = await slot(page, 'pillars');
  await dragPart(page, 'pillars', p[0], p[1]);
  s = await S(page);
  check('기단 전에 기둥 → "아래부터" 실수', !s.placed.pillars && s.mistakes === 2, s);
  p = await slot(page, 'roof');
  await dragPart(page, 'platform', p[0], p[1] - 20);
  s = await S(page);
  check('기단을 지붕 자리에 → 틀린 자리 실수', !s.placed.platform && s.mistakes === 3, s);
  await dragPart(page, 'platform', 330, 50);
  s = await S(page);
  check('빈 곳에 놓으면 그냥 취소 (감점 없음)', !s.placed.platform && s.mistakes === 3, s);
  p = await slot(page, 'platform');
  await dragPart(page, 'platform', p[0], p[1]);
  s = await S(page);
  check('끌어다 놓기: 기단 배치', s.placed.platform && s.partPts === 150, s);
  const c1 = await dbg(page, 'return d.cardCenter("pillars");');
  await clickGame(page, c1[0], c1[1]);
  await wait(page, 60);
  p = await slot(page, 'pillars');
  await clickGame(page, p[0], p[1]);
  await wait(page, 60);
  s = await S(page);
  check('탭-탭 배치: 기둥', s.placed.pillars, s);

  console.log('\n[키보드 배치]');
  await dbg(page, 'd.give("bracket", 2);');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowDown');
  await wait(page, 60);
  s = await S(page);
  check('↑ 선택, ← → 자리, ↓ 놓기: 공포', s.placed.brackets, s);

  console.log('\n[타이머 / 일시정지]');
  let t0 = (await S(page)).timeLeft;
  await wait(page, 1000);
  let t1 = (await S(page)).timeLeft;
  check('타이머 1초 ≈ 1초', t0 - t1 > 0.8 && t0 - t1 < 1.25, t0 - t1);
  await page.keyboard.press('KeyP');
  t0 = (await S(page)).timeLeft;
  await wait(page, 600);
  check('일시정지 중 시간 멈춤', (await S(page)).timeLeft === t0);
  await page.click('.pause-panel .btn-primary');
  await wait(page, 200);

  console.log('\n[완성 → 건축 요소 설명]');
  await dbg(page, 'd.state.items = []; d.state.nextItem = 999; d.give("paint", 2); d.give("tile", 3); d.give("figure", 2);');
  for (const id of ['dancheong', 'roof', 'japsang']) {
    p = await slot(page, id);
    await dragPart(page, id, p[0], p[1]);
  }
  s = await S(page);
  check('6개 부재 모두 배치 → 축하', s.phase === 'celebrate', s);
  await wait(page, 800);
  await page.screenshot({ path: path.join(SHOTS, 'pb-complete.png') });
  await page.waitForFunction(() => KK.games.session.instance.debug.state.phase === 'admire', null, { timeout: 5000 });
  await wait(page, 2000);
  s = await S(page);
  check('건축 요소 설명이 하나씩 나타남', s.shown >= 2 && s.shown < 6, s.shown);
  await clickGame(page, 330, 300);
  await wait(page, 200);
  s = await S(page);
  check('탭 한 번 → 설명 6개 모두 표시 (결과로 건너뛰지 않음)', s.shown === 6 && s.phase === 'admire', s);
  await page.screenshot({ path: path.join(SHOTS, 'pb-admire.png') });
  await clickGame(page, 330, 300);
  await page.waitForSelector('.result-panel.win', { timeout: 5000 });
  await wait(page, 1200);
  await page.screenshot({ path: path.join(SHOTS, 'pb-result.png') });
  check('결과: Palace hall complete!', (await page.textContent('.result-ribbon')) === 'Palace hall complete!');
  const bd = await page.textContent('.breakdown');
  check('점수 내역에 실수 감점(−75)과 솜씨 보너스', bd.includes('−75') && bd.includes('Craftsmanship'), bd);
  check('경복궁 설명', (await page.textContent('.fact-card')).includes('1395'));
  check('배지 획득 (첫 궁궐)', (await page.textContent('.result-badges')).includes('First Palace Hall'));
  const st = await page.evaluate(() => KK.save.gameStats('palace-builder'));
  check('기록 저장', st.completions === 1 && st.best > 0, st);

  console.log('\n[다시 하기 / 시간 종료]');
  await page.click('.result-panel .btn-primary');
  await page.waitForFunction(() => KK.games.session.state === 'playing', null, { timeout: 5000 });
  s = await S(page);
  check('다시 하기 → 초기화', s.score === 0 && s.mistakes === 0 && !s.placed.platform && s.have.stone === 0 && s.timeLeft > 89, s);
  t0 = s.timeLeft;
  await wait(page, 1000);
  t1 = (await S(page)).timeLeft;
  check('다시 하기 후 타이머 정상 속도', t0 - t1 > 0.8 && t0 - t1 < 1.25, t0 - t1);
  await dbg(page, 'd.give("stone", 3);');
  p = await slot(page, 'platform');
  await dragPart(page, 'platform', p[0], p[1]);
  await dbg(page, 'd.state.timeLeft = 0.3;');
  await page.waitForSelector('.result-panel.lose', { timeout: 5000 });
  const sub = await page.textContent('.result-sub');
  check('시간 종료: 진행도와 남은 부재 안내', sub.includes('17%') && sub.includes('Wooden pillars'), sub);
  await page.click('.result-panel .btn-ghost');
  await page.waitForSelector('.menu-screen');
  check('메인 메뉴로 돌아옴', !(await page.$('.game-screen')));
  check('진행도에 Palace Builder 완료 반영', (await page.textContent('.progress-meta')).includes('1/4'));
  check('PC 오류 없음', errors.length === 0, errors);
  await ctx.close();

  console.log('\n[휴대폰 / 태블릿 터치]');
  for (const vp of [
    { name: 'phone-portrait', width: 390, height: 844 },
    { name: 'phone-landscape', width: 844, height: 390 },
    { name: 'tablet', width: 820, height: 1180 },
  ]) {
    const mctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const mp = await mctx.newPage();
    const merr = [];
    mp.on('pageerror', (e) => merr.push(String(e)));
    await mp.addInitScript(() => localStorage.setItem('kkparty.save.v1', JSON.stringify({ lang: 'ko', sound: true, games: {}, badges: {} })));
    await mp.goto(URL + '#/play/palace-builder');
    await mp.waitForSelector('.intro-panel');
    await mp.tap('.intro-panel .btn-primary');
    await mp.waitForFunction(() => KK.games.session.state === 'playing', null, { timeout: 5000 });
    await placeOnBelt(mp, 'stone', 400);
    const bx = await dbg(mp, 'return d.state.items[0].x;');
    const tp = await toPage(mp, bx, 494);
    await mp.touchscreen.tap(tp.x, tp.y);
    await mp.waitForTimeout(80);
    check(`${vp.name}: 터치로 재료 모으기`, (await S(mp)).have.stone === 1);
    await dbg(mp, 'd.state.items = []; d.give("stone", 2);');
    const from = await toPage(mp, ...(await dbg(mp, 'return d.cardCenter("platform");')));
    const to = await toPage(mp, ...(await slot(mp, 'platform')));
    const cdp = await mctx.newCDPSession(mp);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
    for (let i = 1; i <= 8; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + ((to.x - from.x) * i) / 8, y: from.y + ((to.y - from.y) * i) / 8 }] });
      await mp.waitForTimeout(25);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await mp.waitForTimeout(100);
    check(`${vp.name}: 손가락으로 끌어 기단 배치`, (await S(mp)).placed.platform);
    const inView = await mp.evaluate(() => {
      const b = document.querySelector('.game-canvas').getBoundingClientRect();
      return b.left >= -1 && b.top >= -1 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1;
    });
    check(`${vp.name}: 캔버스가 화면 안`, inView);
    await mp.evaluate(() => KK.games.session.instance.debug.state.nextItem = 0);
    await mp.waitForTimeout(1500);
    await mp.screenshot({ path: path.join(SHOTS, `pb-${vp.name}.png`) });
    check(`${vp.name}: 오류 없음`, merr.length === 0, merr);
    await mctx.close();
  }

  await browser.close();
  console.log(`\n결과: ${passes} 통과, ${failures} 실패`);
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
