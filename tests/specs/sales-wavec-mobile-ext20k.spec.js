// Reserve IV — WAVE C (WS04/C5): mobile decision-value integrity. At 320px with
// text enlarged to 200%, the decision-critical value on each of the five
// decision pages must stay VISIBLE and un-clipped (not pushed off-screen, not
// hidden by overflow), and the page must not scroll sideways. Verified fact:
// the sales rows carry no overflow/ellipsis CSS, so values wrap — this spec
// proves that holds for the owner-critical signal on each page.
// iPhone project (narrow layout); reuses the flag helper.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { enableSalesFlag } = require('../helpers/sales-pages');

test.describe('320px + 200% text: decision-critical values stay visible', () => {
  test.use({ viewport: { width: 320, height: 640 } });
  test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'iphone', 'narrow layout; run once'); });

  // For each page: a locator for the owner-critical signal that must remain readable.
  const CRITICAL = {
    salesPriorityPanel: { re: /#1\b/, label: 'top-ranked lead' },
    salesProgressionPanel: { re: /FRESH|AGING|STALE|COLD|DONE|UNKNOWN/, label: 'aging bucket' },
    // No \b: adjacent inline spans concatenate in innerText (e.g. "riskHIGH"),
    // so the risk word has no leading word boundary. The word itself is the signal.
    salesConcentrationPanel: { re: /(LOW|MEDIUM|HIGH)/, label: 'overall risk level' },
    salesNextActionPanel: { re: /STOP|DRAFT|FOLLOW|REVIEW|SAMPLE|WHOLESALE|WAIT|SEND/, label: 'recommended action' },
    salesReplyLabPanel: { re: /Uncertain share/i, label: 'uncertainty signal' },
  };

  for (const [id, crit] of Object.entries(CRITICAL)) {
    test(`${id}: ${crit.label} is present, visible and un-clipped`, async ({ page }) => {
      await enableSalesFlag(page);
      await login(page);
      // Enlarge text to 200% via a constructed stylesheet (CSP-safe; style-src 'self').
      await page.evaluate(() => { const s = new CSSStyleSheet(); s.replaceSync('html{font-size:200%!important}'); document.adoptedStyleSheets = [...document.adoptedStyleSheets, s]; });
      await gotoPage(page, id);
      const panel = page.locator(`#${id} .salesPage`);
      await expect(panel).toBeVisible();
      // The critical signal is present in the rendered text...
      await expect(panel).toContainText(crit.re);
      // ...and the element carrying it has a real, non-zero, on-screen box
      // (not collapsed/clipped and not pushed entirely off the right edge).
      const box = await page.locator(`#${id} .salesRow`, { hasText: crit.re }).first().boundingBox();
      expect(box, `${crit.label} must render a box`).not.toBeNull();
      expect(box.width).toBeGreaterThan(0);
      expect(box.height).toBeGreaterThan(0);
      expect(box.x).toBeLessThan(320); // starts within the viewport width
      // No sideways scroll on the whole document at this width + zoom.
      const over = await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth);
      expect(over).toBeLessThanOrEqual(1);
    });
  }

  test('every decision page: no sales value row is clipped by overflow/ellipsis', async ({ page }) => {
    test.setTimeout(120000);
    await enableSalesFlag(page);
    await login(page);
    await page.evaluate(() => { const s = new CSSStyleSheet(); s.replaceSync('html{font-size:200%!important}'); document.adoptedStyleSheets = [...document.adoptedStyleSheets, s]; });
    const clipped = [];
    for (const id of Object.keys(CRITICAL)) {
      await gotoPage(page, id);
      const bad = await page.locator(`#${id} .salesPage`).evaluate(root => {
        const out = [];
        root.querySelectorAll('.salesRow .v, .salesRow .k, .salesCell').forEach(el => {
          const cs = getComputedStyle(el);
          // A value hidden by ellipsis/clip on a one-line box would lose content.
          if ((cs.textOverflow === 'ellipsis' || cs.overflow === 'hidden') && cs.whiteSpace === 'nowrap' && el.scrollWidth > el.clientWidth + 1) {
            out.push((el.textContent || '').slice(0, 40));
          }
        });
        return out;
      });
      bad.forEach(b => clipped.push(`${id}: ${b}`));
    }
    expect(clipped).toEqual([]);
  });
});
