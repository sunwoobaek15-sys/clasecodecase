/* SAVE CITY — SETTINGS 화면 (기획서 24) */
(function (root) {
  'use strict';
  const SC = root.SC;
  const U = SC.util;
  const E = SC.engine;
  const ui = SC.ui;
  const V = SC.view;
  const app = SC.app;

  function toggleRow(id, key, iconName, label, desc, checked) {
    return (
      '<div class="set-row">' +
      '<span class="set-ic" aria-hidden="true">' + ui.icon(iconName) + '</span>' +
      '<label class="set-text" for="' + id + '"><b>' + label + '</b><small>' + desc + '</small></label>' +
      '<input type="checkbox" role="switch" class="switch" id="' + id + '" data-setting="' + key + '"' + (checked ? ' checked' : '') + ' aria-checked="' + checked + '">' +
      '</div>'
    );
  }

  function render(ctx) {
    const { state } = ctx;
    const s = state.settings;
    const dark = app.isDark();
    const saved = SC.storage.lastSavedAt;
    const storageText =
      app.storageStatus === 'unavailable'
        ? '<p class="warn-line">이 브라우저에서는 저장 기능이 꺼져 있어요. (개인정보 보호 모드 등) 창을 닫으면 기록이 사라질 수 있어요.</p>'
        : '<p class="ok-line">✓ 이 기기에 자동 저장 중' + (saved ? ' · 마지막 저장 ' + String(saved.getHours()).padStart(2, '0') + ':' + String(saved.getMinutes()).padStart(2, '0') : '') + '</p>';
    let html = V.pageHead('설정', '', { back: 'profile' });
    html +=
      '<section class="card settings" aria-label="소리와 화면">' +
      toggleRow('s-sound', 'sound', 'music', '사운드', '잔잔한 배경 음악' + (SC.audio.supported ? '' : ' (이 브라우저는 지원하지 않아요)'), s.sound) +
      toggleRow('s-sfx', 'sfx', 'volume', '효과음', 'TOKEN, 건설, 버튼 소리', s.sfx) +
      toggleRow('s-anim', 'animation', 'motion', '애니메이션', '움직이는 자동차, 축하 효과', s.animation) +
      toggleRow('s-dark', 'dark', 'moon', '다크 모드', s.theme === 'system' ? '지금은 기기 설정을 따라요' : '직접 고른 화면 모드예요', dark) +
      (s.theme !== 'system' ? '<button type="button" class="link-btn set-sub" data-action="settings:system">기기 설정 따르기로 되돌리기</button>' : '') +
      '</section>';
    html +=
      '<section class="card" aria-labelledby="data-h"><h2 class="sub" id="data-h">데이터</h2>' +
      '<p class="muted small">모든 기록은 이 기기의 브라우저에 저장돼요. (게임 데이터는 localStorage, 사진은 IndexedDB) 앱을 닫았다 다시 열어도 그대로 남아요. 다른 기기로 자동으로 옮겨지지는 않아요.</p>' +
      storageText +
      '<button type="button" class="btn btn-danger btn-block" data-action="settings:reset">' + ui.icon('trash') + '데이터 초기화</button>' +
      '</section>';
    html +=
      '<section class="card" aria-labelledby="rule-h"><h2 class="sub" id="rule-h">TOKEN과 안전 안내</h2><ul class="rule-list">' +
      '<li>TOKEN은 게임 속 포인트예요. <b>실제 화폐가 아니에요.</b></li>' +
      '<li>TOKEN을 <b>실제 돈으로 바꿀 수 없고</b>, 돈으로 충전할 수도 없어요.</li>' +
      '<li>앱에 실제 돈을 넣거나 투자하는 기능은 없어요.</li>' +
      '<li>도박이나 현금성 랜덤 보상은 없어요. 보너스는 직접 골라요.</li>' +
      '<li>하루 최대 50,000원(500 TOKEN)까지 인정돼요. 절약 여부를 은행처럼 확인하지 않으니 솔직하게 기록해 주세요.</li>' +
      '</ul></section>';
    html +=
      '<section class="card" aria-labelledby="help-h"><h2 class="sub" id="help-h">도움말</h2>' +
      '<button type="button" class="menu-row" data-action="settings:guide">' + ui.icon('help') + '<span>게임 방법 다시 보기</span>' + ui.icon('next', 'ic-sm') + '</button>' +
      '<button type="button" class="menu-row" data-action="app:streak">' + ui.icon('fire') + '<span>STREAK 규칙</span>' + ui.icon('next', 'ic-sm') + '</button>' +
      '<button type="button" class="menu-row" data-action="app:level">' + ui.icon('city') + '<span>도시 LEVEL 계산 방법</span>' + ui.icon('next', 'ic-sm') + '</button>' +
      '</section>';
    html += '<p class="version">SAVE CITY v1.0 · 작은 절약이 만드는 큰 변화!</p>';
    return html;
  }

  function mount(rootEl) {
    rootEl.querySelectorAll('input[data-setting]').forEach((input) => {
      input.addEventListener('change', () => {
        const key = input.dataset.setting;
        const on = input.checked;
        input.setAttribute('aria-checked', String(on));
        const patch = key === 'dark' ? { theme: on ? 'dark' : 'light' } : { [key]: on };
        app.commit((s) => E.setSettings(s, patch), { render: false });
        if (key === 'sound' || key === 'sfx') SC.audio.unlock();
        app.applySettings();
        SC.audio.play('toggle');
        if (key === 'dark') app.render();
        else {
          const small = input.parentElement.querySelector('small');
          if (key === 'sound' && small) small.textContent = on ? '배경 음악이 켜졌어요' : '잔잔한 배경 음악';
        }
      });
    });
  }

  app.actions['settings:system'] = () => {
    app.commit((s) => E.setSettings(s, { theme: 'system' }), { render: false });
    app.applySettings();
    app.render();
  };

  app.actions['settings:guide'] = () => app.openOnboarding(true);

  app.actions['settings:reset'] = async () => {
    const ranked = !!(SC.ranking && SC.ranking.joined());
    const ok = await ui.confirm({
      title: '데이터 초기화',
      message: '<b>정말 모든 데이터를 삭제하시겠습니까?</b><br>절약 기록, TOKEN, 도시, 업적, 사진, 설정이 모두 지워지고 되돌릴 수 없어요.' + (ranked ? '<br>랭킹에 올린 내 기록도 함께 지워요.' : ''),
      confirmLabel: '모두 삭제',
      confirmId: 'confirm-reset',
      danger: true,
    });
    if (!ok) return;
    if (ranked) {
      try {
        await SC.ranking.leave();
      } catch (e) {
        // 랭킹 기록을 못 지워도 기기 데이터 초기화는 계속해요. (나중에 랭킹 화면에서 지울 수 있어요)
        ui.toast('랭킹 기록은 지우지 못했어요. 나중에 랭킹 화면에서 지울 수 있어요.', { type: 'error', duration: 6000 });
      }
    }
    SC.storage.clear();
    await SC.images.clear();
    app.state = E.createState(new Date());
    app.view.saveDraft = null;
    app.view.editDraft = null;
    app.view.placing = null;
    app.view.cityRegion = 'village';
    app.view.citySlot = null;
    app.persist();
    app.applySettings();
    app.navigate('home');
    ui.toast('모든 데이터를 삭제했어요. 새로 시작해요!', { type: 'info', icon: '🧹' });
    app.openOnboarding(false);
  };

  SC.screens.settings = { title: () => '설정', render, mount };
})(window);
