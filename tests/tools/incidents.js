// Incident response map (EXT12). One entry per thing that can go wrong, in
// the words the dashboard (or a read-only check) actually shows, with what a
// person does next. It connects to nothing and repairs nothing: every
// recovery is done by a person, and anything touching stock or money goes to
// the owner before it is corrected.
//
//   node tests/tools/incidents.js                 list every scenario
//   node tests/tools/incidents.js <id>            one card
//   node tests/tools/incidents.js lookup "<text the screen shows>"
//
// retry: SAFE         pressing again cannot duplicate or harm
//        AFTER CHECK  only after the stated check shows it did not happen
//        NEVER        do not press again; follow the steps
// Rule tested in tests/specs/incidents-ext12.spec.js: when the outcome is
// unknown, retry is never SAFE unless a request key or an all-or-nothing
// function makes a second press harmless (then the page itself says so).
const SCENARIOS = [
  { id: 'po-receive-unknown', area: 'stock', title: 'Purchase-order receive lost its connection',
    signal: { page: ['Receipt status unknown', 'Check this order now'] }, unknownOutcome: true, stop: true, retry: 'NEVER',
    first: ['Do not press Receive again.', 'Press "Check this order now" and follow exactly what it says.', 'If it says stock already shows, finish only the lines it lists, by hand, with a note.'],
    avoid: ['Pressing Receive again "to be sure" (stock would be added twice before R1 is on).'],
    check: 'Inventory history for that order shows each line exactly once; the order is Received.', escalate: 'owner' },
  { id: 'stock-fn-unknown', area: 'stock', title: 'A stock action\'s connection dropped (adjust, recall, return, delete)',
    signal: { page: ['the dashboard cannot tell whether', 'Reload the page and check the stock and its history before trying again.'] }, unknownOutcome: true, stop: true, retry: 'AFTER CHECK',
    first: ['Reload the page.', 'Open the product\'s stock history and look for the change.', 'Only if it is not there, do it once more.'],
    avoid: ['Repeating the action before looking.'], check: 'The change appears exactly once in the history.', escalate: 'owner' },
  { id: 'stock-fn-missing', area: 'stock', title: 'A stock switch is ON but its database function is missing',
    signal: { page: ['is switched on but is not installed, so nothing was changed', 'PROBLEM: switched ON but its database step is missing'] }, stop: true, retry: 'NEVER',
    first: ['Owner turns that switch OFF on Feature Switches.', 'The page goes back to today\'s path at once.', 'Owner runs Query H to see what disappeared.'],
    avoid: ['Reinstalling anything in a hurry.', 'Turning other switches on.'], check: 'System status → Database steps no longer shows PROBLEM; Query H PASS.', escalate: 'owner' },
  { id: 'return-unknown', area: 'stock', title: 'Return "Mark received" outcome unknown',
    signal: { page: ['Chosen outcome: '] }, unknownOutcome: true, stop: true, retry: 'AFTER CHECK',
    first: ['Reload Returns and read the return\'s status.', 'Check the product\'s stock history for the restock.', 'Only if neither shows it, mark received once more.'],
    avoid: ['Marking received twice (restocks twice while R3 is off).', 'Recording a refund to "fix" stock.'],
    check: 'One restock line in history for that return.', escalate: 'owner' },
  { id: 'recall-unknown', area: 'stock', title: 'Recall quarantine outcome unknown',
    signal: { page: ['the dashboard cannot tell whether'] }, unknownOutcome: true, stop: true, retry: 'AFTER CHECK',
    first: ['Reload Recalls; read the recall status.', 'Check the lot\'s stock buckets (available vs quarantine).'],
    avoid: ['Quarantining again before looking.'], check: 'The lot\'s quantity is in quarantine once; available went down by the same amount.', escalate: 'owner' },
  { id: 'adjust-negative', area: 'stock', title: 'Manual adjustment refused (would go below zero, or stock changed)',
    signal: { page: ['changed since the page loaded'] }, stop: false, retry: 'AFTER CHECK',
    first: ['Reload and re-count the shelf.', 'Enter the adjustment again with a reason.'],
    avoid: ['Forcing a number that makes another bucket wrong.'], check: 'Bucket matches the count; reason saved.', escalate: 'owner if the count is far off' },
  { id: 'product-delete', area: 'stock', title: 'A product with history must not be deleted',
    signal: { page: ['a product with any history is never deleted'] }, stop: false, retry: 'NEVER',
    first: ['Archive (deactivate) the product instead.'], avoid: ['Asking for a database delete.'],
    check: 'Product shows as inactive; its history is intact.', escalate: 'owner' },
  { id: 'save-unknown-no-keys', area: 'records', title: 'A save may or may not have happened (request keys off)',
    signal: { page: ['may or may not have been saved'] }, unknownOutcome: true, stop: false, retry: 'AFTER CHECK',
    first: ['Look at the list first.', 'Enter it again only if it is not there.'], avoid: ['Pressing Save again at once (duplicate record).'],
    check: 'Exactly one record.', escalate: 'none unless money' },
  { id: 'save-unknown-with-keys', area: 'records', title: 'A save lost its reply, request keys ON',
    signal: { page: ['Pressing the button again is safe', 'already saved by an earlier attempt'] }, unknownOutcome: true, keyed: true, stop: false, retry: 'SAFE',
    first: ['Press again; the database saves it only once.'], avoid: [], check: 'Exactly one record.', escalate: 'none' },
  { id: 'nightly-not-installed', area: 'checks', title: 'Nightly check switched on but not installed',
    signal: { page: ['Switched on, but the nightly check is not installed'] }, stop: true, retry: 'NEVER',
    first: ['Owner turns integrity_results_home OFF.', 'Install order: drafts/25 then drafts/29 (owner, separate sitting).'],
    avoid: ['Reading the Home card as PASS.'], check: 'Home card says "Not set up yet" (expected) or a dated result.', escalate: 'owner' },
  { id: 'nightly-stale', area: 'checks', title: 'Nightly check result is old or failed',
    signal: { page: ['Nightly integrity check'], external: 'Home card shows STALE or FAIL' }, stop: false, retry: 'SAFE',
    first: ['Press Check again.', 'If still FAIL, open the rows it names and tell the owner.'], avoid: ['Fixing numbers by hand without the owner.'],
    check: 'A result dated today.', escalate: 'owner on FAIL' },
  { id: 'rls-denied', area: 'access', title: 'Permission refused (row-level security) or a role sees too much',
    signal: { page: ['permission'], external: 'Query G shows FAIL, or a staff member sees owner-only data' }, stop: true, retry: 'NEVER',
    first: ['Screenshot what was refused or shown (no customer details).', 'Owner reads Query G.'],
    avoid: ['Asking anyone to "open up" a table.', 'Sharing an owner login.'], check: 'Query G has no FAIL; the role sees only its pages.', escalate: 'owner' },
  { id: 'audit-gap', area: 'checks', title: 'A table changes without an audit record',
    signal: { external: 'Query C section 10: audit_trigger=NONE for a table that must be audited' }, stop: false, retry: 'NEVER',
    first: ['Record it as a finding; compare with AUDIT_REQUIRED.', 'Owner decides whether a trigger draft is prepared.'],
    avoid: ['Adding triggers in production without a reviewed draft.'], check: 'Next Query C lists audit coverage for that table.', escalate: 'owner' },
  { id: 'agent-unknown', area: 'agents', title: 'An agent\'s state is unknown, failed, or ON when it should be off',
    signal: { external: 'Query C section 1: switch=unknown, last_run_status=error, or an off-by-decision agent shows ON' }, stop: true, retry: 'NEVER',
    first: ['Owner turns that agent\'s switch OFF.', 'Keep its last output for review; do not rerun it.'],
    avoid: ['Rerunning an agent to "see what happens" (it may send or write again).'], check: 'Next Query C shows the expected switch and no new runs.', escalate: 'owner' },
  { id: 'backup-stale', area: 'backup', title: 'Backup is older than the allowed age or failed',
    signal: { external: 'Backup evidence older than 7 days, or the nightly backup run failed' }, stop: true, retry: 'NEVER',
    first: ['No production change until a fresh green backup is seen.', 'Owner checks the backup run (backups are owner-only).'],
    avoid: ['Any database step "just this once".'], check: 'A green backup look dated today.', escalate: 'owner' },
  { id: 'dashboard-unavailable', area: 'access', title: 'Dashboard does not load',
    signal: { page: ['The sign-in helper library did not load from the internet', 'did not load, so it cannot start'] }, stop: false, retry: 'SAFE',
    first: ['Check the internet connection.', 'Hard refresh (Cmd+Shift+R) or a Private Window.', 'If still broken after a merge: owner reverts the merge (rollback card).'],
    avoid: ['Working from an old tab.'], check: 'Sign-in screen appears.', escalate: 'owner if it persists' },
  { id: 'session-ended', area: 'access', title: 'Signed out in the background',
    signal: { page: ['You were signed out'] }, stop: false, retry: 'AFTER CHECK',
    first: ['Sign in again.', 'Check whether the last thing you typed was saved before redoing it.'], avoid: ['Assuming the last save went through.'],
    check: 'The record shows your last change, or you re-enter it once.', escalate: 'none' },
  { id: 'conflict', area: 'records', title: 'Someone else changed the record first',
    signal: { page: ['changed elsewhere'] }, stop: false, retry: 'AFTER CHECK',
    first: ['Reload.', 'Compare with what you meant.', 'Redo only what is still needed.'], avoid: ['Pressing repeatedly to force it.'],
    check: 'The record reads as intended.', escalate: 'none' },
  { id: 'data-drift', area: 'checks', title: 'Numbers disagree (stock vs history, or a total that cannot be right)',
    signal: { page: ['Could not check'], external: 'Query E mismatches, or a red row on Home' }, stop: true, retry: 'NEVER',
    first: ['Stop changing the affected records.', 'Screenshot; open an incident; link evidence.', 'Owner decides the correction (adjustment with a reason).'],
    avoid: ['Correcting stock or money before the owner looks.', 'Reading "Could not check" as fine.'], check: 'Query E 0 mismatches; the red row clears.', escalate: 'owner' },
];
const RETRY = ['SAFE', 'AFTER CHECK', 'NEVER'];
// Words a recovery step must never contain: production repairs are not operator steps.
const FORBIDDEN = /\b(run sql|update \w+ set|delete from|service.role|refund the|issue a refund|email the customer|text the customer|turn .*switch on)\b/i;

