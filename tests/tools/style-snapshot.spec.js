// EXT15 migration proof (not part of `npm test`): records the computed style of
// every element on every owner-dashboard page, on rich synthetic data with a
// fixed clock, so two versions of the page code can be compared exactly.
//
//   STYLE_OUT=/tmp/a.json npx playwright test -c tests/tools/style-snapshot.config.js
//   node tests/tools/style-diff.js /tmp/before.json /tmp/after.json
//
// Used to prove the inline-style → utility-class change renders identically.
const fs = require('fs');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { NOW, seedBusiness } = require('../fixtures/business-data');

const PROPS = ['display', 'visibility', 'position', 'font-size', 'font-weight', 'font-family', 'font-style', 'color', 'background-color',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis', 'gap', 'align-items', 'align-self', 'justify-content',
  'width', 'height', 'min-width', 'max-width', 'border-top-width', 'border-top-style', 'border-top-color', 'border-bottom-width', 'border-left-width',
  'border-top-left-radius', 'text-align', 'white-space', 'line-height', 'overflow-x', 'overflow-y', 'cursor', 'resize', 'opacity', 'vertical-align',
  'word-break', 'text-transform', 'letter-spacing', 'box-sizing', 'grid-template-columns', 'list-style-type'];

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });
test('computed styles of every page', async ({ page, backend }, ti) => {
  test.setTimeout(900000);
  seedBusiness(backend);
  await page.clock.setFixedTime(NOW);
  await login(page);
  await page.waitForLoadState('networkidle');
  const ids = await page.locator('#sidebarGroups .sidebarLink[data-page]').evaluateAll(els => [...new Set(els.map(e => e.getAttribute('data-page')))]);
  const out = { project: ti.project.name, pages: {} };
  // wait out CSS transitions (opacity fades) so timing never shows up as a difference
  const snap = async () => { await page.waitForTimeout(600); return page.evaluate(props => {
    const rows = [];
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('#stagingBanner')) continue;
      const cs = getComputedStyle(el);
      rows.push([el.tagName + (el.id ? '#' + el.id : ''), props.map(p => cs.getPropertyValue(p))]);
    }
    return rows;
  }, PROPS); };
  out.pages.__login_home = await snap();
  for (const id of ids) {
    await gotoPage(page, id);
    await page.waitForLoadState('networkidle');
    out.pages[id] = await snap();
  }
  out.props = PROPS;
  fs.writeFileSync(process.env.STYLE_OUT + '.' + ti.project.name + '.json', JSON.stringify(out));
  expect(ids.length).toBeGreaterThan(20);
});
