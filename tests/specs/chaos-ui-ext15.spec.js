// EXT15 deterministic UI chaos: seeded random sequences of what a busy operator
// does (page changes, Back/Forward, palette, search, resize, offline/online,
// double clicks on task buttons, slow and stale replies). After every step:
//   * no uncaught script error;
//   * the dashboard is still shown and exactly one page is active;
//   * no task status was sent twice for one click, and the page never claims a
//     change the database did not record.
// A failure names the seed and the last steps, so it can be replayed exactly.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { enableWrites } = require('../helpers/stateful-backend');

// EXT17: the runner (operation generator, step runner, fresh sign-in) lives in
// tests/helpers/chaos.js, shared with the long and high-risk runs.
const { genOps, runOps, freshSignIn } = require('../helpers/chaos');
const { shrink, describe } = require('../helpers/shrink');

for (const seed of [1501, 1502, 1503]) {
  test(`UI chaos seed ${seed}: 70 random steps keep every invariant`, async ({ page, backend, context }, ti) => {
    test.skip(ti.project.name !== 'desktop' && seed !== 1501, 'phone runs one seed');
    test.setTimeout(600000);
    page.setDefaultTimeout(30000); // a hang becomes a reported failure, not a stall
    enableWrites(backend, []);
    const startRows = JSON.parse(JSON.stringify(backend.tables));
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await login(page);
    const ids = await page.locator('#sidebarGroups .sidebarLink[data-page]').evaluateAll(els => [...new Set(els.map(e => e.getAttribute('data-page')))]);
    const phone = ti.project.name !== 'desktop';
    const ops = genOps(seed, 70, ids);
    const fail = await runOps(page, backend, context, ops, phone, errors);
    if (fail) {
      const replay = async cand => {
        backend.tables = JSON.parse(JSON.stringify(startRows));
        errors.length = 0;
        await context.setOffline(false);
        if (!phone) await page.setViewportSize({ width: 1280, height: 800 });
        await freshSignIn(page);
        return !!(await runOps(page, backend, context, cand, phone, errors));
      };
      const small = await shrink(ops.slice(0, fail.step + 1), replay, { maxRuns: 25, maxMs: 240000 });
      throw new Error(`UI chaos seed ${seed} failed at step ${fail.step} (${fail.message}).\n`
        + `Smallest failing sequence found (${small.ops.length} of ${fail.step + 1} steps, ${small.runs} replays${small.complete ? '' : ', budget reached'}): ${describe(small.ops)}`);
    }
    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
    ti.annotations.push({ type: 'chaos', description: `seed ${seed}: 70 steps: ${ops.map(o => o.op).join(',')}` });
  });
}

// EXT16: the shrinker on the REAL browser runner, with a planted failure: "a search,
// then later a task click" fails. A 24-step seed-1501 run must shrink to those 2 steps.
// (Each replay is a full browser run, so a 70-step shrink is slow; the shrinking logic on
// long sequences is covered cheaply in shrink-ext16.spec.js.)
test('chaos shrinker on the real runner: a planted search→task failure shrinks to the 2 essential steps', async ({ page, backend, context }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'once');
  test.setTimeout(600000);
  page.setDefaultTimeout(30000);
  enableWrites(backend, []);
  const startRows = JSON.parse(JSON.stringify(backend.tables));
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await login(page);
  const ids = await page.locator('#sidebarGroups .sidebarLink[data-page]').evaluateAll(els => [...new Set(els.map(e => e.getAttribute('data-page')))]);
  const plant = done => { const i = done.findIndex(o => o.op === 'search'); return i >= 0 && done.slice(i + 1).some(o => o.op === 'task') ? 'planted: task after search' : null; };
  const ops = genOps(1501, 24, ids);
  const fail = await runOps(page, backend, context, ops, false, errors, plant);
  expect(fail && fail.message).toBe('planted: task after search');
  const replay = async cand => {
    try {
      backend.tables = JSON.parse(JSON.stringify(startRows)); errors.length = 0;
      await context.setOffline(false); await page.setViewportSize({ width: 1280, height: 800 });
      await freshSignIn(page);
      const f = await runOps(page, backend, context, cand, false, errors, plant);
      if (process.env.SHRINK_DEBUG) console.log('REPLAY', cand.length, JSON.stringify(f));
      return !!(f && /planted/.test(f.message));
    } catch (e) { if (process.env.SHRINK_DEBUG) console.log('REPLAY-THREW', String(e).split('\n')[0]); throw e; }
  };
  const small = await shrink(ops.slice(0, fail.step + 1), replay, { maxRuns: 80, maxMs: 480000 });
  ti.annotations.push({ type: 'shrink', description: `${fail.step + 1} → ${small.ops.length} steps in ${small.runs} replays, ${small.ms} ms: ${describe(small.ops)}` });
  expect(small.ops.map(o => o.op)).toEqual(['search', 'task']);
});

// Found by seed 1501: the offline bar sat on top of the header, so an operator who
// went offline on a narrow screen could not open the menu (the click never landed).
test('offline: the offline bar never covers the menu button, Refresh or Sign out', async ({ page, context }, ti) => {
  await login(page);
  if (ti.project.name === 'desktop') {
    await page.setViewportSize({ width: 760, height: 800 });
    // EXT16 root cause of the OPEN INTERMITTENT (GitHub shard 2, 079f378): crossing the 820 px
    // breakpoint slides the sidebar away (0.22 s transform); a check inside that slide sees the
    // sidebar over the menu button. Wait for running animations, then check strictly.
    await page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))));
  }
  await context.setOffline(true);
  await expect(page.locator('#offlineBar')).toBeVisible();
  for (const sel of ['#menuToggleBtn', '#refreshBtn', '#signout']) {
    const el = page.locator(sel);
    if (!(await el.isVisible())) continue;
    const hit = await el.evaluate(e => {
      const r = e.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return top === e || e.contains(top) ? 'ok' : 'covered by ' + (top ? top.tagName + '#' + top.id + '.' + String(top.className).slice(0, 60) : 'nothing');
    });
    expect(hit, sel + ' must receive the click while offline').toBe('ok');
  }
  await page.locator('#menuToggleBtn').click({ timeout: 3000 }).catch(() => {}); // narrow layouts only
  await gotoPage(page, 'tasksPanel');
  await expect(page.locator('section#tasksPanel')).toHaveClass(/activePage/);
  await context.setOffline(false);
});
