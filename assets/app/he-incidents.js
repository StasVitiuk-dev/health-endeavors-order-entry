// assets/app/he-incidents.js — Incidents: list, turning a failed quality check into one incident only once,
// and (behind incidentCloseOn) recording what was done on an incident and closing it
// EXT15: moved unchanged out of assets/owner-login-app.js (initApp). Its inputs
// arrive explicitly in ctx; it returns only what other code still uses. Map:
// docs/ops/APPLICATION_MODULE_MAP_EXT15.md. Created once, by the app, in order.
window.HE.modules.define('he-incidents', { api: 1, needs: ['CLOSED_IN','SEARCH_INDEX','announce','currentRole','fixedRequestKey','fmtDate','h','incidentCloseOn','isClosedStatus','isOverdue','isRequestKeyRepeat','requestKeysOn','showDashError','staleMessage','supabase','updateIfUnchanged','withRequestKey'] }, function (ctx) {
    const { CLOSED_IN, SEARCH_INDEX, announce, currentRole, fixedRequestKey, fmtDate, h, incidentCloseOn, isClosedStatus, isOverdue, isRequestKeyRepeat, requestKeysOn, showDashError, staleMessage, supabase, updateIfUnchanged, withRequestKey } = ctx;
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

    // ---- Record what was done, and close (Nov 24; behind incidentCloseOn) ----
    // The owner and administrators get one button per open incident: write what
    // was done, then keep it open or close it. Nothing is deleted; a closed
    // incident moves to "Closed incidents" below with its note. Rules:
    // assets/views/he-incident-close.js. Uses columns the table already has.
    const icMod = () => (window.HE && window.HE.views && window.HE.views['he-incident-close']) || null;
    const icOn = () => { const IC = icMod(); return !!(IC && incidentCloseOn() && IC.canClose(currentRole())); };
    const icName = (i) => (i.incident_number || 'Incident') + ' — ' + (i.title || 'no title');
    let icRows = [];      // the open incidents on screen, with their notes
    let icResult = '';    // what the last save did, shown once above the list
    function icForm(i){
      const IC = icMod();
      // data-base: the incident as it was when this form was opened, so a redraw
      // (Refresh) that keeps the typed note never lets it overwrite a change
      // made elsewhere meanwhile
      const base = JSON.stringify({ status: i.status == null ? null : i.status, updated_at: i.updated_at == null ? null : i.updated_at });
      return h('form', { class: 'icForm', 'data-incform': String(i.id), 'data-base': base, 'aria-label': 'Record what was done for ' + icName(i) },
        h('h3', null, icName(i)),
        i.description ? h('p', { class: 'hint icAbout' }, String(i.description).slice(0, 2000)) : null,
        h('label', null, 'What was done', h('textarea', { name: 'done', rows: '4', maxlength: String(IC.MAX_CHARS), required: true }, i.actions_taken || '')),
        h('label', null, 'How it ended (optional)', h('textarea', { name: 'ended', rows: '2', maxlength: String(IC.MAX_CHARS) }, i.resolution || '')),
        h('p', { class: 'hint' }, 'Never type passwords or codes here. The note stays with the incident, and the incident is kept after closing (nothing is deleted).'),
        h('div', { class: 'icButtons' },
          h('button', { type: 'submit', class: 'small', 'data-incsave': 'close' }, 'Save and close the incident'),
          h('button', { type: 'submit', class: 'small secondary', 'data-incsave': 'note' }, 'Save the note, keep it open'),
          h('button', { type: 'button', class: 'small secondary', 'data-inccancel': '1' }, 'Cancel')),
        h('p', { class: 'hint', role: 'status', 'data-incmessage': '1' }, ''));
    }
    function icOpenForm(id){
      const wrap = document.getElementById('incidentsTableWrap'), i = icRows.find(r => String(r.id) === String(id));
      const host = wrap && wrap.querySelector('[data-inchost]');
      if (!host || !i || !icOn()) return;
      host.replaceChildren(icForm(i));
      const box = host.querySelector('textarea[name="done"]'); if (box) box.focus();
    }
    function icBase(form, row){
      try {
        const b = JSON.parse(form.getAttribute('data-base') || '');
        if (b && typeof b === 'object' && 'status' in b && 'updated_at' in b) return { status: b.status, updated_at: b.updated_at };
      } catch (e) { /* fall back to the row on screen */ }
      return { status: row.status == null ? null : row.status, updated_at: row.updated_at == null ? null : row.updated_at };
    }
    function icDropForm(id){
      const host = document.querySelector('#incidentsTableWrap [data-inchost]'), f = host && host.querySelector('form[data-incform]');
      if (f && f.getAttribute('data-incform') === id) host.replaceChildren();
    }
    // the open note form, read just before the list is drawn again (Refresh,
    // pull to refresh, an escalation from another page), so typing is not lost
    function icKeep(){
      const f = document.querySelector('#incidentsTableWrap [data-inchost] form[data-incform]');
      if (!f) return null;
      const a = document.activeElement, focus = a && f.contains(a) && (a.name === 'done' || a.name === 'ended') ? a.name : '';
      return { id: f.getAttribute('data-incform'), base: f.getAttribute('data-base'), done: f.elements.done.value, ended: f.elements.ended.value,
        focus, start: focus ? a.selectionStart : null, end: focus ? a.selectionEnd : null };
    }
    function icRestore(keep){
      if (!keep || !icOn()) return;
      const host = document.querySelector('#incidentsTableWrap [data-inchost]'), i = icRows.find(r => String(r.id) === keep.id);
      if (!host || !i) return;   // closed elsewhere meanwhile: it is now under "Closed incidents"
      const f = icForm(i);
      if (keep.base != null) f.setAttribute('data-base', keep.base);
      f.elements.done.value = keep.done;
      f.elements.ended.value = keep.ended;
      host.replaceChildren(f);
      if (keep.focus) { const box = f.elements[keep.focus]; box.focus(); try { box.setSelectionRange(keep.start, keep.end); } catch (e) { /* not a text box */ } }
    }
    async function icSave(form, mode){
      const IC = icMod(); if (!IC) return;
      const say = (t) => { const p = form.querySelector('[data-incmessage]'); if (p) p.textContent = t; };
      const row = icRows.find(r => String(r.id) === form.getAttribute('data-incform'));
      if (!row) { say('This incident is no longer in the list. Open the page again.'); return; }
      if (!icOn()) { say('Only the owner and administrators can do this.'); return; }
      const c = IC.check({ done: form.elements.done.value, ended: form.elements.ended.value });
      if (!c.ok) { say(c.reason); form.elements.done.focus(); return; }
      const buttons = Array.from(form.querySelectorAll('button'));
      buttons.forEach(b => { b.disabled = true; });
      say('Saving…');
      try {
        // only while nobody changed the incident since this list was read
        const saved = await updateIfUnchanged('incidents', row.id, IC.patch(mode, c, new Date().toISOString()), icBase(form, row));
        icResult = !saved ? staleMessage('That incident')
          : mode === 'close' ? icName(row) + ' is closed. Your note is saved with it under "Closed incidents".'
          : 'Your note is saved on ' + icName(row) + '. It stays open.';
        announce(icResult);
        icDropForm(form.getAttribute('data-incform'));   // saved or refused as changed: the form closes, the list is read again
        await loadIncidents();
        const done = document.querySelector('#incidentsTableWrap [data-incresult]'); if (done) done.focus();
      } catch (err) {
        say(IC.friendlyError(err));
        buttons.forEach(b => { b.disabled = false; });
      }
    }
    (function icListen(){
      const wrap = document.getElementById('incidentsTableWrap'); if (!wrap) return;
      wrap.addEventListener('click', (e) => {
        const t = e.target instanceof Element ? e.target : null; if (!t) return;
        const open = t.closest('button[data-increcord]');
        if (open) { icOpenForm(open.getAttribute('data-increcord')); return; }
        if (t.closest('button[data-inccancel]')) {
          const host = wrap.querySelector('[data-inchost]'), id = host && host.querySelector('form') ? host.querySelector('form').getAttribute('data-incform') : '';
          if (host) host.replaceChildren();
          const back = Array.from(wrap.querySelectorAll('button[data-increcord]')).find(b => b.getAttribute('data-increcord') === id); if (back) back.focus();
        }
      });
      wrap.addEventListener('submit', (e) => {
        const form = e.target instanceof Element ? e.target.closest('form[data-incform]') : null; if (!form) return;
        e.preventDefault();
        const by = e.submitter instanceof Element ? e.submitter.getAttribute('data-incsave') : '';
        icSave(form, by === 'close' ? 'close' : 'note');   // anything unclear only saves the note
      });
    })();
    // the latest closed incidents with their notes (owner and administrators)
    async function icClosedList(){
      const IC = icMod();
      try {
        const { data, error } = await supabase.from('incidents')
          .select('id, incident_number, title, status, actions_taken, resolution, closed_at, updated_at')
          .in('status', IC.CLOSED_WORDS).order('updated_at', { ascending: false }).limit(10);
        if (error) throw error;
        const rows = (Array.isArray(data) ? data : []).filter(r => r && typeof r === 'object');
        return h('details', { class: 'icClosed', 'data-incclosed': String(rows.length) },
          h('summary', null, 'Closed incidents (the latest ' + rows.length + ')'),
          rows.length ? h('table', { class: 'phoneCards' },
            h('thead', null, h('tr', null, h('th', null, '#'), h('th', null, 'Title'), h('th', null, 'What was done'), h('th', null, 'How it ended'), h('th', null, 'Closed'))),
            h('tbody', null, rows.map(r => h('tr', { 'data-id': r.id },
              h('td', null, r.incident_number || '—'),
              h('td', { 'data-label': 'Title' }, r.title || '—'),
              h('td', { 'data-label': 'What was done', class: 'icNote' }, r.actions_taken || '—'),
              h('td', { 'data-label': 'How it ended', class: 'icNote' }, r.resolution || '—'),
              h('td', { 'data-label': 'Closed' }, fmtDate(r.closed_at || r.updated_at))))))
            : h('p', { class: 'hint' }, 'No incident has been closed yet.'));
      } catch (err) {
        return h('p', { class: 'hint', 'data-incclosed': 'error' }, 'Could not read the closed incidents just now.');
      }
    }

    async function loadIncidents(){
      try {
        const closing = icOn();
        const { data: incidents, error, count } = await supabase
          .from('incidents')
          .select('id, incident_number, title, severity, status, due_at' + (closing ? ', description, actions_taken, resolution, updated_at' : ''), { count: 'exact' })
          // Open = no status yet, or a status that is not a closed word (EXT7,
          // same reason as loadTasks). A row without a status stays visible.
          .or('status.is.null,status.not.in.' + CLOSED_IN)
          .order('due_at', { ascending: true, nullsFirst: false })
          .limit(100);
        if (error) throw error;
        SEARCH_INDEX.incidents = incidents;

        const open = incidents.filter(i => !isClosedStatus(i.status));
        icRows = closing ? open : [];
        const truncated = count != null && count > incidents.length;
        // EXT20J: built as DOM nodes (h() text-ifies) instead of an HTML string,
        // so the Incidents screen is safe under Trusted Types. An incident title
        // or message can never become executable markup — it was esc()-ed before,
        // and is now only ever a text node.
        const cutoffNoteNode = truncated
          ? h('p', { class: 'hint u-m-0-0-8 u-c-warn' }, `Showing the ${incidents.length} soonest-due of ${count} open incidents.`) : null;
        const resultNode = closing && icResult ? h('p', { class: 'hint icResult', role: 'status', tabindex: '-1', 'data-incresult': '1' }, icResult) : null;
        icResult = '';
        const closedNode = closing ? await icClosedList() : null;
        const keep = closing ? icKeep() : null;
        if (!open.length) {
          document.getElementById('incidentsTableWrap').replaceChildren(...[resultNode, cutoffNoteNode, h('p', { class: 'empty' }, 'No open incidents.'), closedNode].filter(Boolean));
        } else {
          document.getElementById('incidentsTableWrap').replaceChildren(...[resultNode, cutoffNoteNode,
            h('table', { class: 'phoneCards' },
              h('thead', null, h('tr', null, h('th', null, '#'), h('th', null, 'Title'), h('th', null, 'Severity'), h('th', null, 'Status'), h('th', null, 'Due'), closing ? h('th', null, 'Action') : null)),
              h('tbody', null, open.map(i =>
                h('tr', { class: isOverdue(i.due_at, i.status) ? 'overdue' : '', 'data-id': i.id },
                  h('td', null, i.incident_number || '—'),
                  h('td', null, i.title),
                  h('td', null, h('span', { class: 'badge sev-' + (i.severity || '').toLowerCase() }, i.severity || '—')),
                  h('td', null, i.status || '—'),
                  h('td', null, fmtDate(i.due_at)),
                  closing ? h('td', null, h('button', { type: 'button', class: 'small secondary', 'data-increcord': String(i.id), 'aria-label': 'Record what was done for ' + icName(i) }, 'Record what was done')) : null)))),
            closing ? h('div', { class: 'icHost', 'data-inchost': '1' }) : null,
            closedNode
          ].filter(Boolean));
          icRestore(keep);
        }
      } catch (err) {
        showDashError('Could not load incidents: ' + (err && err.message ? err.message : err));
      }
    }

  return { escalateToIncidentOnce, loadIncidents };
});
