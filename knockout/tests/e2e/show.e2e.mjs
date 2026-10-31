// 쇼 모드 E2E: 사람 1 + 봇 5로 레이스 → 넉아웃 아레나 → 결승을 실제 브라우저에서 끝까지 진행
// 레이스에서 탈락하면 다음 라운드부터 방해꾼(번개 구름)으로 폭탄을 떨어뜨릴 수 있는지 확인
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createGameServer } from '../../server/src/network/GameServer.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, '../../client/dist');
const out = path.resolve(here, '../../test-results');
fs.mkdirSync(out, { recursive: true });

const game = createGameServer({ port: 0, staticDir: dist, host: '127.0.0.1' });
const port = await game.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
const step = (s) => console.log('✔', s);
try {
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|favicon/.test(m.text())) errors.push(m.text()); });
  await p.goto(`http://127.0.0.1:${port}/`);
  await p.waitForSelector('#name');
  await p.fill('#name', '쇼테스터');
  await p.click('[data-act=create]');
  await p.waitForFunction(() => window.app.room && window.app.room.mode === 'show');
  for (let i = 0; i < 5; i++) await p.click('[data-act=addBot]');
  await p.waitForFunction(() => window.app.room.players.length === 6);
  await p.click('[data-act=start]');
  await p.waitForSelector('.intro-card', { timeout: 8000 });
  assert.ok((await p.locator('.intro-card').innerText()).includes('터보 레이스'));
  step('라운드 1 소개 카드: 터보 레이스');
  await p.waitForFunction(() => window.app.room.phase === 'playing', null, { timeout: 15000 });
  assert.ok(await p.evaluate(() => !!window.app.game.sync.world.course), '레이스 코스 로드');
  const z0 = await p.evaluate(() => window.app.game.sync.local.z);
  await p.keyboard.down('KeyW');
  await p.waitForTimeout(1500);
  await p.keyboard.up('KeyW');
  const z1 = await p.evaluate(() => window.app.game.sync.local.z);
  assert.ok(z1 - z0 > 3, `코스 전진 ${z0} → ${z1}`);
  await p.screenshot({ path: path.join(out, 'show-e2e-race.png') });
  step('레이스 코스에서 전진');

  // 레이스 종료 → 라운드 결과
  await p.waitForSelector('.intro-card', { timeout: 200000 });
  await p.waitForFunction(() => window.app.room.phase === 'roundEnd', null, { timeout: 200000 });
  step('라운드 결과 표시');
  const seen = new Set();
  let bombed = false;
  for (let i = 0; i < 900 && !(await p.evaluate(() => window.app.room.phase === 'results')); i++) {
    const st = await p.evaluate(() => ({ ph: window.app.room.phase, r: window.app.room.round.idx, type: window.app.room.round.type, ghost: window.app.game.isGhost() }));
    seen.add(st.type);
    if (st.ph === 'playing' && st.ghost && !bombed) {
      await p.keyboard.press('ShiftLeft');
      await p.waitForTimeout(400);
      bombed = await p.evaluate(() => window.app.game.fx.warns.some((w) => w.group.visible));
      if (bombed) { await p.screenshot({ path: path.join(out, 'show-e2e-ghost.png') }); step('방해꾼 모드에서 번개 폭탄 투하'); }
    }
    await p.waitForTimeout(400);
  }
  await p.waitForSelector('.winner-title', { timeout: 10000 });
  const res = await p.evaluate(() => window.app.results);
  assert.equal(res.ranking.length, 6);
  assert.ok(res.rounds.length >= 2);
  await p.screenshot({ path: path.join(out, 'show-e2e-results.png') });
  step(`쇼 완료: 라운드 ${res.rounds.join(' → ')}, 챔피언 ${res.ranking[0].name}`);
  const me = res.ranking.find((r) => r.name === '쇼테스터');
  if (me.rank > 1 && me.label.includes('레이스')) assert.ok(bombed, '레이스 탈락 후 방해꾼으로 폭탄을 떨어뜨렸어야 함');
  assert.deepEqual(errors, [], '콘솔 에러 없음');
  step('콘솔 에러 없음');
  console.log('\nSHOW E2E 통과 ✅');
} catch (e) {
  console.error('SHOW E2E 실패 ❌', e, errors);
  process.exitCode = 1;
} finally {
  await browser.close();
  await game.close();
}
