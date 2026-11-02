// CI change impact (EXT14). Decides which heavy CI jobs a change needs.
// Conservative on purpose: it can only SKIP a job when every changed file is
// clearly unable to affect it; anything unknown runs everything.
//
//   node tests/tools/ci-impact.js <base-sha>        prints browser=true|false and db=true|false
// Rules:
//   browser suite skipped only when every changed file is documentation
//     (*.md outside docs/ops/sql, design-review/**, docs/**/*.png);
//   database suite runs when SQL, the DB runners, the workflow or dependencies change.
const { execFileSync } = require('child_process');

const DOC_ONLY = [/\.md$/i, /^design-review\//, /^docs\/.*\.(png|jpe?g|svg)$/i];
const DB_PATHS = [/^docs\/ops\/sql\//, /^tests\/tools\/run-db-suite\.sh$/, /^tests\/mutation\/run-sql-mutations\.sh$/, /^\.github\/workflows\//, /^package(-lock)?\.json$/];

function decide(files) {
  if (!Array.isArray(files) || !files.length) return { browser: true, db: true, reason: 'no file list: run everything' };
  const docOnly = files.every(f => DOC_ONLY.some(r => r.test(f)) && !/^docs\/ops\/sql\//.test(f));
  const db = files.some(f => DB_PATHS.some(r => r.test(f)));
  return { browser: !docOnly, db, reason: docOnly ? 'documentation only' : 'code or tests changed' };
}
function changedFiles(base) {
  if (!base || /^0+$/.test(base)) return null;
  try { return execFileSync('git', ['diff', '--name-only', base + '...HEAD'], { encoding: 'utf8' }).split('\n').filter(Boolean); }
  catch (e) { return null; }
}
module.exports = { decide, DOC_ONLY, DB_PATHS };

if (require.main === module) {
  const d = decide(changedFiles(process.argv[2]));
  console.log('browser=' + d.browser);
  console.log('db=' + d.db);
  console.error('ci-impact: ' + d.reason);
}
