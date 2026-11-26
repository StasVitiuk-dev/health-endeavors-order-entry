// Backup status on Home (owner, Nov 24: "a warning on Home when the newest backup is older
// than a day"; design D5). The backup jobs write one line per run into backup_reports
// (docs/ops/sql/drafts/70, not installed); behind the preview switch he_backup_status, the
// backups line of Home's checks says what they reported. assets/reports/he-backup-status.js.
// Every value is made up; the database is the mock.
const fs = require('fs');
const path = require('path');
const B = require('../../assets/reports/he-backup-status.js');
const { test, expect, login } = require('../helpers/dashboard');

const node = (ti) => test.skip(ti.project.name !== 'desktop', 'Node-only; run once');
const NOW = Date.parse('2026-11-26T15:00:00Z');
const H = 3600000, D = 24 * H;
const at = (msAgo) => new Date(NOW - msAgo).toISOString();
const line = (kind, msAgo, ok) => ({ kind: kind, finished_at: at(msAgo), ok: ok });

test.describe('the rules (no browser)', () => {
  test('last night succeeded and a recent restore test: all good, said plainly', ({}, ti) => {
    node(ti);
    const r = B.judge([line('nightly_backup', 5 * H, true), line('nightly_backup', 29 * H, true), line('restore_test', 10 * D, true)], NOW);
    expect([r.state, r.level, r.title]).toEqual(['ok', 'info', 'Backups: last night\'s backup succeeded']);
    expect(r.why).toBe('The nightly backup succeeded 5 hours ago. The last restore test succeeded 10 days ago.');
  });

  test('older than a day (26 hours, with slack for a late start) is urgent; the exact age is shown', ({}, ti) => {
    node(ti);
    expect(B.judge([line('nightly_backup', 25 * H, true), line('restore_test', D, true)], NOW).state).toBe('ok');
    const old = B.judge([line('nightly_backup', 27 * H, true), line('restore_test', D, true)], NOW);
    expect([old.state, old.level, old.title]).toEqual(['stale', 'critical', 'Backups: the newest backup is older than a day']);
    expect(old.why).toContain('succeeded 27 hours ago');
    expect(B.judge([line('nightly_backup', 4 * D, true)], NOW).why).toContain('succeeded 4 days ago');
  });

  test('the newest backup failed: urgent, even when an older one succeeded', ({}, ti) => {
    node(ti);
    const r = B.judge([line('nightly_backup', 2 * H, false), line('nightly_backup', 26 * H, true), line('restore_test', D, true)], NOW);
    expect([r.state, r.level, r.title]).toEqual(['failed', 'critical', 'Backups: the last nightly backup FAILED']);
    expect(r.why).toContain('reported a failure 2 hours ago');
    expect(r.action).toContain('never paste logs');
    // the newest is the one that counts: a success after a failure is fine again
    expect(B.judge([line('nightly_backup', 26 * H, false), line('nightly_backup', 2 * H, true), line('restore_test', D, true)], NOW).state).toBe('ok');
  });

  test('the restore test: failed, overdue or never reported needs a look (the backups themselves are fine)', ({}, ti) => {
    node(ti);
    const fresh = line('nightly_backup', 3 * H, true);
    const failed = B.judge([fresh, line('restore_test', 3 * D, false)], NOW);
    expect([failed.state, failed.level, failed.title]).toEqual(['restore', 'action', 'Backups: the restore test needs a look']);
    expect(failed.why).toContain('The last restore test FAILED (3 days ago).');
    expect(B.judge([fresh, line('restore_test', 36 * D, true)], NOW).why).toContain('succeeded, but 36 days ago (more than a month)');
    expect(B.judge([fresh, line('restore_test', 34 * D, true)], NOW).state).toBe('ok');
    expect(B.judge([fresh], NOW).why).toContain('No monthly restore test has reported yet.');
    expect(B.judge([fresh], NOW).state).toBe('restore');
  });

  test('nothing reported yet, or the reports could not be read: never "all good"', ({}, ti) => {
    node(ti);
    const none = B.judge([], NOW);
    expect([none.state, none.level, none.title]).toEqual(['none', 'action', 'Backups: no backup has reported yet']);
    const only = B.judge([line('restore_test', D, true)], NOW);
    expect(only.state).toBe('none');
    for (const bad of [null, undefined, 'x', 7, {}]) {
      const r = B.judge(bad, NOW);
      expect([r.state, r.level, r.title]).toEqual(['unknown', 'unknown', 'Backups: could not check']);
    }
    // lines that make no sense are ignored, never taken for a success
    const junk = B.judge([null, 'x', { kind: 'nightly_backup', finished_at: 'not a date', ok: true }, { kind: 'nightly_backup', finished_at: at(H), ok: 'yes' },
      { kind: 'weekly', finished_at: at(H), ok: true }], NOW);
    expect(junk.state).toBe('none');
    // a time in the future (a wrong clock) does not make an old backup look fresh forever: it is simply the newest
    expect(() => B.judge([line('nightly_backup', -5 * H, true)], 1e300)).not.toThrow();
    expect(B.ago(NOW - 10 * 60000, NOW)).toBe('less than an hour ago');
    expect(B.ago(NOW - H, NOW)).toBe('1 hour ago');
  });

  test('not installed yet: the same honest "not verified here" line as before', ({}, ti) => {
    node(ti);
    const n = B.notInstalled();
    expect([n.level, n.title]).toEqual(['info', 'Backups: not verified here']);
    expect(n.why).toContain('step 19');
    expect(B.isMissingTable({ code: 'PGRST205', message: 'Could not find the table public.backup_reports in the schema cache' })).toBe(true);
    expect(B.isMissingTable({ code: '42P01', message: 'relation "public.backup_reports" does not exist' })).toBe(true);
    expect(B.isMissingTable({ code: '42501', message: 'permission denied for table backup_reports' })).toBe(false);
    expect(B.isMissingTable(null)).toBe(false);
  });

  test('read(): the newest 200 lines, reading only; a refusal is "could not check"; a missing table is "not verified here"', async ({}, ti) => {
    node(ti);
    const asked = [];
    const client = (reply) => ({ from: (t) => { asked.push(t); const q = { select: (c) => { asked.push(c); return q; }, order: (c, o) => { asked.push(c + ':' + o.ascending); return q; }, limit: (n) => { asked.push(n); return Promise.resolve(reply); } }; return q; } });
    expect((await B.read(client({ data: [line('nightly_backup', H, true), line('restore_test', D, true)], error: null }), NOW)).state).toBe('ok');
    expect(asked.slice(0, 4)).toEqual(['backup_reports', 'kind, finished_at, ok', 'finished_at:false', 200]);
    expect((await B.read(client({ data: null, error: { code: 'PGRST205', message: 'Could not find the table' } }), NOW)).title).toBe('Backups: not verified here');
    expect((await B.read(client({ data: null, error: { code: '42501', message: 'permission denied' } }), NOW)).title).toBe('Backups: could not check');
    const throwing = { from: () => { throw new Error('network down'); } };
    expect((await B.read(throwing, NOW)).title).toBe('Backups: could not check');
  });

  test('Home\'s checks take the line as it is; without it, the old honest line stays', ({}, ti) => {
    node(ti);
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'owner-login-helpers.js'), 'utf8');
    const win = {}; new Function('window', src)(win);
    const { attentionFindings } = win.HE.helpers;
    const plain = attentionFindings({}, NOW).find(f => f.key === 'backups');
    expect([plain.level, plain.title]).toEqual(['info', 'Backups: not verified here']);
    const stale = attentionFindings({ backupLine: B.judge([line('nightly_backup', 3 * D, true)], NOW) }, NOW);
    expect(stale[0]).toMatchObject({ key: 'backups', level: 'critical', badge: 'Urgent', title: 'Backups: the newest backup is older than a day' });   // urgent lines come first
    expect(attentionFindings({ backupLine: B.judge([line('nightly_backup', H, true), line('restore_test', D, true)], NOW) }, NOW).find(f => f.key === 'backups').badge).toBeUndefined();
    const odd = attentionFindings({ backupLine: { title: 'x', level: 'party' } }, NOW).find(f => f.key === 'backups');
    expect(odd.level).toBe('unknown');                                                     // an unknown level is never taken for "fine"
  });
});

