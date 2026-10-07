// Write-path extractor (2026-10-06, extension 4, workstream A).
//
// Finds every place the pages can change data: database insert / update /
// upsert / delete, guarded updates (updateIfUnchanged), mutating RPCs,
// storage upload / remove, and sign-in-system writes. For each it records
// the page, enclosing function / handler, table, operation and the guards
// visible in the code around it. Used by:
//   * tests/specs/write-path-inventory.spec.js (every path must be classified
//     in docs/ops/write-paths.classification.json; state changes must carry
//     a stale-tab condition or a written justification)
//   * node tests/tools/write-paths.js --md  → docs/ops/WRITE_PATH_MATRIX.md
// Static analysis: it reads the source text; nothing is executed.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PAGES = ['owner-login.html', 'manual-order-entry.html', 'index.html', 'dashboard.html', 'search.html', 'change-password.html'];
const MUTATING_RPCS = new Set(['log_customer_data_access', 'revoke_my_session']);
// Workflow-state columns (kept in step with STATE_COLUMNS in tests/helpers/mock-supabase.js)
const STATE_COLUMNS = {
  tasks: ['status'], purchase_orders: ['status', 'payment_status'], returns: ['status'], recalls: ['status'],
  approval_requests: ['status'], feature_requests: ['status', 'deleted_at'], legal_holds: ['status'], quality_checks: ['result', 'resolution'],
  incidents: ['status'], customer_inquiries: ['status', 'severity'], service_status: ['status'], system_mode: ['mode'],
  feature_flags: ['enabled'], agent_controls: ['enabled'], business_rules: ['is_active', 'config'], sop_documents: ['agent_visible'],
  products: ['status', 'is_active'], orders: ['status', 'deleted_at'], expenses: ['deleted_at', 'receipt_path'],
  adverse_event_reports: ['fda_reported'],
};

function lineOf(src, idx) { return src.slice(0, idx).split('\n').length; }

// Block structure of a source file: for every "{", its matching "}",
// skipping strings, template text and comments (approximate but adequate).
function braceMap(src) {
  const match = new Map(), stack = [];
  let i = 0;
  const tpl = []; // template-literal nesting: brace depth at which a ${ opened
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (c === '/' && n === '/') { i = src.indexOf('\n', i); if (i < 0) break; continue; }
    if (c === '/' && n === '*') { i = src.indexOf('*/', i + 2) + 2; if (i < 2) break; continue; }
    if (c === "'" || c === '"') { const q = c; i++; while (i < src.length && src[i] !== q && src[i] !== '\n') { if (src[i] === '\\') i++; i++; } i++; continue; }
    if (c === '`') {
      i++;
      while (i < src.length && src[i] !== '`') {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === '$' && src[i + 1] === '{') { tpl.push(stack.length); stack.push(-1); i += 2; break; }
        i++;
      }
      if (src[i] === '`') i++;
      continue;
    }
    if (c === '{') stack.push(i);
    else if (c === '}') {
      const open = stack.pop();
      if (open === -1) { tpl.pop(); // end of ${...}: continue the template literal
        i++;
        while (i < src.length && src[i] !== '`') {
          if (src[i] === '\\') { i += 2; continue; }
          if (src[i] === '$' && src[i + 1] === '{') { tpl.push(stack.length); stack.push(-1); i += 2; break; }
          i++;
        }
        if (src[i] === '`') i++;
        continue;
      }
      if (open !== undefined) match.set(open, i);
    }
    i++;
  }
  return match;
}

