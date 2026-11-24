// Reviews (owner plan item 8, Nov 24: "reviews from every channel in the feed, worst
// first, reply to approve"). assets/sales/he-review-inbox.js and its page, behind the
// preview switch he_review_inbox (OFF). The owner pastes or types reviews in; no
// account and no connection. NOTHING IS POSTED OR SENT, and nothing is asked of the
// database: the reviews are kept in this browser for now. All data here is made up.
const R = require('../../assets/sales/he-review-inbox.js');
const F = require('../../assets/views/he-attention-feed.js');
const deps = { reviews: require('../../assets/sales/he-sales-reviews.js'), feedback: require('../../assets/sales/he-sales-feedback.js'), claims: require('../../assets/sales/he-sales-claims.js') };
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { unnamedControls, contrastFailures } = require('../helpers/a11y-audit');

const NOW = Date.parse('2026-11-24T18:00:00Z');
const LIST = ['stars, channel, date, text',
  '2, Etsy, 2026-11-20, "SYNTHETIC The pump stopped working after a week, call me on 555 123 4567 890."',
  '5, Amazon, 2026-11-22, "SYNTHETIC Lovely scent, will buy again."',
  '3 stars; tik tok; ; SYNTHETIC It is fine',
  '1, website, 2026-11-23, "SYNTHETIC I got a rash after using it"',
  '9, etsy, , SYNTHETIC not a rating',
  '★★★★☆, google, , SYNTHETIC Nice lotion'].join('\n');

