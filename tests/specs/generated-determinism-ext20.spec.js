// EXT20J Reserve VIII: generated-artifact determinism + freshness.
// The repository ships machine-generated docs (the application module map, the
// write-path matrix / inventory). If a generator's output depended on hash /
// Set-iteration order, Date.now, or Math.random, re-running it would produce a
// different file and the "freshness" guards would flap — and a reviewer could
// never trust that a generated file matches its source. This spec proves:
//   * each generator is DETERMINISTIC — called twice on the same source it
//     returns byte-identical output;
//   * the COMMITTED generated file matches a fresh regeneration (freshness).
// write-path-inventory.spec.js already guards write-path freshness; the module
// map had no such test, and determinism was never asserted for any of them.
// Pure Node (read-only): reads the source and the committed docs, writes nothing.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const ROOT = path.join(__dirname, '..', '..');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

const mm = require('../tools/module-map');
const wp = require('../tools/write-paths');

function loadClasses() {
  const p = path.join(ROOT, 'docs', 'ops', 'write-paths.classification.json');
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
}

test('module map: render() is deterministic (byte-identical across runs)', () => {
  expect(mm.render()).toBe(mm.render());
});

test('module map: the committed generated section is fresh (matches render())', () => {
  const doc = fs.readFileSync(mm.DOC, 'utf8');
  const start = doc.indexOf(mm.BEGIN);
  const end = doc.indexOf(mm.END);
  expect(start, 'BEGIN marker present').toBeGreaterThan(-1);
  expect(end, 'END marker present').toBeGreaterThan(start);
  // render() includes the markers; the CLI writes prefix + render() + suffix.
  const regenerated = doc.slice(0, start) + mm.render() + doc.slice(end + mm.END.length);
  expect(regenerated, 'run `node tests/tools/module-map.js --write` to refresh').toBe(doc);
});

test('write-path matrix: markdown() is deterministic', () => {
  const classes = loadClasses();
  const a = wp.markdown(wp.all(), classes);
  const b = wp.markdown(wp.all(), classes);
  expect(a).toBe(b);
});

test('write-path inventory: inventoryMarkdown() and inventoryJson() are deterministic', () => {
  const classes = loadClasses();
  const jsonA = JSON.stringify(wp.inventoryJson(wp.all(), classes));
  const jsonB = JSON.stringify(wp.inventoryJson(wp.all(), classes));
  expect(jsonA).toBe(jsonB);
  const mdA = wp.inventoryMarkdown(wp.inventoryJson(wp.all(), classes));
  const mdB = wp.inventoryMarkdown(wp.inventoryJson(wp.all(), classes));
  expect(mdA).toBe(mdB);
});

test('write-path matrix: the committed file matches a fresh regeneration', () => {
  const classes = loadClasses();
  const committed = fs.readFileSync(path.join(ROOT, 'docs', 'ops', 'WRITE_PATH_MATRIX.md'), 'utf8');
  expect(committed, 'run `node tests/tools/write-paths.js --md` to refresh').toBe(wp.markdown(wp.all(), classes));
});

test('mutation write-path inventory JSON: the committed file matches a fresh regeneration', () => {
  const classes = loadClasses();
  const committed = fs.readFileSync(path.join(ROOT, 'docs', 'ops', 'MUTATION_WRITE_PATH_INVENTORY.json'), 'utf8');
  const fresh = JSON.stringify(wp.inventoryJson(wp.all(), classes), null, 1) + '\n';
  expect(committed, 'run `node tests/tools/write-paths.js --json` to refresh').toBe(fresh);
});
