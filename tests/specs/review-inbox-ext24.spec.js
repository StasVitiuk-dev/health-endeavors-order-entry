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
    expect(R.clean({ stars: '5', text: '' }).problems).toEqual(['Write what the review says (three characters at least).']);
    // counted the way the database counts (an emoji is one character), so the page never accepts what the database would refuse
    expect(R.clean({ stars: 5, text: '\u{1F60D}\u{1F60D}' }).ok).toBe(false);
    expect(R.clean({ stars: 5, text: '\u{1F60D}\u{1F60D}\u{1F60D}' }).ok).toBe(true);
    // a long product name cut at 120 never ends in half of an emoji (the database would refuse the whole save)
    expect(R.clean({ stars: 5, text: 'SYNTHETIC text', product: 'x'.repeat(119) + '\u{1F60D}' }).review.product).toBe('x'.repeat(119));
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
    await expect(P.locator('[data-rimessage]')).toHaveText('Not added: Write what the review says (three characters at least).');
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

// ---------- Reviews on every device (docs/ops/sql/drafts/60; behind he_review_store) ----------
// A switch that saves real records: OFF, and usable only once the draft is installed.
// With it the reviews live in the database (the same on every device of the owner and the
// administrators); without it everything above stays exactly as it is. The database part
// is tested against a real local PostgreSQL (docs/ops/sql/local-test/customer_reviews_test.sh).
test.describe('reviews on every device: the database side (no browser)', () => {
  test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });
  const row = (n, extra) => Object.assign({ id: '00000000-0000-4000-8000-' + String(n).padStart(12, '0'), channel: 'etsy', stars: 2, review_text: 'SYNTHETIC review ' + n, review_date: '2026-11-20', product: '', status: 'new', status_at: null, added_at: '2026-11-24T18:00:0' + n + 'Z' }, extra || {});
  const fake = (rows, opts) => { const calls = [], o = opts || {};
    return { calls, client: { from: (t) => ({ select: (cols) => ({ limit: async () => { calls.push(['probe', t]); return o.probeError ? { data: null, error: o.probeError } : { data: [], error: null }; },
        order: () => ({ limit: async () => { calls.push(['list', t, cols]); return o.listError ? { data: null, error: o.listError } : { data: rows, error: null }; } }) }) }),
      rpc: async (name, body) => { calls.push(['rpc', name, body]); return o.rpcError ? { data: null, error: o.rpcError } : { data: o.rpcData || { ok: true, added: 1, duplicates: 0, refused: 0 }, error: null }; } } }; };

  test('off, or without a client, it asks nothing; installed or not is read from one empty question', async () => {
    const f = fake([]);
    const off = R.createStore({ client: f.client, enabled: false });
    expect([await off.state(), (await off.list()).ok, (await off.add([{ stars: 5, text: 'SYNTHETIC x' }])).ok, (await off.mark(row(1).id, 'answered')).ok]).toEqual(['off', false, false, false]);
    expect(f.calls).toEqual([]);
    expect(await R.createStore({ client: null }).state()).toBe('unknown');
    expect(await R.createStore({ client: f.client }).state()).toBe('installed');
    expect(await R.createStore({ client: fake([], { probeError: { code: 'PGRST205', message: "Could not find the table 'public.customer_reviews' in the schema cache" } }).client }).state()).toBe('not_installed');
    expect(await R.createStore({ client: fake([], { probeError: { code: '500', message: 'SYNTHETIC failure' } }).client }).state()).toBe('unknown');
  });

  test('the list: rows become reviews with the same identity as in the browser; removed ones are known but not shown; junk rows are dropped', async () => {
    const rows = [row(1), row(2, { status: 'answered', status_at: '2026-11-24T18:30:00Z' }), row(3, { status: 'removed' }), { id: 'not-an-id', stars: 5, review_text: 'SYNTHETIC junk' }, row(5, { stars: 9 }), null];
    const st = R.createStore({ client: fake(rows).client });
    const r = await st.list();
    expect(r.ok).toBe(true);
    expect(r.rows.map(x => [x.text, x.status, x.dbId])).toEqual([['SYNTHETIC review 1', 'new', row(1).id], ['SYNTHETIC review 2', 'answered', row(2).id]]);
    expect(r.known.length).toBe(3);                                           // the removed one is known, so an old copy cannot bring it back
    // the identity is the browser's own: same site, date and words
    expect(r.rows[0].id).toBe(R.clean({ stars: 2, channel: 'etsy', date: '2026-11-20', text: 'SYNTHETIC review 1' }).review.id);
    const bad = await R.createStore({ client: fake([], { listError: { code: '42501', message: 'permission denied for table customer_reviews' } }).client }).list();
    expect(bad).toMatchObject({ ok: false, rows: [], message: 'You do not have permission to do that. Nothing was changed.' });
  });

  test('adding and marking: only checked reviews are sent, as plain fields; refusals are said in plain words', async () => {
    const f = fake([]);
    const st = R.createStore({ client: f.client });
    expect(await st.add([{ stars: 5, channel: 'Amazon', date: '2026-11-22', text: ' SYNTHETIC Lovely ', product: 'SYNTHETIC lotion' }, { stars: 0, text: 'SYNTHETIC not a review' }, null])).toMatchObject({ ok: true, added: 1 });
    expect(f.calls).toEqual([['rpc', 'add_customer_reviews', { p_reviews: [{ channel: 'amazon', stars: 5, text: 'SYNTHETIC Lovely', date: '2026-11-22', product: 'SYNTHETIC lotion' }] }]]);
    expect((await st.add([{ stars: 0, text: '' }])).message).toBe('There is no review to add.');
    expect((await st.add(Array.from({ length: R.MAX_LINES + 1 }, (_, i) => ({ stars: 5, text: 'SYNTHETIC many ' + i })))).message).toContain('at a time');
    expect((await st.mark('nope', 'answered')).ok).toBe(false);
    expect((await st.mark(row(1).id, 'published')).ok).toBe(false);
    const g = fake([], { rpcData: { ok: true, id: row(1).id, status: 'removed' } });
    expect(await R.createStore({ client: g.client }).mark(row(1).id, 'removed')).toEqual({ ok: true, message: '' });
    expect(g.calls).toEqual([['rpc', 'set_customer_review_status', { p_id: row(1).id, p_status: 'removed' }]]);
    expect(R.friendlyError({ code: '42501', message: 'Only the owner and administrators can keep reviews.' })).toBe('Only the owner and administrators can keep reviews.');
    expect(R.friendlyError({ code: 'PGRST202', message: 'Could not find the function' })).toContain('not installed yet');
    expect(R.friendlyError({ message: 'Failed to fetch' })).toContain('Could not reach the database');
    expect(R.friendlyError(null)).toContain('The database refused');
  });
});

