// The code of a page = its HTML plus the scripts moved out of it into assets/
// (EXT10: change-password, search, dashboard; EXT14 M5d: the owner dashboard).
// Source-reading tests use this so a script moved to a file is still checked.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
// EXT15: the owner page's module files (assets/app/*.js), in the order the page loads them.
const OWNER_MODULES = (() => {
  const html = fs.readFileSync(path.join(ROOT, 'owner-login.html'), 'utf8');
  return [...html.matchAll(/<script src="(assets\/app\/[a-z0-9-]+\.js)\?v=/g)].map(m => m[1]);
})();
const PAGE_SCRIPTS = {
  'owner-login.html': ['assets/owner-login-theme.js', 'assets/owner-login-helpers.js', 'assets/owner-login-modules.js', ...OWNER_MODULES, 'assets/owner-login-app.js'],
  'change-password.html': ['assets/change-password.js'],
  'search.html': ['assets/search-page.js'],
  'dashboard.html': ['assets/dashboard-page.js'],
  'index.html': ['assets/manual-order-entry.js'],            // EXT16: inline script moved out
  'manual-order-entry.html': ['assets/manual-order-entry.js'],
};
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
function pageSource(file) { return [file, ...(PAGE_SCRIPTS[file] || [])].map(read).join('\n'); }
module.exports = { PAGE_SCRIPTS, OWNER_MODULES, pageSource, ROOT };
