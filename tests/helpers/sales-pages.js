// Reserve IV — shared helper for the Sales & Growth subsystem tests.
//
// One source of truth for the 42 flag-gated sales pages (id -> owner-facing
// title), plus small utilities every sales spec reuses: turning the default-OFF
// feature flag ON before the page loads, and opening the collapsed group. This
// keeps the deep per-page matrices (a11y, mobile, scalability, …) parameterized
// over ONE list instead of 42 copy-pasted specs, so a new page is covered the
// moment it is added here.
//
// The list is asserted against the live SALES_TITLES map by
// sales-pages-sync-ext20k.spec.js, so it can never silently drift from the app.

const SALES_PAGES = {
  salesCommandPanel: 'Growth Command Center',
  salesLeadsPanel: 'Wholesale Leads',
  salesPipelinePanel: 'Pipeline',
  salesApprovalsPanel: 'Sales Approvals',
  salesSamplesPanel: 'Samples',
  salesAnalyticsPanel: 'Sales Analytics',
  salesAgentsPanel: 'Sales Agent Activity',
  salesLeadDetailPanel: 'Lead Detail (example)',
  salesRetentionPanel: 'Retention',
  salesContentPanel: 'Content Opportunities',
  salesTerritoryPanel: 'Territory & Expansion',
  salesCampaignPanel: 'Campaign Lab',
  salesDataQualityPanel: 'Sales Data Quality',
  salesForecastPanel: 'Sales Forecast',
  salesCostPanel: 'AI Cost Center',
  salesSafetyPanel: 'Sales Safety Center',
  salesLostDealsPanel: 'Lost Deal Analysis',
  salesAnomalyPanel: 'Sales Anomaly Center',
  salesWorkloadPanel: 'Owner Workload',
  salesScorecardsPanel: 'Agent Scorecards',
  salesQueuePanel: 'Owner Daily Queue',
  salesReadinessPanel: 'Wholesale Readiness',
  salesSourcesPanel: 'Lead Source Quality',
  salesCreatorPanel: 'Creator Prospects',
  salesSampleAdvisorPanel: 'Sample Candidate Ranking',
  salesChangesPanel: 'What Changed',
  salesReviewPanel: 'Weekly Review',
  salesPrivacyPanel: 'Sales Privacy Center',
  salesContentPlannerPanel: 'Content Planner',
  salesCommercialPanel: 'Commercial & Line Sheet',
  salesSettingsPanel: 'Sales Settings & Controls',
  salesDecisionPanel: 'Owner Decision Center',
  salesReportingPanel: 'Reporting Center',
  salesScenarioPanel: 'Scenario & What-If Lab',
  salesOutreachStudioPanel: 'Outreach Studio',
  salesReplyCenterPanel: 'Reply & Follow-up Center',
  salesExportPanel: 'Export Center',
  salesMeetingPanel: 'Meeting & Deal Prep',
  salesSampleOsPanel: 'Sample Operating System',
  salesAgentLabPanel: 'Agent Lab',
  salesAuditPanel: 'Audit & Explainability',
  salesBriefsPanel: 'Owner Briefs',
};

const SALES_IDS = Object.keys(SALES_PAGES);

// Turn the feature flag ON before any page script runs. Must be called before
// login()/page.goto(). Wrapped in try/catch because storage can be blocked
// (private window), in which case the flag stays OFF and the page is inert —
// which is the safe default and still a valid thing to assert.
async function enableSalesFlag(page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('he_sales_growth', 'on'); } catch (e) { /* storage blocked */ }
  });
}

module.exports = { SALES_PAGES, SALES_IDS, enableSalesFlag };
