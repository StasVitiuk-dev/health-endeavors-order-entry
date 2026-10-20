// EXT15: proves the module extraction moved code without changing it. The
// top-level statements of initApp() in a reference version of the program
// (default: the EXT14 frozen page code 3a40095) must each appear exactly once,
// byte-identical, either in initApp() now or in one module's factory. The only
// new statements allowed are the module create calls and each module's input
// line and return line.
//   node tests/tools/verify-moves.js [git-revision] [--changed name1,name2]
// --changed lists declarations deliberately edited after the move (each must be
// named here and in the engineering report); they may differ, nothing else may.
// --styles first applies the mechanical inline-style conversion of
// tests/tools/inline-styles.js (style="…" → u- classes) to the reference, so the
// proof covers "moved + styles converted", and every other edit still has to be listed.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const ROOT = path.join(__dirname, '..', '..');
const args = process.argv.slice(2);
const rev = args.find((x, i) => !x.startsWith('--') && !['--changed', '--changed-text', '--new-modules'].includes(args[i - 1])) || '3a40095';
// --new-modules: modules written new (EXT16 he-ops), not moved: left out of the proof.
const NEW_MODULES = new Set(args.includes('--new-modules') ? args[args.indexOf('--new-modules') + 1].split(',').map(m => m.replace(/\.js$/, '') + '.js') : []);
const CHANGED = new Set(args.includes('--changed') ? args[args.indexOf('--changed') + 1].split(',') : []);
// --changed-text: unnamed top-level statements (event wiring) deliberately edited, matched by a fragment present before and after.
const CHANGED_TEXT = args.includes('--changed-text') ? args[args.indexOf('--changed-text') + 1].split('||') : [];
const declName = s => (/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|^(?:const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(s) || []).slice(1).find(Boolean);
function statements(text, file, fnPicker) {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let body = null;
  (function visit(n) { if (body) return; const b = fnPicker(n); if (b) { body = b; return; } ts.forEachChild(n, visit); })(sf);
  if (!body) throw new Error('function not found in ' + file);
  return body.statements.map(s => s.getText(sf));
}
const isInitApp = n => ts.isFunctionDeclaration(n) && n.name && n.name.text === 'initApp' ? n.body : null;
const isFactory = n => ts.isCallExpression(n) && /HE\.modules\.define$/.test(n.expression.getText()) ? n.arguments[2].body : null;
let reference = execFileSync('git', ['show', rev + ':assets/owner-login-app.js'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 });
if (args.includes('--styles')) { const st = require('./inline-styles'); reference = st.rewrite(reference, style => st.parseDecls(style).map(st.className)); }
const before = statements(reference, 'old.js', isInitApp);
const now = statements(fs.readFileSync(path.join(ROOT, 'assets/owner-login-app.js'), 'utf8'), 'app.js', isInitApp)
  .filter(s => !/^const \{[^}]*\} = HE\.modules\.create\(/.test(s));
const moved = [];
for (const f of fs.readdirSync(path.join(ROOT, 'assets/app')).filter(x => !NEW_MODULES.has(x))) {
  const st = statements(fs.readFileSync(path.join(ROOT, 'assets/app', f), 'utf8'), f, isFactory);
  moved.push(...st.filter(s => !/^const \{[^}]*\} = ctx;$/.test(s) && !/^return \{[^}]*\};$/.test(s)));
}
const count = list => list.reduce((m, s) => m.set(s, (m.get(s) || 0) + 1), new Map());
const keep = st => !CHANGED.has(declName(st)) && !CHANGED_TEXT.some(t => st.includes(t));
const want = count(before.filter(keep)), have = count(now.concat(moved).filter(keep));
const changedSeen = [...CHANGED].filter(n => before.some(st => declName(st) === n) && now.concat(moved).some(st => declName(st) === n));
const problems = [];
for (const [s, n] of want) if (have.get(s) !== n) problems.push(`statement ${have.has(s) ? 'duplicated' : 'missing or changed'}: ${s.slice(0, 120).replace(/\s+/g, ' ')}`);
for (const [s] of have) if (!want.has(s)) problems.push(`new or changed statement: ${s.slice(0, 120).replace(/\s+/g, ' ')}`);
if (problems.length) { problems.slice(0, 40).forEach(p => console.log('PROBLEM: ' + p)); console.log(problems.length + ' problem(s)'); process.exitCode = 1; }
else console.log(`OK: all ${before.length - (before.length - before.filter(keep).length)} unchanged-by-design`+(CHANGED.size ? ` (+ ${changedSeen.length} deliberately edited: ${changedSeen.join(', ')})` : '')+` of ${before.length} top-level statements of initApp() at ${rev} are present exactly once and unchanged (${now.length} in the program, ${moved.length} in ${fs.readdirSync(path.join(ROOT, 'assets/app')).length} modules)`);
