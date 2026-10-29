/* 메인 메뉴: 로고, 진행도, 4개 게임 카드, 언어/소리/기록 버튼 */
(function (KK) {
  'use strict';
  KK.screens = KK.screens || {};

  KK.screens.menu = function (root) {
    const { el, button, formatNum } = KK.ui;
    const t = KK.i18n.t;

    const soundBtn = button({
      icon: KK.audio.enabled ? 'soundOn' : 'soundOff',
      label: `${t('menu.sound')}: ${KK.audio.enabled ? t('menu.on') : t('menu.off')}`,
      cls: 'btn-chip',
      onClick: () => {
        const on = !KK.audio.enabled;
        KK.audio.setEnabled(on);
        KK.save.setSound(on);
        KK.router.refresh();
        if (on) KK.audio.play('click');
      },
    });
    soundBtn.setAttribute('aria-pressed', String(KK.audio.enabled));

    const topbar = el(
      'nav',
      { class: 'topbar' },
      button({
        icon: 'globe',
        label: t('menu.langSwitch'),
        cls: 'btn-chip',
        aria: t('menu.langAria'),
        onClick: () => {
          const next = KK.i18n.lang === 'en' ? 'ko' : 'en';
          KK.save.setLang(next);
          KK.i18n.setLang(next);
        },
      }),
      soundBtn,
      button({ icon: 'trophy', label: t('menu.records'), cls: 'btn-chip', onClick: () => KK.router.go('records') })
    );

    const cat = KK.games.catalog;
    const done = cat.filter((g) => KK.save.gameStats(g.id).completions > 0).length;
    const badges = KK.games.allBadges();
    const got = badges.filter((b) => KK.save.hasBadge(b.id)).length;
    const pct = Math.round((done / cat.length) * 100);

    const hero = el(
      'header',
      { class: 'hero' },
      el(
        'div',
        { class: 'logo' },
        el('div', { class: 'logo-mascot kiwi', html: KK.art.kiwiBird }),
        el(
          'h1',
          { class: 'logo-text' },
          el('span', { class: 'lt-kiwi', text: 'Kiwi' }),
          el('span', { class: 'lt-amp', text: '&' }),
          el('span', { class: 'lt-kimchi', text: 'Kimchi' }),
          el('span', { class: 'lt-party', text: 'PARTY' })
        ),
        el('div', { class: 'logo-mascot jar', html: KK.art.kimchiJar })
      ),
      el('p', { class: 'tagline', text: t('app.tagline') }),
      el(
        'div',
        { class: 'progress-card' },
        el('div', { class: 'progress-head' }, el('b', { text: t('menu.progress') }), el('span', { text: `${pct}%` })),
        el('div', { class: 'progress-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct) }, el('i', { style: `width:${pct}%` })),
        el(
          'div',
          { class: 'progress-meta' },
          el('span', { text: t('menu.gamesDone', { n: done, total: cat.length }) }),
          el('span', { text: t('menu.badgesDone', { n: got, total: badges.length }) })
        )
      )
    );

    const grid = el('div', { class: 'card-grid' });
    cat.forEach((g) => {
      const playable = !!KK.games.get(g.id);
      const st = KK.save.gameStats(g.id);
      const play = () => KK.router.go('play/' + g.id);
      const card = el(
        'article',
        { class: 'game-card' + (playable ? '' : ' soon'), style: `--accent:${g.color}`, 'data-game': g.id },
        el(
          'div',
          { class: 'card-art', html: KK.art.cards[g.id] },
          el('span', { class: 'card-tag ' + g.country, text: t('tag.' + g.country) }),
          el('span', { class: 'card-num', text: g.num })
        ),
        el(
          'div',
          { class: 'card-body' },
          el('h3', { text: t(`game.${g.id}.name`) }),
          el('p', { text: t(`game.${g.id}.desc`) }),
          el(
            'div',
            { class: 'card-foot' },
            el('span', { class: 'card-best', text: playable ? (st.plays ? t('menu.best', { score: formatNum(st.best) }) : t('menu.noRecord')) : '' }),
            playable
              ? button({ label: t('menu.play'), icon: 'play', cls: 'btn-primary btn-play', onClick: play })
              : el('span', { class: 'soon-pill', text: t('menu.soon') })
          )
        )
      );
      if (playable) {
        const art = card.querySelector('.card-art');
        art.addEventListener('click', play);
        art.classList.add('clickable');
      }
      grid.append(card);
    });

    root.append(
      el(
        'div',
        { class: 'menu-screen' },
        topbar,
        hero,
        el('h2', { class: 'section-title', text: t('menu.chooseGame') }),
        grid,
        el('footer', { class: 'menu-footer', text: t('menu.footer') })
      )
    );
  };
})(window.KK);
