// The owner runs the READ-ONLY query files (docs/ops/sql/0*_READONLY_*.sql)
// by hand in production Supabase. This static check (2026-10-06, EXT3
// workstream 8) proves each one is a single read-only statement: after
// removing comments, quoted text and dollar-quoted text there is exactly
// one ";" (at the end) and no write / schema / permission keyword. For
// Query C it also checks that function source and job command text are only
// ever pattern-matched, never output. Node-only; nothing is run anywhere.

const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const ROOT = path.resolve(__dirname, '..', '..');
const DIR = path.join(ROOT, 'docs', 'ops', 'sql');
const FILES = fs.readdirSync(DIR).filter(f => /^0\d_READONLY_.*\.sql$/.test(f));

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

// Removes -- comments, /* */ comments, '…' literals ('' escapes) and $tag$…$tag$.
function stripSql(sql) {
  let out = '', i = 0;
  while (i < sql.length) {
    const two = sql.slice(i, i + 2);
    if (two === '--') { const j = sql.indexOf('\n', i); i = j === -1 ? sql.length : j; continue; }
    if (two === '/*') { const j = sql.indexOf('*/', i + 2); i = j === -1 ? sql.length : j + 2; continue; }
    if (sql[i] === "'") {
      i++;
      while (i < sql.length) { if (sql[i] === "'" && sql[i + 1] === "'") { i += 2; continue; } if (sql[i] === "'") { i++; break; } i++; }
      out += "''"; continue;
    }
    const dq = sql.slice(i).match(/^\$[A-Za-z_]*\$/);
    if (dq) { const j = sql.indexOf(dq[0], i + dq[0].length); i = j === -1 ? sql.length : j + dq[0].length; out += "''"; continue; }
    out += sql[i++];
  }
  return out;
}

test('there are read-only query files to check (A, B, C, D)', () => {
  expect(FILES.length).toBeGreaterThanOrEqual(4);
});

for (const f of FILES) {
  test(`${f} is one read-only statement`, () => {
    const code = stripSql(fs.readFileSync(path.join(DIR, f), 'utf8'));
    expect(code.split(';').length - 1, 'exactly one statement').toBe(1);
    expect(code.trim().endsWith(';')).toBe(true);
    expect(code.trim()).toMatch(/^(with|select)\b/i);
    const forbidden = /\b(insert|update|delete|merge|upsert|create|alter|drop|truncate|grant|revoke|comment\s+on|copy|vacuum|analyze|cluster|reindex|refresh|lock|call|do|execute|perform|set\s+role|set\s+session|reset|listen|notify|security\s+label|nextval|setval|pg_terminate_backend|pg_cancel_backend|lo_import|lo_export|dblink|pg_read_file|pg_write_file)\b/ig;
    // "select … for update" would also take locks; "update" is already forbidden.
    expect(code.match(forbidden) || [], 'write / schema / permission keywords outside quoted text').toEqual([]);
  });
}

test('control: the checker notices a write hidden after a comment and ignores words in quoted text', () => {
  expect(stripSql("select 'delete from x; drop' as a; -- update\n").split(';').length - 1).toBe(1);
  const bad = stripSql("select 1;\n/* harmless */ delete from products;");
  expect(bad.split(';').length - 1).toBe(2);
  expect(/\bdelete\b/i.test(bad)).toBe(true);
});

test('Query C: function source and job command text are only pattern-matched, never output', () => {
  const sql = fs.readFileSync(path.join(DIR, FILES.find(f => f.startsWith('02_'))), 'utf8');
  const lines = sql.split('\n').filter(l => !/^\s*--/.test(l));
  for (const l of lines.filter(x => /prosrc/.test(x))) {
    // allowed: the column in the fn CTE, and comparisons (~*, ilike) on it
    expect(/~\*|ilike|^\s*select p\.oid, n\.nspname, p\.proname, p\.prosrc, p\.prosecdef,\s*$/.test(l), l).toBe(true);
  }
  for (const l of lines.filter(x => /\bcommand\b/.test(x))) {
    expect(/~\*|substring\(j\.command from '\/functions\/v1\/|select jobid, jobname, schedule, active, command from cron\.job|null::text as command|columns jobid bigint, jobname text, schedule text, active boolean, command text/.test(l), l).toBe(true);
  }
  expect(sql).not.toMatch(/pg_get_functiondef/);
  expect(sql).toMatch(/\[email\]/);
  expect(sql).toMatch(/\[token\]/);
  expect(sql).toMatch(/to_regclass\('cron\.job'\)/); // still runs without pg_cron
});

// EXT4 (workstream AP): the owner guide states the reviewed file's checksum,
// line count and first / last lines. If the file changes, this fails until the
// guide is updated in the same change, so the owner never checks against an
// outdated value.
test('Query C owner guide: checksum, line count and first/last lines match the file', () => {
  const file = fs.readFileSync(path.join(DIR, '02_READONLY_C_agents.sql'), 'utf8');
  const guide = fs.readFileSync(path.join(ROOT, 'docs', 'ops', 'QUERY_C_OWNER_RUN_GUIDE.md'), 'utf8');
  const sha = require('crypto').createHash('sha256').update(file).digest('hex');
  expect(guide).toContain('`' + sha + '`');
  const lines = file.replace(/\n$/, '').split('\n');
  expect(guide).toContain(lines.length + ' lines');
  expect(guide).toContain('`' + lines[0] + '`');
  expect(guide).toContain('`' + lines[lines.length - 1] + '`');
});

// EXT5 (workstream 44): Query D reads function source only to answer yes/no
// questions (pattern matches) and to count lines; it never outputs it.
test('Query D: function source is only pattern-matched or counted, never output', () => {
  const sql = fs.readFileSync(path.join(DIR, FILES.find(f => f.startsWith('03_'))), 'utf8');
  const lines = sql.split('\n').filter(l => !/^\s*--/.test(l));
  const uses = lines.filter(x => /prosrc/.test(x));
  expect(uses.length).toBeGreaterThan(0);
  for (const l of uses) expect(/p\.prosrc ~\*|regexp_split_to_array\(p\.prosrc, E'\\n'\)/.test(l), l).toBe(true);
  expect(sql).not.toMatch(/pg_get_functiondef|pg_get_triggerdef/);
  expect(sql).toMatch(/from pg_proc p/);
});
