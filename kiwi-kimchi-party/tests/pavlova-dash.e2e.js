/* Pavlova Dash 브라우저 자동 테스트 (Playwright)
 * 실행: node tests/pavlova-dash.e2e.js */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const SHOTS = process.env.SHOTS || path.resolve(__dirname, 'screenshots');
const PLATE_Y = 394;
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
      phase: s.phase, step: s.step, timeLeft: s.timeLeft, hearts: s.hearts, have: { ...s.have }, x: s.player.x,
      score: Math.max(0, s.ingPts + s.streakPts - s.penalty), ingPts: s.ingPts, streakPts: s.streakPts, penalty: s.penalty,
      streak: s.streak, mult: s.mult, soggy: s.soggy, items: s.items.length, topIdx: s.topIdx, perfects: s.perfects, decoPts: s.decoPts,
    };
  });
// 쟁반 바로 위에서 떨어뜨려 받게 한다 (구름/다른 아이템은 치운다)
const drop = (page, type, dx) =>
  page.evaluate(
    ([type, dx, py]) => {
      const d = KK.games.session.instance.debug;
      d.state.items = [];
      d.state.cloud.active = false;
      d.state.cloud.next = 999;
      d.state.nextItem = 999;
      d.state.nextHeart = 999;
      d.spawn(type, d.state.player.x + (dx || 0), py - 40, 500);
    },
    [type, dx || 0, PLATE_Y]
  );