test.describe('the rules (no browser)', () => {
  test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

  test('a pasted list: the first line names the columns; a line that is not a review is counted, not guessed', () => {
    const p = R.parse(LIST);
    expect([p.read, p.unread, p.problems]).toEqual([5, 1, []]);
    expect(p.rows.map(r => [r.stars, r.channel, r.date])).toEqual([[2, 'etsy', '2026-11-20'], [5, 'amazon', '2026-11-22'], [3, 'tiktok', null], [1, 'website', '2026-11-23'], [4, 'google', null]]);
    expect(R.parse('name, email\nx, y').problems[0]).toContain('at least: stars, text');
    expect(R.parse('')).toMatchObject({ read: 0, unread: 0, problems: [] });
    expect(R.parse('stars,text\n' + Array.from({ length: R.MAX_LINES + 1 }, (_, i) => '5,SYNTHETIC review ' + i).join('\n')).problems[0]).toContain('too long');
    // stars are read only when they are plainly 1 to 5
    expect(['4/5', '5 stars', '3', '1 star', '0', '6', '4.5', 'great', ''].map(R.starsOf)).toEqual([4, 5, 3, 1, null, null, null, null, null]);
    // an unknown site is "other", never dropped
    expect(R.channelOf('Walmart')).toBe('other');
    for (const junk of [null, undefined, 7, [], {}, 'x\ny']) expect(() => R.parse(junk)).not.toThrow();
  });

  test('one typed review is checked; the same review is never kept twice; at most 300 are kept', () => {
    expect(R.clean({ stars: 5, text: 'ok!' }).ok).toBe(true);
    expect(R.clean({ stars: '5', text: '' }).problems).toEqual(['Write what the review says.']);
    expect(R.clean({ stars: 0, text: 'SYNTHETIC text' }).problems).toEqual(['Choose the stars (1 to 5).']);
    expect(R.clean({ stars: 3, text: 'SYNTHETIC text', date: 'someday' }).problems[0]).toContain('not a date');
    expect(R.clean({ stars: 3, text: 'x'.repeat(R.MAX_TEXT + 1) }).problems[0]).toContain('too long');
    const a = R.add([], R.parse(LIST).rows, NOW);
    expect([a.added, a.duplicates, a.list.length]).toEqual([5, 0, 5]);
    const again = R.add(a.list, R.parse(LIST).rows, NOW + 1000);
    expect([again.added, again.duplicates, again.list.length]).toEqual([0, 5, 5]);
    // the same words with other capitals and spacing are the same review; on another site they are another one
    expect(R.add(a.list, [{ stars: 5, channel: 'amazon', date: '2026-11-22', text: 'synthetic  LOVELY scent, will buy again.' }], NOW).duplicates).toBe(1);
    expect(R.add(a.list, [{ stars: 5, channel: 'etsy', date: '2026-11-22', text: 'SYNTHETIC Lovely scent, will buy again.' }], NOW).added).toBe(1);
    const many = Array.from({ length: R.MAX_KEEP + 20 }, (_, i) => ({ stars: 5, text: 'SYNTHETIC review number ' + i }));
    const big = R.add([], many, NOW);
    expect([big.list.length, big.dropped]).toEqual([R.MAX_KEEP, 20]);
    // junk in what was kept is dropped on the way in, never thrown on
    expect(R.add([null, 7, { stars: 99 }, { stars: 4, text: 'SYNTHETIC kept' }], [], NOW).list.length).toBe(1);
  });

  test('worst first: 1 and 2 stars, a leak, a reaction or a faulty product are urgent; 3 stars is today; 4 and 5 need nothing', () => {
    const list = R.add([], R.parse(LIST).rows, NOW).list;
    const r = R.rank(list, deps);
    expect(r.map(x => [x.stars, x.level])).toEqual([[1, 'urgent'], [2, 'urgent'], [3, 'today'], [4, 'info'], [5, 'info']]);
    expect(r[0].safety).toBe(true);
    expect(r[0].reasons).toEqual(['1 star', 'mentions a reaction or a safety concern']);
    expect(r[1].reasons).toEqual(['2 stars', 'mentions a problem with the pump']);
    // a 5-star review that mentions a leak still needs a look
    expect(R.rank([{ stars: 5, text: 'SYNTHETIC great lotion but the bottle leaked in the box' }], deps)[0].level).toBe('urgent');
    // praise for the pump is not a problem
    expect(R.rank([{ stars: 5, text: 'SYNTHETIC I love the pump' }], deps)[0].level).toBe('info');
    // answered ones go to the end, and are no longer counted as waiting
    const done = R.setStatus(list, r[0].id, 'answered', NOW);
    expect(done.ok).toBe(true);
    expect(R.rank(done.list, deps).map(x => x.stars)).toEqual([2, 3, 4, 5, 1]);
    expect(R.summary(done.list, deps)).toMatchObject({ total: 5, waiting: 2, urgent: 1, today: 1, answered: 1, average: 3 });
    expect(R.setStatus(list, 'nope', 'answered', NOW).ok).toBe(false);
    expect(R.setStatus(list, r[0].id, 'published', NOW).ok).toBe(false);
    // without the review rules loaded nothing is guessed from the words: the stars alone decide
    expect(R.rank([{ stars: 4, text: 'SYNTHETIC I got a rash' }], {})[0]).toMatchObject({ level: 'info', checked: false });
  });

  test('ready replies: three per case, each through the claim check, none asks for a better review or gives health advice', () => {
    const list = R.add([], R.parse(LIST).rows, NOW).list;
    const by = Object.fromEntries(R.rank(list, deps).map(x => [x.stars, x]));
    expect([1, 2, 3, 4, 5].map(s => R.replies(by[s], deps).bucket)).toEqual(['safety', 'low', 'middle', 'high', 'high']);
    for (const s of [1, 2, 3, 5]) {
      const rep = R.replies(by[s], deps);
      expect(rep.options.length).toBe(3);
      for (const o of rep.options) {
        expect(o.blocked, o.text).toBe(false);
        expect(deps.claims.scan(o.text).findings).toEqual([]);
        expect(o.text).not.toMatch(/change your review|update your review|remove (your|the) review|delete (your|the) review|5 stars|five stars|discount|coupon|free|refund|in exchange|doctor|allerg|medical|treat|cure|heal/i);
        expect(o.text.length).toBeLessThanOrEqual(400);
      }
    }
    expect(R.replies(by[1], deps).rule).toContain('it gives no medical advice');
    expect(R.replies(by[2], deps).rule).toContain('never asks for the review to be changed or removed');
    expect(R.replies(by[1], deps).options.every(o => /stop using|do not keep using/i.test(o.text))).toBe(true);
    // it fails closed: without the claim check no reply is offered
    expect(R.replies(by[2], { reviews: deps.reviews }).options.every(o => o.blocked)).toBe(true);
    expect(R.replies(null, deps)).toMatchObject({ ok: false, options: [] });
  });

  test('what goes to Home: only the ones still waiting, worst first, with private details hidden', () => {
    const list = R.add([], R.parse(LIST).rows, NOW).list;
    const rows = R.toFeed(list, deps);
    expect(rows.map(x => [x.stars, x.level])).toEqual([[1, 'urgent'], [2, 'urgent'], [3, 'today']]);
    expect(rows[0].title).toBe('1-star review on Your website · mentions a reaction or a safety concern');
    expect(rows[1].title).toBe('2-star review on Etsy · mentions a problem with the pump');
    expect(rows[1].detail).toContain('[phone redacted]');
    expect(rows[1].detail).not.toContain('555');
    expect(rows[2].title).toBe('3-star review on TikTok Shop');
    // without the check for private details the review's words are not repeated on Home at all
    expect(R.toFeed(list, { reviews: deps.reviews }).every(x => x.detail === '')).toBe(true);
    const items = F.buildFeed({ reviews: rows }, NOW);
    expect(items.map(i => [i.kind, i.badge, i.level, i.page])).toEqual([['review', 'Review', 'urgent', 'reviewsPanel'], ['review', 'Review', 'urgent', 'reviewsPanel'], ['review', 'Review', 'today', 'reviewsPanel']]);
    expect(items.every(i => F.matchesFilter(i, 'message'))).toBe(true);
    expect(F.buildFeed({ reviews: null }, NOW)).toEqual([]);
    expect(F.buildFeed({ reviews: [null, 7, { id: 'x', level: 'info' }, { level: 'urgent' }] }, NOW)).toEqual([]);
  });
});

