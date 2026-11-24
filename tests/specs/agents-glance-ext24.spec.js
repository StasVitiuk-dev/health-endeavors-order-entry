// Agents at a glance (owner, Nov 24: "how am I going to see them working, where
// will I be able to turn them off"). The short list at the top of the AI Agents
// page: every agent on one line, what it is doing now, when it last ran, and a
// button to its switch. It only words what the page already read; it asks the
// database nothing new. assets/views/he-agents-glance.js. Every value is made up.
const G = require('../../assets/views/he-agents-glance.js');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const node = (ti) => test.skip(ti.project.name !== 'desktop', 'Node-only; run once');

test.describe('the wording (no browser)', () => {
  test('every state the page knows falls in one of four plain groups; anything else needs a look', ({}, ti) => {
    node(ti);
    expect(['enabled', 'dryrun', 'calc'].map(G.bucketOf)).toEqual(['on', 'on', 'on']);
    expect(['disabled', 'off-intended'].map(G.bucketOf)).toEqual(['paused', 'off']);
    expect(['failed', 'stale', 'unknown', 'brand-new', '', null, undefined, 7, 'constructor', '__proto__'].map(G.bucketOf)).toEqual(Array(10).fill('look'));
  });

  test('when it last ran, in plain words; no date is never "just now"', ({}, ti) => {
    node(ti);
    const now = Date.parse('2026-11-24T18:00:00Z');
    const at = (iso) => G.lastRan(iso, now);
    expect([at('2026-11-24T17:59:40Z'), at('2026-11-24T17:59:00Z'), at('2026-11-24T17:48:00Z'), at('2026-11-24T17:00:00Z'), at('2026-11-24T05:00:00Z'), at('2026-11-22T19:00:00Z'), at('2026-11-20T18:00:00Z')])
      .toEqual(['just now', '1 minute ago', '12 minutes ago', '1 hour ago', '13 hours ago', '47 hours ago', '4 days ago']);
    expect(at('2026-11-24T18:00:30Z')).toBe('just now');                    // a clock a little ahead
    for (const junk of [null, undefined, '', 'x', 7, {}, []]) expect(G.lastRan(junk, now)).toBe('never recorded');
  });

  test('the summary line counts each group and leaves out the empty ones', ({}, ti) => {
    node(ti);
    const rows = ['enabled', 'enabled', 'calc', 'disabled', 'off-intended', 'off-intended', 'stale'].map((k, i) => ({ num: i + 1, name: 'A' + i, truthKey: k }));
    expect(G.summarise(rows)).toEqual({ on: 3, paused: 1, off: 2, look: 1, total: 7, line: '3 working · 1 paused · 2 off on purpose · 1 needs a look' });
    expect(G.summarise(rows.concat([{ truthKey: 'failed' }])).line).toBe('3 working · 1 paused · 2 off on purpose · 2 need a look');
    expect(G.summarise([{ truthKey: 'enabled' }]).line).toBe('1 working');
    for (const junk of [null, undefined, 'x', 7, {}, [null, 'x', 7]]) expect(G.summarise(junk)).toEqual({ on: 0, paused: 0, off: 0, look: 0, total: 0, line: 'No agents listed.' });
  });
});

test.describe('agents approved but not running yet (no browser)', () => {
  test('seven, each saying what it does, what it sends and what exists today; none claims to run', ({}, ti) => {
    node(ti);
    expect(G.PLANNED.map(a => a.key)).toEqual(['store_finder', 'store_outreach', 'customer_email', 'review_request', 'receipt_inbox', 'morning_summary', 'content_helper']);
    for (const a of G.PLANNED) {
      for (const k of ['name', 'what', 'sends', 'now']) expect(typeof a[k] === 'string' && a[k].length > 5, a.key + ' ' + k).toBe(true);
      expect(a.now, a.key).toMatch(/^Not (running|built yet)/);
      // anything that writes to a person says it waits for the owner's approval
      if (/email/i.test(a.sends)) expect(a.sends, a.key).toMatch(/only after you approve/);
      expect(Object.isFrozen(a)).toBe(true);
    }
    expect(G.PLANNED.some(a => /text message|sms/i.test(a.sends + a.what))).toBe(false);          // owner: no texting at the start
  });
});

