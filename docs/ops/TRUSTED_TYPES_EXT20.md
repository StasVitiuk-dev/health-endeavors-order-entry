# Trusted Types (EXT20)

Status: **CURRENT on the feature branch.** Supersedes `DOM_TRUSTED_TYPES_EXT19.md` §2 and §4. Trusted Types is still **not enforced**.

## 1. What changed

Every HTML string that was **fixed text** is now built as elements. That covers:

- empty states;
- "Loading…" placeholders;
- clearing a box;
- placeholder `<option>`s;
- the toast message;
- the activity digest's empty line.

The changes follow three patterns:

- `X.innerHTML = ''` → `X.replaceChildren()`;
- `<p class="empty">text</p>` → `h('p', { class: 'empty' }, 'text')` in the main page, and `Object.assign(document.createElement('p'), { className, textContent })` in modules that do not receive `h`;
- the toast now builds its message as a text node (`h('span', null, message)`); before, it parsed a fixed HTML skeleton and then set the text.

## 2. Measured (report-only `require-trusted-types-for 'script'`, all 26 pages opened)

| | EXT17/18 | EXT19 | **EXT20** |
|---|---|---|---|
| Violations | 168 | 86 | **56** |
| Distinct code locations | 86 | 84 | **54** |
| `innerHTML` assignments (static count, gate ceiling) | 160 | 159 | **109** |

Where the 54 locations are:

- `owner-login-app.js`: 35;
- `assets/app/he-compliance.js`: 6;
- `assets/app/he-suppliers.js`: 3;
- `assets/app/he-inquiries.js`, `assets/app/he-tasks.js`: 2 each;
- admin, agents, approvals, audit, expenses, incidents: 1 each.

**Ratchet:** `tests/specs/trusted-types-ext20.spec.js` fails if the violations rise above **56**, or if the probe reports 0 (that would mean it was silently switched off). The DOM sink gate ceiling (`dom-sinks-reviewed.json`) is **109**. No warning was hidden: the count comes from the browser's own report.

## 3. Classification of what remains (54 locations)

| Class | Count | Examples | Next step |
|---|---|---|---|
| Static trusted template | 0 | all converted in EXT19/EXT20 | — |
| Dynamic text only, escaped (`esc()` for every value) | about 45 | the record tables and cards: tasks, suppliers, POs, recalls, returns, tax, accounting, AI spend | convert each table to `h()` (mechanical but long; one page per change) |
| Dynamic markup composed from escaped parts | about 6 | palette rows (icon SVG plus text slots), the order lookup cache, the inspector history | needs a small safe fragment builder for SVG plus text |
| Icon / SVG path | inside the palette and sidebar | `pageIconSvg()` strings for the palette | `pageIconNode()` already exists (sidebar); use it in the palette |
| Third-party / library requirement | 0 | supabase-js does not write HTML | — |
| Difficult legacy | about 3 | the business-health card list and the nightly check cards (`card()` helper) | refactor `card()` to return a node |

Each remaining interpolation is either escaped, numeric, or one of the 52 hand-reviewed values in `dom-sinks-reviewed.json`. The gate fails on any new unreviewed value.

## 4. Other sinks (inventory)

| Sink | Count | Note |
|---|---|---|
| `outerHTML`, `insertAdjacentHTML`, `document.write`, `DOMParser`, `eval`/`new Function` | 0 | gate-enforced |
| `srcdoc` | 0 | refused by `h()` and by the static check |
| `setAttribute('on…')` | 0 | refused by `h()` |
| dynamic `href`/`src` assignment | 2 | both are `URL.createObjectURL(blob)` for CSV downloads (same-origin blob, not data) |
| dynamic script creation | 0 | |
| dynamic style writes | 47 | all fixed values, fixed tables (`SYSTEM_MODE_LABELS`, prototype-free), clamped numbers (`Math.min/max`), or a `#hex` colour checked by a regular expression; none takes a raw database value |

## 5. Enforcement readiness: **NOT YET SAFE**

Blockers:

1. 54 code locations still assign strings to `innerHTML`. Enforcing would break those pages.
2. A pass-through policy (`createHTML: s => s`) would satisfy the browser but protect nothing, so it is not used.

**Path:** convert the about-45 escaped tables to `h()`, then the 6 composed fragments, then enforce `require-trusted-types-for 'script'` with **no** default policy. Estimate: 2–3 focused changes. It is safe to do locally at any time; the ratchet test prevents slipping back.

## 6. Proof

- `trusted-types-ext20.spec.js`:
  - the ratchet;
  - 2,000 hostile toast messages stay text, and nothing runs;
  - empty states keep their words.
- `dom-builder-ext19.spec.js`: 3,000 hostile strings through `h()`.
- Mutants, all caught:
  - a toast shows its message as HTML;
  - a raw HTML string is restored;
  - a `javascript:` link becomes clickable again.
