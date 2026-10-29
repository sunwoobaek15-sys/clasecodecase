// index.html 과 모든 CSS/JS/아이콘을 한 파일로 합쳐 dist/kiwi-kimchi-party.html 을 만든다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
let html = read('index.html');

html = html.replace(/<link rel="stylesheet" href="(styles\/[^"]+)" \/>/g, (_, p) => `<style>\n${read(p)}\n</style>`);
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, p) => `<script>\n${read(p).replace(/<\/script/gi, '<\\/script')}\n</script>`);
const icon = Buffer.from(read('assets/images/icon.svg')).toString('base64');
html = html.replace('href="assets/images/icon.svg"', `href="data:image/svg+xml;base64,${icon}"`);

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', 'kiwi-kimchi-party.html');
fs.writeFileSync(out, html);
console.log(`만들어진 파일: ${out} (${Math.round(html.length / 1024)} KB)`);
