// EXT20J-post-TT: a small structural scanner for the dashboard CSS files.
// It is NOT a full CSS parser — it catches the specific class of defect that
// shipped silently in the calendar colour bug: JavaScript that leaked into a
// stylesheet (template-literal `${...}` or string concatenation `' + expr + '`)
// during the EXT15 inline-style -> class conversion, plus unbalanced braces.
// Such content is invalid CSS, so the browser drops the declaration and the
// intended styling never applies, with no error anywhere.
//
//   node tests/tools/css-lint.js          -> report findings (exit 0)
//   node tests/tools/css-lint.js --check  -> exit 1 if any finding
//
// Exposed for tests: FILES, scan(text, file), scanAll(readFn).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

const FILES = ['assets/owner-login.css', 'assets/change-password.css', 'assets/dashboard-page.css',
  'assets/manual-order-entry.css', 'assets/search-page.css'];

// Strip /* ... */ comments so their contents never produce findings. Keeps
// newline count stable so reported line numbers stay accurate.
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
}

// Each finding: { file, line, kind, text }.
function scan(css, file) {
  const out = [];
  const clean = stripComments(css);
  const lines = clean.split('\n');
  lines.forEach((line, i) => {
    const push = (kind) => out.push({ file, line: i + 1, kind, text: line.trim().slice(0, 160) });
    // JavaScript template-literal interpolation leaked into CSS.
    if (line.includes('${')) push('template-literal interpolation (${...}) in CSS');
    if (/`/.test(line)) push('backtick (template literal) in CSS');
    // JavaScript string concatenation leaked into a declaration value,
    // e.g. background:' + colorForCalendar(x) + ' !important  (the calendar bug).
    if (/'\s*\+|\+\s*'|"\s*\+|\+\s*"/.test(line)) push("string concatenation (' + ...) in CSS");
  });
  // Unclosed /* */ comment: an odd number of comment delimiters means one was
  // never closed (stripComments only removes balanced pairs, so a stray opener
  // survives in `clean`).
  if (clean.includes('/*')) out.push({ file, line: 0, kind: 'unclosed /* comment (no matching */)', text: '' });
  // Brace and parenthesis balance over the whole (comment-stripped,
  // string-blanked) file — a truncated or malformed rule shows up here.
  const noStr = clean.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');
  const opens = (noStr.match(/\{/g) || []).length;
  const closes = (noStr.match(/\}/g) || []).length;
  if (opens !== closes) out.push({ file, line: 0, kind: `unbalanced braces (${opens} '{' vs ${closes} '}')`, text: '' });
  const pOpen = (noStr.match(/\(/g) || []).length;
  const pClose = (noStr.match(/\)/g) || []).length;
  if (pOpen !== pClose) out.push({ file, line: 0, kind: `unbalanced parentheses (${pOpen} '(' vs ${pClose} ')')`, text: '' });
  return out;
}

function scanAll(readFn) {
  const read = readFn || (f => fs.readFileSync(path.join(ROOT, f), 'utf8'));
  const all = [];
  for (const f of FILES) { try { all.push(...scan(read(f), f)); } catch (e) { all.push({ file: f, line: 0, kind: 'could not read: ' + e.message, text: '' }); } }
  return all;
}

if (require.main === module) {
  const findings = scanAll();
  if (findings.length) {
    for (const f of findings) console.log(`${f.file}:${f.line} ${f.kind}${f.text ? '  ->  ' + f.text : ''}`);
    if (process.argv.includes('--check')) process.exitCode = 1;
  } else {
    console.log('OK: no JavaScript residue or brace imbalance in', FILES.join(', '));
  }
}

module.exports = { FILES, scan, scanAll, stripComments };
