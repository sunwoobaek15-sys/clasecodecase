/* 플레이 기록 화면: 게임별 최고 점수, 플레이/완성 횟수, 최단 시간, 배지 */
(function (KK) {
  'use strict';
  KK.screens = KK.screens || {};

  KK.screens.records = function (root) {
    const { el, button, formatNum, badgeEl } = KK.ui;
    const t = KK.i18n.t;

    const list = el('div', { class: 'records-list' });
    KK.games.catalog.forEach((g) => {
      const def = KK.games.get(g.id);
      const st = KK.save.gameStats(g.id);
      const head = el(
        'div',
        { class: 'rec-head' },
        el('div', { class: 'rec-thumb', html: KK.art.cards[g.id] }),
        el('div', null, el('h3', { text: t(`game.${g.id}.name`) }), el('span', { class: 'card-tag ' + g.country, text: t('tag.' + g.country) }))
      );
      const sec = el('section', { class: 'rec-card' + (def ? '' : ' soon'), style: `--accent:${g.color}`, 'data-game': g.id }, head);
      if (!def) {
        sec.append(el('p', { class: 'rec-soon', text: t('records.notYet') }));
      } else {
        const stat = (label, value) => el('div', { class: 'rec-stat' }, el('span', { text: label }), el('b', { text: value }));
        sec.append(
          el(
            'div',
            { class: 'rec-stats' },
            stat(t('records.best'), formatNum(st.best)),
            stat(t('records.plays'), formatNum(st.plays)),
            stat(t('records.completions'), formatNum(st.completions)),
            stat(t('records.bestTime'), st.bestTime == null ? t('records.none') : t('records.seconds', { s: st.bestTime.toFixed(1) }))
          ),
          el('h4', { text: t('records.badges') }),
          el(
            'div',
            { class: 'badge-grid' },
            (def.badges || []).map((b) => badgeEl(b, KK.save.hasBadge(b.id), g.color))
          )
        );
      }
      list.append(sec);
    });

    root.append(
      el(
        'div',
        { class: 'records-screen' },
        el(
          'nav',
          { class: 'topbar records-top' },
          button({ icon: 'back', label: t('records.back'), cls: 'btn-chip', onClick: () => KK.router.go('menu') }),
          el('h1', { class: 'page-title', text: t('records.title') })
        ),
        list,
        el(
          'div',
          { class: 'records-foot' },
          el('p', { text: t('records.saved') }),
          button({
            label: t('records.reset'),
            cls: 'btn-ghost btn-small',
            onClick: async () => {
              const ok = await KK.ui.confirm({ title: t('records.resetTitle'), text: t('records.resetConfirm'), yes: t('records.resetYes'), no: t('records.cancel') });
              if (ok) {
                KK.save.reset();
                KK.router.refresh();
              }
            },
          })
        )
      )
    );
  };
})(window.KK);
