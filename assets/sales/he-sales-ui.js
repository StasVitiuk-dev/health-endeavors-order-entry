// Sales & Growth — page VIEW-MODELS (presentation contract) + a thin DOM adapter.
//
// Each builder returns a pure, deterministic view model: a page state
// (OK / EMPTY / LOADING / ERROR / DISABLED / BLOCKED_OWNER) and sections of rows,
// where every value carries a truth label so the UI can never present synthetic
// or estimated numbers as real:
//   ACTUAL     — a real measured value
//   ESTIMATED  — a projection/estimate
//   SIMULATED  — from synthetic fixtures (not real activity)
//   UNKNOWN    — not enough data (shown instead of a fake 0)
//   OWNER_INPUT_REQUIRED — blocked on an owner decision
//
// render(root, vm, h) builds DOM with the INJECTED h() builder only (no innerHTML,
// no HTML strings), so it inherits the dashboard's Trusted-Types safety. The view
// models are tested in Node; render() is tested with a fake h to prove it never
// uses a string sink.
//
// Pure data; dual-mode. The subsystem is feature-flagged OFF by default.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-ui'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const LABELS = ['ACTUAL', 'ESTIMATED', 'SIMULATED', 'UNKNOWN', 'OWNER_INPUT_REQUIRED'];
  const STATES = ['OK', 'EMPTY', 'LOADING', 'ERROR', 'DISABLED', 'BLOCKED_OWNER'];

  function val(value, label) { return { value, label: label || 'ACTUAL' }; }
  function section(heading, rows) { return { heading, rows: rows || [] }; }

  // Wrap a builder so a disabled flag or an error/loading signal short-circuits to
  // the right page state before any data work.
  function page(title, opts, build) {
    const o = opts || {};
    if (o.enabled === false) return { title, state: 'DISABLED', note: 'Sales & Growth is turned off (feature flag).', sections: [] };
    if (o.loading) return { title, state: 'LOADING', sections: [] };
    if (o.error) return { title, state: 'ERROR', note: String(o.error), sections: [] };
    return build();
  }

  // Growth Command Center — the owner summary. Everything carries a truth label.
  function commandCenter(data, opts) {
    const d = data || {};
    return page('Growth Command Center', opts, () => {
      const simulated = d.synthetic !== false; // fixtures by default
      const lab = simulated ? 'SIMULATED' : 'ACTUAL';
      const num = (v) => (v == null ? val('—', 'UNKNOWN') : val(v, lab));
      const sections = [
        section('What needs your attention', [
          { k: 'Drafts awaiting approval', ...num(d.draftsAwaiting) },
          { k: 'Replies to review', ...num(d.replies) },
          { k: 'Follow-ups due', ...num(d.followUpsDue) },
          { k: 'Sample candidates', ...num(d.sampleCandidates) },
        ]),
        section('Pipeline', [
          { k: 'New leads', ...num(d.newLeads) },
          { k: 'Qualified leads', ...num(d.qualifiedLeads) },
          { k: 'Interested', ...num(d.interested) },
          { k: 'Customers won', ...num(d.customersWon) },
          { k: 'Estimated pipeline value', ...(d.estPipeline == null ? val('—', 'UNKNOWN') : val(d.estPipeline, 'ESTIMATED')) },
        ]),
        section('Samples', [
          { k: 'Monthly budget', ...(d.sampleBudget == null ? val('—', 'OWNER_INPUT_REQUIRED') : val(d.sampleBudget, 'SIMULATED')) },
          { k: 'Approved this month', ...num(d.samplesApproved) },
        ]),
        section('AI usage', [
          { k: 'Estimated monthly AI cost', ...(d.aiMonthlyCost == null ? val('—', 'UNKNOWN') : val(d.aiMonthlyCost, 'ESTIMATED')) },
        ]),
      ];
      const empty = (d.newLeads || 0) + (d.qualifiedLeads || 0) + (d.draftsAwaiting || 0) === 0;
      return { title: 'Growth Command Center', state: empty ? 'EMPTY' : 'OK', simulated, sections };
    });
  }

  // Wholesale Leads list. `rows` are scored leads (from he-sales-leads.rank()).
  function leadsView(rows, opts) {
    return page('Wholesale Leads', opts, () => {
      const list = (rows || []).map(r => ({
        business: r.storeName, location: [r.city, r.state].filter(Boolean).join(', ') || '—',
        score: r.scoring ? r.scoring.score : null, band: r.scoring ? r.scoring.band : 'unknown',
        source: r.source || 'unknown', reachable: !!(r.email || r.website),
        label: r.synthetic ? 'SIMULATED' : 'ACTUAL',
      }));
      return { title: 'Wholesale Leads', state: list.length ? 'OK' : 'EMPTY', count: list.length, rows: list };
    });
  }

  // Pipeline board — columns are the pipeline stages with counts.
  function pipelineView(stageCounts, stages, opts) {
    return page('Pipeline', opts, () => {
      const cols = (stages || []).map(s => ({ stage: s, count: (stageCounts && stageCounts[s]) || 0, label: 'SIMULATED' }));
      const total = cols.reduce((a, c) => a + c.count, 0);
      return { title: 'Pipeline', state: total ? 'OK' : 'EMPTY', columns: cols, total };
    });
  }

  // Sales approvals inbox — APPROVE is never SEND.
  function approvalsView(drafts, opts) {
    return page('Sales Approvals', opts, () => {
      const list = (drafts || []).map(d => ({
        kind: d.kind, leadId: d.leadId, status: d.status,
        claimWarnings: (d.claimFindings || d.claimScan && d.claimScan.findings || []).length,
        provider: d.provider || d.createdWith || 'template',
        sendNote: 'APPROVE = READY FOR MANUAL/CONTROLLED SEND — NOT SENT',
      }));
      return { title: 'Sales Approvals', state: list.length ? 'OK' : 'EMPTY', rows: list, approveMeansSend: false };
    });
  }

  // Samples page grouped by status + budget + ROI.
  function samplesView(data, opts) {
    const d = data || {};
    return page('Samples', opts, () => {
      const budget = d.budget || {};
      const roi = d.roi || {};
      return {
        title: 'Samples', state: (d.rows && d.rows.length) ? 'OK' : 'EMPTY',
        budget: { budget: budget.budget == null ? null : budget.budget, approved: budget.approved || 0,
          remaining: budget.remaining, label: budget.budget == null ? 'OWNER_INPUT_REQUIRED' : 'SIMULATED' },
        roi: { converted: roi.converted || 0, conversionRate: roi.conversionRate,
          conversionLabel: roi.conversionRate == null ? 'UNKNOWN' : 'ESTIMATED',
          costBasis: roi.costBasis || 'UNKNOWN' },
        rows: d.rows || [],
        guard: 'No sample is auto-approved, auto-reserved, or auto-shipped; owner approval is mandatory.',
      };
    });
  }

  // Analytics — null rates render as UNKNOWN, never a fake 0%.
  function analyticsView(metrics, opts) {
    const m = metrics || {};
    return page('Sales Analytics', opts, () => {
      const rate = (k, v) => ({ k, value: v == null ? '—' : v, label: v == null ? 'UNKNOWN' : 'ESTIMATED' });
      return { title: 'Sales Analytics', state: 'OK', rows: [
        rate('Reply rate', m.replyRate), rate('Interest rate', m.interestRate),
        rate('Customer conversion', m.customerConversion), rate('Sample conversion', m.sampleConversion),
        rate('Cost per lead', m.costPerLead), rate('Cost per customer', m.costPerCustomer),
      ] };
    });
  }

  // Sales agent observability — never a fake "healthy".
  function agentActivityView(agents, opts) {
    return page('Sales Agent Activity', opts, () => {
      const rows = (agents || []).map(a => ({
        name: a.name, mode: a.mode || 'DRAFT_ONLY', enabled: !!a.enabled, paused: !!a.paused,
        lastRun: a.lastRun || 'never', lastSuccess: a.lastSuccess || 'never',
        lastError: a.lastError || null, draftsCreated: a.draftsCreated || 0,
        unknowns: a.unknowns || 0, provider: a.provider || 'template',
        estCost: a.estCost == null ? val('—', 'UNKNOWN') : val(a.estCost, 'ESTIMATED'),
        health: a.lastError ? 'ERROR' : (a.lastRun ? 'OK' : 'UNKNOWN'), // no fake healthy
      }));
      return { title: 'Sales Agent Activity', state: rows.length ? 'OK' : 'EMPTY', rows };
    });
  }

  // Thin DOM adapter: builds a page shell from ANY of the view models above using
  // the INJECTED h() builder only. Never uses innerHTML / HTML strings, so it
  // inherits Trusted Types. Returns the root node. It understands the shapes the
  // builders produce — sections (command center), rows (leads/approvals/analytics/
  // agents), columns (pipeline), and the samples budget/ROI — and renders only the
  // ones present, so one adapter covers every page.
  function render(viewModel, h) {
    if (typeof h !== 'function') throw new Error('he-sales-ui.render: inject the h() DOM builder');
    const vm = viewModel || {};
    // A labelled key/value row: the value carries its truth label as a data attr.
    const kv = (k, value, label) => h('div', { class: 'salesRow' },
      h('span', { class: 'k' }, String(k)),
      h('span', { class: 'v', 'data-label': label || 'ACTUAL' }, value == null ? '—' : String(value)));
    // A record row: every primitive field as a labelled cell (objects/nulls skipped).
    const recordRow = (row) => h('div', { class: 'salesRow salesRecord' },
      Object.keys(row).map(k => {
        const v = row[k];
        if (v == null || typeof v === 'object') return null;
        return h('span', { class: 'salesCell', 'data-field': k }, k + ': ' + String(v));
      }));
    const kids = [h('h2', { class: 'salesTitle' }, vm.title || 'Sales')];
    if (vm.state && vm.state !== 'OK') kids.push(h('p', { class: 'salesState', 'data-state': vm.state }, vm.note || vm.state));
    // command-center sections
    for (const s of (vm.sections || [])) {
      kids.push(h('h3', null, s.heading));
      for (const row of s.rows) kids.push(kv(row.k, row.value, row.label));
    }
    // pipeline columns
    if (vm.columns) { kids.push(h('h3', null, 'Stages')); for (const c of vm.columns) kids.push(kv(c.stage, c.count, c.label)); }
    // samples budget + ROI + guard
    if (vm.budget) {
      kids.push(h('h3', null, 'Monthly sample budget'));
      kids.push(kv('Budget', vm.budget.budget, vm.budget.label));
      kids.push(kv('Approved this month', vm.budget.approved, 'SIMULATED'));
    }
    if (vm.roi) {
      kids.push(h('h3', null, 'Sample ROI'));
      kids.push(kv('Converted', vm.roi.converted, 'SIMULATED'));
      kids.push(kv('Conversion rate', vm.roi.conversionRate, vm.roi.conversionLabel));
      kids.push(kv('Cost basis', vm.roi.costBasis, vm.roi.costBasis === 'UNKNOWN' ? 'UNKNOWN' : 'ESTIMATED'));
    }
    if (vm.guard) kids.push(h('p', { class: 'salesGuard' }, vm.guard));
    // generic rows (leads / approvals / analytics / agents). Command center uses
    // sections instead, so it never double-renders here. Rows shaped {k,value}
    // (analytics) render as labelled key/value; everything else as a record row.
    if (!vm.sections && vm.rows && vm.rows.length) {
      for (const row of vm.rows) {
        if (row && Object.prototype.hasOwnProperty.call(row, 'k') && Object.prototype.hasOwnProperty.call(row, 'value'))
          kids.push(kv(row.k, row.value, row.label));
        else kids.push(recordRow(row));
      }
    }
    return h('section', { class: 'salesPage', 'data-state': vm.state || 'OK' }, kids);
  }

  return { LABELS, STATES, val, section, page, commandCenter, leadsView, pipelineView,
    approvalsView, samplesView, analyticsView, agentActivityView, render };
}));