const on = (page, feed) => page.addInitScript((withFeed) => { try { localStorage.setItem('he_review_inbox', 'on'); if (withFeed) localStorage.setItem('he_attention_feed', 'on'); } catch (e) {} }, feed);
const clip = (page) => page.addInitScript(() => { window.__copied = []; try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t) => { window.__copied.push(String(t)); return Promise.resolve(); } } }); } catch (e) {} });
const writes = (backend) => backend.requests.filter(r => r.method !== 'GET' && r.method !== 'HEAD' && !r.rpc && String(r.path || '').startsWith('/rest/v1/'));
const paste = async (P) => { await P.locator('[data-ripastebox] summary').click(); await P.locator('#riPasteIn').fill(LIST); await P.locator('[data-ri="paste"]').click(); };

test.describe('the Reviews page', () => {
  test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date(NOW)); });

  test('switch off (as shipped): no page in the menu, nothing drawn, nothing kept, nothing on Home', async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    await page.addInitScript(() => { try { localStorage.setItem('he_attention_feed', 'on'); localStorage.setItem('he_review_inbox_v1', JSON.stringify({ reviews: [{ stars: 1, text: 'SYNTHETIC left over from before' }] })); } catch (e) {} });
    await login(page);
    await expect(page.locator('#sidebarNav')).not.toContainText('Reviews');
    await expect(page.locator('#reviewsPanel')).toBeEmpty();
    await gotoPage(page, 'attentionPanel');
    await expect(page.locator('#attentionFeedHost')).toBeVisible();
    await expect(page.locator('#attentionFeedHost [data-feedkind="review"]')).toHaveCount(0);
  });

  test('paste a list: the ones that need you come first; ready replies are copied, never posted; answered ones leave the list; nothing is written anywhere but this browser', async ({ page, backend, pageErrors }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    await on(page, true); await clip(page);
    await login(page); await gotoPage(page, 'reviewsPanel');
    const P = page.locator('#reviewsPanel');
    await expect(P.locator('[data-rinosend]')).toContainText('Nothing is posted from this page.');
    await expect(P.locator('[data-rikept]')).toContainText('Kept in this browser only for now.');
    await expect(P.locator('[data-risummary]')).toHaveText('No reviews here yet.');
    await paste(P);
    await expect(P.locator('[data-rimessage]')).toHaveText('5 reviews added, 1 line could not be read.');
    await expect(P.locator('[data-risummary]')).toHaveText('3 reviews need you · 2 urgent, 1 today · 5 reviews here, average 3 of 5 (exact, of the reviews here only)');
    const cards = P.locator('[data-rireview]');
    await expect(cards).toHaveCount(3);                                       // the 4 and 5 star ones need nothing
    expect(await cards.evaluateAll(els => els.map(e => e.getAttribute('data-rilevel')))).toEqual(['urgent', 'urgent', 'today']);
    await expect(cards.nth(0)).toContainText('1 of 5 stars · mentions a reaction or a safety concern');
    await expect(cards.nth(0).locator('[data-risafety]')).toContainText('also record it under Adverse Event Reports');
    await expect(cards.nth(1)).toContainText('[phone redacted]');
    await expect(cards.nth(1)).not.toContainText('555');
    await expect(cards.nth(1)).toContainText('Private details in this review');
    // the box stays open and is emptied after a list was read; pasting the same list again adds nothing
    await expect(P.locator('#riPasteIn')).toBeVisible();
    await expect(P.locator('#riPasteIn')).toHaveValue('');
    await P.locator('#riPasteIn').fill(LIST); await P.locator('[data-ri="paste"]').click();
    await expect(P.locator('[data-rimessage]')).toHaveText('0 reviews added, 5 already here, 1 line could not be read.');
    await expect(cards).toHaveCount(3);
    // ready replies for the 2-star one
    await cards.nth(1).locator('[data-ri="replies"]').click();
    await expect(cards.nth(1).locator('[data-rireplies]')).toHaveAttribute('data-rireplies', 'low');
    await expect(cards.nth(1).locator('[data-ricopy]')).toHaveCount(3);
    await cards.nth(1).locator('[data-ricopy]').first().click();
    await expect(P.locator('[data-rimessage]')).toHaveText('Reply copied. Nothing was posted. Paste it where the review was written, then press "I answered it".');
    expect(await page.evaluate(() => window.__copied)).toEqual(['Thank you for telling us, and we are sorry your order was not what you expected. We would like to make this right: please message us here with your order number.']);
    // answered: it leaves "Need you", stays under "All", and can be put back
    await cards.nth(1).locator('[data-ri="answered"]').click();
    await expect(P.locator('[data-rimessage]')).toHaveText('Marked as answered.');
    await expect(cards).toHaveCount(2);
    await P.locator('[data-rifilter="all"]').click();
    await expect(cards).toHaveCount(5);
    await expect(P.locator('[data-ristatus="answered"]')).toHaveCount(1);
    await P.locator('[data-ristatus="answered"] [data-ri="new"]').click();
    await P.locator('[data-rifilter="waiting"]').click();
    await expect(cards).toHaveCount(3);
    // Home lists the three that need you, and opens the page
    await gotoPage(page, 'attentionPanel');
    const home = page.locator('#attentionFeedHost [data-feedkind="review"]');
    await expect(home).toHaveCount(3);
    // on Home the urgent ones are in Home's own order (the one waiting longest first)
    await expect(home.nth(0)).toContainText('2-star review on Etsy');
    await expect(home.nth(1)).toContainText('1-star review on Your website');
    await expect(home.nth(2)).toContainText('3-star review on TikTok Shop');
    await expect(page.locator('#attentionFeedHost')).not.toContainText('555');
    await home.nth(1).locator('[data-feedopen="reviewsPanel"]').click();
    await expect(page.locator('section#reviewsPanel')).toHaveClass(/activePage/);
    // kept across a reload, in this browser only
    await page.reload(); await expect(page.locator('#dash')).toBeVisible(); await gotoPage(page, 'reviewsPanel');
    await expect(cards).toHaveCount(3);
    expect(writes(backend)).toEqual([]);
    expect(backend.requests.filter(r => r.rpc && /review/i.test(r.rpc))).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('type one review in; a mistake is said in plain words; Remove asks twice; the safety note opens Adverse Event Reports', async ({ page, backend, pageErrors }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    await on(page, false);
    await login(page); await gotoPage(page, 'reviewsPanel');
    const P = page.locator('#reviewsPanel'), cards = P.locator('[data-rireview]');
    await P.locator('#riStarsIn').selectOption('1');
    await P.locator('#riChannelIn').selectOption('amazon');
    await P.locator('#riDateIn').fill('2026-11-23');
    await P.locator('[data-ri="add-one"]').click();
    await expect(P.locator('[data-rimessage]')).toHaveText('Not added: Write what the review says.');
    // what was already chosen is still there after the message
    await expect(P.locator('#riStarsIn')).toHaveValue('1');
    await expect(P.locator('#riChannelIn')).toHaveValue('amazon');
    await expect(P.locator('#riDateIn')).toHaveValue('2026-11-23');
    await P.locator('#riTextIn').fill('SYNTHETIC it gave me a rash');
    await P.locator('[data-ri="add-one"]').click();
    await expect(P.locator('[data-rimessage]')).toHaveText('Review added.');
    await expect(P.locator('#riTextIn')).toHaveValue('');                    // ready for the next one
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('Amazon');
    await expect(cards.first()).toContainText('Nov 23, 2026');
    // the same one again is not added twice
    await P.locator('#riStarsIn').selectOption('1'); await P.locator('#riChannelIn').selectOption('amazon'); await P.locator('#riDateIn').fill('2026-11-23'); await P.locator('#riTextIn').fill('SYNTHETIC it gave me a rash');
    await P.locator('[data-ri="add-one"]').click();
    await expect(P.locator('[data-rimessage]')).toHaveText('That review is already here; it was not added twice.');
    await expect(cards).toHaveCount(1);
    // Remove asks twice
    await cards.first().locator('[data-ri="remove"]').click();
    await expect(cards.first().locator('[data-ri="remove"]')).toHaveText('Tap again to remove');
    await expect(cards).toHaveCount(1);
    await P.locator('#riTextIn').fill('SYNTHETIC half typed');
    await cards.first().locator('[data-ri="replies"]').click();               // doing something else cancels it
    await expect(cards.first().locator('[data-ri="remove"]')).toHaveText('Remove');
    await expect(P.locator('#riTextIn')).toHaveValue('SYNTHETIC half typed'); // and what was being typed is not lost
    await P.locator('#riTextIn').fill('');
    await expect(cards.first().locator('[data-rireplies]')).toHaveAttribute('data-rireplies', 'safety');
    // the safety note leads to the adverse event page
    await cards.first().locator('[data-ri="adverse"]').click();
    await expect(page.locator('section#adverseEventsPanel')).toHaveClass(/activePage/);
    await gotoPage(page, 'reviewsPanel');
    await cards.first().locator('[data-ri="remove"]').click(); await cards.first().locator('[data-ri="remove"]').click();
    await expect(cards).toHaveCount(0);
    await expect(P.locator('[data-risummary]')).toHaveText('No reviews here yet.');
    expect(writes(backend)).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('an employee does not see reviews here or on Home', async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    backend.tables.profiles[0].role = 'employee';
    await page.addInitScript((v) => { try { localStorage.setItem('he_review_inbox', 'on'); localStorage.setItem('he_attention_feed', 'on'); localStorage.setItem('he_review_inbox_v1', v); } catch (e) {} },
      JSON.stringify({ reviews: [{ stars: 1, text: 'SYNTHETIC kept by the owner on a shared computer' }] }));
    await login(page); await gotoPage(page, 'reviewsPanel');
    await expect(page.locator('#reviewsPanel')).toContainText('Only the owner and administrators can see reviews here.');
    await expect(page.locator('#reviewsPanel')).not.toContainText('shared computer');
    await gotoPage(page, 'attentionPanel');
    await expect(page.locator('#attentionFeedHost [data-feedkind="review"]')).toHaveCount(0);
  });

  test('readable in light and dark, every control named; on a phone it fits and the buttons are easy to tap', async ({ page, backend, pageErrors }, ti) => {
    await on(page, false);
    await login(page);
    const check = (loc) => loc.evaluate((root, src) => (new Function('return ' + src)())(root), contrastFailures.toString());
    for (const scheme of ti.project.name === 'desktop' ? ['light', 'dark'] : ['light']) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await gotoPage(page, 'reviewsPanel');
      const P = page.locator('#reviewsPanel');
      if (await P.locator('[data-rireview]').count() === 0) await paste(P);
      if (await P.locator('[data-rireplies]').count() === 0) await P.locator('[data-ri="replies"]').first().click();
      await expect(P.locator('[data-ricopy]').first()).toBeVisible();
      await page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))));
      expect(await check(P), scheme).toEqual([]);
      expect(await P.evaluate(unnamedControls), scheme).toEqual([]);
    }
    if (ti.project.name === 'iphone') {
      expect(await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth)).toBeLessThanOrEqual(1);
      const heights = await page.locator('#reviewsPanel button').evaluateAll(els => els.filter(e => e.offsetParent !== null).map(e => Math.round(e.getBoundingClientRect().height)));
      expect(heights.length).toBeGreaterThan(5);
      expect(Math.min(...heights)).toBeGreaterThanOrEqual(40);
    }
    expect(pageErrors).toEqual([]);
  });
});