test.describe('reviews on every device: on the page', () => {
  test.beforeEach(async ({ page }, ti) => { test.skip(ti.project.name !== 'desktop', 'run once'); await page.clock.setFixedTime(new Date(NOW)); });
  const KEPT = JSON.stringify({ reviews: [
    { stars: 2, channel: 'etsy', date: '2026-11-20', text: 'SYNTHETIC The pump stopped working.', status: 'new', addedAt: NOW - 5000 },
    { stars: 3, channel: 'tiktok', date: '2026-11-21', text: 'SYNTHETIC It is fine', status: 'answered', statusAt: NOW - 1000, addedAt: NOW - 4000 }] });
  const flags = (page, store, kept) => page.addInitScript(([withStore, v]) => { try { localStorage.setItem('he_review_inbox', 'on'); localStorage.setItem('he_attention_feed', 'on'); if (withStore) localStorage.setItem('he_review_store', 'on'); if (v && !localStorage.getItem('he_review_inbox_v1') && !sessionStorage.getItem('seeded')) { localStorage.setItem('he_review_inbox_v1', v); sessionStorage.setItem('seeded', '1'); } } catch (e) {} }, [store, kept]);
  const install = (backend) => {
    backend.tables.customer_reviews = []; let n = 0;
    const key = (r) => [r.channel, r.date || '', String(r.text).toLowerCase().replace(/\s+/g, ' ').trim()].join('|');
    backend.rpc.add_customer_reviews = (b) => { let added = 0, duplicates = 0;
      (b.p_reviews || []).forEach(r => { const ex = backend.tables.customer_reviews.find(x => x.k === key(r));
        if (!ex) { n += 1; backend.tables.customer_reviews.push({ id: '00000000-0000-4000-8000-' + String(n).padStart(12, '0'), k: key(r), channel: r.channel, stars: r.stars, review_text: r.text, review_date: r.date || null, product: r.product || '', status: 'new', status_at: null, added_at: new Date(Date.parse('2026-11-24T18:00:00Z') + n * 1000).toISOString() }); added += 1; }
        else if (ex.status === 'removed') { ex.status = 'new'; added += 1; } else duplicates += 1; });
      return { ok: true, added, duplicates, refused: 0 }; };
    backend.rpc.set_customer_review_status = (b) => { const x = backend.tables.customer_reviews.find(r => r.id === b.p_id); if (x) { x.status = b.p_status; x.status_at = '2026-11-24T18:05:00Z'; } return { ok: !!x, id: b.p_id, status: b.p_status }; };
  };
  const rpcs = (backend, name) => backend.requests.filter(r => r.rpc === name).map(r => r.body);
  const reads = (backend) => backend.requests.filter(r => r.table === 'customer_reviews' && !r.params.some(([k, v]) => k === 'limit' && v === '0'));
  // Feature Flags asks once whether the table exists (select=*, no rows) to show "installed"; that is not the Reviews page asking
  const probes = (backend) => backend.requests.filter(r => r.table === 'customer_reviews' && !(r.params.some(([k, v]) => k === 'limit' && v === '0') && r.params.some(([k, v]) => k === 'select' && v === '*')));

  test('switch off (as shipped): the reviews stay in this browser and nothing is asked of the database for them', async ({ page, backend }) => {
    install(backend); await flags(page, false, KEPT);
    await login(page); await gotoPage(page, 'reviewsPanel');
    const P = page.locator('#reviewsPanel');
    await expect(P.locator('[data-rikept]')).toHaveAttribute('data-rikept', 'browser');
    await expect(P.locator('[data-rireview]')).toHaveCount(1);
    await P.locator('#riTextIn').fill('SYNTHETIC a new one'); await P.locator('[data-ri="add-one"]').click();
    await expect(P.locator('[data-rimessage]')).toHaveText('Review added.');
    await gotoPage(page, 'attentionPanel');
    await expect(page.locator('#attentionFeedHost [data-feedkind="review"]')).toHaveCount(1);
    await page.waitForTimeout(500);
    expect(probes(backend)).toEqual([]);
    expect(rpcs(backend, 'add_customer_reviews').concat(rpcs(backend, 'set_customer_review_status'))).toEqual([]);
    expect(backend.tables.customer_reviews).toEqual([]);
  });

  test('switched on and installed: what this browser held moves to the database once; adding, answering and removing are saved there; another device shows the same, and an old copy cannot bring a removed review back', async ({ page, backend, pageErrors }) => {
    install(backend); await flags(page, true, KEPT);
    await login(page); await gotoPage(page, 'reviewsPanel');
    const P = page.locator('#reviewsPanel'), cards = P.locator('[data-rireview]');
    await expect(P.locator('[data-rikept]')).toHaveAttribute('data-rikept', 'database');
    await expect(P.locator('[data-rikept]')).toHaveText('Kept in the database: the same on every phone and computer, for you and the administrators.');
    // moved once: both reviews, and the one that was already answered keeps its mark
    expect(rpcs(backend, 'add_customer_reviews').length).toBe(1);
    expect(rpcs(backend, 'add_customer_reviews')[0].p_reviews.map(r => [r.channel, r.stars, r.text, r.date])).toEqual([['tiktok', 3, 'SYNTHETIC It is fine', '2026-11-21'], ['etsy', 2, 'SYNTHETIC The pump stopped working.', '2026-11-20']]);
    expect(rpcs(backend, 'set_customer_review_status')).toEqual([{ p_id: '00000000-0000-4000-8000-000000000001', p_status: 'answered' }]);
    await expect(cards).toHaveCount(1);
    await expect(P.locator('[data-risummary]')).toContainText('1 review needs you');
    // a new one is saved in the database
    await P.locator('#riStarsIn').selectOption('1'); await P.locator('#riChannelIn').selectOption('amazon'); await P.locator('#riTextIn').fill('SYNTHETIC it leaked in the box');
    await P.locator('[data-ri="add-one"]').click();
    await expect(P.locator('[data-rimessage]')).toHaveText('Review added.');
    await expect(cards).toHaveCount(2);
    expect(backend.tables.customer_reviews.map(r => r.review_text)).toEqual(['SYNTHETIC It is fine', 'SYNTHETIC The pump stopped working.', 'SYNTHETIC it leaked in the box']);
    // answered: saved with the row's own id
    await P.locator('[data-rireview]', { hasText: 'it leaked in the box' }).locator('[data-ri="answered"]').click();
    await expect(P.locator('[data-rimessage]')).toHaveText('Marked as answered.');
    expect(backend.tables.customer_reviews[2].status).toBe('answered');
    // Remove marks it removed; the row stays
    const pump = P.locator('[data-rireview]', { hasText: 'The pump stopped working' });
    await pump.locator('[data-ri="remove"]').click(); await pump.locator('[data-ri="remove"]').click();
    await expect(P.locator('[data-rimessage]')).toHaveText('Review removed from the list. It stays on the record, marked as removed.');
    await expect(cards).toHaveCount(0);
    expect(backend.tables.customer_reviews.map(r => r.status)).toEqual(['answered', 'removed', 'answered']);
    expect(backend.tables.customer_reviews.length).toBe(3);
    // "another device", which still holds an old copy with the removed review: Home is opened first, not the Reviews page
    const adds = rpcs(backend, 'add_customer_reviews').length;
    await page.evaluate((v) => localStorage.setItem('he_review_inbox_v1', v), KEPT);
    await page.reload(); await expect(page.locator('#dash')).toBeVisible(); await gotoPage(page, 'attentionPanel');
    await expect(page.locator('#attentionFeedHost')).toBeVisible();
    await expect(page.locator('#attentionFeedHost [data-feedkind="review"]')).toHaveCount(0);   // nothing waits: one removed, two answered
    await gotoPage(page, 'reviewsPanel');
    await expect(P.locator('[data-rikept]')).toHaveAttribute('data-rikept', 'database');
    await P.locator('[data-rifilter="all"]').click();
    await expect(cards).toHaveCount(2);
    await expect(P).not.toContainText('The pump stopped working');
    expect(rpcs(backend, 'add_customer_reviews').length).toBe(adds);                           // the old copy added nothing
    expect(backend.tables.customer_reviews.map(r => r.status)).toEqual(['answered', 'removed', 'answered']);
    // putting one back travels too
    await P.locator('[data-rireview]', { hasText: 'It is fine' }).locator('[data-ri="new"]').click();
    await expect(P.locator('[data-rimessage]')).toHaveText('Put back among the ones that need you.');
    expect(backend.tables.customer_reviews[0].status).toBe('new');
    await gotoPage(page, 'attentionPanel');
    await expect(page.locator('#attentionFeedHost [data-feedkind="review"]')).toHaveCount(1);
    expect(writes(backend)).toEqual([]);                                                       // only through the two functions, never a direct write
    expect(pageErrors).toEqual([]);
  });

  test('switched on but not installed: said in plain words, and the page keeps working in this browser', async ({ page, backend, pageErrors }) => {
    await flags(page, true, KEPT);
    await page.route('**/rest/v1/customer_reviews?*', route => route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST205', message: "Could not find the table 'public.customer_reviews' in the schema cache" }) }));
    await login(page); await gotoPage(page, 'reviewsPanel');
    const P = page.locator('#reviewsPanel');
    await expect(P.locator('[data-rikept]')).toHaveText('Kept in this browser only: the database step for reviews (draft 60) is not installed yet.');
    await expect(P.locator('[data-rireview]')).toHaveCount(1);
    await P.locator('#riTextIn').fill('SYNTHETIC still works here'); await P.locator('#riStarsIn').selectOption('2'); await P.locator('[data-ri="add-one"]').click();
    await expect(P.locator('[data-rimessage]')).toHaveText('Review added.');
    await expect(P.locator('[data-rireview]')).toHaveCount(2);
    expect(rpcs(backend, 'add_customer_reviews')).toEqual([]);
    expect(pageErrors.filter(e => !/404|PGRST|Failed to load resource/.test(e))).toEqual([]);   // the 404 is this test's own "not installed"
  });

  test('the database refuses a save: nothing changes on the page and the reason is shown', async ({ page, backend, pageErrors }) => {
    install(backend); await flags(page, true, null);
    await login(page); await gotoPage(page, 'reviewsPanel');
    const P = page.locator('#reviewsPanel');
    await expect(P.locator('[data-rikept]')).toHaveAttribute('data-rikept', 'database');
    await page.route('**/rest/v1/rpc/add_customer_reviews*', route => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ code: '42501', message: 'Only the owner and administrators can keep reviews.' }) }));
    await P.locator('#riTextIn').fill('SYNTHETIC will be refused'); await P.locator('[data-ri="add-one"]').click();
    await expect(P.locator('[data-rimessage]')).toHaveText('Not added: Only the owner and administrators can keep reviews.');
    await expect(P.locator('[data-rireview]')).toHaveCount(0);
    await expect(P.locator('#riTextIn')).toHaveValue('SYNTHETIC will be refused');              // what was typed is still there to try again
    expect(backend.tables.customer_reviews).toEqual([]);
    expect(pageErrors.filter(e => !/403|42501|Failed to load resource/.test(e))).toEqual([]);
  });
});

