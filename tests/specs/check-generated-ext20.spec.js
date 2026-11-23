// Guard for tests/tools/check-generated.js — the fast, side-effect-free freshness
// preflight (`npm run generated:check`). It runs the committed generators and
// reports whether the generated docs are stale, in a couple of seconds, so a
// contributor catches staleness before the ~18-minute browser shards do.
//
// This spec is deliberately READ-ONLY. The tool itself writes to shared tracked
// files (the module map, the write-path docs, the page ?v= hashes), and other
// specs in the same shard (generated-determinism-ext20, write-path-inventory,
// modules-ext15) read those very files; under the suite's fullyParallel mode,
// executing the tool here could race those specs. So the tool's run-time behavior
// (fresh -> exit 0 side-effect-free; stale -> exit 1 naming the regenerate command
// and restoring the tree; a mid-sequence generator failure -> exit 2 with the tree
// restored, no partial writes) is verified manually and recorded in
// docs/ops/SALES_RECOVERY_VALIDATION_2026-11-01.md. What CAN drift silently, and
// is guarded here, is the tool's coverage: if a new generated artifact gains a
// freshness spec but is not added to the tool, the preflight quietly goes blind.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const ROOT = path.join(__dirname, '..', '..');
const TOOL = path.join(ROOT, 'tests', 'tools', 'check-generated.js');
test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

test('check-generated covers every generated file a freshness spec guards (no silent omission)', () => {
  const toolSrc = fs.readFileSync(TOOL, 'utf8');
  // Each file below is asserted fresh by a committed spec:
  //  - APPLICATION_MODULE_MAP_EXT15.md: generated-determinism-ext20, modules-ext15:93
  //  - WRITE_PATH_MATRIX/INVENTORY + MUTATION_WRITE_PATH_INVENTORY.json:
  //      generated-determinism-ext20, write-path-inventory
  //  - SALES_INVENTORY.md: sales-inventory-ext20j
  //  - STATE_MACHINES.md: state-machine
  //  - owner-login.html (?v= asset hashes): modules-ext15
  const guarded = [
    'docs/ops/APPLICATION_MODULE_MAP_EXT15.md',
    'docs/ops/WRITE_PATH_MATRIX.md',
    'docs/ops/WRITE_PATH_INVENTORY.md',
    'docs/ops/MUTATION_WRITE_PATH_INVENTORY.json',
    'docs/ops/SALES_INVENTORY.md',
    'docs/ops/STATE_MACHINES.md',
    'owner-login.html',
  ];
  for (const f of guarded) expect(toolSrc, `${f} must be covered by check-generated.js`).toContain(f);
  // The one generated artifact the tool deliberately does NOT cover (a browser
  // baseline, not a fast node render) must stay named as an explicit exclusion,
  // so the gap is documented rather than silent.
  expect(toolSrc, 'the requests.json browser-baseline exclusion must stay documented').toContain('tests/baselines/requests.json');
});
