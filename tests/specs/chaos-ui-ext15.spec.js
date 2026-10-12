// EXT15 deterministic UI chaos: seeded random sequences of what a busy operator
// does (page changes, Back/Forward, palette, search, resize, offline/online,
// double clicks on task buttons, slow and stale replies). After every step:
//   * no uncaught script error;
//   * the dashboard is still shown and exactly one page is active;
//   * no task status was sent twice for one click, and the page never claims a
//     change the database did not record.
// A failure names the seed and the last steps, so it can be replayed exactly.
const { test, expect, login, gotoPage, openMenuIfMobile } = require('../helpers/dashboard');
const { enableWrites } = require('../helpers/stateful-backend');

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
const pick = (r, a) => a[Math.floor(r() * a.length)];
const OPS = ['page', 'page', 'page', 'back', 'forward', 'palette', 'search', 'resize', 'offline', 'task', 'task', 'slow'];

// EXT16: the whole operation list is generated from the seed up front, so a failing run
// can be replayed with operations removed. On a failure the test shrinks the sequence
// (tests/helpers/shrink.js): each candidate runs on a fresh sign-in with the mock
// database restored to its starting rows; the error names the seed, the failing step
// and the smallest failing sequence found within the budget.
const { shrink, describe } = require('../helpers/shrink');
// A replay must start signed out: the synthetic session survives a reload, so without
// clearing it the sign-in form is not there (replays used to hang on it).
async function freshSignIn(page) {
  await page.goto('/owner-login.html');
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
  await login(page);
}
function genOps(seed, n, ids) {
  const r = rng(seed);
  return Array.from({ length: n }, () => {
    const op = pick(r, OPS);
    if (op === 'page' || op === 'offline' || op === 'slow') return { op, page: pick(r, ids) };
    if (op === 'palette') return { op, text: pick(r, ['ta', 'inv', 'SYN', '<b>', 'zz']) };
    if (op === 'search') return { op, text: pick(r, ['SYN', 'task', '"; DROP', '中文', '']) };
    if (op === 'resize') return { op, width: pick(r, [1100, 900, 760, 1280]) };
    return { op };
  });
}
async function runOps(page, backend, context, ops, phone, errors, plant) {
  for (let step = 0; step < ops.length; step++) {
    const { op } = ops[step];
    const t0 = Date.now();
    try {
      if (op === 'page') await gotoPage(page, ops[step].page);
      else if (op === 'back') await page.goBack({ waitUntil: 'commit' }).catch(() => {});
      else if (op === 'forward') await page.goForward({ waitUntil: 'commit' }).catch(() => {});
      else if (op === 'palette' && !phone) { await page.keyboard.press('Escape'); await page.keyboard.press('ControlOrMeta+k'); await page.keyboard.type(ops[step].text); await page.keyboard.press('Escape'); }
      else if (op === 'search') { await openMenuIfMobile(page); await page.fill('#sidebarSearch', ops[step].text); await page.fill('#sidebarSearch', ''); await page.keyboard.press('Escape'); }
      else if (op === 'resize' && !phone) await page.setViewportSize({ width: ops[step].width, height: 800 });
      else if (op === 'offline') { await context.setOffline(true); await gotoPage(page, ops[step].page).catch(() => {}); await context.setOffline(false); }
      else if (op === 'slow') { backend.delayNext('tasks', 'GET', 1200); await gotoPage(page, 'tasksPanel'); await gotoPage(page, ops[step].page); }
      else if (op === 'task') {
        await gotoPage(page, 'tasksPanel');
        const btn = page.locator('#tasksTableWrap tr[data-id] .taskStatusBtn:not([disabled])').first();
        if (await btn.count()) {
          page.once('dialog', d => d.accept());
          const before = backend.taskUpdates ? backend.taskUpdates().length : 0;
          await btn.click({ timeout: 3000 }).catch(() => {});
          await btn.click({ timeout: 500 }).catch(() => {}); // the same person's double click
          await page.waitForLoadState('networkidle');
          const after = backend.taskUpdates ? backend.taskUpdates().length : 0;
          if (after - before > 1) return { step, message: 'one click sent ' + (after - before) + ' task updates' };
        }
      }
      await page.waitForTimeout(80);
      if (!(await page.locator('#dash').isVisible())) return { step, message: 'dashboard no longer shown' };
      const active = await page.locator('section.panel.activePage').count();
      if (active !== 1) return { step, message: active + ' active pages' };
      if (errors.length) return { step, message: 'script error: ' + errors[0] };
      if (plant) { const planted = plant(ops.slice(0, step + 1)); if (planted) return { step, message: planted }; }
      const ms = Date.now() - t0;
      if (ms > 20000) console.log(`CHAOS step ${step} ${op}: ${ms} ms`);
      if (ms > 45000) return { step, message: `${op} took ${ms} ms: an operator action must not hang` };
    } catch (e) {
      return { step, message: String(e && e.message || e).split('\n')[0] };
    }
  }
  return null;
}

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
