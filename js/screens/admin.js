/* SAVE CITY — 관리자 모드 (게시자 전용): 참가자 기록을 보고 부정 사용을 막아요. */
(function (root) {
  'use strict';
  const SC = root.SC;
  const U = SC.util;
  const D = SC.data;
  const K = SC.rank;
  const ui = SC.ui;
  const V = SC.view;
  const app = SC.app;

  const FILTERS = [
    { id: 'all', label: '전체' },
    { id: 'review', label: '확인 필요' },
    { id: 'hidden', label: '제외됨' },
    { id: 'ok', label: '정상' },
  ];
  const RISK_LABEL = { high: '확인 필요', mid: '주의', ok: '정상' };
  const RISK_ORDER = { high: 0, mid: 1, ok: 2 };
  const nameCache = Object.create(null);
  let busy = false;

  function R() {
    return SC.ranking;
  }

  /** '3분 전' 같은 짧은 시간 표시 */
  function ago(iso, nowMs) {
    if (!iso) return '–';
    const diff = nowMs - Date.parse(iso);
    if (diff < -60000) return '미래 시각 ' + dateTime(iso);
    if (diff < 60000) return '방금';
    if (diff < 3600000) return Math.floor(diff / 60000) + '분 전';
    if (diff < 86400000) return Math.floor(diff / 3600000) + '시간 전';
    if (diff < 30 * 86400000) return Math.floor(diff / 86400000) + '일 전';
    return U.dotDate(U.dateKey(new Date(iso)));
  }

  function dateTime(iso) {
    const d = new Date(iso);
    return U.dotDate(U.dateKey(d)) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function statusChip(mod, vis) {
    if (mod && mod.status === 'hidden') return '<span class="status-chip st-hidden">제외됨</span>';
    if (vis && vis.reason === 'auto') return '<span class="status-chip st-auto">자동 숨김</span>';
    if (mod && mod.status === 'warned') return '<span class="status-chip st-warned">경고</span>';
    if (mod && mod.status === 'ok') return '<span class="status-chip st-ok">확인됨</span>';
    return '';
  }

  function riskChip(a) {
    const n = a.flags.filter((f) => f.level === a.risk).length;
    return '<span class="risk-chip risk-' + a.risk + '">' + RISK_LABEL[a.risk] + (a.risk !== 'ok' ? ' ' + n : '') + '</span>';
  }

  function sorted(list) {
    return list.slice().sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk] || String(b.entry.syncedAt).localeCompare(String(a.entry.syncedAt)));
  }

  function matches(a, filter, q) {
    const hidden = a.mod && a.mod.status === 'hidden';
    if (filter === 'review' && (hidden || a.risk === 'ok')) return false;
    if (filter === 'hidden' && !hidden) return false;
    if (filter === 'ok' && (hidden || a.risk !== 'ok')) return false;
    if (!q) return true;
    const hay = (a.entry.nick + ' ' + (nameCache[a.id] || '')).toLowerCase();
    return hay.includes(q);
  }

  function row(a, nowMs) {
    const e = a.entry;
    const week = e.week === U.weekStart(U.dateKey(new Date(nowMs))) ? e.weekSaved : 0;
    return (
      '<li><button type="button" class="admin-row row-' + a.risk + '" data-action="admin:open" data-id="' + U.esc(a.id) + '">' +
      '<span class="rank-av" aria-hidden="true">' + e.avatar + '</span>' +
      '<span class="admin-main"><span class="admin-name"><b>' + U.esc(e.nick) + '</b><small data-profile-id="' + U.esc(a.id) + '">' + U.esc(nameCache[a.id] || '') + '</small></span>' +
      '<span class="admin-meta">이번 주 ' + U.won(week) + ' · LV ' + e.level + ' · 🔥' + e.streak + ' · ' + ago(e.syncedAt, nowMs) + '</span></span>' +
      '<span class="admin-side">' + riskChip(a) + statusChip(a.mod, a.vis) + '</span>' +
      '</button></li>'
    );
  }

  function listHtml(all, nowMs) {
    const filter = FILTERS.some((f) => f.id === app.view.adminFilter) ? app.view.adminFilter : 'all';
    const q = String(app.view.adminQuery || '').trim().toLowerCase();
    const list = sorted(all).filter((a) => matches(a, filter, q));
    if (!all.length) return V.empty('🧑‍🤝‍🧑', '아직 참가한 사람이 없어요', '게임을 공유받은 사람이 랭킹에 참가하면 여기에 나타나요.');
    if (!list.length) return '<p class="muted pad center">조건에 맞는 참가자가 없어요.</p>';
    return '<ul class="admin-list">' + list.map((a) => row(a, nowMs)).join('') + '</ul>';
  }

  function body() {
    const rk = R();
    if (!rk || rk.status === 'none') return '<section class="card">' + V.empty('🛡️', '관리자 모드는 공유된 SAVE CITY에서 열려요', '이 버전에는 랭킹이 없어요.', '<button type="button" class="btn btn-secondary" data-nav="home">홈으로</button>') + '</section>';
    if (rk.status === 'loading') return '<section class="card"><p class="muted pad center">연결하는 중…</p></section>';
    if (rk.status === 'off') return '<section class="card">' + V.empty('🔌', '지금은 관리자 모드를 쓸 수 없어요', 'Claude에 로그인한 상태에서 다시 열어 주세요.') + '</section>';
    if (!rk.isOwner) return '<section class="card">' + V.empty('🔒', '관리자만 볼 수 있어요', '이 게임을 공유한 사람(게시자)만 관리자 모드를 쓸 수 있어요.', '<button type="button" class="btn btn-secondary" data-nav="ranking">랭킹 보기</button>') + '</section>';
    if (!rk.loaded.ranking) return '<section class="card"><p class="muted pad center">참가자 목록을 불러오는 중…</p></section>';
    const nowMs = Date.now();
    const all = rk.audits();
    const hiddenN = all.filter((a) => a.mod && a.mod.status === 'hidden').length;
    const high = all.filter((a) => a.risk === 'high' && !(a.mod && a.mod.status === 'hidden'));
    const mid = all.filter((a) => a.risk === 'mid' && !(a.mod && a.mod.status === 'hidden')).length;
    const filter = FILTERS.some((f) => f.id === app.view.adminFilter) ? app.view.adminFilter : 'all';
    let html =
      '<section class="tiles tiles-4" aria-label="참가자 요약">' +
      '<div class="tile"><span class="label">참가자</span><strong>' + all.length + '명</strong></div>' +
      '<div class="tile' + (high.length ? ' tile-danger' : '') + '"><span class="label">확인 필요</span><strong>' + high.length + '명</strong></div>' +
      '<div class="tile' + (mid ? ' tile-warn' : '') + '"><span class="label">주의</span><strong>' + mid + '명</strong></div>' +
      '<div class="tile"><span class="label">제외됨</span><strong>' + hiddenN + '명</strong></div>' +
      '</section>';
    if (!rk.loaded.proofs) html += '<p class="hint">상세 기록을 불러오는 중이에요. 다 불러오면 검사 결과가 더 정확해져요.</p>';
    if (high.length) {
      html +=
        '<section class="card callout callout-danger"><div class="callout-ic" aria-hidden="true">🚨</div><div class="callout-text"><h2>확인이 필요한 참가자 ' + high.length + '명</h2><p>자동 검사에서 게임 규칙으로는 나올 수 없는 기록이 발견돼 랭킹에서 자동으로 숨겼어요.</p></div>' +
        '<button type="button" class="btn btn-danger btn-sm" data-action="admin:bulk-hide"' + (busy ? ' disabled' : '') + '>모두 제외</button></section>';
    }
    html +=
      '<section class="card admin-card" aria-labelledby="admin-h"><div class="card-head"><h2 id="admin-h">참가자</h2><span class="muted">위험도 순</span></div>' +
      '<div class="seg" role="tablist" aria-label="참가자 필터">' +
      FILTERS.map((f) => '<button type="button" role="tab" aria-selected="' + (f.id === filter) + '" class="seg-btn' + (f.id === filter ? ' on' : '') + '" data-action="admin:filter" data-filter="' + f.id + '">' + f.label + '</button>').join('') +
      '</div>' +
      '<label class="search admin-search">' + ui.icon('search') + '<span class="sr-only">닉네임 검색</span><input class="input" type="search" id="admin-q" placeholder="닉네임 또는 이름 검색" value="' + U.esc(app.view.adminQuery || '') + '" autocomplete="off"></label>' +
      '<div id="admin-list">' + listHtml(all, nowMs) + '</div>' +
      '</section>';
    html +=
      '<section class="card" aria-labelledby="guide-h"><h2 class="sub" id="guide-h">관리 방법</h2><ul class="rule-list muted-list">' +
      '<li><b>확인 필요</b>: 시계 되돌림, 저장 데이터 변조, 하루 한도를 넘는 금액처럼 게임 규칙으로는 나올 수 없는 기록이에요. 랭킹에서 자동으로 숨겨져요.</li>' +
      '<li><b>주의</b>: 매일 최대치, 짧은 시간 몰아서 기록, 아주 큰 금액처럼 사람이 판단해야 하는 패턴이에요. 랭킹에는 그대로 보여요.</li>' +
      '<li><b>정상 확인</b>을 누르면 지금 보이는 항목을 허용해요. 새로운 흔적이 생기면 다시 표시돼요.</li>' +
      '<li><b>경고</b>는 순위를 유지한 채 본인에게 메시지를 보여 주고, <b>랭킹 제외</b>는 다른 사람에게 순위를 숨겨요.</li>' +
      '</ul></section>';
    return html;
  }

  function render() {
    return V.pageHead('관리자 모드', '참가자 기록을 보고 부정 사용을 막아요.', { back: 'ranking' }) + '<div id="admin-body">' + body() + '</div>';
  }

  /** 목록에 Claude 계정 이름 채우기 (그릴 때마다 물어보고, 글자로만 넣어요) */
  function fillNames(scope) {
    const els = Array.from(scope.querySelectorAll('[data-profile-id]'));
    if (!els.length || !R()) return;
    const ids = Array.from(new Set(els.map((el) => el.dataset.profileId)));
    R()
      .names(ids)
      .then((names) => {
        els.forEach((el) => {
          const n = names[el.dataset.profileId] || '';
          nameCache[el.dataset.profileId] = n;
          if (el.isConnected) el.textContent = n;
        });
      });
  }

  function bindSearch(main) {
    const input = main.querySelector('#admin-q');
    if (!input) return;
    input.addEventListener('input', () => {
      app.view.adminQuery = U.cut(input.value, 30);
      updateList(main);
    });
  }

  function updateList(main) {
    const box = main.querySelector('#admin-list');
    if (!box || !R()) return;
    box.innerHTML = listHtml(R().audits(), Date.now());
    fillNames(box);
  }

  function mount(main) {
    if (R() && R().isOwner) R().ensureProofs();
    bindSearch(main);
    fillNames(main);
  }

  /** 새 데이터가 오면 검색창은 그대로 두고 나머지만 다시 그려요. */
  function live(main) {
    const bodyEl = main.querySelector('#admin-body');
    if (!bodyEl) return;
    const input = main.querySelector('#admin-q');
    if (input && document.activeElement === input) {
      updateList(main);
      return;
    }
    app.keepFocus(bodyEl, () => (bodyEl.innerHTML = body()));
    mount(main);
  }

  function refresh() {
    if (app.route.name === 'admin') live(document.getElementById('screen'));
  }

  /* ---------------- 참가자 상세 ---------------- */

  function guessReason(flags) {
    const codes = flags.map((f) => f.code);
    if (codes.includes('tampered')) return 'tamper';
    if (codes.some((c) => c === 'clock' || c === 'order' || c === 'future')) return 'clock';
    if (codes.some((c) => c === 'burst' || c === 'alwaysMax' || c === 'bigClaim')) return 'pattern';
    if (codes.length) return 'fake';
    return 'other';
  }

  function dailyChart(proof, today) {
    const map = {};
    (proof ? proof.daily : []).forEach((x) => (map[x.d] = x));
    const days = [];
    for (let i = 13; i >= 0; i--) days.push(U.addDays(today, -i));
    const bars = days
      .map((k) => {
        const x = map[k];
        const r = x ? x.r : 0;
        const h = Math.round((r / D.RULES.DAILY_CAP) * 100);
        const over = x && x.r > D.RULES.DAILY_CAP;
        return '<span class="mini-bar' + (over ? ' over' : '') + (r >= D.RULES.DAILY_CAP ? ' full' : '') + '" title="' + U.dotDate(k) + ' ' + U.won(r) + '"><i style="height:' + Math.min(100, h) + '%"></i><small>' + Number(k.slice(8)) + '</small></span>';
      })
      .join('');
    const table = days
      .filter((k) => map[k])
      .map((k) => '<tr><th scope="row">' + V.dayLabel(k) + '</th><td>' + map[k].n + '건</td><td>' + U.won(map[k].r) + '</td></tr>')
      .join('');
    return (
      '<div class="mini-bars" role="img" aria-label="최근 14일 인정 금액 막대그래프">' + bars + '</div>' +
      '<details class="chart-table"><summary>표로 보기</summary><div class="table-wrap"><table><thead><tr><th scope="col">날짜</th><th scope="col">기록</th><th scope="col">인정 금액</th></tr></thead><tbody>' +
      (table || '<tr><td colspan="3">최근 14일 기록이 없어요.</td></tr>') +
      '</tbody></table></div></details>'
    );
  }

  function detailHtml(a, nowMs) {
    const e = a.entry;
    const p = a.proof;
    const m = a.mod;
    const today = U.dateKey(new Date(nowMs));
    const allow = (m && m.allow) || [];
    let html =
      '<div class="admin-head"><span class="rank-av big" aria-hidden="true">' + e.avatar + '</span><div class="admin-name"><b>' + U.esc(e.nick) + '</b><small data-profile-id="' + U.esc(a.id) + '">' + U.esc(nameCache[a.id] || '') + '</small></div>' +
      '<div class="admin-side">' + riskChip(a) + statusChip(m, a.vis) + '</div></div>';

    html += '<h3 class="sub">자동 검사</h3>';
    html += a.allFlags.length
      ? '<ul class="flag-list">' +
        a.allFlags
          .map((f) => {
            const ok = allow.includes(f.key);
            return '<li class="flag-' + (ok ? 'allowed' : f.level) + '"><span aria-hidden="true">' + (ok ? '✓' : f.level === 'high' ? '🔴' : '🟡') + '</span><span>' + f.text + (ok ? ' <em>(확인됨)</em>' : '') + '</span></li>';
          })
          .join('') +
        '</ul>'
      : '<p class="ok-line">✓ 의심 항목이 없어요.</p>';
    if (m && (m.status === 'hidden' || m.status === 'warned')) {
      html += '<p class="notice ' + (m.status === 'hidden' ? 'notice-danger' : 'notice-warn') + '"><b>' + (m.status === 'hidden' ? '🚫 랭킹 제외 중' : '⚠️ 경고 보냄') + '</b><span>' + (m.reason ? K.MOD_REASON_MAP[m.reason].label : '') + (m.at ? ' · ' + dateTime(m.at) : '') + '</span>' + (m.message ? '<span class="notice-msg">“' + U.esc(m.message) + '”</span>' : '') + '</p>';
    }

    html +=
      '<h3 class="sub">랭킹 숫자</h3><dl class="kv-list">' +
      '<div><dt>이번 주 인정 금액</dt><dd>' + U.won(e.weekSaved) + (e.week !== U.weekStart(today) ? ' <small class="muted">(' + U.dotDate(e.week || '') + ' 주)</small>' : '') + '</dd></div>' +
      '<div><dt>누적 인정 금액</dt><dd>' + U.won(e.total) + '</dd></div>' +
      '<div><dt>기록한 날 / 절약한 날</dt><dd>' + e.days + '일 / ' + e.saveDays + '일</dd></div>' +
      '<div><dt>절약 기록</dt><dd>' + U.fmt(e.records) + '건</dd></div>' +
      '<div><dt>받은 TOKEN (절약 / 보너스)</dt><dd>' + U.fmt(e.earned) + ' / ' + U.fmt(e.bonus) + '</dd></div>' +
      '<div><dt>사용한 TOKEN</dt><dd>' + U.fmt(e.spent) + '</dd></div>' +
      '<div><dt>도시</dt><dd>LV ' + e.level + ' · 가치 ' + U.fmt(e.value) + '</dd></div>' +
      '<div><dt>STREAK (현재 / 최장)</dt><dd>' + e.streak + '일 / ' + e.longest + '일</dd></div>' +
      '<div><dt>게임 시작일</dt><dd>' + (e.since ? U.dotDate(e.since) : '–') + '</dd></div>' +
      '<div><dt>마지막 반영</dt><dd>' + (e.syncedAt ? dateTime(e.syncedAt) : '–') + '</dd></div>' +
      '</dl>';

    html += '<h3 class="sub">최근 14일 인정 금액</h3>' + (p ? dailyChart(p, today) : '<p class="muted small">상세 기록이 아직 없어요.</p>');

    if (p && p.recent.length) {
      html +=
        '<h3 class="sub">최근 절약 기록</h3><div class="table-wrap"><table class="admin-table"><thead><tr><th scope="col">기록 시각</th><th scope="col">항목</th><th scope="col">금액</th><th scope="col">인정</th></tr></thead><tbody>' +
        p.recent
          .slice(-20)
          .reverse()
          .map(
            (x) =>
              '<tr' + (x.a >= 1000000 ? ' class="hl"' : '') + '><td>' + dateTime(x.at) + (x.ed ? ' <small class="muted">수정됨</small>' : '') + '</td><td>' + V.catIcon(x.c) + ' ' + U.esc(x.i) + '</td><td>' + U.won(x.a) + '</td><td>' + U.won(x.r) + '</td></tr>'
          )
          .join('') +
        '</tbody></table></div>';
    }
    if (p && p.clockEvents.length) {
      html += '<h3 class="sub">기기 시계 되돌림</h3><ul class="rule-list muted-list">' + p.clockEvents.slice(-8).reverse().map((c) => '<li>' + dateTime(c.at) + ' · ' + U.fmt(c.back) + '분 뒤로</li>').join('') + '</ul>';
    }
    if (p && p.syncs.length) {
      html += '<h3 class="sub">반영 기록</h3><p class="small muted">' + p.syncs.slice(-6).reverse().map(dateTime).join(' · ') + '</p>';
    }
    if (m && m.history.length) {
      const label = { ok: '정상 확인', warned: '경고', hidden: '랭킹 제외' };
      html += '<h3 class="sub">관리 기록</h3><ul class="rule-list muted-list">' + m.history.slice().reverse().map((h) => '<li>' + dateTime(h.at) + ' · ' + label[h.status] + (h.reason ? ' (' + K.MOD_REASON_MAP[h.reason].label + ')' : '') + '</li>').join('') + '</ul>';
    }
    return html;
  }

  function openPlayer(id) {
    const rk = R();
    const a = rk.audits().find((x) => x.id === id);
    if (!a) {
      ui.toast('참가자를 찾을 수 없어요. 랭킹에서 나갔을 수 있어요.', { type: 'error' });
      return;
    }
    const hidden = a.mod && a.mod.status === 'hidden';
    const actions = [];
    actions.push({ label: hidden ? '제외 풀기' : '정상 확인', kind: 'primary', onClick: (close, dialog) => (act(dialog, close, () => rk.setMod(id, 'ok', { allow: a.allFlags.map((f) => f.key) }), hidden ? '랭킹 제외를 풀었어요.' : '정상으로 확인했어요.'), false) });
    if (!hidden) {
      actions.push({ label: '경고', kind: 'secondary', onClick: (close, dialog) => (askReason(a, 'warned', dialog, close), false) });
      actions.push({ label: '랭킹 제외', kind: 'danger', onClick: (close, dialog) => (askReason(a, 'hidden', dialog, close), false) });
    }
    ui.sheet({
      title: '참가자 기록',
      className: 'dialog-admin',
      body: detailHtml(a, Date.now()) + '<button type="button" class="link-btn danger-link admin-remove" data-remove>랭킹 기록 삭제</button><p class="fineprint">삭제는 그만둔 사람의 기록을 정리할 때 써요. 계속 참가 중인 사람은 다음 기록 때 다시 올라와요. 막으려면 랭킹 제외를 써 주세요.</p>',
      actions,
      onOpen: (dialog, close) => {
        fillNames(dialog);
        dialog.querySelector('[data-remove]').addEventListener('click', async () => {
          const ok = await ui.confirm({ title: '랭킹 기록 삭제', message: U.esc(a.entry.nick) + '님의 랭킹 카드와 상세 기록을 지울까요?', confirmLabel: '삭제', danger: true });
          if (ok) act(dialog, close, () => rk.removePlayer(id), '랭킹 기록을 지웠어요.');
        });
      },
    });
  }

  /** 관리자 행동 실행: 버튼을 잠그고, 성공하면 창을 닫아요. */
  async function act(dialog, close, fn, okText) {
    const btns = dialog.querySelectorAll('.dialog-actions .btn, [data-remove]');
    btns.forEach((b) => (b.disabled = true));
    try {
      await fn();
      SC.audio.play('success');
      ui.toast(okText, { type: 'success', icon: '🛡️' });
      close();
    } catch (e) {
      SC.audio.play('error');
      ui.toast(U.esc(e.message), { type: 'error', duration: 6000 });
      btns.forEach((b) => (b.disabled = false));
    }
  }

  /** 경고·제외 사유 고르기 */
  function askReason(a, status, parentDialog, parentClose) {
    const pick = guessReason(K.openFlags(a.allFlags, a.mod));
    const isHide = status === 'hidden';
    ui.open({
      title: isHide ? '랭킹에서 제외' : '경고 보내기',
      className: 'dialog-reason',
      body:
        '<p class="small">' + U.esc(a.entry.nick) + '님에게 사유와 메시지가 보여요.' + (isHide ? ' 다른 사람에게는 순위가 보이지 않아요.' : ' 순위는 그대로 남아요.') + '</p>' +
        '<fieldset class="field"><legend class="label">사유</legend><div class="reason-grid">' +
        K.MOD_REASONS.map((r) => '<label class="pick-opt"><input type="radio" name="mod-reason" value="' + r.id + '"' + (r.id === pick ? ' checked' : '') + '><span>' + r.label + '</span></label>').join('') +
        '</div></fieldset>' +
        '<div class="field"><label for="mod-msg">메시지 <span class="opt">(선택, 최대 ' + K.MOD_MESSAGE_MAX + '자)</span></label><textarea class="input" id="mod-msg" rows="2" maxlength="' + K.MOD_MESSAGE_MAX + '" placeholder="' + (isHide ? '예: 시계를 바꿔 기록한 흔적이 있어요.' : '예: 실제로 아낀 금액만 기록해 주세요.') + '"></textarea></div>',
      actions: [
        { label: '취소', kind: 'secondary' },
        {
          label: isHide ? '제외하기' : '경고 보내기',
          kind: isHide ? 'danger' : 'primary',
          onClick: (close, dialog) => {
            const reason = (dialog.querySelector('input[name="mod-reason"]:checked') || {}).value || 'other';
            const message = dialog.querySelector('#mod-msg').value;
            act(dialog, () => {
              close();
              parentClose();
            }, () => R().setMod(a.id, status, { reason, message }), isHide ? '랭킹에서 제외했어요.' : '경고를 보냈어요.');
            return false;
          },
        },
      ],
    });
  }

  /* ---------------- 행동 ---------------- */

  app.actions['admin:open'] = (btn) => openPlayer(btn.dataset.id);

  app.actions['admin:filter'] = (btn) => {
    app.view.adminFilter = btn.dataset.filter;
    SC.audio.play('tap');
    const main = document.getElementById('screen');
    main.querySelectorAll('[data-action="admin:filter"]').forEach((b) => {
      const on = b.dataset.filter === app.view.adminFilter;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', String(on));
    });
    updateList(main);
  };

  app.actions['admin:bulk-hide'] = async () => {
    const rk = R();
    const targets = rk.audits().filter((a) => a.risk === 'high' && !(a.mod && a.mod.status === 'hidden'));
    if (!targets.length) return;
    const ok = await ui.confirm({
      title: '확인 필요한 참가자 모두 제외',
      message: '<b>' + targets.length + '명</b>을 랭킹에서 제외할까요?<br>' + targets.map((a) => U.esc(a.entry.nick)).join(', ') + '<br><small>나중에 한 명씩 제외를 풀 수 있어요.</small>',
      confirmLabel: '모두 제외',
      danger: true,
    });
    if (!ok) return;
    busy = true;
    refresh();
    let done = 0;
    try {
      // 문서마다 한 번에 하나씩 써요.
      for (const a of targets) {
        await rk.setMod(a.id, 'hidden', { reason: guessReason(K.openFlags(a.allFlags, a.mod)), message: '자동 검사에서 게임 규칙으로는 나올 수 없는 기록이 확인됐어요.' });
        done++;
      }
      SC.audio.play('success');
      ui.toast(done + '명을 랭킹에서 제외했어요.', { type: 'success', icon: '🛡️' });
    } catch (e) {
      SC.audio.play('error');
      ui.toast((done ? done + '명은 제외했지만, ' : '') + U.esc(e.message), { type: 'error', duration: 6000 });
    } finally {
      busy = false;
      refresh();
    }
  };

  SC.screens.admin = { title: () => '관리자 모드', render, mount, live };
})(window);
