# A shorter dashboard menu: three variations (Nov 24, 2026)

Status: CURRENT (built, PR #61 and #62, not merged) · DECIDED Nov 24: variation 1 is the starting menu

Owner's request (Nov 23 evening): go through the whole dashboard and put things of the same kind
next to each other (shipping with shipping, accounting with finance), so there are fewer separate
pages. Offer three variations.

**Owner's correction (Nov 24), which decides the design:** "I like how it is right now, I just want
less of them: put some inside each other if it is the same topic." So the menu keeps its look, its
group headings and its page names. The only change is that same-topic pages sit inside one another.
The first proposal (new page names, new groups; see the end of this file) is DEPRECATED.

## Today


8 groups, 30 pages (plus optional pages behind switches):

| Group | Pages |
|---|---|
| Overview | Needs Your Attention, Daily Summary, Report History, Calendar |
| Sales | Orders & Revenue |
| Inventory | Inventory, Returns, Suppliers, Purchase Orders, Quality Control |
| Finance | Expenses, Accounting, Tax Records |
| Operations | Tasks, Incidents, Evidence Locker, Documents |
| Customers & AI | Customer Inquiries, AI Agent Activity |
| Admin | Feature Flags, Business Rules, Approval Queue, Active Sessions, Employee Activity, Procedures (SOPs), Feature Requests |
| Compliance (folded) | Recalls, Adverse Event Reports, Legal Holds, Business Continuity |

## What was built (PR #61)

A page that is inside another shows as a **row of buttons at the top of the page** (for example
Accounting · Expenses · Tax Records). The menu line stays lit while any page inside it is open and
carries the counts of all of them. Nothing is removed: search finds every page, pinned pages,
`#page=` links and Back/Forward work as before. A page a list does not place (a new page, or the
Sales & Growth pages behind their switch) stays in the menu where it is today.

**Owner's decision (Nov 24): "let's go with A option".** Variation 1 ("A little shorter") is the menu
everyone starts with. The owner also asked to confirm that nothing is deleted: confirmed, all 30
pages keep everything on them; 14 lines only move inside a page of the same topic.

Chosen on **Feature Flags → Menu**. "Today's menu" puts every page back on its own line; a choice is
remembered (in the browser as `he_menu_layout`: `today`, `a`, `b` or `c`; nothing kept = variation 1).

| Variation | Lines | Menu |
|---|---|---|
| 1. A little shorter | 16 | Overview: Needs Your Attention · Daily Summary (+ Report History) · Calendar. Sales: Orders & Revenue (+ Returns). Inventory: Inventory · Purchase Orders (+ Suppliers) · Quality Control (+ Recalls, Adverse Event Reports). Finance: Accounting (+ Expenses, Tax Records). Operations: Tasks (+ Approval Queue) · Incidents · Documents (+ Evidence Locker, Procedures, Backups & Printouts). Customers & AI: Customer Inquiries · AI Agent Activity. Admin: Feature Flags (+ Business Rules, Feature Requests) · Employee Activity (+ Active Sessions). Compliance: Legal Holds (+ Business Continuity). |
| 2. One page per topic | 10 | Overview: Needs Your Attention · Daily Summary (+ Report History, Calendar). Sales: Orders & Revenue (+ Returns, Customer Inquiries). Inventory: Inventory (+ Purchase Orders, Suppliers) · Quality Control (+ Recalls, Adverse Event Reports). Finance: Accounting (+ Expenses, Tax Records). Operations: Tasks (+ Approval Queue, Incidents) · Documents (+ Evidence Locker, Procedures, Backups & Printouts, Legal Holds, Business Continuity). Admin: Feature Flags (+ Business Rules, Feature Requests) · Employee Activity (+ Active Sessions, AI Agent Activity). |
| 3. Shortest | 6 | No headings; one line per group with every page of the group inside: Overview (4) · Sales (3) · Inventory (6) · Finance (3) · Operations (7) · Admin (8). |

Claude first suggested variation 2, then, asked to choose between leaving the menu and variation 1,
recommended variation 1 (smallest change). The owner chose variation 1.

Where the choice is kept: in the browser where it was made; once the shared settings (draft 50) are
in use, the owner's choice is saved as shared setting `menu_layout` (readable by every employee) and
every phone and computer follows it at the next sign-in. Only the owner can save it for everyone.

Files: `assets/views/he-menu-layouts.js` (the three lists), `tests/specs/menu-layouts-ext24.spec.js`.
To change what sits inside what, edit the lists in that one file; the tests check every page is
still there exactly once.

Not done: Sales & Growth pages are not regrouped. Pinning a line with pages inside pins its first page.

Tests: the shared test set-up chooses "Today's menu" before each test (most tests are about page
content and several count the full menu's lines); `menu-layouts-ext24` tests the menu as shipped.
See `tests/README.md`, "Which menu the tests see".

NEXT: the owner merges #62 (contains #61) and checks the live menu has 16 lines.

## DEPRECATED: the first proposal (Nov 24, before the owner's correction)

Kept for the record only. It renamed pages and groups, which the owner did not want.

What was wrong with today's menu, as first described: the menu grew one page at a time. Things that belong to one job are apart
(an order is under Sales, its return under Inventory, the customer's question under Customers & AI;
Daily Summary and Report History are two pages for one thing; money is three pages).

## The rule in all three options

Nothing is removed. Pages that belong together become **one page with tabs across the top**; each
tab shows the same content the separate page shows today. Search still finds everything. The old
menu stays available behind a switch until the owner is happy.

## Option A: follow the work (recommended) · 6 pages

| Page | Tabs |
|---|---|
| Home | What needs you · Today's summary · Calendar |
| Orders & Shipping | Orders · Packing & batches · Drop-off & delivery · Customer returns · Customer questions |
| Stock & Suppliers | Stock · Batch stickers · Purchase orders & receiving · Suppliers · Quality & recalls |
| Money | Overview & profit · Expenses · Bank & channel matching · Tax · Reports |
| Team & Tasks | Tasks · Approvals · Incidents · Procedures · Team activity · AI agents |
| Settings & Records | Switches · Rules · Documents & evidence · Backups & printouts · Legal & continuity |

Good: each page is one part of the day from start to finish. Trade-off: the biggest change to get
used to.

## Option B: fewest pages · 4 pages and a settings gear

Today (what needs you, tasks & approvals, customer questions, calendar, summary) · Sell (orders,
packing & batches, delivery, returns) · Stock (stock, batches, purchase orders, suppliers, quality &
recalls) · Money (profit, expenses, matching, tax, reports) · Settings (switches, rules, team, AI
agents, documents, backups, incidents, legal).

Good: the shortest menu, easiest on a phone. Trade-off: more tabs per page; rarely used things sit
deeper under the gear.

## Option C: tidy what is there · 5 groups, about 16 pages

Home (Needs Your Attention, Calendar, Reports = Daily Summary + Report History) · Orders (Orders &
Shipping, Returns, Customer Questions) · Stock (Inventory, Purchasing = Suppliers + Purchase Orders,
Product Safety = Quality + Recalls + Adverse Events) · Money (Accounting + Expenses + Tax) · Running
the business (Tasks & Approvals, Incidents, Documents = Documents + Evidence + Procedures, Team =
Sessions + Activity, AI Agents, Settings = Switches + Rules + Requests, Legal & Continuity).

Good: the smallest change; every page keeps a familiar name. Trade-off: still the longest menu.

## How it would be built (same for all three)

A layout is only a list: page → tabs → the existing section each tab shows. So the three options
can be built as one mechanism with three lists, behind a preview switch, and tried on the live
dashboard before choosing. The existing sections, their tests and their database requests do not
change. NEXT: build that mechanism with option A as the first list, so the owner can try it.
