/* 시작점: 저장된 설정을 불러오고 첫 화면을 띄운다. */
(function (KK) {
  'use strict';

  KK.save.load();
  KK.i18n.setLang(KK.save.lang);
  document.documentElement.lang = KK.save.lang;
  KK.audio.setEnabled(KK.save.sound);

  // 브라우저 정책상 소리는 사용자가 처음 화면을 누른 뒤에만 켤 수 있다
  const unlock = () => {
    KK.audio.unlock();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  KK.router.start(document.getElementById('app'));
})(window.KK);
