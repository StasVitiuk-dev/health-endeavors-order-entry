// Deployment simulator (EXT12). A pure state machine of the production
// rollout in PRODUCTION_CHANGE_PACKAGE_EXT10.md / PRODUCTION_READINESS_BOARD_EXT11.md.
// It connects to NOTHING: it only answers "is this next step allowed, and
// why not?" so the owner's order can be rehearsed and wrong orders caught.
// A run in any environment other than production is SIMULATED and can never
// produce a production status.
//
//   const sim = require('./deploy-sim');
//   let s = sim.start({ env: 'local' });
//   s = sim.apply(s, { do: 'evidence', type: 'BACKUP', status: 'PASS', date: '2026-10-20' }).state; // in production, also env: 'production'
//   const r = sim.apply(s, { do: 'install', unit: 'r15', date: '2026-10-20', sitting: 1 }); // r.ok, r.message
const INSTALLS = {
  merge:           { label: 'Merge the code (P0)', needs: [], db: false },
  r15:             { label: 'Install R1–R5 functions (P2, drafts/10)', needs: ['merge'], db: true, evidence: ['QUERY_C'], fingerprint: 'f6d9c2c8be690710eeb721041f6779d9', rollback: 'drafts/11' },
  switch_rows:     { label: 'Add the five stock switch rows, all OFF (P3, drafts/21)', needs: ['r15'], db: true, rollback: 'drafts/22' },
  line_guard:      { label: 'PO line guard (P5, drafts/17)', needs: ['merge'], db: true, rollback: 'drafts/18' },
  integrity_rules: { label: 'Integrity rules (P6, drafts/23)', needs: ['merge'], db: true, evidence: ['QUERY_E', 'QUERY_F'], rollback: 'drafts/24' },
  request_keys:    { label: 'Request-key columns + switch row (P7, drafts/19 then 27)', needs: ['merge'], db: true, rollback: 'drafts/28 then drafts/20' },
  permissions:     { label: 'Permission fixes from Query G (P8)', needs: ['merge'], db: true, evidence: ['QUERY_G'], rollback: 'each draft\'s exact old policy' },
  nightly:         { label: 'Nightly check (P9, drafts/25) + Home card tables (P9b, drafts/29)', needs: ['merge'], db: true, decision: 'thresholds', rollback: 'drafts/30 then drafts/26' },
};
// Stock switches in the suggested order (D-ops-1): R1 → R4 → R2 → R3 → R5.
const SWITCHES = {
  stock_fn_receive_po:     { label: 'R1 receive', install: 'switch_rows', order: 1, stock: true },
  stock_fn_adjust:         { label: 'R4 adjust', install: 'switch_rows', order: 2, stock: true },
  stock_fn_recall:         { label: 'R2 recall', install: 'switch_rows', order: 3, stock: true },
  stock_fn_return:         { label: 'R3 return', install: 'switch_rows', order: 4, stock: true, note: 'whole line unless the partial-returns decision says otherwise' },
  stock_fn_delete_product: { label: 'R5 delete', install: 'switch_rows', order: 5, stock: true },
  request_keys:            { label: 'request keys', install: 'request_keys', order: 0 },
  integrity_results_home:  { label: 'nightly check on Home', install: 'nightly', order: 0 },
};
const ENVIRONMENTS = ['production', 'staging', 'local'];
const DAY = 86400000;
// The request-key install step and its switch share a name; keep them apart in state.
const swKey = name => (name === 'request_keys' ? 'request_keys_switch' : name);

function start({ env } = {}) {
  const e = String(env || '').toLowerCase();
  if (!ENVIRONMENTS.includes(e)) throw new Error('Environment must be stated (production, staging or local). Nothing assumed.');
  const units = {};
  for (const k of Object.keys(INSTALLS)) units[k] = { status: 'NOT STARTED' };
  for (const k of Object.keys(SWITCHES)) units[swKey(k)] = { status: 'ABSENT' };
  return { env: e, simulated: e !== 'production', units, evidence: {}, decisions: {}, halted: null, log: [], sittings: {} };
}
const clone = s => JSON.parse(JSON.stringify(s));
const no = (s, message) => ({ ok: false, state: s, message });
const yes = (s, message) => { s.log.push(message); return { ok: true, state: s, message: (s.simulated ? 'SIMULATED: ' : '') + message }; };
const done = st => ['POSTCHECK PASS', 'VERIFIED'].includes(st);
const switchOnLike = st => ['SWITCH ON', 'OBSERVING'].includes(st);

