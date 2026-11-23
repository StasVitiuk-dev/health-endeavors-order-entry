// New look (preview, Nov 22): applies the chosen direction before the page is
// drawn, so it never flashes the old look first. Runs only when the "New look"
// preview switch is on (localStorage he_new_look = 'on'); the direction is one
// of a fixed list (he_look), anything else is ignored. Stored in this browser only.
(function () {
  'use strict';
  var LOOKS = ['aurora', 'graphite', 'original-plus'];
  try {
    if (localStorage.getItem('he_new_look') !== 'on') return;
    var look = localStorage.getItem('he_look');
    if (LOOKS.indexOf(look) < 0) look = 'aurora';
    document.documentElement.setAttribute('data-look', look);
  } catch (e) { /* storage blocked: today's look */ }
}());
