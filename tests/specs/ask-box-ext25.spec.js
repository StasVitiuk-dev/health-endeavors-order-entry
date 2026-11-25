// "Ask the dashboard" (owner, Nov 24: "something like a Siri of my app"). Behind the preview
// switch he_ask_box (off by default), on the owner's account only. The search box also answers
// a fixed set of questions with exact figures from the records, shown and, unless Quiet is on,
// read out loud; "Talk" uses the browser's own dictation. It only reads. "Remind me to ..."
// opens the existing "New reminder" box filled in. assets/views/he-ask.js. Every value is
// made up; the microphone and the voice are replaced by stand-ins, so nothing is heard or said.
const A = require('../../assets/views/he-ask.js');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const node = (ti) => test.skip(ti.project.name !== 'desktop', 'Node-only; run once');
const NOW = new Date(2026, 10, 25, 12, 0, 0).getTime();            // a Wednesday, on the calendar of whoever runs this
const ask = (text, last) => { const u = A.understand(text, last ? { last: last } : undefined); return [u.intent, u.period, u.person, u.title]; };

test.describe('the rules (no browser)', () => {
  test('what it understands: the kind of question, the period and the person', ({}, ti) => {
    node(ti);
    expect(ask('How many orders this week?')).toEqual(['orders', 'week', '', '']);
    expect(ask('how many orders did we get')).toEqual(['orders', 'today', '', '']);                      // no period said: today
    expect(ask('Orders yesterday')).toEqual(['orders', 'yesterday', '', '']);
    expect(ask('How much did we sell last month?')).toEqual(['sales', 'lastmonth', '', '']);
    expect(ask('sales this month')).toEqual(['sales', 'month', '', '']);
    expect(ask('Is any customer waiting?')).toEqual(['waiting', '', '', '']);
    expect(ask('who is waiting for an answer')).toEqual(['waiting', '', '', '']);
    expect(ask('any unanswered messages')).toEqual(['waiting', '', '', '']);
    expect(ask('open customer inquiries')).toEqual(['none', '', '', '']);                                // "open ..." is a page to go to, not a question
    expect(ask('are any questions unanswered')).toEqual(['waiting', '', '', '']);
    expect(ask('What is low on stock?')).toEqual(['stock', '', '', '']);
    expect(ask('are we running out of anything')).toEqual(['stock', '', '', '']);
    expect(ask('What is left before launch?')).toEqual(['launch', '', '', '']);
    expect(ask('Read me the weekly report')).toEqual(['weekly', '', '', '']);
    expect(ask('what did everyone do today')).toEqual(['did', 'today', '', '']);
    expect(ask('What did Ana do this week?')).toEqual(['did', 'week', 'ana', '']);
    expect(ask('who did what yesterday')).toEqual(['did', 'yesterday', '', '']);
    for (const q of ['Brief me', 'good morning', 'what did I forget', 'catch me up']) expect(ask(q)[0]).toBe('brief');
    for (const q of ['help', 'What can I ask?']) expect(ask(q)[0]).toBe('help');
    // plain searches are left to the search: a product, an order number, a page to open
    for (const q of ['lotion', 'order 1042', 'open inventory', 'expenses', 'SYNTHETIC client', '']) expect(ask(q)[0]).toBe('none');
  });

  test('"remind me to ..." keeps the words as they were typed; a follow-up keeps the question and changes only the period', ({}, ti) => {
    node(ti);
    expect(ask('Remind me to call the supplier on Friday.')).toEqual(['remind', '', '', 'Call the supplier on Friday']);
    expect(ask('remind me about the Etsy fees!!!')).toEqual(['remind', '', '', 'The Etsy fees']);
    expect(ask('please remember to order boxes')).toEqual(['remind', '', '', 'Order boxes']);
    expect(ask('remind me')).toEqual(['none', '', '', '']);
    const last = { intent: 'sales', period: 'week', person: '' };
    expect(ask('and last week?', last)).toEqual(['sales', 'lastweek', '', '']);
    expect(ask('what about yesterday', last)).toEqual(['sales', 'yesterday', '', '']);
    expect(ask('last month', { intent: 'did', period: 'today', person: 'ana' })).toEqual(['did', 'lastmonth', 'ana', '']);
    expect(ask('and last week?')).toEqual(['none', '', '', '']);                                           // nothing was asked before
    expect(ask('and last week?', { intent: 'stock', period: '', person: '' })).toEqual(['none', '', '', '']);   // stock has no period
    // odd input never throws, and very long text is cut
    for (const junk of [null, undefined, 7, {}, [], '?'.repeat(50000), 'remind me to ' + 'x'.repeat(5000)]) expect(() => A.understand(junk, junk)).not.toThrow();
    expect(A.understand('remind me to ' + 'x'.repeat(5000)).title.length).toBeLessThanOrEqual(300);
  });

  test('periods are on the viewer\'s own calendar, with the period before for comparison', ({}, ti) => {
    node(ti);
    const t = (p) => { const b = A.periodBounds(p, NOW); return [new Date(b.from).getTime(), new Date(b.to).getTime(), new Date(b.prevFrom).getTime(), b.label, b.before]; };
    const d = (day, month) => new Date(2026, month == null ? 10 : month, day).getTime();
    expect(t('today')).toEqual([d(25), d(26), d(24), 'today', 'Yesterday']);
    expect(t('yesterday')).toEqual([d(24), d(25), d(23), 'yesterday', 'The day before']);
    expect(t('week')).toEqual([d(23), d(26), d(16), 'this week (since Monday)', 'Last week (the whole week)']);
    expect(t('lastweek')).toEqual([d(16), d(23), d(9), 'last week (Nov 16 – Nov 22)', 'The week before']);
    expect(t('month')).toEqual([d(1), d(26), d(1, 9), 'this month', 'Last month (the whole month)']);
    expect(t('lastmonth')).toEqual([d(1, 9), d(1), d(1, 8), 'last month', 'The month before']);
    for (const junk of ['nonsense', null, undefined, 7]) expect(A.periodBounds(junk, NOW).period).toBe('today');
    for (const bad of [1e300, NaN, 'x', null]) expect(() => A.periodBounds('week', bad)).not.toThrow();
  });

  test('answers are exact, say what could not be read, and never name a customer', ({}, ti) => {
    node(ti);
    const b = A.periodBounds('week', NOW);
    const sales = A.compose({ intent: 'orders', period: 'week' }, { bounds: b, sales: { state: 'ok', orders: 3, counted: 2, notCounted: 1, byCurrency: [{ currency: 'USD', cents: 3050 }], before: { state: 'ok', orders: 1, byCurrency: [{ currency: 'USD', cents: 900 }] } } });
    expect(sales.title).toBe('Orders, this week (since Monday)');
    expect(sales.lines).toEqual([{ label: 'Orders placed, this week (since Monday)', value: '3' }, { label: 'Order totals (tax and shipping included)', value: '$30.50' },
      { label: 'Cancelled or refunded (not in the totals)', value: '1' }, { label: 'Last week (the whole week)', value: '1 order, $9.00' }]);
    expect(sales.say).toBe('3 orders this week, 30 dollars and 50 cents. 1 cancelled or refunded, not counted in the money.');
    expect([sales.page, sales.pageName]).toEqual(['ordersPanel', 'Orders']);
    expect(A.compose({ intent: 'sales', period: 'today' }, { sales: { state: 'ok', orders: 0, notCounted: 0, byCurrency: [] } }).say).toBe('No orders today.');
    // not read: it says so, in the lines and out loud; never "no orders"
    const lost = A.compose({ intent: 'orders', period: 'today' }, { sales: { state: 'unknown' } });
    expect([lost.lines[0].value, lost.say]).toEqual(['could not be read', 'I could not read the orders just now.']);
    for (const intent of ['orders', 'waiting', 'stock', 'launch', 'weekly', 'did']) expect(A.compose({ intent: intent, period: 'today' }, {}).say).toMatch(/^I could not read /);

    expect(A.compose({ intent: 'waiting' }, { questions: { state: 'ok', waiting: 2, oldestDays: 5 } }).say).toBe('2 customers are waiting for an answer. The oldest has waited 5 days.');
    expect(A.compose({ intent: 'waiting' }, { questions: { state: 'ok', waiting: 0, oldestDays: null } }).say).toBe('No customer is waiting.');
    const stock = A.compose({ intent: 'stock' }, { stock: { state: 'ok', lowCount: 4, noLevel: 1, low: [{ name: 'SYNTHETIC A', available: 1, level: 5 }, { name: 'SYNTHETIC B', available: 2, level: 5 }, { name: 'SYNTHETIC C', available: 3, level: 5 }, { name: 'SYNTHETIC D', available: 4, level: 5 }] } });
    expect(stock.say).toBe('4 products are low on stock: SYNTHETIC A, 1 left; SYNTHETIC B, 2 left; SYNTHETIC C, 3 left; and 1 more. 1 product has no alert level, so it can never show as low.');
    expect(stock.lines).toHaveLength(6);
    const launch = A.compose({ intent: 'launch' }, { launchPage: true, launch: { ready: 1, total: 4, lines: [{ state: 'ready', title: 'SYNTHETIC one' }, { state: 'todo', title: 'SYNTHETIC two' }, { state: 'unknown', title: 'SYNTHETIC three' }, { state: 'todo', title: 'SYNTHETIC four' }] } });
    expect(launch.say).toBe('1 of 4 launch lines are ready. Next: SYNTHETIC two; SYNTHETIC three; SYNTHETIC four.');
    expect(launch.lines.map(l => l.label)).toEqual(['Ready to launch', 'To do', 'Could not check', 'To do']);
    expect(launch.page).toBe('launchPanel');
    const did = A.compose({ intent: 'did', period: 'today', person: 'ana' }, { people: { state: 'ok', capped: false, rows: [{ name: 'SYNTHETIC Ana', account: '111222333', actions: 2 }, { name: 'SYNTHETIC Ben', account: '', actions: 1 }] } });
    expect([did.title, did.lines, did.say]).toEqual(['What ana did, today', [{ label: 'SYNTHETIC Ana · #111222333', value: '2 changes' }], 'SYNTHETIC Ana, 2 recorded changes today.']);
    expect(A.compose({ intent: 'did', period: 'yesterday', person: 'zed' }, { people: { state: 'ok', rows: [] } }).say).toBe('I found no recorded change by zed yesterday.');
    const brief = A.compose({ intent: 'brief' }, { feedSummary: '3 things need you · 1 urgent, 2 today', sales: { state: 'ok', orders: 2, notCounted: 0, byCurrency: [{ currency: 'USD', cents: 4000 }] }, questions: { state: 'ok', waiting: 1, oldestDays: 0 }, stock: { state: 'unknown' } });
    expect(brief.say).toBe('3 things need you: 1 urgent, 2 today. 2 orders today, 40 dollars. 1 customer is waiting for an answer. The oldest has waited less than a day. I could not read the stock just now.');
    expect(brief.lines[0]).toEqual({ label: 'On Home', value: '3 things need you · 1 urgent, 2 today' });
    expect(A.compose({ intent: 'help' }, {}).lines.map(l => l.label)).toEqual(A.EXAMPLES);
    for (const junk of [null, undefined, 'x', { intent: 'none' }, { intent: 'remind', title: 'x' }]) expect(A.compose(junk, {})).toBeNull();
    // every example is something it understands
    for (const e of A.EXAMPLES) expect(A.understand(e).intent, e).not.toBe('none');
  });
});