function backupOk(s, date) {
  const b = s.evidence.BACKUP;
  return b && b.status === 'PASS' && b.date === date;
}
function apply(state, action) {
  const s = clone(state);
  const a = action || {};
  if (s.halted && !['owner_resolves', 'switch_off', 'evidence', 'rollback'].includes(a.do)) return no(s, 'STOPPED: ' + s.halted + ' Only switching OFF, rolling back, new evidence or the owner\'s review may happen now.');
  // one production change per sitting (owner fatigue / one thing at a time)
  if (['install', 'switch_on'].includes(a.do)) {
    if (a.sitting === undefined) return no(s, 'Each change needs a sitting number (one change per sitting).');
    if (s.sittings[a.sitting]) return no(s, 'One change per sitting: sitting ' + a.sitting + ' already did "' + s.sittings[a.sitting] + '".');
  }
  switch (a.do) {
    case 'evidence': {
      if (!s.simulated && a.env !== 'production') return no(s, 'Evidence from ' + (a.env || 'an unstated environment') + ' cannot support a production step (local or staging results are not production verification).');
      s.evidence[a.type] = { status: a.status, date: a.date };
      if (a.type === 'QUERY_H' && a.status === 'FAIL') s.halted = 'Query H shows FAIL (' + (a.detail || 'drift') + '). Switch OFF what its ACTION names; no next step.';
      if (a.type === 'BACKUP' && a.status === 'FAIL') s.halted = 'Backup FAILED. No production change until the owner has looked at why.';
      return yes(s, 'Evidence ' + a.type + ' = ' + a.status + ' (' + a.date + ')');
    }
    case 'decision': s.decisions[a.id] = a.choice; return yes(s, 'Decision ' + a.id + ' = ' + a.choice);
    case 'precheck': {
      const u = INSTALLS[a.unit]; if (!u) return no(s, 'Unknown step ' + a.unit);
      if (s.units[a.unit].status !== 'NOT STARTED' && s.units[a.unit].status !== 'ROLLED BACK') return no(s, u.label + ' is already ' + s.units[a.unit].status + '.');
      for (const n of u.needs) if (!done(s.units[n].status)) return no(s, 'Wrong order: "' + INSTALLS[n].label + '" must be done and checked first.');
      for (const ev of u.evidence || []) if (!s.evidence[ev] || !['PASS', 'WARN'].includes(s.evidence[ev].status)) return no(s, u.label + ' needs ' + ev + ' evidence first (read-only check).');
      if (u.decision && !s.decisions[u.decision]) return no(s, u.label + ' needs the "' + u.decision + '" decision first (the defaults may be accepted explicitly).');
      if (a.result !== 'PASS') { s.units[a.unit].status = 'FAILED'; s.halted = u.label + ': precheck did not pass (' + (a.result || 'no result') + ').'; return yes(s, u.label + ' precheck FAILED: stop.'); }
      s.units[a.unit].status = 'PRECHECK PASS';
      return yes(s, u.label + ' precheck PASS');
    }
    case 'install': {
      const u = INSTALLS[a.unit]; if (!u) return no(s, 'Unknown step ' + a.unit);
      if (['INSTALLED', 'POSTCHECK PASS', 'VERIFIED'].includes(s.units[a.unit].status)) return yes(s, u.label + ': already installed; running it again changes nothing (each draft is idempotent or refuses).');
      if (s.units[a.unit].status !== 'PRECHECK PASS') return no(s, 'Skipped precheck: ' + u.label + ' can only be installed right after its precheck passes.');
      if (u.db && !backupOk(s, a.date)) return no(s, 'No green backup look on ' + a.date + ': database steps need one on the same day.');
      s.units[a.unit] = { status: 'INSTALLED', version: a.version || null, date: a.date };
      s.sittings[a.sitting] = 'install ' + a.unit;
      return yes(s, u.label + ' INSTALLED (not yet checked)');
    }
    case 'postcheck': {
      const u = INSTALLS[a.unit]; if (!u) return no(s, 'Unknown step ' + a.unit);
      if (s.units[a.unit].status !== 'INSTALLED') return no(s, 'Postcheck only right after install (now ' + s.units[a.unit].status + ').');
      const fpBad = u.fingerprint && a.fingerprint !== u.fingerprint;
      if (a.result !== 'PASS' || fpBad) {
        s.units[a.unit].status = 'FAILED';
        s.halted = u.label + ': postcheck failed' + (fpBad ? ' (fingerprint ' + (a.fingerprint || 'missing') + ' is not the reviewed version)' : '') + '. Roll back with ' + (u.rollback || 'the revert') + '.';
        return yes(s, u.label + ' postcheck FAILED: stop and roll back.');
      }
      s.units[a.unit].status = 'POSTCHECK PASS';
      if (a.unit === 'switch_rows') for (const [k, sw] of Object.entries(SWITCHES)) if (sw.install === 'switch_rows') s.units[k].status = 'SWITCH OFF';
      if (a.unit === 'request_keys') s.units.request_keys_switch.status = 'SWITCH OFF';
      if (a.unit === 'nightly') s.units.integrity_results_home.status = 'SWITCH OFF';
      return yes(s, u.label + ' postcheck PASS');
    }
    case 'switch_on': {
      const sw = SWITCHES[a.switch]; if (!sw) return no(s, 'Unknown switch ' + a.switch);
      const key = swKey(a.switch);
      const cur = s.units[key];
      if (!done(s.units[sw.install].status)) return no(s, 'Switch ' + sw.label + ' refused: its database step "' + INSTALLS[sw.install].label + '" is not installed and checked.');
      if (cur.status === 'ABSENT') return no(s, 'Switch ' + sw.label + ' refused: its switch row does not exist yet.');
      if (switchOnLike(cur.status)) return no(s, 'Switch ' + sw.label + ' is already ON.');
      const busy = Object.entries(s.units).filter(([, u]) => switchOnLike(u.status)).map(([k]) => k);
      if (busy.length) return no(s, 'One switch at a time: ' + busy.join(', ') + ' is still being observed (needs one working day and checks, then VERIFIED).');
      if (!s.evidence.QUERY_H || s.evidence.QUERY_H.status !== 'PASS' || s.evidence.QUERY_H.date !== a.date) return no(s, 'Run Query H on ' + a.date + ' first: it must be PASS before a switch goes on.');
      if (sw.stock) {
        const earlier = Object.entries(SWITCHES).filter(([, x]) => x.stock && x.order < sw.order).map(([k]) => k);
        const notYet = earlier.filter(k => s.units[k].status !== 'VERIFIED');
        if (notYet.length) return no(s, 'Order: ' + notYet.map(k => SWITCHES[k].label).join(', ') + ' must be ON and VERIFIED before ' + sw.label + '.');
      }
      s.sittings[a.sitting] = 'switch on ' + a.switch;
      s.units[key] = { status: 'OBSERVING', since: a.date };
      return yes(s, 'Switch ' + sw.label + ' ON; observing (canary action, then one working day)' + (sw.note ? ' — ' + sw.note : ''));
    }
    case 'verify': {
      if (!SWITCHES[a.switch]) return no(s, 'Unknown switch ' + a.switch);
      const u = s.units[swKey(a.switch)]; if (u.status !== 'OBSERVING') return no(s, 'Only a switch under observation can be verified.');
      if (Date.parse(a.date) - Date.parse(u.since) < DAY) return no(s, 'Too early: at least one working day of normal use before VERIFIED.');
      if (a.canary !== 'expected') return no(s, 'The canary action did not give the expected number: switch OFF and stop.');
      if (!s.evidence.QUERY_H || s.evidence.QUERY_H.status !== 'PASS' || s.evidence.QUERY_H.date !== a.date) return no(s, 'Query H on ' + a.date + ' must be PASS to verify.');
      if (SWITCHES[a.switch].stock && (!s.evidence.QUERY_E || s.evidence.QUERY_E.status !== 'PASS' || s.evidence.QUERY_E.date !== a.date)) return no(s, 'Stock switch: Query E must show 0 mismatches on ' + a.date + '.');
      u.status = 'VERIFIED';
      return yes(s, 'Switch ' + SWITCHES[a.switch].label + ' VERIFIED' + (s.simulated ? ' (simulation only: not production evidence)' : ''));
    }
    case 'switch_off': {
      if (!SWITCHES[a.switch]) return no(s, 'Unknown switch ' + a.switch);
      const u = s.units[swKey(a.switch)]; if (!['SWITCH ON', 'OBSERVING', 'VERIFIED'].includes(u.status)) return yes(s, 'Switch ' + a.switch + ' is already OFF (turning off is always safe).');
      u.status = 'SWITCH OFF';
      return yes(s, 'Switch ' + SWITCHES[a.switch].label + ' OFF: the page is back to today\'s path at once. Real-world effects made while it was ON (stock received, records saved) stay and are corrected by hand with a note if wrong.');
    }
    case 'drift': {
      // e.g. a function disappeared or changed while its switch is ON
      const sw = SWITCHES[a.switch];
      const st = sw ? s.units[swKey(a.switch)].status : null;
      if (sw && (switchOnLike(st) || st === 'VERIFIED')) s.halted = 'PROBLEM: switch ' + sw.label + ' is ON but its database step is ' + (a.what || 'missing') + '. Turn it OFF now.';
      else s.halted = 'Drift found: ' + (a.what || 'unexpected database state') + '.';
      return yes(s, s.halted);
    }
    case 'rollback': {
      const u = INSTALLS[a.unit]; if (!u) return no(s, 'Unknown step ' + a.unit);
      if (!['INSTALLED', 'POSTCHECK PASS', 'VERIFIED', 'FAILED'].includes(s.units[a.unit].status)) return no(s, 'Nothing to roll back: ' + u.label + ' is ' + s.units[a.unit].status + ' (wrong rollback file?).');
      const onSwitches = Object.entries(SWITCHES).filter(([k, sw]) => (sw.install === a.unit || (a.unit === 'r15' && sw.install === 'switch_rows')) && ['SWITCH ON', 'OBSERVING', 'VERIFIED'].includes(s.units[swKey(k)].status)).map(([k]) => k);
      if (onSwitches.length) return no(s, 'Rollback refused while ' + onSwitches.join(', ') + ' is ON: switch it OFF first (the rollback files refuse too).');
      const dependents = Object.entries(INSTALLS).filter(([k, x]) => x.needs.includes(a.unit) && k !== 'merge' && ['INSTALLED', 'POSTCHECK PASS', 'VERIFIED'].includes(s.units[k].status)).map(([k]) => k);
      if (dependents.length) return no(s, 'Rollback order: roll back ' + dependents.join(', ') + ' first.');
      s.units[a.unit] = { status: 'ROLLED BACK' };
      if (a.unit === 'switch_rows') for (const [k, sw] of Object.entries(SWITCHES)) if (sw.install === 'switch_rows') s.units[k].status = 'ABSENT';
      if (a.unit === 'nightly') s.units.integrity_results_home.status = 'ABSENT';
      if (a.unit === 'request_keys') s.units.request_keys_switch.status = 'ABSENT';
      if (s.halted && /postcheck failed|precheck/.test(s.halted)) s.halted = null;
      return yes(s, u.label + ' ROLLED BACK with ' + (u.rollback || 'the revert') + '. A rollback removes database objects; it cannot undo business effects.');
    }
    case 'owner_resolves': s.halted = null; return yes(s, 'Owner reviewed the stop and decided how to continue: ' + (a.note || ''));
    case 'version_changed': {
      // a new reviewed version of a draft means old install evidence no longer applies
      const u = s.units[a.unit];
      if (u && u.version && u.version !== a.version) u.status = 'UNKNOWN';
      return yes(s, 'New version of ' + a.unit + ': earlier install evidence no longer applies (status UNKNOWN until re-checked).');
    }
    default: return no(s, 'Unknown action ' + a.do);
  }
}
function board(s) {
  const rows = Object.entries(s.units).map(([k, u]) => (s.simulated ? 'SIMULATED ' : '') + k + ': ' + u.status);
  return rows;
}
// Run a list of actions; stop at the first refusal.
function run(env, actions) {
  let s = start({ env }); const out = [];
  for (const a of actions) { const r = apply(s, a); out.push(r); if (!r.ok) break; s = r.state; }
  return { state: s, results: out };
}
module.exports = { INSTALLS, SWITCHES, start, apply, run, board };

// CLI: rehearse an order written as a JSON list of actions.
//   node tests/tools/deploy-sim.js plan.json --env local
if (require.main === module) {
  const file = process.argv[2];
  const i = process.argv.indexOf('--env');
  const env = i > 0 ? process.argv[i + 1] : undefined;
  if (!file) { console.error('usage: node tests/tools/deploy-sim.js <plan.json> --env production|staging|local'); process.exit(2); }
  let actions;
  try { actions = JSON.parse(require('fs').readFileSync(file, 'utf8')); } catch (e) { console.error('Cannot read ' + file + ': ' + e.message); process.exit(2); }
  let out;
  try { out = run(env, actions); } catch (e) { console.error(e.message); process.exit(2); }
  out.results.forEach((r, n) => console.log((r.ok ? 'OK      ' : 'REFUSED ') + (n + 1) + '. ' + r.message));
  console.log('\n' + board(out.state).join('\n'));
  if (out.state.halted) console.log('\nSTOPPED: ' + out.state.halted);
  process.exitCode = out.results.every(r => r.ok) ? 0 : 1;
}
