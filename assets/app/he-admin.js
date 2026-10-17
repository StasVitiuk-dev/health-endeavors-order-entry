// assets/app/he-admin.js — Admin pages: signed-in sessions, SOPs, feature requests and their recycle bin (reads plus simple non-stock, non-money saves)
// EXT15: moved unchanged out of assets/owner-login-app.js (initApp). Its inputs
// arrive explicitly in ctx; it returns only what other code still uses. Map:
// docs/ops/APPLICATION_MODULE_MAP_EXT15.md. Created once, by the app, in order.
window.HE.modules.define('he-admin', { api: 1, needs: ['FR_NEXT_LABEL','FR_NEXT_STATUS','FR_STATUS_LABELS','SEARCH_INDEX','advanceFeatureRequest','appendMore','boolGuard','deleteFeatureRequest','deviceLabel','esc','fmtDate','listLimit','noRowsChanged','requireReauth','showDashError','showPageWarning','staleMessage','supabase','updateIfUnchanged'] }, function (ctx) {
    const { FR_NEXT_LABEL, FR_NEXT_STATUS, FR_STATUS_LABELS, SEARCH_INDEX, advanceFeatureRequest, appendMore, boolGuard, deleteFeatureRequest, deviceLabel, esc, fmtDate, listLimit, noRowsChanged, requireReauth, showDashError, showPageWarning, staleMessage, supabase, updateIfUnchanged } = ctx;
    async function loadSessions(){
      try {
        const { data: sessions, error } = await supabase.rpc('list_my_sessions');
        if (error) throw error;
        if (!sessions || !sessions.length) {
          document.getElementById('sessionsWrap').replaceChildren(Object.assign(document.createElement('p'), { className: 'empty', textContent: 'No active sessions found.' }));
          return;
        }
        document.getElementById('sessionsWrap').innerHTML = sessions.map(s => `
          <div class="sessionRow" data-id="${esc(s.session_id)}">
            <div class="info">
              <b>${esc(deviceLabel(s.user_agent))}</b>${s.is_current ? ' <span class="u-c-good u-fs-11">· This device</span>' : ''}
              <br><span class="u-fs-11 u-c-muted">Signed in ${esc(fmtDate(s.created_at))} &middot; Last active ${esc(fmtDate(s.last_active))}${s.ip_address ? ' &middot; ' + esc(s.ip_address) : ''}</span>
            </div>
            <div class="actions">
              ${s.is_current ? '' : '<button class="small deny logoutSessionBtn">Log out</button>'}
            </div>
          </div>`).join('');
        document.querySelectorAll('.logoutSessionBtn').forEach(btn => btn.addEventListener('click', () => revokeSession(btn)));
      } catch (err) {
        showDashError('Could not load active sessions: ' + (err && err.message ? err.message : err));
      }
    }

    async function revokeSession(btn){
      const row = btn.closest('.sessionRow');
      const id = row.getAttribute('data-id');
      const ok = await requireReauth('log out that device');
      if (!ok) return;
      btn.disabled = true;
      try {
        const { error } = await supabase.rpc('revoke_my_session', { target_session_id: id });
        if (error) throw error;
        // Check it really happened: a device that still shows up afterwards
        // must not look logged out.
        const { data: after, error: afterErr } = await supabase.rpc('list_my_sessions');
        if (!afterErr && Array.isArray(after) && after.some(x => String(x.session_id) === String(id))) {
          showDashError('That device still shows as signed in, so it was NOT logged out (no permission, or the session could not be ended). Try again, or change your password to sign out everywhere.');
        } else {
          toastOk('Device logged out.');
        }
        loadSessions();
      } catch (err) {
        btn.disabled = false;
        showDashError('Could not log out that device: ' + (err && err.message ? err.message : err));
      }
    }

    // SOP / Procedure Center: your own written step-by-step procedures, stored
    // so they live in the system instead of your head — useful for your own
    // reference now, and ready the moment anyone else needs to follow them.
    async function loadSops(){
      try {
        const { data: sops, error, count: capCount } = await supabase
          .from('sop_documents')
          .select('id, title, category, content, updated_at, agent_visible', { count: 'exact' })
          .order('category', { ascending: true, nullsFirst: false })
          .order('title', { ascending: true });
        if (error) throw error;
        showPageWarning('sopsPanel', typeof capCount === 'number' && capCount > (sops || []).length ? 'Showing the first ' + (sops || []).length + ' of ' + capCount + ' procedures: the rest are not listed on this page.' : null);
        SEARCH_INDEX.sops = sops;
        if (!sops || !sops.length) {
          document.getElementById('sopsWrap').replaceChildren(Object.assign(document.createElement('p'), { className: 'empty', textContent: 'No procedures written yet — add your first one below.' }));
          return;
        }
        document.getElementById('sopsWrap').innerHTML = sops.map(s => `
          <details class="u-bb-1-solid-line u-p-8-0">
            <summary class="u-cur-pointer u-fw-600 u-fs-13p5 u-c-navy">
              ${esc(s.title)}${s.category ? ` <span class="u-fw-400 u-c-muted u-fs-12">&middot; ${esc(s.category)}</span>` : ''}
            </summary>
            <div class="u-ws-pre-wrap u-fs-13 u-c-ink u-m-8-0-4">${esc(s.content)}</div>
            <div class="u-d-flex u-ai-center u-jc-space-between u-gap-10 u-fwr-wrap u-mt-6">
              <div class="u-fs-11 u-c-muted">Last updated ${esc(fmtDate(s.updated_at))}</div>
              <label class="u-d-flex u-ai-center u-gap-8 u-fs-11p5 u-c-ink u-cur-pointer">
                Customer Service Agent may reference this
                <span class="switch">
                  <input type="checkbox" class="sopAgentToggle" data-id="${esc(s.id)}" ${s.agent_visible ? 'checked' : ''}>
                  <span class="slider"></span>
                </span>
              </label>
            </div>
          </details>`).join('');
        document.querySelectorAll('.sopAgentToggle').forEach(cb => {
          cb.addEventListener('change', async () => {
            const id = cb.getAttribute('data-id');
            const newVal = cb.checked;
            cb.disabled = true;
            try {
              const changed = await updateIfUnchanged('sop_documents', id, { agent_visible: newVal }, { agent_visible: boolGuard(!newVal) });
              if (!changed) {
                // EXT7: re-read instead of guessing: the other change may have
                // set the very value this click wanted, or something else.
                showDashError(staleMessage('That procedure'));
                loadSops();
                return;
              }
            } catch (err) {
              cb.checked = !newVal;
              showDashError('Could not update that procedure: ' + (err && err.message ? err.message : err));
            } finally {
              cb.disabled = false;
            }
          });
        });
      } catch (err) {
        showDashError('Could not load procedures: ' + (err && err.message ? err.message : err));
      }
    }

    async function loadFeatureRequests(){
      try {
        const { data: reqs, error, count: capCount } = await supabase
          .from('feature_requests')
          .select('id, title, description, status, priority, requested_at, updated_at, resolution_notes', { count: 'exact' })
          .is('deleted_at', null)
          .order('requested_at', { ascending: false });
        if (error) throw error;
        showPageWarning('featureRequestsPanel', typeof capCount === 'number' && capCount > (reqs || []).length ? 'Showing the first ' + (reqs || []).length + ' of ' + capCount + ' feature requests: the rest are not listed on this page.' : null);
        SEARCH_INDEX.featureRequests = reqs;

        const counts = { requested: 0, in_progress: 0, done: 0 };
        (reqs || []).forEach(r => { if (counts[r.status] !== undefined) counts[r.status]++; });
        document.getElementById('frStats').innerHTML = `
          <div class="stat"><div class="num">${counts.requested}</div><div class="lbl">Requested</div></div>
          <div class="stat"><div class="num">${counts.in_progress}</div><div class="lbl">In progress</div></div>
          <div class="stat"><div class="num">${counts.done}</div><div class="lbl">Done</div></div>
        `;

        if (!reqs || !reqs.length) {
          document.getElementById('featureRequestsWrap').replaceChildren(Object.assign(document.createElement('p'), { className: 'empty', textContent: 'No feature requests yet — add your first one below.' }));
          return;
        }

        // Keep open requests (requested / in progress) above done ones, so the
        // list stays useful as a running queue instead of getting cluttered
        // with finished items once you have a lot of history.
        const sorted = reqs.slice().sort((a, b) => {
          const aDone = a.status === 'done' ? 1 : 0;
          const bDone = b.status === 'done' ? 1 : 0;
          if (aDone !== bDone) return aDone - bDone;
          return new Date(b.requested_at) - new Date(a.requested_at);
        });

        document.getElementById('featureRequestsWrap').innerHTML = sorted.map(r => `
          <div class="approvalRow" data-id="${esc(r.id)}" data-status="${esc(r.status || '')}">
            <div class="info">
              <b>${esc(r.title)}</b>
              ${r.priority === 'high' ? '<span class="priorityPill high">high</span>' : ''}
              <span class="badge${r.status === 'done' ? ' sev-low' : ''}">${esc(FR_STATUS_LABELS[r.status] || r.status)}</span>
              ${r.description ? `<div class="u-fs-12 u-c-muted u-mt-3">${esc(r.description)}</div>` : ''}
              <br><span class="u-fs-11 u-c-muted">Requested ${esc(fmtDate(r.requested_at))}</span>
            </div>
            <div class="actions">
              ${FR_NEXT_STATUS[r.status] ? `<button class="small frAdvanceBtn">${esc(FR_NEXT_LABEL[r.status])}</button>` : ''}
              <button class="small deny frDeleteBtn">Delete</button>
            </div>
          </div>`).join('');
        document.querySelectorAll('.frAdvanceBtn').forEach(btn => btn.addEventListener('click', () => advanceFeatureRequest(btn)));
        document.querySelectorAll('.frDeleteBtn').forEach(btn => btn.addEventListener('click', () => deleteFeatureRequest(btn)));
      } catch (err) {
        showDashError('Could not load feature requests: ' + (err && err.message ? err.message : err));
      }
    }

    async function loadDeletedFeatureRequests(){
      try {
        const { data: deleted, error, count } = await supabase
          .from('feature_requests')
          .select('id, title, deleted_at', { count: 'exact' })
          .not('deleted_at', 'is', null)
          .order('deleted_at', { ascending: false })
          .limit(listLimit('delFR'));
        if (error) throw error;

        if (!deleted || !deleted.length) {
          document.getElementById('deletedFeatureRequestsWrap').replaceChildren(Object.assign(document.createElement('p'), { className: 'empty', textContent: 'Recycle bin is empty.' }));
          return;
        }
        document.getElementById('deletedFeatureRequestsWrap').innerHTML = deleted.map(r => `
          <div class="deletedRow" data-id="${esc(r.id)}">
            <div class="info"><b>${esc(r.title)}</b><br>
            <span class="u-fs-11 u-c-muted">Deleted ${esc(fmtDate(r.deleted_at))}</span></div>
            <button class="small restoreFeatureRequestBtn">Restore</button>
          </div>`).join('');
        appendMore('deletedFeatureRequestsWrap', 'delFR', deleted.length, count, 'deleted requests', loadDeletedFeatureRequests);
        document.querySelectorAll('.restoreFeatureRequestBtn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const row = btn.closest('.deletedRow');
            const id = row.getAttribute('data-id');
            btn.disabled = true;
            try {
              // Only while it is still deleted. EXT4
              const { data: changed, error } = await supabase.from('feature_requests').update({ deleted_at: null }).eq('id', id).not('deleted_at', 'is', null).select('id');
              if (error) throw error;
              if (noRowsChanged(changed)) { showDashError(staleMessage('That request')); loadFeatureRequests(); return; }
              loadFeatureRequests();
              loadDeletedFeatureRequests();
            } catch (err) {
              btn.disabled = false;
              showDashError('Could not restore that request: ' + (err && err.message ? err.message : err));
            }
          });
        });
      } catch (err) {
        showDashError('Could not load recently deleted requests: ' + (err && err.message ? err.message : err));
      }
    }

  return { loadSessions, loadSops, loadFeatureRequests, loadDeletedFeatureRequests };
});