// Found on a second reading of the move-to-the-database step (Nov 24): if the first save
// failed, the reviews held in the browser were overwritten by the (empty) database list.
// Now nothing is switched over unless every review was taken, and a long list goes in parts.
test.describe('reviews on every device: moving what the browser held', () => {
  test.beforeEach(async ({ page }, ti) => { test.skip(ti.project.name !== 'desktop', 'run once'); await page.clock.setFixedTime(new Date(NOW)); });
  const kept = (n) => JSON.stringify({ reviews: Array.from({ length: n }, (_, i) => ({ stars: 1 + (i % 5), channel: 'etsy', date: '2026-11-20', text: 'SYNTHETIC kept review number ' + i, status: 'new', addedAt: NOW - i * 1000 })) });
  const flags = (page, v) => page.addInitScript((val) => { try { localStorage.setItem('he_review_inbox', 'on'); localStorage.setItem('he_review_store', 'on'); if (!sessionStorage.getItem('seeded')) { localStorage.setItem('he_review_inbox_v1', val); sessionStorage.setItem('seeded', '1'); } } catch (e) {} }, v);
  const install = (backend) => { backend.tables.customer_reviews = []; let n = 0;
    backend.rpc.add_customer_reviews = (b) => { (b.p_reviews || []).forEach(r => { n += 1; backend.tables.customer_reviews.push({ id: '00000000-0000-4000-8000-' + String(n).padStart(12, '0'), channel: r.channel, stars: r.stars, review_text: r.text, review_date: r.date || null, product: '', status: 'new', status_at: null, added_at: new Date(Date.parse('2026-11-24T18:00:00Z') + n * 1000).toISOString() }); }); return { ok: true, added: (b.p_reviews || []).length, duplicates: 0, refused: 0 }; }; };
  const adds = (backend) => backend.requests.filter(r => r.rpc === 'add_customer_reviews').map(r => r.body.p_reviews.length);

  test('the first save fails: the reviews stay in this browser, untouched, and the page says nothing was lost; the next visit moves them', async ({ page, backend, pageErrors }) => {
    install(backend); await flags(page, kept(3));
    let fail = true;
    await page.route('**/rest/v1/rpc/add_customer_reviews*', route => (fail ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: '503', message: 'SYNTHETIC the database is busy' }) }) : route.fallback()));
    await login(page); await gotoPage(page, 'reviewsPanel');
    const P = page.locator('#reviewsPanel');
    await expect(P.locator('[data-rikept]')).toContainText('Nothing was lost.');
    await expect(P.locator('[data-rikept]')).toHaveAttribute('data-rikept', 'browser');
    await P.locator('[data-rifilter="all"]').click();
    await expect(P.locator('[data-rireview]')).toHaveCount(3);
    expect(JSON.parse(await page.evaluate(() => localStorage.getItem('he_review_inbox_v1'))).reviews.length).toBe(3);
    expect(backend.tables.customer_reviews).toEqual([]);
    // the next visit, with the database answering again
    fail = false;
    await page.reload(); await expect(page.locator('#dash')).toBeVisible(); await gotoPage(page, 'reviewsPanel');
    await expect(P.locator('[data-rikept]')).toHaveAttribute('data-rikept', 'database');
    await P.locator('[data-rifilter="all"]').click();
    await expect(P.locator('[data-rireview]')).toHaveCount(3);
    expect(backend.tables.customer_reviews.length).toBe(3);
    expect(pageErrors.filter(e => !/503|Failed to load resource/.test(e))).toEqual([]);          // the 503 is this test's own failure
  });

  test('more than 200 reviews held in the browser go to the database in parts, all of them', async ({ page, backend, pageErrors }) => {
    install(backend); await flags(page, kept(250));
    await login(page); await gotoPage(page, 'reviewsPanel');
    const P = page.locator('#reviewsPanel');
    await expect(P.locator('[data-rikept]')).toHaveAttribute('data-rikept', 'database');
    expect(adds(backend)).toEqual([200, 50]);
    expect(backend.tables.customer_reviews.length).toBe(250);
    await expect(P.locator('[data-risummary]')).toHaveAttribute('data-risummary', '250');
    expect(pageErrors).toEqual([]);
  });

  test('a review added while the page is still reading the database is saved there, not lost', async ({ page, backend, pageErrors }) => {
    install(backend); await flags(page, kept(0));
    backend.delayMs.customer_reviews = 1500;                                  // a slow connection: the first read takes a while
    await login(page); await gotoPage(page, 'reviewsPanel');
    const P = page.locator('#reviewsPanel');
    await P.locator('#riStarsIn').selectOption('2'); await P.locator('#riTextIn').fill('SYNTHETIC typed at once');
    await P.locator('[data-ri="add-one"]').click();                           // pressed before the database has answered
    await expect(P.locator('[data-rimessage]')).toHaveText('Review added.', { timeout: 15000 });
    await expect(P.locator('[data-rikept]')).toHaveAttribute('data-rikept', 'database');
    await expect(P.locator('[data-rireview]')).toHaveCount(1);
    expect(backend.tables.customer_reviews.map(r => r.review_text)).toEqual(['SYNTHETIC typed at once']);
    backend.delayMs.customer_reviews = 0;
    await page.reload(); await expect(page.locator('#dash')).toBeVisible(); await gotoPage(page, 'reviewsPanel');
    await expect(P.locator('[data-rireview]')).toHaveCount(1);
    expect(pageErrors).toEqual([]);
  });

  test('an "answered" mark made in this browser is not lost when saving it fails: nothing is switched over, and the next visit carries it', async ({ page, backend, pageErrors }) => {
    install(backend);
    backend.rpc.set_customer_review_status = (b) => { const x = backend.tables.customer_reviews.find(r => r.id === b.p_id); if (x) x.status = b.p_status; return { ok: !!x, id: b.p_id, status: b.p_status }; };
    await flags(page, JSON.stringify({ reviews: [
      { stars: 2, channel: 'etsy', date: '2026-11-20', text: 'SYNTHETIC answered before the move', status: 'answered', statusAt: NOW - 5000, addedAt: NOW - 9000 },
      { stars: 5, channel: 'etsy', date: '2026-11-21', text: 'SYNTHETIC still new', status: 'new', addedAt: NOW - 8000 }] }));
    let fail = true;
    await page.route('**/rest/v1/rpc/set_customer_review_status*', route => (fail ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: '503', message: 'SYNTHETIC the database is busy' }) }) : route.fallback()));
    await login(page); await gotoPage(page, 'reviewsPanel');
    const P = page.locator('#reviewsPanel');
    await expect(P.locator('[data-rikept]')).toContainText('Nothing was lost.');
    await expect(P.locator('[data-rikept]')).toHaveAttribute('data-rikept', 'browser');
    const here = JSON.parse(await page.evaluate(() => localStorage.getItem('he_review_inbox_v1')));
    expect(here.reviews.map(r => r.status).sort()).toEqual(['answered', 'new']);      // this browser still knows it was answered
    expect(here.from).toBeUndefined();
    // the next visit, with the database answering again: nothing is added twice, and the mark goes over
    fail = false;
    await page.reload(); await expect(page.locator('#dash')).toBeVisible(); await gotoPage(page, 'reviewsPanel');
    await expect(P.locator('[data-rikept]')).toHaveAttribute('data-rikept', 'database');
    expect(adds(backend)).toEqual([2]);
    expect(backend.tables.customer_reviews.map(r => r.review_text + ':' + r.status).sort()).toEqual(['SYNTHETIC answered before the move:answered', 'SYNTHETIC still new:new']);
    expect(JSON.parse(await page.evaluate(() => localStorage.getItem('he_review_inbox_v1'))).from).toBe('database');
    expect(pageErrors.filter(e => !/503|Failed to load resource/.test(e))).toEqual([]);          // the 503 is this test's own failure
  });

  test('the database says it would not take one of them: nothing is switched over and nothing is lost', async ({ page, backend, pageErrors }) => {
    install(backend); await flags(page, kept(3));
    const real = backend.rpc.add_customer_reviews;
    backend.rpc.add_customer_reviews = (b) => { const all = b.p_reviews || []; real({ p_reviews: all.slice(0, all.length - 1) }); return { ok: true, added: all.length - 1, duplicates: 0, refused: 1 }; };
    await login(page); await gotoPage(page, 'reviewsPanel');
    const P = page.locator('#reviewsPanel');
    await expect(P.locator('[data-rikept]')).toContainText('Nothing was lost.');
    await P.locator('[data-rifilter="all"]').click();
    await expect(P.locator('[data-rireview]')).toHaveCount(3);
    expect(JSON.parse(await page.evaluate(() => localStorage.getItem('he_review_inbox_v1'))).reviews.length).toBe(3);
    expect(pageErrors).toEqual([]);
  });

  test('the database counts two of them as one and the same review: it has them all, so the move finishes instead of being tried forever', async ({ page, backend, pageErrors }) => {
    install(backend); await flags(page, kept(2));
    const real = backend.rpc.add_customer_reviews;
    backend.rpc.add_customer_reviews = (b) => { const all = b.p_reviews || []; real({ p_reviews: all.slice(0, 1) }); return { ok: true, added: 1, duplicates: all.length - 1, refused: 0 }; };
    await login(page); await gotoPage(page, 'reviewsPanel');
    const P = page.locator('#reviewsPanel');
    await expect(P.locator('[data-rikept]')).toHaveAttribute('data-rikept', 'database');
    await P.locator('[data-rifilter="all"]').click();
    await expect(P.locator('[data-rireview]')).toHaveCount(1);
    expect(adds(backend)).toEqual([2]);
    expect(pageErrors).toEqual([]);
  });

  test('a typed review the database would not take is said so, and what was typed stays', async ({ page, backend, pageErrors }) => {
    install(backend); await flags(page, kept(0));
    backend.rpc.add_customer_reviews = () => ({ ok: true, added: 0, duplicates: 0, refused: 1 });
    await login(page); await gotoPage(page, 'reviewsPanel');
    const P = page.locator('#reviewsPanel');
    await expect(P.locator('[data-rikept]')).toHaveAttribute('data-rikept', 'database');
    await P.locator('#riStarsIn').selectOption('4'); await P.locator('#riTextIn').fill('SYNTHETIC refused by the database');
    await P.locator('[data-ri="add-one"]').click();
    await expect(P.locator('[data-rimessage]')).toContainText('Not added: the database would not take that review');
    await expect(P.locator('#riTextIn')).toHaveValue('SYNTHETIC refused by the database');
    await expect(P.locator('[data-rireview]')).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test('the database takes only some of them: nothing is switched over and nothing is lost', async ({ page, backend, pageErrors }) => {
    install(backend); await flags(page, kept(3));
    const real = backend.rpc.add_customer_reviews;
    backend.rpc.add_customer_reviews = (b) => real({ p_reviews: (b.p_reviews || []).slice(0, 2) });   // one is silently not taken
    await login(page); await gotoPage(page, 'reviewsPanel');
    const P = page.locator('#reviewsPanel');
    await expect(P.locator('[data-rikept]')).toContainText('Nothing was lost.');
    await P.locator('[data-rifilter="all"]').click();
    await expect(P.locator('[data-rireview]')).toHaveCount(3);
    expect(JSON.parse(await page.evaluate(() => localStorage.getItem('he_review_inbox_v1'))).reviews.length).toBe(3);
    expect(pageErrors).toEqual([]);
  });
});
