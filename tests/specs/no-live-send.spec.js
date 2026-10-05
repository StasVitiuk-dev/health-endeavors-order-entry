// R10 preparation: no dashboard action can send a message to a customer or
// call an outside service. Two kinds of check:
//   1. the page source has no way to send (no fetch/XHR/beacon of its own, no
//      Supabase Edge Function calls, no mailto/sms links);
//   2. working through the customer-facing pages in a real browser session
//      sends nothing outside the Supabase tables the page already uses.
// If an email service is ever connected, these tests are the tripwire: the
// change must be deliberate, human-gated and reviewed.

const fs = require('fs');
const path = require('path');
const base = require('@playwright/test');
const { test, expect, login, gotoPage, OWNER_USER } = require('../helpers/dashboard');

const ROOT = path.resolve(__dirname, '..', '..');
const PAGES = ['owner-login.html', 'change-password.html', 'dashboard.html', 'index.html', 'manual-order-entry.html', 'search.html'];

base.test.describe('page source cannot send anything by itself', () => {
  base.test.beforeEach(({}, testInfo) => { base.test.skip(testInfo.project.name !== 'desktop', 'source scan; run once'); });
  for (const file of PAGES) {
    base.test(`${file}: no fetch/XHR/beacon, no Edge Function calls, no mailto/sms links`, () => {
      const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
      base.expect(html).not.toMatch(/\bfetch\s*\(/);
      base.expect(html).not.toMatch(/XMLHttpRequest|sendBeacon|new\s+WebSocket/);
      base.expect(html).not.toMatch(/functions\s*\.\s*invoke|\/functions\/v1\//);
      base.expect(html).not.toMatch(/href\s*=\s*["'](mailto|sms):/i);
    });
  }
  base.test('owner dashboard: the only window.open calls open short-lived signed file links', () => {
    const html = fs.readFileSync(path.join(ROOT, 'owner-login.html'), 'utf8');
    const calls = [...html.matchAll(/window\.open\(([^)]*)\)/g)].map(m => m[1].trim());
    base.expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) base.expect(c).toMatch(/^data\.signedUrl, '_blank', 'noopener,noreferrer'$/);
  });
});

test('customer inquiries: Copy reply and Mark as answered never send anything to anyone', async ({ page, backend, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  const baseRow = { channel: 'email', order_id: null, customer_email: 'syn@example.test', ai_confidence: 0.8, sensitive: false, sensitive_reasons: null, drafted_at: null, answered_at: null };
  backend.tables.customer_inquiries = [
    { ...baseRow, id: 'inq-1', customer_name: 'SYNTHETIC', question_text: 'SYNTHETIC where is my order', status: 'drafted', severity: 'low', ai_draft_reply: 'SYNTHETIC draft', created_at: '2026-09-22T00:00:00Z' },
  ];
  backend.tables.orders = [];
  await login(page);
  await gotoPage(page, 'inquiriesPanel');
  await page.waitForLoadState('networkidle');
  const before = backend.requests.length;
  await page.locator('.inqCopyBtn[data-id="inq-1"]').click();
  await page.locator('.inqAnsweredBtn[data-id="inq-1"]').click();
  await expect.poll(() => backend.tableWrites().filter(r => r.table === 'customer_inquiries').length).toBe(1);
  await page.waitForLoadState('networkidle');
  const after = backend.requests.slice(before);
  // Only reads and the one status change on customer_inquiries; no Edge
  // Function, no RPC, no notification table, nothing outside Supabase.
  expect(after.filter(r => r.path.startsWith('/functions/'))).toEqual([]);
  expect(after.filter(r => r.rpc)).toEqual([]);
  expect(backend.tableWrites().map(r => r.table)).toEqual(['customer_inquiries']);
  expect(backend.tableWrites()[0].body).toMatchObject({ status: 'answered' });
});

test('a full session through every page writes nothing and calls no Edge Function', async ({ page, backend }) => {
  await login(page);
  await page.waitForLoadState('networkidle');
  const ids = await page.locator('#sidebarGroups .sidebarLink[data-page]').evaluateAll(els => [...new Set(els.map(e => e.getAttribute('data-page')))]);
  expect(ids.length).toBeGreaterThan(20);
  for (const id of ids) {
    await gotoPage(page, id);
  }
  await page.waitForLoadState('networkidle');
  expect(backend.requests.filter(r => r.path.startsWith('/functions/'))).toEqual([]);
  expect(backend.tableWrites()).toEqual([]);
  expect(backend.requests.some(r => r.table === 'customer_notifications' && r.method !== 'GET')).toBe(false);
});
