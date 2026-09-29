// Checks that the test setup itself is safe: nothing can reach production,
// and the test data contains nothing real.
const fs = require('fs');
const path = require('path');
const { test, expect, login } = require('../helpers/dashboard');
const { SUPABASE_HOST } = require('../helpers/mock-supabase');

const TESTS_DIR = path.resolve(__dirname, '..');

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? listFiles(p) : [p];
  });
}

test('requests to the production Supabase address are answered by the mock', async ({ page, backend }) => {
  await page.goto('/owner-login.html');
  const result = await page.evaluate(async host => {
    const res = await fetch(`https://${host}/rest/v1/tasks?select=id`, { headers: { apikey: 'x' } });
    return { status: res.status, body: await res.json() };
  }, SUPABASE_HOST);
  expect(result.status).toBe(200);
  // Synthetic ids only: this answer came from the mock, not the real database.
  expect(result.body.map(r => r.id)).toContain('task-open-1');
  expect(backend.requests.some(r => r.table === 'tasks')).toBe(true);
});

test('any other internet address is blocked', async ({ page, backend }) => {
  await page.goto('/owner-login.html');
  const outcomes = await page.evaluate(async () => {
    const urls = ['https://example.com/', 'https://api.github.com/', 'https://admin.shopify.com/', 'https://gmail.googleapis.com/'];
    const out = [];
    for (const u of urls) {
      try { await fetch(u, { mode: 'no-cors' }); out.push('reached'); } catch (e) { out.push('blocked'); }
    }
    return out;
  });
  expect(outcomes).toEqual(['blocked', 'blocked', 'blocked', 'blocked']);
  expect(backend.blocked).toHaveLength(4);
  backend.blocked.length = 0; // expected in this test only
});

test('the dashboard only ever talks to the mock during a full session', async ({ page, backend }) => {
  await login(page);
  await page.waitForLoadState('networkidle');
  expect(backend.requests.length).toBeGreaterThan(20);
  // Every Supabase request used the synthetic session, never a real one.
  const authed = backend.requests.filter(r => r.headers.authorization && r.path.startsWith('/rest/'));
  expect(authed.length).toBeGreaterThan(0);
  for (const r of authed) expect(r.headers.authorization).toContain('synthetic-signature');
  // (the fixture also fails this test if anything was blocked)
});

test('test files contain no real secrets or real contact details', () => {
  const suspicious = [
    /service_role/i,
    /sb_secret_/i,
    /shpat_[0-9a-f]/i,           // Shopify admin token
    /sk_live_/i,                 // payment secret key
    /eyJ[a-zA-Z0-9_-]{20,}\.eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/, // a real signed JWT
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  ];
  const emailPattern = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  // This file is skipped: it has to spell out the patterns it looks for.
  for (const file of listFiles(TESTS_DIR).filter(f => f !== __filename)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const re of suspicious) expect(re.test(text), `${path.relative(TESTS_DIR, file)} matches ${re}`).toBe(false);
    for (const email of text.match(emailPattern) || []) {
      expect(email.endsWith('.test'), `${path.relative(TESTS_DIR, file)} has a non-synthetic email ${email}`).toBe(true);
    }
  }
});