// ---------- on the page ----------
const FIXED = '2026-11-25T18:00:00Z';
const iso = (day, hour) => '2026-11-' + String(day).padStart(2, '0') + 'T' + String(hour == null ? 17 : hour).padStart(2, '0') + ':00:00Z';
const row = (n, day, extra) => Object.assign({ id: 'o-' + n, order_number: 'HE-' + (1000 + n), customer_name: 'SYNTHETIC client ' + n, customer_email: 'client' + n + '@example.test', status: 'paid', currency: 'USD', total: 10 * n, placed_at: iso(day), deleted_at: null }, extra || {});
function seed(backend) {
  backend.tables.orders = [row(1, 25), row(2, 25), row(3, 25, { status: 'cancelled' }), row(4, 24), row(5, 18)];
  backend.tables.order_items = [];
  backend.tables.customer_inquiries = [{ id: 'q1', status: 'new', created_at: iso(22), customer_name: 'SYNTHETIC asker', question_text: 'SYNTHETIC question' }];
  backend.tables.products = [{ id: 'p1', sku: 'LOT-8', name: 'SYNTHETIC Lotion 8 oz', is_active: true, status: 'active', retail_price: 24 }];
  backend.tables.inventory = [{ id: 'inv1', product_id: 'p1', available: 3, low_stock_threshold: 10 }];
  backend.rpc.employee_activity = (b) => (b.p_offset ? [] : [{ id: 'a1', person_name: 'SYNTHETIC Ana', person_account_number: '111222333', person_role: 'employee', happened_at: iso(25) }]);
}
async function open(page, backend, opts) {
  const o = opts || {};
  await page.clock.setFixedTime(new Date(FIXED));
  seed(backend);
  if (o.role) backend.tables.profiles[0].role = o.role;
  await page.addInitScript((opt) => {
    try { if (opt.on !== false) localStorage.setItem('he_ask_box', 'on'); if (opt.quiet) localStorage.setItem('he_ask_quiet', 'on'); } catch (e) {}
    // stand-ins: what would be said is written down; the microphone "hears" window.__hear when started
    window.__said = [];
    if (opt.voice !== false) {
      window.SpeechSynthesisUtterance = function (text) { this.text = text; };
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { cancel() { window.__cancelled = (window.__cancelled || 0) + 1; }, speak(u) { window.__said.push(u.text); } } });
    } else { Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: undefined }); }
    delete window.SpeechRecognition;
    if (opt.mic !== false) {
      window.webkitSpeechRecognition = function () {
        this.start = () => { window.__listening = (window.__listening || 0) + 1; setTimeout(() => { if (window.__micError) { this.onerror({ error: window.__micError }); this.onend(); return; } this.onresult({ results: [[{ transcript: window.__hear || '' }]] }); this.onend(); }, 30); };
        this.stop = () => {}; this.abort = () => {};
      };
    } else { window.webkitSpeechRecognition = undefined; }
  }, { on: o.on, quiet: !!o.quiet, voice: o.voice, mic: o.mic });
  await login(page);
}
const openBox = async (page) => { await page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k'); await expect(page.locator('#paletteOverlay')).toHaveClass(/open/); };
const writes = (backend) => backend.requests.filter(r => r.method && r.method !== 'GET' && r.method !== 'HEAD' && String(r.path || '').startsWith('/rest/v1/') && !r.rpc);
const said = (page) => page.evaluate(() => window.__said);

test('switch OFF (the default): the search box is as before, with no bar and no answers', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'the keyboard shortcut; run once');
  await open(page, backend, { on: false });
  await expect(page.locator('#askBarHost')).toHaveCount(0);
  await openBox(page);
  await expect(page.locator('#paletteOverlay [data-askbar]')).toHaveCount(0);
  await expect(page.locator('#paletteInput')).toHaveAttribute('placeholder', /Jump to a page or record/);
  await page.locator('#paletteInput').fill('how many orders this week');
  await expect(page.locator('#paletteResults .pKind', { hasText: 'Answer' })).toHaveCount(0);
});

