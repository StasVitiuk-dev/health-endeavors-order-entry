// assets/app/he-audit.js — change history and activity: record titles, field names, change descriptions and diffs, inspector targets, activity feed reads
// EXT15: moved unchanged out of assets/owner-login-app.js (initApp). Its inputs
// arrive explicitly in ctx; it returns only what other code still uses. Map:
// docs/ops/APPLICATION_MODULE_MAP_EXT15.md. Created once, by the app, in order.
window.HE.modules.define('he-audit', { api: 1, needs: ['ACTIVITY_AREA_LABELS','PANEL_RECORD_TABLE','RECORD_ID_ATTRS','RECORD_TITLE_KEYS','esc','supabase'] }, function (ctx) {
    const { ACTIVITY_AREA_LABELS, PANEL_RECORD_TABLE, RECORD_ID_ATTRS, RECORD_TITLE_KEYS, esc, supabase } = ctx;
    function recordTitle(r){
      const nd = r.new_data || {};
      const od = r.old_data || {};
      const src = Object.keys(nd).length ? nd : od;
      for (const k of RECORD_TITLE_KEYS) {
        const v = src[k];
        if (v !== undefined && v !== null && String(v).trim() !== '') {
          const s = String(v);
          return s.length > 48 ? s.slice(0, 48) + '…' : s;
        }
      }
      return r.record_id ? String(r.record_id).slice(0, 8) : '—';
    }

    function prettyField(f){
      return String(f).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
    function jsonPreview(v){
      if (v === null || v === undefined) return '—';
      let s;
      if (typeof v === 'object') { try { s = JSON.stringify(v); } catch (e) { s = '…'; } }
      else s = String(v);
      if (s === '') return '(empty)';
      return s.length > 80 ? s.slice(0, 80) + '…' : s;
    }

    // Turns one log entry into a readable "what actually changed" block. Entries
    // from the privacy-protected areas carry only field names, never values.
    function describeChange(r){
      const nd = r.new_data || {};
      const od = r.old_data || {};
      const privacyNote = "Actual values aren't recorded for this area, to keep personal data and formula details out of the log.";

      if (!r.values_stored) {
        const fields = Array.isArray(nd.changed_fields) ? nd.changed_fields : [];
        if (r.action === 'UPDATE' && fields.length) {
          return `<div><b>Fields changed:</b> ${fields.map(f => esc(prettyField(f))).join(', ')}</div>
                  <div class="actNote">${privacyNote}</div>`;
        }
        const what = r.action === 'INSERT' ? 'A record was created.'
                   : r.action === 'DELETE' ? 'A record was deleted.'
                   : 'A record was changed.';
        return `<div>${what}</div><div class="actNote">${privacyNote}</div>`;
      }

      if (r.action === 'UPDATE') {
        let keys = Object.keys(nd).filter(k => JSON.stringify(od[k]) !== JSON.stringify(nd[k]));
        if (keys.length > 1) keys = keys.filter(k => k !== 'updated_at');
        if (!keys.length) return '<div class="actNote">Nothing visible changed on this record.</div>';
        return `<table><tr><th>Field</th><th>Before</th><th>After</th></tr>` +
          keys.map(k => `<tr><td>${esc(prettyField(k))}</td><td>${esc(jsonPreview(od[k]))}</td><td>${esc(jsonPreview(nd[k]))}</td></tr>`).join('') +
          `</table>`;
      }

      const src = r.action === 'DELETE' ? od : nd;
      const keys = Object.keys(src)
        .filter(k => src[k] !== null && src[k] !== undefined && src[k] !== '')
        .slice(0, 10);
      if (!keys.length) return '<div class="actNote">No details recorded.</div>';
      return `<table><tr><th>Field</th><th>Value</th></tr>` +
        keys.map(k => `<tr><td>${esc(prettyField(k))}</td><td>${esc(jsonPreview(src[k]))}</td></tr>`).join('') +
        `</table>`;
    }

    // Turns the "Any time / Today / Last 7 days / Last 30 days" picker into an
    // actual start date the database can filter on.
    function activityFromDate(){
      const v = document.getElementById('activityRange').value;
      if (v === 'all') return null;
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      if (v === '7') d.setDate(d.getDate() - 6);
      if (v === '30') d.setDate(d.getDate() - 29);
      return d.toISOString();
    }
    // Every activity row for these filters, page by page (the feed returns at
    // most what is asked for), up to `cap`. Returns { rows, capped }.
    async function fetchAllActivity(filters, cap){
      const PAGE = 500;
      const rows = [];
      const seenIds = new Set();
      let offset = 0;
      for (;;) {
        const { data, error } = await supabase.rpc('employee_activity', Object.assign({}, filters, { p_limit: PAGE, p_offset: offset }));
        if (error) throw error;
        const batch = data || [];
        // EXT5: pages are counted by position, so a change recorded while
        // exporting shifts everything by one and the next page repeats rows.
        // The audit log only grows, so skipping ids already seen is exact.
        for (const r of batch) if (!seenIds.has(r.id)) { seenIds.add(r.id); rows.push(r); }
        offset += batch.length;
        if (batch.length < PAGE) return { rows, capped: false };
        if (rows.length >= cap) return { rows: rows.slice(0, cap), capped: true };
      }
    }

    // The area dropdown, built from what's actually in the log and already
    // filtered to what this person is allowed to see.
    async function loadActivityAreas(){
      try {
        const { data, error } = await supabase.rpc('employee_activity_areas');
        if (error) throw error;
        const sel = document.getElementById('activityArea');
        const current = sel.value;
        sel.innerHTML = '<option value="">All areas</option>' + (data || []).map(a =>
          `<option value="${esc(a.table_name)}">${esc(ACTIVITY_AREA_LABELS[a.table_name] || a.area)} (${Number(a.entries)})</option>`
        ).join('');
        sel.value = current;
      } catch (err) { /* dropdown just stays as "All areas" */ }
    }

    // A one-line "what happened today" summary across everyone.
    async function loadActivityDigest(){
      try {
        const start = new Date(); start.setHours(0, 0, 0, 0);
        const { data, error } = await supabase.rpc('employee_activity', {
          p_from: start.toISOString(), p_limit: 500, p_offset: 0,
        });
        if (error) throw error;
        const rows = data || [];
        // The digest reads at most 500 changes; past that it says "500+"
        // instead of an exact-looking undercount.
        const atCap = rows.length >= 500;
        const el = document.getElementById('activityDigest');
        if (!rows.length) {
          el.style.display = 'block';
          el.innerHTML = '<b>Today:</b> no changes recorded yet.';
          return;
        }
        const people = new Set(rows.filter(r => r.person_account_number).map(r => r.person_account_number));
        const areaCount = {};
        rows.forEach(r => {
          const a = ACTIVITY_AREA_LABELS[r.table_name] || r.area;
          areaCount[a] = (areaCount[a] || 0) + 1;
        });
        const top = Object.keys(areaCount).sort((a, b) => areaCount[b] - areaCount[a]).slice(0, 3)
          .map(a => `${esc(a)} (${areaCount[a]})`).join(', ');
        const deletes = rows.filter(r => r.action === 'DELETE').length;
        el.style.display = 'block';
        el.innerHTML = `<b>Today:</b> ${rows.length}${atCap ? '+' : ''} change${rows.length === 1 ? '' : 's'}` +
          ` · ${people.size} ${people.size === 1 ? 'person' : 'people'} signed in` +
          (deletes ? ` · <span class="u-c-danger u-fw-600">${deletes} deletion${deletes === 1 ? '' : 's'}</span>` : '') +
          (top ? ` · busiest: ${top}` : '');
      } catch (err) { /* the digest is a nicety, never block the page on it */ }
    }

    function hlValue(v){
      if (v === null || v === undefined) return '<span class="jNull">empty</span>';
      if (typeof v === 'number') return `<span class="jNum">${esc(String(v))}</span>`;
      if (typeof v === 'boolean') return `<span class="jBool">${v}</span>`;
      if (typeof v === 'object') return `<span class="jStr">${esc(JSON.stringify(v))}</span>`;
      return `<span class="jStr">"${esc(String(v))}"</span>`;
    }
    function codeDiff(r){
      const nd = r.new_data || {};
      const od = r.old_data || {};
      if (!r.values_stored) {
        const fields = Array.isArray(nd.changed_fields) ? nd.changed_fields : [];
        const body = fields.length
          ? fields.map(f => `<div class="cLine"><span class="jKey">${esc(f)}</span> <span class="jNull">changed</span></div>`).join('')
          : `<div class="cLine"><span class="jNull">${esc(r.action_label)}</span></div>`;
        return `<div class="codeBlock">${body}</div>
                <div class="insNote">Values aren't recorded for this area, to keep personal data and formula details out of the log.</div>`;
      }
      if (r.action === 'UPDATE') {
        let keys = Object.keys(nd).filter(k => JSON.stringify(od[k]) !== JSON.stringify(nd[k]));
        if (keys.length > 1) keys = keys.filter(k => k !== 'updated_at');
        if (!keys.length) return '<div class="insNote">Nothing visible changed on this record.</div>';
        return `<div class="codeBlock">` + keys.map(k =>
          `<div class="cLine cRemove">− <span class="jKey">${esc(k)}</span>: ${hlValue(od[k])}</div>` +
          `<div class="cLine cAdd">+ <span class="jKey">${esc(k)}</span>: ${hlValue(nd[k])}</div>`
        ).join('') + `</div>`;
      }
      const src = r.action === 'DELETE' ? od : nd;
      const cls = r.action === 'DELETE' ? 'cRemove' : 'cAdd';
      const sign = r.action === 'DELETE' ? '−' : '+';
      const keys = Object.keys(src).filter(k => src[k] !== null && src[k] !== '');
      if (!keys.length) return '<div class="insNote">No details recorded.</div>';
      return `<div class="codeBlock">` + keys.map(k =>
        `<div class="cLine ${cls}">${sign} <span class="jKey">${esc(k)}</span>: ${hlValue(src[k])}</div>`
      ).join('') + `</div>`;
    }

    function resolveInspectTarget(el){
      if (!el || !el.closest) return null;
      for (const spec of RECORD_ID_ATTRS) {
        const host = el.closest('[' + spec.attr + ']');
        if (!host) continue;
        const id = host.getAttribute(spec.attr);
        if (!id) continue;
        let table = spec.table;
        if (!table) {
          table = host.getAttribute('data-rec-table');
          if (!table) {
            const panel = host.closest('section.panel');
            table = panel ? PANEL_RECORD_TABLE[panel.id] : null;
          }
        }
        if (!table) continue;
        const label = (host.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 48);
        return { table, id, el: host, label };
      }
      return null;
    }

    function plainChange(r){
      const nd = r.new_data || {}, od = r.old_data || {};
      if (!r.values_stored) {
        const f = Array.isArray(nd.changed_fields) ? nd.changed_fields : [];
        return f.length ? 'Fields changed: ' + f.join(', ') : r.action_label;
      }
      if (r.action !== 'UPDATE') return r.action_label;
      let keys = Object.keys(nd).filter(k => JSON.stringify(od[k]) !== JSON.stringify(nd[k]));
      if (keys.length > 1) keys = keys.filter(k => k !== 'updated_at');
      return keys.map(k => `${k}: ${jsonPreview(od[k])} → ${jsonPreview(nd[k])}`).join('; ');
    }

  return { recordTitle, describeChange, hlValue, codeDiff, plainChange, resolveInspectTarget, activityFromDate, fetchAllActivity, loadActivityAreas, loadActivityDigest };
});
