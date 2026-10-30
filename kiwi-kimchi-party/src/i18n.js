/* Kiwi & Kimchi Party — 번역(영어 기본, 한국어 선택)
 * 각 게임 파일은 KK.i18n.add({ en: {...}, ko: {...} }) 로 자기 문장을 추가한다. */
window.KK = window.KK || {};

(function (KK) {
  'use strict';

  const dict = { en: {}, ko: {} };
  const listeners = [];
  let lang = 'en';

  KK.i18n = {
    add(strings) {
      for (const l in strings) {
        dict[l] = dict[l] || {};
        Object.assign(dict[l], strings[l]);
      }
    },
    t(key, vars) {
      let s = dict[lang][key];
      if (s == null) s = dict.en[key];
      if (s == null) return key;
      if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
      return s;
    },
    get lang() {
      return lang;
    },
    setLang(l) {
      if (!dict[l] || l === lang) return;
      lang = l;
      document.documentElement.lang = l;
      listeners.forEach((fn) => fn(l));
    },
    onChange(fn) {
      listeners.push(fn);
      return () => listeners.splice(listeners.indexOf(fn), 1);
    },
  };

  KK.i18n.add({
    en: {
      'app.tagline': 'Korea × New Zealand culture mini-games',
      'menu.chooseGame': 'Choose a game',
      'menu.play': 'PLAY',
      'menu.soon': 'Coming soon',
      'menu.records': 'Records',
      'menu.sound': 'Sound',
      'menu.on': 'On',
      'menu.off': 'Off',
      'menu.langSwitch': '한국어',
      'menu.langAria': 'Change language to Korean',
      'menu.best': 'Best {score}',
      'menu.noRecord': 'No record yet',
      'menu.progress': 'Party progress',
      'menu.gamesDone': '{n}/{total} games completed',
      'menu.badgesDone': '{n}/{total} badges',
      'menu.footer': 'Made for students in Korea and New Zealand to play and learn together.',
      'tag.korea': 'Korea',
      'tag.nz': 'New Zealand',

      'game.kimchi-run.name': 'Kimchi Run',
      'game.kimchi-run.desc':
        'Dash through a Korean market lane, dodge crates and onggi jars, collect cabbage, radish, garlic, chili powder and salt — then mix your own kimchi!',
      'game.pavlova-dash.name': 'Pavlova Dash',
      'game.pavlova-dash.desc':
        'Catch falling meringue, cream and fresh fruit to build a pavlova, a summer dessert loved across New Zealand.',
      'game.palace-builder.name': 'Palace Builder',
      'game.palace-builder.desc':
        'Gather roof tiles, timber and painted decorations, then place them to raise a traditional Korean palace hall.',
      'game.kiwi-forest-rescue.name': 'Kiwi Forest Rescue',
      'game.kiwi-forest-rescue.desc':
        'Explore a native forest, gather food and nest materials, and make a safe home for the kiwi — a bird that cannot fly.',

      'hud.score': 'Score',
      'hud.time': 'Time',
      'hud.pause': 'Pause',
      'hud.lives': 'Hearts',
      'pause.title': 'Paused',
      'pause.resume': 'Resume',
      'pause.restart': 'Restart',
      'pause.quit': 'Main menu',
      'intro.start': 'START',
      'intro.back': 'Back',
      'intro.goal': 'Goal',
      'intro.collect': 'Collect',
      'intro.controls': 'Controls',
      'intro.keyboard': 'Keyboard',
      'intro.touch': 'Touch',
      'count.go': 'GO!',
      'result.score': 'Score',
      'result.best': 'Best',
      'result.newBest': 'NEW BEST!',
      'result.again': 'Play again',
      'result.menu': 'Main menu',
      'result.newBadges': 'Badge unlocked!',
      'result.didYouKnow': 'Did you know?',
      'result.time': 'Time',
      'ctrl.left': 'Move left',
      'ctrl.right': 'Move right',
      'ctrl.jump': 'JUMP',
      'ctrl.mix': 'MIX',
      'ctrl.drop': 'DROP',
      'ctrl.place': 'PLACE',
      'tip.rotate': 'Tip: turn your device sideways for a bigger view.',

      'records.title': 'Records',
      'records.back': 'Back',
      'records.best': 'Best score',
      'records.plays': 'Plays',
      'records.completions': 'Completed',
      'records.bestTime': 'Fastest finish',
      'records.badges': 'Badges',
      'records.locked': 'Locked',
      'records.reset': 'Reset all records',
      'records.resetTitle': 'Reset records?',
      'records.resetConfirm': 'This deletes every score, record and badge saved on this device.',
      'records.resetYes': 'Delete',
      'records.cancel': 'Cancel',
      'records.notYet': 'This game is coming soon.',
      'records.seconds': '{s}s',
      'records.none': '—',
      'records.saved': 'Records are saved on this device only.',
    },
    ko: {
      'app.tagline': '한국 × 뉴질랜드 문화 체험 미니게임',
      'menu.chooseGame': '게임을 골라 주세요',
      'menu.play': '플레이',
      'menu.soon': '준비 중',
      'menu.records': '기록',
      'menu.sound': '소리',
      'menu.on': '켜짐',
      'menu.off': '꺼짐',
      'menu.langSwitch': 'English',
      'menu.langAria': '언어를 영어로 바꾸기',
      'menu.best': '최고 {score}점',
      'menu.noRecord': '아직 기록 없음',
      'menu.progress': '파티 진행도',
      'menu.gamesDone': '게임 {n}/{total}개 완료',
      'menu.badgesDone': '배지 {n}/{total}개',
      'menu.footer': '한국과 뉴질랜드 학생들이 함께 놀며 배우도록 만들었어요.',
      'tag.korea': '한국',
      'tag.nz': '뉴질랜드',

      'game.kimchi-run.name': '김치 런',
      'game.kimchi-run.desc':
        '한국 시장 골목을 달리며 나무 상자와 옹기를 피하고 배추·무·마늘·고춧가루·소금을 모아 직접 김치를 버무려요!',
      'game.pavlova-dash.name': '파블로바 대시',
      'game.pavlova-dash.desc': '떨어지는 머랭, 크림, 신선한 과일을 받아 뉴질랜드에서 사랑받는 여름 디저트 파블로바를 완성해요.',
      'game.palace-builder.name': '궁궐 짓기',
      'game.palace-builder.desc': '기와, 목재, 단청 장식을 모아 제자리에 놓고 한국 전통 궁궐 전각을 세워요.',
      'game.kiwi-forest-rescue.name': '키위 숲 구조대',
      'game.kiwi-forest-rescue.desc': '뉴질랜드 숲을 탐험하며 먹이와 둥지 재료를 모아 날지 못하는 새, 키위의 안전한 보금자리를 만들어요.',

      'hud.score': '점수',
      'hud.time': '시간',
      'hud.pause': '일시정지',
      'hud.lives': '하트',
      'pause.title': '일시정지',
      'pause.resume': '계속하기',
      'pause.restart': '다시 하기',
      'pause.quit': '메인 메뉴',
      'intro.start': '시작',
      'intro.back': '뒤로',
      'intro.goal': '목표',
      'intro.collect': '모을 재료',
      'intro.controls': '조작법',
      'intro.keyboard': '키보드',
      'intro.touch': '터치',
      'count.go': '출발!',
      'result.score': '점수',
      'result.best': '최고 기록',
      'result.newBest': '최고 기록!',
      'result.again': '다시 하기',
      'result.menu': '메인 메뉴',
      'result.newBadges': '새 배지 획득!',
      'result.didYouKnow': '알고 있나요?',
      'result.time': '시간',
      'ctrl.left': '왼쪽으로',
      'ctrl.right': '오른쪽으로',
      'ctrl.jump': '점프',
      'ctrl.mix': '섞기',
      'ctrl.drop': '놓기',
      'ctrl.place': '넣기',
      'tip.rotate': '팁: 기기를 가로로 돌리면 화면이 더 크게 보여요.',

      'records.title': '플레이 기록',
      'records.back': '뒤로',
      'records.best': '최고 점수',
      'records.plays': '플레이 횟수',
      'records.completions': '완성 횟수',
      'records.bestTime': '최단 완성',
      'records.badges': '배지',
      'records.locked': '잠김',
      'records.reset': '기록 모두 지우기',
      'records.resetTitle': '기록을 지울까요?',
      'records.resetConfirm': '이 기기에 저장된 점수, 기록, 배지가 모두 지워져요.',
      'records.resetYes': '지우기',
      'records.cancel': '취소',
      'records.notYet': '곧 추가될 게임이에요.',
      'records.seconds': '{s}초',
      'records.none': '—',
      'records.saved': '기록은 이 기기에만 저장돼요.',
    },
  });
})(window.KK);
