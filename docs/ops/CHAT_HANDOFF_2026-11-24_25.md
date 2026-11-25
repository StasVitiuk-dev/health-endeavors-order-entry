# Chat hand-off: sessions of Nov 24 and Nov 25, 2026

Written for a **new chat** to read first, so it knows what was finished, what is open,
and what was added to the list. The owner can paste this file (or its link) into the
new chat. It holds no passwords, keys, customer data, product formula, email
addresses or home address (this repository is public).

Read together with: `CLAUDE.md` (standing rules), `docs/PROJECT_RECORD.md`,
`docs/ops/BUILD_TRACKER_2_WEEKS.md` (one row per pull request, the detail),
`docs/ops/NEXT_SESSION_CHECKLIST.md` (what to do next).

---

## 1. How to work with the owner (unchanged, still in force)

- The owner (Stas) has no coding background: plain English, one step at a time,
  links to click, ask for a screenshot to confirm, a short "where we are" recap.
- Claude never merges, never pushes to `main`, never runs SQL on production, never
  sends real messages, never touches Shopify/Gmail without a task the owner approved.
  Database changes are **drafts**; the owner runs them after reading the review guide.
- Every new feature ships **switched off**. Switches are per browser until database
  draft 50 is installed (then shared by every device).
- How the owner merges (bypass is allowed for the owner only): tick
  "Merge without waiting for requirements to be met (bypass rules)" → arrow →
  "Create a merge commit" → "Bypass rules and merge" → "Confirm bypass rules and merge".
  Never "Delete branch". The check "Screenshots (informational)" is always red on
  GitHub; it is informational and gets one standard comment per PR.
- Owner's standing rules for everything built: every agent/feature visible and
  switchable on the dashboard; placed where the owner would look; the same on every
  phone and computer; exact numbers, never estimates or a silent zero.

## 2. Owner decisions made on Nov 24–25 (DECIDED, do not ask again)

| Decision | Where recorded |
|---|---|
| **Design stays as it is.** No changes to buttons, typeface, shapes or the look unless the owner asks. A real display fault (unreadable number, cut-off text) is a bug and is still fixed. PR #92 closed without merging. | `OWNER_REQUESTS_2026-11-24_VOICE_AND_LOOKS.md` §2 |
| Administrator account is "almost like owner". Owner-only: System mode, the owner's own history, the owner's accounts, the sign-in records behind the dashboard. | `OWNER_DECISION_2026-11-24_ADMINISTRATOR_NEAR_OWNER.md` |
| Four levels: **Owner > Administrator > Manager > Employee.** | PR #90 |
| New Employee page: work email addresses only; the person types their own password on the owner's Mac; the owner controls the accounts. | PR #90, `docs/ops/sql-review/ITEM_13_DRAFTS_62_64_PEOPLE_LEVELS.md` |
| Weekly owner report: wanted (built, merged). | PR #88 |
| "Customers first": customer messages always on top of Home (built, merged). | PR #87 |
| Voice assistant ("Siri of my app"), owner account only: Stage 1 built (free, browser dictation and voice). Stage 2 (free questions answered by a paid AI service) = OWNER DECISION after launch. | PR #91 |
| "Ready to launch" page: wanted; two-step sign-in is one of the last launch lines. | PR #89 |
| Shopify is the hub for Amazon, Etsy and TikTok. | Build tracker |
| Backups: wanted at the best level (plan written). | `RECOVERY_AND_BACKUP_READINESS.md` §7 |
| Not wanted: "low stock → purchase order draft". Do not ask again about the attention feed. | Build tracker |

## 3. Finished and live (merged by the owner)

| PR | What it is | Merged |
|---|---|---|
| #85 | Big chain #56–#84: shorter menu, packaging costs, day pack, agents overview, Store Campaigns, Customer Emails, Content Helper, Reviews page, hand-offs "Handled", and more (all behind switches) | Nov 24, ~6:03 PM Central |
| #86 | Administrators see the "switches that save real records" | Nov 24, ~7:03 PM Central |
| #87 | Customers first (preview switch, off by default) | Nov 24, ~9:31 PM Central |
| #88 | Weekly owner report, first section of Backups & Printouts (owner and administrators; Show / Print / Copy) | Nov 24, ~10:19 PM Central |

Live check by the owner (Nov 24, late): the weekly report shows on the Backups page
and its Print button opens the print window. Reminder: in the shorter menu,
**Backups & Printouts sits inside Documents**.

## 4. Built, waiting for the owner's merge (open PRs)

