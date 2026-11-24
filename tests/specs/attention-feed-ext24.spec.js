// One attention feed (owner request, Nov 23: "Needs your attention" as the main
// screen, everything in one chain, most urgent first, reply from there). The pure
// builder (assets/views/he-attention-feed.js) and the Home section behind the
// he_attention_feed switch (OFF by default, on Feature Flags). The feed never
// writes: "Later" is kept in this browser; "Dismiss" uses the reminder's own
// button; replies are copied, never sent. Every value is made up.
const F = require('../../assets/views/he-attention-feed.js');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { unnamedControls, contrastFailures } = require('../helpers/a11y-audit');

const node = (ti) => test.skip(ti.project.name !== 'desktop', 'Node-only; run once');
const NOW = Date.parse('2026-11-24T15:00:00Z');
const memStore = () => ({ d: {}, getItem(k) { return k in this.d ? this.d[k] : null; }, setItem(k, v) { this.d[k] = String(v); } });
const SRC = () => ({
  attention: [
    { item_type: 'manual', source_id: 'r1', title: 'SYNTHETIC call the supplier', due_at: '2026-11-24T20:00:00Z', priority: 'normal' },
    { item_type: 'task', source_id: 't1', title: 'SYNTHETIC label the batch', due_at: '2026-11-20T10:00:00Z' },
    { item_type: 'approval', source_id: 'a1', title: 'SYNTHETIC refund', priority: 'high' },
    { item_type: 'calendar_event', source_id: 'c1', title: 'SYNTHETIC market day', due_at: '2026-11-30T10:00:00Z' }],
  checks: [
    { key: 'overdueTasks', level: 'action', title: 'Overdue tasks', count: 1, page: 'tasksPanel' },
    { key: 'questionsToReview', level: 'action', title: 'Customer questions waiting', count: 2, page: 'inquiriesPanel' },
    { key: 'negativeStock', level: 'critical', title: 'Stock below zero', count: 2, page: 'inventoryPanel' },
    { key: 'backups', level: 'info', title: 'Backups: not verified here', count: null }],
  questions: [
    { id: 'q1', customer_name: 'SYNTHETIC Ana', channel: 'email', question_text: 'Is it safe for kids?', status: 'needs_review', sensitive: true, ai_draft_reply: 'SYNTHETIC draft for Ana' },
    { id: 'q2', customer_name: 'SYNTHETIC Bo', question_text: 'Where is my order?', status: 'new', created_at: '2026-11-24T14:00:00Z' },
    { id: 'q3', customer_name: 'SYNTHETIC Cy', question_text: 'Done already', status: 'answered' }],
  money: { open: 3 }, tax: { count: 1 }, nightly: null });