async function startGame(page) {
  await page.goto(URL + '#/play/pavlova-dash');
  await page.waitForSelector('.intro-panel');
  await page.click('.intro-panel .btn-primary');
  await page.waitForFunction(() => KK.games.session && KK.games.session.state === 'playing', null, { timeout: 5000 });
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text()) && errors.push(m.text()));

  console.log('\n[메뉴 → Pavlova Dash]');
  await page.goto(URL);
  await page.waitForSelector('.game-card');
  check('Pavlova Dash 카드에 PLAY 버튼', !!(await page.$('[data-game="pavlova-dash"] .btn-play')));
  await page.click('[data-game="pavlova-dash"] .btn-play');
  await page.waitForSelector('.intro-panel');
  const intro = await page.textContent('.intro-panel');
  check('소개 화면에 재료 5종', ['Meringue', 'Whipped cream', 'Kiwifruit', 'Strawberry', 'Passionfruit'].every((w) => intro.includes(w)));
  await page.screenshot({ path: path.join(SHOTS, 'pd-intro.png') });
  await page.click('.intro-panel .btn-primary');
  await page.waitForFunction(() => KK.games.session.state === 'playing', null, { timeout: 5000 });
  let s = await S(page);
  check('게임 시작', s.phase === 'run');

  console.log('\n[쟁반 이동]');
  const x0 = s.x;
  await page.keyboard.down('ArrowRight');
  await wait(page, 300);
  await page.keyboard.up('ArrowRight');
  s = await S(page);
  check('→ 키로 오른쪽 이동', s.x > x0 + 80, { x0, x: s.x });
  const x1 = s.x;
  await page.keyboard.down('KeyA');
  await wait(page, 300);
  await page.keyboard.up('KeyA');
  s = await S(page);
  check('A 키로 왼쪽 이동', s.x < x1 - 80, { x1, x: s.x });
  const box = await page.$eval('.game-canvas', (c) => { const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await page.mouse.move(box.x + box.w * 0.2, box.y + box.h * 0.5);
  await wait(page, 600);
  s = await S(page);
  check('마우스를 따라 쟁반 이동', Math.abs(s.x - 960 * 0.2) < 6, s.x);

  console.log('\n[받기 / 점수 / 연속 보너스]');
  await drop(page, 'meringue');
  await wait(page, 150);
  s = await S(page);
  check('머랭 받기 → 1/3', s.have.meringue === 1, s.have);
  check('점수 100', s.score === 100, s.score);
  check('HUD 재료 표시', (await page.textContent('.track-chip[data-id="meringue"] .track-count')) === '1/3');
  for (const ty of ['cream', 'kiwi', 'strawberry', 'cream']) {
    await drop(page, ty);
    await wait(page, 150);
  }
  s = await S(page);
  check('5개 연속 → 달콤 연속 ×1.5', s.streak === 5 && s.mult === 1.5, s);
  await drop(page, 'kiwi');
  await wait(page, 150);
  s = await S(page);
  check('×1.5 보너스 점수 (5번째 +40, 6번째 +45)', s.streakPts === 85, s.streakPts);

  console.log('\n[방해 요소]');
  await drop(page, 'burnt');
  await wait(page, 150);
  s = await S(page);
  check('탄 머랭 → −50, 연속 끊김', s.penalty === 50 && s.streak === 0 && s.mult === 1, s);
  await drop(page, 'rain');
  await wait(page, 150);
  s = await S(page);
  check('빗방울 → 하트 2', s.hearts === 2 && s.soggy === 1, s);
  check('HUD 하트 2개', (await page.$$('.hud-hearts .ico.full')).length === 2);
  await drop(page, 'heart');
  await wait(page, 150);
  check('하트 받기 → 회복', (await S(page)).hearts === 3);
  await drop(page, 'strawberry');
  await wait(page, 150);
  await drop(page, 'passion', 300);
  await page.waitForFunction(() => KK.games.session.instance.debug.state.items.length === 0, null, { timeout: 4000 });
  s = await S(page);
  check('필요한 재료를 놓치면 연속 끊김', s.streak === 0 && s.have.passion === 0, s);

  console.log('\n[타이머 / 일시정지 / 다시 하기]');
  let t0 = (await S(page)).timeLeft;
  await wait(page, 1000);
  let t1 = (await S(page)).timeLeft;
  check('타이머 1초 ≈ 1초', t0 - t1 > 0.8 && t0 - t1 < 1.25, t0 - t1);
  await page.keyboard.press('Escape');
  t0 = (await S(page)).timeLeft;
  await wait(page, 600);
  check('일시정지 중 시간 멈춤', (await S(page)).timeLeft === t0);
  await page.click('.pause-panel .btn-secondary');
  await page.waitForFunction(() => KK.games.session.state === 'playing', null, { timeout: 5000 });
  s = await S(page);
  check('다시 하기 → 초기화', s.score === 0 && s.hearts === 3 && s.have.meringue === 0 && s.penalty === 0 && s.timeLeft > 59, s);
  t0 = s.timeLeft;
  await wait(page, 1000);
  t1 = (await S(page)).timeLeft;
  check('다시 하기 후 타이머 정상 속도', t0 - t1 > 0.8 && t0 - t1 < 1.25, t0 - t1);

  console.log('\n[파블로바 완성]');
  const need = { meringue: 3, cream: 3, kiwi: 3, strawberry: 3, passion: 2 };
  for (const [ty, n] of Object.entries(need)) {
    for (let i = 0; i < n; i++) {
      await drop(page, ty);
      await wait(page, 120);
    }
  }
  s = await S(page);
  check('재료 모두 모음 → outro', s.phase === 'outro', s.phase);
  await page.screenshot({ path: path.join(SHOTS, 'pd-outro.png') });
  await page.waitForFunction(() => KK.games.session.instance.debug.state.step === 'top', null, { timeout: 8000 });
  check('테이블: 받침 → 크림 → 토핑 단계', true);
  for (let i = 0; i < 5; i++) {
    await page.waitForFunction(
      (i) => {
        const d = KK.games.session.instance.debug;
        const s = d.state;
        return s.topIdx === i && !s.falling && s.waitNext <= 0 && Math.abs(d.swingX() - d.targetX(i)) < 5;
      },
      i,
      { timeout: 8000, polling: 'raf' }
    );
    if (i === 2) await page.screenshot({ path: path.join(SHOTS, 'pd-decorate.png') });
    await page.keyboard.press('Space');
    await page.waitForFunction((i) => KK.games.session.instance.debug.state.topIdx === i + 1, i, { timeout: 4000 });
  }
  s = await S(page);
  check('토핑 5개 올림', s.topIdx === 5, s.topIdx);
  check('타이밍 맞추면 Perfect (4개 이상)', s.perfects >= 4, s.perfects);
  await page.waitForFunction(() => KK.games.session.instance.debug.state.step === 'done', null, { timeout: 4000 });
  await wait(page, 700);
  await page.screenshot({ path: path.join(SHOTS, 'pd-complete.png') });
  await page.waitForSelector('.result-panel.win', { timeout: 8000 });
  await wait(page, 1200);
  await page.screenshot({ path: path.join(SHOTS, 'pd-result.png') });
  check('결과: Pavlova complete!', (await page.textContent('.result-ribbon')) === 'Pavlova complete!');
  check('점수 내역 5줄', (await page.$$('.breakdown li')).length === 5);
  check('파블로바 문화 설명', (await page.textContent('.fact-card')).includes('Anna Pavlova'));
  check('배지 획득', (await page.$$('.result-badges .badge')).length >= 1);
  const st = await page.evaluate(() => KK.save.gameStats('pavlova-dash'));
  check('기록 저장', st.completions === 1 && st.best > 0, st);

  console.log('\n[게임 오버 / 시간 종료]');
  await page.click('.result-panel .btn-primary');
  await page.waitForFunction(() => KK.games.session.state === 'playing', null, { timeout: 5000 });
  await drop(page, 'burnt');
  await wait(page, 150);
  for (let i = 0; i < 3; i++) {
    await drop(page, 'rain');
    await wait(page, 150);
  }
  check('빗방울 3번 → over', (await S(page)).phase === 'over');
  await page.waitForSelector('.result-panel.lose', { timeout: 5000 });
  check('실패 결과 화면', (await page.textContent('.result-ribbon')) === 'No pavlova this time');
  check('감점 줄은 −로 표시', (await page.textContent('.breakdown')).includes('−50'));
  check('점수는 0 미만으로 내려가지 않음', (await page.textContent('.result-score')) === '0');
  await page.click('.result-panel .btn-primary');
  await page.waitForFunction(() => KK.games.session.state === 'playing', null, { timeout: 5000 });
  await page.evaluate(() => (KK.games.session.instance.debug.state.timeLeft = 0.3));
  await page.waitForSelector('.result-panel.lose', { timeout: 5000 });
  check('시간 종료 결과', (await page.textContent('.result-sub')).includes("Time's up"));
  await page.click('.result-panel .btn-ghost');
  await page.waitForSelector('.menu-screen');
  check('메인 메뉴로 돌아옴', !(await page.$('.game-screen')));
  check('메뉴에 최고 기록 표시', (await page.textContent('[data-game="pavlova-dash"] .card-best')).startsWith('Best'));
  await page.goto(URL + '#/records');
  await page.waitForSelector('.records-screen');
  check('기록 화면에 Pavlova 배지 5개', (await page.$$('[data-game="pavlova-dash"] .badge')).length === 5);
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
    await startGame(mp);
    const cv = await mp.$eval('.game-canvas', (c) => { const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    const cdp = await mctx.newCDPSession(mp);
    // 캔버스 아래 빈 곳(세로 화면) 또는 캔버스 위에서 손가락으로 끌기
    const dragY = vp.name === 'phone-portrait' ? cv.y + cv.h + 120 : cv.y + cv.h * 0.5;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cv.x + cv.w * 0.5, y: dragY }] });
    for (let k = 1; k <= 8; k++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cv.x + cv.w * (0.5 - k * 0.04), y: dragY }] });
      await mp.waitForTimeout(30);
    }
    await mp.waitForTimeout(400);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const tx = (await S(mp)).x;
    check(`${vp.name}: 손가락으로 끌어 쟁반 이동`, Math.abs(tx - 960 * 0.18) < 8, tx);
    check(`${vp.name}: ◀ ▶ 버튼 표시`, await mp.isVisible('.ctrl-btn[data-ctrl="left"]'));
    const layout = await mp.evaluate(() => {
      const inView = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return b.left >= -1 && b.top >= -1 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1; };
      return inView('.game-canvas') && inView('.hud') && inView('.ctrl-btn[data-ctrl="right"]');
    });
    check(`${vp.name}: 화면 배치 정상`, layout);
    await drop(mp, 'kiwi');
    await mp.waitForTimeout(150);
    check(`${vp.name}: 한국어로 재료 표시`, (await mp.getAttribute('.track-chip[data-id="kiwi"]', 'title')) === '키위');
    await mp.evaluate(() => KK.games.session.instance.debug.spawn('strawberry', 600, 120, 120));
    await mp.waitForTimeout(400);
    await mp.screenshot({ path: path.join(SHOTS, `pd-${vp.name}.png`) });
    // 장식 단계: 놓기 버튼
    await mp.evaluate(() => {
      const d = KK.games.session.instance.debug;
      Object.assign(d.state.have, { meringue: 3, cream: 3, kiwi: 3, strawberry: 3, passion: 1 });
      d.state.items = [];
      d.state.nextItem = 999;
      d.state.cloud.active = false;
      d.state.cloud.next = 999;
    });
    await drop(mp, 'passion');
    await mp.waitForFunction(() => KK.games.session.instance.debug.state.step === 'top', null, { timeout: 8000 });
    check(`${vp.name}: 장식 단계 놓기 버튼`, await mp.isVisible('.ctrl-btn[data-ctrl="drop"]'));
    await mp.tap('.ctrl-btn[data-ctrl="drop"]');
    await mp.waitForFunction(() => KK.games.session.instance.debug.state.topIdx === 1, null, { timeout: 4000 });
    check(`${vp.name}: 놓기 버튼으로 토핑 놓기`, true);
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
