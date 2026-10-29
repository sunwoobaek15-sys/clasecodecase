/* 화면 전환: 주소의 # 뒷부분으로 화면을 고른다.
 *   #/menu            메인 메뉴
 *   #/records         플레이 기록
 *   #/play/kimchi-run 게임 실행 */
(function (KK) {
  'use strict';

  let root = null;
  let session = null;
  let current = '';

  function parse() {
    const h = location.hash.replace(/^#\/?/, '');
    const parts = h.split('/');
    if (parts[0] === 'play' && parts[1]) return { name: 'play', id: parts[1] };
    if (parts[0] === 'records') return { name: 'records' };
    return { name: 'menu' };
  }

  function render() {
    const r = parse();
    if (session) {
      session.destroy();
      session = null;
    }
    root.innerHTML = '';
    window.scrollTo(0, 0);
    document.body.classList.toggle('in-game', r.name === 'play');
    if (r.name === 'play') {
      session = KK.games.mount(root, r.id);
      if (!session) {
        go('menu');
        return;
      }
    } else {
      KK.screens[r.name](root);
    }
    current = r.name;
  }

  function go(path) {
    const target = '#/' + path;
    if (location.hash === target) render();
    else location.hash = target;
  }

  KK.router = {
    start(el) {
      root = el;
      window.addEventListener('hashchange', render);
      // 메뉴/기록 화면에서 언어를 바꾸면 바로 다시 그린다
      KK.i18n.onChange(() => {
        if (current !== 'play') render();
      });
      render();
    },
    go,
    refresh() {
      if (current !== 'play') render();
    },
    get current() {
      return current;
    },
  };
})(window.KK);
