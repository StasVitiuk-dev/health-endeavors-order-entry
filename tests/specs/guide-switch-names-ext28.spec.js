// The owner turns switches on by their name, from the guides. Every switch a guide names in bold
// ("turn on **X**", "the preview switch **X**", "**X** switch") must be a switch the dashboard or a
// database step really shows by that name (Nov 28). Runs once, in Node, no browser.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

// production's own switches (not created by a draft; the label as Feature Flags shows it)
const PRODUCTION_OWN = ['Shopify Order Sync'];
// bold words next to "switch" that are not a switch's name
const NOT_A_NAME = ['one', 'off', 'on'];

function knownNames() {
  const names = new Set(PRODUCTION_OWN);
  for (const f of ['assets/app/he-config.js', 'assets/views/he-record-switches.js'])
    for (const m of read(f).matchAll(/\{ key: '\w+',(?: launch: true,)? name: '([^']+)'/g)) names.add(m[1]);
  const D = 'docs/ops/sql/drafts';
  for (const f of fs.readdirSync(path.join(ROOT, D)).filter(x => /_DRAFT_/.test(x) && !/rollback/i.test(x))) {
    for (const st of read(D + '/' + f).matchAll(/insert into public\.feature_flags[\s\S]*?;/gi))
      for (const q of st[0].matchAll(/'([^']{3,60})'/g)) names.add(q[1]);
  }
  return names;
}

function namedInGuides(files) {
  const out = [];
  for (const f of files) {
    const t = read(f);
    for (const re of [/turn on (?:the )?(?:preview )?(?:switch )?\*\*([^*]+)\*\*/gi, /(?:preview )?switch \*\*([^*]+)\*\*/gi, /\*\*([^*]+)\*\* (?:preview )?switch\b/gi])
      for (const m of t.matchAll(re)) if (!NOT_A_NAME.includes(m[1].toLowerCase()) && !/[:.]$|^PROPOSED|^No switch/.test(m[1]) && m[1].split(/\s+/).length <= 6) out.push({ file: f, name: m[1] });
  }
  return out;
}

const guides = () => ['docs/ops', 'docs/ops/sql-review'].flatMap(d => fs.readdirSync(path.join(ROOT, d)).filter(f => /\.md$/.test(f)).map(f => d + '/' + f));

test('every switch a guide tells the owner to turn on exists by that exact name', () => {
  const names = knownNames();
  expect(names.has('Ready to launch') && names.has('Request keys on new records') && names.has('Stock: all-or-nothing receive')).toBe(true);
  const named = namedInGuides(guides());
  expect(named.length).toBeGreaterThanOrEqual(8);   // the check really reads the guides
  expect(named.filter(n => !names.has(n.name)).map(n => n.file + ': **' + n.name + '**')).toEqual([]);
});

test('a guide naming a switch that does not exist is caught (planted)', () => {
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'he-guide-'));
  const rel = path.relative(ROOT, path.join(dir, 'X.md'));
  fs.writeFileSync(path.join(dir, 'X.md'), 'Then turn on **Request keys** and the preview switch **Reviews**.');
  try {
    const named = namedInGuides([rel]);
    expect(named.map(n => n.name)).toEqual(['Request keys', 'Reviews']);
    expect(named.filter(n => !knownNames().has(n.name)).map(n => n.name)).toEqual(['Request keys']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
