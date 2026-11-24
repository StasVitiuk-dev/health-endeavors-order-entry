// Agent diary (owner, Nov 24: "love it"): what each agent recorded in its own log
// (ai_decision_log), in plain words on AI Agents behind he_agent_diary (OFF, on
// Feature Flags), and the steps an agent passed to a person in the Home feed.
// No database change; reads only. Every value is made up.
const A = require('../../assets/views/he-agent-diary.js');
const F = require('../../assets/views/he-attention-feed.js');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { unnamedControls, contrastFailures } = require('../helpers/a11y-audit');

const node = (ti) => test.skip(ti.project.name !== 'desktop', 'Node-only; run once');
const REG = [{ num: 5, name: 'Shipping/Tracking Agent' }, { num: 7, name: 'Customer Service Agent' }];
const NOW = Date.parse('2026-11-24T16:00:00Z');
const ROWS = [
  { id: '00000000-0000-4000-8000-00000000a101', agent_key: 'shipping_tracking_agent', output_summary: 'Marked order 1042 delivered', confidence: null, escalated_to_human: false, created_at: '2026-11-24T15:02:00Z' },
  { id: '00000000-0000-4000-8000-00000000a102', agent_key: 'customer_service_agent', output_summary: 'Drafted a reply; the customer mentions a refund', confidence: 0.62, escalated_to_human: true, created_at: '2026-11-24T03:10:00Z' },
  { id: '00000000-0000-4000-8000-00000000a103', agent_key: 'shipping_tracking_agent', output_summary: null, confidence: null, escalated_to_human: false, created_at: '2026-11-23T20:00:00Z' }];

test.describe('the diary (no browser)', () => {
  test('names, plain lines, days in Chicago time, filter, and what goes to the feed', ({}, ti) => {
    node(ti);
    expect(A.agentName('customer_service_agent', REG)).toBe('#7 Customer Service Agent');
    expect(A.agentName('Shipping/Tracking Agent', REG)).toBe('#5 Shipping/Tracking Agent');
    expect(A.agentName('agent-5', REG)).toBe('#5 Shipping/Tracking Agent');
    expect(A.agentName('pricing_helper_agent', REG)).toBe('Pricing helper agent');
    expect(A.agentName('', REG)).toBe('Unknown agent');
    // broken rows are skipped (found by the robustness probe on GitHub)
    expect(A.view([null, undefined, 'x', 7]).count).toBe(0);
    expect(A.view([null]).days).toEqual([]);
    expect(A.needsPerson([null, undefined])).toEqual([]);
    const e = A.entries(ROWS, { registry: REG });
    expect(e.map(x => [x.day, x.time, x.agent])).toEqual([
      ['Tuesday, November 24', '9:02 AM', '#5 Shipping/Tracking Agent'],
      ['Monday, November 23', '9:10 PM', '#7 Customer Service Agent'],      // 03:10 UTC is the evening before in Chicago
      ['Monday, November 23', '2:00 PM', '#5 Shipping/Tracking Agent']]);
    expect(e[1]).toMatchObject({ passedToPerson: true, confidence: 62 });
    expect(e[2].what).toBe('Recorded a step (no summary given).');
    const v = A.view(e, '');
    expect(v.agents.map(a => a.name + ':' + a.count)).toEqual(['#5 Shipping/Tracking Agent:2', '#7 Customer Service Agent:1']);
    expect(v.days.map(d => d.entries.length)).toEqual([1, 2]);
    expect(A.view(e, 'customer_service_agent')).toMatchObject({ count: 1, passedToPerson: 1 });
    expect(A.view(e, 'no_such_agent').agent).toBe('');
    const need = A.needsPerson(e, { now: NOW, days: 7 });
    expect(need.map(x => x.id)).toEqual(['00000000-0000-4000-8000-00000000a102']);
    expect(A.needsPerson(e, { now: NOW + 8 * 86400000, days: 7 })).toEqual([]);
    const items = F.buildFeed({ agents: need }, NOW);
    expect(items[0]).toMatchObject({ kind: 'agent', level: 'today', title: '#7 Customer Service Agent passed this to you', page: 'aiPanel' });
    expect(F.view(items, { now: NOW, filter: 'work' }).items.length).toBe(1);
  });

  test('broken rows never break it', ({}, ti) => {
    node(ti);
    expect(A.entries(null)).toEqual([]);
    expect(A.entries([null, 5, {}, { created_at: 'x' }, { agent_key: 'x', created_at: '2026-11-24T00:00:00Z', confidence: 7 }])).toHaveLength(1);
    expect(A.entries([{ agent_key: 'x', created_at: '2026-11-24T00:00:00Z', confidence: 7 }])[0].confidence).toBe(100);
    expect(A.view(null, 'x')).toMatchObject({ count: 0, days: [] });
    expect(A.needsPerson(null)).toEqual([]);
  });
});

