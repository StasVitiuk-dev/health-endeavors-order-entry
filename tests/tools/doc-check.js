// Documentation integrity check (EXT13). For the given Markdown files, finds
// every file the text names (in `backticks` or [links](...)) and every
// `npm run <script>`, and reports the ones that do not exist. Owner
// instructions must never point at a missing file or a command that fails.
//
//   node tests/tools/doc-check.js docs/ops/START_HERE_EXT13.md [...more.md]
//   node tests/tools/doc-check.js --current      (the current owner docs)
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
// Folders a short file name may live in (docs refer to each other by bare name).
const SEARCH = ['', 'docs', 'docs/ops', 'docs/ops/sql', 'docs/ops/sql/drafts', 'docs/ops/sql/local-test', 'docs/ops/sql/local-test/draft-tests', 'docs/ops/evidence',
  'docs/security', 'docs/code-quality', 'tests', 'tests/specs', 'tests/tools', 'tests/helpers', 'tests/fixtures', 'tests/mutation', 'assets'];
const FILE_RE = /\.(md|sql|js|json|jsonl|sh|html|css|py|csv|png)$/i;

// The documents an owner or a future session is told to start from.
const CURRENT = [
  'CLAUDE.md',
  'docs/ops/SECURITY_ARCHITECTURE_EXT18.md', 'docs/ops/AUTH_SESSION_SECURITY_EXT18.md', 'docs/ops/AUTHORIZATION_CONTRACT_EXT18.md',
  'docs/ops/DOM_CSP_SECURITY_EXT18.md', 'docs/ops/DATABASE_SECURITY_EXT18.md', 'docs/ops/SECURITY_TESTING_EXT18.md',
  'docs/ops/SUPPLY_CHAIN_SECURITY_EXT18.md', 'docs/ops/SECURITY_INCIDENT_RUNBOOK_EXT18.md', 'docs/ops/CURRENT_PLATFORM_STATE_EXT18.md',
  'docs/ops/RELEASE_REVIEW_EXT18.md',
  'docs/ops/CURRENT_PLATFORM_STATE_EXT19.md', 'docs/ops/TYPE_SAFETY_EXT19.md', 'docs/ops/DOM_TRUSTED_TYPES_EXT19.md', 'docs/ops/STATE_MACHINES_EXT19.md',
  'docs/ops/SCHEMA_CONTRACT_EXT19.md', 'docs/ops/DATABASE_CONCURRENCY_EXT19.md', 'docs/ops/PREPRODUCTION_GAPS_EXT19.md', 'docs/ops/RELEASE_REVIEW_EXT19.md',
  'docs/ops/CURRENT_PLATFORM_STATE_EXT20.md', 'docs/ops/SECURITY_HARDENING_EXT20.md', 'docs/ops/TRUSTED_TYPES_EXT20.md', 'docs/ops/INTERMITTENT_FORENSICS_EXT20.md',
  'docs/ops/DATABASE_CONCURRENCY_EXT20.md', 'docs/ops/RLS_AUDIT_READINESS_EXT20.md', 'docs/ops/OPERATOR_STATE_SAFETY_EXT20.md', 'docs/ops/RELEASE_REVIEW_EXT20.md',
  'docs/ops/OWNER_ACTIONS_EXT20.md', 'docs/ops/FINAL_AUTONOMOUS_GAP_MAP_EXT20.md',
  'docs/ops/START_HERE_EXT14.md', 'docs/ops/CURRENT_PLATFORM_STATE_EXT14.md', 'docs/ops/ENGINEERING_REPORT_EXT14.md',
  'docs/ops/RELEASE_REVIEW_EXT14.md', 'docs/ops/CI_GUIDE_EXT14.md', 'docs/ops/SCREENSHOT_POLICY_EXT14.md',
  'docs/ops/START_HERE_EXT13.md', 'docs/ops/CURRENT_PLATFORM_STATE_EXT13.md', 'docs/ops/OWNER_ATTENTION_SESSION_EXT13.md',
  'docs/ops/SOURCE_OF_TRUTH_MAP_EXT13.md', 'docs/ops/PLATFORM_MATRICES_EXT13.md', 'docs/ops/DATA_MODEL_DICTIONARY_EXT13.md',
  'docs/ops/POST_LAUNCH_BACKLOG_EXT13.md', 'docs/ops/OWNER_SESSION_PROMPTS_EXT13.md', 'docs/ops/OPERATIONS_HANDBOOK_EXT13.md',
  'docs/ops/RELEASE_REVIEW_EXT13.md', 'docs/ops/UNFINISHED_WORK_EXT13.md',
  'docs/ops/OWNER_EVIDENCE_GUIDE_EXT12.md', 'docs/ops/DEPLOYMENT_SIMULATION_EXT12.md', 'docs/ops/INCIDENT_SIMULATION_EXT12.md',
  'docs/ops/OPERATOR_TRAINING_EXT12.md', 'docs/ops/OWNER_DECISION_STATUS_EXT12.md', 'docs/ops/OWNER_CHECKS_EXT11.md',
  'docs/ops/PRODUCTION_READINESS_BOARD_EXT11.md', 'docs/ops/PRODUCTION_CHANGE_PACKAGE_EXT10.md', 'docs/ops/R1-R5-INSTALL-RUNBOOK.md',
  'docs/ops/evidence/README.md', 'docs/health-endeavors-current-state.md',
].filter(f => fs.existsSync(path.join(ROOT, f)));

