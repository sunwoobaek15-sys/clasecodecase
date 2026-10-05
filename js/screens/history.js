/* SAVE CITY — HISTORY 화면 (기획서 10): 날짜별 기록, TOKEN 내역, 상세·수정·삭제 */
(function (root) {
  'use strict';
  const SC = root.SC;
  const U = SC.util;
  const D = SC.data;
  const E = SC.engine;
  const ui = SC.ui;
  const V = SC.view;
  const app = SC.app;

  let photoUrl = null;

  function filtered(state) {
    const q = U.cleanText(app.view.historyQuery, 40).toLowerCase();
    const list = state.history.slice().reverse();
    if (!q) return list;
    return list.filter((r) => (r.item + ' ' + r.reason + ' ' + r.memo + ' ' + V.catLabel(r.category)).toLowerCase().includes(q));
  }

  function recordsHtml(state) {
    const all = filtered(state);
    if (!state.history.length) {
      return V.empty('📒', '아직 기록이 없어요', '오늘 참은 소비 하나를 기록하면 여기에 날짜별로 쌓여요.', '<button type="button" class="btn btn-sun" data-nav="save">첫 절약 기록하기</button>');
    }
    if (!all.length) return V.empty('🔍', '찾는 기록이 없어요', '다른 단어로 검색해 보세요.', '');
    const shown = all.slice(0, app.view.historyLimit);
    const groups = [];
    for (const r of shown) {
      let g = groups[groups.length - 1];
      if (!g || g.date !== r.date) {
        g = { date: r.date, items: [] };
        groups.push(g);
      }
      g.items.push(r);
    }
    let html = groups
      .map((g) => {
        const day = state.history.filter((r) => r.date === g.date && r.kind === 'save');
        const saved = day.reduce((n, r) => n + r.amount, 0);
        const tk = day.reduce((n, r) => n + r.tokens, 0);
        return '<section class="day-group"><h3><span>' + V.dayLabel(g.date) + '</span><small>' + U.won(saved) + ' · +' + U.fmt(tk) + ' TOKEN</small></h3><ul class="rec-list">' + g.items.map(V.recordRow).join('') + '</ul></section>';
      })
      .join('');
    if (all.length > shown.length) html += '<button type="button" class="btn btn-secondary btn-block" data-action="history:more">기록 더 보기 (' + U.fmt(all.length - shown.length) + '개 남음)</button>';
    return html;
  }

  function ledgerHtml(state, d) {
    const list = state.ledger.slice().reverse();
    let html =
      '<div class="ledger-sum">' +
      '<div><span>절약으로 받은 TOKEN</span><b>+' + U.fmt(d.saveTokens) + '</b></div>' +
      '<div><span>보너스·업적 TOKEN</span><b>+' + U.fmt(state.wallet.bonusTotal) + '</b></div>' +
      '<div><span>사용한 TOKEN</span><b>-' + U.fmt(state.wallet.spentTotal) + '</b></div>' +
      '<div class="total"><span>현재 TOKEN</span><b>' + U.fmt(d.balance) + '</b></div>' +
      '</div>';
    if (!list.length) return html + V.empty('🪙', 'TOKEN 내역이 없어요', '절약을 기록하거나 건물을 사면 여기에 내역이 남아요.', '');
    const shown = list.slice(0, app.view.ledgerLimit);
    html +=
      '<ul class="ledger">' +
      shown
        .map((e) => {
          const t = new Date(e.at);
          const time = U.dotDate(e.date) + ' ' + String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
          return '<li><span class="lg-kind kind-' + e.kind + '">' + D.LEDGER_KINDS[e.kind] + '</span><span class="lg-main"><strong>' + U.esc(e.label) + '</strong><small>' + time + '</small></span><b class="' + (e.delta > 0 ? 'plus' : 'minus') + '">' + U.signed(e.delta) + '</b></li>';
        })
        .join('') +
      '</ul>';
    if (list.length > shown.length) html += '<button type="button" class="btn btn-secondary btn-block" data-action="history:moreLedger">더 보기</button>';
    html += '<p class="fineprint">최근 ' + D.RULES.LEDGER_MAX.toLocaleString() + '개의 내역까지 보관해요.</p>';
    return html;
  }

  function render(ctx) {
    const { state, d } = ctx;
    const tab = app.view.historyTab === 'ledger' ? 'ledger' : 'records';
    let html = V.pageHead('히스토리', '과거 절약 기록을 날짜별로 보여 줘요.', { back: 'profile' });
    html +=
      '<div class="seg" role="tablist" aria-label="기록 종류">' +
      '<button type="button" role="tab" aria-selected="' + (tab === 'records') + '" class="seg-btn' + (tab === 'records' ? ' on' : '') + '" data-action="history:tab" data-tab="records">절약 기록</button>' +
      '<button type="button" role="tab" aria-selected="' + (tab === 'ledger') + '" class="seg-btn' + (tab === 'ledger' ? ' on' : '') + '" data-action="history:tab" data-tab="ledger">TOKEN 내역</button>' +
      '</div>';
    if (tab === 'records') {
      html +=
        '<div class="summary-row"><div><span>절약 기록</span><b>' + U.fmt(d.records) + '건</b></div><div><span>누적 절약</span><b>' + U.won(d.totalSaved) + '</b></div><div><span>받은 TOKEN</span><b>' + U.fmt(d.saveTokens) + '</b></div></div>';
      if (state.history.length) {
        html += '<div class="search"><label class="sr-only" for="h-search">기록 검색</label>' + ui.icon('search') + '<input class="input" type="search" id="h-search" placeholder="항목, 이유, 메모 검색" value="' + U.esc(app.view.historyQuery) + '" autocomplete="off"></div>';
      }
      html += '<div id="h-list">' + recordsHtml(state) + '</div>';
    } else {
      html += ledgerHtml(state, d);
    }
    return html;
  }

  /* ---------------- 상세 ---------------- */

  function renderDetail(ctx) {
    const { state } = ctx;
    const r = state.history.find((x) => x.id === ctx.param);
    if (!r) {
      return V.pageHead('기록 상세', '', { back: 'history' }) + V.empty('🔍', '기록을 찾을 수 없어요', '이미 삭제되었을 수 있어요.', '<button type="button" class="btn btn-primary" data-nav="history">기록 목록으로</button>');
    }
    const checkin = r.kind === 'checkin';
    const rows = [
      ['항목', U.esc(r.item)],
      ['종류', V.catIcon(r.category) + ' ' + V.catLabel(r.category)],
      ['금액', U.won(r.amount)],
      ['인정 금액', U.won(r.recognized)],
      ['획득 TOKEN', '<span class="' + (r.tokens ? 'plus' : 'muted') + '">+' + U.fmt(r.tokens) + '</span>'],
      ['이유', checkin ? 'STREAK 유지용 0원 기록' : U.esc(r.reason)],
      ['메모', r.memo ? U.esc(r.memo).replace(/\n/g, '<br>') : '<span class="muted">없음</span>'],
      ['날짜', V.dayLabel(r.date)],
    ];
    let html = V.pageHead('기록 상세', '', { back: 'history' });
    html +=
      '<article class="card detail">' +
      '<div class="detail-top"><span class="rec-ic big" aria-hidden="true">' + V.catIcon(r.category) + '</span><div><h2>' + U.esc(r.item) + '</h2><p class="muted">' + V.dayLabel(r.date) + '</p></div></div>' +
      '<dl class="detail-list">' + rows.map((x) => '<div><dt>' + x[0] + '</dt><dd>' + x[1] + '</dd></div>').join('') + '</dl>' +
      (r.hasImage ? '<figure class="detail-photo" id="detail-photo"><p class="muted small">사진 불러오는 중…</p></figure>' : '') +
      (r.amount > r.recognized && !checkin ? '<p class="hint">하루 최대 인정 금액(50,000원)을 넘은 부분은 TOKEN에 포함되지 않았어요.</p>' : '') +
      (r.updatedAt ? '<p class="muted small">마지막 수정: ' + U.dotDate(U.dateKey(new Date(r.updatedAt))) + '</p>' : '') +
      '</article>';
    html +=
      '<div class="detail-actions">' +
      (checkin ? '' : '<button type="button" class="btn btn-primary" data-nav="edit" data-param="' + r.id + '">' + ui.icon('edit') + '수정</button>') +
      '<button type="button" class="btn btn-danger" data-action="record:delete" data-id="' + r.id + '">' + ui.icon('trash') + '삭제</button>' +
      '</div>';
    if (checkin) html += '<p class="hint center">0원 기록은 수정할 수 없고 삭제만 할 수 있어요.</p>';
    return html;
  }

  function loadPhoto(rootEl, id) {
    const fig = rootEl.querySelector('#detail-photo');
    if (!fig) return;
    SC.images
      .get(id)
      .then((blob) => {
        if (!fig.isConnected) return;
        if (!blob) {
          fig.innerHTML = '<p class="muted small">사진을 찾을 수 없어요. (브라우저 데이터가 지워졌을 수 있어요)</p>';
          return;
        }
        if (photoUrl) URL.revokeObjectURL(photoUrl);
        photoUrl = URL.createObjectURL(blob);
        fig.innerHTML = '<img src="' + photoUrl + '" alt="기록에 첨부한 사진">';
      })
      .catch(() => {
        if (fig.isConnected) fig.innerHTML = '<p class="muted small">이 브라우저에서는 사진을 불러올 수 없어요.</p>';
      });
  }

  /* ---------------- 버튼 ---------------- */

  app.actions['history:tab'] = (btn) => {
    app.view.historyTab = btn.dataset.tab;
    SC.audio.play('tap');
    app.render();
  };
  app.actions['history:more'] = () => {
    app.view.historyLimit += 50;
    app.render();
  };
  app.actions['history:moreLedger'] = () => {
    app.view.ledgerLimit += 100;
    app.render();
  };

  app.actions['record:delete'] = async (btn) => {
    const id = btn.dataset.id;
    const r = app.state.history.find((x) => x.id === id);
    if (!r) return;
    const pv = E.previewDelete(app.state, id);
    if (!pv.ok) {
      SC.audio.play('error');
      await ui.alert({
        title: '지금은 삭제할 수 없어요',
        message:
          '이 기록을 지우면 TOKEN <b>' + U.fmt(-pv.delta) + '개</b>를 돌려줘야 해요. 그런데 이미 건물 구매 등에 사용해서 지금은 <b>' + U.fmt(pv.balance) + '개</b>만 있어요.<br>TOKEN을 <b>' + U.fmt(pv.need) + '개</b> 더 모으면 삭제할 수 있어요.',
      });
      return;
    }
    const ok = await ui.confirm({
      title: '이 기록을 삭제할까요?',
      message: '<b>' + U.esc(r.item) + '</b> (' + U.won(r.amount) + ')' + (pv.delta ? '<br>이 기록으로 받은 TOKEN <b>' + U.fmt(-pv.delta) + '개</b>가 회수돼요.' : '') + '<br>삭제한 기록은 되돌릴 수 없어요.',
      confirmLabel: '삭제',
      danger: true,
    });
    if (!ok) return;
    const res = app.commit((s, now) => E.deleteRecord(s, id, now), { render: false });
    if (!res) return;
    if (r.hasImage) SC.images.del(id);
    SC.audio.play('tap');
    app.navigate('history');
    ui.toast('기록을 삭제했어요.' + (res.delta ? ' TOKEN ' + U.signed(res.delta) : ''), { type: 'info', icon: '🗑️' });
    app.celebrate(res.events);
  };

  SC.screens.history = {
    title: () => '히스토리',
    render,
    mount(rootEl) {
      const input = rootEl.querySelector('#h-search');
      if (input) {
        input.addEventListener('input', () => {
          app.view.historyQuery = input.value;
          app.view.historyLimit = 50;
          const list = rootEl.querySelector('#h-list');
          if (list) list.innerHTML = recordsHtml(app.state);
        });
      }
    },
  };

  SC.screens.record = {
    title: () => '기록 상세',
    render: renderDetail,
    mount(rootEl, ctx) {
      loadPhoto(rootEl, ctx.param);
    },
    unmount() {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      photoUrl = null;
    },
  };
})(window);
