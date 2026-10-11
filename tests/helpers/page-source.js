// The code of a page = its HTML plus the scripts moved out of it into assets/
// (EXT10: change-password, search, dashboard; EXT14 M5d: the owner dashboard).
// Source-reading tests use this so a script moved to a file is still checked.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const PAGE_SCRIPTS = {
  'owner-login.html': ['assets/owner-login-theme.js', 'assets/owner-login-helpers.js', 'assets/owner-login-app.js'],
  'change-password.html': ['assets/change-password.js'],
  'search.html': ['assets/search-page.js'],
  'dashboard.html': ['assets/dashboard-page.js'],
};
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
function pageSource(file) { return [file, ...(PAGE_SCRIPTS[file] || [])].map(read).join('\n'); }
module.exports = { PAGE_SCRIPTS, pageSource, ROOT };
