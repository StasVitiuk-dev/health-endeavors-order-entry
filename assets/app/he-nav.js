// assets/app/he-nav.js — navigation state: page ids, deep links, last page, sidebar groups open and pinned, back/forward stacks, unsaved-typing guard
// EXT15: moved unchanged out of assets/owner-login-app.js (initApp). Its inputs
// arrive explicitly in ctx; it returns only what other code still uses. Map:
// docs/ops/APPLICATION_MODULE_MAP_EXT15.md. Created once, by the app, in order.
window.HE.modules.define('he-nav', { api: 1, needs: ['SIDEBAR_GROUPS'] }, function (ctx) {
    const { SIDEBAR_GROUPS } = ctx;
    // ---------- forgot password ----------
    // Sends a normal Supabase password-reset email. The link in that email
    // brings the person back to change-password.html already signed in for
    // recovery, where they pick a new password — no admin/owner involvement.
    const CHANGE_PASSWORD_URL = 'https://stasvitiuk-dev.github.io/health-endeavors-order-entry/change-password.html';
    // EXT6: leaving the dashboard reloads the page instead of only hiding it,
    // so no customer name, inquiry, figure, search entry or export from this
    // session stays in the page or in memory for the next person on a shared
    // computer. The reason note survives the reload (this tab only).
    const SIGNED_OUT_NOTE = 'he.signedOutNote';
    // EXT7: unsaved typing. A form counts as unsaved when the person typed
    // in it (page-made changes don't count) and a text box in it still holds
    // text. Pressing its Save button clears that (the form's own error shows
    // if the save fails). Closing or reloading the tab then asks first, and
    // so does Sign out. A forced sign-out (other tab, expired sign-in) never
    // waits: wiping the page matters more there.
    const typedForms = new Set();
    const NOT_GUARDED_FORMS = new Set(['loginForm', 'forgotForm']);
    function hasUnsavedTyping(){
      for (const f of typedForms) {
        if (!f.isConnected) { typedForms.delete(f); continue; }
        const boxes = f.querySelectorAll('textarea, input[type="text"], input:not([type])');
        if ([...boxes].some(el => el.value.trim() !== '')) return true;
      }
      return false;
    }

    const PAGE_LABEL_BY_ID = {};

    // Pinned favorites: your own shortlist of pages, saved in this browser
    // (like "remember last page") and pinned to the very top of the sidebar
    // so your most-used pages are always one click away.
    // Which foldable sidebar sections you've opened. Remembered in this browser
    // only; starts folded.
    function openGroups(){
      try { return JSON.parse(localStorage.getItem('he_open_groups') || '[]'); }
      catch (e) { return []; }
    }
    function isGroupOpen(label){ return openGroups().includes(label); }
    function setGroupOpen(label, open){
      const set = new Set(openGroups());
      if (open) set.add(label); else set.delete(label);
      try { localStorage.setItem('he_open_groups', JSON.stringify([...set])); } catch (e) { /* not critical */ }
    }

    function getPinnedPages(){
      try {
        const raw = localStorage.getItem('he_pinned_pages');
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr.filter(id => allPageIds().includes(id)) : [];
      } catch (e) { return []; }
    }
    function setPinnedPages(arr){
      try { localStorage.setItem('he_pinned_pages', JSON.stringify(arr)); } catch (e) { /* not critical */ }
    }

    // All known page ids, used to make sure a remembered page still actually
    // exists before we try to jump to it (e.g. if a page were ever renamed).
    function allPageIds(){
      const ids = [];
      SIDEBAR_GROUPS.forEach(g => g.pages.forEach(p => ids.push(p.id)));
      return ids;
    }

    // Remembers which page you were on so refreshing (or closing and
    // reopening the dashboard) brings you back to it instead of always
    // starting over at "Needs Your Attention". Stored only in this browser,
    // on this device — never sent anywhere, never stored in the database.
    function getLastPage(){
      // EXT8: a link to a page (#page=<id>) wins; only page names are ever
      // put in the address bar, never record data.
      const linked = pageFromHash();
      if (linked) return linked;
      try {
        const saved = localStorage.getItem('he_last_page');
        if (saved && allPageIds().includes(saved)) return saved;
      } catch (e) { /* private browsing or blocked storage — fine, just default */ }
      return 'attentionPanel';
    }
    function pageFromHash(){
      const m = /^#page=([A-Za-z]+)$/.exec(location.hash || '');
      return m && allPageIds().includes(m[1]) ? m[1] : null;
    }
    function saveLastPage(pageId){
      try { localStorage.setItem('he_last_page', pageId); } catch (e) { /* not critical */ }
    }

    // X8-19 (EXT9): one shared banner. A page's own warning (e.g. orders in
    // several currencies) is kept per page and shown while that page is open
    // or when it is opened, never on another page by a background load.
    const PAGE_WARNINGS = {};


    // ================= Faster to drive =================

    // ---- Where you've been: ⌘[ and ⌘] ----
    const NAV_BACK = [], NAV_FWD = [];
    function rowsOnPage(){
      const panel = document.querySelector('main.contentArea > section.panel.activePage');
      if (!panel) return [];
      return Array.from(panel.querySelectorAll('.actItem, tr[data-id], [data-product-id], [data-return-id], .approvalRow[data-id], .flagRow[data-id], .calEvent'));
    }

  return { isGroupOpen, setGroupOpen, getPinnedPages, setPinnedPages, allPageIds, getLastPage, pageFromHash, saveLastPage, PAGE_WARNINGS, PAGE_LABEL_BY_ID, NAV_BACK, NAV_FWD, rowsOnPage, typedForms, NOT_GUARDED_FORMS, hasUnsavedTyping, CHANGE_PASSWORD_URL, SIGNED_OUT_NOTE };
});
