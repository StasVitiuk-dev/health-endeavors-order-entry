# Property, chaos and soak testing (EXT15)

Status: **CURRENT on the feature branch only. MEASURED LOCALLY** on synthetic data (test mock, local staging build). Nothing here touches production.

## 1. In plain English

Ordinary tests check situations someone thought of. The tests in this document generate **thousands of random situations from a fixed starting number (a "seed")**, so they find cases nobody thought of, and a failure can be replayed exactly by running the same seed again.

They found **4 real problems**, all fixed in this branch:

| # | Found by | Problem | Fix |
|---|---|---|---|
| 1 | property test (nightly check) | a blank or malformed "problems found" count on the nightly integrity check showed **PASS** | only a real whole number counts; anything else is UNKNOWN |
| 2 | malformed-data test | an AI agent whose on/off value was not a clear on/off (`'yes'`, `1`, empty) showed as **Enabled** | shown as Unknown |
| 3 | dead-code check, then a test | if this month's AI spend could not be read, the AI page showed **"$0.00 spent, $30.00 remaining"** | shows "?" and "could not be read" |
| 4 | UI chaos test, seed 1501 | the "You are offline" bar covered the menu button, Refresh and Sign out; on a narrow screen an operator who went offline **could not open the menu** | the bar sits at the bottom and lets clicks through |

## 2. The suites

| Spec | What is random | Checked after every step | Seeds / size |
|---|---|---|---|
| `property-node-ext15.spec.js` (Node only) | CSV cells (formula starters, quotes, commas, line breaks, Unicode, RTL marks); dates across 3 time zones, DST, month/year ends, leap days; database error shapes; text with fake tokens/e-mails; nightly-check rows; money values | CSV reads back exactly with an independent parser and no cell can start a formula; date helpers agree with an independent `Intl` oracle; the error explainer never crashes or says "undefined"; masking removes every fake secret; malformed counts are UNKNOWN, never PASS; malformed money shows "—" | 3 CSV seeds × 2,000 cells; 3 time zones × 3 years; 3 error seeds; 2,000 masking strings |
| `xss-property-ext15.spec.js` | hostile text (script tags, event attributes, SVG, `javascript:`/`data:` links, broken Unicode, very long text) put into customer, product, supplier, task, incident, question, approval, expense and return text | nothing becomes an element or runs; the activity export has no formula cells; the diagnostic summary copies safely | seeds 151–153 (phone: 151); >25 fields per run |
| `chaos-ui-ext15.spec.js` | 70 operator steps: page changes, Back/Forward, palette, search (including `"; DROP` and Chinese text), window resize, offline/online, double clicks on task buttons, slow replies | no script error; the dashboard is still shown with exactly one page open; one click never sends two task changes; no step may hang (45 s limit, names the step) | seeds 1501–1503 desktop, 1501 phone; + an offline-bar regression test |
| `malformed-data-ext15.spec.js` | broken rows (missing ids/names, impossible dates and amounts, unknown statuses, wrong types) on 11 tables; 50,000-character names; 5,000 overdue tasks | no script error and no "NaN", "Invalid Date", "undefined", "[object Object]" on any page; pages draw within 8 s; Home counts all 5,000 but draws a bounded list; malformed agent switch is Unknown; failed spend read is "?" | fixed data |
| `session-expiry-reads-ext15.spec.js` | the sign-in expires while reading | after Refresh every Home figure is "?" with "could not be read" and an expiry message; an activity export fails with an error and produces no file; the diagnostic summary still appears and says the database could not be read | — |
| `soak-ext15.spec.js` | overlays opened and closed hundreds of times; an accelerated working day (page changes, searches, edits, sign-out/in) | Chrome's own counters (listeners, DOM nodes) and live timers do not keep growing after a warm-up round | bounded (minutes, not hours) |
| `staging-ext15.spec.js` | 4 new staging scenarios; scenario switching; two builds; a planted backups path | the scenario shows the honest state; switching never carries data over; builds are byte-identical; the firewall deletes a contaminated build | offline staging build |

## 3. How to replay a failure

Every failure message names the seed and the last steps, e.g. `UI chaos seed 1501 failed at step 46 after: resize, back, page, …`. Run the same test with `-g "seed 1501"`; the steps repeat exactly.

## 4. What these tests do NOT prove

- **Long soak**: the soak tests run for minutes with an accelerated clock, not for a real 8-hour day. A 60–120 minute soak is EXT16 work.
- **Real browsers other than Chromium**, real phones, real Safari: NOT VERIFIED.
- **Shrinking**: a failing random sequence is not automatically cut down to the smallest one yet (the step log is printed instead). PROPOSED for EXT16.
- **Database-side randomness** (random interleavings of stock functions) is in the local database suite (`random_interleavings.sh`, seed 909), not here.
