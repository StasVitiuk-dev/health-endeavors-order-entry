// assets/app/he-reports.js — Report history: daily / weekly / monthly views (missing values stay '?', never zero)
// EXT15: moved unchanged out of assets/owner-login-app.js (initApp). Its inputs
// arrive explicitly in ctx; it returns only what other code still uses. Map:
// docs/ops/APPLICATION_MODULE_MAP_EXT15.md. Created once, by the app, in order.
window.HE.modules.define('he-reports', { api: 1, needs: ['fmtDateOnly','fmtMoney','h','localDateString','missingToNaN','monthGroupLabel','reportCount','rollupReports','showDashError','startOfWeekMonday','supabase','weekGroupLabel'] }, function (ctx) {
    const { fmtDateOnly, fmtMoney, h, localDateString, missingToNaN, monthGroupLabel, reportCount, rollupReports, showDashError, startOfWeekMonday, supabase, weekGroupLabel } = ctx;
    // Report History: browse the nightly automatic snapshots saved into
    // daily_reports by the scheduled database job (separate from the live
    // Daily Summary above, which is always computed fresh on page load).
    // Holds the raw daily rows once fetched, so switching between Daily/Weekly/
    // Monthly just re-groups data already in memory — no extra database calls.
    let REPORT_HISTORY_DATA = [];
    let reportHistoryView = 'daily';
    // EXT15: the only way to change the view from outside the reports module.
    function setReportHistoryView(view){ reportHistoryView = view; }

    function renderReportHistoryView(){
      const wrap = document.getElementById('reportHistoryWrap');
      if (!REPORT_HISTORY_DATA.length) {
        wrap.replaceChildren(Object.assign(document.createElement('p'), { className: 'empty', textContent: 'No saved reports yet — the first one will appear after tonight\'s automatic run.' }));
        return;
      }

      let rows, firstColLabel;
      if (reportHistoryView === 'daily') {
        firstColLabel = 'Date';
        rows = REPORT_HISTORY_DATA.map(r => ({
          label: fmtDateOnly(r.report_date), currency: r.currency || 'USD',
          orders_count: r.orders_count, revenue: missingToNaN(r.revenue),
          new_inquiries_count: r.new_inquiries_count, tasks_opened_count: r.tasks_opened_count,
          incidents_opened_count: r.incidents_opened_count, ai_calls_count: r.ai_calls_count,
          ai_cost: missingToNaN(r.ai_cost), emailed: r.emailed_at ? '✓' : '—',
        }));
      } else if (reportHistoryView === 'weekly') {
        firstColLabel = 'Week';
        rows = rollupReports(REPORT_HISTORY_DATA, d => localDateString(startOfWeekMonday(d)), d => weekGroupLabel(startOfWeekMonday(d)))
          .map(g => ({ ...g, emailed: '—' }));
      } else {
        firstColLabel = 'Month';
        rows = rollupReports(REPORT_HISTORY_DATA, d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, monthGroupLabel)
          .map(g => ({ ...g, emailed: '—' }));
      }

      // EXT20J: built as DOM nodes (h() text-ifies) instead of an HTML string, so
      // the Report History is safe under Trusted Types. Missing values stay '?'
      // (reportCount), never zero; values were already esc()-ed, now text nodes.
      wrap.replaceChildren(h('table', { class: 'phoneCards' },
        h('thead', null, h('tr', null,
          h('th', null, firstColLabel), h('th', null, 'Orders'), h('th', null, 'Revenue'), h('th', null, 'New questions'),
          h('th', null, 'Tasks opened'), h('th', null, 'Incidents opened'), h('th', null, 'AI calls'), h('th', null, 'AI cost'), h('th', null, 'Emailed'))),
        h('tbody', null, rows.map(r =>
          h('tr', null,
            h('td', null, r.label),
            h('td', null, reportCount(r.orders_count)),
            h('td', null, fmtMoney(r.revenue, r.currency || 'USD')),
            h('td', null, reportCount(r.new_inquiries_count)),
            h('td', null, reportCount(r.tasks_opened_count)),
            h('td', null, reportCount(r.incidents_opened_count)),
            h('td', null, reportCount(r.ai_calls_count)),
            h('td', null, fmtMoney(r.ai_cost, 'USD')),
            h('td', null, r.emailed))))));
    }

    async function loadReportHistory(){
      try {
        const { data: reports, error } = await supabase
          .from('daily_reports')
          .select('*')
          .order('report_date', { ascending: false })
          .limit(366);
        if (error) throw error;

        REPORT_HISTORY_DATA = reports || [];
        renderReportHistoryView();
      } catch (err) {
        showDashError('Could not load Report History: ' + (err && err.message ? err.message : err));
      }
    }

  return { setReportHistoryView, renderReportHistoryView, loadReportHistory };
});