test('a typed question is answered in the box with exact figures, read out loud, and nothing is written', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'the keyboard shortcut; run once');
  await open(page, backend);
  await openBox(page);
  const box = page.locator('#paletteOverlay');
  await expect(page.locator('#paletteInput')).toHaveAttribute('placeholder', 'Search, or ask: how many orders this week?');
  await page.locator('#paletteInput').fill('How many orders today?');
  await expect(page.locator('#paletteResults .pResult').first()).toContainText('Answer: orders, today');
  await page.keyboard.press('Enter');
  await expect(box).toHaveClass(/open/);                                                   // the box stays open for the answer
  await expect(box.locator('[data-asktitle]')).toHaveText('Orders, today');
  await expect(box.locator('[data-asksay]')).toHaveText('3 orders today, 30 dollars. 1 cancelled or refunded, not counted in the money.');
  await expect(box.locator('.askCard tr').first()).toContainText('3');
  await expect(box.locator('.askCard')).toContainText('$30.00');                           // 10 + 20; the cancelled 30 is not added
  await expect(box.locator('.askCard')).toContainText('Yesterday');
  await expect(box.locator('.askCard')).not.toContainText('SYNTHETIC client');             // no customer names
  expect(await said(page)).toEqual(['3 orders today, 30 dollars. 1 cancelled or refunded, not counted in the money.']);
  // a follow-up changes only the period
  await page.locator('#paletteInput').fill('and yesterday?');
  await expect(box.locator('[data-asktitle]')).toHaveCount(0);                             // typing clears the old answer
  await page.keyboard.press('Enter');
  await expect(box.locator('[data-asksay]')).toHaveText('1 order yesterday, 40 dollars.');
  // the answer leads to its page
  await box.locator('[data-ask="open"]').click();
  await expect(page.locator('#ordersPanel')).toBeVisible();
  await expect(box).not.toHaveClass(/open/);
  expect(writes(backend)).toEqual([]);
});

