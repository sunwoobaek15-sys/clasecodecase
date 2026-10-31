// 실제 브라우저 2개(PC + 모바일 터치 에뮬레이션)로 방 생성 → 코드 참가 → 준비 → 경기 → 새로고침 재접속 → 결과까지 검증
// 사용: npm run build && npm run test:e2e
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createGameServer } from '../../server/src/network/GameServer.js';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = await import('playwright')); }

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, '../../client/dist');
const out = path.resolve(here, '../../test-results');
fs.mkdirSync(out, { recursive: true });
if (!fs.existsSync(dist)) { console.error('client/dist 없음: 먼저 npm run build'); process.exit(1); }

// 무작위 경기장 이벤트를 끄고 결정적으로 검증한다 (이벤트 자체는 단위 테스트에서 검증)
const game = createGameServer({ port: 0, staticDir: dist, host: '127.0.0.1', roomOptions: { events: false } });
const port = await game.listen();
const url = `http://127.0.0.1:${port}/`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
const watch = (page, tag) => {
  page.on('pageerror', (e) => errors.push(`${tag} pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${tag} console: ${m.text()}`); });
};
const step = (s) => console.log('✔', s);
const shot = (page, name) => page.screenshot({ path: path.join(out, name) });
const state = (page) => page.evaluate(() => {
  const a = window.app; const g = a.game;
  return { phase: a.room && a.room.phase, you: a.youId, code: a.room && a.room.code, screen: a.ui.screen,
    local: g.sync.local && { x: g.sync.local.x, y: g.sync.local.y, z: g.sync.local.z, alive: g.sync.local.alive, dashCd: g.sync.local.dashCd },
    snapIds: g.sync.latest() ? [...g.sync.latest().players.keys()] : [] };
});
const waitFor = async (page, fn, arg, ms = 10000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 100 });

