/* SAVE CITY — 여러 화면에서 함께 쓰는 HTML 조각 */
(function (root) {
  'use strict';
  const SC = (root.SC = root.SC || {});
  const U = SC.util;
  const D = SC.data;
  const ui = SC.ui;

  function titleName(id) {
    return (D.TITLE_MAP[id] || D.TITLE_MAP.newbie).name;
  }

  function catIcon(cat) {
    return (D.CATEGORY_MAP[cat] || D.CATEGORY_MAP.etc).icon;
  }

  function catLabel(cat) {
    return (D.CATEGORY_MAP[cat] || D.CATEGORY_MAP.etc).label;
  }

  function dayLabel(key) {
    return U.dotDate(key) + ' (' + U.weekday(key) + ')';
  }

  function tokens(n, cls) {
    return '<span class="tok' + (cls ? ' ' + cls : '') + '">' + ui.coin() + '<b>' + U.fmt(n) + '</b></span>';
  }

  function thumb(itemId, level, skin, cls) {
    return '<div class="thumb' + (cls ? ' ' + cls : '') + '">' + SC.cityArt.renderThumb(itemId, level, skin) + '</div>';
  }

  function rewardText(reward) {
    const out = [];
    if (reward.tokens) out.push('+' + U.fmt(reward.tokens) + ' TOKEN');
    if (reward.special) out.push("특별 장식 '" + D.ITEM_MAP[reward.special].name + "'");
    if (reward.title) out.push("칭호 '" + titleName(reward.title) + "'");
    return out.join(' · ');
  }

  function pageHead(title, sub, o) {
    o = o || {};
    return (
      '<header class="page-head' + (o.back ? ' has-back' : '') + '">' +
      (o.back ? '<button type="button" class="icon-btn back-btn" data-nav="' + o.back + '"' + (o.backParam ? ' data-param="' + o.backParam + '"' : '') + ' aria-label="뒤로">' + ui.icon('back') + '</button>' : '') +
      '<div class="page-head-text"><h1>' + title + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' +
      (o.right || '') +
      '</header>'
    );
  }

  function recordRow(r) {
    const checkin = r.kind === 'checkin';
    return (
      '<li><button type="button" class="rec-row' + (checkin ? ' is-checkin' : '') + '" data-nav="record" data-param="' + r.id + '">' +
      '<span class="rec-ic" aria-hidden="true">' + catIcon(r.category) + '</span>' +
      '<span class="rec-main"><strong>' + U.esc(r.item) + '</strong><small>' + (checkin ? 'STREAK 유지용 0원 기록' : U.esc(r.reason)) + '</small></span>' +
      '<span class="rec-side">' + (checkin ? '<b>₩0</b><em class="muted">STREAK 유지</em>' : '<b>' + U.won(r.amount) + '</b><em' + (r.tokens ? '' : ' class="muted"') + '>+' + U.fmt(r.tokens) + ' TOKEN</em>') + '</span>' +
      (r.hasImage ? '<span class="rec-photo" aria-label="사진 있음">' + ui.icon('image') + '</span>' : '') +
      '</button></li>'
    );
  }

  function empty(icon, title, text, action) {
    return '<div class="empty"><div class="empty-ill" aria-hidden="true">' + icon + '</div><h2>' + title + '</h2>' + (text ? '<p>' + text + '</p>' : '') + (action || '') + '</div>';
  }

  /** 지역 이름 */
  function regionName(r) {
    return 'REGION ' + r.no + ' · ' + r.name;
  }

  SC.view = { titleName, catIcon, catLabel, dayLabel, tokens, thumb, rewardText, pageHead, recordRow, empty, regionName };
})(typeof window !== 'undefined' ? window : globalThis);
