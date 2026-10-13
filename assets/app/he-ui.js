// assets/app/he-ui.js — shared screen helpers: toasts, loading skeletons, number animation, focus return, overlays (help, palette, shortcuts, quick add), theme, empty states, icons
// EXT15: moved unchanged out of assets/owner-login-app.js (initApp). Its inputs
// arrive explicitly in ctx; it returns only what other code still uses. Map:
// docs/ops/APPLICATION_MODULE_MAP_EXT15.md. Created once, by the app, in order.
window.HE.modules.define('he-ui', { api: 1, needs: ['EMPTY_ICONS','HELP','ICON_PATHS','THEME_FACE','THEME_NAME','THEME_ORDER'] }, function (ctx) {
    const { EMPTY_ICONS, HELP, ICON_PATHS, THEME_FACE, THEME_NAME, THEME_ORDER } = ctx;
    // True for a saved link that is safe to show as a clickable link. Blocks
    // only the kinds that run code or smuggle content when clicked
    // (javascript:, data:, vbscript:); web, email, Apple Mail/Photos and
    // other normal links still work. Control characters and spaces are
    // ignored when checking, because browsers ignore them too.
    function isSafeLink(url){
      const u = String(url || '').replace(/[\u0000-\u0020\u007f]/g, '').toLowerCase();
      return !!u && !/^(javascript|data|vbscript):/.test(u);
    }
    function fmtDate(iso){
      if (!iso) return '—';
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' }) +
             ' ' + d.toLocaleTimeString(undefined, { hour:'numeric', minute:'2-digit' });
    }
    function getTheme(){
      try { const t = localStorage.getItem('he_theme'); return THEME_ORDER.includes(t) ? t : 'auto'; }
      catch (e) { return 'auto'; }
    }
    function applyTheme(t){
      if (t === 'auto') document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', t);
      const btn = document.getElementById('themeBtn');
      if (btn) {
        btn.textContent = THEME_FACE[t];
        btn.title = 'Theme: ' + THEME_NAME[t] + ' — click to change';
      }
    }
    function decorateEmptyStates(){
      document.querySelectorAll('main.contentArea .empty').forEach(el => {
        if (el.querySelector('.emptyIcon')) return;
        const text = (el.textContent || '').trim();
        if (!text || /^loading/i.test(text)) return;
        let icon = '🌿';
        for (const [re, ic] of EMPTY_ICONS) { if (re.test(text)) { icon = ic; break; } }
        const span = document.createElement('span');
        span.className = 'emptyIcon';
        span.textContent = icon;
        el.insertBefore(span, el.firstChild);
      });
    }

    // Keyboard focus goes back to whatever opened a dialog when it closes
    // (WCAG 2.4.3), so keyboard and screen-reader users keep their place
    // instead of starting again from the top of the page (EXT3).
    const focusReturn = new Map();
    function rememberFocus(key){
      const el = document.activeElement;
      if (el && el !== document.body && !focusReturn.has(key)) focusReturn.set(key, el);
    }
    function restoreFocus(key){
      const el = focusReturn.get(key);
      focusReturn.delete(key);
      if (el && document.contains(el) && el.offsetParent !== null && typeof el.focus === 'function') {
        try { el.focus({ preventScroll: true }); } catch (e) { /* element can't take focus any more */ }
      }
    }
    // Line icons, drawn rather than typed — one consistent 16px grid, 1.4px
    // stroke, no fill, inheriting the text colour so they invert correctly on a
    // selected row and in dark mode.
    const ICON_OPEN = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">';
    const FALLBACK_ICON = '<circle cx="8" cy="8" r="2.4"/>';
    function pageIconSvg(pageId){
      return ICON_OPEN + (ICON_PATHS[pageId] || FALLBACK_ICON) + '</svg>';
    }

    // EXT19: safe element builder (the first step towards Trusted Types).
    // h('a', { class: 'x', 'data-page': id }, 'text', childNode, …) creates the
    // element with createElement, sets attributes with setAttribute and adds
    // strings as TEXT, so data can never become markup. Event-handler
    // attributes (on…) and srcdoc are refused; listeners are added in code.
    // false / null / undefined attributes and children are skipped.
    function h(tag, attrs, ...children){
      const el = document.createElement(tag);
      for (const [k, v] of Object.entries(attrs || {})) {
        if (v === false || v === null || v === undefined) continue;
        if (/^on/i.test(k) || /^srcdoc$/i.test(k)) throw new Error('h(): refused attribute ' + k);
        el.setAttribute(k, v === true ? '' : String(v));
      }
      for (const c of children.flat()) {
        if (c === false || c === null || c === undefined) continue;
        el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
      }
      return el;
    }
    // The page icon as SVG nodes, built from the fixed icon table without any
    // HTML parsing. Only <path>, <circle> and <rect> with geometry attributes
    // are accepted; anything else in the table is ignored.
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const ICON_TAGS = /^(path|circle|rect)$/, ICON_ATTRS = /^(d|cx|cy|r|x|y|width|height|rx|ry)$/;
    function pageIconNode(pageId){
      const svg = document.createElementNS(SVG_NS, 'svg');
      for (const [k, v] of [['viewBox', '0 0 16 16'], ['fill', 'none'], ['stroke', 'currentColor'], ['stroke-width', '1.4'], ['stroke-linecap', 'round'], ['stroke-linejoin', 'round']]) svg.setAttribute(k, v);
      // (the table entries are a few hundred characters; the cap keeps every pattern fast whatever is in it)
      const src = String(ICON_PATHS[pageId] || FALLBACK_ICON).slice(0, 4000);
      for (const m of src.matchAll(/<([a-z]+)([^<>]*?)\/>/g)) {
        if (!ICON_TAGS.test(m[1])) continue;
        const shape = document.createElementNS(SVG_NS, m[1]);
        for (const a of m[2].matchAll(/([a-z-]+)="([^"<>]*)"/g)) if (ICON_ATTRS.test(a[1])) shape.setAttribute(a[1], a[2]);
        svg.appendChild(shape);
      }
      return svg;
    }

    function closeMobileSidebar(){
      document.getElementById('sidebarNav').classList.remove('mobileOpen');
      document.getElementById('sidebarOverlay').classList.remove('visible');
    }


    // ================= Feedback, speed and keyboard =================

    // ---- Toasts ----
    const toastHost = document.createElement('div');
    function toast(message, kind){
      const el = document.createElement('div');
      el.className = 'toast' + (kind ? ' ' + kind : '');
      if (kind === 'err') el.setAttribute('aria-hidden', 'true');
      el.innerHTML = '<span class="dot"></span><span></span>';
      el.lastChild.textContent = message;
      toastHost.appendChild(el);
      const life = kind === 'err' ? 6500 : 3200;
      setTimeout(() => {
        el.classList.add('leaving');
        setTimeout(() => el.remove(), 220);
      }, life);
    }

    // ---- Skeletons ----
    // Shows the shape of the content while it loads, instead of the word
    // "Loading". Loaders overwrite these as soon as their data lands.
    function skeletonNodes(n){
      const widths = ['w80', 'w60', 'w40', 'w80', 'w60'];
      return Array.from({ length: n }, (_, i) => h('span', { class: 'skel skelRow ' + widths[i % widths.length] }));
    }
    function paintSkeletons(){
      document.querySelectorAll('main.contentArea div[id$="Wrap"]').forEach(el => {
        if (/^\s*loading/i.test(el.textContent || '')) el.replaceChildren(...skeletonNodes(4)); // EXT19: no HTML parsing
      });
    }

    // ---- Numbers settle instead of snapping ----
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    // EXT7: figures appear with a short fade (CSS class numIn) and their text
    // is never changed. The old count-up rewrote the number frame by frame;
    // when frames and timers stopped (heavy load, background tab) a money
    // figure stayed part-way, e.g. $99,745.45 instead of $100,000.00, even
    // with a timer fallback. A fade that stops part-way still shows the exact
    // amount.
    // The old count-up also wrote every figure in US format with thousands
    // commas ("1000" -> "1,000"). That is kept as a one-time step that never
    // changes the value, and now also applies with Reduce Motion on (which
    // used to show "1000").
    function formatFigure(el){
      const raw = (el.textContent || '').trim();
      const m = raw.match(/^([^0-9-]*)(-?\d[\d,]*(?:\.\d+)?)(.*)$/);
      if (!m || !/\d{4}/.test(m[2].split('.')[0].replace(/,/g, '')) || /,/.test(m[2])) return;
      if (/^[-/:]\d/.test(m[3])) return; // a date or time, not an amount
      const n = Number(m[2]);
      if (!isFinite(n)) return;
      const decimals = (m[2].split('.')[1] || '').length;
      el.textContent = m[1] + n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + m[3];
    }
    function animateNumber(el){
      formatFigure(el);
      if (reduceMotion.matches) return;
      el.classList.remove('numIn');
      void el.offsetWidth; // restart the fade when a figure is redrawn
      el.classList.add('numIn');
    }

    // EXT10 (U38): on a phone, wide tables marked "phoneCards" become one card
    // per row (CSS below 600 px). Each cell gets its column name as a label,
    // and explicit table roles keep screen readers reading it as a table even
    // though the layout changes. Desktop is unaffected.
    function labelPhoneCards(root){
      const tables = root.matches && root.matches('table.phoneCards') ? [root] : (root.querySelectorAll ? root.querySelectorAll('table.phoneCards') : []);
      tables.forEach(t => {
        const heads = [...t.querySelectorAll('thead th')].map(th => th.textContent.trim());
        t.setAttribute('role', 'table');
        t.querySelectorAll('thead, tbody').forEach(g => g.setAttribute('role', 'rowgroup'));
        t.querySelectorAll('tr').forEach(tr => {
          tr.setAttribute('role', 'row');
          [...tr.children].forEach((c, i) => {
            if (c.tagName === 'TH') { c.setAttribute('role', 'columnheader'); return; }
            c.setAttribute('role', 'cell');
            if (heads[i]) c.setAttribute('data-label', heads[i]); else c.classList.add('cardActions');
          });
        });
      });
    }
    function safeRun(fn){
      try { return Promise.resolve(fn()).catch(() => {}); }
      catch (e) { return Promise.resolve(); }
    }

    // One matcher, used by both the command palette and the sidebar search.
    function helpMatches(query){
      const stop = ['how','the','and','for','you','can','what','where','does','with','use','about','when','why'];
      const words = query.split(/[^a-z0-9]+/).filter(w => w.length > 2 && !stop.includes(w));
      const scored = [];
      HELP.forEach(e => {
        const hay = (e.title + ' ' + e.keys + ' ' + e.body).toLowerCase();
        let score = 0;
        if (e.title.toLowerCase().includes(query)) score += 6;
        words.forEach(w => {
          const stem = w.endsWith('s') ? w.slice(0, -1) : w;
          if (e.title.toLowerCase().includes(stem)) score += 3;
          else if (e.keys.includes(stem)) score += 2;
          else if (hay.includes(stem)) score += 1;
        });
        if (!words.length && hay.includes(query)) score += 1;
        if (score > 0) scored.push({ score: score, e: e });
      });
      return scored.sort((a, b) => b.score - a.score).slice(0, 5).map(s => s.e);
    }

    const helpOverlay = document.createElement('div');
    function closeHelp(){ helpOverlay.classList.remove('open'); restoreFocus('help'); }

    // ---- Command palette ----
    const paletteOverlay = document.createElement('div');
    // restore=false when a result was chosen: the page changes, so focus
    // should not jump back to where the palette was opened from.
    function closePalette(restore = true){ paletteOverlay.classList.remove('open'); if (restore) restoreFocus('palette'); else focusReturn.delete('palette'); }

    // ---- Shortcut sheet ----
    const shortcutOverlay = document.createElement('div');
    function openShortcuts(){ rememberFocus('shortcuts'); shortcutOverlay.classList.add('open'); }
    function closeShortcuts(){ shortcutOverlay.classList.remove('open'); restoreFocus('shortcuts'); }
    function typingInField(e){
      const t = e.target;
      if (!t || !t.tagName) return false;
      const tag = t.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable;
    }
    function anyOverlayOpen(){
      return paletteOverlay.classList.contains('open')
        || shortcutOverlay.classList.contains('open')
        || document.getElementById('inspectorOverlay').classList.contains('open')
        || document.getElementById('reauthOverlay').style.display === 'flex';
    }

    // ---- ⌘N: jot a reminder from anywhere ----
    const quickAdd = document.createElement('div');
    function openQuickAdd(){
      rememberFocus('quickadd');
      quickAdd.classList.add('open');
      const i = document.getElementById('quickAddInput');
      i.value = '';
      setTimeout(() => i.focus(), 10);
    }
    function closeQuickAdd(){ quickAdd.classList.remove('open'); restoreFocus('quickadd'); }

    // ---- Connection banner ----
    const offlineBar = document.createElement('div');

    // ---- iPhone: pull down to refresh, swipe to change page ----
    const ptr = document.createElement('div');

  return { toastHost, toast, paintSkeletons, reduceMotion, animateNumber, labelPhoneCards, safeRun, rememberFocus, restoreFocus, decorateEmptyStates, getTheme, applyTheme, isSafeLink, fmtDate, helpMatches, helpOverlay, closeHelp, paletteOverlay, closePalette, shortcutOverlay, openShortcuts, closeShortcuts, typingInField, anyOverlayOpen, quickAdd, openQuickAdd, closeQuickAdd, offlineBar, ptr, closeMobileSidebar, pageIconSvg, h, pageIconNode };
});
