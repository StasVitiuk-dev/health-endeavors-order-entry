// EXT20J Reserve VIII: state-machine transition coverage analysis.
//
// The high-risk operation machine (assets/app/he-ops.js) is defined by an
// explicit transition table NEXT: state -> [allowed next states]. The existing
// ops-state spec spot-checks a scenario and runs a random campaign, but never
// MEASURES how much of the transition matrix is exercised, nor EXHAUSTIVELY
// proves that every transition absent from the table is rejected.
//
// This pure helper analyses any such table so a spec can assert exact coverage:
//   analyze(NEXT) -> {
//     states, legalEdges, illegalEdges,         // the full |states|^2 matrix, partitioned
//     reachable, unreachable,                   // BFS from the start state over the table
//     neverTargeted,                            // states no edge points to (besides start)
//     terminal,                                 // states with no outgoing edge
//   }
// It is pure (no DOM, no network, no git), so the spec feeds it he-ops's own
// OP_NEXT / OP_NEXT_REPEATABLE and the numbers are grounded in the real table.
'use strict';

function analyze(NEXT, start) {
  const states = Object.keys(NEXT);
  const startState = start || states[0];
  const set = new Set(states);

  const legalEdges = [];
  for (const from of states) for (const to of NEXT[from]) legalEdges.push([from, to]);

  // Illegal = every ordered (from, to) pair over real states that the table does
  // not allow. Self-loops count as illegal unless the table lists them.
  const legalKey = new Set(legalEdges.map(([a, b]) => a + '>' + b));
  const illegalEdges = [];
  for (const from of states) for (const to of states) {
    if (!legalKey.has(from + '>' + to)) illegalEdges.push([from, to]);
  }

  // BFS reachability from the start state over the table.
  const reachable = new Set([startState]);
  const q = [startState];
  while (q.length) {
    const s = q.shift();
    for (const to of (NEXT[s] || [])) if (set.has(to) && !reachable.has(to)) { reachable.add(to); q.push(to); }
  }
  const unreachable = states.filter(s => !reachable.has(s));

  const targeted = new Set();
  for (const [, to] of legalEdges) targeted.add(to);
  const neverTargeted = states.filter(s => !targeted.has(s) && s !== startState);
  const terminal = states.filter(s => (NEXT[s] || []).length === 0);

  return { states, startState, legalEdges, illegalEdges, reachable: [...reachable].sort(),
    unreachable, neverTargeted, terminal };
}

// Given a table and the set of states a caller can actually drive the real
// machine INTO through its public API, report the legal edges whose SOURCE the
// API can reach (so a test can and should exercise them) versus those it cannot.
function apiReachableEdges(NEXT, apiReachableStates) {
  const reach = new Set(apiReachableStates);
  const exercisable = [];
  const unexercisable = [];
  for (const from of Object.keys(NEXT)) for (const to of NEXT[from]) {
    (reach.has(from) ? exercisable : unexercisable).push([from, to]);
  }
  // states defined in the table but the public API never enters
  const apiUnreachable = Object.keys(NEXT).filter(s => !reach.has(s));
  return { exercisable, unexercisable, apiUnreachable };
}

module.exports = { analyze, apiReachableEdges };
