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
// The shape of buttons, fields and windows, and the typeface (owner request, Nov 24):
// one of three styles when this browser chose one on Feature Flags (he_shape); with no
// choice, or anything else stored, nothing is applied and the dashboard is as it was.
// On its own, so it also applies with the previous look.
(function () {
  'use strict';
  var SHAPES = ['soft', 'crisp', 'elegant'];
  try {
    var chosen = localStorage.getItem('he_shape');
    if (SHAPES.indexOf(chosen) >= 0) document.documentElement.setAttribute('data-shape', chosen);
  } catch (e) { /* storage blocked: as it was */ }
}());
