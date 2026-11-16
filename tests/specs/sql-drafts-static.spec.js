// EXT6 (workstream 11 / 24): a static safety check over every database DRAFT
// the owner may one day install (docs/ops/sql/drafts, install and rollback
// files; the local test files are excluded). A tripwire, not a proof: it
// catches the classic mistakes in functions and permissions before review.
// Node-only, no browser, no database.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const DIR = path.resolve(__dirname, '..', '..', 'docs', 'ops', 'sql', 'drafts');
const INSTALLS = ['10_DRAFT_stock_functions.sql', '13_DRAFT_report_totals.sql', '17_DRAFT_po_line_delete_guard.sql', '19_DRAFT_request_keys.sql', '21_DRAFT_stock_function_switches.sql', '23_DRAFT_integrity_constraints.sql', '25_DRAFT_integrity_check_schedule.sql', '27_DRAFT_request_keys_switch.sql', '29_DRAFT_integrity_results_on_home.sql', '32_DRAFT_invoices.sql', '34_DRAFT_stock_count_adjustments.sql', '36_DRAFT_supplier_documents.sql'];
const ROLLBACKS = { '10_DRAFT_stock_functions.sql': '11_DRAFT_rollback_stock_functions.sql',
  '17_DRAFT_po_line_delete_guard.sql': '18_DRAFT_rollback_po_line_delete_guard.sql',
  '19_DRAFT_request_keys.sql': '20_DRAFT_rollback_request_keys.sql',
  '21_DRAFT_stock_function_switches.sql': '22_DRAFT_rollback_stock_function_switches.sql',
  '23_DRAFT_integrity_constraints.sql': '24_DRAFT_rollback_integrity_constraints.sql',
  '25_DRAFT_integrity_check_schedule.sql': '26_DRAFT_rollback_integrity_check_schedule.sql',
  '27_DRAFT_request_keys_switch.sql': '28_DRAFT_rollback_request_keys_switch.sql',
  '29_DRAFT_integrity_results_on_home.sql': '30_DRAFT_rollback_integrity_results_on_home.sql',
  '13_DRAFT_report_totals.sql': '31_DRAFT_rollback_report_totals.sql', // EXT14: 13 now has its rollback
  '32_DRAFT_invoices.sql': '33_DRAFT_rollback_invoices.sql',           // Nov 15: invoice storage + numbering
  '34_DRAFT_stock_count_adjustments.sql': '35_DRAFT_rollback_stock_count_adjustments.sql',   // Nov 16: owner-only stock-count approval
  '36_DRAFT_supplier_documents.sql': '37_DRAFT_rollback_supplier_documents.sql' };   // Nov 16, later: supplier document storage, owner-only review
const ALL = fs.readdirSync(DIR).filter(f => /^\d\d_DRAFT_.*\.sql$/.test(f) && !/_tests?_/.test(f));

// Remove comments and quoted text so words inside them are not mistaken for SQL.
function code(sql) {
  return sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}
