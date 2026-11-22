// Saved money differences (owner request of Nov 22: "let me know somewhere if
// there is a mismatch"): drafts/42 connected to Home and Accounting through
// he-money-issues-store.js, behind the he_money_issues switch (not on the Feature
// Flags page). Most tests run against a REAL throwaway Postgres with drafts/42
// installed (tests/helpers/pg-bridge.js); they skip where it is not running.
const path = require('path');
const M = require('../../assets/reports/he-money-match.js');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { pgBridge, pgAvailable } = require('../helpers/pg-bridge');
const { unnamedControls } = require('../helpers/a11y-audit');

const INSTALL = path.resolve(__dirname, '..', '..', 'docs', 'ops', 'sql', 'drafts', '42_DRAFT_shopify_payouts_money_issues.sql');
const TABLES = ['money_match_issues'];
const RPCS = ['record_money_issue', 'mark_money_issue_checked'];
// what the daily sync would have stored: one payout that does not add up
const SEED = "insert into shopify_payouts (id, issued_at, status, net) values ('gid://shopify/ShopifyPaymentsPayout/9003', '2026-11-21 18:00+00', 'PAID', 99.00);" +
  "insert into shopify_balance_transactions (id, payout_id, type, amount, fee, net) values ('b5', 'gid://shopify/ShopifyPaymentsPayout/9003', 'CHARGE', 101.00, 3.00, 98.00);" +
  "select public.check_shopify_payouts();";
async function on(page, extra) { await page.addInitScript((x) => { try { localStorage.setItem('he_money_issues', 'on'); if (x) localStorage.setItem('he_money_match', 'on'); } catch (e) {} }, !!extra); }
const needPg = () => test.skip(!pgAvailable(), 'needs the local throwaway Postgres (not available here, e.g. GitHub CI)');

test('switch OFF (the default): Home and Accounting are unchanged', async ({ page }) => {
  await login(page);
  await expect(page.locator('#moneyAlertHost')).toBeEmpty();
  await gotoPage(page, 'accountingPanel');
  await expect(page.locator('#moneyIssuesHost')).toBeEmpty();
});

test('switch ON but not installed (production today): Accounting says so; Home shows nothing', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'run once');
  await page.route(/\/rest\/v1\/(rpc\/[a-z_]*money|money_match)/, r => r.fulfill({ status: 404, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify({ code: 'PGRST205', message: "Could not find the table 'public.money_match_issues' in the schema cache" }) }));
  await on(page); await login(page);
  await expect(page.locator('#moneyAlertHost')).toBeEmpty();
  await gotoPage(page, 'accountingPanel');
  await expect(page.locator('#moneyIssuesHost [data-minote]')).toContainText('not installed in the database yet');
});

test('signed in as staff: nothing is shown', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'run once');
  backend.tables.profiles.find(p => p.role === 'owner').role = 'employee';
  await on(page); await login(page);
  await expect(page.locator('#moneyAlertHost')).toBeEmpty();
  await gotoPage(page, 'accountingPanel');
  await expect(page.locator('#moneyIssuesHost')).toBeEmpty();
});

test.describe('against a real database with drafts/42 installed', () => {
  test.beforeEach(needPg);

  test('Home says a difference is open; Accounting lists it until it is marked checked with a note', async ({ page }) => {
    const db = await pgBridge(page, { install: INSTALL, tables: TABLES, rpcs: RPCS, role: 'owner', setupSql: SEED });
    try {
      await on(page); await login(page);
      const alert = page.locator('#moneyAlertHost [data-moneyalert]');
      await expect(alert).toHaveAttribute('data-moneyalert', '1');
      await expect(alert).toContainText('1 money difference to look at');
      await alert.locator('[data-moneyalertopen]').click();
      const host = page.locator('#moneyIssuesHost');
      await expect(host.locator('table')).toHaveAttribute('data-micount', '1');
      const row = host.locator('tr[data-misource="shopify_payout"]');
      await expect(row).toContainText('Shopify payout of $99.00: its 1 transaction(s) add up to $98.00');
      await expect(row).toContainText('Found by the daily Shopify check');
      await row.locator('[data-micheck]').click();
      await expect(host.locator('input[name="note"]')).toBeFocused();
      await host.locator('form[data-micheckform] button[type="submit"]').click();
      await expect(host.locator('[data-mimessage]')).toContainText('at least 5 characters');
      await host.locator('input[name="note"]').fill('Shopify reserve of $1.00, released next payout');
      await host.locator('form[data-micheckform] button[type="submit"]').click();
      await expect(host.locator('[data-mimessage]')).toContainText('Marked checked. It stays on the record with your note.');
      await expect(host.locator('[data-micount]')).toHaveAttribute('data-micount', '0');
      expect(await db.query("select status||'/'||check_note from money_match_issues")).toBe('checked/Shopify reserve of $1.00, released next payout');
      await page.reload(); await expect(page.locator('#dash')).toBeVisible();
      await expect(page.locator('#moneyAlertHost')).toBeEmpty();
      expect(await page.locator('#moneyIssuesHost').evaluate(unnamedControls)).toEqual([]);
    } finally { await db.close(); }
  });

  test('a card file\'s differences are saved for follow-up once, however often they are saved', async ({ page, backend }) => {
    backend.tables.expenses = [{ id: 'x1', category: 'packaging', amount: '86.40', expense_date: '2026-11-16', vendor: 'SYN Label Printer', receipt_path: null, deleted_at: null, note: null, created_at: '2026-11-16T00:00:00Z' }];
    const db = await pgBridge(page, { install: INSTALL, tables: TABLES, rpcs: RPCS, role: 'owner' });
    try {
      await on(page, true); await login(page); await gotoPage(page, 'accountingPanel');
      const mm = page.locator('#moneyMatchHost');
      await mm.locator('#mmCard').setInputFiles({ name: 'wells-fargo.csv', mimeType: 'text/csv', buffer: Buffer.from(M.fixtures().wells) });
      await expect(mm.locator('[data-mmheadline]')).toHaveText('2 differences to look at');
      await mm.locator('[data-misave]').click();
      await expect(mm.locator('[data-mmmessage]')).toContainText('2 differences saved for follow-up.');
      await expect(page.locator('#moneyIssuesHost [data-micount]')).toHaveAttribute('data-micount', '2');
      await mm.locator('[data-misave]').click();
      await expect(mm.locator('[data-mmmessage]')).toContainText('All of these had been saved before. Nothing changed.');
      expect(await db.query("select count(*)||'/'||string_agg(distinct source, ',') from money_match_issues")).toBe('2/card');
      await expect(page.locator('#moneyIssuesHost')).toContainText('Saved from a card file');
    } finally { await db.close(); }
  });
});
