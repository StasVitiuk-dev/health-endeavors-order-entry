// EXT15: static analysis of the owner dashboard program (assets/owner-login-app.js
// and any extracted modules). Uses the TypeScript parser (devDependency, exact
// version) on plain JavaScript; it changes nothing.
//
//   node tests/tools/app-graph.js                 → summary metrics
//   node tests/tools/app-graph.js --json [file]   → full machine-readable graph
//   node tests/tools/app-graph.js --candidates    → declarations whose free
//        variables are only other extractable declarations or globals
//
// What it maps, for every top-level declaration inside initApp():
//   name, kind (function / async function / const / let / var), lines,
//   which other top-level names it reads, which top-level variables it writes,
//   who reads/writes each variable, whether a variable is mutable (let/var and
//   written anywhere after its declaration), and what its initializer looks like
//   (DOM reference, config literal, cache, request-generation counter...).
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = path.join(__dirname, '..', '..');
const APP = path.join(ROOT, 'assets', 'owner-login-app.js');

function parse(file) {
  const text = fs.readFileSync(file, 'utf8');
  return { text, sf: ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS) };
}
const lineOf = (sf, pos) => sf.getLineAndCharacterOfPosition(pos).line + 1;

function findInitApp(sf) {
  let found = null;
  (function visit(n) {
    if (found) return;
    if (ts.isFunctionDeclaration(n) && n.name && n.name.text === 'initApp') { found = n; return; }
    ts.forEachChild(n, visit);
  })(sf);
  return found;
}

// Names declared at the top level of a block (functions, variables, destructuring).
function bindingNames(name, out) {
  if (ts.isIdentifier(name)) out.push(name.text);
  else if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) for (const el of name.elements) if (el.name) bindingNames(el.name, out);
  return out;
}