test('Talk: what the microphone hears is asked; Quiet shows the answer without speaking', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'the keyboard shortcut; run once');
  await open(page, backend);
  await openBox(page);
  const box = page.locator('#paletteOverlay');
  await page.evaluate(() => { window.__hear = 'is any customer waiting'; });
  await box.locator('[data-ask="listen"]').click();
  await expect(page.locator('#paletteInput')).toHaveValue('is any customer waiting');
  await expect(box.locator('[data-asksay]')).toHaveText('1 customer is waiting for an answer. The oldest has waited 3 days.');
  await expect(box.locator('[data-ask="listen"]')).toHaveText('Talk');
  expect(await said(page)).toEqual(['1 customer is waiting for an answer. The oldest has waited 3 days.']);
  // something it does not know: it says what it heard and leaves the search results
  await page.evaluate(() => { window.__hear = 'lotion'; });
  await box.locator('[data-ask="listen"]').click();
  await expect(box.locator('[data-asknote]')).toContainText('I heard: “lotion”.');
  // Quiet: shown, not spoken, and remembered
  await box.locator('[data-ask="quiet"]').click();
  await expect(box.locator('[data-ask="quiet"]')).toHaveText('Quiet: on');
  await expect(box.locator('[data-ask="quiet"]')).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => { window.__hear = 'what is low on stock'; });
  await box.locator('[data-ask="listen"]').click();
  await expect(box.locator('[data-asksay]')).toHaveText('1 product is low on stock: SYNTHETIC Lotion 8 oz, 3 left.');
  await expect(box.locator('[data-asknote]')).toHaveText('Quiet is on: shown, not spoken.');
  expect(await said(page)).toHaveLength(1);                                               // nothing new was said
  expect(await page.evaluate(() => localStorage.getItem('he_ask_quiet'))).toBe('on');
  // the microphone refused by the browser: a plain sentence, no error
  await page.evaluate(() => { window.__micError = 'not-allowed'; });
  await box.locator('[data-ask="listen"]').click();
  await expect(box.locator('[data-asknote]')).toHaveText('The microphone is not allowed for this page. Allow it in the browser, or type your question.');
});

