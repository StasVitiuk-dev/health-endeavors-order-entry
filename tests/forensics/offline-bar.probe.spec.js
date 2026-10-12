// EXT16 forensic probe (not part of npm test): the OPEN INTERMITTENT offline-bar
// failure (GitHub shard 2, 079f378). Records, at the FIRST instant after going
// offline (no re-check), what is under the centre of each header button, plus
// geometry, viewport, sidebar state and timing. Variants: resize just before,
// delayed stylesheet. Output: one JSON line per run (PROBE …).
const { test, login } = require('../helpers/dashboard');
const MODE = process.env.PROBE_MODE || 'plain';
test('offline-bar first-instant probe', async ({ page, context }, ti) => {
  if (MODE === 'slowcss') await page.route('**/assets/owner-login.css*', async r => { await new Promise(x => setTimeout(x, 400)); r.fallback(); });
  await login(page);
  if (ti.project.name === 'desktop') {
    if (MODE === 'resize') await page.setViewportSize({ width: 1280, height: 800 });
    await page.setViewportSize({ width: 760, height: 800 });
    if (MODE === 'settled') await page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))));
  }
  const t0 = Date.now();
  await context.setOffline(true);
  const snap = await page.evaluate(() => {
    const out = { vw: innerWidth, vh: innerHeight, nav: (document.getElementById('sidebarNav') || {}).className, anims: document.getAnimations().map(a => (a.effect && a.effect.target && (a.effect.target.id || a.effect.target.className)) + ':' + a.playState).slice(0, 8) };
    const bar = document.getElementById('offlineBar');
    out.bar = bar ? { cls: bar.className, rect: bar.getBoundingClientRect().toJSON(), pos: getComputedStyle(bar).position, bottom: getComputedStyle(bar).bottom } : null;
    for (const id of ['menuToggleBtn', 'refreshBtn', 'signout']) {
      const e = document.getElementById(id); if (!e) continue;
      const r = e.getBoundingClientRect(); const vis = r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none';
      if (!vis) { out[id] = 'hidden'; continue; }
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      out[id] = top === e || e.contains(top) ? 'ok' : { coveredBy: top ? top.tagName + '#' + top.id + '.' + String(top.className).slice(0, 50) : null, rect: r.toJSON() };
    }
    return out;
  });
  snap.ms = Date.now() - t0; snap.project = ti.project.name; snap.mode = MODE; snap.rep = ti.repeatEachIndex;
  console.log('PROBE ' + JSON.stringify(snap));
  await context.setOffline(false);
});
