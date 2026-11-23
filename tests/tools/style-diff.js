// Compares two style snapshots (tests/tools/style-snapshot.spec.js).
//   node tests/tools/style-diff.js before.json after.json   → exit 1 on any difference
const fs = require('fs');
const [a, b] = process.argv.slice(2).map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
let diffs = 0, elements = 0;
for (const page of Object.keys(a.pages)) {
  const x = a.pages[page], y = b.pages[page];
  if (!y) { console.log(`${page}: missing in second snapshot`); diffs++; continue; }
  if (x.length !== y.length) { console.log(`${page}: ${x.length} vs ${y.length} elements`); diffs++; continue; }
  for (let i = 0; i < x.length; i++) {
    elements++;
    if (x[i][0] !== y[i][0]) { console.log(`${page} #${i}: element ${x[i][0]} vs ${y[i][0]}`); diffs++; break; }
    x[i][1].forEach((v, k) => { if (v !== y[i][1][k]) { if (diffs < 60) console.log(`${page} #${i} ${x[i][0]} ${a.props[k]}: ${v} → ${y[i][1][k]}`); diffs++; } });
  }
}
console.log(diffs ? `DIFFERENCES: ${diffs}` : `IDENTICAL: ${Object.keys(a.pages).length} pages, ${elements} elements, ${a.props.length} properties each`);
process.exitCode = diffs ? 1 : 0;
