/* Kiwi Forest Rescue 브라우저 자동 테스트 (Playwright)
 * 실행: node tests/kiwi-forest-rescue.e2e.js */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const SHOTS = process.env.SHOTS || path.resolve(__dirname, 'screenshots');
const GROUND = 452;
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
      phase: s.phase, timeLeft: s.timeLeft, hearts: s.hearts, x: s.player.x, y: s.player.y, onGround: s.player.onGround,
      bag: s.bag.slice(), deposited: { ...s.deposited }, collected: { ...s.collected }, found: s.found, trips: s.trips,
      score: s.itemPts + s.comboPts + s.nestPts, itemPts: s.itemPts, nestPts: s.nestPts, combo: s.combo, factIdx: s.factIdx,
    };
  });
const tp = (page, x, y) => page.evaluate(([x, y]) => KK.games.session.instance.debug.teleport(x, y), [x, y == null ? null : y]);
const noStoats = (page) => page.evaluate(() => (KK.games.session.instance.debug.state.stoats = []));

async function startGame(page) {
  await page.goto(URL + '#/play/kiwi-forest-rescue');
  await page.waitForSelector('.intro-panel');
  await page.click('.intro-panel .btn-primary');
  await page.waitForFunction(() => KK.games.session && KK.games.session.state === 'playing', null, { timeout: 5000 });
}
// 남아 있는 모든 필요한 물건을 모아 굴에 넣는다
async function collectAndDeliver(page) {
  for (let guard = 0; guard < 10; guard++) {
    const plan = await page.evaluate(() => {
      const s = KK.games.session.instance.debug.state;
      const need = { worm: 4, grub: 3, fern: 3, moss: 2, leaf: 3 };
      return s.items.filter((it) => !it.taken && s.collected[it.type] < need[it.type]).map((it) => [it.type, it.x, it.y]);
    });
    if (!plan.length) break;
    for (const [, x, y] of plan) {
      const bag = (await S(page)).bag.length;
      if (bag >= 5) break;
      await tp(page, x, y + 20 >= GROUND ? GROUND : y + 26);
      await wait(page, 60);
    }
    await tp(page, 150);
    await wait(page, 60);
    await page.keyboard.press('ArrowDown');
    await wait(page, 1100);
  }
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text()) && errors.push(m.text()));

  console.log('\n[메뉴 → Kiwi Forest Rescue]');
  await page.goto(URL);
  await page.waitForSelector('.game-card');
  check('Kiwi Forest Rescue 카드에 PLAY 버튼', !!(await page.$('[data-game="kiwi-forest-rescue"] .btn-play')));
  await page.click('[data-game="kiwi-forest-rescue"] .btn-play');
  await page.waitForSelector('.intro-panel');
  const intro = await page.textContent('.intro-panel');
  check('소개: 먹이와 둥지 재료 5종', ['Earthworm', 'Beetle grub', 'Fern frond', 'Moss', 'Dry leaves'].every((w) => intro.includes(w)));
  await page.click('.intro-panel .btn-primary');
  await page.waitForFunction(() => KK.games.session.state === 'playing', null, { timeout: 5000 });
  let s = await S(page);
  check('게임 시작', s.phase === 'run' && s.hearts === 3);

  console.log('\n[이동 / 점프 / 발판]');
  await page.evaluate(() => (KK.games.session.instance.debug.state.stoats = []));
  const x0 = s.x;
  await page.keyboard.down('ArrowRight');
  await wait(page, 400);
  await page.keyboard.up('ArrowRight');
  s = await S(page);
  check('→ 걷기', s.x > x0 + 70, { x0, x: s.x });
  const x1 = s.x;
  await page.keyboard.down('KeyA');
  await wait(page, 300);
  await page.keyboard.up('KeyA');
  check('A 키로 왼쪽 걷기', (await S(page)).x < x1 - 50);
  await page.keyboard.press('Space');
  await wait(page, 150);
  s = await S(page);
  check('점프', s.y < GROUND - 60 && !s.onGround, s);
  await wait(page, 800);
  check('착지', (await S(page)).y === GROUND);
  await tp(page, 370, 300);
  await wait(page, 300);
  s = await S(page);
  check('통나무 발판 위에 올라섬', s.y === 362 && s.onGround, s);
  await tp(page, 990 - 60 - 40);
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => KK.games.session.instance.debug.state.hearts < 3, null, { timeout: 3000 });
  await page.keyboard.up('ArrowRight');
  s = await S(page);
  check('개울에 빠지면 하트 −1, 안전한 곳으로 돌아옴', s.hearts === 2 && s.y === GROUND && s.x < 900, s);

  console.log('\n[물건 줍기 / 가방]');
  await page.click('.hud-btn');
  await page.click('.pause-panel .btn-secondary');
  await page.waitForFunction(() => KK.games.session.state === 'playing', null, { timeout: 5000 });
  await noStoats(page);
  s = await S(page);
  check('다시 하기 → 초기화', s.hearts === 3 && s.score === 0 && s.bag.length === 0 && s.timeLeft > 99, s);
  await tp(page, 270);
  await wait(page, 80);
  s = await S(page);
  check('마른 잎 줍기 → 가방 1, +50', s.bag.length === 1 && s.collected.leaf === 1 && s.itemPts === 50, s);
  check('HUD 표시', (await page.textContent('.track-chip[data-id="leaf"] .track-count')) === '1/3');
  await tp(page, 480);
  await wait(page, 80);
  await tp(page, 370, 362);
  await wait(page, 80);
  await tp(page, 620, 302);
  await wait(page, 80);
  s = await S(page);
  check('통나무·바위 위 물건 줍기', s.collected.fern === 1 && s.collected.moss === 1, s.collected);
  check('연속 수집 보너스', s.score > s.itemPts, s);
  await tp(page, 800);
  await wait(page, 80);
  check('가방 5칸 가득', (await S(page)).bag.length === 5);
  await tp(page, 1080);
  await wait(page, 80);
  s = await S(page);
  check('가방이 가득 차면 더 못 주움', s.bag.length === 5 && s.collected.grub === 0, s);
  await page.keyboard.press('ArrowDown');
  await wait(page, 200);
  check('굴에서 멀면 넣기 안 됨', (await S(page)).trips === 0);

  console.log('\n[굴에 넣기]');
  await tp(page, 150);
  await wait(page, 60);
  await page.keyboard.press('ArrowDown');
  await wait(page, 1200);
  s = await S(page);
  check('굴에 넣기 → 가방 비움, 1번째 왕복', s.bag.length === 0 && s.trips === 1 && s.nestPts === 150, s);
  check('서식지 완성도 반영', s.deposited.leaf === 1 && s.deposited.worm === 2, s.deposited);
  await page.screenshot({ path: path.join(SHOTS, 'kf-home.png') });

  console.log('\n[스토트]');
  await page.evaluate(() => {
    const s = KK.games.session.instance.debug.state;
    s.stoats = [{ min: 1300, max: 1500, x: 1400, dir: 1, speed: 0 }];
  });
  await tp(page, 1385);
  await wait(page, 100);
  s = await S(page);
  check('스토트에 닿으면 하트 −1', s.hearts === 2, s.hearts);
  await wait(page, 100);
  check('잠깐 무적 (연속으로 맞지 않음)', (await S(page)).hearts === 2);
  await noStoats(page);

  console.log('\n[타이머 / 일시정지]');
  let t0 = (await S(page)).timeLeft;
  await wait(page, 1000);
  let t1 = (await S(page)).timeLeft;
  check('타이머 1초 ≈ 1초', t0 - t1 > 0.8 && t0 - t1 < 1.25, t0 - t1);
  await page.keyboard.press('Escape');
  t0 = (await S(page)).timeLeft;
  await wait(page, 600);
  check('일시정지 중 시간 멈춤', (await S(page)).timeLeft === t0);
  await page.click('.pause-panel .btn-primary');
  await wait(page, 200);
  await page.screenshot({ path: path.join(SHOTS, 'kf-run.png') });

  console.log('\n[서식지 완성 → 키위 등장]');
  await collectAndDeliver(page);
  s = await S(page);
  check('필요한 물건을 모두 굴에 넣으면 완성', s.phase === 'finale', s);
  await wait(page, 2500);
  await page.screenshot({ path: path.join(SHOTS, 'kf-kiwi-walk.png') });
  const kiwiOnGround = await page.evaluate(() => KK.games.session.instance.debug.state.phase);
  check('키위 등장 장면 진행', kiwiOnGround === 'finale');
  await page.waitForFunction(() => KK.games.session.instance.debug.state.phase === 'facts', null, { timeout: 9000 });
  await page.screenshot({ path: path.join(SHOTS, 'kf-facts.png') });
  for (let i = 0; i < 3; i++) {
    await wait(page, 400);
    await page.keyboard.press('Space');
  }
  await page.waitForSelector('.result-panel.win', { timeout: 5000 });
  await wait(page, 1200);
  await page.screenshot({ path: path.join(SHOTS, 'kf-result.png') });
  check('결과: Kiwi rescued!', (await page.textContent('.result-ribbon')) === 'Kiwi rescued!');
  check('점수 내역 5줄', (await page.$$('.breakdown li')).length === 5);
  check('자연 보호 설명 (스토트)', (await page.textContent('.fact-card')).includes('stoats'));
  check('배지 획득', (await page.textContent('.result-badges')).includes('Kiwi Rescuer'));
  const st = await page.evaluate(() => KK.save.gameStats('kiwi-forest-rescue'));
  check('기록 저장', st.completions === 1 && st.best > 0, st);

  console.log('\n[게임 오버 / 시간 종료]');
  await page.click('.result-panel .btn-primary');
  await page.waitForFunction(() => KK.games.session.state === 'playing', null, { timeout: 5000 });
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => {
      const s = KK.games.session.instance.debug.state;
      s.player.inv = 0;
      s.stoats = [{ min: s.player.x - 5, max: s.player.x + 5, x: s.player.x, dir: 1, speed: 0 }];
    });
    await wait(page, 80);
    await page.waitForFunction(() => KK.games.session.instance.debug.state.player.onGround, null, { timeout: 3000 });
  }
  check('하트 0 → over', (await S(page)).phase === 'over');
  await page.waitForSelector('.result-panel.lose', { timeout: 5000 });
  check('실패 결과', (await page.textContent('.result-ribbon')) === 'The habitat is not ready yet');
  check('부족한 물건 안내', (await page.textContent('.result-sub')).includes('Still needed'));
  await page.click('.result-panel .btn-primary');
  await page.waitForFunction(() => KK.games.session.state === 'playing', null, { timeout: 5000 });
  await page.evaluate(() => (KK.games.session.instance.debug.state.timeLeft = 0.3));
  await page.waitForSelector('.result-panel.lose', { timeout: 5000 });
  check('시간 종료 결과', (await page.textContent('.result-sub')).includes("Time's up"));
  await page.click('.result-panel .btn-ghost');
  await page.waitForSelector('.menu-screen');
  check('메인 메뉴로 돌아옴', !(await page.$('.game-screen')));
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
    await noStoats(mp);
    check(`${vp.name}: 터치 버튼 4개 (◀ ▶ 넣기 점프)`, (await mp.$$('.ctrl-btn')).length === 4 && (await mp.isVisible('.ctrl-btn[data-ctrl="place"]')));
    const box = await mp.$eval('.ctrl-btn[data-ctrl="right"]', (b) => { const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    const cdp = await mctx.newCDPSession(mp);
    const bx = (await S(mp)).x;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x, y: box.y }] });
    await mp.waitForTimeout(300);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    check(`${vp.name}: ▶ 버튼으로 걷기`, (await S(mp)).x > bx + 40);
    await mp.tap('.ctrl-btn[data-ctrl="jump"]');
    await mp.waitForTimeout(120);
    check(`${vp.name}: 점프 버튼`, (await S(mp)).y < GROUND - 40);
    await mp.waitForTimeout(900);
    await tp(mp, 270);
    await mp.waitForTimeout(80);
    await tp(mp, 150);
    await mp.waitForTimeout(80);
    await mp.tap('.ctrl-btn[data-ctrl="place"]');
    await mp.waitForTimeout(500);
    check(`${vp.name}: 넣기 버튼으로 굴에 넣기`, (await S(mp)).deposited.leaf === 1);
    const inView = await mp.evaluate(() => {
      const v = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return b.left >= -1 && b.top >= -1 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1; };
      return v('.game-canvas') && v('.hud') && v('.ctrl-btn[data-ctrl="jump"]') && v('.ctrl-btn[data-ctrl="left"]');
    });
    check(`${vp.name}: 화면 배치 정상`, inView);
    await tp(mp, 1300);
    await mp.waitForTimeout(400);
    await mp.screenshot({ path: path.join(SHOTS, `kf-${vp.name}.png`) });
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
