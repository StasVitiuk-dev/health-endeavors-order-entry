// The look (owner decision, Nov 23: Aurora for everyone): applied before the page
// is drawn, so the old look never flashes first. Aurora unless this browser chose
// another direction on Feature Flags (he_look, one of a fixed list; anything else
// is ignored) or the previous look ('classic': no look applied).
(function () {
  'use strict';
  var LOOKS = ['aurora', 'graphite', 'original-plus'];
  var look = 'aurora';
  try {
    var chosen = localStorage.getItem('he_look');
    if (chosen === 'classic') return;
    if (LOOKS.indexOf(chosen) >= 0) look = chosen;
  } catch (e) { /* storage blocked: Aurora */ }
  document.documentElement.setAttribute('data-look', look);
}());
