// AI Agent Activity: every agent shows one honest state computed from what the
// dashboard can actually read (agent_controls, last_run_*, the scheduled-job
// list) — ENABLED, DISABLED, UNKNOWN, FAILED, STALE, DRY RUN or CALCULATED
// HERE. Nothing is shown as "on" when it could not be read. Synthetic data;
// no agent setting is changed by any of these tests.

const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const minutesAgo = m => new Date(Date.now() - m * 60000).toISOString();

function seed(backend) {
  backend.tables.agent_controls = [
    { agent_num: 1, enabled: true, updated_by: null, updated_at: null },
    // #2 has no row on purpose
    { agent_num: 3, enabled: true, updated_by: null, updated_at: null },
    { agent_num: 4, enabled: true, updated_by: null, updated_at: null, last_run_at: minutesAgo(10), last_run_status: 'ok' },
    { agent_num: 5, enabled: true, updated_by: null, updated_at: null, last_run_at: minutesAgo(5 * 60), last_run_status: 'ok' },
    { agent_num: 6, enabled: true, updated_by: null, updated_at: null, last_run_at: minutesAgo(20), last_run_status: 'ok' },
    { agent_num: 7, enabled: false, updated_by: null, updated_at: null },
    { agent_num: 8, enabled: true, updated_by: null, updated_at: null, last_run_status: 'failed', last_error: 'SYNTHETIC boom' },
  ];
  backend.rpc.get_agent_cron_status = [
    { jobname: 'agent_4_retail_wholesale', schedule: '3 * * * *', active: true },
    { jobname: 'agent_5_shipping_tracking', schedule: '10 * * * *', active: true },
    { jobname: 'agent_6_customer_notifications', schedule: '5 * * * *', active: true },
  ];
}

const card = (page, n) => page.locator(`#agentRegistryWrap .deletedRow[data-agent="${n}"]`);

test('each agent shows the state its data supports', async ({ page, backend }) => {
  seed(backend);
  await login(page);
  await gotoPage(page, 'aiPanel');
  const expected = { 1: 'Enabled', 2: 'Unknown', 3: 'Unknown', 4: 'Enabled', 5: 'Stale', 6: 'Dry run', 7: 'Disabled', 8: 'Failed', 9: 'Calculated here', 10: 'Calculated here' };
  for (const [n, label] of Object.entries(expected)) {
    await expect(card(page, n).locator('.agentTruthBadge')).toHaveText(label);
  }
  await expect(card(page, 5)).toContainText('Last run 5 hours ago; it should run every hour.');
  await expect(card(page, 8)).toContainText('SYNTHETIC boom');
  await expect(card(page, 3)).toContainText('runs on GitHub Actions, which this dashboard cannot see');
  // #1 no longer claims "Live now" as fixed text.
  await expect(card(page, 1)).not.toContainText('Live now');
  // A switch with no row is not shown as on, and can't be used.
  await expect(card(page, 2).locator('.agentToggle')).toBeDisabled();
  await expect(card(page, 2).locator('.agentToggle')).not.toBeChecked();
  await expect(card(page, 7).locator('.agentToggle')).not.toBeChecked();
  await expect(card(page, 1).locator('.agentToggle')).toBeChecked();
  expect(backend.tableWrites()).toEqual([]);
});

test('a stopped scheduled job makes a running-looking agent "Stale"', async ({ page, backend }) => {
  seed(backend);
  backend.rpc.get_agent_cron_status = backend.rpc.get_agent_cron_status.map(j => j.jobname === 'agent_4_retail_wholesale' ? { ...j, active: false } : j);
  await login(page);
  await gotoPage(page, 'aiPanel');
  await expect(card(page, 4).locator('.agentTruthBadge')).toHaveText('Stale');
  await expect(card(page, 4)).toContainText('scheduled job is not active');
});

test('if the switches cannot be read, every agent is "Unknown", switches are disabled and a banner says so', async ({ page, backend }) => {
  seed(backend);
  const original = backend.handleRest.bind(backend);
  backend.handleRest = (route, entry) => (entry.table === 'agent_controls' && entry.method === 'GET')
    ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'SYNTHETIC outage' }) })
    : original(route, entry);
  await login(page);
  await gotoPage(page, 'aiPanel');
  for (const n of [1, 2, 4, 5, 6, 7, 8]) {
    await expect(card(page, n).locator('.agentTruthBadge')).toHaveText('Unknown');
    await expect(card(page, n).locator('.agentToggle')).toBeDisabled();
    await expect(card(page, n).locator('.agentToggle')).not.toBeChecked();
  }
  await expect(page.locator('#pausedAgentsBanner')).toContainText('Agent switches could not be read');
  expect(backend.tableWrites()).toEqual([]);
});
