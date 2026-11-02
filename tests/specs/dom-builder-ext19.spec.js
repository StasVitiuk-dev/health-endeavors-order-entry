// EXT19: the safe element builder h() and the SVG icon builder in assets/app/he-ui.js.
// The real module file is loaded into an empty page with a stub registry, so these
// tests run the shipped code itself. Then the converted sidebar is checked in the
// signed-in dashboard with hostile record text.
const fs = require('fs');
const path = require('path');
const { test, expect, login } = require('../helpers/dashboard');
const ROOT = path.join(__dirname, '..', '..');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'builder logic; once'); });

async function loadUi(page, iconPaths) {
  await page.goto('/owner-login.html'); // same origin; the page itself is not used
  const src = fs.readFileSync(path.join(ROOT, 'assets/app/he-ui.js'), 'utf8');
  return page.evaluate(({ src, iconPaths }) => {
    const reg = {};
    const HE = { modules: { define: (name, meta, f) => { reg[name] = f; } } };
    new Function('window', 'HE', src.replace(/window\.HE\.modules/g, 'HE.modules'))(window, HE); // eslint-disable-line no-new-func
    const ui = reg['he-ui']({ EMPTY_ICONS: {}, HELP: [], ICON_PATHS: iconPaths, THEME_FACE: {}, THEME_NAME: {}, THEME_ORDER: ['auto'] });
    window.__ui = ui;
    return Object.keys(ui).includes('h') && Object.keys(ui).includes('pageIconNode');
  }, { src, iconPaths });
}

// Deterministic hostile text generator (seeded).
function corpus(n, seed) {
  const parts = ['<img src=x onerror="window.__pwn=1">', '"><script>window.__pwn=1</script>', "javascript:window.__pwn=1", '<svg onload=window.__pwn=1>',
    '&lt;b&gt;', '&amp;', '‮', '\u0000', '</span><b>', "' onmouseover='window.__pwn=1", '{{constructor}}', '${1+1}', '<iframe srcdoc="x">', 'é', '🙂', ' ', '\n'];
  let s = seed;
  const r = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  return Array.from({ length: n }, () => Array.from({ length: 1 + Math.floor(r() * 5) }, () => parts[Math.floor(r() * parts.length)]).join(''));
}

test('h(): 3,000 hostile strings stay plain text and plain attribute values; nothing runs', async ({ page }) => {
  expect(await loadUi(page, {})).toBe(true);
  const strings = corpus(3000, 1901);
  const res = await page.evaluate(async strings => {
    window.__pwn = 0;
    const host = document.createElement('div'); document.body.appendChild(host);
    let bad = 0;
    for (const s of strings) {
      const el = window.__ui.h('span', { title: s, 'data-x': s, class: 'k' }, s, window.__ui.h('b', null, s));
      host.appendChild(el);
      if (el.firstChild.nodeType !== 3 || el.firstChild.data !== s || el.getAttribute('title') !== s || el.getAttribute('data-x') !== s) bad++;
      if (el.children.length !== 1 || el.children[0].tagName !== 'B' || el.children[0].children.length !== 0) bad++;
    }
    await new Promise(r => setTimeout(r, 200));
    return { bad, pwn: window.__pwn, scripts: host.querySelectorAll('script, img, svg, iframe').length };
  }, strings);
  expect(res).toEqual({ bad: 0, pwn: 0, scripts: 0 });
});

test('h(): event-handler and srcdoc attributes are refused; false/null are skipped', async ({ page }) => {
  await loadUi(page, {});
  const r = await page.evaluate(() => {
    const t = k => { try { window.__ui.h('a', { [k]: 'x' }); return 'allowed'; } catch (e) { return 'refused'; } };
    const el = window.__ui.h('button', { disabled: false, title: null, hidden: true, 'aria-expanded': 'true' }, null, false, 0);
    return { onclick: t('onclick'), ONLOAD: t('ONLOAD'), srcdoc: t('srcdoc'), href: t('href'),
      attrs: [...el.attributes].map(a => a.name + '=' + a.value).sort(), text: el.textContent };
  });
  expect(r).toEqual({ onclick: 'refused', ONLOAD: 'refused', srcdoc: 'refused', href: 'allowed', attrs: ['aria-expanded=true', 'hidden='], text: '0' });
});

