// EXT20J-post-TT: the calendar colour bug shipped because JavaScript residue
// (`background:' + colorForCalendar(x) + ' !important`) leaked into the CSS
// during the EXT15 inline-style -> class conversion. Invalid CSS is dropped
// silently by the browser, so nothing caught it. tests/tools/css-lint.js scans
// every dashboard stylesheet for that class of defect; this spec proves the
// current files are clean AND that the scanner actually catches the defect.
const { test, expect } = require('@playwright/test');
const css = require('../tools/css-lint');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

test('every dashboard stylesheet is free of JavaScript residue and brace imbalance', () => {
  const findings = css.scanAll();
  expect(findings, findings.map(f => `${f.file}:${f.line} ${f.kind}`).join('\n')).toEqual([]);
});

test('the scanner catches the calendar-bug class: string concatenation leaked into a value', () => {
  const bad = ".calChip .cDot{background:' + colorForCalendar(ev.calendar_name) + ' !important}\n";
  const f = css.scan(bad, 'planted.css');
  expect(f.some(x => /concatenation/.test(x.kind))).toBe(true);
});

test('the scanner catches a leaked template-literal interpolation', () => {
  const f = css.scan('.x{color:${color}}\n', 'planted.css');
  expect(f.some(x => /template-literal/.test(x.kind))).toBe(true);
});

test('the scanner catches a leaked backtick template literal', () => {
  const f = css.scan('.x{background:`red`}\n', 'planted.css');
  expect(f.some(x => /backtick/.test(x.kind))).toBe(true);
});

test('the scanner catches unbalanced braces (a truncated or malformed rule)', () => {
  const f = css.scan('.x{color:red;\n.y{color:blue}\n', 'planted.css');
  expect(f.some(x => /unbalanced braces/.test(x.kind))).toBe(true);
});

test('the scanner does not false-positive on legitimate CSS (calc, var, nested functions)', () => {
  const legit = '.a{width:calc(100% - 10px)}\n.b{background:var(--panel-2)}\n.c{grid-template-columns:repeat(3, minmax(0, 1fr))}\n.e{color:rgb(1, 2, 3)}\n';
  expect(css.scan(legit, 'ok.css')).toEqual([]);
});
