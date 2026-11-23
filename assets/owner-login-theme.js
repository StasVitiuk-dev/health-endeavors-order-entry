// Applied before anything renders (no flash of the wrong theme). EXT14: moved out of
// owner-login.html for the strict script policy; loaded synchronously in <head>.
// Applied before anything renders so there's no flash of the wrong theme.
(function(){
  try {
    var t = localStorage.getItem('he_theme');
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  } catch (e) { /* private browsing — just follow the system setting */ }
})();
