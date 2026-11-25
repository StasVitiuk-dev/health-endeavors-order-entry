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

// What a person set aside follows that person to every device (owner's rule 3; database
// draft 58, behind he_my_settings: a switch that saves real records, OFF). The database
// part is tested against a real local PostgreSQL (docs/ops/sql/local-test/my_settings_test.sh).
test.describe('set aside on every device: the rules (no browser)', () => {
  test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });
  const mem = () => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; };
  const T = Date.parse('2026-11-24T15:00:00Z');

  test('two devices are joined: both lists count, the later entry wins, and "Show them again" on one clears what was set aside before it', () => {
    const phone = mem(), mac = mem();
    F.snooze(phone, { id: 'task:1', signature: 's1' }, T);
    F.snooze(mac, { id: 'task:2', signature: 's2' }, T + 1000);
    let joined = F.merge(F.pack(phone), F.pack(mac), T + 2000);
    expect(Object.keys(joined.items)).toEqual(['task:1', 'task:2']);
    expect(joined.items['task:1']).toEqual({ until: F.readSnoozes(phone)['task:1'].until, sig: 's1', at: T });
    // the same item set aside again later, with a changed text: the later one stands
    F.snooze(mac, { id: 'task:1', signature: 's1-changed' }, T + 3000);
    expect(F.merge(F.pack(phone), F.pack(mac), T + 4000).items['task:1'].sig).toBe('s1-changed');
    // "Show them again" on the Mac: everything set aside before that moment is back, on the phone too
    F.unsnoozeAll(mac, T + 5000);
    joined = F.merge(F.pack(phone), F.pack(mac), T + 6000);
    expect(joined).toEqual({ items: {}, clearedAt: T + 5000 });
    // something set aside after it stays
    F.snooze(phone, { id: 'task:3', signature: 's3' }, T + 9000);
    joined = F.merge(F.pack(phone), F.pack(mac), T + 9500);
    expect(Object.keys(joined.items)).toEqual(['task:3']);
    F.unpack(mac, joined);
    expect(Object.keys(F.readSnoozes(mac))).toEqual(['task:3']);
    expect(F.pack(mac)).toEqual(joined);
  });

  test('old entries are dropped, the list stays small, and junk never throws', () => {
    const old = { items: { gone: { until: T - 8 * 86400000, sig: 'x', at: T - 9 * 86400000 }, kept: { until: T + 1000, sig: 'y', at: T - 1000 } }, clearedAt: 0 };
    expect(Object.keys(F.merge(old, null, T).items)).toEqual(['kept']);
    // ids as long as the real ones ("q:" + a 36-character id), each with a fingerprint
    const longId = (i) => 'q:00000000-0000-4000-8000-' + String(i).padStart(12, '0');
    const many = { items: Object.fromEntries(Array.from({ length: 400 }, (x, i) => [longId(i), { until: T + 1000, sig: 'abcdef12', at: T + i }])), clearedAt: 0 };
    const cut = F.merge(many, null, T);
    expect(Object.keys(cut.items)).toHaveLength(60);
    expect(cut.items[longId(399)]).toBeTruthy(); expect(cut.items[longId(0)]).toBeUndefined();   // the most recent are kept
    for (const junk of [null, undefined, 'x', 7, [], { items: 'x', clearedAt: 'y' }, { items: { a: null, b: { until: 'soon' }, ['z'.repeat(300)]: { until: T } }, clearedAt: -5 }]) {
      expect(F.merge(junk, junk, T)).toEqual({ items: {}, clearedAt: 0 });
      expect(F.unpack(mem(), junk)).toBe(true);
    }
    expect(F.pack(null)).toEqual({ items: {}, clearedAt: 0 });
    expect(JSON.stringify(F.merge(many, null, T)).length).toBeLessThan(8000);                  // fits in one setting
  });

  test('the personal store asks nothing while it is off, and names its own database step when that is missing', async () => {
    const SS = require('../../assets/views/he-shared-settings.js');
    const calls = [];
    const client = { from: (t) => ({ select: () => ({ eq: () => ({ limit: async () => { calls.push(t); return { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.my_settings' in the schema cache" } }; } }) }) }),
      rpc: async (n, a) => { calls.push([n, a]); return { data: { ok: true, updated_at: 'now' }, error: null }; } };
    const off = SS.createPersonalStore({ client, enabled: false });
    expect((await off.get('feed_snooze')).state).toBe('not_installed');
    expect((await off.set('feed_snooze', {})).ok).toBe(false);
    expect(calls).toEqual([]);
    const on = SS.createPersonalStore({ client, enabled: true });
    const got = await on.get('feed_snooze');
    expect(got.state).toBe('not_installed');
    expect(got.message).toContain('drafts/58');
    expect((await on.set('feed_snooze', { items: {}, clearedAt: 0 })).ok).toBe(true);
    expect(calls[1]).toEqual(['set_my_setting', { p_key: 'feed_snooze', p_value: { items: {}, clearedAt: 0 } }]);
    expect((await on.set('feed_snooze', { password: 'x' })).message).toContain('never saved as settings');
    expect((await on.set('Bad Key', {})).ok).toBe(false);
  });
});

test.describe('set aside on every device: on Home', () => {
  test.beforeEach(async ({ page }, ti) => { test.skip(ti.project.name !== 'desktop', 'run once'); await page.clock.setFixedTime(new Date('2026-11-24T15:00:00Z')); });
  const mine = (page) => page.addInitScript(() => { try { localStorage.setItem('he_my_settings', 'on'); } catch (e) {} });
  const saves = (backend) => backend.requests.filter(r => r.rpc === 'set_my_setting').map(r => r.body);
  const reads = (backend) => backend.requests.filter(r => r.table === 'my_settings' && !r.params.some(([k, v]) => k === 'limit' && v === '0'));
  const install = (backend) => { backend.tables.my_settings = []; backend.rpc.set_my_setting = (b) => { backend.tables.my_settings = [{ key: b.p_key, value: b.p_value, updated_at: '2026-11-24T15:00:05Z' }]; return { ok: true, key: b.p_key, updated_at: '2026-11-24T15:00:05Z' }; }; };
  const BO = 'q:00000000-0000-4000-8000-00000000f102';

  test('switch off (as shipped): setting aside stays in this browser and nothing is asked of the database for it', async ({ page, backend }) => {
    seed(backend); install(backend); await on(page);
    await login(page); await gotoPage(page, 'attentionPanel');
    const f = feed(page);
    await f.locator(`[data-feeditem="${BO}"] [data-feedsnooze]`).click();
    await expect(f.locator('.feedSnoozed')).toContainText('1 set aside until tomorrow (this browser).');
    await page.waitForTimeout(1000);
    expect(reads(backend)).toEqual([]);
    expect(saves(backend)).toEqual([]);
  });

  test('switched on: what is set aside is saved for this person, and another device shows it set aside too; "Show them again" travels as well', async ({ page, backend, pageErrors }) => {
    seed(backend); install(backend); await on(page); await mine(page);
    await login(page); await gotoPage(page, 'attentionPanel');
    const f = feed(page), bo = f.locator(`[data-feeditem="${BO}"]`);
    await expect(bo).toBeVisible();
    await bo.locator('[data-feedsnooze]').click();
    await expect(f.locator('.feedSnoozed')).toContainText('1 set aside until tomorrow (on every device you sign in to).');
    await expect.poll(() => saves(backend).length).toBe(1);
    const saved = saves(backend)[0];
    expect(saved.p_key).toBe('feed_snooze');
    expect(Object.keys(saved.p_value)).toEqual(['items', 'clearedAt']);
    expect(Object.keys(saved.p_value.items)).toEqual([BO]);
    expect(Object.keys(saved.p_value.items[BO]).sort()).toEqual(['at', 'sig', 'until']);          // no text of the question, no customer
    expect(JSON.stringify(saved)).not.toMatch(/SYNTHETIC|example\.test/);
    // "another device": this browser forgets its own list; the saved one brings it back
    await page.evaluate(() => { localStorage.removeItem('he_feed_snooze'); localStorage.removeItem('he_feed_snooze_cleared'); });
    await page.reload(); await expect(page.locator('#dash')).toBeVisible(); await gotoPage(page, 'attentionPanel');
    await expect(f.locator('.feedSnoozed')).toContainText('1 set aside until tomorrow (on every device you sign in to).');
    await expect(bo).toHaveCount(0);
    await page.waitForTimeout(1000);
    expect(saves(backend).length).toBe(1);                                                    // nothing new to say: nothing saved again
    // "Show them again" here clears it for every device
    await f.locator('[data-feedunsnooze]').click();
    await expect(bo).toBeVisible();
    await expect.poll(() => saves(backend).length).toBe(2);
    expect(saves(backend)[1].p_value.items).toEqual({});
    expect(saves(backend)[1].p_value.clearedAt).toBeGreaterThan(0);
    await page.reload(); await expect(page.locator('#dash')).toBeVisible(); await gotoPage(page, 'attentionPanel');
    await expect(bo).toBeVisible();
    await expect(f.locator('.feedSnoozed')).toHaveCount(0);
    expect(writes(backend)).toEqual([]);                                                      // no business record was ever changed
    expect(pageErrors).toEqual([]);
  });

  test('two devices open at the same time: what the other one set aside a moment ago is kept, not overwritten by this one', async ({ page, backend, pageErrors }) => {
    seed(backend); install(backend); await on(page); await mine(page);
    await login(page); await gotoPage(page, 'attentionPanel');
    const f = feed(page), bo = f.locator(`[data-feeditem="${BO}"]`);
    await expect(bo).toBeVisible();
    // the other device saves something of its own after this page has already read the list
    const OTHER = 'q:00000000-0000-4000-8000-00000000f999';
    const theirs = { until: Date.parse('2026-11-25T14:00:00Z'), at: Date.parse('2026-11-24T14:59:30Z'), sig: 'SYNTHETIC-sig' };
    backend.tables.my_settings = [{ key: 'feed_snooze', value: { items: { [OTHER]: theirs }, clearedAt: 0 }, updated_at: '2026-11-24T14:59:30Z' }];
    await bo.locator('[data-feedsnooze]').click();
    await expect.poll(() => saves(backend).length).toBe(1);
    expect(Object.keys(saves(backend)[0].p_value.items).sort()).toEqual([BO, OTHER].sort());   // both, joined
    expect(saves(backend)[0].p_value.items[OTHER]).toEqual(theirs);
    // and this browser took the other device's entry in as well
    expect(Object.keys(JSON.parse(await page.evaluate(() => localStorage.getItem('he_feed_snooze')))).sort()).toEqual([BO, OTHER].sort());
    expect(writes(backend)).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('switched on but not installed, or the database refuses: setting aside still works in this browser', async ({ page, backend, pageErrors }) => {
    seed(backend); await on(page); await mine(page);
    await page.route('**/rest/v1/my_settings?*', route => route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST205', message: "Could not find the table 'public.my_settings' in the schema cache" }) }));
    await login(page); await gotoPage(page, 'attentionPanel');
    const f = feed(page);
    await f.locator(`[data-feeditem="${BO}"] [data-feedsnooze]`).click();
    await expect(f.locator('.feedSnoozed')).toContainText('1 set aside until tomorrow (this browser).');
    await page.reload(); await expect(page.locator('#dash')).toBeVisible(); await gotoPage(page, 'attentionPanel');
    await expect(f.locator('.feedSnoozed')).toBeVisible();
    expect(pageErrors.filter(e => !/404|PGRST|Failed to load resource/.test(e))).toEqual([]);
  });
});

// ---------- Agent hand-offs: "Handled", and the supervisor rule (Nov 24) ----------
// The plan's rule for the Supervisor: what an agent passed to a person and nobody
// handled within a day is raised to urgent. Until now a hand-off could not be marked
// handled at all (it simply stayed 7 days), so both come together, behind the preview
// switch he_handoff_handled (OFF). The marks are kept in this browser and, with the
// shared settings in use (drafts/50), in the database for every device.
test.describe('agent hand-offs: the rules (no browser)', () => {
  test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });
  const H = 3600000;
  const steps = () => [
    { id: 'a-new', passedToPerson: true, agent: 'Order Intake', what: 'SYNTHETIC could not match an order.', at: NOW - 2 * H },
    { id: 'a-old', passedToPerson: true, agent: 'Accounting', what: 'SYNTHETIC a payout differs.', at: NOW - 30 * H },
    { id: 'a-edge', passedToPerson: true, agent: 'Accounting', what: 'SYNTHETIC exactly a day.', at: NOW - 24 * H },
    { id: 'a-done', passedToPerson: true, agent: 'Shipping', what: 'SYNTHETIC done already.', at: NOW - 40 * H },
    { id: 'a-nodate', passedToPerson: true, agent: 'Shipping', what: 'SYNTHETIC no time recorded.', at: null }];

  test('without the switch nothing changes: no Handled button, nothing raised, however old', () => {
    const items = F.buildFeed({ agents: steps() }, NOW);
    expect(items.map(i => i.level)).toEqual(['today', 'today', 'today', 'today', 'today']);
    expect(items.every(i => i.actions.length === 1 && i.actions[0].kind === 'open')).toBe(true);
    expect(items.some(i => /Waiting/.test(i.detail))).toBe(false);
  });

  test('with it: a handled hand-off leaves the list; one waiting a day or more is urgent and says so; one without a time is never raised', () => {
    const items = F.buildFeed({ agents: steps(), handled: { 'a-done': NOW - H } }, NOW);
    const by = Object.fromEntries(items.map(i => [i.id, i]));
    expect(Object.keys(by).sort()).toEqual(['agent:a-edge', 'agent:a-new', 'agent:a-nodate', 'agent:a-old']);
    expect(by['agent:a-old'].level).toBe('urgent');
    expect(by['agent:a-old'].detail).toBe('SYNTHETIC a payout differs. Waiting more than a day.');
    expect(by['agent:a-edge'].level).toBe('urgent');                       // exactly 24 hours counts
    expect(by['agent:a-new'].level).toBe('today');
    expect(by['agent:a-new'].detail).toBe('SYNTHETIC could not match an order.');
    expect(by['agent:a-nodate'].level).toBe('today');
    expect(items.every(i => i.actions.map(a => a.kind).join('+') === 'open+handled')).toBe(true);
    expect(by['agent:a-old'].actions[1]).toEqual({ kind: 'handled', label: 'Handled', id: 'a-old' });
    // urgent ones come first, and they are counted as urgent
    expect(items[0].level).toBe('urgent');
    expect(F.view(items, { now: NOW, snoozes: {} }).counts).toEqual({ urgent: 2, today: 2, info: 0 });
    // only agent hand-offs follow this rule: a parcel keeps its own clock
    const parcel = F.buildFeed({ delivery: [{ id: 'p1', level: 'today', title: 'SYNTHETIC parcel', next: 'Check it.', since: NOW - 90 * H }], handled: {} }, NOW)[0];
    expect(parcel.level).toBe('today');
  });

  test('marking: remembered with its time, never twice, joined across devices with the first time kept', () => {
    const st = memStore();
    expect(F.readHandled(st, NOW)).toEqual({});
    expect(F.markHandled(st, 'a-old', NOW)).toBe(true);
    expect(F.markHandled(st, 'a-old', NOW + H)).toBe(true);                  // pressing again changes nothing
    expect(F.readHandled(st, NOW + H)).toEqual({ 'a-old': NOW });
    expect(F.markHandled(st, '', NOW)).toBe(false);
    expect(F.markHandled(null, 'x', NOW)).toBe(false);                       // no storage: says so, never throws
    expect(F.mergeHandled({ 'a-old': NOW, x: NOW - H }, { 'a-old': NOW - 2 * H, y: NOW - 3 * H }, NOW)).toEqual({ 'a-old': NOW - 2 * H, x: NOW - H, y: NOW - 3 * H });
    expect(F.mergeHandled(null, undefined, NOW)).toEqual({});
  });

  test('the list stays small: marks older than 30 days are dropped, at most the 100 newest are kept, and it always fits one saved setting', () => {
    const many = {};
    for (let i = 0; i < 300; i++) many['00000000-0000-4000-8000-' + String(i).padStart(12, '0')] = NOW - i * 1000;
    many['very-old'] = NOW - 31 * 86400000;
    const kept = F.mergeHandled(many, null, NOW);
    expect(Object.keys(kept).length).toBe(F.HANDLED_MAX);
    expect(kept['very-old']).toBeUndefined();
    expect(kept['00000000-0000-4000-8000-000000000000']).toBe(NOW);          // the newest are the ones kept
    expect(kept['00000000-0000-4000-8000-000000000299']).toBeUndefined();
    expect(JSON.stringify({ items: kept }).length).toBeLessThan(8000);
    // junk never throws and is never kept
    for (const junk of [null, 7, 'x', [], [1, 2], { a: 'soon', b: -5, c: NaN, d: NOW + 10 * 86400000, e: {} }]) {
      expect(F.mergeHandled(junk, junk, NOW)).toEqual({});
    }
    const broken = { getItem() { return '{not json'; }, setItem() { throw new Error('full'); } };
    expect(F.readHandled(broken, NOW)).toEqual({});
    expect(F.markHandled(broken, 'x', NOW)).toBe(false);
  });
});

test.describe('agent hand-offs: on Home', () => {
  test.beforeEach(async ({ page }, ti) => { test.skip(ti.project.name !== 'desktop', 'run once'); await page.clock.setFixedTime(new Date('2026-11-24T15:00:00Z')); });
  const OLD = '00000000-0000-4000-8000-00000000d001', NEW = '00000000-0000-4000-8000-00000000d002';
  const agents = (backend) => { backend.tables.ai_decision_log = [
    { id: OLD, agent_key: 'accounting', output_summary: 'SYNTHETIC a payout differs from the bank line.', confidence: 0.4, escalated_to_human: true, created_at: '2026-11-23T09:00:00Z' },
    { id: NEW, agent_key: 'order_intake', output_summary: 'SYNTHETIC could not match an order.', confidence: 0.5, escalated_to_human: true, created_at: '2026-11-24T13:00:00Z' }]; };
  const handledOn = (page, shared) => page.addInitScript((sharedOn) => { try { localStorage.setItem('he_handoff_handled', 'on'); if (sharedOn) localStorage.setItem('he_shared_settings', 'on'); } catch (e) {} }, shared);
  const saves = (backend) => backend.requests.filter(r => r.rpc === 'set_shared_setting').map(r => r.body);
  const reads = (backend) => backend.requests.filter(r => r.table === 'shared_settings' && r.method === 'GET' && r.params.some(([k, v]) => k === 'key' && /handoffs_handled/.test(v)));
  const install = (backend, rows) => { backend.tables.shared_settings = rows || []; backend.rpc.set_shared_setting = (b) => {
    backend.tables.shared_settings = backend.tables.shared_settings.filter(r => r.key !== b.p_key).concat([{ key: b.p_key, value: b.p_value, audience: b.p_audience || 'owner_admin', updated_at: '2026-11-24T15:00:05Z' }]); return { ok: true, updated_at: '2026-11-24T15:00:05Z' }; }; };
  const item = (page, id) => feed(page).locator(`[data-feeditem="agent:${id}"]`);

  test('switch off (as shipped): hand-offs are listed as before, no Handled button, nothing raised', async ({ page, backend }) => {
    seed(backend); agents(backend); install(backend); await on(page);
    await login(page); await gotoPage(page, 'attentionPanel');
    await expect(item(page, OLD)).toBeVisible();
    await expect(item(page, OLD)).toHaveClass(/feed-today/);
    await expect(feed(page).locator('[data-feedhandled]')).toHaveCount(0);
    await expect(item(page, OLD)).not.toContainText('Waiting more than a day');
    await page.waitForTimeout(900);
    expect(reads(backend)).toEqual([]);
    expect(saves(backend)).toEqual([]);
  });

  test('switched on: the one waiting over a day is urgent and says so; Handled takes it off the list and it stays off after a reload; no record is changed', async ({ page, backend, pageErrors }) => {
    seed(backend); agents(backend); await on(page); await handledOn(page, false);
    await login(page); await gotoPage(page, 'attentionPanel');
    await expect(item(page, OLD)).toHaveClass(/feed-urgent/);
    await expect(item(page, OLD)).toContainText('SYNTHETIC a payout differs from the bank line. Waiting more than a day.');
    await expect(item(page, NEW)).toHaveClass(/feed-today/);
    await expect(item(page, NEW)).not.toContainText('Waiting more than a day');
    const before = Number(await feed(page).locator('[data-feedneedyou]').getAttribute('data-feedneedyou'));
    const btn = item(page, OLD).locator('[data-feedhandled]');
    await expect(btn).toHaveText('Handled');
    await expect(btn).toHaveAttribute('title', 'Done: it leaves the list (in this browser)');
    await btn.click();
    await expect(item(page, OLD)).toHaveCount(0);
    await expect(item(page, NEW)).toBeVisible();
    await expect(feed(page).locator('[data-feedneedyou]')).toHaveAttribute('data-feedneedyou', String(before - 1));
    expect(Object.keys(JSON.parse(await page.evaluate(() => localStorage.getItem('he_handoffs_handled'))))).toEqual([OLD]);
    // keyboard focus moved to a neighbour, not lost
    expect(await page.evaluate(() => !!document.activeElement && document.activeElement !== document.body)).toBe(true);
    await page.reload(); await expect(page.locator('#dash')).toBeVisible(); await gotoPage(page, 'attentionPanel');
    await expect(item(page, NEW)).toBeVisible();
    await expect(item(page, OLD)).toHaveCount(0);
    await page.waitForTimeout(900);
    expect(reads(backend)).toEqual([]);                                     // shared settings not in use: nothing asked
    expect(saves(backend)).toEqual([]);
    expect(writes(backend)).toEqual([]);                                    // the agents' own log is never changed
    expect(pageErrors).toEqual([]);
  });

  test('with the shared settings in use: Handled is saved for every device (ids and times only), and another device shows it handled', async ({ page, backend, pageErrors }) => {
    seed(backend); agents(backend); install(backend); await on(page); await handledOn(page, true);
    await login(page); await gotoPage(page, 'attentionPanel');
    await item(page, OLD).locator('[data-feedhandled]').click();
    await expect(item(page, OLD)).toHaveCount(0);
    await expect.poll(() => saves(backend).length).toBe(1);
    const saved = saves(backend)[0];
    expect(saved.p_key).toBe('handoffs_handled');
    expect(saved.p_audience).toBe('owner_admin');
    expect(Object.keys(saved.p_value)).toEqual(['items']);
    expect(Object.keys(saved.p_value.items)).toEqual([OLD]);
    expect(typeof saved.p_value.items[OLD]).toBe('number');
    expect(JSON.stringify(saved)).not.toMatch(/SYNTHETIC|payout/);          // never what the agent wrote
    // "another device": this browser forgets its own marks; the saved ones bring them back
    await page.evaluate(() => localStorage.removeItem('he_handoffs_handled'));
    await page.reload(); await expect(page.locator('#dash')).toBeVisible(); await gotoPage(page, 'attentionPanel');
    await expect(item(page, NEW)).toBeVisible();
    await expect(item(page, OLD)).toHaveCount(0);
    await expect(item(page, NEW).locator('[data-feedhandled]')).toHaveAttribute('title', 'Done: it leaves the list (on every device)');
    await page.waitForTimeout(900);
    expect(saves(backend).length).toBe(1);                                  // nothing new to say: nothing saved again
    expect(writes(backend)).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('shared settings switched on but not installed, or the save refused: Handled still works in this browser', async ({ page, backend, pageErrors }) => {
    seed(backend); agents(backend); await on(page); await handledOn(page, true);
    await page.route('**/rest/v1/shared_settings?*', route => route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST205', message: "Could not find the table 'public.shared_settings' in the schema cache" }) }));
    await login(page); await gotoPage(page, 'attentionPanel');
    const btn = item(page, OLD).locator('[data-feedhandled]');
    await expect(btn).toHaveAttribute('title', 'Done: it leaves the list (in this browser)');
    await btn.click();
    await expect(item(page, OLD)).toHaveCount(0);
    await page.waitForTimeout(900);
    expect(saves(backend)).toEqual([]);
    expect(pageErrors.filter(e => !/404|PGRST|Failed to load resource/.test(e))).toEqual([]);   // the 404 is this test's own "not installed"
  });
});

// "Undo" for a hand-off marked handled by mistake (Nov 24). The mark is not erased:
// it is kept as "taken back at <time>", so that when two devices are joined the
// later action wins and the hand-off does not come back as handled from the other one.
test.describe('agent hand-offs: taking a Handled mark back (no browser)', () => {
  test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });
  const H = 3600000;

  test('Undo: not handled any more, the hand-off is back in the list; pressing Handled again works', () => {
    const st = memStore();
    const rows = [{ id: 'a1', passedToPerson: true, agent: 'Accounting', what: 'SYNTHETIC x', at: NOW - 3 * H }];
    expect(F.unmarkHandled(st, 'a1', NOW)).toBe(false);                      // nothing to take back
    expect(F.markHandled(st, 'a1', NOW - 2 * H)).toBe(true);
    expect(F.buildFeed({ agents: rows, handled: F.readHandled(st, NOW) }, NOW)).toEqual([]);
    expect(F.unmarkHandled(st, 'a1', NOW - H)).toBe(true);
    expect(F.readHandled(st, NOW)).toEqual({});
    expect(F.readMarks(st, NOW)).toEqual({ a1: -(NOW - H) });                // remembered as taken back, with the time
    expect(F.buildFeed({ agents: rows, handled: F.readHandled(st, NOW) }, NOW).map(i => i.id)).toEqual(['agent:a1']);
    expect(F.unmarkHandled(st, 'a1', NOW)).toBe(false);                      // twice changes nothing
    expect(F.markHandled(st, 'a1', NOW)).toBe(true);
    expect(F.readHandled(st, NOW)).toEqual({ a1: NOW });
    expect(F.unmarkHandled(null, 'a1', NOW)).toBe(false);
    expect(F.unmarkHandled(st, '', NOW)).toBe(false);
  });

  test('two devices: the later action wins, whichever device it was on', () => {
    // handled on the phone, taken back later on the computer: not handled
    expect(F.mergeHandled({ a: NOW - 2 * H }, { a: -(NOW - H) }, NOW)).toEqual({ a: -(NOW - H) });
    // taken back, then handled again later on the other device: handled
    expect(F.mergeHandled({ a: -(NOW - 2 * H) }, { a: NOW - H }, NOW)).toEqual({ a: NOW - H });
    // handled on both: the first time is kept
    expect(F.mergeHandled({ a: NOW - 3 * H }, { a: NOW - H }, NOW)).toEqual({ a: NOW - 3 * H });
    // taken back on both: the later one is kept
    expect(F.mergeHandled({ a: -(NOW - 3 * H) }, { a: -(NOW - H) }, NOW)).toEqual({ a: -(NOW - H) });
    // the order of the two devices never matters
    for (const [x, y] of [[{ a: NOW - 2 * H, b: -(NOW - H) }, { a: -(NOW - H), b: NOW - 5 * H, c: NOW }]]) {
      expect(F.mergeHandled(x, y, NOW)).toEqual(F.mergeHandled(y, x, NOW));
    }
    // a taken-back mark an instant after the handling still wins over it (same millisecond)
    const st = memStore(); F.markHandled(st, 'z', NOW); F.unmarkHandled(st, 'z', NOW);
    expect(F.mergeHandled(F.readMarks(st, NOW), { z: NOW }, NOW).z).toBeLessThan(0);
  });
});