const CTX_CACHE = new Map();
function contexts(src) {
  if (CTX_CACHE.has(src)) return CTX_CACHE.get(src);
  const braces = braceMap(src);
  const list = [];
  const add = (name, from) => {
    // the body must start right here: an expression-bodied arrow
    // (x => doThing()) has no block of its own
    let open = from;
    while (open < src.length && /\s/.test(src[open])) open++;
    if (src[open] !== '{' || !braces.has(open)) return;
    list.push({ name, open, close: braces.get(open) });
  };
  let m;
  const fnRe = /(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*/g;
  while ((m = fnRe.exec(src))) add(m[1], m.index + m[0].length);
  const evRe = /([A-Za-z_$][\w$]*)?(\))?\.addEventListener\(\s*'(click|submit|change|input|keydown)'\s*,\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*/g;
  const GENERIC = new Set(['btn', 'el', 'cb', 'row', 'link', 'b', 'item', 'input', 'select', 'box', 'e', 'x', 'n']);
  while ((m = evRe.exec(src))) {
    let sel;
    if (m[1] && !GENERIC.has(m[1]) && !m[2]) sel = m[1]; // e.g. orderForm.addEventListener
    else {
      const back = src.slice(Math.max(0, m.index - 500), m.index + 1);
      const sels = [...back.matchAll(/(?:querySelectorAll|querySelector|getElementById)\(\s*'([^']+)'\s*\)/g)];
      sel = sels.length ? sels[sels.length - 1][1] : (m[1] || '?');
    }
    add(`${m[3]} ${sel}`, m.index + m[0].length);
  }
  CTX_CACHE.set(src, list);
  return list;
}

// Innermost named function or event handler that contains idx.
function contextOf(src, idx) {
  let best = null;
  for (const c of contexts(src)) if (c.open < idx && idx < c.close && (!best || c.open > best.open)) best = c;
  return best ? best.name : '(top level)';
}

function statementAround(src, idx) {
  // from the start of the call chain (the nearest preceding "await" or line
  // start with supabase/sb) to the end of the statement
  let start = src.lastIndexOf('await ', idx);
  const ls = src.lastIndexOf('\n', idx);
  if (start < ls - 400 || start === -1) start = ls;
  let depth = 0, i = idx;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '(' || c === '{' || c === '[') depth++;
    else if (c === ')' || c === '}' || c === ']') depth--;
    else if (c === ';' && depth <= 0) break;
  }
  return src.slice(start, i + 1);
}

function tableFor(src, idx, stmt) {
  const own = /\.from\(\s*'([a-z_]+)'\s*\)/.exec(stmt);
  if (own) return own[1];
  const back = src.slice(Math.max(0, idx - 600), idx);
  const all = [...back.matchAll(/\.from\(\s*'([a-z_]+)'\s*\)/g)];
  return all.length ? all[all.length - 1][1] : '?';
}

function innermost(src, idx) {
  let best = null;
  for (const c of contexts(src)) if (c.open < idx && idx < c.close && (!best || c.open > best.open)) best = c;
  return best;
}

