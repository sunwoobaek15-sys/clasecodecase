// 모든 CSS·JS를 HTML 한 파일에 넣어 dist/save-city.html을 만듭니다.
// 사용법: npm run build  (결과 파일 하나만 있으면 어디서든 열 수 있어요)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

let html = read('index.html');

html = html.replace(/<link rel="stylesheet" href="css\/style\.css">/, () => '<style>\n' + read('css/style.css') + '\n</style>');

html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => {
  const code = read(src);
  if (/<\/script/i.test(code)) throw new Error(src + ' 안에 </script 문자열이 있어 한 파일로 합칠 수 없어요.');
  return '<script>\n' + code + '\n</script>';
});

const icon = 'data:image/svg+xml,' + encodeURIComponent(read('assets/icon.svg').replace(/\s+/g, ' '));
html = html
  .replace(/<link rel="manifest"[^>]*>\n?/, '')
  .replace(/<link rel="apple-touch-icon"[^>]*>\n?/, '')
  .replace(/<link rel="icon"[^>]*>/, '<link rel="icon" href="' + icon + '">');

mkdirSync(join(root, 'dist'), { recursive: true });
const out = join(root, 'dist', 'save-city.html');
writeFileSync(out, html);
console.log('만들었어요: ' + out + ' (' + Math.round(html.length / 1024) + ' KB)');
