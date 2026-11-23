// EXT18 static security check for every page and script the dashboard ships.
//   node tests/tools/static-security.js        → prints findings, exit 1 if any
// Program code (assets/**/*.js) is read as a syntax tree, so comments and
// error-message text cannot cause false alarms. It fails on:
//   eval / Function / new Function, document.write(ln), setTimeout/setInterval
//   with a string, a created <script> element, setAttribute('on…' / 'srcdoc'),
//   .srcdoc / .outerHTML assignment, a 'message' listener (needs an origin
//   check and a review), markup strings with an inline on…= handler or a
//   javascript: link, target="_blank" without rel="noopener", window.open
//   without 'noopener', and navigation to a computed (non-literal) address.
// Pages (*.html) must have: no inline handlers, no javascript: links, the frame
// guard as the first script, only same-site scripts or the pinned library with
// integrity + crossorigin, a policy whose script-src names that exact library
// file (not the whole CDN), object-src 'none', base-uri 'self',
// form-action 'self', frame-src 'none', no unsafe-inline / unsafe-eval / * /
// data: for scripts, and referrer no-referrer.
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const ROOT = path.join(__dirname, '..', '..');

const HANDLER_IN_MARKUP = /<[a-z][^<>]*\son[a-z]+\s*=/i;
const JS_LINK_IN_MARKUP = /\b(href|src|action|formaction)\s*=\s*["']?\s*javascript:/i;
const BLANK_NO_OPENER = /target\s*=\s*["']?_blank(?![^<>]*rel\s*=\s*["'][^"']*noopener)/i;