// Named on purpose although not in the repository (each with its reason).
const ABSENT_BY_DESIGN = {
  'docs/ops/evidence/ledger.jsonl': 'created by the first evidence intake',
  'ledger.jsonl': 'created by the first evidence intake',
  'C.csv': 'example name of the owner\'s download', 'D.csv': 'example name of the owner\'s download', 'H.csv': 'example name of the owner\'s download',
  'V5_2026-10-15.csv': 'example file name', '.md': 'file-name pattern example',
  'docs/website/README.md': 'public website workspace, kept outside this repository (CLAUDE.md)',
  'docs/website/decisions-needed.md': 'public website workspace, kept outside this repository (CLAUDE.md)',
};
function exists(ref, fromDir) {
  if (ABSENT_BY_DESIGN[ref]) return true;
  const r = ref.replace(/^\.\//, '').replace(/[#?].*$/, '').replace(/[),.;:]+$/, '');
  if (!r) return true;
  if (/^https?:/i.test(r)) return true;
  const tries = [path.join(fromDir, r), ...SEARCH.map(d => path.join(ROOT, d, r))];
  if (tries.some(p => fs.existsSync(p))) return true;
  // `drafts/10` style short references: a draft whose name starts with that number.
  const m = /^(?:docs\/ops\/sql\/)?drafts\/(\d{2})$/.exec(r);
  if (m) return fs.readdirSync(path.join(ROOT, 'docs/ops/sql/drafts')).some(f => f.startsWith(m[1] + '_'));
  // a glob-like mention (`stale-*.spec.js`) is not checkable: report it
  return false;
}

function check(file) {
  const abs = path.join(ROOT, file);
  const text = fs.readFileSync(abs, 'utf8');
  const dir = path.dirname(abs);
  const scripts = Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts || {});
  const problems = [];
  const refs = new Set();
  for (const m of text.matchAll(/`([^`\n]+)`/g)) {
    const t = m[1].trim();
    // a code span with spaces is a command or phrase; take path-like words from it
    for (const w of t.split(/\s+/)) if (FILE_RE.test(w.replace(/[),.;:]+$/, '')) && !/[<>*{}|$]/.test(w) && !/^[a-z]+:\/\//i.test(w)) refs.add(w);
    for (const w of t.split(/\s+/)) if (/^(docs\/ops\/sql\/)?drafts\/\d{2}$/.test(w)) refs.add(w);
  }
  for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) if (!/^(https?:|mailto:|#)/i.test(m[1])) refs.add(m[1]);
  for (const r of refs) if (!exists(r, dir)) problems.push({ file, kind: 'missing file', ref: r });
  for (const m of text.matchAll(/npm run (?:-s )?([a-z][\w:-]*)/g)) if (!scripts.includes(m[1])) problems.push({ file, kind: 'unknown npm script', ref: m[1] });
  for (const m of text.matchAll(/node (tests\/[\w/.-]+\.js)/g)) if (!fs.existsSync(path.join(ROOT, m[1]))) problems.push({ file, kind: 'missing tool', ref: m[1] });
  return problems;
}
module.exports = { check, CURRENT, exists, ABSENT_BY_DESIGN };

if (require.main === module) {
  const args = process.argv.slice(2);
  const files = args.includes('--current') || !args.length ? CURRENT : args;
  const all = files.flatMap(check);
  for (const p of all) console.log(p.kind.padEnd(20) + p.file + '  →  ' + p.ref);
  console.log(all.length ? all.length + ' problem(s) in ' + files.length + ' file(s).' : 'OK: ' + files.length + ' file(s), every named file and command exists.');
  process.exitCode = all.length ? 1 : 0;
}
