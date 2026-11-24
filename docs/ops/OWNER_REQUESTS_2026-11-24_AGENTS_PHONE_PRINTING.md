# Owner requests, Nov 24, 2026: phone line, agents that write to stores and customers, marketing agents, seeing and stopping agents, smart camera, backups and printing

Status: PROPOSED · several items OWNER DECISION REQUIRED · nothing here sends a real message

The owner asked for all of this to be discussed, checked against what exists, and added to the list.
What exists was checked in the repository on Nov 24 (agent registry in `assets/app/he-config.js`,
the preview switches, the Backups & Printouts page). Statements about outside services (carriers,
texting rules, seller accounts) are Claude's general understanding and are NOT verified here.

## 1. What exists today

| Topic | State in the repository |
|---|---|
| Ten agents (invoices, order intake, order monitoring, retail/wholesale tagging, shipping/tracking, customer notification, customer service, supervisor, accounting, tax record) | CURRENT. Listed on the AI Agent Activity page with a state badge and a pause switch each. Several are switched off until the store has products. |
| Customer Notification Agent | CURRENT, but it only **logs what it would email**. It sends nothing. |
| Customer Service Agent | CURRENT, switched off. It **drafts** a reply to a customer question; a person sends. |
| Agent diary (every agent step written down) | Built, behind the preview switch `he_agent_diary` (off). |
| Sales & Growth pages (wholesale leads, pipeline, samples, in-person visits, outreach studio, reply centre, content planner, ad variants, campaign lab, creator prospects and more) | Built as **draft-only pages on example data**, behind `he_sales_growth` (off). Nothing is sent, spent or posted. |
| Finding real stores near the owner | NOT STARTED. Needs a source of store data (a decision and an account). |
| Sending real email or text from an agent | NOT STARTED. Standing rule in `CLAUDE.md`: no real customer messages without the owner's explicit approval of that specific task. |
| Smart camera | Step B built (tracking barcodes → orders → dropped off; batch stickers; batch sticker from a photo). Receipts, expenses and supplier papers (B2) NOT STARTED; an expense can already carry a photo of its receipt. |
| Backups & Printouts page | Built and merged, behind the preview switch `he_backups_page` (off), which is why the owner does not see it. Prints a day's recap, a month of recaps, the manuals; saves recaps as a spreadsheet; shows what the dashboard can see of the backups. |
| Printing a client list or a whole "day pack"; printing automatically every day | NOT STARTED. |

## 2. Proposed plan

**A. Phone line.** The new line is the business number for seller-account codes, calls with stores and
the dashboard on the phone. Seller accounts opened before the new iPhone arrives (Dec 13) need a number
the owner keeps, so the line should exist before the accounts are opened where possible.
Texting from software does not go through the phone's own line: it goes through a texting service with
the business and number registered with the carriers, which takes time (not verified here).

**B. Three levels for any agent that writes to a person.** (1) Draft only: as today. (2) Approve
first: the agent drafts, the owner presses Approve, then it is sent. (3) Automatic: only fixed,
safe messages. Recommendation: stores and customer replies stay at level 2.

**C. Stores (wholesale).** Find stores from a store-data source, score them, draft a first email,
approve, send, follow up, log visits and samples. Email, visits and calls first. No texts to stores
that have not agreed to them. The draft pages for most of these steps exist on example data.

**D. Customers.** Order received / shipped / delivered emails: check whether Shopify's own
notifications already cover them before building a second sender. Questions: Customer Service Agent
drafts, a person approves. Texts only to customers who agreed at checkout.

**E. Marketing agents.** Turn the existing draft pages (content planner, ad variants, campaign lab,
creator prospects, retention reminders) from example data to the real products and orders, still
draft-and-approve. Posting or spending money stays with the owner.

**F. One control room for agents.** One page: each agent, on/off, what it did today (diary), what is
waiting for approval, last error. The pieces exist on three pages (AI Agent Activity, Agent diary,
Approval Queue).

**G. Printing.** A "day pack" button (orders of the day, clients of the day, daily recap) and a client
list to print on demand. Automatic daily printing: a web page cannot print by itself, so it needs a
small scheduled helper on the owner's Mac (the Mac must be on and the printer connected). The helper
lives on the owner's computer, not in this repository. Printed pages hold customer data and must be
stored safely.

**H. Smart camera B2.** Photo of a receipt → expense draft with the photo attached; photo of a supplier
paper → filed with the supplier. Reading the amounts automatically needs a text-reading service; first
step is photo plus typed amount.

## 3. Decisions for the owner

1. OWNER DECISION REQUIRED: stores and customer replies at "approve first" (recommended)?
2. OWNER DECISION REQUIRED: stores by email, visits and calls first, no cold texts (recommended)?
3. OWNER DECISION REQUIRED: let Shopify send the order-update emails (recommended, to be checked)?
4. OWNER DECISION REQUIRED: automatic daily printing: is the Mac on every day, and at what time?
5. Any real sending needs the owner's explicit approval per task, a business email address on the
   business's own domain, and for texts a registered texting service.

## 4. Rough size (planning estimates, not promises)

Control room F: about 1 day. Printing G (buttons): about 1 day; the Mac helper: half a day plus a
session with the owner. Smart camera B2 first step: about 1 day. Real data for Sales & Growth and
marketing pages (C, E, still draft-only): 2–3 days. Real sending (email, approve first): 1–2 days of
building plus outside set-up and waits. Texting: outside registration wait, not estimated.
