// Content helper (owner, Nov 24: "it will have to have ready different options so if I
// don't like how a picture or video or email or text or font looks it must already
// have a bunch of different options for me, and be able to make a new one any time").
// assets/sales/he-content-helper.js and its page. DRAFTS ONLY: nothing is posted, sent
// or spent. Every product and story here is made up.
const H = require('../../assets/sales/he-content-helper.js');
const deps = { claims: require('../../assets/sales/he-sales-claims.js') };
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const INPUT = { product: 'SYNTHETIC Cocoa Lotion', story: 'a rich chocolate-scented body lotion we make in small batches, and our customers say it smells like dessert' };
const CLAIM = { product: 'SYNTHETIC Cocoa Lotion', story: 'this lotion heals eczema and cures every skin problem in one week, we promise' };

test.describe('the rules (no browser)', () => {
  test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

  test('what is needed first: a product name and a story of a sentence or two', () => {
    expect(H.checkInput(INPUT)).toMatchObject({ ok: true, problems: [] });
    expect(H.checkInput({ product: '', story: 'short' }).problems).toEqual(['Type the product\'s name.',
      'Write your story in a sentence or two (at least 20 characters): what it is, who it is for, or what a customer said.']);
    expect(H.checkInput({ product: 'x'.repeat(81), story: 'y'.repeat(601) }).problems).toHaveLength(2);
    for (const junk of [null, undefined, 'x', 7, [], {}]) expect(H.checkInput(junk).ok).toBe(false);
  });

  test('several ready options for every kind and tone; "others" walks through them all without a repeat and says when it is the last set', () => {
    for (const kind of Object.keys(H.KINDS)) {
      for (const tone of Object.keys(H.TONES)) {
        const first = H.options(Object.assign({ kind, tone }, INPUT), deps);
        expect(first.ok).toBe(true);
        expect(first.options.length, kind + ' ' + tone).toBe(3);
        expect(first.total, kind + ' ' + tone).toBeGreaterThanOrEqual(9);          // at least three sets of three
        const seen = new Set();
        for (let r = 0; r < first.rounds; r += 1) {
          const set = H.options(Object.assign({ kind, tone, round: r }, INPUT), deps);
          expect(set.last).toBe(r === first.rounds - 1);
          for (const o of set.options) {
            expect(seen.has(o.text), 'a repeat: ' + o.text).toBe(false); seen.add(o.text);
            expect(o.chars).toBe(o.text.length);
            expect(o.chars, o.text).toBeLessThanOrEqual(H.KINDS[kind].limit);
            expect(o.blocked).toBe(false);
            expect(o.text).not.toMatch(/\{p\}|undefined|null|\s{2,}/);
          }
        }
        expect(seen.size).toBe(first.total);
        // after the last set it starts again from the first
        expect(H.options(Object.assign({ kind, tone, round: first.rounds }, INPUT), deps).options).toEqual(first.options);
      }
    }
    // the three tones really read differently
    const texts = Object.keys(H.TONES).map(tone => H.options(Object.assign({ kind: 'post', tone }, INPUT), deps).options[0].text);
    expect(new Set(texts).size).toBe(3);
    // how many at a time is the caller's choice (1 to 6); anything else means 3
    expect(H.options(Object.assign({ kind: 'post', count: 6 }, INPUT), deps).options).toHaveLength(6);
    expect(H.options(Object.assign({ kind: 'post', count: 99 }, INPUT), deps).options).toHaveLength(3);
  });

  test('it never invents a fact: the only facts in a draft are the product name and the owner\'s own story', () => {
    const frame = /^(Meet|This is|About|Say hello to|We want you to meet|Here is|Introducing|Discover|See it on our site|Find it in our shop|Take a look|Come take a look|We would love for you to try it|Have a look, we think you will like it|Yours to discover|See the details in our shop|A closer look awaits|and we love it|made with care|That is)$/;
    const story = INPUT.story.charAt(0).toUpperCase() + INPUT.story.slice(1) + '.';
    for (const tone of Object.keys(H.TONES)) {
      const r = H.options(Object.assign({ kind: 'email', tone, count: 6 }, INPUT), deps);
      for (const o of r.options.filter(x => ['story', 'product', 'short'].includes(x.angle))) {
        expect(o.text).toContain(story);                                        // the story, whole and unchanged
        const rest = o.text.replace(story, '|').replace(new RegExp(INPUT.product, 'g'), '|').split(/[|.!:,]/).map(t => t.trim()).filter(Boolean);
        for (const part of rest) expect(part, o.text).toMatch(frame);           // everything else is neutral wording
      }
    }
    // a long story is cut at a word and marked, never in the middle of one
    const long = H.options({ kind: 'adText', product: 'SYNTHETIC Lotion', story: 'word '.repeat(60).trim() }, deps).options[0];
    expect(long.text).toContain('word…');
    expect(long.chars).toBeLessThanOrEqual(125);
    // a name too long for a headline: those headlines are left out, never cut
    const name = 'SYNTHETIC Extremely Long Product Name Indeed';
    const heads = H.options({ kind: 'adHeadline', count: 6, product: name, story: INPUT.story }, deps);
    for (const o of heads.options) { expect(o.chars).toBeLessThanOrEqual(40); if (o.text.includes('SYNTHETIC')) expect(o.text).toContain(name); }
  });

  test('the claim firewall: a story with a health claim blocks every draft made from it, and says which words', () => {
    for (const kind of Object.keys(H.KINDS)) {
      const r = H.options(Object.assign({ kind, count: 6 }, CLAIM), deps);
      const withStory = r.options.filter(o => /heals|cures|eczema/i.test(o.text));
      expect(withStory.length, kind).toBeGreaterThan(0);
      for (const o of withStory) { expect(o.blocked).toBe(true); expect(o.findings.map(f => f.match).join(' ')).toMatch(/heals|cures|eczema/); }
    }
    expect(H.video(CLAIM, deps)).toMatchObject({ ok: true, blocked: true });
    expect(H.week(CLAIM, deps).blocked).toBeGreaterThan(0);
    // without the wording check everything is blocked (it fails closed)
    for (const d of [null, {}, { claims: {} }, { claims: { scan: () => null } }]) {
      expect(H.options(Object.assign({ kind: 'post' }, INPUT), d).options.every(o => o.blocked && o.findings[0].family === 'unavailable')).toBe(true);
      expect(H.video(INPUT, d).blocked).toBe(true);
      expect(H.checkOwn('A plain sentence.', 'post', d)).toMatchObject({ ok: false, blocked: true });
    }
  });

  test('a short video: three lines to say and four things to film, three versions', () => {
    const seen = new Set();
    for (let r = 0; r < 3; r += 1) {
      const v = H.video(Object.assign({ tone: 'friendly', round: r }, INPUT), deps);
      expect(v).toMatchObject({ ok: true, blocked: false, round: r, rounds: 3, last: r === 2 });
      expect(v.script).toHaveLength(3); expect(v.shots).toHaveLength(4);
      expect(v.script[0]).toContain(INPUT.product);
      expect(v.script[1]).toContain('chocolate-scented');
      seen.add(v.script.join('|') + v.shots.join('|'));
    }
    expect(seen.size).toBe(3);
    expect(H.video({}, deps)).toMatchObject({ ok: false, script: [], shots: [] });
  });

  test('a week\'s plan: something for six days and a rest day; a suggestion, never a schedule', () => {
    const w = H.week(Object.assign({ tone: 'premium' }, INPUT), deps);
    expect(w).toMatchObject({ ok: true, blocked: 0, rounds: 3 });
    expect(w.days.map(d => d.day + ':' + d.kind)).toEqual(['Monday:post', 'Tuesday:adHeadline', 'Tuesday:adText', 'Wednesday:post', 'Thursday:email', 'Friday:video', 'Saturday:post', 'Sunday:rest']);
    expect(w.days.find(d => d.kind === 'video').shots).toHaveLength(4);
    expect(new Set(w.days.map(d => d.text)).size).toBe(w.days.length);
    expect(H.week(Object.assign({ round: 1 }, INPUT), deps).days[0].text).not.toBe(H.week(INPUT, deps).days[0].text);
    expect(H.week(null, deps)).toMatchObject({ ok: false, days: [] });
  });

  test('the owner\'s own version is checked the same way: the claim check and the length', () => {
    expect(H.checkOwn('A lotion that smells like chocolate.', 'post', deps)).toMatchObject({ ok: true, chars: 36, limit: 300, blocked: false, tooLong: false });
    expect(H.checkOwn('It cures dry skin.', 'post', deps)).toMatchObject({ ok: false, blocked: true });
    expect(H.checkOwn('x'.repeat(41), 'adHeadline', deps)).toMatchObject({ ok: false, tooLong: true, limit: 40 });
    expect(H.checkOwn('   ', 'post', deps)).toMatchObject({ ok: false, empty: true });
    expect(H.checkOwn('Fine words.', 'no such kind', deps)).toMatchObject({ ok: true, limit: 500 });
    for (const junk of [null, undefined, [], {}]) expect(H.checkOwn(junk, junk, deps).ok).toBe(false);
  });

  test('six ready looks, each with a name and what it is', () => {
    expect(H.LOOKS.map(l => l.key)).toEqual(['clean', 'warm', 'bold', 'classic', 'fresh', 'night']);
    for (const l of H.LOOKS) { expect(l.name).toBeTruthy(); expect(l.what).toMatch(/\.$/); }
  });
});

