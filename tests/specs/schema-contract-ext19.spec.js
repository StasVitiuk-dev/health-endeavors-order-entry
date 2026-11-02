// EXT19: the schema contract (tests/tools/schema-contract.js) and the mock's
// column check, plus the real bug they found: "changed by" names were read from
// profiles.full_name, which the real table does not have (it has display_name),
// so System mode and the agent switches never showed who changed them.
const fs = require('fs');
const path = require('path');
const base = require('@playwright/test');
const { test, expect, login, gotoPage, OWNER_USER } = require('../helpers/dashboard');
const sc = require('../tools/schema-contract');

base.test.describe('static contract', () => {
  base.test.beforeEach(({}, ti) => { base.test.skip(ti.project.name !== 'desktop', 'Node only; once'); });

  base.test('every table and column the page names exists in the local real-shape schema (or is a known outside table / draft column)', () => {
    const r = sc.check();
    base.expect(r.drift).toEqual([]);
    base.expect(r.tables).toBeGreaterThan(30);
    base.expect(r.columns).toBeGreaterThan(200);
    const { uses } = sc.contract();
    base.expect([...sc.OUTSIDE].filter(t => !uses[t]), 'stale outside-table entries').toEqual([]);
    for (const t of sc.OUTSIDE) base.expect(sc.schema()[t], `${t} is listed as outside but is in the schema`).toBeUndefined();
  });

  base.test('select parsing: columns, aliases, relations, nested relations, *', () => {
    const p = sc.parseSelect('id, name, total:amount, suppliers(name), purchase_order_items(id, products(sku)), *');
    base.expect(p.cols).toEqual(['id', 'name', 'amount']);
    base.expect(p.rels.map(r => r.table)).toEqual(['suppliers', 'purchase_order_items']);
    base.expect(p.rels[1].sub.rels[0]).toEqual({ table: 'products', sub: { cols: ['sku'], rels: [] } });
  });

  base.test('the contract would have caught the full_name bug', () => {
    const db = sc.schema();
    base.expect(db.profiles.has('display_name')).toBe(true);
    base.expect(db.profiles.has('full_name')).toBe(false);
    const app = ['assets/owner-login-app.js', 'assets/app/he-agents.js'].map(f => fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8')).join('\n');
    base.expect(app).not.toMatch(/\.from\('profiles'\)[^;]*full_name/);
  });
});

test('System mode and agent switches show who changed them (display name), and an unknown column is refused like the real database', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'once');
  const ADMIN = '00000000-0000-4000-8000-0000000000b2';
  backend.tables.profiles = (backend.tables.profiles || []).concat([{ id: ADMIN, email: 'admin@example.test', display_name: 'SYNTHETIC Admin', role: 'administrator', is_active: true, account_number: '100000009' }]);
  backend.tables.system_mode = [{ id: true, mode: 'NORMAL', changed_at: '2026-09-01T00:00:00Z', changed_by: ADMIN }];
  backend.tables.agent_controls = [{ agent_num: 7, enabled: false, updated_by: ADMIN, updated_at: '2026-09-02T00:00:00Z' }];
  await login(page);
  await gotoPage(page, 'flagsPanel');
  await expect(page.locator('#systemModeWrap')).toContainText('Last changed by SYNTHETIC Admin');
  await gotoPage(page, 'aiPanel');
  await expect(page.locator('#agentRegistryWrap .deletedRow[data-agent="7"]')).toContainText('Last changed by SYNTHETIC Admin');
});

base.test('the mock refuses a column the real table does not have (as PostgREST answers 42703)', ({}, ti) => {
  base.test.skip(ti.project.name !== 'desktop', 'Node only; once');
  const { unknownSelectColumns } = require('../helpers/mock-supabase');
  base.expect(unknownSelectColumns('profiles', 'full_name')).toBe('profiles.full_name');
  base.expect(unknownSelectColumns('profiles', 'id, display_name, email')).toBeNull();
  base.expect(unknownSelectColumns('purchase_orders', 'id, purchase_order_items(id, nope)')).toBe('purchase_order_items.nope');
  base.expect(unknownSelectColumns('purchase_orders', 'id, client_request_id')).toBeNull(); // draft column
  base.expect(unknownSelectColumns('agent_controls', 'anything')).toBeNull();          // outside the known 18: not checked
});
