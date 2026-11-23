// The change-password page (opened from the password-reset email) in light and dark
// mode (Nov 23). Found while preparing the Aurora comparison: in dark mode the page
// background used the near-white text colour, so a bright light-blue gradient sat
// behind the dark card. Checks: the background is dark in dark mode and stays the
// brand gradient in light mode; the card text stays readable on the card.
const { test, expect } = require('../helpers/dashboard');

const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const stops = (img) => [...img.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g)].map(m => [+m[1], +m[2], +m[3]]);

for (const scheme of ['light', 'dark']) {
  test(`change-password page: background and card in ${scheme} mode`, async ({ page }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'colours are the same at phone size');
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/change-password.html');
    const img = await page.locator('#screen').evaluate(el => getComputedStyle(el).backgroundImage);
    const colours = stops(img);
    expect(colours.length, img).toBeGreaterThanOrEqual(2);
    const brightest = Math.max(...colours.map(lum));
    if (scheme === 'dark') expect(brightest, 'dark mode page background ' + img).toBeLessThan(0.05);
    else expect(img).toContain('linear-gradient');
    // the card's title is readable on the card
    const ratio = await page.locator('.card').evaluate(card => {
      const p = s => s.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
      const L = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const h1 = card.querySelector('h1');
      const a = L(p(getComputedStyle(h1).color)), b = L(p(getComputedStyle(card).backgroundColor));
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
}