function classifyInit(init, text) {
  if (!init) return 'uninitialised';
  const src = init.getText().slice(0, 200);
  if (/document\.(getElementById|querySelector)/.test(src)) return 'dom-reference';
  if (/^new (Map|Set|WeakMap)\(/.test(src) || /^\[\]$|^\{\}$/.test(src)) return 'cache/collection';
  if (/^(null|undefined|false|true|0|'[^']*'|"[^"]*")$/.test(src)) return 'scalar-state';
  if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) return 'function';
  if (ts.isObjectLiteralExpression(init) || ts.isArrayLiteralExpression(init)) return 'config-literal';
  if (ts.isNumericLiteral(init) || ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) return 'constant';
  if (/createClient|supabase/.test(src)) return 'client';
  return 'computed';
}

function analyse(file = APP) {
  const { text, sf } = parse(file);
  const init = findInitApp(sf);
  if (!init) throw new Error('initApp() not found in ' + file);
  const decls = [];          // top-level declarations inside initApp
  const byName = new Map();
  const loose = [];          // top-level statements that are not declarations (listeners, calls)
  for (const st of init.body.statements) {
    if (ts.isFunctionDeclaration(st) && st.name) {
      const isAsync = (st.modifiers || []).some(m => m.kind === ts.SyntaxKind.AsyncKeyword);
      decls.push({ name: st.name.text, kind: isAsync ? 'async function' : 'function', node: st });
    } else if (ts.isVariableStatement(st)) {
      const flags = st.declarationList.flags;
      const kind = flags & ts.NodeFlags.Const ? 'const' : flags & ts.NodeFlags.Let ? 'let' : 'var';
      for (const d of st.declarationList.declarations) {
        for (const n of bindingNames(d.name, [])) decls.push({ name: n, kind, node: d, initKind: classifyInit(d.initializer, text), destructured: !ts.isIdentifier(d.name) });
      }
    } else loose.push(st);
  }
  for (const d of decls) {
    d.start = lineOf(sf, d.node.getStart()); d.end = lineOf(sf, d.node.getEnd());
    d.lines = d.end - d.start + 1;
    d.reads = new Set(); d.writes = new Set(); d.readBy = new Set(); d.writtenBy = new Set();
    byName.set(d.name, d);
  }
  // Walk each declaration (and each loose statement) collecting references to
  // top-level names that are not shadowed by a local declaration of the same name.
  function refs(node, owner) {
    const shadow = [];
    function declaredHere(n) {
      const names = [];
      if ((ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n)) && n !== node) {
        for (const p of n.parameters) bindingNames(p.name, names);
        if (ts.isFunctionExpression(n) && n.name) names.push(n.name.text);
      }
      if (ts.isBlock(n) || ts.isSourceFile(n) || ts.isCaseBlock(n) || ts.isForStatement(n) || ts.isForOfStatement(n) || ts.isForInStatement(n)) {
        const list = ts.isCaseBlock(n) ? n.clauses.flatMap(c => c.statements) : ts.isBlock(n) ? n.statements : [];
        for (const s of list) {
          if (ts.isVariableStatement(s)) for (const d of s.declarationList.declarations) bindingNames(d.name, names);
          if (ts.isFunctionDeclaration(s) && s.name) names.push(s.name.text);
        }
        if ((ts.isForStatement(n) || ts.isForOfStatement(n) || ts.isForInStatement(n)) && n.initializer && ts.isVariableDeclarationList(n.initializer)) for (const d of n.initializer.declarations) bindingNames(d.name, names);
      }
      if (ts.isCatchClause(n) && n.variableDeclaration) bindingNames(n.variableDeclaration.name, names);
      return names;
    }
    const isShadowed = name => shadow.some(s => s.includes(name));
    (function visit(n) {
      const local = declaredHere(n);
      if (local.length) shadow.push(local);
      if (ts.isIdentifier(n) && byName.has(n.text) && !isShadowed(n.text)) {
        const p = n.parent;
        const isPropName = (ts.isPropertyAccessExpression(p) && p.name === n) || (ts.isPropertyAssignment(p) && p.name === n) || (ts.isMethodDeclaration(p) && p.name === n);
        const isDeclName = (ts.isFunctionDeclaration(p) || ts.isVariableDeclaration(p) || ts.isBindingElement(p) || ts.isParameter(p)) && p.name === n;
        const isShorthand = ts.isShorthandPropertyAssignment(p);
        if (!isPropName && !isDeclName || isShorthand) {
          const target = byName.get(n.text);
          const isWrite = (ts.isBinaryExpression(p) && p.left === n && p.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && p.operatorToken.kind <= ts.SyntaxKind.LastAssignment)
            || ((ts.isPrefixUnaryExpression(p) || ts.isPostfixUnaryExpression(p)) && (p.operator === ts.SyntaxKind.PlusPlusToken || p.operator === ts.SyntaxKind.MinusMinusToken));
          if (owner) {
            if (target !== owner || isWrite) {
              if (isWrite) { owner.writes.add(n.text); target.writtenBy.add(owner.name); }
              else if (target !== owner) { owner.reads.add(n.text); target.readBy.add(owner.name); }
            }
          } else {
            if (isWrite) target.writtenBy.add('(init)'); else target.readBy.add('(init)');
          }
        }
      }
      ts.forEachChild(n, visit);
      if (local.length) shadow.pop();
    })(node);
  }
  for (const d of decls) refs(d.node, d);
  for (const st of loose) refs(st, null);
  for (const d of decls) d.mutable = d.kind !== 'const' && d.kind !== 'function' && d.kind !== 'async function' && d.writtenBy.size > 0;
  return { file, text, sf, decls, byName, loose };
}

