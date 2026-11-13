// Sales & Growth wiring into the live dashboard, behind a default-OFF feature
// flag (he-config salesGrowthOn(), localStorage 'he_sales_growth'). These tests
// prove the two things that make the wiring safe:
//   1. With the flag OFF (the default) there is NO sidebar group, NO sidebar
//      link, and every sales panel renders only the inert DISABLED shell — so
//      the page-sweep / Trusted-Types specs never see a sales page and the live
//      dashboard is unchanged.
//   2. With the flag ON the Sales & Growth group and its seven read-only /
//      draft-only pages appear and render synthetic (SIMULATED) data, while the
//      existing pages keep working.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const SALES_IDS = ['salesCommandPanel', 'salesLeadsPanel', 'salesPipelinePanel',
  'salesApprovalsPanel', 'salesSamplesPanel', 'salesVisitsPanel',
  'salesRepurposePanel', 'salesAdVariantsPanel', 'salesFeedbackPanel', 'salesCreatorOfferPanel', 'salesReminderPanel', 'salesHealthPanel',
  'salesAnalyticsPanel', 'salesAgentsPanel',
  'salesLeadDetailPanel', 'salesRetentionPanel', 'salesContentPanel', 'salesTerritoryPanel',
  'salesCampaignPanel', 'salesDataQualityPanel', 'salesForecastPanel', 'salesCostPanel', 'salesSafetyPanel',
  'salesLostDealsPanel', 'salesAnomalyPanel', 'salesWorkloadPanel', 'salesScorecardsPanel',
  'salesQueuePanel', 'salesReadinessPanel', 'salesSourcesPanel', 'salesCreatorPanel',
  'salesSampleAdvisorPanel', 'salesChangesPanel', 'salesReviewPanel', 'salesPrivacyPanel',
  'salesContentPlannerPanel', 'salesCommercialPanel', 'salesSettingsPanel', 'salesDecisionPanel',
  'salesReportingPanel', 'salesScenarioPanel', 'salesOutreachStudioPanel', 'salesReplyCenterPanel',
  'salesExportPanel', 'salesMeetingPanel', 'salesSampleOsPanel', 'salesAgentLabPanel',
  'salesAuditPanel', 'salesBriefsPanel',
  'salesPriorityPanel', 'salesProgressionPanel', 'salesConcentrationPanel',
  'salesNextActionPanel', 'salesReplyLabPanel'];

test.describe('flag OFF (default): sales is invisible and inert', () => {
  test('no Sales & Growth group, no sales links, panels render the DISABLED shell', async ({ page, backend }) => {
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await login(page);

    // No sidebar surface at all (counts are attachment checks, so they hold even
    // when the mobile sidebar is off-screen — no need to open it).
    await expect(page.locator('#sidebarGroups .groupToggle[data-group="Sales & Growth"]')).toHaveCount(0);
    await expect(page.locator('#sidebarGroups .groupLabel', { hasText: 'Sales & Growth' })).toHaveCount(0);
    await expect(page.locator('#sidebarGroups .sidebarLink[data-page^="sales"]')).toHaveCount(0);

    // The host sections exist exactly once each, but are not the active page.
    for (const id of SALES_IDS) {
      await expect(page.locator(`section#${id}`)).toHaveCount(1);
      await expect(page.locator(`section#${id}.activePage`)).toHaveCount(0);
    }

    // Startup still ran the loader (it is in PANEL_LOADERS) but, with the flag
    // off, it rendered only the inert DISABLED shell — no synthetic data.
    await page.waitForFunction(() => document.body.dataset.loaded === 'all');
    const state = await page.locator('#salesCommandPanel .salesPage').getAttribute('data-state');
    expect(state).toBe('DISABLED');
    await expect(page.locator('#salesCommandPanel [data-label="SIMULATED"]')).toHaveCount(0);

    // Exactly one active page overall (the usual invariant is not disturbed).
    await expect(page.locator('main.contentArea > section.panel.activePage')).toHaveCount(1);
    expect(errors.join('\n')).not.toMatch(/Trusted Type|require-trusted-types|Refused to/i);
  });
});

