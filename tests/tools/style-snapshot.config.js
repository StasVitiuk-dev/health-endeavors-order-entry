// Config for tests/tools/style-snapshot.spec.js (EXT15 migration proof).
const base = require('../playwright.config.js');
module.exports = { ...base, testDir: '.', testMatch: /style-snapshot\.spec\.js$/, outputDir: '../../test-results/style-snapshot', projects: base.projects.map(p => ({ ...p, testIgnore: undefined })), workers: 2 };
