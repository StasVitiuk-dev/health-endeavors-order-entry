// One machine-readable source for the dashboard's workflow state machines
// (2026-10-06, extension 5, workstream 5). Read from the code, not invented:
// state-machine.spec.js checks this file against the page's own transition
// constants and the database's allowed values, and docs/ops/STATE_MACHINES.md
// is generated from it (node tests/fixtures/state-machines.js --md).
//
// transitions: [from[], to, the button that does it]. "from" is the condition
// the page sends WITH the write, so a stale tab cannot apply it from any other
// state. terminal: states with no way out from the dashboard.
const MACHINES = {
  tasks: {
    table: 'tasks', column: 'status',
    states: ['open', 'in_progress', 'done', 'cancelled'],
    transitions: [[['open'], 'in_progress', 'Mark in progress'], [['open', 'in_progress'], 'done', 'Mark done']],
    terminal: ['done', 'cancelled'],
    pageConstant: 'TASK_ALLOWED_FROM',
    notes: 'cancelled is a valid database value but no dashboard button sets it (agents may).',
  },
  purchase_orders: {
    table: 'purchase_orders', column: 'status',
    states: ['draft', 'ordered', 'shipped', 'received', 'cancelled'],
    transitions: [[['draft'], 'ordered', 'Mark as ordered'], [['ordered'], 'shipped', 'Mark as shipped'],
      [['draft', 'ordered', 'shipped'], 'cancelled', 'Cancel'], [['ordered', 'shipped'], 'received', 'Receive delivery']],
    terminal: ['received', 'cancelled'],
    pageConstant: 'PO_ALLOWED_FROM',
    notes: 'Lines, shipping and tax editable only while draft or ordered (PO_EDITABLE). Receive is claim-first, then re-reads the order (EXT5).',
  },
  returns: {
    table: 'returns', column: 'status',
    states: ['requested', 'approved', 'rejected', 'received', 'refunded', 'closed'],
    transitions: [[['requested'], 'approved', 'Approve'], [['requested'], 'rejected', 'Reject'], [['approved'], 'received', 'Mark Received'],
      [['received'], 'refunded', 'Mark Refunded'], [['rejected', 'refunded', 'received'], 'closed', 'Close']],
    terminal: ['closed'],
    notes: 'Refund accounting policy is owner decision N4; the dashboard records, it never pays.',
  },
  recalls: {
    table: 'recalls', column: 'status',
    states: ['initiated', 'quarantined', 'resolved'],
    transitions: [[['initiated'], 'quarantined', 'Quarantine stock'], [['quarantined', 'initiated'], 'resolved', 'Mark resolved']],
    terminal: ['resolved'],
    notes: 'Resolving a never-quarantined recall needs a second, deliberate press and a resolution note.',
  },
  approval_requests: {
    table: 'approval_requests', column: 'status',
    states: ['pending', 'approved', 'rejected'],
    transitions: [[['pending'], 'approved', 'Approve (password)'], [['pending'], 'rejected', 'Deny (password)']],
    terminal: ['approved', 'rejected'],
  },
  feature_requests: {
    table: 'feature_requests', column: 'status',
    states: ['requested', 'in_progress', 'done'],
    transitions: [[['requested'], 'in_progress', 'Mark in progress'], [['in_progress'], 'done', 'Mark done']],
    terminal: ['done'],
    pageConstant: 'FR_NEXT_STATUS',
    notes: 'Database allowed values not verified yet (Query C section 9).',
  },
  legal_holds: {
    table: 'legal_holds', column: 'status',
    states: ['active', 'released'],
    transitions: [[['active'], 'released', 'Release (password)']],
    terminal: ['released'],
    notes: 'Database allowed values not verified yet (Query C section 9).',
  },
  adverse_event_fda_flag: {
    table: 'adverse_event_reports', column: 'fda_reported',
    states: [false, true],
    transitions: [[[false], true, 'Mark reported to FDA (second press)']],
    terminal: [true],
  },
};

function markdown() {
  const out = ['# Workflow state machines (generated)', '',
    '**Generated** from `tests/fixtures/state-machines.js` (`node tests/fixtures/state-machines.js --md`). `state-machine.spec.js` checks the fixture against the page\'s transition constants and the database\'s allowed values, and fails if this file is out of date. "From" is the condition sent with the write: a stale tab cannot apply a move from any other state (tested per state in `state-transitions*.spec.js`).', ''];
  for (const [name, m] of Object.entries(MACHINES)) {
    out.push(`## ${name} (\`${m.table}.${m.column}\`)`, '');
    out.push('States: ' + m.states.map(s => '`' + s + '`').join(', ') + '. Terminal: ' + m.terminal.map(s => '`' + s + '`').join(', ') + '.', '');
    out.push('| From | To | Button |', '|---|---|---|');
    for (const [from, to, btn] of m.transitions) out.push(`| ${from.map(s => '`' + s + '`').join(', ')} | \`${to}\` | ${btn} |`);
    const illegal = [];
    for (const to of m.states) for (const from of m.states) if (from !== to && !m.transitions.some(t => t[1] === to && t[0].includes(from))) illegal.push(`${from}→${to}`);
    out.push('', 'Not possible from the dashboard: ' + illegal.map(s => '`' + s + '`').join(', ') + '.');
    if (m.notes) out.push('', m.notes);
    out.push('');
  }
  return out.join('\n');
}

module.exports = { MACHINES, markdown };
if (require.main === module && process.argv.includes('--md')) {
  require('fs').writeFileSync(require('path').join(__dirname, '..', '..', 'docs', 'ops', 'STATE_MACHINES.md'), markdown() + '\n');
}