test('pageIconNode(): every real icon is built as SVG shapes; anything but path/circle/rect and geometry is ignored', async ({ page }) => {
  const cfg = fs.readFileSync(path.join(ROOT, 'assets/app/he-config.js'), 'utf8');
  const block = /const ICON_PATHS = \{([\s\S]*?)\n    \};/.exec(cfg)[1];
  const real = {};
  for (const m of block.matchAll(/(\w+):\s*'([^']*)'/g)) real[m[1]] = m[2];
  const hostile = { evil: '<path d="M0 0" onload="window.__pwn=1"/><script src="x"/><image href="x"/><circle cx="1" cy="1" r="1" style="x"/>' };
  await loadUi(page, { ...real, ...hostile });
  const r = await page.evaluate(({ ids }) => {
    window.__pwn = 0;
    const out = {};
    for (const id of ids) { const svg = window.__ui.pageIconNode(id); document.body.appendChild(svg); out[id] = [...svg.children].map(c => c.tagName + ':' + [...c.attributes].map(a => a.name).sort().join(',')).join(' '); }
    return { out, pwn: window.__pwn };
  }, { ids: [...Object.keys(real), 'evil'] });
  for (const [id, markup] of Object.entries(real)) {
    const want = [...markup.matchAll(/<([a-z]+)/g)].length;
    expect(r.out[id].split(' ').filter(Boolean).length, id).toBe(want);
  }
  expect(r.out.evil).toBe('path:d circle:cx,cy,r');
  expect(r.pwn).toBe(0);
});

test('sidebar: hostile record text in search results is shown as text; page links keep icons, pins and badges', async ({ page, backend }) => {
  const evil = '<img src=x onerror="window.__pwn=1">SYNTHETIC';
  backend.tables.tasks = [{ id: 't1', title: evil, priority: 'normal', status: 'open', due_at: '2026-12-01T00:00:00Z' }];
  await login(page);
  await page.evaluate(() => { window.__pwn = 0; });
  const links = await page.locator('#sidebarGroups .sidebarLink[data-page] .pageIcon svg').count();
  expect(links).toBeGreaterThan(5);
  await page.fill('#sidebarSearch', 'synthetic');
  await expect(page.locator('#sidebarGroups .searchResultLink').first()).toBeVisible();
  const r = await page.evaluate(() => ({ pwn: window.__pwn, imgs: document.querySelectorAll('#sidebarGroups img').length,
    text: [...document.querySelectorAll('#sidebarGroups .searchResultLink')].map(a => a.textContent).join('|') }));
  expect(r.pwn).toBe(0);
  expect(r.imgs).toBe(0);
  expect(r.text).toContain(evil);
});

test('h(): child coercion contract — arrays flatten one level, Nodes pass through, numbers render, only false/null/undefined skip', async ({ page }) => {
  await loadUi(page, {});
  const r = await page.evaluate(() => {
    const h = window.__ui.h;
    // Array children are flattened one level; a nested array flattens one level
    // (its inner array becomes a text node, matching Array.prototype.flat()).
    const a = h('div', null, ['x', 'y'], h('b', null, 'z'));
    const nested = h('div', null, [['p'], 'q']);
    // Numbers (including 0, NaN, Infinity) render as text — only false/null/undefined skip.
    const nums = h('div', null, 0, NaN, Infinity, -0, '', false, null, undefined);
    // Node children are appended as-is (not copied/re-coerced).
    const node = document.createElement('i'); node.textContent = 'kept';
    const passthrough = h('div', null, node);
    return {
      flatText: a.textContent, flatKids: a.childNodes.length, hasB: a.querySelector('b') ? a.querySelector('b').textContent : null,
      nestedText: nested.textContent,
      numsText: nums.textContent, numsKids: nums.childNodes.length,
      nodeSame: passthrough.firstChild === node, nodeText: passthrough.textContent,
    };
  });
  // 'x','y' flattened + a <b>z</b>: text content "xyz", 3 child nodes (2 text + 1 element).
  expect(r.flatKids).toBe(3);
  expect(r.flatText).toBe('xyz');
  expect(r.hasB).toBe('z');
  // [['p'],'q'] flattens one level: ['p'] -> String(['p'])='p', plus 'q' -> "pq".
  expect(r.nestedText).toBe('pq');
  // 0, NaN, Infinity, -0, '' render (6 text nodes); false/null/undefined skipped.
  expect(r.numsKids).toBe(5);
  expect(r.numsText).toBe('0NaNInfinity0');
  // Node children are the exact same object, appended once.
  expect(r.nodeSame).toBe(true);
  expect(r.nodeText).toBe('kept');
});