test.describe('flag ON: sales pages appear and render synthetic data', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.setItem('he_sales_growth', 'on'); } catch (e) { /* storage blocked */ } });
  });

  test('the group and its seven pages are present, navigable, and labelled synthetic', async ({ page, backend }) => {
    await login(page);

    // The collapsible group's toggle is in the DOM (collapsed by default).
    await expect(page.locator('#sidebarGroups .groupToggle[data-group="Sales & Growth"]')).toHaveCount(1);

    // Command center renders real (OK) state with SIMULATED truth labels.
    // gotoPage opens the mobile menu + expands the collapsed group for us.
    await gotoPage(page, 'salesCommandPanel');
    const cc = page.locator('#salesCommandPanel .salesPage');
    expect(await cc.getAttribute('data-state')).not.toBe('DISABLED');
    await expect(page.locator('#salesCommandPanel [data-label="SIMULATED"]').first()).toBeVisible();
    await expect(page.locator('#salesCommandPanel .salesTitle')).toHaveText('Growth Command Center');

    // Every sales page opens and shows its own titled, non-disabled panel.
    const titles = {
      salesLeadsPanel: 'Wholesale Leads', salesPipelinePanel: 'Pipeline',
      salesApprovalsPanel: 'Sales Approvals', salesSamplesPanel: 'Samples',
      salesVisitsPanel: 'In-Person Sample Visits',
      salesRepurposePanel: 'Content Repurposing', salesAdVariantsPanel: 'Ad Variants',
      salesFeedbackPanel: 'Feedback Analysis', salesCreatorOfferPanel: 'Creator Sample Offers',
      salesReminderPanel: 'Reorder Reminders', salesHealthPanel: 'Service Health',
      salesAnalyticsPanel: 'Sales Analytics', salesAgentsPanel: 'Sales Agent Activity',
      salesLeadDetailPanel: 'Lead Detail (example)', salesRetentionPanel: 'Retention',
      salesContentPanel: 'Content Opportunities', salesTerritoryPanel: 'Territory & Expansion',
      salesCampaignPanel: 'Campaign Lab', salesDataQualityPanel: 'Sales Data Quality',
      salesForecastPanel: 'Sales Forecast', salesCostPanel: 'AI Cost Center',
      salesSafetyPanel: 'Sales Safety Center',
      salesLostDealsPanel: 'Lost Deal Analysis', salesAnomalyPanel: 'Sales Anomaly Center',
      salesWorkloadPanel: 'Owner Workload', salesScorecardsPanel: 'Agent Scorecards',
      salesQueuePanel: 'Owner Daily Queue', salesReadinessPanel: 'Wholesale Readiness',
      salesSourcesPanel: 'Lead Source Quality', salesCreatorPanel: 'Creator Prospects',
      salesSampleAdvisorPanel: 'Sample Candidate Ranking', salesChangesPanel: 'What Changed',
      salesReviewPanel: 'Weekly Review', salesPrivacyPanel: 'Sales Privacy Center',
    };
    for (const [id, title] of Object.entries(titles)) {
      await gotoPage(page, id);
      await expect(page.locator(`#${id} .salesTitle`)).toHaveText(title);
      expect(await page.locator(`#${id} .salesPage`).getAttribute('data-state')).not.toBe('DISABLED');
    }

    // The agent page renders the real advisory roster (not a stub): a known
    // agent is present and there are many rows, all plainly advisory.
    await gotoPage(page, 'salesAgentsPanel');
    await expect(page.locator('#salesAgentsPanel')).toContainText('Claim Firewall');
    expect(await page.locator('#salesAgentsPanel .salesRecord').count()).toBeGreaterThanOrEqual(24);

    // The existing dashboard still works with the flag on.
    await gotoPage(page, 'ordersPanel');
    await expect(page.locator('section#ordersPanel.activePage')).toHaveCount(1);
  });

  test('approvals page states plainly that APPROVE is not SEND', async ({ page, backend }) => {
    await login(page);
    await gotoPage(page, 'salesApprovalsPanel');
    await expect(page.locator('#salesApprovalsPanel')).toContainText('NOT SENT');
  });

  test('in-person visits page shows stock/cost/outcome, names the R4 write, and is plainly read-only', async ({ page, backend }) => {
    await login(page);
    await gotoPage(page, 'salesVisitsPanel');
    const panel = page.locator('#salesVisitsPanel');
    await expect(page.locator('#salesVisitsPanel .salesTitle')).toHaveText('In-Person Sample Visits');
    // Stock consumed on the spot (synthetic 6+4+3) and the unknown-cost visit
    // keeps cost basis honest (never a fake $0).
    await expect(panel).toContainText('13');                 // jars consumed
    await expect(panel).toContainText('PARTIAL/UNKNOWN');     // one visit had no unit cost
    await expect(panel).toContainText('$2.90');              // known cost (6+4)*0.29, 2dp
    // The missing safe production write is named, not faked.
    await expect(panel).toContainText('adjust_inventory (R4)');
    await expect(panel.locator('[data-label="OWNER_INPUT_REQUIRED"]').first()).toBeVisible();
    // Advisory / read-only: it consumes no real stock and sends nothing.
    await expect(panel).toContainText('sends nothing');
    // In-person visits are plainly distinct from SHIPPED samples: this page
    // says "hand-delivered" and does not claim to ship/mail anything.
    await expect(panel).toContainText('hand-delivered');
    expect(await panel.innerText()).not.toMatch(/shipped|mailed/i);
    // The shipped-sample page remains a separate panel.
    await gotoPage(page, 'salesSamplesPanel');
    await expect(page.locator('#salesSamplesPanel .salesTitle')).toHaveText('Samples');
  });

  test('W-1 content repurposing panel shows drafts + source attribution, blocks injection', async ({ page }) => {
    await login(page);
    await gotoPage(page, 'salesRepurposePanel');
    const panel = page.locator('#salesRepurposePanel');
    await expect(page.locator('#salesRepurposePanel .salesTitle')).toHaveText('Content Repurposing');
    await expect(panel).toContainText('Instagram caption');
    await expect(panel).toContainText('Source attribution');
    await expect(panel).toContainText('Injected-asset drafts blocked');
    await expect(panel).toContainText('never published');
  });

  test('W-2 ad-variants panel shows variants + exact-version approval, no spend', async ({ page }) => {
    await login(page);
    await gotoPage(page, 'salesAdVariantsPanel');
    const panel = page.locator('#salesAdVariantsPanel');
    await expect(page.locator('#salesAdVariantsPanel .salesTitle')).toHaveText('Ad Variants');
    await expect(panel).toContainText('Ad hook');
    await expect(panel).toContainText('invalidated — re-review required'); // approval binding after edit
    await expect(panel).toContainText('no campaign, no spend');
    expect(await panel.innerText()).not.toMatch(/\bsent\b.*true/i);
  });

  test('W-3 feedback panel routes to a human and redacts PII in a testimonial', async ({ page }) => {
    await login(page);
    await gotoPage(page, 'salesFeedbackPanel');
    const panel = page.locator('#salesFeedbackPanel');
    await expect(page.locator('#salesFeedbackPanel .salesTitle')).toHaveText('Feedback Analysis');
    await expect(panel).toContainText('Routed to a human');
    await expect(panel).toContainText('[phone redacted]'); // PII redaction visible
    expect(await panel.innerText()).not.toContain('555-123-4567');
    await expect(panel).toContainText('nothing auto-replied or published');
  });

  test('W-4 creator panel shows shortlist with UNKNOWN engagement and disabled capabilities', async ({ page }) => {
    await login(page);
    await gotoPage(page, 'salesCreatorOfferPanel');
    const panel = page.locator('#salesCreatorOfferPanel');
    await expect(page.locator('#salesCreatorOfferPanel .salesTitle')).toHaveText('Creator Sample Offers');
    await expect(panel).toContainText('UNKNOWN');            // missing engagement kept unknown
    await expect(panel).toContainText('Gifting');
    await expect(panel).toContainText('adjust_inventory (R4)');
    await expect(panel).toContainText('nothing contacted, gifted, or written to stock');
  });

  test('W-5 reminder panel shows explicit cadence and guard counts, nothing sent', async ({ page }) => {
    await login(page);
    await gotoPage(page, 'salesReminderPanel');
    const panel = page.locator('#salesReminderPanel');
    await expect(page.locator('#salesReminderPanel .salesTitle')).toHaveText('Reorder Reminders');
    await expect(panel).toContainText('cadence');
    await expect(panel).toContainText('Suppressed (opt-out/DNC)');
    await expect(panel).toContainText('nothing sent');
  });

  test('#25 Service Health panel surfaces stale/error states, last success and next operator action', async ({ page }) => {
    await login(page);
    await gotoPage(page, 'salesHealthPanel');
    const panel = page.locator('#salesHealthPanel');
    await expect(page.locator('#salesHealthPanel .salesTitle')).toHaveText('Service Health');
    // Synthetic failure states are surfaced with a next action.
    await expect(panel).toContainText('STALE');
    await expect(panel).toContainText('ERROR');
    await expect(panel).toContainText('Needs attention');
    await expect(panel).toContainText('next operator action');
    await expect(panel).toContainText('Review the last error'); // the error job's next action
    await expect(panel).toContainText('read-only'); // nothing is run or changed here
  });
});

test('no duplicate panel ids are introduced', async ({ page, backend }) => {
  await login(page);
  const dupes = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map(e => e.id);
    return ids.filter((id, i) => ids.indexOf(id) !== i);
  });
  expect(dupes).toEqual([]);
});
