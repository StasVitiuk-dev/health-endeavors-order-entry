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

Merge in this order. Each one was tested; only "Screenshots (informational)" is red.

| Order | PR | What it is | After merging |
|---|---|---|---|
| 1 | #89 | **Ready to launch** page (Overview): 14 lines, "X of 14 ready"; 6 checked from the records, 8 ticked by a person | Feature Flags → turn on "Ready to launch" |
| 2 | #90 | **New Employee page, part 1**: rules file + database drafts 62–65 (Manager level; each level changes only accounts below it; never deletes). Nothing shown on a page yet | Nothing to switch on; database step later (review item 13) |
| 3 | #91 | **Ask the dashboard (voice)**: search box answers questions with exact figures, "Talk" button, reads answers aloud unless Quiet; owner only. Contains #89 | Feature Flags → turn on "Ask the dashboard" |
| 4 | #94 | **Bug fix**: the number on a coloured Home tile (e.g. red "Overdue tasks") was invisible in the Aurora look. Only that is changed | Cmd+Shift+R; red tile shows its number |
| 5 | #93 | Documents only (backup plan, next-session checklist, tracker, the two owner decisions, this hand-off) | Nothing |

## 5. Database drafts waiting for the owner (nothing installed)

Run in this order, each only after reading its review guide in `docs/ops/sql-review/`:
draft **50** first (shared settings and switches for every device), then 52, 54, 56,
58, 60, then 62 and 64 (people levels; item 13 starts with one read-only look).
Next free draft number: **66**.

## 6. Still to build (the list), in planned order

1. **New Employee page, part 2**: a draft of the helper program that creates a sign-in,
   sets the first password and signs a person out, which asks the database rules from
   draft 64 first; the page under Admin behind a real-records switch; Home tells the
   owner what an administrator did.
2. **Administrator near-owner, the remaining pieces**: draft 50 changed so
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
- When ready: the read-only look for review item 13 (Claude gives the query in chat).
- Later: database sittings (draft 50 first), the business email decision, printers
  arriving, the stock-count decision.

## 8. Where things are

- Live dashboard: https://stasvitiuk-dev.github.io/health-endeavors-order-entry/owner-login.html
- `main` before these merges: `2bc7aba` (merge of #88).
- Branches: `claude/launch-page` (#89), `claude/new-employee-rules` (#90),
  `claude/ask-box` (#91, contains #89), `claude/tile-figure-fix` (#94),
  `claude/sweet-hamilton-5ty3zp` (#93, documents).
- Progress percentages: `docs/health-endeavors-progress.md` (planning estimates).
