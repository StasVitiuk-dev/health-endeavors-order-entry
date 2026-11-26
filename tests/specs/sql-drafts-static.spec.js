// EXT6 (workstream 11 / 24): a static safety check over every database DRAFT
// the owner may one day install (docs/ops/sql/drafts, install and rollback
// files; the local test files are excluded). A tripwire, not a proof: it
// catches the classic mistakes in functions and permissions before review.
// Node-only, no browser, no database.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const DIR = path.resolve(__dirname, '..', '..', 'docs', 'ops', 'sql', 'drafts');
const INSTALLS = ['10_DRAFT_stock_functions.sql', '13_DRAFT_report_totals.sql', '17_DRAFT_po_line_delete_guard.sql', '19_DRAFT_request_keys.sql', '21_DRAFT_stock_function_switches.sql', '23_DRAFT_integrity_constraints.sql', '25_DRAFT_integrity_check_schedule.sql', '27_DRAFT_request_keys_switch.sql', '29_DRAFT_integrity_results_on_home.sql', '32_DRAFT_invoices.sql', '34_DRAFT_stock_count_adjustments.sql', '36_DRAFT_supplier_documents.sql', '38_DRAFT_supplier_document_files.sql', '40_DRAFT_partial_receiving_returns.sql', '42_DRAFT_shopify_payouts_money_issues.sql', '44_DRAFT_staff_read_purchase_orders.sql', '46_DRAFT_tax_rates.sql', '48_DRAFT_order_parcels.sql', '50_DRAFT_shared_settings.sql', '52_DRAFT_order_costs.sql', '54_DRAFT_order_batches.sql', '56_DRAFT_email_sending.sql', '58_DRAFT_my_settings.sql', '60_DRAFT_customer_reviews.sql', '62_DRAFT_manager_role.sql', '64_DRAFT_people_levels.sql', '66_DRAFT_managers_approve_stock.sql', '68_DRAFT_history_functions_search_path.sql', '70_DRAFT_backup_reports.sql'];
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
  '36_DRAFT_supplier_documents.sql': '37_DRAFT_rollback_supplier_documents.sql',
  '38_DRAFT_supplier_document_files.sql': '39_DRAFT_rollback_supplier_document_files.sql',
  '40_DRAFT_partial_receiving_returns.sql': '41_DRAFT_rollback_partial_receiving_returns.sql',
  '42_DRAFT_shopify_payouts_money_issues.sql': '43_DRAFT_rollback_shopify_payouts_money_issues.sql',
  '44_DRAFT_staff_read_purchase_orders.sql': '45_DRAFT_rollback_staff_read_purchase_orders.sql',
  '46_DRAFT_tax_rates.sql': '47_DRAFT_rollback_tax_rates.sql',   // Nov 23: the owner's confirmed sales tax rates
  '48_DRAFT_order_parcels.sql': '49_DRAFT_rollback_order_parcels.sql',   // Nov 24: parcels and drop-off receipts
  '50_DRAFT_shared_settings.sql': '51_DRAFT_rollback_shared_settings.sql',   // Nov 24: settings shared by every device
  '52_DRAFT_order_costs.sql': '53_DRAFT_rollback_order_costs.sql',
  '54_DRAFT_order_batches.sql': '55_DRAFT_rollback_order_batches.sql',
  '56_DRAFT_email_sending.sql': '57_DRAFT_rollback_email_sending.sql',
  '58_DRAFT_my_settings.sql': '59_DRAFT_rollback_my_settings.sql',
  '60_DRAFT_customer_reviews.sql': '61_DRAFT_rollback_customer_reviews.sql',
  '62_DRAFT_manager_role.sql': '63_DRAFT_rollback_manager_role.sql',       // Nov 25: the Manager role word
  '64_DRAFT_people_levels.sql': '65_DRAFT_rollback_people_levels.sql',
  '66_DRAFT_managers_approve_stock.sql': '67_DRAFT_rollback_managers_approve_stock.sql',
  '68_DRAFT_history_functions_search_path.sql': '69_DRAFT_rollback_history_functions_search_path.sql',
  '70_DRAFT_backup_reports.sql': '71_DRAFT_rollback_backup_reports.sql' };   // Nov 26: backup reports for Home (design D5)   // Nov 25: four levels of account   // Nov 24: reviews the owner typed in   // Nov 24: one person's settings on every device   // Nov 24: email sending records (nothing in it sends)   // Nov 24: which batch went into which order     // Nov 24: the real fee and postage of each order   // Nov 24: settings shared by every device   // Nov 24: parcels and drop-off receipts   // Nov 22: owner decision, staff read purchase orders   // Nov 22: Shopify payout copy and money differences   // Nov 22: partial receiving and returns (D-ops-5), owner approves stock changes   // Nov 21: private files, owner-only reading   // Nov 16, later: supplier document storage, owner-only review
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

