// EXT16: automatic shrinking of failing random operation sequences.
//
//   const { shrink } = require('../helpers/shrink');
//   const r = await shrink(ops, async candidate => /* true when it still fails */, { maxRuns, maxMs, simplify });
//   r.ops        the smallest failing sequence found (always still failing)
//   r.runs       how many candidates were tried; r.ms the time spent; r.complete
//                false when the budget ran out (the result is then smaller, not minimal)
//
// Method (delta debugging, then simplification), all bounded by maxRuns/maxMs:
//   1. remove chunks: halves, quarters, … down to single operations, keeping a
//      removal only when the shorter sequence still fails;
//   2. remove single operations once more until no single removal keeps the failure;
//   3. simplify values: for each operation, try each simpler variant the caller's
//      simplify(op) offers (e.g. shorter text, smaller delay) and keep it if it
//      still fails.
// The predicate must be deterministic for a given sequence (seeded tests are).
async function shrink(ops, stillFails, opts = {}) {
  const maxRuns = opts.maxRuns || 200, maxMs = opts.maxMs || 120000, simplify = opts.simplify || (() => []);
  const t0 = Date.now();
  let runs = 0, best = ops.slice();
  const budget = () => runs < maxRuns && Date.now() - t0 < maxMs;
  const test = async cand => { runs++; try { return !!(await stillFails(cand)); } catch (e) { return false; } };

  // 1. chunk removal (ddmin-style)
  let n = 2;
  while (best.length >= 2 && budget()) {
    const size = Math.ceil(best.length / n);
    let removed = false;
    for (let i = 0; i < best.length && budget(); i += size) {
      const cand = best.slice(0, i).concat(best.slice(i + size));
      if (cand.length && await test(cand)) { best = cand; n = Math.max(n - 1, 2); removed = true; break; }
    }
    if (!removed) { if (size <= 1) break; n = Math.min(n * 2, best.length); }
  }
  // 2. single removals until none helps
  let changed = true;
  while (changed && budget()) {
    changed = false;
    for (let i = 0; i < best.length && budget(); i++) {
      const cand = best.slice(0, i).concat(best.slice(i + 1));
      if (cand.length && await test(cand)) { best = cand; changed = true; break; }
    }
  }
  // 3. simplify values
  // (after a simpler value is accepted, simplification restarts from THAT value: alternatives
  //  derived from the old value could otherwise replace a short result with a longer one)
  for (let i = 0; i < best.length && budget(); i++) {
    let improved = true;
    while (improved && budget()) {
      improved = false;
      for (const simpler of simplify(best[i])) {
        if (!budget()) break;
        const cand = best.slice(); cand[i] = simpler;
        if (await test(cand)) { best = cand; improved = true; break; }
      }
    }
  }
  return { ops: best, runs, ms: Date.now() - t0, complete: budget() };
}
function describe(ops) { return ops.map(o => (typeof o === 'string' ? o : JSON.stringify(o))).join(' → '); }
module.exports = { shrink, describe };
