// Seeded UI chaos runner (EXT15, moved here in EXT17 so the long and high-risk
// runs share it with chaos-ui-ext15.spec.js). The whole operation list is
// generated from the seed first, so a failing run can be replayed and shrunk.
const { login, gotoPage, openMenuIfMobile } = require('./dashboard');

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
const pick = (r, a) => a[Math.floor(r() * a.length)];
const OPS = ['page', 'page', 'page', 'back', 'forward', 'palette', 'search', 'resize', 'offline', 'task', 'task', 'slow'];
// EXT17: high-risk mix adds manual stock adjustments with lost replies. Only
// used when asked for, so the EXT15/EXT16 seeds keep their exact sequences.
const OPS_HIGH_RISK = OPS.concat(['adjust', 'adjust', 'adjust']);

// A replay must start signed out: the synthetic session survives a reload, so without
// clearing it the sign-in form is not there (replays used to hang on it).
async function freshSignIn(page) {
  await page.goto('/owner-login.html');
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
  await login(page);
}

function genOps(seed, n, ids, opts) {
  const r = rng(seed);
  const list = opts && opts.highRisk ? OPS_HIGH_RISK : OPS;
  return Array.from({ length: n }, () => {
    const op = pick(r, list);
    if (op === 'page' || op === 'offline' || op === 'slow') return { op, page: pick(r, ids) };
    if (op === 'palette') return { op, text: pick(r, ['ta', 'inv', 'SYN', '<b>', 'zz']) };
    if (op === 'search') return { op, text: pick(r, ['SYN', 'task', '"; DROP', '中文', '']) };
    if (op === 'resize') return { op, width: pick(r, [1100, 900, 760, 1280]) };
    if (op === 'adjust') return { op, amount: 1 + Math.floor(r() * 5), mode: pick(r, ['ok', 'lostSaved', 'lostUnsaved']) };
    return { op };
  });
}

// One manual adjustment, possibly with a lost reply and an impatient second
// press. Invariant: the stock moves by 0 or by the amount, never twice.
async function adjustOnce(page, backend, o) {
  await gotoPage(page, 'inventoryPanel');
  await page.waitForLoadState('networkidle');
  const productId = await page.locator('#invProduct option[value]:not([value=""])').first().getAttribute('value').catch(() => null);
  if (!productId) { if (process.env.CHAOS_DEBUG) console.log('CHAOS adjust: no product option'); return null; }
  const row = () => (backend.tables.inventory || []).find(x => x.product_id === productId);
  if (!row()) { if (process.env.CHAOS_DEBUG) console.log('CHAOS adjust: no inventory row for', productId); return null; }
  const before = Number(row().available || 0);
  if (o.mode !== 'ok') backend.dropNext('inventory', 'PATCH', { applied: o.mode === 'lostSaved' });
  await page.selectOption('#invProduct', productId);
  await page.selectOption('#invBucket', 'available');
  await page.fill('#invAmount', String(o.amount));
  // A press is finished when the Save button is enabled again and the page is
  // quiet (measuring right after the click missed saves still in flight, so a
  // double count could have gone unseen: found while proving this check).
  const settled = async () => {
    await page.waitForFunction(() => { const b = document.querySelector('#adjustInventoryForm button[type=submit]'); return b && !b.disabled; }, null, { timeout: 30000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(250);
    await page.waitForLoadState('networkidle');
  };
  await page.click('#adjustInventoryForm button[type=submit]');
  await settled();
  if (o.mode !== 'ok') { // the operator presses Save again after the error
    await page.click('#adjustInventoryForm button[type=submit]');
    await settled();
  }
  const delta = Number(row().available || 0) - before;
  if (process.env.CHAOS_DEBUG) console.log('CHAOS adjust', JSON.stringify(o), 'delta', delta, 'msg:', (await page.locator('#dashError').textContent().catch(() => '')).slice(0, 160), 'toast:', await page.locator('#toastHost').textContent().catch(() => ''));
  o.applied = delta; // the spec's end-of-run total check uses it
  if (delta !== 0 && delta !== o.amount) return 'one adjustment of ' + o.amount + ' (' + o.mode + ') changed the stock by ' + delta;
  if (o.mode === 'lostUnsaved' && delta !== 0) return 'an adjustment whose save was dropped before the database changed the stock by ' + delta;
  if (o.mode !== 'lostUnsaved' && delta !== o.amount) return 'an adjustment of ' + o.amount + ' (' + o.mode + ') did not land (stock changed by ' + delta + ')';
  return null;
}

async function runOps(page, backend, context, ops, phone, errors, plant) {
  // EXT20 (INT-3 next-failure evidence): requests still in flight when a step fails
  // are named in the failure message, so a "networkidle did not settle" failure
  // says which request kept the page busy (and whether the mock had a delay or a
  // drop queued) instead of only that it timed out.
  const inFlight = new Map();
  const onReq = r => inFlight.set(r, Date.now());
  const onDone = r => inFlight.delete(r);
  page.on('request', onReq); page.on('requestfinished', onDone); page.on('requestfailed', onDone);
  const pendingNote = () => {
    const now = Date.now();
    const list = [...inFlight].map(([r, t]) => r.method() + ' ' + r.url().replace(/^https?:\/\/[^/]+/, '').slice(0, 80) + ' (' + (now - t) + ' ms)');
    const hooks = backend.pendingHooks ? backend.pendingHooks() : null;
    return (list.length ? ' | in flight: ' + list.join('; ') : ' | nothing in flight') + (hooks && hooks.length ? ' | queued mock hooks: ' + hooks.join('; ') : '');
  };
  try {
    return await runOpsInner(page, backend, context, ops, phone, errors, plant, pendingNote);
  } finally {
    page.off('request', onReq); page.off('requestfinished', onDone); page.off('requestfailed', onDone);
  }
}

async function runOpsInner(page, backend, context, ops, phone, errors, plant, pendingNote) {
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
      else if (op === 'adjust') { const bad = await adjustOnce(page, backend, ops[step]); if (bad) return { step, message: bad }; }
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
      return { step, message: String(e && e.message || e).split('\n')[0] + pendingNote() };
    }
  }
  return null;
}

module.exports = { rng, pick, OPS, OPS_HIGH_RISK, genOps, runOps, freshSignIn, adjustOnce };