try {
  // ---- 호스트 (PC) ----
  const hostCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const host = await hostCtx.newPage();
  watch(host, 'host');
  await host.goto(url);
  await host.waitForSelector('#name');
  await host.fill('#name', '호스트');
  await host.click('[data-act=create]');
  await waitFor(host, () => window.app.room && window.app.room.phase === 'lobby');
  const { code } = await state(host);
  assert.match(code, /^[A-Z0-9]{4}$/);
  step(`방 생성: 코드 ${code}`);

  // ---- 게스트 (모바일 터치) ----
  const guestCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const guest = await guestCtx.newPage();
  watch(guest, 'guest');
  await guest.goto(url + '?room=' + code);
  await guest.waitForSelector('#name');
  assert.equal(await guest.inputValue('#code'), code, '초대 링크로 코드 자동 입력');
  await guest.fill('#name', '모바일');
  await guest.tap('[data-act=join]');
  await waitFor(guest, () => window.app.room && window.app.room.players.length === 2);
  await waitFor(host, () => window.app.room.players.length === 2);
  step('코드로 참가 (모바일)');
  await shot(host, 'e2e-01-lobby-host.png');
  await shot(guest, 'e2e-02-lobby-mobile.png');

  // 게스트 꾸미기 변경 → 호스트에 반영
  await guest.tap('[data-act=customize]');
  await guest.tap('[data-act=customTab][data-k=hat]');
  await guest.tap('[data-act=look][data-k=hat][data-v=crown]');
  await waitFor(host, () => window.app.room.players[1].look.hat === 'crown');
  await shot(guest, 'e2e-03-customize-mobile.png');
  await guest.tap('[data-act=closeCustomize]');
  step('커스터마이징 동기화');

  assert.ok(await host.isDisabled('[data-act=start]'), '게스트 준비 전 시작 불가');
  await guest.tap('[data-act=ready]');
  await waitFor(host, () => !document.querySelector('[data-act=start]').disabled);
  step('준비 → 시작 버튼 활성화');
  await host.click('[data-act=start]');
  await waitFor(guest, () => window.app.room.phase === 'countdown');
  await shot(guest, 'e2e-04-countdown-mobile.png');
  await waitFor(host, () => window.app.room.phase === 'playing', null, 8000);
  await waitFor(guest, () => window.app.room.phase === 'playing', null, 8000);
  step('카운트다운 → 경기 시작 (양쪽 동기화)');

  // ---- PC: 키보드 이동/점프/대시 ----
  const s0 = await state(host);
  await host.keyboard.down('KeyW');
  await host.waitForTimeout(600);
  await host.keyboard.press('Space');
  await host.waitForTimeout(150);
  const air = await state(host);
  await host.keyboard.press('ShiftLeft');
  await host.waitForTimeout(250);
  await host.keyboard.up('KeyW');
  const s1 = await state(host);
  assert.ok(Math.hypot(s1.local.x - s0.local.x, s1.local.z - s0.local.z) > 2, 'PC 이동');
  assert.ok(air.local.y > 0.2 || s1.local.dashCd > 0, '점프 또는 대시');
  assert.ok(s1.local.dashCd > 0, '대시 쿨타임 시작');
  await shot(host, 'e2e-05-play-host.png');
  step('PC 조작: 이동/점프/대시');

  // 다른 브라우저에서 호스트 위치가 보이는지 (서버 경유 동기화)
  await host.waitForTimeout(400);
  const hostId = s0.you;
  const hostPos = (await state(host)).local;
  const seen = await guest.evaluate((id) => { const r = window.app.game.sync.sample(id, {}); return r && { x: r.x, z: r.z }; }, hostId);
  assert.ok(seen && Math.hypot(seen.x - hostPos.x, seen.z - hostPos.z) < 1.5, `게스트가 본 호스트 위치 ${JSON.stringify(seen)} vs ${JSON.stringify(hostPos)}`);
  step('위치 동기화 (다른 기기에서 보이는 위치 일치)');

  // ---- 모바일: 가상 조이스틱/점프 버튼 ----
  const g0 = await state(guest);
  const cdp = await guestCtx.newCDPSession(guest);
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  await touch('touchStart', [{ x: 90, y: 700, id: 1 }]);
  for (let i = 1; i <= 6; i++) { await touch('touchMove', [{ x: 90, y: 700 - i * 10, id: 1 }]); await guest.waitForTimeout(16); }
  await guest.waitForTimeout(700);
  const jumpBox = await guest.locator('.tbtn.jump').boundingBox();
  await touch('touchStart', [{ x: 90, y: 640, id: 1 }, { x: jumpBox.x + jumpBox.width / 2, y: jumpBox.y + jumpBox.height / 2, id: 2 }]);
  await waitFor(guest, () => window.app.game.sync.local.y > 0.1, null, 3000);
  const gAir = await state(guest);
  await touch('touchEnd', []);
  const g1 = await state(guest);
  assert.ok(Math.hypot(g1.local.x - g0.local.x, g1.local.z - g0.local.z) > 2, '조이스틱 이동');
  assert.ok(gAir.local.y > 0.1, `점프 버튼 y=${gAir.local.y}`);
  await shot(guest, 'e2e-06-play-mobile.png');
  step('모바일 터치 조작: 조이스틱 이동 + 점프 버튼');

  // ---- 새로고침 → 같은 플레이어로 복귀 ----
  const gid = g1.you;
  await guest.reload();
  await waitFor(guest, (id) => window.app && window.app.youId === id && window.app.room && window.app.room.phase === 'playing', gid, 10000);
  await waitFor(guest, () => window.app.game.sync.local !== null);
  assert.ok(await guest.evaluate(() => window.app.game.sync.local.alive), '재접속 후에도 생존');
  step('브라우저 새로고침 후 재접속 (같은 플레이어, 경기 계속)');

  // ---- 호스트가 경기장 밖으로 달려 탈락 → 게스트 우승 ----
  await host.evaluate(() => { window.app.game.rig.yaw = Math.atan2(-window.app.game.sync.local.x, -window.app.game.sync.local.z); });
  await host.keyboard.down('KeyW');
  await waitFor(host, () => window.app.room.phase === 'results', null, 15000);
  await host.keyboard.up('KeyW');
  await waitFor(guest, () => window.app.room.phase === 'results', null, 5000);
  await guest.waitForTimeout(800);
  const res = await guest.evaluate(() => window.app.results);
  assert.deepEqual(res.winners, [gid], '게스트 우승');
  assert.equal(res.ranking.length, 2);
  assert.ok(await guest.locator('.winner-title').innerText().then((t) => t.includes('모바일')));
  await shot(guest, 'e2e-07-results-mobile.png');
  await shot(host, 'e2e-08-results-host.png');
  step('탈락 → 마지막 생존자 우승 → 결과 화면');

  // ---- 다시 하기 ----
  await host.click('[data-act=rematch]');
  await waitFor(guest, () => window.app.room.phase === 'countdown' && window.app.room.matchNo === 2);
  step('다시 하기 → 새 경기 카운트다운');
  await waitFor(host, () => window.app.room.phase === 'playing', null, 8000);

  // 경기 중 대기실 복귀 흐름: 호스트가 나가면 방장 이전
  await host.evaluate(() => window.app.action('leave', {}));
  await waitFor(guest, () => window.app.room.hostId === window.app.youId, null, 8000);
  step('방장 퇴장 → 방장 위임');

  const bad = errors.filter((e) => !/favicon|fonts\.g/.test(e));
  assert.deepEqual(bad, [], '브라우저 콘솔 에러 없음');
  step('콘솔 에러 없음');
  console.log('\nE2E 통과 ✅  스크린샷:', out);
} catch (e) {
  console.error('E2E 실패 ❌', e);
  console.error(errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
  await game.close();
}