test.describe('on AI Agents and in the feed', () => {
  test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date(NOW)); });

  test('switch OFF (default): AI Agents is as before', async ({ page, backend }) => {
    backend.tables.ai_decision_log = ROWS;
    await login(page); await gotoPage(page, 'aiPanel');
    await expect(page.locator('#aiTableWrap')).toBeVisible();
    await expect(page.locator('#agentDiaryHost')).toHaveCount(0);
  });

  test('switch ON: the diary by day, a filter per agent; the hand-off is in the feed', async ({ page, backend }) => {
    backend.tables.ai_decision_log = ROWS;
    await page.addInitScript(() => { try { localStorage.setItem('he_agent_diary', 'on'); localStorage.setItem('he_attention_feed', 'on'); } catch (e) {} });
    await login(page); await gotoPage(page, 'aiPanel');
    const d = page.locator('#agentDiaryHost');
    await expect(d.locator('.diaryDayTitle')).toHaveText(['Tuesday, November 24', 'Monday, November 23']);
    await expect(d.locator('[data-diaryentry]')).toHaveCount(3);
    await expect(d.locator('.diaryPerson')).toContainText('Passed to a person');
    await expect(d.locator('.diaryPerson')).toContainText('#7 Customer Service Agent');
    await d.locator('#agentDiaryFilter').selectOption('shipping_tracking_agent');
    await expect(d.locator('[data-diaryentry]')).toHaveCount(2);
    await expect(d.locator('[data-diarycount]')).toHaveText('2 steps');
    await gotoPage(page, 'attentionPanel');
    const item = page.locator('#attentionFeedHost [data-feeditem="agent:00000000-0000-4000-8000-00000000a102"]');
    await expect(item.locator('.feedTitle')).toHaveText('#7 Customer Service Agent passed this to you');
    await item.locator('[data-feedopen="aiPanel"]').click();
    await expect(page.locator('#aiPanel')).toBeVisible();
  });

  test('the log cannot be read: says so, never "no steps"', async ({ page, backend }) => {
    await page.addInitScript(() => { try { localStorage.setItem('he_agent_diary', 'on'); } catch (e) {} });
    await page.route('**/rest/v1/ai_decision_log*', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'XX000', message: 'SYNTHETIC failure' }) }));
    await login(page); await gotoPage(page, 'aiPanel');
    await expect(page.locator('#agentDiaryHost [role="status"]')).toContainText('could not be read');
    await expect(page.locator('#agentDiaryHost .empty')).toHaveCount(0);
  });

  test('readable in light and dark, named controls; fits a phone', async ({ page, backend }, ti) => {
    backend.tables.ai_decision_log = ROWS;
    await page.addInitScript(() => { try { localStorage.setItem('he_agent_diary', 'on'); } catch (e) {} });
    await login(page);
    const check = (loc) => loc.evaluate((root, src) => (new Function('return ' + src)())(root), contrastFailures.toString());
    for (const scheme of ti.project.name === 'desktop' ? ['light', 'dark'] : ['light']) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await gotoPage(page, 'aiPanel');
      await expect(page.locator('#agentDiaryHost [data-diaryentry]').first()).toBeVisible();
      await page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))));
      expect(await check(page.locator('#agentDiaryHost')), scheme).toEqual([]);
      expect(await page.locator('#agentDiaryHost').evaluate(unnamedControls), scheme).toEqual([]);
    }
    if (ti.project.name === 'iphone') expect(await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth)).toBeLessThanOrEqual(1);
  });
});

