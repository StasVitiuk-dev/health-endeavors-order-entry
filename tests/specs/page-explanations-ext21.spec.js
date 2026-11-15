// Owner review of Nov 3 (points 7 and 8): long explanatory paragraphs made pages
// feel unfinished, and empty states left tall blank bands. Each long page
// explanation now shows a short lead — including any warning or stated limit —
// with the rest one click away; nothing was deleted. Empty states are compact.
const fs = require('fs');
const path = require('path');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const HTML = fs.readFileSync(path.join(__dirname, '..', '..', 'owner-login.html'), 'utf8');
const strip = h => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

test('markup: no page explanation is a wall of text; every "more" block follows a lead', async ({}, ti) => {
  test.skip(ti.project.name !== 'desktop', 'Node-only; run once');
  // Visible lead paragraphs (not the ones tucked inside a "more" block) stay short.
  const outside = HTML.replace(/<details class="hintMore">[\s\S]*?<\/details>/g, '');
  const long = [...outside.matchAll(/<p class="hint[^"]*"[^>]*>([\s\S]*?)<\/p>/g)].map(m => strip(m[1])).filter(t => t.length >= 260);
  expect(long).toEqual([]);
  const more = [...HTML.matchAll(/<p class="hint[^"]*hintLead">[\s\S]*?<\/p>\s*<details class="hintMore"><summary>More about this<\/summary><p class="hint">[\s\S]*?<\/p><\/details>/g)];
  expect(more.length).toBe((HTML.match(/class="hintMore"/g) || []).length);
  expect(more.length).toBeGreaterThanOrEqual(15);
});

test('warnings and stated limits stay visible without opening anything', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'wording; run once');
  await login(page);
  const visible = [
    ['taxRecordsPanel', 'It never files anything or talks to the IRS or any state directly'],
    ['taxRecordsPanel', 'not tax advice'],
    ['taxRecordsPanel', 'This is an estimate, not an authoritative Cost of Goods Sold figure'],
    ['taxRecordsPanel', 'by-state split as unverified'],
    ['accountingPanel', "the exact amount refunded isn't tracked yet"],
    ['adverseEventsPanel', 'This is a tracking tool, not legal advice'],
    ['aiPanel', 'a record of intent, not a guaranteed stop'],
    ['flagsPanel', "does not (yet) force-disable logins or revoke other people's sessions"],
  ];
  for (const [panel, text] of visible) {
    await gotoPage(page, panel);
    await expect(page.locator('section#' + panel + ' p.hintLead', { hasText: text }).first(), panel + ': ' + text).toBeVisible();
  }
});

test('the rest is one click or one key press away, and it is all still there', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'run once');
  await login(page);
  await gotoPage(page, 'inventoryPanel');
  const more = page.locator('section#inventoryPanel details.hintMore').first();
  const body = more.locator('p.hint');
  await expect(body).toBeHidden();
  await more.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(body).toBeVisible();
  await expect(body).toContainText('give everything a SKU and use the same one in Shopify');
  await expect(body).toContainText('Every change is logged with who made it, when and why');
  await page.keyboard.press('Enter');
  await expect(body).toBeHidden();
});

test('an empty state is compact, not a tall blank band', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'layout; run once');
  await login(page);
  await gotoPage(page, 'accountingPanel');
  const empty = page.locator('section#accountingPanel p.empty').first();
  await expect(empty).toBeVisible();
  const box = await empty.boundingBox();
  expect(box.height).toBeLessThan(60);
});

test('phone size: the "more" control is an easy tap target and nothing scrolls sideways', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'iphone', 'phone size only');
  await login(page);
  await gotoPage(page, 'taxRecordsPanel');
  const sums = page.locator('section#taxRecordsPanel details.hintMore summary');
  expect(await sums.count()).toBeGreaterThanOrEqual(4);
  for (let i = 0; i < await sums.count(); i++) expect((await sums.nth(i).boundingBox()).height).toBeGreaterThanOrEqual(24);
  await sums.first().click();
  await expect(page.locator('section#taxRecordsPanel details.hintMore p.hint').first()).toBeVisible();
  expect(await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth)).toBeLessThanOrEqual(1);
});
