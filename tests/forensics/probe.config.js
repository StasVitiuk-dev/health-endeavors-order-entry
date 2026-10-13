// Config for tests/forensics/*.probe.spec.js (EXT16 forensic probes; not part of npm test).
const base = require('../playwright.config.js');
module.exports = { ...base, testDir: '.', testMatch: /\.probe\.spec\.js$/, outputDir: '../../test-results/forensics', projects: base.projects.map(p => ({ ...p, testIgnore: undefined })) };
