// Reserve IV — WAVE 1: per-page accessibility depth for the 42 Sales & Growth
// pages, with the feature flag ON. The broad a11y specs (a11y-basics,
// a11y-ext8) only ever see the flag-OFF dashboard, so the sales pages get no
// a11y coverage there. This spec drives EVERY sales page and checks, in ONE
// parameterized pass per concern (not 42 copy-pasted specs):
//   - every visible control has an accessible name a screen reader announces;
//   - element ids stay globally unique with the whole subsystem rendered;
//   - every page has a visible heading and no data table lacks column headers;
//   - text meets WCAG AA contrast in light AND dark themes;
//   - at 320 px with text at 200 %, no page scrolls sideways (mobile);
//   - visible buttons are at least a 24 px tap target on a phone.
// Everything is synthetic and read-only; nothing is sent, saved or deployed.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { SALES_IDS, enableSalesFlag } = require('../helpers/sales-pages');

// ---- shared in-page audit functions (string-serialized into evaluate) ----

// Visible controls with no accessible name, inside the given root.
function unnamedControls(root) {
  const visible = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const labelFor = el => el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
  const name = el => (el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('placeholder') || el.textContent || el.value || (labelFor(el) && labelFor(el).textContent) || (el.closest('label') && el.closest('label').textContent) || el.getAttribute('aria-labelledby') || '').trim();
  const out = [];
  root.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button]').forEach(el => {
    if (!visible(el)) return;
    if (el.tagName === 'SELECT') { if (!name(el) && !(el.options[0] && el.options[0].textContent.trim())) out.push(el.outerHTML.slice(0, 120)); return; }
    if (el.tagName === 'INPUT' && ['checkbox', 'radio'].includes(el.type)) { if (!name(el)) out.push(el.outerHTML.slice(0, 120)); return; }
    if (!name(el) && !el.querySelector('svg title, img[alt]:not([alt=""])')) out.push(el.outerHTML.slice(0, 120));
  });
  return out;
}

// Contrast-ratio failures (WCAG AA) for every element that has text of its own.
function contrastFailures(root) {
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const bgOf = el => {
    const layers = []; let e = el;
    while (e) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; } e = e.parentElement; }
    let baseC = layers.pop() || { r: 255, g: 255, b: 255, a: 1 };
    while (layers.length) { const t = layers.pop(); baseC = { r: t.r * t.a + baseC.r * (1 - t.a), g: t.g * t.a + baseC.g * (1 - t.a), b: t.b * t.a + baseC.b * (1 - t.a), a: 1 }; }
    return baseC;
  };
  const out = [];
  root.querySelectorAll('*').forEach(el => {
    const ownText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (!ownText || el.offsetParent === null || el.disabled) return;
    const fg = parse(getComputedStyle(el).color); if (!fg) return;
    const L1 = lum(fg), L2 = lum(bgOf(el));
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const cs = getComputedStyle(el); const size = parseFloat(cs.fontSize); const bold = Number(cs.fontWeight) >= 700;
    if (ratio < ((size >= 24 || (size >= 18.66 && bold)) ? 3 : 4.5)) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} ${ratio.toFixed(2)}`);
  });
  return out;
}

// ---- desktop: structure (names, ids, headings, table headers) ----

test('every sales page: visible controls are named, ids unique, headings and table headers present', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'markup; run once');
  test.setTimeout(240000);
  await enableSalesFlag(page);
  await login(page);
  const problems = [];
  for (const id of SALES_IDS) {
    await gotoPage(page, id);
    await expect(page.locator(`#${id} .salesPage`)).toHaveAttribute('data-state', /^(?!DISABLED).+/);
    const bad = await page.locator(`section#${id}`).evaluate(unnamedControls);
    bad.forEach(b => problems.push(`${id} unnamed: ${b}`));
    const r = await page.evaluate(pid => {
      const sec = document.getElementById(pid);
      const vis = el => el.getClientRects().length > 0;
      const heading = [...sec.querySelectorAll('h1, h2, h3, [role=heading]')].some(vis);
      const bareTables = [...sec.querySelectorAll('table')].filter(vis).filter(t => !t.querySelector('th')).length;
      return { heading, bareTables };
    }, id);
    if (!r.heading) problems.push(`${id}: no visible heading`);
    if (r.bareTables) problems.push(`${id}: ${r.bareTables} table(s) without <th>`);
  }
  // Unique ids across the whole document with every sales page rendered.
  const dupIds = await page.evaluate(() => {
    const seen = {}; document.querySelectorAll('[id]').forEach(e => { seen[e.id] = (seen[e.id] || 0) + 1; });
    return Object.entries(seen).filter(([, n]) => n > 1).map(([k, n]) => `${k} ×${n}`);
  });
  expect(problems).toEqual([]);
  expect(dupIds).toEqual([]);
});

// ---- desktop: contrast in both themes ----

for (const scheme of ['light', 'dark']) {
  test(`every sales page: text meets AA contrast (${scheme})`, async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'colours; run once');
    test.setTimeout(240000);
    await page.emulateMedia({ colorScheme: scheme });
    await enableSalesFlag(page);
    await login(page);
    const bad = new Map();
    for (const id of SALES_IDS) {
      await gotoPage(page, id);
      await expect(page.locator(`#${id} .salesPage`)).toBeVisible();
      const found = await page.locator(`section#${id}`).evaluate(contrastFailures);
      found.forEach(f => { if (!bad.has(f)) bad.set(f, `${id}: ${f}`); });
    }
    expect([...bad.values()]).toEqual([]);
  });
}

// ---- mobile: no sideways scroll at 320 px with 200 % text; tap targets ----

test.describe('phone 320 px with text at 200 %', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test('no sales page scrolls sideways', async ({ page }, ti) => {
    test.skip(ti.project.name !== 'iphone', 'small screen; run once');
    test.setTimeout(240000);
    await enableSalesFlag(page);
    await login(page);
    // style-src 'self' blocks an injected <style>; a constructed stylesheet is allowed.
    await page.evaluate(() => { const s = new CSSStyleSheet(); s.replaceSync('html { font-size: 200% !important; }'); document.adoptedStyleSheets = [...document.adoptedStyleSheets, s]; });
    const over = [];
    for (const id of SALES_IDS) {
      await gotoPage(page, id);
      await expect(page.locator(`#${id} .salesPage`)).toBeVisible();
      const x = await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth);
      if (x > 1) over.push(`${id}: ${x}px sideways`);
    }
    expect(over).toEqual([]);
  });
});

test('every sales page: visible buttons are at least a 24 px tap target (phone)', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'iphone', 'phone size only');
  test.setTimeout(240000);
  await enableSalesFlag(page);
  await login(page);
  const small = [];
  for (const id of SALES_IDS) {
    await gotoPage(page, id);
    await expect(page.locator(`#${id} .salesPage`)).toBeVisible();
    const found = await page.locator(`section#${id}`).evaluate(root => [...root.querySelectorAll('button')]
      .filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 24; })
      .map(b => `${(b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 30)} (${Math.round(b.getBoundingClientRect().height)}px)`));
    found.forEach(f => small.push(`${id}: ${f}`));
  }
  expect(small).toEqual([]);
});
