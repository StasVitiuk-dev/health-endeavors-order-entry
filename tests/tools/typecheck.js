// EXT15 type-check / lint pilot: the TypeScript checker on the extracted module
// files, the registry and the helpers (plain JavaScript, // @ts-check style, no
// conversion to TypeScript). Lint-like checks come from compiler options:
// unused locals, unreachable code, switch fall-through, implicit any returns...
//   node tests/tools/typecheck.js            → summary by error code
//   node tests/tools/typecheck.js --all      → every diagnostic
//   node tests/tools/typecheck.js --gate     → exit 1 on any error in the gated set
// The gated set (GATE) is what CI enforces; the rest is reported, not enforced,
// so the pilot can tighten file by file instead of typing 9,000 lines blindly.
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const ROOT = path.join(__dirname, '..', '..');
const FILES = [path.join(ROOT, 'assets', 'owner-login-modules.js'), path.join(ROOT, 'assets', 'owner-login-helpers.js'),
  // EXT19: the whole program, not only the modules
  ...['owner-login-app.js', 'owner-login-theme.js', 'dashboard-page.js', 'search-page.js', 'manual-order-entry.js', 'change-password.js'].map(f => path.join(ROOT, 'assets', f)),
  ...fs.readdirSync(path.join(ROOT, 'assets', 'app')).filter(f => f.endsWith('.js')).map(f => path.join(ROOT, 'assets', 'app', f))];
// Diagnostic codes that are real defects in this code base, enforced in CI.
const GATE = new Set([
  2304, 2552,  // cannot find name (hidden dependency / typo)
  7027,        // unreachable code
  7029,        // switch case falls through
  2367,        // comparison that can never be true (e.g. typo in a status string vs a literal type)
  1345,        // an expression of type void cannot be tested for truthiness
  2349,        // calling something that is not callable
  2554, 2555,  // wrong number of arguments to a function the file defines
  6133,        // declared but never used
]);
const GLOBALS = `interface Window { HE: any; supabase: any; __sbLoadFailed?: boolean; __heHelpersLoadFailed?: boolean; toastOk: (m: any) => void; toastErr: (m: any) => void }
declare var HE: any; declare var supabase: any; /* the Supabase library's global (smaller pages) */ declare function toastOk(m: any): void; declare function toastErr(m: any): void;`;
function run() {
  const declName = path.join(ROOT, '__he_globals.d.ts');
  const host = ts.createCompilerHost({});
  const orig = host.getSourceFile;
  host.getSourceFile = (n, l) => n === declName ? ts.createSourceFile(n, GLOBALS, l) : orig.call(host, n, l);
  const options = { allowJs: true, checkJs: true, noEmit: true, target: ts.ScriptTarget.ES2022, lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'], types: [],
    noUnusedLocals: true, allowUnreachableCode: false, noFallthroughCasesInSwitch: true, noImplicitReturns: false, strict: false };
  const prog = ts.createProgram([...FILES, declName], options, host);
  const diags = [];
  for (const f of FILES) for (const d of ts.getPreEmitDiagnostics(prog, prog.getSourceFile(f))) {
    if (!d.file) continue;
    diags.push({ file: path.relative(ROOT, d.file.fileName), line: d.file.getLineAndCharacterOfPosition(d.start).line + 1, code: d.code, gated: GATE.has(d.code), message: ts.flattenDiagnosticMessageText(d.messageText, ' ') });
  }
  return diags;
}
if (require.main === module) {
  const diags = run();
  const args = process.argv.slice(2);
  if (args.includes('--all')) for (const d of diags) console.log(`${d.file}:${d.line} TS${d.code}${d.gated ? ' [gated]' : ''} ${d.message}`);
  const byCode = {}; for (const d of diags) byCode[d.code] = (byCode[d.code] || 0) + 1;
  const gated = diags.filter(d => d.gated);
  console.log(`${FILES.length} files, ${diags.length} diagnostics (${gated.length} gated). By code: ${JSON.stringify(byCode)}`);
  if (args.includes('--gate') && gated.length) { for (const d of gated) console.log(`GATED ${d.file}:${d.line} TS${d.code} ${d.message}`); process.exitCode = 1; }
}
module.exports = { run, GATE, FILES };