test('"Brief me" from Home: the day in one answer; a part that cannot be read says so', async ({ page, backend }) => {
  await open(page, backend);
  await gotoPage(page, 'attentionPanel');
  await page.route('**/rest/v1/inventory?*', route => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ code: '42501', message: 'SYNTHETIC permission denied for table inventory' }) }));
  const bar = page.locator('#askBarHost');
  await expect(bar).toContainText('Ask the dashboard');
  await bar.locator('[data-askhome="brief"]').click();
  const box = page.locator('#paletteOverlay');
  await expect(box).toHaveClass(/open/);
  await expect(box.locator('[data-asktitle]')).toHaveText('Your briefing');
  const say = await box.locator('[data-asksay]').textContent();
  expect(say).toContain('3 orders today, 30 dollars.');
  expect(say).toContain('1 customer is waiting for an answer.');
  expect(say).toContain('I could not read the stock just now.');                           // never "nothing is low"
  expect(say).toMatch(/\d+ of 14 launch lines are ready\./);
  expect(await said(page)).toEqual([say]);
  expect(writes(backend)).toEqual([]);
});

test('"Remind me to ..." opens the New reminder box filled in; nothing is added until Add is pressed', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'the keyboard shortcut; run once');
  await open(page, backend);
  await openBox(page);
  await page.locator('#paletteInput').fill('Remind me to call the supplier on Friday.');
  await expect(page.locator('#paletteResults .pResult').first()).toContainText('Add a reminder: Call the supplier on Friday');
  await page.keyboard.press('Enter');
  await expect(page.locator('#paletteOverlay')).not.toHaveClass(/open/);
  await expect(page.locator('#quickAddOverlay')).toHaveClass(/open/);
  await expect(page.locator('#quickAddInput')).toHaveValue('Call the supplier on Friday');
  expect(writes(backend)).toEqual([]);                                                     // only shown so far
  await page.locator('#quickAddCancel').click();
  expect(writes(backend)).toEqual([]);
});

