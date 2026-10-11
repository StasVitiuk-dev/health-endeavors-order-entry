// EXT12: synthetic owner-evidence samples, shaped exactly like the real
// outputs (column names from the SQL files and the local-database runs).
// SYNTHETIC ONLY: no real data. Used by tests/specs/evidence-ext12.spec.js and
// by the owner-evidence rehearsal in docs/ops/OWNER_EVIDENCE_GUIDE_EXT12.md.
const C_HEAD = 'section,item,result\n';
const C_BASE = [
  '0 counts,orders,0', '1 agents,agent #01,switch=ON; last_run_at=2026-10-14T03:00:00Z; last_run_status=ok; switch_changed_at=unknown; last_error=none',
  '1 agents,agent #04,switch=ON; last_run_at=2026-10-14T03:00:00Z; last_run_status=ok; switch_changed_at=unknown; last_error=none',
  '1 agents,agent #02,switch=off; last_run_at=never recorded; last_run_status=none; switch_changed_at=unknown; last_error=none',
  '2 switches,shopify_order_sync,enabled=false', '3 agent #1 invoices,trg_generate_invoice_for_order,enabled; checks switch=yes',
  '4 shopify sync,orders from shopify,0', '5 scheduled jobs,agent4-retail-wholesale,"schedule=3 * * * *; active=true; last=succeeded"',
  '6 stock writers,none found,none', '7 triggers,orders,trg_generate_invoice_for_order', '8 direct writes,inventory,authenticated: SELECT',
  '9 value rules,orders_status_check,check (status in (...))',
];
const audit = (t, trig) => `10 audit coverage,${t},"audit_trigger=${trig}; who_when_columns=created_at, updated_at"`;
const AUDITED = ['tasks', 'orders', 'inventory', 'inventory_adjustments', 'purchase_orders', 'returns', 'recalls', 'products', 'approval_requests', 'business_rules', 'feature_flags', 'system_mode'];
const C = {
  allPass: C_HEAD + C_BASE.concat(AUDITED.map(t => audit(t, t + '_audit'))).join('\n') + '\n',
  auditMissing: C_HEAD + C_BASE.concat(AUDITED.map(t => audit(t, ['inventory', 'feature_flags'].includes(t) ? 'NONE' : t + '_audit'))).join('\n') + '\n',
  agentUnknown: C_HEAD + C_BASE.concat(['1 agents,agent #10,switch=unknown; last_run_at=never recorded; last_run_status=none; switch_changed_at=unknown; last_error=none'], AUDITED.map(t => audit(t, t + '_audit'))).join('\n') + '\n',
  agentFailed: C_HEAD + C_BASE.concat(['1 agents,agent #06,switch=off; last_run_at=2026-10-09T03:00:00Z; last_run_status=error; switch_changed_at=unknown; last_error=failed for [email]'], AUDITED.map(t => audit(t, t + '_audit'))).join('\n') + '\n',
  offAgentOn: C_HEAD + C_BASE.concat(['1 agents,agent #07,switch=ON; last_run_at=2026-10-14T03:00:00Z; last_run_status=ok; switch_changed_at=unknown; last_error=none'], AUDITED.map(t => audit(t, t + '_audit'))).join('\n') + '\n',
  unexpectedWriter: C_HEAD + C_BASE.filter(l => !/^6 stock writers/.test(l)).concat(['6 stock writers,public.agent4_run(),"writes inventory; reachable by: pg_cron job agent4"'], AUDITED.map(t => audit(t, t + '_audit'))).join('\n') + '\n',
  missingSection: C_HEAD + C_BASE.filter(l => !/^5 scheduled jobs/.test(l)).concat(AUDITED.map(t => audit(t, t + '_audit'))).join('\n') + '\n',
  partialOutput: C_HEAD + C_BASE.slice(0, 4).join('\n') + '\n',
  permissionDenied: 'ERROR:  permission denied for schema cron\n',
  timeout: 'ERROR:  canceling statement due to statement timeout\n',
};
const D_HEAD = 'function_name,classification\n';
const D = {
  allPass: D_HEAD + 'public.handle_new_user(),A trigger only\npublic.is_owner_or_admin(),B not callable by anon\n',
  readNext: D_HEAD + 'public.handle_new_user(),A trigger only\npublic.agent4_run(),C callable by signed-in users; checks caller: unknown\n',
  misusable: D_HEAD + 'public.handle_new_user(),A trigger only\npublic.reset_stock(),E anon + no gate WRITES\n',
  unknownRow: D_HEAD + 'public.mystery(),?\n',
  malformed: 'name;kind\nx;y\n',
};
const E_HEAD = 'section,check_name,result\n';
const E = {
  match: E_HEAD + '1 stock,buckets differ from history,0\n2 history,history without stock,0\n3 deliveries,received PO without expense,none\n4 lots,lots hold more than stock (information),0\n',
  stockMismatch: E_HEAD + '1 stock,buckets differ from history,2\n2 history,history without stock,0\n3 deliveries,received PO without expense,none\n',
  deliveryMismatch: E_HEAD + '1 stock,buckets differ from history,0\n3 deliveries,received PO without expense,PO-SYN-7 (1)\n',
  missingData: E_HEAD + '1 stock,buckets differ from history,\n',
  unknown: E_HEAD,
};
const F_HEAD = 'section,check_name,findings,examples\n';
const FNAMES = ['F01 stuck work', 'F02 stuck work', 'F03 stuck work', 'F04 stuck work', 'F05 stuck work', 'F06 probable duplicate', 'F07 probable duplicate', 'F08 probable duplicate', 'F09 probable duplicate',
  'F10 points at the wrong thing', 'F11 points at the wrong thing', 'F12 impossible value', 'F13 impossible value', 'F14 impossible value', 'F15 impossible value'];
