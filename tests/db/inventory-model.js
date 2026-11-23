#!/usr/bin/env node
// EXT17: inventory property model for the DRAFT stock functions (drafts/10,
// R1–R5). LOCAL THROWAWAY DATABASE ONLY: it builds its own database from the
// real-shape schema and drafts/10, and refuses anything that looks like
// Supabase.
//
// For each seed it generates a random sequence of what operators do (manual
// adjustments, deliveries with and without lots, receiving an order twice,
// recalls, quarantining twice, deleting products), runs it through the real
// functions one call at a time, and after EVERY call compares every product's
// stock buckets with an independent reference model written from the rules,
// not from the SQL. At the end the data-integrity rules (invariants.sql) must
// all hold. A failing sequence is shrunk (tests/helpers/shrink.js) to the
// smallest sequence that still fails, replayed on a fresh database each time.
//
//   node tests/db/inventory-model.js -h localhost -p 5433 -U postgres [--seeds 1-20] [--ops 60] [--plant] [--draft <file>]
//
// --plant gives the reference model a deliberate wrong rule (a recall reduces
// the lot's remaining count), to prove the harness detects and shrinks a
// disagreement. Exit code: 0 all seeds agree, 1 a disagreement, 2 setup error.
'use strict';
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { shrink, describe } = require('../helpers/shrink');

