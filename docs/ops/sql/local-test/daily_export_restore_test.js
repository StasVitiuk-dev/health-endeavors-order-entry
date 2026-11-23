#!/usr/bin/env node
// LOCAL TEST ONLY (2026-11-16). Never point this at Supabase.
// A daily export across the Chicago day cutoff, restored into a disposable
// database. Uses the dashboard's own code (he-report-export.js for the package,
// he-report-schedule.js for the Central business day) and a brand-new, empty
// Postgres database that is dropped at the end. Proves:
//   * orders at 11:30 pm and 12:30 am Central land on the right Central days,
//     also on the night daylight saving starts and the night it ends;
//   * the export package opens, is restored into the empty database, and the
//     rows read back from the database reproduce the package's checksum exactly
//     (a figure that was never measured comes back as UNKNOWN, never 0);
//   * a tampered package is refused before anything is written;
//   * restoring the same package twice adds nothing.
// All data is made up. Usage: node daily_export_restore_test.js -h /var/tmp/hepg -p 5499 -U postgres
'use strict';
const { execFileSync } = require('child_process');
const X = require('../../../../assets/reports/he-report-export.js');
const SCH = require('../../../../assets/reports/he-report-schedule.js');

const CONN = process.argv.slice(2);
const DB = 'he_daily_export_restore_test';
let pass = 0, fail = 0;
const ok = (name, got, want) => { const g = JSON.stringify(got), w = JSON.stringify(want); if (g === w) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + ': expected ' + w + ', got ' + g); } };
const psql = (sql, db) => execFileSync('psql', CONN.concat(['-d', db || DB, '-qtAX', '-v', 'ON_ERROR_STOP=1', '-c', sql]), { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const lit = (v) => v == null ? 'null' : "'" + String(v).replace(/'/g, "''") + "'";
const central = (at) => SCH.businessDateTZ(at, 'America/Chicago');

console.log('Daily export across the Chicago cutoff, restored into a disposable database (' + DB + ')');

// ---- 1. the cutoff ------------------------------------------------------
// Instants written in UTC; the comment says what the clock in Chicago showed.
const events = [
  { type: 'order', at: '2026-11-15T17:10:00Z', amount: 40 },   // Sun 15 Nov, 11:10 am CST
  { type: 'order', at: '2026-11-16T05:30:00Z', amount: 25 },   // Sun 15 Nov, 11:30 pm CST  -> the 15th (UTC says the 16th)
  { type: 'order', at: '2026-11-16T06:30:00Z', amount: 30 },   // Mon 16 Nov, 12:30 am CST  -> the 16th
  { type: 'order', at: '2026-11-16T20:00:00Z', amount: null }, // Mon 16 Nov, 2 pm CST, amount never recorded -> revenue UNKNOWN that day
  { type: 'order', at: '2026-03-09T04:30:00Z', amount: 18 },   // Sun 8 Mar 2026, 11:30 pm CDT (daylight saving began that morning) -> the 8th
  { type: 'order', at: '2026-11-02T05:30:00Z', amount: 22 },   // Sun 1 Nov 2026, 11:30 pm CST (daylight saving ended that morning) -> the 1st
];
ok('11:30 pm Central on Nov 15 is the 15th (UTC would say the 16th)', central(events[1].at), '2026-11-15');
ok('12:30 am Central on Nov 16 is the 16th', central(events[2].at), '2026-11-16');
ok('the night daylight saving starts: 11:30 pm is still that day', central(events[4].at), '2026-03-08');
ok('the night daylight saving ends: 11:30 pm is still that day', central(events[5].at), '2026-11-01');
const daily = X.summarizeLedger(events, { dayOf: central });
const byDay = Object.fromEntries(daily.map(r => [r.report_date, r]));
ok('daily rows by Central day', daily.map(r => r.report_date + ':' + r.orders_count), ['2026-03-08:1', '2026-11-01:1', '2026-11-15:2', '2026-11-16:2']);
ok('  the 15th holds the late-evening order: $65.00', byDay['2026-11-15'].revenue, 65);
ok('  the 16th has an order with no amount: revenue UNKNOWN, not $30', byDay['2026-11-16'].revenue, 'UNKNOWN');
const utc = X.summarizeLedger(events, { offsetHours: 0 });
ok('control: counted by the UTC day the same orders split differently (so the check can fail)', utc.map(r => r.report_date + ':' + r.orders_count).join(','), '2026-03-09:1,2026-11-02:1,2026-11-15:1,2026-11-16:3');

// ---- 2. the export package ------------------------------------------------
const history = daily.map(r => ({ report_date: r.report_date, currency: r.currency, orders_count: r.orders_count, revenue: r.revenue === 'UNKNOWN' ? null : r.revenue }));
const m = X.buildManifest({ history, from: '2026-03-01', to: '2026-11-30', now: '2026-11-17T06:05:00Z' });
const pkg = X.packageOf(m);
ok('the export package covers 4 days and opens cleanly', [m.rowCount, X.openPackage(pkg).ok], [4, true]);

// ---- 3. restore into a disposable database ---------------------------------
const METRICS = ['orders_count', 'revenue', 'new_inquiries_count', 'tasks_opened_count', 'incidents_opened_count', 'ai_calls_count', 'ai_cost'];
function freshDb() {
  psql('drop database if exists ' + DB + ' with (force)', 'postgres');
  psql('create database ' + DB + ' template template0', 'postgres');   // empty: no business tables at all
  psql('create table daily_reports_restored (report_date date primary key, currency text not null, emailed boolean not null default false, ' +
    METRICS.map(c => c + ' numeric').join(', ') + ')');
}
// The restore: open (checks schema, files, checksum) BEFORE writing; then one
// transaction; a day already present is left alone (restoring twice adds nothing).
function restore(p) {
  const opened = X.openPackage(p);
  if (!opened.ok) return opened;
  const rows = p.payload.reports;
  const values = rows.map(r => '(' + [lit(r.report_date), lit(r.currency), r.emailed ? 'true' : 'false']
    .concat(METRICS.map(c => r[c] === 'UNKNOWN' || r[c] == null ? 'null' : String(Number(r[c])))).join(',') + ')').join(',');
  const added = psql('with ins as (insert into daily_reports_restored (report_date, currency, emailed, ' + METRICS.join(', ') + ') values ' + values +
    ' on conflict (report_date) do nothing returning 1) select count(*) from ins');
  return { ok: true, added: Number(added) };
}
function readBack() {
  const json = psql("select coalesce(json_agg(t order by report_date), '[]') from (select report_date::text, currency, emailed, " + METRICS.join(', ') + ' from daily_reports_restored) t');
  return JSON.parse(json).map(r => { const o = { report_date: r.report_date, currency: r.currency }; METRICS.forEach(c => { o[c] = r[c] == null ? 'UNKNOWN' : Number(r[c]); }); o.emailed = r.emailed; return o; });
}
freshDb();
ok('the disposable database starts empty', psql('select count(*) from daily_reports_restored'), '0');
const r1 = restore(pkg);
ok('restore: 4 days written', [r1.ok, r1.added], [true, 4]);
const back = readBack();
ok('the rows read back from the database reproduce the package checksum exactly', X.verifyManifest(m, back).ok, true);
ok('  the unmeasured revenue came back as UNKNOWN, not 0', back.find(r => r.report_date === '2026-11-16').revenue, 'UNKNOWN');
ok('  the late-evening day came back with its 2 orders and $65.00', [back.find(r => r.report_date === '2026-11-15').orders_count, back.find(r => r.report_date === '2026-11-15').revenue], [2, 65]);
const r2 = restore(pkg);
ok('restoring the same package again adds nothing', [r2.ok, r2.added, psql('select count(*) from daily_reports_restored')], [true, 0, '4']);

// ---- 4. a tampered package is refused before anything is written -----------
freshDb();
const bad = JSON.parse(JSON.stringify(pkg));
bad.payload.reports[2].orders_count = 3;
const rb = restore(bad);
ok('a package changed after export is refused (checksum)', [rb.ok, rb.stage, rb.applied], [false, 'checksum', false]);
ok('  and nothing was written', psql('select count(*) from daily_reports_restored'), '0');
const newer = Object.assign({}, pkg, { schemaVersion: 99 });
ok('a package from a newer version is refused up front', [restore(newer).ok, restore(newer).stage], [false, 'schema']);
ok('  and nothing was written', psql('select count(*) from daily_reports_restored'), '0');

psql('drop database if exists ' + DB + ' with (force)', 'postgres');
ok('the disposable database was dropped', psql("select count(*) from pg_database where datname = '" + DB + "'", 'postgres'), '0');
console.log('passed ' + pass + ', failed ' + fail);
process.exit(fail ? 1 : 0);
