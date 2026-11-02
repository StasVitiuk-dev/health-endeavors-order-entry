# DOM and Trusted Types (EXT19)

Status: **CURRENT on the feature branch.** Trusted Types is still **not enforced**.

## 1. Safe element builder

`h(tag, attrs, ...children)` in `assets/app/he-ui.js`:

- creates elements with `createElement`;
- sets attributes with `setAttribute`;
- adds every string as **text**, so data can never become markup;
- refuses `on…` and `srcdoc` attributes.

`pageIconNode()` builds the page icons as SVG shapes from the fixed icon table, with no HTML parsing. It accepts only `path`, `circle` and `rect` with geometry attributes.

**Converted to it:** the whole sidebar (pinned pages, search results, the "look up in all orders" box, page groups) and the loading skeletons.

## 2. Measured (report-only `require-trusted-types-for 'script'`, all 26 pages opened)

| | EXT17/18 | EXT19 |
|---|---|---|
| Violations | 168 | **86** |
| Distinct code locations | 86 | 84 |
| Busiest location | skeletons in `assets/app/he-ui.js` (42), sidebar (40) | agent registry (3); the rest 1 each |
| `innerHTML` assignments (static count) | 160 | 159 (ceiling lowered) |

## 3. Proof

`dom-builder-ext19.spec.js`:

- 3,000 generated hostile strings stay text and plain attribute values, and nothing runs;
- handler attributes are refused;
- every real icon is built correctly, and hostile icon markup is ignored;
- hostile record text in sidebar search shows as text.

3 mutants, all caught:

- the builder adds text as HTML;
- the builder accepts handler attributes;
- the icon builder accepts any tag.

## 4. Remaining work to enforce Trusted Types

The 84 remaining locations are one-off page renders (tables, cards, histories). Each needs converting to `h()`, or routing through one narrow escaping policy. Enforce only when the probe shows zero, with no pass-through policy. This is planned as the next waves (EXT20 Part 22).
