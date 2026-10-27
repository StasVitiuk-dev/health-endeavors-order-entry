// EXT14 screenshot policy (docs/ops/SCREENSHOT_POLICY_EXT14.md), checked:
//   * no two screenshots in design-review/ are byte-identical (an unchanged
//     screen is referenced, not stored again)
//   * every package has a MANIFEST.md that lists each of its PNG files, and
//     every file the manifest lists still exists (or is marked removed)
//   * no single screenshot is larger than 1.5 MB
// Node-only.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const DR = path.join(__dirname, '..', '..', 'design-review');
test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });
const packages = fs.readdirSync(DR, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name);
const pngs = pkg => fs.readdirSync(path.join(DR, pkg)).filter(f => f.endsWith('.png'));

test('no byte-identical duplicate screenshots', () => {
  const seen = new Map(), dups = [];
  for (const p of packages) for (const f of pngs(p)) {
    const h = crypto.createHash('sha256').update(fs.readFileSync(path.join(DR, p, f))).digest('hex');
    if (seen.has(h)) dups.push(`${p}/${f} = ${seen.get(h)}`); else seen.set(h, `${p}/${f}`);
  }
  expect(dups).toEqual([]);
});

test('every package manifest lists exactly its files', () => {
  expect(packages.length).toBeGreaterThan(3);
  for (const p of packages) {
    const man = fs.readFileSync(path.join(DR, p, 'MANIFEST.md'), 'utf8');
    for (const f of pngs(p)) expect(man, `${p}/MANIFEST.md lists ${f}`).toContain('`' + f + '`');
    for (const m of man.matchAll(/^\| `([^`]+\.png)`/gm)) expect(fs.existsSync(path.join(DR, p, m[1])), `${p}/${m[1]} listed but missing`).toBe(true);
    for (const m of man.matchAll(/~~`([^`]+\.png)`~~ removed in EXT14: byte-identical to `\.\.\/([^`]+)`/g)) {
      expect(fs.existsSync(path.join(DR, p, m[1])), m[1]).toBe(false);
      expect(fs.existsSync(path.join(DR, m[2])), `replacement ${m[2]} exists`).toBe(true);
    }
  }
});

test('no screenshot over 1.5 MB', () => {
  for (const p of packages) for (const f of pngs(p)) expect(fs.statSync(path.join(DR, p, f)).size, `${p}/${f}`).toBeLessThan(1.5 * 1024 * 1024);
});
