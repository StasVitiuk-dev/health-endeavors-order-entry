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
    const { RET_ORDER_CAP, ROW_CAP, STOCK_FN_FLAGS, FLAG_DEPENDS, THEME_ORDER, THEME_FACE, THEME_NAME, EMPTY_ICONS, SIDEBAR_GROUPS, ICON_PATHS, SEARCH_INDEX, BUSINESS_RULE_CONFIG_KEY, BUSINESS_RULE_UNIT_LABELS, INVENTORY_BUCKET_LABELS, RETURN_STATUS_LABELS, RETURN_REASON_LABELS, RETURN_CONDITION_LABELS, RETURN_DISPOSITION_LABELS, EXPENSE_CATEGORY_LABELS, HELP, GO_TO, ACTIVITY_PAGE_SIZE, RECORD_TITLE_KEYS, ROLE_LABELS, ACTIVITY_AREA_LABELS, PANEL_RECORD_TABLE, RECORD_ID_ATTRS, ITEM_TYPE_LABELS, NIGHTLY_PAGES, DB_STEPS, APPLE_CAL_HINT, CAL_COLORS, SUPPLIER_TYPE_LABELS, PO_STATUS_LABELS, PAYMENT_LABELS, PO_ALLOWED_FROM, PO_EDITABLE, QC_TYPE_LABELS, QC_RESULT_LABELS, QC_SEVERITY_LABELS, RECALL_STATUS_LABELS, TASK_STATUS_LABELS, TASK_NEXT_ACTIONS, TASK_ALLOWED_FROM, AGENT_REGISTRY, AGENT_STALE_AFTER_HOURS, INQ_STATUS_LABELS, INQ_ANSWERED_CAP, LAUNCH_BLOCKED_FLAGS, SYSTEM_MODE_LABELS, FR_STATUS_LABELS, FR_NEXT_STATUS, FR_NEXT_LABEL, DOCUMENT_LINK_TYPES, DOCUMENT_CATEGORY_LABELS, salesGrowthOn, scanShipmentOn, reorderPlanningOn, reportExportOn, invoicePreviewOn, recoveryDrillOn, savedViewsOn, cycleCountOn, partialReceivingOn, supplierScorecardOn, supplierDocsOn, supplierDocsStoreOn, invoicePaymentsOn, moneyMatchOn, moneyIssuesOn, receivingStoreOn, orderSlipsOn, backupsPageOn, newLookOn, LOOK_CHOICES, reconcileOn, opsWatchOn, PREVIEW_SWITCHES, reportVersionsOn } = HE.modules.create('he-config', {  });
    const { toastHost, toast, paintSkeletons, reduceMotion, animateNumber, labelPhoneCards, safeRun, rememberFocus, restoreFocus, focusDialog, decorateEmptyStates, getTheme, applyTheme, isSafeLink, fmtDate, helpMatches, helpOverlay, closeHelp, paletteOverlay, closePalette, shortcutOverlay, openShortcuts, closeShortcuts, typingInField, anyOverlayOpen, quickAdd, openQuickAdd, closeQuickAdd, offlineBar, ptr, closeMobileSidebar, h, pageIconNode } = HE.modules.create('he-ui', { EMPTY_ICONS, HELP, ICON_PATHS, THEME_FACE, THEME_NAME, THEME_ORDER });
    const { writesInFlight, newLoadToken, LIST_LIMITS, listLimit, appendMore, supabase, verifyOnly, updateIfUnchanged, claimOutcomeAfterDrop, changeStock, stockFunctionOn, callStockFunction, STOCK_FN_PROBES, stockFunctionInstalled, requestKeysOn, formRequestKey, clearRequestKey, insertOnce, withRequestKey, isRequestKeyRepeat, REPEAT_NOTE, stockFunctionError, fetchAllRows, fetchAllRowsIn, uploadThenSave, currentUserId, logCustomerAccess, poStatusNow, ACCOUNTING_REFUND_POLICY, returnRefundsIn, manualOrdersWithoutItems, errorKind } = HE.modules.create('he-data', { INVENTORY_BUCKET_LABELS, ROW_CAP, STOCK_FN_FLAGS, SUPABASE_ANON_KEY, SUPABASE_URL, classifyOrderStatus, explainDbError, isNetworkError, keyFingerprint, newRequestKey, toast });
    const { recordTitle, describeChange, hlValue, codeDiff, plainChange, resolveInspectTarget, activityFromDate, fetchAllActivity, loadActivityAreas, loadActivityDigest } = HE.modules.create('he-audit', { ACTIVITY_AREA_LABELS, PANEL_RECORD_TABLE, RECORD_ID_ATTRS, RECORD_TITLE_KEYS, h, supabase });
    const { environmentLabel, assetVersions, isMissingRelation, dbStepsStatus, NIGHTLY_STALE_MS, ATTN_STALE_MS, attnSeenGet, attnSeenSet, attnSignature } = HE.modules.create('he-status', { DB_STEPS, STOCK_FN_PROBES, SUPABASE_URL, stockFunctionInstalled, supabase });
    const { getTodayRange, getYesterdayRange, colorForCalendar, dateKey, eventDateKey, fmtTimeShort, personalEventEditorHtml, personalTimesFromInputs, PERSONAL_CAL_HINT, weekGroupLabel, monthGroupLabel } = HE.modules.create('he-time', { CAL_COLORS, h });
    const { missingToNaN, reportCount, missingTotalCount, missingTotalNote, mixedCurrencyNote, docExpiryBadge, inqStatusBadgeClass, continuityBadgeClass, qcIncidentCategory, numVal, CLOSED_IN } = HE.modules.create('he-format', { CLOSED_WORDS, fmtDateOnly, h });
    const { isGroupOpen, setGroupOpen, getPinnedPages, setPinnedPages, allPageIds, getLastPage, pageFromHash, saveLastPage, PAGE_WARNINGS, PAGE_LABEL_BY_ID, NAV_BACK, NAV_FWD, rowsOnPage, typedForms, NOT_GUARDED_FORMS, hasUnsavedTyping, CHANGE_PASSWORD_URL, SIGNED_OUT_NOTE } = HE.modules.create('he-nav', { SIDEBAR_GROUPS });
    const { loadTasks } = HE.modules.create('he-tasks', { CLOSED_IN, SEARCH_INDEX, TASK_ALLOWED_FROM, TASK_NEXT_ACTIONS, TASK_STATUS_LABELS, explainDbError, fmtDate, h, isClosedStatus, isOverdue, showDashError, supabase });
    const { loadApprovals } = HE.modules.create('he-approvals', { CLOSED_IN, SEARCH_INDEX, fmtDate, h, isClosedStatus, requireReauth, showDashError, staleMessage, supabase, updateIfUnchanged });
    const { escalateToIncidentOnce, loadIncidents } = HE.modules.create('he-incidents', { CLOSED_IN, SEARCH_INDEX, fixedRequestKey, fmtDate, h, isClosedStatus, isOverdue, isRequestKeyRepeat, requestKeysOn, showDashError, staleMessage, supabase, updateIfUnchanged, withRequestKey });
    const { loadExpenses, loadDeletedExpenses } = HE.modules.create('he-expenses', { EXPENSE_CATEGORY_LABELS, LIST_LIMITS, SEARCH_INDEX, appendMore, confirmSecondPress, fetchAllRows, fmtDate, fmtDateOnly, fmtMoney, h, listLimit, noRowsChanged, showDashError, staleMessage, supabase, updateIfUnchanged });
    const { loadSuppliers } = HE.modules.create('he-suppliers', { SEARCH_INDEX, SUPPLIER_TYPE_LABELS, boolGuard, fetchAllRows, h, showDashError, staleMessage, updateIfUnchanged });
    const { setReportHistoryView, renderReportHistoryView, loadReportHistory, reportHistoryRows } = HE.modules.create('he-reports', { fmtDateOnly, fmtMoney, h, localDateString, missingToNaN, monthGroupLabel, reportCount, rollupReports, showDashError, startOfWeekMonday, supabase, weekGroupLabel });
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
      // Nov 15: a very long account name is cut (it used to make the whole page
      // scroll sideways at computer size); the full line stays on hover.
      const whoName = String(profile.display_name || user.email || '');
      whoAmI.textContent = `${whoName.length > 80 ? whoName.slice(0, 79) + '\u2026' : whoName} — role: ${profile.role}`;
      whoAmI.title = whoAmI.textContent;
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
    // A menu entry that is a link without an address (the page changes inside
    // the dashboard): Tab reaches it, a screen reader calls it a link, Enter
    // opens it (as with any link; Space keeps its other meanings). Nov 15:
    // before, only a mouse could use these.
    function keyLink(el, after){
      el.setAttribute('role', 'link');
      el.setAttribute('tabindex', '0');
      el.addEventListener('keydown', (e) => {
        if (e.target !== el || e.key !== 'Enter') return;   // not the pin star inside it
        e.preventDefault();
        e.stopPropagation();           // Enter also means "open the row" elsewhere
        el.click();
        if (after) after();
      });
      // A mouse click or a tap leaves no keyboard focus behind on the entry, as
      // before it could take focus: "hover a row and press Space" keeps working.
      el.addEventListener('click', (e) => {
        if (!e.detail) return;                                // pressed from the keyboard
        const a = document.activeElement;
        if (a && a.getAttribute('role') === 'link' && a.classList.contains('sidebarLink')) a.blur();
      });
    }
    function pageLinkNode(p, pinnedSet){
      const badge = getPageBadgeCount(p.id);
      const isPinned = pinnedSet.has(p.id);
      return h('a', { class: 'sidebarLink' + (p.id === currentPageId ? ' active' : ''), 'data-page': p.id },
        h('span', { class: 'linkLabelRow' },
          h('button', { type: 'button', class: 'pinBtn' + (isPinned ? ' pinned' : ''), 'data-pin-page': p.id, title: isPinned ? 'Unpin' : 'Pin to top', 'aria-label': isPinned ? 'Unpin ' + p.label : 'Pin ' + p.label + ' to top' }, isPinned ? '★' : '☆'),
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
        // EXT20J: the earlier lookup's rows are rebuilt as fresh DOM nodes (the
        // cache holds a node-builder, not an HTML string) and shown again for
        // the same search, so the sidebar stays safe under Trusted Types.
        if (ORDER_LOOKUP.q === q && ORDER_LOOKUP.render) results.replaceChildren(...ORDER_LOOKUP.render());
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
      // The menu is redrawn often (a page opens, numbers refresh). Remember which
      // entry had keyboard focus and give it back afterwards, so a keyboard user
      // is not thrown out of the menu (Nov 15).
      const held = document.activeElement;
      let holdSel = null;
      if (held && wrap.contains(held)) {
        const esc = v => CSS.escape(v == null ? '' : v);
        if (held.classList.contains('pinBtn')) holdSel = '.pinBtn[data-pin-page="' + esc(held.getAttribute('data-pin-page')) + '"]';
        else if (held.classList.contains('groupToggle')) holdSel = '.groupToggle[data-group="' + esc(held.getAttribute('data-group')) + '"]';
        else if (held.classList.contains('searchResultLink')) holdSel = '.searchResultLink[data-result-index="' + esc(held.getAttribute('data-result-index')) + '"]';
        else if (held.classList.contains('sidebarLink')) holdSel = '.sidebarLink[data-page="' + esc(held.getAttribute('data-page')) + '"]:not(.searchResultLink)';
      }
      wrap.replaceChildren(...out);
      wrap.querySelectorAll('.sidebarGroup[data-group-color]').forEach(g => {
        const c = g.getAttribute('data-group-color');
        if (/^#[0-9a-fA-F]{3,8}$/.test(c)) g.style.setProperty('--groupColor', c);
      });
      wrap.querySelectorAll('.sidebarLink').forEach(link => {
        link.addEventListener('click', () => showPage(link.getAttribute('data-page')));
        if (link.classList.contains('active')) link.setAttribute('aria-current', 'page');
        // Opened from the keyboard: say which page opened (focus stays in the menu).
        keyLink(link, link.classList.contains('searchResultLink') ? null
          : () => announce((PAGE_LABEL_BY_ID[link.getAttribute('data-page')] || 'Page') + ' page opened'));
      });
      // (after the links above were made focusable)
      if (holdSel) { const same = wrap.querySelector(holdSel); if (same) same.focus({ preventScroll: true }); }
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
    // iPhone Duo (Nov 22): folding, unfolding or turning it can cross the
    // 820-point line where the menu changes between a drawer and a column. Close
    // the drawer then, so it is never left open over the page after folding back.
    try {
      const menuWidth = window.matchMedia('(max-width: 820px)');
      if (menuWidth.addEventListener) menuWidth.addEventListener('change', closeMobileSidebar);
      else if (menuWidth.addListener) menuWidth.addListener(closeMobileSidebar);   // older Safari
    } catch (e) { /* no matchMedia: nothing to follow */ }
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
    // ---- Sales & Growth / Wholesale (feature-flagged OFF) ----
    // These pages exist only when the Sales & Growth flag is on (see he-config
    // salesGrowthOn()). The engine modules are pure and draft-only: rendering a
    // page never sends anything, approves a sample, or touches production. All
    // data here is clearly-labelled synthetic fixture data (SIMULATED), and when
    // the flag is off every page renders the DISABLED state — so even a direct
    // hash link to a sales page is a safe, empty no-op. Rendering uses the shared
    // safe DOM builder h() only (no innerHTML), so it inherits Trusted-Types.
    // The sales engine is a SEPARATE subsystem from the app's he-* module graph:
    // its files self-register on `window.HE.sales` (not the app module registry),
    // so the module-graph tooling and diagnostics are untouched by it.
    function salesMod(name){
      const s = (window.HE && window.HE.sales) || {};
      if (!s[name]) throw new Error('sales module not loaded: ' + name);
      return s[name];
    }
    function salesUi(){ return salesMod('he-sales-ui'); }
    function salesEngine(){
      return { ui: salesMod('he-sales-ui'), fixtures: salesMod('he-sales-fixtures'),
        leads: salesMod('he-sales-leads'), pipeline: salesMod('he-sales-pipeline'),
        agents: salesMod('he-sales-agents'), claims: salesMod('he-sales-claims'),
        cost: salesMod('he-sales-cost'), leaddetail: salesMod('he-sales-leaddetail'),
        retention: salesMod('he-sales-retention'), content: salesMod('he-sales-content'),
        territory: salesMod('he-sales-territory'), campaign: salesMod('he-sales-campaign'),
        dataquality: salesMod('he-sales-dataquality'), forecast: salesMod('he-sales-forecast'),
        providers: salesMod('he-sales-providers'), safety: salesMod('he-sales-safety'),
        lostdeals: salesMod('he-sales-lostdeals'), anomaly: salesMod('he-sales-anomaly'),
        workload: salesMod('he-sales-workload'), scorecards: salesMod('he-sales-scorecards'),
        readiness: salesMod('he-sales-readiness'), sources: salesMod('he-sales-sources'),
        queue: salesMod('he-sales-queue'), creator: salesMod('he-sales-creator'),
        sampleadvisor: salesMod('he-sales-sampleadvisor'), changes: salesMod('he-sales-changes'),
        privacy: salesMod('he-sales-privacy'), export: salesMod('he-sales-export'),
        replies: salesMod('he-sales-replies'), followup: salesMod('he-sales-followup'),
        samples: salesMod('he-sales-samples'), benchmark: salesMod('he-sales-benchmark'),
        priority: salesMod('he-sales-priority'), progression: salesMod('he-sales-progression'),
        concentration: salesMod('he-sales-concentration'),
        nextaction: salesMod('he-sales-nextaction'), replylab: salesMod('he-sales-replylab'),
        approval: salesMod('he-sales-approval'), audit: salesMod('he-sales-audit'),
        visit: salesMod('he-sales-visit'), reviews: salesMod('he-sales-reviews'),
        repurpose: salesMod('he-sales-repurpose'), advariants: salesMod('he-sales-advariants'),
        feedback: salesMod('he-sales-feedback'), creatoroffer: salesMod('he-sales-creatoroffer'),
        reminder: salesMod('he-sales-retentionreminder'), fallback: salesMod('he-ops-fallback') };
    }
    // Small helpers to build he-sales-ui section view-models tersely.
    function salesKv(k, value, label){ return { k, value: value == null ? '—' : value, label: label || 'ACTUAL' }; }
    function salesSection(heading, rows){ return { heading, rows: rows || [] }; }
    const SALES_TITLES = {
      salesCommandPanel: 'Growth Command Center', salesLeadsPanel: 'Wholesale Leads',
      salesPipelinePanel: 'Pipeline', salesApprovalsPanel: 'Sales Approvals',
      salesSamplesPanel: 'Samples', salesVisitsPanel: 'In-Person Sample Visits',
      salesRepurposePanel: 'Content Repurposing', salesAdVariantsPanel: 'Ad Variants',
      salesFeedbackPanel: 'Feedback Analysis', salesCreatorOfferPanel: 'Creator Sample Offers',
      salesReminderPanel: 'Reorder Reminders', salesHealthPanel: 'Service Health',
      salesAnalyticsPanel: 'Sales Analytics',
      salesAgentsPanel: 'Sales Agent Activity',
      salesLeadDetailPanel: 'Lead Detail (example)', salesRetentionPanel: 'Retention',
      salesContentPanel: 'Content Opportunities', salesTerritoryPanel: 'Territory & Expansion',
      salesCampaignPanel: 'Campaign Lab', salesDataQualityPanel: 'Sales Data Quality',
      salesForecastPanel: 'Sales Forecast', salesCostPanel: 'AI Cost Center',
      salesSafetyPanel: 'Sales Safety Center',
      salesLostDealsPanel: 'Lost Deal Analysis', salesAnomalyPanel: 'Sales Anomaly Center',
      salesWorkloadPanel: 'Owner Workload', salesScorecardsPanel: 'Agent Scorecards',
      salesQueuePanel: 'Owner Daily Queue', salesReadinessPanel: 'Wholesale Readiness',
      salesSourcesPanel: 'Lead Source Quality', salesCreatorPanel: 'Creator Prospects',
      salesSampleAdvisorPanel: 'Sample Candidate Ranking', salesChangesPanel: 'What Changed',
      salesReviewPanel: 'Weekly Review', salesPrivacyPanel: 'Sales Privacy Center',
      salesContentPlannerPanel: 'Content Planner', salesCommercialPanel: 'Commercial & Line Sheet',
      salesSettingsPanel: 'Sales Settings & Controls', salesDecisionPanel: 'Owner Decision Center',
      salesReportingPanel: 'Reporting Center', salesScenarioPanel: 'Scenario & What-If Lab',
      salesOutreachStudioPanel: 'Outreach Studio', salesReplyCenterPanel: 'Reply & Follow-up Center',
      salesExportPanel: 'Export Center', salesMeetingPanel: 'Meeting & Deal Prep',
      salesSampleOsPanel: 'Sample Operating System', salesAgentLabPanel: 'Agent Lab',
      salesAuditPanel: 'Audit & Explainability', salesBriefsPanel: 'Owner Briefs',
      salesPriorityPanel: 'Prioritization Lab', salesProgressionPanel: 'Deal Progression & Aging',
      salesConcentrationPanel: 'Pipeline Risk & Concentration',
      salesNextActionPanel: 'Next-Best-Action', salesReplyLabPanel: 'Reply Triage Lab',
    };
    // Build the view model for one sales page from the engine + synthetic fixtures.
    // Everything is labelled SIMULATED/UNKNOWN/OWNER_INPUT_REQUIRED by the view
    // models themselves; this only chooses which synthetic inputs to hand them.
    const SALES_VIEWS = {
      salesCommandPanel(e, opts){
        const scored = e.leads.rank(e.fixtures.leads(24, 7));
        const qualified = scored.filter(l => l.scoring && l.scoring.serious).length;
        return e.ui.commandCenter({
          newLeads: scored.length, qualifiedLeads: qualified, interested: 0, customersWon: 0,
          draftsAwaiting: 3, replies: 2, followUpsDue: 1, sampleCandidates: qualified,
          estPipeline: null, sampleBudget: null, samplesApproved: 0, aiMonthlyCost: null,
        }, opts);
      },
      salesLeadsPanel(e, opts){ return e.ui.leadsView(e.leads.rank(e.fixtures.leads(24, 7)), opts); },
      salesPipelinePanel(e, opts){
        const stages = ['NEW', 'QUALIFIED', 'READY_FOR_OUTREACH', 'OWNER_APPROVED', 'CONTACTED', 'REPLIED', 'INTERESTED', 'SAMPLE_CONSIDERATION', 'WHOLESALE_DISCUSSION', 'CUSTOMER'];
        const counts = { NEW: 9, QUALIFIED: 5, READY_FOR_OUTREACH: 3, OWNER_APPROVED: 0, CONTACTED: 2, REPLIED: 1, INTERESTED: 1, SAMPLE_CONSIDERATION: 1, WHOLESALE_DISCUSSION: 0, CUSTOMER: 0 };
        return e.ui.pipelineView(counts, stages, opts);
      },
      salesApprovalsPanel(e, opts){
        return e.ui.approvalsView([
          { kind: 'intro', leadId: 'SYN-1003', status: 'DRAFT', provider: 'template', claimScan: { findings: [] } },
          { kind: 'follow_up', leadId: 'SYN-1007', status: 'DRAFT', provider: 'template', claimScan: { findings: [] } },
          { kind: 'sample_offer', leadId: 'SYN-1011', status: 'DRAFT', provider: 'template', claimScan: { findings: [] } },
        ], opts);
      },
      salesSamplesPanel(e, opts){
        return e.ui.samplesView({ budget: { budget: null }, roi: { converted: 0, conversionRate: null, costBasis: 'UNKNOWN' }, rows: [] }, opts);
      },
      // In-person (HAND-DELIVERED) sample visits — distinct from mailed samples.
      // Advisory/read-only: records stock, cost and outcome per visit, is
      // idempotent, never fabricates a missing cost ($0), and NAMES the missing
      // safe production write (adjust_inventory R4). Never sends, never writes
      // real stock. Synthetic inputs only.
      salesVisitsPanel(e, opts){
        return e.ui.page('In-Person Sample Visits', opts, () => {
          const log = e.visit.createVisitLog();
          // Synthetic visit history (SYN- stores; one with an unknown unit cost
          // to show UNKNOWN is first-class and never becomes a fake $0).
          log.record({ store: 'SYN-Bright Market', date: '2026-11-05', kitId: 'A', jars: 6, unitCost: 0.29, outcome: 'ORDERED', by: 'owner' });
          log.record({ store: 'SYN-Coast Co',      date: '2026-11-06', kitId: 'A', jars: 4, unitCost: 0.29, outcome: 'FOLLOW_UP', by: 'owner' });
          log.record({ store: 'SYN-Cedar Spa',     date: '2026-11-07', kitId: 'B', jars: 3, outcome: 'DECLINED', by: 'owner' }); // no unit cost
          const tc = log.totalCost();
          const oc = log.outcomes();
          const costLabel = tc.costBasis === 'ACTUAL' ? 'ACTUAL' : 'PARTIAL/UNKNOWN';
          return { title: 'In-Person Sample Visits', state: 'OK', simulated: true, sections: [
            salesSection('Visits (hand-delivered — advisory, nothing written)', log.all().map(v =>
              salesKv(v.store + ' · ' + (v.date || '—'), v.jars + ' jars → ' + v.outcome + ' (' + v.suggestedSampleState + ')', 'SIMULATED'))),
            salesSection('Stock consumed on the spot', [
              salesKv('Jars consumed (synthetic)', log.stockConsumed(), 'SIMULATED'),
              salesKv('Safe write to apply this', 'adjust_inventory (R4) — not in local build', 'OWNER_INPUT_REQUIRED'),
            ]),
            salesSection('Sample cost', [
              salesKv('Known cost', tc.known == null ? '—' : ('$' + tc.known.toFixed(2)), 'ACTUAL'),
              salesKv('Visits with unknown unit cost', tc.unknownCount, tc.unknownCount ? 'UNKNOWN' : 'ACTUAL'),
              salesKv('Cost basis', costLabel, costLabel === 'ACTUAL' ? 'ACTUAL' : 'UNKNOWN'),
            ]),
            salesSection('Outcomes → suggested sample state (advisory, never auto-applied)', [
              salesKv('Ordered → CONVERTED', oc.ORDERED, 'SIMULATED'),
              salesKv('Follow-up → FOLLOW_UP_DUE', oc.FOLLOW_UP, 'SIMULATED'),
              salesKv('Declined → NO_ORDER', oc.DECLINED, 'SIMULATED'),
              salesKv('Pending → RECEIVED', oc.PENDING, 'SIMULATED'),
            ]),
            salesSection('Note', [salesKv('Actions', 'log only — consumes no real stock, sends nothing, advances no book automatically', 'ACTUAL')]),
          ] };
        });
      },
      // W-1 — content repurposing: one approved asset -> channel drafts with
      // source attribution; injection/unsupported claims blocked; never published.
      salesRepurposePanel(e, opts){
        return e.ui.page('Content Repurposing', opts, () => {
          const fx = e.repurpose.fixtures();
          const out = e.repurpose.repurpose({ asset: fx.approvedAsset, facts: fx.facts, claims: e.claims });
          const inj = e.repurpose.repurpose({ asset: fx.injectedAsset, facts: fx.facts, claims: e.claims });
          const first = out.drafts[0];
          return { title: 'Content Repurposing', state: 'OK', simulated: true, sections: [
            salesSection('Drafts from one approved asset (nothing published)', out.drafts.map(d =>
              salesKv(d.channelLabel || d.channel, d.status + (d.status === 'DRAFT' ? ' · ' + String(d.text).slice(0, 56) : ''), d.status === 'DRAFT' ? 'SIMULATED' : 'OWNER_INPUT_REQUIRED'))),
            salesSection('Source attribution (first draft)', (first.attribution.facts || []).map(f => salesKv(f.fact, f.value + ' @ ' + f.source, 'SIMULATED')).concat([salesKv('Asset', first.attribution.assetTitle, 'SIMULATED')])),
            salesSection('Safety', [salesKv('Injected-asset drafts blocked', inj.counts.blocked, inj.counts.blocked ? 'OWNER_INPUT_REQUIRED' : 'ACTUAL'), salesKv('Source text', 'treated as data, never obeyed', 'ACTUAL')]),
            salesSection('Note', [salesKv('Actions', 'draft only — claim-checked, editable, never published or sent', 'ACTUAL')]),
          ] };
        });
      },
      // W-2 — ad variants: hooks/headlines/briefs, review by variant; approval
      // binds to exact wording+facts and invalidates on edit. No campaign/spend.
      salesAdVariantsPanel(e, opts){
        return e.ui.page('Ad Variants', opts, () => {
          const fx = e.advariants.fixtures();
          const out = e.advariants.adVariants({ asset: fx.approvedAsset, facts: fx.facts, claims: e.claims });
          const hook = out.variants[0];
          const appr = e.approval.approve(hook, 'owner', '2026-11-13T00:00:00Z');
          const edited = e.advariants.editVariant(hook, 'Meet Shea Body Butter — boutique favourite.', 'owner', e.claims);
          const after = e.approval.check(appr, edited);
          return { title: 'Ad Variants', state: 'OK', simulated: true, sections: [
            salesSection('Variants from one approved asset (no campaign, no spend)', out.variants.map(v =>
              salesKv(v.variantLabel || v.variantType, v.status + (v.status === 'DRAFT' ? ' · ' + String(v.body).slice(0, 48) : ''), v.status === 'DRAFT' ? 'SIMULATED' : 'OWNER_INPUT_REQUIRED'))),
            salesSection('Exact-version approval', [salesKv('Hook approved', appr.status, 'SIMULATED'), salesKv('After an edit', after.valid ? 'still valid' : 'invalidated — re-review required', 'OWNER_INPUT_REQUIRED')]),
            salesSection('Note', [salesKv('Spend', '$0 — no campaign, no ad account', 'ACTUAL'), salesKv('Actions', 'draft copy for review; nothing sent', 'ACTUAL')]),
          ] };
        });
      },
      // W-3 — feedback analysis: route packaging/quality/safety to a human,
      // conflicts + duplicates, PII guard, testimonial review. Nothing auto-replied.
      salesFeedbackPanel(e, opts){
        return e.ui.page('Feedback Analysis', opts, () => {
          const fx = e.feedback.fixtures();
          const a = e.feedback.analyze(fx, e.reviews);
          const t = e.feedback.testimonialDraft(fx[3], e.reviews, e.claims); // safety + PII example
          const tr = e.feedback.trends(e.feedback.trendFixtures(), e.reviews, { minWeeks: 2 });
          return { title: 'Feedback Analysis', state: 'OK', simulated: true, sections: [
            salesSection('Routed to a human', a.toHuman.map(x => salesKv(x.product, x.routeReasons.join(' + ') + (x.pii.length ? ' · PII' : ''), 'OWNER_INPUT_REQUIRED'))),
            salesSection('Recurring complaint trends (#27)', tr.trends.map(x => salesKv(x.product + ' · ' + x.theme, x.route + ' · ' + x.weeks + ' week(s), ' + x.total + ' report(s)', x.recurring ? 'OWNER_INPUT_REQUIRED' : 'SIMULATED'))),
            salesSection('Conflicts & duplicates', [salesKv('Conflicts', a.conflicts.map(c => c.product + '/' + c.theme).join(', ') || 'none', 'SIMULATED'), salesKv('Duplicates collapsed', a.duplicatesCollapsed, 'SIMULATED')]),
            salesSection('Testimonial review (PII example — redacted)', [salesKv('Status', t.status, t.publishable ? 'SIMULATED' : 'OWNER_INPUT_REQUIRED'), salesKv('Display', t.display, 'SIMULATED')]),
            salesSection('Note', [salesKv('Actions', 'routed for human decision; nothing auto-replied or published', 'ACTUAL')]),
          ] };
        });
      },
      // W-4 — creator scouting: shortlist with source+fit evidence, sample-offer
      // drafts for review; gifting/stock/contact disabled; engagement kept UNKNOWN.
      salesCreatorOfferPanel(e, opts){
        return e.ui.page('Creator Sample Offers', opts, () => {
          const fx = e.creatoroffer.fixtures();
          const out = e.creatoroffer.shortlistWithOffers(fx.creators, fx.facts, e.claims, e.creator);
          return { title: 'Creator Sample Offers', state: 'OK', simulated: true, sections: [
            salesSection('Shortlist + sample-offer drafts', out.shortlist.map(x => salesKv(
              x.prospect.name + ' (' + x.prospect.band + ')',
              x.offer.status + ' · engagement: ' + (x.offer.evidence ? x.offer.evidence.engagement : 'UNKNOWN'),
              x.offer.status === 'DRAFT_FOR_HUMAN_REVIEW' ? 'SIMULATED' : 'OWNER_INPUT_REQUIRED'))),
            salesSection('Disabled capabilities', [salesKv('Contact', 'disabled', 'ACTUAL'), salesKv('Gifting', 'disabled', 'ACTUAL'), salesKv('Stock adjust', 'disabled — needs adjust_inventory (R4)', 'OWNER_INPUT_REQUIRED')]),
            salesSection('Note', [salesKv('Actions', 'draft offers for review; nothing contacted, gifted, or written to stock', 'ACTUAL')]),
          ] };
        });
      },
      // W-5 — retention: reorder-reminder drafts with an explicit cadence and
      // opt-out/recent-order/duplicate/cap guards. Nothing sent.
      salesReminderPanel(e, opts){
        return e.ui.page('Reorder Reminders', opts, () => {
          const fx = e.reminder.fixtures();
          const plan = e.reminder.planReminders(fx.customers, fx.asOf, {}, { retention: e.retention, followup: e.followup, claims: e.claims });
          return { title: 'Reorder Reminders', state: 'OK', simulated: true, sections: [
            salesSection('Reminder drafts (nothing sent)', plan.rows.map(r =>
              salesKv(r.storeName || r.id, r.status + ' · cadence ' + r.cadenceDays + 'd (' + r.cadenceBasis + ')', r.status === 'DRAFT' ? 'SIMULATED' : 'OWNER_INPUT_REQUIRED'))),
            salesSection('Guards', [salesKv('Drafted', plan.counts.draft, 'SIMULATED'), salesKv('Suppressed (opt-out/DNC)', plan.counts.suppressed, 'ACTUAL'), salesKv('Not due (recent / no history)', plan.counts.notDue, 'ACTUAL')]),
            salesSection('Note', [salesKv('Cadence', 'explicit assumption, shown per row', 'ACTUAL'), salesKv('Actions', 'draft reminders for review; opt-out/cap/duplicate enforced; nothing sent', 'ACTUAL')]),
          ] };
        });
      },
      // #25 Service Health — stale jobs, last success, error state and the NEXT
      // OPERATOR ACTION, shown with synthetic failure states. Read-only.
      salesHealthPanel(e, opts){
        return e.ui.page('Service Health', opts, () => {
          const fx = e.agents.healthFixtures();
          const rows = e.agents.healthRows(fx.jobs, fx.now, fx.staleAfterHours);
          const sum = e.agents.healthSummary(fx.jobs, fx.now, fx.staleAfterHours);
          const fb = e.fallback.fallbackReadiness();
          return { title: 'Service Health', state: 'OK', simulated: true, sections: [
            salesSection('Status summary (synthetic)', [
              salesKv('Needs attention', sum.needsAttention, sum.needsAttention ? 'OWNER_INPUT_REQUIRED' : 'ACTUAL'),
              salesKv('By state', e.agents.HEALTH_STATES.map(s => s + ':' + sum.counts[s]).join('  '), 'SIMULATED'),
              salesKv('First action', sum.firstAction || 'none — all clear', sum.needsAttention ? 'OWNER_INPUT_REQUIRED' : 'ACTUAL'),
            ]),
            salesSection('Jobs — state · last success · next operator action', rows.map(r => salesKv(
              r.name,
              r.state + ' · ' + (r.lastSuccess ? 'last ok ' + r.sinceSuccessHours + 'h ago' : 'no success yet') + ' → ' + r.nextAction,
              (r.state === 'OK' || r.state === 'OFF') ? 'ACTUAL' : 'OWNER_INPUT_REQUIRED'))),
            // #21 — every launch-critical flow has a manual path + pause/recovery.
            salesSection('Manual fallback readiness (#21) — ' + (fb.ready ? 'all flows covered' : fb.gaps.length + ' gap(s)'), fb.flows.map(f =>
              salesKv(f.name, 'manual: ' + f.manualPath + ' · pause/recovery: ' + f.pauseRecovery, fb.ready ? 'ACTUAL' : 'OWNER_INPUT_REQUIRED'))),
            salesSection('Note', [salesKv('Scope', 'synthetic failure states + manual-fallback readiness for review; read-only — nothing is run, scheduled, or changed here', 'ACTUAL')]),
          ] };
        });
      },
      salesAnalyticsPanel(e, opts){
        return e.ui.analyticsView({ replyRate: null, interestRate: null, customerConversion: null, sampleConversion: null, costPerLead: null, costPerCustomer: null }, opts);
      },
      salesAgentsPanel(e, opts){
        // The full advisory roster, all OFF by default; never-run agents report
        // UNKNOWN health (never a fake "healthy").
        e.agents.assertSafe();
        return e.ui.agentActivityView(e.agents.activityRows(), opts);
      },
      salesLeadDetailPanel(e, opts){
        return e.ui.page('Lead Detail (example)', opts, () => {
          const lead = { id: 'SYN-1001', storeName: 'Cedar Day Spa', category: 'spa', city: 'Austin', state: 'TX',
            email: 'buyer@cedar.example.com', website: 'cedar.example.com', source: 'referral',
            pipelineState: 'INTERESTED', carriesSimilarBrands: true, synthetic: true };
          const hist = { outreach: [{ at: '2026-10-01', summary: 'intro draft (template)' }],
            replies: [{ at: '2026-10-05', text: 'interested — send pricing' }],
            followups: [{ at: '2026-10-09', summary: 'follow-up planned' }],
            notes: [{ at: '2026-10-06', text: 'wants a line sheet' }],
            audit: [{ at: '2026-10-05', kind: 'reply_received' }], aiRuns: [{ cost: 0.012 }, { cost: 0.004 }] };
          const d = e.leaddetail.dossier(lead, hist, { leads: e.leads, dataquality: e.dataquality });
          return { title: 'Lead Detail (example)', state: 'OK', simulated: true, sections: [
            salesSection('Business', [salesKv('Store', d.identity.storeName, 'SIMULATED'), salesKv('Category', d.identity.category, 'SIMULATED'), salesKv('Location', [d.identity.city, d.identity.state].filter(Boolean).join(', '), 'SIMULATED'), salesKv('Website', d.contact.website, 'SIMULATED')]),
            salesSection('Score', [salesKv('Score', d.score.value, 'SIMULATED'), salesKv('Band', d.score.band, 'SIMULATED'), salesKv('Reasons', (d.score.reasons || []).join('; ') || '—', 'SIMULATED')]),
            salesSection('Pipeline & next step', [salesKv('State', d.pipelineState, 'SIMULATED'), salesKv('Next best action', d.nextBestAction.action, 'ESTIMATED'), salesKv('Owner decision needed?', d.nextBestAction.ownerDecision ? 'YES' : 'no', 'ACTUAL')]),
            salesSection('History', [salesKv('Outreach drafts', d.outreachHistory.length, 'SIMULATED'), salesKv('Replies', d.replyHistory.length, 'SIMULATED'), salesKv('Follow-ups', d.followupHistory.length, 'SIMULATED'), salesKv('Samples', d.sampleHistory.length, 'SIMULATED')]),
            salesSection('Commercial blockers (owner input)', (d.commercialBlockers.length ? d.commercialBlockers.map(b => salesKv(b.label, 'missing', 'OWNER_INPUT_REQUIRED')) : [salesKv('All facts present', 'yes', 'ACTUAL')])),
            salesSection('AI usage for this lead', [salesKv('Runs', d.aiUsage.runs, 'ACTUAL'), salesKv('Est. cost', d.aiUsage.estCost == null ? '—' : ('$' + d.aiUsage.estCost), d.aiUsage.label)]),
            salesSection('Data quality', (d.dataQualityWarnings.length ? d.dataQualityWarnings.slice(0, 5).map(w => salesKv(w.kind, w.detail, 'ACTUAL')) : [salesKv('No warnings', 'clean', 'ACTUAL')])),
          ] };
        });
      },
      salesRetentionPanel(e, opts){
        return e.ui.page('Retention', opts, () => {
          const a = e.retention.analyze(e.retention.fixtures(7), '2026-10-19');
          return { title: 'Retention', state: 'OK', sections: [
            salesSection('Segments', e.retention.SEGMENTS.map(s => salesKv(s, a.counts[s] || 0, 'SIMULATED'))),
            salesSection('Candidate lists (advisory — owner reaches out by hand)', [
              salesKv('Reorder candidates', a.reorderCandidates.length, 'SIMULATED'),
              salesKv('Win-back candidates', a.winBack.length, 'SIMULATED'),
              salesKv('VIP customers', a.vips.length, 'SIMULATED'),
              salesKv('Review-request candidates', a.reviewRequest.length, 'SIMULATED'),
            ]),
            salesSection('Reorder rhythm', [salesKv('Avg reorder interval (days)', a.avgReorderIntervalDays, a.avgReorderConfidence === 'UNKNOWN' ? 'UNKNOWN' : 'ESTIMATED')]),
          ] };
        });
      },
      salesContentPanel(e, opts){
        return e.ui.page('Content Opportunities', opts, () => {
          const items = e.content.fixtures().map(it => e.content.checkClaims(it, e.claims.scan));
          const cal = e.content.calendar(items);
          return { title: 'Content Opportunities', state: 'OK', sections: [
            salesSection('By status', e.content.STATUSES.map(s => salesKv(s, cal.counts[s] || 0, 'SIMULATED'))),
            salesSection('Ideas (claim-checked)', items.map(it => salesKv(it.type + ': ' + it.topic.slice(0, 48), it.claimStatus, it.claimStatus === 'BLOCKED' ? 'OWNER_INPUT_REQUIRED' : 'SIMULATED'))),
          ] };
        });
      },
      salesTerritoryPanel(e, opts){
        return e.ui.page('Territory & Expansion', opts, () => {
          const t = e.territory.analyze(e.leads.rank(e.fixtures.leads(24, 7)));
          return { title: 'Territory & Expansion', state: 'OK', sections: [
            salesSection('By state', t.byState.slice(0, 8).map(s => salesKv(s.key, s.prospects + ' prospects / ' + s.qualified + ' qualified', s.avgScoreLabel))),
            salesSection('Top white-space (good quality, thin coverage)', (t.topWhitespace.length ? t.topWhitespace.slice(0, 6).map(w => salesKv(w.key, 'score ' + w.whitespaceScore, w.whitespaceLabel)) : [salesKv('Not enough data', '—', 'UNKNOWN')])),
            salesSection('Needs scoring (UNKNOWN quality — not low potential)', (t.needsData && t.needsData.length ? t.needsData.slice(0, 6).map(s => salesKv(s.key, s.prospects + ' prospects, none scored yet', 'OWNER_INPUT_REQUIRED')) : [salesKv('none', 'every territory with prospects has a score', 'ACTUAL')])),
          ] };
        });
      },
      salesCampaignPanel(e, opts){
        return e.ui.page('Campaign Lab', opts, () => {
          const vs = [
            e.campaign.variant('subject', 'Wholesale body-care for your {{store}} boutique', e.claims.scan),
            e.campaign.variant('subject', 'Our balm cures eczema!!!', e.claims.scan),
            e.campaign.variant('cta', 'Reply and I will send the line sheet for {{store}}', e.claims.scan),
          ];
          const cmp = e.campaign.compare(vs);
          const vol = e.campaign.volumeTable([5, 25, 100]);
          return { title: 'Campaign Lab', state: 'OK', sections: [
            salesSection('Variant comparison (SIMULATION — nothing sent)', cmp.ranked.map(v => salesKv(v.kind + ': ' + v.text.slice(0, 40), 'q' + v.qualityScore + ' p' + v.personalizationScore + (v.claimSafe ? '' : ' ⚠ claim'), v.claimSafe ? 'SIMULATED' : 'OWNER_INPUT_REQUIRED'))),
            salesSection('Outreach volume simulator', vol.map(r => salesKv(r.perDay + '/day', '~' + r.ownerMinutes + ' owner min, $' + r.estCost + ', ' + r.replies + ' replies', 'SIMULATED'))),
          ] };
        });
      },
      salesDataQualityPanel(e, opts){
        return e.ui.page('Sales Data Quality', opts, () => {
          const r = e.dataquality.scan(e.dataquality.fixtures());
          return { title: 'Sales Data Quality', state: r.total ? 'OK' : 'EMPTY', sections: [
            salesSection('By severity', [salesKv('Critical', r.bySeverity.CRITICAL, 'ACTUAL'), salesKv('Warning', r.bySeverity.WARNING, 'ACTUAL'), salesKv('Info', r.bySeverity.INFO, 'ACTUAL')]),
            salesSection('Exceptions (flag only — never auto-repaired)', r.findings.slice(0, 12).map(f => salesKv(f.severity + ' · ' + f.kind, f.detail, 'ACTUAL'))),
          ] };
        });
      },
      salesForecastPanel(e, opts){
        return e.ui.page('Sales Forecast', opts, () => {
          const counts = { NEW: 40, QUALIFIED: 12, INTERESTED: 6, WHOLESALE_DISCUSSION: 3, CUSTOMER: 2, LOST: 7 };
          const w = e.forecast.weightedPipeline(counts);
          const rev = e.forecast.revenueScenario({ leadVolume: 500, replyRate: 0.15, interestRate: 0.25, conversionRate: 0.2, avgFirstOrder: 300, repeatOrders: 1 });
          const inv = e.forecast.inventoryConstrained({ available: 1000, retailReserve: 400, sampleReserve: 50, wholesaleDemand: 300 });
          return { title: 'Sales Forecast', state: 'OK', sections: [
            salesSection('Weighted pipeline (ESTIMATE · NOT GUARANTEED)', [salesKv('Weighted', '$' + w.weighted, 'ESTIMATED'), salesKv('High confidence', '$' + w.highConfidence, 'ESTIMATED'), salesKv('Speculative', '$' + w.speculative, 'ESTIMATED'), salesKv('If all closed', '$' + w.rawIfAllClosed, 'ESTIMATED')]),
            salesSection('Revenue scenario (SIMULATION)', [salesKv('Projected customers', rev.customers, 'ESTIMATED'), salesKv('Gross sales', '$' + rev.grossSales, 'ESTIMATED'), salesKv('Sample demand', rev.sampleDemand, 'ESTIMATED'), salesKv('Owner review items', rev.ownerReviewItems, 'ESTIMATED')]),
            salesSection('Inventory-constrained (advisory — no stock reserved)', [salesKv('Status', inv.status, 'ESTIMATED'), salesKv('Why', inv.reason, 'ESTIMATED')]),
          ] };
        });
      },
      salesCostPanel(e, opts){
        return e.ui.page('AI Cost Center', opts, () => {
          const matrix = e.providers.costMatrix(500, 300);
          return { title: 'AI Cost Center', state: 'OK', sections: [
            salesSection('Provider cost (per draft, synthetic rates)', matrix.map(m => salesKv(m.provider + ' (' + m.tier + ')', m.configured ? ('$' + m.cost) : ('$' + m.cost + ' — not enabled'), m.configured ? 'ESTIMATED' : 'OWNER_INPUT_REQUIRED'))),
            salesSection('Routing', [salesKv('Routine work', 'deterministic (no AI call, $0)', 'ACTUAL'), salesKv('Fallback floor', e.providers.fallbackChain(['strong', 'cheap', 'template']).slice(-1)[0], 'ACTUAL')]),
            salesSection('Latency (typical, synthetic)', e.providers.latencyMatrix().map(l => salesKv(l.provider, l.typicalLatencyMs + ' ms', 'SIMULATED'))),
          ] };
        });
      },
      salesSafetyPanel(e, opts){
        return e.ui.page('Sales Safety Center', opts, () => {
          const c = e.safety.safetyCenter({ featureFlag: true });
          return { title: 'Sales Safety Center', state: 'OK', sections: [
            salesSection('Safety controls (enforced in code)', c.rows.map(r => salesKv(r.key, r.status, r.protective ? 'ACTUAL' : 'OWNER_INPUT_REQUIRED'))),
          ] };
        });
      },
      salesLostDealsPanel(e, opts){
        return e.ui.page('Lost Deal Analysis', opts, () => {
          const deals = [
            { reason: 'PRICE', storeType: 'spa', source: 'referral', state: 'TX', scoreValue: 45 },
            { reason: 'MOQ', storeType: 'boutique', source: 'event', state: 'OR', scoreValue: 60 },
            { reason: 'TIMING', storeType: 'salon', source: 'search', state: 'TX', scoreValue: 82 },
            { reason: 'NO_RESPONSE', storeType: 'gift', source: 'social', state: 'NV', scoreValue: 70 },
            { reason: 'NOT_INTERESTED', storeType: 'grocery', source: 'manual', state: 'CA', scoreValue: 30 },
            { reason: 'weird', storeType: 'spa', source: 'referral', state: 'CA', scoreValue: 55 },
          ];
          const a = e.lostdeals.analyze(deals);
          return { title: 'Lost Deal Analysis', state: 'OK', sections: [
            salesSection('By reason', e.lostdeals.REASONS.map(r => salesKv(r, a.byReason[r] || 0, 'SIMULATED'))),
            salesSection('Signals', [salesKv('Top reason', a.topReason, 'SIMULATED'), salesKv('Re-opening candidates (advisory)', a.reopenCandidates.length, 'SIMULATED')]),
          ] };
        });
      },
      salesAnomalyPanel(e, opts){
        return e.ui.page('Sales Anomaly Center', opts, () => {
          const r = e.anomaly.scan({
            replyRate: 0.05, replyRateHistory: [0.2, 0.18, 0.22], bounceRate: 0.18, bounceBaseline: 0.05,
            dncToday: 10, dncBaseline: 2, followUpBacklog: 35, aiCostToday: 4, aiCostBaseline: 1,
            approvalBacklog: 22, sources: [{ name: 'cheap-list', leads: 40, conversion: 0 }],
          });
          return { title: 'Sales Anomaly Center', state: r.total ? 'OK' : 'EMPTY', sections: [
            salesSection('By severity', [salesKv('Critical', r.bySeverity.CRITICAL, 'ACTUAL'), salesKv('Warning', r.bySeverity.WARNING, 'ACTUAL'), salesKv('Info', r.bySeverity.INFO, 'ACTUAL')]),
            salesSection('Anomalies (advisory — nothing paused automatically)', r.anomalies.map(x => salesKv(x.severity + ' · ' + x.kind, x.detail, 'SIMULATED'))),
          ] };
        });
      },
      salesWorkloadPanel(e, opts){
        return e.ui.page('Owner Workload', opts, () => {
          const w = e.workload.workload({ draftsAwaiting: 12, repliesToReview: 6, samplesToDecide: 2, contentApprovals: 3, dailyBudgetMinutes: 60 });
          const rt = e.workload.responseTimes({ ownerApprovalPairs: [{ from: '2026-10-01', to: '2026-10-03' }, { from: '2026-10-02', to: '2026-10-02' }] });
          return { title: 'Owner Workload', state: 'OK', sections: [
            salesSection('Today’s queue', [salesKv('Drafts awaiting', w.items.draftsAwaiting, 'SIMULATED'), salesKv('Replies to review', w.items.repliesToReview, 'SIMULATED'), salesKv('Samples to decide', w.items.samplesToDecide, 'SIMULATED'), salesKv('Content approvals', w.items.contentApprovals, 'SIMULATED')]),
            salesSection('Estimate', [salesKv('Owner minutes/day', w.estMinutes, 'ESTIMATED'), salesKv('Sustainable vs budget?', w.sustainable ? 'yes' : 'NO — reduce volume', 'ESTIMATED')]),
            salesSection('Response times', [salesKv('Owner approval latency (avg days)', rt.ownerApproval.avgDays, rt.ownerApproval.label)]),
          ] };
        });
      },
      salesScorecardsPanel(e, opts){
        return e.ui.page('Agent Scorecards', opts, () => {
          const runs = [
            { agent: 'Intro Draft Writer', result: 'ok', approved: true, cost: 0.011, latencyMs: 600 },
            { agent: 'Intro Draft Writer', result: 'ok', ownerEdited: true, cost: 0.013, latencyMs: 700 },
            { agent: 'Intro Draft Writer', result: 'fail', failure: 'timeout', cost: 0, latencyMs: 30000 },
            { agent: 'Reply Classifier', result: 'ok', cost: 0, latencyMs: 2 },
            { agent: 'Reply Classifier', result: 'ok', unknown: true, cost: 0, latencyMs: 2 },
          ];
          const cards = e.scorecards.scorecards(runs);
          const fa = e.scorecards.failureAnalysis(runs);
          return { title: 'Agent Scorecards', state: 'OK', sections: [
            salesSection('Per-agent (synthetic runs)', cards.map(c => salesKv(c.agent, 'correctness ' + (c.correctness == null ? '—' : c.correctness) + ', edits ' + (c.ownerEditRate == null ? '—' : c.ownerEditRate), c.correctnessLabel))),
            salesSection('Failures by cause', [salesKv('Top cause', fa.top, 'SIMULATED'), salesKv('Total failures', fa.total, 'SIMULATED')]),
          ] };
        });
      },
      salesQueuePanel(e, opts){
        return e.ui.page('Owner Daily Queue', opts, () => {
          const q = e.queue.build({
            approvalsAwaiting: [{ leadId: 'SYN-1003' }, { leadId: 'SYN-1007' }],
            sampleDecisions: [{ leadId: 'SYN-1011' }], repliesToReview: [{ leadId: 'SYN-1005' }],
            followUpsDue: [{ leadId: 'SYN-1002', dueDate: '2026-10-20' }],
            blocked: [{ leadId: 'SYN-1009', reason: 'needs wholesale price' }], watch: [{ leadId: 'SYN-1012' }],
          });
          return { title: 'Owner Daily Queue', state: 'OK', sections: e.queue.BUCKETS.map(b =>
            salesSection(b + ' (' + q.counts[b] + ')', q.byBucket[b].length ? q.byBucket[b].map(it => salesKv(it.leadId || '—', it.nextAction + (it.ownerDecisionRequired ? ' · owner decision' : ''), 'SIMULATED')) : [salesKv('nothing', '—', 'ACTUAL')])) };
        });
      },
      salesReadinessPanel(e, opts){
        return e.ui.page('Wholesale Readiness', opts, () => {
          const facts = { wholesalePrice: null, moq: { value: 24, verified: true }, shippingTerms: null,
            paymentTerms: null, approvedClaims: null, lineSheet: null, legalStatus: { value: 'pending' } };
          const c = e.readiness.commercial(facts);
          const ls = e.readiness.lineSheet(facts);
          const center = e.readiness.center({});
          return { title: 'Wholesale Readiness', state: 'OK', sections: [
            salesSection('Commercial facts', c.rows.map(r => salesKv(r.label + (r.required ? ' *' : ''), r.state, r.state === 'APPROVED' ? 'ACTUAL' : 'OWNER_INPUT_REQUIRED'))),
            salesSection('Line sheet', [salesKv('Status', ls.status, ls.status === 'BLOCKED' ? 'OWNER_INPUT_REQUIRED' : 'ESTIMATED'), salesKv('Blockers', ls.blockers.join('; ') || 'none', ls.blockers.length ? 'OWNER_INPUT_REQUIRED' : 'ACTUAL')]),
            salesSection('Readiness center', center.rows.map(r => salesKv(r.item, r.status, /LOCAL READY/.test(r.status) ? 'ACTUAL' : 'OWNER_INPUT_REQUIRED'))),
          ] };
        });
      },
      salesSourcesPanel(e, opts){
        return e.ui.page('Lead Source Quality', opts, () => {
          const leads = e.leads.rank(e.fixtures.leads(24, 7)).map((l, i) => ({ ...l, replied: i % 2 === 0, interested: i % 3 === 0, converted: i % 7 === 0, storeType: l.category }));
          const a = e.sources.analyze(leads);
          return { title: 'Lead Source Quality', state: 'OK', sections: [
            salesSection('By source', a.bySource.map(s => salesKv(s.key, s.leads + ' leads · reply ' + (s.replyRate == null ? '—' : s.replyRate), s.replyLabel))),
            salesSection('By store type', a.byStoreType.slice(0, 8).map(s => salesKv(s.key, s.leads + ' leads · conv ' + (s.conversionRate == null ? '—' : s.conversionRate), s.conversionLabel))),
          ] };
        });
      },
      salesCreatorPanel(e, opts){
        return e.ui.page('Creator Prospects', opts, () => {
          const ranked = e.creator.fixtures();
          return { title: 'Creator Prospects', state: 'OK', sections: [
            salesSection('Prospects (public signals only; no auto-contact)', ranked.map(c => salesKv(c.name + ' (' + c.platform + ')', 'score ' + c.score + ' · ' + c.band + ' · ' + c.sampleConsideration, 'SIMULATED'))),
            salesSection('Safety', [salesKv('Auto-contact', 'OFF', 'ACTUAL'), salesKv('Payment/free-product promise', 'OFF', 'ACTUAL'), salesKv('Medical claims', 'blocked', 'ACTUAL'), salesKv('Usage rights', 'not assumed', 'ACTUAL')]),
          ] };
        });
      },
      salesSampleAdvisorPanel(e, opts){
        return e.ui.page('Sample Candidate Ranking', opts, () => {
          const cands = [
            { id: 'SYN-1011', storeName: 'Blue Harbor Apothecary', scoring: { score: 90 }, replyQuality: 'strong', likelyOrderSize: 'large', locations: 3, priorSamples: 0 },
            { id: 'SYN-1007', storeName: 'Cedar Day Spa', scoring: { score: 70 }, replyQuality: 'ok', likelyOrderSize: 'medium', locations: 1, priorSamples: 1 },
          ];
          const r = e.sampleadvisor.rank(cands, 8);
          const fraud = e.sampleadvisor.fraudScan([
            { id: 1, storeName: 'Spa One', email: 'a@sketchy.example.com', website: 'sketchy.example.com' },
            { id: 2, storeName: 'Spa Two', email: 'a@sketchy.example.com', website: 'sketchy.example.com' },
            { id: 3, storeName: 'Spa Three', email: 'c@sketchy.example.com', website: 'sketchy.example.com' },
          ], { maxPerDomain: 2 });
          return { title: 'Sample Candidate Ranking', state: 'OK', sections: [
            salesSection('Ranked candidates (owner still approves each)', r.ranked.map(c => salesKv(c.storeName, 'score ' + c.score, 'SIMULATED'))),
            salesSection('Abuse watch (advisory)', fraud.flags.length ? fraud.flags.map(f => salesKv(f.kind, f.detail, 'SIMULATED')) : [salesKv('No flags', 'clean', 'ACTUAL')]),
          ] };
        });
      },
      salesChangesPanel(e, opts){
        return e.ui.page('What Changed', opts, () => {
          const asOf = '2026-10-19T12:00:00Z';
          const ev = [
            { at: '2026-10-19T09:00:00Z', kind: 'new_lead' }, { at: '2026-10-19T10:00:00Z', kind: 'reply' },
            { at: '2026-10-18T10:00:00Z', kind: 'customer_won' }, { at: '2026-10-14T10:00:00Z', kind: 'sample_request' },
            { at: '2026-10-02T10:00:00Z', kind: 'opportunity_lost' },
          ];
          const d = e.changes.digest(ev, asOf);
          const win = (label, c) => salesSection(label, e.changes.MATERIAL.filter(k => c[k]).map(k => salesKv(k, c[k], 'SIMULATED')).concat(Object.values(c).every(v => !v) ? [salesKv('no material changes', '—', 'ACTUAL')] : []));
          return { title: 'What Changed', state: 'OK', sections: [win('Today', d.today), win('Yesterday', d.yesterday), win('Last 7 days', d.last7), win('Last 30 days', d.last30)] };
        });
      },
      salesReviewPanel(e, opts){
        return e.ui.page('Weekly Review', opts, () => {
          const asOf = '2026-10-19T12:00:00Z';
          const ev = [
            { at: '2026-10-15T10:00:00Z', kind: 'customer_won' }, { at: '2026-10-16T10:00:00Z', kind: 'opportunity_lost' },
            { at: '2026-10-17T10:00:00Z', kind: 'dnc' }, { at: '2026-10-14T10:00:00Z', kind: 'new_lead' },
            { at: '2026-10-13T10:00:00Z', kind: 'sample_request' },
          ];
          const r = e.changes.review(ev, 7, asOf);
          return { title: 'Weekly Review', state: 'OK', sections: [
            salesSection('This week (7 days)', [salesKv('Wins', r.wins, 'SIMULATED'), salesKv('Losses', r.losses, 'SIMULATED'), salesKv('New leads', r.newLeads, 'SIMULATED'), salesKv('Replies', r.replies, 'SIMULATED'), salesKv('Samples requested', r.samplesRequested, 'SIMULATED'), salesKv('Opt-outs', r.optOuts, 'SIMULATED')]),
            salesSection('Risks', r.risks.length ? r.risks.map((x, i) => salesKv('risk ' + (i + 1), x, 'SIMULATED')) : [salesKv('No flagged risks', '—', 'ACTUAL')]),
          ] };
        });
      },
      salesPrivacyPanel(e, opts){
        return e.ui.page('Sales Privacy Center', opts, () => {
          const inv = e.privacy.inventory(['id', 'storeName', 'website', 'contactName', 'email', 'phone', 'apiKey', 'password', '_scratch', 'scoring', 'source']);
          const ret = e.privacy.retentionPolicyOptions();
          return { title: 'Sales Privacy Center', state: 'OK', sections: [
            salesSection('Field classification', inv.rows.map(r => salesKv(r.field, r.class + ' — ' + r.recommend, r.class === 'SENSITIVE' ? 'OWNER_INPUT_REQUIRED' : 'ACTUAL'))),
            salesSection('Retention policy (PROPOSED — owner/legal decide)', ret.options.map(o => salesKv(o.topic, o.default, 'OWNER_INPUT_REQUIRED'))),
          ] };
        });
      },
      salesContentPlannerPanel(e, opts){
        return e.ui.page('Content Planner', opts, () => {
          const items = e.content.fixtures().map(it => e.content.checkClaims(it, e.claims.scan));
          const cal = e.content.calendar(items);
          const channel = (type, label) => salesSection(label, items.filter(it => it.type === type).map(it => salesKv(it.topic.slice(0, 50), it.claimStatus, it.claimStatus === 'BLOCKED' ? 'OWNER_INPUT_REQUIRED' : 'SIMULATED')).concat(items.some(it => it.type === type) ? [] : [salesKv('no ideas yet', '—', 'ACTUAL')]));
          return { title: 'Content Planner', state: 'OK', sections: [
            salesSection('By status', e.content.STATUSES.map(s => salesKv(s, cal.counts[s] || 0, 'SIMULATED'))),
            channel('seo', 'SEO queue'), channel('faq', 'FAQ queue'), channel('blog', 'Blog / editorial'),
            channel('newsletter', 'Newsletter (send DISABLED)'), channel('social', 'Social'),
            channel('creator', 'Creator content'), channel('product_copy', 'Product copy'),
            salesSection('Safety', [salesKv('Claim firewall', 'ON — blocked items cannot be approved', 'ACTUAL'), salesKv('Publishing', 'DISABLED (local planning only)', 'ACTUAL')]),
          ] };
        });
      },
      salesCommercialPanel(e, opts){
        return e.ui.page('Commercial & Line Sheet', opts, () => {
          const facts = { wholesalePrice: null, moq: { value: 24, verified: true }, msrp: null, size: { value: '8 oz', verified: true },
            shippingTerms: null, paymentTerms: null, approvedClaims: null, certifications: null, samplePolicy: null,
            lineSheet: null, legalStatus: { value: 'pending' }, contactChannel: null };
          const c = e.readiness.commercial(facts);
          const ls = e.readiness.lineSheet(facts);
          return { title: 'Commercial & Line Sheet', state: 'OK', sections: [
            salesSection('Commercial fact register', c.rows.map(r => salesKv(r.label + (r.required ? ' *' : ''), r.state, r.state === 'APPROVED' ? 'ACTUAL' : 'OWNER_INPUT_REQUIRED'))),
            salesSection('Line sheet builder', [salesKv('Status', ls.status, ls.status === 'BLOCKED' ? 'OWNER_INPUT_REQUIRED' : 'ESTIMATED')]),
            salesSection('Line sheet blockers (why it cannot be ready)', ls.blockers.length ? ls.blockers.map(b => salesKv(b, 'needed before export', 'OWNER_INPUT_REQUIRED')) : [salesKv('none', 'all required facts present', 'ACTUAL')]),
            salesSection('Preview', [salesKv('Preview', ls.status === 'BLOCKED' ? 'blocked — placeholder only' : 'draft preview available', ls.status === 'BLOCKED' ? 'OWNER_INPUT_REQUIRED' : 'SIMULATED')]),
          ] };
        });
      },
      salesSettingsPanel(e, opts){
        return e.ui.page('Sales Settings & Controls', opts, () => {
          const c = e.safety.safetyCenter({ featureFlag: true });
          const km = e.safety.killSwitch({ featureFlag: true }, false);
          return { title: 'Sales Settings & Controls', state: 'OK', sections: [
            salesSection('Controls', [
              salesKv('Feature flag', 'ON (you are viewing it); default OFF', 'ACTUAL'),
              salesKv('Global AI pause (kill switch)', km.aiRunsAllowed ? 'not paused' : 'PAUSED', 'ACTUAL'),
              salesKv('Agent modes', 'all OFF by default', 'ACTUAL'),
              salesKv('AI daily / monthly budget', '$1 / $10 synthetic hard stop', 'SIMULATED'),
              salesKv('Synthetic sample cap', '8 / month', 'SIMULATED'),
              salesKv('Provider preference', 'deterministic template (paid providers not enabled)', 'ACTUAL'),
              salesKv('Content mode', 'draft-only', 'ACTUAL'), salesKv('Simulation mode', 'on (no real effects)', 'ACTUAL'),
            ]),
            salesSection('Enforced status', c.rows.map(r => salesKv(r.key, r.status, r.protective ? 'ACTUAL' : 'OWNER_INPUT_REQUIRED'))),
          ] };
        });
      },
      salesDecisionPanel(e, opts){
        return e.ui.page('Owner Decision Center', opts, () => {
          const D = (k, s) => salesKv(k, s, /LOCAL|done/i.test(s) ? 'ACTUAL' : 'OWNER_INPUT_REQUIRED');
          return { title: 'Owner Decision Center', state: 'OK', sections: [
            salesSection('Decisions only you can make', [
              D('Sales mailbox address', 'OWNER_DECISION'), D('Gmail read access', 'OWNER_DECISION'),
              D('Gmail draft access', 'OWNER_DECISION'), D('Gmail SEND (future, separate)', 'OWNER_DECISION — stays off'),
              D('Daily outreach cap', 'OWNER_DECISION'), D('Sample cap', 'OWNER_DECISION'),
              D('Wholesale price', 'OWNER_DECISION'), D('MOQ', 'OWNER_DECISION'), D('MSRP', 'OWNER_DECISION'),
              D('Approved claims', 'LEGAL_REVIEW'), D('Legal review', 'LEGAL_REVIEW'),
              D('Creator policy', 'OWNER_DECISION'), D('Website integration', 'WEBSITE_REQUIRED'),
              D('Production activation', 'PRODUCTION_DB_REQUIRED'),
            ]),
            salesSection('Readiness roll-up', e.readiness.center({}).rows.map(r => salesKv(r.item, r.status, /LOCAL READY/.test(r.status) ? 'ACTUAL' : 'OWNER_INPUT_REQUIRED'))),
          ] };
        });
      },
      salesReportingPanel(e, opts){
        return e.ui.page('Reporting Center', opts, () => {
          const asOf = '2026-10-19T12:00:00Z';
          const ev = [{ at: '2026-10-19T09:00:00Z', kind: 'new_lead' }, { at: '2026-10-18T10:00:00Z', kind: 'customer_won' }, { at: '2026-10-15T10:00:00Z', kind: 'sample_request' }];
          const wk = e.changes.review(ev, 7, asOf);
          const mo = e.changes.review(ev, 30, asOf);
          const w = e.forecast.weightedPipeline({ NEW: 40, QUALIFIED: 12, INTERESTED: 6, WHOLESALE_DISCUSSION: 3, CUSTOMER: 2 });
          return { title: 'Reporting Center', state: 'OK', sections: [
            salesSection('Available reports', ['Daily', 'Weekly', 'Monthly', 'Pipeline', 'Samples', 'Agents', 'Costs', 'Sources', 'Lost Deals', 'Territory', 'Retention', 'Content'].map(r => salesKv(r, 'ready (synthetic)', 'SIMULATED'))),
            salesSection('Weekly snapshot', [salesKv('Wins', wk.wins, 'SIMULATED'), salesKv('New leads', wk.newLeads, 'SIMULATED'), salesKv('Samples requested', wk.samplesRequested, 'SIMULATED'), salesKv('Risks', wk.risks.length, 'SIMULATED')]),
            salesSection('Monthly snapshot', [salesKv('Wins', mo.wins, 'SIMULATED'), salesKv('New leads', mo.newLeads, 'SIMULATED')]),
            salesSection('Pipeline health', [salesKv('Weighted', '$' + w.weighted, 'ESTIMATED'), salesKv('High confidence', '$' + w.highConfidence, 'ESTIMATED')]),
          ] };
        });
      },
      salesScenarioPanel(e, opts){
        return e.ui.page('Scenario & What-If Lab', opts, () => {
          const base = e.forecast.revenueScenario({ leadVolume: 500, replyRate: 0.15, interestRate: 0.25, conversionRate: 0.2, avgFirstOrder: 300, repeatOrders: 1 });
          const doubleReply = e.forecast.revenueScenario({ leadVolume: 500, replyRate: 0.30, interestRate: 0.25, conversionRate: 0.2, avgFirstOrder: 300, repeatOrders: 1 });
          const inv = e.forecast.inventoryConstrained({ available: 1000, retailReserve: 400, sampleReserve: 50, wholesaleDemand: 600 });
          const sizes = e.forecast.orderSizeScenarios();
          return { title: 'Scenario & What-If Lab', state: 'OK', sections: [
            salesSection('Base revenue scenario (SIMULATION, not a forecast)', [salesKv('Customers', base.customers, 'ESTIMATED'), salesKv('Gross sales', '$' + base.grossSales, 'ESTIMATED'), salesKv('AI cost', '$' + base.aiCost, 'ESTIMATED')]),
            salesSection('What if reply rate doubles?', [salesKv('Customers', doubleReply.customers, 'ESTIMATED'), salesKv('Gross sales', '$' + doubleReply.grossSales, 'ESTIMATED')]),
            salesSection('What if a large wholesale order lands (inventory-constrained)?', [salesKv('Status', inv.status, 'ESTIMATED'), salesKv('Why', inv.reason, 'ESTIMATED')]),
            salesSection('Order-size scenarios', sizes.map(s => salesKv(s.size, s.units + ' units · $' + s.grossValue, 'SIMULATED'))),
          ] };
        });
      },
      salesOutreachStudioPanel(e, opts){
        return e.ui.page('Outreach Studio', opts, () => {
          const vs = [
            e.campaign.variant('subject', 'Wholesale body-care for your {{store}} boutique', e.claims.scan),
            e.campaign.variant('subject', 'A small-batch line your customers will reach for', e.claims.scan),
            e.campaign.variant('cta', 'Reply and I will send the line sheet for {{store}}', e.claims.scan),
          ];
          const cmp = e.campaign.compare(vs);
          const templates = ['intro', 'follow-up 1', 'follow-up 2', 'close loop', 'reply interest', 'reply price', 'sample reply', 'creator intro', 'review request', 'win-back'];
          return { title: 'Outreach Studio', state: 'OK', sections: [
            salesSection('Variant comparison (SIMULATION — nothing sent)', cmp.ranked.map(v => salesKv(v.kind + ': ' + v.text.slice(0, 40), 'q' + v.qualityScore + ' p' + v.personalizationScore + (v.claimSafe ? '' : ' ⚠'), v.claimSafe ? 'SIMULATED' : 'OWNER_INPUT_REQUIRED'))),
            salesSection('Template library (draft-only, no sending)', templates.map(t => salesKv(t, 'template available', 'ACTUAL'))),
          ] };
        });
      },
      salesReplyCenterPanel(e, opts){
        return e.ui.page('Reply & Follow-up Center', opts, () => {
          const replies = e.fixtures.replies().map(r => ({ text: r.text, label: e.replies.classify(r.text).label, conf: e.replies.classify(r.text).confidence }));
          const bucket = (pred, label) => salesSection(label, replies.filter(pred).map(r => salesKv(r.text.slice(0, 44), r.label, 'SIMULATED')).concat(replies.some(pred) ? [] : [salesKv('none', '—', 'ACTUAL')]));
          return { title: 'Reply & Follow-up Center', state: 'OK', sections: [
            bucket(r => !['UNSUBSCRIBE', 'BOUNCE', 'OUT_OF_OFFICE', 'UNKNOWN'].includes(r.label), 'Needs a response'),
            bucket(r => r.label === 'UNKNOWN', 'Unknown / ambiguous (review by hand)'),
            bucket(r => r.label === 'UNSUBSCRIBE', 'Opt-out / DNC (suppressed — no further contact)'),
            bucket(r => r.label === 'BOUNCE', 'Bounces'),
            bucket(r => r.label === 'OUT_OF_OFFICE', 'Out of office'),
            salesSection('Follow-up rules', [salesKv('Max follow-ups', e.followup.SEQUENCE ? e.followup.SEQUENCE.length : 3, 'ACTUAL'), salesKv('Suppressed leads', 'never followed up', 'ACTUAL')]),
          ] };
        });
      },
      salesExportPanel(e, opts){
        return e.ui.page('Export Center', opts, () => {
          const rows = e.leads.rank(e.fixtures.leads(6, 7)).map(l => ({ id: l.id, storeName: l.storeName, city: l.city, state: l.state, email: l.email, score: l.scoring.score }));
          const out = e.export.toCsv(rows, e.privacy.classifyField);
          const sample = out.csv.split('\r\n').slice(0, 3);
          return { title: 'Export Center', state: 'OK', sections: [
            salesSection('Safe CSV export (synthetic)', [salesKv('Rows', out.rows, 'SIMULATED'), salesKv('Columns exported', out.fields.join(', '), 'ACTUAL')]),
            salesSection('Dropped for privacy', out.dropped.length ? out.dropped.map(d => salesKv(d.field, 'dropped (' + d.class + ')', 'ACTUAL')) : [salesKv('none', '—', 'ACTUAL')]),
            salesSection('Preview (header + first rows)', sample.map((line, i) => salesKv('row ' + i, line.slice(0, 60), 'SIMULATED'))),
            salesSection('Safety', [salesKv('Formula injection', 'neutralized (= + - @ prefixed)', 'ACTUAL'), salesKv('Personal fields', 'excluded unless owner opts in', 'ACTUAL')]),
          ] };
        });
      },
      salesMeetingPanel(e, opts){
        return e.ui.page('Meeting & Deal Prep', opts, () => {
          const lead = { id: 'SYN-1011', storeName: 'Blue Harbor Apothecary', category: 'skincare', city: 'Portland', state: 'OR',
            email: 'buyer@blueharbor.example.com', website: 'blueharbor.example.com', source: 'referral',
            pipelineState: 'WHOLESALE_DISCUSSION', carriesSimilarBrands: true, synthetic: true };
          const hist = { outreach: [{ at: '2026-09-20', summary: 'intro' }], replies: [{ at: '2026-09-28', text: 'send pricing + MOQ' }],
            notes: [{ at: '2026-10-01', text: 'wants 3-store rollout' }], audit: [{ at: '2026-09-28', kind: 'reply_received' }], aiRuns: [{ cost: 0.02 }] };
          const d = e.leaddetail.dossier(lead, hist, { leads: e.leads, dataquality: e.dataquality });
          return { title: 'Meeting & Deal Prep', state: 'OK', sections: [
            salesSection('Business summary', [salesKv('Store', d.identity.storeName, 'SIMULATED'), salesKv('Location', [d.identity.city, d.identity.state].filter(Boolean).join(', '), 'SIMULATED'), salesKv('Stage', d.pipelineState, 'SIMULATED'), salesKv('Score', d.score.value, 'SIMULATED')]),
            salesSection('Prior interactions', d.timeline.length ? d.timeline.map(t => salesKv(t.at, t.type + ': ' + t.detail, 'SIMULATED')) : [salesKv('none', '—', 'ACTUAL')]),
            salesSection('Owner questions to ask', [salesKv('Order size', 'how many stores / opening order?', 'OWNER_INPUT_REQUIRED'), salesKv('Timing', 'target launch date?', 'OWNER_INPUT_REQUIRED'), salesKv('Terms', 'payment & shipping expectations?', 'OWNER_INPUT_REQUIRED')]),
            salesSection('Commercial blockers to resolve first', d.commercialBlockers.length ? d.commercialBlockers.map(b => salesKv(b.label, 'needed', 'OWNER_INPUT_REQUIRED')) : [salesKv('none', 'all facts present', 'ACTUAL')]),
            salesSection('Deal momentum', [salesKv('State', 'WARMING', 'ESTIMATED'), salesKv('Next best action', d.nextBestAction.action, 'ESTIMATED')]),
          ] };
        });
      },
      salesSampleOsPanel(e, opts){
        return e.ui.page('Sample Operating System', opts, () => {
          const cands = [
            { id: 'SYN-1011', storeName: 'Blue Harbor Apothecary', scoring: { score: 92 }, replyQuality: 'strong', likelyOrderSize: 'large', locations: 3, priorSamples: 0 },
            { id: 'SYN-1007', storeName: 'Cedar Day Spa', scoring: { score: 70 }, replyQuality: 'ok', likelyOrderSize: 'medium', locations: 1, priorSamples: 1 },
          ];
          const ranked = e.sampleadvisor.rank(cands, 8);
          const fraud = e.sampleadvisor.fraudScan([
            { id: 1, storeName: 'Spa One', email: 'a@dup.example.com', website: 'dup.example.com' },
            { id: 2, storeName: 'Spa Two', email: 'a@dup.example.com', website: 'dup.example.com' },
          ], { maxPerDomain: 1 });
          const book = e.samples.createSampleBook ? e.samples.createSampleBook({ monthlyBudget: 8 }) : null;
          return { title: 'Sample Operating System', state: 'OK', sections: [
            salesSection('Owner review — ranked candidates (owner approves each)', ranked.ranked.map(c => salesKv(c.storeName, 'score ' + c.score, 'SIMULATED'))),
            salesSection('Monthly budget', [salesKv('Synthetic budget', (book ? 8 : '—') + ' / month', 'SIMULATED'), salesKv('Approved this month', 0, 'SIMULATED'), salesKv('Owner approval', 'MANDATORY for every sample', 'ACTUAL')]),
            salesSection('ROI (synthetic)', [salesKv('Converted', 0, 'SIMULATED'), salesKv('Conversion rate', '—', 'UNKNOWN'), salesKv('Cost basis', 'UNKNOWN (owner sets cost)', 'UNKNOWN')]),
            salesSection('Fraud / duplicate watch', fraud.flags.length ? fraud.flags.map(f => salesKv(f.kind, f.detail, 'SIMULATED')) : [salesKv('No flags', 'clean', 'ACTUAL')]),
            salesSection('Safety', [salesKv('Auto-approve', 'IMPOSSIBLE — owner actor required', 'ACTUAL'), salesKv('Auto-ship / reserve', 'IMPOSSIBLE', 'ACTUAL')]),
          ] };
        });
      },
      salesAgentLabPanel(e, opts){
        return e.ui.page('Agent Lab', opts, () => {
          const reply = e.benchmark.runSuite(e.benchmark.GOLD.reply, t => e.replies.classify(t), r => r.label);
          const claim = e.benchmark.runSuite(e.benchmark.GOLD.claim, t => e.claims.scan(t), r => (r.findings && r.findings.length ? 'UNSAFE' : 'SAFE'));
          const matrix = e.providers.costMatrix(500, 300);
          const chaos = e.providers.chaos(['strong', 'cheap', 'template']);
          return { title: 'Agent Lab', state: 'OK', sections: [
            salesSection('Gold benchmark (deterministic baselines)', [salesKv('Reply classifier accuracy', reply.accuracy, reply.accuracyLabel), salesKv('Claim firewall accuracy', claim.accuracy, claim.accuracyLabel)]),
            salesSection('Provider comparison (fake providers, no credentials)', matrix.map(m => salesKv(m.provider + ' (' + m.tier + ')', m.configured ? ('$' + m.cost) : ('$' + m.cost + ' — not enabled'), m.configured ? 'ESTIMATED' : 'OWNER_INPUT_REQUIRED'))),
            salesSection('Provider failure chaos (fallback floor = template)', chaos.map(c => salesKv(c.down + ' down', '→ ' + c.fallsBackTo, 'SIMULATED'))),
          ] };
        });
      },
      salesAuditPanel(e, opts){
        return e.ui.page('Audit & Explainability', opts, () => {
          const lead = e.leads.score({ storeName: 'Blue Harbor Apothecary', category: 'skincare', carriesSimilarBrands: true, email: 'b@blueharbor.example.com', website: 'blueharbor.example.com', region: 'domestic', size: 'medium' });
          return { title: 'Audit & Explainability', state: 'OK', sections: [
            salesSection('Audit search (filters)', [salesKv('Filter by', 'lead · actor · agent · action · sample · approval · date · provider', 'ACTUAL'), salesKv('Hidden chain-of-thought', 'never shown — structured evidence only', 'ACTUAL')]),
            salesSection('Why this lead score? (structured rationale)', (lead.reasons || []).map((r, i) => salesKv('reason ' + (i + 1), r, 'SIMULATED'))),
            salesSection('Why blocked? / Why owner-decision?', [salesKv('Sample', 'owner actor + budget required', 'ACTUAL'), salesKv('Outreach send', 'Gmail not connected + send disabled', 'ACTUAL'), salesKv('Claim', 'firewall blocks therapeutic language', 'ACTUAL')]),
            (function(){
              // Lifecycle evidence (Wave H9): a synthetic append-only trail that
              // distinguishes suggestion / review / approval / simulated outcome.
              const draft = { kind: 'intro', recipient: 'b@blueharbor.example.com', subject: 'Intro', body: 'Hello from Health Endeavors body-care...', attachments: [], productFacts: { skuCount: 4 }, commercialTerms: {} };
              const approval = e.approval.approve(draft, 'owner', '2026-10-20T09:00:00Z');
              const trail = e.audit.createTrail();
              trail.record('SUGGESTION', { leadId: 'SYN-1003', detail: 'next step: draft outreach', at: '2026-10-20T08:00:00Z' });
              trail.record('REVIEW', { leadId: 'SYN-1003', actor: 'owner', detail: 'reviewed draft + claim scan', at: '2026-10-20T08:50:00Z' });
              trail.record('APPROVAL', { leadId: 'SYN-1003', fingerprint: approval.fingerprint, at: approval.approvedAt });
              trail.record('SIMULATED_OUTCOME', { leadId: 'SYN-1003', detail: 'SIMULATED — owner would send by hand (nothing sent)', at: '2026-10-20T09:05:00Z' });
              return salesSection('Lifecycle evidence (synthetic, append-only)', trail.forLead('SYN-1003').map(ev =>
                salesKv('#' + ev.seq + ' ' + ev.stage, (ev.actor ? ev.actor + ' · ' : '') + ev.detail + (ev.fingerprint ? ' · fp ' + ev.fingerprint : ''), 'SIMULATED')));
            })(),
          ] };
        });
      },
      salesBriefsPanel(e, opts){
        return e.ui.page('Owner Briefs', opts, () => {
          const q = e.queue.build({ approvalsAwaiting: [{ leadId: 'SYN-1003' }], sampleDecisions: [{ leadId: 'SYN-1011' }], repliesToReview: [{ leadId: 'SYN-1005' }], blocked: [{ leadId: 'SYN-1009', reason: 'needs price' }] });
          const an = e.anomaly.scan({ followUpBacklog: 30, approvalBacklog: 18 });
          const wl = e.workload.workload({ draftsAwaiting: 3, repliesToReview: 1, samplesToDecide: 1, contentApprovals: 2 });
          const brief = (label) => salesSection(label, [
            salesKv('Needs you now', q.counts.NEEDS_OWNER_NOW, 'SIMULATED'),
            salesKv('Replies to review', q.counts.TODAY, 'SIMULATED'),
            salesKv('Blocked (owner input)', q.counts.BLOCKED, 'SIMULATED'),
            salesKv('Est. owner minutes', wl.estMinutes, 'ESTIMATED'),
            salesKv('Anomalies flagged', an.total, 'SIMULATED'),
          ]);
          return { title: 'Owner Briefs', state: 'OK', sections: [
            brief('Morning brief'), brief('Midday brief'), brief('End-of-day brief'),
            salesSection('Note', [salesKv('Actions', 'briefs are read-only; nothing is sent or executed', 'ACTUAL')]),
          ] };
        });
      },
      salesPriorityPanel(e, opts){
        return e.ui.page('Prioritization Lab', opts, () => {
          const leads = [
            { id: 'SYN-1003', name: 'Big Spa Group', factors: { value: 0.9, fit: 0.8, urgency: 0.5, momentum: 0.6, effort: 0.3, risk: 0.2 } },
            { id: 'SYN-1007', name: 'Corner Wellness', factors: { value: 0.4, fit: 0.6, urgency: 0.3, momentum: 0.3, effort: 0.7, risk: 0.5 } },
            { id: 'SYN-1011', name: 'Urgent Reorder Co', factors: { value: 0.6, fit: 0.6, urgency: 0.95, momentum: 0.9, effort: 0.4, risk: 0.1 } },
            { id: 'SYN-1012', name: 'Boutique Chain', factors: { value: 0.75, fit: 0.7, urgency: 0.4, momentum: 0.5, effort: 0.5, risk: 0.3 } },
          ];
          const r = e.priority.rank(leads, e.priority.DEFAULT_WEIGHTS);
          const sens = e.priority.sensitivityAll(leads, e.priority.DEFAULT_WEIGHTS, 1);
          return { title: 'Prioritization Lab', state: r.count ? 'OK' : 'EMPTY', sections: [
            salesSection('Ranking (explainable, synthetic)', r.ranked.map(s => salesKv('#' + s.rank + ' ' + (s.name || s.leadId), s.explain, 'SIMULATED'))),
            salesSection('Preference sensitivity (what-if; no side effects)', sens.rows.map(row => salesKv(row.factor, (row.changed ? row.changed + ' lead(s) move' : 'no change') + (row.topChanged ? ' · top pick changes' : ''), 'ESTIMATED'))),
            salesSection('Note', [salesKv('Most influential preference', sens.mostInfluential || '—', 'ESTIMATED'), salesKv('Actions', 'advisory ranking only — contacts no one, changes no deal', 'ACTUAL')]),
          ] };
        });
      },
      salesProgressionPanel(e, opts){
        return e.ui.page('Deal Progression & Aging', opts, () => {
          const asOf = '2026-10-20T00:00:00Z';
          const days = n => new Date(Date.parse(asOf) - n * 86400000).toISOString();
          const leads = [
            { id: 'SYN-1003', name: 'Big Spa Group', state: 'CONTACTED', createdAt: days(6), enteredStateAt: days(4) },
            { id: 'SYN-1007', name: 'Corner Wellness', state: 'OUTREACH_DRAFTED', createdAt: days(30), enteredStateAt: days(18) },
            { id: 'SYN-1011', name: 'Urgent Reorder Co', state: 'INTERESTED', createdAt: days(80), enteredStateAt: days(55) },
            { id: 'SYN-1012', name: 'Boutique Chain', state: 'CUSTOMER', createdAt: days(120), enteredStateAt: days(10) },
          ];
          const a = e.progression.analyze(leads, { asOf });
          return { title: 'Deal Progression & Aging', state: a.rows.length ? 'OK' : 'EMPTY', sections: [
            salesSection('Aging buckets', e.progression.BUCKETS.concat(['DONE']).map(b => salesKv(b, a.histogram[b] || 0, 'SIMULATED'))),
            salesSection('Stalled (past stage SLA; worst first)', a.stalled.length ? a.stalled.map(r => salesKv(r.name || r.leadId, r.state + ' · ' + Math.round(r.currentStageDays) + 'd (over by ' + Math.round(r.overBy) + 'd)', 'SIMULATED')) : [salesKv('none', '—', 'ACTUAL')]),
            salesSection('Progression map (active per stage)', a.map.stages.filter(s => s.count > 0).map(s => salesKv(s.stage, s.count, 'SIMULATED'))),
            salesSection('Note', [salesKv('Avg active age (days)', Math.round(a.avgActiveAgeDays), 'ESTIMATED'), salesKv('Actions', 'read-only aging view — advances no deal, writes nothing', 'ACTUAL')]),
          ] };
        });
      },
      salesConcentrationPanel(e, opts){
        return e.ui.page('Pipeline Risk & Concentration', opts, () => {
          const deals = [
            { id: 'SYN-1003', account: 'Big Spa Group', weightedValue: 42 },
            { id: 'SYN-1007', account: 'Corner Wellness', weightedValue: 8 },
            { id: 'SYN-1011', account: 'Urgent Reorder Co', weightedValue: 20 },
            { id: 'SYN-1012', account: 'Boutique Chain', weightedValue: 18 },
            { id: 'SYN-1015', account: 'Big Spa Group', weightedValue: 12 },
          ];
          const c = e.concentration.analyze(deals);
          const pct = n => (n * 100).toFixed(0) + '%';
          return { title: 'Pipeline Risk & Concentration', state: c.dealCount ? 'OK' : 'EMPTY', sections: [
            salesSection('Concentration (weighted, synthetic)', [
              salesKv('Top deal share', pct(c.top1Share), 'SIMULATED'), salesKv('Top 3 share', pct(c.top3Share), 'SIMULATED'),
              salesKv('Top account share', pct(c.topAccountShare), 'SIMULATED'),
              salesKv('Deal HHI', c.dealHHI.toFixed(2), 'SIMULATED'), salesKv('Account HHI', c.accountHHI.toFixed(2), 'SIMULATED'),
            ]),
            salesSection('Risk flags', c.flags.length ? c.flags.map(f => salesKv(f.severity.toUpperCase() + ' · ' + f.code, f.message, 'SIMULATED')) : [salesKv('none', 'well spread', 'ACTUAL')]),
            salesSection('Note', [salesKv('Overall risk', c.riskLevel, 'ESTIMATED'), salesKv('Actions', 'weighted value is owner-supplied; invents no revenue, changes no deal', 'ACTUAL')]),
          ] };
        });
      },
      salesNextActionPanel(e, opts){
        return e.ui.page('Next-Best-Action', opts, () => {
          const leads = [
            { id: 'SYN-1003', state: 'OUTREACH_DRAFTED' },
            { id: 'SYN-1005', state: 'CONTACTED', daysInStage: 6 },
            { id: 'SYN-1007', state: 'INTERESTED', sampleEligible: true },
            { id: 'SYN-1009', state: 'REPLIED', hasReply: true, replyLabel: 'UNKNOWN' },
            { id: 'SYN-1011', state: 'DO_NOT_CONTACT' },
            { id: 'SYN-1012', state: 'QUALIFIED' },
          ];
          const r = e.nextaction.recommendAll(leads);
          return { title: 'Next-Best-Action', state: r.count ? 'OK' : 'EMPTY', sections: [
            salesSection('Recommended next step (advisory, synthetic)', r.rows.map(row => salesKv(row.leadId + ' · ' + row.state, row.action + ' — ' + row.reason + (row.ownerDecisionRequired ? ' · owner decision' : ''), 'SIMULATED'))),
            salesSection('Note', [salesKv('Owner decisions in list', r.ownerDecisions, 'SIMULATED'), salesKv('Actions', 'suggestions only — sends nothing, approves nothing, ships nothing', 'ACTUAL')]),
          ] };
        });
      },
      salesReplyLabPanel(e, opts){
        return e.ui.page('Reply Triage Lab', opts, () => {
          const replies = [
            { id: 'SYN-R1', text: 'Please unsubscribe me from this list' },
            { id: 'SYN-R2', text: 'What is your wholesale pricing and MOQ?' },
            { id: 'SYN-R3', text: 'asdf qwer zxcv' },
            { id: 'SYN-R4', text: 'Mailer-Daemon: delivery failed permanently' },
            { id: 'SYN-R5', text: 'We might be interested, tell me more about the line' },
          ];
          const t = e.replylab.triage(replies, e.replies);
          const pct = n => (n * 100).toFixed(0) + '%';
          return { title: 'Reply Triage Lab', state: t.count ? 'OK' : 'EMPTY', sections: [
            salesSection('Confidence (synthetic batch)', [
              salesKv('High', t.confidence.high, 'SIMULATED'), salesKv('Medium', t.confidence.medium, 'SIMULATED'),
              salesKv('Unknown', t.confidence.unknown, 'SIMULATED'), salesKv('Uncertain share', pct(t.uncertainShare), 'ESTIMATED'),
            ]),
            salesSection('Review queue (least certain first)', t.reviewQueue.length ? t.reviewQueue.map(r => salesKv(r.id, r.label + ' · ' + r.confidence, 'SIMULATED')) : [salesKv('none', '—', 'ACTUAL')]),
            salesSection('Suppression review (owner confirms — never auto)', t.suppressReview.length ? t.suppressReview.map(r => salesKv(r.id, r.label, 'OWNER_INPUT_REQUIRED')) : [salesKv('none', '—', 'ACTUAL')]),
            salesSection('Note', [salesKv('Actions', 'triage only — nothing suppressed, sent, or replied to automatically', 'ACTUAL')]),
          ] };
        });
      },
    };
    function loadSales(pageId){
      const host = document.getElementById(pageId);
      if (!host) return;
      const enabled = typeof salesGrowthOn === 'function' && salesGrowthOn();
      const title = SALES_TITLES[pageId] || 'Sales & Growth';
      try {
        const ui = salesUi();
        // Off (the default): render the DISABLED shell only; never build data or
        // touch the rest of the engine. On: build the real synthetic view model.
        const vm = (!enabled || !SALES_VIEWS[pageId])
          ? ui.page(title, { enabled: enabled }, () => ({ title, state: 'EMPTY', sections: [] }))
          : SALES_VIEWS[pageId](salesEngine(), { enabled: true });
        host.replaceChildren(ui.render(vm, h));
      } catch (err) {
        // A missing/broken engine module must never break the dashboard: show a
        // plain, safe message in this panel and nothing else.
        host.replaceChildren(h('section', { class: 'salesPage', 'data-state': 'ERROR' },
          h('h2', { class: 'salesTitle' }, title), h('p', { class: 'salesState', 'data-state': 'ERROR' }, 'This page could not load.')));
      }
    }

    // ---------- Sales outreach workbench (on Sales Approvals; behind salesGrowthOn)
    // The owner's Nov 3 brief: the sales workflow runnable end to end, with state
    // kept and clearly labelled, and a reset. Import an example store list ->
    // draft -> edit -> approve -> SIMULATED send -> record a reply -> next step.
    // Nothing is sent; the state is saved in THIS browser only (localStorage) and
    // "Reset workbench" clears it. The signed-in person's real role decides who
    // may approve (owner or administrator). The logic is he-sales-workbench.
    const WORKBENCH_KEY = 'he_sales_workbench';
    let workbenchState = null;
    let workbenchSelected = null;
    // Sections that redraw themselves after a click (the workbench,
    // reconciliation, preview switches, the invoice desk) lose the button that
    // was pressed and recreate their message line, which screen readers often
    // do not read out. announce() puts the result in one permanent, invisible
    // status region (#srAnnounce, in the page from the start); refocusLike()
    // puts keyboard focus back on the matching button after the redraw.
    function announce(text) {
      const el = document.getElementById('srAnnounce'); if (!el) return;
      const msg = String(text == null ? '' : text).slice(0, 500);
      el.textContent = '';                       // a repeated message is read again
      if (msg) setTimeout(() => { el.textContent = msg; }, 60);
    }
    // fallback: the section to focus when the pressed button no longer exists
    // (for example "Approve" after approving); given an id or an element.
    function refocusLike(btn, fallback) {
      if (!btn || !btn.attributes || document.contains(btn)) return;
      const sel = [...btn.attributes].filter(a => a.name.startsWith('data-')).map(a => '[' + a.name + '="' + CSS.escape(a.value) + '"]').join('');
      let next = null;
      if (sel) { try { next = document.querySelector(btn.tagName.toLowerCase() + sel); } catch (e) { next = null; } }
      if (next && typeof next.focus === 'function') { next.focus(); return; }
      const fb = typeof fallback === 'string' ? document.getElementById(fallback) : fallback;
      if (fb && typeof fb.focus === 'function') { if (!fb.hasAttribute('tabindex')) fb.setAttribute('tabindex', '-1'); fb.focus(); }
    }
    let workbenchMessage = '';
    const WORKBENCH_REPLIES = ['Sounds great — we would love to carry it. Can we set up a call?', 'Thanks! Can you send pricing and your minimum order?',
      'Please remove me from your list.', 'Not interested, thanks.', 'I am out of office until Monday.'];
    function workbenchDeps() {
      const m = n => { try { return salesMod('he-sales-' + n); } catch (e) { return null; } };
      return { import: m('import'), leads: m('leads'), outreach: m('outreach'), ai: m('ai'), claims: m('claims'), approval: m('approval'), replies: m('replies'), nextaction: m('nextaction') };
    }
    function workbenchSave(wb) {
      try { localStorage.setItem(WORKBENCH_KEY, wb.serialize(workbenchState)); return true; } catch (e) { return false; }
    }
    function loadSalesWorkbench() {
      const panel = document.getElementById('salesApprovalsPanel'); if (!panel) return;
      let host = document.getElementById('salesWorkbenchHost');
      if (!(typeof salesGrowthOn === 'function' && salesGrowthOn())) { if (host) host.remove(); return; }
      if (!host || host.parentNode !== panel) { if (host) host.remove(); host = h('div', { id: 'salesWorkbenchHost' }); panel.appendChild(host); }
      let wb = null; try { wb = salesMod('he-sales-workbench'); } catch (e) { wb = null; }
      if (!wb) { host.replaceChildren(h('p', { class: 'empty' }, 'The outreach workbench could not load.')); return; }
      if (!workbenchState) {
        let raw = null; try { raw = localStorage.getItem(WORKBENCH_KEY); } catch (e) { raw = null; }
        const r = wb.restore(raw); workbenchState = r.state; if (!r.ok) workbenchMessage = r.message;
      }
      const st = workbenchState; const sum = wb.summary(st);
      const isSuppressed = s => st.suppressed.indexOf(String(s.email || '').toLowerCase()) !== -1;
      const storeRows = st.stores.map(s => {
        const sel = workbenchSelected === s.id;
        const checks = s.status === 'NOT_USABLE' ? s.problems.join('; ') : (s.scoring ? s.scoring.score + ' (' + s.scoring.band + ')' + (s.problems.length ? ' · ' + s.problems.join('; ') : '') : '—');
        const label = s.storeName || '(no name)';
        return h('tr', { 'data-wb-store': s.id, 'data-wb-status': s.status },
          h('td', null, h('div', { class: 'taskTitle' }, label), h('div', { class: 'u-fs-11 u-c-muted' }, s.email || s.website || 'no contact')),
          h('td', null, checks),
          h('td', null, s.status),
          h('td', null, (s.status === 'NOT_USABLE' || s.status === 'LIKELY_DUPLICATE' || isSuppressed(s)) ? '—'
            : st.drafts[s.id] ? h('button', { type: 'button', class: 'small' + (sel ? '' : ' secondary'), 'data-workbench': 'open', 'data-store': s.id, 'aria-label': 'Review the email to ' + label }, sel ? 'Reviewing' : 'Review')
              : h('button', { type: 'button', class: 'small secondary', 'data-workbench': 'draft', 'data-store': s.id, 'aria-label': 'Draft an email to ' + label }, 'Draft email')));
      });
      let review = null;
      const cur = workbenchSelected && findWorkbenchStore(st, workbenchSelected);
      if (cur && st.drafts[cur.id]) {
        const d = st.drafts[cur.id]; const ap = st.approvals[cur.id]; const sent = st.outbox.some(o => o.storeId === cur.id);
        const reps = st.replies.filter(r => r.storeId === cur.id);
        review = h('div', { class: 'scanCard u-mt-10', 'data-wb-review': cur.id },
          h('div', { class: 'scanCardHead' }, 'Email to ' + cur.storeName + ' — version ' + d.version + (ap ? ' · approved by ' + ap.by : ' · not approved') + (sent ? ' · simulated-sent' : '')),
          h('div', { class: 'scanCardRow' }, h('span', { class: 'u-c-muted' }, 'Subject: '), d.subject),
          h('div', { class: 'scanCardRow u-fs-11 u-c-muted' }, 'Uses approved facts only: ' + d.factsUsed.map(f => f.fact + ' = ' + f.value).join(', ')),
          h('div', { class: 'heField heWide u-mt-6' }, h('label', { for: 'wbBody' }, 'Email text'),
            h('textarea', { id: 'wbBody', rows: '7', maxlength: String(wb.MAX_BODY), class: 'u-w-100pct u-p-9-10 u-br-8 u-b-1-solid-xcfd8d6 u-ff-inherit u-fs-14 u-rs-vertical' }, d.body)),
          h('div', { class: 'scanToggleRow u-mt-6' },
            h('button', { type: 'button', class: 'small secondary', 'data-workbench': 'save', 'data-store': cur.id }, 'Save edit'),
            h('button', { type: 'button', class: 'small', 'data-workbench': 'approve', 'data-store': cur.id }, ap ? 'Approved' : 'Approve'),
            h('button', { type: 'button', class: 'small secondary', 'data-workbench': 'send', 'data-store': cur.id }, 'Send (simulated)')),
          sent ? h('div', { class: 'heField u-mt-8' },
            h('label', { for: 'wbReply' }, 'The store replies (example)'),
            h('select', { id: 'wbReply' }, ...WORKBENCH_REPLIES.map(t => h('option', { value: t }, t))),
            h('div', { class: 'scanToggleRow u-mt-6' }, h('button', { type: 'button', class: 'small secondary', 'data-workbench': 'reply', 'data-store': cur.id }, 'Record this reply'))) : null,
          ...reps.map(r => h('div', { class: 'scanCardRow', 'data-wb-reply': r.label }, 'Reply: "' + r.text + '" → read as ' + r.label + ' → next step: ' + r.next)));
      }
      host.replaceChildren(h('div', { class: 'salesWorkbench u-mt-18' },
        h('div', { class: 'scanHead' }, h('h3', null, 'Outreach workbench'), h('span', { class: 'scanBadge' }, wb.GUARD)),
        h('p', { class: 'hint u-mt-6', 'data-wb-summary': '1' }, sum.stores + ' stores · ' + sum.drafts + ' drafts · ' + sum.approved + ' approved · ' + sum.simulatedSent + ' simulated-sent · ' + sum.replies + ' replies · ' + sum.doNotContact + ' do-not-contact'),
        workbenchMessage ? h('p', { class: 'hint u-mt-6', 'data-wb-msg': '1' }, workbenchMessage) : null,
        st.stores.length ? h('table', { class: 'phoneCards u-mt-8' },
          h('thead', null, h('tr', null, h('th', null, 'Store'), h('th', null, 'Checks and score'), h('th', null, 'Status'), h('th', null, 'Next'))),
          h('tbody', null, storeRows))
          : h('p', { class: 'empty' }, 'No stores yet. Load the example list to try the whole path.'),
        review,
        st.outbox.length ? h('div', { class: 'scanCard u-mt-10' }, h('div', { class: 'scanCardHead' }, 'Simulated outbox — nothing here was sent'),
          ...st.outbox.map(o => h('div', { class: 'scanCardRow', 'data-wb-outbox': o.storeId }, o.to + ' · "' + o.subject + '" · version ' + o.version + ' · not delivered'))) : null,
        st.suppressed.length ? h('p', { class: 'hint u-mt-8', 'data-wb-dnc': '1' }, 'Do not contact: ' + st.suppressed.join(', ')) : null,
        st.audit.length ? h('details', { class: 'hintMore u-mt-8' }, h('summary', null, 'What happened, step by step (' + st.audit.length + ')'),
          ...st.audit.slice(-20).map(a => h('div', { class: 'u-fs-11 u-c-muted' }, a.n + '. ' + a.action + (a.storeId ? ' · ' + a.storeId : '') + ' · ' + a.detail + (a.by ? ' · ' + a.by : '')))) : null,
        h('div', { class: 'scanToggleRow u-mt-8' },
          h('button', { type: 'button', class: 'small secondary', 'data-workbench': 'import' }, st.stores.length ? 'Load the example list again' : 'Load the example store list'),
          h('button', { type: 'button', class: 'small secondary', 'data-workbench': 'reset' }, 'Reset workbench')),
        h('p', { class: 'hint u-mt-6' }, 'Saved in this browser only, so it is still here after a reload. "Reset workbench" clears it. Nothing is stored in the database.')));
    }
    function findWorkbenchStore(st, id) { return (st.stores || []).find(s => s.id === id) || null; }
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-workbench]'); if (!t) return;
      let wb = null; try { wb = salesMod('he-sales-workbench'); } catch (err) { wb = null; }
      if (!wb || !workbenchState) return;
      const act = t.getAttribute('data-workbench'); const id = t.getAttribute('data-store');
      const who = { role: currentUserRole, by: String(currentUserRole || 'unknown') + ' (example)', at: new Date().toISOString() };
      const deps = workbenchDeps();
      let out = null;
      if (act === 'reset') {
        try { localStorage.removeItem(WORKBENCH_KEY); } catch (err) { /* nothing saved to clear */ }
        workbenchState = wb.empty(); workbenchSelected = null; workbenchMessage = 'The workbench was cleared.';
        loadSalesWorkbench(); announce(workbenchMessage); refocusLike(t); return;
      }
      if (act === 'open') { workbenchSelected = id; workbenchMessage = ''; loadSalesWorkbench(); return; }
      if (act === 'import') { out = wb.importRows(workbenchState, wb.exampleRows(), deps, who); if (out.ok) workbenchSelected = null; }
      else if (act === 'draft') { out = wb.draftFor(workbenchState, id, deps, who); if (out.ok) workbenchSelected = id; }
      else if (act === 'save') { const el = document.getElementById('wbBody'); out = wb.editDraft(workbenchState, id, el ? el.value : '', deps, who); }
      else if (act === 'approve') out = wb.approve(workbenchState, id, deps, who);
      else if (act === 'send') out = wb.simulateSend(workbenchState, id, deps, who);
      else if (act === 'reply') { const el = document.getElementById('wbReply'); out = wb.recordReply(workbenchState, id, el ? el.value : '', deps, who); }
      if (!out) return;
      workbenchState = out.state;   // a refusal can still add a line to the record
      workbenchMessage = out.message + (workbenchSave(wb) ? '' : ' (This browser would not save it; it will be gone after a reload.)');
      loadSalesWorkbench(); announce(workbenchMessage); refocusLike(t);
    });

    // ---------- Scan Shipment (Phase 1 prototype; behind scanShipmentOn()) ----
    // A local, SIMULATED flow: read/enter a shipping label, find the matching
    // order (role-scoped, from synthetic fixtures), confirm EVERY package, attach
    // the tracking number ONCE, and queue a simulated tracking check + one
    // notification. No camera/carrier/customer contact and no production writes.
    // DOM is built only with h(); clicks use delegated data-action handlers.
    const scanMod = (n) => { try { return (window.HE && window.HE.scan && window.HE.scan[n]) || null; } catch (e) { return null; } };
    const scanState = { step: 'capture', extracted: null, ranked: [], recognition: null, plan: null, attachedKeys: new Set(), assignedTracking: {}, cameraStream: null, outage: false };

    function scanOrders() {
      const fx = scanMod('he-scan-fixtures');
      return fx ? fx.ORDERS : [];
    }
    function scanAccessible() {
      const role = currentUserRole || 'staff';
      return function (o) { return (role === 'owner' || role === 'administrator') ? true : !o.owner_only; };
    }
    function scanOverlayEl() { return document.getElementById('scanOverlay'); }

    function stopScanCamera() {
      if (scanState.cameraStream) { try { scanState.cameraStream.getTracks().forEach(t => t.stop()); } catch (e) {} scanState.cameraStream = null; }
    }
    function closeScanFlow() {
      stopScanCamera();
      const o = scanOverlayEl(); if (o) { o.style.display = 'none'; o.replaceChildren(); }
      restoreFocus();
    }
    function openScanFlow() {
      if (!(typeof scanShipmentOn === 'function' && scanShipmentOn())) return;
      rememberFocus();
      scanState.step = 'capture'; scanState.extracted = null; scanState.ranked = []; scanState.recognition = null; scanState.plan = null; scanState.outage = false;
      const o = scanOverlayEl(); if (o) o.style.display = 'flex';
      renderScan();
    }

    // Build the extracted-fields object from a fixture scan, a barcode read, or
    // manual input, tagging HOW it was recognized so the UI never passes a fixture
    // off as a live read.
    function setExtracted(fields, recognition) {
      scanState.extracted = Object.assign({ carrier: '', tracking: '', orderRef: '', destZip: '', name: '', fulfillmentHint: true }, fields || {});
      scanState.recognition = recognition || 'manual';
      const eng = scanMod('he-scan');
      scanState.ranked = eng ? eng.rankOrders(scanState.extracted, scanOrders(), scanAccessible()) : [];
      scanState.step = 'review';
    }

    const RECOGNITION_LABEL = {
      barcode: 'Barcode (read from image)',
      fixture: 'Fixture scan (demo — not a live read)',
      manual: 'Typed by you',
      printed_text: 'Printed-text demo (fixture — real OCR not wired)',
    };

    async function scanRecognizePhoto(file) {
      // Real barcode recognition where the browser supports it; otherwise fall
      // back to manual. Never fabricate a read.
      try {
        if (typeof window.BarcodeDetector === 'function' && file) {
          const bitmap = await createImageBitmap(file);
          const det = new window.BarcodeDetector();
          const codes = await det.detect(bitmap);
          if (codes && codes.length) return { tracking: codes[0].rawValue || '', recognition: 'barcode' };
        }
      } catch (e) { /* fall through to manual */ }
      return null;
    }

    function scanConfirm(orderId) {
      const eng = scanMod('he-scan'); if (!eng) return;
      const cand = scanState.ranked.find(r => r.order.id === orderId) || (scanState.ranked[0] || null);
      const order = cand ? cand.order : null;
      const shipmentId = 'SYN-ship-' + (order ? order.id : 'x');
      let plan = eng.planAttach({
        shipmentId: shipmentId, orderId: order && order.id, tracking: scanState.extracted.tracking,
        carrier: scanState.extracted.carrier, channel: order && order.channel, actor: currentUserRole || 'owner',
        now: new Date().toISOString(), existingKeys: scanState.attachedKeys,
        // cross-order guard: refuse a label already attached to a DIFFERENT shipment
        assignedTo: scanState.assignedTracking,
      });
      // Provider outage simulation: the notification fails (held for safe retry);
      // the confirmed shipment state is preserved regardless.
      if (plan.ok && scanState.outage) {
        plan = Object.assign({}, plan, { queued: plan.queued.map(q => q.kind === 'notification' ? Object.assign({}, q, { state: 'failed' }) : q) });
      }
      if (plan.ok && plan.attach) {
        scanState.attachedKeys.add(plan.attach.dedup_key);
        scanState.assignedTracking[plan.attach.tracking_number] = plan.attach.shipment_id; // own this label
        (plan.queued || []).forEach(q => { if (q.kind === 'notification') scanState.attachedKeys.add(q.dedup_key); });
      }
      scanState.plan = plan; scanState.selectedOrder = order; scanState.step = 'result';
      renderScan();
    }

    function scanCard(c, ui) {
      return h('div', { class: 'scanCard' },
        h('div', { class: 'scanCardHead' }, (c.channel === 'wholesale' ? 'Wholesale' : 'Retail') + ' order ', h('b', null, c.order_number || c.order_id)),
        h('div', { class: 'scanCardRow' }, 'To: ', c.intendedRecipient, ' · ZIP ', c.destination.zip),
        h('div', { class: 'scanCardRow' }, 'Carrier: ', (c.carrier || '—'), ' · Tracking: ', h('span', { class: 'scanMono' }, c.tracking || '—')),
        h('div', { class: 'scanReasons' }, 'Why: ' + (c.reasons && c.reasons.length ? c.reasons.join('; ') : 'weak clue only')),
        h('div', { class: 'scanCardActions' },
          h('button', { type: 'button', class: 'small', 'data-scan': 'confirm', 'data-order': c.order_id }, 'Confirm & start tracking'),
          h('button', { type: 'button', class: 'small secondary', 'data-scan': 'back-capture' }, 'Correct / retake')));
    }

    function renderScan() {
      const host = scanOverlayEl(); if (!host) return;
      const ui = scanMod('he-scan-ui'); const eng = scanMod('he-scan');
      const card = h('div', { class: 'card scanCardWrap' });
      const head = h('div', { class: 'scanHead' },
        h('h3', null, 'Scan Shipment'),
        h('span', { class: 'scanBadge' }, 'SIMULATED — no carrier or customer is contacted'));
      const close = h('button', { type: 'button', class: 'small secondary scanClose', 'data-scan': 'close' }, 'Close');
      let body;
      if (!ui || !eng) {
        body = h('p', { class: 'empty' }, 'The scan tools could not load.');
      } else if (scanState.step === 'capture') {
        const cap = ui.captureStep({ cameraAvailable: typeof navigator !== 'undefined' && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) });
        body = h('div', { class: 'scanBody' },
          h('p', { class: 'scanNote' }, 'Read a shipping label, choose a photo, or type it in. Every package is confirmed before anything is attached.'),
          h('div', { class: 'scanMethods' },
            cap.cameraAvailable ? h('button', { type: 'button', class: 'small', 'data-scan': 'camera' }, 'Scan with camera') : h('span', { class: 'scanHint' }, 'Camera not available on this device — use a photo or type it in.'),
            h('label', { class: 'small scanFileBtn' }, 'Choose a photo', h('input', { type: 'file', accept: 'image/*', 'data-scan': 'photo', class: 'u-d-none' })),
            h('button', { type: 'button', class: 'small secondary', 'data-scan': 'manual' }, 'Enter by hand')),
          h('details', { class: 'scanDemo' }, h('summary', null, 'Load a sample scan (demo fixtures)'),
            h('div', { class: 'scanDemoRow' },
              ['exact_match', 'same_name', 'multi_package', 'zip_only', 'no_match', 'invalid_tracking'].map(k =>
                h('button', { type: 'button', class: 'small secondary', 'data-scan': 'fixture', 'data-fx': k }, k.replace(/_/g, ' '))))));
      } else if (scanState.step === 'camera') {
        body = h('div', { class: 'scanBody' },
          h('p', { class: 'scanNote' }, 'Point the camera at the label. Reading uses the browser barcode reader where supported.'),
          h('video', { id: 'scanVideo', class: 'scanVideo', autoplay: true, muted: true, playsinline: true }),
          h('div', { class: 'scanCardActions' },
            h('button', { type: 'button', class: 'small', 'data-scan': 'capture-frame' }, 'Read label'),
            h('button', { type: 'button', class: 'small secondary', 'data-scan': 'back-capture' }, 'Back')));
      } else if (scanState.step === 'manual') {
        body = h('div', { class: 'scanBody' },
          h('p', { class: 'scanNote' }, 'Type what you can read from the label. Carrier and tracking are enough to start.'),
          h('div', { class: 'heForm' },
            h('div', { class: 'heField' }, h('label', { for: 'scanM_carrier' }, 'Carrier'), h('select', { id: 'scanM_carrier' }, h('option', { value: '' }, 'Detect automatically'), h('option', { value: 'ups' }, 'UPS'), h('option', { value: 'usps' }, 'USPS'), h('option', { value: 'fedex' }, 'FedEx'))),
            h('div', { class: 'heField' }, h('label', { for: 'scanM_tracking' }, 'Tracking number'), h('input', { type: 'text', id: 'scanM_tracking', placeholder: 'e.g. 1Z…' })),
            h('div', { class: 'heField' }, h('label', { for: 'scanM_ref' }, 'Order number ', h('span', { class: 'heOpt' }, '(if on the label)')), h('input', { type: 'text', id: 'scanM_ref', placeholder: 'e.g. SYN-1003' })),
            h('div', { class: 'heField' }, h('label', { for: 'scanM_zip' }, 'Destination ZIP ', h('span', { class: 'heOpt' }, '(optional)')), h('input', { type: 'text', id: 'scanM_zip', placeholder: 'e.g. 10001' })),
            h('div', { class: 'heField heWide' }, h('label', { for: 'scanM_name' }, 'Recipient / store ', h('span', { class: 'heOpt' }, '(optional, weak clue)')), h('input', { type: 'text', id: 'scanM_name' }))),
          h('div', { class: 'scanCardActions' },
            h('button', { type: 'button', class: 'small', 'data-scan': 'manual-submit' }, 'Find the order'),
            h('button', { type: 'button', class: 'small secondary', 'data-scan': 'back-capture' }, 'Back')));
      } else if (scanState.step === 'review') {
        const rv = ui.reviewExtraction(scanState.extracted);
        const conf = ui.confirmStep(scanState.extracted, scanState.ranked);
        body = h('div', { class: 'scanBody' },
          h('div', { class: 'scanRecog' }, 'Read as: ', h('b', null, RECOGNITION_LABEL[scanState.recognition] || scanState.recognition)),
          h('div', { class: 'scanFields' },
            h('div', null, 'Carrier: ', h('b', null, rv.fields.carrier.value)),
            h('div', null, 'Tracking: ', h('span', { class: 'scanMono' }, rv.fields.tracking.value), rv.invalidTracking ? h('span', { class: 'scanWarn' }, ' ⚠ tracking failed its carrier check — confirm or re-enter') : null),
            rv.trackingLink ? h('a', { href: rv.trackingLink, target: '_blank', rel: 'noopener', class: 'scanLink' }, 'Open on carrier site') : null),
          h('div', { class: 'scanToggleRow' },
            h('button', { type: 'button', class: 'small secondary', 'data-scan': 'back-capture' }, 'Retake / correct'),
            h('button', { type: 'button', class: 'small secondary', 'data-scan': 'manual' }, 'Edit by hand'),
            h('label', { class: 'scanOutage' }, h('input', { type: 'checkbox', 'data-scan': 'outage', class: 'u-w-auto' }), ' simulate a provider outage')),
          conf.kind === 'single_match' ? h('div', null, h('p', { class: 'scanSub' }, 'Suggested order — confirm to attach:'), conf.cards.map(c => scanCard(c, ui)))
            : conf.kind === 'multiple_matches' ? h('div', null, h('p', { class: 'scanSub' }, 'More than one order matches — pick the right one:'), conf.cards.map(c => scanCard(c, ui)))
            : h('div', null, h('p', { class: 'scanSub scanWarn' }, conf.note), h('button', { type: 'button', class: 'small', 'data-scan': 'manual' }, 'Search / enter the order')));
      } else if (scanState.step === 'result') {
        const res = ui.resultStep(scanState.plan);
        const rows = (res.queued || []).map(q => h('div', { class: 'scanQ' },
          (q.kind === 'tracking_check' ? 'Tracking check' : 'Shipping notification' + (q.channel ? ' (' + q.channel + ')' : '')) + ': ',
          h('span', { class: 'scanQState scanQ-' + q.state }, q.state),
          q.retryable ? h('button', { type: 'button', class: 'small secondary', 'data-scan': 'retry' }, 'Retry') : null));
        body = h('div', { class: 'scanBody' },
          res.state === 'OK' ? h('div', null,
            h('p', { class: 'scanOk' }, '✓ Tracking attached to the shipment (simulated).'),
            h('div', { class: 'scanFields' },
              h('div', null, 'Carrier: ', h('b', null, res.attached.carrier), ' · ', h('span', { class: 'scanMono' }, res.attached.tracking)),
              h('div', null, 'Tracking state: ', h('b', null, res.attached.trackingState), ' — a scan does not prove the carrier accepted it')),
            h('p', { class: 'scanSub' }, 'Queued (simulated):'), rows,
            h('p', { class: 'scanNote' }, res.note))
          : res.state === 'DUPLICATE' ? h('p', { class: 'scanWarn' }, res.note)
          : h('p', { class: 'scanWarn' }, '⚠ ' + res.note),
          h('div', { class: 'scanCardActions' }, h('button', { type: 'button', class: 'small', 'data-scan': 'again' }, 'Scan another'), h('button', { type: 'button', class: 'small secondary', 'data-scan': 'close' }, 'Done')));
      }
      card.replaceChildren(head, close, body);
      host.replaceChildren(card);
      scanFocusStep(host);
      if (scanState.step === 'camera') startScanCamera();
    }
    // Keyboard and screen-reader users land inside the dialog at every step:
    // on the first field to fill in when there is one, otherwise on the
    // dialog's heading (which then reads the step). Nov 15 — before this, focus
    // stayed behind the dialog when it opened and fell to the page after a step.
    function scanFocusStep(host) {
      if (!host || host.style.display === 'none') return;
      const field = host.querySelector('input:not([type=hidden]):not([type=file]), select, textarea');
      const heading = host.querySelector('h3');
      if (heading) heading.setAttribute('tabindex', '-1');
      const target = field || heading;
      if (target && typeof target.focus === 'function') target.focus();
    }
    // Escape closes the dialog; Tab and Shift+Tab stay inside it while it is open.
    function scanKeydown(e) {
      const o = scanOverlayEl(); if (!o || o.style.display === 'none' || !o.firstChild) return;
      if (e.key === 'Escape') { e.preventDefault(); closeScanFlow(); return; }
      if (e.key !== 'Tab') return;
      // what the browser will really Tab to: includes a <summary>, skips what a
      // closed <details> hides (checkVisibility knows about that; older Safari
      // falls back to layout boxes)
      const shown = el => (typeof el.checkVisibility === 'function' ? el.checkVisibility({ checkVisibilityCSS: true }) : el.getClientRects().length > 0) && !el.closest('details:not([open]) > :not(summary)');
      const items = [...o.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, summary, [tabindex]:not([tabindex="-1"])')].filter(el => !el.disabled && shown(el));
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (!o.contains(document.activeElement)) { e.preventDefault(); first.focus(); return; }
      if (e.shiftKey && (document.activeElement === first || document.activeElement === o.querySelector('h3'))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', scanKeydown);

    async function startScanCamera() {
      const video = document.getElementById('scanVideo');
      if (!video || !(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) { scanState.step = 'capture'; renderScan(); return; }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        scanState.cameraStream = stream; video.srcObject = stream;
      } catch (e) {
        // Denied or unavailable — fall back cleanly to photo / manual.
        stopScanCamera(); scanState.step = 'capture'; renderScan();
        toast('Camera not available — choose a photo or type the label in.');
      }
    }

    async function captureScanFrame() {
      const video = document.getElementById('scanVideo'); if (!video) return;
      let recognized = null;
      try {
        if (typeof window.BarcodeDetector === 'function') {
          const det = new window.BarcodeDetector();
          const codes = await det.detect(video);
          if (codes && codes.length) recognized = { tracking: codes[0].rawValue || '', recognition: 'barcode' };
        }
      } catch (e) { /* fall through */ }
      stopScanCamera();
      if (recognized) { setExtracted({ tracking: recognized.tracking }, 'barcode'); renderScan(); }
      else { scanState.step = 'manual'; renderScan(); toast('No barcode read — type the label in.'); }
    }

    function scanEntryButton() {
      return h('button', { type: 'button', class: 'small scanEntryBtn', 'data-scan': 'open' }, '📦 Scan Shipment');
    }
    // Paint the entry action into Home and Orders, only when the flag is on. With
    // the flag off the hosts stay empty, so the live dashboard is unchanged.
    function paintScanEntry() {
      if (!(typeof scanShipmentOn === 'function' && scanShipmentOn())) return;
      ['scanEntryHome', 'scanEntryOrders'].forEach((id) => {
        const host = document.getElementById(id);
        if (host && !host.firstChild) host.replaceChildren(scanEntryButton());
      });
    }

    // One delegated handler for the whole overlay + entry buttons.
    document.addEventListener('click', async (e) => {
      const t = e.target.closest('[data-scan]'); if (!t) return;
      const act = t.getAttribute('data-scan');
      if (act === 'open') { e.preventDefault(); openScanFlow(); return; }
      if (act === 'close') { closeScanFlow(); return; }
      if (act === 'camera') { scanState.step = 'camera'; renderScan(); return; }
      if (act === 'manual') { scanState.step = 'manual'; renderScan(); return; }
      if (act === 'back-capture') { stopScanCamera(); scanState.step = 'capture'; renderScan(); return; }
      if (act === 'capture-frame') { await captureScanFrame(); return; }
      if (act === 'fixture') {
        const fx = scanMod('he-scan-fixtures'); const key = t.getAttribute('data-fx');
        if (fx && fx.SCANS[key]) setExtracted(fx.SCANS[key], 'fixture');
        renderScan(); return;
      }
      if (act === 'manual-submit') {
        setExtracted({
          carrier: (document.getElementById('scanM_carrier') || {}).value || '',
          tracking: (document.getElementById('scanM_tracking') || {}).value || '',
          orderRef: (document.getElementById('scanM_ref') || {}).value || '',
          destZip: (document.getElementById('scanM_zip') || {}).value || '',
          name: (document.getElementById('scanM_name') || {}).value || '',
        }, 'manual');
        renderScan(); return;
      }
      if (act === 'confirm') { scanConfirm(t.getAttribute('data-order')); return; }
      if (act === 'retry') {
        // Safe retry: re-queue the failed notification without re-attaching.
        if (scanState.plan && scanState.plan.queued) scanState.plan.queued = scanState.plan.queued.map(q => q.state === 'failed' ? Object.assign({}, q, { state: 'sent' }) : q);
        scanState.outage = false; renderScan(); return;
      }
      if (act === 'again') { openScanFlow(); return; }
    });
    document.addEventListener('change', async (e) => {
      const t = e.target.closest('[data-scan]'); if (!t) return;
      const act = t.getAttribute('data-scan');
      if (act === 'photo' && t.files && t.files[0]) {
        const r = await scanRecognizePhoto(t.files[0]);
        if (r) setExtracted({ tracking: r.tracking }, 'barcode');
        else { scanState.step = 'manual'; renderScan(); toast('No barcode found in that photo — type the label in.'); return; }
        renderScan();
      }
      if (act === 'outage') { scanState.outage = !!t.checked; }
    });

    // ---------- Inventory reorder planning (read-only; behind reorderPlanningOn)
    // Surfaces the pure reorder engine over synthetic fixtures as a planning view
    // in the Inventory panel. RECOMMENDS only — never writes stock or places a PO.
    const invMod = (n) => { try { return (window.HE && window.HE.inventory && window.HE.inventory[n]) || null; } catch (e) { return null; } };
    let reorderFilter = 'all';
    let reorderShowDraft = false;

    function reorderItems() {
      const fx = invMod('he-reorder-fixtures');
      let items = fx ? fx.ITEMS.slice() : [];
      if (reorderFilter === 'finished') items = items.filter(i => (i.kind || 'finished') === 'finished');
      else if (reorderFilter === 'component') items = items.filter(i => i.kind === 'component');
      return items;
    }
    function reorderDecisionBadge(p) {
      const map = { reorder: ['Reorder', 'badge sev-medium'], reorder_manual: ['Reorder (manual)', 'badge sev-medium'], none: ['OK', 'badge'], needs_data: ['Needs data', 'badge sev-high'] };
      const m = map[p.decision] || ['—', 'badge'];
      return h('span', { class: m[1] }, m[0]);
    }
    function fmtCell(v) { return (v == null) ? '—' : String(v); }
    function loadReorderPlanning() {
      const host = document.getElementById('reorderPlanningHost'); if (!host) return;
      if (!(typeof reorderPlanningOn === 'function' && reorderPlanningOn())) { host.replaceChildren(); return; }
      const eng = invMod('he-reorder');
      if (!eng) { host.replaceChildren(h('p', { class: 'empty' }, 'Reorder planning tools could not load.')); return; }
      const plan = eng.reorderPlan(reorderItems());
      const rows = plan.proposals.map(p => h('tr', { class: p.duplicate ? 'reorderDup' : '' },
        h('td', null, h('div', { class: 'taskTitle' }, p.key), h('div', { class: 'u-fs-11 u-c-muted' }, p.kind + (p.duplicate ? ' · duplicate (skipped)' : ''))),
        h('td', { class: 'num-cell' }, fmtCell(p.onHand)),
        h('td', { class: 'num-cell' }, fmtCell(p.reserved)),
        h('td', { class: 'num-cell' }, fmtCell(p.incoming)),
        h('td', { class: 'num-cell' }, p.leadTimeDays == null ? '—' : p.leadTimeDays + 'd'),
        h('td', { class: 'num-cell' }, p.daysOfCover == null ? '?' : (p.daysOfCover === 'infinite' ? '∞' : p.daysOfCover + 'd')),
        h('td', null, reorderDecisionBadge(p), h('div', { class: 'u-fs-11 u-c-muted' }, (p.reasons || []).join('; '))),
        h('td', { class: 'num-cell' }, p.quantity ? String(p.quantity) : '—'),
        h('td', { class: 'num-cell' }, p.cash == null ? (p.decision === 'reorder' || p.decision === 'reorder_manual' ? 'cost?' : '—') : fmtMoney(p.cash, 'USD'))));
      const filterChip = (k, label) => h('button', { type: 'button', class: 'small' + (reorderFilter === k ? '' : ' secondary'), 'data-reorder': 'filter', 'data-kind': k }, label);
      const draftNode = reorderShowDraft ? h('div', { class: 'scanCard u-mt-10' },
        h('div', { class: 'scanCardHead' }, 'Draft reorder (simulated — not placed)'),
        plan.actionable.length ? plan.actionable.map(p => h('div', { class: 'scanCardRow' }, p.key + ' × ' + p.quantity + (p.cash == null ? ' (cost unknown)' : ' — ' + fmtMoney(p.cash, 'USD')))) : h('div', { class: 'scanCardRow' }, 'Nothing to reorder right now.'),
        h('div', { class: 'u-fs-12 u-c-muted u-mt-8' }, 'Cash needed (known costs): ' + fmtMoney(plan.cashTotal, 'USD') + (plan.cashUnknownCount ? ' · ' + plan.cashUnknownCount + ' item(s) missing a unit cost' : ''))) : null;
      host.replaceChildren(h('div', { class: 'reorderPlan u-mb-16' },
        h('div', { class: 'scanHead' }, h('h3', null, 'Reorder planning'), h('span', { class: 'scanBadge' }, 'SIMULATED — planning only, no purchase is placed')),
        h('div', { class: 'scanToggleRow u-mt-8' }, filterChip('all', 'All'), filterChip('finished', 'Finished'), filterChip('component', 'Components'),
          h('button', { type: 'button', class: 'small secondary', 'data-reorder': 'draft' }, reorderShowDraft ? 'Hide draft' : 'Preview draft reorder')),
        h('table', { class: 'phoneCards u-mt-10' },
          h('thead', null, h('tr', null, h('th', null, 'Item'), h('th', { class: 'num-cell' }, 'On hand'), h('th', { class: 'num-cell' }, 'Reserved'), h('th', { class: 'num-cell' }, 'Inbound'), h('th', { class: 'num-cell' }, 'Lead'), h('th', { class: 'num-cell' }, 'Cover'), h('th', null, 'Suggestion & why'), h('th', { class: 'num-cell' }, 'Qty'), h('th', { class: 'num-cell' }, 'Cash'))),
          h('tbody', null, rows)),
        draftNode));
    }
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-reorder]'); if (!t) return;
      const act = t.getAttribute('data-reorder');
      if (act === 'filter') { reorderFilter = t.getAttribute('data-kind') || 'all'; loadReorderPlanning(); }
      else if (act === 'draft') { reorderShowDraft = !reorderShowDraft; loadReorderPlanning(); }
      refocusLike(t, 'reorderPlanningHost');
    });

    // ---------- #65 Saved views & filters (personal; behind savedViewsOn()) ----
    // A per-person, per-screen set of named filter presets, saved in this
    // browser's localStorage (namespaced by user so views never cross people).
    // OFF by default: with the flag off the host renders empty, so the Orders and
    // Inventory screens are byte-unchanged. The engine (he-saved-views) is pure;
    // this only binds it to localStorage + the current user + the screen's host.
    const viewsMod = (n) => { try { return (window.HE && window.HE.views && window.HE.views[n]) || null; } catch (e) { return null; } };
    const SAVED_VIEW_HOSTS = [['savedViewsOrders', 'ordersPanel'], ['savedViewsInventory', 'inventoryPanel']];
    const SAVED_VIEW_STATUS = {
      ordersPanel: [['', 'Any status'], ['unfulfilled', 'Unfulfilled'], ['fulfilled', 'Fulfilled'], ['wholesale', 'Wholesale']],
      inventoryPanel: [['', 'Any stock'], ['low', 'Low stock'], ['out', 'Out of stock'], ['damaged', 'Has damaged']],
    };
    function savedViewStore(eng, uid, panel) {
      try { return eng.createViewStore({ storage: window.localStorage, userId: uid, panel: panel }); } catch (e) { return null; }
    }
    function renderSavedViews(host, eng, uid, panel) {
      const store = savedViewStore(eng, uid, panel);
      if (!store) { host.replaceChildren(); return; }
      const views = store.list();
      const statusOpts = (SAVED_VIEW_STATUS[panel] || [['', 'Any']]).map(([v, l]) => h('option', { value: v }, l));
      const nameInput = h('input', { type: 'text', id: panel + 'ViewName', class: 'u-p-9-10 u-br-8 u-b-1-solid-xcfd8d6 u-ff-inherit u-fs-13', placeholder: 'Name this view', 'aria-label': 'Name this view', maxlength: '60' });
      const searchInput = h('input', { type: 'text', id: panel + 'ViewSearch', class: 'u-p-9-10 u-br-8 u-b-1-solid-xcfd8d6 u-ff-inherit u-fs-13', placeholder: 'Search text', 'aria-label': 'Filter: search text' });
      const statusSel = h('select', { id: panel + 'ViewStatus', class: 'u-p-9-10 u-br-8 u-b-1-solid-xcfd8d6 u-ff-inherit u-fs-13', 'aria-label': 'Filter: status' }, ...statusOpts);
      const viewChips = views.length ? views.map(v => h('span', { class: 'savedViewChip u-mr-6' },
        h('button', { type: 'button', class: 'small secondary', 'data-savedview': 'restore', 'data-panel': panel, 'data-name': v.name }, v.name),
        h('button', { type: 'button', class: 'small secondary', 'data-savedview': 'delete', 'data-panel': panel, 'data-name': v.name, 'aria-label': 'Delete view ' + v.name, title: 'Delete' }, '✕')))
        : [h('span', { class: 'empty u-fs-12' }, 'No saved views yet.')];
      host.replaceChildren(h('div', { class: 'savedViews u-mb-14' },
        h('div', { class: 'scanHead' }, h('h3', null, 'Saved views'), h('span', { class: 'scanBadge' }, 'Personal — saved on this device')),
        h('div', { class: 'savedViewForm u-mt-8', role: 'group', 'aria-label': 'Save a view' }, nameInput, searchInput, statusSel,
          h('button', { type: 'button', class: 'small', 'data-savedview': 'save', 'data-panel': panel }, 'Save view'),
          h('button', { type: 'button', class: 'small secondary', 'data-savedview': 'reset', 'data-panel': panel }, 'Reset')),
        h('div', { class: 'savedViewList u-mt-8' }, ...viewChips)));
    }
    async function loadSavedViews() {
      const on = typeof savedViewsOn === 'function' && savedViewsOn();
      const eng = viewsMod('he-saved-views');
      let uid = 'anon'; try { uid = (await currentUserId()) || 'anon'; } catch (e) { /* not signed in */ }
      SAVED_VIEW_HOSTS.forEach(([hostId, panel]) => {
        const host = document.getElementById(hostId); if (!host) return;
        if (!on || !eng) { host.replaceChildren(); return; }
        renderSavedViews(host, eng, uid, panel);
      });
    }
    document.addEventListener('click', async (e) => {
      const t = e.target.closest('[data-savedview]'); if (!t) return;
      const act = t.getAttribute('data-savedview');
      const panel = t.getAttribute('data-panel');
      const eng = viewsMod('he-saved-views'); if (!eng) return;
      let uid = 'anon'; try { uid = (await currentUserId()) || 'anon'; } catch (err) { /* not signed in */ }
      const store = savedViewStore(eng, uid, panel); if (!store) return;
      const nameEl = document.getElementById(panel + 'ViewName');
      const searchEl = document.getElementById(panel + 'ViewSearch');
      const statusEl = document.getElementById(panel + 'ViewStatus');
      if (act === 'save') {
        const r = store.save((nameEl && nameEl.value) || '', { search: (searchEl && searchEl.value) || '', status: (statusEl && statusEl.value) || '' }, new Date().toISOString());
        if (!r.ok) { toast(r.reason || 'Could not save that view.'); return; }
        if (nameEl) nameEl.value = '';
        await loadSavedViews();   // redraw first, then put focus back
      } else if (act === 'restore') {
        const f = store.restore(t.getAttribute('data-name')) || {};
        if (searchEl) searchEl.value = f.search || '';
        if (statusEl) statusEl.value = f.status || '';
      } else if (act === 'delete') {
        store.remove(t.getAttribute('data-name'));
        await loadSavedViews();   // redraw first, then put focus back
      } else if (act === 'reset') {
        if (searchEl) searchEl.value = '';
        if (statusEl) statusEl.value = '';
      }
      const svHost = SAVED_VIEW_HOSTS.find(x => x[1] === panel);
      refocusLike(t, svHost ? svHost[0] : null);
    });

    // ---------- Invoice payments (drafts/32, Nov 22; behind invoicePaymentsOn)
    // Stored invoices and the payments recorded against them, from the database
    // (he-invoice-store.js). Owner or administrator: record a payment (amount,
    // date received, how, reference) and reverse one with a written reason; the
    // invoice's paid amount and status follow the recorded payments, set by the
    // database. A payment is never edited or deleted. Each form carries one
    // request key until it succeeds, so a second press or a retry after a lost
    // reply records once. OFF by default; does nothing until drafts/32 is installed.
    let invPaySeq = 0;
    let invPayOpen = null;           // the invoice whose payments are shown
    let invPayReverse = null;        // the payment whose reverse form is open
    let invPayLast = null;           // { store, invoices, myId }
    let invPayMessage = '';
    const IP_METHOD = { check: 'Check', ach: 'ACH transfer', card: 'Card', cash: 'Cash', wire: 'Wire transfer', other: 'Other' };
    const IP_STATUS = { issued: 'Issued, unpaid', partially_paid: 'Partly paid', paid: 'Paid', void: 'Void' };
    function invPayStore() {
      let mod = null; try { mod = (window.HE && window.HE.invoice && window.HE.invoice['he-invoice-store']) || null; } catch (e) { mod = null; }
      if (!mod || !(typeof invoicePaymentsOn === 'function' && invoicePaymentsOn())) return null;
      return mod.createStore({ client: supabase, enabled: true, role: currentUserRole });
    }
    function ipMoney(v) { return v == null ? 'Tax pending' : fmtMoney(v, 'USD'); }
    function ipWho(id) { const L = invPayLast; return !id ? 'someone' : (L && L.myId && id === L.myId) ? 'you' : 'a team member'; }
    async function loadInvoicePayments() {
      const host = document.getElementById('invoicePaymentsHost'); if (!host) return;
      const store = invPayStore();
      if (!store) { host.replaceChildren(); return; }
      const seq = ++invPaySeq;
      const wrap = (mode, ...kids) => h('div', { class: 'invoicePayments u-mb-16', 'data-ipmode': mode }, h('h3', { class: 'u-fs-13 u-c-navy u-m-18-0-6' }, 'Invoice payments'), ...kids);
      if (currentUserRole !== 'owner' && currentUserRole !== 'administrator') {
        host.replaceChildren(wrap('forbidden', h('p', { class: 'hint' }, 'Payments are visible to the owner and administrators only.'))); return;
      }
      const pr = await store.probe(); if (seq !== invPaySeq) return;
      if (!pr.ok) { host.replaceChildren(wrap('unavailable', h('p', { class: 'hint', 'data-ipnote': '1' }, pr.message))); return; }
      const L = await store.list({ limit: 200 }); if (seq !== invPaySeq) return;
      if (!L.ok) { host.replaceChildren(wrap('unavailable', h('p', { class: 'hint', 'data-ipnote': '1' }, L.message))); return; }
      const invoices = L.invoices.filter(x => x.status && x.status !== 'draft');
      const myId = await currentUserId().catch(() => null); if (seq !== invPaySeq) return;
      invPayLast = { store, invoices, myId };
      if (invPayOpen && !invoices.some(x => x.id === invPayOpen)) invPayOpen = null;
      let pays = null;
      if (invPayOpen) { pays = await store.listPayments(invPayOpen); if (seq !== invPaySeq) return; }
      const open = invoices.find(x => x.id === invPayOpen) || null;
      const rows = invoices.map(x => h('tr', { 'data-ipinvoice': x.id, 'data-ipstatus': x.status },
        h('td', null, h('div', { class: 'taskTitle' }, x.number || '(no number)'), h('div', { class: 'u-fs-12 u-c-muted' }, (x.billTo && x.billTo.name) ? String(x.billTo.name).slice(0, 80) : 'Billing name not recorded')),
        h('td', null, IP_STATUS[x.status] || x.status),
        h('td', { class: 'num-cell' }, ipMoney(x.total)),
        h('td', { class: 'num-cell' }, fmtMoney(x.paid || 0, 'USD')),
        h('td', { class: 'num-cell' }, x.status === 'void' ? '—' : ipMoney(x.balance)),
        h('td', null, h('button', { type: 'button', class: 'small secondary', 'data-ipopen': x.id, 'aria-expanded': String(x.id === invPayOpen) }, x.id === invPayOpen ? 'Hide payments' : 'Payments'))));
      const list = invoices.length
        ? h('table', { class: 'phoneCards u-mt-6' }, h('thead', null, h('tr', null, h('th', null, 'Invoice'), h('th', null, 'Status'), h('th', { class: 'num-cell' }, 'Total'), h('th', { class: 'num-cell' }, 'Paid'), h('th', { class: 'num-cell' }, 'Still owed'), h('th', null, h('span', { class: 'srOnly' }, 'Action')))), h('tbody', null, rows))
        : h('p', { class: 'empty' }, 'No issued invoices yet. Payments can be recorded once an invoice is issued.');
      host.replaceChildren(wrap('stored',
        h('p', { class: 'hint u-mt-n2' }, 'Recorded payments from the database. Paid amounts and status follow the recorded payments; a payment entered in error is reversed with a reason, never edited or deleted.'),
        h('p', { class: 'u-fs-12 u-mt-4', role: 'status', 'data-ipmessage': '1' }, invPayMessage),
        list,
        open ? invPayDetail(open, pays) : null));
    }
    function invPayDetail(inv, pays) {
      const canPay = inv.status === 'issued' || inv.status === 'partially_paid';
      let history;
      if (!pays || !pays.ok) history = h('p', { class: 'hint' }, pays ? pays.message : 'Payments could not be read.');
      else if (!pays.payments.length) history = h('p', { class: 'empty' }, 'No payments recorded yet.');
      else history = h('table', { class: 'phoneCards u-mt-6', 'data-iphistory': String(pays.payments.length) },
        h('thead', null, h('tr', null, h('th', null, 'Received'), h('th', { class: 'num-cell' }, 'Amount'), h('th', null, 'How'), h('th', null, 'Reference'), h('th', null, 'Recorded'), h('th', null, h('span', { class: 'srOnly' }, 'Action')))),
        h('tbody', null, pays.payments.map(p => h('tr', { 'data-ippayment': p.id, 'data-ipreversed': String(p.reversed) },
          h('td', null, p.receivedOn || '—'),
          h('td', { class: 'num-cell' }, p.reversed ? h('s', null, fmtMoney(p.amount, 'USD')) : fmtMoney(p.amount, 'USD')),
          h('td', null, p.method ? (IP_METHOD[p.method] || p.method) : '—'),
          h('td', null, p.reference || '—', p.note ? h('div', { class: 'u-fs-12 u-c-muted' }, p.note) : null),
          h('td', null, 'by ' + ipWho(p.recordedBy) + (p.recordedAt ? ' · ' + fmtDate(p.recordedAt) : ''),
            p.reversed ? h('div', { class: 'u-fs-12 taskTitle' }, 'Reversed by ' + ipWho(p.reversal.recordedBy) + ': ' + (p.reversal.reason || '')) : null),
          h('td', null, p.reversed ? null : (invPayReverse === p.id
            ? h('form', { 'data-ipreverseform': p.id, class: 'heForm u-mt-4', novalidate: '' },
                h('div', { class: 'heField' }, h('label', { for: 'ipReason-' + p.id }, 'Why reverse it? (required)'),
                  h('input', { id: 'ipReason-' + p.id, name: 'reason', type: 'text', maxlength: '500', autocomplete: 'off' })),
                h('div', { class: 'u-mt-4' }, h('button', { type: 'submit', class: 'small deny' }, 'Reverse payment'), ' ', h('button', { type: 'button', class: 'small secondary', 'data-ipreversecancel': p.id }, 'Cancel')))
            : h('button', { type: 'button', class: 'small secondary', 'data-ipreverse': p.id }, 'Reverse')))))));
      const today = localDateString(new Date());
      const field = (id, label, input) => h('div', { class: 'heField' }, h('label', { for: id }, label), input);
      const form = canPay ? h('form', { 'data-ippayform': inv.id, class: 'heForm u-mt-12 u-pt-16 u-bt-1-solid-line', novalidate: '' },
        h('h4', null, 'Record a payment'),
        h('p', { class: 'hint' }, 'Still owed: ' + ipMoney(inv.balance) + '. A payment cannot be more than that.'),
        field('ipAmount', 'Amount received ($)', h('input', { id: 'ipAmount', name: 'amount', type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: '0.00' })),
        field('ipDate', 'Date received', h('input', { id: 'ipDate', name: 'receivedOn', type: 'date', value: today, max: today })),
        field('ipMethod', 'How it was paid', h('select', { id: 'ipMethod', name: 'method' }, h('option', { value: '' }, 'Not recorded'), Object.keys(IP_METHOD).map(k => h('option', { value: k }, IP_METHOD[k])))),
        field('ipRef', 'Reference (check number or transfer reference, optional)', h('input', { id: 'ipRef', name: 'reference', type: 'text', maxlength: '120', autocomplete: 'off' })),
        field('ipNote', 'Note (optional)', h('input', { id: 'ipNote', name: 'note', type: 'text', maxlength: '500', autocomplete: 'off' })),
        h('div', { class: 'u-mt-8' }, h('button', { type: 'submit' }, 'Record payment')))
        : h('p', { class: 'hint u-mt-8' }, inv.status === 'paid' ? 'Paid in full. Reverse a payment above if one was entered in error.' : 'This invoice is void; payments cannot be recorded against it.');
      return h('div', { class: 'u-mt-8', 'data-ipdetail': inv.id, tabindex: '-1' },
        h('h4', null, 'Payments on ' + (inv.number || 'this invoice')),
        history, form);
    }
    async function invPayAfter(res, okText, focusSel) {
      invPayMessage = res.ok ? (res.message || okText) : res.message;
      announce(invPayMessage);
      if (res.ok) { await loadInvoicePayments(); const el = focusSel && document.querySelector(focusSel); if (el) el.focus(); }
      else { const m = document.querySelector('#invoicePaymentsHost [data-ipmessage]'); if (m) m.textContent = invPayMessage; }
    }
    document.addEventListener('click', async (e) => {
      const t = e.target.closest('#invoicePaymentsHost [data-ipopen], #invoicePaymentsHost [data-ipreverse], #invoicePaymentsHost [data-ipreversecancel]'); if (!t) return;
      if (t.hasAttribute('data-ipopen')) {
        const id = t.getAttribute('data-ipopen'); invPayOpen = invPayOpen === id ? null : id; invPayReverse = null; invPayMessage = '';
        await loadInvoicePayments();
        const d = invPayOpen && document.querySelector('#invoicePaymentsHost [data-ipdetail]');
        if (d) d.focus(); else refocusLike(t, 'invoicePaymentsHost');
        return;
      }
      if (t.hasAttribute('data-ipreverse')) { invPayReverse = t.getAttribute('data-ipreverse'); await loadInvoicePayments(); const i = document.getElementById('ipReason-' + invPayReverse); if (i) i.focus(); return; }
      invPayReverse = null; await loadInvoicePayments(); refocusLike(t, 'invoicePaymentsHost');
    });
    document.addEventListener('submit', async (e) => {
      const f = e.target.closest('#invoicePaymentsHost form[data-ippayform], #invoicePaymentsHost form[data-ipreverseform]'); if (!f) return;
      e.preventDefault();
      const L = invPayLast; if (!L || !L.store) return;
      const btn = f.querySelector('button[type="submit"]');
      if (btn && btn.disabled) return;
      if (!f.dataset.ipKey) f.dataset.ipKey = newRequestKey();
      const v = (n) => { const el = f.elements[n]; return el ? el.value : ''; };
      if (btn) btn.disabled = true;
      let res;
      try {
        if (f.hasAttribute('data-ippayform')) {
          const inv = L.invoices.find(x => x.id === f.getAttribute('data-ippayform'));
          res = await L.store.recordPayment({ requestKey: f.dataset.ipKey, invoiceId: f.getAttribute('data-ippayform'), amount: v('amount'), receivedOn: v('receivedOn'), method: v('method'), reference: v('reference'), note: v('note'), balance: inv ? inv.balance : null });
        } else {
          res = await L.store.reversePayment({ requestKey: f.dataset.ipKey, paymentId: f.getAttribute('data-ipreverseform'), reason: v('reason') });
          if (res.ok) invPayReverse = null;
        }
      } finally { if (btn && document.contains(btn)) btn.disabled = false; }
      if (res.ok) delete f.dataset.ipKey;
      await invPayAfter(res, 'Saved.', '#invoicePaymentsHost [data-ipmessage]');
    });

    // ---------- Money matching (Nov 22; behind moneyMatchOn)
    // Does the money show up in the bank, once and in full? The owner chooses a
    // Chase checking or Wells Fargo card export (CSV); the file is READ IN THIS
    // BROWSER ONLY and never sent anywhere. Card purchases are matched to the
    // expenses recorded in the dashboard (read-only); deposits to Shopify payouts
    // and wholesale payments once those are connected (until then every deposit
    // is listed as not explained, and the page says why). The example uses
    // made-up data. Nothing is saved or changed. OFF by default.
    let mmState = { mode: 'example', bank: null, card: null, bankName: '', cardName: '', expenses: null, note: '' };
    let mmSeq = 0;
    let mmItems = [];
    function mmLastItems() { return mmItems.filter(it => it.needsLook); }
    const MM_WORD = { MATCHED: 'Matched', PENDING: 'Not due yet', MISSING: 'Missing', AMOUNT_DIFFERS: 'Amount differs', DOUBLED: 'Twice', UNEXPECTED: 'Not explained', NOT_RECORDED: 'Not recorded', UNKNOWN: 'Unclear' };
    const MM_KIND = { shopify_payout: 'Shopify payout', ach: 'Wholesale payment (ACH)', wire: 'Wholesale payment (wire)', check: 'Wholesale payment (check)', cash: 'Cash', other: 'Payment', refund: 'Refund paid out', bank: 'Bank', card: 'Card purchase' };
    function mmMod() { try { return (window.HE && window.HE.reports && window.HE.reports['he-money-match']) || null; } catch (e) { return null; } }
    const mmCents = c => c == null ? '—' : fmtMoney(c / 100, 'USD');
    function mmTable(title, res, key) {
      if (!res) return null;
      const sorted = res.items.slice().sort((a, b) => (b.needsLook - a.needsLook) || String(a.date || '').localeCompare(String(b.date || '')));
      return h('div', { class: 'u-mt-12', 'data-mmgroup': key },
        h('h4', null, title + ' — ' + res.headline),
        res.items.length ? h('table', { class: 'phoneCards u-mt-6' },
          h('thead', null, h('tr', null, h('th', null, 'Status'), h('th', null, 'Date'), h('th', null, 'What'), h('th', { class: 'num-cell' }, 'Expected'), h('th', { class: 'num-cell' }, 'Found'), h('th', null, 'Why'))),
          h('tbody', null, sorted.map(it => h('tr', { 'data-mmoutcome': it.outcome, 'data-mmlook': String(it.needsLook) },
            h('td', null, h('span', { class: 'badge ' + (it.needsLook ? 'sev-high' : it.outcome === 'PENDING' ? 'sev-medium' : 'sev-low') }, MM_WORD[it.outcome] || it.outcome)),
            h('td', { class: 'u-ws-nowrap' }, it.date || '—'),
            h('td', null, h('div', { class: 'taskTitle' }, MM_KIND[it.kind] || it.kind), h('div', { class: 'u-fs-12 u-c-muted' }, [it.ref, it.label && !(it.ref && it.label.includes(it.ref)) ? it.label : ''].filter(Boolean).join(' · ').slice(0, 120) || '—')),
            h('td', { class: 'num-cell' }, mmCents(it.expected)),
            h('td', { class: 'num-cell' }, mmCents(it.found)),
            h('td', null, it.why)))))
          : h('p', { class: 'empty' }, 'Nothing to compare.'));
    }
    async function loadMoneyMatch() {
      const host = document.getElementById('moneyMatchHost'); if (!host) return;
      if (!(typeof moneyMatchOn === 'function' && moneyMatchOn())) { host.replaceChildren(); return; }
      const eng = mmMod();
      if (!eng) { host.replaceChildren(h('p', { class: 'empty' }, 'Money matching could not load.')); return; }
      const seq = ++mmSeq;
      let payoutCheck = null, deposits = null, cardCheck = null, needsLook = 0, notes = [];
      if (mmState.mode === 'example') {
        const x = eng.example();
        payoutCheck = x.payoutCheck; deposits = x.deposits; cardCheck = x.cardCheck; needsLook = x.needsLook;
      } else {
        if (mmState.bank) {
          // Shopify payouts and stored wholesale payments are not connected yet
          deposits = eng.matchDeposits([], mmState.bank.rows, { statementTo: mmState.bank.to });
          notes.push('Shopify payouts and wholesale payments are not connected yet, so every deposit is listed as not explained. That changes once the Shopify feed and invoice storage are approved and installed.');
        }
        if (mmState.card) {
          if (!mmState.expenses) {
            const from = mmState.card.from, to = mmState.card.to;
            const rows = await fetchAllRows('expenses', 'id, amount, expense_date, vendor, deleted_at', q => q.is('deleted_at', null).gte('expense_date', from).lte('expense_date', to)).catch(e => ({ error: e }));
            if (seq !== mmSeq) return;
            if (Array.isArray(rows)) mmState.expenses = rows.map(r => ({ id: r.id, date: r.expense_date, amountCents: eng.toCents(r.amount), vendor: r.vendor }));
            else if (rows && Array.isArray(rows.data)) mmState.expenses = rows.data.map(r => ({ id: r.id, date: r.expense_date, amountCents: eng.toCents(r.amount), vendor: r.vendor }));
            else { mmState.expenses = []; notes.push('The recorded expenses could not be read, so every card purchase is listed as not recorded. Refresh and try again.'); }
          }
          cardCheck = eng.matchCard(mmState.expenses, mmState.card.rows);
        }
        needsLook = (deposits ? deposits.needsLook : 0) + (cardCheck ? cardCheck.needsLook : 0);
      }
      if (seq !== mmSeq) return;
      mmItems = mmState.mode === 'file' ? [].concat(deposits ? deposits.items : [], cardCheck ? cardCheck.items : []) : [];
      const canSave = mmState.mode === 'file' && mmItems.some(it => it.needsLook) && typeof moneyIssuesOn === 'function' && moneyIssuesOn() && (currentUserRole === 'owner' || currentUserRole === 'administrator');
      const fileInfo = (label, p, name) => p ? h('li', null, label + ': ' + name + ' — ' + (p.layout === 'chase_checking' ? 'Chase checking' : p.layout === 'wells_fargo' ? 'Wells Fargo' : 'statement') + ', ' + p.rows.length + ' lines, ' + p.from + ' to ' + p.to + (p.problems.length ? '; ' + p.problems.length + ' line(s) could not be read (lines ' + p.problems.slice(0, 5).map(x => x.line).join(', ') + ')' : '')) : null;
      host.replaceChildren(h('div', { class: 'moneyMatch u-mb-16', 'data-mmmode': mmState.mode, 'data-mmneedslook': String(needsLook) },
        h('div', { class: 'scanHead' }, h('h3', null, 'Money matching'),
          h('span', { class: 'scanBadge' }, mmState.mode === 'example' ? 'SIMULATED — example data' : 'YOUR FILE — read in this browser only, not saved')),
        h('p', { class: 'hint u-mt-6' }, 'Checks that every Shopify payout and wholesale payment arrived in the bank once and in full, that refunds went out, and that every card purchase is recorded as an expense. Nothing is changed.'),
        h('div', { class: 'heForm u-mt-8' },
          h('div', { class: 'heField' }, h('label', { for: 'mmBank' }, 'Chase checking export (CSV)'), h('input', { id: 'mmBank', type: 'file', accept: '.csv,text/csv', 'data-mmfile': 'bank' })),
          h('div', { class: 'heField' }, h('label', { for: 'mmCard' }, 'Wells Fargo card export (CSV)'), h('input', { id: 'mmCard', type: 'file', accept: '.csv,text/csv', 'data-mmfile': 'card' })),
          h('div', { class: 'scanToggleRow' },
            h('button', { type: 'button', class: 'small' + (mmState.mode === 'example' ? '' : ' secondary'), 'data-mm': 'example', 'aria-pressed': String(mmState.mode === 'example') }, 'Show the example'),
            mmState.mode === 'file' ? h('button', { type: 'button', class: 'small secondary', 'data-mm': 'clear' }, 'Forget my files') : null)),
        h('p', { class: 'u-fs-12 u-mt-4', role: 'status', 'data-mmmessage': '1' }, mmState.note || ''),
        mmState.mode === 'file' ? h('ul', { class: 'u-fs-12 u-c-muted' }, fileInfo('Bank', mmState.bank, mmState.bankName), fileInfo('Card', mmState.card, mmState.cardName)) : null,
        h('p', { class: 'u-mt-8 taskTitle', 'data-mmheadline': '1' }, needsLook ? needsLook + ' difference' + (needsLook === 1 ? '' : 's') + ' to look at' : 'Everything matched'),
        canSave ? h('button', { type: 'button', class: 'small', 'data-misave': '1' }, 'Save these differences for follow-up') : null,
        notes.map(n => h('p', { class: 'hint' }, n)),
        mmTable('Shopify payouts against their own sales and fees', payoutCheck, 'payouts'),
        mmTable('Deposits and refunds in the bank', deposits, 'deposits'),
        mmTable('Card purchases against recorded expenses', cardCheck, 'card')));
    }
    document.addEventListener('change', (e) => {
      const inp = e.target.closest('#moneyMatchHost input[data-mmfile]'); if (!inp) return;
      const which = inp.getAttribute('data-mmfile'); const file = inp.files && inp.files[0]; if (!file) return;
      const eng = mmMod(); if (!eng) return;
      const say = (msg) => { mmState.note = msg; const m = document.querySelector('#moneyMatchHost [data-mmmessage]'); if (m) m.textContent = msg; announce(msg); };
      if (file.size > eng.MAX_BYTES) { say('That file is larger than 5 MB; export a shorter period.'); inp.value = ''; return; }
      const fr = new FileReader();
      fr.onerror = () => say('The file could not be read.');
      fr.onload = async () => {
        const p = eng.parseStatement(String(fr.result || ''));
        if (!p.ok) { say(file.name + ': ' + p.reason); inp.value = ''; return; }
        if (mmState.mode !== 'file') mmState = { mode: 'file', bank: null, card: null, bankName: '', cardName: '', expenses: null, note: '' };
        if (which === 'bank') { mmState.bank = p; mmState.bankName = file.name.slice(0, 80); }
        else { mmState.card = p; mmState.cardName = file.name.slice(0, 80); mmState.expenses = null; }
        mmState.note = file.name + ' read: ' + p.rows.length + ' lines. Nothing was uploaded.';
        await loadMoneyMatch();
        announce(mmState.note);
        const back = document.getElementById(which === 'bank' ? 'mmBank' : 'mmCard'); if (back) back.focus();
      };
      fr.readAsText(file);
    });
    document.addEventListener('click', async (e) => {
      const t = e.target.closest('#moneyMatchHost [data-mm]'); if (!t) return;
      mmState = { mode: 'example', bank: null, card: null, bankName: '', cardName: '', expenses: null, note: t.getAttribute('data-mm') === 'clear' ? 'Your files were forgotten. Showing the example.' : '' };
      await loadMoneyMatch();
      announce(mmState.note || 'Showing the example.');
      refocusLike(t, 'moneyMatchHost');
    });

    // ---------- Saved money differences (drafts/42, Nov 22; behind moneyIssuesOn)
    // Open differences, found by the daily Shopify check or saved from Money
    // matching, stay listed on Accounting until the owner or an administrator marks
    // each one checked with a note; Home shows how many are open. Does nothing
    // until drafts/42 is installed. Owner and administrators only.
    let miSeq = 0, miMessage = '', miCheckOpen = null;
    function miStore() {
      let mod = null; try { mod = (window.HE && window.HE.reports && window.HE.reports['he-money-issues-store']) || null; } catch (e) { mod = null; }
      if (!mod || !(typeof moneyIssuesOn === 'function' && moneyIssuesOn())) return null;
      if (currentUserRole !== 'owner' && currentUserRole !== 'administrator') return null;
      return mod.createStore({ client: supabase, enabled: true, role: currentUserRole });
    }
    async function loadMoneyAlert() {
      const host = document.getElementById('moneyAlertHost'); if (!host) return;
      const store = miStore(); if (!store) { host.replaceChildren(); return; }
      const L = await store.listOpen();
      if (!L.ok || !L.issues.length) { host.replaceChildren(); return; }     // nothing open, or not installed: Home stays as it is
      const n = L.issues.length;
      host.replaceChildren(h('div', { class: 'attnRow u-mt-12', 'data-moneyalert': String(n), role: 'status' },
        h('span', { class: 'badge sev-high' }, 'Money'),
        h('span', { class: 'taskTitle' }, n + (L.truncated ? '+' : '') + ' money difference' + (n === 1 ? '' : 's') + ' to look at'),
        ' ', h('button', { type: 'button', class: 'small', 'data-goto': 'accountingPanel', 'data-moneyalertopen': '1' }, 'Review on Accounting')));
    }
    async function loadMoneyIssues() {
      const host = document.getElementById('moneyIssuesHost'); if (!host) return;
      const store = miStore(); if (!store) { host.replaceChildren(); return; }
      const seq = ++miSeq;
      const L = await store.listOpen(); if (seq !== miSeq) return;
      const wrap = (...kids) => h('div', { class: 'moneyIssues u-mb-16', 'data-mimode': L.ok ? 'stored' : 'unavailable' }, h('h3', { class: 'u-fs-13 u-c-navy u-m-18-0-6' }, 'Money differences to look at'), ...kids);
      if (!L.ok) { host.replaceChildren(wrap(h('p', { class: 'hint', 'data-minote': '1' }, L.message))); return; }
      const rows = L.issues.map(x => h('tr', { 'data-miissue': x.id, 'data-misource': x.source },
        h('td', { class: 'u-ws-nowrap' }, x.occurred_on || String(x.created_at || '').slice(0, 10)),
        h('td', null, h('div', null, x.summary), h('div', { class: 'u-fs-12 u-c-muted' }, x.source === 'shopify_payout' ? 'Found by the daily Shopify check' : x.source === 'card' ? 'Saved from a card file' : 'Saved from a bank file')),
        h('td', { class: 'num-cell' }, x.expected == null ? '—' : fmtMoney(Number(x.expected), 'USD')),
        h('td', { class: 'num-cell' }, x.found == null ? '—' : fmtMoney(Number(x.found), 'USD')),
        h('td', null, miCheckOpen === x.id
          ? h('form', { 'data-micheckform': x.id, class: 'heForm', novalidate: '' },
              h('div', { class: 'heField' }, h('label', { for: 'miNote-' + x.id }, 'What did you find? (required)'), h('input', { id: 'miNote-' + x.id, name: 'note', type: 'text', maxlength: '500', autocomplete: 'off' })),
              h('div', { class: 'u-mt-4' }, h('button', { type: 'submit', class: 'small' }, 'Mark checked'), ' ', h('button', { type: 'button', class: 'small secondary', 'data-micheckcancel': x.id }, 'Cancel')))
          : h('button', { type: 'button', class: 'small secondary', 'data-micheck': x.id }, 'Mark checked'))));
      host.replaceChildren(wrap(
        h('p', { class: 'hint u-mt-n2' }, 'Each difference stays here until you or an administrator mark it checked with a note. Nothing is deleted.'),
        h('p', { class: 'u-fs-12 u-mt-4', role: 'status', 'data-mimessage': '1' }, miMessage),
        rows.length ? h('table', { class: 'phoneCards u-mt-6', 'data-micount': String(rows.length) },
          h('thead', null, h('tr', null, h('th', null, 'Date'), h('th', null, 'Difference'), h('th', { class: 'num-cell' }, 'Expected'), h('th', { class: 'num-cell' }, 'Found'), h('th', null, h('span', { class: 'srOnly' }, 'Action')))),
          h('tbody', null, rows))
          : h('p', { class: 'empty', 'data-micount': '0' }, 'No open differences.')));
    }
    async function miAfter(res) {
      miMessage = res.message || ''; announce(miMessage);
      if (res.ok) { await loadMoneyIssues(); await loadMoneyAlert(); const m = document.querySelector('#moneyIssuesHost [data-mimessage]'); if (m) { m.setAttribute('tabindex', '-1'); m.focus(); } }
      else { const m = document.querySelector('#moneyIssuesHost [data-mimessage]'); if (m) m.textContent = miMessage; }
    }
    document.addEventListener('click', async (e) => {
      const go = e.target.closest('#moneyAlertHost [data-moneyalertopen]');
      if (go) { showPage('accountingPanel'); return; }
      const t = e.target.closest('#moneyIssuesHost [data-micheck], #moneyIssuesHost [data-micheckcancel], #moneyMatchHost [data-misave]'); if (!t) return;
      if (t.hasAttribute('data-misave')) {
        const store = miStore(); const items = mmLastItems();
        if (!store || !items.length) return;
        t.disabled = true;
        const res = await store.save(items);
        t.disabled = false;
        await miAfter(res);
        const m = document.querySelector('#moneyMatchHost [data-mmmessage]'); if (m) m.textContent = res.message;
        return;
      }
      miCheckOpen = t.hasAttribute('data-micheck') ? t.getAttribute('data-micheck') : null; miMessage = '';
      await loadMoneyIssues();
      const i = miCheckOpen && document.getElementById('miNote-' + miCheckOpen); if (i) i.focus(); else refocusLike(t, 'moneyIssuesHost');
    });
    document.addEventListener('submit', async (e) => {
      const f = e.target.closest('#moneyIssuesHost form[data-micheckform]'); if (!f) return;
      e.preventDefault();
      const store = miStore(); if (!store) return;
      const btn = f.querySelector('button[type="submit"]'); if (btn && btn.disabled) return;
      if (btn) btn.disabled = true;
      let res; try { res = await store.markChecked(f.getAttribute('data-micheckform'), f.elements.note ? f.elements.note.value : ''); } finally { if (btn && document.contains(btn)) btn.disabled = false; }
      if (res.ok) miCheckOpen = null;
      await miAfter(res);
    });

    // ---------- Deliveries with partial receiving (drafts/40, Nov 22; behind receivingStoreOn)
    // The owner's rules of Nov 22 on real records: staff record what arrived on
    // a purchase order line by line (good, damaged that we keep, rejected with a
    // reason, surplus beyond what was ordered); it waits for the owner, who
    // approves (stock changes now, and only now) or rejects; surplus waits for
    // the owner's keep-or-return. One request key per form, so a second press or a
    // retry after a lost reply records once. Does nothing until drafts/40 is
    // installed; staff see purchase orders only with drafts/44.
    let dlvSeq = 0, dlvLast = null, dlvMessage = '', dlvPo = '', dlvRejectOpen = null;
    function dlvStore() {
      let mod = null; try { mod = (window.HE && window.HE.inventory && window.HE.inventory['he-receiving-store']) || null; } catch (e) { mod = null; }
      if (!mod || !(typeof receivingStoreOn === 'function' && receivingStoreOn())) return null;
      return mod.createStore({ client: supabase, enabled: true, role: currentUserRole });
    }
    function dlvWho(id) { const L = dlvLast; return !id ? 'someone' : (L && L.myId && id === L.myId) ? 'you' : 'a team member'; }
    function dlvLineText(l, items) {
      const it = items[l.po_item_id]; const name = it ? (it.sku || it.description || 'item') : 'item';
      const parts = [];
      if (l.good) parts.push(l.good + ' good'); if (l.damaged) parts.push(l.damaged + ' damaged, kept');
      if (l.rejected) parts.push(l.rejected + ' rejected (' + (l.rejected_reason || '') + ')'); if (l.surplus) parts.push(l.surplus + ' surplus');
      return name + ': ' + parts.join(', ');
    }
    async function loadDeliveries() {
      const host = document.getElementById('deliveriesHost'); if (!host) return;
      const store = dlvStore(); if (!store) { host.replaceChildren(); return; }
      const seq = ++dlvSeq;
      const wrap = (mode, ...kids) => h('div', { class: 'deliveries u-mb-16', 'data-dlvmode': mode }, h('h3', { class: 'u-fs-13 u-c-navy u-m-18-0-6' }, 'Deliveries'), ...kids);
      const pr = await store.probe(); if (seq !== dlvSeq) return;
      if (!pr.ok) { host.replaceChildren(wrap('unavailable', h('p', { class: 'hint', 'data-dlvnote': '1' }, pr.message))); return; }
      const L = await store.load(); if (seq !== dlvSeq) return;
      if (!L.ok) { host.replaceChildren(wrap('unavailable', h('p', { class: 'hint', 'data-dlvnote': '1' }, L.message))); return; }
      const myId = await currentUserId().catch(() => null); if (seq !== dlvSeq) return;
      dlvLast = { store, data: L, myId };
      const isOwner = currentUserRole === 'owner';
      const items = {}; L.orders.forEach(o => o.lines.forEach(l => { items[l.id] = Object.assign({ po: o.number }, l); }));
      const poNum = id => { const o = L.orders.find(x => x.id === id); return o ? o.number : 'a purchase order'; };
      const waitingRows = L.waiting.filter(r => isOwner || r.submitted_by === myId).map(r => h('li', { 'data-dlvrecord': r.id, class: 'u-mt-6' },
        h('div', { class: 'taskTitle' }, poNum(r.purchase_order_id) + ' — recorded by ' + dlvWho(r.submitted_by) + ' on ' + String(r.submitted_at || '').slice(0, 10)),
        h('div', { class: 'u-fs-12' }, r.lines.map(l => dlvLineText(l, items)).join('; ') + (r.note ? ' — ' + r.note : '')),
        h('div', { class: 'u-mt-4' },
          isOwner ? h('button', { type: 'button', class: 'small approve', 'data-dlvact': 'approve', 'data-id': r.id }, 'Approve') : null, ' ',
          isOwner ? h('button', { type: 'button', class: 'small secondary', 'data-dlvact': 'reject-open', 'data-id': r.id }, 'Reject') : null, ' ',
          (r.submitted_by === myId || isOwner) ? h('button', { type: 'button', class: 'small secondary', 'data-dlvact': 'cancel', 'data-id': r.id }, 'Cancel') : null),
        dlvRejectOpen === r.id ? h('form', { 'data-dlvrejectform': r.id, class: 'heForm u-mt-4', novalidate: '' },
          h('div', { class: 'heField' }, h('label', { for: 'dlvWhy-' + r.id }, 'Why reject it? (required)'), h('input', { id: 'dlvWhy-' + r.id, name: 'reason', type: 'text', maxlength: '500', autocomplete: 'off' })),
          h('button', { type: 'submit', class: 'small deny u-mt-4' }, 'Reject delivery record')) : null));
      const surplusRows = isOwner ? L.surplusWaiting.map(l => h('li', { 'data-dlvsurplus': l.id, class: 'u-mt-6' },
        h('span', null, (items[l.po_item_id] ? items[l.po_item_id].po + ' · ' + (items[l.po_item_id].sku || 'item') : 'A line') + ': ' + l.surplus + ' unit(s) more than ordered '),
        h('button', { type: 'button', class: 'small', 'data-dlvact': 'keep', 'data-id': l.id }, 'Keep (into stock)'), ' ',
        h('button', { type: 'button', class: 'small secondary', 'data-dlvact': 'return', 'data-id': l.id }, 'Send back'))) : [];
      const open = L.orders.filter(o => o.status !== 'received' || o.lines.some(l => l.toCome > 0));
      if (dlvPo && !open.some(o => o.id === dlvPo)) dlvPo = '';
      const chosen = open.find(o => o.id === dlvPo) || null;
      const num = (id, label) => h('div', { class: 'heField' }, h('label', { for: id }, label), h('input', { id, name: id, type: 'text', inputmode: 'numeric', pattern: '[0-9]*', autocomplete: 'off', placeholder: '0' }));
      const form = h('form', { 'data-dlvform': '1', class: 'heForm u-mt-12 u-pt-16 u-bt-1-solid-line', novalidate: '' },
        h('h4', null, 'Record a delivery'),
        h('div', { class: 'heField' }, h('label', { for: 'dlvPo' }, 'Purchase order'),
          h('select', { id: 'dlvPo', name: 'po' }, h('option', { value: '' }, open.length ? 'Choose…' : 'No open purchase orders'), open.map(o => h('option', Object.assign({ value: o.id }, o.id === dlvPo ? { selected: 'selected' } : {}), o.number)))),
        chosen ? chosen.lines.map(l => h('fieldset', { class: 'u-mt-8', 'data-dlvline': l.id },
          h('legend', null, (l.sku || l.description || 'Item') + ' — ordered ' + l.ordered + ', received ' + l.received + ', still to come ' + l.toCome),
          num('dlvGood-' + l.id, 'Good'), num('dlvDamaged-' + l.id, 'Damaged, kept'), num('dlvRejected-' + l.id, 'Rejected'),
          h('div', { class: 'heField' }, h('label', { for: 'dlvReason-' + l.id }, 'Why rejected'), h('input', { id: 'dlvReason-' + l.id, type: 'text', maxlength: '300', autocomplete: 'off' })),
          num('dlvSurplus-' + l.id, 'More than ordered'))) : null,
        chosen ? h('div', { class: 'heField' }, h('label', { for: 'dlvNote' }, 'Note (optional)'), h('input', { id: 'dlvNote', type: 'text', maxlength: '500', autocomplete: 'off' })) : null,
        chosen ? h('button', { type: 'submit', class: 'u-mt-8' }, 'Record delivery') : null);
      host.replaceChildren(wrap('stored',
        h('p', { class: 'hint u-mt-n2' }, 'Record what arrived, line by line. Stock changes only when the owner approves. Rejected units stay to come; units beyond the order wait for the owner.'),
        h('p', { class: 'u-fs-12 u-mt-4', role: 'status', 'data-dlvmessage': '1' }, dlvMessage),
        h('h4', null, isOwner ? 'Waiting for your approval (' + L.waiting.length + ')' : 'Your deliveries waiting for the owner'),
        waitingRows.length ? h('ul', { 'data-dlvwaiting': String(waitingRows.length) }, waitingRows) : h('p', { class: 'empty', 'data-dlvwaiting': '0' }, 'Nothing waiting.'),
        surplusRows.length ? h('div', null, h('h4', { class: 'u-mt-8' }, 'More than ordered: keep or send back?'), h('ul', null, surplusRows)) : null,
        form));
    }
    async function dlvAfter(res, focusSel) {
      dlvMessage = res.message || ''; announce(dlvMessage);
      const m = document.querySelector('#deliveriesHost [data-dlvmessage]');
      if (!res.ok) { if (m) m.textContent = dlvMessage; return; }
      await loadDeliveries(); if (typeof loadPurchaseOrders === 'function' && res.status === 'approved') loadPurchaseOrders();
      const f = (focusSel && document.querySelector(focusSel)) || document.querySelector('#deliveriesHost [data-dlvmessage]');
      if (f) { if (!f.hasAttribute('tabindex') && f.tagName === 'P') f.setAttribute('tabindex', '-1'); f.focus(); }
    }
    document.addEventListener('change', async (e) => {
      const s = e.target.closest('#deliveriesHost select#dlvPo'); if (!s) return;
      dlvPo = s.value; dlvMessage = '';
      await loadDeliveries();
      const back = document.getElementById('dlvPo'); if (back) back.focus();
    });
    document.addEventListener('click', async (e) => {
      const t = e.target.closest('#deliveriesHost [data-dlvact]'); if (!t) return;
      const L = dlvLast; if (!L) return;
      const id = t.getAttribute('data-id'), act = t.getAttribute('data-dlvact');
      if (act === 'reject-open') { dlvRejectOpen = dlvRejectOpen === id ? null : id; await loadDeliveries(); const i = document.getElementById('dlvWhy-' + id); if (i) i.focus(); return; }
      t.disabled = true;
      const res = act === 'approve' ? await L.store.approve(id) : act === 'cancel' ? await L.store.cancel(id)
        : await L.store.decideSurplus(id, act === 'keep' ? 'kept' : 'returned');
      if (document.contains(t)) t.disabled = false;
      if (act === 'approve' && res.ok) res.status = 'approved';
      await dlvAfter(res);
    });
    document.addEventListener('submit', async (e) => {
      const f = e.target.closest('#deliveriesHost form[data-dlvform], #deliveriesHost form[data-dlvrejectform]'); if (!f) return;
      e.preventDefault();
      const L = dlvLast; if (!L) return;
      const btn = f.querySelector('button[type="submit"]'); if (btn && btn.disabled) return;
      if (btn) btn.disabled = true;
      let res;
      try {
        if (f.hasAttribute('data-dlvrejectform')) {
          res = await L.store.reject(f.getAttribute('data-dlvrejectform'), f.elements.reason ? f.elements.reason.value : '');
          if (res.ok) dlvRejectOpen = null;
        } else {
          if (!f.dataset.dlvKey) f.dataset.dlvKey = newRequestKey();
          const o = L.data.orders.find(x => x.id === dlvPo);
          const val = id => { const el = document.getElementById(id); return el ? el.value : ''; };
          const toCome = {}; const lines = (o ? o.lines : []).map(l => { toCome[l.id] = l.toCome; return { poItemId: l.id, good: val('dlvGood-' + l.id), damaged: val('dlvDamaged-' + l.id), rejected: val('dlvRejected-' + l.id), rejectedReason: val('dlvReason-' + l.id), surplus: val('dlvSurplus-' + l.id) }; });
          res = await L.store.submit({ requestKey: f.dataset.dlvKey, poId: dlvPo, lines, note: val('dlvNote'), toCome });
          if (res.ok) { delete f.dataset.dlvKey; dlvPo = ''; }
        }
      } finally { if (btn && document.contains(btn)) btn.disabled = false; }
      await dlvAfter(res);
    });

    // ---------- Returns and corrections (drafts/40, Nov 23; behind receivingStoreOn)
    // The rest of the owner's Nov 22 rules on real records. Customer returns:
    // staff record what came back; it waits "awaiting inspection" (not for sale)
    // until the owner inspects it; opened or used skincare is never restocked.
    // Returns to a supplier: staff record them, the owner approves (stock goes
    // down then); "replacement expected" puts the units back on the order.
    // Corrections: the owner reverses a wrong stock movement with a reason, as a
    // new linked movement; nothing is edited or deleted. One request key per form.
    let rtnSeq = 0, rtnLast = null, rtnMessage = '', rtnOpen = null;
    async function loadStockReturns() {
      const host = document.getElementById('stockReturnsHost'); if (!host) return;
      const store = dlvStore(); if (!store) { host.replaceChildren(); return; }
      const seq = ++rtnSeq;
      const wrap = (mode, ...kids) => h('div', { class: 'stockReturns u-mb-16', 'data-rtnmode': mode }, h('h3', { class: 'u-fs-13 u-c-navy u-m-20-0-6' }, 'Returns to check and send back'), ...kids);
      const L = await store.loadReturns(); if (seq !== rtnSeq) return;
      if (!L.ok) { host.replaceChildren(wrap('unavailable', h('p', { class: 'hint', 'data-rtnnote': '1' }, L.message))); return; }
      const myId = await currentUserId().catch(() => null); if (seq !== rtnSeq) return;
      rtnLast = { store, data: L, myId };
      const isOwner = currentUserRole === 'owner', seesMoves = isOwner || currentUserRole === 'administrator';
      const who = id => !id ? 'someone' : (myId && id === myId) ? 'you' : 'a team member';
      const day = v => String(v || '').slice(0, 10);
      const oLine = {}; L.orderLines.forEach(l => { oLine[l.id] = l; });
      const pLine = {}; L.poLines.forEach(l => { pLine[l.id] = l; });
      const num = (id, label) => h('div', { class: 'heField' }, h('label', { for: id }, label), h('input', { id, name: id, type: 'text', inputmode: 'numeric', pattern: '[0-9]*', autocomplete: 'off', placeholder: '0' }));
      const yesNo = (id, label) => h('div', { class: 'heField' }, h('label', { for: id }, label),
        h('select', { id, name: id }, h('option', { value: '' }, 'Choose…'), h('option', { value: 'no' }, 'No'), h('option', { value: 'yes' }, 'Yes')));
      const text = (id, label, max) => h('div', { class: 'heField' }, h('label', { for: id }, label), h('input', { id, name: id, type: 'text', maxlength: String(max || 300), autocomplete: 'off' }));

      // customer returns
      const crRows = L.customerWaiting.map(c => {
        const l = oLine[c.order_item_id];
        return h('li', { 'data-rtncr': c.id, class: 'u-mt-6' },
          h('div', { class: 'taskTitle' }, (l ? l.order + ' · ' + (l.sku || l.name || 'item') : 'An order line') + ': ' + c.quantity + ' unit(s) awaiting inspection'),
          h('div', { class: 'u-fs-12' }, 'Recorded by ' + who(c.received_by) + ' on ' + day(c.received_at) + '. Not for sale until inspected.'),
          (isOwner || c.received_by === myId) ? h('div', { class: 'u-mt-4' },
            isOwner ? h('button', { type: 'button', class: 'small', 'data-rtnact': 'inspect-open', 'data-id': c.id, 'aria-expanded': String(rtnOpen === 'inspect:' + c.id) }, 'Inspect') : null, ' ',
            h('button', { type: 'button', class: 'small secondary', 'data-rtnact': 'cr-cancel', 'data-id': c.id }, 'Cancel (recorded by mistake)')) : null,
          isOwner && rtnOpen === 'inspect:' + c.id ? h('form', { 'data-rtnform': 'inspect', 'data-id': c.id, class: 'heForm u-mt-4', novalidate: '' },
            yesNo('rtnOpened-' + c.id, 'Was it opened?'), yesNo('rtnUsed-' + c.id, 'Was it used?'),
            num('rtnRestock-' + c.id, 'Back on the shelf (sealed only)'), num('rtnDamaged-' + c.id, 'Damaged'), num('rtnUnsuitable-' + c.id, 'Unsuitable (opened or used, never resold)'),
            text('rtnInspNote-' + c.id, 'Note (optional)', 500),
            h('p', { class: 'heField heWide hint' }, 'Every unit needs one outcome: ' + c.quantity + ' in total.'),
            h('div', { class: 'heActions' }, h('button', { type: 'submit', class: 'small' }, 'Save inspection'))) : null);
      });
      const crOptions = L.orderLines.filter(l => l.canReturn > 0);
      const crForm = h('form', { 'data-rtnform': 'cr', class: 'heForm u-mt-8', novalidate: '' },
        h('div', { class: 'heField heWide' }, h('label', { for: 'rtnCrLine' }, 'Order line'),
          h('select', { id: 'rtnCrLine', name: 'line' }, h('option', { value: '' }, crOptions.length ? 'Choose…' : 'No order lines that can come back'),
            crOptions.map(l => h('option', { value: l.id }, l.order + ' · ' + (l.sku || l.name || 'item') + ' — sold ' + l.sold + ', can come back ' + l.canReturn)))),
        num('rtnCrQty', 'Units that came back'),
        h('div', { class: 'heActions' }, h('button', { type: 'submit', class: 'small' }, 'Record (awaiting inspection)')));

      // returns to a supplier
      const srRows = L.supplierWaiting.filter(x => isOwner || x.submitted_by === myId).map(x => {
        const l = pLine[x.po_item_id];
        return h('li', { 'data-rtnsr': x.id, class: 'u-mt-6' },
          h('div', { class: 'taskTitle' }, (l ? l.po + ' · ' + (l.sku || l.description || 'item') : 'A purchase-order line') + ': ' + x.quantity + ' unit(s) from ' + (x.from_bucket === 'damaged' ? 'Damaged' : 'Available')),
          h('div', { class: 'u-fs-12' }, x.reason + (x.replacement_expected ? ' · replacement expected' : '') + ' · recorded by ' + who(x.submitted_by) + ' on ' + day(x.submitted_at)),
          h('div', { class: 'u-mt-4' },
            isOwner ? h('button', { type: 'button', class: 'small approve', 'data-rtnact': 'sr-approve', 'data-id': x.id }, 'Approve') : null, ' ',
            isOwner ? h('button', { type: 'button', class: 'small secondary', 'data-rtnact': 'sr-reject', 'data-id': x.id }, 'Reject') : null, ' ',
            (isOwner || x.submitted_by === myId) ? h('button', { type: 'button', class: 'small secondary', 'data-rtnact': 'sr-cancel', 'data-id': x.id }, 'Cancel (recorded by mistake)') : null));
      });
      const srForm = h('form', { 'data-rtnform': 'sr', class: 'heForm u-mt-8', novalidate: '' },
        h('div', { class: 'heField heWide' }, h('label', { for: 'rtnSrLine' }, 'Purchase-order line'),
          h('select', { id: 'rtnSrLine', name: 'line' }, h('option', { value: '' }, L.poLines.length ? 'Choose…' : 'Nothing received yet'),
            L.poLines.map(l => h('option', { value: l.id }, l.po + ' · ' + (l.sku || l.description || 'item') + ' — received ' + l.received)))),
        num('rtnSrQty', 'Units going back'),
        h('div', { class: 'heField' }, h('label', { for: 'rtnSrFrom' }, 'Taken from'),
          h('select', { id: 'rtnSrFrom', name: 'from' }, h('option', { value: '' }, 'Choose…'), h('option', { value: 'available' }, 'Available stock'), h('option', { value: 'damaged' }, 'Damaged stock'))),
        h('div', { class: 'heField heWide' }, h('label', { for: 'rtnSrReason' }, 'Why they go back (required)'), h('input', { id: 'rtnSrReason', name: 'rtnSrReason', type: 'text', maxlength: '300', autocomplete: 'off' })),
        h('div', { class: 'heField heWide' }, h('label', { class: 'u-d-flex u-ai-center u-gap-8 u-fw-400' }, h('input', { type: 'checkbox', id: 'rtnSrRepl', name: 'repl', class: 'u-w-auto u-m-0' }), 'The supplier sends replacements (the units are expected again)')),
        h('div', { class: 'heActions' }, h('button', { type: 'submit', class: 'small' }, 'Record return to supplier')));

      // stock movements and corrections
      const moveRows = seesMoves ? L.movements.map(m => h('li', { 'data-rtnmove': String(m.id), class: 'u-mt-6' },
        h('div', null, h('span', { class: 'u-ws-nowrap' }, day(m.at)), ' · ', m.product + ' · ' + (m.bucket === 'damaged' ? 'Damaged' : 'Available') + ' ',
          h('b', null, (m.change > 0 ? '+' : '') + m.change), ' · ' + m.reason,
          m.corrected ? h('span', { class: 'badge u-ml-6' }, 'corrected') : null),
        isOwner && !m.corrected && !m.isCorrection ? h('button', { type: 'button', class: 'small secondary u-mt-4', 'data-rtnact': 'fix-open', 'data-id': String(m.id), 'aria-expanded': String(rtnOpen === 'fix:' + m.id) }, 'Correct') : null,
        isOwner && rtnOpen === 'fix:' + m.id ? h('form', { 'data-rtnform': 'fix', 'data-id': String(m.id), class: 'heForm u-mt-4', novalidate: '' },
          h('div', { class: 'heField heWide' }, h('label', { for: 'rtnFixWhy-' + m.id }, 'Why is it wrong? (required)'), h('input', { id: 'rtnFixWhy-' + m.id, name: 'reason', type: 'text', maxlength: '300', autocomplete: 'off' })),
          h('p', { class: 'heField heWide hint' }, 'A new movement of ' + (-m.change > 0 ? '+' : '') + (-m.change) + ' is added and linked to this one. Nothing is deleted.'),
          h('div', { class: 'heActions' }, h('button', { type: 'submit', class: 'small deny' }, 'Correct this movement'))) : null)) : [];

      host.replaceChildren(wrap('stored',
        h('p', { class: 'hint u-mt-n2' }, 'Returned skincare waits for inspection before anything goes back on the shelf. Units sent back to a supplier and corrections change stock only when the owner approves.'),
        h('p', { class: 'u-fs-12 u-mt-4', role: 'status', 'data-rtnmessage': '1' }, rtnMessage),
        h('h4', null, 'Customer returns awaiting inspection (' + L.customerWaiting.length + ')'),
        crRows.length ? h('ul', { 'data-rtncrwaiting': String(crRows.length) }, crRows) : h('p', { class: 'empty', 'data-rtncrwaiting': '0' }, 'Nothing awaiting inspection.'),
        h('h4', { class: 'u-mt-12' }, 'Record a customer return'), crForm,
        h('h4', { class: 'u-mt-12' }, isOwner ? 'Returns to suppliers waiting for your approval (' + L.supplierWaiting.length + ')' : 'Your returns to suppliers waiting for the owner'),
        srRows.length ? h('ul', { 'data-rtnsrwaiting': String(srRows.length) }, srRows) : h('p', { class: 'empty', 'data-rtnsrwaiting': '0' }, 'Nothing waiting.'),
        h('h4', { class: 'u-mt-12' }, 'Send units back to a supplier'), srForm,
        seesMoves ? h('h4', { class: 'u-mt-12' }, 'Latest stock movements') : null,
        seesMoves ? (moveRows.length ? h('ul', { 'data-rtnmoves': String(moveRows.length) }, moveRows) : h('p', { class: 'empty', 'data-rtnmoves': '0' }, 'No stock movements yet.')) : null));
    }
    async function rtnAfter(res, focusSel) {
      rtnMessage = res.message || ''; announce(rtnMessage);
      const m = document.querySelector('#stockReturnsHost [data-rtnmessage]');
      if (!res.ok) { if (m) m.textContent = rtnMessage; return; }
      await loadStockReturns();
      const f = (focusSel && document.querySelector(focusSel)) || document.querySelector('#stockReturnsHost [data-rtnmessage]');
      if (f) { if (!f.hasAttribute('tabindex') && f.tagName === 'P') f.setAttribute('tabindex', '-1'); f.focus(); }
    }
    document.addEventListener('click', async (e) => {
      const t = e.target.closest('#stockReturnsHost [data-rtnact]'); if (!t) return;
      const L = rtnLast; if (!L) return;
      const id = t.getAttribute('data-id'), act = t.getAttribute('data-rtnact');
      if (act === 'inspect-open' || act === 'fix-open') {
        const key = (act === 'inspect-open' ? 'inspect:' : 'fix:') + id;
        rtnOpen = rtnOpen === key ? null : key; rtnMessage = '';
        await loadStockReturns();
        const first = document.querySelector('#stockReturnsHost form[data-rtnform][data-id="' + id + '"] select, #stockReturnsHost form[data-rtnform][data-id="' + id + '"] input');
        if (first) first.focus();
        return;
      }
      t.disabled = true;
      const res = act === 'sr-cancel' ? await L.store.cancelSupplierReturn(id) : act === 'cr-cancel' ? await L.store.cancelCustomerReturn(id)
        : await L.store.decideSupplierReturn(id, act === 'sr-approve' ? 'approved' : 'rejected');
      if (document.contains(t)) t.disabled = false;
      await rtnAfter(res);
    });
    document.addEventListener('submit', async (e) => {
      const f = e.target.closest('#stockReturnsHost form[data-rtnform]'); if (!f) return;
      e.preventDefault();
      const L = rtnLast; if (!L) return;
      const btn = f.querySelector('button[type="submit"]'); if (btn && btn.disabled) return;
      if (btn) btn.disabled = true;
      const kind = f.getAttribute('data-rtnform'), id = f.getAttribute('data-id');
      const val = x => { const el = document.getElementById(x); return el ? el.value : ''; };
      const yn = x => { const v = val(x); return v === 'yes' ? true : v === 'no' ? false : null; };
      if (!f.dataset.rtnKey) f.dataset.rtnKey = newRequestKey();
      let res;
      try {
        if (kind === 'cr') res = await L.store.recordCustomerReturn({ requestKey: f.dataset.rtnKey, orderItemId: val('rtnCrLine'), quantity: val('rtnCrQty') });
        else if (kind === 'sr') res = await L.store.submitSupplierReturn({ requestKey: f.dataset.rtnKey, poItemId: val('rtnSrLine'), quantity: val('rtnSrQty'), fromBucket: val('rtnSrFrom'), reason: val('rtnSrReason'), replacementExpected: !!(document.getElementById('rtnSrRepl') || {}).checked });
        else if (kind === 'inspect') res = await L.store.decideCustomerReturn(id, { opened: yn('rtnOpened-' + id), used: yn('rtnUsed-' + id), restock: val('rtnRestock-' + id), damaged: val('rtnDamaged-' + id), unsuitable: val('rtnUnsuitable-' + id), note: val('rtnInspNote-' + id) });
        else if (kind === 'fix') res = await L.store.correctMovement({ requestKey: f.dataset.rtnKey, movementId: Number(id), reason: val('rtnFixWhy-' + id) });
        else res = { ok: false, message: '' };
        if (res.ok) { delete f.dataset.rtnKey; if (kind === 'inspect' || kind === 'fix') rtnOpen = null; }
      } finally { if (btn && document.contains(btn)) btn.disabled = false; }
      await rtnAfter(res);
    });

    // ---------- Backups & Printouts (owner request, Nov 23; behind backupsPageOn)
    // One place for the paper and file copies the owner keeps: the daily recaps
    // (print a month on Letter, or save it as a spreadsheet file), the manuals
    // (what to do if the dashboard is down, how the dashboard works, the owner's
    // own procedures, the printer setup), and an honest note on the database
    // backups, which run outside the dashboard and which it cannot see. Reads
    // only; every printout is black on white.
    let bkReports = null, bkSops = null, bkMonth = '', bkMessage = '', bkSeq = 0;
    const BK_DOWN = [
      'Orders keep arriving in Shopify while the dashboard is down. Nothing is lost.',
      'Orders: work from Shopify admin (Orders). Shipping labels print from Shopify as usual.',
      'Stock changes: write each one on the log at the bottom of this page (date, product, change, reason, who). Enter them in the dashboard when it is back.',
      'Deliveries and returns: keep the paperwork together in one tray. Record them when the dashboard is back.',
      'Money: the dashboard never moves money. Shopify payouts reach the bank as usual.',
      'Try again in another browser, in a Private Window, or with Cmd+Shift+R. If it is still down after an hour, send a screenshot to whoever maintains the dashboard.',
    ];
    const BK_PRINTING = [
      'Brother MFC-J1365DW (US Letter): invoices, packing slips, recaps and manuals. Paper Letter, scale 100%. Every printout is black only.',
      'Rollo label printer (4 × 6 in): shipping labels from Shopify and the 4×6 packing slip. Paper size 4 × 6 (or 100 × 150 mm), margins None, scale 100%.',
      'Test pages: Orders page → Packing slips → "Test page" for each printer. The frame must show on all four sides and the square must measure 1 inch.',
      'If something is cut off: margins None, scale 100%, then print again.',
    ];
    const bkMonthOf = r => String(r.report_date || '').slice(0, 7);
    const bkMonthName = m => { const d = new Date(m + '-01T12:00:00'); return isNaN(d) ? m : d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); };
    const bkNum = v => (v == null || v === '' || !isFinite(Number(v))) ? '—' : String(Number(v));
    async function loadBackupsPage() {
      const host = document.getElementById('backupsPanel'); if (!host) return;
      if (!(typeof backupsPageOn === 'function' && backupsPageOn())) { host.replaceChildren(); return; }
      const seq = ++bkSeq;
      if (bkReports === null) host.replaceChildren(h('h2', null, 'Backups & Printouts'), h('p', { class: 'empty' }, 'Loading…'));
      const [rep, sop] = await Promise.all([
        supabase.from('daily_reports').select('*').order('report_date', { ascending: false }).limit(366).then(r => r, e => ({ error: e })),
        supabase.from('sop_documents').select('id, title, category, content, updated_at').order('title', { ascending: true }).then(r => r, e => ({ error: e })),
      ]);
      if (seq !== bkSeq) return;
      bkReports = rep && !rep.error && Array.isArray(rep.data) ? rep.data : false;
      bkSops = sop && !sop.error && Array.isArray(sop.data) ? sop.data : false;
      renderBackupsPage();
    }
    function bkMonthRows() { return (bkReports || []).filter(r => bkMonthOf(r) === bkMonth).sort((a, b) => String(a.report_date).localeCompare(String(b.report_date))); }
    function renderBackupsPage() {
      const host = document.getElementById('backupsPanel'); if (!host) return;
      const months = [...new Set((bkReports || []).map(bkMonthOf).filter(m => /^\d{4}-\d{2}$/.test(m)))].sort().reverse();
      if (!months.includes(bkMonth)) bkMonth = months[0] || '';
      const rows = bkMonthRows();
      const recaps = bkReports === false
        ? h('p', { class: 'hint', 'data-bknote': 'recaps' }, 'The daily recaps could not be read. Refresh the page and try again.')
        : !months.length ? h('p', { class: 'empty', 'data-bknote': 'recaps' }, 'No daily recaps saved yet. The first one appears the morning after a working day.')
        : h('div', null,
          h('div', { class: 'u-d-flex u-gap-8 u-fwr-wrap u-ai-flex-end u-mt-8' },
            h('div', { class: 'heField' }, h('label', { for: 'bkMonth' }, 'Month'),
              h('select', { id: 'bkMonth' }, months.map(m => h('option', Object.assign({ value: m }, m === bkMonth ? { selected: 'selected' } : {}), bkMonthName(m))))),
            h('button', { type: 'button', class: 'small', 'data-bk': 'print-recaps' }, 'Print this month'),
            h('button', { type: 'button', class: 'small secondary', 'data-bk': 'csv-recaps' }, 'Save this month as a spreadsheet (CSV)')),
          h('div', { class: 'u-mt-8' }, h('table', { 'data-bkrecaps': String(rows.length) },
            h('thead', null, h('tr', null, h('th', null, 'Date'), h('th', { class: 'num-cell' }, 'Orders'), h('th', { class: 'num-cell' }, 'Revenue'), h('th', { class: 'num-cell' }, 'New questions'), h('th', { class: 'num-cell' }, 'AI cost'))),
            h('tbody', null, rows.map(r => h('tr', null, h('td', { class: 'u-ws-nowrap' }, String(r.report_date).slice(0, 10)), h('td', { class: 'num-cell' }, bkNum(r.orders_count)),
              h('td', { class: 'num-cell' }, r.revenue == null ? '—' : fmtMoney(r.revenue, r.currency || 'USD')), h('td', { class: 'num-cell' }, bkNum(r.new_inquiries_count)),
              h('td', { class: 'num-cell' }, r.ai_cost == null ? '—' : fmtMoney(r.ai_cost, 'USD'))))))));
      const sopCount = Array.isArray(bkSops) ? bkSops.length : 0;
      const manual = (key, title, what, disabled) => h('li', { class: 'u-mt-6', 'data-bkmanualrow': key },
        h('div', { class: 'taskTitle' }, title), h('div', { class: 'u-fs-12 u-c-muted' }, what),
        h('button', Object.assign({ type: 'button', class: 'small secondary u-mt-4', 'data-bkmanual': key, 'aria-label': 'Print: ' + title }, disabled ? { disabled: '' } : {}), 'Print'));
      host.replaceChildren(
        h('h2', null, 'Backups & Printouts'),
        h('p', { class: 'hint' }, 'Paper and file copies to keep in your business folder: the daily recaps and the manuals. Everything here only reads; nothing is changed. Printouts are black only, on US Letter.'),
        h('p', { class: 'u-fs-12', role: 'status', 'data-bkmessage': '1' }, bkMessage),
        h('h3', null, 'Daily recaps'),
        h('p', { class: 'hint u-mt-n2' }, 'The nightly summary of each day: orders, revenue, new customer questions and AI cost. Print a month for the folder, and save the spreadsheet to your computer and one more place (for example iCloud Drive).'),
        recaps,
        h('h3', null, 'Manuals to print'),
        h('ul', null,
          manual('down', 'If the dashboard is down', 'What to do by hand, with a paper log for stock changes.'),
          manual('help', 'How the dashboard works', HELP.length + ' short guides: returns, inventory, activity, rules and more.'),
          manual('sops', 'Your procedures', bkSops === false ? 'Your procedures could not be read. Refresh the page.' : sopCount ? sopCount + ' procedure' + (sopCount === 1 ? '' : 's') + ' from the Procedures page.' : 'No procedures written yet (Admin → Procedures).', !sopCount),
          manual('printing', 'Printer setup', 'Settings for the Brother and the Rollo, and how to check them.'),
          manual('all', 'All manuals together', 'Each manual starts on a new page.')),
        h('h3', null, 'Database backups'),
        h('p', { class: 'hint' }, 'The database backups run outside the dashboard, so this page cannot see whether the last one worked. It says UNKNOWN, as on Business Continuity, instead of a tick it cannot prove. Check the backups as in your owner checklist.'),
        h('button', { type: 'button', class: 'small secondary', 'data-bkgoto': 'continuityPanel' }, 'Open Business Continuity'));
    }
    function bkPrintDoc(pages) {
      const host = document.getElementById('invoicePrintHost'); if (!host) return;
      setLabelSheet(false);
      host.replaceChildren(h('div', { class: 'printDoc' }, pages));
      try { window.print(); } catch (e) {}
    }
    const bkPrinted = () => 'Printed ' + localDateString();
    function bkManualPage(key) {
      const page = (title, ...kids) => h('div', { class: 'printPage', 'data-printmanual': key }, h('div', { class: 'printHdr' }, h('div', { class: 'taskTitle' }, 'Health Endeavors — ' + title), h('div', null, bkPrinted())), ...kids);
      if (key === 'down') return page('If the dashboard is down',
        h('ol', null, BK_DOWN.map(t => h('li', null, t))),
        h('div', { class: 'printLabel u-mt-8' }, 'Stock change log'),
        h('table', null, h('thead', null, h('tr', null, ['Date', 'Product', 'Change', 'Reason', 'Who'].map(x => h('th', null, x)))),
          h('tbody', null, Array.from({ length: 14 }, () => h('tr', null, [0, 1, 2, 3, 4].map(() => h('td', null, ' ')))))));
      if (key === 'help') return page('How the dashboard works', HELP.map(g => h('div', { class: 'u-mt-8' }, h('div', { class: 'printLabel' }, g.title),
        String(g.body || '').split('|').map(p => h('p', null, p)))));
      if (key === 'sops') return page('Your procedures', (bkSops || []).map(s => h('div', { class: 'u-mt-8' }, h('div', { class: 'printLabel' }, s.title + (s.category ? ' (' + s.category + ')' : '')),
        String(s.content || '').split(/\n+/).map(p => h('p', null, p)))));
      if (key === 'printing') return page('Printer setup', h('ul', null, BK_PRINTING.map(t => h('li', null, t))));
      return null;
    }
    document.addEventListener('change', (e) => {
      const s = e.target.closest('#backupsPanel select#bkMonth'); if (!s) return;
      bkMonth = s.value; bkMessage = ''; renderBackupsPage();
      const back = document.getElementById('bkMonth'); if (back) back.focus();
    });
    document.addEventListener('click', (e) => {
      const g = e.target.closest('#backupsPanel [data-bkgoto]');
      if (g) { showPage(g.getAttribute('data-bkgoto')); return; }
      const m = e.target.closest('#backupsPanel [data-bkmanual]');
      if (m) {
        const key = m.getAttribute('data-bkmanual');
        const keys = key === 'all' ? ['down', 'help'].concat(Array.isArray(bkSops) && bkSops.length ? ['sops'] : []).concat(['printing']) : [key];
        bkPrintDoc(keys.map(bkManualPage).filter(Boolean));
        return;
      }
      const t = e.target.closest('#backupsPanel [data-bk]'); if (!t) return;
      const rows = bkMonthRows();
      if (!rows.length) { bkMessage = 'There are no recaps for that month.'; announce(bkMessage); renderBackupsPage(); return; }
      if (t.getAttribute('data-bk') === 'print-recaps') {
        const sum = k => rows.reduce((a, r) => a + (isFinite(Number(r[k])) ? Number(r[k]) : 0), 0);
        bkPrintDoc([h('div', { class: 'printPage', 'data-printrecaps': bkMonth },
          h('div', { class: 'printHdr' }, h('div', { class: 'taskTitle' }, 'Health Endeavors — Daily recaps, ' + bkMonthName(bkMonth)), h('div', null, bkPrinted())),
          h('table', null,
            h('thead', null, h('tr', null, ['Date', 'Orders', 'Revenue', 'New questions', 'Tasks opened', 'Incidents', 'AI calls', 'AI cost'].map(x => h('th', null, x)))),
            h('tbody', null, rows.map(r => h('tr', null, h('td', null, String(r.report_date).slice(0, 10)), h('td', null, bkNum(r.orders_count)), h('td', null, r.revenue == null ? '—' : fmtMoney(r.revenue, r.currency || 'USD')),
              h('td', null, bkNum(r.new_inquiries_count)), h('td', null, bkNum(r.tasks_opened_count)), h('td', null, bkNum(r.incidents_opened_count)), h('td', null, bkNum(r.ai_calls_count)), h('td', null, r.ai_cost == null ? '—' : fmtMoney(r.ai_cost, 'USD')))))),
          h('div', { class: 'printTotals', 'data-printtotal': 'month' }, 'Month: ' + rows.length + ' day(s) · orders ' + sum('orders_count') + ' · revenue ' + fmtMoney(sum('revenue'), (rows[0] && rows[0].currency) || 'USD') + (rows.some(r => r.revenue == null) ? ' (some days have no revenue figure)' : '')))]);
        return;
      }
      const head = ['Date', 'Orders', 'Revenue', 'Currency', 'New questions', 'Tasks opened', 'Incidents opened', 'AI calls', 'AI cost (USD)'];
      const lines = [head].concat(rows.map(r => [String(r.report_date).slice(0, 10), r.orders_count, r.revenue, r.currency || 'USD', r.new_inquiries_count, r.tasks_opened_count, r.incidents_opened_count, r.ai_calls_count, r.ai_cost]));
      const csv = lines.map(l => l.map(v => csvCell(v == null ? '' : v)).join(',')).join('\r\n');
      try {
        const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
        const a = document.createElement('a'); a.href = url; a.download = 'daily-recaps-' + bkMonth + '.csv';
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        bkMessage = 'Saved daily-recaps-' + bkMonth + '.csv (' + rows.length + ' day' + (rows.length === 1 ? '' : 's') + ').';
      } catch (err) { bkMessage = 'The file could not be saved in this browser.'; }
      announce(bkMessage);
      const msg = document.querySelector('#backupsPanel [data-bkmessage]'); if (msg) msg.textContent = bkMessage;
    });

    // ---------- #08 Payment reconciliation review (behind reconcileOn)
    // A worked synthetic example on Accounting: invoices that should have been
    // paid vs payments recorded. Every difference is named and stays OPEN until
    // an owner/administrator closes it with a written note. ADVISORY — no money
    // is moved, no invoice or payment is changed, and closing a difference never
    // alters a figure. OFF by default (host renders empty, Accounting unchanged).
    let reconcileResult = null;
    let reconcileMessage = '';
    const RECONCILE_WORDS = { MATCHED: 'matched', UNDERPAID: 'short', OVERPAID: 'over', MISSING: 'nothing recorded', UNEXPECTED: 'not expected', DUPLICATE: 'listed twice', CURRENCY_MISMATCH: 'other currency', UNKNOWN_AMOUNT: 'amount unknown' };
    function reconcileMod() { try { return (window.HE && window.HE.reports && window.HE.reports['he-reconcile']) || null; } catch (e) { return null; } }
    function loadReconcile() {
      const host = document.getElementById('reconcileHost'); if (!host) return;
      if (!(typeof reconcileOn === 'function' && reconcileOn())) { host.replaceChildren(); return; }
      const eng = reconcileMod();
      if (!eng) { host.replaceChildren(h('p', { class: 'empty' }, 'Reconciliation tools could not load.')); return; }
      if (!reconcileResult) { const fx = eng.fixtures(); reconcileResult = eng.reconcile(fx.expected, fx.recorded); }
      const r = reconcileResult; const st = eng.status(r);
      const amt = v => v == null ? '?' : fmtMoney(v, 'USD');
      // An empty figure means two different things: "nothing was expected here"
      // (a dash) or "the amount is not known" (the word), never a bare "?".
      const cell = (it, v) => v != null ? fmtMoney(v, 'USD') : ((it.outcome === 'UNEXPECTED' || it.outcome === 'DUPLICATE') ? '—' : 'unknown');
      const rows = r.items.map(it => h('tr', { 'data-outcome': it.outcome, 'data-review': it.reviewState },
        h('td', null, h('div', { class: 'taskTitle' }, it.ref || '(no reference)'), h('div', { class: 'u-fs-11 u-c-muted' }, it.detail)),
        h('td', null, RECONCILE_WORDS[it.outcome] || it.outcome),
        h('td', { class: 'num-cell' }, cell(it, it.expected)),
        h('td', { class: 'num-cell' }, cell(it, it.recorded)),
        h('td', { class: 'num-cell' }, cell(it, it.difference)),
        h('td', null, it.reviewState === 'NOT_NEEDED' ? '—'
          : it.reviewState === 'REVIEWED' ? h('div', null, 'Reviewed by ' + it.review.by, h('div', { class: 'u-fs-11 u-c-muted' }, it.review.note))
            : h('button', { type: 'button', class: 'small secondary', 'data-reconcile': 'review', 'data-line': String(it.line), 'aria-label': 'Mark line ' + it.line + ' (' + (it.ref || 'no reference') + ') reviewed' }, 'Mark reviewed'))));
      const stateWord = st.state === 'BALANCED' ? 'Balanced' : st.state === 'NEEDS_REVIEW' ? 'Needs review — ' + st.open + ' open' : 'Closed with differences (reviewed, still not balanced)';
      host.replaceChildren(h('div', { class: 'reconcileReview u-mb-16' },
        h('div', { class: 'scanHead' }, h('h3', null, 'Payment reconciliation'), h('span', { class: 'scanBadge' }, 'SIMULATED — example data, no money is moved')),
        h('p', { class: 'hint u-mt-6', 'data-reconcile-state': st.state }, 'Status: ' + stateWord + ' · expected ' + amt(r.totals.expected) + ' · recorded ' + amt(r.totals.recorded) + ' · difference ' + amt(r.totals.difference) + (r.totals.complete ? '' : ' (incomplete — some amounts unknown)')),
        h('div', { class: 'heField heWide u-mt-8' },
          h('label', { for: 'reconcileNote' }, 'Review note ', h('span', { class: 'heOpt' }, '(required to close a difference)')),
          h('input', { type: 'text', id: 'reconcileNote', maxlength: '500', placeholder: 'e.g. Customer confirmed the balance arrives Friday' })),
        reconcileMessage ? h('p', { class: 'hint u-mt-6', 'data-reconcile-msg': '1' }, reconcileMessage) : null,
        h('table', { class: 'phoneCards u-mt-8' },
          h('thead', null, h('tr', null, h('th', null, 'Invoice'), h('th', null, 'Result'), h('th', { class: 'num-cell' }, 'Expected'), h('th', { class: 'num-cell' }, 'Recorded'), h('th', { class: 'num-cell' }, 'Difference'), h('th', null, 'Review'))),
          h('tbody', null, rows)),
        h('div', { class: 'scanToggleRow u-mt-8' }, h('button', { type: 'button', class: 'small secondary', 'data-reconcile': 'reset' }, 'Reset example')),
        h('p', { class: 'hint u-mt-8' }, 'Closing a difference records who looked and why; it never changes an amount. ' + r.guard)));
    }
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-reconcile]'); if (!t) return;
      const act = t.getAttribute('data-reconcile'); const eng = reconcileMod(); if (!eng) return;
      if (act === 'reset') { reconcileResult = null; reconcileMessage = ''; loadReconcile(); return; }
      if (act === 'review' && reconcileResult) {
        const noteEl = document.getElementById('reconcileNote');
        const out = eng.markReviewed(reconcileResult, Number(t.getAttribute('data-line')), { role: currentUserRole, by: String(currentUserRole || 'unknown') + ' (example)', at: new Date().toISOString(), note: noteEl ? noteEl.value : '' });
        if (out.ok) { reconcileResult = out.result; reconcileMessage = 'Recorded. The figures are unchanged.'; }
        else reconcileMessage = 'Not recorded: ' + out.reason + '.';
        loadReconcile(); announce(reconcileMessage); refocusLike(t);
      }
    });

    // ---------- Preview switches (Feature Flags page; owner / administrator)
    // On/off buttons for the preview features, so reviewing them needs no typed
    // commands. A switch is a note in THIS browser only: it is not saved to the
    // database, does not affect anyone else, and only ever reveals a preview that
    // uses example data or is read-only. Only keys listed in PREVIEW_SWITCHES can
    // be written. Shown to the owner and administrators; empty for everyone else.
    let previewSwitchMessage = '';
    function previewSwitchIsOn(key) { try { return localStorage.getItem(key) === 'on'; } catch (e) { return false; } }
    function loadPreviewSwitches() {
      const host = document.getElementById('previewSwitchesHost'); if (!host) return;
      if (!(currentUserRole === 'owner' || currentUserRole === 'administrator') || !Array.isArray(PREVIEW_SWITCHES)) { host.replaceChildren(); return; }
      const onCount = PREVIEW_SWITCHES.filter(sw => previewSwitchIsOn(sw.key)).length;
      const rows = PREVIEW_SWITCHES.map(sw => {
        const on = previewSwitchIsOn(sw.key);
        return h('tr', { 'data-preview-key': sw.key, 'data-preview-on': on ? 'yes' : 'no' },
          h('td', null, h('div', { class: 'taskTitle' }, sw.name), h('div', { class: 'u-fs-11 u-c-muted' }, sw.what)),
          h('td', null, sw.where),
          h('td', null, on ? 'On' : 'Off'),
          h('td', null, h('button', { type: 'button', class: 'small' + (on ? ' secondary' : ''), 'data-previewswitch': 'toggle', 'data-key': sw.key, 'aria-label': (on ? 'Turn off ' : 'Turn on ') + sw.name }, on ? 'Turn off' : 'Turn on')));
      });
      host.replaceChildren(h('div', { class: 'previewSwitches u-mt-18' },
        h('h3', { class: 'u-m-18-0-6 u-fs-15' }, 'Preview features'),
        h('p', { class: 'hint u-mt-0' }, 'For looking at features that are built but not switched on. A switch here applies to this browser on this device only — it is not saved to the database and nobody else sees a change. Every preview uses example data or is read-only: nothing is sent, issued, charged or written to stock. All are off unless you turn them on.'),
        h('p', { class: 'hint u-mt-6', 'data-preview-count': String(onCount) }, onCount + ' of ' + PREVIEW_SWITCHES.length + ' on in this browser.'),
        previewSwitchMessage ? h('p', { class: 'hint u-mt-6', 'data-preview-msg': '1' }, previewSwitchMessage,
          ' ', h('button', { type: 'button', class: 'small secondary', 'data-previewswitch': 'reload' }, 'Reload now')) : null,
        h('table', { class: 'phoneCards u-mt-8' },
          h('thead', null, h('tr', null, h('th', null, 'Preview'), h('th', null, 'Where it appears'), h('th', null, 'Now'), h('th', null, 'Change'))),
          h('tbody', null, rows)),
        h('div', { class: 'scanToggleRow u-mt-8' }, h('button', { type: 'button', class: 'small secondary', 'data-previewswitch': 'alloff' }, 'Turn all off')),
        lookPicker()));
    }
    // New look (preview): pick one of the three directions; applied at once.
    function lookPicker() {
      if (!(typeof newLookOn === 'function' && newLookOn()) || !Array.isArray(LOOK_CHOICES)) return null;
      let cur = 'aurora'; try { cur = localStorage.getItem('he_look') || 'aurora'; } catch (e) { /* default */ }
      return h('div', { class: 'u-mt-12', 'data-lookpicker': cur },
        h('h4', null, 'Choose the look'),
        h('div', { class: 'scanToggleRow', role: 'group', 'aria-label': 'Look' },
          LOOK_CHOICES.map(c => h('button', { type: 'button', class: 'small' + (c.key === cur ? '' : ' secondary'), 'data-lookpick': c.key, 'aria-pressed': String(c.key === cur) }, c.name))),
        h('p', { class: 'hint u-mt-6' }, (LOOK_CHOICES.find(c => c.key === cur) || LOOK_CHOICES[0]).what));
    }
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-lookpick]'); if (!t) return;
      const c = (LOOK_CHOICES || []).find(x => x.key === t.getAttribute('data-lookpick')); if (!c) return;
      try { localStorage.setItem('he_look', c.key); } catch (err) { /* this browser only; still applied below */ }
      document.documentElement.setAttribute('data-look', c.key);
      loadPreviewSwitches(); announce('Look: ' + c.name + '. ' + c.what); refocusLike(t);
    });
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-previewswitch]'); if (!t) return;
      if (!(currentUserRole === 'owner' || currentUserRole === 'administrator')) return;
      const act = t.getAttribute('data-previewswitch');
      if (act === 'reload') { window.location.reload(); return; }
      try {
        if (act === 'alloff') {
          PREVIEW_SWITCHES.forEach(sw => localStorage.removeItem(sw.key));
          document.documentElement.removeAttribute('data-look');
          previewSwitchMessage = 'All previews are off. Reload the page to finish.';
        } else if (act === 'toggle') {
          const sw = PREVIEW_SWITCHES.find(x => x.key === t.getAttribute('data-key'));
          if (!sw) return;                                   // only listed keys are ever written
          if (previewSwitchIsOn(sw.key)) { localStorage.removeItem(sw.key); previewSwitchMessage = sw.name + ' is off. Reload the page to finish.'; }
          else { localStorage.setItem(sw.key, 'on'); previewSwitchMessage = sw.name + ' is on. Reload the page, then open ' + sw.where + '.'; }
          if (sw.key === 'he_new_look') {
            if (previewSwitchIsOn('he_new_look')) { let lk = 'aurora'; try { lk = localStorage.getItem('he_look') || 'aurora'; } catch (e2) { /* default */ } document.documentElement.setAttribute('data-look', lk); previewSwitchMessage = 'New look is on. Choose a direction below; it applies at once.'; }
            else { document.documentElement.removeAttribute('data-look'); previewSwitchMessage = 'New look is off: today\'s look is back.'; }
          }
        }
      } catch (err) { previewSwitchMessage = 'This browser would not save the switch (private window or storage blocked).'; }
      loadPreviewSwitches(); announce(previewSwitchMessage); refocusLike(t);
    });

    // ---------- #26 Operations watch (behind opsWatchOn)
    // Flags unusual daily figures, stock and orders for a person to look at.
    // Daily figures come from the saved nightly reports when there are any (read
    // only); stock and orders are example data until real feeds are approved.
    // ADVISORY — nothing is paused, changed or corrected. "Seen" records that a
    // person looked; it does not clear a flag. OFF by default (host renders
    // empty, Report History unchanged).
    let opsWatchItems = null;
    function opsWatchMod() { try { return (window.HE && window.HE.reports && window.HE.reports['he-ops-anomaly']) || null; } catch (e) { return null; } }
    function loadOpsWatch() {
      const host = document.getElementById('opsWatchHost'); if (!host) return;
      if (!(typeof opsWatchOn === 'function' && opsWatchOn())) { host.replaceChildren(); return; }
      const eng = opsWatchMod();
      if (!eng) { host.replaceChildren(h('p', { class: 'empty' }, 'Operations watch tools could not load.')); return; }
      const fx = eng.fixtures();
      const live = (typeof reportHistoryRows === 'function') ? reportHistoryRows() : [];
      const usingLive = Array.isArray(live) && live.length > 0;
      const res = eng.scan({ daily: usingLive ? live : fx.daily, stock: fx.stock, orders: fx.orders });
      opsWatchItems = eng.review(opsWatchItems || [], res.flags);
      const sum = eng.summary(opsWatchItems);
      const sevWord = { CRITICAL: 'Urgent', WARNING: 'Check', INFO: 'For information' };
      const rows = opsWatchItems.map(it => h('tr', { 'data-opswatch-kind': it.kind, 'data-opswatch-state': it.state },
        h('td', null, sevWord[it.severity] || it.severity),
        h('td', null, h('div', { class: 'taskTitle' }, it.detail), h('div', { class: 'u-fs-11 u-c-muted' }, it.nextAction)),
        h('td', null, it.state === 'RESOLVED' ? 'Cleared — ' + it.resolvedBecause
          : it.state === 'ACKNOWLEDGED' ? 'Seen by ' + it.acknowledged.by + ' (still present)'
            : h('button', { type: 'button', class: 'small secondary', 'data-opswatch': 'ack', 'data-key': it.key, 'aria-label': 'Mark as seen: ' + it.detail }, 'Mark as seen'))));
      host.replaceChildren(h('div', { class: 'opsWatch u-mb-16' },
        h('div', { class: 'scanHead' }, h('h3', null, 'Operations watch'), h('span', { class: 'scanBadge' }, 'SIMULATED — advisory, nothing is changed')),
        h('p', { class: 'hint u-mt-6', 'data-opswatch-summary': '1' }, sum.stillPresent + ' to look at (' + sum.open + ' not yet seen, ' + sum.acknowledged + ' seen) · ' + res.bySeverity.CRITICAL + ' urgent'),
        h('p', { class: 'hint u-mt-6', 'data-opswatch-source': usingLive ? 'saved' : 'demo' }, 'Daily figures: ' + (usingLive ? 'your saved reports (' + live.length + ' day' + (live.length === 1 ? '' : 's') + ')' : 'example data (no saved reports yet)') + '. Stock and orders: example data.'),
        rows.length ? h('table', { class: 'phoneCards u-mt-8' },
          h('thead', null, h('tr', null, h('th', null, 'Level'), h('th', null, 'What was noticed'), h('th', null, 'Review'))),
          h('tbody', null, rows)) : h('p', { class: 'empty' }, 'Nothing unusual found.'),
        h('div', { class: 'scanToggleRow u-mt-8' }, h('button', { type: 'button', class: 'small secondary', 'data-opswatch': 'reset' }, 'Reset example')),
        h('p', { class: 'hint u-mt-8' }, res.calibrationNote + ' Marking a flag as seen does not clear it; it clears only when a later check no longer finds it. ' + res.guard)));
    }
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-opswatch]'); if (!t) return;
      const act = t.getAttribute('data-opswatch'); const eng = opsWatchMod(); if (!eng) return;
      if (act === 'reset') { opsWatchItems = null; loadOpsWatch(); refocusLike(t, 'opsWatchHost'); return; }
      if (act === 'ack' && opsWatchItems) {
        const out = eng.acknowledge(opsWatchItems, t.getAttribute('data-key'), { by: String(currentUserRole || 'unknown') + ' (example)', at: new Date().toISOString() });
        if (out.ok) opsWatchItems = out.items;
        loadOpsWatch();
      }
      refocusLike(t, 'opsWatchHost');
    });

    // ---------- #12/#53 Supplier scorecard (behind supplierScorecardOn)
    // Read-only worked example on the Suppliers page: delivery accuracy from
    // purchase orders (a delivery with no recorded date is UNKNOWN, never counted
    // as on time) and required-document status (missing / expired / expiring).
    // Synthetic data; nothing is written and no supplier is contacted. OFF by
    // default (host renders empty, Suppliers unchanged).
    function loadSupplierScorecard() {
      const host = document.getElementById('supplierScorecardHost'); if (!host) return;
      if (!(typeof supplierScorecardOn === 'function' && supplierScorecardOn())) { host.replaceChildren(); return; }
      let eng = null; try { eng = (window.HE && window.HE.suppliers && window.HE.suppliers['he-supplier-scorecard']) || null; } catch (e) { eng = null; }
      if (!eng) { host.replaceChildren(h('p', { class: 'empty' }, 'Supplier scorecard tools could not load.')); return; }
      const fx = eng.fixtures();
      const sc = eng.scorecard(fx.supplier, fx.purchaseOrders, fx.documents, { asOfDate: fx.asOfDate });
      const d = sc.delivery;
      const docWord = { MISSING: 'missing', EXPIRED: 'expired', EXPIRING_SOON: 'expiring soon', VALID: 'valid', PRESENT_NO_EXPIRY: 'on file (no expiry date)' };
      const docRows = sc.documents.rows.map(r => h('tr', { 'data-docstatus': r.status },
        h('td', null, r.type),
        h('td', null, docWord[r.status] || r.status),
        h('td', null, r.expiresAt || '—'),
        h('td', { class: 'num-cell' }, r.daysLeft == null ? '—' : String(r.daysLeft))));
      host.replaceChildren(h('div', { class: 'supplierScorecard u-mb-16' },
        h('div', { class: 'scanHead' }, h('h3', null, 'Supplier scorecard'), h('span', { class: 'scanBadge' }, 'SIMULATED — example data, read-only')),
        h('div', { class: 'scanCard u-mt-8' },
          h('div', { class: 'taskTitle' }, sc.supplier.name),
          h('div', { class: 'scanCardRow', 'data-scorecard': 'delivery' }, 'Deliveries: ' + d.receivedPOs + ' received of ' + d.totalPOs + ' orders · on time ' + d.onTime + ' · late ' + d.late + ' · timing unknown ' + d.unknownTiming + ' · still open ' + d.open),
          h('div', { class: 'scanCardRow' }, 'On-time rate: ' + (d.onTimeRate == null ? 'UNKNOWN (no delivery has both dates)' : d.onTimeRate + '% of the ' + (d.onTime + d.late) + ' deliveries with both dates') + (d.avgDaysLate != null ? ' · average ' + d.avgDaysLate + ' days late when late' : '')),
          h('div', { class: 'scanCardRow', 'data-scorecard': 'attention' }, sc.needsAttention ? 'Needs attention: ' + sc.reasons.join('; ') : 'No concerns found')),
        h('table', { class: 'phoneCards u-mt-8' },
          h('thead', null, h('tr', null, h('th', null, 'Document'), h('th', null, 'Status'), h('th', null, 'Expires'), h('th', { class: 'num-cell' }, 'Days left'))),
          h('tbody', null, docRows)),
        h('p', { class: 'hint u-mt-8' }, 'Checked as of ' + fx.asOfDate + '. Required documents assumed: ' + sc.documents.required.join(', ') + ' — the owner confirms the real list. Not stored in the database yet: ' + eng.MISSING_FIELDS.length + ' fields this scorecard needs.')));
    }

    // ---------- Supplier document checklist (behind supplierDocsOn; owner decision of Nov 16)
    // Read-only worked example on the Suppliers page: for each supplier, the
    // documents its kind of supplier should have on file (purchases; lotion lab;
    // bottles and pumps; labels or direct printing), and which are missing or
    // waiting for review. Example data; nothing is stored, uploaded or sent. OFF
    // by default (host renders empty, Suppliers unchanged).
    let supplierDocsShowAll = false;
    let supplierDocsSeq = 0;
    let supplierDocsLast = null;      // { mode: 'stored'|'example', data, store, myId, names }
    const SD_WORD = { MISSING: 'Missing', REJECTED: 'Rejected — needs a new copy', EXPIRED: 'Expired — needs a new copy', AWAITING_REVIEW: 'Awaiting review', APPROVED: 'Approved' };
    function sdPerson(id) {
      const L = supplierDocsLast; if (!id) return 'someone';
      if (L && L.myId && id === L.myId) return 'you';
      return (L && L.names && L.names[id]) || 'a team member';
    }
    function sdStore() {
      let mod = null; try { mod = (window.HE && window.HE.suppliers && window.HE.suppliers['he-supplier-docs-store']) || null; } catch (e) { mod = null; }
      if (!mod || !(typeof supplierDocsStoreOn === 'function' && supplierDocsStoreOn())) return null;
      return mod.createStore({ client: supabase, enabled: true, role: currentUserRole });
    }
    async function loadSupplierDocs() {
      const host = document.getElementById('supplierDocsHost'); if (!host) return;
      if (!(typeof supplierDocsOn === 'function' && supplierDocsOn())) { host.replaceChildren(); return; }
      let eng = null; try { eng = (window.HE && window.HE.suppliers && window.HE.suppliers['he-supplier-docs']) || null; } catch (e) { eng = null; }
      if (!eng) { host.replaceChildren(h('p', { class: 'empty' }, 'Supplier document tools could not load.')); return; }
      const seq = ++supplierDocsSeq;
      // Stored records when storage is switched on AND installed; otherwise the example data.
      let mode = 'example', data = null, store = sdStore(), storeNote = null;
      if (store) {
        const pr = await store.probe();
        if (seq !== supplierDocsSeq) return;
        if (pr.ok) {
          const L = await store.load();
          if (seq !== supplierDocsSeq) return;
          if (L.ok) { mode = 'stored'; data = L; } else storeNote = L.message;
        } else storeNote = pr.message;
      }
      let myId = null, names = {};
      if (mode === 'stored') {
        myId = await currentUserId().catch(() => null);
        try { const pr = await supabase.from('profiles').select('id,display_name'); if (!pr.error) (pr.data || []).forEach(p => { if (p.display_name) names[p.id] = String(p.display_name).slice(0, 80); }); } catch (e) { /* names stay generic */ }
        if (seq !== supplierDocsSeq) return;
      }
      if (mode === 'example') { const fx = eng.fixtures(); data = { suppliers: fx.suppliers, context: fx.context, documents: fx.documents, checklist: eng.DEFAULT_CHECKLIST, asOf: fx.asOf, history: [] }; }
      const asOf = mode === 'stored' ? localDateString(new Date()) : data.asOf;
      supplierDocsLast = { mode, data, store: mode === 'stored' ? store : null, myId, names };
      const ov = eng.overview(data.suppliers, data.context, data.documents, { asOf, checklist: data.checklist });
      if (!ov.ok) { host.replaceChildren(h('p', { class: 'empty' }, 'Supplier documents: ' + ov.reason + '.')); return; }
      const isOwner = currentUserRole === 'owner';
      const detail = r => r.status === 'APPROVED' ? 'Reviewed by ' + (mode === 'stored' ? sdPerson(r.reviewedBy) : r.reviewedBy) + ' on ' + String(r.reviewedAt).slice(0, 10) + (r.expiresOn ? ' · valid until ' + r.expiresOn : '')
        : r.status === 'AWAITING_REVIEW' ? 'Received ' + (r.receivedAt ? String(r.receivedAt).slice(0, 10) : '(date not recorded)') + (mode === 'stored' && r.recordedBy ? ', recorded by ' + sdPerson(r.recordedBy) : '') + ' — nobody has reviewed it yet'
        : r.status === 'REJECTED' ? 'Rejected' + (r.note ? ': ' + r.note : '')
        : r.status === 'EXPIRED' ? 'Expired on ' + (r.expiresOn || '—') : 'Nothing on file';
      const actions = r => {
        if (mode !== 'stored' || r.status !== 'AWAITING_REVIEW' || !r.documentId) return null;
        const mine = r.recordedBy && r.recordedBy === myId;
        if (!isOwner && !mine) return null;
        const id = r.documentId;
        return h('div', { class: 'scanToggleRow u-mt-6', 'data-sdrow': id },
          h('input', { type: 'text', class: 'u-flex-1', maxlength: '500', placeholder: isOwner ? 'Reason (needed to reject or withdraw)' : 'Reason (needed to withdraw)', 'aria-label': 'Reason for ' + r.label + ', ' + r.subjectLabel, 'data-sdreason': id }),
          isOwner ? h('button', { type: 'button', class: 'small', 'data-sdact': 'approved', 'data-docid': id }, 'Approve') : null,
          isOwner ? h('button', { type: 'button', class: 'small secondary', 'data-sdact': 'rejected', 'data-docid': id }, 'Reject') : null,
          h('button', { type: 'button', class: 'small secondary', 'data-sdact': 'withdraw', 'data-docid': id }, 'Withdraw'));
      };
      // Files (drafts/38): only the owner opens one; the person who recorded a
      // waiting document (or the owner) attaches its one file.
      const docById = {}; (data.documents || []).forEach(d => { docById[d.id] = d; });
      const fileCtl = r => {
        if (mode !== 'stored' || !r.documentId) return null;
        const d = docById[r.documentId] || {}, id = r.documentId;
        if (d.filePath) {
          return isOwner ? h('div', { class: 'scanToggleRow u-mt-6', 'data-sdfilerow': id },
            h('button', { type: 'button', class: 'small secondary', 'data-sdopen': id }, 'Open file'),
            h('span', { class: 'u-fs-12', 'data-sdfilelink': id }))
            : h('div', { class: 'u-fs-12 u-c-muted u-mt-6', 'data-sdfilerow': id }, 'File attached. Only the owner can open it.');
        }
        const mine = r.recordedBy && r.recordedBy === myId;
        if (r.status !== 'AWAITING_REVIEW' || (!isOwner && !mine)) return null;
        return h('div', { class: 'scanToggleRow u-mt-6', 'data-sdfilerow': id },
          h('input', { type: 'file', accept: 'application/pdf,image/jpeg,image/png', 'aria-label': 'File for ' + r.label + ', ' + r.subjectLabel + ' (PDF, JPEG or PNG, up to 10 MB)', 'data-sdfile': id }),
          h('button', { type: 'button', class: 'small secondary', 'data-sdattach': id }, 'Attach file'));
      };
      const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
      const cards = ov.suppliers.map(sup => {
        const shown = supplierDocsShowAll ? sup.rows : sup.rows.filter(r => r.status !== 'APPROVED');
        return h('div', { class: 'scanCard u-mt-8', 'data-supplierdocs-supplier': String(sup.supplier.id), 'data-missing': String(sup.missing), 'data-awaiting': String(sup.awaitingReview) },
          h('div', { class: 'taskTitle' }, sup.supplier.name),
          h('div', { class: 'u-fs-12 u-c-muted' }, 'Checklist: purchases' + sup.profiles.map(p => ' + ' + p.label.toLowerCase()).join('') + ' · ' + plural(sup.missing, 'document', 'documents') + ' missing · ' + sup.awaitingReview + ' awaiting review · ' + sup.approved + ' approved'),
          shown.length ? h('table', { class: 'phoneCards u-mt-8' },
            h('thead', null, h('tr', null, h('th', null, 'Document'), h('th', null, 'For'), h('th', null, 'Status'), h('th', null, 'Detail'))),
            h('tbody', null, shown.map(r => h('tr', { 'data-docstate': r.status, 'data-dockey': r.key, 'data-subject': r.subjectId == null ? '' : r.subjectId },
              h('td', null, r.label), h('td', null, r.subjectLabel), h('td', null, h('span', { class: r.status === 'APPROVED' ? '' : 'taskTitle' }, SD_WORD[r.status] || r.status)),
              h('td', null, detail(r) + (r.reference ? ' · ref. ' + r.reference : ''), actions(r), fileCtl(r))))))
            : h('div', { class: 'u-fs-12 u-c-muted u-mt-6' }, 'Every document on this supplier\'s checklist is on file and reviewed.'));
      });
      const c = data.checklist;
      const listOf = docs => docs.map(d => d.label + ' (one per ' + d.per + ')').join('; ');
      host.replaceChildren(h('div', { class: 'supplierDocs u-mb-16', 'data-sdmode': mode },
        h('div', { class: 'scanHead' }, h('h3', null, 'Supplier documents'), h('span', { class: 'scanBadge' }, mode === 'stored' ? 'STORED — saved in the database' : 'SIMULATED — example data, read-only')),
        storeNote ? h('p', { class: 'hint u-mt-6', 'data-sdstorenote': '1' }, 'Storage is switched on but not available: ' + storeNote + ' Showing the example data instead.') : null,
        h('p', { class: 'hint u-mt-6', 'data-supplierdocs-totals': ov.totals.missing + '/' + ov.totals.awaitingReview + '/' + ov.totals.approved },
          plural(ov.totals.missing, 'document', 'documents') + ' missing · ' + ov.totals.awaitingReview + ' awaiting review · ' + ov.totals.approved + ' approved, across ' + plural(ov.totals.suppliers, 'supplier', 'suppliers') + '. Checked as of ' + asOf + '.'),
        mode === 'stored' && !isOwner ? h('p', { class: 'hint u-mt-6', 'data-sdpurchasehint': '1' }, 'A purchase document is recorded against an order you can see. If its order is not listed for you, hand it to the owner below.') : null,
        h('div', { class: 'scanToggleRow u-mt-8' },
          h('button', { type: 'button', class: 'small' + (supplierDocsShowAll ? ' secondary' : ''), 'data-supplierdocs': 'attention', 'aria-pressed': String(!supplierDocsShowAll) }, 'Missing or awaiting review'),
          h('button', { type: 'button', class: 'small' + (supplierDocsShowAll ? '' : ' secondary'), 'data-supplierdocs': 'all', 'aria-pressed': String(supplierDocsShowAll) }, 'Every document')),
        cards,
        mode === 'stored' && isOwner ? sdHandoffsForOwner(data) : null,
        mode === 'stored' ? sdRecordForm(data) : null,
        mode === 'stored' && !isOwner ? sdHandoffForm(data) : null,
        mode === 'stored' ? sdHistory(data) : null,
        mode === 'stored' && isOwner ? sdSettings(data) : null,
        h('details', { class: 'hintMore u-mt-10' }, h('summary', null, 'The checklist these suppliers are held to'),
          h('div', { class: 'scanCardRow', 'data-checklist': 'purchase' }, h('span', { class: 'u-c-muted' }, 'Every purchase, where it applies: '), listOf(c.purchase)),
          Object.keys(c.profiles).map(k => h('div', { class: 'scanCardRow', 'data-checklist': k }, h('span', { class: 'u-c-muted' }, c.profiles[k].label + ': '), listOf(c.profiles[k].documents)))),
        h('p', { class: 'hint u-mt-8' }, mode === 'stored'
          ? 'A document counts only once the owner has reviewed and approved it. Only the owner can approve, reject or change the checklist, and only the owner can open an attached file (through a link that works for 60 seconds); the database and the file storage enforce this. A stored file cannot be replaced or deleted.'
          : 'A document counts only once someone has reviewed and approved it. The checklist can be changed per kind of supplier. These records are not stored in the database yet — that needs its own approved change.')));
    }
    // Record that a document arrived (stored mode).
    function sdRecordForm(data) {
      const kinds = (data.types || []).filter(t => t.is_active !== false);
      const pos = (data.context.purchaseOrders || []).filter(p => !p.deleted_at && p.status !== 'draft' && p.status !== 'cancelled');
      return h('form', { class: 'heForm u-mt-12 u-pt-16 u-bt-1-solid-line', 'data-sdform': '1', novalidate: '' },
        h('h3', null, 'Record a document that arrived'),
        h('p', { class: 'hint' }, 'It then waits for the owner\'s review. Saving twice, or again after a lost connection, records it once.'),
        h('div', { class: 'heField' }, h('label', { for: 'sdSupplier' }, 'Supplier'),
          h('select', { id: 'sdSupplier', name: 'supplier', required: '' }, h('option', { value: '' }, 'Choose…'), data.suppliers.map(s => h('option', { value: s.id }, s.name)))),
        h('div', { class: 'heField' }, h('label', { for: 'sdKind' }, 'Document'),
          h('select', { id: 'sdKind', name: 'kind', required: '' }, h('option', { value: '' }, 'Choose…'), kinds.map(t => h('option', { value: t.key, 'data-subject': t.subject_kind }, t.label)))),
        h('div', { class: 'heField' }, h('label', { for: 'sdSubject' }, 'For (batch, formula, component or artwork reference; for a purchase document, the purchase order)'),
          h('input', { id: 'sdSubject', name: 'subject', type: 'text', maxlength: '120', list: 'sdPoList', autocomplete: 'off' }),
          h('datalist', { id: 'sdPoList' }, pos.map(p => h('option', { value: p.po_number || p.id })))),
        h('div', { class: 'heField' }, h('label', { for: 'sdSubjectLabel' }, 'Name it (optional, e.g. "Lot 301, Honey Milk")'), h('input', { id: 'sdSubjectLabel', name: 'subjectLabel', type: 'text', maxlength: '200' })),
        h('div', { class: 'heField' }, h('label', { for: 'sdRef' }, 'Reference on the document (optional)'), h('input', { id: 'sdRef', name: 'reference', type: 'text', maxlength: '120' })),
        h('div', { class: 'heField' }, h('label', { for: 'sdReceived' }, 'Received on'), h('input', { id: 'sdReceived', name: 'receivedOn', type: 'date', value: localDateString(new Date()) })),
        h('div', { class: 'heField' }, h('label', { for: 'sdDocDate' }, 'Document date (optional)'), h('input', { id: 'sdDocDate', name: 'documentDate', type: 'date' })),
        h('div', { class: 'heField' }, h('label', { for: 'sdExpires' }, 'Valid until (optional)'), h('input', { id: 'sdExpires', name: 'expiresOn', type: 'date' })),
        h('button', { type: 'submit', 'data-sdsave': '1' }, 'Save document'),
        h('p', { class: 'hint u-mt-6', role: 'status', 'data-sdformmsg': '1' }));
    }
    function sdHistory(data) {
      const rows = (data.history || []).slice(0, 20);
      const typeLabel = {}; (data.types || []).forEach(t => { typeLabel[t.key] = t.label; });
      const docBy = {}; (data.allDocuments || []).forEach(d => { docBy[d.id] = d; });
      const what = e => {
        if (e.area === 'checklist') return 'changed the checklist (' + String((e.detail && e.detail.table) || '').replace(/_/g, ' ') + ')';
        const d = docBy[e.document_id] || {};
        const doc = (typeLabel[d.kind] || 'a document') + (d.subjectLabel || d.subjectId ? ' for ' + (d.subjectLabel || d.subjectId) : '');
        return ({ recorded: 'recorded ', corrected: 'corrected ', approved: 'approved ', rejected: 'rejected ', withdrawn: 'withdrew ' }[e.event] || e.event + ' ') + doc + (e.note ? ' — ' + e.note : '');
      };
      return h('details', { class: 'hintMore u-mt-10', 'data-sdhistory': '1' }, h('summary', null, 'Review history (latest ' + rows.length + ')'),
        rows.length ? h('ul', { class: 'u-mt-6' }, rows.map(e => h('li', { 'data-sdevent': e.event }, fmtDate(e.at) + ' — ' + sdPerson(e.by_user) + ' ' + what(e))))
          : h('p', { class: 'hint' }, 'Nothing recorded yet.'));
    }
    // Staff (and administrators): a purchase document whose order they cannot
    // see goes to the owner, instead of widening who can see purchase orders.
    function sdHandoffForm(data) {
      const kinds = (data.types || []).filter(t => t.is_active !== false && t.subject_kind === 'purchase');
      const mine = (data.handoffs || []).slice(0, 20);
      const word = { waiting: 'Waiting for the owner', recorded: 'Linked and recorded by the owner', dismissed: 'Dismissed by the owner' };
      return h('form', { class: 'heForm u-mt-12 u-pt-16 u-bt-1-solid-line', 'data-sdhandoff': '1', novalidate: '' },
        h('h3', null, 'Hand a purchase document to the owner'),
        h('p', { class: 'hint' }, 'For a packing slip, invoice or receipt whose order you cannot see. The owner links it to the right order. Sending twice records it once.'),
        h('div', { class: 'heField' }, h('label', { for: 'sdhSupplier' }, 'Supplier'),
          h('select', { id: 'sdhSupplier', name: 'supplier', required: '' }, h('option', { value: '' }, 'Choose…'), data.suppliers.map(s => h('option', { value: s.id }, s.name)))),
        h('div', { class: 'heField' }, h('label', { for: 'sdhKind' }, 'Document'),
          h('select', { id: 'sdhKind', name: 'kind', required: '' }, h('option', { value: '' }, 'Choose…'), kinds.map(t => h('option', { value: t.key }, t.label)))),
        h('div', { class: 'heField' }, h('label', { for: 'sdhPo' }, 'Order number as printed on the paper'), h('input', { id: 'sdhPo', name: 'poText', type: 'text', maxlength: '120', required: '' })),
        h('div', { class: 'heField' }, h('label', { for: 'sdhRef' }, 'Reference on the document (optional)'), h('input', { id: 'sdhRef', name: 'reference', type: 'text', maxlength: '120' })),
        h('div', { class: 'heField' }, h('label', { for: 'sdhReceived' }, 'Received on'), h('input', { id: 'sdhReceived', name: 'receivedOn', type: 'date', value: localDateString(new Date()) })),
        h('div', { class: 'heField' }, h('label', { for: 'sdhNote' }, 'Note for the owner (optional)'), h('input', { id: 'sdhNote', name: 'note', type: 'text', maxlength: '500' })),
        h('button', { type: 'submit', 'data-sdhsave': '1' }, 'Hand to the owner'),
        h('p', { class: 'hint u-mt-6', role: 'status', 'data-sdhmsg': '1' }),
        mine.length ? h('ul', { class: 'u-mt-6', 'data-sdmyhandoffs': '1' }, mine.map(x => h('li', { 'data-sdhstatus': x.status },
          String(x.received_on || String(x.handed_at || '').slice(0, 10)) + ' — ' + x.po_text + (x.reference ? ' (ref. ' + x.reference + ')' : '') + ': ' + (word[x.status] || x.status) + (x.status === 'dismissed' && x.resolve_note ? ' — ' + x.resolve_note : '')))) : null);
    }
    // Owner: documents handed over, to link to the right order or dismiss.
    function sdHandoffsForOwner(data) {
      const waiting = (data.handoffs || []).filter(x => x.status === 'waiting');
      const supName = {}; data.suppliers.forEach(s => { supName[s.id] = s.name; });
      const typeLabel = {}; (data.types || []).forEach(t => { typeLabel[t.key] = t.label; });
      const pos = (data.context.purchaseOrders || []).filter(p => !p.deleted_at && p.status !== 'draft' && p.status !== 'cancelled');
      return h('div', { class: 'u-mt-12', 'data-sdhandoffs': String(waiting.length) },
        h('h3', null, 'Handed to you (' + waiting.length + ')'),
        waiting.length ? waiting.map(x => h('div', { class: 'scanCard u-mt-8', 'data-sdhandoff-id': x.id },
          h('div', { class: 'taskTitle' }, (typeLabel[x.kind] || x.kind) + ' from ' + (supName[x.supplier_id] || 'a supplier')),
          h('div', { class: 'u-fs-12 u-c-muted' }, 'Order on the paper: ' + x.po_text + (x.reference ? ' · ref. ' + x.reference : '') + ' · received ' + (x.received_on || '—') + ' · handed over by ' + sdPerson(x.handed_by) + (x.note ? ' · "' + x.note + '"' : '')),
          h('div', { class: 'scanToggleRow u-mt-6' },
            h('select', { 'aria-label': 'Purchase order for the ' + (typeLabel[x.kind] || x.kind) + ' marked ' + x.po_text, 'data-sdpo': x.id },
              h('option', { value: '' }, 'Choose the order…'), pos.filter(p => p.supplier_id === x.supplier_id).map(p => h('option', { value: p.id }, p.po_number || p.id))),
            h('button', { type: 'button', class: 'small', 'data-sdresolve': x.id }, 'Link and record')),
          h('div', { class: 'scanToggleRow u-mt-6' },
            h('input', { type: 'text', class: 'u-flex-1', maxlength: '500', placeholder: 'Reason (needed to dismiss)', 'aria-label': 'Reason to dismiss the hand-off marked ' + x.po_text, 'data-sdhonote': x.id }),
            h('button', { type: 'button', class: 'small secondary', 'data-sddismiss': x.id }, 'Dismiss'))))
          : h('p', { class: 'hint' }, 'Nothing waiting.'));
    }
    async function sdSha256(file) {
      const mod = window.HE && window.HE.suppliers && window.HE.suppliers['he-supplier-docs-store'];
      return mod.fileSha256(file);
    }
    // Owner only: which profiles each kind of supplier is held to.
    function sdSettings(data) {
      const profiles = Object.keys(data.checklist.profiles);
      const byType = data.checklist.profilesByType || {};
      return h('details', { class: 'hintMore u-mt-10', 'data-sdsettings': '1' }, h('summary', null, 'Checklist by kind of supplier (owner only)'),
        Object.keys(SUPPLIER_TYPE_LABELS).map(t => h('fieldset', { class: 'u-mt-6', 'data-sdtype': t },
          h('legend', null, SUPPLIER_TYPE_LABELS[t]),
          profiles.map(p => h('label', { class: 'u-mr-4' }, h('input', { type: 'checkbox', value: p, checked: (byType[t] || []).indexOf(p) >= 0 ? '' : null }), ' ' + data.checklist.profiles[p].label)),
          h('button', { type: 'button', class: 'small secondary u-ml-6', 'data-sdtypesave': t }, 'Save'))));
    }
    async function sdAfter(res, okText) {
      toast(res.ok ? (res.message || okText) : (res.message || 'Not saved.'), res.ok ? undefined : 'err');
      announce(res.ok ? (res.message || okText) : (res.message || 'Not saved.'));
      await loadSupplierDocs();
    }
    document.addEventListener('click', async (e) => {
      const t = e.target.closest('[data-supplierdocs]');
      if (t) {
        supplierDocsShowAll = t.getAttribute('data-supplierdocs') === 'all';
        await loadSupplierDocs();
        announce(supplierDocsShowAll ? 'Showing every document.' : 'Showing documents that are missing or awaiting review.');
        refocusLike(t, 'supplierDocsHost');
        return;
      }
      const a = e.target.closest('[data-sdact]');
      if (a && supplierDocsLast && supplierDocsLast.store) {
        if (a.disabled) return;
        const id = a.getAttribute('data-docid'), act = a.getAttribute('data-sdact');
        const reasonEl = document.querySelector('[data-sdreason="' + CSS.escape(id) + '"]');
        const reason = reasonEl ? reasonEl.value : '';
        a.disabled = true;
        const res = act === 'withdraw' ? await supplierDocsLast.store.withdraw(id, reason) : await supplierDocsLast.store.review(id, act, reason);
        a.disabled = false;
        await sdAfter(res, act === 'approved' ? 'Approved.' : act === 'rejected' ? 'Rejected.' : 'Withdrawn.');
        return;
      }
      const at = e.target.closest('[data-sdattach]');
      if (at && supplierDocsLast && supplierDocsLast.store) {
        if (at.disabled) return;
        const id = at.getAttribute('data-sdattach');
        const inp = document.querySelector('[data-sdfile="' + CSS.escape(id) + '"]');
        const file = inp && inp.files && inp.files[0];
        if (!file) { toast('Choose a file first.', 'err'); announce('Choose a file first.'); return; }
        at.disabled = true;
        let res;
        try { res = await supplierDocsLast.store.attachFile(id, { name: file.name, type: file.type, size: file.size, sha256: await sdSha256(file), body: file }); }
        catch (err) { res = { ok: false, message: 'The file could not be read. Nothing was attached.' }; }
        at.disabled = false;
        await sdAfter(res, 'File attached.');
        return;
      }
      const op = e.target.closest('[data-sdopen]');
      if (op && supplierDocsLast && supplierDocsLast.store) {
        if (op.disabled) return;
        const id = op.getAttribute('data-sdopen');
        const doc = (supplierDocsLast.data.documents || []).find(d => d.id === id);
        op.disabled = true;
        const res = await supplierDocsLast.store.openFile(doc);
        op.disabled = false;
        const slot = document.querySelector('[data-sdfilelink="' + CSS.escape(id) + '"]');
        if (!res.ok) { toast(res.message || 'The file could not be opened.', 'err'); announce(res.message || 'The file could not be opened.'); return; }
        // A link, not a pop-up (phones block pop-ups opened after a wait).
        if (slot) slot.replaceChildren(h('a', { href: res.url, target: '_blank', rel: 'noopener noreferrer', 'data-sdfileurl': id }, 'Open the file (this link works for 60 seconds)'));
        announce('A link to the file is ready. It works for 60 seconds.');
        return;
      }
      const rv = e.target.closest('[data-sdresolve]');
      if (rv && supplierDocsLast && supplierDocsLast.store) {
        if (rv.disabled) return;
        const id = rv.getAttribute('data-sdresolve');
        const sel = document.querySelector('[data-sdpo="' + CSS.escape(id) + '"]');
        if (!sel || !sel.value) { toast('Choose the purchase order this document belongs to.', 'err'); announce('Choose the purchase order this document belongs to.'); if (sel) sel.focus(); return; }
        rv.disabled = true;
        const res = await supplierDocsLast.store.resolveHandoff(id, sel ? sel.value : '');
        rv.disabled = false;
        await sdAfter(res, 'Linked and recorded.');
        return;
      }
      const dm = e.target.closest('[data-sddismiss]');
      if (dm && supplierDocsLast && supplierDocsLast.store) {
        if (dm.disabled) return;
        const id = dm.getAttribute('data-sddismiss');
        const n = document.querySelector('[data-sdhonote="' + CSS.escape(id) + '"]');
        if (!n || n.value.trim().length < 5) { toast('Say why the hand-off is dismissed.', 'err'); announce('Say why the hand-off is dismissed.'); if (n) n.focus(); return; }
        dm.disabled = true;
        const res = await supplierDocsLast.store.dismissHandoff(id, n ? n.value : '');
        dm.disabled = false;
        await sdAfter(res, 'Dismissed.');
        return;
      }
      const s = e.target.closest('[data-sdtypesave]');
      if (s && supplierDocsLast && supplierDocsLast.store) {
        const t2 = s.getAttribute('data-sdtypesave');
        const box = s.closest('[data-sdtype]');
        const chosen = Array.from(box.querySelectorAll('input[type=checkbox]:checked')).map(x => x.value);
        s.disabled = true;
        const res = await supplierDocsLast.store.setTypeProfiles(t2, chosen);
        s.disabled = false;
        await sdAfter(res, 'Checklist updated.');
      }
    });
    document.addEventListener('submit', async (e) => {
      const f = e.target.closest('form[data-sdhandoff]'); if (!f) return;
      e.preventDefault();
      const L = supplierDocsLast; if (!L || !L.store) return;
      const btn = f.querySelector('[data-sdhsave]'); const msg = f.querySelector('[data-sdhmsg]');
      if (btn.disabled) return;
      const v = n => (f.elements[n] && f.elements[n].value || '').trim();
      if (!f.dataset.sdKey) f.dataset.sdKey = newRequestKey();
      btn.disabled = true; msg.textContent = 'Sending…';
      const res = await L.store.handOff({ requestKey: f.dataset.sdKey, supplierId: v('supplier'), kind: v('kind'), poText: v('poText'), reference: v('reference'), receivedOn: v('receivedOn'), note: v('note') });
      btn.disabled = false;
      msg.textContent = res.message || '';
      if (res.ok) { delete f.dataset.sdKey; await sdAfter(res, 'Handed to the owner.'); }
      else { toast(res.message || 'Not sent.', 'err'); announce(res.message || 'Not sent.'); }
    });
    document.addEventListener('submit', async (e) => {
      const f = e.target.closest('form[data-sdform]'); if (!f) return;
      e.preventDefault();
      const L = supplierDocsLast; if (!L || !L.store) return;
      const btn = f.querySelector('[data-sdsave]'); const msg = f.querySelector('[data-sdformmsg]');
      if (btn.disabled) return;          // a double click while the first save is on its way
      const v = n => (f.elements[n] && f.elements[n].value || '').trim();
      const kindOpt = f.elements.kind.selectedOptions[0];
      const subjectKind = kindOpt ? kindOpt.getAttribute('data-subject') : '';
      let subjectRef = v('subject');
      if (subjectKind === 'purchase') {
        const po = (L.data.context.purchaseOrders || []).find(p => p.po_number === subjectRef || p.id === subjectRef);
        if (!po) { msg.textContent = currentUserRole === 'owner' ? 'Not saved: choose one of the purchase orders listed.' : 'Not saved: that is not an order you can see. Use "Hand a purchase document to the owner" below instead.'; return; }
        subjectRef = po.id;
      } else if (subjectKind === 'supplier') subjectRef = v('supplier');
      // One request key per document being entered: kept until the save succeeds,
      // so pressing Save again after a lost reply sends the same key.
      if (!f.dataset.sdKey) f.dataset.sdKey = newRequestKey();
      btn.disabled = true; msg.textContent = 'Saving…';
      const res = await L.store.record({ requestKey: f.dataset.sdKey, supplierId: v('supplier'), kind: v('kind'), subjectKind, subjectRef,
        subjectLabel: v('subjectLabel'), reference: v('reference'), receivedOn: v('receivedOn'), documentDate: v('documentDate'), expiresOn: v('expiresOn') });
      btn.disabled = false;
      if (res.ok) { delete f.dataset.sdKey; }
      msg.textContent = res.message || '';
      if (res.ok) await sdAfter(res, 'Recorded.');
      else { toast(res.message || 'Not saved.', 'err'); announce(res.message || 'Not saved.'); }
    });

    // ---------- #54/#55 Cycle count + adjustment approval (behind cycleCountOn)
    // A worked synthetic count: draft -> discrepancy review -> owner-approved
    // adjustment -> audit. ADVISORY/DRAFT-ONLY — an approved adjustment names the
    // safe write (adjust_inventory R4) and is never applied to real stock. The
    // owner-only approval boundary and the audit trail are shown live; OFF by
    // default (host renders empty, Inventory unchanged).
    let cycleCountApproved = false;
    function workedCycleCount(eng) {
      const c = eng.startCount(eng.fixtures());
      eng.recordCount(c, 'HE-HONEY-8OZ', 38, 'staff', '2026-11-14T09:10:00Z'); // short 2
      eng.recordCount(c, 'HE-VEGAN-8OZ', 25, 'staff', '2026-11-14T09:11:00Z'); // match
      eng.recordCount(c, 'HE-SHEA-4OZ', 15, 'staff', '2026-11-14T09:12:00Z');  // over 3
      eng.submitForApproval(c, 'staff', '2026-11-14T09:15:00Z', 'Monthly shelf count: two honey jars missing, three shea jars found behind the boxes');
      return c;
    }
    function loadCycleCount() {
      const host = document.getElementById('cycleCountHost'); if (!host) return;
      if (!(typeof cycleCountOn === 'function' && cycleCountOn())) { host.replaceChildren(); return; }
      const eng = invMod('he-inventory-count');
      if (!eng) { host.replaceChildren(h('p', { class: 'empty' }, 'Cycle count tools could not load.')); return; }
      const c = workedCycleCount(eng);
      const disc = eng.discrepancies(c);
      const discRows = disc.map(d => h('tr', null,
        h('td', null, d.sku),
        h('td', { class: 'num-cell' }, String(d.systemQty)),
        h('td', { class: 'num-cell' }, String(d.countedQty)),
        h('td', { class: 'num-cell' }, (d.delta > 0 ? '+' : '') + d.delta + ' ' + d.direction)));
      // Try a staff and an ordinary-administrator approval first, to show the
      // permission boundary refuses both (owner decision of Nov 16).
      const staffTry = eng.approveAdjustment(c, { role: 'staff' });
      const adminTry = eng.approveAdjustment(c, { role: 'administrator' });
      const when = t => t ? String(t).slice(0, 16).replace('T', ' ') + ' UTC' : 'time not recorded';
      let approvedBlock = null;
      if (cycleCountApproved) {
        // The signed-in person's real role decides: only the owner may approve.
        const ap = eng.approveAdjustment(c, { role: currentUserRole, by: String(currentUserRole || 'unknown'), at: '2026-11-14T10:00:00Z' });
        approvedBlock = !ap.ok ? h('div', { class: 'scanCard u-mt-10', 'data-cyclecount-refused': '1' }, 'Not approved: ' + ap.reason + '.') : h('div', { class: 'scanCard u-mt-10' },
          h('div', { class: 'scanCardHead' }, 'Approved adjustment (advisory — NOT written to stock)'),
          ...ap.adjustments.map(a => h('div', { class: 'scanCardRow', 'data-cyclecount-record': a.sku },
            a.sku + ': original count ' + a.originalCount + ' → requested count ' + a.requestedCount + ' (' + (a.delta > 0 ? '+' : '') + a.delta + ')',
            h('div', { class: 'u-fs-12 u-c-muted' }, 'Reason: ' + (a.reason || '—')),
            h('div', { class: 'u-fs-12 u-c-muted' }, 'Proposed by ' + (a.submittedBy || '—') + ', ' + when(a.submittedAt) + ' · approved by ' + (a.approvedBy || '—') + ', ' + when(a.approvedAt) + ' · not written to stock'))),
          h('div', { class: 'u-fs-12 u-c-muted u-mt-8' }, 'Safe write needed: ' + eng.MISSING_WRITE_CONTRACT),
          h('div', { class: 'u-fs-12 u-c-muted u-mt-6' }, 'Audit: ' + c.audit.map(x => x.action).join(' → ')));
      }
      host.replaceChildren(h('div', { class: 'cycleCount u-mb-16' },
        h('div', { class: 'scanHead' }, h('h3', null, 'Cycle count & adjustment review'), h('span', { class: 'scanBadge' }, 'SIMULATED — advisory, no stock is written')),
        h('p', { class: 'hint u-mt-6' }, 'Staff and administrators may propose an adjustment with a reason. Only the owner approves it.'),
        h('p', { class: 'hint u-mt-6', 'data-cyclecount-status': c.status }, 'Status: ' + c.status + ' · proposed by ' + (c.submittedBy || '—') + ' · reason: ' + (c.reason || '—')),
        h('p', { class: 'hint u-mt-6', 'data-cyclecount-boundary': '1' }, 'Staff approval attempt: ' + staffTry.reason + '. Administrator approval attempt: ' + adminTry.reason + '.'),
        h('table', { class: 'phoneCards u-mt-8' },
          h('thead', null, h('tr', null, h('th', null, 'SKU'), h('th', { class: 'num-cell' }, 'System'), h('th', { class: 'num-cell' }, 'Counted'), h('th', { class: 'num-cell' }, 'Discrepancy'))),
          h('tbody', null, discRows)),
        h('div', { class: 'scanToggleRow u-mt-8' },
          h('button', { type: 'button', class: 'small' + (cycleCountApproved ? ' secondary' : ''), 'data-cyclecount': 'approve' }, cycleCountApproved ? 'Approval requested' : 'Approve (owner only)'),
          h('button', { type: 'button', class: 'small secondary', 'data-cyclecount': 'reset' }, 'Reset')),
        approvedBlock));
    }
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-cyclecount]'); if (!t) return;
      const act = t.getAttribute('data-cyclecount');
      if (act === 'approve') { cycleCountApproved = true; loadCycleCount(); }
      else if (act === 'reset') { cycleCountApproved = false; loadCycleCount(); }
      refocusLike(t, 'cycleCountHost');
    });

    // ---------- D-ops-5 / INV-17 Partial receiving and returns (behind partialReceivingOn)
    // The owner's rules of Nov 22, step by step on made-up stock: staff record
    // deliveries and the owner approves before stock changes; rejected units stay
    // outstanding; surplus waits for the owner; damaged kept goes to Damaged; a
    // supplier return reopens the order only when a replacement is expected;
    // customer returns wait for inspection and opened or used skincare is never
    // restocked; corrections are linked movements. Example data from
    // he-receiving.js (the same rules as SQL draft 40); NO stock is written.
    // OFF by default (host renders empty).
    let partialReceivingShown = 'steps';      // 'steps' | 'history' | 'rules'
    function loadPartialReceiving() {
      const host = document.getElementById('partialReceivingHost'); if (!host) return;
      if (!(typeof partialReceivingOn === 'function' && partialReceivingOn())) { host.replaceChildren(); return; }
      const eng = invMod('he-receiving');
      if (!eng) { host.replaceChildren(h('p', { class: 'empty' }, 'Partial receiving tools could not load.')); return; }
      const w = eng.workedExample();
      const signed = n => (n > 0 ? '+' : '') + n;
      const BW = { available: 'Available', damaged: 'Damaged' };
      const WHO = { staff: 'Staff', owner: 'You' };
      const outcome = s => s.kind === 'start' ? '—' : s.duplicate ? 'Already recorded: nothing changed' : !s.ok ? 'Refused: ' + s.reason
        : s.kind === 'submit' ? 'Recorded, waiting for your decision' : 'Done';
      const moveText = s => s.movements.length ? s.movements.map(m => BW[m.bucket] + ' ' + signed(m.change) + ' (' + m.before + ' → ' + m.after + ')').join('; ') : 'no change';
      const tab = (k, label) => h('button', { type: 'button', class: 'small' + (partialReceivingShown === k ? '' : ' secondary'), 'data-partialrcv': k, 'aria-pressed': String(partialReceivingShown === k) }, label);
      let body;
      if (partialReceivingShown === 'history') {
        body = h('div', { class: 'u-mt-8', 'data-partialrcv-history': String(w.history.length) },
          h('h4', null, 'History (' + w.history.length + ' entries)'),
          h('ol', null, w.history.map(e => h('li', null, String(e.at).slice(0, 16).replace('T', ' ') + ' UTC — ' + e.by + ': ' + e.what + (e.note ? ' — ' + e.note : '')))),
          h('h4', { class: 'u-mt-8' }, 'Stock movements (' + w.movements.length + ')'),
          h('table', { class: 'phoneCards u-mt-6' },
            h('thead', null, h('tr', null, h('th', null, '#'), h('th', null, 'Stock'), h('th', { class: 'num-cell' }, 'Before'), h('th', { class: 'num-cell' }, 'Change'), h('th', { class: 'num-cell' }, 'After'), h('th', null, 'Why'), h('th', null, 'Asked by'), h('th', null, 'Approved by'))),
            h('tbody', null, w.movements.map(m => h('tr', { 'data-partialrcv-move': String(m.n) }, h('td', null, String(m.n)), h('td', null, BW[m.bucket]), h('td', { class: 'num-cell' }, String(m.before)), h('td', { class: 'num-cell' }, signed(m.change)), h('td', { class: 'num-cell' }, String(m.after)),
              h('td', null, m.why + (m.corrects ? ' (linked to movement ' + m.corrects + ')' : '')), h('td', null, m.requestedBy || '—'), h('td', null, m.approvedBy || '—'))))),
          h('h4', { class: 'u-mt-8' }, 'Refused, and recorded as refused (' + w.refusals.length + ')'),
          h('ul', null, w.refusals.map(r => h('li', null, (r.by || 'someone') + ': ' + r.reason))),
          h('p', { class: 'hint u-mt-6', 'data-partialrcv-reconcile': w.reconcile.ok ? 'ok' : 'problem' }, w.reconcile.ok ? 'Check: adding every movement to the starting stock gives today\'s stock exactly.' : 'Check failed: ' + w.reconcile.problems.join('; ')));
      } else if (partialReceivingShown === 'rules') {
        body = h('div', { class: 'u-mt-8', 'data-partialrcv-rules': '1' },
          h('h4', null, 'Your stock rules of Nov 22 (D-ops-5)'),
          h('ol', null,
            h('li', null, 'Whole units only; at least one unit each time.'),
            h('li', null, 'Good and damaged units on a line can never be more than is still to come. Anything beyond is entered as surplus, and only once the line is complete.'),
            h('li', null, 'A delivery with several lines is approved completely or not at all.'),
            h('li', null, 'Good units go to Available and damaged units we keep go to Damaged, both when you approve. Rejected units are recorded with a reason and stay outstanding.'),
            h('li', null, 'Surplus waits for you: kept (into Available) or returned (no stock change).'),
            h('li', null, 'A return to the supplier can never be more than was received and kept, or more than the chosen stock holds. It reopens the order only when a replacement is expected.'),
            h('li', null, 'A customer return can never be more than was sold and not yet returned. It waits for inspection and is not for sale. Every unit gets an outcome; opened or used skincare is never restocked.'),
            h('li', null, 'Staff and administrators record deliveries and returns for purchase orders they may see. Only you approve, reject or decide; the person who submitted it, or you, can cancel it.'),
            h('li', null, 'Every submission has its own key: sending it again changes nothing, and approving twice changes nothing.'),
            h('li', null, 'Every change records who asked, who approved, when, why and the stock before and after. Refusals are recorded too. A mistake is corrected once, by a linked movement with a reason.')),
          h('p', { class: 'hint u-mt-6' }, 'The same rules as a database change for your review: SQL draft 40 (docs/ops/sql-review/ITEM_5_DRAFT_40_PARTIAL_RECEIVING.md).'));
      } else {
        body = h('table', { class: 'phoneCards u-mt-8', 'data-partialrcv-steps': String(w.steps.length) },
          h('thead', null, h('tr', null, h('th', null, 'Step'), h('th', { class: 'num-cell' }, 'Received'), h('th', { class: 'num-cell' }, 'Still to come'),
            h('th', { class: 'num-cell' }, 'Rejected'), h('th', { class: 'num-cell' }, 'Sent back'), h('th', { class: 'num-cell' }, 'Waiting for you'), h('th', { class: 'num-cell' }, 'Available'), h('th', { class: 'num-cell' }, 'Damaged'))),
          h('tbody', null, w.steps.map(s => h('tr', { 'data-partialrcv-step': String(s.n), 'data-partialrcv-kind': s.kind },
            // the first cell: a phone card shows it full width, as the card's title
            h('td', null, h('div', null, h('div', null, s.n + '. ' + (s.who ? WHO[s.who] + ': ' : '') + s.title),
              s.kind === 'start' ? null : h('div', { class: 'u-fs-12 u-mt-4' + (s.ok && !s.duplicate ? ' u-c-muted' : ' taskTitle'), 'data-partialrcv-result': s.ok ? (s.duplicate ? 'duplicate' : 'recorded') : 'refused' }, outcome(s)),
              s.kind === 'start' ? null : h('div', { class: 'u-fs-12 u-c-muted' }, 'Stock: ' + moveText(s)))),
            h('td', { class: 'num-cell' }, s.received + ' of ' + s.ordered), h('td', { class: 'num-cell' }, String(s.toCome)), h('td', { class: 'num-cell' }, String(s.rejected)),
            h('td', { class: 'num-cell' }, String(s.returnedToSupplier)), h('td', { class: 'num-cell' }, String(s.waiting)), h('td', { class: 'num-cell' }, String(s.available)), h('td', { class: 'num-cell' }, String(s.damaged))))));
      }
      host.replaceChildren(h('div', { class: 'partialReceiving u-mb-16' },
        h('div', { class: 'scanHead' }, h('h3', null, 'Partial receiving and returns'), h('span', { class: 'scanBadge' }, 'SIMULATED — example data, no stock is written')),
        h('p', { class: 'hint u-mt-6' }, 'Example: purchase order SYN-PO-020 for 20 jars of ' + w.sku + ', delivered in three parts, with rejected, damaged and surplus jars, two returns to the supplier, a customer return inspected in two parts, and one correction. Staff record; you approve before stock changes.'),
        h('div', { class: 'scanToggleRow u-mt-8' }, tab('steps', 'Step by step'), tab('history', 'History and movements'), tab('rules', 'The rules')),
        body,
        h('p', { class: 'hint u-mt-8' }, 'Nothing here changes stock. Live stock still changes only through the reviewed database functions (drafts/10, behind their switches). These rules go live only with SQL draft 40, after your separate approval.')));
    }
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-partialrcv]'); if (!t) return;
      partialReceivingShown = t.getAttribute('data-partialrcv');
      loadPartialReceiving();
      announce(partialReceivingShown === 'history' ? 'Showing the history and stock movements.' : partialReceivingShown === 'rules' ? 'Showing the stock rules.' : 'Showing the example step by step.');
      refocusLike(t, 'partialReceivingHost');
    });

    // ---------- #70/#71 Scheduled-report version history + simulated delivery
    // (behind reportVersionsOn). Shows the schedule check (which days ran /
    // missed), immutable versions with a rerun appended (new checksum, history
    // kept), and a SIMULATED delivery lifecycle — no real email ever sends.
    const reportSchedMod = () => { try { return (window.HE && window.HE.reports && window.HE.reports['he-report-schedule']) || null; } catch (e) { return null; } };
    let reportRerun = false; let reportDeliveryState = 'QUEUED';
    function loadReportVersions() {
      const host = document.getElementById('reportVersionsHost'); if (!host) return;
      if (!(typeof reportVersionsOn === 'function' && reportVersionsOn())) { host.replaceChildren(); return; }
      const eng = reportSchedMod();
      if (!eng) { host.replaceChildren(h('p', { class: 'empty' }, 'Report version tools could not load.')); return; }
      const fx = eng.scheduleFixtures();
      const book = eng.createReportBook();
      book.generate('2026-11-11', fx.day11, '2026-11-11T06:00:00Z');
      book.generate('2026-11-13', fx.day13, '2026-11-13T06:00:00Z');
      if (reportRerun) book.generate('2026-11-13', fx.day13v2, '2026-11-13T18:00:00Z'); // corrected rerun
      const sched = book.scheduleStatus(fx.expected);
      const versions = book.versions('2026-11-13');
      const verRows = versions.map(v => h('tr', null,
        h('td', null, v.reportDate + ' v' + v.version + (v.rerun ? ' (rerun)' : '')),
        h('td', null, v.checksum),
        h('td', { class: 'num-cell' }, v.rows.length + ' row(s)')));
      // Simulated delivery of the latest version.
      let d = eng.queueDelivery(book.latest('2026-11-13'), 'email', '2026-11-13T07:00:00Z');
      if (reportDeliveryState === 'SENT') { d = eng.applyDelivery(d, 'HELD').record; d = eng.applyDelivery(d, 'QUEUED').record; d = eng.applyDelivery(d, 'SENT').record; }
      host.replaceChildren(h('div', { class: 'reportVersions u-mb-16' },
        h('div', { class: 'scanHead' }, h('h3', null, 'Report versions & delivery'), h('span', { class: 'scanBadge' }, 'SIMULATED — no email is sent')),
        h('p', { class: 'hint u-mt-6' }, 'Schedule: ' + sched.present.length + ' of ' + sched.expected.length + ' days ran · missed: ' + (sched.missing.join(', ') || 'none')),
        h('table', { class: 'phoneCards u-mt-8' },
          h('thead', null, h('tr', null, h('th', null, 'Version'), h('th', null, 'Checksum'), h('th', { class: 'num-cell' }, 'Rows'))),
          h('tbody', null, verRows)),
        h('p', { class: 'hint u-mt-8' }, 'Delivery (2026-11-13 v' + book.latest('2026-11-13').version + '): ' + d.state + ' · delivered=' + d.delivered + ' · ' + d.dependency),
        h('div', { class: 'scanToggleRow u-mt-8' },
          h('button', { type: 'button', class: 'small' + (reportRerun ? ' secondary' : ''), 'data-reportver': 'rerun' }, reportRerun ? 'Reran (v2 added)' : 'Rerun 2026-11-13'),
          h('button', { type: 'button', class: 'small' + (reportDeliveryState === 'SENT' ? ' secondary' : ''), 'data-reportver': 'send' }, reportDeliveryState === 'SENT' ? 'Simulated-sent' : 'Simulate delivery'),
          h('button', { type: 'button', class: 'small secondary', 'data-reportver': 'reset' }, 'Reset'))));
    }
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-reportver]'); if (!t) return;
      const act = t.getAttribute('data-reportver');
      if (act === 'rerun') { reportRerun = true; loadReportVersions(); }
      else if (act === 'send') { reportDeliveryState = 'SENT'; loadReportVersions(); }
      else if (act === 'reset') { reportRerun = false; reportDeliveryState = 'QUEUED'; loadReportVersions(); }
      refocusLike(t, 'reportVersionsHost');
    });

    // ---------- Operations output previews (read-only; behind reportExportOn /
    // invoicePreviewOn). Both are SIMULATED prototypes shown in Report History.
    // The export preview packages a synthetic day-set into a manifest with a
    // checksum (writes no file, sends nothing). The invoice preview shows a
    // SIMULATED draft invoice + packing slip; issuing stays an owner decision.
    const opsReportsMod = () => { try { return (window.HE && window.HE.reports && window.HE.reports['he-report-export']) || null; } catch (e) { return null; } };
    // #72: a traceable label for an export (who / why / which content). It does
    // not change the export or its checksum; it travels with it. It names the
    // person signed in on this page (their sign-in email and role), so a printed
    // or saved copy says who made it. Preview only: stamping saved files comes
    // with enabling real exports (owner decision 6).
    const exportLabelWho = () => {
      const email = (typeof currentUserEmail === 'string' && currentUserEmail.trim()) ? currentUserEmail.trim().slice(0, 120) : '';
      const role = (typeof currentUserRole === 'string' && currentUserRole.trim()) ? currentUserRole.trim().slice(0, 40) : '';
      if (!email) return 'signed-in user (not known)';
      return role ? email + ' (' + role + ')' : email;
    };
    const exportLabelFor = (manifest, usingLive) => {
      let mod = null; try { mod = (window.HE && window.HE.reports && window.HE.reports['he-export-label']) || null; } catch (e) { mod = null; }
      if (!mod || !manifest) return null;
      const label = mod.labelExport(manifest, { exportedBy: exportLabelWho(), at: null, purpose: 'owner review', classification: usingLive ? 'CONFIDENTIAL' : 'INTERNAL' });
      return { label: label, check: mod.verifyLabel(label, manifest) };
    };
    const opsInvoiceMod = () => { try { return (window.HE && window.HE.invoice && window.HE.invoice['he-invoice']) || null; } catch (e) { return null; } };
    function loadReportExportPreview() {
      const host = document.getElementById('reportExportHost'); if (!host) return;
      if (!(typeof reportExportOn === 'function' && reportExportOn())) { host.replaceChildren(); return; }
      const rx = opsReportsMod();
      if (!rx) { host.replaceChildren(h('p', { class: 'empty' }, 'Export preview tools could not load.')); return; }
      // L1: package the SAME nightly rows Report History loaded when they are
      // available; fall back to a synthetic day-set only when none are saved yet,
      // so the preview is meaningful in a fresh/empty database too.
      const live = (typeof reportHistoryRows === 'function') ? reportHistoryRows() : [];
      const usingLive = Array.isArray(live) && live.length > 0;
      const history = usingLive ? live : [
        { report_date: '2026-11-05', currency: 'USD', orders_count: 3, revenue: 120.50, new_inquiries_count: 2, tasks_opened_count: 1, incidents_opened_count: 0, ai_calls_count: 10, ai_cost: 0.42, emailed_at: '2026-11-06' },
        { report_date: '2026-11-06', currency: 'USD', orders_count: 0, revenue: 0, new_inquiries_count: 1, tasks_opened_count: 0, incidents_opened_count: 0, ai_calls_count: 4, ai_cost: 0.11 },
        { report_date: '2026-11-07', currency: 'USD', orders_count: 5, revenue: null, new_inquiries_count: 3, tasks_opened_count: 2, incidents_opened_count: 1, ai_calls_count: 7, ai_cost: 0.33 },
      ];
      const manifest = rx.buildManifest({ history: history });
      const v = rx.verifyManifest(manifest);
      const pm = rx.printModel({ history: history });
      const xl = exportLabelFor(manifest, usingLive);
      const kv = (k, val) => h('div', { class: 'scanCardRow' }, h('span', { class: 'u-c-muted' }, k + ': '), String(val));
      host.replaceChildren(h('div', { class: 'reorderPlan u-mb-16' },
        h('div', { class: 'scanHead' }, h('h3', null, 'Export preview'), h('span', { class: 'scanBadge' }, 'SIMULATED — writes no file, sends nothing')),
        h('div', { class: 'scanCard u-mt-8' },
          kv('Source', usingLive ? 'saved reports (' + history.length + ' day' + (history.length === 1 ? '' : 's') + ')' : 'demo data (no saved reports yet)'),
          kv('Format', manifest.format), kv('Rows', manifest.rowCount),
          kv('Date range', (manifest.range.from || '?') + ' → ' + (manifest.range.to || '?')),
          kv('Checksum', manifest.checksum + ' (' + manifest.checksumAlgorithm + ')'),
          kv('Integrity check', v.ok ? 'OK — checksum matches' : 'MISMATCH'),
          xl ? h('div', { class: 'scanCardRow', 'data-exportlabel': xl.check.ok ? 'ok' : 'mismatch' }, h('span', { class: 'u-c-muted' }, 'Trace label: '), xl.label.watermark + ' — ' + (xl.check.ok ? 'matches this export' : xl.check.reason)) : null,
          kv('Page', pm.page.page + ' (' + pm.page.widthPx + '×' + pm.page.heightPx + 'px) — print model, not a rendered PDF')),
        h('div', { class: 'scanToggleRow u-mt-8' }, h('button', { type: 'button', class: 'small', 'data-print': 'report' }, 'Print report (US-Letter preview)')),
        h('p', { class: 'hint u-mt-8' }, 'Values marked UNKNOWN were never measured (never shown as $0). Automatic Mac sync of the saved package is a separate component and is not enabled here.')));
    }
    // The one example invoice the preview and its print layout both show.
    // Owner decision of Nov 16: no tax rate is built in, and unknown tax is never
    // shown as 0 — so this example carries TAX PENDING (no figure) until a rate
    // is confirmed. Synthetic; nothing is issued.
    function draftTaxInput(tf) {
      if (!tf) return { taxRate: null, taxRateStatus: 'PENDING', taxPendingReasons: ['the tax rules could not load'] };
      const out = { taxRate: tf.taxRate, taxRateStatus: tf.taxRateStatus, taxShipping: tf.taxShipping === true, taxExempt: tf.taxExempt === true };
      if (tf.taxPlace) out.taxPlace = tf.taxPlace;
      if (tf.taxExemptReason) out.taxExemptReason = tf.taxExemptReason;
      if (tf.pendingReasons && tf.pendingReasons.length) out.taxPendingReasons = tf.pendingReasons.slice();
      return out;
    }
    function previewInvoiceDraft(inv) {
      let taxMod = null; try { taxMod = (window.HE && window.HE.invoice && window.HE.invoice['he-tax']) || null; } catch (e) { taxMod = null; }
      const tf = (taxMod && typeof taxMod.invoiceTaxFields === 'function') ? taxMod.invoiceTaxFields({ shipping: { amount: 12.5, mandatory: true } }) : null;
      return inv.draftInvoice(Object.assign({ lines: [
        { sku: 'HE-HONEY-8OZ', description: 'Honey Milk 8 oz', quantity: 10, unitPrice: 18.50, discount: 5, lotNumber: 'LOT-A' },
        { sku: 'HE-VEGAN-8OZ', description: 'Vegan 8 oz', quantity: 4, unitPrice: 18.50, lotNumber: 'LOT-B' },
      ], orderDiscount: 10, shipping: 12.5, currency: 'USD', terms: 'DUE_ON_RECEIPT',
      billTo: { name: 'SYNTHETIC Wholesale Buyer', lines: ['100 Example Street', 'Example City, IL 60000'] } }, draftTaxInput(tf)));
    }
    // The review desk for generated drafts (owner decision #3's manual step), as a
    // worked example: confirm a tax rate for a place, issue, void. State lives in
    // this page only; nothing is stored, sent or charged, and the signed-in
    // person's real role decides what is allowed. The example orders cover the
    // cases of the Nov 16 decision: shipping stated separately and optional,
    // mandatory shipping, wholesale resale with a verified exemption document,
    // resale claimed without one, and shipping terms that were never recorded.
    let invoiceDesk = null;
    let invoiceDeskSkipped = [];
    let invoiceDeskMessage = '';
    let invoiceDeskSales = {};          // order id -> the facts its tax depends on
    let invoiceDeskRates = [];          // rates confirmed in this example, one per place
    function invoiceDeskTaxFields(taxMod, orderId) {
      const sale = invoiceDeskSales[String(orderId)];
      if (!taxMod || !sale) return null;
      return taxMod.invoiceTaxFields(Object.assign({}, sale, { rateSetting: taxMod.rateSettingFor(invoiceDeskRates, sale.place) }));
    }
    function invoiceDeskOpen(inv, taxMod) {
      const exLines = [{ sku: 'HE-HONEY-8OZ', product_name: 'Honey Milk 8 oz', quantity: 6, unit_price: 18.50, line_total: 111 }];
      const A = 'Example City A, IL', B = 'Example City B, IL';
      const exOrders = [
        { id: 'SYN-O-2001', order_number: 'SYN-2001', status: 'paid', currency: 'USD', shipping_total: 9, items: exLines },
        { id: 'SYN-O-2002', order_number: 'SYN-2002', status: 'paid', currency: 'USD', shipping_total: 0, items: [{ sku: 'HE-VEGAN-8OZ', product_name: 'Vegan 8 oz', quantity: 3, unit_price: null }] },
        { id: 'SYN-O-2003', order_number: 'SYN-2003', status: 'cancelled', currency: 'USD', items: exLines },
        { id: 'SYN-O-2004', order_number: 'SYN-2004', status: 'paid', currency: 'USD', items: exLines },
        { id: 'SYN-O-2005', order_number: 'SYN-2005', status: 'paid', currency: 'USD', shipping_total: 12, items: exLines },
        { id: 'SYN-O-2006', order_number: 'SYN-2006', status: 'paid', currency: 'USD', shipping_total: 9, items: exLines },
        { id: 'SYN-O-2007', order_number: 'SYN-2007', status: 'paid', currency: 'USD', shipping_total: 0, items: exLines },
        { id: 'SYN-O-2008', order_number: 'SYN-2008', status: 'paid', currency: 'USD', shipping_total: 7, items: exLines },
      ];
      invoiceDeskRates = [];
      invoiceDeskSales = {
        'SYN-O-2001': { place: A, shipping: { amount: 9, separatelyStated: true, avoidable: true } },           // optional shipping
        'SYN-O-2002': { place: A, shipping: { amount: 0 } },
        'SYN-O-2005': { place: B, shipping: { amount: 12, mandatory: true } },                                // mandatory shipping
        'SYN-O-2006': { place: A, shipping: { amount: 9, mandatory: true }, resale: true, asOf: '2026-11-16',  // verified resale
          resaleCertificate: { number: 'SYN-RESALE-0001', verified: true, verifiedBy: 'owner (example)', verifiedAt: '2026-11-01', expiresOn: '2027-11-01' } },
        'SYN-O-2007': { place: A, shipping: { amount: 0 }, resale: true, asOf: '2026-11-16',                   // resale claimed, not verified
          resaleCertificate: { number: 'SYN-RESALE-0002', verified: false } },
        'SYN-O-2008': { place: A, shipping: { amount: 7 } },                                                  // shipping terms not recorded
      };
      const gen = inv.draftsForOrders(exOrders, [{ orderId: 'SYN-O-2004', status: 'issued' }], {
        taxFieldsFor: ord => invoiceDeskTaxFields(taxMod, ord.id),
        accountFor: ord => ({ id: 'SYN-ACCT', creditApproved: ord.id === 'SYN-O-2002' }),
      });
      invoiceDesk = inv.openDesk(gen.drafts, { usedNumbers: [] });
      invoiceDeskSkipped = gen.skipped.map(k => { const src = exOrders.find(x => x.id === k.orderId); return { orderId: k.orderId, label: (src && src.order_number) || String(k.orderId), reason: k.reason }; });
    }
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-invoicedesk]'); if (!t) return;
      const inv = opsInvoiceMod(); if (!inv || typeof inv.openDesk !== 'function') return;
      let taxMod = null; try { taxMod = (window.HE && window.HE.invoice && window.HE.invoice['he-tax']) || null; } catch (err) { taxMod = null; }
      const act = t.getAttribute('data-invoicedesk');
      const who = { role: currentUserRole, by: String(currentUserRole || 'unknown') + ' (example)', now: new Date().toISOString() };
      if (act === 'reset' || !invoiceDesk) { invoiceDesk = null; invoiceDeskMessage = ''; loadInvoicePreview(); return; }
      let out = null;
      if (act === 'confirm-tax') {
        const place = t.getAttribute('data-place') || '';
        const el = t.closest('.heField') ? t.closest('.heField').querySelector('input') : null;
        const raw = el ? String(el.value).trim().replace('%', '') : '';
        const pct = raw === '' ? NaN : Number(raw);
        if (!isFinite(pct) || pct < 0 || pct > 25 || !taxMod || !place) { invoiceDeskMessage = 'Not confirmed: type the full tax rate for ' + (place || 'this place') + ' as a percent between 0 and 25, for example 8.75.'; loadInvoicePreview(); announce(invoiceDeskMessage); refocusLike(t); return; }
        const before = invoiceDeskRates;
        invoiceDeskRates = before.filter(r => r.place !== place).concat([{ place: place, rate: Math.round(pct * 1000) / 100000, confirmedBy: who.by, confirmedAt: who.now }]);
        out = inv.deskConfirmTax(invoiceDesk, item => invoiceDeskTaxFields(taxMod, item.orderId), who);
        if (!out.ok) invoiceDeskRates = before;
        invoiceDeskMessage = out.ok
          ? 'Rate ' + pct + '% confirmed for ' + place + ': ' + out.changed + ' draft(s) now carry tax' + (out.stillPending ? '; ' + out.stillPending + ' still pending (each says why)' : '') + '. Recorded as a revision on each draft.'
          : 'Not confirmed: ' + out.reason + '.';
      } else if (act === 'issue') {
        out = inv.deskIssue(invoiceDesk, t.getAttribute('data-order'), who);
        invoiceDeskMessage = out.ok ? 'Issued as ' + out.number + ' (simulated).' : 'Not issued: ' + out.reason + '.';
      } else if (act === 'void') {
        const el = document.getElementById('invoiceDeskReason');
        out = inv.deskVoid(invoiceDesk, t.getAttribute('data-number'), Object.assign({ reason: el ? el.value : '' }, who));
        invoiceDeskMessage = out.ok ? 'Voided ' + t.getAttribute('data-number') + '. Its number stays on the record and is not reused.' : 'Not voided: ' + out.reason + '.';
      }
      if (out && out.ok) invoiceDesk = out.desk;
      loadInvoicePreview(); announce(invoiceDeskMessage); refocusLike(t);
    });
    function loadInvoicePreview() {
      const host = document.getElementById('invoicePreviewHost'); if (!host) return;
      if (!(typeof invoicePreviewOn === 'function' && invoicePreviewOn())) { host.replaceChildren(); return; }
      const inv = opsInvoiceMod();
      if (!inv) { host.replaceChildren(h('p', { class: 'empty' }, 'Invoice preview tools could not load.')); return; }
      const draft = previewInvoiceDraft(inv);
      const slip = inv.packingSlip({ orderId: 'SYN-preview', shipmentId: 'SYN-preview-s1', allocations: [
        { sku: 'HE-HONEY-8OZ', quantity: 6, lotNumber: 'LOT-A' }, { sku: 'HE-VEGAN-8OZ', quantity: 4, lotNumber: 'LOT-B' },
      ] });
      const lineRows = draft.lines.map(l => h('tr', null,
        h('td', null, h('div', { class: 'taskTitle' }, l.sku || '—'), h('div', { class: 'u-fs-11 u-c-muted' }, l.description || '')),
        h('td', { class: 'num-cell' }, String(l.quantity)),
        h('td', { class: 'num-cell' }, fmtMoney(l.unitPrice, draft.currency)),
        h('td', { class: 'num-cell' }, l.discount ? fmtMoney(l.discount, draft.currency) : '—'),
        h('td', { class: 'num-cell' }, fmtMoney(l.lineTotal, draft.currency))));
      // One line of the totals block: a figure, or the words that stand in for a
      // figure that is not known yet (tax pending) — never $0.00 for unknown.
      const totalsBlock = inv.totalsLines(draft).map(l => h('div', { class: 'scanCardRow', 'data-total': l.key },
        h('span', { class: 'u-c-muted' }, l.label + ': '),
        h('span', { class: l.key === 'total' ? 'taskTitle' : '' }, l.amount == null ? l.text : fmtMoney(l.amount, draft.currency) + (l.text ? ' — ' + l.text : ''))));
      const slipRows = slip.lines.map(l => h('div', { class: 'scanCardRow' }, (l.sku || '—') + ' × ' + l.quantity + ' · lot ' + (l.lotNumber || '—') + (l.unitPrice === undefined ? '' : ' · ' + fmtMoney(l.unitPrice, 'USD'))));
      // Proposed numbering (O1): suggest the next number in the HE-YYYY-NNNN
      // format. This only PROPOSES; nothing is issued. Owner confirms the scheme.
      const suggested = (typeof inv.nextInvoiceNumber === 'function') ? inv.nextInvoiceNumber({ year: new Date().getFullYear() }) : null;
      const hdr = (typeof inv.invoiceHeader === 'function') ? inv.invoiceHeader({ number: suggested ? suggested.number : null }) : null;
      // Owner decisions shown on the example (draft only). Tax: nothing is built
      // in — the example stays TAX PENDING until a rate is confirmed (Nov 16).
      const taxMod = (function () { try { return window.HE.invoice['he-tax']; } catch (e) { return null; } })();
      const taxInfo = taxMod ? taxMod.computeTax({ subtotal: draft.subtotal, orderDiscount: draft.orderDiscount, shipping: { amount: draft.shipping, mandatory: true } }) : null;
      const terms = (typeof inv.termsForAccount === 'function') ? inv.termsForAccount({}) : 'DUE_ON_RECEIPT';
      const dueDate = (typeof inv.dueDateFor === 'function') ? inv.dueDateFor('2026-11-14', terms) : null;
      // The same rules applied inside the invoice itself: whether it could be
      // issued. Pending tax blocks issuing.
      const issueCheck = inv.issue(draft, { role: 'owner', number: suggested ? suggested.number : 'HE-0000-0000', now: '2026-11-14T00:00:00Z', account: {} });
      const decisionsCard = taxInfo ? h('div', { class: 'scanCard u-mt-8', 'data-taxstatus': taxInfo.status },
        h('div', { class: 'scanCardHead' }, 'Per your decisions (draft example — nothing issued)'),
        h('div', { class: 'scanCardRow' }, taxInfo.status === 'PENDING'
          ? 'Tax: PENDING — no tax rate is built into the dashboard. A rate applies only after you confirm it for a named place.'
          : 'Tax: ' + taxInfo.status.toLowerCase()),
        h('div', { class: 'scanCardRow' }, 'Shipping: taxed when it is bundled or mandatory; not taxed when it is stated separately and the buyer could avoid it (for example pickup); pending when the terms were not recorded.'),
        h('div', { class: 'scanCardRow' }, 'Wholesale resale: exempt only with a verified exemption document on file; otherwise taxed like any other order.'),
        h('div', { class: 'scanCardRow' }, 'Payment terms: ' + (terms === 'NET_14' ? 'Net 14' : 'Due on receipt') + (dueDate ? ' · due ' + dueDate : '')),
        h('div', { class: 'scanCardRow', 'data-issuecheck': issueCheck && issueCheck.ok ? 'allowed' : 'blocked' }, 'Invoice total under these rules: ' + (draft.total == null ? 'pending (' + fmtMoney(draft.totalBeforeTax, draft.currency) + ' before tax)' : fmtMoney(draft.total, draft.currency)) + ' · issuing: ' + (issueCheck && issueCheck.ok ? 'would be allowed' : 'blocked — ' + (issueCheck ? issueCheck.reason : 'not checked'))),
        taxInfo.note ? h('div', { class: 'u-fs-11 u-c-muted' }, taxInfo.note) : null) : null;
      // Owner decision #3: drafts are generated automatically from orders and
      // wait for the owner to review and issue them. Example orders; nothing is
      // issued or numbered. An order that already has an invoice, or was
      // cancelled, gets no draft and the reason is shown.
      let autoDraftsCard = null;
      if (typeof inv.draftsForOrders === 'function' && typeof inv.openDesk === 'function') {
        if (!invoiceDesk) invoiceDeskOpen(inv, taxMod);
        const desk = invoiceDesk;
        const termsWord = t => t === 'NET_14' ? 'Net 14' : 'Due on receipt';
        // The places that still have a pending draft: each gets its own rate.
        const pendingPlaces = [];
        desk.items.forEach(it => { const pl = it.draft.taxPlace; if (it.draft.taxRateStatus === 'PENDING' && pl && pendingPlaces.indexOf(pl) < 0 && !invoiceDeskRates.some(r => r.place === pl)) pendingPlaces.push(pl); });
        const taxWords = d => d.taxRateStatus === 'EXEMPT' ? 'tax $0.00 — ' + (d.taxExemptReason || 'resale exempt')
          : d.taxRateStatus === 'PENDING' ? 'TAX PENDING — ' + ((d.taxPendingReasons && d.taxPendingReasons.length) ? d.taxPendingReasons.join('; ') : 'not confirmed yet')
          : 'tax ' + fmtMoney(d.tax, d.currency) + ' at ' + (Math.round(d.taxRate * 100000) / 1000) + '% (' + (d.taxPlace || 'place not recorded') + (d.taxShipping ? ', shipping taxed' : ', shipping not taxed') + ')';
        autoDraftsCard = h('div', { class: 'scanCard u-mt-8 invoiceDesk', 'data-autodrafts': String(desk.items.length) },
          h('div', { class: 'scanCardHead' }, 'Drafts generated from orders — waiting for your review (example orders)'),
          ...desk.items.map(it => h('div', { class: 'scanCardRow', 'data-autodraft': it.orderId },
            'Order ' + (it.draft.orderNumber || it.orderId) + ' · ' + (it.draft.total == null ? 'total pending (' + fmtMoney(it.draft.totalBeforeTax, it.draft.currency) + ' before tax)' : fmtMoney(it.draft.total, it.draft.currency)) + ' · ' + termsWord(it.draft.terms) + ' · draft, not issued ',
            h('button', { type: 'button', class: 'small secondary', 'data-invoicedesk': 'issue', 'data-order': String(it.orderId), 'aria-label': 'Issue the draft for order ' + (it.draft.orderNumber || it.orderId) + ' (simulated)' }, 'Issue (simulated)'),
            h('div', { class: 'u-fs-11 u-c-muted', 'data-taxline': it.draft.taxRateStatus || 'PENDING' }, taxWords(it.draft)),
            it.checks.length ? h('div', { class: 'u-fs-11 u-c-muted' }, 'To check: ' + it.checks.join('; ')) : null)),
          ...invoiceDeskSkipped.map(k => h('div', { class: 'scanCardRow u-c-muted', 'data-autodraft-skipped': String(k.orderId) }, 'No draft for order ' + k.label + ': ' + k.reason)),
          ...pendingPlaces.map((pl, n) => h('div', { class: 'heField u-mt-8', 'data-taxplace': pl },
            h('label', { for: 'invoiceDeskRate' + n }, 'Full tax rate for ' + pl + ', percent ', h('span', { class: 'heOpt' }, '(example only — not saved anywhere)')),
            h('input', { type: 'text', inputmode: 'decimal', id: 'invoiceDeskRate' + n, maxlength: '6', placeholder: 'e.g. 8.75' }),
            h('div', { class: 'scanToggleRow u-mt-6' }, h('button', { type: 'button', class: 'small', 'data-invoicedesk': 'confirm-tax', 'data-place': pl }, 'Confirm rate for ' + pl)))),
          desk.issued.length ? h('div', { class: 'scanCardHead u-mt-10' }, 'Issued in this example (simulated — nothing was sent or stored)') : null,
          ...desk.issued.map(x => h('div', { class: 'scanCardRow', 'data-issued': x.number, 'data-issued-status': x.status },
            x.number + ' · order ' + (x.orderNumber || x.orderId) + ' · ' + fmtMoney(x.total, x.currency) + ' · ' + termsWord(x.terms) + ' · due ' + (x.dueDate || '—') + ' · ' + (x.status === 'void' ? 'VOID — the number stays on the record ' : 'issued '),
            x.status === 'void' ? null : h('button', { type: 'button', class: 'small secondary', 'data-invoicedesk': 'void', 'data-number': x.number, 'aria-label': 'Void invoice ' + x.number + ' (simulated)' }, 'Void (simulated)'))),
          desk.issued.some(x => x.status !== 'void') ? h('div', { class: 'heField u-mt-8' },
            h('label', { for: 'invoiceDeskReason' }, 'Reason for voiding ', h('span', { class: 'heOpt' }, '(required)')),
            h('input', { type: 'text', id: 'invoiceDeskReason', maxlength: '200', placeholder: 'e.g. Entered twice' })) : null,
          invoiceDeskMessage ? h('p', { class: 'hint u-mt-8', 'data-invoicedesk-msg': '1' }, invoiceDeskMessage) : null,
          h('div', { class: 'scanToggleRow u-mt-8' }, h('button', { type: 'button', class: 'small secondary', 'data-invoicedesk': 'reset' }, 'Reset example')),
          h('div', { class: 'u-fs-11 u-c-muted u-mt-6' }, 'Drafts only — nothing is issued or numbered until the owner or an administrator issues it. In this example "Issue" only reserves a number inside this page.'));
      }
      host.replaceChildren(h('div', { class: 'reorderPlan u-mb-16' },
        h('div', { class: 'scanHead' }, h('h3', null, 'Invoice preview'), h('span', { class: 'scanBadge' }, 'SIMULATED — draft only, nothing issued or charged')),
        hdr ? h('div', { class: 'scanCard u-mt-8' },
          h('div', { class: 'taskTitle' }, hdr.businessName),
          h('div', { class: 'u-fs-11 u-c-muted' }, hdr.addressLines.join(' · ')),
          h('div', { class: 'u-fs-11 u-c-muted' }, hdr.remitTo),
          hdr.placeholder ? h('div', { class: 'u-fs-11 u-c-muted' }, 'Business address & remit-to are placeholders — owner to confirm.') : null) : null,
        suggested ? h('div', { class: 'scanCard u-mt-8' },
          h('div', { class: 'scanCardRow' }, h('span', { class: 'u-c-muted' }, 'Suggested number (proposed): '), h('span', { class: 'taskTitle' }, suggested.number)),
          h('div', { class: 'u-fs-11 u-c-muted' }, 'Format ' + suggested.format + ' — per-year, gap-free. Owner can change the scheme; nothing is issued.')) : null,
        h('table', { class: 'phoneCards u-mt-10' },
          h('thead', null, h('tr', null, h('th', null, 'Item'), h('th', { class: 'num-cell' }, 'Qty'), h('th', { class: 'num-cell' }, 'Unit'), h('th', { class: 'num-cell' }, 'Disc'), h('th', { class: 'num-cell' }, 'Line'))),
          h('tbody', null, lineRows)),
        h('div', { class: 'scanCard u-mt-8' },
          totalsBlock),
        decisionsCard,
        autoDraftsCard,
        h('div', { class: 'scanCard u-mt-8' }, h('div', { class: 'scanCardHead' }, 'Packing slip — not an invoice, not a carrier label'), slipRows),
        h('div', { class: 'scanToggleRow u-mt-8' },
          h('button', { type: 'button', class: 'small', 'data-print': 'invoice' }, 'Print invoice (US-Letter)'),
          h('button', { type: 'button', class: 'small secondary', 'data-print': 'slip' }, 'Print packing slip'),
          h('button', { type: 'button', class: 'small secondary', 'data-print': 'slip4x6' }, 'Print 4×6 label slip')),
        h('p', { class: 'hint u-mt-8' }, 'Invoices and packing slips print on US Letter (your Brother printer), in black only. The 4×6 label slip is for your Rollo label printer: choose the Rollo and paper size 4 × 6 in the print window.'),
        h('p', { class: 'hint u-mt-8' }, 'Draft preview only. Drafts are generated automatically; issuing one is done by hand by the owner or an administrator and is not enabled here (owner decision of Nov 14).')));
    }

    // L3: build a US-Letter print layout of the draft invoice into the body-level
    // print host and open the browser print dialog. The @media print rules hide
    // the dashboard and lay each modelled page onto its own sheet with the table
    // heading repeated. Pure DOM via h(); the host is empty until this runs.
    function renderInvoicePrint() {
      const host = document.getElementById('invoicePrintHost'); if (!host) return;
      const inv = opsInvoiceMod(); if (!inv) return;
      // Nov 16: a draft prints no number. Numbers are given only when an invoice
      // is issued; a printed draft carrying one could be taken for a real invoice.
      const draft = previewInvoiceDraft(inv);
      const doc = inv.invoicePrint(Object.assign({}, draft, { number: null }));
      const cur = doc.totals.currency;
      const termsWord = doc.terms === 'NET_14' ? 'Net 14' : (doc.terms === 'DUE_ON_RECEIPT' ? 'Due on receipt' : '—');
      const party = (title, who) => h('div', { class: 'printParty' }, h('div', { class: 'printLabel' }, title),
        who ? [h('div', null, who.name || '—')].concat((who.lines || []).map(x => h('div', null, x))) : h('div', null, '—'));
      const pages = doc.pages.map(function (p) {
        return h('div', { class: 'printPage' },
          doc.watermark ? h('div', { class: 'printMark', 'data-printmark': doc.taxPending ? 'tax-pending' : 'draft' }, doc.watermark) : null,
          h('div', { class: 'printHdr' }, h('div', { class: 'taskTitle' }, doc.header.businessName),
            doc.header.addressLines.map(x => h('div', null, x)),
            h('div', { 'data-printnumber': doc.header.number ? 'issued' : 'draft' }, 'Invoice ' + (doc.header.number || '(draft — numbered when issued)') + ' — SIMULATED'),
            h('div', null, 'Page ' + p.pageNo + ' of ' + p.totalPages)),
          p.pageNo === 1 ? h('div', { class: 'printMeta' },
            party('Bill to', doc.billTo), party('Ship to', doc.shipTo),
            h('div', { class: 'printParty' },
              h('div', null, h('span', { class: 'printLabel' }, 'Issue date: '), doc.issueDate ? String(doc.issueDate).slice(0, 10) : 'not issued'),
              h('div', null, h('span', { class: 'printLabel' }, 'Terms: '), termsWord),
              h('div', null, h('span', { class: 'printLabel' }, 'Due: '), doc.dueDate || (doc.issueDate ? '—' : 'set when issued')))) : null,
          h('table', null,
            h('thead', null, h('tr', null, p.headings.map(function (x) { return h('th', null, x); }))),
            h('tbody', null, p.rows.map(function (l) {
              return h('tr', null, h('td', null, l.sku || '—', l.description ? h('div', null, l.description) : null), h('td', null, String(l.quantity)),
                h('td', null, fmtMoney(l.unitPrice, cur)), h('td', null, l.discount ? fmtMoney(l.discount, cur) : '—'),
                h('td', null, fmtMoney(l.lineTotal, cur)));
            }))),
          p.showTotals ? h('div', { class: 'printTotals' },
            doc.totalsLines.map(l => h('div', { class: 'printTotalRow' + (l.key === 'total' ? ' printGrand' : ''), 'data-printtotal': l.key },
              h('span', null, l.label), h('span', null, l.amount == null ? l.text : fmtMoney(l.amount, cur) + (l.text ? ' — ' + l.text : '')))),
            doc.taxPending ? h('div', { 'data-printnote': 'tax-pending' }, 'DRAFT — the tax is pending and is not included in any figure above. Not a final invoice.') : null,
            h('div', { class: 'printRemit' }, doc.header.remitTo)) : null);
      });
      host.replaceChildren(h('div', { class: 'printDoc' }, pages));
      try { window.print(); } catch (e) {}
    }
    // Nov 23: the 4 x 6 label sheet (assets/print/he-print-label.css) is on only
    // while a label slip prints; everything else keeps US Letter.
    function setLabelSheet(on) {
      const l = document.getElementById('labelPrintCss'); if (!l) return;
      l.media = on ? 'print' : 'not all';
    }
    window.addEventListener('afterprint', function () { setLabelSheet(false); });
    document.addEventListener('click', function (e) {
      const t = e.target.closest('[data-print]'); if (!t) return;
      const what = t.getAttribute('data-print');
      setLabelSheet(what === 'slip4x6');
      if (what === 'invoice') renderInvoicePrint();
      else if (what === 'report') renderReportPrint();
      else if (what === 'slip') renderPackingSlipPrint();
      else if (what === 'slip4x6') renderPackingSlipPrint('4x6');
    });

    // follow-on: US-Letter packing-slip print (lot numbers, prices hidden by
    // default, explicitly not an invoice and not a carrier label). Reuses the
    // print host + @media print rules. Pure DOM; window.print wrapped.
    function renderPackingSlipPrint(size) {
      const host = document.getElementById('invoicePrintHost'); if (!host) return;
      const inv = opsInvoiceMod(); if (!inv || typeof inv.packingSlipPrint !== 'function') return;
      const slip = inv.packingSlip({ orderId: 'SYN-preview', shipmentId: 'SYN-preview-s1', allocations: [
        { sku: 'HE-HONEY-8OZ', quantity: 6, lotNumber: 'LOT-A' }, { sku: 'HE-VEGAN-8OZ', quantity: 4, lotNumber: 'LOT-B' },
      ] });
      const label = size === '4x6' && inv.LABEL_4X6;
      const doc = inv.packingSlipPrint(slip, label ? { page: inv.LABEL_4X6.page } : undefined);
      const pages = doc.pages.map(function (p) {
        return h('div', { class: 'printPage', 'data-printsize': label ? '4x6' : 'letter' },
          h('div', { class: 'printHdr' }, h('div', { class: 'taskTitle' }, 'Health Endeavors — Packing slip'),
            label ? h('div', { class: 'labelOrder' }, 'Order ' + (slip.orderId || '—')) : null,
            h('div', null, 'SIMULATED — not an invoice, not a carrier label'), h('div', null, 'Page ' + p.pageNo + ' of ' + p.totalPages)),
          h('table', null,
            h('thead', null, h('tr', null, p.headings.map(function (x) { return h('th', null, x); }))),
            h('tbody', null, p.rows.map(function (l) {
              const cells = [h('td', null, l.sku || '—'), h('td', label ? { class: 'labelQty' } : null, String(l.quantity)), h('td', null, l.lotNumber || '—')];
              if (doc.showPrices) cells.push(h('td', null, l.unitPrice === undefined ? '—' : fmtMoney(l.unitPrice, 'USD')));
              return h('tr', null, cells);
            }))));
      });
      host.replaceChildren(h('div', { class: 'printDoc' }, pages));
      try { window.print(); } catch (e) {}
    }

    // Packing slips for real orders (Nov 23; behind orderSlipsOn). The order's own
    // lines are read when the Orders page loads, so pressing Print opens the print
    // window straight away (Safari can refuse a print window opened after a wait).
    // Lot is left blank to write by hand. Not an invoice, not a carrier label (the
    // shipping label with the barcode comes from Shopify). Printing reads only.
    let slipOrders = [], slipItems = {}, slipItemsError = '';
    async function prefetchSlipItems(ids) {
      slipItemsError = '';
      if (!ids.length) { slipItems = {}; return; }
      try {
        const { data, error } = await supabase.from('order_items').select('id, order_id, sku, product_name, quantity').in('order_id', ids).limit(2000);
        if (error) throw error;
        const by = {}; (data || []).forEach(r => { (by[r.order_id] = by[r.order_id] || []).push(r); });
        slipItems = by;
      } catch (err) { slipItems = {}; slipItemsError = 'The order lines could not be read, so no slip can be printed. Refresh the page and try again.'; }
    }
    function loadOrderSlipsHost() {
      const host = document.getElementById('orderSlipsHost'); if (!host) return;
      if (!orderSlipsOn()) { host.replaceChildren(); return; }
      host.replaceChildren(h('div', { class: 'scanCard u-mb-10', 'data-slipsbox': '1' },
        h('div', { class: 'scanCardHead' }, 'Packing slips'),
        h('p', { class: 'hint u-m-0' }, 'Each order below has a 4×6 slip for the Rollo label printer and a Letter slip for the Brother. In the print window choose the printer and the paper size (4 × 6 for the Rollo), margins None, scale 100%. Lot is left blank to write by hand.'),
        h('div', { class: 'u-mt-8 u-d-flex u-gap-8 u-fwr-wrap' },
          h('button', { type: 'button', class: 'small secondary', 'data-printtest': '4x6' }, 'Test page: Rollo 4×6'),
          h('button', { type: 'button', class: 'small secondary', 'data-printtest': 'letter' }, 'Test page: Brother Letter')),
        h('p', { class: 'u-fs-12 u-mt-4', role: 'status', 'data-slipmessage': '1' })));
    }
    function slipMessage(text) {
      const m = document.querySelector('#orderSlipsHost [data-slipmessage]'); if (m) m.textContent = text;
      announce(text);
    }
    function renderOrderSlipPrint(order, items, size) {
      const host = document.getElementById('invoicePrintHost'); if (!host) return false;
      const inv = opsInvoiceMod(); if (!inv || typeof inv.packingSlipPrint !== 'function') return false;
      const label = size === '4x6';
      const num = order.order_number || order.id;
      const slip = inv.packingSlip({ orderId: num, allocations: items.map(it => ({ sku: it.sku || '', description: it.product_name || '', quantity: Number(it.quantity) || 0, lotNumber: null })) });
      const doc = inv.packingSlipPrint(slip, label ? { page: inv.LABEL_4X6.page } : undefined);
      const pages = doc.pages.map(function (p) {
        return h('div', { class: 'printPage', 'data-printsize': label ? '4x6' : 'letter', 'data-printorder': num },
          h('div', { class: 'printHdr' }, h('div', { class: 'taskTitle' }, 'Health Endeavors — Packing slip'),
            h('div', { class: label ? 'labelOrder' : 'printLabel' }, 'Order ' + num),
            h('div', null, [order.customer_name ? 'For: ' + order.customer_name : null, order.placed_at ? 'ordered ' + String(order.placed_at).slice(0, 10) : null].filter(Boolean).join(' · ')),
            h('div', null, 'Page ' + p.pageNo + ' of ' + p.totalPages + ' · not an invoice, not a shipping label')),
          h('table', null,
            h('thead', null, h('tr', null, p.headings.map(x => h('th', null, x)))),
            h('tbody', null, p.rows.map(l => h('tr', null,
              h('td', null, l.sku || '—', l.description ? h('div', null, l.description) : null),
              h('td', label ? { class: 'labelQty' } : null, String(l.quantity)),
              h('td', null, '________'))))),
          p.pageNo === p.totalPages ? h('div', { class: 'labelFoot' }, 'Packed by: ________   Checked: ☐') : null);
      });
      host.replaceChildren(h('div', { class: 'printDoc' }, pages));
      return true;
    }
    function renderPrinterTest(size) {
      const host = document.getElementById('invoicePrintHost'); if (!host) return;
      const label = size === '4x6';
      host.replaceChildren(h('div', { class: 'printDoc' }, h('div', { class: 'printPage printTest', 'data-printsize': label ? '4x6' : 'letter' },
        h('div', { class: 'taskTitle' }, 'Health Endeavors — printer test page'),
        h('div', null, label ? 'Rollo label printer · 4 × 6 inch label' : 'Brother · US Letter'),
        h('p', null, 'The frame should show on all four sides. If a side is cut off, set margins to None and scale to 100% and print again.'),
        h('div', { class: 'printInch' }, '1 inch'),
        h('p', null, 'The square above should measure exactly 1 inch. If it does not, the scale is not 100%.'),
        h('p', null, 'Black only: this page has no colour.'))));
    }
    document.addEventListener('click', function (e) {
      const t = e.target.closest('[data-printtest]'); if (!t) return;
      const size = t.getAttribute('data-printtest') === '4x6' ? '4x6' : 'letter';
      setLabelSheet(size === '4x6');
      renderPrinterTest(size);
      try { window.print(); } catch (err) {}
    });
    document.addEventListener('click', function (e) {
      const t = e.target.closest('#ordersTableWrap [data-slip]'); if (!t) return;
      const size = t.getAttribute('data-slip') === '4x6' ? '4x6' : 'letter';
      const order = slipOrders.find(o => o.id === t.getAttribute('data-order'));
      if (!order) { slipMessage('That order is no longer on the list. Refresh the page.'); return; }
      if (slipItemsError) { slipMessage(slipItemsError); return; }
      const items = (slipItems[order.id] || []).filter(it => Number(it.quantity) > 0);
      if (!items.length) { slipMessage('Order ' + (order.order_number || order.id) + ' has no items on file, so there is nothing to put on a slip.'); return; }
      setLabelSheet(size === '4x6');
      if (!renderOrderSlipPrint(order, items, size)) { slipMessage('The slip could not be prepared. Refresh the page.'); return; }
      slipMessage('');
      logCustomerAccess([order], 'Printed a packing slip in Owner Dashboard – Orders panel');
      try { window.print(); } catch (err) {}
    });

    // L-follow-on: build a US-Letter print layout of the daily report rows into
    // the body-level print host (reuses the invoice print host + @media print
    // rules). Uses the live saved rows when present, else the demo set. Pure DOM.
    function renderReportPrint() {
      const host = document.getElementById('invoicePrintHost'); if (!host) return;
      const rx = opsReportsMod(); if (!rx) return;
      const live = (typeof reportHistoryRows === 'function') ? reportHistoryRows() : [];
      const history = (Array.isArray(live) && live.length) ? live : [
        { report_date: '2026-11-05', currency: 'USD', orders_count: 3, revenue: 120.5, ai_calls_count: 10, ai_cost: 0.42 },
        { report_date: '2026-11-06', currency: 'USD', orders_count: 0, revenue: 0, ai_calls_count: 4, ai_cost: 0.11 },
        { report_date: '2026-11-07', currency: 'USD', orders_count: 5, revenue: null, ai_calls_count: 7, ai_cost: 0.33 },
      ];
      const pm = rx.printModel({ history: history, title: 'Daily report' });
      const xl = exportLabelFor(rx.buildManifest({ history: history }), false);
      const sum = pm.summary;
      const money = function (v) { return v === 'UNKNOWN' ? '?' : fmtMoney(v, 'USD'); };
      const num = function (v) { return v === 'UNKNOWN' ? '?' : String(v); };
      const bodyRows = pm.rows.map(function (r) {
        return h('tr', null, h('td', null, r.report_date), h('td', null, num(r.orders_count)),
          h('td', null, money(r.revenue)), h('td', null, num(r.new_inquiries_count)), h('td', null, num(r.ai_calls_count)), h('td', null, money(r.ai_cost)));
      });
      host.replaceChildren(h('div', { class: 'printDoc' }, h('div', { class: 'printPage' },
        h('div', { class: 'printHdr' }, h('div', { class: 'taskTitle' }, 'Health Endeavors — Daily report'),
          h('div', null, 'SIMULATED'), h('div', null, (pm.range.from || '?') + ' → ' + (pm.range.to || '?'))),
        h('table', null,
          h('thead', null, h('tr', null, h('th', null, 'Date'), h('th', null, 'Orders'), h('th', null, 'Revenue'), h('th', null, 'New questions'), h('th', null, 'AI calls'), h('th', null, 'AI cost'))),
          h('tbody', null, bodyRows)),
        h('div', { class: 'printTotals' }, 'Totals — orders: ' + num(sum.orders_count) + ' · revenue: ' + money(sum.revenue) + (sum.missing && sum.missing.revenue ? ' (' + sum.missing.revenue + ' day(s) UNKNOWN)' : '')),
        xl ? h('div', { class: 'printTotals', 'data-exportlabel': 'print' }, xl.label.watermark) : null)));
      try { window.print(); } catch (e) {}
    }

    // Export recovery drill (read-only; behind recoveryDrillOn). Shows a clean
    // package opening with its coverage, and a tampered package being rejected at
    // the checksum stage before anything is applied. Writes nothing.
    function loadRecoveryDrill() {
      const host = document.getElementById('recoveryDrillHost'); if (!host) return;
      if (!(typeof recoveryDrillOn === 'function' && recoveryDrillOn())) { host.replaceChildren(); return; }
      const rx = opsReportsMod();
      if (!rx || typeof rx.packageOf !== 'function') { host.replaceChildren(h('p', { class: 'empty' }, 'Recovery drill tools could not load.')); return; }
      const history = [
        { report_date: '2026-11-05', currency: 'USD', orders_count: 3, revenue: 120.5 },
        { report_date: '2026-11-06', currency: 'USD', orders_count: 2, revenue: 80 },
      ];
      const clean = rx.openPackage(rx.packageOf(rx.buildManifest({ history: history })));
      const tampered = rx.packageOf(rx.buildManifest({ history: history })); tampered.payload.reports[0].orders_count = 999;
      const bad = rx.openPackage(tampered);
      const missing = rx.openPackage(rx.packageOf(rx.buildManifest({ history: history })), { present: ['reports.json'] }); // drop summary.json + MANIFEST.txt
      const row = (label, res) => h('div', { class: 'scanCardRow' },
        h('span', { class: 'u-c-muted' }, label + ': '),
        res.ok ? ('opened — ' + (res.coverage ? res.coverage.days + ' day(s)' : 'ok') + ' applied') : ('rejected at ' + res.stage + ' — nothing applied'));
      host.replaceChildren(h('div', { class: 'reorderPlan u-mb-16' },
        h('div', { class: 'scanHead' }, h('h3', null, 'Export recovery drill'), h('span', { class: 'scanBadge' }, 'SIMULATED — read-only, backups untouched')),
        h('div', { class: 'scanCard u-mt-8' },
          h('div', { class: 'scanCardRow' }, h('span', { class: 'u-c-muted' }, 'Schema version: '), String(rx.SCHEMA_VERSION)),
          row('Clean package', clean), row('Tampered package', bad), row('Missing file', missing)),
        h('p', { class: 'hint u-mt-8' }, 'A restore refuses a bad checksum, a missing file or an unsupported version before applying anything. Automatic Mac sync is a separate component; existing backups are untouched.')));
    }

    // L1: the panel loaders run in parallel, so the export preview must render
    // AFTER Report History has loaded its rows. This awaits the load, then paints
    // the export preview over the now-loaded rows (the synthetic fallback inside
    // loadReportExportPreview covers the "no saved reports yet" case).
    async function loadReportHistoryThenExport() {
      await safeRun(loadReportHistory);
      loadReportExportPreview();
      loadOpsWatch();
    }
    const PANEL_LOADERS = {
      attentionPanel: [loadAttention, loadBusinessHealth, loadAttentionChecks, loadNightlyCheck, paintScanEntry, loadMoneyAlert],
      calendarPanel: [loadCalendarMonth],
      dailySummaryPanel: [loadDailySummary],
      reportHistoryPanel: [loadReportHistoryThenExport, loadRecoveryDrill, loadInvoicePreview, loadReportVersions],
      ordersPanel: [loadOrders, paintScanEntry, loadSavedViews, loadOrderSlipsHost],
      inventoryPanel: [loadInventory, loadInventoryAdjustments, loadReorderPlanning, loadSavedViews, loadCycleCount, loadPartialReceiving],
      returnsPanel: [loadReturns, loadStockReturns],
      suppliersPanel: [loadSuppliers, loadSupplierScorecard, loadSupplierDocs],
      purchaseOrdersPanel: [loadPurchaseOrders, loadDeliveries],
      qualityControlPanel: [loadQualityChecks],
      recallsPanel: [loadRecalls],
      expensesPanel: [loadExpenses, loadDeletedExpenses],
      accountingPanel: [loadAccounting, loadReconcile, loadInvoicePayments, loadMoneyMatch, loadMoneyIssues],
      taxRecordsPanel: [loadTaxRecords],
      tasksPanel: [loadTasks],
      incidentsPanel: [loadIncidents],
      evidenceLockerPanel: [loadEvidenceLocker],
      documentsPanel: [loadDocuments],
      adverseEventsPanel: [loadAdverseEvents],
      inquiriesPanel: [loadInquiries],
      aiPanel: [loadAI],
      continuityPanel: [loadContinuity, loadSystemStatus],
      flagsPanel: [loadFlags, loadSystemMode, loadPreviewSwitches],
      businessRulesPanel: [loadBusinessRules],
      approvalsPanel: [loadApprovals],
      sessionsPanel: [loadSessions],
      activityPanel: [loadActivityPeople, loadActivityAreas, loadActivityDigest, () => loadActivity(true)],
      sopsPanel: [loadSops],
      backupsPanel: [loadBackupsPage],
      featureRequestsPanel: [loadFeatureRequests, loadDeletedFeatureRequests],
      legalHoldsPanel: [loadLegalHolds, loadReleasedLegalHolds],
      salesCommandPanel:   [() => loadSales('salesCommandPanel')],
      salesLeadsPanel:     [() => loadSales('salesLeadsPanel')],
      salesPipelinePanel:  [() => loadSales('salesPipelinePanel')],
      salesApprovalsPanel: [() => loadSales('salesApprovalsPanel'), loadSalesWorkbench],
      salesVisitsPanel:    [() => loadSales('salesVisitsPanel')],
      salesRepurposePanel: [() => loadSales('salesRepurposePanel')],
      salesAdVariantsPanel:[() => loadSales('salesAdVariantsPanel')],
      salesFeedbackPanel:  [() => loadSales('salesFeedbackPanel')],
      salesCreatorOfferPanel: [() => loadSales('salesCreatorOfferPanel')],
      salesReminderPanel:  [() => loadSales('salesReminderPanel')],
      salesHealthPanel:    [() => loadSales('salesHealthPanel')],
      salesSamplesPanel:   [() => loadSales('salesSamplesPanel')],
      salesAnalyticsPanel: [() => loadSales('salesAnalyticsPanel')],
      salesAgentsPanel:    [() => loadSales('salesAgentsPanel')],
      salesLeadDetailPanel:  [() => loadSales('salesLeadDetailPanel')],
      salesRetentionPanel:   [() => loadSales('salesRetentionPanel')],
      salesContentPanel:     [() => loadSales('salesContentPanel')],
      salesTerritoryPanel:   [() => loadSales('salesTerritoryPanel')],
      salesCampaignPanel:    [() => loadSales('salesCampaignPanel')],
      salesDataQualityPanel: [() => loadSales('salesDataQualityPanel')],
      salesForecastPanel:    [() => loadSales('salesForecastPanel')],
      salesCostPanel:        [() => loadSales('salesCostPanel')],
      salesSafetyPanel:      [() => loadSales('salesSafetyPanel')],
      salesLostDealsPanel:   [() => loadSales('salesLostDealsPanel')],
      salesAnomalyPanel:     [() => loadSales('salesAnomalyPanel')],
      salesWorkloadPanel:    [() => loadSales('salesWorkloadPanel')],
      salesScorecardsPanel:  [() => loadSales('salesScorecardsPanel')],
      salesQueuePanel:         [() => loadSales('salesQueuePanel')],
      salesReadinessPanel:     [() => loadSales('salesReadinessPanel')],
      salesSourcesPanel:       [() => loadSales('salesSourcesPanel')],
      salesCreatorPanel:       [() => loadSales('salesCreatorPanel')],
      salesSampleAdvisorPanel: [() => loadSales('salesSampleAdvisorPanel')],
      salesChangesPanel:       [() => loadSales('salesChangesPanel')],
      salesReviewPanel:        [() => loadSales('salesReviewPanel')],
      salesPrivacyPanel:       [() => loadSales('salesPrivacyPanel')],
      salesContentPlannerPanel: [() => loadSales('salesContentPlannerPanel')],
      salesCommercialPanel:     [() => loadSales('salesCommercialPanel')],
      salesSettingsPanel:       [() => loadSales('salesSettingsPanel')],
      salesDecisionPanel:       [() => loadSales('salesDecisionPanel')],
      salesReportingPanel:      [() => loadSales('salesReportingPanel')],
      salesScenarioPanel:       [() => loadSales('salesScenarioPanel')],
      salesOutreachStudioPanel: [() => loadSales('salesOutreachStudioPanel')],
      salesReplyCenterPanel:    [() => loadSales('salesReplyCenterPanel')],
      salesExportPanel:         [() => loadSales('salesExportPanel')],
      salesMeetingPanel:        [() => loadSales('salesMeetingPanel')],
      salesSampleOsPanel:       [() => loadSales('salesSampleOsPanel')],
      salesAgentLabPanel:       [() => loadSales('salesAgentLabPanel')],
      salesAuditPanel:          [() => loadSales('salesAuditPanel')],
      salesBriefsPanel:         [() => loadSales('salesBriefsPanel')],
      salesPriorityPanel:       [() => loadSales('salesPriorityPanel')],
      salesProgressionPanel:    [() => loadSales('salesProgressionPanel')],
      salesConcentrationPanel:  [() => loadSales('salesConcentrationPanel')],
      salesNextActionPanel:     [() => loadSales('salesNextActionPanel')],
      salesReplyLabPanel:       [() => loadSales('salesReplyLabPanel')],
    };
    function refreshChrome(){
      renderSidebar(document.getElementById('sidebarSearch').value);
      decorateEmptyStates();
    }
    helpOverlay.id = 'helpOverlay';
    // Announced as a dialog by screen readers (EXT3).
    helpOverlay.setAttribute('role', 'dialog'); helpOverlay.setAttribute('aria-modal', 'true'); helpOverlay.setAttribute('aria-label', 'Guide');
    // EXT20J-post-TT: overlay scaffold built as DOM nodes (no innerHTML), so it
    // raises no Trusted Types violation even under strict enforcement.
    helpOverlay.replaceChildren(h('div', { class: 'helpCard' },
      h('h3', { id: 'helpTitle' }),
      h('div', { class: 'helpWhere', id: 'helpWhere' }),
      h('div', { id: 'helpBody' }),
      h('div', { class: 'helpFoot' },
        h('button', { type: 'button', class: 'small', id: 'helpGoBtn' }, 'Take me there'),
        h('button', { type: 'button', class: 'small secondary', id: 'helpCloseBtn' }, 'Close'))));
    document.body.appendChild(helpOverlay);
    let HELP_CURRENT = null;
    function openHelp(entry){
      HELP_CURRENT = entry;
      document.getElementById('helpTitle').textContent = entry.title;
      document.getElementById('helpWhere').textContent = PAGE_LABEL_BY_ID[entry.page] || '';
      document.getElementById('helpBody').replaceChildren(
        ...entry.body.split('|').map(p => h('p', null, p)));
      rememberFocus('help');
      helpOverlay.classList.add('open');
      focusDialog(helpOverlay);
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
    // EXT20J-post-TT: built as DOM nodes (no innerHTML).
    paletteOverlay.replaceChildren(h('div', { class: 'paletteCard' },
      h('input', { type: 'text', id: 'paletteInput', placeholder: 'Jump to a page or record, or ask how something works\u2026', autocomplete: 'off', spellcheck: 'false' }),
      h('div', { id: 'paletteResults' }),
      h('div', { class: 'paletteFoot' },
        h('span', null, h('kbd', null, '\u2191'), h('kbd', null, '\u2193'), ' move'),
        h('span', null, h('kbd', null, '\u21A9'), ' open'),
        h('span', null, h('kbd', null, 'esc'), ' close'))));
    document.body.appendChild(paletteOverlay);
    let PAL_ITEMS = [], PAL_SEL = 0;

    function paletteItems(q){
      const items = [];
      const query = (q || '').trim().toLowerCase();
      const pages = [];
      SIDEBAR_GROUPS.forEach(g => g.pages.forEach(p => {
        if (!query || p.label.toLowerCase().includes(query) || g.label.toLowerCase().includes(query)) {
          pages.push({ kind: g.label, label: p.label, pageId: p.id });
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
          kind: r.type, label: r.label, pageId: r.pageId, activitySearch: r.activitySearch,
        }));
        helpMatches(query).forEach(e => items.push({
          kind: 'Guide', label: e.title, pageId: e.page, help: e,
        }));
      }
      if (!query) items.push.apply(items, pages);
      return items.slice(0, 40);
    }
    function renderPalette(){
      const box = document.getElementById('paletteResults');
      if (!PAL_ITEMS.length) { box.replaceChildren(h('div', { class: 'pEmpty' }, 'Nothing matches that.')); return; }
      // EXT20J: rows built as DOM nodes (h() text-ifies label/kind, and the page
      // icon is a DOM node from pageIconNode) instead of an HTML string, so the
      // palette is safe under Trusted Types. The label and kind were already set
      // via textContent before, never interpolated into markup.
      box.replaceChildren(...PAL_ITEMS.map((it, i) =>
        h('div', { class: 'pResult' + (i === PAL_SEL ? ' sel' : ''), 'data-i': i },
          h('span', { class: 'pIcon' }, pageIconNode(it.pageId)),
          h('span', { class: 'pMain' }, it.label),
          h('span', { class: 'pKind' }, it.kind))));
      box.querySelectorAll('.pResult').forEach((el, i) => {
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
    // EXT20J-post-TT: the shortcuts grid built as DOM nodes (no innerHTML).
    // scKbd/scRow are tiny builders: a row is a label span + a span of keys.
    const scKbd = s => h('kbd', null, s);
    const scRow = (label, keys) => h('div', { class: 'scRow' }, h('span', null, label), h('span', null, ...keys));
    shortcutOverlay.replaceChildren(h('div', { class: 'shortcutCard' },
      h('h3', null, 'Keyboard shortcuts'),
      h('div', { class: 'scGrid' },
        h('div', { class: 'scGroup' }, h('h4', null, 'Anywhere'),
          scRow('Command palette', [scKbd('\u2318'), scKbd('K')]),
          scRow('Search pages', [scKbd('/')]),
          scRow('This list', [scKbd('?')]),
          scRow('Refresh data', [scKbd('\u2318'), scKbd('\u21E7'), scKbd('R')]),
          scRow('Close anything', [scKbd('esc')]),
          scRow('Back / forward', [scKbd('\u2318'), scKbd('['), ' ', scKbd('\u2318'), scKbd(']')]),
          scRow('New reminder', [scKbd('\u2318'), scKbd('N')]),
          scRow('Jump to pinned page', [scKbd('\u2318'), scKbd('1'), '\u2013', scKbd('9')]),
          scRow('Move through rows', [scKbd('J'), scKbd('K')]),
          scRow('Open the row', [scKbd('\u21A9')]),
          scRow('Inspect a record', [scKbd('space')]),
          scRow('Ask the guide', [scKbd('\u2318'), scKbd('K'), ' then type'])),
        h('div', { class: 'scGroup' }, h('h4', null, 'On the calendar'),
          scRow('Previous / next', [scKbd('\u2190'), scKbd('\u2192')]),
          scRow('Day / Week / Month', [scKbd('D'), scKbd('W'), scKbd('M')]),
          scRow('Jump to today', [scKbd('T')]),
          scRow('Save a note', [scKbd('\u2318'), scKbd('\u21A9')])),
        h('div', { class: 'scGroup' }, h('h4', null, 'Go to \u2014 press g, then\u2026'),
          scRow('Needs your attention', [scKbd('g'), scKbd('n')]),
          scRow('Orders', [scKbd('g'), scKbd('o')]),
          scRow('Inventory', [scKbd('g'), scKbd('i')]),
          scRow('Returns', [scKbd('g'), scKbd('r')]),
          scRow('Expenses', [scKbd('g'), scKbd('e')]),
          scRow('Tasks', [scKbd('g'), scKbd('t')]),
          scRow('Employee activity', [scKbd('g'), scKbd('a')]),
          scRow('Calendar', [scKbd('g'), scKbd('c')])))));
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
        // Nov 16: say "no matches" only when something was searched or filtered;
        // with nothing chosen, the honest message is that nothing is recorded.
        const val = id => { const el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; };
        const narrowed = ACTIVITY_PERSON || val('activitySearch') || (val('activityRange') && val('activityRange') !== 'all') || val('activityArea');
        wrap.replaceChildren(h('p', { class: 'empty' }, narrowed ? 'No activity matches that search.' : 'No changes recorded yet.'));
        return;
      }

      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const todayCount = rows.filter(r => new Date(r.happened_at).getTime() >= dayAgo).length;
      const peopleCount = new Set(rows.filter(r => r.person_account_number).map(r => r.person_account_number)).size;
      // EXT20J: stats and rows are DOM nodes (h() text-ifies) instead of HTML
      // strings, so Employee Activity is safe under Trusted Types.
      document.getElementById('activityStats').replaceChildren(
        h('div', { class: 'stat' }, h('div', { class: 'num' }, rows.length), h('div', { class: 'lbl' }, 'Entries loaded')),
        h('div', { class: 'stat' }, h('div', { class: 'num' }, todayCount), h('div', { class: 'lbl' }, 'Last 24 hours')),
        h('div', { class: 'stat' }, h('div', { class: 'num' }, peopleCount), h('div', { class: 'lbl' }, 'People in this list')));

      wrap.replaceChildren(...rows.map((r, i) => {
        const area = ACTIVITY_AREA_LABELS[r.table_name] || r.area || r.table_name;
        const roleKey = r.person_role || 'system';
        const roleLabel = r.person_role ? (ROLE_LABELS[r.person_role] || r.person_role) : 'System';
        return h('div', { class: 'actItem' + (r.action === 'DELETE' ? ' isDelete' : ''), 'data-index': i },
          h('div', { class: 'actRow' },
            h('div', { class: 'actMain' },
              h('div', { class: 'actHead' },
                h('span', { class: 'actWho' }, r.person_name),
                r.person_account_number ? h('span', { class: 'actNum' }, '#' + fmtAccountNumber(r.person_account_number)) : null,
                h('span', { class: 'badge role-' + roleKey }, roleLabel)),
              h('div', { class: 'actWhat' }, h('b', null, r.action_label), ' in ', h('b', null, area), ' · ' + recordTitle(r))),
            h('div', { class: 'actSide' },
              h('div', { class: 'actWhen' }, fmtDate(r.happened_at)),
              h('button', { type: 'button', class: 'small secondary actToggle', 'data-index': i }, 'Details'))),
          h('div', { class: 'actDetail u-d-none', id: 'actDetail' + i }));
      }));

      wrap.querySelectorAll('.actToggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const i = Number(btn.getAttribute('data-index'));
          const box = document.getElementById('actDetail' + i);
          if (!box) return;
          // EXT15: starts hidden by a class now (no inline style), so ask the computed style.
          if (getComputedStyle(box).display === 'none') {
            if (!box.childNodes.length) box.replaceChildren(...describeChange(ACTIVITY_ROWS[i]));
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
        // EXT20J: chips are DOM nodes (h() text-ifies) instead of an HTML
        // string, so the people strip is safe under Trusted Types.
        strip.replaceChildren(
          h('span', { class: 'peopleLbl' }, 'People'),
          h('button', { type: 'button', class: 'personChip' + (ACTIVITY_PERSON ? '' : ' active'), 'data-person': '' }, 'Everyone'),
          ...people.map(p => h('button', {
            type: 'button', class: 'personChip' + (ACTIVITY_PERSON === p.id ? ' active' : ''), 'data-person': p.id,
          }, (p.display_name || p.email) + ' · #' + fmtAccountNumber(p.account_number) + ' · ' + (ROLE_LABELS[p.role] || p.role))));
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
        // EXT20J: raw-state view built as DOM nodes (h() text-ifies) instead of
        // an HTML string, so the inspector is safe under Trusted Types.
        body.replaceChildren(
          h('div', { class: 'codeBlock' }, ...Object.keys(nd).map(k =>
            h('div', { class: 'cLine' }, h('span', { class: 'jKey' }, k), ': ', hlValue(nd[k])))),
          h('div', { class: 'insNote' }, 'As of ' + fmtDate(latest.happened_at) + " — the most recent recorded state, not necessarily the record's live value today."));
        return;
      }
      if (!INSPECTOR_HISTORY.length) {
        body.replaceChildren(h('p', { class: 'empty' }, 'No history found for this record.'));
        return;
      }
      // EXT20J: history list built as DOM nodes. The loop variable is `ev` (not
      // `h`) so it does not shadow the h() DOM builder used inside.
      body.replaceChildren(...INSPECTOR_HISTORY.map(ev => {
        const cls = ev.action === 'DELETE' ? 'isDelete' : ev.action === 'INSERT' ? 'isInsert' : 'isUpdate';
        const acct = ev.person_account_number ? ' · #' + fmtAccountNumber(ev.person_account_number) : '';
        return h('div', { class: 'insEvent ' + cls },
          h('div', { class: 'insWhen' }, fmtDate(ev.happened_at)),
          h('div', { class: 'insWho' }, ev.person_name + acct + ' — ' + ev.action_label),
          ...codeDiff(ev));
      }));
    }
    // Opens the inspector for any record anywhere in the dashboard, given the
    // area it belongs to and its id. Everything it shows comes back through the
    // same protected function as the Employee Activity list, so this can never
    // reveal more than that list already would.
    // The sidebar is redrawn when background loads finish; the lookup's
    // answer is kept (for the same search text) so it does not vanish.
    // EXT20J: the cached answer is a node-builder (() => array of DOM nodes),
    // rebuilt fresh each time it is shown, not an HTML string.
    let ORDER_LOOKUP = { q: null, render: null };
    function bindOrderLookupLinks(){
      document.querySelectorAll('#orderLookupResults .orderLookupLink').forEach(a => {
        a.addEventListener('click', () => openInspectorFor('orders', a.getAttribute('data-id'), a.getAttribute('data-num')));
        keyLink(a);
      });
    }
    // EXT8: order number or customer name, in every (not deleted) order,
    // matched literally; newest 20 shown. Opens the order's history.
    async function lookUpAllOrders(q){
      const btn = document.getElementById('orderLookupBtn');
      if (!btn || btn.disabled) return;
      btn.disabled = true;
      const show = render => {
        ORDER_LOOKUP = { q, render };
        const box = document.getElementById('orderLookupResults'); // may have been redrawn
        if (box) { box.replaceChildren(...render()); bindOrderLookupLinks(); }
      };
      show(() => [h('p', { class: 'hint u-m-4-10' }, 'Looking…')]);
      try {
        const pat = '%' + likeLiteral(q) + '%';
        // Inside PostgREST's quoted value, backslash and double quote are escaped.
        const quoted = '"' + pat.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
        const { data, error } = await supabase.from('orders')
          .select('id, order_number, customer_name, status, total, currency, placed_at')
          .is('deleted_at', null).or('order_number.ilike.' + quoted + ',customer_name.ilike.' + quoted)
          .order('placed_at', { ascending: false }).limit(20);
        if (error) throw error;
        if (!data || !data.length) { show(() => [h('p', { class: 'hint u-m-4-10' }, 'No order number or customer name contains this.')]); return; }
        const capped = data.length === 20;
        show(() => [
          ...(capped ? [h('p', { class: 'hint u-m-4-10' }, 'The newest 20 matches:')] : []),
          ...data.map(o => h('a', { class: 'sidebarLink orderLookupLink', 'data-id': o.id, 'data-num': o.order_number || '' },
            h('span', { class: 'resultType' }, 'Order'), h('br'),
            (o.order_number || o.id) + ' — ' + (o.customer_name || '—') + ' · ' + fmtMoney(o.total, o.currency) + ' · ' + (o.status || '—') + ' · ' + fmtDate(o.placed_at))),
        ]);
      } catch (err) {
        show(() => [h('p', { class: 'hint u-m-4-10 u-c-warn' }, 'Could not search orders: ' + explainDbError((err && err.message) || String(err)))]);
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
      focusDialog(document.getElementById('inspectorOverlay'));
      try {
        // All matches, page by page: other records whose text mentions this id
        // also match the search, and a 200-row cut could hide this record's
        // older history.
        const found = await fetchAllActivity({ p_search: recordId, p_area: tableName }, 5000);
        INSPECTOR_HISTORY = found.rows.filter(h => h.record_id === recordId);
        if (!INSPECTOR_HISTORY.length) {
          // EXT20J: DOM nodes (h() text-ifies) instead of an HTML string.
          document.getElementById('insBody').replaceChildren(
            h('p', { class: 'empty' }, 'No recorded history for this record yet.'),
            h('div', { class: 'insNote' }, "Either nothing has changed since activity recording was switched on, or this area isn't recorded."));
          return;
        }
        renderInspector();
      } catch (err) {
        document.getElementById('insBody').replaceChildren(
          h('p', { class: 'empty' }, explainDbError("Could not load this record's history: " + (err && err.message ? err.message : String(err)))));
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
        // This list and the checks higher up the page are two different things:
        // an empty list here does not mean the checks are clear (owner review,
        // Nov 3: Home showed urgent checks above and "Nothing needs your attention"
        // here). The message names exactly what is empty and points at the checks.
        document.getElementById('attentionWrap').replaceChildren(h('p', { class: 'empty', 'data-attention-empty': '1' }, 'No tasks, approvals, incidents, calendar events or reminders are waiting right now. The checks above are a separate list — look there too.'));
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
      // EXT8: an older reply never draws over a newer one. Without this, a load
      // still in flight from sign-in / page-show can paint a stale tile (e.g. a
      // pre-expiry "$0.00" AI-spend) over a newer post-refresh render, so an
      // expired read could look like a fresh zero. Matches the other loaders.
      const isLatest = newLoadToken('businessHealth');
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
        // EXT20J: tiles are DOM nodes (h() text-ifies) instead of HTML strings, so
        // Home is safe under Trusted Types. A failed read is still null -> "?"
        // (statUnknown, amber), never a misleading zero.
        const tile = (num, lbl, cls, goto) => {
          if (num === null) return h('div', { class: 'stat statWarn statUnknown' }, h('div', { class: 'num' }, '?'), h('div', { class: 'lbl' }, lbl + ' (could not be read)'));
          const inner = [h('div', { class: 'num' }, num), h('div', { class: 'lbl' }, lbl)];
          return goto
            ? h('button', { type: 'button', class: 'stat statLink ' + cls, 'data-goto': goto, 'aria-label': lbl + ': ' + String(num).replace(/<[^<>]*>/g, '') + '. Open that page.' }, ...inner)
            : h('div', { class: 'stat ' + cls }, ...inner);
        };

        if (!isLatest()) return; // a newer load started while these reads were in flight; let it win
        wrap.replaceChildren(
          tile(todayRevenue === null ? null : fmtMoney(todayRevenue, todayCurrency), todayMissingTotals ? "Today's revenue (" + todayMissingTotals + ' order' + (todayMissingTotals === 1 ? '' : 's') + ' without a total not counted)' : "Today's revenue", todayMissingTotals ? 'statWarn' : ''),
          tile(todayOrderCount, "Today's orders", ''),
          tile(pendingApprovals, 'Pending approvals', approvalsClass, 'approvalsPanel'),
          tile(overdueTasks, 'Overdue tasks', tasksClass, 'tasksPanel'),
          tile(criticalIncidents, 'Open high/critical incidents', incidentsClass, 'incidentsPanel'),
          // Unknown is not zero: if the switches couldn't be read, say so.
          agentControls().state === 'ok' ? tile(pausedAgents, 'Paused agents', agentsClass) : tile('?', 'Paused agents (switches could not be read)', 'statWarn'),
          tile(monthAiSpend === null ? null : fmtMoney(monthAiSpend, 'USD') + ' / ' + fmtMoney(AI_SPEND_CAP, 'USD'), 'AI spend this month', aiClass),
          tile(activeSessions, 'Active sessions', ''));
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
    // EXT20J-post-TT: built as DOM nodes (no innerHTML).
    quickAdd.replaceChildren(h('div', { class: 'quickAddCard' },
      h('h4', null, 'New reminder'),
      h('input', { type: 'text', id: 'quickAddInput', placeholder: 'What do you need to remember?', autocomplete: 'off' }),
      h('div', { class: 'quickAddRow' },
        h('select', { id: 'quickAddPriority' },
          h('option', { value: 'normal' }, 'Normal'),
          h('option', { value: 'high' }, 'High')),
        h('span', { class: 'grow' }),
        h('button', { type: 'button', class: 'small secondary', id: 'quickAddCancel' }, 'Cancel'),
        h('button', { type: 'button', class: 'small', id: 'quickAddSave' }, 'Add'))));
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

    // EXT20J: apply each element's data-cal-color as a background through the CSS
    // object model (not a static class), hex-guarded, so it is safe under the
    // style-src 'self' CSP (same approach as renderSidebar's group colours).
    function paintCalColors(root){
      root.querySelectorAll('[data-cal-color]').forEach(el => {
        const c = el.getAttribute('data-cal-color');
        if (/^#[0-9a-fA-F]{3,8}$/.test(c)) el.style.backgroundColor = c;
      });
    }
    function renderCalFilters(){
      const names = [...new Set(calEvents.map(ev => ev.calendar_name || 'Other'))].sort();
      const box = document.getElementById('calFilters');
      if (!names.length) { box.replaceChildren(); return; }
      // EXT20J: filter chips built as DOM nodes (h() text-ifies) instead of an
      // HTML string, so the calendar filter bar is safe under Trusted Types.
      box.replaceChildren(...names.map(n => {
        const off = calHidden.has(n);
        return h('button', { type: 'button', class: 'calChipBtn' + (off ? ' off' : ''), 'data-cal': n },
          h('span', { class: 'swatch', 'data-cal-color': colorForCalendar(n) }), n);
      }));
      // EXT20J: paint the per-calendar swatch colour through the CSS object model
      // (hex-guarded), the same CSP-safe pattern renderSidebar uses for group
      // colours — the static u-bg-colorforcalendar-* classes were invalid CSS and
      // never applied. An "off" chip keeps its muted swatch (its !important rule
      // outranks this non-important inline colour).
      paintCalColors(box);
      box.querySelectorAll('.calChipBtn').forEach(btn => {
        btn.addEventListener('click', () => {
          const n = btn.getAttribute('data-cal');
          if (calHidden.has(n)) calHidden.delete(n); else calHidden.add(n);
          renderCalFilters();
          renderCalendar();
        });
      });
    }

    // EXT20J: one event row as a DOM node (h() text-ifies) instead of an HTML
    // string. The nested editors (personalEventEditorHtml / noteEditorHtml) also
    // return nodes now, so the whole calendar is safe under Trusted Types.
    function eventHtml(ev){
      const note = calNotes[ev.uid];
      const open = calOpenUid === ev.uid;
      const personal = calMode === 'personal';
      const timeKids = ev.all_day
        ? [h('span', { class: 'calAllDay' }, 'All day')]
        : [fmtTimeShort(ev.starts_at), ...(ev.ends_at && !ev.all_day ? [h('br'), h('span', { class: 'u-op-65' }, fmtTimeShort(ev.ends_at))] : [])];
      return h('div', { class: 'calEvent' + (open ? ' selected' : ''), 'data-uid': ev.uid },
        h('div', { class: 'eTime' }, ...timeKids),
        h('div', { class: 'eBar', 'data-cal-color': colorForCalendar(ev.calendar_name) }),
        h('div', { class: 'eBody' },
          h('div', { class: 'eTitle' }, ev.summary || 'Event'),
          ev.location ? h('div', { class: 'eSub' }, ev.location) : null,
          personal ? null : h('div', { class: 'eSub' }, ev.calendar_name || 'Other'),
          (!personal && note && !open) ? h('div', { class: 'eNote' }, note) : null,
          ...(open ? [personal ? personalEventEditorHtml(ev) : noteEditorHtml(ev)] : [])));
    }
    // EXT20J: data-had / data-shown = the note as shown (none, or its text); the
    // raw note text rides setAttribute and round-trips through getAttribute for
    // the stale-save guard's `.eq('note', data-shown)` check.
    function noteEditorHtml(ev){
      return h('div', {
        class: 'calNoteBox', 'data-noteuid': ev.uid,
        'data-had': calNotes[ev.uid] != null ? '1' : '0', 'data-shown': calNotes[ev.uid] || '',
      },
        h('textarea', { class: 'calNoteText', placeholder: 'Add a note for yourself about this appointment…' }, calNotes[ev.uid] || ''),
        h('div', { class: 'calNoteRow' },
          h('button', { type: 'button', class: 'small calNoteSave' }, 'Save note'),
          calNotes[ev.uid] ? h('button', { type: 'button', class: 'small secondary calNoteDelete' }, 'Remove') : null,
          h('span', { class: 'saved' })));
    }
    function dayGroupHtml(date, events){
      const key = dateKey(date);
      const isToday = key === dateKey(new Date());
      const head = h('div', { class: 'calDayHead' + (isToday ? ' isToday' : '') },
        h('span', { class: 'dName' }, date.toLocaleDateString(undefined, { weekday:'long' })),
        h('span', { class: 'dMeta' }, date.toLocaleDateString(undefined, { month:'short', day:'numeric' }) +
          ' · ' + (events.length ? events.length + (events.length === 1 ? ' appointment' : ' appointments') : 'nothing scheduled')));
      if (!events.length) return h('div', { class: 'calDayGroup' }, head, h('p', { class: 'empty' }, 'Nothing scheduled.'));

      const nowLine = () => h('div', { class: 'calNowLine' }, h('span', { class: 'dot' }), h('span', { class: 'line' }));
      const kids = [head];
      const now = new Date();
      let nowDrawn = !isToday;
      events.forEach(ev => {
        if (!nowDrawn && !ev.all_day && new Date(ev.starts_at) > now) { kids.push(nowLine()); nowDrawn = true; }
        kids.push(eventHtml(ev));
      });
      if (!nowDrawn) kids.push(nowLine());
      return h('div', { class: 'calDayGroup' }, ...kids);
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

      // EXT20J: every view built as DOM nodes (h() text-ifies) instead of HTML
      // strings, so the calendar body is safe under Trusted Types.
      if (calView === 'day') {
        body.replaceChildren(dayGroupHtml(new Date(calCursor), eventsOn(calCursor)));
      } else if (calView === 'week') {
        const { start } = calRange();
        const days = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(start); d.setDate(start.getDate() + i);
          days.push(dayGroupHtml(d, eventsOn(d)));
        }
        body.replaceChildren(...days);
      } else {
        const { start } = calRange();
        const month = calCursor.getMonth();
        const todayKey = dateKey(new Date());
        const dowGrid = h('div', { class: 'calGrid' },
          ...['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => h('div', { class: 'calDow' }, d)));
        const cells = [];
        for (let i = 0; i < 42; i++) {
          const d = new Date(start); d.setDate(start.getDate() + i);
          const key = dateKey(d);
          const evs = eventsOn(d);
          const shown = evs.slice(0, 3);
          cells.push(h('div', {
            class: 'calCell' + (d.getMonth() !== month ? ' otherMonth' : '') + (key === todayKey ? ' today' : ''),
            'data-daykey': key,
          },
            h('div', { class: 'dNum' }, d.getDate()),
            ...shown.map(ev => h('span', { class: 'calChip', title: ev.summary || 'Event' },
              h('span', { class: 'cDot', 'data-cal-color': colorForCalendar(ev.calendar_name) }),
              h('span', { class: 'cText' }, ev.summary || 'Event'))),
            evs.length > shown.length ? h('div', { class: 'calMore' }, '+' + (evs.length - shown.length) + ' more') : null));
        }
        body.replaceChildren(dowGrid, h('div', { class: 'calGrid u-mt-6' }, ...cells));
        body.querySelectorAll('.calCell').forEach(cell => {
          cell.addEventListener('click', () => {
            calCursor = new Date(cell.getAttribute('data-daykey') + 'T00:00:00');
            setCalView('day');
          });
        });
      }
      paintCalColors(body); // EXT20J: event bars / month-cell dots get their per-calendar colour
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
                h('th', null, 'Order #'), h('th', null, 'Customer'), h('th', null, 'Status'), h('th', { class: 'num-cell' }, 'Total'), h('th', null, 'Placed'), h('th'))),
              h('tbody', null, recent.map(o =>
                h('tr', { 'data-id': o.id },
                  h('td', null, o.order_number || o.id),
                  h('td', null, o.customer_name || '—'),
                  h('td', null, h('span', { class: 'badge' }, o.status ? String(o.status).replace(/_/g, ' ') : '—')),
                  h('td', { class: 'num-cell' }, fmtMoney(o.total, o.currency)),
                  h('td', null, fmtDate(o.placed_at)),
                  h('td', null, orderSlipsOn() ? [
                    h('button', { type: 'button', class: 'small secondary', 'data-slip': '4x6', 'data-order': o.id, 'aria-label': 'Print a 4×6 packing slip for order ' + (o.order_number || o.id) }, '4×6 slip'), ' ',
                    h('button', { type: 'button', class: 'small secondary', 'data-slip': 'letter', 'data-order': o.id, 'aria-label': 'Print a Letter packing slip for order ' + (o.order_number || o.id) }, 'Letter slip'), ' '] : null,
                    h('button', { class: 'small deny deleteOrderBtn' }, 'Delete'))))))
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
        if (orderSlipsOn()) { slipOrders = recent; prefetchSlipItems(recent.map(o => o.id)); }

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
        // EXT20J: built as DOM nodes (h() text-ifies) instead of an HTML string.
        const syncMissingNoteNode = flags.some(f => f.flag_key === 'shopify_order_sync') ? null :
          h('p', { class: 'hint flagSyncMissing u-c-danger u-mt-8' }, 'The Shopify Order Sync switch was not found in the database, so its state is unknown (not configured), not "off". Emergency mode cannot switch it off either.');
        if (!flags.length) {
          document.getElementById('flagsWrap').replaceChildren(...[h('p', { class: 'empty' }, 'No feature flags exist yet.'), syncMissingNoteNode].filter(Boolean));
        } else {
          const flagRow = f => h('div', { class: 'flagRow', 'data-id': f.id, 'data-key': f.flag_key || '' },
            h('div', { class: 'flagInfo' },
              h('div', { class: 'k' }, f.label || f.flag_key, LAUNCH_BLOCKED_FLAGS[f.flag_key] ? [' ', h('span', { class: 'badge sev-high flagBlockedBadge' }, 'Blocked until launch checks')] : null),
              h('div', { class: 'd' }, f.description || f.flag_key),
              LAUNCH_BLOCKED_FLAGS[f.flag_key] ? h('div', { class: 'd flagBlockedReason u-c-danger' }, LAUNCH_BLOCKED_FLAGS[f.flag_key]) : null,
              FLAG_DEPENDS[f.flag_key] ? h('div', { class: 'd flagDepends' }, h('span', { class: 'badge flagState' }, f.enabled ? 'ON' : 'OFF'), ' Needs first: ' + FLAG_DEPENDS[f.flag_key] + '. The page checks this before it lets the switch turn on; turning it off is always safe (work already done stays done).') : null),
            h('label', { class: 'switch' },
              h('input', { type: 'checkbox', class: 'flagToggle', checked: f.enabled ? true : null }),
              h('span', { class: 'slider' })));
          document.getElementById('flagsWrap').replaceChildren(...[...flags.map(flagRow), syncMissingNoteNode].filter(Boolean));
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
          who = who_row && (who_row.display_name || who_row.email) ? (who_row.display_name || who_row.email) : null;
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
          // EXT20J: built as DOM nodes (h() text-ifies) instead of an HTML string.
          wrap.replaceChildren(
            h('div', { class: 'modePill' }, info.label),
            h('p', { class: 'hint u-m-8-0-0' }, info.desc + ' ' + changedLine));
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

        // EXT20J: built as DOM nodes (h() text-ifies) instead of an HTML string.
        // data-config carries the raw JSON string (setAttribute/getAttribute round-
        // trips it unchanged), so the save handler's JSON.parse works as before.
        const ruleRow = r => {
          const configKey = BUSINESS_RULE_CONFIG_KEY[r.rule_key];
          const unit = BUSINESS_RULE_UNIT_LABELS[r.rule_key] || '';
          const knownShape = configKey && r.config && typeof r.config === 'object'
            && Object.prototype.hasOwnProperty.call(r.config, configKey);
          const currentValue = knownShape ? r.config[configKey] : null;
          return h('div', { class: 'flagRow u-ai-flex-start', 'data-id': r.id, 'data-rule-key': r.rule_key, 'data-config-key': configKey || '', 'data-config': JSON.stringify(r.config === undefined ? null : r.config) },
            h('div', { class: 'flagInfo u-flex-1 u-minw-0' },
              h('div', { class: 'k' }, r.label || r.rule_key),
              h('div', { class: 'd' }, r.description || r.rule_key)),
            h('div', { class: 'u-d-flex u-ai-center u-gap-10 u-flex-none' },
              ...(knownShape
                ? [h('input', { type: 'number', class: 'ruleValueInput u-w-90 u-p-7-8 u-br-8 u-b-1-solid-xcfd8d6 u-ff-inherit u-fs-13p5', value: String(currentValue), step: 'any' }),
                   h('span', { class: 'u-fs-12 u-c-muted u-minw-60' }, unit)]
                : [h('textarea', { class: 'ruleConfigJson u-w-180 u-p-7-8 u-br-8 u-b-1-solid-xcfd8d6 u-ff-monospace u-fs-12 u-rs-vertical', rows: '2' }, JSON.stringify(r.config))]),
              h('button', { type: 'button', class: 'small ruleSaveBtn u-d-none' }, 'Save'),
              h('label', { class: 'switch' },
                h('input', { type: 'checkbox', class: 'ruleActiveToggle', checked: r.is_active ? true : null }),
                h('span', { class: 'slider' }))));
        };
        document.getElementById('businessRulesWrap').replaceChildren(...rules.map(ruleRow));

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
        sel.replaceChildren(h('option', { value: '' }, 'Category…'),
          ...Object.entries(DOCUMENT_CATEGORY_LABELS).map(([k, v]) => h('option', { value: k }, v)));
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
        // EXT20J: built as DOM nodes (h() text-ifies) instead of an HTML string.
        const adjRow = a => {
          const productLabel = a.products ? (a.products.name + (a.products.sku ? ' (' + a.products.sku + ')' : '')) : 'Unknown product';
          const sign = Number(a.change_amount) > 0 ? '+' : '';
          return h('div', { class: 'deletedRow' },
            h('div', { class: 'info' },
              h('b', null, productLabel), ' — ' + (INVENTORY_BUCKET_LABELS[a.bucket] || a.bucket) + ': ' + sign + Number(a.change_amount),
              ...(a.reason ? [h('br'), h('span', { class: 'u-fs-12 u-c-muted' }, a.reason)] : []),
              h('br'), h('span', { class: 'u-fs-11 u-c-muted' }, fmtDate(a.adjusted_at))));
        };
        document.getElementById('inventoryAdjustmentsWrap').replaceChildren(...adjustments.map(adjRow));
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
              h('input', { type: 'number', class: 'refundAmountInput u-w-130 u-p-5-7 u-br-6 u-b-1-solid-xcfd8d6 u-ff-inherit u-fs-12', min: '0', max: '1000000', step: '0.01', placeholder: 'Refund $', 'aria-label': 'Refund amount in dollars (optional)' }),
              h('button', { type: 'button', class: 'small markRefundedBtn' }, 'Mark Refunded'),
              h('button', { type: 'button', class: 'small advanceReturnBtn', 'data-next': 'closed' }, 'Close without refund'),
            ];
          } else if (r.status === 'refunded') {
            actionNodes = [h('button', { type: 'button', class: 'small advanceReturnBtn', 'data-next': 'closed' }, 'Close')];
          }

          const detailLine = [
            r.reason ? 'Reason: ' + (RETURN_REASON_LABELS[r.reason] || (String(r.reason).charAt(0).toUpperCase() + String(r.reason).slice(1)).replace(/_/g, ' ')) : '',
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
        orderItemSelect.replaceChildren(h('option', { value: '' }, 'Which item…'),
          ...items.map(it => h('option', { value: it.id }, (it.product_name || it.sku || it.id) + (it.sku ? ' (' + it.sku + ')' : '') + ' — Qty ' + it.quantity)));
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

    // Owner review, Nov 3 (point 2): say what was chosen as soon as a receipt is
    // picked — its name and size, or the same problem the save would refuse it
    // for — instead of only finding out when "Add expense" is pressed. Uses the
    // exact rule the save uses (uploadProblem); nothing is uploaded here.
    function receiptSize(bytes) {
      if (!(bytes >= 0)) return '';
      if (bytes < 1024) return bytes + ' bytes';
      if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
      return (Math.round(bytes / 104857.6) / 10) + ' MB';
    }
    function showReceiptStatus() {
      const input = document.getElementById('expReceipt');
      const out = document.getElementById('expReceiptStatus');
      if (!input || !out) return;
      const file = input.files && input.files[0];
      if (!file) { out.textContent = ''; out.removeAttribute('data-receipt'); return; }
      const problem = uploadProblem(file);
      if (problem) { out.textContent = problem; out.setAttribute('data-receipt', 'problem'); return; }
      const looksRight = /^image\//.test(file.type || '') || /\.pdf$/i.test(file.name || '') || file.type === 'application/pdf';
      out.textContent = 'Ready to attach: ' + file.name + ' (' + receiptSize(file.size) + ')' + (looksRight ? '' : ' — not a photo or PDF, but it can still be saved');
      out.setAttribute('data-receipt', 'ok');
    }
    document.getElementById('expReceipt').addEventListener('change', showReceiptStatus);
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
        showReceiptStatus();
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

        // EXT20J: built as DOM nodes (h() text-ifies) instead of an HTML string.
        // No accounting logic changes; money values were already esc()-ed.
        document.getElementById('acctStats').replaceChildren(...[
          h('div', { class: 'stat' }, h('div', { class: 'num' }, fmtMoney(revenue, currency)), h('div', { class: 'lbl' }, 'Revenue')),
          h('div', { class: 'stat' }, h('div', { class: 'num' }, fmtMoney(totalExpenses, currency)), h('div', { class: 'lbl' }, 'Expenses')),
          h('div', { class: 'stat' }, h('div', { class: 'num' }, fmtMoney(netProfit, currency)), h('div', { class: 'lbl' }, 'Net profit')),
          h('div', { class: 'stat' }, h('div', { class: 'num' }, fmtMoney(excluded, currency)), h('div', { class: 'lbl' }, 'Cancelled / refunded (excluded)')),
          ACCOUNTING_REFUND_POLICY === 'subtract_return_refunds' ? h('div', { class: 'stat' }, h('div', { class: 'num' }, fmtMoney(returnRefundTotal, currency)), h('div', { class: 'lbl' }, 'Refunds on Returns (subtracted)')) : null
        ].filter(Boolean));

        // RP-06 (EXT3): the same purchase order's cost logged more than once
        // (a retried or half-finished receive). Shown for review only.
        const poCosts = Object.create(null);
        expenses.forEach(e => {
          const m = /^Purchase order (.+)$/.exec(String(e.note || '').trim());
          if (!m) return;
          (poCosts[m[1]] = poCosts[m[1]] || []).push(e);
        });
        const dupPos = Object.keys(poCosts).filter(k => poCosts[k].length > 1).sort();
        document.getElementById('acctDupWrap').replaceChildren(...(!dupPos.length
          ? [h('p', { class: 'empty' }, 'None found.')]
          : dupPos.map(k => h('div', { class: 'deletedRow acctDupRow' },
              h('div', { class: 'info' },
                h('b', null, 'Purchase order ' + k), ' — logged ' + poCosts[k].length + ' times, ' + fmtMoney(poCosts[k].reduce((s, e) => s + Number(e.amount || 0), 0), currency) + ' in total',
                h('br'),
                h('span', { class: 'u-fs-11 u-c-muted' }, poCosts[k].map(e => fmtDateOnly(e.expense_date) + ': ' + fmtMoney(e.amount, currency)).join(' · ')))))));

        // EXT6: manual orders saved without their items still count as revenue.
        // Only manual orders can end up like this (Shopify orders arrive with
        // their items), so only those are checked: a small extra read.
        const noItemsWrap = document.getElementById('acctNoItemsWrap');
        try {
          const empty = await manualOrdersWithoutItems(orders);
          if (!isLatest()) return;
          const acctOrderRow = (o, cls) => h('div', { class: cls },
            h('div', { class: 'info' },
              h('b', null, o.order_number || o.id), ' — ' + fmtMoney(o.total, o.currency),
              h('br'),
              h('span', { class: 'u-fs-11 u-c-muted' }, 'Status: ' + o.status + ' — Placed ' + fmtDate(o.placed_at))));
          noItemsWrap.replaceChildren(...(!empty.length
            ? [h('p', { class: 'empty' }, 'None found.')]
            : empty.map(o => acctOrderRow(o, 'deletedRow acctNoItemsRow'))));
        } catch (noItemsErr) {
          noItemsWrap.replaceChildren(h('p', { class: 'empty' }, 'Could not check for orders without items: ' + explainDbError((noItemsErr && noItemsErr.message) || String(noItemsErr))));
        }

        if (!needsReview.length) {
          document.getElementById('acctReviewWrap').replaceChildren(h('p', { class: 'empty' }, 'Nothing needs review right now.'));
        } else {
          document.getElementById('acctReviewWrap').replaceChildren(...needsReview.map(o =>
            h('div', { class: 'deletedRow' },
              h('div', { class: 'info' },
                h('b', null, o.order_number || o.id), ' — ' + fmtMoney(o.total, o.currency),
                h('br'),
                h('span', { class: 'u-fs-11 u-c-muted' }, 'Status: ' + o.status + ' — Placed ' + fmtDate(o.placed_at))))));
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

        // EXT20J: built as DOM nodes (h() text-ifies) instead of an HTML string.
        // No tax logic changes; money values were already esc()-ed.
        document.getElementById('taxStats').replaceChildren(
          h('div', { class: 'stat' }, h('div', { class: 'num' }, fmtMoney(revenue, currency)), h('div', { class: 'lbl' }, 'Revenue')),
          h('div', { class: 'stat' }, h('div', { class: 'num' }, fmtMoney(cogsTotal, currency)), h('div', { class: 'lbl' }, 'Cost of Goods Sold (logged)')),
          h('div', { class: 'stat' }, h('div', { class: 'num' }, fmtMoney(operatingTotal, currency)), h('div', { class: 'lbl' }, 'Operating expenses')),
          h('div', { class: 'stat' }, h('div', { class: 'num' }, fmtMoney(netProfit, currency)), h('div', { class: 'lbl' }, 'Net profit')),
          h('div', { class: 'stat' }, h('div', { class: 'num' }, fmtMoney(salesTax, currency)), h('div', { class: 'lbl' }, 'Sales tax collected')));

        const catRows = Object.keys(byCategory).map(cat => {
          const info = TAX_CATEGORY_MAP[cat] || { group: 'operating', label: cat || 'Uncategorized' };
          return { cat, label: info.label, group: info.group, amount: byCategory[cat] };
        }).sort((a, b) => (a.group === b.group ? b.amount - a.amount : (a.group === 'cogs' ? -1 : 1)));

        if (!catRows.length) {
          document.getElementById('taxCategoryWrap').replaceChildren(h('p', { class: 'empty' }, 'No expenses logged in this period.'));
        } else {
          document.getElementById('taxCategoryWrap').replaceChildren(h('table', null,
            h('thead', null, h('tr', null, h('th', null, 'Category'), h('th', null, 'Type'), h('th', { class: 'num-cell' }, 'Total'))),
            h('tbody', null, catRows.map(r =>
              h('tr', null,
                h('td', null, r.label),
                h('td', null, h('span', { class: 'badge' + (r.group === 'cogs' ? ' sev-medium' : '') }, r.group === 'cogs' ? 'COGS' : 'Operating')),
                h('td', { class: 'num-cell' }, fmtMoney(r.amount, currency)))))));
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
        document.getElementById('taxCogsWrap').replaceChildren(...[
          h('div', { class: 'statRow' },
            h('div', { class: 'stat' }, h('div', { class: 'num' }, fmtMoney(estCogs, currency)), h('div', { class: 'lbl' }, 'Estimated cost of units sold')),
            h('div', { class: 'stat' }, h('div', { class: 'num' }, unmatchedCount), h('div', { class: 'lbl' }, 'Units with no matching cost'))),
          unmatchedSkus.size ? h('p', { class: 'hint u-mt-8' }, 'SKUs with no cost on file: ' + [...unmatchedSkus].join(', ')) : null
        ].filter(Boolean));

        const stateEntries = Object.keys(stateTax).sort();
        if (!stateEntries.length && !stateUnknownTax) {
          document.getElementById('taxStateWrap').replaceChildren(h('p', { class: 'empty' }, 'No sales tax collected in this period.'));
        } else {
          document.getElementById('taxStateWrap').replaceChildren(h('table', null,
            h('thead', null, h('tr', null, h('th', null, 'State'), h('th', { class: 'num-cell' }, 'Sales tax collected'))),
            h('tbody', null,
              ...stateEntries.map(s => h('tr', null, h('td', null, s), h('td', { class: 'num-cell' }, fmtMoney(stateTax[s], currency)))),
              ...(stateUnknownTax ? [h('tr', null, h('td', null, 'Unknown / not yet verified'), h('td', { class: 'num-cell' }, fmtMoney(stateUnknownTax, currency)))] : []))));
        }

        const missing = expenses.filter(e => !e.receipt_path);
        if (!missing.length) {
          document.getElementById('taxReceiptWrap').replaceChildren(h('p', { class: 'empty' }, 'Every logged expense in this period has a receipt on file.'));
        } else {
          document.getElementById('taxReceiptWrap').replaceChildren(h('table', { class: 'phoneCards' },
            h('thead', null, h('tr', null, h('th', null, 'Date'), h('th', null, 'Category'), h('th', null, 'Vendor'), h('th', { class: 'num-cell' }, 'Amount'))),
            h('tbody', null, missing.map(e =>
              h('tr', null,
                h('td', null, fmtDateOnly(e.expense_date)),
                h('td', null, (TAX_CATEGORY_MAP[e.category] || {}).label || e.category || '—'),
                h('td', null, e.vendor || '—'),
                h('td', { class: 'num-cell' }, fmtMoney(e.amount, currency)))))));
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
