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
| 1 | Form fields are mostly full-width stacked; labels sometimes placeholder-only; date/priority/add alignment loose | reminder (Tasks), supplier add, PO, returns, expenses | VERIFIED controls are square/consistent; layout NOT done | Persistent labels; widths fit meaning; aligned rows desktop; clean mobile stacking; behavior/submit/date semantics unchanged | Local now | M (1–2 days; medium uncertainty — many forms) |
| 2 | Tiny unstyled file chooser; no selected-filename/error feedback | Expenses (receipt), any upload | VERIFIED unstyled (screenshot) | Styled, accessible file control showing chosen filename + type/error; no real upload | Local now (synthetic) | S–M (0.5–1 day) |
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
