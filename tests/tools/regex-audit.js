// EXT18 slow-regex (ReDoS) audit of every regular expression the dashboard ships.
//   node tests/tools/regex-audit.js        → summary, exit 1 on a finding
// Each regex literal in assets/**/*.js is (1) checked for the shapes that can
// take exponential time (a quantified group that itself contains a
// quantifier, e.g. (a+)+ or (\s*x)*), and (2) actually run against hostile
// inputs: 20,000-character runs of the characters it is likely to match,
// followed by a character that makes the match fail. Any single run over
// LIMIT_MS is a finding. new RegExp(...) built from data is reported too,
// so it gets a look.
// tests/tools/regex-audit-reviewed.json lists the slow-on-huge-input patterns
// whose input is capped in the code: each is re-timed at its stated maxInput
// (which must stay under LIMIT_MS), keyed by file + pattern text, not line.
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const ROOT = path.join(__dirname, '..', '..');
const LIMIT_MS = 50;

function files() {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
      const p = d + '/' + e.name;
      if (e.isDirectory()) walk(p); else if (e.name.endsWith('.js')) out.push(p);
    }
  })('assets');
  return out;
}

// A quantified group whose body has its own unbounded quantifier.
function nestedQuantifier(src) {
  const stack = [];
  let esc = false, cls = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (esc) { esc = false; if (stack.length && /[dws.DWS]/.test(c)) stack[stack.length - 1].atom = true; continue; }
    if (c === '\\') { esc = true; continue; }
    if (cls) { if (c === ']') cls = false; continue; }
    if (c === '[') { cls = true; continue; }
    if (c === '(') { stack.push({ inner: false }); continue; }
    if (c === ')') {
      const g = stack.pop() || { inner: false };
      const q = src[i + 1];
      const unbounded = q === '+' || q === '*' || (q === '{' && /^\{\d+,\}/.test(src.slice(i + 1)));
      if (unbounded && g.inner) return true;
      if (stack.length && (g.inner || unbounded)) stack[stack.length - 1].inner = true;
      continue;
    }
    if ((c === '+' || c === '*') && stack.length) stack[stack.length - 1].inner = true;
    if (c === '{' && /^\{\d+,\}/.test(src.slice(i)) && stack.length) stack[stack.length - 1].inner = true;
  }
  return false;
}

const N = 20000;
const probes = n => [' ', 'a', '0', '1', ',', '.', '-', '_', '=', '\t', '\n', 'A', '@', '/', ':', '$', '%', 'é', '‮']
  .flatMap(ch => [ch.repeat(n) + '!', ch.repeat(n) + '\u0000', 'x' + ch.repeat(n)])
  .concat(['a1'.repeat(n / 2) + '!', 'a '.repeat(n / 2) + '!', '1,'.repeat(n / 2) + 'x', '-1'.repeat(n / 2) + '$', '<a '.repeat(n / 3) + '"', 'aa@'.repeat(n / 3)]);
const PROBES = probes(N);
const REVIEWED = path.join(__dirname, 'regex-audit-reviewed.json');
// slowest probe; each probe's time is the best of 3 runs (a busy machine only adds time)
const time1 = (re, p) => { const t0 = process.hrtime.bigint(); re.test(p); return Number(process.hrtime.bigint() - t0) / 1e6; };
const worst = (re, list) => { let w = 0; for (const p of list) { let t = time1(re, p); if (t > LIMIT_MS / 5) t = Math.min(t, time1(re, p), time1(re, p)); w = Math.max(w, t); if (w > LIMIT_MS) break; } return w; };

function audit(reviewed = JSON.parse(fs.readFileSync(REVIEWED, 'utf8'))) {
  const findings = [], dynamic = [], used = new Set();
  const byKey = new Map(reviewed.patterns.map(e => [e.file + '\u0000' + e.regex, e]));
  let count = 0;
  for (const f of files()) {
    const text = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    (function visit(n) {
      if (n.kind === ts.SyntaxKind.RegularExpressionLiteral) {
        count++;
        const lit = n.getText(sf);
        const at = `${f}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;
        const m = /^\/(.*)\/([a-z]*)$/s.exec(lit);
        let re;
        try { re = new RegExp(m[1], m[2].replace('g', '').replace('y', '')); } catch (e) { findings.push(`${at} does not compile: ${lit}`); return; }
        if (nestedQuantifier(m[1])) findings.push(`${at} nested quantifier (can take exponential time): ${lit.slice(0, 80)}`);
        const ms = worst(re, PROBES);
        if (ms > LIMIT_MS) {
          const e = byKey.get(f + '\u0000' + lit);
          if (!e) findings.push(`${at} took ${ms.toFixed(0)} ms on a ${N}-character input: ${lit.slice(0, 80)} (cap its input and list it in regex-audit-reviewed.json, or rewrite it)`);
          else {
            used.add(e);
            const capped = worst(re, probes(e.maxInput));
            if (capped > LIMIT_MS) findings.push(`${at} still takes ${capped.toFixed(0)} ms at its reviewed cap of ${e.maxInput} characters: ${lit.slice(0, 80)}`);
          }
        }
      }
      if ((ts.isNewExpression(n) || ts.isCallExpression(n)) && /^(window\.)?RegExp$/.test(n.expression.getText(sf))) {
        const a0 = n.arguments && n.arguments[0];
        if (!a0 || !(ts.isStringLiteral(a0) || ts.isNoSubstitutionTemplateLiteral(a0))) dynamic.push(`${f}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`);
      }
      ts.forEachChild(n, visit);
    })(sf);
  }
  for (const e of reviewed.patterns) {
    if (!used.has(e)) findings.push(`stale reviewed pattern (not found, or no longer slow; remove it): ${e.file} ${e.regex.slice(0, 60)}`);
    if (!e.reason || !e.maxInput) findings.push(`reviewed pattern without a reason or cap: ${e.file} ${e.regex.slice(0, 60)}`);
  }
  for (const d of dynamic) if (!(reviewed.dynamic || []).some(x => d.startsWith(x.file + ':'))) findings.push(`RegExp built at run time, not reviewed: ${d}`);
  return { count, findings, dynamic };
}

if (require.main === module) {
  const r = audit();
  r.findings.forEach(x => console.log('FINDING ' + x));
  r.dynamic.forEach(x => console.log('DYNAMIC RegExp (built at run time; review) ' + x));
  console.log(r.findings.length ? `REGEX AUDIT: FAIL (${r.findings.length})` : `REGEX AUDIT: PASS (${r.count} regular expressions, ${r.dynamic.length} built at run time)`);
  process.exit(r.findings.length ? 1 : 0);
}
module.exports = { audit, nestedQuantifier };