function guardsFor(src, idx, stmt, op, table, ctxStart) {
  // everything earlier in the same handler / function (or the last 3,000
  // characters at top level)
  const c = innermost(src, idx);
  const handler = c ? src.slice(c.open, idx) : src.slice(Math.max(0, idx - 3000), idx);
  const near = handler;
  // a query built in a variable and finished later (let q = …delete()…; q = q.eq(…); await q.select('id'))
  // (EXT5: the declaration may be a few lines up in the same statement:
  //  let q = supabase.from('t')\n  .update(…)\n  .eq(…);)
  const v = /^\s*(?:await\s+)?(?:let|const|var)?\s*([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?supabase/.exec(src.slice(src.lastIndexOf('\n', idx) + 1, idx + 5))
    || /(?:let|const|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?supabase[^;]*$/.exec(src.slice(Math.max(0, idx - 300), idx));
  if (v) {
    const ahead = src.slice(idx, idx + 700);
    const more = ahead.match(new RegExp('\\b' + v[1] + '\\b[^;]*;', 'g')) || [];
    stmt = stmt + more.join(' ');
  }
  const conds = [...stmt.matchAll(/\.(eq|neq|in|is|not|gte|lte|ilike)\(\s*'([a-z_]+)'/g)].map(x => x[1] + ':' + x[2]);
  const nonKey = conds.filter(c => !/:(id|product_id|agent_num|flag_key|order_id|event_uid)$/.test(c) || /^(in|is|not)/.test(c));
  return {
    staleCondition: op === 'updateIfUnchanged' ? !/,\s*\{\s*\}\s*\)/.test(stmt) : nonKey.length > 0,
    readBack: op === 'updateIfUnchanged' || /\.select\(/.test(stmt),
    doubleClickLock: /(disabled\s*=\s*true|dataset\.(saving|armed)|inFlight|savingNow|activeReauthClose)/.test(near),
    confirmation: /(requireReauth\(|confirmSecondPress\(|window\.confirm\(|\bconfirm\(|dataset\.armed)/.test(handler),
    rolePrecheck: /canChangeStock\(\)/.test(near),
    conditions: conds,
  };
}

function extract(file) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const out = [];
  const patterns = [
    { re: /updateIfUnchanged\(\s*'([a-z_]+)'/g, op: 'updateIfUnchanged' },
    { re: /\.(insert|update|upsert|delete)\(/g, op: null },
    { re: /\.rpc\(\s*'([a-z_]+)'/g, op: 'rpc' },
    { re: /\.storage\.from\(\s*'([a-z-]+)'\s*\)\s*\.(upload|remove)\(/g, op: 'storage' },
    { re: /\.auth\.(updateUser|resetPasswordForEmail|signOut)\(/g, op: 'auth' },
  ];
  for (const p of patterns) {
    let m;
    while ((m = p.re.exec(src))) {
      const idx = m.index;
      if (/function\s+updateIfUnchanged/.test(src.slice(Math.max(0, idx - 15), idx + 20))) continue; // the helper's own definition
      let op = p.op, table;
      const stmt = statementAround(src, idx);
      if (op === 'updateIfUnchanged') table = m[1];
      else if (op === 'rpc') { if (!MUTATING_RPCS.has(m[1])) continue; table = 'rpc:' + m[1]; }
      else if (op === 'storage') { table = 'storage:' + m[1]; op = 'storage.' + m[2]; }
      else if (op === 'auth') { table = 'auth'; op = 'auth.' + m[1]; }
      else {
        op = m[1];
        // skip non-Supabase calls (e.g. Map.delete, Set.delete)
        if (!/(supabase|sb|verifyOnly|\bq\b|delQ|delInv|\)\s*\n?\s*)\s*[\s\S]{0,400}$/.test(src.slice(Math.max(0, idx - 400), idx)) && !/\.from\(/.test(src.slice(Math.max(0, idx - 600), idx))) continue;
        if (!/\.from\(\s*'/.test(src.slice(Math.max(0, idx - 600), idx)) && !/delQ|delInv/.test(stmt)) continue;
        table = tableFor(src, idx, stmt);
      }
      const ctx = contextOf(src, idx);
      const ctxStart = Math.max(0, idx - 12000);
      const g = guardsFor(src, idx, stmt, op, table, ctxStart);
      const body = /\.(update|insert|upsert)\(\s*\{([\s\S]*?)\}\s*[,)]/.exec(stmt) || (op === 'updateIfUnchanged' ? /,\s*\{([\s\S]*?)\}/.exec(stmt.slice(stmt.indexOf(',') + 1)) : null);
      const bodyText = body ? (body[2] || body[1] || '') : '';
      const writesState = (STATE_COLUMNS[table] || []).some(c => new RegExp('\\b' + c + '\\s*:').test(bodyText)) || (op === 'delete');
      out.push({ file, line: lineOf(src, idx), context: ctx, table, op, writesState, ...g });
    }
  }
  out.sort((a, b) => a.line - b.line);
  // stable keys: file | context | table | op | n-th occurrence in that context
  const seen = {};
  for (const r of out) {
    const base = `${r.file}|${r.context}|${r.table}|${r.op}`;
    seen[base] = (seen[base] || 0) + 1;
    r.key = `${base}|${seen[base]}`;
  }
  return out;
}

function all() { return PAGES.filter(f => fs.existsSync(path.join(ROOT, f))).flatMap(extract); }

function markdown(rows, classes) {
  const yn = b => (b ? '✓' : '—');
  const lines = [];
  lines.push('# Write-path matrix (generated)');
  lines.push('');
  lines.push('**Status:** CURRENT, generated by `node tests/tools/write-paths.js --md` from the page source plus `docs/ops/write-paths.classification.json` (hand-checked fields). Branch work, not live. `tests/specs/write-path-inventory.spec.js` fails if a write path is added, removed or loses a guard without this classification being updated.');
  lines.push('');
  lines.push(`**${rows.length} write paths**: ${rows.filter(r => r.file === 'owner-login.html').length} in the owner dashboard, ${rows.filter(r => r.file !== 'owner-login.html').length} on other pages (index.html is an identical copy of manual-order-entry.html).`);
  lines.push('');
  lines.push('Columns: **Stale** = conditional on the value the page showed (stale-tab / optimistic concurrency). **Read-back** = the write asks for the changed rows back, so a silent refusal (0 rows) is noticed. **Lock** = the button or form is disabled while saving (double click). **Confirm** = second press / password / confirm dialog. **Role** = page-side role pre-check (the database enforces roles in every case). Hand-checked columns come from the classification file.');
  lines.push('');
  lines.push('| # | Page:line | Where (handler / function) | Table | Op | State change | Stale | Read-back | Lock | Confirm | Role | Idempotent / retry | Audit | Partial-failure risk | Sensitive | Note |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  rows.forEach((r, i) => {
    const c = classes[r.key] || {};
    lines.push(`| ${i + 1} | ${r.file.replace('.html', '')}:${r.line} | ${r.context} | ${r.table} | ${r.op} | ${yn(r.writesState)} | ${yn(r.staleCondition)} | ${yn(r.readBack)} | ${yn(r.doubleClickLock)} | ${yn(r.confirmation)} | ${yn(r.rolePrecheck)} | ${c.idempotency || '?'} | ${c.audit || '?'} | ${c.partial || '?'} | ${c.sensitive || '?'} | ${(c.note || '').replace(/\|/g, '/')} |`);
  });
  return lines.join('\n') + '\n';
}

// EXT7 (workstream C): the retry class of each path, from its hand-checked
// idempotency text plus what the database itself guarantees.
//   SAFE ALREADY                 a repeat changes nothing (condition, same value,
//                                upsert, or a unique key refuses a second row)
//   CLIENT-SIDE MITIGATION ONLY  the page recognises the attempt; another device
//                                or a cleared tab could still duplicate
//   DATABASE REQUEST KEY NEEDED  a repeat creates a second record; fixed by
//                                docs/ops/sql/drafts/19_DRAFT_request_keys.sql
//                                (OWNER APPROVAL REQUIRED) + a dashboard change
//   UNRESOLVED                   none of the above
const REQUEST_KEY_TABLES = new Set(['expenses', 'inventory_adjustments', 'inventory_lots', 'returns', 'recalls',
  'products', 'suppliers', 'documents', 'evidence_locker', 'adverse_event_reports', 'legal_holds', 'quality_checks',
  'incidents', 'sop_documents', 'feature_requests', 'manual_attention_items', 'personal_calendar_events', 'tasks',
  'orders', 'order_items', 'purchase_orders', 'purchase_order_items']);
// Unique keys that already refuse a second identical create (Query A shape).
const UNIQUE_CREATE_KEYS = { inventory: 'UNIQUE (product_id)' };
function retryClass(row, cls) {
  const idem = String((cls && cls.idempotency) || '');
  if (/^(guarded|repeat harmless|upsert)/.test(idem)) return { retryClass: 'SAFE ALREADY', why: idem };
  if (UNIQUE_CREATE_KEYS[row.table]) return { retryClass: 'SAFE ALREADY', why: 'database ' + UNIQUE_CREATE_KEYS[row.table] + ' refuses a second row' };
  if (/^retry-safe/.test(idem)) return { retryClass: 'CLIENT-SIDE MITIGATION ONLY', why: idem + '; a request key (draft 19) would make it hold across devices' };
  if (/^not idempotent/.test(idem) && REQUEST_KEY_TABLES.has(row.table)) return { retryClass: 'DATABASE REQUEST KEY NEEDED', why: idem + '; draft 19 covers ' + row.table };
  return { retryClass: 'UNRESOLVED', why: idem || 'not classified' };
}

function inventoryJson(rows, classes) {
  const items = rows.map((r, i) => {
    const c = classes[r.key] || {};
    return { n: i + 1, key: r.key, page: r.file, line: r.line, where: r.context, table: r.table, op: r.op,
      writesState: r.writesState, staleCondition: r.staleCondition, readBack: r.readBack, doubleClickLock: r.doubleClickLock,
      confirmation: r.confirmation, rolePrecheck: r.rolePrecheck, idempotency: c.idempotency || null, audit: c.audit || null,
      partialFailure: c.partial || null, sensitive: c.sensitive || null, ...retryClass(r, c) };
  });
  const totals = {};
  for (const it of items) totals[it.retryClass] = (totals[it.retryClass] || 0) + 1;
  return { generatedBy: 'node tests/tools/write-paths.js --json', status: 'CURRENT (branch work, not live)', paths: items.length, retryClassTotals: totals, items };
}

module.exports = { extract, all, markdown, inventoryJson, retryClass, STATE_COLUMNS, PAGES };

if (require.main === module) {
  const rows = all();
  const classPath = path.join(ROOT, 'docs', 'ops', 'write-paths.classification.json');
  const classes = fs.existsSync(classPath) ? JSON.parse(fs.readFileSync(classPath, 'utf8')) : {};
  if (process.argv.includes('--json')) {
    const inv = inventoryJson(rows, classes);
    fs.writeFileSync(path.join(ROOT, 'docs', 'ops', 'MUTATION_WRITE_PATH_INVENTORY.json'), JSON.stringify(inv, null, 1) + '\n');
    console.log('wrote docs/ops/MUTATION_WRITE_PATH_INVENTORY.json', JSON.stringify(inv.retryClassTotals));
  } else if (process.argv.includes('--md')) {
    fs.writeFileSync(path.join(ROOT, 'docs', 'ops', 'WRITE_PATH_MATRIX.md'), markdown(rows, classes));
    console.log('wrote docs/ops/WRITE_PATH_MATRIX.md with', rows.length, 'paths');
  } else {
    for (const r of rows) console.log([r.key, r.line, r.writesState ? 'STATE' : '', r.staleCondition ? 'stale' : '', r.readBack ? 'rb' : '', r.doubleClickLock ? 'lock' : '', r.confirmation ? 'conf' : '', r.rolePrecheck ? 'role' : ''].join(' \t'));
    console.log(rows.length, 'paths');
  }
}
