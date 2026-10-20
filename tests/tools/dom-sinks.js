// EXT15 DOM sink audit for the owner page's program and modules.
//   node tests/tools/dom-sinks.js            → counts by sink and by class
//   node tests/tools/dom-sinks.js --review   → every interpolation that needs a human look
//   node tests/tools/dom-sinks.js --gate     → EXT18 gate (exit 1 on failure):
//       • dangerous sinks (outerHTML, insertAdjacentHTML, document.write, eval/Function,
//         setAttribute('on…')) must stay at 0;
//       • innerHTML / href-src counts may not rise above the ceilings in dom-sinks-reviewed.json;
//       • every REVIEW interpolation must be listed (by file + expression text, not line) in
//         dom-sinks-reviewed.json with a reason; a new one fails, and so does a stale entry.
// Sinks: innerHTML / outerHTML assignments, insertAdjacentHTML, document.write,
// eval / new Function, setAttribute('on…'), href/src assignment, style writes.
// Each ${…} inside an HTML-producing template is classed:
//   ESCAPED   esc(...) / escAttr / csvCell / encodeURIComponent
//   NUMERIC   numbers, counts, .length, toFixed, fmtMoney/fmtDate*/timeAgo (formatters return plain text)
//   BUILDER   a call to a function that returns HTML built the same way (followed by name)
//   LITERAL   a ternary or expression made only of string literals
//   REVIEW    anything else (listed with --review)
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const ROOT = path.join(__dirname, '..', '..');
const FILES = ['assets/owner-login-app.js', ...fs.readdirSync(path.join(ROOT, 'assets', 'app')).filter(f => f.endsWith('.js')).map(f => 'assets/app/' + f)];
const ESCAPERS = /^(esc|escAttr|csvCell|encodeURIComponent|maskSensitive)$/;
const FORMATTERS = /^(fmtMoney|fmtDate|fmtDateOnly|fmtTimeShort|timeAgo|formatFigure|fmtAccountNumber|deviceLabel|localDateString|String|Number|Math\.\w+|toLocaleString|toFixed|reportCount)$/;
function classify(expr, sf) {
  const t = expr.getText(sf);
  if (ts.isCallExpression(expr)) {
    const callee = expr.expression.getText(sf);
    const name = callee.split('.').pop();
    if (ESCAPERS.test(name)) return 'ESCAPED';
    if (FORMATTERS.test(name) || FORMATTERS.test(callee)) return 'NUMERIC';
    if (/Html$|^render|^pageIconSvg$|^describeChange$|^codeDiff$|^skeletonRows$|^personalEventEditorHtml$|^docExpiryBadge$|^agentJobHealthHtml$|Badge$|^pageLinkHtml$|^eventHtml$|^noteEditorHtml$|^tile$|^card$|^row$|map$|join$/.test(name)) return 'BUILDER';
    if (name === 'join' || name === 'map') return 'BUILDER';
  }
  if (ts.isNumericLiteral(expr) || /\.length$|Count$|^n$|^i$|^count|total|^pct|Pct$|_count$|Index$/.test(t)) return 'NUMERIC';
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return 'LITERAL';
  if (ts.isConditionalExpression(expr)) {
    const a = classify(expr.whenTrue, sf), b = classify(expr.whenFalse, sf);
    const rank = { REVIEW: 4, BUILDER: 3, NUMERIC: 2, ESCAPED: 1, LITERAL: 0 };
    return rank[a] >= rank[b] ? a : b;
  }
  if (ts.isTemplateExpression(expr)) return expr.templateSpans.map(s => classify(s.expression, sf)).reduce((w, c) => (['REVIEW', 'BUILDER', 'NUMERIC', 'ESCAPED', 'LITERAL'].indexOf(c) < ['REVIEW', 'BUILDER', 'NUMERIC', 'ESCAPED', 'LITERAL'].indexOf(w) ? c : w), 'LITERAL');
  if (ts.isParenthesizedExpression(expr)) return classify(expr.expression, sf);
  if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.BarBarToken) return classify(expr.left, sf) === 'REVIEW' ? 'REVIEW' : classify(expr.right, sf);
  if (/^(html|out|rows|body|parts|items|cards|list|inner|content|extra|actions|badges|chips|links)\w*$/i.test(t)) return 'BUILDER'; // locally built HTML strings
  if (/^[A-Z_]+$/.test(t)) return 'LITERAL'; // constants
  return 'REVIEW';
}
function audit(files = FILES, read = f => fs.readFileSync(path.join(ROOT, f), 'utf8')) {
  const counts = { innerHTML: 0, outerHTML: 0, insertAdjacentHTML: 0, documentWrite: 0, evalLike: 0, setAttributeOn: 0, hrefSrcAssign: 0, styleWrites: 0 };
  const classes = { ESCAPED: 0, NUMERIC: 0, BUILDER: 0, LITERAL: 0, REVIEW: 0 };
  const review = [], items = [];
  for (const f of files) {
    const text = read(f);
    const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const inspect = rhs => {
      (function visit(n) {
        if (ts.isTemplateExpression(n)) for (const span of n.templateSpans) {
          const c = classify(span.expression, sf);
          classes[c]++;
          if (c === 'REVIEW') items.push({ file: f, expr: norm(span.expression.getText(sf)) });
          if (c === 'REVIEW') review.push(`${f}:${sf.getLineAndCharacterOfPosition(span.expression.getStart()).line + 1}  \${${span.expression.getText(sf).slice(0, 80)}}`);
        }
        ts.forEachChild(n, visit);
      })(rhs);
    };
    (function visit(n) {
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(n.left)) {
        const p = n.left.name.text;
        if (p === 'innerHTML' || p === 'outerHTML') { counts[p]++; inspect(n.right); }
        if (p === 'href' || p === 'src') counts.hrefSrcAssign++;
        if (ts.isPropertyAccessExpression(n.left.expression) && n.left.expression.name.text === 'style') counts.styleWrites++;
      }
      if (ts.isCallExpression(n)) {
        const c = n.expression.getText(sf);
        if (/\.insertAdjacentHTML$/.test(c)) { counts.insertAdjacentHTML++; n.arguments[1] && inspect(n.arguments[1]); }
        if (/^document\.write/.test(c)) counts.documentWrite++;
        if (c === 'eval' || c === 'Function') counts.evalLike++;
        if (/\.setAttribute$/.test(c) && n.arguments[0] && /^['"]on/i.test(n.arguments[0].getText(sf))) counts.setAttributeOn++;
        if (/\.style\.setProperty$/.test(c)) counts.styleWrites++;
      }
      if (ts.isNewExpression(n) && n.expression.getText(sf) === 'Function') counts.evalLike++;
      ts.forEachChild(n, visit);
    })(sf);
  }
  return { counts, classes, review, items };
}
const norm = t => t.replace(/\s+/g, ' ').trim();
const DANGEROUS = ['outerHTML', 'insertAdjacentHTML', 'documentWrite', 'evalLike', 'setAttributeOn'];
const REVIEWED = path.join(__dirname, 'dom-sinks-reviewed.json');
// Returns a list of failures (empty = pass). Pure, so the self-test can feed it planted code.
function gate(r, reviewed = JSON.parse(fs.readFileSync(REVIEWED, 'utf8'))) {
  const fails = [];
  for (const k of DANGEROUS) if (r.counts[k] !== 0) fails.push(`dangerous sink ${k} = ${r.counts[k]} (must be 0)`);
  for (const [k, max] of Object.entries(reviewed.ceilings)) if (r.counts[k] > max) fails.push(`${k} = ${r.counts[k]}, above the ceiling ${max} (lower is fine; raise only with a reviewed reason)`);
  const have = new Map();
  for (const it of r.items) { const key = it.file + '\u0000' + it.expr; have.set(key, (have.get(key) || 0) + 1); }
  const allowed = new Map(reviewed.interpolations.map(e => [e.file + '\u0000' + norm(e.expr), e]));
  for (const e of reviewed.interpolations) if (!e.reason || e.reason.length < 10) fails.push(`reviewed entry without a reason: ${e.file} \${${e.expr}}`);
  for (const [key, n] of have) {
    const e = allowed.get(key), [file, expr] = key.split('\u0000');
    if (!e) fails.push(`UNREVIEWED interpolation in HTML: ${file} \${${expr.slice(0, 100)}} (escape it with esc(), or review it and add it to dom-sinks-reviewed.json)`);
    else if (n > e.count) fails.push(`${file} \${${expr.slice(0, 100)}} appears ${n} times, ${e.count} reviewed`);
  }
  for (const [key, e] of allowed) if (!have.has(key)) fails.push(`stale reviewed entry (no longer in the code; remove it): ${e.file} \${${e.expr.slice(0, 100)}}`);
  return fails;
}
if (require.main === module) {
  const r = audit();
  console.log(JSON.stringify({ files: FILES.length, sinks: r.counts, interpolations: r.classes }, null, 1));
  if (process.argv.includes('--review')) r.review.forEach(x => console.log('REVIEW ' + x));
  if (process.argv.includes('--gate')) {
    const fails = gate(r);
    fails.forEach(x => console.log('GATE FAIL ' + x));
    console.log(fails.length ? `DOM SINK GATE: FAIL (${fails.length})` : `DOM SINK GATE: PASS (${r.items.length} reviewed interpolations, dangerous sinks 0)`);
    process.exit(fails.length ? 1 : 0);
  }
}
module.exports = { audit, gate, norm, FILES };
