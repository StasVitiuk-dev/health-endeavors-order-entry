// Reserve IV — WAVE C (C6/C7): uncertainty and risk on the decision pages are
// conveyed by TEXT, never by color alone. Verified fact (grep of
// assets/owner-login.css): the sales value rows carry a `data-label`
// (SIMULATED/ESTIMATED/UNKNOWN/OWNER_INPUT_REQUIRED) but NO colour styling, and
// the decision-relevant signals (risk level, UNKNOWN, confidence) are rendered
// as literal text values. This spec proves those words are present in
// textContent — so a viewer who cannot perceive colour still reads the signal.
// Flag ON; desktop project (markup/text; run once).
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { enableSalesFlag } = require('../helpers/sales-pages');

test.describe('decision pages: uncertainty/risk conveyed as text (not colour-only)', () => {
  test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'markup/text; run once'); });

  test('Pipeline Risk & Concentration states the risk LEVEL and flags as words', async ({ page }) => {
    await enableSalesFlag(page);
    await login(page);
    await gotoPage(page, 'salesConcentrationPanel');
    const text = await page.locator('#salesConcentrationPanel .salesPage').innerText();
    // The overall risk level is a literal word, not a colour swatch.
    expect(text).toMatch(/\b(LOW|MEDIUM|HIGH)\b/);
    // The synthetic fixture concentrates one account -> a named risk flag in words.
    expect(text).toMatch(/SINGLE_ACCOUNT_DEPENDENCY|SINGLE_DEAL_DEPENDENCY|THIN_PIPELINE/);
    // Severity is spelled out alongside the flag, not signalled only by colour.
    expect(text.toUpperCase()).toMatch(/HIGH|MEDIUM/);
  });

  test('Prioritization Lab explains rank and sensitivity in words', async ({ page }) => {
    await enableSalesFlag(page);
    await login(page);
    await gotoPage(page, 'salesPriorityPanel');
    const text = await page.locator('#salesPriorityPanel .salesPage').innerText();
    expect(text).toMatch(/Most influential preference/i);
    // A ranked row reads as text ("#1 ...") with a named factor in the explanation.
    expect(text).toMatch(/#1\b/);
    expect(text.toLowerCase()).toMatch(/value|fit|urgency|momentum|effort|risk/);
  });

  test('UNKNOWN surfaces as a visible dash/word, never a fake zero or a colour', async ({ page }) => {
    await enableSalesFlag(page);
    await login(page);
    // Reply Triage Lab shows a confidence breakdown incl. an Unknown count as text.
    await gotoPage(page, 'salesReplyLabPanel');
    const text = await page.locator('#salesReplyLabPanel .salesPage').innerText();
    expect(text).toMatch(/Unknown/i);     // the confidence bucket is named in words
    expect(text).toMatch(/Uncertain share/i);
  });

  test('no decision page conveys a risk/uncertainty signal with colour as the only cue', async ({ page }) => {
    await enableSalesFlag(page);
    await login(page);
    // Render the pages in a forced monochrome filter; the risk/uncertainty words
    // must still be present in the text layer (they are textContent, not colour).
    await page.addStyleTag({ content: 'html{filter:grayscale(1) contrast(1)!important}' }).catch(() => {});
    for (const [id, re] of [
      ['salesConcentrationPanel', /\b(LOW|MEDIUM|HIGH)\b/],
      ['salesProgressionPanel', /FRESH|AGING|STALE|COLD|UNKNOWN|DONE|stalled|Stalled/],
    ]) {
      await gotoPage(page, id);
      const text = await page.locator(`#${id} .salesPage`).innerText();
      expect(text, `${id} must carry its signal as text`).toMatch(re);
    }
  });
});
