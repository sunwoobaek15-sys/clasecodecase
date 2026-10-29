/* 저장 관리: 설정, 게임별 기록, 배지를 브라우저 localStorage 에 저장한다.
 * 저장소를 쓸 수 없는 환경(비공개 창 등)에서도 게임은 정상 동작한다. */
(function (KK) {
  'use strict';

  const KEY = 'kkparty.save.v1';
  const defaults = () => ({ version: 1, lang: 'en', sound: true, games: {}, badges: {} });
  let data = defaults();

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        data = Object.assign(defaults(), parsed);
        if (!data.games || typeof data.games !== 'object') data.games = {};
        if (!data.badges || typeof data.badges !== 'object') data.badges = {};
      }
    } catch (e) {
      data = defaults();
    }
  }

  function write() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      /* 저장 실패는 무시 (게임 진행에는 영향 없음) */
    }
  }

  function gameStats(id) {
    return Object.assign({ plays: 0, completions: 0, best: 0, bestTime: null }, data.games[id]);
  }

  KK.save = {
    load() {
      read();
      return data;
    },
    get lang() {
      return data.lang === 'ko' ? 'ko' : 'en';
    },
    setLang(l) {
      data.lang = l;
      write();
    },
    get sound() {
      return data.sound !== false;
    },
    setSound(on) {
      data.sound = !!on;
      write();
    },
    gameStats,
    hasBadge(id) {
      return !!data.badges[id];
    },

    /** 한 판의 결과를 저장하고 최고 기록/새 배지 정보를 돌려준다. */
    record(gameId, result, badgeDefs) {
      const s = gameStats(gameId);
      const prevBest = s.best;
      s.plays += 1;
      if (result.completed) {
        s.completions += 1;
        if (typeof result.time === 'number') {
          const tm = Math.round(result.time * 10) / 10;
          if (s.bestTime == null || tm < s.bestTime) s.bestTime = tm;
        }
      }
      const isBest = result.score > prevBest;
      if (isBest) s.best = result.score;
      data.games[gameId] = s;

      const newBadges = [];
      (badgeDefs || []).forEach((b) => {
        if (!data.badges[b.id] && b.test(result)) {
          data.badges[b.id] = Date.now();
          newBadges.push(b);
        }
      });
      write();
      return { isBest, prevBest, best: s.best, newBadges };
    },

    reset() {
      const { lang, sound } = data;
      data = defaults();
      data.lang = lang;
      data.sound = sound;
      write();
    },
  };
})(window.KK);
