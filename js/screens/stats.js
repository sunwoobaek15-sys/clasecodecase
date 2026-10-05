/* SAVE CITY — STATS 화면 (기획서 22): 숫자 요약과 그래프 */
(function (root) {
  'use strict';
  const SC = root.SC;
  const U = SC.util;
  const D = SC.data;
  const ui = SC.ui;
  const V = SC.view;
  const app = SC.app;

  function niceMax(v) {
    if (v <= 0) return 1000;
    const exp = Math.pow(10, Math.floor(Math.log10(v)));
    const f = v / exp;
    const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    return nf * exp;
  }

  /** 막대그래프 (한 가지 색, 4px 둥근 끝, 가는 격자선) */
  function barChart(rows, o) {
    const W = 340;
    const H = 190;
    const padL = 40;
    const padR = 10;
    const padT = 22;
    const padB = 28;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;
    const max = niceMax(Math.max.apply(null, rows.map((r) => r.value)));
    const ticks = 4;
    const band = innerW / rows.length;
    const bw = Math.min(24, band * 0.56);
    const y = (v) => padT + innerH - (v / max) * innerH;
    let svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + U.esc(o.label) + '">';
    for (let i = 0; i <= ticks; i++) {
      const v = (max / ticks) * i;
      const yy = y(v);
      svg += '<line class="chart-grid" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + yy.toFixed(1) + '" y2="' + yy.toFixed(1) + '"/>';
      svg += '<text class="chart-tick" x="' + (padL - 6) + '" y="' + (yy + 3.5).toFixed(1) + '" text-anchor="end">' + U.compact(v) + '</text>';
    }
    rows.forEach((r, i) => {
      const cx = padL + band * i + band / 2;
      const top = y(r.value);
      const h = padT + innerH - top;
      const x0 = cx - bw / 2;
      const rr = Math.min(4, h / 2, bw / 2);
      const base = padT + innerH;
      const path = h > 0 ? 'M' + x0.toFixed(1) + ' ' + base + ' V' + (top + rr).toFixed(1) + ' Q' + x0.toFixed(1) + ' ' + top.toFixed(1) + ' ' + (x0 + rr).toFixed(1) + ' ' + top.toFixed(1) + ' H' + (x0 + bw - rr).toFixed(1) + ' Q' + (x0 + bw).toFixed(1) + ' ' + top.toFixed(1) + ' ' + (x0 + bw).toFixed(1) + ' ' + (top + rr).toFixed(1) + ' V' + base + ' Z' : '';
      svg +=
        '<g class="bar' + (r.current ? ' current' : '') + '" tabindex="0" role="img" aria-label="' + U.esc(r.title + ' ' + U.won(r.value)) + '" data-tip="' + U.esc(r.title + '|' + U.won(r.value)) + '">' +
        '<rect class="bar-hit" x="' + (cx - band / 2).toFixed(1) + '" y="' + padT + '" width="' + band.toFixed(1) + '" height="' + (innerH + padB) + '"/>' +
        (path ? '<path class="bar-fill" d="' + path + '"/>' : '') +
        '<text class="chart-val" x="' + cx.toFixed(1) + '" y="' + (top - 6).toFixed(1) + '" text-anchor="middle">' + U.compact(r.value) + '</text>' +
        '<text class="chart-x' + (r.current ? ' strong' : '') + '" x="' + cx.toFixed(1) + '" y="' + (H - 9) + '" text-anchor="middle">' + U.esc(r.label) + '</text>' +
        '</g>';
    });
    svg += '<line class="chart-axis" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + (padT + innerH) + '" y2="' + (padT + innerH) + '"/>';
    svg += '</svg>';
    const table =
      '<details class="chart-table"><summary>표로 보기</summary><div class="table-wrap"><table><thead><tr><th scope="col">' + o.col + '</th><th scope="col">절약 금액</th></tr></thead><tbody>' +
      rows.map((r) => '<tr><th scope="row">' + U.esc(r.title) + '</th><td>' + U.won(r.value) + '</td></tr>').join('') +
      '</tbody></table></div></details>';
    return '<div class="chart-box">' + svg + '<div class="chart-tip" hidden></div></div>' + table;
  }

  function lastDays(state, today, n) {
    const sums = {};
    for (const r of state.history) if (r.kind === 'save') sums[r.date] = (sums[r.date] || 0) + r.amount;
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const k = U.addDays(today, -i);
      out.push({ label: i === 0 ? '오늘' : U.weekday(k), title: V.dayLabel(k), value: sums[k] || 0, current: i === 0 });
    }
    return out;
  }

  function lastMonths(state, today, n) {
    const sums = {};
    for (const r of state.history) if (r.kind === 'save') sums[U.monthKey(r.date)] = (sums[U.monthKey(r.date)] || 0) + r.amount;
    const cur = U.monthKey(today);
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const m = U.addMonths(cur, -i);
      out.push({ label: Number(m.slice(5)) + '월', title: m.slice(0, 4) + '년 ' + Number(m.slice(5)) + '월', value: sums[m] || 0, current: i === 0 });
    }
    return out;
  }

  function categoryBars(state) {
    const sums = {};
    let total = 0;
    for (const r of state.history) {
      if (r.kind !== 'save') continue;
      sums[r.category] = (sums[r.category] || 0) + r.amount;
      total += r.amount;
    }
    const rows = D.CATEGORIES.filter((c) => sums[c.id]).map((c) => ({ c, v: sums[c.id] })).sort((a, b) => b.v - a.v);
    if (!rows.length) return '<p class="muted pad">아직 절약 기록이 없어요.</p>';
    const max = rows[0].v;
    return (
      '<ul class="hbars">' +
      rows
        .map(
          (r) =>
            '<li><span class="hb-label"><span aria-hidden="true">' + r.c.icon + '</span> ' + r.c.label + '</span><span class="hb-track" aria-hidden="true"><span class="hb-fill" style="width:' + ((r.v / max) * 100).toFixed(1) + '%"></span></span><span class="hb-val">' + U.won(r.v) + '<small>' + Math.round((r.v / total) * 100) + '%</small></span></li>'
        )
        .join('') +
      '</ul>'
    );
  }

  function render(ctx) {
    const { state, d } = ctx;
    const tiles = [
      ['누적 절약 금액', U.won(d.totalSaved)],
      ['누적 인정 금액', U.won(d.totalRecognized)],
      ['받은 TOKEN', U.fmt(d.saveTokens + state.wallet.bonusTotal)],
      ['사용한 TOKEN', U.fmt(state.wallet.spentTotal)],
      ['현재 STREAK', d.streak.current + '일'],
      ['최장 STREAK', d.longestStreak + '일'],
      ['절약 기록', U.fmt(d.records) + '건'],
      ['건물 수', U.fmt(d.city.buildings + d.city.landmarks) + '채'],
      ['도시 가치', U.fmt(d.cityValue)],
      ['업적', d.achievementsCount + ' / ' + D.ACHIEVEMENTS.length],
    ];
    let html = V.pageHead('통계', '절약, TOKEN, STREAK, 도시 성장을 한눈에 봐요.', { back: 'profile' });
    html += '<section class="tiles" aria-label="요약 숫자">' + tiles.map((t) => '<div class="tile"><span class="label">' + t[0] + '</span><strong>' + t[1] + '</strong></div>').join('') + '</section>';
    html += '<section class="card chart-card" aria-labelledby="c7-h"><div class="card-head"><h2 id="c7-h">최근 7일 절약 금액</h2><span class="muted">합계 ' + U.won(lastDays(state, d.today, 7).reduce((n, r) => n + r.value, 0)) + '</span></div>' + barChart(lastDays(state, d.today, 7), { label: '최근 7일 절약 금액 막대그래프', col: '날짜' }) + '</section>';
    html += '<section class="card chart-card" aria-labelledby="c6-h"><div class="card-head"><h2 id="c6-h">최근 6개월 절약 금액</h2></div>' + barChart(lastMonths(state, d.today, 6), { label: '최근 6개월 절약 금액 막대그래프', col: '월' }) + '</section>';
    html += '<section class="card" aria-labelledby="cc-h"><div class="card-head"><h2 id="cc-h">종류별 절약 금액</h2></div>' + categoryBars(state) + '</section>';
    html +=
      '<section class="card" aria-labelledby="tk-h"><div class="card-head"><h2 id="tk-h">TOKEN 흐름</h2></div><dl class="kv-list">' +
      '<div><dt>절약으로 받은 TOKEN</dt><dd>+' + U.fmt(d.saveTokens) + '</dd></div>' +
      '<div><dt>보너스·업적·STREAK TOKEN</dt><dd>+' + U.fmt(state.wallet.bonusTotal) + '</dd></div>' +
      '<div><dt>건물·업그레이드에 사용</dt><dd>-' + U.fmt(state.wallet.spentTotal) + '</dd></div>' +
      '<div class="total"><dt>현재 TOKEN</dt><dd>' + U.fmt(d.balance) + '</dd></div>' +
      '</dl><button type="button" class="btn btn-secondary btn-block" data-nav="history" data-tab="ledger">TOKEN 내역 보기</button></section>';
    return html;
  }

  function mount(rootEl) {
    rootEl.querySelectorAll('.chart-box').forEach((box) => {
      const tip = box.querySelector('.chart-tip');
      const show = (g) => {
        const [title, value] = g.dataset.tip.split('|');
        tip.innerHTML = '<b>' + value + '</b><span>' + title + '</span>';
        tip.hidden = false;
        const br = box.getBoundingClientRect();
        const r = (g.querySelector('.bar-fill') || g.querySelector('.bar-hit')).getBoundingClientRect();
        const left = Math.max(4, Math.min(br.width - tip.offsetWidth - 4, r.left - br.left + r.width / 2 - tip.offsetWidth / 2));
        tip.style.left = left + 'px';
        tip.style.top = Math.max(0, r.top - br.top - tip.offsetHeight - 8) + 'px';
      };
      const hide = () => (tip.hidden = true);
      box.querySelectorAll('.bar').forEach((g) => {
        g.addEventListener('pointerenter', () => show(g));
        g.addEventListener('pointerleave', hide);
        g.addEventListener('focus', () => show(g));
        g.addEventListener('blur', hide);
      });
    });
  }

  SC.screens.stats = { title: () => '통계', render, mount };
})(window);