const fRows = over => F_HEAD + FNAMES.map((s, i) => `${s},check ${i + 1},${over[s.slice(0, 3)] !== undefined ? over[s.slice(0, 3)] : 0},`).join('\n') + '\n';
const F = {
  allPass: fRows({}),
  oneFail: fRows({ F14: 1 }),
  multiple: fRows({ F02: 3, F06: 1, F12: 2 }),
  unknown: fRows({ F09: '' }),
  malformed: 'section,check\nF01,x\n',
};
const G_HEAD = 'check_id,level,object,detail\n';
const G = {
  expected: G_HEAD + 'G01 no row-level security,PASS,tasks,\nG03 open task update,PASS,tasks,\nG04 anon table rights,WARN,products,SELECT\nG07 RLS on no policy,INFO,integrity_check_runs,\n',
  anonWrite: G_HEAD + 'G01 no row-level security,PASS,tasks,\nG04 anon table rights,FAIL,orders,"INSERT, UPDATE"\n',
  duplicatePolicy: G_HEAD + 'G01 no row-level security,PASS,tasks,\nG05 duplicate read policies,WARN,inventory,2 permissive SELECT policies\n',
  taskUpdateBroad: G_HEAD + 'G03 open task update,FAIL,tasks,update using (true)\n',
  noRls: G_HEAD + 'G01 no row-level security,FAIL,legacy_notes,\n',
  malformed: 'policy,table\nx,y\n',
};
const H_HEAD = 'id,item,expected,observed,status,action\n';
const H = {
  allExpected: H_HEAD + 'H01,R1-R5 stock functions (drafts/10),6,0 present,NOT INSTALLED,Normal before step P2.\nH02,anon cannot run stock functions,0,0,PASS,Nothing to do.\nH03,Switch stock_fn_receive_po (drafts/21),OFF,no switch row,NOT INSTALLED,Normal before step P3.\nH10,PO line guard,present after P5,absent,NOT INSTALLED,Normal before step P5.\n',
  installedOk: H_HEAD + 'H01,R1-R5 stock functions (drafts/10),"6, fingerprint 3df2bf7a07b451f12f9359ceca1c85df","6 present, fingerprint 3df2bf7a07b451f12f9359ceca1c85df",PASS,Nothing to do.\nH03,Switch stock_fn_receive_po (drafts/21),OFF,OFF,PASS,Nothing to do.\n',
  missingFunction: H_HEAD + 'H01,R1-R5 stock functions (drafts/10),6,4 present,FAIL,STOP: send this CSV.\n',
  wrongFingerprint: H_HEAD + 'H01,R1-R5 stock functions (drafts/10),fingerprint 3df2bf7a07b451f12f9359ceca1c85df,fingerprint 0000aaaa,FAIL,STOP: not the reviewed version. Turn every stock switch OFF.\n',
  switchWithoutDependency: H_HEAD + 'H01,R1-R5 stock functions (drafts/10),6,0 present,NOT INSTALLED,Normal before step P2.\nH05,Switch stock_fn_recall (drafts/21),OFF,ON,FAIL,STOP: this switch is ON but its function is missing. Turn it OFF now.\n',
  warning: H_HEAD + 'H11,Integrity rules (drafts/23),4 or 0,2,WARN,Send this CSV.\n',
  unknown: H_HEAD + 'H08,Request keys,columns before switch,?,UNKNOWN,Run again.\n',
  partial: H_HEAD,
};
const BACKUP = {
  healthy: 'nightly green:2026-10-14, restore green:2026-10-01, minutes ok',
  stale: 'nightly green:2026-10-09, restore green:2026-10-01, minutes ok',
  failed: 'nightly red:2026-10-14, restore green:2026-10-01, minutes ok',
  minutesOut: 'nightly green:2026-10-14, restore green:2026-10-01, minutes out',
  vague: 'looked fine I think',
  incomplete: 'nightly green:2026-10-14',
};
const GITHUB = {
  correct: 'account: stasvitiuk-reos\nrole: write\nbackups_repo_visible: no\nbypass: admin-only\n',
  stillAdmin: 'account: StasVitiuk-dev\nrole: admin\nbackups_repo_visible: yes\nbypass: admin-only\n',
  backupsVisible: 'account: stasvitiuk-reos\nrole: write\nbackups_repo_visible: yes\nbypass: admin-only\n',
  bypassAnyone: 'account: stasvitiuk-reos\nrole: write\nbackups_repo_visible: no\nbypass: write roles\n',
  wrongAccount: 'account: someone-else\nrole: write\nbackups_repo_visible: no\nbypass: admin-only\n',
  ambiguous: 'it says write I think\n',
};
const DEVICE = {
  pass: 'device: iPhone Safari\nsha: 32c05e2\ntester: Stas\nhome readable: pass\npo lot box reachable: pass\nsign out: pass\n',
  voiceoverFail: 'device: VoiceOver\nsha: 32c05e2\nsign in: pass\napproval confirm reachable: fail - focus jumps behind the dialog\n',
  noSha: 'device: Chrome\nhome: pass\n',
  unknownDevice: 'device: Android tablet\nsha: 32c05e2\nhome: pass\n',
};
const DECISION = {
  partialWhole: 'decision: partial_returns\nchoice: whole line\ndecided_by: Stas\n',
  partialQty: 'decision: partial_returns\nchoice: partial quantity\ndecided_by: Stas\n',
  partialRevoked: 'decision: partial_returns\nchoice: revoked\ndecided_by: Stas\n',
  lowStockGlobal: 'decision: low_stock_levels\nchoice: global\ndecided_by: Stas\n',
  badChoice: 'decision: week_definition\nchoice: fortnight\ndecided_by: Stas\n',
  noWho: 'decision: week_definition\nchoice: calendar week\n',
  n4ByOwner: 'decision: refund_rule_n4\nchoice: b\ndecided_by: Stas\n',
  n4ByAccountant: 'decision: refund_rule_n4\nchoice: b\ndecided_by: accountant (SYNTHETIC)\n',
};
const AGENT_SOURCE = {
  complete: 'agent: 4\nreads: orders, products\nwrites: daily_reports\nschedule: 3 * * * * (UTC)\nfailure_recorded_as: agent_controls.last_run_status=error\nsecond_run_duplicates: no\n',
  duplicates: 'agent: 6\nreads: customer_inquiries\nwrites: drafts\nschedule: hourly\nfailure_recorded_as: last_error\nsecond_run_duplicates: yes\n',
  withSecret: 'agent: 4\nreads: orders\nwrites: x\nschedule: x\nfailure_recorded_as: x\nsecond_run_duplicates: no\napi_key = sk_live_ABCDEF1234567890\n',
  partial: 'agent: 1\nreads: orders\n',
};
module.exports = { C, D, E, F, G, H, BACKUP, GITHUB, DEVICE, DECISION, AGENT_SOURCE };