// Nov 25: the project's one deliberate exception to "every function runs with the caller's rights".
// drafts/66 (option A, owner decision on managers) lets exactly four decision actions run with raised
// rights. No other draft, and no other line of drafts/66, may mention raised rights.
test('raised rights appear only in drafts/66, only for the four decision actions', () => {
  const DEFINER_66 = [
    'alter function public.approve_receiving_record(uuid, text) security definer;',
    'alter function public.reject_receiving_record(uuid, text) security definer;',
    'alter function public.decide_supplier_return(uuid, text, text) security definer;',
    'alter function public.decide_customer_return(uuid, integer, integer, integer, boolean, boolean, text) security definer;'];
  for (const f of ALL) {
    let sql = code(fs.readFileSync(path.join(DIR, f), 'utf8')).toLowerCase();
    if (f === '66_DRAFT_managers_approve_stock.sql') {
      for (const d of DEFINER_66) { expect(sql.split(d).length - 1, 'pinned line present exactly once: ' + d).toBe(1); sql = sql.split(d).join(''); }
    }
    expect(sql, f + ' uses raised rights').not.toMatch(/security\s+definer/);
  }
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
      'create policy invoices_staff_read on public.invoices for select to authenticated using (public.is_active_staff() and (created_by = auth.uid() or (order_id is not null and exists (select 1 from public.orders o where o.id = invoices.order_id))));',
      'drop policy if exists invoices_staff_draft_insert on public.invoices;',
      "create policy invoices_staff_draft_insert on public.invoices for insert to authenticated with check (public.is_active_staff() and status = 'draft' and (order_id is null or exists (select 1 from public.orders o where o.id = invoices.order_id)));",
      'drop policy if exists invoices_staff_draft_update on public.invoices;',
      "create policy invoices_staff_draft_update on public.invoices for update to authenticated using (public.is_active_staff() and status = 'draft' and (created_by = auth.uid() or (order_id is not null and exists (select 1 from public.orders o where o.id = invoices.order_id)))) with check (public.is_active_staff() and status = 'draft');",
      'drop policy if exists invoices_staff_draft_delete on public.invoices;',
      "create policy invoices_staff_draft_delete on public.invoices for delete to authenticated using (public.is_active_staff() and status = 'draft' and (created_by = auth.uid() or (order_id is not null and exists (select 1 from public.orders o where o.id = invoices.order_id))));",
      'drop policy if exists invoices_owner_admin_all on public.invoices;',
      'create policy invoices_owner_admin_all on public.invoices for all to authenticated using (public.is_owner_or_admin()) with check (public.is_owner_or_admin());',
      'drop policy if exists invoice_counters_owner_admin on public.invoice_counters;',
      'create policy invoice_counters_owner_admin on public.invoice_counters for all to authenticated using (public.is_owner_or_admin()) with check (public.is_owner_or_admin());',
      'drop policy if exists invoice_payments_owner_admin_read on public.invoice_payments;',
      'create policy invoice_payments_owner_admin_read on public.invoice_payments for select to authenticated using (public.is_owner_or_admin());',
      'drop policy if exists invoice_payments_owner_admin_add on public.invoice_payments;',
      'create policy invoice_payments_owner_admin_add on public.invoice_payments for insert to authenticated with check (public.is_owner_or_admin());',
      'drop policy if exists invoice_events_read on public.invoice_events;',
      'create policy invoice_events_read on public.invoice_events for select to authenticated using (public.is_owner_or_admin() or (public.is_active_staff() and exists (select 1 from public.invoices i where i.id = invoice_events.invoice_id)));',
      'drop policy if exists invoice_events_trigger_insert on public.invoice_events;',
      'create policy invoice_events_trigger_insert on public.invoice_events for insert to authenticated with check (public.is_active_staff());'];
    // The fourth allowed set (Nov 16, drafts/36): row rules on that draft's OWN six
    // new tables. Active staff read everything and may record a document (status
    // 'received') and add a subject; only the owner writes the checklist or
    // updates a subject; who may approve, correct or withdraw a document is the
    // guard trigger's job (owner only), on top of these rules.
    const SUPPLIER_DOC_RULES = [
      'drop policy if exists supplier_document_types_staff_read on public.supplier_document_types;',
      'create policy supplier_document_types_staff_read on public.supplier_document_types for select to authenticated using (public.is_active_staff());',
      'drop policy if exists supplier_document_types_owner_write on public.supplier_document_types;',
      "create policy supplier_document_types_owner_write on public.supplier_document_types for all to authenticated using (public.current_role() in ('owner', 'administrator')) with check (public.current_role() in ('owner', 'administrator'));",
      'drop policy if exists supplier_type_document_profiles_staff_read on public.supplier_type_document_profiles;',
      'create policy supplier_type_document_profiles_staff_read on public.supplier_type_document_profiles for select to authenticated using (public.is_active_staff());',
      'drop policy if exists supplier_type_document_profiles_owner_write on public.supplier_type_document_profiles;',
      "create policy supplier_type_document_profiles_owner_write on public.supplier_type_document_profiles for all to authenticated using (public.current_role() in ('owner', 'administrator')) with check (public.current_role() in ('owner', 'administrator'));",
      'drop policy if exists supplier_document_supplier_profiles_staff_read on public.supplier_document_supplier_profiles;',
      'create policy supplier_document_supplier_profiles_staff_read on public.supplier_document_supplier_profiles for select to authenticated using (public.is_active_staff());',
      'drop policy if exists supplier_document_supplier_profiles_owner_write on public.supplier_document_supplier_profiles;',
      "create policy supplier_document_supplier_profiles_owner_write on public.supplier_document_supplier_profiles for all to authenticated using (public.current_role() in ('owner', 'administrator')) with check (public.current_role() in ('owner', 'administrator'));",
      'drop policy if exists supplier_document_subjects_staff_read on public.supplier_document_subjects;',
      'create policy supplier_document_subjects_staff_read on public.supplier_document_subjects for select to authenticated using (public.is_active_staff());',
      'drop policy if exists supplier_document_subjects_staff_add on public.supplier_document_subjects;',
      'create policy supplier_document_subjects_staff_add on public.supplier_document_subjects for insert to authenticated with check (public.is_active_staff() and is_active);',
      'drop policy if exists supplier_document_subjects_owner_update on public.supplier_document_subjects;',
      "create policy supplier_document_subjects_owner_update on public.supplier_document_subjects for update to authenticated using (public.current_role() in ('owner', 'administrator')) with check (public.current_role() in ('owner', 'administrator'));",
      'drop policy if exists supplier_documents_staff_read on public.supplier_documents;',
      'create policy supplier_documents_staff_read on public.supplier_documents for select to authenticated using (public.is_active_staff());',
      'drop policy if exists supplier_documents_staff_record on public.supplier_documents;',
      "create policy supplier_documents_staff_record on public.supplier_documents for insert to authenticated with check (public.is_active_staff() and status = 'received');",
      'drop policy if exists supplier_documents_staff_update on public.supplier_documents;',
      'create policy supplier_documents_staff_update on public.supplier_documents for update to authenticated using (public.is_active_staff()) with check (public.is_active_staff());',
      'drop policy if exists supplier_document_events_staff_read on public.supplier_document_events;',
      'create policy supplier_document_events_staff_read on public.supplier_document_events for select to authenticated using (public.is_active_staff());',
      'drop policy if exists supplier_document_handoffs_read on public.supplier_document_handoffs;',
      'create policy supplier_document_handoffs_read on public.supplier_document_handoffs for select to authenticated using (handed_by = auth.uid() or public.is_owner_or_admin());',
      'drop policy if exists supplier_document_handoffs_staff_add on public.supplier_document_handoffs;',
      "create policy supplier_document_handoffs_staff_add on public.supplier_document_handoffs for insert to authenticated with check (public.is_active_staff() and status = 'waiting');",
      'drop policy if exists supplier_document_handoffs_owner_resolve on public.supplier_document_handoffs;',
      "create policy supplier_document_handoffs_owner_resolve on public.supplier_document_handoffs for update to authenticated using (public.current_role() in ('owner', 'administrator')) with check (public.current_role() in ('owner', 'administrator'));",
      'drop policy if exists supplier_document_events_trigger_insert on public.supplier_document_events;',
      'create policy supplier_document_events_trigger_insert on public.supplier_document_events for insert to authenticated with check (public.is_active_staff());'];
    // The fifth allowed set (Nov 21, drafts/38 + 39): the two rules on Supabase's
    // storage.objects for the private supplier-documents bucket only (owner reads;
    // the recorder uploads into a waiting document's folder), and their removal.
    const SUPPLIER_FILE_RULES = [
      'drop policy if exists supplier_document_files_owner_read on storage.objects;',
      // owner decision of Nov 25: a manager opens files too (to approve them); nothing else changed
      "create policy supplier_document_files_owner_read on storage.objects for select to authenticated using (bucket_id = 'supplier-documents' and coalesce(public.supplier_documents_is_owner() or public.current_role() = 'manager', false));",
      'drop policy if exists supplier_document_files_upload on storage.objects;',
      "create policy supplier_document_files_upload on storage.objects for insert to authenticated with check (bucket_id = 'supplier-documents' and public.supplier_document_file_upload_allowed(name));"];
    // The sixth allowed set (Nov 22, drafts/40): row rules on that draft's OWN new
    // tables for partial receiving and returns. Staff submit for purchase orders
    // they can see; who may DECIDE (the owner) is the guards' job on top of these.
    const RECEIVING_RULES = [
      'drop policy if exists receiving_records_read on public.receiving_records;',
      'create policy receiving_records_read on public.receiving_records for select to authenticated using (submitted_by = auth.uid() or public.is_owner_or_admin());',
      'drop policy if exists receiving_records_submit on public.receiving_records;',
      "create policy receiving_records_submit on public.receiving_records for insert to authenticated with check (public.is_active_staff() and status = 'submitted' and exists (select 1 from public.purchase_orders po where po.id = receiving_records.purchase_order_id));",
      'drop policy if exists receiving_records_decide on public.receiving_records;',
      'create policy receiving_records_decide on public.receiving_records for update to authenticated using (submitted_by = auth.uid() or public.stock_is_owner()) with check (submitted_by = auth.uid() or public.stock_is_owner());',
      'drop policy if exists receiving_record_lines_read on public.receiving_record_lines;',
      'create policy receiving_record_lines_read on public.receiving_record_lines for select to authenticated using (exists (select 1 from public.receiving_records r where r.id = receiving_record_lines.record_id));',
      'drop policy if exists receiving_record_lines_add on public.receiving_record_lines;',
      'create policy receiving_record_lines_add on public.receiving_record_lines for insert to authenticated with check (public.is_active_staff() and exists (select 1 from public.receiving_records r where r.id = receiving_record_lines.record_id));',
      'drop policy if exists receiving_record_lines_surplus on public.receiving_record_lines;',
      'create policy receiving_record_lines_surplus on public.receiving_record_lines for update to authenticated using (public.stock_is_owner()) with check (public.stock_is_owner());',
      'drop policy if exists supplier_returns_read on public.supplier_returns;',
      'create policy supplier_returns_read on public.supplier_returns for select to authenticated using (submitted_by = auth.uid() or public.is_owner_or_admin());',
      'drop policy if exists supplier_returns_submit on public.supplier_returns;',
      "create policy supplier_returns_submit on public.supplier_returns for insert to authenticated with check (public.is_active_staff() and status = 'submitted' and exists (select 1 from public.purchase_order_items i where i.id = supplier_returns.po_item_id));",
      'drop policy if exists supplier_returns_decide on public.supplier_returns;',
      'create policy supplier_returns_decide on public.supplier_returns for update to authenticated using (submitted_by = auth.uid() or public.stock_is_owner()) with check (submitted_by = auth.uid() or public.stock_is_owner());',
      'drop policy if exists customer_return_inspections_read on public.customer_return_inspections;',
      'create policy customer_return_inspections_read on public.customer_return_inspections for select to authenticated using (public.is_active_staff());',
      'drop policy if exists customer_return_inspections_record on public.customer_return_inspections;',
      "create policy customer_return_inspections_record on public.customer_return_inspections for insert to authenticated with check (public.is_active_staff() and status = 'awaiting_inspection');",
      'drop policy if exists customer_return_inspections_decide on public.customer_return_inspections;',
      'create policy customer_return_inspections_decide on public.customer_return_inspections for update to authenticated using (received_by = auth.uid() or public.stock_is_owner()) with check (received_by = auth.uid() or public.stock_is_owner());',
      'drop policy if exists stock_movements_read on public.stock_movements;',
      'create policy stock_movements_read on public.stock_movements for select to authenticated using (public.is_owner_or_admin());',
      'drop policy if exists stock_movements_trigger_insert on public.stock_movements;',
      'create policy stock_movements_trigger_insert on public.stock_movements for insert to authenticated with check (public.is_active_staff());',
      'drop policy if exists stock_corrections_read on public.stock_corrections;',
      'create policy stock_corrections_read on public.stock_corrections for select to authenticated using (public.is_owner_or_admin());',
      'drop policy if exists stock_corrections_owner on public.stock_corrections;',
      'create policy stock_corrections_owner on public.stock_corrections for insert to authenticated with check (public.stock_is_owner());'];
    // The ninth allowed set (Nov 24, drafts/48): row rules on that draft's OWN new
    // tables (order_parcels and their diary; never the Shipping agent's shipments): every active team member, administrators
    // and the owner read, add and move parcels forward; the diary is insert-only.
    const SHIPMENT_RULES = [
      'drop policy if exists order_parcels_read on public.order_parcels;',
      'create policy order_parcels_read on public.order_parcels for select to authenticated using (public.is_active_staff() or public.is_owner_or_admin());',
      'drop policy if exists order_parcels_team_add on public.order_parcels;',
      'create policy order_parcels_team_add on public.order_parcels for insert to authenticated with check (public.is_active_staff() or public.is_owner_or_admin());',
      'drop policy if exists order_parcels_team_change on public.order_parcels;',
      'create policy order_parcels_team_change on public.order_parcels for update to authenticated\n  using (public.is_active_staff() or public.is_owner_or_admin()) with check (public.is_active_staff() or public.is_owner_or_admin());',
      'drop policy if exists order_parcel_events_read on public.order_parcel_events;',
      'create policy order_parcel_events_read on public.order_parcel_events for select to authenticated using (public.is_active_staff() or public.is_owner_or_admin());',
      'drop policy if exists order_parcel_events_diary on public.order_parcel_events;',
      'create policy order_parcel_events_diary on public.order_parcel_events for insert to authenticated with check (public.is_active_staff() or public.is_owner_or_admin());'];
    // The eleventh allowed set (Nov 24, drafts/52): row rules on that draft's OWN new
    // table (the real costs of each order): money, so owner and administrators only.
    // The twelfth allowed set (Nov 24, drafts/54): row rules on that draft's OWN new
    // table (which batch went into which order): packing is staff work, so every
    // active team member, administrators and the owner read and record; the guard
    // limits what a change may be (more bottles, or a void by owner/administrator).
    // The thirteenth allowed set (Nov 24, drafts/56): row rules on that draft's OWN three new
    // tables (approved email campaigns, the outbox, the do-not-email list). They hold customer
    // and store email addresses, so only the owner and administrators read; only the owner
    // approves and queues; the guards limit every change (a person can only skip a queued email).
    const EMAIL_RULES = [
      'drop policy if exists email_suppressions_read on public.email_suppressions;',
      'create policy email_suppressions_read on public.email_suppressions for select to authenticated using (public.is_owner_or_admin());',
      'drop policy if exists email_suppressions_add on public.email_suppressions;',
      'create policy email_suppressions_add on public.email_suppressions for insert to authenticated with check (public.is_owner_or_admin());',
      'drop policy if exists email_campaigns_read on public.email_campaigns;',
      'create policy email_campaigns_read on public.email_campaigns for select to authenticated using (public.is_owner_or_admin());',
      'drop policy if exists email_campaigns_owner_add on public.email_campaigns;',
      "create policy email_campaigns_owner_add on public.email_campaigns for insert to authenticated with check (coalesce(public.current_role(), '') in ('owner', 'administrator'));",
      'drop policy if exists email_campaigns_owner_change on public.email_campaigns;',
      "create policy email_campaigns_owner_change on public.email_campaigns for update to authenticated\n  using (coalesce(public.current_role(), '') in ('owner', 'administrator')) with check (coalesce(public.current_role(), '') in ('owner', 'administrator'));",
      'drop policy if exists email_outbox_read on public.email_outbox;',
      'create policy email_outbox_read on public.email_outbox for select to authenticated using (public.is_owner_or_admin());',
      'drop policy if exists email_outbox_owner_add on public.email_outbox;',
      "create policy email_outbox_owner_add on public.email_outbox for insert to authenticated with check (coalesce(public.current_role(), '') in ('owner', 'administrator'));",
      'drop policy if exists email_outbox_skip on public.email_outbox;',
      'create policy email_outbox_skip on public.email_outbox for update to authenticated\n  using (public.is_owner_or_admin()) with check (public.is_owner_or_admin());'];
    // The fourteenth allowed set (Nov 24, drafts/58): row rules on that draft's OWN new table
    // (one person's settings): each active person reads and writes only their own rows.
    const OWN = "user_id = auth.uid() and (public.is_active_staff() or public.is_owner_or_admin())";
    const MY_SETTINGS_RULES = [
      'drop policy if exists my_settings_own_read on public.my_settings;',
      'create policy my_settings_own_read on public.my_settings for select to authenticated\n  using (' + OWN + ');',
      'drop policy if exists my_settings_own_add on public.my_settings;',
      'create policy my_settings_own_add on public.my_settings for insert to authenticated\n  with check (' + OWN + ');',
      'drop policy if exists my_settings_own_change on public.my_settings;',
      'create policy my_settings_own_change on public.my_settings for update to authenticated\n  using (' + OWN + ')\n  with check (' + OWN + ');'];
    // The fifteenth allowed set (Nov 24, drafts/60): row rules on that draft's OWN new table
    // (reviews the owner typed in): the owner and administrators only.
    const REVIEW_RULES = [
      'drop policy if exists customer_reviews_read on public.customer_reviews;',
      'create policy customer_reviews_read on public.customer_reviews for select to authenticated\n  using (public.is_owner_or_admin());',
      'drop policy if exists customer_reviews_add on public.customer_reviews;',
      'create policy customer_reviews_add on public.customer_reviews for insert to authenticated\n  with check (public.is_owner_or_admin());',
      'drop policy if exists customer_reviews_change on public.customer_reviews;',
      'create policy customer_reviews_change on public.customer_reviews for update to authenticated\n  using (public.is_owner_or_admin())\n  with check (public.is_owner_or_admin());'];
    // The sixteenth allowed set (Nov 25, drafts/64): two row rules on the EXISTING accounts table,
    // the owner's decision of Nov 24 (each level looks after the levels below it). They only ADD
    // "an account of a level below yours" for reading and changing; the rules that exist today are
    // not named, changed or dropped. No rule for adding or deleting an account.
    const LEVELS = 'public.people_can_manage(public.people_actor_role(), role::text, id = auth.uid(), ';
    const PEOPLE_RULES = [
      'drop policy if exists profiles_levels_read on public.profiles;',
      'create policy profiles_levels_read on public.profiles for select to authenticated\n  using (' + LEVELS + 'false));',
      'drop policy if exists profiles_levels_change on public.profiles;',
      'create policy profiles_levels_change on public.profiles for update to authenticated\n  using (' + LEVELS + 'is_break_glass))\n  with check (' + LEVELS + 'is_break_glass));'];
    const ORDER_BATCH_RULES = [
      'drop policy if exists order_batches_read on public.order_batches;',
      'create policy order_batches_read on public.order_batches for select to authenticated using (public.is_active_staff() or public.is_owner_or_admin());',
      'drop policy if exists order_batches_team_add on public.order_batches;',
      'create policy order_batches_team_add on public.order_batches for insert to authenticated with check (public.is_active_staff() or public.is_owner_or_admin());',
      'drop policy if exists order_batches_team_change on public.order_batches;',
      'create policy order_batches_team_change on public.order_batches for update to authenticated\n  using (public.is_active_staff() or public.is_owner_or_admin()) with check (public.is_active_staff() or public.is_owner_or_admin());'];
    const ORDER_COST_RULES = [
      'drop policy if exists order_costs_read on public.order_costs;',
      'create policy order_costs_read on public.order_costs for select to authenticated using (public.is_owner_or_admin());',
      'drop policy if exists order_costs_add on public.order_costs;',
      'create policy order_costs_add on public.order_costs for insert to authenticated with check (public.is_owner_or_admin());',
      'drop policy if exists order_costs_change on public.order_costs;',
      'create policy order_costs_change on public.order_costs for update to authenticated\n  using (public.is_owner_or_admin()) with check (public.is_owner_or_admin());'];
    // The tenth allowed set (Nov 24, drafts/50): row rules on that draft's OWN new
    // table (settings shared by every device): the owner and administrators read
    // all, active staff only settings marked for staff; only the owner adds or changes.
    const SETTINGS_RULES = [
      'drop policy if exists shared_settings_read on public.shared_settings;',
      "create policy shared_settings_read on public.shared_settings for select to authenticated\n  using (public.is_owner_or_admin() or (audience = 'staff' and public.is_active_staff()));",
      'drop policy if exists shared_settings_owner_add on public.shared_settings;',
      "create policy shared_settings_owner_add on public.shared_settings for insert to authenticated with check (coalesce(public.current_role(), '') in ('owner', 'administrator'));",
      'drop policy if exists shared_settings_owner_change on public.shared_settings;',
      "create policy shared_settings_owner_change on public.shared_settings for update to authenticated\n  using (coalesce(public.current_role(), '') in ('owner', 'administrator')) with check (coalesce(public.current_role(), '') in ('owner', 'administrator'));"];   // owner and administrators (owner decision, Nov 24)
    // The eighth allowed set (Nov 23, drafts/46): row rules on that draft's OWN new
    // table (confirmed tax rates): active staff read; only the owner adds or changes.
    const TAX_RATE_RULES = [
      'drop policy if exists tax_rates_read on public.tax_rates;',
      'create policy tax_rates_read on public.tax_rates for select to authenticated using (public.is_active_staff() or public.is_owner_or_admin());',
      'drop policy if exists tax_rates_owner_add on public.tax_rates;',
      "create policy tax_rates_owner_add on public.tax_rates for insert to authenticated with check (coalesce(public.current_role(), '') in ('owner', 'administrator'));",
      'drop policy if exists tax_rates_owner_change on public.tax_rates;',
      "create policy tax_rates_owner_change on public.tax_rates for update to authenticated\n  using (coalesce(public.current_role(), '') in ('owner', 'administrator')) with check (coalesce(public.current_role(), '') in ('owner', 'administrator'));"];
    // The seventh allowed set (Nov 22, drafts/42): row rules on that draft's OWN
    // new tables (Shopify payout copy, money differences); owner/admin only.
    const MONEY_RULES = [
      'drop policy if exists shopify_payouts_read on public.shopify_payouts;',
      'create policy shopify_payouts_read on public.shopify_payouts for select to authenticated using (public.is_owner_or_admin());',
      'drop policy if exists shopify_balance_transactions_read on public.shopify_balance_transactions;',
      'create policy shopify_balance_transactions_read on public.shopify_balance_transactions for select to authenticated using (public.is_owner_or_admin());',
      'drop policy if exists money_match_issues_read on public.money_match_issues;',
      'create policy money_match_issues_read on public.money_match_issues for select to authenticated using (public.is_owner_or_admin());',
      'drop policy if exists money_match_issues_add on public.money_match_issues;',
      'create policy money_match_issues_add on public.money_match_issues for insert to authenticated with check (public.is_owner_or_admin());',
      'drop policy if exists money_match_issues_check on public.money_match_issues;',
      'create policy money_match_issues_check on public.money_match_issues for update to authenticated using (public.is_owner_or_admin()) with check (public.is_owner_or_admin());'];
    // The eighth allowed set (Nov 22, drafts/44, owner decision): two READ-ONLY
    // rules on the EXISTING purchase-order tables for active staff. Only select.
    const STAFF_PO_RULES = [
      'drop policy if exists staff_read_purchase_orders on public.purchase_orders;',
      'create policy staff_read_purchase_orders on public.purchase_orders for select to authenticated using (public.is_active_staff() and deleted_at is null);',
      'drop policy if exists staff_read_purchase_order_items on public.purchase_order_items;',
      'create policy staff_read_purchase_order_items on public.purchase_order_items for select to authenticated using (public.is_active_staff() and exists (select 1 from public.purchase_orders po where po.id = purchase_order_items.purchase_order_id and po.deleted_at is null));'];
    // Nov 25 (owner decision on managers, option A, drafts/66): a manager reads the deliveries and the
    // returns to the supplier waiting for a decision; drafts/67 puts drafts/40's own two rules back.
    const MANAGER_STOCK_RULES = [
      'drop policy if exists receiving_records_read on public.receiving_records;',
      "create policy receiving_records_read on public.receiving_records for select to authenticated using (submitted_by = auth.uid() or public.is_owner_or_admin() or public.current_role() = 'manager');",
      'drop policy if exists supplier_returns_read on public.supplier_returns;',
      "create policy supplier_returns_read on public.supplier_returns for select to authenticated using (submitted_by = auth.uid() or public.is_owner_or_admin() or public.current_role() = 'manager');"];
    const MANAGER_STOCK_UNDO = [
      'drop policy if exists receiving_records_read on public.receiving_records;',
      'create policy receiving_records_read on public.receiving_records for select to authenticated using (submitted_by = auth.uid() or public.is_owner_or_admin());',
      'drop policy if exists supplier_returns_read on public.supplier_returns;',
      'create policy supplier_returns_read on public.supplier_returns for select to authenticated using (submitted_by = auth.uid() or public.is_owner_or_admin());'];
    // Nov 26 (drafts/70, design D5): the owner and administrators READ the backup jobs' own report table;
    // no rule lets anyone signed in add, change or delete a line (only the backup job writes, with the service key).
    const BACKUP_REPORT_RULES = [
      'drop policy if exists backup_reports_owner_admin_read on public.backup_reports;',
      'create policy backup_reports_owner_admin_read on public.backup_reports for select to authenticated using (public.is_owner_or_admin());'];
    if (f === '70_DRAFT_backup_reports.sql') {
      for (const r of BACKUP_REPORT_RULES) expect(sql.split(r).length - 1, 'pinned rule present exactly once: ' + r.slice(0, 60)).toBe(1);
      expect(sql, 'signed-in people may only read').toContain('grant select on public.backup_reports to authenticated;');
      expect(sql, 'the backup job may add and read, nothing more').toContain('grant select, insert on public.backup_reports to service_role;');
      expect(sql, 'no update or delete for anyone').not.toMatch(/grant[^;]*\b(update|delete|all)\b[^;]*backup_reports/);
    }
    if (f === '66_DRAFT_managers_approve_stock.sql') for (const r of MANAGER_STOCK_RULES) expect(sql.split(r).length - 1, 'pinned rule present exactly once: ' + r.slice(0, 60)).toBe(1);
    if (f === '67_DRAFT_rollback_managers_approve_stock.sql') for (const r of MANAGER_STOCK_UNDO) expect(sql.split(r).length - 1, 'pinned rule present exactly once: ' + r.slice(0, 60)).toBe(1);
    const SUPPLIER_FILE_DROPS = [
      'drop policy if exists supplier_document_files_owner_read on storage.objects;',
      'drop policy if exists supplier_document_files_upload on storage.objects;'];
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
          : f === '36_DRAFT_supplier_documents.sql' ? SUPPLIER_DOC_RULES.reduce((t, r) => t.split(r).join(''), sql)
            : f === '38_DRAFT_supplier_document_files.sql' ? SUPPLIER_FILE_RULES.reduce((t, r) => t.split(r).join(''), sql)
              : f === '39_DRAFT_rollback_supplier_document_files.sql' ? SUPPLIER_FILE_DROPS.reduce((t, r) => t.split(r).join(''), sql)
              : f === '45_DRAFT_rollback_staff_read_purchase_orders.sql' ? STAFF_PO_RULES.filter(r => r.startsWith('drop policy')).reduce((t, r) => t.split(r).join(''), sql)
                : f === '40_DRAFT_partial_receiving_returns.sql' ? RECEIVING_RULES.reduce((t, r) => t.split(r).join(''), sql)
                : f === '42_DRAFT_shopify_payouts_money_issues.sql' ? MONEY_RULES.reduce((t, r) => t.split(r).join(''), sql)
                : f === '44_DRAFT_staff_read_purchase_orders.sql' ? STAFF_PO_RULES.reduce((t, r) => t.split(r).join(''), sql)
                : f === '46_DRAFT_tax_rates.sql' ? TAX_RATE_RULES.reduce((t, r) => t.split(r).join(''), sql)
                : f === '48_DRAFT_order_parcels.sql' ? SHIPMENT_RULES.reduce((t, r) => t.split(r).join(''), sql)
                : f === '50_DRAFT_shared_settings.sql' ? SETTINGS_RULES.reduce((t, r) => t.split(r).join(''), sql)
                : f === '52_DRAFT_order_costs.sql' ? ORDER_COST_RULES.reduce((t, r) => t.split(r).join(''), sql)
                : f === '54_DRAFT_order_batches.sql' ? ORDER_BATCH_RULES.reduce((t, r) => t.split(r).join(''), sql)
                : f === '56_DRAFT_email_sending.sql' ? EMAIL_RULES.reduce((t, r) => t.split(r).join(''), sql)
                : f === '58_DRAFT_my_settings.sql' ? MY_SETTINGS_RULES.reduce((t, r) => t.split(r).join(''), sql)
                : f === '60_DRAFT_customer_reviews.sql' ? REVIEW_RULES.reduce((t, r) => t.split(r).join(''), sql)
                : f === '64_DRAFT_people_levels.sql' ? PEOPLE_RULES.reduce((t, r) => t.split(r).join(''), sql)
                : f === '65_DRAFT_rollback_people_levels.sql' ? PEOPLE_RULES.filter(r => r.startsWith('drop policy')).reduce((t, r) => t.split(r).join(''), sql)
                : f === '66_DRAFT_managers_approve_stock.sql' ? MANAGER_STOCK_RULES.reduce((t, r) => t.split(r).join(''), sql)
                : f === '67_DRAFT_rollback_managers_approve_stock.sql' ? MANAGER_STOCK_UNDO.reduce((t, r) => t.split(r).join(''), sql)
                : f === '70_DRAFT_backup_reports.sql' ? BACKUP_REPORT_RULES.reduce((t, r) => t.split(r).join(''), sql) : sql;
    if (f === '64_DRAFT_people_levels.sql') {
      for (const r of PEOPLE_RULES) expect(sql.split(r).length - 1, 'pinned rule present exactly once: ' + r.slice(0, 60)).toBe(1);
      // only reading and changing: never a rule for adding or deleting an account, and none for "all"
      expect(sql).not.toMatch(/for (insert|delete|all) to/);
      // nothing new is granted on the accounts table, and nothing at all on the saved text
      expect(sql).not.toMatch(/grant [^;]* on (table )?public\.profiles/);
      expect(sql).toContain('revoke all on public.people_levels_backup from public, anon, authenticated;');
      expect(sql).not.toMatch(/grant [^;]*people_levels_backup/);
      const whole = fs.readFileSync(path.join(DIR, f), 'utf8');
      // today's guard is saved before it is replaced, once, and never overwritten by this file's own guard
      expect(whole.indexOf('insert into public.people_levels_backup')).toBeGreaterThan(0);
      expect(whole.indexOf('insert into public.people_levels_backup')).toBeLessThan(whole.indexOf('create or replace function public.guard_profile_privileged_columns()'));
      expect(whole).toContain('on conflict (what) do nothing;');
      expect(whole).toContain("obj_description(to_regclass('public.people_levels_backup'), 'pg_class')");
      // no account is changed by installing: the only UPDATEs are inside the functions a person calls
      expect(sql).not.toMatch(/^\s*update\s+public\.profiles/m);
    }
    if (f === '60_DRAFT_customer_reviews.sql') {
      for (const r of REVIEW_RULES) expect(sql.split(r).length - 1, 'pinned rule present exactly once: ' + r.slice(0, 60)).toBe(1);
      // every row rule is "the owner and administrators": staff and visitors never read a review
      expect([...sql.matchAll(/create policy [^;]+;/g)].every(m => m[0].includes('public.is_owner_or_admin()') && !m[0].includes('is_active_staff'))).toBe(true);
      // a review is never deleted by a person: no delete is granted and no delete rule exists
      expect(sql).not.toMatch(/grant [^;]*delete[^;]* to authenticated/);
      expect(sql).not.toMatch(/for (delete|all) to/);
      expect(fs.readFileSync(path.join(DIR, f), 'utf8')).toContain("obj_description(to_regclass('public.customer_reviews'), 'pg_class')");
    }
    if (f === '58_DRAFT_my_settings.sql') {
      for (const r of MY_SETTINGS_RULES) expect(sql.split(r).length - 1, 'pinned rule present exactly once: ' + r.slice(0, 60)).toBe(1);
      // every row rule is "your own rows only": no rule lets the owner or an administrator read someone else's
      expect([...sql.matchAll(/create policy [^;]+;/g)].every(m => m[0].includes('user_id = auth.uid()'))).toBe(true);
      expect(sql).not.toMatch(/grant [^;]*delete[^;]* to authenticated/);
      expect(sql).not.toMatch(/for (delete|all) to/);
      expect(fs.readFileSync(path.join(DIR, f), 'utf8')).toContain("obj_description(to_regclass('public.my_settings'), 'pg_class')");
    }
    if (f === '56_DRAFT_email_sending.sql') {
      for (const r of EMAIL_RULES) expect(sql.split(r).length - 1, 'pinned rule present exactly once: ' + r.slice(0, 60)).toBe(1);
      const whole = fs.readFileSync(path.join(DIR, f), 'utf8');
      // nothing is ever deleted from these tables by a person: no delete is granted, and no delete rule exists
      expect(sql).not.toMatch(/grant [^;]*delete[^;]* to authenticated/);
      expect(sql).not.toMatch(/for (delete|all) to/);
      // the do-not-email list only grows: no update is granted on it either
      expect(sql).toContain('grant select, insert on public.email_suppressions to authenticated;');
      // the sending program's two functions are never given to a signed-in person or a visitor
      expect(sql).toContain('revoke all on function public.next_emails_to_send(integer) from public, anon, authenticated;');
      expect(sql).toContain('revoke all on function public.record_email_result(uuid, text, text, text) from public, anon, authenticated;');
      expect(sql).not.toMatch(/grant execute on function public\.(next_emails_to_send|record_email_result)/);
      // it refuses to install over tables it did not create, and says in its own words that it sends nothing
      expect(whole).toContain("not like 'Health Endeavors drafts/56:%'");
      expect(whole).toContain('NOTHING IN THIS FILE SENDS AN EMAIL.');
      // it reaches no network and schedules nothing: no extension, no http call, no cron job
      const live = whole.split('\n').filter(l => !/^\s*--/.test(l)).join('\n');
      expect(live).not.toMatch(/\b(create extension|pg_net|net\.http|http_post|cron\.schedule|dblink)\b/i);
      // existing tables are only read: the only tables it creates or alters are its own three
      expect([...live.matchAll(/\b(?:create table if not exists|alter table) public\.(\w+)/g)].map(m => m[1]).filter(t => !/^email_(campaigns|outbox|suppressions)$/.test(t))).toEqual([]);
    }
    if (f === '54_DRAFT_order_batches.sql') {
      for (const r of ORDER_BATCH_RULES) expect(sql.split(r).length - 1, 'pinned rule present exactly once: ' + r.slice(0, 60)).toBe(1);
      // a recorded batch is voided, never deleted: no delete is granted, and no delete rule exists
      expect(sql).not.toMatch(/grant [^;]*delete[^;]* to authenticated/);
      expect(sql).not.toMatch(/for (delete|all) to/);
      expect(sql).toContain('grant select, insert, update on public.order_batches to authenticated;');
      const whole = fs.readFileSync(path.join(DIR, f), 'utf8');
      expect(whole).toContain("obj_description(to_regclass('public.order_batches'), 'pg_class')");
      // its two links never hold a batch in stock or a product back
      expect(whole).toContain('references public.inventory_lots(id) on delete set null');
      expect(whole).toContain('references public.products(id) on delete set null');
      // existing tables are only read: nothing creates, alters, or writes orders, inventory_lots or products
      const live = whole.split('\n').filter(l => !/^\s*--/.test(l)).join('\n');
      expect(live).not.toMatch(/(alter|drop)\s+table[^;]*public\.(orders|inventory_lots|products)\b/i);
      expect(live).not.toMatch(/(insert\s+into|update|delete\s+from)\s+public\.(orders|inventory_lots|products)\b/i);
    }
    if (f === '52_DRAFT_order_costs.sql') {
      for (const r of ORDER_COST_RULES) expect(sql.split(r).length - 1, 'pinned rule present exactly once: ' + r.slice(0, 60)).toBe(1);
      // costs are replaced, never deleted: no delete is granted, and no delete rule exists
      expect(sql).not.toMatch(/grant [^;]*delete[^;]* to authenticated/);
      expect(sql).not.toMatch(/for (delete|all) to/);
      expect(sql).toContain('grant select, insert, update on public.order_costs to authenticated;');
      expect(fs.readFileSync(path.join(DIR, f), 'utf8')).toContain("obj_description(to_regclass('public.order_costs'), 'pg_class')");
    }
    if (f === '50_DRAFT_shared_settings.sql') {
      for (const r of SETTINGS_RULES) expect(sql.split(r).length - 1, 'pinned rule present exactly once: ' + r.slice(0, 60)).toBe(1);
      // a setting is replaced, never deleted: no delete is granted, and no delete rule exists
      expect(sql).not.toMatch(/grant [^;]*delete[^;]* to authenticated/);
      expect(sql).not.toMatch(/for (delete|all) to/);
      expect(sql).toContain('grant select, insert, update on public.shared_settings to authenticated;');
      // it refuses a table of the same name it did not create (the lesson of drafts/48)
      expect(fs.readFileSync(path.join(DIR, f), 'utf8')).toContain("obj_description(to_regclass('public.shared_settings'), 'pg_class')");
    }
    if (f === '48_DRAFT_order_parcels.sql') {
      for (const r of SHIPMENT_RULES) expect(sql.split(r).length - 1, 'pinned rule present exactly once: ' + r.slice(0, 60)).toBe(1);
      // a parcel is never deleted (cancelled instead); the diary is never edited or deleted
      expect(sql).not.toMatch(/grant [^;]*delete[^;]* to authenticated/);
      expect(sql).not.toMatch(/for (delete|all) to/);
      expect(sql).toContain('grant select, insert, update on public.order_parcels to authenticated;');
      expect(sql).toContain('grant select, insert on public.order_parcel_events to authenticated;');
      // Nov 24 (adapted to production): the Shipping/Tracking agent's own shipments table is
      // only ever READ: no statement creates, alters, drops, grants on, or adds a rule,
      // trigger or link to public.shipments, and nothing inserts, updates or deletes its rows.
      const live = fs.readFileSync(path.join(DIR, f), 'utf8').split('\n').filter(l => !/^\s*--/.test(l)).join('\n');
      expect(live).not.toMatch(/(create|alter|drop)\s+table[^;]*public\.shipments\b/i);
      expect(live).not.toMatch(/(insert\s+into|update|delete\s+from)\s+public\.shipments\b/i);
      expect(live).not.toMatch(/\bon\s+public\.shipments\b/i);
      expect(live).not.toMatch(/references\s+public\.shipments\b/i);
      expect(live.split('public.shipments').length - 1, 'read in one query, checked in the precheck').toBeLessThanOrEqual(6);
      expect(live).toContain("obj_description(to_regclass('public.order_parcels'), 'pg_class')");
    }
    if (f === '46_DRAFT_tax_rates.sql') {
      for (const r of TAX_RATE_RULES) expect(sql.split(r).length - 1, 'pinned rule present exactly once: ' + r.slice(0, 60)).toBe(1);
      // a confirmed rate is never deleted: no delete is granted, and no delete rule exists
      expect(sql).not.toMatch(/grant [^;]*delete[^;]* to authenticated/);
      expect(sql).not.toMatch(/for (delete|all) to/);
      expect(sql).toContain('grant select, insert, update on public.tax_rates to authenticated;');
    }
    if (f === '44_DRAFT_staff_read_purchase_orders.sql') {
      for (const r of STAFF_PO_RULES) expect(sql.split(r).length - 1, 'pinned rule present exactly once: ' + r.slice(0, 60)).toBe(1);
      // read only: no rule for insert, update or delete, and no grant at all
      expect(sql).not.toMatch(/create policy [^;]* for (insert|update|delete|all)/);
      expect(sql).not.toMatch(/\bgrant\b/);
    }
    if (f === '42_DRAFT_shopify_payouts_money_issues.sql') {
      for (const r of MONEY_RULES) expect(sql.split(r).length - 1, 'pinned rule present exactly once: ' + r.slice(0, 60)).toBe(1);
      // nobody signed in may write the Shopify copy, nor delete a difference
      expect(sql).not.toMatch(/grant [^;]*(insert|update|delete)[^;]* on public\.shopify_/);
      expect(sql).not.toMatch(/grant [^;]*delete[^;]* to authenticated/);
    }
    if (f === '40_DRAFT_partial_receiving_returns.sql') {
      for (const r of RECEIVING_RULES) expect(sql.split(r).length - 1, 'pinned rule present exactly once: ' + r.slice(0, 60)).toBe(1);
      // No delete is granted on any of its tables; the guards refuse one anyway.
      expect(sql).not.toMatch(/grant [^;]*delete[^;]* to authenticated/);
    }
    if (f === '38_DRAFT_supplier_document_files.sql') {
      for (const r of SUPPLIER_FILE_RULES) expect(sql.split(r).length - 1, 'pinned rule present exactly once: ' + r.slice(0, 60)).toBe(1);
      expect(sql, 'the bucket is private').toContain("values ('supplier-documents', 'supplier-documents', false,");
      expect(sql, 'no update or delete rule on files').not.toMatch(/for (update|delete|all) to/);
    }
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
        : f === '33_DRAFT_rollback_invoices.sql' ? ['invoice_payments', 'invoice_events', 'invoices', 'invoice_counters'].reduce((t, n) => t.replace('drop table if exists public.' + n + ';', ''), sql)
          // Nov 16: the stock-count rollback removes its own two tables (and refuses to run once any adjustment has been approved or rejected).
          : f === '35_DRAFT_rollback_stock_count_adjustments.sql' ? sql.replace('drop table if exists public.stock_count_adjustments;', '').replace('drop table if exists public.stock_count_approvers;', '')
            // Nov 16, later: the supplier document rollback removes its own tables (and refuses once any document has been reviewed);
            // Nov 21 adds the hand-off table to that list.
            // Nov 22: the partial receiving rollback removes its own six tables (and refuses once any stock moved).
            // Nov 23: the tax rates rollback removes its own table (and refuses while any rate is recorded, unless authorized).
            : f === '47_DRAFT_rollback_tax_rates.sql' ? sql.replace('drop table if exists public.tax_rates;', '')
            // Nov 24: the parcels rollback removes its own two tables (and refuses while any parcel is recorded, unless authorized).
            // Nov 24: the shared settings rollback removes its own table (and refuses while any setting is saved, unless authorized).
            // Nov 24: the order costs rollback removes its own table (and refuses while any costs are saved, unless authorized).
            // Nov 24: the order batches rollback removes its own table (and refuses while any batch is recorded, unless authorized).
            : f === '55_DRAFT_rollback_order_batches.sql' ? sql.replace('drop table if exists public.order_batches;', '')
            : f === '59_DRAFT_rollback_my_settings.sql' ? sql.replace('drop table if exists public.my_settings;', '')
            // Nov 24: the reviews rollback removes its own table (and refuses while any review is saved, unless authorized).
            : f === '61_DRAFT_rollback_customer_reviews.sql' ? sql.replace('drop table if exists public.customer_reviews;', '')
            // Nov 26: the backup reports rollback removes its own table (it only held "this job finished, ok or not" lines).
            : f === '71_DRAFT_rollback_backup_reports.sql' ? sql.replace('drop table if exists public.backup_reports;', '')
            // Nov 25: the four-levels rollback removes its own small table (the saved text of the earlier guard), and only after that text was put back.
            : f === '65_DRAFT_rollback_people_levels.sql' ? sql.replace('drop table if exists public.people_levels_backup;', '')
            // Nov 24: the email sending rollback removes its own three tables (and refuses while any email record is saved, unless authorized).
            : f === '57_DRAFT_rollback_email_sending.sql' ? ['email_outbox', 'email_campaigns', 'email_suppressions'].reduce((t, n) => t.replace('drop table if exists public.' + n + ';', ''), sql)
            : f === '53_DRAFT_rollback_order_costs.sql' ? sql.replace('drop table if exists public.order_costs;', '')
            : f === '51_DRAFT_rollback_shared_settings.sql' ? sql.replace('drop table if exists public.shared_settings;', '')
            : f === '49_DRAFT_rollback_order_parcels.sql' ? sql.replace('drop table if exists public.order_parcel_events;', '').replace('drop table if exists public.order_parcels;', '')
            : f === '43_DRAFT_rollback_shopify_payouts_money_issues.sql' ? ['money_match_issues', 'shopify_balance_transactions', 'shopify_payouts']
              .reduce((t, n) => t.replace('drop table if exists public.' + n + ';', ''), sql)
            : f === '41_DRAFT_rollback_partial_receiving_returns.sql' ? ['stock_corrections', 'receiving_record_lines', 'receiving_records', 'supplier_returns', 'customer_return_inspections', 'stock_movements']
              .reduce((t, n) => t.replace('drop table if exists public.' + n + ';', ''), sql)
            : f === '37_DRAFT_rollback_supplier_documents.sql' ? ['supplier_document_handoffs', 'supplier_document_events', 'supplier_documents', 'supplier_document_subjects', 'supplier_document_supplier_profiles', 'supplier_type_document_profiles', 'supplier_document_types']
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
          // Nov 21: the file rollback removes its own bucket row, and only after refusing if any file is stored in it.
          : f === '39_DRAFT_rollback_supplier_document_files.sql'
            ? sql.replace("delete from storage.buckets where id = 'supplier-documents';", '')
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
    let sql = code(fs.readFileSync(path.join(DIR, f), 'utf8'));
    if (f === '65_DRAFT_rollback_people_levels.sql') {
      // The one pinned exception (Nov 25): the rollback of drafts/64 runs the guard's earlier text exactly as
      // drafts/64 saved it (the database's own pg_get_functiondef output, kept where no signed-in person can
      // read or write). It appears once, and only after the saved text was checked to be that function.
      expect(sql.split('execute v_def;').length - 1, 'the saved guard is run exactly once').toBe(1);
      const check = sql.indexOf("if v_def !~* '^\\s*create or replace function public\\.guard_profile_privileged_columns\\(\\)\\s' or v_def ~* 'drafts/64' then");
      expect(check, 'the saved text is checked').toBeGreaterThan(0);
      expect(check, 'and checked before it is run').toBeLessThan(sql.indexOf('execute v_def;'));
      sql = sql.replace('execute v_def;', '');
    }
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
