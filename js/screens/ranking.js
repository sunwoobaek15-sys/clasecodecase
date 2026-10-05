/* SAVE CITY — 랭킹 화면: 이번 주·누적·도시·STREAK 순위, 참가와 나가기 */
(function (root) {
  'use strict';
  const SC = root.SC;
  const U = SC.util;
  const K = SC.rank;
  const ui = SC.ui;
  const V = SC.view;
  const app = SC.app;

  const SHOW_MAX = 100;
  let busy = false;
  let lastBody = '';

  function R() {
    return SC.ranking;
  }

  function catId() {
    return K.CAT_MAP[app.view.rankCat] ? app.view.rankCat : 'week';
  }

  function valueText(cat, v) {
    if (cat === 'week' || cat === 'total') return U.won(v);
    if (cat === 'city') return 'LV ' + v;
    return v + '일';
  }

  function subText(cat, e) {
    if (cat === 'week') return '누적 ' + U.won(e.total);
    if (cat === 'total') return '절약한 날 ' + U.fmt(e.saveDays) + '일';
    if (cat === 'city') return '도시 가치 ' + U.fmt(e.value);
    return '최장 ' + e.longest + '일';
  }

  function medal(rank) {
    return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
  }

  /** 순위 한 줄 (닉네임은 다른 사람이 쓴 글이라 꼭 esc) */
  function row(r, cat, me) {
    const e = r.entry;
    const m = medal(r.rank);
    const mine = r.id === me;
    return (
      '<li class="rank-row' + (mine ? ' me' : '') + '"' + (mine ? ' aria-current="true"' : '') + '>' +
      '<span class="rank-no' + (m ? ' medal' : '') + '"><span class="sr-only">' + r.rank + '위</span><span aria-hidden="true">' + (m || r.rank) + '</span></span>' +
      '<span class="rank-av" aria-hidden="true">' + e.avatar + '</span>' +
      '<span class="rank-name"><b>' + U.esc(e.nick) + (mine ? ' <em class="me-tag">나</em>' : '') + '</b><small>' + V.titleName(e.title) + ' · ' + subText(cat, e) + '</small></span>' +
      '<span class="rank-val">' + valueText(cat, r.value) + '</span>' +
      '</li>'
    );
  }

  function rowsHtml(rows, cat, me, limit) {
    const top = rows.slice(0, limit);
    let html = '<ol class="rank-list">' + top.map((r) => row(r, cat, me)).join('') + '</ol>';
    const mine = rows.find((r) => r.id === me);
    if (mine && !top.includes(mine)) html += '<p class="rank-gap" aria-hidden="true">⋯</p><ol class="rank-list">' + row(mine, cat, me) + '</ol>';
    return html;
  }

  function time(iso) {
    const d = new Date(iso);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  /** 관리자 판정과 자동 숨김 안내 */
  function noticeHtml(my) {
    let html = '';
    const m = my.mod;
    const reason = m && m.reason ? K.MOD_REASON_MAP[m.reason].label : '';
    const msg = m && m.message ? '<span class="notice-msg">“' + U.esc(m.message) + '”</span>' : '';
    if (m && m.status === 'hidden') {
      html += '<div class="notice notice-danger" role="status"><b>🚫 관리자가 랭킹에서 제외했어요</b><span>' + U.esc(reason) + ' · 다른 사람에게 내 순위가 보이지 않아요.</span>' + msg + '</div>';
    } else if (m && m.status === 'warned') {
      html += '<div class="notice notice-warn" role="status"><b>⚠️ 관리자 경고</b><span>' + U.esc(reason) + '</span>' + msg + '</div>';
    }
    if (my.vis && my.vis.reason === 'auto') {
      html +=
        '<div class="notice notice-warn" role="status"><b>🔎 확인이 필요해서 랭킹에 잠시 숨겨졌어요</b>' +
        '<ul>' + my.vis.flags.filter((f) => f.level === 'high').map((f) => '<li>' + f.text + '</li>').join('') + '</ul>' +
        '<span>관리자가 확인하면 다시 보여요.</span></div>';
    }
    return html;
  }

  function myCard(cat) {
    const rk = R();
    const my = rk.mine(cat);
    const block = rk.joinBlockReason();
    if (!my.joined) {
      let html =
        '<section class="card rank-me" aria-labelledby="rank-me-h">' +
        '<div class="card-head"><h2 id="rank-me-h">랭킹에 참가하기</h2></div>' +
        '<p class="small">닉네임과 캐릭터, 도시 LEVEL, STREAK, 인정된 절약 금액이 이 게임을 함께 보는 사람들에게 공개돼요.</p>' +
        (block ? '<p class="warn-line">' + block + '</p>' : '') +
        '<button type="button" class="btn btn-sun btn-block" data-action="rank:join"' + (block || busy ? ' disabled' : '') + '>' + (busy ? '참가하는 중…' : '🏆 랭킹 참가하기') + '</button>';
      if (my.entry) html += '<p class="hint">예전에 올린 내 랭킹 기록이 남아 있어요. <button type="button" class="link-btn" data-action="rank:remove-mine"' + (busy ? ' disabled' : '') + '>내 기록 지우기</button></p>';
      return html + '</section>';
    }
    const s = app.state;
    const u = s.user;
    let big;
    if (!my.entry) big = '<strong class="rank-big muted">올리는 중…</strong>';
    else if (my.vis && my.vis.reason === 'hidden') big = '<strong class="rank-big danger-text">제외됨</strong>';
    else if (my.vis && my.vis.reason === 'auto') big = '<strong class="rank-big warn-text">확인 대기</strong>';
    else if (my.rank) big = '<strong class="rank-big">' + my.rank + '<small>위</small></strong><small class="rank-of">' + my.count + '명 중</small>';
    else big = '<strong class="rank-big muted">–</strong>';
    const sync = rk.syncing
      ? '<p class="hint">⏳ 랭킹에 올리는 중…</p>'
      : rk.syncError
        ? '<p class="warn-line">' + rk.errorText(rk.syncError) + '</p>'
        : s.ranking.lastSyncAt
          ? '<p class="ok-line">✓ 랭킹에 반영됨 · ' + time(s.ranking.lastSyncAt) + '</p>'
          : '';
    return (
      '<section class="card rank-me" aria-labelledby="rank-me-h">' +
      '<div class="card-head"><h2 id="rank-me-h">내 순위 · ' + K.CAT_MAP[cat].label + '</h2><span class="chip chip-tag">참가 중</span></div>' +
      '<div class="rank-mine"><span class="rank-av big" aria-hidden="true">' + u.avatar + '</span><span class="rank-name"><b>' + U.esc(u.nickname) + '</b><small>' + V.titleName(u.titleId) + '</small></span><span class="rank-mine-no">' + big + '</span></div>' +
      noticeHtml(my) +
      sync +
      '<div class="btn-row"><button type="button" class="btn btn-secondary btn-sm" data-action="rank:sync"' + (rk.syncing || busy ? ' disabled' : '') + '>지금 반영하기</button>' +
      '<button type="button" class="link-btn danger-link" data-action="rank:leave"' + (busy ? ' disabled' : '') + '>랭킹 나가기</button></div>' +
      '</section>'
    );
  }

  function boardCard(cat) {
    const rk = R();
    const c = K.CAT_MAP[cat];
    let html = '<section class="card" aria-labelledby="board-h"><div class="card-head"><h2 id="board-h">' + c.title + '</h2>';
    if (!rk.loaded.ranking) return html + '</div><p class="muted pad">랭킹을 불러오는 중…</p></section>';
    const rows = rk.board(cat);
    html += '<span class="muted">' + rows.length + '명</span></div><p class="hint">' + c.desc + '</p>';
    if (rk.listenError) html += '<p class="warn-line">랭킹을 새로 받아오지 못하고 있어요. 잠시 뒤에 다시 확인할게요.</p>';
    html += rows.length ? rowsHtml(rows, cat, rk.me, SHOW_MAX) : V.empty('🏆', '아직 랭킹에 오른 사람이 없어요', '첫 번째로 참가해서 1위를 차지해 보세요!');
    return html + '</section>';
  }

  function adminCard() {
    const rk = R();
    if (!rk.isOwner) return '';
    const total = rk.players().length;
    const review = rk.reviewCount();
    return (
      '<section class="card callout callout-admin">' +
      '<div class="callout-ic" aria-hidden="true">🛡️</div><div class="callout-text"><h2>관리자 모드</h2><p>참가자 ' + total + '명' + (review ? ' · <b>확인 필요 ' + review + '명</b>' : ' · 확인할 사람 없음') + '</p></div>' +
      '<button type="button" class="btn btn-primary btn-sm" data-nav="admin">열기</button></section>'
    );
  }

  const RULES_HTML =
    '<section class="card" aria-labelledby="fair-h"><h2 class="sub" id="fair-h">공정한 랭킹 규칙</h2><ul class="rule-list muted-list">' +
    '<li>순위는 <b>인정 금액</b>(하루 최대 50,000원) 기준이라 큰 금액을 적어도 순위가 더 오르지 않아요.</li>' +
    '<li>기기 시계를 바꾸거나 저장 데이터를 직접 고친 흔적, 게임 규칙으로는 나올 수 없는 숫자가 보이면 자동으로 랭킹에서 숨기고 관리자가 확인해요.</li>' +
    '<li>관리자(이 게임을 공유한 사람)는 부정 사용 확인을 위해 참가자의 최근 절약 기록(항목·금액·날짜·시각)을 볼 수 있어요. 이유·메모·사진은 보내지 않아요.</li>' +
    '<li>TOKEN은 게임 속 포인트예요. 랭킹에는 상금이나 실제 돈이 없어요.</li>' +
    '</ul></section>';

  function body() {
    const rk = R();
    const status = rk ? rk.status : 'none';
    if (status === 'none') {
      return (
        '<section class="card">' +
        V.empty('🏆', '랭킹은 공유된 SAVE CITY에서 열려요', '이 버전은 기록을 이 기기 안에만 저장해요. 친구와 랭킹을 겨루려면 Claude에서 공유받은 SAVE CITY 링크로 들어와 주세요.', '<button type="button" class="btn btn-secondary" data-nav="home">홈으로</button>') +
        '</section>'
      );
    }
    if (status === 'loading') return '<section class="card"><p class="muted pad center">랭킹에 연결하는 중…</p></section>';
    if (status === 'off') {
      return '<section class="card">' + V.empty('🔌', '지금은 랭킹을 쓸 수 없어요', 'Claude에 로그인한 상태에서 공유받은 링크로 열어 주세요. 기록과 도시는 이 기기에 그대로 저장돼요.') + '</section>';
    }
    const cat = catId();
    const tabs =
      '<div class="seg" role="tablist" aria-label="랭킹 종류">' +
      K.CATS.map((c) => '<button type="button" role="tab" aria-selected="' + (c.id === cat) + '" class="seg-btn' + (c.id === cat ? ' on' : '') + '" data-action="rank:cat" data-cat="' + c.id + '">' + c.label + '</button>').join('') +
      '</div>';
    return myCard(cat) + adminCard() + tabs + boardCard(cat) + RULES_HTML;
  }

  function render() {
    lastBody = body();
    return V.pageHead('랭킹', '절약 습관을 함께 겨뤄요', { back: 'profile' }) + '<div class="rank-body" id="rank-body">' + lastBody + '</div>';
  }

  function live(main) {
    const el = main.querySelector('#rank-body');
    if (!el) return;
    const html = body();
    if (html === lastBody) return;
    lastBody = html;
    app.keepFocus(el, () => (el.innerHTML = html));
  }

  function refresh() {
    if (app.route.name === 'ranking') live(document.getElementById('screen'));
  }

  /* ---------------- 행동 ---------------- */

  app.actions['rank:cat'] = (btn) => {
    app.view.rankCat = btn.dataset.cat;
    SC.audio.play('tap');
    refresh();
    const tab = document.querySelector('#rank-body [data-cat="' + app.view.rankCat + '"]');
    if (tab) tab.focus({ preventScroll: true });
  };

  app.actions['rank:join'] = () => {
    const rk = R();
    const block = rk.joinBlockReason();
    if (block) {
      ui.toast(block, { type: 'error', duration: 6000 });
      return;
    }
    const sec = app.state.security;
    const hasTrace = sec.tamperCount > 0 || sec.clockBack > 0 || K.timeReversals(app.state.history) > 0;
    ui.open({
      title: '랭킹에 참가할까요?',
      className: 'dialog-join',
      body:
        '<ul class="share-list">' +
        '<li><span aria-hidden="true">🌏</span><div><b>모두에게 공개</b><small>닉네임, 캐릭터, 칭호, 도시 LEVEL·가치, STREAK, 이번 주·누적 인정 금액</small></div></li>' +
        '<li><span aria-hidden="true">🛡️</span><div><b>관리자만 볼 수 있음</b><small>최근 절약 기록 ' + K.PROOF_RECENT + '개(항목·종류·금액·날짜·시각), 날짜별 합계, 기기 시계 기록</small></div></li>' +
        '<li><span aria-hidden="true">🔒</span><div><b>보내지 않음</b><small>절약 이유, 메모, 사진</small></div></li>' +
        '</ul>' +
        (hasTrace ? '<p class="notice notice-warn">이 기기 데이터에 시계를 되돌렸거나 저장 데이터를 고친 흔적이 있어서, 참가해도 관리자가 확인할 때까지 랭킹에 보이지 않을 수 있어요.</p>' : '') +
        '<p class="hint">기록을 바꾸면 랭킹에도 자동으로 반영돼요. 랭킹에서 나가면 올린 기록이 지워져요.</p>',
      actions: [
        { label: '취소', kind: 'secondary' },
        {
          label: '참가하기',
          kind: 'sun',
          onClick: () => {
            doJoin();
          },
        },
      ],
    });
  };

  async function doJoin() {
    busy = true;
    refresh();
    try {
      await R().join();
      SC.audio.play('success');
      ui.confetti(60);
      ui.toast('<b>랭킹에 참가했어요!</b> 이제 절약 기록이 랭킹에 반영돼요.', { type: 'success', icon: '🏆' });
    } catch (e) {
      SC.audio.play('error');
      ui.toast(U.esc(e.message), { type: 'error', duration: 6000 });
    } finally {
      busy = false;
      refresh();
    }
  }

  app.actions['rank:sync'] = async () => {
    const ok = await R().syncNow({ force: true });
    if (ok) ui.toast('랭킹에 최신 기록을 반영했어요.', { type: 'success', icon: '✓' });
    else if (R().syncError) ui.toast(R().errorText(R().syncError), { type: 'error', duration: 6000 });
    refresh();
  };

  async function removeMine(title, message, done) {
    const ok = await ui.confirm({ title, message, confirmLabel: '지우기', danger: true });
    if (!ok) return;
    busy = true;
    refresh();
    try {
      await R().leave();
      SC.audio.play('toggle');
      ui.toast(done, { type: 'info', icon: '👋' });
    } catch (e) {
      SC.audio.play('error');
      ui.toast(U.esc(e.message), { type: 'error', duration: 6000 });
    } finally {
      busy = false;
      refresh();
    }
  }

  app.actions['rank:leave'] = () =>
    removeMine('랭킹 나가기', '랭킹에 올린 내 기록을 지우고 랭킹에서 나갈까요?<br>게임 기록과 도시는 이 기기에 그대로 남아요.', '랭킹에서 나왔어요. 언제든 다시 참가할 수 있어요.');
  app.actions['rank:remove-mine'] = () => removeMine('내 랭킹 기록 지우기', '랭킹에 남아 있는 예전 기록을 지울까요?', '예전 랭킹 기록을 지웠어요.');

  SC.screens.ranking = { title: () => '랭킹', render, live };

  /** HOME 화면의 랭킹 카드 (랭킹을 쓸 수 있을 때만) */
  SC.rankingCard = function () {
    const rk = R();
    if (!rk || rk.status !== 'ready') return '';
    const rows = rk.loaded.ranking ? rk.board('week') : [];
    const my = rk.mine('week');
    let html = '<div class="card-head"><h2 id="home-rank-h">이번 주 랭킹</h2><button type="button" class="link-btn" data-nav="ranking">전체 보기</button></div>';
    if (my.joined && my.rank) html += '<p class="rank-home-me">🏆 <b>' + my.rank + '위</b> / ' + my.count + '명</p>';
    else if (my.joined && my.vis && !my.vis.visible) html += '<p class="warn-line">랭킹 확인이 필요해요. 랭킹 화면에서 내용을 확인해 주세요.</p>';
    if (rows.length) html += rowsHtml(rows, 'week', rk.me, 3);
    if (!my.joined) {
      html += '<div class="callout rank-invite"><p>친구들과 이번 주 절약 금액을 겨뤄 보세요!</p><button type="button" class="btn btn-sun btn-sm" data-nav="ranking">랭킹 참가하기</button></div>';
    } else if (!rows.length) html += '<p class="muted pad">랭킹을 불러오는 중…</p>';
    return html;
  };
})(window);
