// Sales & Growth: lead import + duplicate graph (assets/sales/he-sales-import.js).
const { test, expect } = require('@playwright/test');
const I = require('../../assets/sales/he-sales-import.js');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

test('normalizers handle names, domains, emails, phones', () => {
  expect(I.normalizeName('The Blue Harbor Boutique, LLC')).toBe('blue harbor');
  expect(I.normalizeDomain('https://www.BlueHarbor.com/shop?x=1')).toBe('blueharbor.com');
  expect(I.normalizeDomain('buyer@BlueHarbor.com')).toBe('blueharbor.com');
  expect(I.normalizeEmail('  Buyer@BlueHarbor.com ')).toBe('buyer@blueharbor.com');
  expect(I.normalizeEmail('nope')).toBe('');
  expect(I.normalizePhone('(415) 555-0100')).toBe('4155550100');
});

test('prepareRow preserves raw values and lists problems without inventing data', () => {
  const p = I.prepareRow({ storeName: 'Aqua Spa', website: 'not a url', source: 'manual' });
  expect(p.raw.storeName).toBe('Aqua Spa');
  expect(p.problems).toContain('website is malformed');
  const bad = I.prepareRow({ email: 'x@y', source: '' });
  expect(bad.problems).toEqual(expect.arrayContaining(['missing business name', 'email is malformed', 'missing source provenance']));
});

test('duplicate graph flags likely matches (email, domain, phone, name+city) and never merges', () => {
  const rows = [
    { storeName: 'Blue Harbor', email: 'buyer@blueharbor.com', city: 'Austin', source: 'web' },
    { storeName: 'Blue Harbor Apothecary', website: 'blueharbor.com', city: 'Austin', source: 'web' }, // same domain
    { storeName: 'Totally Different', email: 'hi@other.com', city: 'Reno', source: 'web' },
    { storeName: 'Blue  Harbor', phone: '415-555-0100', city: 'Austin', source: 'web' },               // same name+city
    { storeName: 'X', phone: '(415) 555-0100', city: 'Reno', source: 'web' },                          // same phone as row 3(idx3)
  ];
  const prepared = rows.map(I.prepareRow);
  const clusters = I.duplicateGraph(prepared);
  // rows 0,1,3,4 all connect (domain/name+city/phone); row 2 stands alone.
  const big = clusters.find(c => c.members.length >= 3);
  expect(big).toBeTruthy();
  expect(big.members).not.toContain(2);
  expect(big.reasons.length).toBeGreaterThan(0);
});

test('importPreview requires confirmation and counts warnings', () => {
  const pv = I.importPreview([{ storeName: 'A', email: 'a@a.com', source: 'web' }, { storeName: '', source: '' }]);
  expect(pv.count).toBe(2);
  expect(pv.needsConfirmation).toBe(true);
  expect(pv.warnings).toBeGreaterThan(0);
});

test('empty import is safe', () => {
  expect(I.importPreview([])).toMatchObject({ count: 0, warnings: 0 });
  expect(I.importPreview()).toMatchObject({ count: 0 });
});
