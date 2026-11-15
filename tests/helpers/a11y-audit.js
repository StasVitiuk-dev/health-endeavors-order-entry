// Shared in-page accessibility audits (moved here from ops-flags-a11y-ext21 on
// Nov 15 so the Sales workbench sweep can use the same checks). Each function
// is self-contained: Playwright serializes it into the page via evaluate().

// Visible controls with no accessible name, inside the given root.
function unnamedControls(root) {
  const visible = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const labelFor = el => el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
  const name = el => (el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('placeholder') || el.textContent || el.value || (labelFor(el) && labelFor(el).textContent) || (el.closest('label') && el.closest('label').textContent) || el.getAttribute('aria-labelledby') || '').trim();
  const out = [];
  root.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button]').forEach(el => {
    if (!visible(el)) return;
    if (el.tagName === 'SELECT') { if (!name(el) && !(el.options[0] && el.options[0].textContent.trim())) out.push(el.outerHTML.slice(0, 120)); return; }
    if (el.tagName === 'INPUT' && ['checkbox', 'radio'].includes(el.type)) { if (!name(el)) out.push(el.outerHTML.slice(0, 120)); return; }
    if (!name(el) && !el.querySelector('svg title, img[alt]:not([alt=""])')) out.push(el.outerHTML.slice(0, 120));
  });
  return out;
}

// Contrast-ratio failures (WCAG AA) for every element that has text of its own.
function contrastFailures(root) {
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const bgOf = el => {
    const layers = []; let e = el;
    while (e) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; } e = e.parentElement; }
    let baseC = layers.pop() || { r: 255, g: 255, b: 255, a: 1 };
    while (layers.length) { const t = layers.pop(); baseC = { r: t.r * t.a + baseC.r * (1 - t.a), g: t.g * t.a + baseC.g * (1 - t.a), b: t.b * t.a + baseC.b * (1 - t.a), a: 1 }; }
    return baseC;
  };
  const out = [];
  root.querySelectorAll('*').forEach(el => {
    const ownText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (!ownText || el.offsetParent === null || el.disabled) return;
    const fg = parse(getComputedStyle(el).color); if (!fg) return;
    const L1 = lum(fg), L2 = lum(bgOf(el));
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const cs = getComputedStyle(el); const size = parseFloat(cs.fontSize); const bold = Number(cs.fontWeight) >= 700;
    if (ratio < ((size >= 24 || (size >= 18.66 && bold)) ? 3 : 4.5)) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} ${ratio.toFixed(2)}`);
  });
  return out;
}

module.exports = { unnamedControls, contrastFailures };