**Merge ONE pull request: #100** (or #99, #98, #97, #96: whichever is the newest that is green; each contains the ones before it). #96 contains every open
feature PR (#89, #90, #91, #94, #95); they changed the same few lines, so they were joined
and the clash resolved (Nov 25, about 6 UTC). #97 contains #96 plus the Home note about
administrators' changes. Merging it brings all of them in, and GitHub then shows the others
as merged by themselves. Then merge #93 (documents).

| PR | What it is | After merging |
|---|---|---|
| #89 (in #96) | **Ready to launch** page (Overview): 14 lines, "X of 14 ready" | Feature Flags → turn on "Ready to launch" |
| #90 (in #96) | **New Employee, part 1**: rules + database drafts 62–65 (review item 16) | Nothing to switch on |
| #91 (in #96) | **Ask the dashboard (voice)**, owner only | Feature Flags → turn on "Ask the dashboard" |
| #94 (in #96) | **Bug fix**: invisible number on a coloured Home tile (Aurora) | Cmd+Shift+R; red tile shows its number |
| #95 (in #96) | **New Employee, part 2a**: the helper program draft that creates sign-ins (review item 17; not deployed) | Nothing |
| #96 | **New Employee, part 2b**: the People page under Admin (record switch, off; turns on only once drafts 62/64 are installed) | Feature Flags: the row says "Not installed yet" (expected) |
| #97 | **Home: what administrators changed** (preview switch "What administrators changed", off; owner only; reads only). Contains #96 | Feature Flags → turn on "What administrators changed" |
| #98 | **Administrators save settings for every device too**: drafts/50 changed before install (owner and administrators save). Contains #97 | Nothing until drafts/50 is installed |
| #99 | **Administrators confirm and re-check the tax rate too**: drafts/46 changed before install. Contains #98 | Nothing until drafts/46 is installed |
| #100 | **Administrators approve, pause and stop saved email campaigns too**: drafts/56 changed before install. Contains #99 | Nothing until drafts/56 is installed |
| #93 | Documents only | Nothing |

## 5. Database drafts waiting for the owner (nothing installed)

Run in this order, each only after reading its review guide in `docs/ops/sql-review/`:
draft **50** first (shared settings and switches for every device), then 52, 54, 56,
58, 60, then 62 and 64 (people levels; review item 16 starts with one read-only look). After 62/64: the helper program that creates sign-ins (review item 17, its own read-only look, then a deploy walked through screen by screen).
Next free draft number: **66**.

## 6. Still to build (the list), in planned order

1. ~~Home tells the owner what an administrator changed~~ BUILT (#97). The New Employee
   work is complete as drafts and pages (#90, #95, #96, #97); what is left is the owner's
   database steps (items 16, 17).
2. **Administrator near-owner, the remaining pieces** (the draft 50 change is DONE, #98): draft 50 changed so
   administrators can save shared switches; approvals without the owner's pre-approval;
   Employee Activity widened for administrators; owner's history and owner accounts
   protected; a small wording fix in the "Other switches" hint.
3. **Backups at the best level**: plan steps in `RECOVERY_AND_BACKUP_READINESS.md` §7
   (some need the owner, because the backups repository is off-limits to Claude).
4. Weekly report: a profit line, once the owner's costs are entered.
5. Voice Stage 2 (paid AI) — owner decision after launch.
6. One stock count for all channels — waits on the owner's decision.
7. Reminders: a dress rehearsal (test order end to end) when the printers arrive;
   two-step sign-in before launch.

## 7. What Claude needs from the owner

- Merge the open PRs in the order of section 4, and turn on the two switches.
- Backups, in the agreed short form only: "nightly: green/red, date; restore test:
  green/red, date; minutes: OK/out". Never paste logs, file names or contents.
- When ready: the read-only looks for review items 16 and 17 (Claude gives the queries in chat).
- Later: database sittings (draft 50 first), the business email decision, printers
  arriving, the stock-count decision.

## 8. Where things are

- Live dashboard: https://stasvitiuk-dev.github.io/health-endeavors-order-entry/owner-login.html
- `main` before these merges: `2bc7aba` (merge of #88).
- Branches: `claude/launch-page` (#89), `claude/new-employee-rules` (#90), `claude/new-employee-helper` (#95, contains #90), `claude/new-employee-page` (#96, contains #95),
  `claude/ask-box` (#91, contains #89), `claude/tile-figure-fix` (#94),
  `claude/sweet-hamilton-5ty3zp` (#93, documents).
- Progress percentages: `docs/health-endeavors-progress.md` (planning estimates).

---

## 9. Later on Nov 25: the owner's completion queue (CHECKPOINT for the next chat)

The owner gave a ten-task queue ("HEALTH ENDEAVORS DASHBOARD — CONTINUE THE COMPLETION QUEUE").
The live status table is `docs/PROJECT_RECORD.md` §3b; read it first.

**Merged:** #101 (safety tests: the one People-page exception), and **#110 (Nov 25, about 2:14 pm
Central, merge commit `f173b97`), which brought in #102–#109.** #104 and #105 were closed as
already contained (merging either leaves `main` unchanged). The chain below is history.

**Was open, chained (all now on `main`):**
#102 administrators approve deliveries and returns (draft 40) → #103 administrators review supplier
documents (drafts 36/38) → #104 managers can do what employees can + worked example → #105
owner-protection map, private-history plan, complete install index, fingerprint test → #106 two
devices never erase each other's additions (draft 50) → the documents PR after it (this section).

**Waiting on the owner:**
1. ~~Merge the newest green PR of the chain.~~ Done (#110).
2. The read-only look in `docs/ops/OWNER_PROTECTION_AND_PRIVATE_HISTORY.md` §B3 (four functions,
   changes nothing). It decides the private-history draft.
3. Two answers (no rush): may a **manager** approve deliveries or supplier documents? When an
   administrator looks at history, show "changed by the owner" or nothing at all (proposed: nothing)?
4. Backups in the short form; database sittings in the order of `START_HERE_GUIDED_RUNS.md`.

**Next for Claude (in this order):**
1. When the chain is green: one full test run on the head of the newest PR (task 6), and record
   revision, counts, skips and what mocks cannot prove.
2. Task 8: the end-to-end rehearsal with made-up records (order → invoice → payment status →
   stock → shipment → tracking → simulated notice → partial return), with its failure cases.
3. Task 9: the evidence list for backups (nightly, restore test, files coverage, independent
   copy, alerts, replacement Mac) and the print checks.
4. Task 10: finish the blueprint reconciliation in §3b; then the unfinished approved agents as
   complete flows (no new placeholder screens).
5. After the owner's §B3 look: the private-history draft and its tests.

**Session notes:** the local test database is at `/var/tmp/hepg`, port 5499 (start it with
`pg_ctl` if a restart stopped it). Before a browser run, the scratchpad's `diag-on.sh` points the
tests at the installed browser; restore `tests/playwright.config.js` before committing.

## 10. Evening of Nov 25 (CHECKPOINT for the next chat; supersedes the lists in §9)

**Merged by the owner:** #110 (with #102–#109) and #111 (records). #52, #104 and #105 were closed as
already contained (merging them would leave `main` unchanged).

**Owner answers of Nov 25:** managers approve supplier documents, deliveries and returns; when an
administrator looks at history they see **nothing** of the owner's entries; the platform's own
shipping email stays the one customers get (Shopify's; the dashboard's only for hand-entered and
wholesale orders); the B3 read-only look is done (`employee_activity` and
`employee_activity_people` run with raised rights; `global_search` does not; details in
`docs/ops/OWNER_PROTECTION_AND_PRIVATE_HISTORY.md`).

**Open PRs (chained; #113 contains #112):**
- #112: managers approve or reject supplier documents someone else recorded, and open files
  (drafts 36/38 changed before install). All real checks green.
- #113: managers decide deliveries and returns someone else recorded. **Option A is prepared**
  (drafts 66/67, not installed); the dashboard part is the same for A and B. Waits for the owner's
  "A" or "B" (if B: replace 66/67 with the stock-rights version before merging).

**Waiting on the owner:**
1. The second read-only look (the text of `employee_activity`, `employee_activity_people`,
   `list_my_sessions`; the query is in the chat of Nov 25 and repeated here):
   `select p.proname, pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('employee_activity','employee_activity_people','list_my_sessions') order by 1;`
2. "A" or "B" for managers and stock.
3. Backups in the short form (reminder set for Nov 26, 10 am Central).
4. Database sittings in the order of `docs/ops/sql-review/START_HERE_GUIDED_RUNS.md`.

**Next for Claude:** the private-history draft from the second look (keep each function exactly as
it is plus one condition: leave out entries made by an owner account, and owner accounts in the
people list, unless the asker is an owner; with tests: owner sees all, administrator sees no owner
entry on mixed records, in page 2, in counts and through a direct call; employees unchanged).

**Parked:** the screenshot-reference fix (branch `claude/screenshot-refs`, no PR): GitHub's
artifact storage is not reachable from the work computer, so GitHub's own pictures cannot be
downloaded here. The informational check stays red; nothing is broken.