function checkJs(text, name) {
  const out = [];
  const sf = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const at = n => `${name}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;
  const strArg = a => a && (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) ? a.text : null;
  (function visit(n) {
    if (ts.isCallExpression(n) || ts.isNewExpression(n)) {
      const c = n.expression.getText(sf);
      const a0 = n.arguments && n.arguments[0];
      if (c === 'eval' || c === 'window.eval' || c === 'Function' || c === 'window.Function') out.push(`${at(n)} code from a string (${c})`);
      if (/^(window\.)?document\.write(ln)?$/.test(c)) out.push(`${at(n)} document.write`);
      if (/^(window\.)?set(Timeout|Interval)$/.test(c) && a0 && (ts.isStringLiteral(a0) || ts.isTemplateExpression(a0) || ts.isNoSubstitutionTemplateLiteral(a0) || ts.isBinaryExpression(a0))) out.push(`${at(n)} ${c} with a string (runs it as code)`);
      if (/\.createElement$/.test(c) && /^script$/i.test(strArg(a0) || '')) out.push(`${at(n)} creates a <script> element`);
      if (/\.setAttribute(NS)?$/.test(c)) { const v = strArg(n.arguments[n.arguments.length === 3 ? 1 : 0]) || ''; if (/^on|^srcdoc$/i.test(v)) out.push(`${at(n)} setAttribute('${v}')`); }
      if (/\.addEventListener$/.test(c) && strArg(a0) === 'message') out.push(`${at(n)} 'message' listener (cross-window input; needs an origin check and a review)`);
      if (/^(window\.)?open$/.test(c) && !/noopener/.test(strArg(n.arguments[2]) || '')) out.push(`${at(n)} window.open without 'noopener'`);
      if (/location\.(assign|replace)$/.test(c) && a0 && !strArg(a0) && !/self\.location\.href$/.test(a0.getText(sf))) out.push(`${at(n)} navigation to a computed address`);
    }
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(n.left)) {
      const p = n.left.name.text, lhs = n.left.getText(sf);
      if (p === 'srcdoc' || p === 'outerHTML') out.push(`${at(n)} .${p} assignment`);
      if (/(^|\.)location(\.href)?$/.test(lhs) && !strArg(n.right)) out.push(`${at(n)} navigation to a computed address`);
    }
    // markup inside string / template text
    let raw = null;
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) raw = n.text;
    else if (ts.isTemplateExpression(n)) raw = n.head.text + n.templateSpans.map(s => '${}' + s.literal.text).join('');
    if (raw !== null && /</.test(raw)) {
      if (HANDLER_IN_MARKUP.test(raw)) out.push(`${at(n)} inline event handler in markup`);
      if (JS_LINK_IN_MARKUP.test(raw)) out.push(`${at(n)} javascript: link in markup`);
      if (BLANK_NO_OPENER.test(raw)) out.push(`${at(n)} target=_blank without rel=noopener`);
    }
    ts.forEachChild(n, visit);
  })(sf);
  return out;
}

function checkHtml(text, name) {
  const out = [];
  const tags = text.match(/<[a-z][^>]*>/gi) || [];
  for (const t of tags) {
    if (/\son[a-z]+\s*=/i.test(t)) out.push(`${name}: inline event handler ${t.slice(0, 80)}`);
    if (JS_LINK_IN_MARKUP.test(t)) out.push(`${name}: javascript: link`);
    if (BLANK_NO_OPENER.test(t)) out.push(`${name}: target=_blank without rel=noopener`);
    if (/^<form\b/i.test(t) && /\saction\s*=\s*["']?(https?:)?\/\//i.test(t)) out.push(`${name}: form posts to another site`);
    if (/^<(iframe|object|embed|base)\b/i.test(t)) out.push(`${name}: <${t.slice(1).split(/[\s>]/)[0]}> element`);
    // With no name, a field is never sent by the browser's own form submission
    // (e.g. if the scripts fail to load), so a password can never end up in the
    // address bar, history or a server log.
    if (/^<input\b/i.test(t) && /type="password"/i.test(t) && /\sname\s*=/i.test(t)) out.push(`${name}: password field with a name attribute (could be sent in the address)`);
    if (/^<form\b/i.test(t) && /\smethod\s*=\s*["']?get/i.test(t)) out.push(`${name}: form with method=get`);
  }
  const scripts = [...text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  if (!scripts.length || !/id="frameGuard"/.test(scripts[0][1])) out.push(`${name}: the frame guard is not the first script`);
  const csp = (/http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(text) || [])[1];
  if (!csp) { out.push(`${name}: no Content-Security-Policy`); return out; }
  const dir = n => { const d = csp.split(';').map(x => x.trim()).find(x => x === n || x.startsWith(n + ' ')); return d ? d.split(/\s+/).slice(1) : null; };
  const scriptSrc = dir('script-src') || [];
  for (const bad of ["'unsafe-inline'", "'unsafe-eval'", '*', 'data:', 'https:', 'http:', "'unsafe-hashes'", "'wasm-unsafe-eval'"]) if (scriptSrc.includes(bad)) out.push(`${name}: script-src allows ${bad}`);
  const libs = [];
  for (const [, attrs] of scripts) {
    const src = (/\ssrc="([^"]+)"/.exec(attrs) || [])[1];
    if (!src) continue;
    if (/^https?:\/\//.test(src)) {
      libs.push(src);
      if (!/\sintegrity="sha(384|512)-/.test(attrs) || !/\scrossorigin="anonymous"/.test(attrs)) out.push(`${name}: ${src} without integrity + crossorigin`);
    } else if (!/^assets\//.test(src)) out.push(`${name}: script from an unexpected place ${src}`);
  }
  for (const s of scriptSrc.filter(x => /^https?:/.test(x))) {
    if (!/\.js$/.test(s)) out.push(`${name}: script-src allows a whole host or folder (${s}); name the exact file`);
    else if (!libs.includes(s)) out.push(`${name}: script-src allows ${s}, which the page does not load`);
  }
  for (const l of libs) if (!scriptSrc.includes(l)) out.push(`${name}: the page loads ${l} but script-src does not name it`);
  const need = { 'object-src': "'none'", 'base-uri': "'self'", 'form-action': "'self'", 'frame-src': "'none'", 'default-src': "'self'" };
  for (const [d, v] of Object.entries(need)) if (!(dir(d) || []).includes(v) || (dir(d) || []).length !== 1) out.push(`${name}: ${d} must be exactly ${v}`);
  if (!/<meta name="referrer" content="no-referrer">/.test(text)) out.push(`${name}: no referrer=no-referrer`);
  return out;
}

function listFiles() {
  const js = [];
  (function walk(d) {
    for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
      const p = d + '/' + e.name;
      if (e.isDirectory()) walk(p); else if (e.name.endsWith('.js')) js.push(p);
    }
  })('assets');
  const html = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
  return { js, html };
}

function run() {
  const { js, html } = listFiles();
  const findings = [];
  for (const f of js) findings.push(...checkJs(fs.readFileSync(path.join(ROOT, f), 'utf8'), f));
  for (const f of html) findings.push(...checkHtml(fs.readFileSync(path.join(ROOT, f), 'utf8'), f));
  return { js: js.length, html: html.length, findings };
}

if (require.main === module) {
  const r = run();
  r.findings.forEach(x => console.log('FINDING ' + x));
  console.log(r.findings.length ? `STATIC SECURITY: FAIL (${r.findings.length})` : `STATIC SECURITY: PASS (${r.js} scripts, ${r.html} pages)`);
  process.exit(r.findings.length ? 1 : 0);
}
module.exports = { checkJs, checkHtml, run };
