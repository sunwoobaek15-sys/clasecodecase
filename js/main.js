/* SAVE CITY — 시작 */
(function (root) {
  'use strict';
  const start = (data) => root.SC.app.start(data || {});
  const hot = root.claude && root.claude.hot;
  if (hot && typeof hot.ready === 'function') hot.ready(start);
  else start((hot && hot.data) || {});
})(window);
