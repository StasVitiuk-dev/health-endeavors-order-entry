// Sales & Growth — safe CSV export (items 81/133/134). Formula-injection guard
// + field minimization (sensitive/not-needed dropped; personal opt-in only).
const { test, expect } = require('@playwright/test');
const EX = require('../../assets/sales/he-sales-export.js');
const PRIV = require('../../assets/sales/he-sales-privacy.js');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

test('formula-injection cells are neutralized', () => {
  expect(EX.cell('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
  expect(EX.cell('+1')).toBe("'+1");
  expect(EX.cell('-2')).toBe("'-2");
  expect(EX.cell('@cmd')).toBe("'@cmd");
  expect(EX.cell('safe')).toBe('safe');
  expect(EX.cell('a,b')).toBe('"a,b"');          // quoted
  expect(EX.cell('she said "hi"')).toBe('"she said ""hi"""');
});

test('sensitive and not-needed fields are never exported; personal is opt-in', () => {
  const rows = [{ id: '1', storeName: 'Cedar', email: 'a@b.example.com', apiKey: 'sk-1', _scratch: 'x' }];
  const def = EX.toCsv(rows, PRIV.classifyField);
  expect(def.fields).toContain('storeName');
  expect(def.fields).not.toContain('apiKey');    // SENSITIVE dropped
  expect(def.fields).not.toContain('_scratch');  // NOT_NEEDED dropped
  expect(def.fields).not.toContain('email');     // PERSONAL dropped by default
  const withPersonal = EX.toCsv(rows, PRIV.classifyField, { includePersonal: true });
  expect(withPersonal.fields).toContain('email');
  expect(withPersonal.fields).not.toContain('apiKey'); // still never
});

test('toCsv produces RFC-4180 rows and reports what was dropped', () => {
  const rows = [{ storeName: 'A, Inc', note: '=HACK()' }, { storeName: 'B', note: 'ok' }];
  const out = EX.toCsv(rows, () => 'BUSINESS');
  const lines = out.csv.split('\r\n');
  expect(lines[0]).toBe('storeName,note');
  expect(lines[1]).toBe('"A, Inc",\'=HACK()');
  expect(out.rows).toBe(2);
  expect(out.guard).toMatch(/formula-injection-safe/i);
});

test('field selection restricts and orders columns', () => {
  const rows = [{ a: 1, b: 2, c: 3 }];
  const out = EX.toCsv(rows, () => 'BUSINESS', { fields: ['c', 'a'] });
  expect(out.csv.split('\r\n')[0]).toBe('c,a');
});
