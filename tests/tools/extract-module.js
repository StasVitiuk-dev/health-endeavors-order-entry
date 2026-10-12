// EXT15: moves a group of top-level declarations out of initApp() in
// assets/owner-login-app.js into a module file under assets/app/, unchanged.
//
//   node tests/tools/extract-module.js <module-name> <description> <decl1,decl2,...>
//
// Rules it enforces (it refuses and changes nothing otherwise):
//   * every listed declaration is a function or a const (no `let`/`var` state);
//   * a variable statement moves only whole (all its names must be listed);
//   * everything the moved code reads is either moved with it, exported by a
//     module created earlier, one of the pure helpers (window.HE.helpers), a
//     script-level constant (SUPABASE_URL, SUPABASE_ANON_KEY, showBanner...),
//     or a browser global; nothing it reads is app state created later;
//   * the moved code writes no top-level variable of the app.
// The module receives its inputs explicitly (ctx) and returns only the names
// something else still uses. The app creates it right after the earlier
// modules, before any of its own code runs.
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const { analyse } = require('./app-graph');

const ROOT = path.join(__dirname, '..', '..');
const APP = path.join(ROOT, 'assets', 'owner-login-app.js');
const OUTER = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'scriptErrorEl', 'showBanner', 'APP_MODULES'];
const CREATE_BEGIN = '    // @@ EXT15 modules: created in dependency order';
const CREATE_END = '    // @@ end modules';

// Names a module file exports (the object it returns) and the ctx names it needs.
function moduleInfo(file) {
  const text = fs.readFileSync(file, 'utf8');
  const name = (/HE\.modules\.define\('([a-z0-9-]+)'/.exec(text) || [])[1];
  const needs = JSON.parse(((/needs: (\[[^\]]*\])/.exec(text) || [])[1] || '[]').replace(/'/g, '"'));
  const ret = /\n  return \{([^}]*)\};\n\}\);\s*$/.exec(text);
  const exports = ret ? ret[1].split(',').map(s => s.trim()).filter(Boolean) : [];
  const api = Number((/api: (\d+)/.exec(text) || [])[1]);
  return { name, file, needs, exports, api };
}
function existingModules() {
  const dir = path.join(ROOT, 'assets', 'app');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.js')).map(f => moduleInfo(path.join(dir, f)));
}

