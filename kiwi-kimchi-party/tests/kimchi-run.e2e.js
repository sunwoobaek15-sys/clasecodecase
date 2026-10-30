/* 브라우저 자동 테스트 (Playwright)
 * 실행: node tests/kimchi-run.e2e.js
 * 실제 브라우저(Chromium)로 index.html 을 열어 메뉴와 Kimchi Run 을 끝까지 플레이해 본다. */
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

const S = (page) => page.evaluate(() => {
  const s = KK.games.session.instance.debug.state;
  return {
    phase: s.phase, step: s.step, timeLeft: s.timeLeft, hearts: s.hearts, have: { ...s.have },
    score: s.ingPts + s.comboPts, combo: s.combo, x: s.player.x, y: s.player.y, jumps: s.player.jumps,
    mixP: s.mixP, obstacles: s.obstacles.length, items: s.items.length,
  };
});
const wait = (page, ms) => page.waitForTimeout(ms);

async function startGame(page) {
  await page.goto(URL + '#/play/kimchi-run');
  await page.waitForSelector('.intro-panel');
  await page.click('.intro-panel .btn-primary');
  await page.waitForFunction(() => KK.games.session && KK.games.session.state === 'playing', null, { timeout: 5000 });
}
// 플레이어 위치에 아이템/장애물을 놓는다
const giveItem = (page, type) => page.evaluate((type) => {
  const d = KK.games.session.instance.debug;
  d.spawnItem(type, d.state.player.x, d.state.player.y - 40);
}, type);
const placeObstacle = (page) => page.evaluate(() => {
  const d = KK.games.session.instance.debug;
  d.state.player.inv = 0;
  d.spawnObstacle('crate', d.state.player.x - 20);
});

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text()) && errors.push(m.text()));

  console.log('\n[메인 메뉴]');
  await page.goto(URL);
  await page.waitForSelector('.game-card');
  check('게임 카드 4개', (await page.$$('.game-card')).length === 4);
  const names = await page.$$eval('.game-card h3', (n) => n.map((x) => x.textContent));
  check('카드 이름 순서', JSON.stringify(names) === JSON.stringify(['Kimchi Run', 'Pavlova Dash', 'Palace Builder', 'Kiwi Forest Rescue']), names);
  check('Culture Match 없음', !(await page.content()).toLowerCase().includes('culture match'));
  check('4개 게임 모두 PLAY 버튼', (await page.$$('.btn-play')).length === 4);
  check('"Coming soon" 없음', (await page.$$('.soon-pill')).length === 0);

  await page.click('.topbar .btn:nth-child(1)');
  check('언어 → 한국어', (await page.textContent('.game-card h3')) === '김치 런');
  await page.reload();
  await page.waitForSelector('.game-card');
  check('언어 설정 저장 (새로고침 후 유지)', (await page.textContent('.game-card h3')) === '김치 런');
  await page.click('.topbar .btn:nth-child(1)');
  check('언어 → 영어', (await page.textContent('.game-card h3')) === 'Kimchi Run');

  await page.click('.topbar .btn:nth-child(2)');
  check('소리 끄기', (await page.textContent('.topbar .btn:nth-child(2)')).includes('Off'));
  await page.click('.topbar .btn:nth-child(2)');
  check('소리 켜기', (await page.textContent('.topbar .btn:nth-child(2)')).includes('On'));

  await page.click('.topbar .btn:nth-child(3)');
  await page.waitForSelector('.records-screen');
  check('기록 화면 열림', (await page.$$('.rec-card')).length === 4);
  await page.click('.records-top .btn');
  await page.waitForSelector('.menu-screen');
  check('기록 화면 → 메뉴로 돌아옴', true);

  console.log('\n[Kimchi Run: 시작/이동/점프]');
  await page.click('[data-game="kimchi-run"] .btn-play');
  await page.waitForSelector('.intro-panel');
  check('게임 소개 화면', (await page.textContent('.intro-panel')).includes('Napa cabbage'));
  await page.click('.intro-panel .btn-primary');
  check('카운트다운 중에는 시작 전', (await page.evaluate(() => KK.games.session.state)) === 'countdown');
  await page.waitForFunction(() => KK.games.session.state === 'playing', null, { timeout: 5000 });
  let s = await S(page);
  check('게임 시작 (run 단계)', s.phase === 'run');
  const x0 = s.x;
  await page.keyboard.down('ArrowRight');
  await wait(page, 400);
  await page.keyboard.up('ArrowRight');
  s = await S(page);
  check('오른쪽 이동', s.x > x0 + 50, { x0, x: s.x });
  const x1 = s.x;
  await page.keyboard.down('KeyA');
  await wait(page, 300);
  await page.keyboard.up('KeyA');
  s = await S(page);
  check('왼쪽 이동 (A 키)', s.x < x1 - 40, { x1, x: s.x });
  await page.keyboard.press('Space');
  await wait(page, 120);
  s = await S(page);
  check('점프 (공중에 뜸)', s.y < 456 - 40 && s.jumps === 1, s);
  await page.keyboard.press('ArrowUp');
  await wait(page, 60);
  s = await S(page);
  check('2단 점프', s.jumps === 2, s);
  await wait(page, 1200);
  s = await S(page);
  check('착지', s.y === 456 && s.jumps === 0, s);

  console.log('\n[수집/점수/콤보]');
  await page.evaluate(() => (KK.games.session.instance.debug.state.obstacles = []));
  await giveItem(page, 'cabbage');
  await wait(page, 80);
  s = await S(page);
  check('배추 수집 → 1/3', s.have.cabbage === 1, s.have);
  check('점수 100', s.score === 100, s.score);
  await giveItem(page, 'garlic');
  await wait(page, 80);
  s = await S(page);
  check('콤보 보너스 (+60 재료 +10 콤보)', s.score === 170 && s.combo === 2, s);
  check('HUD 점수 표시', (await page.textContent('.hud-stat .hud-value')) === '170');
  check('HUD 재료 표시', (await page.textContent('.track-chip[data-id="cabbage"] .track-count')) === '1/3');

  console.log('\n[충돌]');
  await placeObstacle(page);
  await wait(page, 80);
  s = await S(page);
  check('장애물 충돌 → 하트 2', s.hearts === 2, s.hearts);
  check('충돌 시 콤보 초기화', s.combo === 0);
  check('HUD 하트 2개', (await page.$$('.hud-hearts .ico.full')).length === 2);
  await page.evaluate(() => KK.games.session.instance.debug.spawnObstacle('crate', KK.games.session.instance.debug.state.player.x - 20));
  await wait(page, 80);
  check('무적 시간에는 또 맞지 않음', (await S(page)).hearts === 2);

  console.log('\n[타이머/일시정지]');
  let t0 = (await S(page)).timeLeft;
  await wait(page, 1000);
  let t1 = (await S(page)).timeLeft;
  check('타이머 1초 ≈ 1초 감소', t0 - t1 > 0.8 && t0 - t1 < 1.25, t0 - t1);
  await page.keyboard.press('KeyP');
  check('P 키로 일시정지', (await page.evaluate(() => KK.games.session.state)) === 'paused' && !!(await page.$('.pause-panel')));
  t0 = (await S(page)).timeLeft;
  await wait(page, 800);
  t1 = (await S(page)).timeLeft;
  check('일시정지 중 시간 멈춤', t0 === t1, { t0, t1 });
  await page.click('.pause-panel .btn-primary');
  await wait(page, 500);
  t1 = (await S(page)).timeLeft;
  check('계속하기 → 시간 다시 흐름', t0 - t1 > 0.3, t0 - t1);
  await page.click('.hud-btn');
  check('HUD 일시정지 버튼', !!(await page.$('.pause-panel')));

  console.log('\n[다시 하기 초기화]');
  await page.click('.pause-panel .btn-secondary');
  await page.waitForFunction(() => KK.games.session.state === 'playing', null, { timeout: 5000 });
  s = await S(page);
  check('다시 하기: 점수/하트/재료 초기화', s.score === 0 && s.hearts === 3 && s.have.cabbage === 0 && s.timeLeft > 59, s);
  check('HUD 초기화', (await page.textContent('.hud-stat .hud-value')) === '0' && (await page.$$('.hud-hearts .ico.full')).length === 3);
  t0 = (await S(page)).timeLeft;
  await wait(page, 1000);
  t1 = (await S(page)).timeLeft;
  check('다시 하기 후 타이머가 2배로 빨라지지 않음', t0 - t1 > 0.8 && t0 - t1 < 1.25, t0 - t1);

  console.log('\n[김치 완성]');
  await page.evaluate(() => (KK.games.session.instance.debug.state.obstacles = []));
  const need = { cabbage: 3, radish: 2, garlic: 3, chili: 2, salt: 2 };
  for (const [type, n] of Object.entries(need)) {
    for (let i = 0; i < n; i++) {
      await page.evaluate(() => (KK.games.session.instance.debug.state.obstacles = []));
      await giveItem(page, type);
      await wait(page, 50);
    }
  }
  s = await S(page);
  check('재료를 모두 모으면 outro', s.phase === 'outro', s.phase);
  check('추가 장애물 생성 중단', s.obstacles === 0);
  const tStop = s.timeLeft;
  await page.waitForFunction(() => KK.games.session.instance.debug.state.step === 'mix', null, { timeout: 8000 });
  check('부엌: 배추 절이기 → 양념 버무리기', true);
  check('완성 후 타이머 멈춤', (await S(page)).timeLeft === tStop);
  await page.screenshot({ path: path.join(SHOTS, 'kitchen-mix.png') });
  for (let i = 0; i < 16; i++) {
    await page.keyboard.press('Space');
    await wait(page, 60);
  }
  s = await S(page);
  check('SPACE 연타로 버무리기 100%', s.mixP === 1, s.mixP);
  await page.waitForFunction(() => KK.games.session.instance.debug.state.step === 'done', null, { timeout: 8000 });
  await wait(page, 400);
  await page.screenshot({ path: path.join(SHOTS, 'kimchi-complete.png') });
  await page.waitForSelector('.result-panel', { timeout: 8000 });
  await wait(page, 1200);
  await page.screenshot({ path: path.join(SHOTS, 'result-win.png') });
  check('결과 화면: 김치 완성', (await page.textContent('.result-ribbon')) === 'Kimchi complete!');
  const total = await page.textContent('.result-score');
  check('결과 점수 표시', parseInt(total.replace(/,/g, ''), 10) > 1000, total);
  check('점수 내역 5줄', (await page.$$('.breakdown li')).length === 5);
  check('배지 획득 표시', (await page.$$('.result-badges .badge')).length >= 2);
  check('김장 문화 설명', (await page.textContent('.fact-card')).includes('UNESCO'));
  check('결과 화면에서 게임 루프 정지', !(await page.evaluate(() => KK.games.session.instance.debug.running)));
  const saved = await page.evaluate(() => KK.save.gameStats('kimchi-run'));
  check('기록 저장 (완성 1회)', saved.completions === 1 && saved.best > 0, saved);

  console.log('\n[게임 오버]');
  await page.click('.result-panel .btn-primary');
  await page.waitForFunction(() => KK.games.session.state === 'playing', null, { timeout: 5000 });
  for (let i = 0; i < 3; i++) {
    await placeObstacle(page);
    await wait(page, 60);
  }
  s = await S(page);
  check('하트 0 → over 단계', s.hearts === 0 && s.phase === 'over', s);
  await page.waitForSelector('.result-panel.lose', { timeout: 5000 });
  check('실패 결과 화면', (await page.textContent('.result-ribbon')) === 'No kimchi this time');
  check('부족한 재료 안내', (await page.textContent('.result-sub')).includes('Still needed'));
  check('실패 시 점수 내역 2줄 (완성 보너스 없음)', (await page.$$('.breakdown li')).length === 2);

  console.log('\n[시간 종료]');
  await page.click('.result-panel .btn-primary');
  await page.waitForFunction(() => KK.games.session.state === 'playing', null, { timeout: 5000 });
  await page.evaluate(() => (KK.games.session.instance.debug.state.timeLeft = 0.3));
  await page.waitForSelector('.result-panel.lose', { timeout: 5000 });
  check('시간 종료 결과', (await page.textContent('.result-sub')).includes("Time's up"));

  console.log('\n[메인 메뉴로 돌아가기]');
  await page.click('.result-panel .btn-ghost');
  await page.waitForSelector('.menu-screen');
  check('결과 → 메인 메뉴', !(await page.evaluate(() => KK.games.session)));
  check('메뉴에 최고 기록 표시', (await page.textContent('[data-game="kimchi-run"] .card-best')).startsWith('Best'));
  check('진행도 1/4', (await page.textContent('.progress-meta')).includes('1/4'));
  await startGame(page);
  await page.keyboard.press('Escape');
  await page.click('.pause-panel .btn-ghost');
  await page.waitForSelector('.menu-screen');
  check('일시정지 → 메인 메뉴', !(await page.$('.game-screen')));
  await startGame(page);
  await page.goBack();
  await page.waitForSelector('.menu-screen');
  check('브라우저 뒤로 가기 → 메뉴, 게임 정리', !(await page.$('.game-screen')) && !(await page.evaluate(() => KK.games.session)));

  console.log('\n[기록 화면 / 초기화]');
  await page.goto(URL + '#/records');
  await page.waitForSelector('.records-screen');
  check('배지 잠금 해제 표시', (await page.$$('[data-game="kimchi-run"] .badge:not(.locked)')).length >= 2);
  await page.click('.records-foot .btn');
  await page.click('.modal .btn-ghost');
  check('초기화 취소 → 기록 유지', (await page.evaluate(() => KK.save.gameStats('kimchi-run').plays)) > 0);
  await page.click('.records-foot .btn');
  await page.click('.modal .btn-danger');
  check('초기화 → 기록 삭제', (await page.evaluate(() => KK.save.gameStats('kimchi-run').plays)) === 0);
  check('PC 화면 오류 없음', errors.length === 0, errors);
  await ctx.close();

  console.log('\n[휴대폰 세로 화면 / 터치]');
  for (const vp of [
    { name: 'phone-portrait', width: 390, height: 844 },
    { name: 'phone-landscape', width: 844, height: 390 },
    { name: 'small-320', width: 320, height: 640 },
    { name: 'tablet', width: 820, height: 1180 },
  ]) {
    const mctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const mp = await mctx.newPage();
    const merr = [];
    mp.on('pageerror', (e) => merr.push(String(e)));
    await mp.goto(URL);
    await mp.waitForSelector('.game-card');
    const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(`${vp.name}: 메뉴 가로 넘침 없음`, overflow <= 0, overflow);
    await mp.screenshot({ path: path.join(SHOTS, `menu-${vp.name}.png`) });
    await mp.tap('[data-game="kimchi-run"] .btn-play');
    await mp.waitForSelector('.intro-panel');
    const btnVisible = await mp.evaluate(() => {
      const b = document.querySelector('.intro-panel .btn-primary').getBoundingClientRect();
      return b.width > 0;
    });
    check(`${vp.name}: 소개 화면 START 버튼`, btnVisible);
    await mp.tap('.intro-panel .btn-primary');
    await mp.waitForFunction(() => KK.games.session.state === 'playing', null, { timeout: 5000 });
    check(`${vp.name}: 터치 버튼 표시`, await mp.isVisible('.ctrl-btn[data-ctrl="jump"]'));
    // 버튼과 캔버스가 화면 안에 있는지
    const layout = await mp.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect();
      const inView = (b) => b.left >= -1 && b.top >= -1 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1;
      return {
        canvas: inView(r('.game-canvas')),
        jump: inView(r('.ctrl-btn[data-ctrl="jump"]')),
        left: inView(r('.ctrl-btn[data-ctrl="left"]')),
        hud: inView(r('.hud')),
      };
    });
    check(`${vp.name}: 캔버스/HUD/버튼이 화면 안`, layout.canvas && layout.jump && layout.left && layout.hud, layout);
    await mp.tap('.ctrl-btn[data-ctrl="jump"]');
    await mp.waitForTimeout(100);
    const js = await S(mp);
    check(`${vp.name}: 점프 버튼 터치 → 점프`, js.y < 456 - 30, js.y);
    await mp.waitForTimeout(1200);
    const box = await mp.$eval('.ctrl-btn[data-ctrl="right"]', (b) => { const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    const bx = (await S(mp)).x;
    const cdp = await mctx.newCDPSession(mp);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x, y: box.y }] });
    await mp.waitForTimeout(400);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const ax = (await S(mp)).x;
    check(`${vp.name}: ▶ 버튼 길게 누르기 → 이동`, ax > bx + 40, { bx, ax });
    await mp.waitForTimeout(100);
    const ax2 = (await S(mp)).x;
    check(`${vp.name}: 손을 떼면 멈춤`, Math.abs(ax2 - ax) < 1, { ax, ax2 });
    await mp.evaluate(() => KK.games.session.instance.debug.spawnItem('chili', 700, 380));
    await mp.waitForTimeout(500);
    await mp.screenshot({ path: path.join(SHOTS, `game-${vp.name}.png`) });
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