test.describe('the feed builder (no browser)', () => {
  test('one list, most urgent first; summary checks are not repeated when their items are listed', ({}, ti) => {
    node(ti);
    const items = F.buildFeed(SRC(), NOW);
    expect(items.map(i => i.level)).toEqual([...items.map(i => i.level)].sort((a, b) => F.LEVELS.indexOf(a) - F.LEVELS.indexOf(b)));
    const ids = items.map(i => i.id);
    expect(ids).toContain('q:q1');
    expect(ids).toContain('q:q2');
    expect(ids).not.toContain('q:q3');                         // answered: not waiting
    expect(ids).not.toContain('check:overdueTasks');           // the task itself is listed
    expect(ids).not.toContain('check:questionsToReview');      // the questions themselves are listed
    expect(ids).toContain('check:negativeStock');
    const by = Object.fromEntries(items.map(i => [i.id, i]));
    expect(by['q:q1'].level).toBe('urgent');                   // sensitive
    expect(by['q:q1'].message).toEqual({ from: 'SYNTHETIC Ana', text: 'Is it safe for kids?', draft: 'SYNTHETIC draft for Ana' });
    expect(by['q:q1'].actions.map(a => a.label)).toEqual(['Copy reply', 'Answer']);
    expect(by['q:q2'].level).toBe('today');
    expect(by['na:task:t1']).toMatchObject({ level: 'urgent', overdue: true, page: 'tasksPanel' });
    expect(by['na:approval:a1'].level).toBe('urgent');         // high priority
    expect(by['na:manual:r1']).toMatchObject({ level: 'today', actions: [{ kind: 'dismiss', label: 'Dismiss', id: 'r1' }] });
    expect(by['na:calendar_event:c1'].level).toBe('info');     // not due yet
    expect(by['check:negativeStock']).toMatchObject({ level: 'urgent', kind: 'stock', title: 'Stock below zero: 2' });
    expect(by['money:open']).toMatchObject({ level: 'today', title: '3 money differences to look at', page: 'accountingPanel' });
    expect(by['tax:due']).toMatchObject({ level: 'today', title: '1 sales tax rate needs a re-check', page: 'taxRecordsPanel' });
    // when the questions could not be read (null), the summary check stands in for them
    const noQ = F.buildFeed(Object.assign(SRC(), { questions: null }), NOW).map(i => i.id);
    expect(noQ).toContain('check:questionsToReview');
    // a check that could not run is never hidden behind the items
    const unk = F.buildFeed(Object.assign(SRC(), { checks: [{ key: 'overdueTasks', level: 'unknown', title: 'Overdue tasks', count: null }] }), NOW);
    expect(unk.find(i => i.id === 'check:overdueTasks')).toMatchObject({ level: 'today', badge: 'Could not check' });
    // the nightly check
    expect(F.buildFeed({ nightly: { state: 'problems', problems: [{ key: 'fail', title: 'The nightly check found problems', level: 'urgent' }] } }, NOW)[0].level).toBe('urgent');
    expect(F.buildFeed({ nightly: { state: 'unknown', reason: 'x' } }, NOW)[0]).toMatchObject({ level: 'today', badge: 'Could not check' });
  });

  test('filters, counts, "all caught up", and Later (until tomorrow, or until it changes)', ({}, ti) => {
    node(ti);
    const items = F.buildFeed(SRC(), NOW);
    const all = F.view(items, { now: NOW });
    expect(all.counts).toEqual({ urgent: 4, today: 4, info: 2 });
    expect(all.needYou).toBe(8);
    expect(all.caughtUp).toBe(false);
    expect(F.view(items, { now: NOW, filter: 'message' }).items.map(i => i.id)).toEqual(['q:q1', 'q:q2']);
    expect(F.view(items, { now: NOW, filter: 'money' }).items.map(i => i.kind).sort()).toEqual(['money', 'tax']);
    expect(F.view(items, { now: NOW, filter: 'work' }).items.every(i => ['task', 'approval', 'reminder', 'incident'].includes(i.kind))).toBe(true);
    expect(F.view(items, { now: NOW, filter: 'nonsense' }).filter).toBe('all');
    const store = memStore();
    const q1 = items.find(i => i.id === 'q:q1');
    expect(F.snooze(store, q1, NOW)).toBe(true);
    let v = F.view(items, { now: NOW, snoozes: F.readSnoozes(store) });
    expect(v.snoozed).toBe(1);
    expect(v.items.map(i => i.id)).not.toContain('q:q1');
    // back by itself the next day
    expect(F.view(items, { now: NOW + 86400000, snoozes: F.readSnoozes(store) }).snoozed).toBe(0);
    // back at once when it changes (a draft reply arrives)
    const changed = F.buildFeed(Object.assign(SRC(), { questions: [Object.assign({}, SRC().questions[0], { ai_draft_reply: 'SYNTHETIC new draft' })] }), NOW);
    expect(F.view(changed, { now: NOW, snoozes: F.readSnoozes(store) }).snoozed).toBe(0);
    F.unsnoozeAll(store);
    expect(F.view(items, { now: NOW, snoozes: F.readSnoozes(store) }).snoozed).toBe(0);
    // nothing waiting
    expect(F.view(F.buildFeed({ attention: [], checks: [], questions: [] }, NOW), { now: NOW })).toMatchObject({ caughtUp: true, needYou: 0 });
  });

  test('the morning summary: the counts, the most urgent things by name, how many more; never the filter the page happens to show', ({}, ti) => {
    node(ti);
    const items = F.buildFeed(SRC(), NOW);
    const v = F.view(items, { now: NOW, snoozes: {}, filter: 'money' });
    const text = F.summaryText(v, { dayLabel: 'Tuesday, November 24' });
    const lines = text.split('\n');
    expect(lines[0]).toBe('Health Endeavors, Tuesday, November 24');
    expect(lines[1]).toBe(v.needYou + ' things need you: ' + v.counts.urgent + ' urgent, ' + v.counts.today + ' today' + (v.counts.info ? ', ' + v.counts.info + ' to know' : '') + '.');
    // every urgent line comes before every "today" line, whatever the filter
    const kinds = lines.slice(2).filter(l => l.startsWith('- [')).map(l => l.slice(3, l.indexOf(']')));
    expect(kinds.length).toBe(Math.min(F.SUMMARY_MAX, v.needYou));
    expect(kinds.join(',')).toBe(kinds.slice().sort((a, b) => (a === b ? 0 : a === 'Urgent' ? -1 : 1)).join(','));
    expect(kinds.filter(k => k === 'Urgent').length).toBe(Math.min(F.SUMMARY_MAX, v.counts.urgent));
    expect(text).not.toContain('To know]');                                   // things only "to know" are counted, not listed
    // a short limit says how many are left
    const two = F.summaryText(v, { max: 2 }).split('\n');
    expect(two[0]).toBe('Health Endeavors');
    expect(two[two.length - 1]).toBe('...and ' + (v.needYou - 2) + ' more on the dashboard.');
    // nothing needs the owner
    expect(F.summaryText(F.view([], { now: NOW }), { dayLabel: 'Monday' })).toBe('Health Endeavors, Monday\nAll caught up. Nothing needs you right now.');
    // set-aside items are mentioned, never dropped silently
    const store = memStore(); F.snooze(store, items.find(i => i.level !== 'info'), NOW);
    expect(F.summaryText(F.view(items, { now: NOW, snoozes: F.readSnoozes(store) }), {})).toContain('1 set aside until tomorrow.');
    for (const junk of [null, undefined, 'x', 7, [], {}, { counts: 'x', items: 'y', all: 7, snoozed: 'z' }]) expect(typeof F.summaryText(junk, junk)).toBe('string');
  });

  test('broken input and blocked storage never break it', ({}, ti) => {
    node(ti);
    expect(() => F.buildFeed(null, 'not a date')).not.toThrow();
    const junk = F.buildFeed({ attention: 'x', checks: [null, 5, 'a', {}], questions: [{}, { id: 'q', question_text: 'y'.repeat(50000) }], money: { open: 'abc' }, tax: { count: -2 }, nightly: 7 }, NOW);
    const long = junk.find(i => i.id === 'q:q');
    expect(long.message.text.length).toBeLessThanOrEqual(2000);
    expect(junk.some(i => i.id === 'q:')).toBe(false);          // a question without an id is left out
    expect(junk.some(i => i.kind === 'money' || i.kind === 'tax')).toBe(false);
    const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    expect(F.readSnoozes(throwing)).toEqual({});
    expect(F.snooze(throwing, { id: 'x', signature: '' }, NOW)).toBe(false);
    const badJson = { getItem() { return '{not json'; }, setItem() {} };
    expect(F.readSnoozes(badJson)).toEqual({});
    expect(F.view(null, {})).toMatchObject({ caughtUp: true, items: [] });
  });
});

