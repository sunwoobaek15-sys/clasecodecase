/* SAVE CITY — PROFILE 화면: 닉네임, 캐릭터, 칭호, 메뉴 */
(function (root) {
  'use strict';
  const SC = root.SC;
  const U = SC.util;
  const D = SC.data;
  const E = SC.engine;
  const ui = SC.ui;
  const V = SC.view;
  const app = SC.app;

  function render(ctx) {
    const { state, d } = ctx;
    const u = state.user;
    const recentAch = D.ACHIEVEMENTS.filter((a) => state.achievements[a.id])
      .sort((a, b) => String(state.achievements[b.id]).localeCompare(String(state.achievements[a.id])))
      .slice(0, 8);
    let html =
      '<section class="profile-card">' +
      '<div class="avatar-big" aria-hidden="true">' + u.avatar + '</div>' +
      '<div class="profile-text"><h1>' + U.esc(u.nickname) + '</h1><p class="title-chip">🏅 ' + V.titleName(u.titleId) + '</p></div>' +
      '<button type="button" class="btn btn-secondary btn-sm" data-action="profile:edit">' + ui.icon('edit') + '편집</button>' +
      '</section>';
    html +=
      '<section class="tiles tiles-4" aria-label="내 도시 요약">' +
      '<button type="button" class="tile" data-action="app:level"><span class="label">도시 LEVEL</span><strong>LV ' + d.cityLevel + '</strong></button>' +
      '<button type="button" class="tile" data-nav="achievements" data-tab="list"><span class="label">업적</span><strong>' + d.achievementsCount + '/' + D.ACHIEVEMENTS.length + '</strong></button>' +
      '<button type="button" class="tile" data-nav="achievements" data-tab="dex"><span class="label">도감</span><strong>' + d.collection.pct + '%</strong></button>' +
      '<button type="button" class="tile" data-action="app:streak"><span class="label">최장 STREAK</span><strong>' + d.longestStreak + '일</strong></button>' +
      '</section>';
    html +=
      '<nav class="card menu" aria-label="더 보기">' +
      '<button type="button" class="menu-row" data-nav="history">' + ui.icon('history') + '<span>히스토리 <small>HISTORY</small></span><em>' + U.fmt(d.records) + '건</em>' + ui.icon('next', 'ic-sm') + '</button>' +
      '<button type="button" class="menu-row" data-nav="achievements">' + ui.icon('trophy') + '<span>업적 & 도감 <small>ACHIEVEMENTS</small></span><em>' + d.achievementsCount + '개</em>' + ui.icon('next', 'ic-sm') + '</button>' +
      '<button type="button" class="menu-row" data-nav="stats">' + ui.icon('chart') + '<span>통계 <small>STATS</small></span>' + ui.icon('next', 'ic-sm') + '</button>' +
      '<button type="button" class="menu-row" data-nav="settings">' + ui.icon('gear') + '<span>설정 <small>SETTINGS</small></span>' + ui.icon('next', 'ic-sm') + '</button>' +
      '</nav>';
    html += '<section class="card" aria-labelledby="badge-h"><div class="card-head"><h2 id="badge-h">최근 받은 배지</h2><button type="button" class="link-btn" data-nav="achievements" data-tab="list">전체 보기</button></div>';
    html += recentAch.length
      ? '<ul class="badge-row">' + recentAch.map((a) => '<li title="' + a.name + '"><span aria-hidden="true">' + a.icon + '</span><small>' + a.name + '</small></li>').join('') + '</ul>'
      : '<p class="muted pad">아직 받은 배지가 없어요. 첫 절약을 기록하면 첫 배지를 받아요!</p>';
    html += '</section>';
    return html;
  }

  app.actions['profile:edit'] = () => {
    const state = app.state;
    const titles = E.unlockedTitles(state);
    const body =
      '<div class="field"><label for="p-nick">닉네임 <span class="opt">(최대 ' + D.RULES.NICK_MAX + '자)</span></label><input class="input" id="p-nick" maxlength="' + D.RULES.NICK_MAX + '" value="' + U.esc(state.user.nickname) + '" autocomplete="nickname"><p class="field-error" id="e-nick" hidden></p></div>' +
      '<div class="field"><span class="label">캐릭터</span><div class="avatar-grid" role="radiogroup" aria-label="캐릭터">' +
      D.AVATARS.map((a) => '<label class="avatar-opt"><input type="radio" name="p-avatar" value="' + a + '"' + (a === state.user.avatar ? ' checked' : '') + '><span>' + a + '</span></label>').join('') +
      '</div></div>' +
      '<div class="field"><span class="label">칭호 <span class="opt">(업적으로 얻어요)</span></span><div class="title-grid" role="radiogroup" aria-label="칭호">' +
      D.TITLES.map((t) => {
        const has = titles.includes(t.id);
        const src = D.ACHIEVEMENTS.find((a) => a.reward.title === t.id);
        return (
          '<label class="title-opt' + (has ? '' : ' locked') + '"><input type="radio" name="p-title" value="' + t.id + '"' + (t.id === state.user.titleId ? ' checked' : '') + (has ? '' : ' disabled') + '><span>' + (has ? '' : '🔒 ') + t.name + '</span>' +
          (has || !src ? '' : '<small>업적 \'' + src.name + '\'</small>') + '</label>'
        );
      }).join('') +
      '</div></div>';
    ui.sheet({
      title: '프로필 편집',
      body,
      actions: [
        { label: '취소', kind: 'secondary' },
        {
          label: '저장',
          kind: 'primary',
          onClick: (close, dialog) => {
            const nick = dialog.querySelector('#p-nick').value;
            if (!U.cleanText(nick, D.RULES.NICK_MAX)) {
              const err = dialog.querySelector('#e-nick');
              err.textContent = '닉네임을 1자 이상 입력해 주세요.';
              err.hidden = false;
              dialog.querySelector('#p-nick').focus();
              SC.audio.play('error');
              return false;
            }
            const avatar = (dialog.querySelector('input[name="p-avatar"]:checked') || {}).value;
            const titleId = (dialog.querySelector('input[name="p-title"]:checked') || {}).value;
            const patch = { nickname: nick };
            if (avatar) patch.avatar = avatar;
            if (titleId) patch.titleId = titleId;
            const res = app.commit((s, now) => E.updateProfile(s, patch, now));
            if (!res) return false;
            SC.audio.play('success');
            ui.toast('프로필을 저장했어요.', { type: 'success', icon: '✨' });
          },
        },
      ],
    });
  };

  SC.screens.profile = { title: () => '프로필', render };
})(window);
