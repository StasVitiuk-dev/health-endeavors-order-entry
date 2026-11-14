// #65 Saved views & filters. Pure, Node-only, synthetic. Personal, isolated
// per user, persisted via a storage adapter, with restore / reset / default /
// rename / delete and graceful degradation when storage is unavailable.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const V = require('../../assets/views/he-saved-views.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

// A localStorage-like in-memory adapter.
function mem() { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; }

test('a saved view persists and restores the exact filter set for its screen', () => {
  const s = mem();
  const store = V.createViewStore({ storage: s, userId: 'u1', panel: 'ordersPanel' });
  expect(store.save('Unfulfilled wholesale', { status: 'unfulfilled', channel: 'wholesale' }, '2026-11-14').ok).toBe(true);
  // A fresh store over the same storage + user sees it (survives reload).
  const reopened = V.createViewStore({ storage: s, userId: 'u1', panel: 'ordersPanel' });
  expect(reopened.list().map(v => v.name)).toEqual(['Unfulfilled wholesale']);
  expect(reopened.restore('Unfulfilled wholesale')).toEqual({ status: 'unfulfilled', channel: 'wholesale' });
  expect(reopened.restore('nope')).toBeNull();
});

test('views are personal: one user never sees another user\'s views (permission by namespace)', () => {
  const s = mem();
  V.createViewStore({ storage: s, userId: 'alice', panel: 'ordersPanel' }).save('A', { x: 1 });
  const bob = V.createViewStore({ storage: s, userId: 'bob', panel: 'ordersPanel' });
  expect(bob.list()).toEqual([]);
  expect(bob.restore('A')).toBeNull();
});

test('views are per-screen: Orders / Wholesale / Inventory do not cross', () => {
  const s = mem();
  V.createViewStore({ storage: s, userId: 'u', panel: 'ordersPanel' }).save('O', { a: 1 });
  const inv = V.createViewStore({ storage: s, userId: 'u', panel: 'inventoryPanel' });
  expect(inv.list()).toEqual([]);
  expect(V.VIEW_PANELS).toEqual(expect.arrayContaining(['ordersPanel', 'wholesalePanel', 'inventoryPanel']));
  expect(() => V.createViewStore({ storage: s, userId: 'u', panel: 'reportsPanel' })).toThrow(/unknown view panel/);
});

test('reset clears the current selection but keeps saved views; clearAll deletes them', () => {
  const s = mem();
  const store = V.createViewStore({ storage: s, userId: 'u', panel: 'inventoryPanel' });
  store.save('Low stock', { bucket: 'low' });
  expect(store.reset()).toEqual({});          // empty filter set, nothing deleted
  expect(store.list()).toHaveLength(1);
  expect(store.clearAll().ok).toBe(true);
  expect(store.list()).toHaveLength(0);
});

test('default view: set, read, follows a rename, clears on delete', () => {
  const s = mem();
  const store = V.createViewStore({ storage: s, userId: 'u', panel: 'wholesalePanel' });
  store.save('Net-14 buyers', { terms: 'net14' });
  expect(store.setDefault('Net-14 buyers').ok).toBe(true);
  expect(store.getDefault().filters).toEqual({ terms: 'net14' });
  expect(store.rename('Net-14 buyers', 'Credit buyers').ok).toBe(true);
  expect(store.getDefault().name).toBe('Credit buyers');
  expect(store.remove('Credit buyers').ok).toBe(true);
  expect(store.getDefault()).toBeNull();
});

test('overwrite by name, a per-screen cap, and input validation', () => {
  const s = mem();
  const store = V.createViewStore({ storage: s, userId: 'u', panel: 'ordersPanel', cap: 2 });
  store.save('V', { a: 1 });
  store.save('V', { a: 2 });                   // same name overwrites, not duplicates
  expect(store.list()).toHaveLength(1);
  expect(store.restore('V')).toEqual({ a: 2 });
  store.save('W', { b: 1 });
  const over = store.save('X', { c: 1 });      // cap is 2
  expect(over.ok).toBe(false);
  expect(over.reason).toMatch(/limit reached/);
  expect(store.save('', { a: 1 }).reason).toMatch(/needs a name/);
  expect(store.save('Y', [1, 2]).reason).toMatch(/must be an object/);
});

test('storage unavailable (private window / blocked) never throws and the screen still works', () => {
  const store = V.createViewStore({ storage: null, userId: 'u', panel: 'ordersPanel' });
  expect(store.available).toBe(false);
  const r = store.save('V', { a: 1 });
  expect(r.ok).toBe(false);
  expect(r.persisted).toBe(false);
  expect(r.reason).toMatch(/storage unavailable/);
  // reads degrade to empty, not an error.
  expect(store.list()).toEqual([]);
  expect(store.restore('V')).toBeNull();
  expect(store.reset()).toEqual({});
});

test('a storage adapter that throws is tolerated (quota / disabled cookies)', () => {
  const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('blocked'); } };
  const store = V.createViewStore({ storage: throwing, userId: 'u', panel: 'ordersPanel' });
  expect(() => store.list()).not.toThrow();
  expect(store.list()).toEqual([]);
  expect(store.save('V', { a: 1 }).ok).toBe(false);
});