// ---------- on the page ----------
const FIXED = '2026-11-26T15:00:00Z';
const row = (page) => page.locator('#attnChecksWrap .attnCheck[data-key="backups"]');
const asked = (backend) => backend.requests.filter(r => r.table === 'backup_reports');
async function open(page, backend, opts) {
  const o = opts || {};
  await page.clock.setFixedTime(new Date(FIXED));
  if (o.lines) backend.tables.backup_reports = o.lines.map((l, i) => Object.assign({ id: i + 1, size_bytes: null, reported_at: l.finished_at }, l));
  if (o.route) await page.context().route(/\/rest\/v1\/backup_reports/, o.route);
  await page.addInitScript((on) => { try { if (on) localStorage.setItem('he_backup_status', 'on'); } catch (e) {} }, o.on !== false);
  await login(page);
}

test.describe('on Home', () => {
  test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'page logic; one size is enough (the phone check is below)'); });

  test('switch off: exactly as before, and the reports are not even asked for', async ({ page, backend }) => {
    await open(page, backend, { on: false, lines: [line('nightly_backup', 3 * D, false)] });
    await expect(row(page)).toContainText('Backups: not verified here');
    expect(asked(backend)).toEqual([]);
  });

  test('last night succeeded: said plainly, with the time and the restore test', async ({ page, backend }) => {
    await open(page, backend, { lines: [line('nightly_backup', 5 * H, true), line('restore_test', 10 * D, true)] });
    await expect(row(page)).toContainText('Backups: last night\'s backup succeeded');
    await row(page).locator('summary').click();
    await expect(row(page)).toContainText('The nightly backup succeeded 5 hours ago. The last restore test succeeded 10 days ago.');
    expect(asked(backend).every(r => r.method === 'GET')).toBe(true);
  });

  test('older than a day: urgent, at the top of the checks, and it cannot be hidden', async ({ page, backend }) => {
    await open(page, backend, { lines: [line('nightly_backup', 50 * H, true), line('restore_test', 10 * D, true)] });
    await expect(row(page)).toContainText('Backups: the newest backup is older than a day');
    await expect(page.locator('#attnChecksWrap .attnCheck').first()).toHaveAttribute('data-key', 'backups');
    await expect(row(page).locator('.attnLevel')).toHaveText('Urgent');                     // not "Data problem": the data is fine, the backup is late
    await expect(row(page).locator('button')).toHaveCount(0);
  });

  test('the last backup failed: urgent', async ({ page, backend }) => {
    await open(page, backend, { lines: [line('nightly_backup', 2 * H, false), line('restore_test', 10 * D, true)] });
    await expect(row(page)).toContainText('Backups: the last nightly backup FAILED');
  });

  test('step 19 not installed yet: the same "not verified here" line, nothing alarming', async ({ page, backend }) => {
    await open(page, backend, { route: r => r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST205', message: 'Could not find the table \'public.backup_reports\' in the schema cache' }) }) });
    await expect(row(page)).toContainText('Backups: not verified here');
    await row(page).locator('summary').click();
    await expect(row(page)).toContainText('step 19');
  });

  test('a refused read says "could not check", never "fine"', async ({ page, backend }) => {
    await open(page, backend, { route: r => r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"synthetic"}' }) });
    await expect(row(page)).toContainText('Backups: could not check');
  });
});

test('at phone size the backups line fits without sideways scrolling', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'iphone', 'phone only');
  await open(page, backend, { lines: [line('nightly_backup', 50 * H, true)] });
  await expect(row(page)).toContainText('older than a day');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});