// Nov 24: with the "Handled" switch (he_handoff_handled) a step passed to a person
// can be marked handled here too. It is the same mark as on Home: handled in one
// place, handled in the other. The agents' own log is never changed.
test.describe('the diary and "Handled"', () => {
  test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date(NOW)); });
  const HANDOFF = '00000000-0000-4000-8000-00000000a102';
  const flags = (page, list) => page.addInitScript((keys) => { try { keys.forEach(k => localStorage.setItem(k, 'on')); } catch (e) {} }, list);

  test('switch off (as shipped): the diary has no Handled button and no Handled mark', async ({ page, backend }) => {
    backend.tables.ai_decision_log = ROWS;
    await flags(page, ['he_agent_diary']);
    await login(page); await gotoPage(page, 'aiPanel');
    await expect(page.locator(`#agentDiaryHost [data-diaryentry="${HANDOFF}"]`)).toContainText('Passed to a person');
    await expect(page.locator('#agentDiaryHost [data-diaryhandled]')).toHaveCount(0);
    await expect(page.locator('#agentDiaryHost [data-diaryhandledon]')).toHaveCount(0);
  });

  test('switched on: only the step passed to a person has the button; pressing it marks it here and takes it off Home; nothing is written to the database', async ({ page, backend, pageErrors }) => {
    backend.tables.ai_decision_log = ROWS;
    await flags(page, ['he_agent_diary', 'he_attention_feed', 'he_handoff_handled']);
    await login(page); await gotoPage(page, 'aiPanel');
    const d = page.locator('#agentDiaryHost'), entry = d.locator(`[data-diaryentry="${HANDOFF}"]`);
    await expect(d.locator('[data-diaryhandled]')).toHaveCount(1);
    const btn = entry.locator('[data-diaryhandled]');
    await expect(btn).toHaveAccessibleName(/^Handled: #7 Customer Service Agent, /);
    await btn.click();
    await expect(entry.locator('[data-diaryhandledon]')).toHaveText('Handled Nov 24');
    await expect(d.locator('[data-diaryhandled]')).toHaveCount(0);
    expect(await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-diaryentry'))).toBe(HANDOFF);
    expect(Object.keys(JSON.parse(await page.evaluate(() => localStorage.getItem('he_handoffs_handled'))))).toEqual([HANDOFF]);
    // Home agrees: the hand-off is no longer in the list
    await gotoPage(page, 'attentionPanel');
    await expect(page.locator('#attentionFeedHost')).toBeVisible();
    await expect(page.locator(`#attentionFeedHost [data-feeditem="agent:${HANDOFF}"]`)).toHaveCount(0);
    // and it stays marked after a reload
    await page.reload(); await expect(page.locator('#dash')).toBeVisible(); await gotoPage(page, 'aiPanel');
    await expect(entry.locator('[data-diaryhandledon]')).toHaveText('Handled Nov 24');
    expect(backend.requests.filter(r => r.method && r.method !== 'GET' && r.method !== 'HEAD' && String(r.path || '').startsWith('/rest/v1/') && !r.rpc)).toEqual([]);   // no table was written; nothing was saved by a function either
    expect(backend.requests.filter(r => r.rpc === 'set_shared_setting')).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('handled on Home shows as handled in the diary; readable in light and dark, every control named', async ({ page, backend }, ti) => {
    backend.tables.ai_decision_log = ROWS.concat([{ id: '00000000-0000-4000-8000-00000000a104', agent_key: 'customer_service_agent', output_summary: 'SYNTHETIC a second hand-off', confidence: 0.5, escalated_to_human: true, created_at: '2026-11-24T10:00:00Z' }]);
    await flags(page, ['he_agent_diary', 'he_attention_feed', 'he_handoff_handled']);
    await login(page); await gotoPage(page, 'attentionPanel');
    await page.locator(`#attentionFeedHost [data-feeditem="agent:${HANDOFF}"] [data-feedhandled]`).click();
    const check = (loc) => loc.evaluate((root, src) => (new Function('return ' + src)())(root), contrastFailures.toString());
    for (const scheme of ti.project.name === 'desktop' ? ['light', 'dark'] : ['light']) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await gotoPage(page, 'aiPanel');
      const d = page.locator('#agentDiaryHost');
      await expect(d.locator(`[data-diaryentry="${HANDOFF}"] [data-diaryhandledon]`)).toHaveText('Handled Nov 24');
      await expect(d.locator('[data-diaryhandled]')).toHaveCount(1);          // the other hand-off still waits
      await page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))));
      expect(await check(d), scheme).toEqual([]);
      expect(await d.evaluate(unnamedControls), scheme).toEqual([]);
    }
    if (ti.project.name === 'iphone') {
      expect(await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth)).toBeLessThanOrEqual(1);
      const box = await page.locator('#agentDiaryHost [data-diaryhandled]').boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(40);                        // easy to tap
    }
  });
});