function outsideFunctions(sql) { // top-level statements only (function bodies removed)
  return sql.replace(/\$(\w*)\$[\s\S]*?\$\1\$/g, '$$ body $$');
}
function functions(sql) { // each "create ... function ... as $tag$ ... $tag$" block
  const out = [];
  const re = /create\s+(or\s+replace\s+)?function\s+([\w.]+)\s*\(([\s\S]*?)\$(\w*)\$([\s\S]*?)\$\4\$/gi;
  let m;
  while ((m = re.exec(sql))) out.push({ name: m[2], header: m[3], body: m[5] });
  return out;
}

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

test('the list of drafts is the one this check knows (a new draft must be added here on purpose)', () => {
  expect(ALL.sort()).toEqual([...INSTALLS, ...Object.values(ROLLBACKS)].sort());
});

test('EXT14: drafts/ holds only install and rollback files; local tests live in local-test/', () => {
  expect(fs.readdirSync(DIR).filter(f => /_tests?_/.test(f))).toEqual([]);
  for (const i of INSTALLS) expect(ROLLBACKS[i], i + ' has a rollback').toBeTruthy();
});

for (const f of ALL) {
  test(`${f}: one transaction, nothing given to anonymous visitors, row-level security untouched`, () => {
    const sql = outsideFunctions(code(fs.readFileSync(path.join(DIR, f), 'utf8'))).toLowerCase();
    expect(sql, 'starts a transaction').toMatch(/^\s*begin\s*;/);
    expect(sql.trim(), 'ends with commit').toMatch(/commit\s*;$/);
    expect(sql, 'no grant to anon / public').not.toMatch(/grant\s[^;]*\bto\s+[^;]*\b(anon|public)\b/);
    expect(sql, 'row-level security never switched off').not.toMatch(/disable\s+row\s+level\s+security|no\s+force\s+row\s+level/);
    // The one allowed pair of policies (EXT10, drafts/29 + 30): owner/admin may
    // READ the nightly check's own two tables; nothing else, no other command.
    const READ_RULES = [
      'drop policy if exists integrity_runs_owner_admin_read on public.integrity_check_runs;',
      'create policy integrity_runs_owner_admin_read on public.integrity_check_runs for select to authenticated using (public.is_owner_or_admin());',
      'drop policy if exists integrity_results_owner_admin_read on public.integrity_check_results;',
      'create policy integrity_results_owner_admin_read on public.integrity_check_results for select to authenticated using (public.is_owner_or_admin());'];
    // The second allowed set (Nov 15, drafts/32): row rules on that draft's OWN two
    // new tables, implementing the owner's Nov 14 decision on who may do what —
    // active staff read and prepare drafts; only the owner or an administrator
    // can do anything else. The exact text is pinned: any other policy, or any
    // change to these, fails this check and has to be allowed here on purpose.
    const INVOICE_RULES = [
      'drop policy if exists invoices_staff_read on public.invoices;',
      'create policy invoices_staff_read on public.invoices for select to authenticated using (public.is_active_staff());',
      'drop policy if exists invoices_staff_draft_insert on public.invoices;',
      "create policy invoices_staff_draft_insert on public.invoices for insert to authenticated with check (public.is_active_staff() and status = 'draft');",
      'drop policy if exists invoices_staff_draft_update on public.invoices;',
      "create policy invoices_staff_draft_update on public.invoices for update to authenticated using (public.is_active_staff() and status = 'draft') with check (public.is_active_staff() and status = 'draft');",
      'drop policy if exists invoices_staff_draft_delete on public.invoices;',
      "create policy invoices_staff_draft_delete on public.invoices for delete to authenticated using (public.is_active_staff() and status = 'draft');",
      'drop policy if exists invoices_owner_admin_all on public.invoices;',
      'create policy invoices_owner_admin_all on public.invoices for all to authenticated using (public.is_owner_or_admin()) with check (public.is_owner_or_admin());',
      'drop policy if exists invoice_counters_owner_admin on public.invoice_counters;',
      'create policy invoice_counters_owner_admin on public.invoice_counters for all to authenticated using (public.is_owner_or_admin()) with check (public.is_owner_or_admin());'];
    // The fourth allowed set (Nov 16, drafts/36): row rules on that draft's OWN six
    // new tables. Active staff read everything and may record a document (status
    // 'received') and add a subject; only the owner writes the checklist or
    // updates a subject; who may approve, correct or withdraw a document is the
    // guard trigger's job (owner only), on top of these rules.
    const SUPPLIER_DOC_RULES = [
      'drop policy if exists supplier_document_types_staff_read on public.supplier_document_types;',
      'create policy supplier_document_types_staff_read on public.supplier_document_types for select to authenticated using (public.is_active_staff());',
      'drop policy if exists supplier_document_types_owner_write on public.supplier_document_types;',
      "create policy supplier_document_types_owner_write on public.supplier_document_types for all to authenticated using (public.current_role() = 'owner') with check (public.current_role() = 'owner');",
      'drop policy if exists supplier_type_document_profiles_staff_read on public.supplier_type_document_profiles;',
      'create policy supplier_type_document_profiles_staff_read on public.supplier_type_document_profiles for select to authenticated using (public.is_active_staff());',
      'drop policy if exists supplier_type_document_profiles_owner_write on public.supplier_type_document_profiles;',
      "create policy supplier_type_document_profiles_owner_write on public.supplier_type_document_profiles for all to authenticated using (public.current_role() = 'owner') with check (public.current_role() = 'owner');",
      'drop policy if exists supplier_document_supplier_profiles_staff_read on public.supplier_document_supplier_profiles;',
      'create policy supplier_document_supplier_profiles_staff_read on public.supplier_document_supplier_profiles for select to authenticated using (public.is_active_staff());',
      'drop policy if exists supplier_document_supplier_profiles_owner_write on public.supplier_document_supplier_profiles;',
      "create policy supplier_document_supplier_profiles_owner_write on public.supplier_document_supplier_profiles for all to authenticated using (public.current_role() = 'owner') with check (public.current_role() = 'owner');",
      'drop policy if exists supplier_document_subjects_staff_read on public.supplier_document_subjects;',
      'create policy supplier_document_subjects_staff_read on public.supplier_document_subjects for select to authenticated using (public.is_active_staff());',
      'drop policy if exists supplier_document_subjects_staff_add on public.supplier_document_subjects;',
      'create policy supplier_document_subjects_staff_add on public.supplier_document_subjects for insert to authenticated with check (public.is_active_staff() and is_active);',
      'drop policy if exists supplier_document_subjects_owner_update on public.supplier_document_subjects;',
      "create policy supplier_document_subjects_owner_update on public.supplier_document_subjects for update to authenticated using (public.current_role() = 'owner') with check (public.current_role() = 'owner');",
      'drop policy if exists supplier_documents_staff_read on public.supplier_documents;',
      'create policy supplier_documents_staff_read on public.supplier_documents for select to authenticated using (public.is_active_staff());',
      'drop policy if exists supplier_documents_staff_record on public.supplier_documents;',
      "create policy supplier_documents_staff_record on public.supplier_documents for insert to authenticated with check (public.is_active_staff() and status = 'received');",
      'drop policy if exists supplier_documents_staff_update on public.supplier_documents;',
      'create policy supplier_documents_staff_update on public.supplier_documents for update to authenticated using (public.is_active_staff()) with check (public.is_active_staff());',
      'drop policy if exists supplier_document_events_staff_read on public.supplier_document_events;',
      'create policy supplier_document_events_staff_read on public.supplier_document_events for select to authenticated using (public.is_active_staff());',
      'drop policy if exists supplier_document_events_trigger_insert on public.supplier_document_events;',
      'create policy supplier_document_events_trigger_insert on public.supplier_document_events for insert to authenticated with check (public.is_active_staff());'];
    if (f === '32_DRAFT_invoices.sql') for (const r of INVOICE_RULES) expect(sql.split(r).length - 1, 'pinned rule present exactly once: ' + r.slice(0, 60)).toBe(1);
    // The third allowed set (Nov 16, drafts/34): row rules on that draft's OWN two
    // new tables, implementing the owner's Nov 16 decision — active staff read
    // and propose; who may DECIDE is the guard trigger's job (owner only, or an
    // administrator the owner granted); only the owner can add or remove a
    // grant. The exact text is pinned, as above.
    const STOCK_COUNT_RULES = [
      'drop policy if exists stock_count_adjustments_staff_read on public.stock_count_adjustments;',
      'create policy stock_count_adjustments_staff_read on public.stock_count_adjustments for select to authenticated using (public.is_active_staff());',
      'drop policy if exists stock_count_adjustments_staff_propose on public.stock_count_adjustments;',
      "create policy stock_count_adjustments_staff_propose on public.stock_count_adjustments for insert to authenticated with check (public.is_active_staff() and status = 'proposed');",
      'drop policy if exists stock_count_adjustments_staff_update on public.stock_count_adjustments;',
      'create policy stock_count_adjustments_staff_update on public.stock_count_adjustments for update to authenticated using (public.is_active_staff()) with check (public.is_active_staff());',
      'drop policy if exists stock_count_approvers_read on public.stock_count_approvers;',
      'create policy stock_count_approvers_read on public.stock_count_approvers for select to authenticated using (user_id = auth.uid() or public.is_owner_or_admin());',
      'drop policy if exists stock_count_approvers_owner_insert on public.stock_count_approvers;',
      "create policy stock_count_approvers_owner_insert on public.stock_count_approvers for insert to authenticated with check (public.current_role() = 'owner');",
      'drop policy if exists stock_count_approvers_owner_delete on public.stock_count_approvers;',
      "create policy stock_count_approvers_owner_delete on public.stock_count_approvers for delete to authenticated using (public.current_role() = 'owner');"];
    if (f === '34_DRAFT_stock_count_adjustments.sql') {
      for (const r of STOCK_COUNT_RULES) expect(sql.split(r).length - 1, 'pinned rule present exactly once: ' + r.slice(0, 60)).toBe(1);
      // No delete is granted on the adjustments table at all, and the guard refuses one anyway.
      expect(sql).toContain('grant select, insert, update on public.stock_count_adjustments to authenticated;');
    }
    const policyOk = /^(29|30)_/.test(f) ? READ_RULES.reduce((t, r) => t.split(r).join(''), sql)
      : f === '32_DRAFT_invoices.sql' ? INVOICE_RULES.reduce((t, r) => t.split(r).join(''), sql)
        : f === '34_DRAFT_stock_count_adjustments.sql' ? STOCK_COUNT_RULES.reduce((t, r) => t.split(r).join(''), sql)
          : f === '36_DRAFT_supplier_documents.sql' ? SUPPLIER_DOC_RULES.reduce((t, r) => t.split(r).join(''), sql) : sql;
    if (f === '36_DRAFT_supplier_documents.sql') {
      for (const r of SUPPLIER_DOC_RULES) expect(sql.split(r).length - 1, 'pinned rule present exactly once: ' + r.slice(0, 60)).toBe(1);
      // No delete is granted on the documents or the history at all; the guards refuse one anyway.
      expect(sql).toContain('grant select, insert, update on public.supplier_documents to authenticated;');
      expect(sql).toContain('grant select, insert on public.supplier_document_events to authenticated;');
    }
    expect(policyOk, 'policies never created, changed or dropped').not.toMatch(/\b(create|alter|drop)\s+policy\b/);
    // The one allowed drop (EXT9): the schedule rollback removes its own results table.
    const dropOk = f === '26_DRAFT_rollback_integrity_check_schedule.sql' ? sql.replace('drop table if exists public.integrity_check_results;', '')
      : f === '30_DRAFT_rollback_integrity_results_on_home.sql' ? sql.replace('drop table if exists public.integrity_check_runs;', '')
        // Nov 15: the invoice rollback removes its own two tables (and refuses to run at all once an invoice has been issued).
        : f === '33_DRAFT_rollback_invoices.sql' ? sql.replace('drop table if exists public.invoices;', '').replace('drop table if exists public.invoice_counters;', '')
          // Nov 16: the stock-count rollback removes its own two tables (and refuses to run once any adjustment has been approved or rejected).
          : f === '35_DRAFT_rollback_stock_count_adjustments.sql' ? sql.replace('drop table if exists public.stock_count_adjustments;', '').replace('drop table if exists public.stock_count_approvers;', '')
            // Nov 16, later: the supplier document rollback removes its own six tables (and refuses once any document has been reviewed).
            : f === '37_DRAFT_rollback_supplier_documents.sql' ? ['supplier_document_events', 'supplier_documents', 'supplier_document_subjects', 'supplier_document_supplier_profiles', 'supplier_type_document_profiles', 'supplier_document_types']
              .reduce((t, n) => t.replace('drop table if exists public.' + n + ';', ''), sql) : sql;
    expect(dropOk, 'no table or schema is dropped').not.toMatch(/\bdrop\s+(table|schema)\b/);
    // The one allowed delete (EXT9): the switches rollback removes exactly the
    // five stock_fn_* rows its install added, nothing else.
    const allowed = f === '22_DRAFT_rollback_stock_function_switches.sql'
      ? sql.replace(/delete from public\.feature_flags\s+where flag_key in \('stock_fn_receive_po', 'stock_fn_recall', 'stock_fn_return', 'stock_fn_adjust', 'stock_fn_delete_product'\);/, '')
      : f === '28_DRAFT_rollback_request_keys_switch.sql'
        ? sql.replace("delete from public.feature_flags where flag_key = 'request_keys';", '')
        : f === '30_DRAFT_rollback_integrity_results_on_home.sql'
          ? sql.replace("delete from public.feature_flags where flag_key = 'integrity_results_home';", '')
          : sql;
    expect(allowed, 'no data deleted or truncated').not.toMatch(/\btruncate\b|^\s*delete\s+from\b/m);
  });

  test(`${f}: every function pins its search path; elevated (definer) functions are not used`, () => {
    const sql = code(fs.readFileSync(path.join(DIR, f), 'utf8'));
    for (const fn of functions(sql)) {
      expect(fn.header.toLowerCase(), `${fn.name} sets search_path`).toMatch(/set\s+search_path\s*=\s*public\s*,\s*pg_temp/);
      expect(fn.header.toLowerCase(), `${fn.name} runs with the caller's rights`).not.toMatch(/security\s+definer/);
    }
  });

  test(`${f}: dynamic SQL only through format() with safe placeholders`, () => {
    const sql = code(fs.readFileSync(path.join(DIR, f), 'utf8'));
    const executes = (sql.match(/\bexecute\s+(?!function\b|procedure\b|on\b)[^;]*/gi) || []);
    for (const e of executes) {
      expect(e, 'built with format()').toMatch(/^execute\s+format\s*\(/i);
      const template = (e.match(/format\s*\(\s*'((?:[^']|'')*)'/i) || [])[1] || '';
      expect(template, 'names quoted with %I, values with %L or $n (never %s)').not.toMatch(/%s/);
    }
  });
}

for (const [install, rollback] of Object.entries(ROLLBACKS)) {
  test(`${install} names its rollback file, and the rollback exists`, () => {
    expect(fs.readFileSync(path.join(DIR, install), 'utf8')).toContain(rollback);
    expect(fs.existsSync(path.join(DIR, rollback))).toBe(true);
  });
}

test('every function a draft creates is revoked from everyone and granted only to signed-in staff (or not at all)', () => {
  for (const f of INSTALLS) {
    const sql = code(fs.readFileSync(path.join(DIR, f), 'utf8')).toLowerCase();
    for (const fn of functions(sql)) {
      const name = fn.name.replace(/^public\./, '');
      expect(sql, `${f}: ${name} revoked from public`).toMatch(new RegExp(`revoke\\s+all\\s+on\\s+function\\s+public\\.${name}\\b[^;]*from\\s+public`));
      const grants = sql.match(new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${name}\\b[^;]*;`, 'g')) || [];
      for (const g of grants) expect(g, `${f}: ${name} granted to authenticated only`).toMatch(/to\s+authenticated\s*;$/);
    }
  }
});

test('the nightly integrity view is exactly Query F (the two never drift apart)', () => {
  const norm = t => t.split('\n').filter(l => !/^\s*--/.test(l)).join('\n').replace(/\s+/g, ' ').trim();
  const f = fs.readFileSync(path.join(DIR, '..', '05_READONLY_F_daily_integrity_check.sql'), 'utf8');
  const d = fs.readFileSync(path.join(DIR, '25_DRAFT_integrity_check_schedule.sql'), 'utf8');
  const fBody = norm(f).replace(/ order by 1, 2;$/, '');
  const view = d.slice(d.indexOf('create view public.integrity_check_f as') + 'create view public.integrity_check_f as'.length, d.indexOf(';\n\ncreate table public.integrity_check_results'));
  expect(norm(view)).toBe(fBody);
});

// EXT10b (missions 89, 391-393): every production-change file says so at the top.
test('every install and rollback draft carries a DRAFT / owner-approval warning in its first lines', () => {
  for (const f of [...INSTALLS, ...Object.values(ROLLBACKS)]) {
    const head = fs.readFileSync(path.join(DIR, f), 'utf8').split('\n').slice(0, 8).join('\n');
    expect(head, f).toMatch(/DRAFT|PRODUCTION CHANGE/);
    expect(head, f).toMatch(/approval|DO NOT RUN|NOT RUN|NOT INSTALLED|NOT FOR PRODUCTION/i);
  }
});
