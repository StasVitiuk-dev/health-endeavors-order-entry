// EXT16: the shrinker (tests/helpers/shrink.js) on planted failures, Node only.
//   * a bug that needs "open dialog → stale update → submit" in that order, hidden
//     in 70-operation random sequences, shrinks to exactly those 3 operations;
//   * the result always still fails; the run and time budgets are respected;
//   * values are simplified (a long text that is not needed becomes short).
const { test, expect } = require('@playwright/test');
const { shrink, describe } = require('../helpers/shrink');
test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
const NOISE = ['page:home', 'page:tasks', 'search', 'back', 'forward', 'resize', 'close-dialog', 'offline', 'online', 'palette'];
// The planted bug: submitting while a dialog is open AFTER a stale update arrived.
function buggy(ops) {
  let dialog = false, stale = false;
  for (const o of ops) {
    if (o === 'open-dialog') { dialog = true; stale = false; }
    else if (o === 'close-dialog') dialog = false;
    else if (o === 'stale-update' && dialog) stale = true;
    else if (o === 'submit' && dialog && stale) return true; // failure
  }
  return false;
}

for (const seed of [1611, 1612, 1613, 1614, 1615]) {
  test(`planted 3-step failure in a 70-step sequence (seed ${seed}) shrinks to exactly 3 steps`, async () => {
    const r = rng(seed);
    let ops;
    do { ops = Array.from({ length: 70 }, () => (r() < 0.12 ? ['open-dialog', 'stale-update', 'submit'][Math.floor(r() * 3)] : NOISE[Math.floor(r() * NOISE.length)])); } while (!buggy(ops));
    const res = await shrink(ops, async c => buggy(c), { maxRuns: 2000, maxMs: 10000 });
    expect(buggy(res.ops)).toBe(true);
    expect(res.ops, describe(res.ops)).toEqual(['open-dialog', 'stale-update', 'submit']);
    test.info().annotations.push({ type: 'shrink', description: `seed ${seed}: 70 → ${res.ops.length} in ${res.runs} tries, ${res.ms} ms` });
  });
}

test('the budget is respected: a slow predicate stops early, and the result still fails', async () => {
  const ops = Array.from({ length: 200 }, (_, i) => 'op' + i);
  const res = await shrink(ops, async c => { await new Promise(x => setTimeout(x, 25)); return c.includes('op150'); }, { maxRuns: 1000, maxMs: 120 });
  expect(res.complete).toBe(false);
  expect(res.ms).toBeLessThan(1500);
  expect(res.ops).toContain('op150');
  expect(res.ops.length).toBeLessThan(200);
  const capped = await shrink(ops, async c => c.includes('op150'), { maxRuns: 5 });
  expect(capped.runs).toBeLessThanOrEqual(5);
});

test('values are simplified: an operation needing only some text keeps a short version', async () => {
  const ops = [{ op: 'type', text: 'x'.repeat(500) + '<script>' }, { op: 'noise' }, { op: 'save' }];
  const fails = async c => c.some(o => o.op === 'type' && o.text.includes('<')) && c.some(o => o.op === 'save');
  const simplify = o => (o.op === 'type' && o.text.length > 1 ? [{ op: 'type', text: '<' }, { op: 'type', text: o.text.slice(o.text.length / 2) }] : []);
  const res = await shrink(ops, fails, { simplify, maxRuns: 100 });
  expect(res.ops).toEqual([{ op: 'type', text: '<' }, { op: 'save' }]);
});

test('a predicate that throws counts as "does not fail" (never trusted as a reproduction)', async () => {
  const res = await shrink(['a', 'b', 'c'], async c => { if (c.length < 3) throw new Error('crash'); return true; }, { maxRuns: 50 });
  expect(res.ops).toEqual(['a', 'b', 'c']);
});
