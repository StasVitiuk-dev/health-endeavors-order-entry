// EXT9: the two hard walls, checked on the source of every page so a future
// change cannot cross them quietly.
//   1. DRAFT ≠ SEND: no page can send anything to a customer (no edge-function
//      call, no e-mail / SMS / chat provider). Customer-service replies are
//      drafts a person sends outside the dashboard (no-live-send.spec.js tests
//      the screens; this tests the code).
//   2. Accounting and tax stay read-only: no page writes invoices, payments,
//      payouts, refunds as money movements, tax records or journal entries,
//      and no page calls a payment provider. Expenses and the "refund recorded"
//      note on a return are records a person types, not money movements.
// The write list comes from the same extractor as WRITE_PATH_INVENTORY.md.

const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { extract, PAGES } = require('../tools/write-paths');

const ROOT = path.join(__dirname, '..', '..');
const HTML = ['owner-login.html', 'index.html', 'manual-order-entry.html', 'dashboard.html', 'search.html', 'change-password.html'];
test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'static check; run once'); });

const SEND = [
  /functions\.invoke\(/, /\/functions\/v1\//, /sendgrid/i, /mailgun/i, /postmarkapp/i, /api\.resend\.com/i, /twilio/i,
  /hooks\.slack\.com/i, /api\.telegram\.org/i, /graph\.facebook\.com/i, /gmail\.googleapis\.com/i, /send_?(email|sms|message)/i,
];
const MONEY_PROVIDERS = [/stripe\.com/i, /paypal\.com/i, /squareup\.com/i, /api\.shopify\.com|myshopify\.com\/admin/i, /plaid\.com/i];
const FORBIDDEN_TABLES = ['invoices', 'payments', 'payouts', 'refunds', 'transactions', 'journal_entries', 'ledger', 'tax_records',
  'tax_filings', 'customer_messages', 'outbound_messages', 'email_queue', 'sms_queue', 'notifications_outbox', 'shopify_orders'];
// Every function the pages may call; anything new must be added here deliberately.
const ALLOWED_RPCS = ['employee_activity', 'employee_activity_people', 'employee_activity_areas', 'list_my_sessions', 'revoke_my_session',
  'log_customer_data_access', 'get_agent_cron_status', 'global_search' /* search.html, read-only */, 'receive_purchase_order', 'adjust_inventory', 'quarantine_recall', 'receive_return', 'delete_unused_product'];

for (const f of HTML) {
  test(`${f}: no code path can send a message or move money`, () => {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const re of SEND.concat(MONEY_PROVIDERS)) expect(src, String(re)).not.toMatch(re);
  });
  test(`${f}: every database function it calls is on the reviewed list`, () => {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const called = [...src.matchAll(/(?:\.rpc|callStockFunction)\(\s*'([a-z_]+)'/g)].map(m => m[1]);
    const probes = [...src.matchAll(/\['([a-z_]+)', \{ p_/g)].map(m => m[1]); // STOCK_FN_PROBES
    for (const name of called.concat(probes)) expect(ALLOWED_RPCS, name).toContain(name);
  });
}

test('no page writes an accounting, tax, payment or outbound-message table', () => {
  const written = new Set();
  for (const p of PAGES) for (const r of extract(p)) written.add(r.table);
  for (const t of FORBIDDEN_TABLES) expect([...written], t).not.toContain(t);
});

test('the customer-service draft is never sent by the page: it can only be saved or copied', () => {
  const src = fs.readFileSync(path.join(ROOT, 'owner-login.html'), 'utf8');
  // The only writes to inquiries change the draft / status fields, never a "sent" channel.
  const inquiryWrites = extract('owner-login.html').filter(r => r.table === 'customer_inquiries');
  expect(inquiryWrites.length).toBeGreaterThan(0);
  expect(src).not.toMatch(/sent_at\s*:\s*new Date/);
});
