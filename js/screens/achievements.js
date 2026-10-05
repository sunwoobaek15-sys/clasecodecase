/* SAVE CITY — 업적(기획서 18)과 도감(기획서 20) */
(function (root) {
  'use strict';
  const SC = root.SC;
  const U = SC.util;
  const D = SC.data;
  const E = SC.engine;
  const ui = SC.ui;
  const V = SC.view;
  const app = SC.app;

  const UNIT = {
    totalRecognized: 'won',
    maxDayRecognized: 'won',
    maxSingle: 'won',
    collectionPct: '%',
    longestStreak: '일',
    records: '회',
    smallSaves: '회',
    categories: '가지',
    memos: '개',
    photos: '개',
    checkins: '회',
    buildings: '채',
    upgrades: '회',
    maxBuildingLevel: 'Lv',
    decorations: '개',
    vehicles: '대',
    landmarks: '개',
    cityValue: '',
    cityLevel: 'LV',
    regions: '곳',
    skins: '개',
    spent: ' TOKEN',
    saveTokens: ' TOKEN',
  };

  function fmtMetric(metric, v) {
    const u = UNIT[metric];
    if (u === 'won') return U.won(v);
    if (u === 'Lv') return 'Lv.' + v;
    if (u === 'LV') return 'LV ' + v;
    return U.fmt(v) + (u || '');
  }

  function achCard(state, d, a) {
    const p = E.achievementProgress(state, a, d);
    return (
      '<article class="ach' + (p.done ? ' done' : '') + '">' +
      '<div class="ach-badge" aria-hidden="true">' + a.icon + '</div>' +
      '<div class="ach-body"><h3>' + a.name + (p.done ? ' <span class="ach-check" aria-label="달성">✓</span>' : '') + '</h3><p class="ach-desc">' + a.desc + '</p>' +
      (p.done
        ? '<p class="ach-date">' + U.dotDate(U.dateKey(new Date(p.at))) + ' 달성</p>'
        : ui.progressBar(p.pct, { cls: 'progress-thin', label: a.name + ' 진행률' }) + '<p class="ach-prog">' + fmtMetric(a.metric, p.value) + ' / ' + fmtMetric(a.metric, a.target) + '</p>') +
      '<p class="ach-reward">🎁 ' + V.rewardText(a.reward) + '</p>' +
      '</div></article>'
    );
  }

  function listHtml(state, d) {
    const total = D.ACHIEVEMENTS.length;
    let html =
      '<div class="card ach-summary"><div><span class="label">달성한 업적</span><strong>' + d.achievementsCount + '<small> / ' + total + '</small></strong></div>' +
      ui.progressBar(d.achievementsCount / total, { label: '업적 달성률' }) +
      '<p class="hint">업적을 달성할 때마다 도시 경험치 +15도 받아요.</p></div>';
    for (const g of D.ACHIEVEMENT_GROUPS) {
      const list = D.ACHIEVEMENTS.filter((a) => a.group === g.id);
      const done = list.filter((a) => state.achievements[a.id]).length;
      html += '<h2 class="group-title">' + g.label + ' <small>' + done + '/' + list.length + '</small></h2><div class="ach-grid">' + list.map((a) => achCard(state, d, a)).join('') + '</div>';
    }
    return html;
  }

  function dexHtml(state, d) {
    const col = d.collection;
    const skin = state.skins.active;
    let html =
      '<div class="card ach-summary"><div><span class="label">도감 완성률</span><strong>' + col.pct + '<small>% (' + col.owned + '/' + col.total + ')</small></strong></div>' +
      ui.progressBar(col.pct / 100, { label: '도감 완성률' }) +
      '<p class="hint">한 번이라도 가져 본 아이템은 도감에 기록돼요.</p></div>';
    html +=
      '<div class="dex-cats">' +
      D.COLLECTION_GROUPS.map((g) => {
        const s = col.groups[g.id];
        return '<div class="dex-cat"><span>' + g.label + '</span><b>' + s.pct + '%</b>' + ui.progressBar(s.pct / 100, { cls: 'progress-thin' }) + '</div>';
      }).join('') +
      '</div>';
    for (const g of D.COLLECTION_GROUPS) {
      const items = D.ITEMS.filter((i) => i.cat === g.id && E.COLLECTIBLE.includes(i.id));
      const s = col.groups[g.id];
      html +=
        '<h2 class="group-title">' + g.label + ' <small>' + s.owned + '/' + s.total + ' · ' + s.pct + '%</small></h2><div class="dex-grid">' +
        items
          .map((i) => {
            const owned = !!state.collection[i.id];
            return (
              '<div class="dex-item' + (owned ? ' owned' : '') + '">' + V.thumb(i.id, i.cat === 'building' ? 1 : 1, i.cat === 'skin' ? i.id : skin, owned ? '' : 'silhouette') +
              '<strong>' + i.name + '</strong><small>' + (owned ? '✓ 수집 완료' : U.esc(E.unlockRule(i))) + '</small></div>'
            );
          })
          .join('') +
        '</div>';
    }
    return html;
  }

  function render(ctx) {
    const { state, d } = ctx;
    const tab = app.view.achTab === 'dex' ? 'dex' : 'list';
    let html = V.pageHead('업적 & 도감', '목표를 이루면 배지, TOKEN, 특별 장식, 프로필 칭호를 받아요.', { back: 'profile' });
    html +=
      '<div class="seg" role="tablist" aria-label="업적과 도감">' +
      '<button type="button" role="tab" aria-selected="' + (tab === 'list') + '" class="seg-btn' + (tab === 'list' ? ' on' : '') + '" data-action="ach:tab" data-tab="list">업적 ' + d.achievementsCount + '/' + D.ACHIEVEMENTS.length + '</button>' +
      '<button type="button" role="tab" aria-selected="' + (tab === 'dex') + '" class="seg-btn' + (tab === 'dex' ? ' on' : '') + '" data-action="ach:tab" data-tab="dex">도감 ' + d.collection.pct + '%</button>' +
      '</div>';
    html += tab === 'list' ? listHtml(state, d) : dexHtml(state, d);
    return html;
  }

  app.actions['ach:tab'] = (btn) => {
    app.view.achTab = btn.dataset.tab;
    SC.audio.play('tap');
    app.render();
  };

  SC.screens.achievements = { title: () => '업적 & 도감', render };
})(window);
