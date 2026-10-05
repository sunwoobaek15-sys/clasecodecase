/* SAVE CITY — HOME 화면 (기획서 6) */
(function (root) {
  'use strict';
  const SC = root.SC;
  const U = SC.util;
  const D = SC.data;
  const E = SC.engine;
  const ui = SC.ui;
  const V = SC.view;
  const app = SC.app;

  let stopAnim = null;
  let rankHtml = '';

  function previewRegion(state) {
    let best = 'village';
    let most = -1;
    for (const r of D.REGIONS) {
      if (!state.regions.includes(r.id)) continue;
      const n = state.buildings.filter((b) => b.region === r.id).length;
      if (n > most) {
        most = n;
        best = r.id;
      }
    }
    return best;
  }

  function streakTrack(cur) {
    return (
      '<ol class="streak-track">' +
      D.STREAK_TRACK.map((m) => {
        const reward = D.STREAK_REWARDS[m];
        const cls = cur >= m ? 'done' : m === E.nextStreakMilestone(cur) ? 'next' : '';
        return '<li class="' + cls + '"><span class="medal" aria-hidden="true">' + (reward ? (reward.special ? '👑' : '🎁') : '🪙') + '</span><span>' + m + '일</span></li>';
      }).join('') +
      '</ol>'
    );
  }

  function rankSection() {
    const inner = SC.rankingCard ? SC.rankingCard() : '';
    rankHtml = inner;
    return '<section class="card rank-card" id="home-rank" aria-labelledby="home-rank-h"' + (inner ? '' : ' hidden') + '>' + inner + '</section>';
  }

  SC.screens.home = {
    title: () => '홈',
    render(ctx) {
      const { state, d } = ctx;
      const u = state.user;
      const region = previewRegion(state);
      const map = SC.cityArt.renderMap({ regionId: region, state, skin: state.skins.active, vehicles: true, title: '내 도시 미리보기' });
      const sky = SC.cityArt.palette(state.skins.active).sky;
      const available = D.REGIONS.filter((r) => !state.regions.includes(r.id) && d.cityLevel >= r.level);
      const recent = state.history.slice(-3).reverse();
      const goals = E.nextGoals(state, d);

      let html = '';

      html +=
        '<section class="hero" aria-label="오늘 요약">' +
        '<div class="hero-head">' +
        '<div class="hero-user"><span class="hero-avatar" aria-hidden="true">' + u.avatar + '</span><div><strong>' + U.esc(u.nickname) + '님의 도시</strong><span>' + V.titleName(u.titleId) + '</span></div></div>' +
        '<div class="hero-chips">' +
        '<button type="button" class="chip chip-coin" data-nav="history" data-tab="ledger" aria-label="현재 TOKEN ' + U.fmt(d.balance) + '개, TOKEN 내역 보기">' + ui.coin() + '<b>' + U.fmt(d.balance) + '</b></button>' +
        '<button type="button" class="chip chip-fire" data-action="app:streak" aria-label="STREAK ' + d.streak.current + '일, 자세히 보기"><span aria-hidden="true">🔥</span><b>' + d.streak.current + '</b> DAY STREAK</button>' +
        '</div></div>' +
        '<div class="hero-money">' +
        '<div class="money-tile"><span>오늘 절약</span><strong>' + U.won(d.todaySaved) + '</strong></div>' +
        '<div class="money-tile"><span>이번 달 절약</span><strong>' + U.won(d.monthSaved) + '</strong></div>' +
        '</div>' +
        '<button type="button" class="hero-city" data-nav="city" data-region="' + region + '" aria-label="도시 화면으로 가기, 도시 LEVEL ' + d.cityLevel + '" style="--sky1:' + sky[0] + ';--sky2:' + sky[1] + '">' +
        '<span class="hero-level"><small>CITY LEVEL</small><strong>' + d.cityLevel + '</strong></span>' +
        '<span class="hero-map">' + map + '</span>' +
        (state.buildings.length ? '' : '<span class="hero-map-hint">아직 빈 땅이에요. 첫 건물을 지어 보세요!</span>') +
        '</button>' +
        '<button type="button" class="btn btn-sun btn-xl btn-block" data-nav="save">' + ui.icon('plus') + '오늘 절약 기록하기</button>' +
        '</section>';
      html = '<div class="home-a">' + html + '</div><div class="home-b">';

      if (d.pendingBonuses) {
        html +=
          '<section class="card callout callout-gift">' +
          '<div class="callout-ic" aria-hidden="true">🎁</div><div class="callout-text"><h2>받지 않은 보너스가 ' + d.pendingBonuses + '개 있어요</h2><p>LUCKY BONUS 또는 CITY DISCOUNT 중 하나를 골라요.</p></div>' +
          '<button type="button" class="btn btn-sun btn-sm" data-action="app:bonus">보너스 받기</button></section>';
      }
      if (available.length) {
        const r = available[0];
        html +=
          '<section class="card callout callout-map">' +
          '<div class="callout-ic" aria-hidden="true">🗺️</div><div class="callout-text"><h2>새 지역을 열 수 있어요</h2><p>' + V.regionName(r) + '</p></div>' +
          '<button type="button" class="btn btn-primary btn-sm" data-nav="city" data-region="' + r.id + '">보러 가기</button></section>';
      }

      // 오늘
      const tokenPct = d.todayTokens / D.RULES.DAILY_TOKEN_CAP;
      html +=
        '<section class="card today" aria-labelledby="today-h">' +
        '<div class="card-head"><h2 id="today-h">오늘의 기록</h2><span class="muted">' + V.dayLabel(d.today) + '</span></div>' +
        '<div class="today-grid">' +
        '<div class="kv"><span class="label">오늘 획득 TOKEN</span><strong>' + U.fmt(d.todayTokens) + '<small> / ' + D.RULES.DAILY_TOKEN_CAP + '</small></strong></div>' +
        '<div class="kv"><span class="label">오늘 절약 금액</span><strong>' + U.won(d.todaySaved) + '</strong></div>' +
        '</div>' +
        ui.progressBar(tokenPct, { label: '오늘 획득 TOKEN', cls: 'progress-sun' }) +
        '<p class="hint">오늘 인정 금액 ' + U.won(d.todayRecognized) + ' / ' + U.won(D.RULES.DAILY_CAP) + ' · 남은 인정 금액 <b>' + U.won(d.remainingToday) + '</b>' + (d.todayBonus ? ' · 보너스 +' + U.fmt(d.todayBonus) + ' TOKEN 별도' : '') + '</p>' +
        (d.streak.recordedToday
          ? '<p class="ok-line">✓ 오늘 ' + d.todayCount + '건 기록했어요</p>'
          : '<p class="warn-line">아직 오늘 기록이 없어요. 기록하면 STREAK이 ' + (d.streak.current + 1) + '일로 늘어나요.</p>') +
        (state.coupons ? '<p class="coupon-line">🏷️ 할인 쿠폰 ' + state.coupons + '장 · 다음 건물 구매 -' + D.RULES.DISCOUNT_PERCENT + '%</p>' : '') +
        '</section>';

      // 핵심 숫자
      html +=
        '<section class="stat-grid" aria-label="내 기록 요약">' +
        '<div class="stat"><span class="label">현재 TOKEN</span><strong class="stat-coin">' + ui.coin() + U.fmt(d.balance) + '</strong></div>' +
        '<div class="stat"><span class="label">누적 절약 금액</span><strong>' + U.won(d.totalSaved) + '</strong></div>' +
        '<div class="stat"><span class="label">도시 VALUE</span><strong>' + U.fmt(d.cityValue) + '</strong></div>' +
        '<button type="button" class="stat stat-btn" data-action="app:level" aria-label="도시 LEVEL ' + d.cityLevel + ', 자세히 보기"><span class="label">도시 LEVEL ' + ui.icon('info', 'ic-xs') + '</span><strong>LV ' + d.cityLevel + '</strong>' + ui.progressBar(d.level.pct, { cls: 'progress-thin' }) + '</button>' +
        '</section>';

      // STREAK
      html +=
        '<section class="card streak-card" aria-labelledby="streak-h">' +
        '<div class="card-head"><h2 id="streak-h">연속 기록 STREAK</h2><button type="button" class="link-btn" data-action="app:streak">규칙 보기</button></div>' +
        '<div class="streak-now"><span aria-hidden="true">🔥</span><strong>' + d.streak.current + '일</strong> 연속<small>최장 ' + d.longestStreak + '일</small></div>' +
        streakTrack(d.streak.current) +
        '<p class="hint">7일 → +100 TOKEN · 14일 → +250 TOKEN · 30일 → 특별 장식품</p>' +
        '</section>';

      // 랭킹 (공유된 게임에서만)
      html += rankSection();

      // 목표
      if (goals.length) {
        html +=
          '<section class="card" aria-labelledby="goal-h"><div class="card-head"><h2 id="goal-h">다음 목표</h2></div><ul class="goal-list">' +
          goals
            .map((g) => {
              const nav = g.action === 'save' ? 'data-nav="save"' : g.action === 'shop' ? 'data-nav="shop" data-tab="' + (D.ITEM_MAP[g.itemId] ? D.ITEM_MAP[g.itemId].cat : 'building') + '"' : 'data-nav="achievements" data-tab="list"';
              return (
                '<li><button type="button" class="goal" ' + nav + '><span class="goal-ic" aria-hidden="true">' + g.icon + '</span><span class="goal-text"><strong>' + U.esc(g.title) + '</strong><small>' + U.esc(g.text) + '</small>' +
                (g.pct != null ? ui.progressBar(g.pct, { cls: 'progress-thin' }) : '') +
                '</span>' + ui.icon('next', 'ic-sm') + '</button></li>'
              );
            })
            .join('') +
          '</ul></section>';
      }

      // 최근 기록
      html += '<section class="card" aria-labelledby="recent-h"><div class="card-head"><h2 id="recent-h">최근 기록</h2>' + (state.history.length ? '<button type="button" class="link-btn" data-nav="history">전체 보기</button>' : '') + '</div>';
      html += recent.length ? '<ul class="rec-list">' + recent.map(V.recordRow).join('') + '</ul>' : '<p class="muted pad">아직 기록이 없어요. 오늘 참은 소비 하나를 기록해 보세요.</p>';
      html += '</section>';

      return html + '</div>';
    },
    /** 랭킹 데이터가 바뀌면 랭킹 카드만 바꿔요 (도시 애니메이션은 그대로) */
    live(rootEl) {
      const el = rootEl.querySelector('#home-rank');
      if (!el) return;
      const inner = SC.rankingCard ? SC.rankingCard() : '';
      if (inner === rankHtml) return;
      rankHtml = inner;
      app.keepFocus(el, () => (el.innerHTML = inner));
      el.hidden = !inner;
    },
    mount(rootEl) {
      const svg = rootEl.querySelector('.hero-map svg');
      stopAnim = SC.cityArt.animate(svg, () => app.state.settings.animation && document.visibilityState !== 'hidden');
    },
    unmount() {
      if (stopAnim) stopAnim();
      stopAnim = null;
    },
  };
})(window);
