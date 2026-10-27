// 모든 CSS·JS를 HTML 한 파일에 넣어 dist/ 안에 만듭니다.
//   dist/save-city.html    SAVE CITY (저장소 맨 위)
//   dist/sector-zero.html  SECTOR ZERO 1인칭 슈팅 게임 (fps/)
// 사용법: npm run build  (결과 파일 하나만 있으면 어디서든 열 수 있어요)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** dir/index.html이 불러오는 내 CSS·JS 파일을 모두 안에 넣어 dist/outName으로 저장 */
function bundle(dir, outName, finish) {
  const read = (p) => readFileSync(join(root, dir, p), 'utf8');
  const label = (p) => (dir === '.' ? p : dir + '/' + p);
  let html = read('index.html');

  // 인터넷 주소(글꼴)는 그대로 두고, 저장소 안의 스타일시트만 넣어요
  html = html.replace(/<link rel="stylesheet" href="((?!https?:)[^"]+\.css)">/g, (_, href) => '<style>\n' + read(href) + '\n</style>');

  html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => {
    const code = read(src);
    if (/<\/script/i.test(code)) throw new Error(label(src) + ' 안에 </script 문자열이 있어 한 파일로 합칠 수 없어요.');
    return '<script>\n' + code + '\n</script>';
  });

  if (finish) html = finish(html, read);

  mkdirSync(join(root, 'dist'), { recursive: true });
  const out = join(root, 'dist', outName);
  writeFileSync(out, html);
  console.log('만들었어요: ' + out + ' (' + Math.round(html.length / 1024) + ' KB)');
}

bundle('.', 'save-city.html', (html, read) => {
  const icon = 'data:image/svg+xml,' + encodeURIComponent(read('assets/icon.svg').replace(/\s+/g, ' '));
  return html
    .replace(/<link rel="manifest"[^>]*>\n?/, '')
    .replace(/<link rel="apple-touch-icon"[^>]*>\n?/, '')
    .replace(/<link rel="icon"[^>]*>/, '<link rel="icon" href="' + icon + '">');
});

// SECTOR ZERO는 아이콘도 HTML 안에 들어 있어서 따로 바꿀 게 없어요
bundle('fps', 'sector-zero.html');
