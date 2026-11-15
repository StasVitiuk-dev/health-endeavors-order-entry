# Candid readiness assessment — what's missing for a "very good" dashboard (2026-11-03)

Independent assessment at local HEAD (visual commits ece7d35→9ba94d8 on top of pushed
9173ccf; all LOCAL, unpushed). Honest, not a 10/10 label. VERIFIED = I checked it this
session (cited); UNRUN/UNVERIFIED = not checked — stated as such, not assumed.

## How this was assessed (scope honesty)
I inspected ~6 real routes (Home, Employee Activity, Suppliers, Returns, Expenses,
Purchase Orders) plus a controls showcase, on the synthetic preview, on **Linux
Chromium (diagnostic build 1243), NOT Safari/iPhone**. I did NOT inspect all operations/
admin routes or the 47 Sales routes individually. Automated specs are correctness
evidence, not visual approval.

## Prioritized gap table
| # | User-visible problem | Route/workflow | Status / evidence | Acceptance criteria | Local now vs owner/external | Effort (rough, uncertainty) |
|---|---|---|---|---|---|---|
| 1 | Form fields are mostly full-width stacked; labels sometimes placeholder-only; date/priority/add alignment loose | reminder (Tasks), supplier add, PO, returns, expenses | **DONE** (ee68864, fd28c2d, e3ecf9d, bd7d814): shared `.heForm` labeled grid on Expenses, Returns, Supplier, Inventory-adjust, Add-product, PO; reminder kept as a proper quick-add bar. Verified light+dark, desktop+iPhone | Persistent labels; widths fit meaning; aligned rows desktop; clean mobile stacking; behavior/submit/date semantics unchanged | Local now | ✓ done |
| 2 | Tiny unstyled file chooser; no selected-filename/error feedback | Expenses (receipt), any upload | **DONE** (ee68864): `::file-selector-button` styled as a secondary control; native filename display kept. Filename-echo/inline validation not added (would need JS) | Styled, accessible file control showing chosen filename + type/error; no real upload | Local now (synthetic) | ✓ styling done; JS filename-echo optional |
| 3 | Report tables: intrinsic widths, descriptions span very wide, amounts not right-aligned | Accounting, Tax Records | HYPOTHESIS from owner report; NOT re-inspected this session | Intentional width/max-width; right-aligned numerics; consistent currency; responsive overflow; calculations/raw values preserved | Local now | M (1 day; medium) |
| 4 | Big blank areas, dense explanatory paragraphs, mixed radii on non-control boxes | multiple (Expenses intro, Activity, etc.) | PARTIAL: control radii fixed; container copy/empty density NOT done | Short empty states + next action; long copy in progressive detail; uncertainty/warnings stay visible; no invented metrics | Local now | M (1–2 days) |
| 5 | Home can show urgent checks yet "Nothing needs attention" elsewhere | Home (Needs Your Attention) | UNVERIFIED — not reproduced/traced this session | Confirm whether scopes differ; label scopes or fix real inconsistency; never suppress real warnings | Local now (trace first) | S to investigate; fix S–M |
| 6 | Accounts not discoverable as a list; only via Activity + search | Employee Activity, palette | VERIFIED accounts render (synthetic fixtures); real records NOT checked | OWNER DECISION: dedicated directory page vs Activity+search. No auth change | Owner decision → then local | Decision blocks; build S–M if yes |
| 7 | Open (expanded) native select menus look unstyled/different | all selects | VERIFIED closed controls fixed; open menus are OS-rendered | Closed controls consistent (done); document OS-menu limit OR build an accessible custom listbox if required | Local (custom listbox) if owner wants | L if custom (accessible combobox is real work) |
| 8 | Sales agents: what can the owner actually DO end-to-end? | Sales & Growth (flag ON) | UNVERIFIED this session — biggest unknown (see §Sales below) | A runnable import→qualify→draft→owner-approve(versioned)→SIMULATED send→reply-classify→audit, with DNC/idempotency, persistent labeled local state + reset | Local build (large) | L (multi-day; HIGH uncertainty until inspected) |
| 9 | Mailbox/provider sending | Sales outreach | Not built; transport disconnected by design | Secure backend/OAuth/transport/scheduling/deliverability DESIGN then build; mock provider only locally | Owner + external (credentials, provider, backend) | L+ (not "just add email") |
| 10 | Responsive/a11y across ALL routes + real Safari/iPhone/VoiceOver | whole app | UNRUN on real devices; automated a11y/contrast/forced-colors PASS (Linux Chromium) | Owner device pass at 1280–1440 / 700–900 / 320–390 / 200%; VoiceOver on key flows | Owner devices (I can't run Safari) | Owner time; my fixes S–M per finding |
| 11 | 279.7ms max-latency CI flake (search-palette) | automated test | VERIFIED cause UNCONFIRMED; not reproduced locally (~10ms) | Either reproduce+fix root cause or owner-agreed metric change; no silent loosening | Local investigation; metric change = owner | S–M; may stay open |

## Category assessment (evidence; no score where unassessed)
- Control consistency / dropdowns (closed): **VERIFIED much improved** — square, one chevron, test-covered. Open native menus remain OS-styled (expected).
- Palette/overall style parity: **VERIFIED restored** to 9173ccf (tokens byte-identical).
- Accessibility (contrast/focus/forced-colors): **PASS on Linux Chromium**; real VoiceOver/Safari **UNRUN**.
- Forms layout, tables, empty/loading/error polish, copy density, navigation hierarchy, responsive matrix: **NOT yet assessed/:done** — no score claimed.
- Sales-agent functional completeness: **UNVERIFIED** — no end-to-end claim.
- Reliability/perf: PR #35 CI green on 9173ccf; push-run red on the search-palette flake (cause unconfirmed); new local candidates have **local results only** until an owner-approved CI run.

## Top 5 priorities (practical)
1. Form layouts + accessible file picker (#1, #2) — highest daily-use payoff, fully local.
2. Report tables numeric alignment/width/overflow (#3) — core finance readability, local.
3. Empty states + copy density + Home-scope clarity (#4, #5) — "feels finished", local.
4. Sales-agent end-to-end INSPECTION then gap-fill (#8) — biggest unknown; inspect before estimating.
5. Owner device/a11y pass (#10) — only the owner can run Safari/iPhone/VoiceOver.

## "Ready for Stas to approve" — a practical definition
Technical/visual completion (what I can deliver locally): original colors preserved;
consistent square controls everywhere; the five form layouts done; tables aligned;
empty/error states tightened; a11y automated green; a clean synthetic preview + before/
after at the required viewports — with the owner's **real Safari/iPhone/VoiceOver** pass
recorded. This is DISTINCT from:
- Simulated functional completion (Sales agents runnable end-to-end on synthetic data,
  clearly labeled SIMULATED), and
- Production activation (real mailbox/providers, credentials, backend/OAuth, go-live
  decisions) — owner + external, not a visual task.

## Blockers to realistic estimates / decisions needed
- Sales-agent effort can't be firmly estimated until I inspect the actual execution/
  state/persistence wiring (not just module names).
- Accounts: directory-page vs Activity+search is an **owner choice** (not mine).
- Open-select styling: whether an accessible custom combobox is wanted (large) or the
  OS menu is acceptable (done).
- Real-device results are owner-supplied; I will not report Linux Chromium as Safari.
No promise of "perfect in a few days" — the form/table/empty-state tranche is a few
days of local work; Sales-agent completeness and provider readiness are larger and
partly owner/external.

## Progress log (local commits on claude/ext20-recovery-2026-10-31, unpushed)
All on top of pushed 9173ccf. Original colors preserved throughout; controls stay
square with the one-chevron fix; every change is structure/labels only.
- `9ba94d8` — restore original 9173ccf light/dark/system colors (kept control shape).
- `5ec614f` — this readiness assessment.
- `ee68864` — **Priority #1/#2**: Expenses form relaid out with the new shared
  `.heForm` labeled grid + styled receipt file picker.
- `fd28c2d` — Returns form on `.heForm` (Reason/Condition paired; find-older-order
  row kept).
- `e3ecf9d` — Suppliers, Inventory-adjust and Add-product forms on `.heForm`;
  reminder kept as a compact quick-add bar (new `.reminderForm` rule + priority
  aria-label); removed stale flex-basis classes that were making product price
  inputs render as tall boxes.
- `bd7d814` — Purchase Orders "Create draft" form on `.heForm`.
Verification each step: a11y-basics, select-chevron-ext21, pages-data (and
purchase-orders / targeted specs) green on the diagnostic Chromium; AA contrast
passes light+dark; phone tap-targets pass; inline-styles --check and
generated:check clean. The 6 inventory-safety ✘ seen while testing are
pre-existing `test.fail('not atomic yet')` cases (identical on the prior commit),
unrelated to these changes.

**Next (not started):** Priority #2 report tables (Accounting/Tax numeric
alignment/width/overflow); #3 empty states + copy density + Home-scope trace;
#4 Sales-agent end-to-end inspection before estimating. No push/merge/deploy
without explicit per-SHA owner approval.

## Update 2026-11-15 — status of the gap table (same local branch, unpushed)
The Nov 7 build took priority after this page was written; these points were picked
up again on Nov 15.

| # | Status now | Evidence |
|---|---|---|
| 3 Report tables | **Done for Tax Records and Report History** (`4b8c5d8`: number columns right-aligned, table uses the panel width). Accounting has no wide data table in the example data — its lists were looked at on Nov 15 and need no change | before/after pictures; `report-tables` checks in `4b8c5d8` |
| 4 Blank areas and dense paragraphs | **Done for the 15 longest page explanations and for empty states** (Nov 15): each long explanation shows a short lead, including any warning or stated limit, with the rest under "More about this" — nothing was deleted; empty states went from a 68 px blank band to a compact line. **Not done:** the mixed corner radii on non-control boxes (cards, tiles) were left as they are — the owner's Nov 3 correction limited the shape change to controls | `page-explanations-ext21` (5 tests); 249 accessibility / layout / policy checks pass |
| 5 Home "nothing needs attention" | **Traced and fixed** (`227aa76`): the two are different lists (computed checks vs. tasks, approvals, incidents, events, reminders). The empty message now names what is empty and points at the checks; no check is hidden | `attention-checks` |
| 2 File picker | Unchanged since `ee68864`: styled control, native file name shown; no inline validation message |  |
| 6, 7 | Still owner decisions (account directory page; custom dropdown menus) |  |
| 10 | Still needs the owner's real Safari / iPhone / VoiceOver pass |  |

The owner's final look-over of the control and form styling is still open; before/
after pictures were sent on Nov 14–15.