const ROOT = path.resolve(__dirname, '..', '..');
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); if (i < 0) return dflt; const v = args[i + 1]; args.splice(i, 2); return v; };
const flag = name => { const i = args.indexOf(name); if (i < 0) return false; args.splice(i, 1); return true; };
const seedsArg = opt('--seeds', '1-20');
const N_OPS = Number(opt('--ops', '60'));
const PLANT_FLAG = flag('--plant');
const DRAFT = opt('--draft', path.join(ROOT, 'docs/ops/sql/drafts/10_DRAFT_stock_functions.sql')); // another version, for negative controls
const QUIET = flag('--quiet');
// --selftest: plants the model bug on a few seeds and passes only if a disagreement is
// found and shrunk to at most 6 operations (a harness that cannot fail is useless).
const SELFTEST = flag('--selftest');
const PLANT = PLANT_FLAG || SELFTEST;
const CONN = args;
if (CONN.join(' ').match(/supabase\.co|pooler\.supabase/)) { console.error('Refusing: local or CI database only.'); process.exit(99); }
const DB = 'he_inventory_model';
const psql = (db, sql) => execFileSync('psql', [...CONN, '-d', db, '-qtAX', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const psqlFile = (db, file) => execFileSync('psql', [...CONN, '-d', db, '-qtAX', '-v', 'ON_ERROR_STOP=1', '-f', file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
const P = ['a1700000-0000-4000-8000-000000000001', 'a1700000-0000-4000-8000-000000000002', 'a1700000-0000-4000-8000-000000000003'];
const BUCKETS = ['available', 'damaged', 'sample', 'recalled'];
const uuid = (prefix, n) => prefix + String(n).padStart(12, '0');

// ---------------------------------------------------------------- operations
function genOps(seed, n) {
  const r = rng(seed); const pick = a => a[Math.floor(r() * a.length)];
  return Array.from({ length: n }, () => {
    const kind = pick(['adjust', 'adjust', 'adjust', 'po', 'po', 'rerecv', 'recall', 'requar', 'del']);
    if (kind === 'adjust') return { kind, p: Math.floor(r() * 3), bucket: pick(['available', 'damaged', 'sample']), change: (r() < 0.5 ? -1 : 1) * (1 + Math.floor(r() * 30)) };
    if (kind === 'po') return { kind, p: Math.floor(r() * 3), qty: 1 + Math.floor(r() * 20), lot: r() < 0.6 };
    if (kind === 'del') return { kind, p: Math.floor(r() * 3) };
    return { kind, i: Math.floor(r() * 1000) }; // which earlier order / lot / recall (mod count)
  });
}

// ------------------------------------------------- reference model (independent)
function newModel() {
  return {
    stock: [{ available: 50, damaged: 0, sample: 0, recalled: 0 }, { available: 0, damaged: 0, sample: 0, recalled: 0 }, { available: 0, damaged: 0, sample: 0, recalled: 0 }],
    used: [false, false, false], deleted: [false, false, false],
    pos: [], lots: [], recalls: [],
  };
}
// Applies one operation to the model; returns the expected outcome tag.
function modelStep(m, op) {
  const quarantine = rc => {
    const lot = m.lots[rc.lot]; const s = m.stock[lot.p];
    const amount = Math.min(lot.remaining, s.available);
    if (amount <= 0) return 'err:nothing';
    s.available -= amount; s.recalled += amount; rc.status = 'quarantined';
    if (PLANT) lot.remaining -= amount; // deliberate wrong rule (the real design keeps it)
    return 'quarantined:' + amount;
  };
  if (op.kind === 'adjust') {
    if (m.deleted[op.p]) return 'err:gone';
    const s = m.stock[op.p]; const v = s[op.bucket] + op.change;
    if (v < 0) return 'err:below_zero';
    s[op.bucket] = v; m.used[op.p] = true; return 'ok';
  }
  if (op.kind === 'po') {
    if (m.deleted[op.p]) return 'err:gone';
    const n = m.pos.length; m.pos.push({ p: op.p, qty: op.qty }); m.used[op.p] = true;
    m.stock[op.p].available += op.qty;
    if (op.lot) m.lots.push({ p: op.p, remaining: op.qty, po: n });
    return 'received';
  }
  if (op.kind === 'rerecv') { if (!m.pos.length) return 'skip'; return 'already_received'; }
  if (op.kind === 'recall') {
    if (!m.lots.length) return 'skip';
    const lot = op.i % m.lots.length; const rc = { lot, status: 'initiated' }; m.recalls.push(rc);
    return quarantine(rc);
  }
  if (op.kind === 'requar') {
    if (!m.recalls.length) return 'skip';
    const rc = m.recalls[op.i % m.recalls.length];
    return rc.status === 'initiated' ? quarantine(rc) : 'already_done';
  }
  if (op.kind === 'del') {
    if (m.deleted[op.p]) return 'not_found';
    if (m.used[op.p]) return 'in_use';
    if (BUCKETS.some(b => m.stock[op.p][b] !== 0)) return 'has_stock';
    m.deleted[op.p] = true; return 'deleted';
  }
  throw new Error('unknown op ' + op.kind);
}

// ------------------------------------------------------- database driver
function setupDatabase() {
  psql('postgres', `drop database if exists ${DB}`);
  psql('postgres', `create database ${DB}`);
  psqlFile(DB, path.join(ROOT, 'docs/ops/sql/local-test/01_REAL_SHAPE_schema_for_local_tests.sql'));
  psqlFile(DB, DRAFT);
  // Test-only wrapper: runs one call and returns its JSON result or "ERR:<sqlstate>:<hint>".
  psql(DB, `create or replace function public._model_call(q text) returns text language plpgsql as $f$
    declare r text; begin execute q into r; return coalesce(r, 'null');
    exception when others then declare h text; begin get stacked diagnostics h = pg_exception_hint; return 'ERR:' || sqlstate || ':' || coalesce(h, ''); end; end $f$;`);
}
function resetSql() {
  return `delete from inventory_adjustments; delete from expenses; delete from recalls; delete from inventory_lots; delete from purchase_order_items; delete from purchase_orders; delete from inventory; delete from products; delete from suppliers;
    insert into profiles (id, email, role) values ('00000000-0000-4000-8000-000000000001','model-owner@example.test','owner') on conflict (id) do update set role='owner';
    insert into suppliers (id, name) values ('99999999-0000-4000-8000-0000000017aa','SYNTHETIC model supplier');
    insert into products (id, name, sku) values ('${P[0]}','SYNTHETIC M1','M-1'),('${P[1]}','SYNTHETIC M2','M-2'),('${P[2]}','SYNTHETIC M3','M-3');
    insert into inventory (product_id, available) values ('${P[0]}',50),('${P[1]}',0),('${P[2]}',0);`;
}
// Builds one script for the whole sequence: each call's result, then every product's buckets.
function runOnDatabase(ops) {
  const lines = [resetSql(), "set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);"];
  let nPo = 0, nRc = 0;
  const pad = n => String(n).padStart(4, '0');
  const call = (i, q) => lines.push(`select 'R|${i}|' || _model_call($q$${q}$q$);`);
  // "An earlier order / lot / recall" is picked among the ones that really exist,
  // in creation order, exactly as the model does (a delivery for a deleted
  // product creates nothing; counting it anyway made the two disagree).
  const pickExisting = (i, table, orderBy, fn, k) => lines.push(`select 'R|${i}|' || case when (select count(*) from ${table}) = 0 then 'skip' else _model_call(format($f$select ${fn}(%L)::text$f$, (select id from ${table} order by ${orderBy} offset (${k} % (select count(*) from ${table})) limit 1))) end;`);
  ops.forEach((op, i) => {
    if (op.kind === 'adjust') call(i, `select adjust_inventory('${P[op.p]}', '${op.bucket}', ${op.change}, 'model')::text`);
    else if (op.kind === 'po') {
      const n = nPo++; const po = uuid('b1700000-0000-4000-8000-', n); const line = uuid('d1700000-0000-4000-8000-', n);
      // header and line in ONE statement: a line for a deleted product fails, and so does the order
      lines.push(`select 'L|${i}|' || _model_call($q$ with a as (insert into purchase_orders (id, po_number, status, supplier_id) values ('${po}','MPO-${pad(n)}','shipped','99999999-0000-4000-8000-0000000017aa') returning id), b as (insert into purchase_order_items (id, purchase_order_id, product_id, description, quantity, unit_cost) select '${line}', a.id, '${P[op.p]}','SYNTHETIC line',${op.qty},1 from a returning 1) select count(*)::text from b $q$);`);
      call(i, `select receive_purchase_order('${po}', '${op.lot ? JSON.stringify([{ line_id: line, lot_number: 'MLOT-' + pad(n) }]) : '[]'}'::jsonb)::text`);
    } else if (op.kind === 'rerecv') pickExisting(i, 'purchase_orders', 'po_number', 'receive_purchase_order', op.i);
    else if (op.kind === 'recall') {
      const rid = uuid('c1700000-0000-4000-8000-', nRc++);
      lines.push(`insert into recalls (id, lot_id, product_id, reason, status) select '${rid}', l.id, l.product_id, 'SYNTHETIC model recall', 'initiated' from inventory_lots l order by l.lot_number offset (${op.i} % greatest((select count(*) from inventory_lots), 1)) limit 1;`);
      lines.push(`select 'R|${i}|' || case when not exists (select 1 from recalls where id = '${rid}') then 'skip' else _model_call($q$select quarantine_recall('${rid}')::text$q$) end;`);
    } else if (op.kind === 'requar') pickExisting(i, 'recalls', 'id', 'quarantine_recall', op.i);
    else if (op.kind === 'del') call(i, `select delete_unused_product('${P[op.p]}')::text`);
    lines.push(`select 'S|${i}|' || string_agg(p.id::text || ':' || coalesce(i.available,0) || ',' || coalesce(i.damaged,0) || ',' || coalesce(i.sample,0) || ',' || coalesce(i.recalled,0) || ',' || (i.product_id is not null), ';' order by p.id) from (values ('${P[0]}'::uuid),('${P[1]}'::uuid),('${P[2]}'::uuid)) p(id) left join inventory i on i.product_id = p.id;`);
  });
  lines.push('reset role;');
  const file = path.join(require('os').tmpdir(), 'he-inventory-model-' + process.pid + '.sql');
  fs.writeFileSync(file, lines.join('\n') + '\n');
  try {
    const out = execFileSync('psql', [...CONN, '-d', DB, '-qtAX', '-v', 'ON_ERROR_STOP=1', '-f', file], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const inv = execFileSync('psql', [...CONN, '-d', DB, '-qtAX', '-f', path.join(ROOT, 'docs/ops/sql/local-test/invariants.sql')], { encoding: 'utf8' }).split('\n').filter(Boolean);
    return { out: out.split('\n').filter(Boolean), invariants: inv };
  } finally { fs.rmSync(file, { force: true }); }
}

// Maps a database result to the same outcome tags the model produces.
function outcomeTag(op, res) {
  if (res === 'skip') return 'skip';
  if (res.startsWith('ERR:')) {
    const [, state, hint] = res.split(':');
    if (hint === 'below_zero') return 'err:below_zero';
    if (hint === 'nothing_to_quarantine') return 'err:nothing';
    if (state === 'P0002' || state === '23503') return 'err:gone';
    return 'err:' + state + ':' + hint;
  }
  const j = JSON.parse(res);
  if (op.kind === 'adjust') return 'ok';
  if (op.kind === 'po' || op.kind === 'rerecv') return j.already_received ? 'already_received' : 'received';
  if (op.kind === 'recall' || op.kind === 'requar') return j.already_done ? 'already_done' : 'quarantined:' + j.quantity_quarantined;
  if (op.kind === 'del') return j.deleted ? 'deleted' : j.reason;
  return 'unknown';
}

// Runs a sequence; returns null when database and model agree everywhere, else the first disagreement.
function check(ops) {
  const m = newModel();
  const { out, invariants } = runOnDatabase(ops.map(o => Object.assign({}, o)));
  const R = {}, S = {};
  for (const line of out) { const [t, i, ...rest] = line.split('|'); const v = rest.join('|'); if (t === 'R') R[i] = v; else if (t === 'S') S[i] = v; }
  for (let i = 0; i < ops.length; i++) {
    const want = modelStep(m, ops[i]);
    const got = outcomeTag(ops[i], R[i] === undefined ? 'MISSING' : R[i]);
    if (got !== want) return { step: i, message: `op ${i} ${JSON.stringify(ops[i])}: database ${got}, model ${want}` };
    const rows = (S[i] || '').split(';').map(x => x.split(':')[1].split(','));
    for (let p = 0; p < 3; p++) {
      if (m.deleted[p]) { if (rows[p][4] !== 'false') return { step: i, message: `op ${i}: product ${p + 1} deleted in the model but its stock row remains` }; continue; }
      const dbv = rows[p].slice(0, 4).map(Number), mv = BUCKETS.map(b => m.stock[p][b]);
      if (dbv.join() !== mv.join()) return { step: i, message: `op ${i} ${JSON.stringify(ops[i])}: product ${p + 1} buckets database ${dbv.join('/')}, model ${mv.join('/')}` };
    }
  }
  if (invariants.length) return { step: ops.length - 1, message: 'data-integrity rule broken: ' + invariants[0] };
  return null;
}

// --------------------------------------------------------------------- main
(async function main() {
  const [lo, hi] = seedsArg.split('-').map(Number);
  try { setupDatabase(); } catch (e) { console.error('setup failed: ' + String(e.stderr || e.message).split('\n')[0]); process.exit(2); }
  const t0 = Date.now(); let failures = 0, opsRun = 0, smallest = Infinity;
  for (let seed = lo; seed <= (hi || lo); seed++) {
    const ops = genOps(17000 + seed, N_OPS); opsRun += ops.length;
    const fail = check(ops);
    if (!fail) { if (!QUIET) console.log(`ok   seed ${seed}: ${ops.length} operations agree with the model`); continue; }
    failures++;
    const small = await shrink(ops.slice(0, fail.step + 1), async cand => !!check(cand), { maxRuns: 200, maxMs: 120000 });
    const again = check(small.ops);
    smallest = Math.min(smallest, small.ops.length);
    console.log(`FAIL seed ${seed}: ${fail.message}\n     smallest failing sequence (${small.ops.length} of ${fail.step + 1} operations, ${small.runs} replays${small.complete ? '' : ', budget reached'}): ${describe(small.ops)}\n     ${again ? again.message : '(did not reproduce on replay)'}`);
  }
  console.log(`inventory model: ${(hi || lo) - lo + 1} seeds, ${opsRun} operations, ${failures} disagreement(s), ${Math.round((Date.now() - t0) / 1000)} s${PLANT ? ' (PLANTED model bug)' : ''}`);
  if (SELFTEST) { const ok = failures > 0 && smallest <= 6; console.log(ok ? `self-test OK: planted bug found and shrunk to ${smallest} operations` : 'self-test FAILED: the planted model bug was not detected or not shrunk'); process.exit(ok ? 0 : 1); }
  process.exit(failures ? 1 : 0);
})();