test.describe('on the AI Agents page', () => {
  test('the approved agents are listed apart, folded, and are never counted as working', async ({ page }) => {
    await login(page);
    await gotoPage(page, 'aiPanel');
    const host = page.locator('#agentGlanceHost');
    await expect(host.locator('[data-glance]')).toHaveCount(10);
    const more = host.locator('details[data-planned="7"]');
    await expect(more.locator('summary')).toHaveText('7 more agents approved, not running yet');
    expect(await more.evaluate(d => d.open)).toBe(false);
    await more.locator('summary').click();
    await expect(more.locator('[data-plannedagent]')).toHaveCount(7);
    await expect(more.locator('[data-plannedagent="store_outreach"]')).toContainText('Email, only after you approve the wording.');
    await expect(more.locator('[data-plannedagent="content_helper"]')).toContainText('It never posts and never spends money.');
    await expect(more).toContainText('None of them runs or sends anything yet');
    const parts = (await host.locator('[data-glancesum]').getAttribute('data-glancesum')).split('/').map(Number);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(10);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  });

  test('one line per agent, in the same words as its card below, with the counts on top; nothing new is asked', async ({ page, backend }) => {
    await login(page);
    await gotoPage(page, 'aiPanel');
    const host = page.locator('#agentGlanceHost');
    await expect(host.locator('h3')).toHaveText('Agents at a glance');
    const cards = page.locator('#agentRegistryWrap [data-agent]');
    await expect(cards).toHaveCount(10);
    await expect(host.locator('[data-glance]')).toHaveCount(10);
    // wait until the switches were read, then each line says exactly what its card says
    await expect(cards.first().locator('.agentTruthBadge')).not.toHaveText('Checking…');
    for (let i = 0; i < 10; i += 1) {
      const card = cards.nth(i), num = await card.getAttribute('data-agent');
      const line = host.locator('[data-glance="' + num + '"]');
      await expect(line.locator('.badge')).toHaveText((await card.locator('.agentTruthBadge').innerText()).trim());
      expect(await line.getAttribute('data-glancestate')).toBe(G.bucketOf(await card.getAttribute('data-truth')));
      await expect(line.locator('.agentGlanceRan')).toContainText('Last ran: ');
    }
    // the counts on top add up to the ten agents
    const parts = (await host.locator('[data-glancesum]').getAttribute('data-glancesum')).split('/').map(Number);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(10);
    // it sits above the detailed list, right under the page's first line
    expect(await page.evaluate(() => { const g = document.getElementById('agentGlanceHost'), r = document.getElementById('agentRegistryWrap'); return !!(g.compareDocumentPosition(r) & Node.DOCUMENT_POSITION_FOLLOWING); })).toBe(true);
    expect(backend.tableWrites()).toEqual([]);
  });

  test('"Its switch" takes you to that agent\'s card: the keyboard lands on its switch, or on the card when the switch cannot be used', async ({ page }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'keyboard');
    await login(page);
    await gotoPage(page, 'aiPanel');
    await expect(page.locator('#agentRegistryWrap [data-agent="6"] .agentTruthBadge')).not.toHaveText('Checking…');
    const usable = page.locator('#agentRegistryWrap input.agentToggle:not([disabled])').first();
    if (await usable.count()) {
      const num = await usable.getAttribute('data-num');
      await page.locator('#agentGlanceHost [data-agentjump="' + num + '"]').click();
      await expect(usable).toBeFocused();
      await expect(page.locator('#agentRegistryWrap [data-agent="' + num + '"]')).toBeInViewport();
    }
    const locked = page.locator('#agentRegistryWrap input.agentToggle[disabled]').first();
    if (await locked.count()) {
      const num = await locked.getAttribute('data-num');
      await page.locator('#agentGlanceHost [data-agentjump="' + num + '"]').click();
      await expect(page.locator('#agentRegistryWrap [data-agent="' + num + '"]')).toBeFocused();
      await expect(page.locator('#agentRegistryWrap [data-agent="' + num + '"]')).toBeInViewport();
    }
    expect((await usable.count()) + (await locked.count())).toBeGreaterThan(0);
  });

  test('the switches cannot be read: every line says Unknown and needs a look, never "working"', async ({ page }) => {
    await page.route('**/rest/v1/agent_controls?*', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'XX000', message: 'SYNTHETIC failure' }) }));
    await login(page);
    await gotoPage(page, 'aiPanel');
    const host = page.locator('#agentGlanceHost');
    await expect(host.locator('[data-glance="5"] .badge')).toHaveText('Unknown');
    await expect(host.locator('[data-glance="5"]')).toHaveAttribute('data-glancestate', 'look');
    await expect(host.locator('[data-glancestate="on"] .badge')).toHaveText(['Calculated here', 'Calculated here']);   // the two worked out by the page itself
    await expect(host.locator('[data-glancesum]')).toHaveAttribute('data-glancesum', '2/0/0/8');
  });

  test('at phone size the lines wrap and the page does not scroll sideways', async ({ page }, ti) => {
    test.skip(ti.project.name === 'desktop', 'phone');
    await login(page);
    await gotoPage(page, 'aiPanel');
    await expect(page.locator('#agentGlanceHost [data-glance]')).toHaveCount(10);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  });
});
