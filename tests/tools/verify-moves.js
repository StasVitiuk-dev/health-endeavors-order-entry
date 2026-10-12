// EXT15: proves the module extraction moved code without changing it. The
// top-level statements of initApp() in a reference version of the program
// (default: the EXT14 frozen page code 3a40095) must each appear exactly once,
// byte-identical, either in initApp() now or in one module's factory. The only
// new statements allowed are the module create calls and each module's input
// line and return line.
//   node tests/tools/verify-moves.js [git-revision]
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const ROOT = path.join(__dirname, '..', '..');
const rev = process.argv[2] || '3a40095';
function statements(text, file, fnPicker) {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let body = null;
  (function visit(n) { if (body) return; const b = fnPicker(n); if (b) { body = b; return; } ts.forEachChild(n, visit); })(sf);
  if (!body) throw new Error('function not found in ' + file);
  return body.statements.map(s => s.getText(sf));
}
const isInitApp = n => ts.isFunctionDeclaration(n) && n.name && n.name.text === 'initApp' ? n.body : null;
const isFactory = n => ts.isCallExpression(n) && /HE\.modules\.define$/.test(n.expression.getText()) ? n.arguments[2].body : null;
const before = statements(execFileSync('git', ['show', rev + ':assets/owner-login-app.js'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 }), 'old.js', isInitApp);
const now = statements(fs.readFileSync(path.join(ROOT, 'assets/owner-login-app.js'), 'utf8'), 'app.js', isInitApp)
  .filter(s => !/^const \{[^}]*\} = HE\.modules\.create\(/.test(s));
const moved = [];
for (const f of fs.readdirSync(path.join(ROOT, 'assets/app'))) {
  const st = statements(fs.readFileSync(path.join(ROOT, 'assets/app', f), 'utf8'), f, isFactory);
  moved.push(...st.filter(s => !/^const \{[^}]*\} = ctx;$/.test(s) && !/^return \{[^}]*\};$/.test(s)));
}
const count = list => list.reduce((m, s) => m.set(s, (m.get(s) || 0) + 1), new Map());
const want = count(before), have = count(now.concat(moved));
const problems = [];
for (const [s, n] of want) if (have.get(s) !== n) problems.push(`statement ${have.has(s) ? 'duplicated' : 'missing or changed'}: ${s.slice(0, 120).replace(/\s+/g, ' ')}`);
for (const [s] of have) if (!want.has(s)) problems.push(`new or changed statement: ${s.slice(0, 120).replace(/\s+/g, ' ')}`);
if (problems.length) { problems.slice(0, 40).forEach(p => console.log('PROBLEM: ' + p)); console.log(problems.length + ' problem(s)'); process.exitCode = 1; }
else console.log(`OK: all ${before.length} top-level statements of initApp() at ${rev} are present exactly once and unchanged (${now.length} in the program, ${moved.length} in ${fs.readdirSync(path.join(ROOT, 'assets/app')).length} modules)`);
