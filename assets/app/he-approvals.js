// assets/app/he-approvals.js — Approval Queue: list and decisions (password re-check before a decision)
// EXT15: moved unchanged out of assets/owner-login-app.js (initApp). Its inputs
// arrive explicitly in ctx; it returns only what other code still uses. Map:
// docs/ops/APPLICATION_MODULE_MAP_EXT15.md. Created once, by the app, in order.
window.HE.modules.define('he-approvals', { api: 1, needs: ['CLOSED_IN','SEARCH_INDEX','esc','fmtDate','h','isClosedStatus','requireReauth','showDashError','staleMessage','supabase','updateIfUnchanged'] }, function (ctx) {
    const { CLOSED_IN, SEARCH_INDEX, esc, fmtDate, h, isClosedStatus, requireReauth, showDashError, staleMessage, supabase, updateIfUnchanged } = ctx;
    async function loadApprovals(){
      try {
        const { data: reqs, error, count } = await supabase
          .from('approval_requests')
          .select('id, action_type, summary, status, created_at', { count: 'exact' })
          .not('status', 'in', CLOSED_IN)
          .order('created_at', { ascending: false })
          .limit(100);
        if (error) throw error;
        SEARCH_INDEX.approvals = reqs;

        // EXT7: only undecided requests are read (same reason as loadTasks).
        // Before, 100 newer decided requests pushed an older pending one out
        // of the approval queue, with only a vague warning.
        const pending = reqs.filter(r => !isClosedStatus(r.status));
        const truncated = count != null && count > reqs.length;
        // EXT20G: built as DOM nodes (h() text-ifies) instead of an HTML string,
        // so this screen is safe under Trusted Types. Values were already esc()-ed.
        const cutoffNote = truncated
          ? [h('p', { class: 'hint u-m-0-0-8 u-c-warn' }, `Showing the ${reqs.length} most recent of ${count} pending requests.`)] : [];
        if (!pending.length) {
          document.getElementById('approvalsWrap').replaceChildren(...cutoffNote, h('p', { class: 'empty' }, 'Nothing waiting for approval.'));
        } else {
          document.getElementById('approvalsWrap').replaceChildren(...cutoffNote, ...pending.map(r =>
            h('div', { class: 'approvalRow', 'data-id': r.id, 'data-status': r.status || '' },
              h('div', { class: 'info' },
                h('b', null, r.action_type), ' — ' + (r.summary || ''),
                h('br'), h('span', { class: 'u-fs-11 u-c-muted' }, 'Requested ' + fmtDate(r.created_at))),
              h('div', { class: 'actions' },
                h('button', { class: 'small approve approveBtn' }, 'Approve'),
                h('button', { class: 'small deny denyBtn' }, 'Deny')))));
          document.querySelectorAll('.approveBtn').forEach(btn => btn.addEventListener('click', () => decideApproval(btn, 'approved')));
          // The database allows only pending / approved / rejected (Query A, 2026-10-05):
          // 'denied' was refused by its status check, so Deny never worked.
          document.querySelectorAll('.denyBtn').forEach(btn => btn.addEventListener('click', () => decideApproval(btn, 'rejected')));
        }
      } catch (err) {
        showDashError('Could not load the approval queue: ' + (err && err.message ? err.message : err));
      }
    }

    async function decideApproval(btn, decision){
      const row = btn.closest('.approvalRow');
      const id = row.getAttribute('data-id');
      const ok = await requireReauth(decision === 'approved' ? 'approve this request' : 'deny (reject) this request');
      if (!ok) return;
      row.querySelectorAll('button').forEach(b => b.disabled = true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const uid = sessionData && sessionData.session ? sessionData.session.user.id : null;
        const seenStatus = row.getAttribute('data-status') || null;
        const changed = await updateIfUnchanged('approval_requests', id,
          { status: decision, reviewed_by: uid, reviewed_at: new Date().toISOString() },
          { status: seenStatus });
        if (!changed) showDashError(staleMessage('That request'));
        else toastOk(decision === 'approved' ? 'Request approved.' : 'Request rejected.');
        loadApprovals();
      } catch (err) {
        row.querySelectorAll('button').forEach(b => b.disabled = false);
        showDashError(`Could not mark that request "${decision}": ` + (err && err.message ? err.message : err));
      }
    }

  return { loadApprovals };
});
