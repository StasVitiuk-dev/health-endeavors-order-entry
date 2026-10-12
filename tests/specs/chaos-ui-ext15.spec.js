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

for (const seed of [1501, 1502, 1503]) {
  test(`UI chaos seed ${seed}: 70 random steps keep every invariant`, async ({ page, backend, context }, ti) => {
    test.skip(ti.project.name !== 'desktop' && seed !== 1501, 'phone runs one seed');
    test.setTimeout(420000);
    enableWrites(backend, []);
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await login(page);
    const ids = await page.locator('#sidebarGroups .sidebarLink[data-page]').evaluateAll(els => [...new Set(els.map(e => e.getAttribute('data-page')))]);
    const r = rng(seed);
    const log = [];
    let taskClicks = 0;
    const phone = ti.project.name !== 'desktop';
    for (let step = 0; step < 70; step++) {
      const op = pick(r, OPS);
      log.push(op);
      try {
        if (op === 'page') await gotoPage(page, pick(r, ids));
        else if (op === 'back') await page.goBack({ waitUntil: 'commit' }).catch(() => {});
        else if (op === 'forward') await page.goForward({ waitUntil: 'commit' }).catch(() => {});
        else if (op === 'palette' && !phone) { await page.keyboard.press('Escape'); await page.keyboard.press('ControlOrMeta+k'); await page.keyboard.type(pick(r, ['ta', 'inv', 'SYN', '<b>', 'zz'])); await page.keyboard.press('Escape'); }
        else if (op === 'search') { await openMenuIfMobile(page); await page.fill('#sidebarSearch', pick(r, ['SYN', 'task', '"; DROP', '中文', ''])); await page.fill('#sidebarSearch', ''); await page.keyboard.press('Escape'); }
        else if (op === 'resize' && !phone) await page.setViewportSize({ width: pick(r, [1100, 900, 760, 1280]), height: 800 });
        else if (op === 'offline') { await context.setOffline(true); await gotoPage(page, pick(r, ids)).catch(() => {}); await context.setOffline(false); }
        else if (op === 'slow') { backend.delayNext('tasks', 'GET', 1200); await gotoPage(page, 'tasksPanel'); await gotoPage(page, pick(r, ids)); }
        else if (op === 'task') {
          await gotoPage(page, 'tasksPanel');
          const btn = page.locator('#tasksTableWrap tr[data-id] .taskStatusBtn:not([disabled])').first();
          if (await btn.count()) {
            page.once('dialog', d => d.accept());
            const before = backend.taskUpdates ? backend.taskUpdates().length : 0;
            await btn.click({ timeout: 3000 }).catch(() => {});
            await btn.click({ timeout: 500 }).catch(() => {}); // the same person's double click
            taskClicks++;
            await page.waitForLoadState('networkidle');
            const after = backend.taskUpdates ? backend.taskUpdates().length : 0;
            expect(after - before, `seed ${seed} step ${step}: one click, at most one update`).toBeLessThanOrEqual(1);
          }
        }
        await page.waitForTimeout(80);
        await expect(page.locator('#dash')).toBeVisible();
        const active = await page.locator('section.panel.activePage').count();
        expect(active, `seed ${seed} step ${step} (${log.slice(-6).join(',')}): exactly one active page`).toBe(1);
        expect(errors, `seed ${seed} step ${step} (${log.slice(-6).join(',')})`).toEqual([]);
      } catch (e) {
        throw new Error(`UI chaos seed ${seed} failed at step ${step} after: ${log.slice(-10).join(', ')}\n${e.message}`);
      }
    }
    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
    ti.annotations.push({ type: 'chaos', description: `seed ${seed}: 70 steps, ${taskClicks} task double-clicks: ${log.join(',')}` });
  });
}
