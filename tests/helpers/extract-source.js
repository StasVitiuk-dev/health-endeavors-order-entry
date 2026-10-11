// Pulls individual functions and constant tables out of owner-login.html so
// they can be unit-tested in Node, without changing the dashboard file and
// without a browser. Used by specs/helpers-unit.spec.js.
//
// It relies on the file's consistent indentation (see sourceOf). That is
// enough for the small, self-contained helpers tested here; it is not a
// general JavaScript parser. If a helper is renamed or moved, the test fails
// loudly with "not found", which is the point.

const fs = require('fs');
const path = require('path');

// owner-login.html plus the pure helpers moved out of it into
// assets/owner-login-helpers.js (same 4-space indentation, so the same rules
// find them in either file).
const ROOT = path.resolve(__dirname, '..', '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'owner-login.html'), 'utf8')
  + '\n' + fs.readFileSync(path.join(ROOT, 'assets', 'owner-login-helpers.js'), 'utf8');

// The dashboard code is consistently indented, so a top-level helper inside
// initApp() starts on a line indented by 4 spaces and ends at the next line
// that is exactly "    }" (or "    };" / a one-line "const X = ...;").
const LINES = SOURCE.split('\n');

function sourceOf(name) {
  const startRe = new RegExp('^    (async )?function ' + name + '\\s*\\(|^    const ' + name + '\\s*=');
  const i = LINES.findIndex(l => startRe.test(l));
  if (i === -1) throw new Error('not found in owner-login.html: ' + name);
  const first = LINES[i];
  if (/^    const /.test(first) && /;\s*$/.test(first)) return first;
  for (let j = i + 1; j < LINES.length; j++) {
    if (/^    \};?\s*$/.test(LINES[j]) || /^    \];?\s*$/.test(LINES[j])) return LINES.slice(i, j + 1).join('\n');
  }
  throw new Error('no end found for ' + name);
}

// Loads the named functions/constants together and returns them by name.
function load(names) {
  const body = names.map(sourceOf).join('\n') + '\nreturn {' + names.join(',') + '};';
  return new Function(body)();
}

module.exports = { load, sourceOf, SOURCE };
