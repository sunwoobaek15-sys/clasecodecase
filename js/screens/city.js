/* SAVE CITY — CITY 화면 (기획서 11~15): 지도, 건설, 업그레이드, 이동, 보관함, 지역 해금 */
(function (root) {
  'use strict';
  const SC = root.SC;
  const U = SC.util;
  const D = SC.data;
  const E = SC.engine;
  const ui = SC.ui;
  const V = SC.view;
  const app = SC.app;
  const R = D.RULES;

  let stopAnim = null;
  let openSheet = null;

  const CAT_NAME = { building: '건물', decoration: '장식', landmark: '랜드마크', special: '특별 장식', vehicle: '탈것', skin: '스킨' };

  function region() {
    return D.REGION_MAP[app.view.cityRegion] || D.REGIONS[0];
  }

  function josa(word, a, b) {
    const ch = word.charCodeAt(word.length - 1);
    if (ch < 0xac00 || ch > 0xd7a3) return word + a;
    return word + ((ch - 0xac00) % 28 ? a : b);
  }

  /* ---------------- 화면 ---------------- */

  function render(ctx) {
    const { state, d } = ctx;
    const reg = region();
    const unlocked = state.regions.includes(reg.id);
    const inv = E.inventory(state);
    const placing = app.view.placing;
    const skin = state.skins.active;
    const sky = SC.cityArt.palette(skin).sky;
    const placed = E.placedMap(state, reg.id);
    const empties = unlocked ? E.emptySlots(state, reg.id) : [];

    let html = V.pageHead(
      U.esc(state.user.nickname) + '의 도시',
      'LEVEL ' + d.cityLevel + ' · 도시 가치 ' + U.fmt(d.cityValue),
      { right: '<button type="button" class="btn btn-secondary btn-sm" data-action="city:inventory">' + ui.icon('box') + '보관함' + (inv.length ? '<span class="count">' + inv.length + '</span>' : '') + '</button>' }
    );

    html +=
      '<button type="button" class="level-strip" data-action="app:level" aria-label="도시 LEVEL ' + d.cityLevel + ' 자세히 보기">' +
      '<span class="ls-lv">LV ' + d.cityLevel + '</span>' + ui.progressBar(d.level.pct, { cls: 'progress-thin' }) +
      '<span class="ls-txt">' + (d.level.next ? '다음 레벨까지 ' + U.fmt(d.level.toNext) + ' XP' : '최고 레벨') + '</span>' + ui.icon('info', 'ic-xs') +
      '</button>';

    html +=
      '<div class="region-tabs" role="tablist" aria-label="지역">' +
      D.REGIONS.map((r) => {
        const sel = r.id === reg.id;
        const open = state.regions.includes(r.id);
        const ready = !open && d.cityLevel >= r.level;
        return (
          '<button type="button" role="tab" aria-selected="' + sel + '" class="region-tab' + (sel ? ' on' : '') + (open ? '' : ' locked') + (ready ? ' ready' : '') + '" data-action="city:region" data-region="' + r.id + '">' +
          '<span class="rt-no">REGION ' + r.no + '</span><span class="rt-name">' + r.name + '</span>' +
          (open ? '' : '<span class="rt-lock">' + (ready ? '🔓 열기 가능' : '🔒 LV ' + r.level) + '</span>') +
          '</button>'
        );
      }).join('') +
      '</div>';

    if (placing && unlocked) {
      const b = E.findBuilding(state, placing.uid);
      if (b) {
        const name = D.ITEM_MAP[b.itemId].name;
        html +=
          '<div class="placing-banner" role="status">' + V.thumb(b.itemId, state.buildingLevels[b.uid] || 1, skin, 'thumb-sm') +
          '<p>' + (empties.length ? '<b>' + U.esc(josa(name, '을', '를')) + '</b> ' + (placing.move ? '옮길' : '놓을') + ' 빈 땅을 눌러 주세요.' : '이 지역에는 빈 땅이 없어요. 다른 지역을 고르거나 건물을 보관함에 넣어 주세요.') + '</p>' +
          '<button type="button" class="btn btn-secondary btn-sm" data-action="city:cancelPlace">취소</button></div>';
      }
    }

    if (unlocked) {
      const map = SC.cityArt.renderMap({
        regionId: reg.id,
        state,
        skin,
        interactive: true,
        vehicles: true,
        placing: !!placing,
        selectedSlot: app.view.citySlot,
        title: reg.name + ' 지도. 빈 땅을 눌러 건물을 지을 수 있어요.',
      });
      html +=
        '<div class="map-wrap' + (app.view.zoom ? ' zoomed' : '') + '" style="--sky1:' + sky[0] + ';--sky2:' + sky[1] + '">' +
        '<div class="map-scroll" id="map-scroll"><div class="map-inner">' + map + '</div></div>' +
        '<div class="map-tools">' +
        '<button type="button" class="map-tool" data-action="city:zoom" aria-pressed="' + !!app.view.zoom + '">' + (app.view.zoom ? '− 축소' : '＋ 확대') + '</button>' +
        '<button type="button" class="map-tool" data-nav="shop" data-tab="skin">🎨 ' + D.ITEM_MAP[skin].name + '</button>' +
        '</div></div>';
      html += '<p class="hint center">' + (placing ? '반짝이는 빈 땅을 눌러 주세요.' : '빈 땅(+)을 누르면 건물을 짓고, 건물을 누르면 업그레이드·이동할 수 있어요.') + '</p>';
    } else {
      const ready = d.cityLevel >= reg.level;
      const empty = SC.cityArt.renderMap({ regionId: reg.id, state: null, skin, title: reg.name + ' (잠김)' });
      html +=
        '<div class="locked-region" style="--sky1:' + sky[0] + ';--sky2:' + sky[1] + '">' +
        '<div class="locked-map" aria-hidden="true">' + empty + '</div>' +
        '<div class="locked-info">' +
        '<div class="lock-badge" aria-hidden="true">' + (ready ? '🔓' : '🔒') + '</div>' +
        '<h2>' + V.regionName(reg) + '</h2><p>' + reg.desc + ' · 빈 땅 ' + reg.plots + '칸</p>' +
        (ready
          ? '<button type="button" class="btn btn-sun" data-action="city:unlockRegion" data-region="' + reg.id + '">' + ui.icon('map') + '지역 해금하기</button>'
          : '<p class="lock-need">도시 LEVEL <b>' + reg.level + '</b>이 되면 열 수 있어요. (지금 LEVEL ' + d.cityLevel + ')</p>' + ui.progressBar(d.xp / Math.max(1, E.levelThreshold(reg.level)), { label: '지역 해금 진행률' })) +
        '</div></div>';
    }

    // 이 지역의 건물 목록 (키보드·화면 낭독기로도 쓸 수 있도록)
    if (unlocked) {
      const list = Object.keys(placed)
        .map(Number)
        .sort((a, b) => a - b)
        .map((slot) => placed[slot]);
      html += '<section class="card" aria-labelledby="rlist-h"><div class="card-head"><h2 id="rlist-h">' + reg.name + '의 건물</h2><span class="muted">빈 땅 ' + empties.length + ' / ' + reg.plots + '칸</span></div>';
      if (list.length) {
        html +=
          '<ul class="bld-list">' +
          list
            .map((b) => {
              const item = D.ITEM_MAP[b.itemId];
              const lvl = state.buildingLevels[b.uid];
              return (
                '<li><button type="button" class="bld-row" data-action="city:openBuilding" data-uid="' + b.uid + '">' + V.thumb(b.itemId, lvl || 1, skin, 'thumb-sm') +
                '<span class="bld-main"><strong>' + item.name + '</strong><small>' + (lvl ? 'LEVEL ' + lvl : CAT_NAME[item.cat]) + ' · 가치 +' + U.fmt(E.itemValue(item, lvl || 1)) + '</small></span>' + ui.icon('next', 'ic-sm') + '</button></li>'
              );
            })
            .join('') +
          '</ul>';
      } else {
        html += '<p class="muted pad">아직 이 지역에 건물이 없어요.</p>';
      }
      if (empties.length && !placing) html += '<button type="button" class="btn btn-primary btn-block" data-action="city:openPlot" data-slot="' + empties[0] + '">' + ui.icon('plus') + '빈 땅에 짓기</button>';
      html += '</section>';
    }

    if (state.vehicles.length) {
      html += '<p class="hint center">🚗 탈것 ' + state.vehicles.length + '대가 도로를 달리고 있어요.</p>';
    }
    return html;
  }

  /* ---------------- 시트 ---------------- */

  function closeSheet() {
    if (openSheet) openSheet.close();
    openSheet = null;
  }

  function selectSlot(slot) {
    app.view.citySlot = slot;
    app.render();
  }

  function plotSheetBody(regionId, slot) {
    const state = app.state;
    const d = app.d;
    const skin = state.skins.active;
    const inv = E.inventory(state);
    let html = '';
    if (inv.length) {
      html +=
        '<h3 class="sub">보관함에서 놓기</h3><ul class="pick-list">' +
        inv
          .map((b) => {
            const item = D.ITEM_MAP[b.itemId];
            const lvl = state.buildingLevels[b.uid];
            return (
              '<li class="pick-item">' + V.thumb(b.itemId, lvl || 1, skin, 'thumb-sm') + '<span class="pick-main"><strong>' + item.name + '</strong><small>' + (lvl ? 'LEVEL ' + lvl : CAT_NAME[item.cat]) + '</small></span>' +
              '<button type="button" class="btn btn-primary btn-sm" data-action="city:placeHere" data-uid="' + b.uid + '" data-region="' + regionId + '" data-slot="' + slot + '">여기에 놓기</button></li>'
            );
          })
          .join('') +
        '</ul>';
    }
    const groups = [
      ['building', '건물'],
      ['decoration', '장식'],
      ['landmark', '랜드마크'],
    ];
    html += '<h3 class="sub">바로 짓기 <small class="muted">보유 ' + ui.coin('coin-xs') + U.fmt(d.balance) + '</small></h3>';
    for (const [cat, label] of groups) {
      const items = D.ITEMS.filter((i) => i.cat === cat && i.price > 0 && E.unlockStatus(i, d).unlocked);
      if (!items.length) continue;
      html +=
        '<p class="pick-group">' + label + '</p><ul class="pick-list">' +
        items
          .map((item) => {
            const price = E.priceFor(state, item);
            const enough = d.balance >= price.final;
            return (
              '<li class="pick-item">' + V.thumb(item.id, 1, skin, 'thumb-sm') + '<span class="pick-main"><strong>' + item.name + '</strong><small>' +
              (price.coupon ? '<s>' + U.fmt(price.base) + '</s> ' : '') + ui.coin('coin-xs') + U.fmt(price.final) + ' · 가치 +' + U.fmt(E.itemValue(item, 1)) + '</small></span>' +
              '<button type="button" class="btn btn-sm ' + (enough ? 'btn-sun' : 'btn-secondary') + '" data-action="city:buyHere" data-item="' + item.id + '" data-region="' + regionId + '" data-slot="' + slot + '"' + (enough ? '' : ' disabled') + '>' + (enough ? '짓기' : 'TOKEN 부족') + '</button></li>'
            );
          })
          .join('') +
        '</ul>';
    }
    const locked = D.ITEMS.filter((i) => ['building', 'decoration', 'landmark'].includes(i.cat) && i.price > 0 && !E.unlockStatus(i, d).unlocked).length;
    if (locked) html += '<p class="hint">잠긴 아이템 ' + locked + '개는 도시 LEVEL을 올리거나 건물을 업그레이드하면 열려요.</p>';
    return html;
  }

  function openPlotSheet(regionId, slot) {
    selectSlot(slot);
    const reg = D.REGION_MAP[regionId];
    openSheet = ui.sheet({
      title: '빈 땅 · ' + reg.name,
      body: plotSheetBody(regionId, slot),
      actions: [{ label: '상점 전체 보기', kind: 'secondary', onClick: () => app.navigate('shop') }],
      onClose: () => {
        openSheet = null;
        if (app.route.name === 'city' && app.view.citySlot === slot) {
          app.view.citySlot = null;
          app.render();
        }
      },
    });
  }

  function levelStrip(item, level, skin) {
    let html = '<div class="level-strip-items" aria-label="레벨별 모습">';
    for (let L = 1; L <= R.MAX_BUILDING_LEVEL; L++) {
      html += '<div class="lv-step' + (L === level ? ' on' : L < level ? ' done' : '') + '">' + V.thumb(item.id, L, skin, 'thumb-xs') + '<span>Lv.' + L + '</span></div>';
    }
    return html + '</div>';
  }

  function buildingBody(uid) {
    const state = app.state;
    const d = app.d;
    const b = E.findBuilding(state, uid);
    if (!b) return '<p class="muted">건물을 찾을 수 없어요.</p>';
    const item = D.ITEM_MAP[b.itemId];
    const skin = state.skins.active;
    const info = E.upgradeInfo(state, uid);
    const level = state.buildingLevels[uid] || 1;
    let html =
      '<div class="bs-top">' + V.thumb(item.id, level, skin, 'thumb-lg') +
      '<div class="bs-info"><p class="bs-cat">' + CAT_NAME[item.cat] + (item.en ? ' · ' + item.en.toUpperCase() : '') + '</p>' +
      (item.cat === 'building' ? '<p class="bs-level">LEVEL ' + level + '<small> / ' + R.MAX_BUILDING_LEVEL + '</small></p>' : '') +
      '<p class="bs-value">도시 가치 <b>+' + U.fmt(E.itemValue(item, level)) + '</b></p>' +
      '<p class="small muted">' + U.esc(item.desc || '') + '</p></div></div>';
    if (item.cat === 'building') {
      html += levelStrip(item, level, skin);
      const unlocks = D.ITEMS.filter((i) => i.unlock && i.unlock.item === item.id);
      unlocks.forEach((u) => {
        const done = (d.city.maxLevelByItem[item.id] || 0) >= u.unlock.itemLevel;
        html += '<p class="hint">' + (done ? '🔓 \'' + u.name + '\' 장식이 상점에 열려 있어요.' : '🔒 Lv.' + u.unlock.itemLevel + '이 되면 \'' + u.name + '\' 장식이 열려요.') + '</p>';
      });
      if (info.upgradable) {
        const enough = d.balance >= info.cost;
        html +=
          '<div class="upgrade-box">' +
          '<p>다음 레벨 <b>LEVEL ' + (info.level + 1) + '</b> · 도시 가치 +' + U.fmt(info.nextValue) + ' <span class="up">(+' + U.fmt(info.nextValue - info.value) + ')</span></p>' +
          '<p class="cost">업그레이드 비용 ' + V.tokens(info.cost) + '</p>' +
          '<button type="button" class="btn btn-primary btn-block" data-action="city:upgrade" data-uid="' + uid + '"' + (enough ? '' : ' disabled') + '>' + ui.icon('up') + 'UPGRADE</button>' +
          (enough ? '' : '<p class="warn-line">TOKEN이 ' + U.fmt(info.cost - d.balance) + '개 부족해요. 절약을 기록해서 모아 보세요!</p>') +
          '</div>';
      } else {
        html += '<p class="ok-line">⭐ 최고 레벨이에요!</p>';
      }
    }
    html +=
      '<div class="row-actions">' +
      '<button type="button" class="btn btn-secondary" data-action="city:move" data-uid="' + uid + '">' + ui.icon('move') + '이동</button>' +
      '<button type="button" class="btn btn-secondary" data-action="city:store" data-uid="' + uid + '">' + ui.icon('box') + '보관함에 넣기</button>' +
      '</div>';
    return html;
  }

  function openBuildingSheet(uid) {
    const b = E.findBuilding(app.state, uid);
    if (!b) return;
    if (b.region) {
      app.view.cityRegion = b.region;
      selectSlot(b.slot);
    }
    const slot = b.slot;
    openSheet = ui.sheet({
      title: D.ITEM_MAP[b.itemId].name,
      body: buildingBody(uid),
      className: 'sheet-building',
      onClose: () => {
        openSheet = null;
        if (app.route.name === 'city' && app.view.citySlot === slot && !app.view.placing) {
          app.view.citySlot = null;
          app.render();
        }
      },
    });
  }

  function inventoryBody() {
    const state = app.state;
    const inv = E.inventory(state);
    const skin = state.skins.active;
    if (!inv.length) {
      return V.empty('📦', '보관함이 비어 있어요', '상점에서 산 건물이나 보상으로 받은 장식이 여기에 들어와요.', '<button type="button" class="btn btn-primary" data-nav="shop">상점 가기</button>');
    }
    return (
      '<p class="hint">보관함에 있는 건물도 도시 가치에 포함돼요. 놓을 건물을 고른 뒤 빈 땅을 눌러 주세요.</p><ul class="pick-list">' +
      inv
        .map((b) => {
          const item = D.ITEM_MAP[b.itemId];
          const lvl = state.buildingLevels[b.uid];
          return (
            '<li class="pick-item">' + V.thumb(b.itemId, lvl || 1, skin, 'thumb-sm') + '<span class="pick-main"><strong>' + item.name + '</strong><small>' + (lvl ? 'LEVEL ' + lvl : CAT_NAME[item.cat]) + '</small></span>' +
            '<button type="button" class="btn btn-primary btn-sm" data-action="city:pickPlace" data-uid="' + b.uid + '">놓기</button></li>'
          );
        })
        .join('') +
      '</ul>'
    );
  }

  /* ---------------- 지도 클릭 ---------------- */

  function onMapClick(e) {
    const el = e.target.closest('[data-slot]');
    if (!el) return;
    const reg = region();
    const slot = Number(el.dataset.slot);
    if (reg.tiles[slot] !== 'plot') {
      if (app.view.placing) ui.toast(reg.tiles[slot] === 'water' ? '물 위에는 지을 수 없어요.' : '도로에는 지을 수 없어요. 빈 땅을 골라 주세요.', { type: 'info' });
      return;
    }
    const b = E.placedMap(app.state, reg.id)[slot];
    if (app.view.placing) {
      placeAt(reg, slot, b);
      return;
    }
    SC.audio.play('open');
    if (b) openBuildingSheet(b.uid);
    else openPlotSheet(reg.id, slot);
  }

  function placeAt(reg, slot, occupant) {
    const p = app.view.placing;
    if (occupant && occupant.uid === p.uid) {
      app.view.placing = null;
      app.render();
      return;
    }
    if (occupant) {
      SC.audio.play('error');
      ui.toast('이미 건물이 있는 땅이에요. 빈 땅을 골라 주세요.', { type: 'error' });
      return;
    }
    const b = E.findBuilding(app.state, p.uid);
    const res = app.commit((s, now) => E.placeItem(s, p.uid, reg.id, slot, now), { render: false });
    if (!res) return;
    app.view.placing = null;
    app.view.citySlot = null;
    SC.audio.play('build');
    app.render();
    ui.toast(U.esc(josa(D.ITEM_MAP[b.itemId].name, '을', '를')) + ' ' + (p.move ? '옮겼어요!' : '놓았어요!'), { type: 'success', icon: '🏗️' });
    app.celebrate(res.events);
  }

  /* ---------------- 버튼 ---------------- */

  app.actions['city:region'] = (btn) => {
    app.view.cityRegion = btn.dataset.region;
    app.view.citySlot = null;
    SC.audio.play('tap');
    app.render();
  };

  app.actions['city:zoom'] = () => {
    app.view.zoom = !app.view.zoom;
    app.render();
    const sc = document.getElementById('map-scroll');
    if (sc && app.view.zoom) {
      sc.scrollLeft = (sc.scrollWidth - sc.clientWidth) / 2;
      sc.scrollTop = (sc.scrollHeight - sc.clientHeight) / 2;
    }
  };

  app.actions['city:inventory'] = () => {
    SC.audio.play('open');
    openSheet = ui.sheet({ title: '보관함', body: inventoryBody(), onClose: () => (openSheet = null) });
  };

  app.actions['city:pickPlace'] = (btn) => {
    closeSheet();
    const reg = region();
    if (!app.state.regions.includes(reg.id)) app.view.cityRegion = 'village';
    app.view.placing = { uid: btn.dataset.uid, move: false };
    app.view.citySlot = null;
    if (app.route.name !== 'city') app.navigate('city');
    else app.render();
  };

  app.actions['city:placeHere'] = (btn) => {
    const uid = btn.dataset.uid;
    const regionId = btn.dataset.region;
    const slot = Number(btn.dataset.slot);
    closeSheet();
    const b = E.findBuilding(app.state, uid);
    const res = app.commit((s, now) => E.placeItem(s, uid, regionId, slot, now), { render: false });
    if (!res) return;
    app.view.citySlot = null;
    SC.audio.play('build');
    app.render();
    ui.toast(U.esc(josa(D.ITEM_MAP[b.itemId].name, '을', '를')) + ' 놓았어요!', { type: 'success', icon: '🏗️' });
    app.celebrate(res.events);
  };

  app.actions['city:buyHere'] = (btn) => {
    const itemId = btn.dataset.item;
    const regionId = btn.dataset.region;
    const slot = Number(btn.dataset.slot);
    SC.purchase(itemId, { region: regionId, slot }, () => closeSheet());
  };

  app.actions['city:openPlot'] = (btn) => {
    openPlotSheet(region().id, Number(btn.dataset.slot));
  };

  app.actions['city:openBuilding'] = (btn) => {
    SC.audio.play('open');
    openBuildingSheet(btn.dataset.uid);
  };

  app.actions['city:upgrade'] = (btn) => {
    const uid = btn.dataset.uid;
    const b = E.findBuilding(app.state, uid);
    if (!b) return;
    const res = app.commit((s, now) => E.upgradeItem(s, uid, now));
    if (!res) return;
    SC.audio.play('upgrade');
    ui.confetti(40);
    if (openSheet && openSheet.el.isConnected) {
      const body = openSheet.el.querySelector('.dialog-body');
      if (body) body.innerHTML = buildingBody(uid);
    }
    ui.toast('<b>LEVEL ' + res.level + '</b>로 업그레이드! 도시 가치 +' + U.fmt(res.valueGain), { type: 'success', icon: '⬆️' });
    app.celebrate(res.events);
  };

  app.actions['city:move'] = (btn) => {
    const uid = btn.dataset.uid;
    closeSheet();
    app.view.placing = { uid, move: true };
    app.view.citySlot = null;
    app.render();
    ui.toast('옮길 빈 땅을 눌러 주세요. 다른 지역 탭을 눌러 다른 지역으로도 옮길 수 있어요.', { type: 'info' });
  };

  app.actions['city:store'] = (btn) => {
    const uid = btn.dataset.uid;
    const b = E.findBuilding(app.state, uid);
    if (!b) return;
    const from = { region: b.region, slot: b.slot };
    closeSheet();
    const res = app.commit((s, now) => E.storeItem(s, uid, now), { render: false });
    if (!res) return;
    app.view.citySlot = null;
    app.render();
    SC.audio.play('tap');
    ui.toast(U.esc(josa(D.ITEM_MAP[b.itemId].name, '을', '를')) + ' 보관함에 넣었어요.', {
      type: 'info',
      icon: '📦',
      action: from.region
        ? {
            label: '되돌리기',
            onClick: () => {
              const r = app.commit((s, now) => E.placeItem(s, uid, from.region, from.slot, now));
              if (r) SC.audio.play('build');
            },
          }
        : null,
    });
  };

  app.actions['city:cancelPlace'] = () => {
    app.view.placing = null;
    app.render();
  };

  app.actions['city:unlockRegion'] = (btn) => {
    const id = btn.dataset.region;
    const res = app.commit((s, now) => E.unlockRegion(s, id, now));
    if (!res) return;
    SC.audio.play('unlock');
    ui.confetti(120);
    ui.toast('새 지역 <b>' + res.region.name + '</b>이(가) 열렸어요! 빈 땅 ' + res.region.plots + '칸이 생겼어요.', { type: 'success', icon: '🗺️' });
    app.celebrate(res.events);
  };

  SC.screens.city = {
    title: () => '도시',
    render,
    mount(rootEl) {
      const svg = rootEl.querySelector('.map-inner svg');
      if (svg) {
        svg.addEventListener('click', onMapClick);
        stopAnim = SC.cityArt.animate(svg, () => app.state.settings.animation && document.visibilityState !== 'hidden');
      }
      const sc = rootEl.querySelector('#map-scroll');
      if (sc && app.view.zoom) {
        sc.scrollLeft = (sc.scrollWidth - sc.clientWidth) / 2;
        sc.scrollTop = (sc.scrollHeight - sc.clientHeight) / 2;
      }
      const tab = rootEl.querySelector('.region-tab.on');
      if (tab) {
        const wrap = tab.parentElement;
        wrap.scrollLeft = tab.offsetLeft - wrap.offsetLeft - (wrap.clientWidth - tab.offsetWidth) / 2;
      }
    },
    unmount() {
      if (stopAnim) stopAnim();
      stopAnim = null;
    },
  };

  SC.cityHelpers = { josa };
})(window);