// ---------- the Home section ----------
function seed(backend) {
  backend.tables.needs_attention = [
    { item_type: 'manual', source_id: '00000000-0000-4000-8000-00000000f001', title: 'SYNTHETIC call the supplier', detail: null, due_at: '2026-11-24T20:00:00Z', priority: 'normal' },
    { item_type: 'task', source_id: '00000000-0000-4000-8000-00000000f002', title: 'SYNTHETIC label the batch', detail: null, due_at: '2026-11-20T10:00:00Z', priority: 'normal' }];
  backend.tables.manual_attention_items = [{ id: '00000000-0000-4000-8000-00000000f001', title: 'SYNTHETIC call the supplier', dismissed: false }];
  backend.tables.customer_inquiries = [
    { id: '00000000-0000-4000-8000-00000000f101', customer_name: 'SYNTHETIC Ana', customer_email: 'ana@example.test', channel: 'email', question_text: 'SYNTHETIC is it safe for kids?', status: 'needs_review', severity: 'high', sensitive: true, ai_draft_reply: 'SYNTHETIC draft for Ana', created_at: '2026-11-24T09:00:00Z' },
    { id: '00000000-0000-4000-8000-00000000f102', customer_name: 'SYNTHETIC Bo', customer_email: 'bo@example.test', channel: 'shopify', question_text: 'SYNTHETIC where is my order?', status: 'new', severity: 'low', created_at: '2026-11-24T14:00:00Z' }];
}
async function on(page) { await page.addInitScript(() => { try { localStorage.setItem('he_attention_feed', 'on'); } catch (e) {} }); }
const feed = (page) => page.locator('#attentionFeedHost');
const writes = (backend) => backend.requests.filter(r => r.method && r.method !== 'GET' && r.method !== 'HEAD' && String(r.path || '').startsWith('/rest/v1/') && !r.rpc);

