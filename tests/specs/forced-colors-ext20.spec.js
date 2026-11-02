// EXT20 — forced-colors / Windows High Contrast accessibility (closes matrix 068).
//
// Under forced-colors, the browser replaces author colours with the user's system
// colours and IGNORES box-shadow. So any focus ring built only from box-shadow, or
// any status conveyed only by background colour, disappears. These checks are
// meaningful (not a restatement of the CSS): they assert the perceivable outcome a
// keyboard / high-contrast user gets, and each has a normal-mode baseline so it
// cannot pass vacuously. Browser-EMULATED evidence only — real Windows High
// Contrast / Safari / VoiceOver remain a manual BLOCKED item.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { NOW, seedBusiness } = require('../fixtures/business-data');

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });
test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'forced-colors emulation: desktop once'); });

// A focus indicator that survives forced-colors must come from `outline`
// (box-shadow is not painted in forced-colors mode).
const outlineInfo = el => {
  const cs = getComputedStyle(el);
  return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) || 0, shadow: cs.boxShadow };
};

test('keyboard focus stays visible under forced-colors on the sign-in fields', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/owner-login.html');
  for (const sel of ['#email', '#password']) {
    await page.locator(sel).focus();
    const o = await page.locator(sel).evaluate(outlineInfo);
    // A real, painted outline — not merely a box-shadow that forced-colors drops.
    expect(o.style !== 'none' && o.width > 0, `${sel} focus outline under forced-colors (got style=${o.style} width=${o.width} shadow=${o.shadow})`).toBe(true);
  }
});

test('the command palette input shows a visible focus outline under forced-colors', async ({ page, backend }) => {
  seedBusiness(backend);
  await page.emulateMedia({ forcedColors: 'active' });
  await login(page);
  await page.keyboard.press('ControlOrMeta+k');
  const pi = page.locator('#paletteInput');
  await expect(pi).toBeFocused();
  const o = await pi.evaluate(outlineInfo);
  expect(o.style !== 'none' && o.width > 0, `#paletteInput focus outline under forced-colors (style=${o.style} width=${o.width})`).toBe(true);
});

test('BASELINE: normal mode gives the sign-in fields a focus indicator (outline OR ring)', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'none' });
  await page.goto('/owner-login.html');
  await page.locator('#email').focus();
  const o = await page.locator('#email').evaluate(outlineInfo);
  const visible = (o.style !== 'none' && o.width > 0) || (o.shadow && o.shadow !== 'none');
  expect(visible, `normal-mode focus indicator present (style=${o.style} width=${o.width} shadow=${o.shadow})`).toBe(true);
});

test('status is conveyed as text, not colour alone (badges / priority pills carry a label)', async ({ page, backend }) => {
  seedBusiness(backend);
  await page.clock.setFixedTime(NOW);
  await page.emulateMedia({ forcedColors: 'active' });
  await login(page);
  await page.waitForLoadState('networkidle');
  const ids = await page.locator('#sidebarGroups .sidebarLink[data-page]').evaluateAll(els => [...new Set(els.map(e => e.getAttribute('data-page')))]);
  const empty = [];
  let seen = 0;
  for (const id of ids) {
    await gotoPage(page, id);
    const res = await page.locator(`section#${id}`).evaluate(root => {
      const out = []; let n = 0;
      root.querySelectorAll('.badge, .priorityPill').forEach(el => {
        const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
        if (!(r.width > 0 && r.height > 0 && cs.visibility !== 'hidden')) return;
        n++;
        const text = (el.textContent || '').trim();
        const label = (el.getAttribute('aria-label') || el.getAttribute('title') || '').trim();
        if (!text && !label) out.push(el.outerHTML.slice(0, 120));
      });
      return { out, n };
    });
    seen += res.n; res.out.forEach(h => empty.push(`${id}: ${h}`));
  }
  expect(seen, 'the test actually exercised status badges (not vacuous)').toBeGreaterThan(0);
  expect(empty, 'every visible status badge/pill carries text or an accessible label').toEqual([]);
});

test('the page does not opt essential UI out of forced-colors (no forced-color-adjust:none on controls/status)', async ({ page, backend }) => {
  seedBusiness(backend);
  await page.emulateMedia({ forcedColors: 'active' });
  await login(page);
  await page.waitForLoadState('networkidle');
  const offenders = await page.evaluate(() => {
    const sel = 'button, a[href], input, select, textarea, [role=button], .badge, .priorityPill, .dot, .swatch';
    const bad = [];
    document.querySelectorAll(sel).forEach(el => {
      const cs = getComputedStyle(el);
      const v = cs.getPropertyValue('forced-color-adjust') || cs.forcedColorAdjust;
      if (v && v.trim() === 'none') bad.push((el.className || el.tagName) + '');
    });
    // negative control: a planted element with the opt-out MUST be detected.
    const probe = document.createElement('button'); probe.style.forcedColorAdjust = 'none';
    probe.setAttribute('data-fc-probe', '1'); document.body.appendChild(probe);
    const probed = getComputedStyle(probe).forcedColorAdjust === 'none';
    probe.remove();
    return { bad, probed };
  });
  expect(offenders.probed, 'self-test: the scanner can detect forced-color-adjust:none').toBe(true);
  expect(offenders.bad, 'no control/status element bypasses the user forced-colors preference').toEqual([]);
});

// Keyboard navigation (not just .focus()): a real Tab walk must leave a painted
// focus indicator on every stop. Inputs rely on the @media forced-colors outline
// added in this change; buttons/links rely on the UA outline (not suppressed).
test('Tab navigation shows a painted focus indicator at each sign-in stop under forced-colors', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/owner-login.html');
  await page.locator('#email').focus(); // start at the first field
  const stops = [];
  for (let i = 0; i < 3; i++) {
    const info = await page.evaluate(() => {
      const el = document.activeElement; const cs = getComputedStyle(el);
      return { id: el.id || el.tagName, style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) || 0 };
    });
    stops.push(info);
    await page.keyboard.press('Tab');
  }
  // #email, #password (our outline) and #loginBtn (UA outline) must each be painted.
  for (const s of stops) {
    expect(s.style !== 'none' && s.width > 0, `focus indicator on ${s.id} under forced-colors (style=${s.style} width=${s.width})`).toBe(true);
  }
  expect(stops.map(s => s.id)).toContain('loginBtn');
});

test('links keep a visible focus indicator under forced-colors (forgot-password link)', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/owner-login.html');
  const link = page.locator('#forgotPasswordLink');
  await link.focus();
  const o = await link.evaluate(el => { const cs = getComputedStyle(el); return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) || 0 }; });
  expect(o.style !== 'none' && o.width > 0, `link focus indicator under forced-colors (style=${o.style} width=${o.width})`).toBe(true);
});