function metrics(text) {
  const count = re => (text.match(re) || []).length;
  return {
    lines: text.split('\n').length,
    bytes: Buffer.byteLength(text),
    addEventListener: count(/\.addEventListener\(/g),
    removeEventListener: count(/\.removeEventListener\(/g),
    setTimeout: count(/\bsetTimeout\(/g),
    setInterval: count(/\bsetInterval\(/g),
    clearTimeout: count(/\bclearTimeout\(/g),
    observers: count(/new (Mutation|Intersection|Resize|Performance)Observer\(/g),
    supabaseFrom: count(/supabase\s*\.from\(/g),
    supabaseRpc: count(/supabase\s*\.rpc\(|callStockFunction\(/g),
    domQueries: count(/\b(getElementById|querySelector|querySelectorAll|getElementsBy\w+)\(/g),
    innerHTMLSinks: count(/\.(innerHTML|outerHTML)\s*=|insertAdjacentHTML\(/g),
    styleWrites: count(/\.style\.[a-zA-Z]+\s*=|\.style\.cssText\s*=|\.style\.setProperty\(/g),
    inlineStyleAttrsInTemplates: count(/style="/g),
    evalLike: count(/\beval\(|new Function\(/g),
    consoleCalls: count(/console\.(log|warn|error|info|debug)\(/g),
  };
}

function summary(a) {
  const fns = a.decls.filter(d => /function/.test(d.kind));
  const vars = a.decls.filter(d => !/function/.test(d.kind));
  const mutable = vars.filter(d => d.mutable);
  const shared = vars.filter(d => d.readBy.size + d.writtenBy.size >= 2);
  return {
    ...metrics(a.text),
    topLevelFunctions: fns.length,
    asyncFunctions: fns.filter(d => d.kind === 'async function').length,
    topLevelConstLet: vars.length,
    mutableTopLevel: mutable.length,
    sharedVariables: shared.length,
    sharedMutable: shared.filter(d => d.mutable).length,
    domReferenceConsts: vars.filter(d => d.initKind === 'dom-reference').length,
    largestFunctions: fns.slice().sort((x, y) => y.lines - x.lines).slice(0, 10).map(d => `${d.name} (${d.lines} lines, L${d.start})`),
  };
}

// A declaration is "extractable" when everything it reads is either an outer
// global (not a top-level name) or another extractable declaration, and it
// writes no top-level variable. Fixed point over the graph.
function candidates(a) {
  const ok = new Set(a.decls.filter(d => /function/.test(d.kind) || d.kind === 'const').map(d => d.name));
  let changed = true;
  while (changed) {
    changed = false;
    for (const name of [...ok]) {
      const d = a.byName.get(name);
      if (d.writes.size || [...d.reads].some(r => !ok.has(r)) || (d.kind === 'const' && d.initKind === 'dom-reference')) { ok.delete(name); changed = true; }
    }
  }
  return [...ok].map(n => a.byName.get(n));
}

function toJson(a) {
  return {
    file: path.relative(ROOT, a.file),
    generatedBy: 'tests/tools/app-graph.js',
    summary: summary(a),
    declarations: a.decls.map(d => ({
      name: d.name, kind: d.kind, start: d.start, end: d.end, lines: d.lines, init: d.initKind || null, mutable: !!d.mutable,
      reads: [...d.reads].sort(), writes: [...d.writes].sort(), readBy: [...d.readBy].sort(), writtenBy: [...d.writtenBy].sort(),
    })),
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const a = analyse();
  if (args.includes('--json')) {
    const out = args[args.indexOf('--json') + 1];
    const json = JSON.stringify(toJson(a), null, 1) + '\n';
    if (out && !out.startsWith('--')) { fs.writeFileSync(out, json); console.log('wrote', out); } else process.stdout.write(json);
  } else if (args.includes('--candidates')) {
    const c = candidates(a);
    console.log(c.length + ' extractable declarations (' + c.reduce((s, d) => s + d.lines, 0) + ' lines):');
    for (const d of c.sort((x, y) => x.start - y.start)) console.log(`  L${d.start}\t${d.lines}\t${d.kind}\t${d.name}\t<- ${[...d.reads].join(',')}`);
  } else console.log(JSON.stringify(summary(a), null, 1));
}
module.exports = { analyse, summary, candidates, toJson, metrics };
