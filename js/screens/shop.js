/* SAVE CITY — SHOP 화면 (기획서 19) + 공통 구매 흐름 */
(function (root) {
  'use strict';
  const SC = root.SC;
  const U = SC.util;
  const D = SC.data;
  const E = SC.engine;
  const ui = SC.ui;
  const V = SC.view;
  const app = SC.app;

  const PLACEABLE = ['building', 'decoration', 'landmark'];
  const TAB_NOTES = {
    building: '건물은 업그레이드하면 Lv.5까지 모습이 바뀌고 도시 가치가 올라가요.',
    decoration: '장식은 빈 땅을 예쁘게 채워요. 일부 장식은 건물을 업그레이드하면 열려요.',
    vehicle: '탈것은 산 순간부터 모든 지역의 도로를 달려요.',
    landmark: '랜드마크는 도시의 상징이에요. 도시 가치가 크게 올라가요.',
    skin: '스킨은 도시 전체 분위기를 바꿔요. 산 스킨은 언제든 다시 바꿔 입을 수 있어요.',
  };

  function josa(word, a, b) {
    return SC.cityHelpers ? SC.cityHelpers.josa(word, a, b) : word + a;
  }

  function priceHtml(state, item) {
    const p = E.priceFor(state, item);
    if (p.coupon) return '<span class="price"><s>' + U.fmt(p.base) + '</s> ' + ui.coin('coin-xs') + '<b>' + U.fmt(p.final) + '</b><em class="sale">-' + D.RULES.DISCOUNT_PERCENT + '%</em></span>';
    return '<span class="price">' + ui.coin('coin-xs') + '<b>' + U.fmt(p.final) + '</b></span>';
  }

  function itemCard(state, d, item) {
    const st = E.unlockStatus(item, d);
    const owned = E.ownedCount(state, item.id);
    const skin = state.skins.active;
    const p = E.priceFor(state, item);
    let button;
    let extra = '';
    if (item.cat === 'skin' && owned) {
      button =
        state.skins.active === item.id
          ? '<button type="button" class="btn btn-secondary btn-sm btn-block" disabled>' + ui.icon('check') + '적용 중</button>'
          : '<button type="button" class="btn btn-primary btn-sm btn-block" data-action="shop:apply" data-item="' + item.id + '">적용하기</button>';
    } else if (!st.unlocked) {
      button = '<button type="button" class="btn btn-secondary btn-sm btn-block" disabled>' + ui.icon('lock', 'ic-sm') + '잠김</button>';
      extra = '<p class="ic-lock">' + st.text + '</p>';
    } else if (d.balance < p.final) {
      button = '<button type="button" class="btn btn-secondary btn-sm btn-block" disabled>TOKEN 부족</button>';
      extra = '<p class="ic-need">' + U.fmt(p.final - d.balance) + ' TOKEN 더 필요</p>';
    } else {
      button = '<button type="button" class="btn btn-sun btn-sm btn-block" data-action="shop:buy" data-item="' + item.id + '">구매</button>';
    }
    const valueTxt = item.cat === 'skin' ? '도시 분위기 변경' : '가치 +' + U.fmt(E.itemValue(item, 1));
    return (
      '<article class="item-card' + (st.unlocked || owned ? '' : ' locked') + '">' +
      V.thumb(item.id, 1, item.cat === 'skin' ? item.id : skin) +
      '<div class="ic-body"><h3>' + item.name + '</h3><p class="ic-en">' + (item.en || '') + '</p>' +
      (item.cat === 'skin' && owned ? '<p class="ic-owned">보유 중</p>' : priceHtml(state, item)) +
      '<p class="ic-meta">' + valueTxt + (owned && item.cat !== 'skin' ? ' · 보유 ' + owned : '') + '</p>' + extra +
      '</div>' + button +
      '</article>'
    );
  }

  function render(ctx) {
    const { state, d } = ctx;
    const tab = D.SHOP_TABS.some((t) => t.id === app.view.shopTab) ? app.view.shopTab : 'building';
    let html = V.pageHead('상점', 'TOKEN으로 건물을 짓고 도시를 꾸며요.');
    html +=
      '<div class="shop-bar"><button type="button" class="chip chip-coin" data-nav="history" data-tab="ledger" aria-label="보유 TOKEN ' + U.fmt(d.balance) + '개, 내역 보기">' + ui.coin() + '<b>' + U.fmt(d.balance) + '</b> TOKEN</button>' +
      (state.coupons ? '<span class="chip chip-tag">🏷️ 할인 쿠폰 ' + state.coupons + '장 · 다음 건물 -' + D.RULES.DISCOUNT_PERCENT + '%</span>' : '') +
      '</div>';
    html +=
      '<div class="seg seg-scroll" role="tablist" aria-label="상점 종류">' +
      D.SHOP_TABS.map((t) => '<button type="button" role="tab" aria-selected="' + (t.id === tab) + '" class="seg-btn' + (t.id === tab ? ' on' : '') + '" data-action="shop:tab" data-tab="' + t.id + '"><span>' + t.label + '</span><small>' + t.en + '</small></button>').join('') +
      '</div>';
    html += '<p class="hint">' + TAB_NOTES[tab] + '</p>';
    const items = D.ITEMS.filter((i) => i.cat === tab);
    html += '<div class="shop-grid">' + items.map((i) => itemCard(state, d, i)).join('') + '</div>';
    if (tab === 'decoration') {
      const specials = D.ITEMS.filter((i) => i.cat === 'special');
      html +=
        '<section class="card special-box" aria-labelledby="sp-h"><h2 class="sub" id="sp-h">특별 보상 장식</h2><p class="muted small">상점에서 팔지 않아요. 업적과 STREAK 보상으로만 받을 수 있어요.</p><div class="special-row">' +
        specials
          .map((i) => {
            const own = E.ownedCount(state, i.id);
            return '<div class="special-item' + (own ? ' owned' : '') + '">' + V.thumb(i.id, 1, state.skins.active, own ? '' : 'silhouette') + '<strong>' + i.name + '</strong><small>' + (own ? '보유 ' + own : U.esc(i.desc)) + '</small></div>';
          })
          .join('') +
        '</div></section>';
    }
    html += '<p class="fineprint">상점에서는 게임 속 TOKEN만 사용해요. 실제 돈으로 결제하거나 TOKEN을 충전할 수 없어요.</p>';
    return html;
  }

  /* ---------------- 공통 구매 흐름 ---------------- */

  function doBuy(itemId, placement) {
    const item = D.ITEM_MAP[itemId];
    const res = app.commit((s, now) => E.buyItem(s, itemId, placement || {}, now), { render: false });
    if (!res) return;
    app.render();
    const name = item.name;
    if (placement) {
      SC.audio.play('build');
      ui.toast(U.esc(josa(name, '을', '를')) + ' 지었어요! 도시 가치 +' + U.fmt(E.itemValue(item, 1)), { type: 'success', icon: '🏗️' });
      app.celebrate(res.events);
    } else if (PLACEABLE.includes(item.cat)) {
      SC.audio.play('build');
      const spot = E.firstEmptySlot(app.state);
      ui.open({
        title: '구매 완료!',
        body:
          '<div class="bought">' + V.thumb(itemId, 1, app.state.skins.active, 'thumb-lg') + '<p><b>' + U.esc(name) + '</b>' + (res.price.coupon ? ' (할인 쿠폰 사용)' : '') + '</p><p class="muted small">보관함에 들어갔어요. ' + (spot ? '지금 도시에 놓아 볼까요?' : '빈 땅이 없어서 지금은 보관만 할 수 있어요. 새 지역을 열면 놓을 수 있어요.') + '</p></div>',
        actions: spot
          ? [
              { label: '나중에', kind: 'secondary' },
              {
                label: '도시에 놓기',
                kind: 'sun',
                onClick: () => {
                  const r = D.REGION_MAP[app.view.cityRegion];
                  const ok = r && app.state.regions.includes(r.id) && E.emptySlots(app.state, r.id).length;
                  app.navigate('city', null, { view: { placing: { uid: res.uid, move: false }, cityRegion: ok ? r.id : spot.region, citySlot: null } });
                },
              },
            ]
          : [{ label: '확인', kind: 'primary' }],
        onClose: () => setTimeout(() => app.celebrate(res.events), 60),
      });
    } else if (item.cat === 'vehicle') {
      SC.audio.play('coin');
      ui.toast(U.esc(josa(name, '이', '가')) + ' 도로를 달리기 시작했어요!', { type: 'success', icon: '🚗', action: { label: '보러 가기', onClick: () => app.navigate('city') } });
      app.celebrate(res.events);
    } else if (item.cat === 'skin') {
      SC.audio.play('success');
      ui.toast("'" + U.esc(name) + "' 스킨을 적용했어요!", { type: 'success', icon: '🎨', action: { label: '도시 보기', onClick: () => app.navigate('city') } });
      app.celebrate(res.events);
    }
  }

  /** 구매 확인 창. placement가 있으면 그 자리에 바로 짓습니다. */
  SC.purchase = function (itemId, placement, onConfirmed) {
    const state = app.state;
    const d = app.d || E.derive(state, new Date());
    const item = D.ITEM_MAP[itemId];
    if (!item) return;
    const st = E.unlockStatus(item, d);
    if (!st.unlocked) {
      SC.audio.play('error');
      ui.toast('아직 잠겨 있어요. ' + st.text, { type: 'error' });
      return;
    }
    const p = E.priceFor(state, item);
    if (d.balance < p.final) {
      SC.audio.play('error');
      ui.toast('TOKEN이 ' + U.fmt(p.final - d.balance) + '개 부족해요.', { type: 'error' });
      return;
    }
    let note = '';
    if (placement) note = '구매하면 고른 빈 땅에 바로 지어져요.';
    else if (PLACEABLE.includes(item.cat)) note = '구매한 건물은 보관함에 들어가고, 원하는 빈 땅에 놓을 수 있어요.';
    else if (item.cat === 'vehicle') note = '구매하면 도시의 도로를 달리기 시작해요.';
    else if (item.cat === 'skin') note = '구매하면 바로 도시 전체에 적용돼요.';
    const body =
      '<div class="buy-box">' + V.thumb(itemId, 1, item.cat === 'skin' ? item.id : state.skins.active, 'thumb-lg') +
      '<div class="buy-info"><h3>' + item.name + '</h3><p class="muted small">' + U.esc(item.desc || '') + '</p></div></div>' +
      '<dl class="buy-list">' +
      '<div><dt>가격</dt><dd>' + V.tokens(p.base) + '</dd></div>' +
      (p.coupon ? '<div><dt>할인 쿠폰</dt><dd class="minus">-' + U.fmt(p.saved) + '</dd></div>' : '') +
      '<div class="total"><dt>결제</dt><dd>' + V.tokens(p.final) + '</dd></div>' +
      '<div><dt>구매 후 TOKEN</dt><dd>' + U.fmt(d.balance) + ' → <b>' + U.fmt(d.balance - p.final) + '</b></dd></div>' +
      (item.cat !== 'skin' ? '<div><dt>도시 가치</dt><dd class="plus">+' + U.fmt(E.itemValue(item, 1)) + '</dd></div>' : '') +
      '</dl>' +
      (note ? '<p class="hint">' + note + '</p>' : '');
    SC.audio.play('open');
    ui.open({
      title: placement ? item.name + ' 짓기' : item.name + ' 구매',
      body,
      actions: [
        { label: '취소', kind: 'secondary' },
        {
          label: placement ? '짓기' : '구매하기',
          kind: 'sun',
          id: 'confirm-buy',
          onClick: (close) => {
            close();
            if (onConfirmed) onConfirmed();
            doBuy(itemId, placement);
          },
        },
      ],
      focus: '#confirm-buy',
    });
  };

  app.actions['shop:tab'] = (btn) => {
    app.view.shopTab = btn.dataset.tab;
    SC.audio.play('tap');
    app.render();
  };

  app.actions['shop:buy'] = (btn) => SC.purchase(btn.dataset.item, null);

  app.actions['shop:apply'] = (btn) => {
    const id = btn.dataset.item;
    const res = app.commit((s, now) => E.applySkin(s, id, now));
    if (!res) return;
    SC.audio.play('success');
    ui.toast("'" + D.ITEM_MAP[id].name + "' 스킨을 적용했어요!", { type: 'success', icon: '🎨', action: { label: '도시 보기', onClick: () => app.navigate('city') } });
    app.celebrate(res.events);
  };

  SC.screens.shop = { title: () => '상점', render };
})(window);