const on = (page) => page.addInitScript(() => { try { localStorage.setItem('he_content_helper', 'on'); } catch (e) {} });
const clip = (page) => page.addInitScript(() => { window.__copied = []; try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t) => { window.__copied.push(t); return Promise.resolve(); } } }); } catch (e) {} });
const writes = (backend) => backend.requests.filter(r => r.method !== 'GET' && r.method !== 'HEAD' && !r.rpc && String(r.path || '').startsWith('/rest/v1/'));

test.describe('the Content Helper page', () => {
  test('switch off (as shipped): no page in the menu, nothing drawn, nothing kept', async ({ page }) => {
    await login(page);
    await expect(page.locator('#sidebarNav')).not.toContainText('Content Helper');
    await expect(page.locator('#contentHelperPanel')).toBeEmpty();
    expect(await page.evaluate(() => localStorage.getItem('he_content_helper_v1'))).toBeNull();
  });

  test('type a product and a story: three ready drafts, others on request, tones, copy, your own version, six looks; nothing is posted or written', async ({ page, backend, pageErrors }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    await on(page); await clip(page);
    await login(page);
    await gotoPage(page, 'contentHelperPanel');
    const P = page.locator('#contentHelperPanel');
    await expect(P.locator('[data-chnosend]')).toContainText('Nothing is posted, sent or spent from this page.');
    await expect(P).toContainText('not written by an AI model');
    await expect(P.locator('[data-chresult]')).toHaveAttribute('data-chresult', 'waiting');
    await page.fill('#chProduct', INPUT.product);
    await expect(P.locator('[data-chproblems]')).toContainText('Write your story in a sentence or two');
    await page.fill('#chStory', INPUT.story);
    await expect(P.locator('[data-chresult]')).toHaveAttribute('data-chresult', 'ready');
    // three drafts of a post, plain tone
    const opts = P.locator('[data-choption]');
    await expect(opts).toHaveCount(3);
    await expect(P.locator('[data-chkind="post"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(P.locator('[data-chtone="plain"]')).toHaveAttribute('aria-pressed', 'true');
    const want = H.options(Object.assign({ kind: 'post', tone: 'plain' }, INPUT), deps);
    await expect(opts.nth(0).locator('.chOptionText')).toHaveText(want.options[0].text);
    await expect(P.locator('[data-chset]')).toHaveAttribute('data-chset', '1/6');
    // others: the next three, different ones; the button keeps the focus
    await P.locator('[data-ch="more"]').click();
    await expect(P.locator('[data-chset]')).toHaveAttribute('data-chset', '2/6');
    await expect(opts.nth(0).locator('.chOptionText')).toHaveText(H.options(Object.assign({ kind: 'post', tone: 'plain', round: 1 }, INPUT), deps).options[0].text);
    await expect(P.locator('[data-ch="more"]')).toBeFocused();
    // another tone starts from the first set again and reads differently
    await P.locator('[data-chtone="friendly"]').click();
    await expect(P.locator('[data-chset]')).toHaveAttribute('data-chset', '1/6');
    const friendly = H.options(Object.assign({ kind: 'post', tone: 'friendly' }, INPUT), deps).options[0].text;
    await expect(opts.nth(0).locator('.chOptionText')).toHaveText(friendly);
    await expect(P.locator('[data-chtone="friendly"]')).toBeFocused();
    // copy a draft
    await opts.nth(0).locator('[data-ch="copy"]').click();
    expect(await page.evaluate(() => window.__copied)).toEqual([friendly]);
    // every kind gives drafts; a headline is short
    await P.locator('[data-chkind="adHeadline"]').click();
    await expect(opts).toHaveCount(3);
    for (const t of await opts.locator('.chOptionText').allTextContents()) expect(t.length).toBeLessThanOrEqual(40);
    await P.locator('[data-chkind="email"]').click();
    await expect(opts).toHaveCount(3);
    // a short video: what to say and what to film, and another on request
    await P.locator('[data-chkind="video"]').click();
    await expect(P.locator('[data-chscript] li')).toHaveCount(3);
    await expect(P.locator('[data-chshots] li')).toHaveCount(4);
    const firstShot = await P.locator('[data-chshots] li').first().textContent();
    await P.locator('[data-ch="more"]').click();
    await expect(P.locator('[data-chshots] li').first()).not.toHaveText(firstShot);
    await P.locator('[data-choption="video"] [data-ch="copy"]').click();
    expect((await page.evaluate(() => window.__copied))[1]).toMatch(/^SAY\n1\. .+\n\nFILM\n1\. /s);
    // a week's plan
    await P.locator('[data-chkind="week"]').click();
    await expect(P.locator('[data-chweek] tbody tr')).toHaveCount(8);
    await expect(P.locator('[data-chweek]')).toContainText('Sunday');
    await P.locator('[data-ch="copy"][data-chid="week"]').click();
    expect((await page.evaluate(() => window.__copied))[2]).toContain('Monday — Post');
    // your own version: start from a draft, change it, the check is live
    await P.locator('[data-chkind="post"]').click();
    await opts.nth(1).locator('[data-ch="use"]').click();
    await expect(page.locator('#chOwn')).toBeFocused();
    await expect(page.locator('#chOwn')).toHaveValue(H.options(Object.assign({ kind: 'post', tone: 'friendly' }, INPUT), deps).options[1].text);
    await expect(P.locator('[data-chown]')).toHaveAttribute('data-chown', 'ok');
    await page.fill('#chOwn', 'Our lotion cures dry skin for good.');
    await expect(P.locator('[data-chown]')).toHaveAttribute('data-chown', 'blocked');
    await expect(P.locator('[data-chown] [data-chblocked]')).toContainText('“cures”');
    await expect(P.locator('[data-ch="copy-own"]')).toBeDisabled();
    await expect(P.locator('[data-chcard]')).toContainText('Your own version does not pass the check yet.');
    await page.fill('#chOwn', 'Chocolate, in a bottle. Meet our new body lotion.');
    await expect(P.locator('[data-chown]')).toHaveAttribute('data-chown', 'ok');
    await P.locator('[data-ch="copy-own"]').click();
    expect((await page.evaluate(() => window.__copied))[3]).toBe('Chocolate, in a bottle. Meet our new body lotion.');
    // six looks: each really changes the card's colours or lettering
    await expect(P.locator('[data-chlook]')).toHaveCount(6);
    const styles = new Set();
    for (const key of H.LOOKS.map(l => l.key)) {
      await P.locator(`[data-chlook="${key}"]`).click();
      await expect(P.locator('[data-chcard]')).toHaveAttribute('data-chcard', key);
      await expect(P.locator(`[data-chlook="${key}"]`)).toHaveAttribute('aria-pressed', 'true');
      styles.add(await P.locator('[data-chcard]').evaluate(el => { const c = getComputedStyle(el); return [c.backgroundColor, c.color, c.fontFamily, c.fontWeight, c.textAlign].join('|'); }));
    }
    expect(styles.size).toBe(6);
    await expect(P.locator('[data-chcard] .chCardText')).toHaveText('Chocolate, in a bottle. Meet our new body lotion.');
    await expect(P.locator('[data-chcard] .chCardName')).toHaveText(INPUT.product);
    // it is all still there after a reload, and nothing was written to the database
    await page.reload();
    await expect(page.locator('#dash')).toBeVisible();
    await gotoPage(page, 'contentHelperPanel');
    await expect(page.locator('#chProduct')).toHaveValue(INPUT.product);
    await expect(page.locator('#chOwn')).toHaveValue('Chocolate, in a bottle. Meet our new body lotion.');
    await expect(P.locator('[data-chcard]')).toHaveAttribute('data-chcard', 'night');
    await expect(P.locator('[data-chtone="friendly"]')).toHaveAttribute('aria-pressed', 'true');
    expect(writes(backend)).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('a story with a health claim: every draft made from it is shown as blocked, with the words, and cannot be copied or used', async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    await on(page); await clip(page);
    await login(page);
    await gotoPage(page, 'contentHelperPanel');
    const P = page.locator('#contentHelperPanel');
    await page.fill('#chProduct', CLAIM.product);
    await page.fill('#chStory', CLAIM.story);
    await expect(P.locator('[data-choption]')).toHaveCount(3);
    await expect(P.locator('[data-choption][data-chstate="blocked"]')).toHaveCount(3);
    await expect(P.locator('[data-chblocked]').first()).toContainText('health or medical claim');
    await expect(P.locator('[data-chblocked]').first()).toContainText('“heals”');
    await expect(P.locator('[data-choption] [data-ch="copy"]')).toHaveCount(0);
    await expect(P.locator('[data-choption] [data-ch="use"]')).toHaveCount(0);
    await expect(P.locator('[data-chcard] .chCardText')).toHaveText('Your words appear here.');     // blocked wording is never shown on the card
    await P.locator('[data-chkind="video"]').click();
    await expect(P.locator('[data-choption="video"]')).toHaveAttribute('data-chstate', 'blocked');
    await expect(P.locator('[data-choption="video"] [data-ch="copy"]')).toHaveCount(0);
    await P.locator('[data-chkind="week"]').click();
    await expect(P.locator('[data-chweek] tr[data-chstate="blocked"]').first()).toBeVisible();
    await expect(P.locator('[data-ch="copy"][data-chid="week"]')).toHaveCount(0);
    expect(await page.evaluate(() => window.__copied)).toEqual([]);
    expect(writes(backend)).toEqual([]);
  });

  test('on a phone: the page fits, the drafts and the card do not run off the side', async ({ page, pageErrors }, ti) => {
    test.skip(ti.project.name === 'desktop', 'phone size only');
    await on(page);
    await login(page);
    await gotoPage(page, 'contentHelperPanel');
    await page.fill('#chProduct', INPUT.product);
    await page.fill('#chStory', INPUT.story + ' ' + 'averyveryverylongwordwithoutanyspaces'.repeat(4));
    const P = page.locator('#contentHelperPanel');
    await expect(P.locator('[data-choption]')).toHaveCount(3);
    for (const kind of ['post', 'video', 'week']) {
      await P.locator(`[data-chkind="${kind}"]`).click();
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over, kind).toBeLessThanOrEqual(1);
    }
    const box = await P.locator('[data-chcard]').boundingBox();
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
    expect(pageErrors).toEqual([]);
  });
});
