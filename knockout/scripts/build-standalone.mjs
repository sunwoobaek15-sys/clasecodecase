// 서버 없이 더블클릭으로 실행되는 단일 HTML 파일(오프라인, 봇 대전) 생성
// 사용: npm run build:standalone  →  KNOCKOUT-offline.html
import { build } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'client/dist-standalone');
process.env.VITE_OFFLINE = '1';

await build({
  configFile: path.join(root, 'client/vite.config.js'),
  logLevel: 'warn',
  build: {
    outDir,
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    modulePreload: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});

let html = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
const assets = path.join(outDir, 'assets');
html = html.replace(/<script type="module" crossorigin src="\.\/assets\/[^"]+"><\/script>/g, '').replace(/<link rel="stylesheet" crossorigin href="\.\/assets\/([^"]+)">/g, (_, f) => `<style>${fs.readFileSync(path.join(assets, f), 'utf8')}</style>`);
// 스크립트는 body 끝(로딩 화면 DOM 이후)에 넣는다
const jsFile = fs.readdirSync(assets).find((f) => f.endsWith('.js'));
const js = fs.readFileSync(path.join(assets, jsFile), 'utf8').replace(/<\/script/gi, '<\\/script');
html = html.replace('</body>', () => `<script type="module">${js}</script>\n</body>`);
if (/src="\.\/assets|href="\.\/assets/.test(html)) throw new Error('외부 자산 참조가 남아 있습니다');
const out = path.join(root, 'KNOCKOUT-offline.html');
fs.writeFileSync(out, html);
console.log(`생성 완료: ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
