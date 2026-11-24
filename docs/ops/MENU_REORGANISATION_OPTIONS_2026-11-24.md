# Reorganising the dashboard menu: three options (Nov 24, 2026)

Status: PROPOSED · OWNER DECISION REQUIRED (choose A, B or C, or a mix)

Owner's request (Nov 23 evening): go through the whole dashboard and put things of the same kind
next to each other (shipping with shipping, accounting with finance), so there are fewer separate
pages, everything is connected, and it is easier to use. Offer three variations.

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

What is wrong with it: the menu grew one page at a time. Things that belong to one job are apart
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