test('no microphone or no voice in the browser: typing still works and the box says how to dictate', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'the keyboard shortcut; run once');
  await open(page, backend, { mic: false, voice: false });
  await openBox(page);
  const box = page.locator('#paletteOverlay');
  await expect(box.locator('[data-ask="listen"]')).toHaveCount(0);
  await expect(box.locator('[data-asknomic]')).toHaveText('To talk, use the microphone key on your keyboard.');
  await box.locator('[data-ask="help"]').click();
  await expect(box.locator('[data-asktitle]')).toHaveText('What you can ask');
  await expect(box.locator('.askCard tr')).toHaveCount(A.EXAMPLES.length);
  await expect(box.locator('[data-ask="again"]')).toHaveCount(0);                          // nothing can be said here
});

test('only the owner has it: an administrator and an employee get the plain search box', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'the keyboard shortcut; run once');
  await open(page, backend, { role: 'administrator' });
  await expect(page.locator('#askBarHost')).toHaveCount(0);
  await openBox(page);
  await expect(page.locator('#paletteOverlay [data-askbar]')).toHaveCount(0);
  await page.locator('#paletteInput').fill('how many orders today');
  await expect(page.locator('#paletteResults .pKind', { hasText: 'Answer' })).toHaveCount(0);
});

test('at phone size the answer fits the box without sideways scrolling', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'iphone', 'phone only');
  await open(page, backend);
  await gotoPage(page, 'attentionPanel');
  await page.locator('#askBarHost [data-askhome="brief"]').click();
  const box = page.locator('#paletteOverlay');
  await expect(box.locator('[data-asktitle]')).toHaveText('Your briefing');
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(0);
  const edge = await box.locator('.askCard').evaluate(el => Math.round(el.getBoundingClientRect().right));
  expect(edge).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
});
