// assets/app/he-incidents.js — Incidents: list, and turning a failed quality check into one incident only once
// EXT15: moved unchanged out of assets/owner-login-app.js (initApp). Its inputs
// arrive explicitly in ctx; it returns only what other code still uses. Map:
// docs/ops/APPLICATION_MODULE_MAP_EXT15.md. Created once, by the app, in order.
window.HE.modules.define('he-incidents', { api: 1, needs: ['CLOSED_IN','SEARCH_INDEX','fixedRequestKey','fmtDate','h','isClosedStatus','isOverdue','isRequestKeyRepeat','requestKeysOn','showDashError','staleMessage','supabase','updateIfUnchanged','withRequestKey'] }, function (ctx) {
    const { CLOSED_IN, SEARCH_INDEX, fixedRequestKey, fmtDate, h, isClosedStatus, isOverdue, isRequestKeyRepeat, requestKeysOn, showDashError, staleMessage, supabase, updateIfUnchanged, withRequestKey } = ctx;
    // "Escalate to Incident" for a quality check or a recall, at most once.
    // A tab opened earlier (or a second person) must not create a second
    // incident and silently re-point the record at it, leaving the first one
    // orphaned. Re-reads the link first, then links only while still unlinked.
    // Returns true when this call made the link.
    async function escalateToIncidentOnce(table, id, incidentRow){
      const { data: now, error: readErr } = await supabase.from(table).select('incident_id').eq('id', id).maybeSingle();
      if (readErr) throw readErr;
      if (!now || now.incident_id) { showDashError(staleMessage('That record')); return false; }
      // EXT10 (U42): with request keys on, the incident's key is made from the
      // record, so a retry after a lost reply (or a second tab) finds the
      // incident already made instead of making another.
      const rk = (await requestKeysOn()) ? fixedRequestKey('escalate|' + table + '|' + id) : null;
      let { data: incident, error: incErr } = await supabase.from('incidents').insert(withRequestKey(incidentRow, rk)).select('id, incident_number').single();
      if (rk && isRequestKeyRepeat(incErr)) {
        ({ data: incident, error: incErr } = await supabase.from('incidents').select('id, incident_number').eq('client_request_id', rk).single());
      }
      if (incErr) throw incErr;
      const linked = await updateIfUnchanged(table, id, { incident_id: incident.id, updated_at: new Date().toISOString() }, { incident_id: null });
      if (!linked) {
        showDashError('Someone escalated this at the same moment, so incident ' + (incident.incident_number || '') +
          ' is an extra copy. Close it on the Incidents page.');
        return false;
      }
      return true;
    }

    async function loadIncidents(){
      try {
        const { data: incidents, error, count } = await supabase
          .from('incidents')
          .select('id, incident_number, title, severity, status, due_at', { count: 'exact' })
          // Open = no status yet, or a status that is not a closed word (EXT7,
          // same reason as loadTasks). A row without a status stays visible.
          .or('status.is.null,status.not.in.' + CLOSED_IN)
          .order('due_at', { ascending: true, nullsFirst: false })
          .limit(100);
        if (error) throw error;
        SEARCH_INDEX.incidents = incidents;

        const open = incidents.filter(i => !isClosedStatus(i.status));
        const truncated = count != null && count > incidents.length;
        // EXT20J: built as DOM nodes (h() text-ifies) instead of an HTML string,
        // so the Incidents screen is safe under Trusted Types. An incident title
        // or message can never become executable markup — it was esc()-ed before,
        // and is now only ever a text node.
        const cutoffNoteNode = truncated
          ? h('p', { class: 'hint u-m-0-0-8 u-c-warn' }, `Showing the ${incidents.length} soonest-due of ${count} open incidents.`) : null;
        if (!open.length) {
          document.getElementById('incidentsTableWrap').replaceChildren(...[cutoffNoteNode, h('p', { class: 'empty' }, 'No open incidents.')].filter(Boolean));
        } else {
          document.getElementById('incidentsTableWrap').replaceChildren(...[cutoffNoteNode,
            h('table', { class: 'phoneCards' },
              h('thead', null, h('tr', null, h('th', null, '#'), h('th', null, 'Title'), h('th', null, 'Severity'), h('th', null, 'Status'), h('th', null, 'Due'))),
              h('tbody', null, open.map(i =>
                h('tr', { class: isOverdue(i.due_at, i.status) ? 'overdue' : '', 'data-id': i.id },
                  h('td', null, i.incident_number || '—'),
                  h('td', null, i.title),
                  h('td', null, h('span', { class: 'badge sev-' + (i.severity || '').toLowerCase() }, i.severity || '—')),
                  h('td', null, i.status || '—'),
                  h('td', null, fmtDate(i.due_at))))))
          ].filter(Boolean));
        }
      } catch (err) {
        showDashError('Could not load incidents: ' + (err && err.message ? err.message : err));
      }
    }

  return { escalateToIncidentOnce, loadIncidents };
});
