// assets/app/he-compliance.js — Compliance pages: adverse events, legal holds (and released holds), documents, evidence locker (reads plus guarded record saves; no stock or money)
// EXT15: moved unchanged out of assets/owner-login-app.js (initApp). Its inputs
// arrive explicitly in ctx; it returns only what other code still uses. Map:
// docs/ops/APPLICATION_MODULE_MAP_EXT15.md. Created once, by the app, in order.
window.HE.modules.define('he-compliance', { api: 1, needs: ['CLOSED_IN','DOCUMENT_CATEGORY_LABELS','SEARCH_INDEX','appendMore','confirmSecondPress','docExpiryBadge','esc','fetchAllRows','fetchAllRowsIn','fmtDate','fmtDateOnly','isSafeLink','listLimit','newLoadToken','noRowsChanged','requireReauth','showDashError','showPageWarning','staleMessage','supabase','updateIfUnchanged'] }, function (ctx) {
    const { CLOSED_IN, DOCUMENT_CATEGORY_LABELS, SEARCH_INDEX, appendMore, confirmSecondPress, docExpiryBadge, esc, fetchAllRows, fetchAllRowsIn, fmtDate, fmtDateOnly, isSafeLink, listLimit, newLoadToken, noRowsChanged, requireReauth, showDashError, showPageWarning, staleMessage, supabase, updateIfUnchanged } = ctx;
    // Evidence Locker: a record of evidence tied to a specific incident (photos,
    // documents, emails, whatever backs up what happened), with a link to where
    // the actual file lives rather than storing the file itself.
    async function loadEvidenceLocker(){
      const isLatest = newLoadToken('evidence'); // EXT8: an older reply never draws over a newer one
      try {
        // EXT8: every open incident (any age) plus the newest 200, so
        // evidence can always be filed against an open incident.
        const [openIncidents, recentRes] = await Promise.all([
          fetchAllRows('incidents', 'id, incident_number, title, created_at', q => q.or('status.is.null,status.not.in.' + CLOSED_IN)),
          supabase.from('incidents').select('id, incident_number, title, created_at').order('created_at', { ascending: false }).limit(200),
        ]);
        if (recentRes.error) throw recentRes.error;
        if (!isLatest()) return;
        const seenInc = new Set();
        const incidents = openIncidents.concat(recentRes.data || [])
          .filter(i => !seenInc.has(i.id) && seenInc.add(i.id))
          .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));

        const incidentOptionsHtml = (incidents || []).map(i => `<option value="${esc(i.id)}">${esc(i.incident_number || 'Incident')} — ${esc(i.title)}</option>`).join('');

        const incidentSelect = document.getElementById('evidenceIncident');
        const currentVal = incidentSelect.value;
        incidentSelect.innerHTML = '<option value="">Which incident is this evidence for?</option>' + incidentOptionsHtml;
        incidentSelect.value = currentVal;

        const filterSelect = document.getElementById('evidenceFilter');
        const currentFilter = filterSelect.value;
        filterSelect.innerHTML = '<option value="">Show evidence for: all incidents</option>' + incidentOptionsHtml;
        filterSelect.value = currentFilter;

        const incidentById = Object.create(null);
        (incidents || []).forEach(i => { incidentById[i.id] = i; });

        let evidenceQuery = supabase
          .from('evidence_locker')
          .select('id, incident_id, title, description, evidence_type, external_link, file_path, created_at', { count: 'exact' })
          .order('created_at', { ascending: false })
          .limit(listLimit('evidence') * 4);
        if (currentFilter) evidenceQuery = evidenceQuery.eq('incident_id', currentFilter);
        const { data: evidence, error, count: evidenceCount } = await evidenceQuery;
        if (error) throw error;
        if (!isLatest()) return;
        // Names for evidence filed against incidents outside the list above.
        const missingInc = [...new Set((evidence || []).map(e => e.incident_id).filter(id => id && !incidentById[id]))];
        if (missingInc.length) {
          (await fetchAllRowsIn('incidents', 'id, incident_number, title', 'id', missingInc)).forEach(i => { incidentById[i.id] = i; });
        }
        if (!currentFilter) SEARCH_INDEX.evidence = evidence;

        if (!evidence || !evidence.length) {
          document.getElementById('evidenceWrap').innerHTML = currentFilter
            ? '<p class="empty">No evidence recorded yet for this incident.</p>'
            : '<p class="empty">No evidence recorded yet — add your first entry below.</p>';
          return;
        }

        document.getElementById('evidenceWrap').innerHTML = evidence.map(e => {
          const inc = incidentById[e.incident_id];
          const incLabel = inc ? `${esc(inc.incident_number || 'Incident')} — ${esc(inc.title)}` : 'Incident no longer on file';
          return `
          <div class="approvalRow" data-file-path="${esc(e.file_path || '')}">
            <div class="info">
              <b>${esc(e.title)}</b>
              ${e.evidence_type ? `<span class="badge">${esc(e.evidence_type)}</span>` : ''}
              <div class="u-fs-12 u-c-muted u-mt-3">Tied to: ${incLabel}</div>
              ${e.description ? `<div class="u-fs-12 u-c-muted u-mt-3">${esc(e.description)}</div>` : ''}
              ${e.file_path ? `<div class="u-fs-12 u-mt-3"><a href="#" class="evidenceFileLink">Download uploaded file</a></div>` : ''}
              ${e.external_link ? (isSafeLink(e.external_link)
                ? `<div class="u-fs-12 u-mt-3"><a href="${esc(e.external_link)}" target="_blank" rel="noopener noreferrer">Open linked file</a></div>`
                : `<div class="u-fs-12 u-mt-3 u-c-muted">Linked file (not opened — this kind of link can run code): ${esc(e.external_link)}</div>`) : ''}
              <br><span class="u-fs-11 u-c-muted">Added ${esc(fmtDate(e.created_at))}</span>
            </div>
          </div>`;
        }).join('');
        appendMore('evidenceWrap', 'evidence', evidence.length, evidenceCount, 'evidence entries', loadEvidenceLocker);

        document.querySelectorAll('.evidenceFileLink').forEach(link => {
          link.addEventListener('click', async (ev) => {
            ev.preventDefault();
            const row = link.closest('.approvalRow');
            const path = row.getAttribute('data-file-path');
            if (!path) return;
            const originalText = link.textContent;
            link.textContent = 'Preparing download…';
            try {
              const { data, error: signErr } = await supabase.storage.from('evidence-files').createSignedUrl(path, 60);
              if (signErr) throw signErr;
              window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
            } catch (err) {
              showDashError('Could not open that file: ' + (err && err.message ? err.message : err));
            } finally {
              link.textContent = originalText;
            }
          });
        });
      } catch (err) {
        if (!isLatest()) return;
        showDashError('Could not load the evidence locker: ' + (err && err.message ? err.message : err));
      }
    }

    async function loadDocuments(){
      try {
        // A document can be linked to a supplier, or to nothing: the database
        // only allows related_type 'supplier' or 'general' (Query A). Incident
        // and purchase-order links were offered before and always failed.
        const [{ data: docs, error, count: docCount }, { data: suppliers }] = await Promise.all([
          supabase.from('documents')
            .select('id, title, category, related_type, related_id, document_url, file_path, issued_date, expiration_date, notes, created_at', { count: 'exact' })
            .order('created_at', { ascending: false }),
          fetchAllRows('suppliers', 'id, name', q => q).then(rows => ({ data: rows.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))) }), () => ({ data: [] })),
        ]);
        if (error) throw error;
        const rows = docs || [];
        showPageWarning('documentsPanel', typeof docCount === 'number' && docCount > rows.length
          ? 'Showing the newest ' + rows.length + ' of ' + docCount + ' documents: older ones are not listed on this page.' : null);
        SEARCH_INDEX.documents = rows;

        const suppliersById = Object.create(null); (suppliers || []).forEach(s => { suppliersById[s.id] = s; });

        function relatedLabel(d){
          if (d.related_type === 'supplier' && suppliersById[d.related_id]) return 'Supplier: ' + suppliersById[d.related_id].name;
          return null;
        }

        // "Link to a record" dropdown on the add-document form, grouped by type.
        const relatedSel = document.getElementById('docRelated');
        const keepRelated = relatedSel.value;
        relatedSel.innerHTML = '<option value="">Not linked to a specific record</option>' +
          (suppliers && suppliers.length ? `<optgroup label="Suppliers">${suppliers.map(s => `<option value="supplier:${esc(s.id)}">${esc(s.name)}</option>`).join('')}</optgroup>` : '');
        relatedSel.value = keepRelated;

        const expiringSoon = rows.filter(d => {
          if (!d.expiration_date) return false;
          const days = Math.round((new Date(d.expiration_date + 'T00:00:00').getTime() - new Date().setHours(0,0,0,0)) / 86400000);
          return days <= 30;
        }).length;
        document.getElementById('documentsStats').innerHTML = `
          <div class="stat"><div class="num">${rows.length}</div><div class="lbl">Documents on file</div></div>
          <div class="stat"><div class="num">${expiringSoon}</div><div class="lbl">Expired or expiring within 30 days</div></div>`;

        document.getElementById('documentsWrap').innerHTML = rows.length ? rows.map(d => {
          const related = relatedLabel(d);
          return `
            <div class="deletedRow u-ai-flex-start" data-id="${esc(d.id)}" data-file-path="${esc(d.file_path || '')}">
              <div class="info u-flex-1">
                <b>${esc(d.title)}</b>
                <span class="badge">${esc(DOCUMENT_CATEGORY_LABELS[d.category] || d.category || 'Other')}</span>
                ${docExpiryBadge(d.expiration_date)}
                ${related ? `<div class="u-fs-12 u-c-muted u-mt-3">Linked to: ${esc(related)}</div>` : ''}
                ${d.issued_date ? `<div class="u-fs-12 u-c-muted u-mt-3">Issued ${esc(fmtDateOnly(d.issued_date))}</div>` : ''}
                ${d.notes ? `<div class="u-mt-6">${esc(d.notes)}</div>` : ''}
                ${d.file_path ? `<div class="u-fs-12 u-mt-6"><a href="#" class="docFileLink">Open uploaded file</a></div>` : ''}
                ${d.document_url ? (isSafeLink(d.document_url)
                  ? `<div class="u-fs-12 u-mt-6"><a href="${esc(d.document_url)}" target="_blank" rel="noopener noreferrer">Open linked document</a></div>`
                  : `<div class="u-fs-12 u-mt-6 u-c-muted">Linked document (not opened — this kind of link can run code): ${esc(d.document_url)}</div>`) : ''}
                <div class="u-mt-8"><button type="button" class="small secondary docDeleteBtn">Delete</button></div>
              </div>
            </div>`;
        }).join('') : '<p class="empty">No documents on file yet — add your first one below.</p>';

        document.querySelectorAll('.docFileLink').forEach(link => {
          link.addEventListener('click', async (ev) => {
            ev.preventDefault();
            const row = link.closest('[data-file-path]');
            const path = row.getAttribute('data-file-path');
            if (!path) return;
            const original = link.textContent;
            link.textContent = 'Preparing…';
            try {
              const { data, error: signErr } = await supabase.storage.from('document-files').createSignedUrl(path, 60);
              if (signErr) throw signErr;
              window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
            } catch (err) {
              showDashError('Could not open that file: ' + (err && err.message ? err.message : err));
            } finally {
              link.textContent = original;
            }
          });
        });

        document.querySelectorAll('.docDeleteBtn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const row = btn.closest('[data-id]');
            const id = row.getAttribute('data-id');
            if (!confirm('Delete this document? This can\'t be undone.')) return;
            // A permanent delete of a compliance record: same password re-check
            // as deleting an order (which is only a soft delete).
            const ok = await requireReauth('permanently delete this document');
            if (!ok) return;
            btn.disabled = true;
            try {
              const filePathToRemove = row.getAttribute('data-file-path') || '';
              // Only while it still has the file this page showed: if another tab
              // replaced the file meanwhile, deleting by id alone would remove the
              // record and the OLD file and leave the new file orphaned.
              let delQ = supabase.from('documents').delete().eq('id', id);
              delQ = filePathToRemove ? delQ.eq('file_path', filePathToRemove) : delQ.is('file_path', null);
              const { data: gone, error: delErr } = await delQ.select('id');
              if (delErr) throw delErr;
              if (noRowsChanged(gone)) { showDashError(staleMessage('That document')); loadDocuments(); return; }
              // The record is gone; remove its stored file too (it used to be
              // left in storage with nothing pointing at it).
              if (filePathToRemove) {
                const { error: fileErr } = await supabase.storage.from('document-files').remove([filePathToRemove]);
                if (fileErr) {
                  showDashError('The document was deleted, but its file could not be removed from storage ("' + filePathToRemove + '"). Tell the owner so it can be cleaned up.');
                  loadDocuments();
                  return;
                }
              }
              toastOk('Document deleted.');
              loadDocuments();
            } catch (err) {
              btn.disabled = false;
              const msg = (err && err.message) || String(err);
              if (/row-level security|permission/i.test(msg)) {
                showDashError('Only the Owner or an Administrator can delete a document — ask one of them, or deactivate/replace it instead.');
              } else {
                showDashError('Could not delete that document: ' + msg);
              }
            }
          });
        });
      } catch (err) {
        document.getElementById('documentsWrap').innerHTML = '';
        showDashError('Could not load documents: ' + (err && err.message ? err.message : err));
      }
    }

    async function loadAdverseEvents(){
      try {
        const { data: events, error, count: capCount } = await supabase
          .from('adverse_event_reports')
          .select('id, product_name, date_received, description, outcome_type, fda_report_deadline, fda_reported, fda_reported_at, reporter_name, reporter_contact, created_at', { count: 'exact' })
          .order('fda_report_deadline', { ascending: true });
        if (error) throw error;
        showPageWarning('adverseEventsPanel', typeof capCount === 'number' && capCount > (events || []).length ? 'Showing the first ' + (events || []).length + ' of ' + capCount + ' adverse event reports: the rest are not listed on this page.' : null);
        SEARCH_INDEX.adverseEvents = events;

        if (!events || !events.length) {
          document.getElementById('adverseEventsWrap').innerHTML = '<p class="empty">No adverse event reports on file — hopefully it stays that way.</p>';
          return;
        }

        const today = new Date(); today.setHours(0, 0, 0, 0);

        document.getElementById('adverseEventsWrap').innerHTML = events.map(ev => {
          const deadline = new Date(ev.fda_report_deadline + 'T00:00:00');
          const daysLeft = Math.round((deadline - today) / 86400000);
          let statusLabel, statusClass;
          if (ev.fda_reported) {
            statusLabel = 'Reported to FDA';
            statusClass = 'sev-low';
          } else if (daysLeft < 0) {
            statusLabel = `OVERDUE by ${Math.abs(daysLeft)} day(s)`;
            statusClass = 'sev-high';
          } else {
            statusLabel = `Due ${esc(fmtDateOnly(ev.fda_report_deadline))} (${daysLeft} day${daysLeft === 1 ? '' : 's'} left)`;
            statusClass = daysLeft <= 3 ? 'sev-high' : 'sev-medium';
          }
          return `
          <div class="approvalRow" data-id="${esc(ev.id)}">
            <div class="info">
              <b>${esc(ev.product_name)}</b>
              <span class="badge ${statusClass}">${statusLabel}</span>
              ${ev.outcome_type ? `<span class="badge">${esc(ev.outcome_type.replace(/_/g, ' '))}</span>` : ''}
              <div class="u-fs-12 u-c-muted u-mt-3">${esc(ev.description)}</div>
              ${ev.reporter_name ? `<div class="u-fs-11 u-c-muted u-mt-3">Reported by: ${esc(ev.reporter_name)}${ev.reporter_contact ? ' — ' + esc(ev.reporter_contact) : ''}</div>` : ''}
              <br><span class="u-fs-11 u-c-muted">Received ${esc(fmtDateOnly(ev.date_received))}</span>
            </div>
            <div class="actions">
              ${!ev.fda_reported ? `<button class="small aeMarkReportedBtn">Mark reported to FDA</button>` : ''}
            </div>
          </div>`;
        }).join('');

        document.querySelectorAll('.aeMarkReportedBtn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const row = btn.closest('.approvalRow');
            const id = row.getAttribute('data-id');
            // A regulatory record with no undo button: needs a second press,
            // and only sets the flag if it isn't already set.
            if (!confirmSecondPress(btn, 'Confirm: filed with FDA?')) return;
            btn.disabled = true;
            try {
              const changed = await updateIfUnchanged('adverse_event_reports', id,
                { fda_reported: true, fda_reported_at: new Date().toISOString() },
                { fda_reported: { notIs: true } });
              if (!changed) showDashError(staleMessage('That report'));
              loadAdverseEvents();
            } catch (err) {
              btn.disabled = false;
              showDashError('Could not update that report: ' + (err && err.message ? err.message : err));
            }
          });
        });
      } catch (err) {
        showDashError('Could not load adverse event reports: ' + (err && err.message ? err.message : err));
      }
    }

    // Legal Holds
    async function loadLegalHolds(){
      try {
        const { data: holds, error, count: capCount } = await supabase
          .from('legal_holds')
          .select('id, title, description, related_type, related_reference, placed_at', { count: 'exact' })
          .eq('status', 'active')
          .order('placed_at', { ascending: false });
        if (error) throw error;
        showPageWarning('legalHoldsPanel', typeof capCount === 'number' && capCount > (holds || []).length ? 'Showing the first ' + (holds || []).length + ' of ' + capCount + ' active legal holds: the rest are not listed on this page.' : null);
        SEARCH_INDEX.legalHolds = holds;

        if (!holds || !holds.length) {
          document.getElementById('legalHoldsWrap').innerHTML = '<p class="empty">No active legal holds.</p>';
          return;
        }

        document.getElementById('legalHoldsWrap').innerHTML = holds.map(h => `
          <div class="approvalRow" data-id="${esc(h.id)}">
            <div class="info">
              <b>${esc(h.title)}</b>
              ${h.related_type ? `<span class="badge">${esc(h.related_type)}</span>` : ''}
              ${h.related_reference ? `<div class="u-fs-12 u-c-muted u-mt-3">Reference: ${esc(h.related_reference)}</div>` : ''}
              ${h.description ? `<div class="u-fs-12 u-c-muted u-mt-3">${esc(h.description)}</div>` : ''}
              <br><span class="u-fs-11 u-c-muted">Placed ${esc(fmtDate(h.placed_at))}</span>
            </div>
            <div class="actions">
              <button class="small lhReleaseBtn">Release hold</button>
            </div>
          </div>`).join('');

        document.querySelectorAll('.lhReleaseBtn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const row = btn.closest('.approvalRow');
            const id = row.getAttribute('data-id');
            // Releasing a legal hold lets protected records be changed or
            // deleted again, so it gets the same password re-check as the
            // other sensitive actions, and only an active hold is released.
            const ok = await requireReauth('release this legal hold');
            if (!ok) return;
            btn.disabled = true;
            try {
              const { data: sessionData } = await supabase.auth.getSession();
              const uid = sessionData && sessionData.session ? sessionData.session.user.id : null;
              const changed = await updateIfUnchanged('legal_holds', id,
                { status: 'released', released_at: new Date().toISOString(), released_by: uid },
                { status: 'active' });
              if (!changed) showDashError(staleMessage('That legal hold'));
              loadLegalHolds();
              loadReleasedLegalHolds();
            } catch (err) {
              btn.disabled = false;
              showDashError('Could not release that hold: ' + (err && err.message ? err.message : err));
            }
          });
        });
      } catch (err) {
        showDashError('Could not load legal holds: ' + (err && err.message ? err.message : err));
      }
    }

    async function loadReleasedLegalHolds(){
      try {
        const { data: holds, error, count } = await supabase
          .from('legal_holds')
          .select('id, title, released_at', { count: 'exact' })
          .eq('status', 'released')
          .order('released_at', { ascending: false })
          .limit(listLimit('relHolds'));
        if (error) throw error;

        if (!holds || !holds.length) {
          document.getElementById('releasedLegalHoldsWrap').innerHTML = '<p class="empty">No released holds yet.</p>';
          return;
        }
        document.getElementById('releasedLegalHoldsWrap').innerHTML = holds.map(h => `
          <div class="deletedRow">
            <div class="info"><b>${esc(h.title)}</b><br>
            <span class="u-fs-11 u-c-muted">Released ${esc(fmtDate(h.released_at))}</span></div>
          </div>`).join('');
        appendMore('releasedLegalHoldsWrap', 'relHolds', holds.length, count, 'released holds', loadReleasedLegalHolds);
      } catch (err) {
        showDashError('Could not load released holds: ' + (err && err.message ? err.message : err));
      }
    }

  return { loadAdverseEvents, loadLegalHolds, loadReleasedLegalHolds, loadDocuments, loadEvidenceLocker };
});
