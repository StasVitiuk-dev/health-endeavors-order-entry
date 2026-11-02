// Recomputes every ?v=<first 10 hex of sha256> in the pages from the files on
// disk (assets/** referenced by src= or href=). Run after changing any asset.
//   node tests/tools/refresh-asset-versions.js [dir]   (default: repository root)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PAGES = ['owner-login.html', 'change-password.html', 'search.html', 'dashboard.html', 'index.html', 'manual-order-entry.html'];
function refresh(dir) {
  const changed = [];
  for (const page of PAGES) {
    const p = path.join(dir, page);
    if (!fs.existsSync(p)) continue;
    const html = fs.readFileSync(p, 'utf8');
    const next = html.replace(/((?:href|src)=")(assets\/[^"?]+)\?v=[0-9a-f]+"/g, (all, pre, file) =>
      pre + file + '?v=' + crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, file))).digest('hex').slice(0, 10) + '"');
    if (next !== html) { fs.writeFileSync(p, next); changed.push(page); }
  }
  return changed;
}
if (require.main === module) console.log('refreshed:', refresh(path.resolve(process.argv[2] || path.join(__dirname, '..', '..'))).join(', ') || 'nothing to change');
module.exports = { refresh };