test.describe('the Home section', () => {
  test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date('2026-11-24T15:00:00Z')); });

  test('switch OFF (default): Home is exactly as before, no feed', async ({ page, backend }) => {
    seed(backend);
    await login(page); await gotoPage(page, 'attentionPanel');
    await expect(page.locator('#attentionWrap .attentionRow').first()).toBeVisible();
    await expect(feed(page)).toHaveCount(0);           // not even an empty box: Home is exactly as before
  });

  test('switch ON: one list at the top, most urgent first, questions as chat bubbles, filters', async ({ page, backend }) => {
    seed(backend); await on(page);
    await login(page); await gotoPage(page, 'attentionPanel');
    const f = feed(page);
    await expect(f.locator('#feedHeading')).toHaveText('Needs you now');
    await expect(f.locator('[data-feeditem="q:00000000-0000-4000-8000-00000000f101"]')).toBeVisible();
    const levels = await f.locator('[data-feeditem]').evaluateAll(els => els.map(e => /feed-(urgent|today|info)/.exec(e.className)[1]));
    const rank = { urgent: 0, today: 1, info: 2 };
    expect(levels).toEqual([...levels].sort((a, b) => rank[a] - rank[b]));
    const ana = f.locator('[data-feeditem="q:00000000-0000-4000-8000-00000000f101"]');
    await expect(ana.locator('.feedThem')).toContainText('SYNTHETIC is it safe for kids?');
    await expect(ana.locator('.feedDraft')).toContainText('Draft reply (not sent)');
    await expect(ana.locator('.feedLevel')).toHaveText('Urgent');
    await expect(f.locator('[data-feeditem="na:task:00000000-0000-4000-8000-00000000f002"] .feedWhen')).toContainText('Overdue');
    await expect(f.locator('[data-feedneedyou]')).toBeVisible();
    // the questions summary check is not repeated: the questions are listed one by one
    await expect(f.locator('[data-feeditem="check:questionsToReview"]')).toHaveCount(0);
    await f.locator('[data-feedfilter="message"]').click();
    await expect(f.locator('[data-feedfilter="message"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(f.locator('[data-feeditem]')).toHaveCount(2);
    await expect(f.locator('[data-feedkind="message"]')).toHaveCount(2);
    // Answer opens Customer Questions
    await ana.locator('[data-feedopen="inquiriesPanel"]').click();
    await expect(page.locator('#inquiriesPanel')).toBeVisible();
    expect(writes(backend)).toEqual([]);
  });

  test('Later hides an item until tomorrow in this browser, without writing anything; Show them again', async ({ page, backend }) => {
    seed(backend); await on(page);
    await login(page); await gotoPage(page, 'attentionPanel');
    const f = feed(page);
    const bo = f.locator('[data-feeditem="q:00000000-0000-4000-8000-00000000f102"]');
    await expect(bo).toBeVisible();
    await bo.locator('[data-feedsnooze]').click();
    await expect(bo).toHaveCount(0);
    await expect(f.locator('.feedSnoozed')).toContainText('1 set aside until tomorrow');
    await expect(page.locator(':focus')).toBeVisible();          // focus moved to the next item, not lost
    await page.reload(); await expect(page.locator('#dash')).toBeVisible(); await gotoPage(page, 'attentionPanel');
    await expect(f.locator('.feedSnoozed')).toBeVisible();       // remembered in this browser
    await f.locator('[data-feedunsnooze]').click();
    await expect(f.locator('[data-feeditem="q:00000000-0000-4000-8000-00000000f102"]')).toBeVisible();
    expect(writes(backend)).toEqual([]);
  });

  test('Copy reply copies the draft (nothing is sent); Dismiss uses the reminder\'s own Dismiss', async ({ page, backend }) => {
    seed(backend); await on(page);
    await page.addInitScript(() => { window.__copied = []; try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t) => { window.__copied.push(t); return Promise.resolve(); } } }); } catch (e) {} });
    await login(page); await gotoPage(page, 'attentionPanel');
    const f = feed(page);
    await f.locator('[data-feeditem="q:00000000-0000-4000-8000-00000000f101"] [data-feedcopy]').click();
    await expect.poll(() => page.evaluate(() => window.__copied)).toEqual(['SYNTHETIC draft for Ana']);
    expect(writes(backend)).toEqual([]);
    await f.locator('[data-feeddismiss="00000000-0000-4000-8000-00000000f001"]').click();
    await expect.poll(() => writes(backend).map(r => r.method + ' ' + r.table)).toEqual(['PATCH manual_attention_items']);
  });

  test('Copy this as a morning summary: the feed as a short text on the clipboard; nothing is sent or written', async ({ page, backend }) => {
    seed(backend); await on(page);
    await page.addInitScript(() => { window.__copied = []; try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t) => { window.__copied.push(t); return Promise.resolve(); } } }); } catch (e) {} });
    await login(page); await gotoPage(page, 'attentionPanel');
    const f = feed(page);
    const need = Number(await f.locator('[data-feedneedyou]').getAttribute('data-feedneedyou'));
    expect(need).toBeGreaterThan(0);
    await f.getByRole('button', { name: 'Copy this as a morning summary' }).click();
    await expect.poll(() => page.evaluate(() => window.__copied.length)).toBe(1);
    const text = await page.evaluate(() => window.__copied[0]);
    const lines = text.split('\n');
    expect(lines[0]).toBe('Health Endeavors, Tuesday, November 24');
    expect(lines[1].startsWith(need + ' things need you: ')).toBe(true);
    expect(lines.filter(l => l.startsWith('- [')).length).toBe(Math.min(F.SUMMARY_MAX, need));
    // the first thing on the page is the first thing in the text
    const top = (await f.locator('.feedItem .feedTitle').first().innerText()).trim();
    expect(lines[2]).toContain(top.slice(0, 40));
    expect(writes(backend)).toEqual([]);
  });

  test('readable in light and dark; every control named', async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'colours are the same at phone size');
    seed(backend); await on(page);
    await login(page);
    const check = (loc) => loc.evaluate((root, src) => (new Function('return ' + src)())(root), contrastFailures.toString());
    for (const scheme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await gotoPage(page, 'attentionPanel');
      await expect(feed(page).locator('[data-feeditem]').first()).toBeVisible();
      await page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))));
      expect(await check(feed(page)), scheme).toEqual([]);
      expect(await feed(page).evaluate(unnamedControls), scheme).toEqual([]);
    }
  });

  test('at phone size it fits the screen and the buttons are easy to tap', async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'iphone', 'phone only');
    seed(backend);
    backend.tables.customer_inquiries[1].question_text = 'SYNTHETIC ' + 'averyveryverylongwordwithoutspaces'.repeat(20);
    await on(page);
    await login(page); await gotoPage(page, 'attentionPanel');
    await expect(feed(page).locator('[data-feeditem]').first()).toBeVisible();
    expect(await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth)).toBeLessThanOrEqual(1);
    const small = await feed(page).evaluate(hst => [...hst.querySelectorAll('button')].map(b => b.getBoundingClientRect()).filter(r => r.width > 0 && (r.height < 32 || r.width < 32)).length);
    expect(small).toBe(0);
  });
});
