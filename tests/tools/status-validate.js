// EXT14 status manifest validator.
//   node tests/tools/status-validate.js [manifest.json]   → prints OK or every problem, exit 1 on problems
// Rules (each is about honesty, not style):
//   * every production step and switch the deployment simulator knows is listed, and nothing else
//   * every SQL change draft belongs to exactly one step; rollbacks match docs/ops/sql/MANIFEST.json
//   * values come from fixed vocabularies
//   * deployed ⇒ merged; a production state other than UNKNOWN / NOT DEPLOYED needs dated
//     production evidence; INSTALLED needs the code merged and deployed first
//   * a switch can only be ON if its step is INSTALLED or VERIFIED
//   * production readiness may not move while no production evidence exists
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const sim = require('./deploy-sim');
const PROD = ['UNKNOWN', 'NOT INSTALLED', 'NOT DEPLOYED', 'DEPLOYED', 'INSTALLED', 'VERIFIED', 'ROLLED BACK', 'REPORTED'];
const SWITCH = ['UNKNOWN', 'ABSENT', 'OFF', 'ON'];
const LOCAL = ['TESTED LOCALLY', 'NOT WRITTEN', 'NOT TESTED'];
const BASELINE_READINESS = 15;

function validate(m, sqlManifest) {
  const p = [];
  const evidenceOk = e => e && /^\d{4}-\d{2}-\d{2}$/.test(e.date || '') && e.env === 'production' && e.source;
  const installs = Object.keys(sim.INSTALLS), switches = Object.keys(sim.SWITCHES);
  const units = m.units || {}, sw = m.switches || {};
  for (const k of installs) if (!units[k]) p.push(`step ${k} (deployment simulator) is missing`);
  for (const k of Object.keys(units)) if (!installs.includes(k) && !units[k].optional) p.push(`step ${k} is not a known production step (mark it optional or add it to the simulator)`);
  for (const k of switches) if (!sw[k]) p.push(`switch ${k} is missing`);
  for (const k of Object.keys(sw)) if (!switches.includes(k)) p.push(`switch ${k} is unknown`);
  // SQL ownership
  const owner = {};
  for (const [k, u] of Object.entries(units)) for (const f of (u.sql || []).concat(u.rollback || [])) { if (owner[f]) p.push(`${f} is claimed by ${owner[f]} and ${k}`); owner[f] = k; }
  const byId = {};
  for (const c of sqlManifest.changes) byId[c.id] = c;
  for (const c of sqlManifest.changes) {
    const ref = 'drafts/' + c.id;
    if (!owner[ref]) p.push(`${ref} (${c.class}) belongs to no step`);
  }
  for (const [k, u] of Object.entries(units)) {
    for (const r of u.rollback || []) { const c = byId[r.split('/')[1]]; if (!c || c.class !== 'ROLLBACK') p.push(`${k}: ${r} is not a rollback draft`); else if (!(u.sql || []).includes('drafts/' + c.rollbackOf)) p.push(`${k}: ${r} rolls back drafts/${c.rollbackOf}, which is not part of this step`); }
    for (const s of u.sql || []) { const c = byId[s.split('/')[1]]; if (!c || c.class === 'ROLLBACK') p.push(`${k}: ${s} is not an install draft`); }
    if (!PROD.includes(u.production)) p.push(`${k}: production "${u.production}" is not an allowed value`);
    if (u.local && !LOCAL.includes(u.local)) p.push(`${k}: local "${u.local}" is not an allowed value`);
    if (u.deployed && !u.merged) p.push(`${k}: deployed but not merged`);
    if (!['UNKNOWN', 'NOT DEPLOYED', 'NOT INSTALLED'].includes(u.production) && !evidenceOk(u.productionEvidence)) p.push(`${k}: production "${u.production}" without dated production evidence (local or staging results never count)`);
    if (['INSTALLED', 'VERIFIED'].includes(u.production) && u.kind === 'sql' && !(units.merge && units.merge.deployed)) p.push(`${k}: installed before the code was merged and deployed (the plan merges first)`);
    if (['INSTALLED', 'VERIFIED'].includes(u.production) && u.local !== 'TESTED LOCALLY') p.push(`${k}: installed in production without a local test`);
  }
  for (const [k, s] of Object.entries(sw)) {
    if (!SWITCH.includes(s.production)) p.push(`switch ${k}: "${s.production}" is not an allowed value`);
    if (s.production !== 'UNKNOWN' && s.production !== 'ABSENT' && !evidenceOk(s.productionEvidence)) p.push(`switch ${k}: "${s.production}" without dated production evidence`);
    const inst = units[s.install];
    if (s.production === 'ON' && !(inst && ['INSTALLED', 'VERIFIED'].includes(inst.production))) p.push(`switch ${k} is ON but its step ${s.install} is not installed`);
  }
  const anyEvidence = Object.values(units).concat(Object.values(sw), Object.values(m.facts || {})).some(x => evidenceOk(x.productionEvidence));
  if (!anyEvidence && m.scores && m.scores.productionReadinessPercent !== BASELINE_READINESS) p.push(`production readiness changed to ${m.scores.productionReadinessPercent}% with no production evidence (local work never raises it)`);
  return p;
}

if (require.main === module) {
  const file = path.resolve(process.argv[2] || path.join(ROOT, 'docs', 'ops', 'STATUS_MANIFEST_EXT14.json'));
  const problems = validate(JSON.parse(fs.readFileSync(file, 'utf8')), JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'ops', 'sql', 'MANIFEST.json'), 'utf8')));
  if (problems.length) { for (const x of problems) console.log('PROBLEM: ' + x); process.exitCode = 1; } else console.log('OK: status manifest is consistent (' + path.relative(ROOT, file) + ')');
}
module.exports = { validate, PROD, SWITCH, BASELINE_READINESS };
