// A coloured tile on Home (red: needs you now; amber: worth a look; green: fine) must show
// its figure. Found Nov 24: in the Aurora look the figure of a coloured tile was drawn in a
// transparent colour, so a red "Overdue tasks" tile showed its caption and no number: the
// tiles that matter most lost their figure. The plain tiles were never affected.
// assets/looks/he-looks.css. Every value is made up.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const alpha = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return 1; const p = m[1].split(',').map(s => s.trim()); return p.length === 4 ? Number(p[3]) : 1; };
async function tiles(page) {
  return page.evaluate(() => [...document.querySelectorAll('#businessHealthStats .stat')].map(t => {
    const n = t.querySelector('.num'), cs = getComputedStyle(n);
    return { kind: ['statCritical', 'statWarn', 'statGood'].find(k => t.classList.contains(k)) || 'plain', text: n.textContent.trim(), color: cs.color, fill: cs.webkitTextFillColor,
      clip: cs.backgroundClip || cs.webkitBackgroundClip, image: cs.backgroundImage, caption: (t.querySelector('.lbl') || {}).textContent || '' };
  }));
}
// a figure can be read when its own colour is solid, or when it is painted with a picture clipped to the letters
const readable = (t) => (alpha(t.color) === 1 && alpha(t.fill) === 1) || (t.clip === 'text' && t.image !== 'none');

for (const look of ['aurora', 'graphite', 'original-plus', 'classic']) {
  for (const theme of ['light', 'dark']) {
    test('look "' + look + '", ' + theme + ': every tile on Home shows its figure, the coloured ones in their own colour', async ({ page }, ti) => {
      test.skip(ti.project.name !== 'desktop', 'one size is enough');
      await page.emulateMedia({ colorScheme: theme });
      await page.addInitScript((l) => { try { if (l !== 'aurora') localStorage.setItem('he_look', l); } catch (e) {} }, look);
      await login(page);
      await gotoPage(page, 'attentionPanel');
      await expect(page.locator('#businessHealthStats .stat').first()).toBeVisible();
      const all = await tiles(page);
      expect(all.length).toBeGreaterThan(3);
      const coloured = all.filter(t => t.kind !== 'plain');
      expect(coloured.length, 'the made-up data has at least one coloured tile (an overdue task)').toBeGreaterThan(0);
      for (const t of all) {
        expect(t.text, t.caption).not.toBe('');
        expect(readable(t), t.caption + ' (' + t.kind + '): colour ' + t.color + ', fill ' + t.fill + ', clip ' + t.clip).toBe(true);
      }
      // a coloured tile's figure is solid, in the colour of its state (never the plain tiles' picture)
      for (const t of coloured) { expect(alpha(t.color), t.caption).toBe(1); expect(t.clip, t.caption).not.toBe('text'); }
    });
  }
}
