// "Did the database requests silently change?"
//
// Logs in with synthetic business data and a frozen clock, opens every page,
// and records every request the dashboard makes to the (mock) database:
// method, table or function, selected columns and filters. The list is
// compared with tests/baselines/requests.json.
//
// A refactor that is meant to change nothing must leave this list identical.
// If a change is intended, regenerate the file and review the diff in the PR:
//   UPDATE_BASELINES=1 npx playwright test --config tests/playwright.config.js request-baseline --project desktop
//
// The same run also checks that every page opens with realistic data and
// without JavaScript errors, and that just looking around writes nothing.

const fs = require('fs');
const path = require('path');
const { test, expect, login, gotoPage, openMenuIfMobile, unfoldSidebar } = require('../helpers/dashboard');
const { NOW, seedBusiness } = require('../fixtures/business-data');

const BASELINE = path.resolve(__dirname, '..', 'baselines', 'requests.json');

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });

function describe(r) {
  if (r.path.startsWith('/auth/v1/')) return `${r.method} auth:${r.path.slice('/auth/v1/'.length)}`;
  if (r.rpc) return `RPC ${r.rpc}(${Object.keys(r.body || {}).sort().join(',')})`;
  if (!r.table) return `${r.method} ${r.path}`;
  const params = r.params
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('&');
  return `${r.method} ${r.table}?${params}`;
}

test('every page opens with realistic data; the request list matches the baseline', async ({ page, backend, pageErrors }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one baseline, recorded at desktop size');
  test.setTimeout(120000);
  seedBusiness(backend);
  await page.clock.setFixedTime(NOW);
  await login(page);
  await page.waitForLoadState('networkidle');

  await openMenuIfMobile(page);
  await unfoldSidebar(page);
  const ids = await page.locator('#sidebarGroups .sidebarLink[data-page]').evaluateAll(
    links => [...new Set(links.filter(l => !l.classList.contains('searchResultLink')).map(l => l.getAttribute('data-page')))]);
  expect(ids.length).toBeGreaterThanOrEqual(30);
  for (const id of ids) {
    await gotoPage(page, id);
    await expect(page.locator(`section#${id}`)).toBeVisible();
  }
  await page.waitForLoadState('networkidle');

  expect(pageErrors).toEqual([]);
  expect(backend.tableWrites(), 'looking around must not write anything').toEqual([]);

  const actual = [...new Set(backend.requests.map(describe))].sort();
  if (process.env.UPDATE_BASELINES) {
    fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
    fs.writeFileSync(BASELINE, JSON.stringify(actual, null, 2) + '\n');
  }
  const expected = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  const added = actual.filter(x => !expected.includes(x));
  const removed = expected.filter(x => !actual.includes(x));
  expect({ added, removed }, 'database requests changed; see tests/specs/request-baseline.spec.js').toEqual({ added: [], removed: [] });
});
