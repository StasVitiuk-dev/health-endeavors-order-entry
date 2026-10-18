// Health Endeavors owner dashboard: the page script (EXT14, M5d).
// Moved unchanged out of owner-login.html so the page can run under a strict
// Content-Security-Policy (no inline scripts). Loaded at the end of <body>,
// after assets/owner-login-helpers.js, exactly where the inline block was.
(function(){ var n = document.getElementById('appNotLoaded'); if (n) n.parentNode.removeChild(n); })();
  const SUPABASE_URL = "https://uizrazyehilyzmwttsrn.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_n0sEzZK0JMtwgk280a3YXA_zxtnheqj";

  // EXT15: the modules this program creates (assets/app/<name>.js) and the
  // compatibility number each must have; kept up to date by tests/tools/extract-module.js.
  const APP_MODULES = { 'he-config': 1, 'he-ui': 1, 'he-data': 1, 'he-audit': 1, 'he-status': 1, 'he-time': 1, 'he-format': 1, 'he-nav': 1, 'he-tasks': 1, 'he-approvals': 1, 'he-incidents': 1, 'he-expenses': 1, 'he-suppliers': 1, 'he-reports': 1, 'he-inquiries': 1, 'he-agents': 1, 'he-ops': 1, 'he-admin': 1, 'he-compliance': 1 };
  const scriptErrorEl = document.getElementById('scriptError');
  function showBanner(text){
    if (!scriptErrorEl) return;
    scriptErrorEl.textContent = text;
    scriptErrorEl.style.display = 'block';
  }
  window.addEventListener('error', function(e){
    showBanner('Something went wrong loading this page: ' + e.message);
  });
  window.addEventListener('unhandledrejection', function(e){
    var m = (e.reason && e.reason.message) ? e.reason.message : e.reason;
    showBanner('Something went wrong: ' + m);
  });

  if (window.__sbLoadFailed || typeof window.supabase === 'undefined') {
    showBanner('The sign-in helper library did not load from the internet, so this page cannot work yet. Check that your Mac is online, then fully reload this page (press Cmd+R). If this keeps happening, a content blocker or ad blocker extension in Safari may be blocking cdn.jsdelivr.net — try turning it off for this page and reloading.');
  } else if (window.__heHelpersLoadFailed || !window.HE || !window.HE.helpers) {
    showBanner('Part of this page (assets/owner-login-helpers.js) did not load, so it cannot start. Check that you are online, then fully reload this page (press Cmd+R).');
  } else if (window.HE.helpers.API !== 9) {
    showBanner('The dashboard was just updated and this page loaded a mix of old and new files. Fully reload this page (press Cmd+R) — nothing was changed.');
  } else if (!window.HE.modules || window.HE.modules.REGISTRY_API !== 1) {
    showBanner('Part of this page (assets/owner-login-modules.js) did not load, so it cannot start. Check that you are online, then fully reload this page (press Cmd+R). Nothing was changed.');
  } else if (window.HE.modules.missing(APP_MODULES).length) {
    showBanner('Part of this page (' + window.HE.modules.missing(APP_MODULES).map(function (n) { return 'assets/app/' + n + '.js'; }).join(', ') + ') did not load, so it cannot start. Check that you are online, then fully reload this page (press Cmd+R). Nothing was changed.');
  } else if (window.HE.modules.mismatched(APP_MODULES).length) {
    showBanner('The dashboard was just updated and this page loaded a mix of old and new files (' + window.HE.modules.mismatched(APP_MODULES).join(', ') + '). Fully reload this page (press Cmd+R) — nothing was changed.');
  } else {
    initApp();
  }

  function initApp(){
    // Pure helpers live in assets/owner-login-helpers.js (see the start-up check).
    const {
      esc,
      csvCell,
      fmtMoney,
      fmtDateOnly,
      CLOSED_WORDS,
      isClosedStatus,
      isOverdue,
      classifyOrderStatus,
      refundsToSubtract,
      poLinesTotal,
      poGrandTotal,
      likeLiteral,
      returnLineValue,
      fmtAccountNumber,
      deviceLabel,
      timeAgo,
      startOfWeekMonday,
      rollupReports,
      businessRuleValueError,
      TAX_CATEGORY_MAP,
      isNetworkError,
      boolGuard,
      noRowsChanged,
      staleMessage,
      explainDbError,
      uploadProblem,
      confirmSecondPress,
      uploadStamp,
      safeStorageName,
      numberInputError,
      localDateString,
      acctRangeStart,
      taxRangeStart,
      maskSensitive,
      taxStateKey,
      attentionFindings,
      newRequestKey,
      fixedRequestKey,
      keyFingerprint,
      nightlyCheckLevel,
      nightlyOverall,
    } = window.HE.helpers;
    // @@ EXT15 modules: created in dependency order (assets/app/*.js; see docs/ops/APPLICATION_MODULE_MAP_EXT15.md)
    const { RET_ORDER_CAP, ROW_CAP, STOCK_FN_FLAGS, FLAG_DEPENDS, THEME_ORDER, THEME_FACE, THEME_NAME, EMPTY_ICONS, SIDEBAR_GROUPS, ICON_PATHS, SEARCH_INDEX, BUSINESS_RULE_CONFIG_KEY, BUSINESS_RULE_UNIT_LABELS, INVENTORY_BUCKET_LABELS, RETURN_STATUS_LABELS, RETURN_REASON_LABELS, RETURN_CONDITION_LABELS, RETURN_DISPOSITION_LABELS, EXPENSE_CATEGORY_LABELS, HELP, GO_TO, ACTIVITY_PAGE_SIZE, RECORD_TITLE_KEYS, ROLE_LABELS, ACTIVITY_AREA_LABELS, PANEL_RECORD_TABLE, RECORD_ID_ATTRS, ITEM_TYPE_LABELS, NIGHTLY_PAGES, DB_STEPS, APPLE_CAL_HINT, CAL_COLORS, SUPPLIER_TYPE_LABELS, PO_STATUS_LABELS, PAYMENT_LABELS, PO_ALLOWED_FROM, PO_EDITABLE, QC_TYPE_LABELS, QC_RESULT_LABELS, QC_SEVERITY_LABELS, RECALL_STATUS_LABELS, TASK_STATUS_LABELS, TASK_NEXT_ACTIONS, TASK_ALLOWED_FROM, AGENT_REGISTRY, AGENT_STALE_AFTER_HOURS, INQ_STATUS_LABELS, INQ_ANSWERED_CAP, LAUNCH_BLOCKED_FLAGS, SYSTEM_MODE_LABELS, FR_STATUS_LABELS, FR_NEXT_STATUS, FR_NEXT_LABEL, DOCUMENT_LINK_TYPES, DOCUMENT_CATEGORY_LABELS } = HE.modules.create('he-config', {  });
    const { toastHost, toast, paintSkeletons, reduceMotion, animateNumber, labelPhoneCards, safeRun, rememberFocus, restoreFocus, decorateEmptyStates, getTheme, applyTheme, isSafeLink, fmtDate, helpMatches, helpOverlay, closeHelp, paletteOverlay, closePalette, shortcutOverlay, openShortcuts, closeShortcuts, typingInField, anyOverlayOpen, quickAdd, openQuickAdd, closeQuickAdd, offlineBar, ptr, closeMobileSidebar, pageIconSvg, h, pageIconNode } = HE.modules.create('he-ui', { EMPTY_ICONS, HELP, ICON_PATHS, THEME_FACE, THEME_NAME, THEME_ORDER });
    const { writesInFlight, newLoadToken, LIST_LIMITS, listLimit, appendMore, supabase, verifyOnly, updateIfUnchanged, claimOutcomeAfterDrop, changeStock, stockFunctionOn, callStockFunction, STOCK_FN_PROBES, stockFunctionInstalled, requestKeysOn, formRequestKey, clearRequestKey, insertOnce, withRequestKey, isRequestKeyRepeat, REPEAT_NOTE, stockFunctionError, fetchAllRows, fetchAllRowsIn, uploadThenSave, currentUserId, logCustomerAccess, poStatusNow, ACCOUNTING_REFUND_POLICY, returnRefundsIn, manualOrdersWithoutItems, errorKind } = HE.modules.create('he-data', { INVENTORY_BUCKET_LABELS, ROW_CAP, STOCK_FN_FLAGS, SUPABASE_ANON_KEY, SUPABASE_URL, classifyOrderStatus, explainDbError, isNetworkError, keyFingerprint, newRequestKey, toast });
    const { recordTitle, describeChange, hlValue, codeDiff, plainChange, resolveInspectTarget, activityFromDate, fetchAllActivity, loadActivityAreas, loadActivityDigest } = HE.modules.create('he-audit', { ACTIVITY_AREA_LABELS, PANEL_RECORD_TABLE, RECORD_ID_ATTRS, RECORD_TITLE_KEYS, esc, h, supabase });
    const { environmentLabel, assetVersions, isMissingRelation, dbStepsStatus, NIGHTLY_STALE_MS, ATTN_STALE_MS, attnSeenGet, attnSeenSet, attnSignature } = HE.modules.create('he-status', { DB_STEPS, STOCK_FN_PROBES, SUPABASE_URL, stockFunctionInstalled, supabase });
    const { getTodayRange, getYesterdayRange, dateKey, eventDateKey, fmtTimeShort, personalEventEditorHtml, personalTimesFromInputs, PERSONAL_CAL_HINT, weekGroupLabel, monthGroupLabel } = HE.modules.create('he-time', { CAL_COLORS, esc });
    const { missingToNaN, reportCount, missingTotalCount, missingTotalNote, mixedCurrencyNote, docExpiryBadge, inqStatusBadgeClass, continuityBadgeClass, qcIncidentCategory, numVal, CLOSED_IN } = HE.modules.create('he-format', { CLOSED_WORDS, fmtDateOnly, h });
    const { isGroupOpen, setGroupOpen, getPinnedPages, setPinnedPages, allPageIds, getLastPage, pageFromHash, saveLastPage, PAGE_WARNINGS, PAGE_LABEL_BY_ID, NAV_BACK, NAV_FWD, rowsOnPage, typedForms, NOT_GUARDED_FORMS, hasUnsavedTyping, CHANGE_PASSWORD_URL, SIGNED_OUT_NOTE } = HE.modules.create('he-nav', { SIDEBAR_GROUPS });
    const { loadTasks } = HE.modules.create('he-tasks', { CLOSED_IN, SEARCH_INDEX, TASK_ALLOWED_FROM, TASK_NEXT_ACTIONS, TASK_STATUS_LABELS, explainDbError, fmtDate, h, isClosedStatus, isOverdue, showDashError, supabase });
    const { loadApprovals } = HE.modules.create('he-approvals', { CLOSED_IN, SEARCH_INDEX, fmtDate, h, isClosedStatus, requireReauth, showDashError, staleMessage, supabase, updateIfUnchanged });
    const { escalateToIncidentOnce, loadIncidents } = HE.modules.create('he-incidents', { CLOSED_IN, SEARCH_INDEX, fixedRequestKey, fmtDate, h, isClosedStatus, isOverdue, isRequestKeyRepeat, requestKeysOn, showDashError, staleMessage, supabase, updateIfUnchanged, withRequestKey });
    const { loadExpenses, loadDeletedExpenses } = HE.modules.create('he-expenses', { EXPENSE_CATEGORY_LABELS, LIST_LIMITS, SEARCH_INDEX, appendMore, confirmSecondPress, fetchAllRows, fmtDate, fmtDateOnly, fmtMoney, h, listLimit, noRowsChanged, showDashError, staleMessage, supabase, updateIfUnchanged });
    const { loadSuppliers } = HE.modules.create('he-suppliers', { SEARCH_INDEX, SUPPLIER_TYPE_LABELS, boolGuard, fetchAllRows, h, showDashError, staleMessage, updateIfUnchanged });
    const { setReportHistoryView, renderReportHistoryView, loadReportHistory } = HE.modules.create('he-reports', { fmtDateOnly, fmtMoney, h, localDateString, missingToNaN, monthGroupLabel, reportCount, rollupReports, showDashError, startOfWeekMonday, supabase, weekGroupLabel });
    const { inquiriesList, loadInquiries, renderInquiries } = HE.modules.create('he-inquiries', { INQ_ANSWERED_CAP, INQ_STATUS_LABELS, fetchAllRows, fetchAllRowsIn, fmtDate, h, inqStatusBadgeClass, noRowsChanged, showDashError, staleMessage, supabase, updateIfUnchanged });
    const { agentControls, agentTruth, loadAgentControls } = HE.modules.create('he-agents', { AGENT_REGISTRY, AGENT_STALE_AFTER_HOURS, currentUserId, fmtDate, h, maskSensitive, requireReauth, showDashError, staleMessage, supabase, toast, updateIfUnchanged });
    const { createOpTracker } = HE.modules.create('he-ops', {});
    const { loadSessions, loadSops, loadFeatureRequests, loadDeletedFeatureRequests } = HE.modules.create('he-admin', { FR_NEXT_LABEL, FR_NEXT_STATUS, FR_STATUS_LABELS, SEARCH_INDEX, advanceFeatureRequest, appendMore, boolGuard, deleteFeatureRequest, deviceLabel, fmtDate, h, listLimit, noRowsChanged, requireReauth, showDashError, showPageWarning, staleMessage, supabase, updateIfUnchanged });
    const { loadAdverseEvents, loadLegalHolds, loadReleasedLegalHolds, loadDocuments, loadEvidenceLocker } = HE.modules.create('he-compliance', { CLOSED_IN, DOCUMENT_CATEGORY_LABELS, SEARCH_INDEX, appendMore, confirmSecondPress, docExpiryBadge, fetchAllRows, fetchAllRowsIn, fmtDate, fmtDateOnly, h, isSafeLink, listLimit, newLoadToken, noRowsChanged, requireReauth, showDashError, showPageWarning, staleMessage, supabase, updateIfUnchanged });
    // @@ end modules

    const loginScreen = document.getElementById('loginScreen');
    const dash = document.getElementById('dash');
    const loginForm = document.getElementById('loginForm');
    const loginMsg = document.getElementById('loginMsg');
    const loginBtn = document.getElementById('loginBtn');
    const whoAmI = document.getElementById('whoAmI');
    const dashErrorEl = document.getElementById('dashError');
    let currentUserEmail = null; // set on login, used to re-check your password before sensitive actions
    let currentUserRole = null; // set on login — 'owner' sees the Apple-synced calendar; anyone else gets their own
    let calMode = 'apple'; // 'apple' or 'personal' — which calendar the Calendar page is currently showing

    function showLoginError(text){
      loginMsg.textContent = text;
      loginMsg.className = 'msg error';
    }
    // EXT10b (missions 66-68): the KIND of the last error shown, for the
    // diagnostic summary (never its text, which can name records).
    let LAST_ERROR_KIND = null, LAST_ERROR_AT = null;
    function showDashError(text){
      text = explainDbError(text);
      LAST_ERROR_KIND = errorKind(text); LAST_ERROR_AT = new Date();
      dashErrorEl.textContent = text;
      dashErrorEl.style.display = 'block';
      if (window.toastErr) window.toastErr(text);
    }
    function clearDashError(){
      dashErrorEl.style.display = 'none';
      dashErrorEl.textContent = '';
    }

    // Stock (inventory, adjustments, lots, purchasing, recalls) can only be
    // changed by the Owner or an Administrator — the database's own rules
    // (Query A). The page checks first so it never starts a change it can't finish.
    function canChangeStock(){ return currentUserRole === 'owner' || currentUserRole === 'administrator'; }
    applyTheme(getTheme());
    document.getElementById('themeBtn').addEventListener('click', () => {
      const next = THEME_ORDER[(THEME_ORDER.indexOf(getTheme()) + 1) % THEME_ORDER.length];
      try { localStorage.setItem('he_theme', next); } catch (e) { /* not critical */ }
      applyTheme(next);
    });

    // ---------- login ----------
    let shownUserId = null; // whose data this page is showing (EXT7)
    async function showDashboardFor(user){
      shownUserId = user && user.id;
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, is_active, display_name')
        .eq('id', user.id)
        .single();

      if (error || !profile || !profile.is_active) {
        showLoginError("This login isn't an active account on this system. Contact the owner.");
        await supabase.auth.signOut();
        return;
      }

      currentUserEmail = user.email;
      currentUserRole = profile.role;
      loginScreen.style.display = 'none';
      dash.style.display = 'flex';
      whoAmI.textContent = `${profile.display_name || user.email} — role: ${profile.role}`;
      renderSidebar('');
      showPage(getLastPage());
      loadDashboard();
      const expDateInput = document.getElementById('expDate');
      if (expDateInput && !expDateInput.value) expDateInput.value = localDateString();
    }

    // ---------- re-authentication for sensitive actions ----------
    // Shows the password-confirm popup and resolves to true only once Supabase
    // has actually re-verified that password against your account (the same
    // check the login screen does) — false if you cancel or get it wrong.
    // Nothing is stored; it just asks Supabase "does this password still work
    // for this email" every single time, so a browser left open on your desk
    // can't be used to restore an order, flip a feature switch, or approve/deny
    // a request without you personally typing your password again.
    // If a password prompt is already open when another one needs to show
    // (or when the page navigates away from it), this closes THAT exact one
    // directly — instead of faking a click on the Cancel button, which only
    // works if that button's listener happens to still be attached. Having a
    // real handle like this is what actually guarantees the box goes away.
    let activeReauthClose = null;
    // Keyboard focus stays inside an open dialog: Tab from the last control
    // goes back to the first, Shift+Tab from the first goes to the last, and
    // focus that has escaped is pulled back in (EXT4, WCAG 2.4.3 / 2.1.2).
    document.addEventListener('keydown', e => {
      if (e.key !== 'Tab') return;
      const shown = el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
      const open = Array.from(document.querySelectorAll('[role="dialog"][aria-modal="true"]')).filter(shown);
      const dlg = open[open.length - 1];
      if (!dlg) return;
      const items = Array.from(dlg.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(shown);
      if (!items.length) { e.preventDefault(); return; }
      const first = items[0], last = items[items.length - 1];
      if (!dlg.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    function requireReauth(actionLabel){
      const overlay = document.getElementById('reauthOverlay');
      const label = document.getElementById('reauthActionLabel');
      const input = document.getElementById('reauthPassword');
      const msg = document.getElementById('reauthMsg');
      const confirmBtn = document.getElementById('reauthConfirmBtn');
      const cancelBtn = document.getElementById('reauthCancelBtn');

      // A prompt was already open (e.g. two toggles clicked in quick
      // succession) — cancel that one first so its old listeners can't pile
      // up on top of this new one.
      if (activeReauthClose) activeReauthClose(false);

      return new Promise((resolve) => {
        label.textContent = actionLabel;
        input.value = '';
        msg.textContent = '';
        msg.className = 'msg';
        confirmBtn.disabled = false;
        rememberFocus('reauth');
        overlay.style.display = 'flex';
        input.focus();

        function close(result){
          overlay.style.display = 'none';
          confirmBtn.removeEventListener('click', onConfirm);
          cancelBtn.removeEventListener('click', onCancel);
          input.removeEventListener('keydown', onKeydown);
          if (activeReauthClose === close) activeReauthClose = null;
          restoreFocus('reauth');
          resolve(result);
        }
        activeReauthClose = close;
        async function onConfirm(){
          // Already checking (Enter pressed again, or a second click) — ignore.
          if (confirmBtn.disabled) return;
          const password = input.value;
          if (!password) { msg.textContent = 'Enter your password.'; msg.className = 'msg error'; return; }
          confirmBtn.disabled = true;
          msg.textContent = 'Checking…';
          msg.className = 'msg';
          try {
            // Never let this sit there spinning — if the check can't answer in
            // 8 seconds, say so and give the buttons back.
            const check = verifyOnly.auth.signInWithPassword({ email: currentUserEmail, password });
            const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000));
            const { error } = await Promise.race([check, timeout]);
            confirmBtn.disabled = false;
            if (error) { msg.textContent = "That password didn't work — try again."; msg.className = 'msg error'; return; }
            try { await verifyOnly.auth.signOut({ scope: 'local' }); } catch (e) { /* nothing to clean up */ }
            close(true);
          } catch (err) {
            confirmBtn.disabled = false;
            msg.textContent = (err && err.message === 'timeout')
              ? "That took too long — check your connection and try again."
              : 'Could not check that just now — try again.';
            msg.className = 'msg error';
          }
        }
        function onCancel(){ close(false); }
        function onKeydown(e){
          if (e.key === 'Enter') onConfirm();
          else if (e.key === 'Escape') onCancel();
        }
        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
        input.addEventListener('keydown', onKeydown);
      });
    }

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      loginBtn.disabled = true;
      loginMsg.textContent = '';
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        loginBtn.disabled = false;
        if (error) { showLoginError(error.message); return; }
        await showDashboardFor(data.user);
      } catch (err) {
        loginBtn.disabled = false;
        showBanner('Sign-in failed: ' + (err && err.message ? err.message : err));
      }
    });
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    const forgotPasswordRow = document.getElementById('forgotPasswordRow');
    const backToLoginLink = document.getElementById('backToLoginLink');
    const backToLoginRow = document.getElementById('backToLoginRow');
    const forgotForm = document.getElementById('forgotForm');
    const forgotBtn = document.getElementById('forgotBtn');
    const forgotMsg = document.getElementById('forgotMsg');

    if (forgotPasswordLink) {
      forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.style.display = 'none';
        loginMsg.textContent = '';
        forgotPasswordRow.style.display = 'none';
        document.getElementById('forgotEmail').value = document.getElementById('email').value || '';
        forgotForm.style.display = 'block';
        backToLoginRow.style.display = 'block';
        forgotMsg.textContent = '';
        forgotMsg.className = 'msg';
      });
    }

    if (backToLoginLink) {
      backToLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        forgotForm.style.display = 'none';
        backToLoginRow.style.display = 'none';
        forgotMsg.textContent = '';
        loginForm.style.display = 'block';
        forgotPasswordRow.style.display = 'block';
      });
    }

    if (forgotForm) {
      forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        forgotBtn.disabled = true;
        forgotMsg.textContent = 'Sending…';
        forgotMsg.className = 'msg';
        const email = document.getElementById('forgotEmail').value.trim();
        try {
          await supabase.auth.resetPasswordForEmail(email, { redirectTo: CHANGE_PASSWORD_URL });
        } catch (err) {
          // Fall through to the same generic message either way — never reveal
          // whether an email address has an account on this system.
        }
        forgotBtn.disabled = false;
        forgotMsg.textContent = 'If that email has an account, a reset link has been sent. Check your inbox (and spam folder).';
        forgotMsg.className = 'msg';
      });
    }

    // Signed out somewhere else (another tab, or the sign-in could not be
    // renewed): leave the dashboard at once and say why, instead of staying
    // on a page whose requests now go out without a sign-in. The database
    // answers those with empty lists, which would look like "no data", and
    // with refusals that look like someone else's change (EXT3, W14).
    let signingOutHere = false;
    document.addEventListener('input', e => {
      if (!e.isTrusted) return;
      const f = e.target && e.target.closest ? e.target.closest('form') : null;
      if (f && !NOT_GUARDED_FORMS.has(f.id)) typedForms.add(f);
    }, true);
    document.addEventListener('submit', e => { typedForms.delete(e.target); }, true);
    let leavingOnPurpose = false;
    window.addEventListener('beforeunload', e => {
      if (leavingOnPurpose || !hasUnsavedTyping()) return;
      e.preventDefault();
      e.returnValue = '';
    });

    function wipeAfterSignOut(note){
      leavingOnPurpose = true;
      dash.style.display = 'none';
      loginScreen.style.display = 'flex';
      try { if (note) sessionStorage.setItem(SIGNED_OUT_NOTE, note); } catch (_) { /* private window: no note */ }
      window.location.reload();
    }
    try {
      const note = sessionStorage.getItem(SIGNED_OUT_NOTE);
      if (note) { sessionStorage.removeItem(SIGNED_OUT_NOTE); showLoginError(note); }
    } catch (_) { /* storage blocked */ }
    supabase.auth.onAuthStateChange((event, session) => {
      if (signingOutHere || dash.style.display !== 'flex') return;
      if (event === 'SIGNED_OUT') {
        // EXT18: a change still waiting for its reply was sent, and the old
        // sign-in stays valid on the server until it expires: it may have landed.
        wipeAfterSignOut(writesInFlight() > 0
          ? 'You were signed out (in another tab, or your sign-in expired) while a change was still being saved. That change may or may not have been saved: after you sign in, check it before doing it again. Nothing else unsaved on that page was sent.'
          : 'You were signed out (in another tab, or your sign-in expired). Anything not already saved on that page was not sent. Sign in again to continue.');
        return;
      }
      // EXT7: a different person signed in on this computer (another tab)
      // without a sign-out here. Never keep showing the previous person's
      // data to them: wipe, and the page reloads for whoever is signed in.
      const uid = session && session.user && session.user.id;
      if (uid && shownUserId && uid !== shownUserId) {
        wipeAfterSignOut('A different person signed in on this computer, so this page was cleared. Anything not already saved was not sent.');
      }
    });

    // EXT8: a page brought back by the browser's Back button from its cache
    // may have missed a sign-out (or a different sign-in) meanwhile: check
    // the sign-in again before showing anything.
    window.addEventListener('pageshow', async (e) => {
      if (!e.persisted || dash.style.display !== 'flex') return;
      let session = null;
      try { ({ data: { session } } = await supabase.auth.getSession()); } catch (_) { session = null; }
      const uid = session && session.user && session.user.id;
      if (!uid) wipeAfterSignOut('You were signed out while this page was in the background. Sign in again to continue.');
      else if (shownUserId && uid !== shownUserId) wipeAfterSignOut('A different person signed in on this computer, so this page was cleared. Anything not already saved was not sent.');
    });

    document.getElementById('signout').addEventListener('click', async () => {
      if (hasUnsavedTyping() && !window.confirm('Something you typed is not saved yet. Sign out anyway? It will be lost.')) return;
      signingOutHere = true;
      try { await supabase.auth.signOut(); } finally { wipeAfterSignOut(null); }
    });

    document.getElementById('refreshBtn').addEventListener('click', loadDashboard);

    // ---------- keyboard shortcuts ----------
    // With 17 pages now, per-page number shortcuts stopped making sense —
    // use the sidebar or the search box to jump to a page instead.
    window.addEventListener('keydown', (e) => {
      if (dash.style.display !== 'flex') return;
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        if (e.key === 'Escape' && document.activeElement.id === 'sidebarSearch') {
          document.activeElement.value = '';
          renderSidebar('');
          document.activeElement.blur();
        }
        return;
      }
      if (e.key === 'r') { loadDashboard(); }
      else if (e.key === '/') {
        e.preventDefault();
        document.getElementById('sidebarSearch').focus();
      }
    });
    let currentPageId = null;
    // The most recent set of sidebar search results, kept so a click can carry
    // extra behaviour with it (e.g. a person result also runs that person's
    // account number through the Employee Activity search).
    let LAST_SEARCH_RESULTS = [];

    // Sidebar badge counts: a small number next to a page name showing
    // something's waiting there, computed live from data already loaded —
    // no extra database calls. Add a case here for any page worth flagging.
    function getPageBadgeCount(pageId){
      switch (pageId) {
        case 'attentionPanel': return (SEARCH_INDEX.attention || []).length;
        case 'approvalsPanel': return (SEARCH_INDEX.approvals || []).filter(r => !isClosedStatus(r.status)).length;
        case 'inquiriesPanel': return (inquiriesList() || []).filter(i => i.status === 'needs_review').length;
        case 'tasksPanel': return (SEARCH_INDEX.tasks || []).filter(t => !isClosedStatus(t.status)).length;
        case 'incidentsPanel': return (SEARCH_INDEX.incidents || []).filter(i => !isClosedStatus(i.status)).length;
        case 'returnsPanel': return (SEARCH_INDEX.returns || []).filter(r => r.status !== 'closed').length;
        default: return 0;
      }
    }

    function searchEverything(query){
      const q = query.trim().toLowerCase();
      if (!q) return [];
      const results = [];

      // The guide answers here as well as in the command palette, so asking
      // "how do returns work" in the sidebar works the same way.
      if (typeof helpMatches === 'function') {
        helpMatches(q).forEach(e => results.push({
          pageId: e.page, type: 'Guide', label: e.title, help: e,
        }));
      }
      // EXT20 (INT-7): only the first 30 results are shown, so stop matching once
      // 30 are found (same results, same order). Before, a one-letter search over
      // 10,000 products built 10,000 result objects per keystroke, then dropped
      // all but 30 (garbage-collection pauses under load).
      const CAP = 30;
      const hit = (fields) => results.length < CAP && fields.filter(Boolean).join(' ').toLowerCase().includes(q);

      (SEARCH_INDEX.orders || []).forEach(o => {
        if (hit([o.order_number, o.id, o.customer_name, o.customer_email, o.status])) {
          results.push({ pageId: 'ordersPanel', type: 'Order', label: `${o.order_number || o.id} — ${o.customer_name || o.customer_email || '—'}` });
        }
      });
      (inquiriesList() || []).forEach(i => {
        if (hit([i.customer_name, i.customer_email, i.question_text, i.order_id])) {
          results.push({ pageId: 'inquiriesPanel', type: 'Customer Inquiry', label: `${i.customer_name || i.customer_email || '—'} — ${(i.question_text || '').slice(0, 50)}` });
        }
      });
      (SEARCH_INDEX.tasks || []).forEach(t => {
        if (hit([t.title, t.priority, t.status])) {
          results.push({ pageId: 'tasksPanel', type: 'Task', label: t.title });
        }
      });
      (SEARCH_INDEX.incidents || []).forEach(inc => {
        if (hit([inc.incident_number, inc.title, inc.severity, inc.status])) {
          results.push({ pageId: 'incidentsPanel', type: 'Incident', label: `${inc.incident_number || ''} — ${inc.title}` });
        }
      });
      (SEARCH_INDEX.approvals || []).forEach(a => {
        if (hit([a.action_type, a.summary, a.status])) {
          results.push({ pageId: 'approvalsPanel', type: 'Approval', label: a.summary || a.action_type });
        }
      });
      (SEARCH_INDEX.sops || []).forEach(s => {
        if (hit([s.title, s.category])) {
          results.push({ pageId: 'sopsPanel', type: 'Procedure', label: s.title });
        }
      });
      (SEARCH_INDEX.featureRequests || []).forEach(f => {
        if (hit([f.title, f.description, f.status])) {
          results.push({ pageId: 'featureRequestsPanel', type: 'Feature Request', label: f.title });
        }
      });
      (SEARCH_INDEX.evidence || []).forEach(e => {
        if (hit([e.title, e.description, e.evidence_type])) {
          results.push({ pageId: 'evidenceLockerPanel', type: 'Evidence', label: e.title });
        }
      });
      (SEARCH_INDEX.adverseEvents || []).forEach(a => {
        if (hit([a.product_name, a.description, a.reporter_name])) {
          results.push({ pageId: 'adverseEventsPanel', type: 'Adverse Event', label: `${a.product_name} — ${(a.description || '').slice(0, 40)}` });
        }
      });
      (SEARCH_INDEX.legalHolds || []).forEach(l => {
        if (hit([l.title, l.description, l.related_reference])) {
          results.push({ pageId: 'legalHoldsPanel', type: 'Legal Hold', label: l.title });
        }
      });
      (SEARCH_INDEX.documents || []).forEach(d => {
        if (hit([d.title, d.category, d.notes])) {
          results.push({ pageId: 'documentsPanel', type: 'Document', label: `${d.title} (${DOCUMENT_CATEGORY_LABELS[d.category] || d.category})` });
        }
      });
      (SEARCH_INDEX.expenses || []).forEach(x => {
        if (hit([EXPENSE_CATEGORY_LABELS[x.category], x.vendor, x.note])) {
          results.push({ pageId: 'expensesPanel', type: 'Expense', label: `${EXPENSE_CATEGORY_LABELS[x.category] || x.category} — ${fmtMoney(x.amount, 'USD')}${x.vendor ? ' — ' + x.vendor : ''}` });
        }
      });
      (SEARCH_INDEX.inventory || []).forEach(p => {
        if (hit([p.sku, p.name])) {
          results.push({ pageId: 'inventoryPanel', type: 'Inventory', label: `${p.name}${p.sku ? ' (' + p.sku + ')' : ''}` });
        }
      });
      // People: typing a 9-digit account number, a name, or an email here finds
      // the person and opens their history in Employee Activity.
      (SEARCH_INDEX.people || []).forEach(p => {
        const acct = p.account_number || '';
        const qDigits = q.replace(/[^0-9]/g, '');
        const acctHit = qDigits.length >= 3 && acct.includes(qDigits);
        if (acctHit || hit([p.display_name, p.email, p.role])) {
          results.push({
            pageId: 'activityPanel',
            type: 'Person',
            label: `${p.display_name || p.email} — #${fmtAccountNumber(acct)} (${ROLE_LABELS[p.role] || p.role})`,
            activitySearch: acct || p.email,
          });
        }
      });
      (SEARCH_INDEX.suppliers || []).forEach(s => {
        if (hit([s.name, s.contact_name, s.email, s.supplier_type])) {
          results.push({ pageId: 'suppliersPanel', type: 'Supplier', label: s.name });
        }
      });
      (SEARCH_INDEX.purchaseOrders || []).forEach(p => {
        const sup = (p.suppliers && p.suppliers.name) || '';
        if (hit([p.po_number, sup, p.status, p.notes])) {
          results.push({ pageId: 'purchaseOrdersPanel', type: 'Purchase Order', label: p.po_number + ' — ' + sup });
        }
      });
      (SEARCH_INDEX.qualityChecks || []).forEach(qc => {
        const prod = (qc.products && qc.products.name) || '';
        const lot = (qc.inventory_lots && qc.inventory_lots.lot_number) || '';
        if (hit([qc.check_type, qc.result, qc.severity, qc.description, prod, lot])) {
          results.push({ pageId: 'qualityControlPanel', type: 'Quality Check', label: `${QC_TYPE_LABELS[qc.check_type] || qc.check_type} — ${prod || 'Unlinked'}` });
        }
      });
      (SEARCH_INDEX.recalls || []).forEach(r => {
        const prod = (r.products && r.products.name) || '';
        const lot = (r.inventory_lots && r.inventory_lots.lot_number) || '';
        if (hit([r.reason, r.status, r.severity, prod, lot])) {
          results.push({ pageId: 'recallsPanel', type: 'Recall', label: `${prod || 'Unlinked'} — lot ${lot || '?'} (${r.status})` });
        }
      });
      (SEARCH_INDEX.returns || []).forEach(r => {
        const order = r.orders || {};
        const item = r.order_items || {};
        if (hit([order.order_number, order.customer_name, item.product_name, item.sku, r.reason, r.status])) {
          results.push({ pageId: 'returnsPanel', type: 'Return', label: `${item.product_name || 'Return'} — ${order.order_number || r.order_id || ''}` });
        }
      });

      return results.slice(0, CAP);
    }
    SIDEBAR_GROUPS.forEach(g => g.pages.forEach(p => { PAGE_LABEL_BY_ID[p.id] = p.label; }));
    function togglePinnedPage(pageId){
      const pinned = getPinnedPages();
      const idx = pinned.indexOf(pageId);
      if (idx === -1) pinned.push(pageId); else pinned.splice(idx, 1);
      setPinnedPages(pinned);
      renderSidebar(document.getElementById('sidebarSearch').value);
    }

    // EXT19: the sidebar is built as elements (h), not as an HTML string: it was
    // the busiest raw-HTML site on the page (40 of 168 Trusted Types reports).
    function pageLinkNode(p, pinnedSet){
      const badge = getPageBadgeCount(p.id);
      const isPinned = pinnedSet.has(p.id);
      return h('a', { class: 'sidebarLink' + (p.id === currentPageId ? ' active' : ''), 'data-page': p.id },
        h('span', { class: 'linkLabelRow' },
          h('button', { type: 'button', class: 'pinBtn' + (isPinned ? ' pinned' : ''), 'data-pin-page': p.id, title: isPinned ? 'Unpin' : 'Pin to top' }, isPinned ? '★' : '☆'),
          h('span', { class: 'pageIcon' }, pageIconNode(p.id)),
          h('span', null, p.label)),
        badge > 0 ? h('span', { class: 'sidebarBadge' }, badge) : null);
    }

    function renderSidebar(filterText){
      const q = (filterText || '').trim().toLowerCase();
      const wrap = document.getElementById('sidebarGroups');
      const pinnedIds = getPinnedPages();
      const pinnedSet = new Set(pinnedIds);
      const out = [];

      if (pinnedIds.length) {
        out.push(h('div', { class: 'sidebarGroup u-groupcolor-copper' }, h('div', { class: 'groupLabel' }, 'Pinned'),
          pinnedIds.filter(id => PAGE_LABEL_BY_ID[id]).map(id => pageLinkNode({ id, label: PAGE_LABEL_BY_ID[id] }, pinnedSet))));
      }

      LAST_SEARCH_RESULTS = [];
      if (q) {
        const dataResults = searchEverything(q);
        LAST_SEARCH_RESULTS = dataResults;
        if (dataResults.length) {
          out.push(h('div', { class: 'sidebarGroup u-groupcolor-teal' }, h('div', { class: 'groupLabel' }, 'Search results'),
            dataResults.map((r, idx) => h('a', { class: 'sidebarLink searchResultLink', 'data-page': r.pageId, 'data-result-index': idx },
              h('span', { class: 'resultType' }, r.type), h('br'), r.label))));
        }
      }

      // EXT8: search runs over what this page has loaded (open work, the
      // newest orders, ...). Say so, and offer a lookup in ALL orders, so an
      // older order is never reported as "no match".
      if (q && q.length >= 2) {
        const results = h('div', { id: 'orderLookupResults' });
        // the earlier lookup's rows (built with esc() in lookUpAllOrders) are shown again for the same search
        if (ORDER_LOOKUP.q === q && ORDER_LOOKUP.html) results.innerHTML = ORDER_LOOKUP.html;
        out.push(h('div', { class: 'sidebarGroup u-groupcolor-teal', id: 'orderLookupGroup' },
          h('p', { class: 'hint u-m-4-10' }, 'Searches the records loaded here (open work, newest orders).'),
          h('button', { type: 'button', class: 'small secondary u-m-2-10-6', id: 'orderLookupBtn' }, 'Look up “' + q + '” in all orders'),
          results));
      }

      SIDEBAR_GROUPS.forEach(group => {
        const pages = group.pages.filter(p => !q || p.label.toLowerCase().includes(q));
        if (!pages.length) return;
        // EXT15: no inline style (strict style policy): the colour travels as data and is
        // applied through the CSS object model below, only if it is a plain hex colour.
        const color = group.color || '#1f7a8c';
        if (group.collapsible && !q) {
          // Open if you've opened it, or if the page you're on lives here.
          const open = isGroupOpen(group.label) || pages.some(p => p.id === currentPageId);
          // Never hide something that needs attention: if a folded page has a
          // badge, the total shows on the section header.
          const hiddenBadges = open ? 0 : pages.reduce((n, p) => n + (getPageBadgeCount(p.id) || 0), 0);
          out.push(h('div', { class: 'sidebarGroup', 'data-group-color': color },
            h('button', { type: 'button', class: 'groupLabel groupToggle', 'data-group': group.label, 'aria-expanded': String(open) },
              h('span', { class: 'groupChevron' }, open ? '▾' : '▸'), group.label,
              hiddenBadges > 0 ? h('span', { class: 'sidebarBadge' }, hiddenBadges) : null),
            open ? pages.map(p => pageLinkNode(p, pinnedSet)) : null));
          return;
        }
        out.push(h('div', { class: 'sidebarGroup', 'data-group-color': color }, h('div', { class: 'groupLabel' }, group.label),
          pages.map(p => pageLinkNode(p, pinnedSet))));
      });

      if (!out.length) out.push(h('p', { class: 'sidebarEmpty' }, 'No pages or records match your search.'));
      wrap.replaceChildren(...out);
      wrap.querySelectorAll('.sidebarGroup[data-group-color]').forEach(g => {
        const c = g.getAttribute('data-group-color');
        if (/^#[0-9a-fA-F]{3,8}$/.test(c)) g.style.setProperty('--groupColor', c);
      });
      wrap.querySelectorAll('.sidebarLink').forEach(link => {
        link.addEventListener('click', () => showPage(link.getAttribute('data-page')));
      });
      wrap.querySelectorAll('.pinBtn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          togglePinnedPage(btn.getAttribute('data-pin-page'));
        });
      });
      wrap.querySelectorAll('.groupToggle').forEach(btn => {
        btn.addEventListener('click', () => {
          const label = btn.getAttribute('data-group');
          setGroupOpen(label, btn.getAttribute('aria-expanded') !== 'true');
          renderSidebar(document.getElementById('sidebarSearch').value);
        });
      });
      // A "Person" search result also drops that person's account number into
      // the Employee Activity search, so clicking it lands on their history.
      const lookupBtn = document.getElementById('orderLookupBtn');
      if (lookupBtn) lookupBtn.addEventListener('click', () => lookUpAllOrders(q));
      bindOrderLookupLinks();
      wrap.querySelectorAll('.searchResultLink').forEach(link => {
        link.addEventListener('click', () => {
          const r = LAST_SEARCH_RESULTS[Number(link.getAttribute('data-result-index'))];
          if (r && r.help) { openHelp(r.help); return; }
          if (!r || !r.activitySearch) return;
          const box = document.getElementById('activitySearch');
          if (!box) return;
          box.value = r.activitySearch;
          loadActivity(true);
        });
      });
    }
    // EXT8: the browser's Back / Forward move between dashboard pages
    // instead of leaving the dashboard.
    let HISTORY_STARTED = false, HISTORY_SUPPRESS = false;
    function recordPageInHistory(pageId){
      if (HISTORY_SUPPRESS) return;
      const want = '#page=' + pageId;
      try {
        if (location.hash !== want) {
          if (HISTORY_STARTED) history.pushState({ hePage: pageId }, '', want);
          else history.replaceState({ hePage: pageId }, '', want);
        }
      } catch (_) { /* history not available: page still works */ }
      HISTORY_STARTED = true;
    }
    window.addEventListener('popstate', () => {
      const pageId = pageFromHash();
      if (!pageId || pageId === currentPageId || dash.style.display !== 'flex') return;
      HISTORY_SUPPRESS = true;
      try { showPage(pageId); } finally { HISTORY_SUPPRESS = false; }
    });
    function showPageWarning(pageId, text){
      PAGE_WARNINGS[pageId] = text || null;
      if (text && currentPageId === pageId) showDashError(text);
    }
    function showPage(pageId){
      // If a password prompt is still open, leaving the page cancels it.
      // Otherwise it floats over whatever you navigate to, looking like it
      // appeared out of nowhere.
      if (activeReauthClose) activeReauthClose(false);
      document.querySelectorAll('main.contentArea > section.panel').forEach(sec => {
        sec.classList.toggle('activePage', sec.id === pageId);
      });
      currentPageId = pageId;
      if (PAGE_WARNINGS[pageId]) showDashError(PAGE_WARNINGS[pageId]); // X8-19: that page's own warning
      if (pageId === 'continuityPanel' && typeof loadSystemStatus === 'function') safeRun(loadSystemStatus); // EXT11: installation probes only when looked at
      saveLastPage(pageId);
      recordPageInHistory(pageId);
      renderSidebar(document.getElementById('sidebarSearch').value);
      closeMobileSidebar();
      document.querySelector('main.contentArea').scrollTop = 0;
      window.scrollTo(0, 0);
    }

    document.getElementById('sidebarSearch').addEventListener('input', (e) => renderSidebar(e.target.value));
    document.getElementById('sidebarSearch').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const q = e.target.value.trim().toLowerCase();
      if (!q) return;
      // Order (EXT3): a page whose name starts with what was typed; then a
      // record (order, task, …); then a Guide topic's page; then any page
      // whose name contains the text. Before, a Guide match always won, so
      // "incidents" + Enter opened Quality Control.
      const allPages = [].concat(...SIDEBAR_GROUPS.map(g => g.pages));
      const named = allPages.find(p => p.label.toLowerCase().startsWith(q));
      if (named) { showPage(named.id); return; }
      const dataResults = searchEverything(q);
      const record = dataResults.find(r => r.type !== 'Guide');
      if (record) { showPage(record.pageId); return; }
      if (dataResults.length) { showPage(dataResults[0].pageId); return; }
      const match = allPages.find(p => p.label.toLowerCase().includes(q));
      if (match) { showPage(match.id); return; }
    });

    // On a phone/narrow screen, the sidebar is hidden by default; this menu
    // button slides it in, and tapping the darkened background (or picking a
    // page, handled in showPage above) closes it again.
    document.getElementById('menuToggleBtn').addEventListener('click', () => {
      document.getElementById('sidebarNav').classList.toggle('mobileOpen');
      document.getElementById('sidebarOverlay').classList.toggle('visible');
    });
    document.getElementById('sidebarOverlay').addEventListener('click', closeMobileSidebar);
    toastHost.id = 'toastHost';
    // Screen readers announce confirmations politely. Error toasts repeat the
    // error banner (role="alert", already announced), so they stay silent.
    toastHost.setAttribute('role', 'status');
    toastHost.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastHost);
    window.toastOk = (m) => toast(m, 'ok');
    window.toastErr = (m) => toast(m, 'err');
    new MutationObserver(muts => {
      muts.forEach(mu => {
        mu.addedNodes.forEach(n => {
          if (n.nodeType !== 1) return;
          if (n.matches && n.matches('.stat .num')) animateNumber(n);
          if (n.querySelectorAll) n.querySelectorAll('.stat .num').forEach(animateNumber);
        });
      });
    }).observe(document.body, { childList: true, subtree: true });
    new MutationObserver(muts => {
      muts.forEach(mu => mu.addedNodes.forEach(n => { if (n.nodeType === 1) labelPhoneCards(n); }));
    }).observe(document.body, { childList: true, subtree: true });

    // ---- Progressive loading ----
    // The page you are actually looking at loads first and appears immediately;
    // everything else fills in behind it, a few at a time. Before this, nothing
    // appeared until all ~30 queries had finished.
    const PANEL_LOADERS = {
      attentionPanel: [loadAttention, loadBusinessHealth, loadAttentionChecks, loadNightlyCheck],
      calendarPanel: [loadCalendarMonth],
      dailySummaryPanel: [loadDailySummary],
      reportHistoryPanel: [loadReportHistory],
      ordersPanel: [loadOrders],
      inventoryPanel: [loadInventory, loadInventoryAdjustments],
      returnsPanel: [loadReturns],
      suppliersPanel: [loadSuppliers],
      purchaseOrdersPanel: [loadPurchaseOrders],
      qualityControlPanel: [loadQualityChecks],
      recallsPanel: [loadRecalls],
      expensesPanel: [loadExpenses, loadDeletedExpenses],
      accountingPanel: [loadAccounting],
      taxRecordsPanel: [loadTaxRecords],
      tasksPanel: [loadTasks],
      incidentsPanel: [loadIncidents],
      evidenceLockerPanel: [loadEvidenceLocker],
      documentsPanel: [loadDocuments],
      adverseEventsPanel: [loadAdverseEvents],
      inquiriesPanel: [loadInquiries],
      aiPanel: [loadAI],
      continuityPanel: [loadContinuity, loadSystemStatus],
      flagsPanel: [loadFlags, loadSystemMode],
      businessRulesPanel: [loadBusinessRules],
      approvalsPanel: [loadApprovals],
      sessionsPanel: [loadSessions],
      activityPanel: [loadActivityPeople, loadActivityAreas, loadActivityDigest, () => loadActivity(true)],
      sopsPanel: [loadSops],
      featureRequestsPanel: [loadFeatureRequests, loadDeletedFeatureRequests],
      legalHoldsPanel: [loadLegalHolds, loadReleasedLegalHolds],
    };
    function refreshChrome(){
      renderSidebar(document.getElementById('sidebarSearch').value);
      decorateEmptyStates();
    }
    helpOverlay.id = 'helpOverlay';
    // Announced as a dialog by screen readers (EXT3).
    helpOverlay.setAttribute('role', 'dialog'); helpOverlay.setAttribute('aria-modal', 'true'); helpOverlay.setAttribute('aria-label', 'Guide');
    helpOverlay.innerHTML = '<div class="helpCard"><h3 id="helpTitle"></h3>' +
      '<div class="helpWhere" id="helpWhere"></div><div id="helpBody"></div>' +
      '<div class="helpFoot"><button type="button" class="small" id="helpGoBtn">Take me there</button>' +
      '<button type="button" class="small secondary" id="helpCloseBtn">Close</button></div></div>';
    document.body.appendChild(helpOverlay);
    let HELP_CURRENT = null;
    function openHelp(entry){
      HELP_CURRENT = entry;
      document.getElementById('helpTitle').textContent = entry.title;
      document.getElementById('helpWhere').textContent = PAGE_LABEL_BY_ID[entry.page] || '';
      document.getElementById('helpBody').innerHTML =
        entry.body.split('|').map(p => '<p>' + esc(p) + '</p>').join('');
      rememberFocus('help');
      helpOverlay.classList.add('open');
    }
    document.getElementById('helpCloseBtn').addEventListener('click', closeHelp);
    document.getElementById('helpGoBtn').addEventListener('click', () => {
      if (HELP_CURRENT) showPage(HELP_CURRENT.page);
      closeHelp();
    });
    helpOverlay.addEventListener('click', (e) => { if (e.target === helpOverlay) closeHelp(); });
    paletteOverlay.id = 'paletteOverlay';
    // Announced as a dialog by screen readers (EXT3).
    paletteOverlay.setAttribute('role', 'dialog'); paletteOverlay.setAttribute('aria-modal', 'true'); paletteOverlay.setAttribute('aria-label', 'Search and commands');
    paletteOverlay.innerHTML =
      '<div class="paletteCard">' +
        '<input type="text" id="paletteInput" placeholder="Jump to a page or record, or ask how something works\u2026" autocomplete="off" spellcheck="false">' +
        '<div id="paletteResults"></div>' +
        '<div class="paletteFoot"><span><kbd>\u2191</kbd><kbd>\u2193</kbd> move</span>' +
        '<span><kbd>\u21A9</kbd> open</span><span><kbd>esc</kbd> close</span></div>' +
      '</div>';
    document.body.appendChild(paletteOverlay);
    let PAL_ITEMS = [], PAL_SEL = 0;

    function paletteItems(q){
      const items = [];
      const query = (q || '').trim().toLowerCase();
      const pages = [];
      SIDEBAR_GROUPS.forEach(g => g.pages.forEach(p => {
        if (!query || p.label.toLowerCase().includes(query) || g.label.toLowerCase().includes(query)) {
          pages.push({ kind: g.label, label: p.label, pageId: p.id, icon: pageIconSvg(p.id) });
        }
      }));
      if (query) {
        // Order: pages, then records, then Guide articles (EXT4). A page whose
        // name starts with what was typed comes first, so "Expenses" + Enter
        // opens Expenses. A question ("how do returns work") matches no page
        // or record, so the Guide article is still first for it. Records are
        // capped at 30 (searchEverything), so Guide articles always fit.
        const named = pages.filter(p => p.label.toLowerCase().startsWith(query));
        items.push.apply(items, named);
        items.push.apply(items, pages.filter(p => !named.includes(p)));
        // Guide articles come last; skip the copies the record search returns.
        searchEverything(query).filter(r => r.type !== 'Guide').forEach(r => items.push({
          kind: r.type, label: r.label, pageId: r.pageId,
          icon: pageIconSvg(r.pageId), activitySearch: r.activitySearch,
        }));
        helpMatches(query).forEach(e => items.push({
          kind: 'Guide', label: e.title, pageId: e.page, help: e, icon: pageIconSvg(e.page),
        }));
      }
      if (!query) items.push.apply(items, pages);
      return items.slice(0, 40);
    }
    function renderPalette(){
      const box = document.getElementById('paletteResults');
      if (!PAL_ITEMS.length) { box.replaceChildren(h('div', { class: 'pEmpty' }, 'Nothing matches that.')); return; }
      box.innerHTML = PAL_ITEMS.map((it, i) =>
        '<div class="pResult' + (i === PAL_SEL ? ' sel' : '') + '" data-i="' + i + '">' +
          '<span class="pIcon">' + it.icon + '</span>' +
          '<span class="pMain"></span>' +
          '<span class="pKind"></span>' +
        '</div>').join('');
      box.querySelectorAll('.pResult').forEach((el, i) => {
        el.querySelector('.pMain').textContent = PAL_ITEMS[i].label;
        el.querySelector('.pKind').textContent = PAL_ITEMS[i].kind;
        el.addEventListener('click', () => runPalette(i));
        el.addEventListener('mousemove', () => {
          if (PAL_SEL === i) return;
          PAL_SEL = i;
          box.querySelectorAll('.pResult').forEach((n, j) => n.classList.toggle('sel', j === i));
        });
      });
      // EXT20 (INT-7): keep the selected row visible by scrolling the result list
      // only. scrollIntoView() also scrolls every ancestor, which forced a layout
      // of the whole page on each keystroke (93% of keystroke time with 10,000
      // inventory rows on the page behind the palette).
      const sel = box.querySelector('.pResult.sel');
      if (sel) {
        const top = sel.offsetTop - box.offsetTop, bottom = top + sel.offsetHeight;
        if (top < box.scrollTop) box.scrollTop = top;
        else if (bottom > box.scrollTop + box.clientHeight) box.scrollTop = bottom - box.clientHeight;
      }
    }
    function openPalette(){
      PAL_SEL = 0;
      PAL_ITEMS = paletteItems('');
      rememberFocus('palette');
      paletteOverlay.classList.add('open');
      renderPalette();
      const inp = document.getElementById('paletteInput');
      inp.value = '';
      // Focus straight away so the first keys typed after Cmd+K aren't lost
      // (Cmd+K's own keypress is already cancelled); the delayed call stays
      // as a fallback for browsers that ignore focus during the keydown.
      inp.focus();
      setTimeout(() => inp.focus(), 10);
    }
    function runPalette(i){
      const it = PAL_ITEMS[i];
      if (!it) return;
      closePalette(false);
      if (it.help) { openHelp(it.help); return; }
      showPage(it.pageId);
      if (it.activitySearch) {
        const box = document.getElementById('activitySearch');
        if (box) { box.value = it.activitySearch; loadActivity(true); }
      }
    }
    document.getElementById('paletteInput').addEventListener('input', (e) => {
      PAL_ITEMS = paletteItems(e.target.value); PAL_SEL = 0; renderPalette();
    });
    document.getElementById('paletteInput').addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); PAL_SEL = Math.min(PAL_SEL + 1, PAL_ITEMS.length - 1); renderPalette(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); PAL_SEL = Math.max(PAL_SEL - 1, 0); renderPalette(); }
      else if (e.key === 'Enter') { e.preventDefault(); runPalette(PAL_SEL); }
      else if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
    });
    paletteOverlay.addEventListener('click', (e) => { if (e.target === paletteOverlay) closePalette(); });
    shortcutOverlay.id = 'shortcutOverlay';
    // Announced as a dialog by screen readers (EXT3).
    shortcutOverlay.setAttribute('role', 'dialog'); shortcutOverlay.setAttribute('aria-modal', 'true'); shortcutOverlay.setAttribute('aria-label', 'Keyboard shortcuts');
    shortcutOverlay.innerHTML =
      '<div class="shortcutCard"><h3>Keyboard shortcuts</h3><div class="scGrid">' +
      '<div class="scGroup"><h4>Anywhere</h4>' +
        '<div class="scRow"><span>Command palette</span><span><kbd>\u2318</kbd><kbd>K</kbd></span></div>' +
        '<div class="scRow"><span>Search pages</span><span><kbd>/</kbd></span></div>' +
        '<div class="scRow"><span>This list</span><span><kbd>?</kbd></span></div>' +
        '<div class="scRow"><span>Refresh data</span><span><kbd>\u2318</kbd><kbd>\u21E7</kbd><kbd>R</kbd></span></div>' +
        '<div class="scRow"><span>Close anything</span><span><kbd>esc</kbd></span></div>' +
        '<div class="scRow"><span>Back / forward</span><span><kbd>\u2318</kbd><kbd>[</kbd> <kbd>\u2318</kbd><kbd>]</kbd></span></div>' +
        '<div class="scRow"><span>New reminder</span><span><kbd>\u2318</kbd><kbd>N</kbd></span></div>' +
        '<div class="scRow"><span>Jump to pinned page</span><span><kbd>\u2318</kbd><kbd>1</kbd>\u2013<kbd>9</kbd></span></div>' +
        '<div class="scRow"><span>Move through rows</span><span><kbd>J</kbd><kbd>K</kbd></span></div>' +
        '<div class="scRow"><span>Open the row</span><span><kbd>\u21A9</kbd></span></div>' +
        '<div class="scRow"><span>Inspect a record</span><span><kbd>space</kbd></span></div>' +
        '<div class="scRow"><span>Ask the guide</span><span><kbd>\u2318</kbd><kbd>K</kbd> then type</span></div></div>' +
      '<div class="scGroup"><h4>On the calendar</h4>' +
        '<div class="scRow"><span>Previous / next</span><span><kbd>\u2190</kbd><kbd>\u2192</kbd></span></div>' +
        '<div class="scRow"><span>Day / Week / Month</span><span><kbd>D</kbd><kbd>W</kbd><kbd>M</kbd></span></div>' +
        '<div class="scRow"><span>Jump to today</span><span><kbd>T</kbd></span></div>' +
        '<div class="scRow"><span>Save a note</span><span><kbd>\u2318</kbd><kbd>\u21A9</kbd></span></div></div>' +
      '<div class="scGroup"><h4>Go to \u2014 press g, then\u2026</h4>' +
        '<div class="scRow"><span>Needs your attention</span><span><kbd>g</kbd><kbd>n</kbd></span></div>' +
        '<div class="scRow"><span>Orders</span><span><kbd>g</kbd><kbd>o</kbd></span></div>' +
        '<div class="scRow"><span>Inventory</span><span><kbd>g</kbd><kbd>i</kbd></span></div>' +
        '<div class="scRow"><span>Returns</span><span><kbd>g</kbd><kbd>r</kbd></span></div>' +
        '<div class="scRow"><span>Expenses</span><span><kbd>g</kbd><kbd>e</kbd></span></div>' +
        '<div class="scRow"><span>Tasks</span><span><kbd>g</kbd><kbd>t</kbd></span></div>' +
        '<div class="scRow"><span>Employee activity</span><span><kbd>g</kbd><kbd>a</kbd></span></div>' +
        '<div class="scRow"><span>Calendar</span><span><kbd>g</kbd><kbd>c</kbd></span></div></div>' +
      '</div></div>';
    document.body.appendChild(shortcutOverlay);
    shortcutOverlay.addEventListener('click', (e) => { if (e.target === shortcutOverlay) closeShortcuts(); });
    let goArmed = false, goTimer = null;
    document.addEventListener('keydown', (e) => {
      const meta = e.metaKey || e.ctrlKey;

      if (meta && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        paletteOverlay.classList.contains('open') ? closePalette() : openPalette();
        return;
      }
      if (meta && e.shiftKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault(); toast('Refreshing\u2026'); loadDashboard(); return;
      }
      if (e.key === 'Escape') {
        if (paletteOverlay.classList.contains('open')) { closePalette(); return; }
        if (helpOverlay.classList.contains('open')) { closeHelp(); return; }
        if (shortcutOverlay.classList.contains('open')) { closeShortcuts(); return; }
      }
      if (typingInField(e) || meta || e.altKey) return;

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        shortcutOverlay.classList.contains('open') ? closeShortcuts() : openShortcuts();
        return;
      }
      if (anyOverlayOpen() || helpOverlay.classList.contains('open')) return;

      // Calendar keys, only while you're on the calendar
      if (currentPageId === 'calendarPanel' && !goArmed) {
        if (e.key === 'ArrowLeft')  { e.preventDefault(); calStep(-1); return; }
        if (e.key === 'ArrowRight') { e.preventDefault(); calStep(1);  return; }
        const k = e.key.toLowerCase();
        if (k === 't') { e.preventDefault(); calToday(); return; }
        if (k === 'd' || k === 'w' || k === 'm') {
          e.preventDefault();
          setCalView(k === 'd' ? 'day' : k === 'w' ? 'week' : 'month');
          return;
        }
      }
      if (e.key === '/') {
        e.preventDefault();
        const s = document.getElementById('sidebarSearch');
        if (s) { s.focus(); s.select(); }
        return;
      }
      if (goArmed) {
        const dest = GO_TO[e.key.toLowerCase()];
        goArmed = false;
        clearTimeout(goTimer);
        if (dest) { e.preventDefault(); showPage(dest); }
        return;
      }
      if (e.key === 'g' || e.key === 'G') {
        goArmed = true;
        clearTimeout(goTimer);
        goTimer = setTimeout(() => { goArmed = false; }, 1200);
      }
    });
    let ACTIVITY_OFFSET = 0;
    let ACTIVITY_ROWS = [];
    let ACTIVITY_PERSON = null;   // null = everyone
    let ACTIVITY_HOVERED = -1;

    function renderActivity(){
      const wrap = document.getElementById('activityWrap');
      const rows = ACTIVITY_ROWS;

      if (!rows.length) {
        document.getElementById('activityStats').replaceChildren();
        wrap.replaceChildren(h('p', { class: 'empty' }, 'No activity matches that search.'));
        return;
      }

      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const todayCount = rows.filter(r => new Date(r.happened_at).getTime() >= dayAgo).length;
      const peopleCount = new Set(rows.filter(r => r.person_account_number).map(r => r.person_account_number)).size;
      document.getElementById('activityStats').innerHTML = `
        <div class="stat"><div class="num">${rows.length}</div><div class="lbl">Entries loaded</div></div>
        <div class="stat"><div class="num">${todayCount}</div><div class="lbl">Last 24 hours</div></div>
        <div class="stat"><div class="num">${peopleCount}</div><div class="lbl">People in this list</div></div>`;

      wrap.innerHTML = rows.map((r, i) => {
        const area = ACTIVITY_AREA_LABELS[r.table_name] || r.area || r.table_name;
        const roleKey = r.person_role || 'system';
        const roleLabel = r.person_role ? (ROLE_LABELS[r.person_role] || r.person_role) : 'System';
        const acct = r.person_account_number ? `<span class="actNum">#${esc(fmtAccountNumber(r.person_account_number))}</span>` : '';
        return `
        <div class="actItem${r.action === 'DELETE' ? ' isDelete' : ''}" data-index="${i}">
          <div class="actRow">
            <div class="actMain">
              <div class="actHead">
                <span class="actWho">${esc(r.person_name)}</span>
                ${acct}
                <span class="badge role-${esc(roleKey)}">${esc(roleLabel)}</span>
              </div>
              <div class="actWhat"><b>${esc(r.action_label)}</b> in <b>${esc(area)}</b> · ${esc(recordTitle(r))}</div>
            </div>
            <div class="actSide">
              <div class="actWhen">${esc(fmtDate(r.happened_at))}</div>
              <button type="button" class="small secondary actToggle" data-index="${i}">Details</button>
            </div>
          </div>
          <div class="actDetail u-d-none" id="actDetail${i}"></div>
        </div>`;
      }).join('');

      wrap.querySelectorAll('.actToggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const i = Number(btn.getAttribute('data-index'));
          const box = document.getElementById('actDetail' + i);
          if (!box) return;
          // EXT15: starts hidden by a class now (no inline style), so ask the computed style.
          if (getComputedStyle(box).display === 'none') {
            if (!box.innerHTML) box.innerHTML = describeChange(ACTIVITY_ROWS[i]);
            box.style.display = 'block';
            btn.textContent = 'Hide';
          } else {
            box.style.display = 'none';
            btn.textContent = 'Details';
          }
        });
      });

      // Quick Look: hovering an entry arms the Space shortcut; clicking the
      // entry itself opens the same inspector, so the shortcut is optional.
      wrap.querySelectorAll('.actItem').forEach(item => {
        const i = Number(item.getAttribute('data-index'));
        item.addEventListener('mouseenter', () => {
          ACTIVITY_HOVERED = i;
          item.classList.add('hovered');
          document.getElementById('inspectHint').classList.add('show');
        });
        item.addEventListener('mouseleave', () => {
          if (ACTIVITY_HOVERED === i) ACTIVITY_HOVERED = -1;
          item.classList.remove('hovered');
          document.getElementById('inspectHint').classList.remove('show');
        });
        item.querySelector('.actRow').addEventListener('click', () => openInspector(ACTIVITY_ROWS[i]));
      });
    }

    // The filters the Activity page shows right now (search, person, area,
    // date range) — shared by the list and the spreadsheet export.
    function activityFilters(){
      const box = document.getElementById('activitySearch');
      const q = box ? (box.value || '').trim() : '';
      return {
        p_search: q || null,
        p_person: ACTIVITY_PERSON,
        p_area: document.getElementById('activityArea').value || null,
        p_from: activityFromDate(),
      };
    }

    async function loadActivity(reset){
      const isLatest = newLoadToken('activity'); // EXT8: an older reply never draws over a newer one
      const box = document.getElementById('activitySearch');
      const q = box ? (box.value || '').trim() : '';
      if (reset) {
        ACTIVITY_OFFSET = 0;
        ACTIVITY_ROWS = [];
        document.getElementById('activityWrap').replaceChildren(h('p', { class: 'empty' }, 'Loading…'));
      }
      try {
        const { data, error } = await supabase.rpc('employee_activity', {
          p_search: q || null,
          p_person: ACTIVITY_PERSON,
          p_area: document.getElementById('activityArea').value || null,
          p_from: activityFromDate(),
          p_limit: ACTIVITY_PAGE_SIZE,
          p_offset: ACTIVITY_OFFSET,
        });
        if (error) throw error;
        if (!isLatest()) return;
        const rows = data || [];
        // EXT5: "Load more" after new changes were recorded would repeat the
        // last rows (pages are counted by position); skip ids already shown.
        const shown = new Set(ACTIVITY_ROWS.map(r => r.id));
        ACTIVITY_ROWS = ACTIVITY_ROWS.concat(rows.filter(r => r.id == null || !shown.has(r.id)));
        ACTIVITY_OFFSET += rows.length;
        document.getElementById('activityMoreWrap').style.display =
          rows.length === ACTIVITY_PAGE_SIZE ? 'block' : 'none';
        renderActivity();
      } catch (err) {
        if (!isLatest()) return;
        document.getElementById('activityWrap').replaceChildren();
        showDashError('Could not load Employee Activity: ' + (err && err.message ? err.message : err));
      }
    }

    // The people strip along the top of the page, which doubles as the "who is
    // account #X" lookup. It comes from its own protected function, so an
    // Administrator's copy of this list never includes the Owner.
    async function loadActivityPeople(){
      try {
        const { data, error } = await supabase.rpc('employee_activity_people');
        if (error) throw error;
        const people = data || [];
        SEARCH_INDEX.people = people;
        const strip = document.getElementById('activityPeople');
        if (!people.length) { strip.replaceChildren(); return; }
        strip.innerHTML = '<span class="peopleLbl">People</span>' +
          `<button type="button" class="personChip${ACTIVITY_PERSON ? '' : ' active'}" data-person="">Everyone</button>` +
          people.map(p => `
          <button type="button" class="personChip${ACTIVITY_PERSON === p.id ? ' active' : ''}" data-person="${esc(p.id)}">
            ${esc(p.display_name || p.email)} · #${esc(fmtAccountNumber(p.account_number))} · ${esc(ROLE_LABELS[p.role] || p.role)}
          </button>`).join('');
        strip.querySelectorAll('.personChip').forEach(chip => {
          chip.addEventListener('click', () => {
            ACTIVITY_PERSON = chip.getAttribute('data-person') || null;
            strip.querySelectorAll('.personChip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            loadActivity(true);
          });
        });
      } catch (err) {
        // Not critical — the search box still works without the people strip.
        document.getElementById('activityPeople').replaceChildren();
      }
    }

    // ---- Record Inspector (Quick Look) ----
    // Opens one record's complete history — every change ever recorded for it —
    // through the same protected function, so it can never show more than the
    // list itself would.
    let INSPECTOR_HISTORY = [];
    let INSPECTOR_TAB = 'history';
    function renderInspector(){
      const body = document.getElementById('insBody');
      if (INSPECTOR_TAB === 'raw') {
        const latest = INSPECTOR_HISTORY.find(h => h.values_stored && h.new_data && Object.keys(h.new_data).length);
        if (!latest) {
          body.replaceChildren(h('div', { class: 'insNote' }, 'No stored values for this record — this area only records which fields changed.'));
          return;
        }
        const nd = latest.new_data;
        body.innerHTML = `<div class="codeBlock">` + Object.keys(nd).map(k =>
          `<div class="cLine"><span class="jKey">${esc(k)}</span>: ${hlValue(nd[k])}</div>`
        ).join('') + `</div>
        <div class="insNote">As of ${esc(fmtDate(latest.happened_at))} — the most recent recorded state, not necessarily the record's live value today.</div>`;
        return;
      }
      if (!INSPECTOR_HISTORY.length) {
        body.replaceChildren(h('p', { class: 'empty' }, 'No history found for this record.'));
        return;
      }
      body.innerHTML = INSPECTOR_HISTORY.map(h => {
        const cls = h.action === 'DELETE' ? 'isDelete' : h.action === 'INSERT' ? 'isInsert' : 'isUpdate';
        const acct = h.person_account_number ? ` · #${esc(fmtAccountNumber(h.person_account_number))}` : '';
        return `<div class="insEvent ${cls}">
          <div class="insWhen">${esc(fmtDate(h.happened_at))}</div>
          <div class="insWho">${esc(h.person_name)}${acct} — ${esc(h.action_label)}</div>
          ${codeDiff(h)}
        </div>`;
      }).join('');
    }
    // Opens the inspector for any record anywhere in the dashboard, given the
    // area it belongs to and its id. Everything it shows comes back through the
    // same protected function as the Employee Activity list, so this can never
    // reveal more than that list already would.
    // The sidebar is redrawn when background loads finish; the lookup's
    // answer is kept (for the same search text) so it does not vanish.
    let ORDER_LOOKUP = { q: null, html: '' };
    function bindOrderLookupLinks(){
      document.querySelectorAll('#orderLookupResults .orderLookupLink').forEach(a => a.addEventListener('click', () =>
        openInspectorFor('orders', a.getAttribute('data-id'), a.getAttribute('data-num'))));
    }
    // EXT8: order number or customer name, in every (not deleted) order,
    // matched literally; newest 20 shown. Opens the order's history.
    async function lookUpAllOrders(q){
      const btn = document.getElementById('orderLookupBtn');
      if (!btn || btn.disabled) return;
      btn.disabled = true;
      const show = html => {
        ORDER_LOOKUP = { q, html };
        const box = document.getElementById('orderLookupResults'); // may have been redrawn
        if (box) { box.innerHTML = html; bindOrderLookupLinks(); }
      };
      show('<p class="hint u-m-4-10">Looking…</p>');
      try {
        const pat = '%' + likeLiteral(q) + '%';
        // Inside PostgREST's quoted value, backslash and double quote are escaped.
        const quoted = '"' + pat.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
        const { data, error } = await supabase.from('orders')
          .select('id, order_number, customer_name, status, total, currency, placed_at')
          .is('deleted_at', null).or('order_number.ilike.' + quoted + ',customer_name.ilike.' + quoted)
          .order('placed_at', { ascending: false }).limit(20);
        if (error) throw error;
        if (!data || !data.length) { show('<p class="hint u-m-4-10">No order number or customer name contains this.</p>'); return; }
        show((data.length === 20 ? '<p class="hint u-m-4-10">The newest 20 matches:</p>' : '') + data.map(o =>
          `<a class="sidebarLink orderLookupLink" data-id="${esc(o.id)}" data-num="${esc(o.order_number || '')}"><span class="resultType">Order</span><br>${esc(o.order_number || o.id)} — ${esc(o.customer_name || '—')} · ${esc(fmtMoney(o.total, o.currency))} · ${esc(o.status || '—')} · ${esc(fmtDate(o.placed_at))}</a>`).join(''));
      } catch (err) {
        show('<p class="hint u-m-4-10 u-c-warn">Could not search orders: ' + esc(explainDbError((err && err.message) || String(err))) + '</p>');
      } finally {
        const b = document.getElementById('orderLookupBtn'); if (b) b.disabled = false;
        btn.disabled = false;
      }
    }

    async function openInspectorFor(tableName, recordId, titleHint){
      if (!tableName || !recordId) return;
      INSPECTOR_TAB = 'history';
      INSPECTOR_HISTORY = [];
      const area = ACTIVITY_AREA_LABELS[tableName] ||
        String(tableName).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      document.getElementById('insTitle').textContent = titleHint ? `${area} · ${titleHint}` : area;
      document.getElementById('insSub').textContent = `Full change history · record ${recordId}`;
      document.getElementById('insTabHistory').className = '';
      document.getElementById('insTabRaw').className = 'secondary';
      document.getElementById('insBody').replaceChildren(h('p', { class: 'empty' }, 'Loading history…'));
      rememberFocus('inspector');
      document.getElementById('inspectorOverlay').classList.add('open');
      try {
        // All matches, page by page: other records whose text mentions this id
        // also match the search, and a 200-row cut could hide this record's
        // older history.
        const found = await fetchAllActivity({ p_search: recordId, p_area: tableName }, 5000);
        INSPECTOR_HISTORY = found.rows.filter(h => h.record_id === recordId);
        if (!INSPECTOR_HISTORY.length) {
          document.getElementById('insBody').innerHTML =
            '<p class="empty">No recorded history for this record yet.</p>' +
            '<div class="insNote">Either nothing has changed since activity recording was switched on, or this area isn\'t recorded.</div>';
          return;
        }
        renderInspector();
      } catch (err) {
        document.getElementById('insBody').innerHTML =
          '<p class="empty">' + esc(explainDbError('Could not load this record\'s history: ' + (err && err.message ? err.message : String(err)))) + '</p>';
      }
    }
    async function openInspector(row){
      if (!row) return;
      await openInspectorFor(row.table_name, row.record_id, recordTitle(row));
    }
    let INSPECT_TARGET = null;
    function setInspectTarget(t){
      if (INSPECT_TARGET && INSPECT_TARGET.el) INSPECT_TARGET.el.classList.remove('inspectHover');
      INSPECT_TARGET = t;
      const hint = document.getElementById('inspectHint');
      if (t && t.el) {
        t.el.classList.add('inspectHover');
        hint.classList.add('show');
      } else {
        hint.classList.remove('show');
      }
    }
    document.querySelector('main.contentArea').addEventListener('mouseover', (e) => {
      if (document.getElementById('inspectorOverlay').classList.contains('open')) return;
      const t = resolveInspectTarget(e.target);
      if (!t) { if (INSPECT_TARGET) setInspectTarget(null); return; }
      if (INSPECT_TARGET && INSPECT_TARGET.el === t.el) return;
      setInspectTarget(t);
    });
    document.querySelector('main.contentArea').addEventListener('mouseleave', () => setInspectTarget(null));

    // A phone has no hover and no Space key, so a tap opens the record instead.
    // Taps on anything interactive are left alone so buttons still behave.
    if (window.matchMedia('(hover: none)').matches) {
      document.querySelector('main.contentArea').addEventListener('click', (e) => {
        // .poRow: tapping a purchase order already opens its details.
        if (e.target.closest('button, a, input, select, textarea, label, .calNoteBox, .poRow')) return;
        if (anyOverlayOpen()) return;
        const t = resolveInspectTarget(e.target);
        if (!t) return;
        openInspectorFor(t.table, t.id, t.label);
      });
    }
    function closeInspector(){
      document.getElementById('inspectorOverlay').classList.remove('open');
      restoreFocus('inspector');
      document.getElementById('inspectHint').classList.remove('show');
      if (typeof INSPECT_TARGET !== 'undefined' && INSPECT_TARGET && INSPECT_TARGET.el) {
        INSPECT_TARGET.el.classList.remove('inspectHover');
        INSPECT_TARGET = null;
      }
    }
    // Exports EVERY change matching the current filters, not just the rows
    // loaded on screen so far (it used to export only those, silently).
    async function exportActivityCsv(){
      const exportBtn = document.getElementById('activityExportBtn');
      let all;
      try {
        if (exportBtn) exportBtn.disabled = true;
        all = await fetchAllActivity(activityFilters(), 20000);
      } catch (err) {
        showDashError('Could not export Employee Activity: ' + (err && err.message ? err.message : err));
        return;
      } finally {
        if (exportBtn) exportBtn.disabled = false;
      }
      const exportRows = all.rows;
      if (!exportRows.length) { showDashError('Nothing to export — no changes match these filters.'); return; }
      if (all.capped) showDashError('The export holds the newest 20,000 changes only. Narrow the date range or filters to export older ones.');
      const head = ['When','Person','Account number','Role','Area','Action','Record','What changed'];
      const lines = [head].concat(exportRows.map(r => [
        fmtDate(r.happened_at),
        r.person_name,
        r.person_account_number || '',
        r.person_role || 'system',
        ACTIVITY_AREA_LABELS[r.table_name] || r.area,
        r.action_label,
        recordTitle(r),
        plainChange(r),
      ]));
      const csv = lines.map(l => l.map(csvCell).join(',')).join('\r\n');
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'employee-activity-' + localDateString() + '.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    document.getElementById('activitySearchBtn').addEventListener('click', () => loadActivity(true));
    document.getElementById('activitySearch').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); loadActivity(true); }
    });
    document.getElementById('activityClearBtn').addEventListener('click', () => {
      document.getElementById('activitySearch').value = '';
      document.getElementById('activityRange').value = 'all';
      document.getElementById('activityArea').value = '';
      ACTIVITY_PERSON = null;
      document.querySelectorAll('#activityPeople .personChip').forEach(c => {
        c.classList.toggle('active', !c.getAttribute('data-person'));
      });
      loadActivity(true);
    });
    document.getElementById('activityRange').addEventListener('change', () => loadActivity(true));
    document.getElementById('activityArea').addEventListener('change', () => loadActivity(true));
    document.getElementById('activityExportBtn').addEventListener('click', exportActivityCsv);
    document.getElementById('activityMoreBtn').addEventListener('click', () => loadActivity(false));
    document.getElementById('insCloseBtn').addEventListener('click', closeInspector);
    document.getElementById('inspectorOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'inspectorOverlay') closeInspector();
    });
    document.getElementById('insTabHistory').addEventListener('click', () => {
      INSPECTOR_TAB = 'history';
      document.getElementById('insTabHistory').className = '';
      document.getElementById('insTabRaw').className = 'secondary';
      renderInspector();
    });
    document.getElementById('insTabRaw').addEventListener('click', () => {
      INSPECTOR_TAB = 'raw';
      document.getElementById('insTabRaw').className = '';
      document.getElementById('insTabHistory').className = 'secondary';
      renderInspector();
    });
    // Space bar opens the inspector for whichever entry the mouse is over —
    // same gesture as Quick Look in Finder. Escape closes it.
    document.addEventListener('keydown', (e) => {
      const overlayOpen = document.getElementById('inspectorOverlay').classList.contains('open');
      if (e.key === 'Escape' && overlayOpen) { closeInspector(); return; }
      if (e.code !== 'Space' && e.key !== ' ') return;
      if (overlayOpen) return;
      const tag = (e.target && e.target.tagName ? e.target.tagName : '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button') return;
      // On the Employee Activity page the hovered entry already knows its own
      // record; everywhere else we work it out from the row under the mouse.
      if (currentPageId === 'activityPanel' && ACTIVITY_HOVERED >= 0 && ACTIVITY_ROWS[ACTIVITY_HOVERED]) {
        e.preventDefault();
        openInspector(ACTIVITY_ROWS[ACTIVITY_HOVERED]);
        return;
      }
      if (!INSPECT_TARGET) return;
      e.preventDefault();
      openInspectorFor(INSPECT_TARGET.table, INSPECT_TARGET.id, INSPECT_TARGET.label);
    });

    function renderAttention(rows){
      if (!rows || !rows.length) {
        document.getElementById('attentionWrap').replaceChildren(h('p', { class: 'empty' }, 'Nothing needs your attention right now.'));
        return;
      }
      // EXT20J: built as DOM nodes (h() text-ifies) instead of an HTML string, so
      // the Home "Needs your attention" list is safe under Trusted Types. Values
      // were already esc()-ed. Classes and data-* attributes are unchanged, so the
      // Dismiss wiring (data-dismiss-id) works as before.
      document.getElementById('attentionWrap').replaceChildren(...rows.map(r =>
        h('div', { class: 'attentionRow', 'data-id': r.source_id },
          h('span', { class: 'badge' }, ITEM_TYPE_LABELS[r.item_type] || r.item_type),
          h('div', { class: 'info' },
            h('div', { class: 'aTitle' }, r.title),
            ...(r.detail ? [h('div', { class: 'aDetail' }, r.detail)] : [])),
          h('span', { class: 'aWhen' }, fmtDate(r.due_at)),
          h('span', { class: 'priorityPill ' + (r.priority === 'high' ? 'high' : 'normal') }, r.priority || 'normal'),
          r.item_type === 'manual'
            ? h('button', { class: 'small dismissBtn', 'data-dismiss-id': r.source_id }, 'Dismiss')
            : h('span'))));

      document.querySelectorAll('[data-dismiss-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-dismiss-id');
          btn.disabled = true;
          try {
            const { data: changed, error } = await supabase.from('manual_attention_items').update({ dismissed: true }).eq('id', id).select('id');
            if (error) throw error;
            if (noRowsChanged(changed)) showDashError(staleMessage('That reminder'));
            loadAttention();
          } catch (err) {
            btn.disabled = false;
            showDashError('Could not dismiss that reminder: ' + (err && err.message ? err.message : err));
          }
        });
      });
    }

    async function loadAttention(){
      try {
        const { data, error, count: capCount } = await supabase
          .from('needs_attention')
          .select('*', { count: 'exact' })
          .order('due_at', { ascending: true, nullsFirst: false });
        if (error) throw error;
        showPageWarning('attentionPanel', typeof capCount === 'number' && capCount > (data || []).length ? 'Showing the first ' + (data || []).length + ' of ' + capCount + ' items needing attention: the rest are not listed on this page.' : null);
        SEARCH_INDEX.attention = data;
        renderAttention(data);
      } catch (err) {
        showDashError('Could not load your attention list: ' + (err && err.message ? err.message : err));
      }
    }
    let ATTN_SHOW_HIDDEN = false;
    async function loadAttentionChecks(){
      const wrap = document.getElementById('attnChecksWrap');
      if (!wrap) return;
      const settle = p => Promise.resolve(p).then(v => {
        if (v && v.error) throw v.error;
        return { ok: true, rows: Array.isArray(v) ? v : (v && v.data) || [] };
      }).catch(e => ({ ok: false, error: e }));
      const allManualWithoutItems = async () => manualOrdersWithoutItems(
        await fetchAllRows('orders', 'id, order_number, total, currency, status, placed_at, source', q => q.eq('source', 'manual').is('deleted_at', null)));
      const [inventory, receivedPOs, openPOs, poExpenses, openTasks, pendingApprovals, openIncidents, waitingQuestions, openReturns, ordersWithoutItems, services, orderSyncFlag, products] = await Promise.all([
        settle(fetchAllRows('inventory', 'id, product_id, available, reserved, damaged, sample, wholesale, promotional, returned, recalled, low_stock_threshold', q => q)),
        settle(fetchAllRows('purchase_orders', 'id, po_number, status, purchase_order_items(product_id, quantity, quantity_received)', q => q.eq('status', 'received'))),
        settle(fetchAllRows('purchase_orders', 'id, po_number, status, expected_at', q => q.in('status', ['ordered', 'shipped']))),
        settle(fetchAllRows('expenses', 'id, note', q => q.is('deleted_at', null).like('note', 'Purchase order %'))),
        settle(fetchAllRows('tasks', 'id, status, due_at', q => q.not('status', 'in', CLOSED_IN))),
        settle(fetchAllRows('approval_requests', 'id, status, created_at', q => q.not('status', 'in', CLOSED_IN))),
        settle(fetchAllRows('incidents', 'id, severity, status, created_at', q => q.or('status.is.null,status.not.in.' + CLOSED_IN))),
        settle(fetchAllRows('customer_inquiries', 'id, status, created_at', q => q.in('status', ['needs_review', 'new']))),
        settle(fetchAllRows('returns', 'id, status, created_at', q => q.in('status', ['requested', 'approved', 'received']))),
        settle(allManualWithoutItems()),
        settle(supabase.from('service_status').select('id, status')),
        settle(supabase.from('feature_flags').select('flag_key, enabled').eq('flag_key', 'shopify_order_sync')),
        settle(fetchAllRows('products', 'id, is_active', q => q.eq('is_active', false))),
        loadAgentControls().catch(() => {}),
      ]);
      // Agent switches come from the AI Agent Activity loader (Business Health runs it).
      // Agents off on purpose until launch (#2/#3/#7/#8) are not listed as "paused".
      const agentsPaused = agentControls().state === 'ok'
        ? { ok: true, rows: AGENT_REGISTRY.filter(a => !a.intendedOff && agentControls().byNum[a.num] && agentControls().byNum[a.num].enabled === false) }
        : { ok: false, error: 'switches could not be read' };
      // EXT10b (missions 7-10): the same honest state as the AI Agents page.
      const truths = AGENT_REGISTRY.map(a => ({ a, t: agentTruth(a, agentControls().byNum[a.num]) }));
      const agentsUnhealthy = agentControls().state === 'ok'
        ? { ok: true, rows: truths.filter(x => x.t.key === 'failed' || x.t.key === 'stale').map(x => ({ num: x.a.num, state: x.t.key })) }
        : { ok: false, error: 'switches could not be read' };
      const agentsUnknown = agentControls().state === 'ok'
        ? { ok: true, rows: truths.filter(x => x.t.key === 'unknown').map(x => ({ num: x.a.num })) }
        : { ok: false, error: 'switches could not be read' };
      ATTN_FINDINGS = attentionFindings({ inventory, receivedPOs, openPOs, poExpenses, openTasks, pendingApprovals, openIncidents,
        waitingQuestions, openReturns, ordersWithoutItems, services, orderSyncFlag, agentsPaused, agentsUnhealthy, agentsUnknown, products }, Date.now());
      ATTN_CHECKED_AT = Date.now();
      renderAttentionChecks();
    }
    let ATTN_FINDINGS = [];
    // EXT9: when the checks last ran. Results older than ATTN_STALE_MS say so
    // plainly (never look current), and re-run when the tab is looked at again.
    let ATTN_CHECKED_AT = null;
    function attnFreshnessNodes(){
      if (!ATTN_CHECKED_AT) return [];
      const age = Date.now() - ATTN_CHECKED_AT;
      const at = new Date(ATTN_CHECKED_AT).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      const mins = Math.round(age / 60000);
      return age > ATTN_STALE_MS
        ? [h('p', { class: 'hint attnFresh attnStale', role: 'status' }, `These results are from ${at} (${mins} minutes ago) and may be out of date. `, h('button', { type: 'button', class: 'small', id: 'attnRecheck' }, 'Check again'))]
        : [h('p', { class: 'hint attnFresh' }, `Checked at ${at}. `, h('button', { type: 'button', class: 'small secondary', id: 'attnRecheck' }, 'Check again'))];
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && ATTN_CHECKED_AT && Date.now() - ATTN_CHECKED_AT > ATTN_STALE_MS && currentPageId === 'attentionPanel') {
        safeRun(loadAttentionChecks);
      }
    });
    function renderAttentionChecks(){
      const wrap = document.getElementById('attnChecksWrap');
      if (!wrap) return;
      const seen = attnSeenGet();
      // Data problems, "could not check" and the backups line stay visible.
      const canHide = f => (f.level === 'action' || f.level === 'info') && f.key !== 'backups';
      const isHidden = f => canHide(f) && seen[f.key] === attnSignature(f);
      const shown = ATTN_FINDINGS.filter(f => ATTN_SHOW_HIDDEN || !isHidden(f));
      const hiddenCount = ATTN_FINDINGS.length - ATTN_FINDINGS.filter(f => !isHidden(f)).length;
      const LEVEL = { critical: 'Data problem', unknown: 'Could not check', action: 'To do', info: 'Info' };
      // EXT20J: built as DOM nodes (h() text-ifies) instead of an HTML string, so
      // the Home data-problem / to-do checks are safe under Trusted Types. Each
      // finding's level class (attn-<level>) is unchanged, so a "Could not check"
      // (unknown) or "Data problem" row keeps its own (never-green) styling.
      const rowNodes = shown.map(f =>
        h('div', { class: 'approvalRow attnCheck attn-' + f.level, 'data-key': f.key },
          h('div', { class: 'info' },
            h('span', { class: 'badge attnLevel' }, LEVEL[f.level]), ' ',
            h('b', null, f.title + (f.count != null ? ': ' + String(f.count) : '')),
            ...(f.oldest ? [h('span', { class: 'attnAge' }, ' · oldest ' + timeAgo(f.oldest))] : []),
            ...(f.action ? [h('div', { class: 'attnAction' }, h('span', { class: 'attnActionLbl' }, 'Next step:'), ' ' + f.action)] : []),
            h('details', { class: 'attnWhy' }, h('summary', null, 'Why is this here?'), h('p', null, f.why))),
          h('div', { class: 'actions' },
            ...(f.page ? [h('button', { type: 'button', class: 'small attnOpen', 'data-goto': f.page }, 'Open')] : []),
            ...(canHide(f) ? [isHidden(f)
              ? h('button', { type: 'button', class: 'small secondary attnUnhide' }, 'Show again')
              : h('button', { type: 'button', class: 'small secondary attnHide', title: 'Hidden on this device until the number changes' }, 'Hide until it changes')] : []))));
      const nothing = !ATTN_FINDINGS.some(f => f.level !== 'info');
      const emptyNote = nothing ? [h('p', { class: 'empty u-m-0-0-8' }, 'No data problems or to-dos found by these checks.')] : [];
      const hiddenNote = hiddenCount ? [h('p', { class: 'hint u-m-8-0-0' }, hiddenCount + ' hidden until they change. ',
        h('button', { type: 'button', class: 'small secondary', id: 'attnToggleHidden' }, ATTN_SHOW_HIDDEN ? 'Hide them' : 'Show them'))] : [];
      wrap.replaceChildren(...emptyNote, ...rowNodes, ...hiddenNote, ...attnFreshnessNodes());
      const recheck = document.getElementById('attnRecheck');
      if (recheck) recheck.addEventListener('click', () => { recheck.disabled = true; safeRun(loadAttentionChecks); });
      wrap.querySelectorAll('.attnOpen').forEach(b => b.addEventListener('click', () => showPage(b.getAttribute('data-goto'))));
      wrap.querySelectorAll('.attnHide, .attnUnhide').forEach(b => b.addEventListener('click', () => {
        const key = b.closest('.attnCheck').getAttribute('data-key');
        const f = ATTN_FINDINGS.find(x => x.key === key);
        const v = attnSeenGet();
        if (b.classList.contains('attnHide')) v[key] = attnSignature(f); else delete v[key];
        attnSeenSet(v);
        renderAttentionChecks();
      }));
      const t = document.getElementById('attnToggleHidden');
      if (t) t.addEventListener('click', () => { ATTN_SHOW_HIDDEN = !ATTN_SHOW_HIDDEN; renderAttentionChecks(); });
    }
    async function loadNightlyCheck(){
      const wrap = document.getElementById('nightlyCheckWrap');
      if (!wrap) return;
      const isLatest = newLoadToken('nightly');
      const LEVEL_CLASS = { PASS: 'attn-info', WARN: 'attn-action', FAIL: 'attn-critical', UNKNOWN: 'attn-unknown', STALE: 'attn-unknown', 'NOT VERIFIED': 'attn-info' };
      // EXT20J: built as DOM nodes (h() text-ifies) instead of an HTML string, so
      // this evidence card is safe under Trusted Types. The level class/data-state
      // are unchanged, so an UNKNOWN / NOT VERIFIED / STALE result still carries its
      // own (never-green) styling — missing evidence can never read as PASS.
      const card = (level, title, body) => h('div',
        { class: `approvalRow attnCheck nightlyCard ${LEVEL_CLASS[level]}`, 'data-state': level },
        h('div', { class: 'info' },
          h('span', { class: 'badge attnLevel' }, level), ' ',
          h('b', null, title),
          ...(body ? (Array.isArray(body) ? body : [body]) : [])));
      const hint = text => h('p', { class: 'hint' }, text);
      try {
        const { data: flag, error: flagErr } = await supabase.from('feature_flags').select('enabled').eq('flag_key', 'integrity_results_home').maybeSingle();
        if (!isLatest()) return;
        if (flagErr) { wrap.replaceChildren(card('UNKNOWN', 'Could not check whether the nightly check is set up', hint(explainDbError(flagErr.message || String(flagErr))))); return; }
        if (flag && flag.enabled === true && !['owner', 'administrator'].includes(currentUserRole)) {
          // The read rule (drafts/29) shows these results to owner/admin only;
          // an empty answer here would wrongly read as "has not run yet".
          wrap.replaceChildren(card('NOT VERIFIED', 'Only the owner and administrators can see the nightly check', null));
          return;
        }
        if (!flag || flag.enabled !== true) {
          wrap.replaceChildren(card('NOT VERIFIED', 'Not set up yet', hint('The nightly check is not installed, or its Home switch ("Nightly integrity check on Home") is off. Until it is, nothing here means "fine": run the daily check by hand (Query F, docs/ops/PRODUCTION_READONLY_VERIFICATION_EXT10.md).')));
          return;
        }
        const [att, okRun] = await Promise.all([
          supabase.from('integrity_check_runs').select('id, started_at, finished_at, status, checks, error').order('started_at', { ascending: false }).limit(1),
          supabase.from('integrity_check_runs').select('id, started_at, finished_at, status, checks').eq('status', 'ok').order('started_at', { ascending: false }).limit(1),
        ]);
        if (!isLatest()) return;
        const readErr = att.error || okRun.error;
        if (readErr) {
          wrap.replaceChildren(isMissingRelation(readErr)
            ? card('NOT VERIFIED', 'Switched on, but the nightly check is not installed', hint('Turn the Home switch off, or install drafts/25 and drafts/29 first (docs/ops/PRODUCTION_CHANGE_PACKAGE_EXT10.md).'))
            : card('UNKNOWN', 'Could not read the nightly check', hint(explainDbError(readErr.message || String(readErr)))));
          return;
        }
        const lastAttempt = (att.data || [])[0] || null;
        const lastOk = (okRun.data || [])[0] || null;
        let results = [];
        if (lastOk) {
          const { data: rows, error: resErr } = await supabase.from('integrity_check_results').select('section, check_name, found, examples').eq('run_id', lastOk.id).order('section', { ascending: true }).limit(200);
          if (!isLatest()) return;
          if (resErr) { wrap.replaceChildren(card('UNKNOWN', 'Could not read the nightly check results', hint(explainDbError(resErr.message || String(resErr))))); return; }
          results = rows || [];
        }
        const now = Date.now();
        const overall = nightlyOverall(lastAttempt, lastOk, results, now, NIGHTLY_STALE_MS);
        const when = r => r ? `${fmtDate(r.started_at)} (${timeAgo(r.started_at)})` : 'never';
        const fresh = h('p', { class: 'hint nightlyFresh' }, `Last success: ${when(lastOk)} · Last attempt: ${when(lastAttempt)}${lastAttempt ? ' — ' + (lastAttempt.status === 'ok' ? 'worked' : lastAttempt.status === 'failed' ? 'FAILED' : 'still running') : ''} · Counts as out of date after ${Math.round(NIGHTLY_STALE_MS / 3600000)} hours.`);
        const counts = { PASS: 0, WARN: 0, FAIL: 0, UNKNOWN: 0 };
        results.forEach(r => { counts[nightlyCheckLevel(r)]++; });
        const TITLES = {
          PASS: 'All ' + results.length + ' checks passed',
          WARN: counts.WARN + ' check' + (counts.WARN === 1 ? '' : 's') + ' found something to look at',
          FAIL: lastAttempt && lastAttempt.status === 'failed' ? 'Last night\'s run FAILED' : counts.FAIL + ' check' + (counts.FAIL === 1 ? '' : 's') + ' found data that cannot be right',
          STALE: 'Out of date: the last successful run is too old',
          UNKNOWN: 'Some results could not be read',
          'NOT VERIFIED': lastAttempt ? 'Installed, first run still in progress' : 'Installed, but it has not run yet',
        };
        const failNote = lastAttempt && lastAttempt.status === 'failed'
          ? h('p', { class: 'hint' }, `The run at ${fmtDate(lastAttempt.started_at)} stopped with: ${lastAttempt.error || 'no error text'}. ${lastOk ? 'The results below are from the last run that worked.' : 'No run has worked yet.'}`) : null;
        const list = results.length ? h('details', { class: 'nightlyDetails', open: (overall === 'FAIL' || overall === 'WARN') || undefined },
          h('summary', null, `Each check (${counts.PASS} pass · ${counts.WARN} warning · ${counts.FAIL} problem${counts.UNKNOWN ? ' · ' + counts.UNKNOWN + ' unreadable' : ''})`),
          h('ul', { class: 'nightlyList' }, ...results.map(r => {
            const lv = nightlyCheckLevel(r);
            const code = String(r.section || '').slice(0, 3);
            const pg = NIGHTLY_PAGES[code];
            return h('li', { class: 'nightlyItem', 'data-level': lv, 'data-section': code },
              h('span', { class: 'badge' }, lv), ' ' + r.check_name + ': ', h('b', null, String(r.found)),
              ...(r.examples && Number(r.found) > 0 ? [h('div', { class: 'hint' }, 'For example: ' + String(r.examples).slice(0, 300))] : []),
              ...(pg && Number(r.found) > 0 ? [' ', h('button', { type: 'button', class: 'small secondary nightlyOpen', 'data-goto': pg }, 'Open')] : []));
          }))) : null;
        wrap.replaceChildren(card(overall, TITLES[overall], [failNote, fresh, list]));
        wrap.querySelectorAll('.nightlyOpen').forEach(b => b.addEventListener('click', () => showPage(b.getAttribute('data-goto'))));
      } catch (err) {
        if (!isLatest()) return;
        wrap.replaceChildren(card('UNKNOWN', 'Could not read the nightly check', hint(explainDbError(err && err.message ? err.message : String(err)))));
      }
    }
    let SYS_STATUS = null;
    let LAST_DB_STEPS = null;
    async function loadSystemStatus(){
      const wrap = document.getElementById('systemStatusWrap');
      if (!wrap) return;
      const isLatest = newLoadToken('sysstatus');
      const t0 = performance.now();
      let db;
      try {
        const { error } = await supabase.from('feature_flags').select('flag_key').limit(1);
        db = error ? { ok: false, text: 'Could not read: ' + errorKind(explainDbError(error.message || String(error))) } : { ok: true, text: 'Reading works (' + Math.round(performance.now() - t0) + ' ms just now)' };
      } catch (e) { db = { ok: false, text: 'Could not read: ' + errorKind(e && e.message) }; }
      if (!isLatest()) return;
      const counts = Object.create(null);
      if (agentControls().state === 'ok') AGENT_REGISTRY.forEach(a => { const t = agentTruth(a, agentControls().byNum[a.num]).label; counts[t] = (counts[t] || 0) + 1; });
      const agents = agentControls().state === 'ok' ? Object.entries(counts).map(([k, v]) => v + ' ' + k).join(' · ') : 'UNKNOWN (agent switches could not be read)';
      // The probes run only while this page is open (or on Check again / Copy),
      // never in the background load at sign-in: 7 requests nobody looks at.
      const dbSteps = currentPageId === 'continuityPanel'
        ? (LAST_DB_STEPS = await dbStepsStatus())
        : (LAST_DB_STEPS || { steps: 'not checked yet (open this page or press Check again)', safety: 'not checked yet' });
      if (!isLatest()) return;
      const nightlyEl = document.querySelector('#nightlyCheckWrap .nightlyCard');
      const nightly = nightlyEl ? nightlyEl.getAttribute('data-state') : 'NOT VERIFIED (open Home first)';
      const env = environmentLabel();
      SYS_STATUS = {
        env, db, agents, nightly,
        rows: [
          ['Environment', env.text],
          ['Database', db.ok ? db.text : db.text + ' — UNKNOWN whether data is current'],
          // EXT14 (diagnostics fuzz): only a known role word is copied; any other
          // value (it comes from the database) could carry text from a record.
          ['Signed-in role', !currentUserRole ? 'UNKNOWN' : Object.prototype.hasOwnProperty.call(ROLE_LABELS, currentUserRole) ? currentUserRole : 'other (not a standard role)'],
          ['Nightly integrity check', nightly],
          ['Backups', 'UNKNOWN — the dashboard cannot see the backup jobs (owner check V1)'],
          ['Agents', agents],
          ['Database steps (read-only check)', dbSteps.steps],
          ['Switch safety', dbSteps.safety],
          ['Page version', assetVersions()],
          ['Last error on screen', LAST_ERROR_KIND ? LAST_ERROR_KIND + ' at ' + LAST_ERROR_AT.toLocaleTimeString() : 'none since this page opened'],
        ],
      };
      // EXT20J: built as DOM nodes instead of an HTML string (safe under Trusted
      // Types). Keys and values were already esc()-ed; now they are text nodes.
      wrap.replaceChildren(h('table', { class: 'sysStatus' },
        h('tbody', null, ...SYS_STATUS.rows.map(([k, v]) =>
          h('tr', null, h('th', { scope: 'row' }, k), h('td', null, v))))));
    }
    function diagnosticSummary(){
      const s = SYS_STATUS || { rows: [] };
      return ['Health Endeavors dashboard — diagnostic summary',
        'Time: ' + new Date().toISOString(),
        'Page open: ' + (currentPageId || 'unknown'),
        ...s.rows.map(([k, v]) => k + ': ' + v),
        'Browser: ' + navigator.userAgent.replace(/\s+/g, ' ').slice(0, 160),
        '(No names, e-mails, record contents, keys or tokens are included.)'].join('\n');
    }
    document.getElementById('sysStatusRefresh').addEventListener('click', () => safeRun(loadSystemStatus));
    document.getElementById('copyDiagBtn').addEventListener('click', async () => {
      await safeRun(loadSystemStatus);
      const text = diagnosticSummary();
      const pre = document.getElementById('diagText');
      pre.textContent = text; pre.style.display = 'block';
      try { await navigator.clipboard.writeText(text); toastOk('Diagnostic summary copied. It is also shown below.'); }
      catch (e) { toast('Could not copy automatically: select the text below and copy it.'); }
    });

    async function loadBusinessHealth(){
      const wrap = document.getElementById('businessHealthStats');
      try {
        const { start } = getTodayRange();
        const startIso = start.toISOString();
        const AI_SPEND_CAP = 30; // matches the cap shown on the AI Agent Activity page
        const startOfMonth = new Date();
        startOfMonth.setUTCDate(1);
        startOfMonth.setUTCHours(0, 0, 0, 0);

        // Counted from every row, read a page at a time (fetchAllRows): a
        // month of AI decision logs or years of approvals easily passes the
        // 1,000 rows one request can return, and the tiles would undercount.
        // EXT7: each read settles on its own. One failed read used to blank
        // the whole panel ("Could not load Business Health"); now only its
        // own tile shows "?" (unknown, not zero) and the rest still show.
        const settle = p => Promise.resolve(p).then(v => {
          if (v && v.error) throw v.error;
          return { ok: true, v };
        }).catch(e => ({ ok: false, e }));
        const [
          ordersR, approvalsR, tasksR, incidentsR, monthAiR, sessionsR,
        ] = await Promise.all([
          settle(fetchAllRows('orders', 'id, total, currency, status, deleted_at, placed_at', q => q.gte('placed_at', startIso))),
          settle(fetchAllRows('approval_requests', 'id, status', q => q)),
          settle(fetchAllRows('tasks', 'id, status, due_at', q => q)),
          settle(fetchAllRows('incidents', 'id, severity, status', q => q)),
          settle(fetchAllRows('ai_decision_log', 'id, cost_usd', q => q.gte('created_at', startOfMonth.toISOString()))),
          settle(supabase.rpc('list_my_sessions')),
          loadAgentControls(), // populates agentControls().byNum + AGENT_REGISTRY's paused count, also refreshes the paused-agents banner
        ]);
        const failed = [ordersR, approvalsR, tasksR, incidentsR, monthAiR, sessionsR].filter(r => !r.ok);
        if (failed.length) {
          showDashError('Some Business Health figures could not be read and show "?": ' + explainDbError((failed[0].e && failed[0].e.message) || String(failed[0].e)));
        }

        let todayRevenue = null, todayCurrency = 'USD', todayOrderCount = null, todayMissingTotals = 0;
        if (ordersR.ok) {
          const todayOrders = (ordersR.v || []).filter(o => !o.deleted_at);
          // EXT6: the same revenue rule as Accounting (it excluded only the exact
          // word "cancelled", so "Canceled" and refunded orders were counted).
          const revenueOrders = todayOrders.filter(o => {
            const c = classifyOrderStatus(o.status);
            return !(c.isCancelled || (c.isRefund && !c.isPartialRefund));
          });
          todayRevenue = revenueOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
          todayMissingTotals = missingTotalCount(revenueOrders);
          todayCurrency = (todayOrders[0] && todayOrders[0].currency) || 'USD';
          todayOrderCount = todayOrders.length;
        }

        const pendingApprovals = approvalsR.ok ? (approvalsR.v || []).filter(r => !isClosedStatus(r.status)).length : null;
        const overdueTasks = tasksR.ok ? (tasksR.v || []).filter(t => isOverdue(t.due_at, t.status)).length : null;
        const criticalIncidents = incidentsR.ok ? (incidentsR.v || []).filter(i =>
          !isClosedStatus(i.status) && ['high', 'critical'].includes(String(i.severity || '').toLowerCase())
        ).length : null;

        const pausedAgents = AGENT_REGISTRY.filter(a =>
          agentControls().byNum[a.num] && agentControls().byNum[a.num].enabled === false
        ).length;

        const monthAiSpend = monthAiR.ok ? (monthAiR.v || []).reduce((sum, l) => sum + Number(l.cost_usd || 0), 0) : null;
        const activeSessions = sessionsR.ok ? ((sessionsR.v && sessionsR.v.data) || []).length : null;

        // Tiles get a color only when there's actually something to look at —
        // a healthy or neutral number stays plain, matching the severity
        // colors already used for badges and incidents elsewhere. Unknown
        // ("?") is always amber: it needs a look, and it is not zero.
        const approvalsClass = pendingApprovals > 0 ? 'statWarn' : '';
        const tasksClass = overdueTasks > 0 ? 'statCritical' : '';
        const incidentsClass = criticalIncidents > 0 ? 'statCritical' : '';
        const agentsClass = pausedAgents > 0 ? 'statWarn' : '';
        const aiClass = monthAiSpend === null ? '' : monthAiSpend >= AI_SPEND_CAP ? 'statCritical'
          : (monthAiSpend >= AI_SPEND_CAP * 0.8 ? 'statWarn' : '');

        // goto: tiles about work open the page where it is done (EXT7).
        const tile = (num, lbl, cls, goto) => {
          if (num === null) return `<div class="stat statWarn statUnknown"><div class="num">?</div><div class="lbl">${esc(lbl)} (could not be read)</div></div>`;
          const inner = `<div class="num">${num}</div><div class="lbl">${esc(lbl)}</div>`;
          return goto
            ? `<button type="button" class="stat statLink ${cls}" data-goto="${esc(goto)}" aria-label="${esc(lbl)}: ${esc(String(num).replace(/<[^<>]*>/g, ''))}. Open that page.">${inner}</button>`
            : `<div class="stat ${cls}">${inner}</div>`;
        };

        wrap.innerHTML = [
          tile(todayRevenue === null ? null : esc(fmtMoney(todayRevenue, todayCurrency)), todayMissingTotals ? "Today's revenue (" + todayMissingTotals + ' order' + (todayMissingTotals === 1 ? '' : 's') + ' without a total not counted)' : "Today's revenue", todayMissingTotals ? 'statWarn' : ''),
          tile(todayOrderCount, "Today's orders", ''),
          tile(pendingApprovals, 'Pending approvals', approvalsClass, 'approvalsPanel'),
          tile(overdueTasks, 'Overdue tasks', tasksClass, 'tasksPanel'),
          tile(criticalIncidents, 'Open high/critical incidents', incidentsClass, 'incidentsPanel'),
          // Unknown is not zero: if the switches couldn't be read, say so.
          agentControls().state === 'ok' ? tile(pausedAgents, 'Paused agents', agentsClass) : tile('?', 'Paused agents (switches could not be read)', 'statWarn'),
          tile(monthAiSpend === null ? null : esc(fmtMoney(monthAiSpend, 'USD')) + ' / ' + esc(fmtMoney(AI_SPEND_CAP, 'USD')), 'AI spend this month', aiClass),
          tile(activeSessions, 'Active sessions', ''),
        ].join('');
        wrap.querySelectorAll('.statLink').forEach(btn => btn.addEventListener('click', () => showPage(btn.getAttribute('data-goto'))));
      } catch (err) {
        wrap.replaceChildren(h('p', { class: 'empty' }, 'Could not load Business Health.'));
        showDashError('Could not load Business Health: ' + (err && err.message ? err.message : err));
      }
    }

    document.getElementById('addReminderForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const titleInput = document.getElementById('reminderTitle');
      const dueInput = document.getElementById('reminderDue');
      const priorityInput = document.getElementById('reminderPriority');
      const title = titleInput.value.trim();
      if (!title) return;
      // One save at a time: a double click or a second Enter must not add the
      // reminder twice.
      const btn = e.target.querySelector('button[type=submit]');
      if (btn && btn.disabled) return;
      if (btn) btn.disabled = true;
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const uid = sessionData && sessionData.session ? sessionData.session.user.id : null;
        const { error } = await insertOnce(e.target, 'manual_attention_items', {
          title,
          due_at: dueInput.value ? new Date(dueInput.value).toISOString() : null,
          priority: priorityInput.value,
          created_by: uid,
        }, 'That reminder');
        if (error) throw error;
        titleInput.value = '';
        dueInput.value = '';
        priorityInput.value = 'normal';
        loadAttention();
      } catch (err) {
        showDashError('Could not add that reminder: ' + (err && err.message ? err.message : err));
      } finally { if (btn) btn.disabled = false; }
    });
    function applyCalendarMode(){
      calMode = (currentUserRole === 'owner') ? 'apple' : 'personal';
      const form = document.getElementById('addPersonalEventForm');
      const hint = document.getElementById('calHintText');
      const filtersBox = document.getElementById('calFilters');
      const personal = calMode === 'personal';
      if (form) form.style.display = personal ? 'block' : 'none';
      if (hint) hint.textContent = personal ? PERSONAL_CAL_HINT : APPLE_CAL_HINT;
      if (filtersBox) filtersBox.style.display = personal ? 'none' : '';
    }
    let navSuppress = false;
    const _showPage = showPage;
    showPage = function(pageId){
      if (!navSuppress && currentPageId && currentPageId !== pageId) {
        NAV_BACK.push(currentPageId);
        NAV_FWD.length = 0;
        if (NAV_BACK.length > 50) NAV_BACK.shift();
      }
      _showPage(pageId);
    };
    function navBack(){
      if (!NAV_BACK.length) return;
      const to = NAV_BACK.pop();
      NAV_FWD.push(currentPageId);
      navSuppress = true; _showPage(to); navSuppress = false;
    }
    function navForward(){
      if (!NAV_FWD.length) return;
      const to = NAV_FWD.pop();
      NAV_BACK.push(currentPageId);
      navSuppress = true; _showPage(to); navSuppress = false;
    }

    // ---- j / k through rows, Return to inspect ----
    let rowCursorEl = null;
    function moveRowCursor(dir){
      const rows = rowsOnPage();
      if (!rows.length) return;
      let i = rowCursorEl ? rows.indexOf(rowCursorEl) : -1;
      i = (i === -1) ? (dir > 0 ? 0 : rows.length - 1) : Math.min(rows.length - 1, Math.max(0, i + dir));
      if (rowCursorEl) rowCursorEl.classList.remove('rowCursor');
      rowCursorEl = rows[i];
      rowCursorEl.classList.add('rowCursor');
      rowCursorEl.scrollIntoView({ block: 'nearest', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
      const t = resolveInspectTarget(rowCursorEl);
      if (t) setInspectTarget(t);
    }
    function openRowCursor(){
      if (!rowCursorEl) return;
      if (rowCursorEl.classList.contains('calEvent')) { rowCursorEl.click(); return; }
      if (rowCursorEl.classList.contains('actItem')) {
        const i = Number(rowCursorEl.getAttribute('data-index'));
        if (ACTIVITY_ROWS[i]) openInspector(ACTIVITY_ROWS[i]);
        return;
      }
      const t = resolveInspectTarget(rowCursorEl);
      if (t) openInspectorFor(t.table, t.id, t.label);
    }
    quickAdd.id = 'quickAddOverlay';
    quickAdd.setAttribute('role', 'dialog'); quickAdd.setAttribute('aria-modal', 'true'); quickAdd.setAttribute('aria-label', 'Quick add');
    quickAdd.innerHTML = '<div class="quickAddCard"><h4>New reminder</h4>' +
      '<input type="text" id="quickAddInput" placeholder="What do you need to remember?" autocomplete="off">' +
      '<div class="quickAddRow"><select id="quickAddPriority">' +
        '<option value="normal">Normal</option><option value="high">High</option></select>' +
      '<span class="grow"></span>' +
      '<button type="button" class="small secondary" id="quickAddCancel">Cancel</button>' +
      '<button type="button" class="small" id="quickAddSave">Add</button></div></div>';
    document.body.appendChild(quickAdd);
    async function saveQuickAdd(){
      const title = (document.getElementById('quickAddInput').value || '').trim();
      if (!title) { closeQuickAdd(); return; }
      const priority = document.getElementById('quickAddPriority').value;
      const btn = document.getElementById('quickAddSave');
      // Enter calls this directly, so the disabled button alone doesn't stop
      // a second Enter from adding the reminder twice.
      if (btn.disabled) return;
      btn.disabled = true;
      try {
        const uid = await currentUserId();
        const { error } = await insertOnce(btn, 'manual_attention_items', { title: title, priority: priority, created_by: uid }, 'That reminder');
        if (error) throw error;
        closeQuickAdd();
        toastOk('Reminder added.');
        safeRun(loadAttention).then(refreshChrome);
      } catch (err) {
        showDashError('Could not add that reminder: ' + (err && err.message ? err.message : err));
      } finally { btn.disabled = false; }
    }
    document.getElementById('quickAddSave').addEventListener('click', saveQuickAdd);
    document.getElementById('quickAddCancel').addEventListener('click', closeQuickAdd);
    document.getElementById('quickAddInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); saveQuickAdd(); }
      if (e.key === 'Escape') { e.preventDefault(); closeQuickAdd(); }
    });
    quickAdd.addEventListener('click', (e) => { if (e.target === quickAdd) closeQuickAdd(); });
    offlineBar.id = 'offlineBar';
    offlineBar.textContent = 'You are offline — showing the last data loaded.';
    document.body.appendChild(offlineBar);
    window.addEventListener('offline', () => offlineBar.classList.add('show'));
    window.addEventListener('online', () => {
      offlineBar.classList.remove('show');
      toastOk('Back online — refreshing.');
      loadDashboard();
    });
    if (!navigator.onLine) offlineBar.classList.add('show');

    // ---- Quiet background refresh ----
    // Keeps the numbers honest without you pressing anything. Skips the refresh
    // while you're typing, offline, or have something open.
    setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (!navigator.onLine) return;
      if (anyOverlayOpen() || quickAdd.classList.contains('open')) return;
      const a = document.activeElement;
      if (a && ['INPUT','TEXTAREA','SELECT'].includes(a.tagName)) return;
      const fns = PANEL_LOADERS[currentPageId] || [];
      Promise.all(fns.map(safeRun)).then(refreshChrome);
    }, 5 * 60 * 1000);
    ptr.id = 'ptrIndicator';
    ptr.replaceChildren(h('span', { class: 'u-pb-6' }, 'Release to refresh'));
    document.body.appendChild(ptr);
    (function(){
      const area = document.querySelector('main.contentArea');
      let startY = 0, startX = 0, pulling = false, dy = 0, dx = 0, swipeAllowed = true;
      // True when the finger started on something that scrolls sideways
      // itself (e.g. a wide table on a phone): that drag scrolls it, so it
      // must not also change the page.
      function startsInSideScroller(el){
        for (let n = el; n && n !== area; n = n.parentElement) {
          if (n.scrollWidth > n.clientWidth + 1) {
            const ox = getComputedStyle(n).overflowX;
            if (ox === 'auto' || ox === 'scroll') return true;
          }
        }
        return false;
      }
      area.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        startY = e.touches[0].clientY; startX = e.touches[0].clientX;
        pulling = area.scrollTop <= 0;
        swipeAllowed = !startsInSideScroller(e.target);
        dy = 0; dx = 0;
      }, { passive: true });
      area.addEventListener('touchmove', (e) => {
        if (e.touches.length !== 1) return;
        dy = e.touches[0].clientY - startY;
        dx = e.touches[0].clientX - startX;
        if (pulling && dy > 0 && Math.abs(dy) > Math.abs(dx)) {
          ptr.style.height = Math.min(64, dy * 0.45) + 'px';
        }
      }, { passive: true });
      area.addEventListener('touchend', () => {
        if (pulling && dy > 110) { toast('Refreshing…'); loadDashboard(); }
        ptr.style.height = '0px';
        // A clear sideways swipe moves to the next or previous page
        if (swipeAllowed && Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 2 && !anyOverlayOpen()) {
          const ids = allPageIds();
          const i = ids.indexOf(currentPageId);
          if (i !== -1) {
            const next = dx < 0 ? i + 1 : i - 1;
            if (next >= 0 && next < ids.length) showPage(ids[next]);
          }
        }
        pulling = false; dy = 0; dx = 0;
      }, { passive: true });
    })();

    // ---- The extra keys ----
    document.addEventListener('keydown', (e) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === '[') { e.preventDefault(); navBack(); return; }
      if (meta && e.key === ']') { e.preventDefault(); navForward(); return; }
      if (meta && (e.key === 'n' || e.key === 'N')) { e.preventDefault(); openQuickAdd(); return; }
      if (meta && e.key >= '1' && e.key <= '9') {
        const ids = allPageIds();
        const pinned = getPinnedPages();
        const list = pinned.length ? pinned : ids;
        const target = list[Number(e.key) - 1];
        if (target) { e.preventDefault(); showPage(target); }
        return;
      }
      if (e.key === 'Escape' && quickAdd.classList.contains('open')) { closeQuickAdd(); return; }

      const t = e.target;
      const tag = (t && t.tagName ? t.tagName : '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || meta || e.altKey) return;
      if (anyOverlayOpen() || quickAdd.classList.contains('open')) return;

      if (e.key === 'j') { e.preventDefault(); moveRowCursor(1); return; }
      if (e.key === 'k') { e.preventDefault(); moveRowCursor(-1); return; }
      if (e.key === 'Enter' && rowCursorEl) { e.preventDefault(); openRowCursor(); return; }
    });



    // ---- Adding products ----
    // Nothing else works without this: purchase orders stock products, returns
    // restock products, and inventory counts products. Until now the dashboard
    // could only read the catalogue, never add to it.
    document.getElementById('addProductForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type=submit]');
      const name = document.getElementById('prodName').value.trim();
      const sku = document.getElementById('prodSku').value.trim();
      if (!name) return;
      btn.disabled = true;
      try {
        const uid = await currentUserId();
        const num = (id) => {
          const v = document.getElementById(id).value;
          return v === '' ? null : Number(v);
        };
        // Same checks as editing a product (EXT4): the add form only had the
        // browser's own checks, with no upper limit.
        const priceProblem = numberInputError(numVal(document.getElementById('prodCost')), { label: 'Cost', allowBlank: true, max: 1000000, decimals: 4 })
          || numberInputError(numVal(document.getElementById('prodRetail')), { label: 'Retail price', allowBlank: true, max: 1000000, decimals: 2 })
          || numberInputError(numVal(document.getElementById('prodWholesale')), { label: 'Wholesale price', allowBlank: true, max: 1000000, decimals: 2 });
        if (priceProblem) { showDashError(priceProblem + ' Nothing was saved.'); return; }
        const rk = await formRequestKey(e.target);
        const { error: insErr } = await supabase.from('products').insert(withRequestKey({
          name: name,
          sku: sku || null,
          status: document.getElementById('prodStatus').value,
          cost: num('prodCost'),
          retail_price: num('prodRetail'),
          wholesale_price: num('prodWholesale'),
          packaging_info: document.getElementById('prodPackaging').value.trim() || null,
          created_by: uid,
        }, rk));
        const repeat = isRequestKeyRepeat(insErr);
        const error = repeat ? null : insErr;
        if (repeat) toast('That product' + REPEAT_NOTE);
        if (error) {
          // The unique index on sku is case-insensitive, so say so plainly
          if (String(error.message || '').includes('products_sku_unique')) {
            showDashError('A product already uses the SKU "' + sku + '". SKUs have to be unique, because returns and deliveries find products by them.');
            return;
          }
          throw error;
        }
        ['prodName','prodSku','prodCost','prodRetail','prodWholesale','prodPackaging']
          .forEach(id => document.getElementById(id).value = '');
        clearRequestKey(e.target);
        if (!repeat) toastOk('Product added.');
        loadInventory();
        safeRun(loadPurchaseOrders);
      } catch (err) {
        showDashError('Could not add that product: ' + (err && err.message ? err.message : err));
      } finally { btn.disabled = false; }
    });
    let PO_OPEN_ID = null;
    // EXT10b (missions 23/24/70): orders whose last receive attempt ended with
    // an unknown outcome. Their Receive button is replaced by a "status
    // unknown, do not receive again" notice with a read-only "Check this order
    // now" until a fresh read proves what happened (kept until reload, by design).
    // EXT16: was a plain { poId: true } flag; now the explicit operation state for receiving
    // (assets/app/he-ops.js): no second send in flight, none after a confirmed receipt, none
    // after an unknown result unless the database step refuses duplicates.
    const poReceiveOps = createOpTracker('PO receive');
    let PO_PRODUCTS = [];
    let PO_LOTS = Object.create(null);

    document.getElementById('addSupplierForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type=submit]');
      if (btn.disabled) return; // a second Enter while saving
      btn.disabled = true;
      try {
        const name = document.getElementById('supName').value.trim();
        // EXT7: adding a supplier can't be undone from here and a lost reply
        // invites a second press, so look for the same name first (any case).
        const { data: same, error: sameErr } = await supabase.from('suppliers').select('id').ilike('name', likeLiteral(name)).limit(1);
        if (sameErr) throw sameErr;
        if (same && same.length && !window.confirm('A supplier named "' + name + '" already exists (it may have been saved a moment ago). Add another one anyway?')) {
          loadSuppliers();
          return;
        }
        const uid = await currentUserId();
        const rk = await formRequestKey(e.target);
        const { error: insErr } = await supabase.from('suppliers').insert(withRequestKey({
          name,
          supplier_type: document.getElementById('supType').value,
          contact_name: document.getElementById('supContact').value.trim() || null,
          email: document.getElementById('supEmail').value.trim() || null,
          phone: document.getElementById('supPhone').value.trim() || null,
          notes: document.getElementById('supNotes').value.trim() || null,
          created_by: uid,
        }, rk));
        const repeat = isRequestKeyRepeat(insErr);
        if (insErr && !repeat) throw insErr;
        ['supName','supContact','supEmail','supPhone','supNotes'].forEach(id => document.getElementById(id).value = '');
        clearRequestKey(e.target);
        if (repeat) toast('That supplier' + REPEAT_NOTE); else toastOk('Supplier added.');
        loadSuppliers();
      } catch (err) {
        showDashError('Could not add that supplier: ' + (err && err.message ? err.message : err));
      } finally { btn.disabled = false; }
    });

    async function loadPurchaseOrders(){
      try {
        // EXT10b (mission 118): pick-lists read every row (paged); the order
        // list stays newest-first but says when older ones are not shown.
        const [{ data: pos, error, count: poCount }, { data: prods }, { data: lots }] = await Promise.all([
          supabase.from('purchase_orders')
            .select('id, po_number, status, currency, shipping_cost, tax, expense_category, ordered_at, expected_at, received_at, payment_status, notes, suppliers(name), purchase_order_items(id, product_id, description, sku, quantity, unit_cost, quantity_received, landed_unit_cost)', { count: 'exact' })
            .is('deleted_at', null)
            .order('created_at', { ascending: false }),
          fetchAllRows('products', 'id, name, sku', q => q).then(rows => ({ data: rows.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))) }), () => ({ data: [] })),
          fetchAllRows('inventory_lots', 'id, purchase_order_id, product_id, lot_number, quantity_received', q => q.not('purchase_order_id', 'is', null)).then(rows => ({ data: rows }), () => ({ data: [] })),
        ]);
        if (error) throw error;
        const rows = pos || [];
        showPageWarning('purchaseOrdersPanel', typeof poCount === 'number' && poCount > rows.length
          ? 'Showing the newest ' + rows.length + ' of ' + poCount + ' purchase orders: older ones are not listed on this page (they still exist; Home checks and Query F read them all).' : null);
        PO_PRODUCTS = prods || [];
        SEARCH_INDEX.purchaseOrders = rows;

        // Group received lot numbers by which PO line they came from, so the
        // receiving table can show what was already recorded.
        PO_LOTS = Object.create(null);
        (lots || []).forEach(l => {
          const key = l.purchase_order_id + '::' + l.product_id;
          (PO_LOTS[key] = PO_LOTS[key] || []).push(l);
        });

        const openPos = rows.filter(p => ['draft','ordered','shipped'].includes(p.status));
        const outstanding = openPos.reduce((s, p) => s + poGrandTotal(p), 0);
        // EXT20J: built as DOM nodes (h() text-ifies) instead of an HTML string,
        // so the Purchase Orders stats and list are safe under Trusted Types.
        // Values were already esc()-ed. The po-<status> / pay-<status> classes are
        // unchanged, so each badge keeps its own colour.
        document.getElementById('poStats').replaceChildren(
          h('div', { class: 'stat' }, h('div', { class: 'num' }, String(rows.filter(p => p.status === 'draft').length)), h('div', { class: 'lbl' }, 'Drafts')),
          h('div', { class: 'stat' }, h('div', { class: 'num' }, String(rows.filter(p => ['ordered','shipped'].includes(p.status)).length)), h('div', { class: 'lbl' }, 'Awaiting delivery')),
          h('div', { class: 'stat' }, h('div', { class: 'num' }, fmtMoney(outstanding, 'USD')), h('div', { class: 'lbl' }, 'Value outstanding')));

        const poNode = po => {
          const sup = (po.suppliers && po.suppliers.name) || 'Unknown supplier';
          const lines = (po.purchase_order_items || []).length;
          const bits = [lines + (lines === 1 ? ' line' : ' lines')];
          if (po.expected_at) bits.push('expected ' + new Date(po.expected_at + 'T00:00:00').toLocaleDateString(undefined, { day:'numeric', month:'short' }));
          if (po.received_at) bits.push('received ' + fmtDate(po.received_at));
          return h('div', { class: 'poItem', 'data-id': po.id },
            h('div', { class: 'poRow' },
              h('div', null,
                h('div', { class: 'poNum' }, po.po_number + ' · ' + sup),
                h('div', { class: 'poMeta' }, bits.join(' · '))),
              h('div', { class: 'poSide' },
                h('span', { class: 'poTotal' }, fmtMoney(poGrandTotal(po), po.currency)),
                ...(po.payment_status && po.payment_status !== 'paid'
                  ? [h('span', { class: 'badge pay-' + po.payment_status }, PAYMENT_LABELS[po.payment_status] || po.payment_status)] : []),
                ...(po.payment_status === 'paid' ? [h('span', { class: 'badge pay-paid' }, 'Paid')] : []),
                h('span', { class: 'badge po-' + po.status }, PO_STATUS_LABELS[po.status] || po.status))),
            h('div', { class: 'poDetail u-d-none', id: 'poDetail_' + po.id }));
        };
        document.getElementById('poWrap').replaceChildren(...(rows.length
          ? rows.map(poNode)
          : [h('p', { class: 'empty' }, 'No purchase orders yet. Add a supplier, then create a draft above.')]));

        document.querySelectorAll('#poWrap .poRow').forEach(row => {
          row.addEventListener('click', () => {
            const id = row.closest('.poItem').getAttribute('data-id');
            PO_OPEN_ID = (PO_OPEN_ID === id) ? null : id;
            renderPoDetails(rows);
          });
        });
        renderPoDetails(rows);
      } catch (err) {
        document.getElementById('poWrap').replaceChildren();
        showDashError('Could not load purchase orders: ' + (err && err.message ? err.message : err));
      }
    }

    function renderPoDetails(rows){
      rows.forEach(po => {
        const box = document.getElementById('poDetail_' + po.id);
        if (!box) return;
        if (PO_OPEN_ID !== po.id) { box.style.display = 'none'; box.replaceChildren(); return; }
        box.style.display = 'block';

        const items = po.purchase_order_items || [];
        const editable = po.status === 'draft' || po.status === 'ordered';
        const awaitingReceipt = po.status === 'ordered' || po.status === 'shipped';
        // EXT20J: the whole PO detail panel is built as DOM nodes (h() text-ifies)
        // instead of an HTML string, so it is safe under Trusted Types. Values were
        // already esc()-ed. Classes, data-* attributes and input/select/button
        // structure are unchanged, so wirePoDetail()'s querySelector wiring works.
        const lotCellFor = l => {
          const outstanding = Number(l.quantity || 0) - Number(l.quantity_received || 0);
          const recordedLots = (PO_LOTS[po.id + '::' + l.product_id] || []);
          if (l.product_id && awaitingReceipt && outstanding > 0) {
            return h('input', { type: 'text', class: 'poLineLot u-w-120', 'data-line': l.id, placeholder: 'e.g. HE-2026-01' });
          }
          if (recordedLots.length) return recordedLots.map(rl => rl.lot_number + ' (' + Number(rl.quantity_received) + ')').join(', ');
          return '—';
        };
        const linesNode = items.length
          ? [h('table', { class: 'phoneCards' },
              h('thead', null, h('tr', null,
                h('th', null, 'Item'), h('th', null, 'SKU'), h('th', null, 'Qty'), h('th', null, 'Unit cost'),
                h('th', null, 'Line total'),
                h('th', { title: 'Unit cost once shipping and tax are shared out' }, 'True cost'),
                h('th', { title: 'Which production batch this stock came from' }, 'Lot #'),
                h('th'))),
              h('tbody', null, items.map(l =>
                h('tr', null,
                  h('td', null, l.description, l.product_id ? [' ', h('span', { class: 'badge' }, 'catalogue')] : null),
                  h('td', null, l.sku || '—'),
                  h('td', null, Number(l.quantity)),
                  h('td', null, fmtMoney(l.unit_cost, po.currency)),
                  h('td', null, fmtMoney(Number(l.quantity) * Number(l.unit_cost || 0), po.currency)),
                  h('td', null, l.landed_unit_cost != null ? fmtMoney(l.landed_unit_cost, po.currency) : '—'),
                  h('td', null, lotCellFor(l)),
                  h('td', null, editable ? h('button', { type: 'button', class: 'small secondary poDelLine', 'data-line': l.id }, 'Remove') : null))))),
            awaitingReceipt && items.some(l => l.product_id) ? h('p', { class: 'sMeta u-mt-6' }, 'Lot # is optional — leave it blank if your manufacturer doesn\'t give you one for this delivery.') : null]
          : [h('p', { class: 'empty' }, 'Nothing on this order yet.')];

        const addLineNode = editable ? h('div', { class: 'poLineForm' },
          h('select', { class: 'poLineProduct grow' },
            h('option', { value: '' }, 'Not a catalogue product…'),
            PO_PRODUCTS.map(p => h('option', { value: p.id, 'data-sku': p.sku || '', 'data-name': p.name }, p.name + (p.sku ? ' (' + p.sku + ')' : '')))),
          h('input', { type: 'text', class: 'poLineDesc grow', placeholder: 'What you\'re buying' }),
          h('input', { type: 'number', class: 'poLineQty num', placeholder: 'Qty', min: '0.01', step: 'any' }),
          h('input', { type: 'number', class: 'poLineCost num', placeholder: 'Unit cost', min: '0', step: '0.01' }),
          h('button', { type: 'button', class: 'small poAddLine' }, 'Add')) : null;

        const totalsNode = h('div', { class: 'poTotalsRow' },
          h('span', null, 'Items ' + fmtMoney(poLinesTotal(po), po.currency)),
          h('label', null, 'Shipping ', h('input', { type: 'number', class: 'poShipping', step: '0.01', min: '0', value: Number(po.shipping_cost || 0), disabled: editable ? null : true })),
          h('label', null, 'Tax ', h('input', { type: 'number', class: 'poTax', step: '0.01', min: '0', value: Number(po.tax || 0), disabled: editable ? null : true })),
          editable ? h('button', { type: 'button', class: 'small secondary poSaveTotals' }, 'Save') : null,
          h('strong', { class: 'u-ml-auto' }, 'Total ' + fmtMoney(poGrandTotal(po), po.currency)));

        const paymentNode = h('div', { class: 'poTotalsRow' },
          h('label', null, 'Payment ',
            h('select', { class: 'poPayment' },
              ['unpaid','partial','paid'].map(v => h('option', { value: v, selected: po.payment_status === v ? true : null }, PAYMENT_LABELS[v])))),
          h('button', { type: 'button', class: 'small secondary poSavePayment' }, 'Save payment'),
          po.notes ? h('span', { class: 'sMeta u-ml-auto' }, po.notes) : null);

        const actionNodes = [];
        if (po.status === 'draft')    actionNodes.push(h('button', { type: 'button', class: 'small poStatusBtn', 'data-next': 'ordered' }, 'Mark as ordered'));
        if (po.status === 'ordered')  actionNodes.push(h('button', { type: 'button', class: 'small poStatusBtn', 'data-next': 'shipped' }, 'Mark as shipped'));
        if (['ordered', 'shipped', 'received'].includes(po.status) && poReceiveOps.isUnknown(po.id)) {
          actionNodes.push(h('div', { class: 'poReceiptUnknown', role: 'status' },
            h('b', null, 'Receipt status unknown — do not press Receive again.'),
            ' The connection dropped while this delivery was being received, so it is not known whether stock and the expense were added. ',
            h('button', { type: 'button', class: 'small secondary poCheckReceipt' }, 'Check this order now')));
        } else if (po.status === 'ordered' || po.status === 'shipped') actionNodes.push(h('button', { type: 'button', class: 'small approve poReceiveBtn' }, 'Receive delivery'));
        if (po.status !== 'received' && po.status !== 'cancelled') actionNodes.push(h('button', { type: 'button', class: 'small secondary poStatusBtn', 'data-next': 'cancelled' }, 'Cancel'));
        // EXT10b: never claim the stock was added when the order's own lines say otherwise
        // (an interrupted receive leaves the order Received with lines short).
        const shortLines = items.filter(l => l.product_id && Number(l.quantity_received || 0) !== Number(l.quantity || 0)).length;
        if (po.status === 'received' && !poReceiveOps.isUnknown(po.id)) actionNodes.push(shortLines
          ? h('span', { class: 'sMeta poShort', role: 'status' }, `Received ${fmtDate(po.received_at)} — but ${shortLines} catalogue line${shortLines === 1 ? ' is' : 's are'} not fully in stock. Do not receive again: add the missing stock with a manual adjustment and check Expenses.`)
          : h('span', { class: 'sMeta' }, `Received ${fmtDate(po.received_at)} — stock added to Inventory and cost logged to Expenses.`));
        const actionsNode = h('div', { class: 'poActions' }, actionNodes);

        box.replaceChildren(...[...linesNode, addLineNode, totalsNode, paymentNode, actionsNode].filter(Boolean));
        wirePoDetail(po, box);
      });
    }

    function wirePoDetail(po, box){
      const prodSel = box.querySelector('.poLineProduct');
      const descInput = box.querySelector('.poLineDesc');
      if (prodSel && descInput) {
        prodSel.addEventListener('change', () => {
          const opt = prodSel.selectedOptions[0];
          if (prodSel.value && opt) descInput.value = opt.getAttribute('data-name') || '';
        });
      }
      const addBtn = box.querySelector('.poAddLine');
      if (addBtn) addBtn.addEventListener('click', async () => {
        const productId = prodSel.value || null;
        const opt = prodSel.selectedOptions[0];
        const description = (descInput.value || '').trim();
        const quantity = Number(box.querySelector('.poLineQty').value);
        const unitCost = Number(box.querySelector('.poLineCost').value || 0);
        if (!description) { toast('Say what you\'re buying first.'); return; }
        if (!(quantity > 0)) { toast('Quantity needs to be more than zero.'); return; }
        const lineProblem = numberInputError(numVal(box.querySelector('.poLineQty')), { label: 'Quantity', min: 0, minExclusive: true, max: 1000000 })
          || numberInputError(numVal(box.querySelector('.poLineCost')), { label: 'Unit cost', allowBlank: true, max: 10000000, decimals: 4 });
        if (lineProblem) { toast(lineProblem); return; }
        // Stock is counted in whole units (inventory columns are integers), so a
        // catalogue product line can't be 2.5. Non-catalogue lines (freight,
        // services) may be fractional.
        if (productId && !Number.isInteger(quantity)) { toast('A catalogue product line needs a whole number of units.'); return; }
        addBtn.disabled = true;
        try {
          if (!PO_EDITABLE.includes(await poStatusNow(po.id))) {
            showDashError(staleMessage('That purchase order'));
            loadPurchaseOrders();
            return;
          }
          const { error } = await insertOnce(addBtn, 'purchase_order_items', {
            purchase_order_id: po.id,
            product_id: productId,
            description: description,
            sku: productId && opt ? (opt.getAttribute('data-sku') || null) : null,
            quantity: quantity,
            unit_cost: unitCost,
          }, 'That line');
          if (error) throw error;
          // EXT5: the status was checked before the insert, in a separate
          // request. If the order was received in between, this line is not
          // part of that delivery: say so (the database guard drafted in
          // drafts/17 closes this window for deletes once installed).
          const statusAfter = await poStatusNow(po.id).catch(() => null);
          if (statusAfter && !PO_EDITABLE.includes(statusAfter)) {
            showDashError('The line was added, but purchase order ' + po.po_number + ' became "' + (PO_STATUS_LABELS[statusAfter] || statusAfter) + '" at the same moment. Check whether this line was received with it (Inventory) before doing anything else.');
          }
          loadPurchaseOrders();
        } catch (err) {
          addBtn.disabled = false;
          showDashError('Could not add that line: ' + (err && err.message ? err.message : err));
        }
      });

      box.querySelectorAll('.poDelLine').forEach(btn => {
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          try {
            if (!PO_EDITABLE.includes(await poStatusNow(po.id))) {
              showDashError(staleMessage('That purchase order'));
              loadPurchaseOrders();
              return;
            }
            const { data: gone, error } = await supabase.from('purchase_order_items').delete().eq('id', btn.getAttribute('data-line')).select('id');
            if (error) throw error;
            if (noRowsChanged(gone)) { showDashError(staleMessage('That line')); loadPurchaseOrders(); return; }
            // EXT5: same check after the delete: a Receive that started in
            // between may already have added this line's stock.
            const statusAfter = await poStatusNow(po.id).catch(() => null);
            if (statusAfter && !PO_EDITABLE.includes(statusAfter)) {
              showDashError('The line was removed, but purchase order ' + po.po_number + ' became "' + (PO_STATUS_LABELS[statusAfter] || statusAfter) + '" at the same moment, so its stock may already have been added. Check Inventory and Expenses for this order.');
            }
            loadPurchaseOrders();
          } catch (err) {
            btn.disabled = false;
            showDashError('Could not remove that line: ' + (err && err.message ? err.message : err));
          }
        });
      });

      const saveTotals = box.querySelector('.poSaveTotals');
      if (saveTotals) saveTotals.addEventListener('click', async () => {
        const totalsProblem = numberInputError(numVal(box.querySelector('.poShipping')), { label: 'Shipping', allowBlank: true, max: 10000000, decimals: 2 })
          || numberInputError(numVal(box.querySelector('.poTax')), { label: 'Tax', allowBlank: true, max: 10000000, decimals: 2 });
        if (totalsProblem) { showDashError(totalsProblem + ' Nothing was saved.'); return; }
        saveTotals.disabled = true;
        try {
          const changed = await updateIfUnchanged('purchase_orders', po.id, {
            shipping_cost: Number(box.querySelector('.poShipping').value || 0),
            tax: Number(box.querySelector('.poTax').value || 0),
            updated_at: new Date().toISOString(),
          // EXT8: also only if shipping and tax are still what this form
          // loaded: two people editing the same order no longer overwrite
          // each other's amounts (money) without noticing.
          }, { status: PO_EDITABLE, deleted_at: null, shipping_cost: po.shipping_cost, tax: po.tax });
          if (changed) toastOk('Saved.');
          else showDashError(staleMessage('That purchase order'));
          loadPurchaseOrders();
        } catch (err) {
          saveTotals.disabled = false;
          showDashError('Could not save that: ' + (err && err.message ? err.message : err));
        }
      });

      const savePay = box.querySelector('.poSavePayment');
      if (savePay) savePay.addEventListener('click', async () => {
        savePay.disabled = true;
        try {
          // Only over the payment status this page showed: a tab opened
          // earlier must not turn "Paid" back into "Unpaid" unnoticed.
          const changed = await updateIfUnchanged('purchase_orders', po.id, {
            payment_status: box.querySelector('.poPayment').value,
            updated_at: new Date().toISOString(),
          }, { payment_status: po.payment_status, deleted_at: null });
          if (changed) toastOk('Payment status saved.');
          else showDashError(staleMessage('That purchase order'));
          loadPurchaseOrders();
        } catch (err) {
          savePay.disabled = false;
          showDashError('Could not save that: ' + (err && err.message ? err.message : err));
        }
      });

      box.querySelectorAll('.poStatusBtn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const next = btn.getAttribute('data-next');
          const allowedFrom = PO_ALLOWED_FROM[next];
          if (!allowedFrom) return;
          if (next === 'cancelled' && !confirmSecondPress(btn, 'Really cancel this order?')) return;
          btn.disabled = true;
          try {
            const patch = { status: next, updated_at: new Date().toISOString() };
            if (next === 'ordered') patch.ordered_at = new Date().toISOString();
            const changed = await updateIfUnchanged('purchase_orders', po.id, patch, { status: allowedFrom, deleted_at: null });
            if (changed) toastOk('Purchase order ' + (PO_STATUS_LABELS[next] || next).toLowerCase() + '.');
            else showDashError(staleMessage('That purchase order'));
            loadPurchaseOrders();
          } catch (err) {
            btn.disabled = false;
            showDashError('Could not update that order: ' + (err && err.message ? err.message : err));
          }
        });
      });

      const checkReceiptBtn = box.querySelector('.poCheckReceipt');
      if (checkReceiptBtn) checkReceiptBtn.addEventListener('click', async () => {
        // Read-only: what the database says now about this order and its lines.
        checkReceiptBtn.disabled = true;
        const rb = poReceiveOps.startReadback(po.id); // RESULT_UNKNOWN -> READBACK_CHECKING (null if it was not unknown)
        try {
          const { data, error } = await supabase.from('purchase_orders')
            .select('status, received_at, purchase_order_items(product_id, quantity, quantity_received)').eq('id', po.id).maybeSingle();
          if (error) throw error;
          if (!data) { showDashError('That purchase order could not be found any more (deleted elsewhere?). Nothing was changed.'); return; }
          const anyReceived = (data.purchase_order_items || []).some(l => Number(l.quantity_received || 0) > 0);
          const notStocked = (data.purchase_order_items || []).filter(l => l.product_id && Number(l.quantity_received || 0) !== Number(l.quantity || 0)).length;
          if (data.status === 'received' && notStocked) {
            if (rb) poReceiveOps.resolved(po.id, 'received, stock incomplete');
            showDashError('Checked: purchase order ' + po.po_number + ' IS marked received, but ' + notStocked + ' catalogue line' + (notStocked === 1 ? ' was' : 's were') + ' not (fully) added to stock, and the expense may be missing. Do not receive it again: add the missing stock with a manual adjustment (reason: "PO ' + po.po_number + ' receive interrupted") and check Expenses. Home lists it under "Received orders not fully in stock".');
          } else if (data.status === 'received') {
            if (rb) poReceiveOps.resolved(po.id, 'received');
            toast('Checked: purchase order ' + po.po_number + ' IS marked received (' + fmtDate(data.received_at) + ') and its lines are in stock. Do not receive it again; check Expenses shows the delivery once.');
          } else if (PO_ALLOWED_FROM.received.includes(data.status) && !anyReceived) {
            if (rb) { poReceiveOps.resolved(po.id, 'not received'); poReceiveOps.reset(po.id, 'safe to receive'); }
            toast('Checked: purchase order ' + po.po_number + ' was NOT received and no stock was added for it. It is safe to receive it now.');
          } else {
            if (rb) poReceiveOps.stillUnknown(po.id, 'needs a person');
            showDashError('Checked: purchase order ' + po.po_number + ' is "' + (PO_STATUS_LABELS[data.status] || data.status) + '"' + (anyReceived ? ' but some lines show stock received' : '') + '. This needs a person to look: compare Inventory history and Expenses with the order before doing anything else. Do not press Receive.');
          }
          loadPurchaseOrders();
        } catch (err) {
          if (rb && poReceiveOps.state(po.id) === 'READBACK_CHECKING') poReceiveOps.stillUnknown(po.id, 'read failed');
          showDashError('Still cannot read the order (' + explainDbError(err && err.message ? err.message : String(err)) + '). The receipt status stays unknown; try the check again when the connection is back. Do not press Receive.');
        } finally { checkReceiptBtn.disabled = false; }
      });
      const recvBtn = box.querySelector('.poReceiveBtn');
      if (recvBtn) recvBtn.addEventListener('click', async () => {
        // Checked before anything is saved: a catalogue line with a fractional
        // quantity can't go into whole-unit stock (and used to fail half-way).
        const fractional = (po.purchase_order_items || []).filter(l => l.product_id && !Number.isInteger(Number(l.quantity || 0)));
        if (fractional.length) {
          showDashError('This order has a catalogue line with a quantity that is not a whole number (' + fractional.map(l => l.description || l.sku || 'a line').join(', ') + '). Stock is counted in whole units — fix the line before receiving. Nothing was changed.');
          return;
        }
        if (!canChangeStock()) { showDashError('Only the Owner or an Administrator can change stock. Nothing was changed.'); return; }
        // Receiving adds stock and logs the expense, and can't be undone from
        // here: a second, deliberate press (same as Cancel).
        if (!confirmSecondPress(recvBtn, 'Confirm: add stock + log expense?')) return;
        recvBtn.disabled = true;
        const viaFunction = await stockFunctionOn('receive');
        if (!poReceiveOps.begin(po.id, { idempotent: viaFunction })) {
          const st = poReceiveOps.state(po.id);
          showDashError(st === 'SENDING' ? 'This delivery is already being received; wait for the result. Nothing new was sent.'
            : st === 'CONFIRMED' ? 'This delivery was already received from this page. Nothing was sent again.'
            : 'The result of the last attempt is unknown. Use "Check this order now" first; nothing was sent.');
          return;
        }
        // EXT9: R1 (receive_purchase_order) when its switch is on: one
        // database transaction locks the order, adds the stock, records the
        // lots, history and expense, or does nothing at all; a second press or
        // a retry gets "already received" and adds nothing.
        if (viaFunction) {
          const lots = [...box.querySelectorAll('.poLineLot[data-line]')]
            .map(i => ({ line_id: i.getAttribute('data-line'), lot_number: i.value.trim() }))
            .filter(l => l.lot_number);
          try {
            const r = await callStockFunction('receive_purchase_order', { p_po_id: po.id, p_lots: lots, p_expense_date: localDateString(new Date()) });
            poReceiveOps.confirmed(po.id, r.already_received ? 'already received' : 'received');
            if (r.already_received) {
              toast('Purchase order ' + (r.po_number || po.po_number) + ' was already received — nothing was added again.');
            } else {
              const n = Number(r.stocked || 0);
              toastOk((n ? `Received — ${n} ${n === 1 ? 'item' : 'items'} added to Inventory, cost logged to Expenses, true unit costs worked out.` : 'Received — cost logged to Expenses, true unit costs worked out.'));
              if (Number(r.skipped || 0)) toast(`${r.skipped} line${Number(r.skipped) === 1 ? '' : 's'} weren't catalogue products, so no stock was added for them.`);
            }
          } catch (err) {
            if (poReceiveOps.state(po.id) === 'SENDING') {
              if (err && err.kind === 'unknown') poReceiveOps.unknown(po.id, 'reply lost (function refuses duplicates)');
              else if (/JWT|expired|sign in again/i.test(String(err && err.message))) poReceiveOps.sessionExpired(po.id, 'session');
              else if (/permission|row-level|not permitted/i.test(String(err && err.message))) poReceiveOps.permissionDenied(po.id, 'permission');
              else poReceiveOps.failedBeforeEffect(po.id, err && err.kind === 'missing' ? 'function missing' : 'refused');
              if (['SESSION_EXPIRED', 'PERMISSION_DENIED'].includes(poReceiveOps.state(po.id))) poReceiveOps.reset(po.id, 'shown');
            }
            showDashError('Could not receive purchase order ' + po.po_number + '. ' + stockFunctionError(err, 'the delivery', true));
          }
          loadPurchaseOrders();
          safeRun(loadInventory);
          safeRun(loadExpenses);
          return;
        }
        // Claim first: the order is marked Received only if it is still
        // Ordered or Shipped. A double click, a second tab, a stale page or a
        // retry after a lost reply then gets "already changed" and adds
        // nothing, instead of adding the stock and the expense a second time.
        // (The full all-or-nothing fix is the receive_purchase_order database
        // function, R1, which waits on the owner's schema check.)
        // claimStamp doubles as a receipt: if the reply to the claim is lost,
        // reading the order back tells us whether it was THIS click that
        // marked it received (same received_at) or someone else.
        const claimStamp = new Date().toISOString();
        let uid = null, claimed = false;
        try {
          uid = await currentUserId();
          claimed = await updateIfUnchanged('purchase_orders', po.id, {
            status: 'received', received_at: claimStamp,
            received_by: uid, updated_at: claimStamp,
          }, { status: PO_ALLOWED_FROM.received, deleted_at: null });
        } catch (err) {
          let now = null;
          try {
            const { data } = await supabase.from('purchase_orders').select('status, received_at').eq('id', po.id).maybeSingle();
            now = data;
          } catch (e) { /* still offline */ }
          if (now && now.status === 'received' && now.received_at && Date.parse(now.received_at) === Date.parse(claimStamp)) {
            claimed = true; // our claim was saved; only the reply was lost
          } else if (now && PO_ALLOWED_FROM.received.includes(now.status)) {
            poReceiveOps.failedBeforeEffect(po.id, 'claim not saved');
            recvBtn.disabled = false;
            showDashError('Could not receive that delivery. Nothing was changed, so it is safe to try again: ' + (err && err.message ? err.message : err));
            return;
          } else {
            showDashError('Could not receive that delivery, and the dashboard can\'t tell whether the order was marked received. Do not press Receive again: use "Check this order now" on the order, and look at Inventory and Expenses first. ' + (err && err.message ? err.message : err));
            poReceiveOps.unknown(po.id, 'claim reply lost, read-back failed');
            loadPurchaseOrders();
            return;
          }
        }
        if (!claimed) {
          poReceiveOps.conflict(po.id, 'already changed'); poReceiveOps.reset(po.id, 'list re-read');
          showDashError(staleMessage('That purchase order') + ' It may already have been received elsewhere — check Inventory and Expenses before doing anything else.');
          loadPurchaseOrders();
          return;
        }
        poReceiveOps.confirmed(po.id, 'claimed'); // the receipt is recorded; a second Receive is refused from here on

        // EXT5: receive what is saved NOW, not what this page loaded. Another
        // tab (or person) may have added or removed a line, or changed the
        // shipping or tax, since the page opened; the claim above only checks
        // the status. Lines can't be changed any more once the order is
        // Received (every line edit checks the status first), so this read is
        // the order's final content, except for an edit already in flight
        // (checked again at the end).
        let items = po.purchase_order_items || [];
        let rpo = po;
        let changedNote = '';
        const progress = { costs: false, stockedNames: [], current: null, expense: false };
        let stocked = 0, skipped = 0;
        const lineSig = list => (list || []).map(l => [l.id, Number(l.quantity), Number(l.unit_cost || 0), l.product_id || ''].join(':')).sort().join('|');
        try {
          const { data: fresh, error: freshErr } = await supabase.from('purchase_orders')
            .select('id, po_number, shipping_cost, tax, expense_category, suppliers(name), purchase_order_items(id, product_id, description, sku, quantity, unit_cost, quantity_received, landed_unit_cost)')
            .eq('id', po.id).maybeSingle();
          if (freshErr) throw freshErr;
          if (!fresh) throw new Error('the order could not be read back after it was marked received');
          rpo = Object.assign({}, po, fresh);
          items = rpo.purchase_order_items || [];
          if (lineSig(items) !== lineSig(po.purchase_order_items) || Number(rpo.shipping_cost || 0) !== Number(po.shipping_cost || 0) || Number(rpo.tax || 0) !== Number(po.tax || 0)) {
            changedNote = ' Note: this order had changed since this page was opened (lines, shipping or tax), so the saved version was received, not the one on screen.';
          }
          const fractionalNow = items.filter(l => l.product_id && !Number.isInteger(Number(l.quantity || 0)));
          if (fractionalNow.length) throw new Error('a catalogue line now has a quantity that is not a whole number (' + fractionalNow.map(l => l.description || l.sku || 'a line').join(', ') + ')');
          // Shipping and tax are shared across the lines in proportion to what
          // each line is worth, so every unit carries its fair share. That is
          // the number to price against — unit_cost alone flatters the margin.
          const itemsValue = poLinesTotal(rpo);
          const extras = Number(rpo.shipping_cost || 0) + Number(rpo.tax || 0);
          for (const line of items) {
            const qty = Number(line.quantity || 0);
            if (qty <= 0) continue;
            const lineValue = qty * Number(line.unit_cost || 0);
            const share = itemsValue > 0 ? (lineValue / itemsValue) * extras : (extras / items.length);
            const landed = (lineValue + share) / qty;
            const { data: costRows, error: costErr } = await supabase.from('purchase_order_items')
              .update({ landed_unit_cost: Math.round(landed * 10000) / 10000 }).eq('id', line.id).select('id');
            if (costErr) throw costErr;
            if (noRowsChanged(costRows)) throw new Error('the true unit cost of a line could not be saved (nothing was changed — no permission?)');
          }
          progress.costs = true;

          for (const line of items) {
            const outstanding = Number(line.quantity || 0) - Number(line.quantity_received || 0);
            if (outstanding <= 0) continue;
            if (!line.product_id) { skipped++; continue; }

            // If the owner entered a lot number for this line, find or create
            // the batch record first so the stock movement can point at it.
            let lotId = null;
            const lotInput = box.querySelector('.poLineLot[data-line="' + line.id + '"]');
            const lotNumber = lotInput ? lotInput.value.trim() : '';
            if (lotNumber) {
              const { data: existingLot, error: lotReadErr } = await supabase
                .from('inventory_lots').select('*')
                .eq('product_id', line.product_id).ilike('lot_number', likeLiteral(lotNumber)).maybeSingle();
              if (lotReadErr) throw lotReadErr;
              if (existingLot) {
                const { data: updatedLot, error: lotUpdErr } = await supabase.from('inventory_lots')
                  .update({
                    quantity_received: Number(existingLot.quantity_received) + outstanding,
                    quantity_remaining: Number(existingLot.quantity_remaining) + outstanding,
                    updated_at: new Date().toISOString(),
                  }).eq('id', existingLot.id).select().single();
                if (lotUpdErr) throw lotUpdErr;
                lotId = updatedLot.id;
              } else {
                const { data: newLot, error: lotInsErr } = await supabase.from('inventory_lots')
                  .insert({
                    product_id: line.product_id, lot_number: lotNumber,
                    purchase_order_id: po.id, quantity_received: outstanding,
                    quantity_remaining: outstanding, created_by: uid,
                  }).select().single();
                if (lotInsErr) throw lotInsErr;
                lotId = newLot.id;
              }
            }

            progress.current = line.description || line.sku || 'a line';
            await changeStock(line.product_id, { available: outstanding }, uid);
            const { error: adjErr } = await supabase.from('inventory_adjustments').insert({
              product_id: line.product_id, bucket: 'available', change_amount: outstanding,
              reason: 'Delivery received (' + rpo.po_number + ')', adjusted_by: uid, lot_id: lotId,
            });
            if (adjErr) throw adjErr;
            const { data: lineRows, error: lineErr } = await supabase.from('purchase_order_items')
              .update({ quantity_received: Number(line.quantity) }).eq('id', line.id).select('id');
            if (lineErr) throw lineErr;
            // Stock for this line is already added: if the line can't be marked
            // received, say so (it would otherwise look unreceived).
            if (noRowsChanged(lineRows)) {
              // Was the line removed at this very moment (EXT5), or refused?
              let stillThere = true;
              try {
                const { data: look, error: lookErr } = await supabase.from('purchase_order_items').select('id').eq('id', line.id).maybeSingle();
                if (!lookErr) stillThere = !!look;
              } catch (e) { /* unknown: keep the general wording */ }
              throw new Error(stillThere
                ? 'its stock was added, but the line could not be marked received (nothing was changed — no permission?)'
                : 'its stock was added, but the line was removed from the order while it was being received (someone edited the order at the same moment)');
            }
            stocked++;
            progress.stockedNames.push(progress.current);
            progress.current = null;
          }

          const total = poGrandTotal(rpo);
          if (total > 0) {
            const { error: expErr } = await supabase.from('expenses').insert({
              category: rpo.expense_category,
              amount: total,
              expense_date: localDateString(new Date()), // Central calendar day (UTC was "tomorrow" after 7 pm) (EXT4)
              vendor: (rpo.suppliers && rpo.suppliers.name) || null,
              note: 'Purchase order ' + rpo.po_number,
            });
            if (expErr) throw expErr;
          }
          progress.expense = true;

          // EXT5: a line edit that passed its status check just before the
          // claim can still land while receiving. Check the lines once more;
          // if they differ from what was received, say so instead of success.
          let after = null;
          try {
            const { data: afterRows, error: afterErr } = await supabase.from('purchase_order_items')
              .select('id, product_id, quantity, unit_cost').eq('purchase_order_id', rpo.id);
            if (!afterErr) after = afterRows;
          } catch (e) { /* re-check unavailable: reported below */ }
          if (after && lineSig(after) !== lineSig(items)) {
            showDashError('Purchase order ' + rpo.po_number + ' was received, but the lines of this order changed while it was being received (a line was added, removed or edited at the same moment). '
              + 'Stock and the expense follow the lines as they were when receiving started. Compare the order with Inventory and Expenses now and correct by hand if needed.');
          } else {
            toastOk((stocked
              ? `Received — ${stocked} ${stocked === 1 ? 'item' : 'items'} added to Inventory, cost logged to Expenses, true unit costs worked out.`
              : 'Received — cost logged to Expenses, true unit costs worked out.') + changedNote);
            if (changedNote) toast(changedNote.trim());
            if (!after) toast('Received, but the lines could not be checked again afterwards. If anyone was editing this order, compare it with Inventory.');
          }
          if (skipped) toast(`${skipped} line${skipped === 1 ? '' : 's'} weren't catalogue products, so no stock was added for them.`);
        } catch (err) {
          // The order is already marked Received, so the Receive button is gone
          // on purpose: pressing it again is exactly what used to double-count.
          // Say precisely what got done so the rest can be finished by hand.
          const productLines = items.filter(l => l.product_id && Number(l.quantity || 0) - Number(l.quantity_received || 0) > 0).length;
          showDashError('Purchase order ' + po.po_number + ' is marked Received, but the work stopped part-way. '
            + 'Done: ' + [
              progress.costs ? 'true unit costs' : null,
              progress.stockedNames.length ? 'stock fully recorded for ' + progress.stockedNames.length + ' of ' + productLines + ' lines (' + progress.stockedNames.join(', ') + ')' : 'no line fully recorded',
              progress.current ? 'it stopped while recording "' + progress.current + '", so that line\'s stock may or may not have been added — check it on Inventory' : null,
              progress.expense ? 'expense logged' : 'expense NOT logged',
            ].filter(Boolean).join('; ')
            + '. Do not try to receive it again — finish the rest by hand on Inventory / Expenses. Error: '
            + (err && err.message ? err.message : err));
        }
        loadPurchaseOrders();
        safeRun(loadInventory);
        safeRun(loadExpenses);
      });
    }

    document.getElementById('addPoForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const supplierId = document.getElementById('poSupplier').value;
      if (!supplierId) { toast('Pick a supplier first.'); return; }
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        const uid = await currentUserId();
        const rk = await formRequestKey(e.target);
        let { data, error } = await supabase.from('purchase_orders').insert(withRequestKey({
          supplier_id: supplierId,
          expected_at: document.getElementById('poExpected').value || null,
          expense_category: document.getElementById('poCategory').value,
          notes: document.getElementById('poNotes').value.trim() || null,
          created_by: uid,
        }, rk)).select('id, po_number').single();
        let repeated = false;
        if (isRequestKeyRepeat(error)) {
          // The earlier attempt created it: open that one instead of a second.
          ({ data, error } = await supabase.from('purchase_orders').select('id, po_number').eq('client_request_id', rk).single());
          repeated = !error;
        }
        if (error) throw error;
        clearRequestKey(e.target);
        document.getElementById('poNotes').value = '';
        PO_OPEN_ID = data.id;
        if (repeated) toast('Purchase order ' + (data.po_number || '') + REPEAT_NOTE + ' It is open below.');
        else toastOk(data.po_number + ' created — add what you\'re ordering.');
        loadPurchaseOrders();
      } catch (err) {
        showDashError('Could not create that purchase order: ' + (err && err.message ? err.message : err));
      } finally { btn.disabled = false; }
    });

    // ---------- Quality Control ----------
    let QC_LOTS = []; // flattened {id, lot_number, product_id} across all products, for the target dropdown

    async function loadQualityChecks(){
      try {
        const [{ data: checks, error, count: qcCount }, { data: products }, { data: lots }, { data: activeRecalls }] = await Promise.all([
          supabase.from('quality_checks')
            .select('id, check_type, result, severity, description, resolution, incident_id, created_at, product_id, lot_id, products(name, sku), inventory_lots(lot_number), incidents(incident_number, status)', { count: 'exact' })
            .order('created_at', { ascending: false }),
          fetchAllRows('products', 'id, name, sku', q => q).then(rows => ({ data: rows.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))) }), () => ({ data: [] })),
          fetchAllRows('inventory_lots', 'id, lot_number, product_id, received_at', q => q)
            .then(rows => ({ data: rows.sort((a, b) => String(b.received_at || '').localeCompare(String(a.received_at || ''))) }), () => ({ data: [] })),
          supabase.from('recalls').select('lot_id, product_id').neq('status', 'resolved'),
        ]);
        if (error) throw error;
        const rows = checks || [];
        showPageWarning('qualityControlPanel', typeof qcCount === 'number' && qcCount > rows.length
          ? 'Showing the newest ' + rows.length + ' of ' + qcCount + ' quality checks: older ones are not listed on this page.' : null);
        SEARCH_INDEX.qualityChecks = rows;
        QC_LOTS = lots || [];

        // Cross-link with Recalls: a lot (or, failing that, a whole product)
        // that already has an active recall gets flagged here too, so nobody
        // reviewing a quality check misses that it's already being pulled.
        const recalledLots = new Set((activeRecalls || []).filter(r => r.lot_id).map(r => r.lot_id));
        const recalledProducts = new Set((activeRecalls || []).filter(r => !r.lot_id && r.product_id).map(r => r.product_id));

        const failedOpen = rows.filter(c => c.result === 'fail' && !c.resolution).length;
        // EXT20J: built as DOM nodes (h() text-ifies) instead of an HTML string, so
        // the Quality Control screen is safe under Trusted Types. Values were
        // already esc()-ed; now they are text nodes.
        document.getElementById('qcStats').replaceChildren(
          h('div', { class: 'stat' }, h('div', { class: 'num' }, rows.length), h('div', { class: 'lbl' }, 'Checks logged')),
          h('div', { class: 'stat' }, h('div', { class: 'num' }, failedOpen), h('div', { class: 'lbl' }, 'Failed, unresolved')));

        // Target dropdown: each product groups its own lots, plus a
        // "general" option for a check that isn't tied to one specific batch.
        const targetSel = document.getElementById('qcTarget');
        const keep = targetSel.value;
        targetSel.replaceChildren(
          h('option', { value: '' }, 'Not tied to a specific product'),
          ...(products || []).map(p =>
            h('optgroup', { label: p.name + (p.sku ? ' (' + p.sku + ')' : '') },
              h('option', { value: 'product:' + p.id }, 'General (no specific batch)'),
              ...QC_LOTS.filter(l => l.product_id === p.id).map(l => h('option', { value: 'lot:' + l.id }, 'Lot ' + l.lot_number)))));
        targetSel.value = keep;

        const qcRow = c => {
          const prod = (c.products && c.products.name) || 'Unlinked';
          const lot = (c.inventory_lots && c.inventory_lots.lot_number) || null;
          const resultClass = c.result === 'fail' ? 'sev-high' : (c.result === 'pass' ? 'sev-low' : '');
          const incident = c.incidents;
          const alsoRecalled = (c.lot_id && recalledLots.has(c.lot_id)) || (!c.lot_id && c.product_id && recalledProducts.has(c.product_id));
          return h('div', { class: 'deletedRow u-ai-flex-start', 'data-id': c.id },
            h('div', { class: 'info u-flex-1' },
              h('b', null, QC_TYPE_LABELS[c.check_type] || c.check_type), ' ',
              h('span', { class: 'badge ' + resultClass }, QC_RESULT_LABELS[c.result] || c.result), ' ',
              h('span', { class: 'badge' }, QC_SEVERITY_LABELS[c.severity] || c.severity), ' ',
              h('span', { class: 'u-c-muted u-fs-12' }, prod + (lot ? ' · lot ' + lot : '') + ' · ' + fmtDate(c.created_at)),
              h('div', { class: 'u-mt-6' }, c.description),
              c.resolution ? h('div', { class: 'u-mt-6 u-c-x4d7c6a' }, h('b', null, 'Resolved:'), ' ' + c.resolution) : null,
              incident ? h('div', { class: 'u-mt-6' }, h('span', { class: 'badge' }, 'Incident ' + (incident.incident_number || '') + ' — ' + incident.status)) : null,
              alsoRecalled ? h('div', { class: 'u-mt-6' }, h('span', { class: 'badge sev-high' }, 'This batch also has an active recall'), ' ', h('a', { href: '#', class: 'qcViewRecallLink u-fs-12' }, 'View in Recalls →')) : null,
              !c.resolution ? h('div', { class: 'u-mt-10 u-d-flex u-gap-8 u-fwr-wrap u-ai-center' },
                h('input', { type: 'text', class: 'qcResolutionInput u-flex-1 u-minw-160 u-p-6-9 u-br-6 u-b-1-solid-xcfd8d6 u-ff-inherit u-fs-13', placeholder: 'Resolution notes' }),
                h('button', { type: 'button', class: 'small secondary qcResolveBtn' }, 'Mark resolved'),
                (c.result === 'fail' && !c.incident_id) ? h('button', { type: 'button', class: 'small deny qcEscalateBtn' }, 'Escalate to Incident') : null) : null));
        };
        document.getElementById('qcWrap').replaceChildren(...(rows.length ? rows.map(qcRow) : [h('p', { class: 'empty' }, 'No quality checks logged yet.')]));

        document.querySelectorAll('.qcViewRecallLink').forEach(link => {
          link.addEventListener('click', (e) => { e.preventDefault(); showPage('recallsPanel'); });
        });

        document.querySelectorAll('.qcResolveBtn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const row = btn.closest('[data-id]');
            const id = row.getAttribute('data-id');
            const note = row.querySelector('.qcResolutionInput').value.trim() || 'Resolved.';
            btn.disabled = true;
            try {
              // Only while still unresolved: a stale page must not overwrite
              // the resolution someone else already wrote.
              const changed = await updateIfUnchanged('quality_checks', id,
                { resolution: note, updated_at: new Date().toISOString() }, { resolution: null });
              if (changed) toastOk('Marked resolved.');
              else showDashError(staleMessage('That quality check'));
              loadQualityChecks();
              safeRun(loadAttention);
            } catch (err) {
              btn.disabled = false;
              showDashError('Could not resolve that: ' + (err && err.message ? err.message : err));
            }
          });
        });

        document.querySelectorAll('.qcEscalateBtn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const row = btn.closest('[data-id]');
            const id = row.getAttribute('data-id');
            const check = rows.find(c => c.id === id);
            if (!check) return;
            btn.disabled = true;
            try {
              const uid = await currentUserId();
              const prod = (check.products && check.products.name) || 'Unlinked product';
              const done = await escalateToIncidentOnce('quality_checks', id, {
                category: qcIncidentCategory(check),
                severity: check.severity,
                status: 'open',
                title: (QC_TYPE_LABELS[check.check_type] || check.check_type) + ' — ' + prod,
                description: check.description,
                requires_approval: false,
                created_by: uid,
              });
              if (done) toastOk('Escalated to Incidents.');
              loadQualityChecks();
              safeRun(loadIncidents);
            } catch (err) {
              btn.disabled = false;
              showDashError('Could not escalate that: ' + (err && err.message ? err.message : err));
            }
          });
        });
      } catch (err) {
        document.getElementById('qcWrap').replaceChildren();
        showDashError('Could not load quality checks: ' + (err && err.message ? err.message : err));
      }
    }

    document.getElementById('addQcForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type=submit]');
      const description = document.getElementById('qcDescription').value.trim();
      if (!description) { toast('Say what you found first.'); return; }
      const target = document.getElementById('qcTarget').value;
      let productId = null, lotId = null;
      if (target.startsWith('lot:')) {
        lotId = target.slice(4);
        const lot = QC_LOTS.find(l => l.id === lotId);
        productId = lot ? lot.product_id : null;
      } else if (target.startsWith('product:')) {
        productId = target.slice(8);
      }
      btn.disabled = true;
      try {
        const uid = await currentUserId();
        const { error } = await insertOnce((btn.form || btn), 'quality_checks', {
          check_type: document.getElementById('qcType').value,
          result: document.getElementById('qcResult').value,
          severity: document.getElementById('qcSeverity').value,
          product_id: productId,
          lot_id: lotId,
          description: description,
          created_by: uid,
        }, 'That quality check');
        if (error) throw error;
        document.getElementById('qcDescription').value = '';
        toastOk('Quality check logged.');
        loadQualityChecks();
        safeRun(loadAttention);
      } catch (err) {
        showDashError('Could not log that check: ' + (err && err.message ? err.message : err));
      } finally { btn.disabled = false; }
    });

    // ---------- Recalls ----------
    async function loadRecalls(){
      try {
        const [{ data: recalls, error, count: recallCount }, { data: lots }, { data: failedChecks }] = await Promise.all([
          supabase.from('recalls')
            .select('id, reason, severity, status, quantity_quarantined, resolution, resolved_at, incident_id, created_at, lot_id, product_id, products(name, sku), inventory_lots(lot_number), incidents(incident_number, status)', { count: 'exact' })
            .order('created_at', { ascending: false }),
          fetchAllRows('inventory_lots', 'id, lot_number, product_id, quantity_remaining, received_at, products(name, sku)', q => q)
            .then(rows => ({ data: rows.sort((a, b) => String(b.received_at || '').localeCompare(String(a.received_at || ''))) }), () => ({ data: [] })),
          supabase.from('quality_checks').select('lot_id, product_id').eq('result', 'fail').is('resolution', null),
        ]);
        if (error) throw error;
        const rows = recalls || [];
        showPageWarning('recallsPanel', typeof recallCount === 'number' && recallCount > rows.length ? 'Showing the newest ' + rows.length + ' of ' + recallCount + ' recalls: older ones are not listed on this page.' : null);
        SEARCH_INDEX.recalls = rows;

        // Cross-link with Quality Control: flag when this same lot (or
        // product, if the recall isn't tied to one lot) also has an
        // unresolved failed check sitting on the other page.
        const failedLots = new Set((failedChecks || []).filter(c => c.lot_id).map(c => c.lot_id));
        const failedProducts = new Set((failedChecks || []).filter(c => !c.lot_id && c.product_id).map(c => c.product_id));

        const active = rows.filter(r => r.status !== 'resolved');
        const quarantinedUnits = rows.reduce((s, r) => s + (r.status !== 'initiated' ? Number(r.quantity_quarantined || 0) : 0), 0);
        // EXT20J: built as DOM nodes (h() text-ifies) instead of an HTML string, so
        // the Recalls screen is safe under Trusted Types. Values were already
        // esc()-ed; now they are text nodes.
        document.getElementById('recallStats').replaceChildren(
          h('div', { class: 'stat' }, h('div', { class: 'num' }, active.length), h('div', { class: 'lbl' }, 'Active recalls')),
          h('div', { class: 'stat' }, h('div', { class: 'num' }, quarantinedUnits), h('div', { class: 'lbl' }, 'Units quarantined')));

        const lotSel = document.getElementById('recallLot');
        const keep = lotSel.value;
        lotSel.replaceChildren(h('option', { value: '' }, 'Which lot?…'), ...(lots || []).map(l => {
          const prod = (l.products && l.products.name) || 'Unknown product';
          return h('option', { value: l.id }, prod + ' — lot ' + l.lot_number + ' (' + Number(l.quantity_remaining) + ' left)');
        }));
        lotSel.value = keep;

        const recallRow = r => {
          const prod = (r.products && r.products.name) || 'Unlinked';
          const lot = (r.inventory_lots && r.inventory_lots.lot_number) || '?';
          const incident = r.incidents;
          const statusClass = r.status === 'resolved' ? 'sev-low' : 'sev-high';
          const alsoFailedQc = (r.lot_id && failedLots.has(r.lot_id)) || (!r.lot_id && r.product_id && failedProducts.has(r.product_id));
          return h('div', { class: 'deletedRow u-ai-flex-start', 'data-id': r.id, 'data-status': r.status || '', 'data-lot': r.lot_id || '' },
            h('div', { class: 'info u-flex-1' },
              h('b', null, prod + ' — lot ' + lot), ' ',
              h('span', { class: 'badge ' + statusClass }, RECALL_STATUS_LABELS[r.status] || r.status), ' ',
              h('span', { class: 'badge' }, QC_SEVERITY_LABELS[r.severity] || r.severity), ' ',
              h('span', { class: 'u-c-muted u-fs-12' }, fmtDate(r.created_at)),
              h('div', { class: 'u-mt-6' }, r.reason),
              r.quantity_quarantined != null ? h('div', { class: 'u-mt-6' }, Number(r.quantity_quarantined) + ' units pulled from Available into Recalled.') : null,
              r.resolution ? h('div', { class: 'u-mt-6 u-c-x4d7c6a' }, h('b', null, 'Resolved:'), ' ' + r.resolution) : null,
              incident ? h('div', { class: 'u-mt-6' }, h('span', { class: 'badge' }, 'Incident ' + (incident.incident_number || '') + ' — ' + incident.status)) : null,
              alsoFailedQc ? h('div', { class: 'u-mt-6' }, h('span', { class: 'badge sev-high' }, 'This batch also has a failed quality check'), ' ', h('a', { href: '#', class: 'recallViewQcLink u-fs-12' }, 'View in Quality Control →')) : null,
              r.status !== 'resolved' ? h('div', { class: 'u-mt-10 u-d-flex u-gap-8 u-fwr-wrap u-ai-center' },
                r.status === 'initiated' ? h('button', { type: 'button', class: 'small deny recallQuarantineBtn' }, 'Quarantine stock') : null,
                !r.incident_id ? h('button', { type: 'button', class: 'small secondary recallEscalateBtn' }, 'Escalate to Incident') : null,
                h('input', { type: 'text', class: 'recallResolutionInput u-flex-1 u-minw-160 u-p-6-9 u-br-6 u-b-1-solid-xcfd8d6 u-ff-inherit u-fs-13', placeholder: 'Resolution notes' }),
                h('button', { type: 'button', class: 'small secondary recallResolveBtn' }, 'Mark resolved')) : null));
        };
        document.getElementById('recallsWrap').replaceChildren(...(rows.length ? rows.map(recallRow) : [h('p', { class: 'empty' }, 'No recalls — hopefully it stays that way.')]));

        document.querySelectorAll('.recallViewQcLink').forEach(link => {
          link.addEventListener('click', (e) => { e.preventDefault(); showPage('qualityControlPanel'); });
        });

        document.querySelectorAll('.recallQuarantineBtn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const row = btn.closest('[data-id]');
            const id = row.getAttribute('data-id');
            const lotId = row.getAttribute('data-lot');
            if (!canChangeStock()) { showDashError('Only the Owner or an Administrator can change stock. Nothing was changed.'); return; }
            btn.disabled = true;
            // EXT9: R2 (quarantine_recall) when its switch is on: the recall
            // status, both stock buckets and their history in one transaction.
            if (await stockFunctionOn('recall')) {
              try {
                const r = await callStockFunction('quarantine_recall', { p_recall_id: id });
                if (r.already_done) toast('That recall was already handled — no stock was moved again.');
                else toastOk(Number(r.quantity_quarantined || 0) + ' units quarantined.');
              } catch (err) {
                showDashError(err.hint === 'nothing_to_quarantine'
                  ? 'There’s nothing left in Available for this lot to quarantine — check Inventory directly if stock needs adjusting by hand. Nothing was changed.'
                  : 'Could not quarantine that stock. ' + stockFunctionError(err, 'the quarantine', true));
              }
              loadRecalls();
              safeRun(loadInventory);
              safeRun(loadAttention);
              return;
            }
            try {
              const uid = await currentUserId();
              const { data: lot, error: lotErr } = await supabase.from('inventory_lots')
                .select('*').eq('id', lotId).single();
              if (lotErr) throw lotErr;
              const { data: inv, error: invReadErr } = await supabase.from('inventory')
                .select('*').eq('product_id', lot.product_id).maybeSingle();
              if (invReadErr) throw invReadErr;
              const amount = Math.min(Number(lot.quantity_remaining || 0), Number((inv && inv.available) || 0));
              if (amount <= 0) {
                showDashError('There’s nothing left in Available for this lot to quarantine — check Inventory directly if stock needs adjusting by hand.');
                btn.disabled = false;
                return;
              }
              // Claim first: only the click that moves the recall from
              // Initiated to Quarantined moves stock, so a double click, a
              // second tab or a retry can't quarantine the lot twice.
              const claimed = await updateIfUnchanged('recalls', id, {
                status: 'quarantined', quantity_quarantined: amount, updated_at: new Date().toISOString(),
              }, { status: 'initiated' });
              if (!claimed) {
                showDashError(staleMessage('That recall') + ' No stock was moved.');
                loadRecalls();
                return;
              }
              try {
                await changeStock(lot.product_id, { available: -amount, recalled: amount }, uid);
                const { error: adj1Err } = await supabase.from('inventory_adjustments').insert({
                  product_id: lot.product_id, bucket: 'available', change_amount: -amount,
                  reason: 'Recall — quarantined', adjusted_by: uid, lot_id: lotId,
                });
                if (adj1Err) throw adj1Err;
                const { error: adj2Err } = await supabase.from('inventory_adjustments').insert({
                  product_id: lot.product_id, bucket: 'recalled', change_amount: amount,
                  reason: 'Recall — quarantined', adjusted_by: uid, lot_id: lotId,
                });
                if (adj2Err) throw adj2Err;
                toastOk(amount + ' units quarantined.');
              } catch (stockErr) {
                showDashError('The recall is marked Quarantined, but moving the stock did not finish: '
                  + (stockErr && stockErr.message ? stockErr.message : stockErr)
                  + ' Check Inventory for this product — the units may still be in Available — and move them to Recalled by hand. Do not quarantine again.');
              }
              loadRecalls();
              safeRun(loadInventory);
              safeRun(loadAttention);
            } catch (err) {
              btn.disabled = false;
              if (isNetworkError(err)) {
                const outcome = await claimOutcomeAfterDrop('recalls', id, 'initiated', 'quarantined');
                if (outcome === 'not_saved') {
                  showDashError('The connection dropped and the recall was NOT marked Quarantined. Nothing was changed; you can press Quarantine again.');
                } else if (outcome === 'saved') {
                  btn.disabled = true;
                  showDashError('The connection dropped after the recall was marked Quarantined, so moving the stock did NOT run from this screen. Check Inventory for this product: if the units are still in Available, move them to Recalled by hand (reason: "Recall — quarantined"). Do not quarantine again.');
                  loadRecalls();
                } else {
                  showDashError('The connection dropped and the dashboard cannot tell whether this recall was marked Quarantined. Reload the page and check its status before pressing again; if it shows Quarantined, check Inventory too.');
                }
                return;
              }
              showDashError('Could not quarantine that stock — nothing was changed: ' + (err && err.message ? err.message : err));
            }
          });
        });

        document.querySelectorAll('.recallEscalateBtn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const row = btn.closest('[data-id]');
            const id = row.getAttribute('data-id');
            const recall = rows.find(r => r.id === id);
            if (!recall) return;
            btn.disabled = true;
            try {
              const uid = await currentUserId();
              const prod = (recall.products && recall.products.name) || 'Unlinked product';
              const lot = (recall.inventory_lots && recall.inventory_lots.lot_number) || '?';
              const done = await escalateToIncidentOnce('recalls', id, {
                category: 'product_safety',
                severity: recall.severity,
                status: 'open',
                title: 'Recall — ' + prod + ' lot ' + lot,
                description: recall.reason,
                requires_approval: false,
                created_by: uid,
              });
              if (done) toastOk('Escalated to Incidents.');
              loadRecalls();
              safeRun(loadIncidents);
            } catch (err) {
              btn.disabled = false;
              showDashError('Could not escalate that: ' + (err && err.message ? err.message : err));
            }
          });
        });

        document.querySelectorAll('.recallResolveBtn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const row = btn.closest('[data-id]');
            const id = row.getAttribute('data-id');
            const note = row.querySelector('.recallResolutionInput').value.trim();
            const seen = row.getAttribute('data-status') || null;
            // A recall is a compliance record: closing it needs a written
            // reason, and closing one whose stock was never quarantined needs
            // a second, deliberate press.
            if (!note) { showDashError('Write what resolved this recall (resolution notes) before marking it resolved.'); return; }
            if (seen === 'initiated' && !confirmSecondPress(btn, 'Stock never quarantined — resolve anyway?')) return;
            btn.disabled = true;
            try {
              const changed = await updateIfUnchanged('recalls', id, {
                status: 'resolved', resolution: note, resolved_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }, { status: seen });
              if (changed) toastOk('Recall resolved.');
              else showDashError(staleMessage('That recall'));
              loadRecalls();
              safeRun(loadAttention);
            } catch (err) {
              btn.disabled = false;
              showDashError('Could not resolve that: ' + (err && err.message ? err.message : err));
            }
          });
        });
      } catch (err) {
        document.getElementById('recallsWrap').replaceChildren();
        showDashError('Could not load recalls: ' + (err && err.message ? err.message : err));
      }
    }

    document.getElementById('addRecallForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const lotId = document.getElementById('recallLot').value;
      const reason = document.getElementById('recallReason').value.trim();
      if (!lotId) { toast('Pick which lot this is about first.'); return; }
      if (!reason) { toast('Say why this batch is being recalled.'); return; }
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        const uid = await currentUserId();
        const { data: lot, error: lotErr } = await supabase.from('inventory_lots')
          .select('product_id').eq('id', lotId).single();
        if (lotErr) throw lotErr;
        const rk = await formRequestKey(e.target);
        const { error: insErr } = await supabase.from('recalls').insert(withRequestKey({
          lot_id: lotId,
          product_id: lot.product_id,
          reason: reason,
          severity: document.getElementById('recallSeverity').value,
          created_by: uid,
        }, rk));
        const repeat = isRequestKeyRepeat(insErr);
        if (insErr && !repeat) throw insErr;
        document.getElementById('recallReason').value = '';
        clearRequestKey(e.target);
        if (repeat) toast('That recall' + REPEAT_NOTE); else toastOk('Recall initiated.');
        loadRecalls();
        safeRun(loadAttention);
      } catch (err) {
        showDashError('Could not initiate that recall: ' + (err && err.message ? err.message : err));
      } finally { btn.disabled = false; }
    });

    // ---------- Calendar ----------
    // Three ways to look at the same data: Day and Week list every appointment
    // with its time (what you actually need to run a day), Month keeps the
    // overview. Calendars can be shown or hidden, and each event can carry a
    // private note — stored in its own table keyed to the event's Apple ID, so
    // the nightly sync can never overwrite it.
    let calView = 'day';
    let calCursor = new Date(); calCursor.setHours(0, 0, 0, 0);
    let calEvents = [];
    let calNotes = Object.create(null);            // event uid -> note text
    let calHidden = new Set();    // calendar names switched off
    let calOpenUid = null;        // which event is expanded

    try {
      const savedView = localStorage.getItem('he_cal_view');
      if (['day','week','month'].includes(savedView)) calView = savedView;
    } catch (e) { /* fine, default to Day */ }

    function calRange(){
      const start = new Date(calCursor);
      const end = new Date(calCursor);
      if (calView === 'day') { end.setDate(end.getDate() + 1); }
      else if (calView === 'week') {
        start.setDate(start.getDate() - start.getDay());
        end.setTime(start.getTime()); end.setDate(end.getDate() + 7);
      } else {
        start.setDate(1);
        start.setDate(start.getDate() - start.getDay());
        end.setTime(start.getTime()); end.setDate(end.getDate() + 42);
      }
      start.setHours(0,0,0,0); end.setHours(0,0,0,0);
      return { start, end };
    }
    function calLabel(){
      if (calView === 'day') {
        return calCursor.toLocaleDateString(undefined, { weekday:'long', month:'long', day:'numeric', year:'numeric' });
      }
      if (calView === 'week') {
        const { start } = calRange();
        const last = new Date(start); last.setDate(last.getDate() + 6);
        const sameMonth = start.getMonth() === last.getMonth();
        return start.toLocaleDateString(undefined, { month:'short', day:'numeric' }) + ' – ' +
               last.toLocaleDateString(undefined, sameMonth ? { day:'numeric', year:'numeric' } : { month:'short', day:'numeric', year:'numeric' });
      }
      return calCursor.toLocaleDateString(undefined, { month:'long', year:'numeric' });
    }
    function visibleEvents(){
      return calEvents.filter(ev => !calHidden.has(ev.calendar_name || 'Other'));
    }

    function renderCalFilters(){
      const names = [...new Set(calEvents.map(ev => ev.calendar_name || 'Other'))].sort();
      const box = document.getElementById('calFilters');
      if (!names.length) { box.replaceChildren(); return; }
      box.innerHTML = names.map(n => {
        const off = calHidden.has(n);
        return '<button type="button" class="calChipBtn' + (off ? ' off' : '') + '" data-cal="' + esc(n) + '">' +
          '<span class="swatch u-bg-colorforcalendar-n"></span>' + esc(n) + '</button>';
      }).join('');
      box.querySelectorAll('.calChipBtn').forEach(btn => {
        btn.addEventListener('click', () => {
          const n = btn.getAttribute('data-cal');
          if (calHidden.has(n)) calHidden.delete(n); else calHidden.add(n);
          renderCalFilters();
          renderCalendar();
        });
      });
    }

    function eventHtml(ev){
      const note = calNotes[ev.uid];
      const time = ev.all_day ? '<span class="calAllDay">All day</span>' : esc(fmtTimeShort(ev.starts_at)) +
        (ev.ends_at && !ev.all_day ? '<br><span class="u-op-65">' + esc(fmtTimeShort(ev.ends_at)) + '</span>' : '');
      const open = calOpenUid === ev.uid;
      const personal = calMode === 'personal';
      return '<div class="calEvent' + (open ? ' selected' : '') + '" data-uid="' + esc(ev.uid) + '">' +
          '<div class="eTime">' + time + '</div>' +
          '<div class="eBar u-bg-colorforcalendar-ev-calendar-name"></div>' +
          '<div class="eBody">' +
            '<div class="eTitle">' + esc(ev.summary || 'Event') + '</div>' +
            (ev.location ? '<div class="eSub">' + esc(ev.location) + '</div>' : '') +
            (personal ? '' : '<div class="eSub">' + esc(ev.calendar_name || 'Other') + '</div>') +
            (!personal && note && !open ? '<div class="eNote">' + esc(note) + '</div>' : '') +
            (open ? (personal ? personalEventEditorHtml(ev) : noteEditorHtml(ev)) : '') +
          '</div>' +
        '</div>';
    }
    function noteEditorHtml(ev){
      // EXT9: data-had / data-shown = the note as shown (none, or its text).
      return '<div class="calNoteBox" data-noteuid="' + esc(ev.uid) + '" data-had="' + (calNotes[ev.uid] != null ? '1' : '0') + '" data-shown="' + esc(calNotes[ev.uid] || '') + '">' +
        '<textarea class="calNoteText" placeholder="Add a note for yourself about this appointment…">' +
          esc(calNotes[ev.uid] || '') + '</textarea>' +
        '<div class="calNoteRow">' +
          '<button type="button" class="small calNoteSave">Save note</button>' +
          (calNotes[ev.uid] ? '<button type="button" class="small secondary calNoteDelete">Remove</button>' : '') +
          '<span class="saved"></span>' +
        '</div></div>';
    }
    function dayGroupHtml(date, events){
      const key = dateKey(date);
      const isToday = key === dateKey(new Date());
      const head = '<div class="calDayHead' + (isToday ? ' isToday' : '') + '">' +
        '<span class="dName">' + esc(date.toLocaleDateString(undefined, { weekday:'long' })) + '</span>' +
        '<span class="dMeta">' + esc(date.toLocaleDateString(undefined, { month:'short', day:'numeric' })) +
        ' · ' + (events.length ? events.length + (events.length === 1 ? ' appointment' : ' appointments') : 'nothing scheduled') +
        '</span></div>';
      if (!events.length) return '<div class="calDayGroup">' + head + '<p class="empty">Nothing scheduled.</p></div>';

      let body = '';
      const now = new Date();
      let nowDrawn = !isToday;
      events.forEach(ev => {
        if (!nowDrawn && !ev.all_day && new Date(ev.starts_at) > now) {
          body += '<div class="calNowLine"><span class="dot"></span><span class="line"></span></div>';
          nowDrawn = true;
        }
        body += eventHtml(ev);
      });
      if (!nowDrawn) body += '<div class="calNowLine"><span class="dot"></span><span class="line"></span></div>';
      return '<div class="calDayGroup">' + head + body + '</div>';
    }
    function eventsOn(date){
      const key = dateKey(date);
      return visibleEvents()
        .filter(ev => eventDateKey(ev) === key)
        .sort((a, b) => (a.all_day === b.all_day)
          ? new Date(a.starts_at) - new Date(b.starts_at)
          : (a.all_day ? -1 : 1));
    }

    function renderCalendar(){
      document.getElementById('calMonthLabel').textContent = calLabel();
      document.querySelectorAll('#calViewToggle [data-calview]').forEach(b =>
        b.className = 'small' + (b.getAttribute('data-calview') === calView ? '' : ' secondary'));
      const body = document.getElementById('calBody');

      if (calView === 'day') {
        body.innerHTML = dayGroupHtml(new Date(calCursor), eventsOn(calCursor));
      } else if (calView === 'week') {
        const { start } = calRange();
        let out = '';
        for (let i = 0; i < 7; i++) {
          const d = new Date(start); d.setDate(start.getDate() + i);
          out += dayGroupHtml(d, eventsOn(d));
        }
        body.innerHTML = out;
      } else {
        const { start } = calRange();
        const month = calCursor.getMonth();
        const todayKey = dateKey(new Date());
        let cells = '<div class="calGrid">' +
          ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => '<div class="calDow">' + d + '</div>').join('') +
          '</div><div class="calGrid u-mt-6">';
        for (let i = 0; i < 42; i++) {
          const d = new Date(start); d.setDate(start.getDate() + i);
          const key = dateKey(d);
          const evs = eventsOn(d);
          const shown = evs.slice(0, 3);
          cells += '<div class="calCell' + (d.getMonth() !== month ? ' otherMonth' : '') +
            (key === todayKey ? ' today' : '') + '" data-daykey="' + key + '">' +
            '<div class="dNum">' + d.getDate() + '</div>' +
            shown.map(ev => '<span class="calChip" title="' + esc(ev.summary || 'Event') + '">' +
              '<span class="cDot u-bg-colorforcalendar-ev-calendar-name"></span>' +
              '<span class="cText">' + esc(ev.summary || 'Event') + '</span></span>').join('') +
            (evs.length > shown.length ? '<div class="calMore">+' + (evs.length - shown.length) + ' more</div>' : '') +
            '</div>';
        }
        body.innerHTML = cells + '</div>';
        body.querySelectorAll('.calCell').forEach(cell => {
          cell.addEventListener('click', () => {
            calCursor = new Date(cell.getAttribute('data-daykey') + 'T00:00:00');
            setCalView('day');
          });
        });
      }
      wireCalEvents();
    }

    function wireCalEvents(){
      const body = document.getElementById('calBody');
      body.querySelectorAll('.calEvent').forEach(el => {
        el.addEventListener('click', (e) => {
          if (e.target.closest('.calNoteBox')) return;   // don't collapse while editing
          const uid = el.getAttribute('data-uid');
          calOpenUid = (calOpenUid === uid) ? null : uid;
          renderCalendar();
        });
      });
      body.querySelectorAll('.calNoteBox').forEach(box => {
        const uid = box.getAttribute('data-noteuid');
        const ta = box.querySelector('.calNoteText');
        const saveBtn = box.querySelector('.calNoteSave');
        const delBtn = box.querySelector('.calNoteDelete');
        setTimeout(() => ta && ta.focus(), 20);
        if (saveBtn) saveBtn.addEventListener('click', async () => {
          const text = (ta.value || '').trim();
          if (!text) { toast('Write something first.'); return; }
          saveBtn.disabled = true;
          try {
            const uidUser = await currentUserId();
            // EXT9: never overwrite a note saved elsewhere meanwhile (was an
            // upsert: the last save silently replaced the other one). A new
            // note is an insert (refused if one appeared meanwhile); an edit
            // only applies while the note is still the one shown.
            let saved = false;
            if (box.getAttribute('data-had') === '1') {
              const { data: rows, error } = await supabase.from('calendar_notes')
                .update({ note: text, updated_at: new Date().toISOString() })
                .eq('event_uid', uid).eq('note', box.getAttribute('data-shown')).select('event_uid');
              if (error) throw error;
              saved = !noRowsChanged(rows);
            } else {
              const { error } = await supabase.from('calendar_notes')
                .insert({ event_uid: uid, note: text, created_by: uidUser, updated_at: new Date().toISOString() });
              if (error && String(error.code) !== '23505') throw error;
              saved = !error;
            }
            if (!saved) {
              showDashError('That note was changed or added somewhere else (another tab or person) since you opened it, so yours was not saved and nothing was overwritten. The calendar has been refreshed: open the note again to see the latest text. Your text: “' + text + '”');
              saveBtn.disabled = false;
              loadCalendarMonth();
              return;
            }
            calNotes[uid] = text;
            toastOk('Note saved.');
            calOpenUid = null;
            renderCalendar();
          } catch (err) {
            saveBtn.disabled = false;
            showDashError('Could not save that note: ' + (err && err.message ? err.message : err));
          }
        });
        if (delBtn) delBtn.addEventListener('click', async () => {
          delBtn.disabled = true;
          try {
            const { data: gone, error } = await supabase.from('calendar_notes').delete().eq('event_uid', uid).select('event_uid');
            if (error) throw error;
            if (noRowsChanged(gone)) { showDashError(staleMessage('That note')); return; }
            delete calNotes[uid];
            toastOk('Note removed.');
            calOpenUid = null;
            renderCalendar();
          } catch (err) {
            delBtn.disabled = false;
            showDashError('Could not remove that note: ' + (err && err.message ? err.message : err));
          }
        });
        if (ta) ta.addEventListener('keydown', (e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); saveBtn.click(); }
          if (e.key === 'Escape') { e.preventDefault(); calOpenUid = null; renderCalendar(); }
        });
      });

      // Personal calendar: save changes to, or delete, one of your own events.
      body.querySelectorAll('.calNoteBox[data-personaluid]').forEach(box => {
        const id = box.getAttribute('data-personaluid');
        const titleInput = box.querySelector('.personalEditTitle');
        const startInput = box.querySelector('.personalEditStart');
        const endInput = box.querySelector('.personalEditEnd');
        const allDayInput = box.querySelector('.personalEditAllDay');
        const saveBtn = box.querySelector('.personalEditSave');
        const delBtn = box.querySelector('.personalEditDelete');
        setTimeout(() => titleInput && titleInput.focus(), 20);
        if (saveBtn) saveBtn.addEventListener('click', async () => {
          const title = (titleInput.value || '').trim();
          if (!title) { toast('Give the event a title first.'); return; }
          if (!startInput.value) { toast('Pick when it starts first.'); return; }
          saveBtn.disabled = true;
          try {
            const times = personalTimesFromInputs(startInput.value, endInput.value, allDayInput.checked);
            // EXT9: only while the event is still as shown (another tab may have changed it).
            let shownEv = null;
            try { shownEv = JSON.parse(box.getAttribute('data-shown') || 'null'); } catch (e) { shownEv = null; }
            const ok = await updateIfUnchanged('personal_calendar_events', id, {
              title,
              starts_at: times.starts_at,
              ends_at: times.ends_at,
              all_day: !!allDayInput.checked,
              updated_at: new Date().toISOString(),
            }, shownEv || {});
            if (!ok) { showDashError(staleMessage('That event')); saveBtn.disabled = false; loadCalendarMonth(); return; }
            toastOk('Event updated.');
            calOpenUid = null;
            loadCalendarMonth();
          } catch (err) {
            saveBtn.disabled = false;
            showDashError('Could not save that event: ' + (err && err.message ? err.message : err));
          }
        });
        if (delBtn) delBtn.addEventListener('click', async () => {
          if (!confirm('Delete this event? This can\'t be undone.')) return;
          delBtn.disabled = true;
          try {
            const { data: gone, error } = await supabase.from('personal_calendar_events').delete().eq('id', id).select('id');
            if (error) throw error;
            if (noRowsChanged(gone)) { showDashError(staleMessage('That event')); delBtn.disabled = false; loadCalendarMonth(); return; }
            toastOk('Event deleted.');
            calOpenUid = null;
            loadCalendarMonth();
          } catch (err) {
            delBtn.disabled = false;
            showDashError('Could not delete that event: ' + (err && err.message ? err.message : err));
          }
        });
        box.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') { e.preventDefault(); calOpenUid = null; renderCalendar(); }
        });
      });
    }

    async function loadCalendarMonth(){
      const isLatest = newLoadToken('calendar'); // EXT8: an older reply never draws over a newer one
      applyCalendarMode();
      try {
        const { start, end } = calRange();

        if (calMode === 'personal') {
          // Your own events only (the database enforces this too). Start one
          // day early so all-day events on the first visible day aren't missed.
          const from = new Date(start); from.setDate(from.getDate() - 1);
          const uid = await currentUserId();
          const { data: rows, error } = await supabase
            .from('personal_calendar_events')
            .select('id, title, starts_at, ends_at, all_day')
            .eq('owner_id', uid)
            .gte('starts_at', from.toISOString())
            .lt('starts_at', end.toISOString())
            .order('starts_at', { ascending: true });
          if (error) throw error;
          if (!isLatest()) return;
          // Reshape into the same form the Apple calendar uses, so the exact
          // same Day / Week / Month views draw them.
          calEvents = (rows || []).map(r => ({
            id: r.id,
            uid: r.id,
            calendar_name: 'My Calendar',
            summary: r.title,
            location: null,
            starts_at: r.starts_at,
            ends_at: r.ends_at,
            all_day: r.all_day,
          }));
          calNotes = Object.create(null);
          renderCalFilters();
          renderCalendar();
          return;
        }

        const { data: events, error } = await supabase
          .from('calendar_events')
          .select('id, uid, calendar_name, summary, location, starts_at, ends_at, all_day')
          .gte('starts_at', start.toISOString())
          .lt('starts_at', end.toISOString())
          .order('starts_at', { ascending: true });
        if (error) throw error;
        if (!isLatest()) return;
        calEvents = events || [];

        // Notes are optional — if the table isn't there yet, the calendar still works.
        const uids = calEvents.map(e => e.uid).filter(Boolean);
        calNotes = Object.create(null);
        // In small batches: event ids can be long, and one URL holding
        // hundreds of them is refused by the gateway (all notes vanished).
        // It used to stop at 300 events, silently.
        for (let i = 0; i < uids.length; i += 50) {
          const { data: notes } = await supabase.from('calendar_notes')
            .select('event_uid, note').in('event_uid', uids.slice(i, i + 50));
          (notes || []).forEach(n => { calNotes[n.event_uid] = n.note; });
        }
        if (!isLatest()) return;
        renderCalFilters();
        renderCalendar();
      } catch (err) {
        if (!isLatest()) return;
        document.getElementById('calBody').replaceChildren();
        showDashError('Could not load the calendar: ' + (err && err.message ? err.message : err));
      }
    }

    function setCalView(v){
      calView = v;
      calOpenUid = null;
      try { localStorage.setItem('he_cal_view', v); } catch (e) { /* not critical */ }
      loadCalendarMonth();
    }
    function calStep(dir){
      if (calView === 'day') calCursor.setDate(calCursor.getDate() + dir);
      else if (calView === 'week') calCursor.setDate(calCursor.getDate() + 7 * dir);
      else calCursor.setMonth(calCursor.getMonth() + dir);
      calOpenUid = null;
      loadCalendarMonth();
    }
    function calToday(){
      calCursor = new Date(); calCursor.setHours(0,0,0,0);
      calOpenUid = null;
      loadCalendarMonth();
    }
    // Add a new event to your own personal calendar.
    const addPersonalEventForm = document.getElementById('addPersonalEventForm');
    if (addPersonalEventForm) addPersonalEventForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const titleEl = document.getElementById('personalEventTitle');
      const startEl = document.getElementById('personalEventStart');
      const endEl = document.getElementById('personalEventEnd');
      const allDayEl = document.getElementById('personalEventAllDay');
      const btn = document.getElementById('addPersonalEventBtn');
      const title = (titleEl.value || '').trim();
      if (!title || !startEl.value) { toast('Add a title and a start time.'); return; }
      if (endEl.value && endEl.value < startEl.value) { toast('The end time is before the start time.'); return; }
      btn.disabled = true;
      try {
        const uid = await currentUserId();
        const times = personalTimesFromInputs(startEl.value, endEl.value, allDayEl.checked);
        const { error } = await insertOnce(addPersonalEventForm, 'personal_calendar_events', {
          owner_id: uid,
          title,
          starts_at: times.starts_at,
          ends_at: times.ends_at,
          all_day: !!allDayEl.checked,
        }, 'That event');
        if (error) throw error;
        addPersonalEventForm.reset();
        toastOk('Event added.');
        // Jump the calendar to the day you just added so you can see it.
        calCursor = new Date(startEl.value.slice(0, 10) + 'T00:00:00');
        loadCalendarMonth();
      } catch (err) {
        showDashError('Could not add that event: ' + (err && err.message ? err.message : err));
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById('calPrevBtn').addEventListener('click', () => calStep(-1));
    document.getElementById('calNextBtn').addEventListener('click', () => calStep(1));
    document.getElementById('calTodayBtn').addEventListener('click', calToday);
    document.querySelectorAll('#calViewToggle [data-calview]').forEach(btn => {
      btn.addEventListener('click', () => setCalView(btn.getAttribute('data-calview')));
    });

    // ---------- dashboard data ----------
    async function loadDashboard(){
      clearDashError();
      paintSkeletons();
      // EXT10b: a plain marker of whether the sign-in load of every page has finished
      document.body.dataset.loaded = 'loading';
      const first = currentPageId || getLastPage();
      const firstSet = PANEL_LOADERS[first] || [];
      await Promise.all(firstSet.map(safeRun));
      refreshChrome();
      const rest = [];
      Object.keys(PANEL_LOADERS).forEach(id => { if (id !== first) rest.push.apply(rest, PANEL_LOADERS[id]); });
      for (let i = 0; i < rest.length; i += 4) {
        await Promise.all(rest.slice(i, i + 4).map(safeRun));
        refreshChrome();
      }
      document.body.dataset.loaded = 'all';
    }

    async function loadOrders(){
      try {
        const { data: orders, error, count } = await supabase
          .from('orders')
          .select('id, order_number, customer_name, customer_email, status, currency, total, placed_at, deleted_at', { count: 'exact' })
          .is('deleted_at', null)
          .order('placed_at', { ascending: false })
          .limit(300);
        if (error) throw error;
        SEARCH_INDEX.orders = orders;

        // EXT6: the order count is exact (Supabase's count), but this read
        // holds the newest 300 orders only. The revenue used to add up just
        // those 300, cancelled and refunded included, under the label "Total
        // revenue". It now uses the Accounting rule, and says plainly when it
        // covers only the newest orders (full totals: Accounting).
        const counted = orders.filter(o => {
          const c = classifyOrderStatus(o.status);
          return !(c.isCancelled || (c.isRefund && !c.isPartialRefund));
        });
        const totalRevenue = counted.reduce((sum, o) => sum + Number(o.total || 0), 0);
        const currency = (orders[0] && orders[0].currency) || 'USD';
        const totalOrders = (count != null ? count : orders.length);
        const partialRevenue = totalOrders > orders.length;
        const revenueLabel = partialRevenue
          ? 'Revenue of the newest ' + orders.length + ' orders (all orders: Accounting)'
          : 'Total revenue (cancelled and refunded excluded)';
        // EXT20J: built as DOM nodes (h() text-ifies) instead of an HTML string,
        // so the Orders screen is safe under Trusted Types. Values were already
        // esc()-ed. A failed revenue read still reaches this point only with real
        // numbers; a thrown read is caught below and shows the error, never $0.00.
        document.getElementById('orderStats').replaceChildren(
          h('div', { class: 'stat' }, h('div', { class: 'num' }, totalOrders), h('div', { class: 'lbl' }, 'Orders on file')),
          h('div', { class: 'stat' }, h('div', { class: 'num' }, fmtMoney(totalRevenue, currency)), h('div', { class: 'lbl' }, revenueLabel)));
        const ordersMixed = mixedCurrencyNote(orders, 'Orders', currency);
        showPageWarning('ordersPanel', ordersMixed); // X8-19

        const recent = orders.slice(0, 15);
        if (!recent.length) {
          document.getElementById('ordersTableWrap').replaceChildren(h('p', { class: 'empty' }, 'No orders yet.'));
        } else {
          const showingNoteNode = totalOrders > recent.length
            ? h('p', { class: 'hint u-m-0-0-8' }, `Showing the ${recent.length} most recent of ${totalOrders} orders total.`) : null;
          document.getElementById('ordersTableWrap').replaceChildren(...[
            showingNoteNode,
            h('table', { class: 'phoneCards' },
              h('thead', null, h('tr', null,
                h('th', null, 'Order #'), h('th', null, 'Customer'), h('th', null, 'Status'), h('th', null, 'Total'), h('th', null, 'Placed'), h('th'))),
              h('tbody', null, recent.map(o =>
                h('tr', { 'data-id': o.id },
                  h('td', null, o.order_number || o.id),
                  h('td', null, o.customer_name || '—'),
                  h('td', null, h('span', { class: 'badge' }, o.status || '—')),
                  h('td', null, fmtMoney(o.total, o.currency)),
                  h('td', null, fmtDate(o.placed_at)),
                  h('td', null, h('button', { class: 'small deny deleteOrderBtn' }, 'Delete'))))))
          ].filter(Boolean));
          document.querySelectorAll('.deleteOrderBtn').forEach(btn => {
            btn.addEventListener('click', async () => {
              const row = btn.closest('tr');
              const id = row.getAttribute('data-id');
              const ok = await requireReauth('delete this order');
              if (!ok) return;
              btn.disabled = true;
              try {
                // Soft delete, same as Feature Requests and Expenses: stamps
                // deleted_at instead of removing the row, so it lands in the
                // recycle bin below and Restore puts it right back.
                const { data: changed, error } = await supabase.from('orders')
                  .update({ deleted_at: new Date().toISOString() }).eq('id', id).is('deleted_at', null).select('id');
                if (error) throw error;
                if (noRowsChanged(changed)) { showDashError(staleMessage('That order')); loadOrders(); return; }
                toast('Order moved to the recycle bin');
                loadOrders();
              } catch (err) {
                btn.disabled = false;
                showDashError('Could not delete that order: ' + (err && err.message ? err.message : err));
              }
            });
          });
        }
        logCustomerAccess(recent, 'Viewed in Owner Dashboard – Orders panel');

        // deleted / recycle bin
        const { data: deleted, error: delErr, count: delCount } = await supabase
          .from('orders')
          .select('id, order_number, customer_name, customer_email, total, currency, deleted_at', { count: 'exact' })
          .not('deleted_at', 'is', null)
          .order('deleted_at', { ascending: false })
          .limit(listLimit('delOrders'));
        if (delErr) throw delErr;

        if (!deleted.length) {
          document.getElementById('deletedOrdersWrap').replaceChildren(h('p', { class: 'empty' }, 'Recycle bin is empty.'));
        } else {
          document.getElementById('deletedOrdersWrap').replaceChildren(...deleted.map(o =>
            h('div', { class: 'deletedRow', 'data-id': o.id },
              h('div', { class: 'info' },
                h('b', null, o.order_number || o.id), ' — ' + (o.customer_name || '—') + ' — ' + fmtMoney(o.total, o.currency),
                h('br'),
                h('span', { class: 'u-fs-11 u-c-muted' }, 'Deleted ' + fmtDate(o.deleted_at))),
              h('button', { class: 'small restoreOrderBtn' }, 'Restore'))));
        appendMore('deletedOrdersWrap', 'delOrders', deleted.length, delCount, 'deleted orders', loadOrders);
          logCustomerAccess(deleted, 'Viewed in Owner Dashboard – Recycle bin');
          document.querySelectorAll('.restoreOrderBtn').forEach(btn => {
            btn.addEventListener('click', async () => {
              const row = btn.closest('.deletedRow');
              const id = row.getAttribute('data-id');
              const ok = await requireReauth('restore this order');
              if (!ok) return;
              btn.disabled = true;
              try {
                // Only while it is still deleted (restored elsewhere = nothing to do).
                const { data: changed, error } = await supabase.from('orders').update({ deleted_at: null }).eq('id', id).not('deleted_at', 'is', null).select('id');
                if (error) throw error;
                if (noRowsChanged(changed)) showDashError(staleMessage('That order'));
                loadOrders();
              } catch (err) {
                btn.disabled = false;
                showDashError('Could not restore that order: ' + (err && err.message ? err.message : err));
              }
            });
          });
        }
      } catch (err) {
        showDashError('Could not load orders: ' + (err && err.message ? err.message : err));
      }
    }

    async function loadAI(){
      await loadAgentControls();
      try {
        const startOfMonth = new Date();
        startOfMonth.setUTCDate(1);
        startOfMonth.setUTCHours(0, 0, 0, 0);
        const SPEND_CAP = 30;

        const [{ data: logs, error }, { data: monthLogs, error: monthErr }, { data: modelConfig, error: modelErr }] = await Promise.all([
          supabase.from('ai_decision_log')
            .select('id, agent_key, output_summary, confidence, escalated_to_human, cost_usd, created_at')
            .order('created_at', { ascending: false })
            .limit(50),
          // every row of the month, not just the first 1,000 (finding N14)
          fetchAllRows('ai_decision_log', 'id, cost_usd', q => q.gte('created_at', startOfMonth.toISOString()))
            .then(rows => ({ data: rows, error: null }), err => ({ data: null, error: err })),
          supabase.from('ai_model_config')
            .select('agent_name, provider, model, fallback_provider, fallback_model'),
        ]);
        if (error) throw error;

        // EXT15: a failed month read is unknown ('?'), never "$0.00 spent, full cap remaining".
        const spendThisMonth = monthErr ? null : (monthLogs || []).reduce((s, l) => s + Number(l.cost_usd || 0), 0);
        // EXT20J: built as DOM nodes (h() text-ifies) instead of an HTML string, so
        // the AI activity screen is safe under Trusted Types. A failed month read
        // still shows '?' (never $0.00); values were already esc()-ed.
        document.getElementById('aiSpendStats').replaceChildren(
          h('div', { class: 'stat' }, h('div', { class: 'num' }, spendThisMonth == null ? '?' : fmtMoney(spendThisMonth, 'USD')), h('div', { class: 'lbl' }, 'Spent this month' + (spendThisMonth == null ? ' (could not be read)' : ''))),
          h('div', { class: 'stat' }, h('div', { class: 'num' }, fmtMoney(SPEND_CAP, 'USD')), h('div', { class: 'lbl' }, 'Monthly cap')),
          h('div', { class: 'stat' }, h('div', { class: 'num' }, spendThisMonth == null ? '?' : fmtMoney(Math.max(0, SPEND_CAP - spendThisMonth), 'USD')), h('div', { class: 'lbl' }, 'Remaining this month')));

        if (modelErr || !modelConfig || !modelConfig.length) {
          document.getElementById('aiModelConfigWrap').replaceChildren(h('p', { class: 'empty' }, 'No AI model configured yet.'));
        } else {
          document.getElementById('aiModelConfigWrap').replaceChildren(h('table', null,
            h('thead', null, h('tr', null, h('th', null, 'Agent'), h('th', null, 'Provider'), h('th', null, 'Model'), h('th', null, 'Fallback model'))),
            h('tbody', null, modelConfig.map(m =>
              h('tr', null,
                h('td', null, m.agent_name || '—'),
                h('td', null, m.provider || '—'),
                h('td', null, m.model || '—'),
                h('td', null, m.fallback_model || '— none set —'))))));
        }

        const totalCost = logs.reduce((s, l) => s + Number(l.cost_usd || 0), 0);
        const escalated = logs.filter(l => l.escalated_to_human).length;
        document.getElementById('aiStats').replaceChildren(
          h('div', { class: 'stat' }, h('div', { class: 'num' }, logs.length), h('div', { class: 'lbl' }, 'Recent decisions')),
          h('div', { class: 'stat' }, h('div', { class: 'num' }, fmtMoney(totalCost, 'USD')), h('div', { class: 'lbl' }, 'AI cost (recent)')),
          h('div', { class: 'stat' }, h('div', { class: 'num' }, escalated), h('div', { class: 'lbl' }, 'Escalated to human')));

        if (!logs.length) {
          document.getElementById('aiTableWrap').replaceChildren(h('p', { class: 'empty' }, 'No AI activity logged yet.'));
        } else {
          document.getElementById('aiTableWrap').replaceChildren(h('table', { class: 'phoneCards' },
            h('thead', null, h('tr', null, h('th', null, 'Agent'), h('th', null, 'Summary'), h('th', null, 'Confidence'), h('th', null, 'Escalated?'), h('th', null, 'When'))),
            h('tbody', null, logs.slice(0, 25).map(l =>
              h('tr', { 'data-id': l.id },
                h('td', null, l.agent_key),
                h('td', null, l.output_summary || '—'),
                h('td', null, l.confidence != null ? Math.round(l.confidence * 100) + '%' : '—'),
                h('td', null, l.escalated_to_human ? h('span', { class: 'badge sev-medium' }, 'Yes') : '—'),
                h('td', null, fmtDate(l.created_at)))))));
        }
      } catch (err) {
        showDashError('Could not load AI activity: ' + (err && err.message ? err.message : err));
      }
    }

    document.getElementById('inqFilter').addEventListener('change', () => renderInquiries());

    async function loadContinuity(){
      try {
        const { data: services, error } = await supabase
          .from('service_status')
          .select('id, service_name, category, status, notes, updated_at')
          .order('service_name', { ascending: true });
        if (error) throw error;

        // Two real, live signals — not just manual status — pulled from
        // activity that already exists elsewhere in the system.
        let lastCalendarSync = null;
        try {
          const { data: calRow } = await supabase
            .from('calendar_events')
            .select('synced_at')
            .order('synced_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          lastCalendarSync = calRow ? calRow.synced_at : null;
        } catch (e) { /* calendar_events may be empty — that's fine, just no signal */ }

        let lastAiCall = null;
        try {
          const { data: aiRow } = await supabase
            .from('ai_decision_log')
            .select('created_at')
            .eq('agent_key', 'customer_service_agent')
            .neq('model_used', 'rules-only')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          lastAiCall = aiRow ? aiRow.created_at : null;
        } catch (e) { /* no real AI calls logged yet — that's fine, just no signal */ }

        // EXT7: a status other than the three (or none) is counted and shown
        // as "Unknown", never folded into Operational.
        const counts = { operational: 0, degraded: 0, down: 0 };
        let unknownCount = 0;
        (services || []).forEach(s => { if (counts[s.status] !== undefined) counts[s.status]++; else unknownCount++; });
        // EXT20J: built as DOM nodes (h() text-ifies) instead of an HTML string.
        // An unknown/not-set status is still counted and shown separately, never
        // folded into Operational.
        document.getElementById('continuityStats').replaceChildren(...[
          h('div', { class: 'stat' }, h('div', { class: 'num' }, counts.operational), h('div', { class: 'lbl' }, 'Operational')),
          h('div', { class: 'stat' }, h('div', { class: 'num' }, counts.degraded), h('div', { class: 'lbl' }, 'Degraded')),
          h('div', { class: 'stat' }, h('div', { class: 'num' }, counts.down), h('div', { class: 'lbl' }, 'Down')),
          unknownCount ? h('div', { class: 'stat statWarn' }, h('div', { class: 'num' }, unknownCount), h('div', { class: 'lbl' }, 'Unknown / not set')) : null
        ].filter(Boolean));

        if (!services || !services.length) {
          document.getElementById('continuityWrap').replaceChildren(h('p', { class: 'empty' }, 'No services tracked yet.'));
          return;
        }

        const serviceRow = s => {
          let liveSignal = null;
          if (s.service_name === 'Apple Calendar Sync') {
            liveSignal = h('div', { class: 'u-fs-11p5 u-c-muted u-mt-3' }, lastCalendarSync ? `Last real sync: ${timeAgo(lastCalendarSync)} (${fmtDate(lastCalendarSync)})` : 'No sync recorded yet.');
          } else if (s.service_name === 'Anthropic AI API') {
            liveSignal = h('div', { class: 'u-fs-11p5 u-c-muted u-mt-3' }, lastAiCall ? `Last real AI call: ${timeAgo(lastAiCall)} (${fmtDate(lastAiCall)})` : 'No AI call logged yet.');
          }
          return h('div', { class: 'approvalRow u-ai-flex-start', 'data-id': s.id },
            h('div', { class: 'info' },
              h('b', null, s.service_name), ' ',
              s.category ? [h('span', { class: 'badge' }, s.category), ' '] : null,
              h('span', { class: 'badge ' + continuityBadgeClass(s.status) }, s.status || 'not set'),
              s.notes ? h('div', { class: 'u-fs-12 u-c-muted u-mt-3' }, s.notes) : null,
              liveSignal,
              h('div', { class: 'u-fs-11 u-c-muted u-mt-3' }, 'Status last set ' + fmtDate(s.updated_at))),
            h('div', { class: 'actions' },
              h('label', { class: 'u-fs-11p5 u-c-muted' },
                h('select', { class: 'continuityStatusSelect u-p-4-7 u-br-6 u-b-1-solid-xcfd8d6 u-ff-inherit u-fs-12p5', 'data-id': s.id },
                  ...(['operational', 'degraded', 'down'].includes(s.status) ? [] : [h('option', { value: s.status || '', selected: true, disabled: true }, 'Unknown (' + (s.status || 'not set') + ')')]),
                  h('option', { value: 'operational', selected: s.status === 'operational' ? true : null }, 'Operational'),
                  h('option', { value: 'degraded', selected: s.status === 'degraded' ? true : null }, 'Degraded'),
                  h('option', { value: 'down', selected: s.status === 'down' ? true : null }, 'Down')))));
        };
        document.getElementById('continuityWrap').replaceChildren(...services.map(serviceRow));

        document.querySelectorAll('.continuityStatusSelect').forEach(sel => sel.addEventListener('change', () => setServiceStatus(sel)));
      } catch (err) {
        showDashError('Could not load Business Continuity: ' + (err && err.message ? err.message : err));
      }
    }

    async function setServiceStatus(sel){
      const id = sel.getAttribute('data-id');
      const newVal = sel.value;
      sel.disabled = true;
      try {
        const shown = [...sel.options].find(o => o.defaultSelected);
        const ok = await updateIfUnchanged('service_status', id, { status: newVal, updated_at: new Date().toISOString() },
          { status: shown && shown.value ? shown.value : null });
        if (!ok) showDashError(staleMessage('That service status'));
        loadContinuity();
      } catch (err) {
        showDashError('Could not update that service status: ' + (err && err.message ? err.message : err));
        sel.disabled = false;
      }
    }

    async function loadDailySummary(){
      try {
        const { start, end } = getYesterdayRange();
        const startIso = start.toISOString();
        const endIso = end.toISOString();
        document.getElementById('dailySummaryDateLabel').textContent =
          start.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

        // Every row counts (see fetchAllRows): never a silently capped list.
        const between = (col) => q => q.gte(col, startIso).lt(col, endIso);
        const [ordersRows, inquiriesRows, tasksRows, incidentsRows, aiRows] = await Promise.all([
          fetchAllRows('orders', 'id, total, currency, status, deleted_at, placed_at', between('placed_at')),
          fetchAllRows('customer_inquiries', 'id, created_at', between('created_at')),
          fetchAllRows('tasks', 'id, created_at', between('created_at')),
          fetchAllRows('incidents', 'id, created_at', between('created_at')),
          fetchAllRows('ai_decision_log', 'id, cost_usd, model_used, created_at', between('created_at')),
        ]);
        const ordersRes = { data: ordersRows }, inquiriesRes = { data: inquiriesRows }, tasksRes = { data: tasksRows };
        const incidentsRes = { data: incidentsRows }, aiRes = { data: aiRows };

        const orders = (ordersRes.data || []).filter(o => !o.deleted_at);
        // EXT6: the same rule as Accounting and Tax Records (classifyOrderStatus).
        // It used to exclude only the exact word "cancelled", so "Canceled",
        // "CANCELLED" and fully refunded orders were counted as revenue here.
        const revenueOrders = orders.filter(o => {
          const c = classifyOrderStatus(o.status);
          return !(c.isCancelled || (c.isRefund && !c.isPartialRefund));
        });
        const revenue = revenueOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
        const currency = (orders[0] && orders[0].currency) || 'USD';
        const dailyMixed = mixedCurrencyNote(orders, 'Daily Summary', currency);
        showPageWarning('dailySummaryPanel', [dailyMixed, missingTotalNote(revenueOrders, 'Daily Summary')].filter(Boolean).join(' ') || null); // X8-19, X11-01

        const aiLogs = aiRes.data || [];
        const aiCost = aiLogs.reduce((sum, l) => sum + Number(l.cost_usd || 0), 0);
        const realAiCalls = aiLogs.filter(l => l.model_used !== 'rules-only').length;

        document.getElementById('dailySummaryStats').replaceChildren(
          h('div', { class: 'stat' }, h('div', { class: 'num' }, orders.length), h('div', { class: 'lbl' }, 'Orders placed')),
          h('div', { class: 'stat' }, h('div', { class: 'num' }, fmtMoney(revenue, currency)), h('div', { class: 'lbl' }, 'Revenue')),
          h('div', { class: 'stat' }, h('div', { class: 'num' }, (inquiriesRes.data || []).length), h('div', { class: 'lbl' }, 'New customer questions')),
          h('div', { class: 'stat' }, h('div', { class: 'num' }, (tasksRes.data || []).length), h('div', { class: 'lbl' }, 'Tasks opened')),
          h('div', { class: 'stat' }, h('div', { class: 'num' }, (incidentsRes.data || []).length), h('div', { class: 'lbl' }, 'Incidents opened')),
          h('div', { class: 'stat' }, h('div', { class: 'num' }, realAiCalls), h('div', { class: 'lbl' }, 'Real AI calls')),
          h('div', { class: 'stat' }, h('div', { class: 'num' }, fmtMoney(aiCost, 'USD')), h('div', { class: 'lbl' }, 'AI cost')));
      } catch (err) {
        showDashError('Could not load Daily Summary: ' + (err && err.message ? err.message : err));
      }
    }
    document.getElementById('reportHistoryToggle').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-view]');
      if (!btn) return;
      setReportHistoryView(btn.getAttribute('data-view'));
      document.querySelectorAll('#reportHistoryToggle button').forEach(b => {
        b.classList.toggle('secondary', b !== btn);
      });
      renderReportHistoryView();
    });

    async function loadFlags(){
      try {
        const { data: flags, error } = await supabase
          .from('feature_flags')
          .select('id, flag_key, label, description, enabled')
          .order('label', { ascending: true });
        if (error) throw error;

        // The one launch-critical switch: if its row is missing, its state is
        // unknown (not "off"), and the page says so.
        const syncMissingNote = flags.some(f => f.flag_key === 'shopify_order_sync') ? '' :
          '<p class="hint flagSyncMissing u-c-danger u-mt-8">The Shopify Order Sync switch was not found in the database, so its state is unknown (not configured), not "off". Emergency mode cannot switch it off either.</p>';
        if (!flags.length) {
          document.getElementById('flagsWrap').innerHTML = '<p class="empty">No feature flags exist yet.</p>' + syncMissingNote;
        } else {
          document.getElementById('flagsWrap').innerHTML = flags.map(f => `
            <div class="flagRow" data-id="${esc(f.id)}" data-key="${esc(f.flag_key || '')}">
              <div class="flagInfo">
                <div class="k">${esc(f.label || f.flag_key)}${LAUNCH_BLOCKED_FLAGS[f.flag_key] ? ' <span class="badge sev-high flagBlockedBadge">Blocked until launch checks</span>' : ''}</div>
                <div class="d">${esc(f.description || f.flag_key)}</div>
                ${LAUNCH_BLOCKED_FLAGS[f.flag_key] ? `<div class="d flagBlockedReason u-c-danger">${esc(LAUNCH_BLOCKED_FLAGS[f.flag_key])}</div>` : ''}
                ${FLAG_DEPENDS[f.flag_key] ? `<div class="d flagDepends"><span class="badge flagState">${f.enabled ? 'ON' : 'OFF'}</span> Needs first: ${esc(FLAG_DEPENDS[f.flag_key])}. The page checks this before it lets the switch turn on; turning it off is always safe (work already done stays done).</div>` : ''}
              </div>
              <label class="switch">
                <input type="checkbox" class="flagToggle" ${f.enabled ? 'checked' : ''}>
                <span class="slider"></span>
              </label>
            </div>`).join('') + syncMissingNote;
          document.querySelectorAll('.flagToggle').forEach(cb => {
            cb.addEventListener('change', async () => {
              const row = cb.closest('.flagRow');
              const id = row.getAttribute('data-id');
              const newVal = cb.checked;
              // Flip the switch back to how it was while we ask for your
              // password, so it doesn't visually take effect until confirmed.
              cb.checked = !newVal;
              const blockedReason = newVal ? LAUNCH_BLOCKED_FLAGS[row.getAttribute('data-key')] : null;
              // EXT9: a stock switch can only be turned on once its database
              // function is installed (otherwise that button would refuse every press).
              // EXT9: the request-key switch needs drafts/19 (the client_request_id
              // columns); otherwise every save would fail. A harmless read tells.
              if (newVal && row.getAttribute('data-key') === 'request_keys') {
                cb.disabled = true;
                let colOk = null;
                try {
                  const { error: colErr } = await supabase.from('expenses').select('client_request_id').limit(1);
                  colOk = !colErr ? true : (String(colErr.code) === '42703' || String(colErr.code) === 'PGRST204' || /client_request_id/.test(colErr.message || '')) ? false : null;
                } catch (e) { colOk = null; }
                cb.disabled = false;
                if (colOk !== true) {
                  showDashError(colOk === false
                    ? 'This switch was left off: the request-key columns (drafts/19) are not installed yet. Install them first, then turn the switch on.'
                    : 'This switch was left off: the dashboard could not confirm the request-key columns are installed (connection problem). Try again in a moment.');
                  return;
                }
              }
              // EXT10: the Home switch for the nightly check needs drafts/25 + 29.
              if (newVal && row.getAttribute('data-key') === 'integrity_results_home') {
                cb.disabled = true;
                let tblOk = null;
                try {
                  const { error: tErr } = await supabase.from('integrity_check_runs').select('id').limit(1);
                  tblOk = !tErr ? true : isMissingRelation(tErr) ? false : null;
                } catch (e) { tblOk = null; }
                cb.disabled = false;
                if (tblOk !== true) {
                  showDashError(tblOk === false
                    ? 'This switch was left off: the nightly check (drafts/25 and drafts/29) is not installed yet. Install it first, then turn the switch on.'
                    : 'This switch was left off: the dashboard could not confirm the nightly check is installed (connection problem or no permission). Try again in a moment.');
                  return;
                }
              }
              if (newVal && STOCK_FN_PROBES[row.getAttribute('data-key')]) {
                cb.disabled = true;
                const installed = await stockFunctionInstalled(row.getAttribute('data-key'));
                cb.disabled = false;
                if (installed !== true) {
                  showDashError(installed === false
                    ? 'This switch was left off: its database function (' + STOCK_FN_PROBES[row.getAttribute('data-key')][0] + ') is not installed yet. Install it first (docs/ops/PRODUCTION_CHANGE_PACKAGE_EXT9.md), then turn the switch on.'
                    : 'This switch was left off: the dashboard could not confirm that its database function is installed (connection problem). Try again in a moment.');
                  return;
                }
              }
              if (blockedReason && !confirm(blockedReason + '\n\nTurn it ON anyway?')) return;
              const ok = await requireReauth(newVal ? 'turn this feature ON' : 'turn this feature OFF');
              if (!ok) return;
              cb.checked = newVal;
              cb.disabled = true;
              try {
                const changed = await updateIfUnchanged('feature_flags', id, { enabled: newVal }, { enabled: boolGuard(!newVal) });
                if (!changed) { showDashError(staleMessage('That feature flag')); safeRun(loadFlags); }
              } catch (err) {
                cb.checked = !newVal;
                showDashError('Could not change that flag: ' + (err && err.message ? err.message : err));
              } finally {
                cb.disabled = false;
              }
            });
          });
        }
      } catch (err) {
        showDashError('Could not load feature flags: ' + (err && err.message ? err.message : err));
      }
    }

    let SYSTEM_MODE_SEEN; // the mode this page last showed; undefined = no mode row found
    async function loadSystemMode(){
      try {
        const { data: row, error } = await supabase
          .from('system_mode')
          .select('mode, changed_at, changed_by')
          .eq('id', true)
          .maybeSingle();
        if (error) throw error;

        let who = null;
        if (row && row.changed_by) {
          const { data: who_row } = await supabase
            .from('profiles').select('display_name, email').eq('id', row.changed_by).maybeSingle(); // EXT19: was full_name, which profiles does not have
          who = who_row && (who_row.display_name || who_row.email) ? esc(who_row.display_name || who_row.email) : null;
        }

        const mode = (row && row.mode) || 'NORMAL';
        SYSTEM_MODE_SEEN = row ? (row.mode || null) : undefined;
        const info = SYSTEM_MODE_LABELS[mode] || SYSTEM_MODE_LABELS.NORMAL;

        const wrap = document.getElementById('systemModeWrap');
        if (wrap) {
          const when = row && row.changed_at ? new Date(row.changed_at).toLocaleString() : null;
          const changedLine = !row ? 'No mode has been saved in the database yet, so this shows the default (Normal).'
            : (who && when) ? `Last changed by ${who} on ${when}.`
            : when ? `Last changed on ${when}.` : 'No change recorded yet.';
          wrap.innerHTML = `
            <div class="modePill">${esc(info.label)}</div>
            <p class="hint u-m-8-0-0">${esc(info.desc)} ${esc(changedLine)}</p>`;
          // EXT15: colours through the CSS object model (strict style policy); they come
          // from the fixed SYSTEM_MODE_LABELS table, never from the database.
          const pill = wrap.querySelector('.modePill');
          pill.style.background = info.bg; pill.style.color = info.fg; pill.style.border = '1px solid ' + info.border;
        }
        const sel = document.getElementById('systemModeSelect');
        if (sel) sel.value = mode;

        const banner = document.getElementById('systemModeBanner');
        if (banner) {
          if (mode === 'NORMAL') {
            banner.style.display = 'none';
          } else {
            banner.style.display = 'block';
            banner.style.background = info.bg;
            banner.style.color = info.fg;
            banner.style.border = `1px solid ${info.border}`;
            banner.textContent = `System mode: ${info.label} — ${info.desc}`;
          }
        }
      } catch (err) {
        showDashError('Could not load system mode: ' + (err && err.message ? err.message : err));
      }
    }

    (function initSystemModeChangeBtn(){
      const btn = document.getElementById('systemModeChangeBtn');
      if (!btn) return;
      btn.addEventListener('click', async () => {
        const sel = document.getElementById('systemModeSelect');
        const newMode = sel ? sel.value : 'NORMAL';
        const info = SYSTEM_MODE_LABELS[newMode] || SYSTEM_MODE_LABELS.NORMAL;
        const ok = await requireReauth(`change system mode to ${info.label}`);
        if (!ok) { await loadSystemMode(); return; }

        // Emergency mode can't force-log-out anyone by itself (that needs a
        // server-side change beyond this dashboard), so this is the one
        // moment to remind whoever's flipping the switch to go do that part
        // by hand if it's actually needed.
        if (newMode === 'EMERGENCY') {
          const proceed = confirm(
            'Reminder: Emergency mode pauses AI and turns off Shopify Order Sync, but it does NOT log anyone out automatically.\n\n' +
            'If you suspect unauthorized access, go to Active Sessions afterward and log out anything unfamiliar yourself.\n\n' +
            'Continue switching to Emergency mode?'
          );
          if (!proceed) { await loadSystemMode(); return; }
        }

        btn.disabled = true;
        try {
          const uid = await currentUserId();
          // Only from the mode this page showed: an old tab can't quietly
          // switch Emergency back to Normal.
          // EXT4: for Emergency and No AI the protective steps below (sync
          // off, Agent #7 paused) run even if recording the mode fails or its
          // outcome is unknown. They only switch things OFF, are safe to
          // repeat, and in an emergency must not wait on the mode record.
          const protective = newMode === 'EMERGENCY' || newMode === 'NO_AI';
          let modeProblem = null;
          try {
            const changed = await updateIfUnchanged('system_mode', { id: true },
              { mode: newMode, changed_by: uid, changed_at: new Date().toISOString() },
              { mode: SYSTEM_MODE_SEEN === undefined ? null : SYSTEM_MODE_SEEN });
            if (!changed) modeProblem = staleMessage('System mode') + ' Check the current mode before choosing again.';
          } catch (modeErr) {
            if (!protective) throw modeErr;
            modeProblem = isNetworkError(modeErr)
              ? 'The connection dropped, so the dashboard cannot tell whether the mode was recorded.'
              : 'The mode could not be recorded (' + ((modeErr && modeErr.message) || modeErr) + ').';
          }
          if (modeProblem && !protective) {
            showDashError(modeProblem);
            await Promise.all([loadSystemMode(), loadFlags(), loadAgentControls()]);
            return;
          }

          // Emergency mode also best-effort switches off the one live
          // external-integration flag. If this second update fails we
          // still keep the mode change — the mode itself is the source
          // of truth, this is just a convenience so you don't have to
          // flip both switches by hand.
          // Each of these must really have happened (a refusal by the
          // database's permissions changes 0 rows without an error), and if
          // one didn't, the page says so plainly instead of reporting success:
          // in an emergency the owner must not believe the sync is off when
          // it is still on.
          const leftOn = [];
          if (newMode === 'EMERGENCY') {
            let { data: flagRows, error: flagErr } = await supabase.from('feature_flags')
              .update({ enabled: false, updated_by: uid, updated_at: new Date().toISOString() })
              .eq('flag_key', 'shopify_order_sync')
              .select('id, enabled');
            // The flag table may not have who/when columns (not verified: Query A
            // did not cover it; X3-17). If the database says a column doesn't
            // exist, switch the flag off without them rather than not at all.
            if (flagErr && (String(flagErr.code) === 'PGRST204' || String(flagErr.code) === '42703' || /column .* (does not exist|of 'feature_flags')/i.test(flagErr.message || ''))) {
              ({ data: flagRows, error: flagErr } = await supabase.from('feature_flags')
                .update({ enabled: false })
                .eq('flag_key', 'shopify_order_sync')
                .select('id, enabled'));
            }
            if (flagErr && isNetworkError(flagErr)) {
              // EXT6: a lost reply does not mean "not switched off"; say it is unknown.
              leftOn.push('Shopify Order Sync may or may not have been switched off: the connection dropped before the answer came back. Check it on this page now and switch it off by hand if it is still on.');
            } else if (flagErr || noRowsChanged(flagRows) || flagRows.some(r => r.enabled !== false)) {
              leftOn.push('Shopify Order Sync could NOT be switched off' + (flagErr ? ' (' + flagErr.message + ')' : ' (nothing was changed — no permission, or the flag row is missing)') + '. Switch it off by hand on this page now.');
            }
          }

          // No AI and Emergency both also best-effort pause Agent #7
          // (Customer Service) — the only one of the 10 agents that calls a
          // paid AI model. This doesn't get undone automatically when you
          // switch back to Normal, since you may have paused it for an
          // unrelated reason.
          if (newMode === 'NO_AI' || newMode === 'EMERGENCY') {
            const { data: agentRows, error: agentErr } = await supabase.from('agent_controls')
              .update({ enabled: false, updated_by: uid, updated_at: new Date().toISOString() })
              .eq('agent_num', 7)
              .select('agent_num, enabled');
            if (agentErr && isNetworkError(agentErr)) {
              leftOn.push('Agent #7 (Customer Service) may or may not have been paused: the connection dropped before the answer came back. Check it on the AI Agent Activity page now and pause it by hand if it is still on.');
            } else if (agentErr || noRowsChanged(agentRows) || agentRows.some(r => r.enabled !== false)) {
              leftOn.push('Agent #7 (Customer Service) could NOT be paused' + (agentErr ? ' (' + agentErr.message + ')' : ' (nothing was changed — no permission, or its switch row is missing)') + '. Pause it by hand on the AI Agent Activity page now.');
            }
          }

          const doneOff = newMode === 'EMERGENCY'
            ? 'Shopify Order Sync and Agent #7 were switched off anyway'
            : 'Agent #7 was paused anyway';
          if (modeProblem) {
            showDashError(info.label + ' mode was NOT confirmed: ' + modeProblem + ' ' +
              (leftOn.length ? 'Also: ' + leftOn.join(' ') : doneOff + '.') + ' Reload the page and check the mode.');
          } else if (leftOn.length) {
            showDashError('System mode is now ' + info.label + ', but: ' + leftOn.join(' '));
          } else {
            toast('System mode changed to ' + info.label);
          }
          await Promise.all([loadSystemMode(), loadFlags(), loadAgentControls()]);
        } catch (err) {
          const msg = (err && err.message) || String(err);
          if (/row-level security|permission/i.test(msg)) {
            showDashError('Only the Owner can change system mode — ask the Owner to make this change.');
          } else {
            showDashError('Could not change system mode: ' + msg);
          }
          await loadSystemMode();
        } finally {
          btn.disabled = false;
        }
      });
    })();

    async function loadBusinessRules(){
      try {
        const { data: rules, error } = await supabase
          .from('business_rules')
          .select('id, rule_key, label, description, config, is_active')
          .order('label', { ascending: true });
        if (error) throw error;

        if (!rules.length) {
          document.getElementById('businessRulesWrap').replaceChildren(h('p', { class: 'empty' }, 'No business rules exist yet.'));
          return;
        }

        document.getElementById('businessRulesWrap').innerHTML = rules.map(r => {
          const configKey = BUSINESS_RULE_CONFIG_KEY[r.rule_key];
          const unit = BUSINESS_RULE_UNIT_LABELS[r.rule_key] || '';
          const knownShape = configKey && r.config && typeof r.config === 'object'
            && Object.prototype.hasOwnProperty.call(r.config, configKey);
          const currentValue = knownShape ? r.config[configKey] : null;

          return `
            <div class="flagRow u-ai-flex-start" data-id="${esc(r.id)}" data-rule-key="${esc(r.rule_key)}" data-config-key="${esc(configKey || '')}" data-config="${esc(JSON.stringify(r.config === undefined ? null : r.config))}">
              <div class="flagInfo u-flex-1 u-minw-0">
                <div class="k">${esc(r.label || r.rule_key)}</div>
                <div class="d">${esc(r.description || r.rule_key)}</div>
              </div>
              <div class="u-d-flex u-ai-center u-gap-10 u-flex-none">
                ${knownShape ? `
                  <input type="number" class="ruleValueInput u-w-90 u-p-7-8 u-br-8 u-b-1-solid-xcfd8d6 u-ff-inherit u-fs-13p5" value="${esc(String(currentValue))}" step="any">
                  <span class="u-fs-12 u-c-muted u-minw-60">${esc(unit)}</span>
                ` : `
                  <textarea class="ruleConfigJson u-w-180 u-p-7-8 u-br-8 u-b-1-solid-xcfd8d6 u-ff-monospace u-fs-12 u-rs-vertical" rows="2">${esc(JSON.stringify(r.config))}</textarea>
                `}
                <button type="button" class="small ruleSaveBtn u-d-none">Save</button>
                <label class="switch">
                  <input type="checkbox" class="ruleActiveToggle" ${r.is_active ? 'checked' : ''}>
                  <span class="slider"></span>
                </label>
              </div>
            </div>`;
        }).join('');

        // The Save button only appears once a value has actually changed, so
        // this page doesn't nag with a Save button sitting there by default.
        document.querySelectorAll('.ruleValueInput, .ruleConfigJson').forEach(el => {
          el.addEventListener('input', () => {
            el.closest('.flagRow').querySelector('.ruleSaveBtn').style.display = 'inline-block';
          });
        });

        document.querySelectorAll('.ruleSaveBtn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const row = btn.closest('.flagRow');
            const id = row.getAttribute('data-id');
            const configKey = row.getAttribute('data-config-key');
            const label = row.querySelector('.flagInfo .k').textContent;

            let newConfig;
            const jsonBox = row.querySelector('.ruleConfigJson');
            if (jsonBox) {
              try {
                newConfig = JSON.parse(jsonBox.value);
              } catch (e) {
                showDashError('That config isn\'t valid JSON — fix the formatting and try again.');
                return;
              }
            } else {
              const valueInput = row.querySelector('.ruleValueInput');
              const num = Number(valueInput.value);
              // A blank box used to save as 0 (Number('') is 0): refused now.
              const ruleProblem = numberInputError(numVal(valueInput), { label: '"' + label + '"', min: 0 });
              if (ruleProblem) {
                showDashError(ruleProblem + ' Nothing was saved.');
                return;
              }
              newConfig = { [configKey]: num };
            }

            const ruleValueErr = businessRuleValueError(row.getAttribute('data-rule-key'), label, newConfig);
            if (ruleValueErr) {
              showDashError(ruleValueErr);
              return;
            }

            const ok = await requireReauth(`change the "${label}" threshold`);
            if (!ok) return;

            btn.disabled = true;
            try {
              const uid = await currentUserId();
              // Only while the rule still has the settings this page showed
              // (MU-14), so a change made elsewhere is never overwritten.
              const shown = row.getAttribute('data-config');
              const changed = await updateIfUnchanged('business_rules', id,
                { config: newConfig, updated_by: uid },
                shown === 'null' ? { config: null } : { config: shown });
              if (!changed) { showDashError(staleMessage('That rule')); loadBusinessRules(); return; }
              row.setAttribute('data-config', JSON.stringify(newConfig));
              btn.style.display = 'none';
            } catch (err) {
              showDashError('Could not save that rule: ' + (err && err.message ? err.message : err));
            } finally {
              btn.disabled = false;
            }
          });
        });

        document.querySelectorAll('.ruleActiveToggle').forEach(cb => {
          cb.addEventListener('change', async () => {
            const row = cb.closest('.flagRow');
            const id = row.getAttribute('data-id');
            const newVal = cb.checked;
            // Flip back while we ask for your password, same pattern as Feature Flags.
            cb.checked = !newVal;
            const ok = await requireReauth(newVal ? 'turn this rule back ON' : 'turn this rule OFF');
            if (!ok) return;
            cb.checked = newVal;
            cb.disabled = true;
            try {
              const uid = await currentUserId();
              const changed = await updateIfUnchanged('business_rules', id,
                { is_active: newVal, updated_by: uid }, { is_active: boolGuard(!newVal) });
              if (!changed) throw new Error(staleMessage('That rule'));
            } catch (err) {
              cb.checked = !newVal;
              showDashError('Could not change that rule: ' + (err && err.message ? err.message : err));
            } finally {
              cb.disabled = false;
            }
          });
        });
      } catch (err) {
        showDashError('Could not load business rules: ' + (err && err.message ? err.message : err));
      }
    }

    document.getElementById('addSopForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const titleInput = document.getElementById('sopTitle');
      const categoryInput = document.getElementById('sopCategory');
      const contentInput = document.getElementById('sopContent');
      const agentVisibleInput = document.getElementById('sopAgentVisible');
      const title = titleInput.value.trim();
      const content = contentInput.value.trim();
      if (!title || !content) return;
      // One save at a time: a double click or a second Enter must not add the
      // same procedure twice (agents may read agent-visible procedures). EXT4.
      const submitBtn = e.target.querySelector('button[type="submit"]');
      if (submitBtn && submitBtn.disabled) return;
      if (submitBtn) submitBtn.disabled = true;
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const uid = sessionData && sessionData.session ? sessionData.session.user.id : null;
        const { error } = await insertOnce(e.target, 'sop_documents', {
          title,
          category: categoryInput.value.trim() || null,
          content,
          agent_visible: agentVisibleInput.checked,
          created_by: uid,
        }, 'That procedure');
        if (error) throw error;
        titleInput.value = '';
        categoryInput.value = '';
        contentInput.value = '';
        agentVisibleInput.checked = false;
        loadSops();
      } catch (err) {
        showDashError('Could not add that procedure: ' + (err && err.message ? err.message : err));
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });

    async function advanceFeatureRequest(btn){
      const row = btn.closest('.approvalRow');
      const id = row.getAttribute('data-id');
      btn.disabled = true;
      try {
        // The step the button showed, from the status the page showed (EXT4).
        // It used to re-read the current status and advance from THAT, so a
        // stale "Mark in progress" could mark a request Done, and a click on a
        // request already done elsewhere silently did nothing.
        const shown = row.getAttribute('data-status');
        const nextStatus = FR_NEXT_STATUS[shown];
        if (!nextStatus) { showDashError(staleMessage('That request')); loadFeatureRequests(); return; }
        const changed = await updateIfUnchanged('feature_requests', id, { status: nextStatus, updated_at: new Date().toISOString() }, { status: shown });
        if (!changed) showDashError(staleMessage('That request'));
        loadFeatureRequests();
      } catch (err) {
        btn.disabled = false;
        showDashError('Could not update that request: ' + (err && err.message ? err.message : err));
      }
    }

    async function deleteFeatureRequest(btn){
      const row = btn.closest('.approvalRow');
      const id = row.getAttribute('data-id');
      row.querySelectorAll('button').forEach(b => b.disabled = true);
      try {
        // Soft delete: just stamps deleted_at instead of removing the row, so
        // it drops out of the main list but can still be restored below.
        const { data: changed, error } = await supabase.from('feature_requests').update({ deleted_at: new Date().toISOString() }).eq('id', id).is('deleted_at', null).select('id');
        if (error) throw error;
        if (noRowsChanged(changed)) { showDashError(staleMessage('That request')); loadFeatureRequests(); return; }
        loadFeatureRequests();
        loadDeletedFeatureRequests();
      } catch (err) {
        row.querySelectorAll('button').forEach(b => b.disabled = false);
        showDashError('Could not delete that request: ' + (err && err.message ? err.message : err));
      }
    }

    document.getElementById('addFeatureRequestForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const titleInput = document.getElementById('frTitle');
      const descInput = document.getElementById('frDescription');
      const priorityInput = document.getElementById('frPriority');
      const title = titleInput.value.trim();
      if (!title) return;
      // One save at a time: a double click or a second Enter must not add the
      // reminder twice.
      const btn = e.target.querySelector('button[type=submit]');
      if (btn && btn.disabled) return;
      if (btn) btn.disabled = true;
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const uid = sessionData && sessionData.session ? sessionData.session.user.id : null;
        const { error } = await insertOnce(e.target, 'feature_requests', {
          title,
          description: descInput.value.trim() || null,
          priority: priorityInput.value,
          created_by: uid,
        }, 'That request');
        if (error) throw error;
        titleInput.value = '';
        descInput.value = '';
        priorityInput.value = 'normal';
        loadFeatureRequests();
      } catch (err) {
        showDashError('Could not add that request: ' + (err && err.message ? err.message : err));
      } finally {
        // EXT10 (X10-01): the button used to stay disabled after the first
        // add, success or failure, until the page was reloaded.
        if (btn) btn.disabled = false;
      }
    });

    document.getElementById('evidenceFilter').addEventListener('change', () => loadEvidenceLocker());

    document.getElementById('addEvidenceForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const incidentInput = document.getElementById('evidenceIncident');
      const titleInput = document.getElementById('evidenceTitle');
      const descriptionInput = document.getElementById('evidenceDescription');
      const typeInput = document.getElementById('evidenceType');
      const fileInput = document.getElementById('evidenceFile');
      const linkInput = document.getElementById('evidenceLink');
      const incidentId = incidentInput.value;
      const title = titleInput.value.trim();
      if (!incidentId || !title) {
        showDashError('Pick which incident this evidence belongs to, and give it a title.');
        return;
      }
      if (linkInput.value.trim() && !isSafeLink(linkInput.value)) {
        showDashError('That link can’t be saved: links starting with javascript:, data: or vbscript: can run code when clicked. Paste a normal web, email or Photos/Drive link instead.');
        return;
      }
      const evFile = fileInput.files && fileInput.files[0];
      const evFileProblem = uploadProblem(evFile);
      if (evFileProblem) { showDashError(evFileProblem); return; }
      const submitBtn = e.target.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn.textContent;
      submitBtn.disabled = true;
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const uid = sessionData && sessionData.session ? sessionData.session.user.id : null;

        const rk = await formRequestKey(e.target);
        const saveEvidence = filePath => supabase.from('evidence_locker').insert(withRequestKey({
          incident_id: incidentId,
          title,
          description: descriptionInput.value.trim() || null,
          evidence_type: typeInput.value || null,
          external_link: linkInput.value.trim() || null,
          file_path: filePath,
          added_by: uid,
        }, rk));
        // Used to leave the uploaded file behind whenever the record was refused.
        if (evFile) {
          submitBtn.textContent = 'Uploading file…';
          const safeName = safeStorageName(evFile.name);
          try {
            await uploadThenSave('evidence-files', 'evidence_locker', 'file_path', `${incidentId}/${uploadStamp()}_${safeName}`, evFile, saveEvidence);
          } catch (upErr) {
            if (!isRequestKeyRepeat(upErr)) throw upErr;
            toast('That evidence' + REPEAT_NOTE);
          }
        } else {
          // EXT10 (X10-02): a stray "isLatest" check (EXT8) stood here and
          // threw after a successful save, so the page said it failed.
          let { error } = await saveEvidence(null);
          if (isRequestKeyRepeat(error)) { toast('That evidence' + REPEAT_NOTE); error = null; }
          if (error && isNetworkError(error)) throw new Error('The connection dropped, so the evidence may or may not have been saved. ' + (rk ? 'Pressing the button again is safe: it will not be added twice.' : 'Check the list before adding it again.'));
          if (error) throw error;
        }
        clearRequestKey(e.target);
        titleInput.value = '';
        descriptionInput.value = '';
        typeInput.value = '';
        linkInput.value = '';
        fileInput.value = '';
        incidentInput.value = '';
        loadEvidenceLocker();
      } catch (err) {
        showDashError('Could not add that evidence: ' + (err && err.message ? err.message : err));
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }
    });
    (function initDocCategorySelect(){
      const sel = document.getElementById('docCategory');
      if (sel) {
        sel.innerHTML = '<option value="">Category…</option>' +
          Object.entries(DOCUMENT_CATEGORY_LABELS).map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join('');
      }
    })();

    document.getElementById('addDocumentForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const titleInput = document.getElementById('docTitle');
      const categoryInput = document.getElementById('docCategory');
      const relatedInput = document.getElementById('docRelated');
      const issuedInput = document.getElementById('docIssuedDate');
      const expirationInput = document.getElementById('docExpirationDate');
      const notesInput = document.getElementById('docNotes');
      const fileInput = document.getElementById('docFile');
      const urlInput = document.getElementById('docUrl');

      const title = titleInput.value.trim();
      const category = categoryInput.value;
      if (!title || !category) { showDashError('Give the document a title and a category first.'); return; }
      if (urlInput.value.trim() && !isSafeLink(urlInput.value)) {
        showDashError('That link can’t be saved: links starting with javascript:, data: or vbscript: can run code when clicked. Paste a normal web, email or Drive link instead.');
        return;
      }

      let relatedType = null, relatedId = null;
      if (relatedInput.value.includes(':')) {
        const [t, id] = relatedInput.value.split(':');
        relatedType = t; relatedId = id;
      }
      // Checked before anything is uploaded, so a refused save never leaves a
      // file behind. Only supplier links are allowed by the database.
      if (relatedType !== null && !DOCUMENT_LINK_TYPES.includes(relatedType)) {
        showDashError('Documents can only be linked to a supplier (or to nothing). Pick a supplier or "Not linked", then save again.');
        return;
      }

      const docFile = fileInput.files && fileInput.files[0];
      const docFileProblem = uploadProblem(docFile);
      if (docFileProblem) { showDashError(docFileProblem); return; }

      const btn = e.target.querySelector('button[type="submit"]');
      const originalText = btn.textContent;
      btn.disabled = true;
      try {
        const uid = await currentUserId();
        const rk = await formRequestKey(e.target);
        const saveDoc = filePath => supabase.from('documents').insert(withRequestKey({
          title,
          category,
          related_type: relatedType,
          related_id: relatedId,
          document_url: urlInput.value.trim() || null,
          file_path: filePath,
          issued_date: issuedInput.value || null,
          expiration_date: expirationInput.value || null,
          notes: notesInput.value.trim() || null,
          uploaded_by: uid,
        }, rk));
        if (docFile) {
          btn.textContent = 'Uploading file…';
          const safeName = safeStorageName(docFile.name);
          try {
            await uploadThenSave('document-files', 'documents', 'file_path', `${uploadStamp()}_${safeName}`, docFile, saveDoc);
          } catch (upErr) {
            if (!isRequestKeyRepeat(upErr)) throw upErr;
            toast('That document' + REPEAT_NOTE);
          }
        } else {
          let { error } = await saveDoc(null);
          if (isRequestKeyRepeat(error)) { toast('That document' + REPEAT_NOTE); error = null; }
          if (error && isNetworkError(error)) throw new Error('The connection dropped, so the document may or may not have been saved. ' + (rk ? 'Pressing the button again is safe: it will not be added twice.' : 'Check the list before adding it again.'));
          if (error) throw error;
        }
        clearRequestKey(e.target);

        titleInput.value = ''; categoryInput.value = ''; relatedInput.value = '';
        issuedInput.value = ''; expirationInput.value = ''; notesInput.value = '';
        fileInput.value = ''; urlInput.value = '';
        toastOk('Document added.');
        loadDocuments();
      } catch (err) {
        showDashError('Could not add that document: ' + (err && err.message ? err.message : err));
      } finally {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    });

    (function initAdverseEventDateField(){
      const dateInput = document.getElementById('aeDateReceived');
      if (dateInput && !dateInput.value) {
        const today = new Date();
        dateInput.value = localDateString(today);
      }
    })();

    document.getElementById('addAdverseEventForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const productInput = document.getElementById('aeProduct');
      const dateInput = document.getElementById('aeDateReceived');
      const descriptionInput = document.getElementById('aeDescription');
      const outcomeInput = document.getElementById('aeOutcomeType');
      const reporterNameInput = document.getElementById('aeReporterName');
      const reporterContactInput = document.getElementById('aeReporterContact');
      const product = productInput.value.trim();
      const description = descriptionInput.value.trim();
      if (!product || !dateInput.value || !description) {
        showDashError('Fill in the product name, date received, and what was reported.');
        return;
      }
      const submitBtn = e.target.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn.textContent;
      submitBtn.disabled = true;
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const uid = sessionData && sessionData.session ? sessionData.session.user.id : null;
        const { error } = await insertOnce(e.target, 'adverse_event_reports', {
          product_name: product,
          date_received: dateInput.value,
          description,
          outcome_type: outcomeInput.value || null,
          reporter_name: reporterNameInput.value.trim() || null,
          reporter_contact: reporterContactInput.value.trim() || null,
          created_by: uid,
        }, 'That report');
        if (error) throw error;
        productInput.value = '';
        descriptionInput.value = '';
        outcomeInput.value = '';
        reporterNameInput.value = '';
        reporterContactInput.value = '';
        dateInput.value = localDateString();
        loadAdverseEvents();
        loadIncidents();
        loadTasks();
      } catch (err) {
        showDashError('Could not log that report: ' + (err && err.message ? err.message : err));
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }
    });

    document.getElementById('addLegalHoldForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const titleInput = document.getElementById('lhTitle');
      const descriptionInput = document.getElementById('lhDescription');
      const relatedTypeInput = document.getElementById('lhRelatedType');
      const relatedReferenceInput = document.getElementById('lhRelatedReference');
      const title = titleInput.value.trim();
      if (!title) {
        showDashError('Say what needs to be placed on hold.');
        return;
      }
      const submitBtn = e.target.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn.textContent;
      submitBtn.disabled = true;
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const uid = sessionData && sessionData.session ? sessionData.session.user.id : null;
        const { error } = await insertOnce(e.target, 'legal_holds', {
          title,
          description: descriptionInput.value.trim() || null,
          related_type: relatedTypeInput.value || null,
          related_reference: relatedReferenceInput.value.trim() || null,
          placed_by: uid,
        }, 'That hold');
        if (error) throw error;
        titleInput.value = '';
        descriptionInput.value = '';
        relatedTypeInput.value = '';
        relatedReferenceInput.value = '';
        loadLegalHolds();
      } catch (err) {
        showDashError('Could not place that hold: ' + (err && err.message ? err.message : err));
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }
    });

    async function loadInventory(){
      try {
        // Embedded select: pulls each product's matching inventory row (if any)
        // in one round trip, using the foreign key link between the two tables.
        // EXT10b (X10-15): every product, also past the database's per-reply cap.
        let products = null, error = null;
        try {
          products = (await fetchAllRows('products', 'id, sku, name, is_active, status, cost, retail_price, wholesale_price, packaging_info, updated_at, inventory(available, reserved, damaged, sample, wholesale, promotional, returned, recalled, low_stock_threshold), inventory_lots(lot_number, quantity_remaining, received_at, expires_at)', q => q))
            .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
        } catch (e) { error = e; }
        if (error) throw error;

        SEARCH_INDEX.inventory = products;

        // Populate the "Adjust stock" product dropdown
        // EXT20F: built as DOM nodes (h() text-ifies data) instead of an HTML
        // string, so this screen is safe under Trusted Types enforcement. Every
        // value was already HTML-escaped with esc(); building nodes removes the
        // string-to-HTML step entirely rather than relying on escaping.
        const productSelect = document.getElementById('invProduct');
        const previousValue = productSelect.value;
        productSelect.replaceChildren(
          h('option', { value: '' }, 'Product…'),
          ...products.map(p => h('option', { value: p.id }, p.name + (p.sku ? ' (' + p.sku + ')' : '')))
        );
        if (previousValue) productSelect.value = previousValue;

        let lowStockCount = 0;
        const INV_BADGE_BUCKETS = ['available', 'reserved', 'damaged', 'sample', 'wholesale', 'promotional', 'returned'];
        const rowNodes = products.map(p => {
          // PostgREST can return this embed as either an array (one-to-many
          // shape) or a single object (one-to-one shape, since product_id is
          // unique on inventory) depending on how it detects the relationship.
          // Handle both so this doesn't silently show blank data if that
          // detection ever flips.
          const inv = Array.isArray(p.inventory) ? (p.inventory[0] || {}) : (p.inventory || {});
          const available = Number(inv.available || 0);
          const threshold = inv.low_stock_threshold;
          const isLow = threshold !== null && threshold !== undefined && available < Number(threshold);
          if (isLow) lowStockCount++;
          // No stock row at all is not the same as "0 in stock": say so (the
          // row is created on the first stock change).
          const hasStockRow = Array.isArray(p.inventory) ? p.inventory.length > 0 : !!p.inventory;
          const lotsOnHand = (p.inventory_lots || [])
            .filter(l => Number(l.quantity_remaining) > 0)
            .sort((a, b) => new Date(a.received_at) - new Date(b.received_at)); // oldest first, for using stock in order
          const today = localDateString();

          // Stock-bucket badges (built as nodes; same classes/text as before).
          const badgeNodes = [];
          if (!hasStockRow) badgeNodes.push(h('span', { class: 'badge sev-medium noStockRowBadge u-mr-4' }, 'No stock record yet (counts shown as 0)'));
          for (const b of INV_BADGE_BUCKETS) badgeNodes.push(h('span', { class: 'badge u-mr-4' }, INVENTORY_BUCKET_LABELS[b] + ': ' + Number(inv[b] || 0)));
          if (Number(inv.recalled || 0) > 0) badgeNodes.push(h('span', { class: 'badge sev-high u-mr-4' }, INVENTORY_BUCKET_LABELS.recalled + ': ' + Number(inv.recalled)));

          const lotsBlock = lotsOnHand.length ? h('div', { class: 'u-mt-8' },
            h('div', { class: 'u-fs-12 u-c-muted u-mb-4' }, 'Lots on hand (oldest first):'),
            ...lotsOnHand.map(l => {
              const expiring = l.expires_at && l.expires_at <= today;
              return h('span', { class: 'badge' + (expiring ? ' sev-high' : '') + ' u-mr-4', title: l.received_at ? 'Received ' + fmtDate(l.received_at) : false },
                l.lot_number + ': ' + Number(l.quantity_remaining) + (l.expires_at ? (expiring ? ' · expired' : ' · exp ' + l.expires_at) : ''));
            })
          ) : null;

          // Hidden "Edit product" form (kept identical in classes/structure so
          // the existing event wiring that queries .peName, .peStatus, etc. and
          // toggles .prodEdit continues to work unchanged).
          const prodEdit = h('div', { class: 'prodEdit u-d-none' },
            h('div', { class: 'prodEditGrid' },
              h('label', null, 'Name', h('input', { type: 'text', class: 'peName', value: p.name })),
              h('label', null, 'SKU', h('input', { type: 'text', class: 'peSku', value: p.sku || '', placeholder: 'none' })),
              h('label', null, 'Status', h('select', { class: 'peStatus' },
                ...['draft', 'active', 'discontinued'].map(s => h('option', { value: s, selected: p.status === s }, s.charAt(0).toUpperCase() + s.slice(1))))),
              h('label', null, 'Cost', h('input', { type: 'number', class: 'peCost', step: '0.0001', min: '0', value: p.cost != null ? Number(p.cost) : '', placeholder: '—' })),
              h('label', null, 'Retail', h('input', { type: 'number', class: 'peRetail', step: '0.01', min: '0', value: p.retail_price != null ? Number(p.retail_price) : '', placeholder: '—' })),
              h('label', null, 'Wholesale', h('input', { type: 'number', class: 'peWholesale', step: '0.01', min: '0', value: p.wholesale_price != null ? Number(p.wholesale_price) : '', placeholder: '—' })),
              h('label', { class: 'wide' }, 'Packaging', h('input', { type: 'text', class: 'pePackaging', value: p.packaging_info || '', placeholder: '—' }))
            ),
            h('div', { class: 'prodEditRow' },
              h('button', { type: 'button', class: 'small saveProductBtn' }, 'Save changes'),
              h('button', { type: 'button', class: 'small secondary cancelProductBtn' }, 'Cancel'),
              h('button', { type: 'button', class: 'small secondary toggleProductBtn u-ml-auto' }, p.is_active ? 'Deactivate' : 'Reactivate'),
              h('button', { type: 'button', class: 'small deny deleteProductBtn' }, 'Delete')
            )
          );

          // Product name line + status badges (spaces kept as text nodes so the
          // spacing matches the previous markup).
          const nameLine = [h('b', null, p.name)];
          if (p.sku) nameLine.push(' ', h('span', { class: 'u-c-muted u-fs-12' }, '(' + p.sku + ')'));
          if (isLow) nameLine.push(' ', h('span', { class: 'badge sev-high' }, 'Low stock'));
          if (!p.is_active) nameLine.push(' ', h('span', { class: 'badge' }, 'Inactive'));

          return h('div', { class: 'deletedRow u-ai-flex-start', 'data-product-id': p.id, 'data-status': p.status || '', 'data-updated-at': p.updated_at || '' },
            h('div', { class: 'info u-flex-1' },
              ...nameLine,
              h('br'),
              h('div', { class: 'u-mt-6' }, ...badgeNodes),
              lotsBlock,
              h('div', { class: 'u-mt-8 u-d-flex u-ai-center u-gap-6' },
                h('label', { class: 'u-fs-12 u-c-muted' }, 'Low-stock alert when Available drops below:'),
                h('input', { type: 'number', class: 'invThresholdInput u-w-80 u-p-5-7 u-br-6 u-b-1-solid-xcfd8d6 u-ff-inherit u-fs-13', min: '0', step: '1', value: (threshold !== null && threshold !== undefined ? Number(threshold) : ''), placeholder: 'none' }),
                h('button', { type: 'button', class: 'small saveThresholdBtn' }, 'Save'),
                h('button', { type: 'button', class: 'small secondary editProductBtn u-ml-auto' }, 'Edit product')
              ),
              prodEdit
            )
          );
        });

        const invWrap = document.getElementById('inventoryWrap');
        if (products.length) invWrap.replaceChildren(...rowNodes);
        else invWrap.replaceChildren(h('p', { class: 'empty' }, 'No products in your catalog yet.'));

        document.getElementById('inventoryStats').replaceChildren(
          h('div', { class: 'stat' }, h('div', { class: 'num' }, products.length), h('div', { class: 'lbl' }, 'Products tracked')),
          h('div', { class: 'stat' }, h('div', { class: 'num' }, lowStockCount), h('div', { class: 'lbl' }, 'Low-stock alerts'))
        );

        // Editing a product: prices change, names get corrected, SKUs get
        // typos. Doing any of that through SQL is not a real answer.
        document.querySelectorAll('.editProductBtn').forEach(btn => {
          btn.addEventListener('click', () => {
            const box = btn.closest('[data-product-id]').querySelector('.prodEdit');
            const open = getComputedStyle(box).display !== 'none'; // EXT15: hidden by a class at first
            box.style.display = open ? 'none' : 'block';
            btn.textContent = open ? 'Edit product' : 'Close';
          });
        });
        document.querySelectorAll('.cancelProductBtn').forEach(btn => {
          btn.addEventListener('click', () => {
            const row = btn.closest('[data-product-id]');
            row.querySelector('.prodEdit').style.display = 'none';
            row.querySelector('.editProductBtn').textContent = 'Edit product';
            loadInventory();
          });
        });
        document.querySelectorAll('.saveProductBtn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const row = btn.closest('[data-product-id]');
            const id = row.getAttribute('data-product-id');
            const val = (cls) => numVal(row.querySelector(cls));
            const num = (cls) => { const v = val(cls); return v === '' ? null : Number(v); };
            const name = val('.peName').trim();
            if (!name) { toast('A product needs a name.'); return; }
            const priceProblem = numberInputError(val('.peCost'), { label: 'Cost', allowBlank: true, max: 1000000, decimals: 4 })
              || numberInputError(val('.peRetail'), { label: 'Retail price', allowBlank: true, max: 1000000, decimals: 2 })
              || numberInputError(val('.peWholesale'), { label: 'Wholesale price', allowBlank: true, max: 1000000, decimals: 2 });
            if (priceProblem) { showDashError(priceProblem + ' Nothing was saved.'); return; }
            btn.disabled = true;
            try {
              const { data: saved, error } = await supabase.from('products').update({
                name: name,
                sku: val('.peSku').trim() || null,
                status: val('.peStatus'),
                cost: num('.peCost'),
                retail_price: num('.peRetail'),
                wholesale_price: num('.peWholesale'),
                packaging_info: val('.pePackaging').trim() || null,
                updated_at: new Date().toISOString(),
              // Only while the status is still the one this form opened with,
              // so a stale tab can't flip a product back (e.g. discontinued
              // → active) without noticing.
              // EXT8: ...and only if nobody saved this product since the form
              // loaded (updated_at, set on every save). Before, a second
              // editor working from an old form silently overwrote the first
              // one's cost, price, name or SKU.
              }).eq('id', id).eq('status', row.getAttribute('data-status'))
                [row.getAttribute('data-updated-at') ? 'eq' : 'is']('updated_at', row.getAttribute('data-updated-at') || null)
                .select('id');
              if (!error && noRowsChanged(saved)) { showDashError(staleMessage('That product')); loadInventory(); return; }
              if (error) {
                if (String(error.message || '').includes('products_sku_unique')) {
                  showDashError('Another product already uses that SKU. SKUs have to be unique, because deliveries and returns find products by them.');
                  return;
                }
                throw error;
              }
              toastOk('Product updated.');
              loadInventory();
              safeRun(loadPurchaseOrders);
            } catch (err) {
              showDashError('Could not save that product: ' + (err && err.message ? err.message : err));
            } finally { btn.disabled = false; }
          });
        });
        document.querySelectorAll('.toggleProductBtn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const row = btn.closest('[data-product-id]');
            const id = row.getAttribute('data-product-id');
            const makeActive = btn.textContent.trim() === 'Reactivate';
            btn.disabled = true;
            try {
              const changed = await updateIfUnchanged('products', id,
                { is_active: makeActive, updated_at: new Date().toISOString() }, { is_active: boolGuard(!makeActive) });
              if (changed) toastOk(makeActive ? 'Product reactivated.' : 'Product deactivated.');
              else showDashError(staleMessage('That product'));
              loadInventory();
            } catch (err) {
              btn.disabled = false;
              showDashError('Could not update that product: ' + (err && err.message ? err.message : err));
            }
          });
        });

        // Deleting is only for products that were never used. Anything with
        // stock, an order line or price history is held by the database, and we
        // say so plainly and point at Deactivate instead — losing the history
        // behind a real product would be worse than keeping a dead row.
        document.querySelectorAll('.deleteProductBtn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const row = btn.closest('[data-product-id]');
            const id = row.getAttribute('data-product-id');
            const name = (row.querySelector('.peName') || {}).value || 'this product';
            if (btn.dataset.armed !== '1') {
              btn.dataset.armed = '1';
              btn.textContent = 'Really delete?';
              setTimeout(() => {
                if (btn.dataset.armed === '1') { btn.dataset.armed = '0'; btn.textContent = 'Delete'; }
              }, 4000);
              return;
            }
            // Deleting is Owner/Administrator only (row-level security, Query A).
            // Without this check an employee's delete quietly removed nothing
            // and the page still said "Product deleted."
            if (!canChangeStock()) {
              showDashError('Only the Owner or an Administrator can delete a product. Nothing was changed.');
              return;
            }
            btn.disabled = true;
            // EXT9: R5 (delete_unused_product) when its switch is on: every
            // check and both deletes in one transaction, so stock can never be
            // lost and a product with any history is never deleted.
            if (await stockFunctionOn('deleteProduct')) {
              try {
                const r = await callStockFunction('delete_unused_product', { p_product_id: id });
                if (r.deleted) { toastOk('Product deleted.'); }
                else {
                  const why = { has_stock: 'still has stock' + (r.units != null ? ' (' + Number(r.units) + ' units in total)' : '') + ', so it can\'t be deleted. Use Deactivate instead, or move the stock out first.',
                    in_use: 'can\'t be deleted because it\'s already used somewhere — a purchase order, a lot, a recall, a quality check or a stock adjustment. Use Deactivate instead, which hides it without losing that history.',
                    sold: 'can\'t be deleted because it has already been sold. Use Deactivate instead, which hides it without losing the sales history.',
                    not_found: 'was already deleted (by someone else or another tab).' }[r.reason] || 'was not deleted. Nothing was changed.';
                  showDashError('"' + name + '" ' + why);
                }
              } catch (err) {
                showDashError('Could not delete "' + name + '". ' + stockFunctionError(err, 'the delete', true));
              }
              btn.disabled = false;
              loadInventory();
              safeRun(loadPurchaseOrders);
              return;
            }
            try {
              // Never delete a product that still has stock: the stock row is
              // removed first (it exists for every product), so a product that
              // turned out to be in use used to lose its stock numbers (R5).
              // Fresh read, not the page's copy, in case stock arrived since.
              const { data: invNow, error: invNowErr } = await supabase
                .from('inventory').select('*').eq('product_id', id).maybeSingle();
              if (invNowErr) throw invNowErr;
              const held = invNow ? Object.keys(INVENTORY_BUCKET_LABELS).filter(b => Number(invNow[b] || 0) !== 0) : [];
              if (held.length) {
                showDashError('"' + name + '" still has stock (' + held.map(b => INVENTORY_BUCKET_LABELS[b] + ': ' + Number(invNow[b])).join(', ') + '), so it can\'t be deleted. Use Deactivate instead, or move the stock out first.');
                return;
              }
              const inUseMsg = '"' + name + '" can\'t be deleted because it\'s already used somewhere — a purchase order, a lot, a recall, a quality check or a stock adjustment. Use Deactivate instead, which hides it without losing that history.';
              // Anything that refers to the product blocks the delete (plain
              // foreign keys, Query A). Ask first, so nothing is touched for a
              // product that is in use.
              for (const t of ['purchase_order_items', 'inventory_lots', 'inventory_adjustments', 'recalls', 'quality_checks']) {
                const { count, error: refErr } = await supabase.from(t).select('id', { count: 'exact', head: true }).eq('product_id', id);
                if (refErr) throw refErr;
                if (count) { showDashError(inUseMsg); return; }
              }
              // Sold products: order lines name the product by its SKU (text, no
              // database link), so nothing would stop the delete and the sales
              // history would point at nothing (X3-13). Fresh SKU from the database.
              const { data: prodNow, error: prodNowErr } = await supabase.from('products').select('sku').eq('id', id).maybeSingle();
              if (prodNowErr) throw prodNowErr;
              const skuNow = prodNow && prodNow.sku ? String(prodNow.sku).trim() : '';
              if (skuNow) {
                const { count: soldCount, error: soldErr } = await supabase.from('order_items').select('id', { count: 'exact', head: true }).ilike('sku', likeLiteral(skuNow));
                if (soldErr) throw soldErr;
                if (soldCount) { showDashError('"' + name + '" can\'t be deleted because it has already been sold (order lines use its SKU ' + skuNow + '). Use Deactivate instead, which hides it without losing the sales history.'); return; }
              }
              // Remove the stock row only while every bucket is still 0, so
              // stock that arrived a moment ago is never thrown away.
              if (invNow) {
                let delInv = supabase.from('inventory').delete().eq('product_id', id);
                Object.keys(INVENTORY_BUCKET_LABELS).forEach(b => { delInv = delInv.eq(b, 0); });
                const { data: invGone, error: delInvErr } = await delInv.select('product_id');
                if (delInvErr) throw delInvErr;
                if (!invGone || !invGone.length) { showDashError(staleMessage('That product')); loadInventory(); return; }
              }
              let { data: prodGone, error } = await supabase.from('products').delete().eq('id', id).select('id');
              if (error && isNetworkError(error)) {
                // The reply was lost: the product may already be gone. Look
                // before putting the stock row back, or a deleted product would
                // get a stray stock row (or be reported as "not deleted") (EXT4).
                const { data: stillThere, error: lookErr } = await supabase.from('products').select('id').eq('id', id).maybeSingle();
                if (lookErr) {
                  showDashError('The connection dropped, so the dashboard cannot tell whether "' + name + '" was deleted. Its stock row (all 0) was removed. Reload the page: if the product is still listed, save its low-stock threshold on Inventory to recreate the stock row.');
                  return;
                }
                if (!stillThere) { prodGone = [{ id }]; error = null; }
              }
              if (error || !prodGone || !prodGone.length) {
                // The product stays, so put its stock row back exactly as it was
                // (every product has one; Query B checks that).
                if (invNow) {
                  const { error: restoreErr } = await supabase.from('inventory').insert(invNow);
                  if (restoreErr) {
                    showDashError('"' + name + '" was not deleted, and its stock row could not be put back (' + (restoreErr.message || restoreErr) + '). Its stock was all 0. Reload, then save its low-stock threshold on Inventory to recreate the stock row.');
                    return;
                  }
                }
                if (error && String(error.code) === '23503') { showDashError(inUseMsg); return; }
                if (error) throw error;
                showDashError('"' + name + '" was not deleted (not permitted). Nothing was changed.');
                return;
              }
              toastOk('Product deleted.');
              loadInventory();
              safeRun(loadPurchaseOrders);
            } catch (err) {
              showDashError('Could not delete that product: ' + (err && err.message ? err.message : err));
            } finally {
              btn.disabled = false;
              btn.dataset.armed = '0';
              btn.textContent = 'Delete';
            }
          });
        });

        document.querySelectorAll('.saveThresholdBtn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const row = btn.closest('[data-product-id]');
            const productId = row.getAttribute('data-product-id');
            const input = row.querySelector('.invThresholdInput');
            const raw = numVal(input).trim();
            // Stock settings are Owner/Administrator only (row-level security on
            // inventory); say so before sending, like the other stock actions.
            if (!canChangeStock()) { showDashError('Only the Owner or an Administrator can change stock settings. Nothing was changed.'); return; }
            const thresholdProblem = numberInputError(raw, { label: 'The low-stock alert level', allowBlank: true, integer: true, max: 1000000 });
            if (thresholdProblem) { showDashError(thresholdProblem + ' Nothing was saved.'); return; }
            const value = raw === '' ? null : parseInt(raw, 10);
            btn.disabled = true;
            try {
              const uid = await currentUserId();
              // EXT5: only over the value this page showed (the box's original
              // value), so a second tab can't silently undo someone's change.
              const shown = input.defaultValue === '' ? null : Number(input.defaultValue);
              let thrQ = supabase.from('inventory')
                .update({ low_stock_threshold: value, updated_at: new Date().toISOString(), updated_by: uid })
                .eq('product_id', productId);
              thrQ = shown === null ? thrQ.is('low_stock_threshold', null) : thrQ.eq('low_stock_threshold', shown);
              const { data: thrRows, error: thrErr } = await thrQ.select('product_id');
              if (thrErr) throw thrErr;
              if (noRowsChanged(thrRows)) {
                const { data: nowRow, error: nowErr } = await supabase.from('inventory').select('low_stock_threshold').eq('product_id', productId).maybeSingle();
                if (nowErr) throw nowErr;
                if (!nowRow) {
                  // No stock record yet: create it with this alert level.
                  const { error: upErr } = await supabase
                    .from('inventory')
                    .upsert({ product_id: productId, low_stock_threshold: value, updated_at: new Date().toISOString(), updated_by: uid }, { onConflict: 'product_id' });
                  if (upErr) throw upErr;
                } else if ((nowRow.low_stock_threshold === undefined ? null : nowRow.low_stock_threshold) !== shown) {
                  showDashError(staleMessage('That low-stock alert level') + ' It is now ' + (nowRow.low_stock_threshold === null ? 'not set' : nowRow.low_stock_threshold) + '. Nothing was changed.');
                  loadInventory();
                  return;
                } else {
                  throw new Error('nothing was changed (no permission?)');
                }
              }
              loadInventory();
            } catch (err) {
              btn.disabled = false;
              showDashError('Could not save that threshold: ' + (err && err.message ? err.message : err));
            }
          });
        });
      } catch (err) {
        showDashError('Could not load Inventory: ' + (err && err.message ? err.message : err));
      }
    }

    async function loadInventoryAdjustments(){
      try {
        const { data: adjustments, error, count } = await supabase
          .from('inventory_adjustments')
          .select('id, product_id, bucket, change_amount, reason, adjusted_at, products(name, sku)', { count: 'exact' })
          .order('adjusted_at', { ascending: false })
          .limit(listLimit('invAdj'));
        if (error) throw error;

        if (!adjustments.length) {
          document.getElementById('inventoryAdjustmentsWrap').replaceChildren(h('p', { class: 'empty' }, 'No adjustments logged yet.'));
          return;
        }
        document.getElementById('inventoryAdjustmentsWrap').innerHTML = adjustments.map(a => {
          const productLabel = a.products ? (a.products.name + (a.products.sku ? ' (' + a.products.sku + ')' : '')) : 'Unknown product';
          const sign = Number(a.change_amount) > 0 ? '+' : '';
          return `
            <div class="deletedRow">
              <div class="info">
                <b>${esc(productLabel)}</b> — ${esc(INVENTORY_BUCKET_LABELS[a.bucket] || a.bucket)}: ${sign}${Number(a.change_amount)}
                ${a.reason ? '<br><span class="u-fs-12 u-c-muted">' + esc(a.reason) + '</span>' : ''}
                <br><span class="u-fs-11 u-c-muted">${esc(fmtDate(a.adjusted_at))}</span>
              </div>
            </div>`;
        }).join('');
        appendMore('inventoryAdjustmentsWrap', 'invAdj', adjustments.length, count, 'adjustments', loadInventoryAdjustments);
      } catch (err) {
        showDashError('Could not load inventory adjustments: ' + (err && err.message ? err.message : err));
      }
    }

    // EXT17: one explicit state per product + bucket for manual adjustments
    // (he-ops, repeatable: a confirmed adjustment may be followed by another).
    // The rule it adds: after a lost reply (RESULT_UNKNOWN) the same adjustment
    // is never sent again until a read-back of the stock says whether the first
    // one was saved. Before EXT17 the form stayed filled and Save was enabled,
    // so a second press could add the stock twice (the page refreshes its
    // numbers after an error, so even the R4 "expected value" check would accept
    // the repeat).
    const adjustOps = createOpTracker('stock adjustment', { repeatable: true });
    const adjustPending = new Map(); // key -> { productId, bucket, before, change }
    const adjustKey = (productId, bucket) => productId + '|' + bucket;

    // Read-back after a lost reply: compare the stock now with the number just
    // before the lost save. Exactly unchanged = not saved; exactly before +
    // change = saved; anything else = someone else changed it too, so a person
    // must look (the dashboard never guesses).
    async function checkUnknownAdjustment(key, amountInput) {
      const p = adjustPending.get(key);
      if (!p || !adjustOps.startReadback(key)) return;
      const label = (p.change > 0 ? '+' : '') + p.change;
      let now;
      try {
        const { data, error } = await supabase.from('inventory').select(p.bucket).eq('product_id', p.productId).maybeSingle();
        if (error) throw error;
        now = data && data[p.bucket] != null ? Number(data[p.bucket]) : null;
      } catch (err) {
        adjustOps.stillUnknown(key, 'read failed');
        showDashError('The dashboard still cannot tell whether the earlier adjustment (' + label + ') was saved: the stock could not be read. Nothing was sent. Try again when the connection is back.');
        return;
      }
      if (p.before != null && now === p.before) {
        adjustOps.resolved(key, 'not saved'); adjustOps.reset(key, 'safe to save'); adjustPending.delete(key);
        showDashError('Checked: the earlier adjustment (' + label + ') was NOT saved — the stock is still ' + now + '. Nothing was sent now; press Save again to save it.');
      } else if (p.before != null && now === p.before + p.change) {
        adjustOps.resolved(key, 'saved'); adjustOps.reset(key, 'confirmed by read-back'); adjustPending.delete(key);
        if (amountInput) amountInput.value = '';
        showDashError('Checked: the earlier adjustment (' + label + ') WAS saved — the stock is now ' + now + '. Nothing more was sent. '
          + (p.via === 'function' ? 'Its line is in the Adjustment history below.' : 'Its line in the Adjustment history was NOT written (the reply was lost before that step): add it by hand if needed.'));
      } else {
        adjustOps.stillUnknown(key, 'changed elsewhere');
        showDashError('The dashboard cannot tell whether the earlier adjustment (' + label + ') was saved: the stock is now ' + (now == null ? 'unknown' : now) + (p.before != null ? ', it was ' + p.before + ' before,' : '') + ' and it changed in another way too. Nothing was sent. Check the Adjustment history below, then reload the page before saving again.');
      }
      loadInventory();
      loadInventoryAdjustments();
    }

    document.getElementById('adjustInventoryForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const productSelect = document.getElementById('invProduct');
      const bucketSelect = document.getElementById('invBucket');
      const amountInput = document.getElementById('invAmount');
      const reasonInput = document.getElementById('invReason');
      const productId = productSelect.value;
      const bucket = bucketSelect.value;
      const changeAmount = parseInt(amountInput.value, 10);
      // "2.7" used to be cut to 2 silently; whole units only, refused otherwise.
      const changeProblem = numVal(amountInput).trim() === '' ? '' : numberInputError(numVal(amountInput), { label: 'The amount', min: -1000000, max: 1000000, integer: true });
      if (changeProblem) { showDashError(changeProblem + ' Nothing was changed.'); return; }

      if (!productId) { showDashError('Pick a product to adjust.'); return; }
      if (!bucket) { showDashError('Pick which bucket this adjustment applies to.'); return; }
      const key = adjustKey(productId, bucket);
      // A lost reply is checked before anything else is sent (EXT17).
      if (adjustOps.isUnknown(key)) { await checkUnknownAdjustment(key, amountInput); return; }
      if (adjustOps.isInFlight(key)) { showDashError('An adjustment for this product and bucket is still being saved. Wait for it to finish.'); return; }
      if (!changeAmount) { showDashError('Enter a non-zero amount (positive to add, negative to remove).'); return; }
      if (!canChangeStock()) { showDashError('Only the Owner or an Administrator can change stock. Nothing was changed.'); return; }

      const submitBtn = e.target.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn.textContent;
      submitBtn.disabled = true;
      // EXT9: R4 (adjust_inventory) when its switch is on: the stock and its
      // history in one transaction. It sends the number this page shows, so a
      // change saved elsewhere meanwhile is refused instead of applied twice.
      if (await stockFunctionOn('adjust')) {
        const shownRow = (SEARCH_INDEX.inventory || []).find(p => p.id === productId);
        const shownInv = shownRow ? (Array.isArray(shownRow.inventory) ? shownRow.inventory[0] : shownRow.inventory) : null;
        const shown = shownInv && shownInv[bucket] != null && Number.isInteger(Number(shownInv[bucket])) ? Number(shownInv[bucket]) : null;
        if (!adjustOps.begin(key)) { submitBtn.disabled = false; showDashError('An adjustment for this product and bucket is still being saved. Wait for it to finish.'); return; }
        try {
          await callStockFunction('adjust_inventory', { p_product_id: productId, p_bucket: bucket, p_change: changeAmount, p_reason: reasonInput.value.trim() || null, p_expected: shown });
          adjustOps.confirmed(key, 'function');
          bucketSelect.value = ''; amountInput.value = ''; reasonInput.value = '';
          toastOk('Stock adjusted.');
        } catch (err) {
          if (err && err.kind === 'unknown') {
            adjustOps.unknown(key, 'reply lost (function)');
            adjustPending.set(key, { productId, bucket, before: shown, change: changeAmount, via: 'function' });
          } else if (err && err.hint === 'stale_value') { adjustOps.conflict(key, 'stale'); adjustOps.reset(key, 'shown'); }
          else if (/JWT|expired|sign in again/i.test(String(err && err.message))) { adjustOps.sessionExpired(key, 'session'); adjustOps.reset(key, 'shown'); }
          else if (/permission|row-level|not permitted/i.test(String(err && err.message))) { adjustOps.permissionDenied(key, 'permission'); adjustOps.reset(key, 'shown'); }
          else { adjustOps.failedBeforeEffect(key, err && err.hint === 'below_zero' ? 'below zero' : 'refused'); adjustOps.reset(key, 'shown'); }
          showDashError(err.hint === 'stale_value'
            ? 'This stock changed since the page loaded, so nothing was changed. The numbers have been refreshed: check them and save again if still needed.'
            : err.hint === 'below_zero' ? err.message.replace(/^Nothing was changed: /, '') + ' Nothing was changed.'
            : 'Could not save that adjustment. ' + stockFunctionError(err, 'the adjustment', false)
              + (adjustOps.isUnknown(key) ? ' Pressing Save again first checks whether it was saved; it never sends it twice.' : ''));
        }
        loadInventory();
        loadInventoryAdjustments();
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
        return;
      }
      if (!adjustOps.begin(key)) { submitBtn.disabled = false; showDashError('An adjustment for this product and bucket is still being saved. Wait for it to finish.'); return; }
      let stockDone = false;
      try {
        // Compare-and-set: never overwrites a change someone else saved in
        // between, and refuses to go below zero using fresh numbers.
        const uid = await currentUserId();
        try {
          await changeStock(productId, { [bucket]: changeAmount }, uid);
          stockDone = true;
        } catch (stockErr) {
          if (stockErr && stockErr.belowZero) { adjustOps.failedBeforeEffect(key, 'below zero'); adjustOps.reset(key, 'shown'); showDashError(stockErr.message); return; }
          // A dropped connection before any write was sent (the stock read)
          // changed nothing; only a lost reply to the write itself is unknown.
          if (isNetworkError(stockErr) && !stockErr.stockAttempt) {
            adjustOps.failedBeforeEffect(key, 'read failed'); adjustOps.reset(key, 'shown');
            showDashError('The connection dropped before anything was saved, so nothing was changed. You can press Save again.');
            return;
          }
          if (isNetworkError(stockErr)) {
            adjustOps.unknown(key, 'stock reply lost');
            adjustPending.set(key, { productId, bucket, before: stockErr.stockAttempt.before[bucket], change: changeAmount, via: 'table' });
            showDashError('The connection dropped while saving, so this adjustment may or may not have been saved. Pressing Save again first checks the stock and tells you which; it never sends the adjustment twice.');
            loadInventory();
            loadInventoryAdjustments();
            return;
          }
          throw stockErr;
        }

        const { error: logErr } = await supabase
          .from('inventory_adjustments')
          .insert({ product_id: productId, bucket, change_amount: changeAmount, reason: reasonInput.value.trim() || null, adjusted_by: uid });
        if (logErr) throw logErr;

        adjustOps.confirmed(key, 'saved');
        bucketSelect.value = '';
        amountInput.value = '';
        reasonInput.value = '';
        loadInventory();
        loadInventoryAdjustments();
      } catch (err) {
        if (stockDone) {
          // EXT17: the stock WAS changed; only its history entry failed. This used
          // to read "Could not save that adjustment", which invited a second save
          // that would have changed the stock twice.
          adjustOps.confirmed(key, 'stock saved, history not');
          amountInput.value = '';
          showDashError('The stock WAS changed (' + (changeAmount > 0 ? '+' : '') + changeAmount + '), but its line in the Adjustment history could not be saved'
            + (isNetworkError(err) ? ' (or its reply was lost)' : '') + '. Do not save it again. Add a note to the history by hand if needed.');
          loadInventory();
          loadInventoryAdjustments();
        } else {
          if (adjustOps.state(key) === 'SENDING') {
            if (/JWT|expired|sign in again/i.test(String(err && err.message))) adjustOps.sessionExpired(key, 'session');
            else if (/permission|row-level|not permitted/i.test(String(err && err.message))) adjustOps.permissionDenied(key, 'permission');
            else adjustOps.failedBeforeEffect(key, 'refused');
            adjustOps.reset(key, 'shown');
          }
          showDashError('Could not save that adjustment: ' + (err && err.message ? err.message : err));
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }
    });

    async function loadReturns(){
      try {
        // order_items.unit_price / line_total feed the refund cap. They are
        // written by manual-order-entry.html, but if a database ever lacks
        // them, fall back to the old column list (no cap) instead of failing
        // the whole page.
        const RETURN_COLS = 'id, order_id, order_item_id, reason, status, product_condition, disposition, refund_amount, approved_at, received_at, refunded_at, notes, created_at, orders(order_number, customer_name), ';
        // Every open return is listed (up to 1,000), plus the newest 200
        // closed ones. Counts come from the database's exact counts, so an
        // open return can never drop off the page just because 200 newer
        // returns exist (X3-04, 2026-10-06).
        const OPEN_CAP = 1000, CLOSED_CAP = 200;
        const readPart = (itemCols, closed) => {
          let q = supabase.from('returns').select(RETURN_COLS + 'order_items(' + itemCols + ')', { count: 'exact' });
          q = closed ? q.eq('status', 'closed') : q.neq('status', 'closed');
          return q.order('created_at', { ascending: false }).limit(closed ? CLOSED_CAP : OPEN_CAP);
        };
        const readReturns = async (itemCols) => {
          const [open, closed] = await Promise.all([readPart(itemCols, false), readPart(itemCols, true)]);
          const error = open.error || closed.error;
          if (error) return { error };
          const data = [...(open.data || []), ...(closed.data || [])].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
          return { data, error: null, openCount: open.count, closedCount: closed.count, openShown: (open.data || []).length, closedShown: (closed.data || []).length };
        };
        let read = await readReturns('product_name, sku, quantity, unit_price, line_total');
        if (read.error && (String(read.error.code) === '42703' || /does not exist/i.test(read.error.message || ''))) {
          read = await readReturns('product_name, sku, quantity');
        }
        if (read.error) throw read.error;
        const returns = read.data;
        const { count: refundedTotal, error: refundedErr } = await supabase.from('returns')
          .select('id', { count: 'exact', head: true }).not('refunded_at', 'is', null);
        if (refundedErr) throw refundedErr;

        SEARCH_INDEX.returns = returns;

        // Populate the "Order" dropdown on the log-return form once — no need
        // to re-fetch it on every refresh. Its matching line items load on
        // demand when an order is picked (see the change listener below).
        const orderSelect = document.getElementById('retOrder');
        if (orderSelect && !orderSelect.dataset.loaded) {
          const { data: recentOrders, error: ordersErr } = await supabase
            .from('orders')
            .select('id, order_number, customer_name')
            .is('deleted_at', null)
            .order('placed_at', { ascending: false })
            .limit(RET_ORDER_CAP);
          if (ordersErr) throw ordersErr;
          // EXT20F: built as DOM nodes (h() text-ifies) instead of an HTML
          // string, so Returns is safe under Trusted Types enforcement.
          orderSelect.replaceChildren(
            h('option', { value: '' }, 'Order…'),
            ...(recentOrders || []).map(o => h('option', { value: o.id }, (o.order_number || o.id) + (o.customer_name ? ' — ' + o.customer_name : '')))
          );
          orderSelect.dataset.loaded = '1';
          // EXT8: the menu holds the newest RET_ORDER_CAP orders only; a
          // customer returning an older order must still be findable.
          const hint = document.getElementById('retOrderHint');
          if (hint) hint.textContent = (recentOrders || []).length >= RET_ORDER_CAP
            ? 'The menu lists the newest ' + RET_ORDER_CAP + ' orders. For an older one, type its number and press Find order.' : '';
        }

        const openCount = read.openCount != null ? read.openCount : read.openShown;
        const closedCount = read.closedCount != null ? read.closedCount : read.closedShown;
        const refundedCount = refundedTotal != null ? refundedTotal : returns.filter(r => r.refunded_at).length;
        document.getElementById('returnsStats').replaceChildren(
          h('div', { class: 'stat' }, h('div', { class: 'num' }, openCount + closedCount), h('div', { class: 'lbl' }, 'Total returns')),
          h('div', { class: 'stat' }, h('div', { class: 'num' }, openCount), h('div', { class: 'lbl' }, 'Open')),
          h('div', { class: 'stat' }, h('div', { class: 'num' }, refundedCount), h('div', { class: 'lbl' }, 'Refunded'))
        );
        const returnsCutNote = [
          openCount > read.openShown ? `Only the newest ${read.openShown} of ${openCount} open returns are listed below.` : '',
          closedCount > read.closedShown ? `Closed returns: showing the newest ${read.closedShown} of ${closedCount}.` : '',
        ].filter(Boolean).join(' ');

        if (!returns.length) {
          document.getElementById('returnsWrap').replaceChildren(h('p', { class: 'empty' }, 'No returns logged yet.'));
          return;
        }

        // EXT20F: Returns rows built as DOM nodes (same classes, data-* and
        // text as before) so the screen is safe under Trusted Types and the
        // existing button wiring (.decideReturnBtn, .markReceivedBtn, etc.)
        // continues to work unchanged.
        const returnRowNodes = returns.map(r => {
          const order = r.orders || {};
          const item = r.order_items || {};
          const statusLabel = RETURN_STATUS_LABELS[r.status] || r.status;
          const statusClass = r.status === 'approved' ? 'sev-medium' : (r.status === 'rejected' ? 'sev-high' : ((r.status === 'received' || r.status === 'refunded') ? 'sev-low' : ''));

          let actionNodes = [];
          if (r.status === 'requested') {
            actionNodes = [
              h('button', { type: 'button', class: 'small decideReturnBtn', 'data-next': 'approved' }, 'Approve'),
              h('button', { type: 'button', class: 'small decideReturnBtn', 'data-next': 'rejected' }, 'Reject'),
            ];
          } else if (r.status === 'approved') {
            actionNodes = [
              h('select', { class: 'dispositionSelect u-p-6-8 u-br-6 u-b-1-solid-xcfd8d6 u-ff-inherit u-fs-12' },
                h('option', { value: '' }, 'If restocking…'),
                h('option', { value: 'restock_available' }, 'Restock to Available'),
                h('option', { value: 'restock_damaged' }, 'Move to Damaged'),
                h('option', { value: 'discard' }, 'Discard (no restock)')),
              h('button', { type: 'button', class: 'small markReceivedBtn' }, 'Mark Received'),
            ];
          } else if (r.status === 'rejected') {
            actionNodes = [h('button', { type: 'button', class: 'small advanceReturnBtn', 'data-next': 'closed' }, 'Close')];
          } else if (r.status === 'received') {
            actionNodes = [
              h('input', { type: 'number', class: 'refundAmountInput u-w-130 u-p-5-7 u-br-6 u-b-1-solid-xcfd8d6 u-ff-inherit u-fs-12', min: '0', max: '1000000', step: '0.01', placeholder: 'Refund $ (optional)' }),
              h('button', { type: 'button', class: 'small markRefundedBtn' }, 'Mark Refunded'),
              h('button', { type: 'button', class: 'small advanceReturnBtn', 'data-next': 'closed' }, 'Close without refund'),
            ];
          } else if (r.status === 'refunded') {
            actionNodes = [h('button', { type: 'button', class: 'small advanceReturnBtn', 'data-next': 'closed' }, 'Close')];
          }

          const detailLine = [
            r.reason ? 'Reason: ' + (RETURN_REASON_LABELS[r.reason] || r.reason) : '',
            r.product_condition ? 'Condition: ' + (RETURN_CONDITION_LABELS[r.product_condition] || r.product_condition) : '',
            r.disposition ? 'Chosen outcome: ' + (RETURN_DISPOSITION_LABELS[r.disposition] || r.disposition) : '',
          ].filter(Boolean).join(' · ');

          const infoChildren = [h('b', null, item.product_name || 'Unknown item')];
          if (item.sku) infoChildren.push(' ', h('span', { class: 'u-c-muted u-fs-12' }, '(' + item.sku + ')'));
          infoChildren.push(' — Qty ' + (item.quantity !== undefined && item.quantity !== null ? item.quantity : '—'));
          infoChildren.push(h('span', { class: 'badge ' + statusClass + ' u-ml-6' }, statusLabel));
          if (r.refund_amount !== null && r.refund_amount !== undefined) infoChildren.push(h('span', { class: 'badge u-ml-4' }, 'Refunded $' + Number(r.refund_amount).toFixed(2)));
          infoChildren.push(h('br'), h('span', { class: 'u-fs-12 u-c-muted' }, 'Order ' + (order.order_number || r.order_id) + (order.customer_name ? ' — ' + order.customer_name : '')));
          if (detailLine) infoChildren.push(h('br'), h('span', { class: 'u-fs-12 u-c-muted' }, detailLine));
          if (r.notes) infoChildren.push(h('br'), h('span', { class: 'u-fs-12 u-c-muted' }, 'Notes: ' + r.notes));
          infoChildren.push(h('br'), h('span', { class: 'u-fs-11 u-c-muted' }, 'Requested ' + fmtDate(r.created_at)));

          return h('div', { class: 'deletedRow u-ai-flex-start u-fwr-wrap', 'data-return-id': r.id, 'data-status': r.status || '', 'data-line-value': returnLineValue(item), 'data-item-sku': item.sku || '', 'data-quantity': item.quantity || 0, 'data-order-label': order.order_number || r.order_id },
            h('div', { class: 'info u-flex-1 u-minw-220' }, ...infoChildren),
            h('div', { class: 'u-d-flex u-gap-6 u-ai-center u-fwr-wrap' }, ...actionNodes)
          );
        });

        const returnsWrapEl = document.getElementById('returnsWrap');
        returnsWrapEl.replaceChildren(
          ...(returnsCutNote ? [h('p', { class: 'hint returnsCutNote u-m-0-0-8 u-c-warn' }, returnsCutNote)] : []),
          ...returnRowNodes
        );

        // Approve or Reject a fresh request.
        document.querySelectorAll('.decideReturnBtn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const row = btn.closest('[data-return-id]');
            const id = row.getAttribute('data-return-id');
            const next = btn.getAttribute('data-next');
            btn.disabled = true;
            try {
              const uid = await currentUserId();
              const patch = { status: next, updated_at: new Date().toISOString() };
              if (next === 'approved') { patch.approved_by = uid; patch.approved_at = new Date().toISOString(); }
              // Approve/Reject only a return that is still "requested": a page
              // opened earlier must not re-open a return that was received or
              // refunded since (that used to allow a second restock and refund).
              const changed = await updateIfUnchanged('returns', id, patch, { status: 'requested' });
              if (!changed) showDashError(staleMessage('That return'));
              loadReturns();
            } catch (err) {
              btn.disabled = false;
              showDashError('Could not update that return: ' + (err && err.message ? err.message : err));
            }
          });
        });

        // Simple status advance: Rejected -> Closed, Refunded -> Closed, or
        // Received -> Closed directly when there's no refund to issue (e.g.
        // an exchange rather than a refund).
        document.querySelectorAll('.advanceReturnBtn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const row = btn.closest('[data-return-id]');
            const id = row.getAttribute('data-return-id');
            const next = btn.getAttribute('data-next');
            btn.disabled = true;
            try {
              const seen = row.getAttribute('data-status') || null;
              const changed = await updateIfUnchanged('returns', id, { status: next, updated_at: new Date().toISOString() }, { status: seen });
              if (!changed) showDashError(staleMessage('That return'));
              loadReturns();
            } catch (err) {
              btn.disabled = false;
              showDashError('Could not update that return: ' + (err && err.message ? err.message : err));
            }
          });
        });

        // Mark Received: records the disposition, and if it's a restock,
        // looks up the matching product by SKU (order_items only stores the
        // SKU as text, not a product id) and adds the quantity back into
        // Inventory, logging it exactly like a manual Inventory adjustment —
        // so the count only has to be entered once. If no product currently
        // matches that SKU, the return still gets marked Received, but
        // you'll be told to adjust Inventory by hand.
        document.querySelectorAll('.markReceivedBtn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const row = btn.closest('[data-return-id]');
            const id = row.getAttribute('data-return-id');
            const sku = row.getAttribute('data-item-sku');
            const quantity = Number(row.getAttribute('data-quantity') || 0);
            const orderLabel = row.getAttribute('data-order-label');
            const dispositionSelect = row.querySelector('.dispositionSelect');
            const disposition = dispositionSelect ? dispositionSelect.value : '';
            if (!disposition) { showDashError('Pick what happens to the stock before marking this Received.'); return; }
            // Stock can only be changed by the Owner or an Administrator (the
            // database's own rules, Query A). Check before anything is saved, so
            // an employee never ends up with a return marked Received whose
            // restock was then refused.
            const restocks = (disposition === 'restock_available' || disposition === 'restock_damaged') && quantity > 0 && !!sku;
            if (restocks && !canChangeStock()) {
              showDashError('Only the Owner or an Administrator can restock a return. Nothing was changed. Ask one of them to mark it Received, or choose "Discard" if the item is not going back into stock.');
              return;
            }
            btn.disabled = true;
            // EXT9: R3 (receive_return) when its switch is on: the Received
            // status and the restock in one transaction; a return received
            // once is never restocked again.
            if (await stockFunctionOn('ret')) {
              try {
                const r = await callStockFunction('receive_return', { p_return_id: id, p_disposition: disposition, p_quantity: null }); // whole line, as today (partial returns wait on owner decision D-ops-5)
                if (r.already_done) toast('That return was already received — no stock was added again.');
                else if (r.restocked) toastOk('Return received — ' + Number(r.quantity || 0) + ' added back to Inventory.');
                else if (r.note === 'no_sku') showDashError('This return has no SKU on file, so it was marked Received without an automatic restock — please adjust Inventory manually.');
                else if (r.note === 'no_product_with_sku') showDashError('No product currently has SKU "' + (r.sku || sku) + '" — this return was marked Received, but you’ll need to adjust Inventory by hand.');
                else toastOk('Return received.');
              } catch (err) {
                showDashError('Could not mark that return Received. ' + stockFunctionError(err, 'receiving the return', true));
              }
              loadReturns();
              loadInventory();
              loadInventoryAdjustments();
              return;
            }
            // Claim first: mark the return Received only if it is still
            // Approved. Only the click that wins the claim restocks, so a
            // double click, a second tab or a retry can't restock twice.
            let uid = null;
            try {
              uid = await currentUserId();
              const claimed = await updateIfUnchanged('returns', id,
                { status: 'received', disposition, received_at: new Date().toISOString(), updated_at: new Date().toISOString() },
                { status: 'approved' });
              if (!claimed) {
                showDashError(staleMessage('That return') + ' No stock was added.');
                loadReturns();
                return;
              }
            } catch (err) {
              btn.disabled = false;
              if (isNetworkError(err)) {
                // X11-02: the claim may have been saved with only its reply
                // lost. The restock runs after the claim, so in that case it
                // never ran, and a second press is refused as "changed
                // elsewhere". Read the return back and say exactly which.
                const outcome = await claimOutcomeAfterDrop('returns', id, 'approved', 'received');
                if (outcome === 'not_saved') {
                  showDashError('The connection dropped and the return was NOT marked Received. Nothing was changed; you can press Mark Received again.');
                } else if (outcome === 'saved') {
                  btn.disabled = true;
                  showDashError(restocks
                    ? 'The connection dropped after the return was marked Received, so its restock did NOT run from this screen. Check Inventory for SKU "' + sku + '": if the ' + quantity + ' unit' + (quantity === 1 ? ' was' : 's were') + ' not added, adjust it by hand (reason: "Return received, order ' + orderLabel + '"). Do not press Mark Received again.'
                    : 'The connection dropped, but the return is marked Received. Nothing else was needed for this disposition.');
                  loadReturns();
                } else {
                  showDashError('The connection dropped and the dashboard cannot tell whether this return was marked Received. Reload the page and check its status before pressing again; if it shows Received, check Inventory too.');
                }
                return;
              }
              showDashError('Could not mark that return Received — nothing was changed: ' + (err && err.message ? err.message : err));
              return;
            }
            try {
              if ((disposition === 'restock_available' || disposition === 'restock_damaged') && quantity > 0) {
                if (!sku) {
                  showDashError('This return has no SKU on file, so it was marked Received without an automatic restock — please adjust Inventory manually.');
                } else {
                  const { data: matchedProduct, error: prodErr } = await supabase
                    .from('products')
                    .select('id')
                    // Case-insensitive, like the database's unique index on lower(sku).
                    .ilike('sku', likeLiteral(sku))
                    .maybeSingle();
                  if (prodErr) throw prodErr;
                  if (!matchedProduct) {
                    showDashError(`No product currently has SKU "${sku}" — this return was marked Received, but you'll need to adjust Inventory by hand.`);
                  } else {
                    const productId = matchedProduct.id;
                    const bucket = disposition === 'restock_available' ? 'available' : 'damaged';
                    await changeStock(productId, { [bucket]: quantity }, uid);
                    const { error: adjErr } = await supabase
                      .from('inventory_adjustments')
                      .insert({ product_id: productId, bucket, change_amount: quantity, reason: `Return received (order ${orderLabel})`, adjusted_by: uid });
                    if (adjErr) throw adjErr;
                  }
                }
              }
            } catch (err) {
              showDashError('The return is marked Received, but the restock did not finish: ' + (err && err.message ? err.message : err)
                + ' The stock may or may not have been added — check Inventory and adjust by hand if needed. Do not re-receive the return.');
            }
            loadReturns();
            loadInventory();
            loadInventoryAdjustments();
          });
        });

        // Mark Refunded: moves the return into its own Refunded stage and
        // records the amount. This never moves money itself — it just notes
        // that a refund was processed outside the system, consistent with
        // this project's "AI/dashboard can flag, never authorize alone" rule.
        document.querySelectorAll('.markRefundedBtn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const row = btn.closest('[data-return-id]');
            const id = row.getAttribute('data-return-id');
            const amountInput = row.querySelector('.refundAmountInput');
            const raw = amountInput ? numVal(amountInput).trim() : '';
            const amount = raw === '' ? null : Number(raw);
            // Whole cents, not negative, not absurd (EXT4: 10.009 used to be saved).
            const refundProblem = numberInputError(raw, { label: 'The refund amount', allowBlank: true, max: 1000000, decimals: 2 });
            if (refundProblem) {
              showDashError(refundProblem + ' Nothing was saved.');
              return;
            }
            const lineValueAttr = row.getAttribute('data-line-value');
            const lineValue = lineValueAttr === '' || lineValueAttr === null ? null : Number(lineValueAttr);
            if (amount !== null && lineValue !== null && !isNaN(lineValue) && amount > lineValue + 0.005) {
              showDashError('That refund (' + fmtMoney(amount) + ') is more than this order line was worth (' + fmtMoney(lineValue) + '). Check the amount — nothing was saved.');
              return;
            }
            // Recording a refund is final (it feeds Accounting): a second,
            // deliberate press that shows the amount being recorded.
            if (!confirmSecondPress(btn, amount !== null ? 'Confirm refund of ' + fmtMoney(amount) + '?' : 'Confirm: refunded (no amount)?')) return;
            btn.disabled = true;
            try {
              // Only from Received, and only once: a second click or a stale
              // page can't overwrite the amount or record a second refund.
              const changed = await updateIfUnchanged('returns', id,
                { status: 'refunded', refunded_at: new Date().toISOString(), refund_amount: amount, updated_at: new Date().toISOString() },
                { status: 'received' });
              if (!changed) showDashError(staleMessage('That return') + ' No refund was recorded.');
              loadReturns();
            } catch (err) {
              btn.disabled = false;
              showDashError('Could not mark that return as refunded: ' + (err && err.message ? err.message : err));
            }
          });
        });
      } catch (err) {
        showDashError('Could not load Returns: ' + (err && err.message ? err.message : err));
      }
    }

    // When an order is picked on the log-return form, load that order's line
    // items into the second dropdown on demand — a return is always for one
    // specific line item (its full quantity), never a raw product pick,
    // since that's how the real returns table links back to what was
    // actually sold.
    // EXT8: find any (not deleted) order by its number, matched literally.
    async function findReturnOrder(){
      const input = document.getElementById('retOrderFind');
      const btn = document.getElementById('retOrderFindBtn');
      const hint = document.getElementById('retOrderHint');
      const select = document.getElementById('retOrder');
      const text = input.value.trim();
      if (!text || btn.disabled) return;
      btn.disabled = true;
      try {
        const { data, error } = await supabase.from('orders').select('id, order_number, customer_name')
          .is('deleted_at', null).ilike('order_number', '%' + likeLiteral(text) + '%')
          .order('placed_at', { ascending: false }).limit(20);
        if (error) throw error;
        if (!data || !data.length) { hint.textContent = 'No order number contains "' + text + '".'; return; }
        for (const o of data) {
          if (![...select.options].some(op => op.value === o.id)) {
            const op = document.createElement('option');
            op.value = o.id;
            op.textContent = (o.order_number || o.id) + (o.customer_name ? ' — ' + o.customer_name : '');
            select.insertBefore(op, select.options[1] || null);
          }
        }
        select.value = data[0].id;
        select.dispatchEvent(new Event('change'));
        hint.textContent = data.length === 1 ? 'Found order ' + (data[0].order_number || '') + '.'
          : 'Found ' + data.length + (data.length === 20 ? ' or more' : '') + ' orders; the newest is selected. Check the menu.';
      } catch (err) {
        showDashError('Could not search orders: ' + explainDbError((err && err.message) || String(err)));
      } finally { btn.disabled = false; }
    }
    document.getElementById('retOrderFindBtn').addEventListener('click', findReturnOrder);
    document.getElementById('retOrderFind').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); findReturnOrder(); } });

    document.getElementById('retOrder').addEventListener('change', async (e) => {
      const orderItemSelect = document.getElementById('retOrderItem');
      const orderId = e.target.value;
      if (!orderId) {
        orderItemSelect.replaceChildren(new Option('Pick an order first…', ''));
        orderItemSelect.disabled = true;
        return;
      }
      orderItemSelect.disabled = true;
      orderItemSelect.replaceChildren(new Option('Loading…', ''));
      try {
        const { data: items, error } = await supabase
          .from('order_items')
          .select('id, product_name, sku, quantity')
          .eq('order_id', orderId)
          .order('product_name', { ascending: true });
        if (error) throw error;
        if (!items || !items.length) {
          orderItemSelect.replaceChildren(new Option('No line items found on this order', ''));
          return;
        }
        orderItemSelect.innerHTML = '<option value="">Which item…</option>' +
          items.map(it => `<option value="${esc(it.id)}">${esc(it.product_name || it.sku || it.id)}${it.sku ? ' (' + esc(it.sku) + ')' : ''} — Qty ${esc(it.quantity)}</option>`).join('');
        orderItemSelect.disabled = false;
      } catch (err) {
        showDashError("Could not load that order's items: " + (err && err.message ? err.message : err));
        orderItemSelect.replaceChildren(new Option('Pick an order first…', ''));
      }
    });

    document.getElementById('logReturnForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const orderSelect = document.getElementById('retOrder');
      const orderItemSelect = document.getElementById('retOrderItem');
      const reasonSelect = document.getElementById('retReason');
      const conditionSelect = document.getElementById('retCondition');
      const notesInput = document.getElementById('retNotes');

      const orderId = orderSelect.value;
      const orderItemId = orderItemSelect.value;

      if (!orderId) { showDashError('Pick which order this return is for.'); return; }
      if (!orderItemId) { showDashError('Pick which item on that order is being returned.'); return; }
      if (!reasonSelect.value) { showDashError('Pick a reason for the return.'); return; }

      const submitBtn = e.target.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn.textContent;
      submitBtn.disabled = true;
      try {
        const uid = await currentUserId();
        const { error: insErr } = await insertOnce(e.target, 'returns', {
            order_id: orderId,
            order_item_id: orderItemId,
            reason: reasonSelect.value,
            product_condition: conditionSelect.value || null,
            notes: notesInput.value.trim() || null,
            created_by: uid,
          }, 'That return');
        if (insErr) throw insErr;

        orderSelect.value = '';
        orderItemSelect.replaceChildren(new Option('Pick an order first…', ''));
        orderItemSelect.disabled = true;
        reasonSelect.value = '';
        conditionSelect.value = '';
        notesInput.value = '';
        loadReturns();
      } catch (err) {
        showDashError('Could not log that return: ' + (err && err.message ? err.message : err));
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }
    });

    document.getElementById('addExpenseForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const categoryInput = document.getElementById('expCategory');
      const amountInput = document.getElementById('expAmount');
      const dateInput = document.getElementById('expDate');
      const vendorInput = document.getElementById('expVendor');
      const noteInput = document.getElementById('expNote');
      const receiptInput = document.getElementById('expReceipt');
      const category = categoryInput.value;
      const amount = parseFloat(amountInput.value);
      if (!category) {
        showDashError('Pick a category for this expense.');
        return;
      }
      const amountProblem = numberInputError(numVal(amountInput), { label: 'The amount', min: 0, minExclusive: true, max: 10000000, decimals: 2 });
      if (amountProblem) {
        showDashError(amountProblem + ' Enter an amount greater than $0.');
        return;
      }
      const receiptFile = receiptInput.files && receiptInput.files[0];
      const receiptProblem = uploadProblem(receiptFile);
      if (receiptProblem) { showDashError(receiptProblem); return; }
      const submitBtn = e.target.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn.textContent;
      submitBtn.disabled = true;
      try {
        const rk = await formRequestKey(e.target);
        const saveExpense = receiptPath => supabase.from('expenses').insert(withRequestKey({
          category,
          amount,
          expense_date: dateInput.value || localDateString(new Date()),
          vendor: vendorInput.value.trim() || null,
          note: noteInput.value.trim() || null,
          receipt_path: receiptPath,
        }, rk));
        // Used to leave the receipt file behind whenever the expense was refused.
        if (receiptFile) {
          submitBtn.textContent = 'Uploading receipt…';
          const safeName = safeStorageName(receiptFile.name);
          try {
            await uploadThenSave('expense-receipts', 'expenses', 'receipt_path', `${uploadStamp()}_${safeName}`, receiptFile, saveExpense);
          } catch (upErr) {
            // A repeat of a saved attempt: this upload was removed again by
            // uploadThenSave; the earlier expense keeps its own receipt.
            if (!isRequestKeyRepeat(upErr)) throw upErr;
            toast('That expense' + REPEAT_NOTE);
          }
        } else {
          let { error } = await saveExpense(null);
          if (isRequestKeyRepeat(error)) { toast('That expense' + REPEAT_NOTE); error = null; }
          if (error) {
            // No reply at all: it may have been saved. Saying "try again"
            // here is how an expense gets logged twice.
            if (isNetworkError(error)) throw new Error('The connection dropped, so the expense may or may not have been saved. Check the list below before adding it again.');
            throw error;
          }
        }
        categoryInput.value = '';
        amountInput.value = '';
        vendorInput.value = '';
        noteInput.value = '';
        receiptInput.value = '';
        dateInput.value = localDateString();
        clearRequestKey(e.target);
        loadExpenses();
      } catch (err) {
        showDashError('Could not save that expense: ' + (err && err.message ? err.message : err));
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }
    });

    // ---------- Accounting Agent (Agent #9) ----------
    // Live rollup only — no table of its own. Combines real order revenue
    // (from `orders`) with logged spending (from `expenses`) into one profit
    // picture, recalculated fresh every time this panel loads or the date
    // range changes.
    let acctRange = 'today';

    async function loadAccounting(){
      const isLatest = newLoadToken('accounting');
      try {
        const start = acctRangeStart(acctRange);

        const orders = await fetchAllRows('orders', 'id, order_number, total, currency, status, placed_at, deleted_at, source', q => {
          q = q.is('deleted_at', null);
          if (start) q = q.gte('placed_at', start.toISOString());
          return q;
        });
        const expenses = await fetchAllRows('expenses', 'id, amount, expense_date, deleted_at, note', q => {
          q = q.is('deleted_at', null);
          if (start) q = q.gte('expense_date', localDateString(start));
          return q;
        });

        if (!isLatest()) return;
        const currency = (orders[0] && orders[0].currency) || 'USD';
        const acctMixed = mixedCurrencyNote(orders, 'Accounting', currency);
        const acctCounted = orders.filter(o => { const c = classifyOrderStatus(o.status); return !(c.isCancelled || (c.isRefund && !c.isPartialRefund)); });
        showPageWarning('accountingPanel', [acctMixed, missingTotalNote(acctCounted, 'Accounting')].filter(Boolean).join(' ') || null); // X8-19, X11-01
        let revenue = 0;
        let excluded = 0;
        const needsReview = [];

        orders.forEach(o => {
          const amt = Number(o.total || 0);
          const { isCancelled, isRefund, isPartialRefund } = classifyOrderStatus(o.status);
          if (isCancelled || (isRefund && !isPartialRefund)) {
            excluded += amt;
            return;
          }
          revenue += amt;
          if (isPartialRefund) needsReview.push(o);
        });
        const returnRefundTotal = refundsToSubtract(orders, await returnRefundsIn(start, null), ACCOUNTING_REFUND_POLICY);
        if (!isLatest()) return; // a newer period was chosen meanwhile
        revenue -= returnRefundTotal;

        const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
        const netProfit = revenue - totalExpenses;

        document.getElementById('acctStats').innerHTML = `
          <div class="stat"><div class="num">${esc(fmtMoney(revenue, currency))}</div><div class="lbl">Revenue</div></div>
          <div class="stat"><div class="num">${esc(fmtMoney(totalExpenses, currency))}</div><div class="lbl">Expenses</div></div>
          <div class="stat"><div class="num">${esc(fmtMoney(netProfit, currency))}</div><div class="lbl">Net profit</div></div>
          <div class="stat"><div class="num">${esc(fmtMoney(excluded, currency))}</div><div class="lbl">Cancelled / refunded (excluded)</div></div>
          ${ACCOUNTING_REFUND_POLICY === 'subtract_return_refunds' ? `<div class="stat"><div class="num">${esc(fmtMoney(returnRefundTotal, currency))}</div><div class="lbl">Refunds on Returns (subtracted)</div></div>` : ''}
        `;

        // RP-06 (EXT3): the same purchase order's cost logged more than once
        // (a retried or half-finished receive). Shown for review only.
        const poCosts = Object.create(null);
        expenses.forEach(e => {
          const m = /^Purchase order (.+)$/.exec(String(e.note || '').trim());
          if (!m) return;
          (poCosts[m[1]] = poCosts[m[1]] || []).push(e);
        });
        const dupPos = Object.keys(poCosts).filter(k => poCosts[k].length > 1).sort();
        document.getElementById('acctDupWrap').innerHTML = !dupPos.length
          ? '<p class="empty">None found.</p>'
          : dupPos.map(k => `
            <div class="deletedRow acctDupRow">
              <div class="info"><b>Purchase order ${esc(k)}</b> — logged ${poCosts[k].length} times, ${esc(fmtMoney(poCosts[k].reduce((s, e) => s + Number(e.amount || 0), 0), currency))} in total<br>
              <span class="u-fs-11 u-c-muted">${poCosts[k].map(e => esc(fmtDateOnly(e.expense_date)) + ': ' + esc(fmtMoney(e.amount, currency))).join(' · ')}</span></div>
            </div>`).join('');

        // EXT6: manual orders saved without their items still count as revenue.
        // Only manual orders can end up like this (Shopify orders arrive with
        // their items), so only those are checked: a small extra read.
        const noItemsWrap = document.getElementById('acctNoItemsWrap');
        try {
          const empty = await manualOrdersWithoutItems(orders);
          if (!isLatest()) return;
          noItemsWrap.innerHTML = !empty.length
            ? '<p class="empty">None found.</p>'
            : empty.map(o => `
              <div class="deletedRow acctNoItemsRow">
                <div class="info"><b>${esc(o.order_number || o.id)}</b> — ${esc(fmtMoney(o.total, o.currency))}<br>
                <span class="u-fs-11 u-c-muted">Status: ${esc(o.status)} — Placed ${esc(fmtDate(o.placed_at))}</span></div>
              </div>`).join('');
        } catch (noItemsErr) {
          noItemsWrap.innerHTML = '<p class="empty">Could not check for orders without items: ' + esc(explainDbError((noItemsErr && noItemsErr.message) || String(noItemsErr))) + '</p>';
        }

        if (!needsReview.length) {
          document.getElementById('acctReviewWrap').replaceChildren(h('p', { class: 'empty' }, 'Nothing needs review right now.'));
        } else {
          document.getElementById('acctReviewWrap').innerHTML = needsReview.map(o => `
            <div class="deletedRow">
              <div class="info"><b>${esc(o.order_number || o.id)}</b> — ${esc(fmtMoney(o.total, o.currency))}<br>
              <span class="u-fs-11 u-c-muted">Status: ${esc(o.status)} — Placed ${esc(fmtDate(o.placed_at))}</span></div>
            </div>`).join('');
        }
      } catch (err) {
        if (!isLatest()) return; // an older load: its error no longer matters
        showDashError('Could not load Accounting: ' + (err && err.message ? err.message : err));
      }
    }

    document.getElementById('acctToggle').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-range]');
      if (!btn) return;
      acctRange = btn.getAttribute('data-range');
      document.querySelectorAll('#acctToggle button').forEach(b => {
        b.classList.toggle('secondary', b !== btn);
      });
      loadAccounting();
    });

    // ================= Tax Records (Agent #10) =================

    let taxRange = 'year';


    let TAX_REPORT = null; // kept around so the Export button doesn't have to re-query

    async function loadTaxRecords(){
      const isLatest = newLoadToken('tax');
      const loadRange = taxRange; // EXT10b (X10-22): the report remembers which period it is for
      try {
        const { start, end } = taxRangeStart(taxRange);

        const orders = await fetchAllRows('orders',
          'id, order_number, total, tax_total, currency, status, placed_at, deleted_at, source, raw_data', q => {
            q = q.is('deleted_at', null);
            if (start) q = q.gte('placed_at', start.toISOString());
            if (end) q = q.lt('placed_at', end.toISOString());
            return q;
          });
        const expenses = await fetchAllRows('expenses',
          'id, category, amount, expense_date, vendor, receipt_path, deleted_at', q => {
            q = q.is('deleted_at', null);
            if (start) q = q.gte('expense_date', localDateString(start));
            if (end) q = q.lt('expense_date', localDateString(end));
            return q;
          });

        const currency = (orders[0] && orders[0].currency) || 'USD';
        const taxMixed = mixedCurrencyNote(orders, 'Tax Records', currency);
        const taxCounted = orders.filter(o => { const c = classifyOrderStatus(o.status); return !(c.isCancelled || (c.isRefund && !c.isPartialRefund)); });
        showPageWarning('taxRecordsPanel', [taxMixed, missingTotalNote(taxCounted, 'Tax Records')].filter(Boolean).join(' ') || null); // X8-19, X11-01

        // Revenue + sales tax — same cancelled/refunded exclusion as Accounting,
        // so the two pages never quietly disagree on what counts as a real sale.
        let revenue = 0, salesTax = 0, stateUnknownTax = 0;
        const stateTax = Object.create(null);
        const inScopeOrders = [];
        orders.forEach(o => {
          const { isCancelled, isRefund, isPartialRefund } = classifyOrderStatus(o.status);
          if (isCancelled || (isRefund && !isPartialRefund)) return;
          inScopeOrders.push(o);
          revenue += Number(o.total || 0);
          const tax = Number(o.tax_total || 0);
          salesTax += tax;
          // EXT7: one row per state whatever the spelling (taxStateKey).
          const province = taxStateKey(o.raw_data && o.raw_data.shipping_address);
          if (province) stateTax[province] = (stateTax[province] || 0) + tax;
          else stateUnknownTax += tax;
        });
        const returnRefundTotal = refundsToSubtract(orders, await returnRefundsIn(start, end), ACCOUNTING_REFUND_POLICY);
        if (!isLatest()) return; // a newer period was chosen meanwhile
        revenue -= returnRefundTotal;

        // Expenses by category, split into COGS vs Operating.
        let cogsTotal = 0, operatingTotal = 0;
        const byCategory = Object.create(null);
        expenses.forEach(e => {
          const amt = Number(e.amount || 0);
          const info = TAX_CATEGORY_MAP[e.category] || { group: 'operating', label: e.category || 'Uncategorized' };
          if (info.group === 'cogs') cogsTotal += amt; else operatingTotal += amt;
          byCategory[e.category] = (byCategory[e.category] || 0) + amt;
        });
        const totalExpenses = cogsTotal + operatingTotal;
        const netProfit = revenue - totalExpenses;

        document.getElementById('taxStats').innerHTML = `
          <div class="stat"><div class="num">${esc(fmtMoney(revenue, currency))}</div><div class="lbl">Revenue</div></div>
          <div class="stat"><div class="num">${esc(fmtMoney(cogsTotal, currency))}</div><div class="lbl">Cost of Goods Sold (logged)</div></div>
          <div class="stat"><div class="num">${esc(fmtMoney(operatingTotal, currency))}</div><div class="lbl">Operating expenses</div></div>
          <div class="stat"><div class="num">${esc(fmtMoney(netProfit, currency))}</div><div class="lbl">Net profit</div></div>
          <div class="stat"><div class="num">${esc(fmtMoney(salesTax, currency))}</div><div class="lbl">Sales tax collected</div></div>
        `;

        const catRows = Object.keys(byCategory).map(cat => {
          const info = TAX_CATEGORY_MAP[cat] || { group: 'operating', label: cat || 'Uncategorized' };
          return { cat, label: info.label, group: info.group, amount: byCategory[cat] };
        }).sort((a, b) => (a.group === b.group ? b.amount - a.amount : (a.group === 'cogs' ? -1 : 1)));

        if (!catRows.length) {
          document.getElementById('taxCategoryWrap').replaceChildren(h('p', { class: 'empty' }, 'No expenses logged in this period.'));
        } else {
          document.getElementById('taxCategoryWrap').innerHTML = `
            <table><thead><tr><th>Category</th><th>Type</th><th>Total</th></tr></thead>
            <tbody>${catRows.map(r => `
              <tr>
                <td>${esc(r.label)}</td>
                <td><span class="badge${r.group === 'cogs' ? ' sev-medium' : ''}">${r.group === 'cogs' ? 'COGS' : 'Operating'}</span></td>
                <td>${esc(fmtMoney(r.amount, currency))}</td>
              </tr>`).join('')}</tbody></table>`;
        }

        // Estimated cost of units sold — quantity sold × each product's recorded
        // cost, matched by SKU the same way Returns already has to (order_items
        // has no live foreign key to products). A separate reference figure, not
        // a stand-in for the categorized expenses above.
        let estCogs = 0, unmatchedCount = 0;
        const unmatchedSkus = new Set();
        const orderIds = inScopeOrders.map(o => o.id);
        if (orderIds.length) {
          // Chunked and paged: every line of every order counts, and the
          // request URLs stay short however many orders there are.
          const items = await fetchAllRowsIn('order_items', 'id, order_id, sku, product_name, quantity', 'order_id', orderIds);
          if (!isLatest()) return;
          // EXT7: SKUs match ignoring case and outer spaces, as everywhere
          // else (products are unique by lower(sku); returns match that way).
          // An exact match listed "SYN-a" as having no cost although
          // "SYN-A" does. The catalogue is read whole (it is small) instead
          // of by exact SKU.
          const skuKey = s => String(s || '').trim().toLowerCase();
          const costBySku = Object.create(null);
          if ((items || []).some(i => skuKey(i.sku))) {
            const products = await fetchAllRows('products', 'id, sku, cost', q => q);
            if (!isLatest()) return;
            (products || []).forEach(p => { if (skuKey(p.sku)) costBySku[skuKey(p.sku)] = p.cost; });
          }
          (items || []).forEach(it => {
            const cost = skuKey(it.sku) ? costBySku[skuKey(it.sku)] : null;
            const qty = Number(it.quantity || 0);
            if (cost === null || cost === undefined) {
              unmatchedCount += qty;
              unmatchedSkus.add(it.sku || it.product_name || '(no SKU)');
            } else {
              estCogs += qty * Number(cost);
            }
          });
        }
        document.getElementById('taxCogsWrap').innerHTML = `
          <div class="statRow">
            <div class="stat"><div class="num">${esc(fmtMoney(estCogs, currency))}</div><div class="lbl">Estimated cost of units sold</div></div>
            <div class="stat"><div class="num">${unmatchedCount}</div><div class="lbl">Units with no matching cost</div></div>
          </div>
          ${unmatchedSkus.size ? `<p class="hint u-mt-8">SKUs with no cost on file: ${[...unmatchedSkus].map(esc).join(', ')}</p>` : ''}
        `;

        const stateEntries = Object.keys(stateTax).sort();
        if (!stateEntries.length && !stateUnknownTax) {
          document.getElementById('taxStateWrap').replaceChildren(h('p', { class: 'empty' }, 'No sales tax collected in this period.'));
        } else {
          document.getElementById('taxStateWrap').innerHTML = `
            <table><thead><tr><th>State</th><th>Sales tax collected</th></tr></thead>
            <tbody>
              ${stateEntries.map(s => `<tr><td>${esc(s)}</td><td>${esc(fmtMoney(stateTax[s], currency))}</td></tr>`).join('')}
              ${stateUnknownTax ? `<tr><td>Unknown / not yet verified</td><td>${esc(fmtMoney(stateUnknownTax, currency))}</td></tr>` : ''}
            </tbody></table>`;
        }

        const missing = expenses.filter(e => !e.receipt_path);
        if (!missing.length) {
          document.getElementById('taxReceiptWrap').replaceChildren(h('p', { class: 'empty' }, 'Every logged expense in this period has a receipt on file.'));
        } else {
          document.getElementById('taxReceiptWrap').innerHTML = `
            <table class="phoneCards"><thead><tr><th>Date</th><th>Category</th><th>Vendor</th><th>Amount</th></tr></thead>
            <tbody>${missing.map(e => `
              <tr>
                <td>${esc(fmtDateOnly(e.expense_date))}</td>
                <td>${esc((TAX_CATEGORY_MAP[e.category] || {}).label || e.category || '—')}</td>
                <td>${esc(e.vendor || '—')}</td>
                <td>${esc(fmtMoney(e.amount, currency))}</td>
              </tr>`).join('')}</tbody></table>`;
        }

        document.getElementById('taxStats').dataset.range = loadRange; // which period the figures on screen are for
        TAX_REPORT = { range: loadRange, currency, revenue, missingTotals: missingTotalCount(taxCounted), cogsTotal, operatingTotal, netProfit, salesTax, catRows, estCogs, unmatchedCount, stateTax, stateUnknownTax, missing };
      } catch (err) {
        if (!isLatest()) return; // an older load: its error no longer matters
        showDashError('Could not load Tax Records: ' + (err && err.message ? err.message : err));
      }
    }

    document.getElementById('taxToggle').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-range]');
      if (!btn) return;
      taxRange = btn.getAttribute('data-range');
      document.querySelectorAll('#taxToggle button').forEach(b => {
        b.classList.toggle('secondary', b !== btn);
      });
      loadTaxRecords();
    });

    document.getElementById('taxExportBtn').addEventListener('click', () => {
      if (!TAX_REPORT) { showDashError('Nothing to export yet — let the page finish loading.'); return; }
      // EXT10b (X10-22): never label one period's figures with another's name.
      if (TAX_REPORT.range !== taxRange) { showDashError('The report for the period you picked is still loading. Press Export again when the figures on screen have updated.'); return; }
      const r = TAX_REPORT;
      const periodLabel = taxRange === 'year' ? 'This Year' : taxRange === 'lastyear' ? 'Last Year' : 'All Time';
      const lines = [
        ['Health Endeavors — Tax Record report'],
        ['Period', periodLabel],
        [],
        ['Summary'],
        ['Revenue', fmtMoney(r.revenue, r.currency)],
        ...(r.missingTotals ? [['Orders with no total saved (NOT included in revenue)', r.missingTotals]] : []),
        ['Cost of Goods Sold (logged)', fmtMoney(r.cogsTotal, r.currency)],
        ['Operating expenses', fmtMoney(r.operatingTotal, r.currency)],
        ['Net profit', fmtMoney(r.netProfit, r.currency)],
        ['Sales tax collected', fmtMoney(r.salesTax, r.currency)],
        ['Estimated cost of units sold (reference only)', fmtMoney(r.estCogs, r.currency)],
        ['Units with no matching cost', r.unmatchedCount],
        [],
        ['Expenses by category'],
        ['Category', 'Type', 'Total'],
        ...r.catRows.map(c => [c.label, c.group === 'cogs' ? 'COGS' : 'Operating', fmtMoney(c.amount, r.currency)]),
        [],
        ['Sales tax by state'],
        ['State', 'Tax collected'],
        ...Object.keys(r.stateTax).sort().map(s => [s, fmtMoney(r.stateTax[s], r.currency)]),
        ...(r.stateUnknownTax ? [['Unknown / not yet verified', fmtMoney(r.stateUnknownTax, r.currency)]] : []),
        [],
        ['Expenses missing a receipt'],
        ['Date', 'Category', 'Vendor', 'Amount'],
        ...r.missing.map(e => [fmtDateOnly(e.expense_date), (TAX_CATEGORY_MAP[e.category] || {}).label || e.category || '', e.vendor || '', fmtMoney(e.amount, r.currency)]),
      ];
      const csv = lines.map(l => l.map(csvCell).join(',')).join('\r\n');
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tax-records-' + localDateString() + '.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });

    // If already logged in from a previous visit, skip straight to the dashboard.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) showDashboardFor(data.session.user);
    });
  }