function validate(list = SCENARIOS) {
  const problems = [];
  const ids = new Set();
  for (const s of list) {
    if (ids.has(s.id)) problems.push(s.id + ': duplicate id'); ids.add(s.id);
    if (!RETRY.includes(s.retry)) problems.push(s.id + ': retry must be ' + RETRY.join('/'));
    if (s.unknownOutcome && s.retry === 'SAFE' && !s.keyed) problems.push(s.id + ': unknown outcome cannot be safe to retry without a request key');
    if (s.area === 'stock' && !/owner/.test(s.escalate)) problems.push(s.id + ': stock incidents go to the owner before correcting');
    if (!s.first || !s.first.length) problems.push(s.id + ': no first step');
    if (!s.check) problems.push(s.id + ': no recovery check');
    if (!s.signal || !((s.signal.page || []).length || s.signal.external)) problems.push(s.id + ': no signal');
    for (const t of [...(s.first || []), s.check]) if (FORBIDDEN.test(t)) problems.push(s.id + ': forbidden step "' + t + '"');
  }
  return problems;
}
// Which scenarios match text pasted from the screen (exact phrases only).
function lookup(text) {
  const t = String(text || '');
  return SCENARIOS.filter(s => (s.signal.page || []).some(p => t.includes(p)));
}
function card(s) {
  return [s.title + '  [' + s.id + ']',
    'Signal: ' + [...(s.signal.page || []).map(p => '"' + p + '"'), s.signal.external || ''].filter(Boolean).join(' / '),
    (s.stop ? 'STOP. ' : '') + 'Retry: ' + s.retry,
    ...s.first.map((x, i) => '  ' + (i + 1) + '. ' + x),
    ...(s.avoid.length ? ['Avoid: ' + s.avoid.join(' ')] : []),
    'Recovered when: ' + s.check,
    'Tell: ' + s.escalate,
    'No automatic repair: a person does each step.'].join('\n');
}
module.exports = { SCENARIOS, RETRY, validate, lookup, card };

if (require.main === module) {
  const [cmd, arg] = process.argv.slice(2);
  if (!cmd) for (const s of SCENARIOS) console.log(s.id.padEnd(26) + (s.stop ? 'STOP  ' : '      ') + s.retry.padEnd(12) + s.title);
  else if (cmd === 'lookup') { const m = lookup(arg); console.log(m.length ? m.map(card).join('\n\n') : 'No exact match. Treat it as unknown: stop, screenshot, tell the owner.'); }
  else { const s = SCENARIOS.find(x => x.id === cmd); console.log(s ? card(s) : 'Unknown scenario ' + cmd); if (!s) process.exitCode = 1; }
}
