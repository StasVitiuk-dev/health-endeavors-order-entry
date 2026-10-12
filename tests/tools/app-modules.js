// EXT15: checks the owner dashboard's module graph. Fails (exit 1) when:
//   * a module file in assets/app/ is not loaded by owner-login.html, or is loaded
//     but not created by the program, or created twice;
//   * the APP_MODULES list in the program differs from the modules it creates;
//   * a module needs an input nothing created before it provides (wrong order)
//     or the module graph has a cycle;
//   * a module uses a name it neither declares, receives in ctx, nor gets from
//     the browser (a hidden dependency): checked with the TypeScript compiler;
//   * a module is loaded after the program, or before the registry.
//   node tests/tools/app-modules.js            → OK or the problems
//   node tests/tools/app-modules.js --graph    → print the graph
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const { moduleInfo, existingModules } = require('./extract-module');

const ROOT = path.join(__dirname, '..', '..');
const APP = path.join(ROOT, 'assets', 'owner-login-app.js');
const SHELL = path.join(ROOT, 'owner-login.html');
const OUTER = new Set(['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'scriptErrorEl', 'showBanner']);

function helperNames(appText) {
  const m = /const \{([\s\S]*?)\} = window\.HE\.helpers;/.exec(appText);
  return new Set(m ? m[1].split(',').map(s => s.trim()).filter(Boolean) : []);
}

// Free identifiers in a module (TS "Cannot find name" diagnostics), with the
// browser's own globals known through lib.dom.
function hiddenDependencies(file) {
  const decl = 'interface Window { HE: any; supabase: any; __sbLoadFailed?: boolean; __heHelpersLoadFailed?: boolean } declare var HE: any;';
  const host = ts.createCompilerHost({});
  const orig = host.getSourceFile;
  const declName = path.join(ROOT, '__he_globals.d.ts');
  host.getSourceFile = (name, lang) => name === declName ? ts.createSourceFile(name, decl, lang) : orig.call(host, name, lang);
  const prog = ts.createProgram([file, declName], { allowJs: true, checkJs: true, noEmit: true, target: ts.ScriptTarget.ES2022, lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'], types: [] }, host);
  return ts.getPreEmitDiagnostics(prog, prog.getSourceFile(file))
    .filter(d => d.code === 2304 || d.code === 2552)
    .map(d => ts.flattenDiagnosticMessageText(d.messageText, ' ') + ' (line ' + (d.file.getLineAndCharacterOfPosition(d.start).line + 1) + ')');
}

function check() {
  const problems = [];
  const appText = fs.readFileSync(APP, 'utf8');
  const shell = fs.readFileSync(SHELL, 'utf8');
  const mods = existingModules();
  const byName = new Map(mods.map(m => [m.name, m]));
  // creation order in the program
  const creates = [...appText.matchAll(/HE\.modules\.create\('([a-z0-9-]+)', \{([^}]*)\}\)/g)].map(m => ({ name: m[1], given: m[2].split(',').map(s => s.trim()).filter(Boolean) }));
  const appModules = (/const APP_MODULES = \{([^}]*)\};/.exec(appText) || [])[1] || '';
  const listed = new Map([...appModules.matchAll(/'([a-z0-9-]+)': (\d+)/g)].map(m => [m[1], Number(m[2])]));
  const tags = [...shell.matchAll(/<script src="assets\/app\/([a-z0-9-]+)\.js\?v=[0-9a-f]+"><\/script>/g)].map(m => ({ name: m[1], at: m.index }));
  const registryAt = shell.indexOf('assets/owner-login-modules.js');
  const appAt = shell.indexOf('assets/owner-login-app.js');
  const seen = new Set();
  const provided = new Map(); // name → module that exports it
  const helpers = helperNames(appText);
  const edges = [];
  for (const c of creates) {
    if (seen.has(c.name)) problems.push(`module ${c.name} is created twice`);
    seen.add(c.name);
    const m = byName.get(c.name);
    if (!m) { problems.push(`program creates ${c.name} but assets/app/${c.name}.js does not exist`); continue; }
    if (listed.get(c.name) !== m.api) problems.push(`APP_MODULES says ${c.name} ${listed.get(c.name)}, the file says ${m.api}`);
    for (const need of m.needs) {
      if (!c.given.includes(need)) problems.push(`${c.name} needs ${need} but the program does not hand it over`);
      if (provided.has(need)) edges.push([c.name, provided.get(need), need]);
      else if (!helpers.has(need) && !OUTER.has(need)) problems.push(`${c.name} needs ${need}, which no earlier module, helper or script constant provides (order or cycle)`);
    }
    for (const g of c.given) if (!m.needs.includes(g)) problems.push(`${c.name} is handed ${g} but does not list it as an input`);
    for (const e of m.exports) { if (provided.has(e)) problems.push(`${e} is exported by both ${provided.get(e)} and ${c.name}`); provided.set(e, c.name); }
  }
  for (const m of mods) {
    if (!seen.has(m.name)) problems.push(`assets/app/${m.name}.js is never created by the program`);
    const t = tags.find(x => x.name === m.name);
    if (!t) problems.push(`assets/app/${m.name}.js is not loaded by owner-login.html`);
    else if (t.at < registryAt || t.at > appAt) problems.push(`assets/app/${m.name}.js must load after the registry and before the program`);
    for (const h of hiddenDependencies(m.file)) problems.push(`${m.name}: hidden dependency: ${h}`);
  }
  for (const n of listed.keys()) if (!byName.has(n)) problems.push(`APP_MODULES lists ${n}, which has no file`);
  // cycle check over the module edges (a module may only use earlier ones, so
  // any cycle would also show up as an order problem above; checked anyway)
  const adj = new Map(); for (const [a, b] of edges) (adj.get(a) || adj.set(a, new Set()).get(a)).add(b);
  const state = new Map();
  const cycle = [];
  (function dfsAll() {
    function dfs(n, stack) {
      state.set(n, 1); stack.push(n);
      for (const x of adj.get(n) || []) {
        if (state.get(x) === 1) cycle.push(stack.slice(stack.indexOf(x)).concat(x).join(' → '));
        else if (!state.get(x)) dfs(x, stack);
      }
      stack.pop(); state.set(n, 2);
    }
    for (const n of adj.keys()) if (!state.get(n)) dfs(n, []);
  })();
  for (const c of cycle) problems.push('module cycle: ' + c);
  return { problems, creates, edges, mods };
}

if (require.main === module) {
  const r = check();
  if (process.argv.includes('--graph')) {
    for (const c of r.creates) {
      const deps = [...new Set(r.edges.filter(e => e[0] === c.name).map(e => e[1]))];
      console.log(`${c.name.padEnd(12)} ← ${deps.join(', ') || '(none)'}   [${r.mods.find(m => m.name === c.name).exports.length} exports]`);
    }
  }
  if (r.problems.length) { r.problems.forEach(p => console.log('PROBLEM: ' + p)); process.exitCode = 1; }
  else console.log(`OK: ${r.creates.length} modules, created once each in dependency order, no cycles, no hidden dependencies`);
}
module.exports = { check, hiddenDependencies };