function extract(modName, description, names) {
  const a = analyse(APP);
  const set = new Set(names);
  const helpersStmt = a.decls.find(d => d.name === 'esc').node.parent.parent; // the destructuring statement
  const helperNames = new Set(a.decls.filter(d => d.node.parent && d.node.parent.parent === helpersStmt).map(d => d.name));
  // statements to move
  const stmts = new Map();
  for (const n of names) {
    const d = a.byName.get(n);
    if (!d) throw new Error('not a top-level declaration: ' + n);
    if (d.kind === 'let' || d.kind === 'var') throw new Error(n + ' is mutable state (' + d.kind + '); not moved');
    if (helperNames.has(n)) throw new Error(n + ' is a pure helper; it stays in owner-login-helpers.js');
    const st = /function/.test(d.kind) ? d.node : d.node.parent.parent;
    if (ts.isVariableStatement(st)) for (const decl of st.declarationList.declarations) for (const nm of [decl.name.text]) if (!set.has(nm)) throw new Error('statement declaring ' + n + ' also declares ' + nm + ' (list it too)');
    if (d.writes.size) throw new Error(n + ' writes app state: ' + [...d.writes].join(', '));
    stmts.set(st, true);
  }
  const mods = existingModules();
  const fromModules = new Map();
  for (const m of mods) for (const e of m.exports) fromModules.set(e, m.name);
  // needs
  const needs = new Set();
  for (const n of names) {
    for (const r of a.byName.get(n).reads) {
      if (set.has(r)) continue;
      if (helperNames.has(r) || fromModules.has(r)) { needs.add(r); continue; }
      throw new Error(n + ' reads ' + r + ', which is app code created later (move it first or with it)');
    }
  }
  // script-level names used by the moved code
  // A statement's leading comments move with it, except the module-block markers.
  const startOf = st => { let s = st.getFullStart(); for (const mk of [CREATE_END, CREATE_BEGIN]) { const i = a.text.indexOf(mk, s); if (i !== -1 && i < st.getStart()) s = a.text.indexOf('\n', i) + 1; } return s; };
  const movedText = [...stmts.keys()].sort((x, y) => x.pos - y.pos).map(st => a.text.slice(startOf(st), st.getEnd())).join('');
  for (const o of OUTER) if (new RegExp('\\b' + o + '\\b').test(movedText)) needs.add(o);
  // exports: moved names that anything outside still reads
  const exportsList = names.filter(n => {
    const d = a.byName.get(n);
    return [...d.readBy].some(r => !set.has(r)) || mods.some(m => m.needs.includes(n));
  });
  // write the module
  const needList = [...needs].sort();
  const file = path.join(ROOT, 'assets', 'app', modName + '.js');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const body = `// assets/app/${modName}.js — ${description}
// EXT15: moved unchanged out of assets/owner-login-app.js (initApp). Its inputs
// arrive explicitly in ctx; it returns only what other code still uses. Map:
// docs/ops/APPLICATION_MODULE_MAP_EXT15.md. Created once, by the app, in order.
window.HE.modules.define('${modName}', { api: 1, needs: ${JSON.stringify(needList).replace(/"/g, "'")} }, function (ctx) {
${needList.length ? '    const { ' + needList.join(', ') + ' } = ctx;\n' : ''}${movedText.replace(/^\n+/, '')}

  return { ${exportsList.join(', ')} };
});
`;
  fs.writeFileSync(file, body);
  // remove from the app (back to front) and add the create call
  let text = a.text;
  for (const st of [...stmts.keys()].sort((x, y) => y.pos - x.pos)) text = text.slice(0, startOf(st)) + text.slice(st.getEnd());
  if (text.includes(CREATE_BEGIN) && !text.includes(CREATE_END)) throw new Error('internal: module block end marker lost');
  const call = `    const { ${exportsList.join(', ')} } = HE.modules.create('${modName}', { ${needList.join(', ')} });\n`;
  if (!text.includes(CREATE_BEGIN)) {
    const anchor = '    } = window.HE.helpers;\n';
    if (!text.includes(anchor)) throw new Error('helpers destructuring not found');
    text = text.replace(anchor, anchor + CREATE_BEGIN + ' (assets/app/*.js; see docs/ops/APPLICATION_MODULE_MAP_EXT15.md)\n' + call + CREATE_END + '\n');
  } else {
    if (!text.includes(CREATE_END + '\n')) throw new Error('module block end marker missing in the program');
    text = text.replace(CREATE_END + '\n', call + CREATE_END + '\n');
  }
  text = text.replace(/  const APP_MODULES = \{([^}]*)\};/, (all, inner) => {
    const entries = inner.trim() ? inner.split(',').map(x => x.trim()).filter(Boolean) : [];
    entries.push(`'${modName}': 1`);
    return '  const APP_MODULES = { ' + entries.join(', ') + ' };';
  });
  fs.writeFileSync(APP, text);
  const shellPath = path.join(ROOT, 'owner-login.html');
  const marker = '<!-- @@ EXT15 module files (assets/app/*.js), added by tests/tools/extract-module.js @@ -->\n';
  const shell = fs.readFileSync(shellPath, 'utf8');
  if (!shell.includes(marker)) throw new Error('module marker missing in owner-login.html');
  const tagsEnd = shell.indexOf(marker) + marker.length;
  let insertAt = tagsEnd;
  const re = /<script src="assets\/app\/[a-z0-9-]+\.js\?v=[0-9a-f]+"><\/script>\n/g; re.lastIndex = tagsEnd;
  for (let m; (m = re.exec(shell)) && m.index === insertAt;) insertAt = m.index + m[0].length;
  fs.writeFileSync(shellPath, shell.slice(0, insertAt) + `<script src="assets/app/${modName}.js?v=0"></script>\n` + shell.slice(insertAt));
  require('./refresh-asset-versions').refresh(ROOT);
  return { file: path.relative(ROOT, file), moved: names.length, lines: movedText.split('\n').length, needs: needList, exports: exportsList };
}

if (require.main === module) {
  const [name, description, list] = process.argv.slice(2);
  if (!name || !list) { console.log('usage: extract-module.js <name> <description> <a,b,c>'); process.exit(2); }
  console.log(JSON.stringify(extract(name, description, list.split(',').map(s => s.trim()).filter(Boolean)), null, 1));
}
module.exports = { extract, moduleInfo, existingModules, CREATE_BEGIN, CREATE_END };
