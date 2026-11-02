// assets/app/he-inquiries.js — Customer questions: list, severity, saved drafts, copy reply, mark answered (never sends anything)
// EXT15: moved unchanged out of assets/owner-login-app.js (initApp). Its inputs
// arrive explicitly in ctx; it returns only what other code still uses. Map:
// docs/ops/APPLICATION_MODULE_MAP_EXT15.md. Created once, by the app, in order.
window.HE.modules.define('he-inquiries', { api: 1, needs: ['INQ_ANSWERED_CAP','INQ_STATUS_LABELS','fetchAllRows','fetchAllRowsIn','fmtDate','h','inqStatusBadgeClass','noRowsChanged','showDashError','staleMessage','supabase','updateIfUnchanged'] }, function (ctx) {
    const { INQ_ANSWERED_CAP, INQ_STATUS_LABELS, fetchAllRows, fetchAllRowsIn, fmtDate, h, inqStatusBadgeClass, noRowsChanged, showDashError, staleMessage, supabase, updateIfUnchanged } = ctx;
    let ALL_INQUIRIES = [];
    // EXT15: read-only access for the badge count and record search.
    function inquiriesList(){ return ALL_INQUIRIES; }
    let INQ_ANSWERED_TOTAL = 0, INQ_ANSWERED_SHOWN = 0;
    let INQUIRY_ORDER_BY_ID = Object.create(null);

    async function loadInquiries(){
      try {
        // EXT8: every question still waiting (not answered, or no status) is
        // read in full, a page at a time; answered ones only the newest
        // INQ_ANSWERED_CAP, with the database's exact count. Before, the
        // newest 200 of ALL statuses were read, so once 200 newer answered
        // questions existed an older unanswered one vanished and the
        // "Needs review" / "New" figures undercounted.
        const INQ_COLS = 'id, order_id, customer_name, customer_email, channel, question_text, status, ai_draft_reply, ai_confidence, sensitive, sensitive_reasons, severity, created_at, drafted_at, answered_at';
        const [waiting, answeredRes] = await Promise.all([
          fetchAllRows('customer_inquiries', INQ_COLS, q => q.or('status.is.null,status.neq.answered')),
          supabase.from('customer_inquiries').select(INQ_COLS, { count: 'exact' })
            .eq('status', 'answered').order('created_at', { ascending: false }).limit(INQ_ANSWERED_CAP),
        ]);
        if (answeredRes.error) throw answeredRes.error;
        const answered = answeredRes.data || [];
        INQ_ANSWERED_TOTAL = answeredRes.count != null ? answeredRes.count : answered.length;
        INQ_ANSWERED_SHOWN = answered.length;
        ALL_INQUIRIES = waiting.concat(answered);

        const orderIds = [...new Set(ALL_INQUIRIES.map(i => i.order_id).filter(Boolean))];
        INQUIRY_ORDER_BY_ID = Object.create(null);
        if (orderIds.length) {
          // chunked: up to 200 ids would make one URL too long for the gateway
          const orders = await fetchAllRowsIn('orders', 'id, order_number', 'id', orderIds);
          orders.forEach(o => { INQUIRY_ORDER_BY_ID[o.id] = o; });
        }

        renderInquiries();
      } catch (err) {
        showDashError('Could not load customer inquiries: ' + (err && err.message ? err.message : err));
      }
    }

    function renderInquiries(){
      const counts = { new: 0, drafted: 0, needs_review: 0, answered: 0 };
      ALL_INQUIRIES.forEach(i => { if (counts[i.status] !== undefined) counts[i.status]++; });
      counts.answered = INQ_ANSWERED_TOTAL; // exact, though only the newest are listed
      // EXT20J: built as DOM nodes (h() text-ifies) instead of an HTML string, so
      // this screen is safe under Trusted Types. Customer-supplied text (names,
      // questions, draft replies) arrives from an external channel, so it was
      // already esc()-ed; now it can never be parsed as markup at all.
      document.getElementById('inqStats').replaceChildren(
        h('div', { class: 'stat' }, h('div', { class: 'num' }, counts.needs_review), h('div', { class: 'lbl' }, 'Needs review')),
        h('div', { class: 'stat' }, h('div', { class: 'num' }, counts.drafted), h('div', { class: 'lbl' }, 'Drafted')),
        h('div', { class: 'stat' }, h('div', { class: 'num' }, counts.new), h('div', { class: 'lbl' }, 'New, no draft')),
        h('div', { class: 'stat' }, h('div', { class: 'num' }, counts.answered), h('div', { class: 'lbl' }, 'Answered')));

      const filterVal = document.getElementById('inqFilter').value;
      const filtered = filterVal ? ALL_INQUIRIES.filter(i => i.status === filterVal) : ALL_INQUIRIES;
      const answeredNote = (filterVal === '' || filterVal === 'answered') && INQ_ANSWERED_TOTAL > INQ_ANSWERED_SHOWN
        ? `<p class="hint u-m-0-0-8">Every question still waiting is listed. Answered: the newest ${INQ_ANSWERED_SHOWN} of ${INQ_ANSWERED_TOTAL}.</p>` : '';

      // Worst-first ordering: highest severity floats to the top so the most
      // urgent questions are the first thing you see, with newest-first as
      // the tiebreaker within the same severity.
      const SEVERITY_RANK = { high: 3, medium: 2, low: 1 };
      const list = filtered.slice().sort((a, b) => {
        const rankDiff = (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0);
        if (rankDiff !== 0) return rankDiff;
        return new Date(b.created_at) - new Date(a.created_at);
      });

      if (!list.length) {
        document.getElementById('inquiriesWrap').replaceChildren(h('p', { class: 'empty' },
          ALL_INQUIRIES.length ? 'Nothing matches that filter.' : 'No customer questions yet.'));
        return;
      }

      const answeredNoteNode = answeredNote
        ? h('p', { class: 'hint u-m-0-0-8' }, `Every question still waiting is listed. Answered: the newest ${INQ_ANSWERED_SHOWN} of ${INQ_ANSWERED_TOTAL}.`) : null;
      const inquiryRow = i => {
        const order = i.order_id ? INQUIRY_ORDER_BY_ID[i.order_id] : null;
        return h('div', { class: 'approvalRow u-ai-flex-start', 'data-id': i.id },
          h('div', { class: 'info' },
            h('b', null, i.customer_name || 'Unknown customer'), ' ',
            i.channel ? [h('span', { class: 'badge' }, i.channel), ' '] : null,
            h('span', { class: 'badge ' + inqStatusBadgeClass(i.status) }, INQ_STATUS_LABELS[i.status] || i.status), ' ',
            i.severity ? h('span', { class: 'badge sev-' + i.severity }, i.severity + ' severity') : null,
            h('div', { class: 'u-fs-12 u-c-muted u-mt-3' },
              (i.customer_email || 'No email on file') + (order ? ' · Order ' + order.order_number : '')),
            h('div', { class: 'u-fs-11 u-c-muted u-mt-2' }, 'Asked ' + fmtDate(i.created_at)),
            h('div', { class: 'u-mt-6' },
              h('label', { class: 'u-fs-11p5 u-c-muted' }, 'Severity:',
                h('select', { class: 'inqSeveritySelect u-ml-4 u-p-3-6 u-br-6 u-b-1-solid-xcfd8d6 u-ff-inherit u-fs-12', 'data-id': i.id },
                  h('option', { value: '', selected: !i.severity ? true : null }, 'Not classified'),
                  h('option', { value: 'low', selected: i.severity === 'low' ? true : null }, 'Low'),
                  h('option', { value: 'medium', selected: i.severity === 'medium' ? true : null }, 'Medium'),
                  h('option', { value: 'high', selected: i.severity === 'high' ? true : null }, 'High')))),
            h('div', { class: 'u-mt-8 u-p-8-10 u-bg-xf4f7f6 u-br-8 u-fs-13' },
              h('b', { class: 'u-fs-11 u-c-muted u-tt-uppercase' }, 'Question'), h('br'),
              i.question_text),
            i.sensitive ? h('div', { class: 'u-mt-8 u-p-8-10 u-bg-xfdecea u-br-8 u-fs-12p5 u-c-x8a2f24' },
              h('b', null, 'Flagged for review:'), ' ' + (i.sensitive_reasons || 'No reason given.')) : null,
            i.ai_draft_reply
              ? h('div', { class: 'u-mt-8' },
                  h('b', { class: 'u-fs-11 u-c-muted u-tt-uppercase' }, 'AI draft reply' + (i.ai_confidence != null ? ' · ' + Math.round(i.ai_confidence * 100) + '% confidence' : '')),
                  h('textarea', { class: 'inqDraftText u-w-100pct u-mt-4 u-p-9-10 u-br-8 u-b-1-solid-xcfd8d6 u-ff-inherit u-fs-13p5 u-rs-vertical', 'data-id': i.id, rows: '4' }, i.ai_draft_reply))
              : h('p', { class: 'empty u-p-6-0' }, 'No draft yet — the agent hasn\'t answered this one.')),
          h('div', { class: 'actions u-fd-column u-ai-stretch' },
            i.ai_draft_reply ? [
              h('button', { class: 'small inqSaveBtn', 'data-id': i.id }, 'Save edits'),
              h('button', { class: 'small inqCopyBtn', 'data-id': i.id }, 'Copy reply')] : null,
            i.status !== 'answered'
              ? h('button', { class: 'small inqAnsweredBtn', 'data-id': i.id, 'data-status': i.status || '' }, 'Mark as answered')
              : h('span', { class: 'badge sev-low' }, 'Answered ' + fmtDate(i.answered_at))));
      };
      document.getElementById('inquiriesWrap').replaceChildren(...[answeredNoteNode, ...list.map(inquiryRow)].filter(Boolean));

      document.querySelectorAll('.inqSaveBtn').forEach(btn => btn.addEventListener('click', () => saveInquiryDraft(btn)));
      document.querySelectorAll('.inqCopyBtn').forEach(btn => btn.addEventListener('click', () => copyInquiryReply(btn)));
      document.querySelectorAll('.inqAnsweredBtn').forEach(btn => btn.addEventListener('click', () => markInquiryAnswered(btn)));
      document.querySelectorAll('.inqSeveritySelect').forEach(sel => sel.addEventListener('change', () => setInquirySeverity(sel)));
    }

    async function setInquirySeverity(sel){
      const id = sel.getAttribute('data-id');
      const newVal = sel.value || null;
      sel.disabled = true;
      try {
        // Only over the severity this page showed (the option rendered as
        // selected): a stale tab can't overwrite someone else's change.
        const shown = [...sel.options].find(o => o.defaultSelected);
        const ok = await updateIfUnchanged('customer_inquiries', id, { severity: newVal }, { severity: shown && shown.value ? shown.value : null });
        if (!ok) { showDashError(staleMessage('That inquiry')); loadInquiries(); return; }
        const rec = ALL_INQUIRIES.find(i => i.id === id);
        if (rec) rec.severity = newVal;
        renderInquiries();
      } catch (err) {
        showDashError('Could not update severity: ' + (err && err.message ? err.message : err));
        sel.disabled = false;
      }
    }

    async function saveInquiryDraft(btn){
      const id = btn.getAttribute('data-id');
      const textarea = document.querySelector(`.inqDraftText[data-id="${id}"]`);
      if (!textarea) return;
      const originalText = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Saving…';
      try {
        // EXT5: two people editing the same reply must not overwrite each
        // other silently. Re-read the draft first: if it changed since this
        // page loaded it, stop and keep this text in the box. (A short gap
        // remains between this read and the save; the text itself is too long
        // to use as a database condition safely.)
        const rec = ALL_INQUIRIES.find(i => i.id === id);
        const { data: nowRow, error: nowErr } = await supabase.from('customer_inquiries').select('ai_draft_reply, answered_at').eq('id', id).maybeSingle();
        if (nowErr) throw nowErr;
        if (!nowRow) throw new Error(staleMessage('That inquiry') + ' Your draft was not saved — copy it before reloading.');
        if (nowRow.answered_at) throw new Error('This inquiry was marked answered in the meantime, so the draft was not saved. Your text is still in the box — copy it if you need it.');
        if (rec && (nowRow.ai_draft_reply || '') !== (rec.ai_draft_reply || '')) {
          throw new Error('Someone else changed this draft since you opened it, so yours was not saved (nothing was overwritten). Your text is still in the box: copy it, reload to see theirs, then combine them.');
        }
        const { data: changed, error } = await supabase.from('customer_inquiries').update({ ai_draft_reply: textarea.value }).eq('id', id).is('answered_at', null).select('id');
        if (error) throw error;
        if (noRowsChanged(changed)) throw new Error(staleMessage('That inquiry') + ' Your draft was not saved — copy it before reloading.');
        if (rec) rec.ai_draft_reply = textarea.value;
        btn.textContent = 'Saved';
        setTimeout(() => { btn.textContent = originalText; btn.disabled = false; }, 1200);
      } catch (err) {
        showDashError('Could not save that edit: ' + (err && err.message ? err.message : err));
        btn.textContent = originalText;
        btn.disabled = false;
      }
    }

    async function copyInquiryReply(btn){
      const id = btn.getAttribute('data-id');
      const textarea = document.querySelector(`.inqDraftText[data-id="${id}"]`);
      if (!textarea) return;
      const originalText = btn.textContent;
      try {
        await navigator.clipboard.writeText(textarea.value);
        btn.textContent = 'Copied!';
      } catch (err) {
        showDashError('Could not copy to clipboard — you can select and copy the text by hand instead.');
      } finally {
        setTimeout(() => { btn.textContent = originalText; }, 1200);
      }
    }

    async function markInquiryAnswered(btn){
      const id = btn.getAttribute('data-id');
      btn.disabled = true;
      try {
        const changed = await updateIfUnchanged('customer_inquiries', id,
          { status: 'answered', answered_at: new Date().toISOString() }, { status: btn.getAttribute('data-status') || null });
        if (!changed) showDashError(staleMessage('That question'));
        loadInquiries();
      } catch (err) {
        showDashError('Could not mark that as answered: ' + (err && err.message ? err.message : err));
        btn.disabled = false;
      }
    }

  return { inquiriesList, loadInquiries, renderInquiries };
});
