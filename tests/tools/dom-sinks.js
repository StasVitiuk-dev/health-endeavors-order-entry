// EXT15 DOM sink audit for the owner page's program and modules.
//   node tests/tools/dom-sinks.js            → counts by sink and by class
//   node tests/tools/dom-sinks.js --review   → every interpolation that needs a human look
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
function audit() {
  const counts = { innerHTML: 0, outerHTML: 0, insertAdjacentHTML: 0, documentWrite: 0, evalLike: 0, setAttributeOn: 0, hrefSrcAssign: 0, styleWrites: 0 };
  const classes = { ESCAPED: 0, NUMERIC: 0, BUILDER: 0, LITERAL: 0, REVIEW: 0 };
  const review = [];
  for (const f of FILES) {
    const text = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const inspect = rhs => {
      (function visit(n) {
        if (ts.isTemplateExpression(n)) for (const span of n.templateSpans) {
          const c = classify(span.expression, sf);
          classes[c]++;
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
  return { counts, classes, review };
}
if (require.main === module) {
  const r = audit();
  console.log(JSON.stringify({ files: FILES.length, sinks: r.counts, interpolations: r.classes }, null, 1));
  if (process.argv.includes('--review')) r.review.forEach(x => console.log('REVIEW ' + x));
}
module.exports = { audit };
