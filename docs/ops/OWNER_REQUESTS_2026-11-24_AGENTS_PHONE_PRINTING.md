# Owner requests, Nov 24, 2026: phone line, agents that write to stores and customers, marketing agents, seeing and stopping agents, smart camera, backups and printing

Status: CURRENT plan · owner's answers of Nov 24 recorded in section 3 · nothing here sends a real message

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
| A "day pack" to print on demand (a day's orders, clients, totals, recap) | BUILT Nov 24 (PR #63, not merged), on Backups & Printouts. |
| A client list to print | BUILT Nov 24 (PR #66, not merged), from orders: the dashboard reads no separate customer table. |
| Printing automatically every day | NOT STARTED (needs a helper on the owner's Mac; 8:00 AM decided). |

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

## 3. The owner's answers (Nov 24)

1. **Phone:** the line is on the owner's personal plan, not a business line. The current number is
   used now and changed to the new number when the new phone arrives (Dec 13). DECIDED: **no texting
   at the start**; no business texting registration for now. Email only.
2. **Approval:** DECIDED: the owner approves **the text of an email or a campaign once**, not each
   single send (a campaign may go to many people a day). Applies to stores and to customers.
3. **Customers too:** email marketing agents are wanted for regular customers (people who ordered or
   subscribed), not only for stores. Customers will have personal accounts on the website; a reward
   programme may come later. (The website is a separate project; nothing of it goes in this repository.)
4. **Marketing agents:** the draft pages are liked. Wanted in addition: more ways to bring stores to
   buy, and more agents that bring customers.
5. **Seeing and stopping agents:** approved. First part BUILT Nov 24 (PR #64, not merged): "Agents at a
   glance" on the AI Agents page. The owner asks to be told which further agents are needed.
6. **Emails to customers and replies (section D):** approved as proposed.
7. **Printing:** approved ("do it"). Day pack BUILT Nov 24 (PR #63, not merged). Automatic daily
   printing: OWNER DECISION REQUIRED only on the time of day and whether the Mac is on then.
8. **Time-savers:** approved: receipt inbox, review request after delivery, morning summary.
   **NOT wanted for now: low stock → purchase order draft** (owner: "I don't need it for now").

Still true whatever is built: any real sending needs the owner's explicit approval of that specific
task (`CLAUDE.md`), a business email address on the business's own domain, an unsubscribe link in
every marketing email, and sending only to people who ordered or subscribed. Whether Shopify's own
email tool should be the sender for customer marketing is to be checked before a second sender is built.

## 3c. Content helper: what it would do (PROPOSED, explained to the owner in chat)

One product and one "story" in (what it is for, an ingredient, a customer's words); out come drafts:
short posts, ad texts in a few variations, one email paragraph, a short video script and shot list, and
a weekly plan of what to post when. Every draft passes the existing claim firewall for health or medical claims (words
such as cure, treat or prevent are flagged) before the owner sees it. It never posts and never spends.
Existing draft pages on example data: Content Planner, Ad Variants, Content Repurposing, Campaign Lab.

**Owner's requirement (Nov 24), DECIDED:** the content helper must always offer **several ready
options** for each thing (picture, video, email, text, font and look), and the owner must be able to
**ask for a new one at any time**. Planned shape: 3–5 text options per draft with "Make another" and
tone buttons (shorter, friendlier, more premium); a set of ready looks (font, colours, layout) to flip
through, applied to the owner's own product photos, with new looks addable; video as several script and
shot-list options. OWNER DECISION REQUIRED later, when that step starts: brand-new AI-made pictures or
finished videos need a paid picture/video service; unlimited "Make another" for text needs the paid AI
model running on the server side (a production step the owner approves).

**As built (PR #70, CURRENT, not merged yet):** the Content Helper page under Sales, behind the preview
switch "Content Helper" (off). Product name and the owner's own story in; three ready drafts at a time
for a post, an ad headline, an ad text and an email paragraph, with "Show me others" (up to 18 per kind
and tone, never a repeat); a short video as three lines to say and four things to film (three versions);
a week's plan; three tones (Plain, Friendly, Premium); the owner's own version, checked as it is typed;
six ready looks for a text card (lettering and colours, a preview only). The drafts are **fixed wording
around the owner's own story, not an AI model**, so no fact is invented; the page says so. Every draft
passes the claim firewall, and a blocked draft is shown with the words that caused it and cannot be
copied. Nothing is posted, sent, spent or written to the database; what is typed is kept in that browser
until a database step exists. **Not built (OWNER DECISION REQUIRED):** an AI writer for unlimited new
wording, looks applied to the owner's own photos, AI-made pictures and finished videos (each needs a
paid service or a server-side step the owner approves).

### Automatic daily printing, recommendation given

8:00 AM every day, yesterday's day pack, on the Mac next to the printer, which may sleep but not be
shut down. DECIDED Nov 24 (owner: "like it, let's do it"). NEXT: set up the helper on the owner's Mac
together, after the day pack (PR #63/#64) is merged.

### Staying out of spam (owner's question, Nov 24)

The owner asked whether many email addresses are needed to send about 100 emails a day to stores, and
whether an agent should watch for spam. Claude's answer (general practice, NOT verified against any
one email provider): one address on the business's own domain is enough; many addresses are not
needed and are a spammer's pattern. What matters: the domain's sender records set up, a slow start
(20–30 a day, rising over 2–3 weeks), a clean list of real store addresses, short plain emails, an
unsubscribe line and the business's postal address in every email, and a separate sub-address for
outreach so order emails are never affected.

DECIDED to add (PROPOSED by Claude, wanted by the owner's question): a **sending guard** inside the
store outreach and customer email agents. It keeps the daily limit and the slow start, spreads sends
over the day, never writes to the same store twice within a set time, removes addresses that bounce,
honours every unsubscribe at once, checks wording, and **stops the campaign by itself and tells the
owner** if bounces or complaints pass a limit. To be listed on the AI Agents page with the next code
change.

### Order-update emails

The owner is fine with Shopify sending them if Shopify has that option. Still to confirm with a
screenshot of Shopify → Settings → Notifications.

### Follow-up answers the same day

- **Stores, how approval works:** the owner approves the general text once, then presses Approve and
  chooses **how many stores** it goes to and **which first: the nearest, or the best match**. Finding
  stores through Google's map and store listings is wanted. (Google offers an official paid service
  for this; it needs the owner's own Google account and a key kept outside this repository. Prices
  and terms are NOT verified here. OWNER DECISION REQUIRED when that step starts.)
- **Stores, channels:** emails and visits only for now. No texts, no other messages.
- **Order-update emails:** the owner asked what "let Shopify send them" means. Explained in chat:
  Shopify itself emails the customer when an order is placed, shipped and delivered. To confirm:
  the owner looks at Shopify → Settings → Notifications and sends a screenshot.
- **Automatic daily printing:** the owner asked for a recommendation. Claude's recommendation: print
  **yesterday's** day pack every morning at a fixed time (a finished day, with its saved recap), on
  the Mac next to the printer, with the Home reminder as the safety net if the Mac was off.
  OWNER DECISION REQUIRED: the time, and which Mac.

## 3b. Agents to add (DECIDED Nov 24: the owner approved all seven, "let's add them as well")

Listed on the AI Agents page as "approved, not running yet" (PR #64). None runs or sends anything yet.
The owner also wants more from the content helper (posts and ads prepared faster): see 3c.

| Agent | What it does | Sends anything? |
|---|---|---|
| Store finder | Builds the list of stores worth contacting, scores them, removes ones already contacted | No |
| Store outreach | Drafts the first email and the follow-ups to a store; the owner approves the text once per campaign | Only after approval |
| Customer email | Drafts campaigns for customers who ordered or subscribed (welcome, reorder time, new product, win-back); approve once per campaign | Only after approval |
| Review request | A few days after delivery, drafts a short "how was it" email | Only after approval |
| Receipt inbox | Turns a forwarded receipt email or a photo into an expense draft | No |
| Morning summary | One message each morning: what needs the owner today | To the owner only |
| Content helper | Turns one product story into post, ad and email drafts (the existing draft pages, on real products) | No |

## 3d. Target and build order (DECIDED Nov 24: "let's try to finish it in 14 days, no longer")

Correction recorded the same day: in chat Claude called the products "supplements" several times.
The repository's own record (`assets/sales/he-sales-claims.js`) says Health Endeavors is a
**body-care / skincare** brand, not a supplement or drug. The rule for wording is the same (no claim
to treat, cure or heal); the remark about a supplement category approval on Amazon does not apply as
stated. Told to the owner in chat. CONFIRMED by the owner the same day: the product is a body lotion (body care) and no medical claim is made. Ingredient details are deliberately not written here.

Build order, planning estimate (building days; the owner's merges, database sessions, business email
and seller accounts run alongside):

| Days | Work |
|---|---|
| 1–2 | Store campaign: rules and screen BUILT Nov 24 (PR #65, not merged), drafts only, nothing sent |
| 3 | Receipt text → expense form BUILT (PR #67); client list to print BUILT (PR #66); control room BUILT: glance (#64), approvals waiting and the way to the diary (#69) |
| 4–5 | One stock count for all channels: OWNER DECISION REQUIRED first (`docs/ops/ONE_STOCK_COUNT_DECISION_2026-11-24.md`): orders do not lower the dashboard's stock today, and Shopify keeps its own count |
| 6 | Morning summary: copy button BUILT (PR #68); sending it each morning needs a server-side step. Reviews and email in the feed still to do |
| 7–8 | Content helper: several options, ready looks, claim firewall on every draft, video scripts |
| 9–10 | Store finder: import and scoring; the Google connection waits on the owner's account |
| 11–12 | Customer email and review request drafts; Shopify notifications checked |
| 13 | Real sending prepared as drafts for the owner's approval (server side, database drafts) |
| 14 | Final pass: full test run, documents, set-ups with the owner (printing, database steps) |

## 4. Rough size (planning estimates, not promises)

Control room F: about 1 day. Printing G (buttons): about 1 day; the Mac helper: half a day plus a
session with the owner. Smart camera B2 first step: about 1 day. Real data for Sales & Growth and
marketing pages (C, E, still draft-only): 2–3 days. Real sending (email, approve first): 1–2 days of
building plus outside set-up and waits. Texting: outside registration wait, not estimated.
