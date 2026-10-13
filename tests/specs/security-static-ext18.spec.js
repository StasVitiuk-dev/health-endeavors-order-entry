// EXT18: the two static security gates and proof that each one fires.
//   tests/tools/static-security.js  dangerous code patterns, page policy, frame guard, links
//   tests/tools/dom-sinks.js --gate  HTML-building code: dangerous sinks at 0, every
//                                    unescaped-looking value reviewed with a reason
// Node only (no browser).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { test, expect } = require('@playwright/test');
const ROOT = path.join(__dirname, '..', '..');
const { checkJs, checkHtml, run } = require('../tools/static-security');
const sinks = require('../tools/dom-sinks');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only checks; once'); });

test('static security check passes on every shipped page and script', () => {
  const r = run();
  expect(r.findings).toEqual([]);
  expect(r.html).toBeGreaterThanOrEqual(6);
  expect(r.js).toBeGreaterThanOrEqual(20);
});

test('static check fires on each planted dangerous pattern, and not on harmless text', () => {
  const planted = {
    eval: 'eval(x)', newFunction: 'new Function("a", b)', Function: 'Function(b)()', documentWrite: 'document.write(x)',
    timeoutString: 'setTimeout("go()", 5)', scriptElement: 'document.createElement("script")',
    handlerAttr: 'el.setAttribute("onclick", x)', messageListener: 'window.addEventListener("message", f)',
    openNoOpener: 'window.open(u, "_blank")', computedNav: 'location.href = u', computedAssign: 'window.location.assign(u)',
    handlerInMarkup: 'el.innerHTML = `<img src=x onerror="${a}">`', jsLink: 'h = "<a href=\\"javascript:x()\\">"',
    blankNoOpener: 'h = "<a href=x target=\\"_blank\\">y</a>"', srcdoc: 'f.srcdoc = x', outerHTML: 'e.outerHTML = x',
  };
  for (const [k, src] of Object.entries(planted)) expect(checkJs(src, 't.js').length, k).toBe(1);
  expect(checkJs('// eval(x) in a comment\nshow("links starting with javascript: run code"); setTimeout(fn, 5); location.href = "./"; window.open(u, "_blank", "noopener,noreferrer")', 't.js')).toEqual([]);
});

test('page check fires on each planted policy or markup weakening', () => {
  const page = fs.readFileSync(path.join(ROOT, 'owner-login.html'), 'utf8');
  expect(checkHtml(page, 'owner-login.html')).toEqual([]);
  const planted = {
    wholeCdnHost: p => p.replace(/https:\/\/cdn\.jsdelivr\.net\/npm[^;]*supabase\.js;/, 'https://cdn.jsdelivr.net;'),
    inlineHandler: p => p.replace('<title>', '<title onclick="x">'),
    noFrameGuard: p => p.replace(/<script id="frameGuard">.*?<\/script>/, ''),
    noIntegrity: p => p.replace(/ integrity="[^"]*"/, ''),
    unsafeInline: p => p.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'"),
    noObjectSrc: p => p.replace("object-src 'none'; ", ''),
    referrer: p => p.replace('content="no-referrer"', 'content="origin"'),
    iframe: p => p.replace('</body>', '<iframe src="x"></iframe></body>'),
    namedPassword: p => p.replace('id="password"', 'id="password" name="password"'),
    getForm: p => p.replace('<form id="loginForm">', '<form id="loginForm" method="get">'),
    foreignForm: p => p.replace('<form id="loginForm">', '<form id="loginForm" action="https://evil.example/">'),
  };
  for (const [k, f] of Object.entries(planted)) {
    const m = f(page);
    expect(m, k + ': mutation did not apply').not.toBe(page);
    expect(checkHtml(m, 'p.html').length, k).toBeGreaterThan(0);
  }
});

test('DOM sink gate passes, and fails on a new unreviewed value, a dangerous sink or a raised ceiling', () => {
  const out = execFileSync('node', [path.join(ROOT, 'tests/tools/dom-sinks.js'), '--gate'], { encoding: 'utf8' });
  expect(out).toContain('DOM SINK GATE: PASS');
  const real = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
  const target = 'assets/app/he-tasks.js';
  const plant = extra => sinks.gate(sinks.audit(sinks.FILES, f => f === target ? real(f) + '\n' + extra : real(f)));
  expect(plant('')).toEqual([]);
  expect(plant('function zz(t){ document.body.innerHTML = `<b>${t.title}</b>`; }').join('\n')).toMatch(/UNREVIEWED interpolation.*t\.title/);
  expect(plant('function zz(t){ document.body.innerHTML = `<b>${esc(t.title)}</b>`; }').some(x => /UNREVIEWED/.test(x))).toBe(false);
  expect(plant('function zz(t){ document.body.insertAdjacentHTML("beforeend", t); }').join('\n')).toMatch(/insertAdjacentHTML = 1/);
  expect(plant('function zz(t){ eval(t); }').join('\n')).toMatch(/evalLike = 1/);
  // a reviewed value used one more time than reviewed
  expect(plant('function zz(){ document.body.innerHTML = `<i>${cutoffNote}</i>`; }').join('\n')).toMatch(/cutoffNote.*appears 2 times, 1 reviewed/);
  // the reviewed list must stay honest: a stale entry and an entry without a reason both fail
  const list = JSON.parse(real('tests/tools/dom-sinks-reviewed.json'));
  const r = sinks.audit();
  expect(sinks.gate(r, { ...list, interpolations: [...list.interpolations, { file: target, expr: 'gone', count: 1, reason: 'no longer in the code' }] }).join('\n')).toMatch(/stale reviewed entry/);
  expect(sinks.gate(r, { ...list, interpolations: list.interpolations.map((e, i) => i ? e : { ...e, reason: '' }) }).join('\n')).toMatch(/without a reason/);
  expect(sinks.gate(r, { ...list, ceilings: { ...list.ceilings, innerHTML: r.counts.innerHTML - 1 } }).join('\n')).toMatch(/above the ceiling/);
});
