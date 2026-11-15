// Very long text on EVERY page (Nov 15). The earlier sweep covered the seven
// operations pages; this one visits every page in the sidebar with a
// 50,000-character value in each free-text column of each table (26 tables),
// at phone and computer size. A page must stay fast, must not scroll sideways,
// and no single box may grow to many screens of one text. Also: a very long
// account name must not push the page header (and with it the page) sideways.
// Synthetic data; saved values are never changed by the page.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { seedBusiness } = require('../fixtures/business-data');
const { FREE_TEXT, seedEveryPage } = require('../fixtures/every-page-rows');

const HUGE = 'SYNTHETIC ' + 'W'.repeat(50000);

test('every page stays fast, narrow and compact with 50,000-character text in every free-text column', async ({ page, backend }, ti) => {
  test.setTimeout(300000);
  seedBusiness(backend);
  seedEveryPage(backend);
  let fields = 0;
  for (const [name, cols] of Object.entries(FREE_TEXT)) {
    const first = (backend.tables[name] || [])[0];
    if (!first) continue;
    for (const k of cols) { first[k] = HUGE; fields++; }
  }
  expect(fields).toBeGreaterThanOrEqual(45);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
  await login(page);
  const ids = await page.locator('#sidebarGroups .sidebarLink[data-page]').evaluateAll(els => [...new Set(els.map(e => e.getAttribute('data-page')))]);
  expect(ids.length).toBeGreaterThanOrEqual(20);
  const slow = [], wide = [], tall = [], seen = [];
  for (const p of ids) {
    const t0 = Date.now();
    await gotoPage(page, p);
    await page.waitForLoadState('networkidle');
    const ms = Date.now() - t0;
    if (ms > 5000) slow.push(p + ' ' + ms + ' ms');
    const m = await page.evaluate(pid => {
      const sec = document.getElementById(pid);
      let worst = 0, what = '', shown = 0;
      sec.querySelectorAll('*').forEach(el => {
        // A box that holds one long text itself (not a wrapper around many rows).
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.data).join('');
        if (own.length < 500) return;
        const h = el.getBoundingClientRect().height; if (!h) return;
        shown++;
        if (h > worst) { worst = h; what = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className ? '.' + String(el.className).split(' ')[0] : ''); }
      });
      return { worst: Math.round(worst), what, shown, side: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth };
    }, p);
    if (m.side > 1) wide.push(p + ' scrolls sideways by ' + m.side + ' px');
    if (m.worst > 2500) tall.push(p + ' ' + m.what + ' ' + m.worst + ' px');
    if (m.shown) seen.push(p);
    if (process.env.HE_SWEEP_LOG) console.log(`SWEEP[${ti.project.name}] ${p} ${ms}ms boxes=${m.shown} worst=${m.worst} ${m.what} side=${m.side}`);
  }
  expect(errors, ti.project.name).toEqual([]);
  expect(slow, ti.project.name).toEqual([]);
  expect(wide, ti.project.name).toEqual([]);
  expect(tall, ti.project.name).toEqual([]);
  // The sweep really did put long text on screen on many pages.
  expect(seen.length, 'pages that showed long text: ' + seen.join(', ')).toBeGreaterThanOrEqual(12);
});

test('a very long account name is cut in the header and does not push the page sideways', async ({ page, backend }, ti) => {
  const NAME = 'Synthetic Owner ' + 'W'.repeat(50000);
  backend.tables.profiles[0].display_name = NAME;
  await login(page);
  expect(await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth)).toBeLessThanOrEqual(1);
  const who = page.locator('#whoAmI');
  const text = await who.textContent();
  expect(text).toBe(NAME.slice(0, 79) + '… — role: owner');
  expect(await who.getAttribute('title')).toBe(text);
  if (ti.project.name === 'desktop') {
    // One line, inside the header, with the buttons beside it still on screen.
    const r = await page.evaluate(() => {
      const w = document.getElementById('whoAmI').getBoundingClientRect();
      const out = document.getElementById('signout').getBoundingClientRect();
      return { w: w.width, h: w.height, signOutRight: out.right, vw: innerWidth };
    });
    expect(r.w).toBeLessThanOrEqual(r.vw * 0.38 + 1);
    expect(r.h).toBeLessThan(30);
    expect(r.signOutRight).toBeLessThanOrEqual(r.vw);
  }
});

test('an ordinary account name is shown whole', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'the name is hidden at phone size');
  await login(page);
  const who = page.locator('#whoAmI');
  await expect(who).toHaveText('Synthetic Owner — role: owner');
  expect(await who.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);   // nothing cut off
});
