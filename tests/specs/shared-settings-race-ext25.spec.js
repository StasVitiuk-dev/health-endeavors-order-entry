// Two devices adding to the same shared list at the same moment (owner queue of
// Nov 25, task 7). The database half is proven in
// docs/ops/sql/local-test/shared_settings_test.sh ("4b": two real connections at
// once, exactly one saves, the other is told "conflict", nothing is erased).
// This is the dashboard half: assets/views/he-shared-settings.js mergeSave()
// reads, joins, saves only the version it read, and on "conflict" reads and joins
// again. The made-up database here applies the same version rule as drafts/50.
const { test, expect } = require('@playwright/test');
const SS = require('../../assets/views/he-shared-settings.js');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

// An in-memory stand-in for drafts/50 with a version check, and a hook to make
// both devices read before either saves (the worst moment).
function fakeDb() {
  const rows = new Map();
  let clock = 0, gate = null;
  const db = {
    rows, saves: 0, conflicts: 0,
    holdReadsUntil(n) { let release; const p = new Promise(r => { release = r; }); let seen = 0; gate = async () => { seen++; if (seen >= n) release(); await p; }; },
    client() {
      return {
        from() {
          let k = null;
          const q = { select() { return q; }, eq(_c, v) { k = v; return q; }, limit() { return q; },
            then(res, rej) {
              const row = rows.get(k);
              const out = { data: row ? [{ key: k, value: JSON.parse(JSON.stringify(row.value)), updated_at: row.updated_at, updated_by: 'x' }] : [], error: null };
              return (gate ? gate() : Promise.resolve()).then(() => out).then(res, rej);
            } };
          return q;
        },
        async rpc(name, a) {
          if (name !== 'set_shared_setting') return { data: null, error: { message: 'unknown' } };
          const row = rows.get(a.p_key);
          const stamp = () => '2026-11-25T10:00:00.' + String(++clock).padStart(6, '0') + '+00:00';
          if (a.p_expect_new) {
            if (row) { db.conflicts++; return { data: { ok: false, conflict: true, updated_at: row.updated_at }, error: null }; }
          } else if (a.p_expected_updated_at) {
            if (!row || row.updated_at !== a.p_expected_updated_at) { db.conflicts++; return { data: { ok: false, conflict: true, updated_at: row && row.updated_at }, error: null }; }
          }
          const r = { value: a.p_value, updated_at: stamp() };
          rows.set(a.p_key, r); db.saves++;
          return { data: { ok: true, key: a.p_key, updated_at: r.updated_at }, error: null };
        },
      };
    },
  };
  return db;
}
const addItem = (id) => (cur) => {
  const items = (cur && Array.isArray(cur.items)) ? cur.items.slice() : [];
  if (items.some(x => x.id === id)) return null;
  items.push({ id });
  return { items };
};

test('two devices add to the same list at the same moment: both additions are kept', async () => {
  const db = fakeDb();
  db.rows.set('handoffs_handled', { value: { items: [{ id: 'a' }] }, updated_at: '2026-11-25T09:00:00.000000+00:00' });
  db.holdReadsUntil(2);   // both devices have read the same version before either saves
  const phone = SS.createStore({ client: db.client(), enabled: true });
  const mac = SS.createStore({ client: db.client(), enabled: true });
  const [p, m] = await Promise.all([phone.mergeSave('handoffs_handled', addItem('b'), 'owner_admin'), mac.mergeSave('handoffs_handled', addItem('c'), 'owner_admin')]);
  expect(p.ok && m.ok).toBe(true);
  expect(db.conflicts).toBe(1);                    // one of them had to read again
  expect(db.rows.get('handoffs_handled').value.items.map(x => x.id).sort()).toEqual(['a', 'b', 'c']);
});

test('the old way (save whatever this device has) would have lost one: the check is what keeps it', async () => {
  const db = fakeDb();
  db.rows.set('handoffs_handled', { value: { items: [{ id: 'a' }] }, updated_at: '2026-11-25T09:00:00.000000+00:00' });
  const phone = SS.createStore({ client: db.client(), enabled: true });
  const mac = SS.createStore({ client: db.client(), enabled: true });
  const pv = (await phone.get('handoffs_handled')).value, mv = (await mac.get('handoffs_handled')).value;
  await phone.set('handoffs_handled', addItem('b')(pv), 'owner_admin');   // no version: replaces
  await mac.set('handoffs_handled', addItem('c')(mv), 'owner_admin');
  expect(db.rows.get('handoffs_handled').value.items.map(x => x.id).sort()).toEqual(['a', 'c']);   // b is gone
});

test('a list nobody saved yet: two devices start it at once, both items kept', async () => {
  const db = fakeDb();
  db.holdReadsUntil(2);
  const a = SS.createStore({ client: db.client(), enabled: true }), b = SS.createStore({ client: db.client(), enabled: true });
  const r = await Promise.all([a.mergeSave('launch_list', addItem('x'), 'owner_admin'), b.mergeSave('launch_list', addItem('y'), 'owner_admin')]);
  expect(r.every(x => x.ok)).toBe(true);
  expect(db.rows.get('launch_list').value.items.map(x => x.id).sort()).toEqual(['x', 'y']);
});

test('nothing new to add: no save at all; a failed save says so instead of pretending', async () => {
  const db = fakeDb();
  db.rows.set('k1', { value: { items: [{ id: 'a' }] }, updated_at: 't0' });
  const s = SS.createStore({ client: db.client(), enabled: true });
  const r = await s.mergeSave('k1', addItem('a'), 'owner_admin');
  expect(r.ok && r.unchanged).toBe(true);
  expect(db.saves).toBe(0);
  // the database keeps changing under it: after three tries it gives up honestly
  const busy = fakeDb();
  busy.rows.set('k2', { value: { items: [] }, updated_at: 't0' });
  const c = busy.client(), rpc = c.rpc;
  c.rpc = async (n, a) => { busy.rows.get('k2').updated_at = 't' + Math.random(); return rpc(n, a); };
  const r2 = await SS.createStore({ client: c, enabled: true }).mergeSave('k2', addItem('z'), 'owner_admin');
  expect(r2.ok).toBe(false);
  expect(r2.message).toMatch(/Not saved: others kept saving at the same moment/);
  // not installed: says so, nothing sent
  const off = await SS.createStore({ client: db.client(), enabled: false }).mergeSave('k1', addItem('q'), 'owner_admin');
  expect(off.ok).toBe(false);
  expect(off.notInstalled).toBe(true);
});
