# Sales & Growth — owner guide, playbooks & rollback

Status: CURRENT · Branch work, not merged, nothing deployed · For: Stas (non-technical)

Plain-English guide to the Sales & Growth operating system: what it is, what the
AI can and can **never** do, how the safety controls work, and what to do if
something looks wrong. Everything here is **local and synthetic** until you
decide otherwise — see `SALES_GROWTH_AND_WHOLESALE_SYSTEM.md` for the technical
detail.

## How to turn it on (for review) and off

- It is **OFF by default**. With it off, there is no Sales & Growth section in
  the sidebar at all.
- To look at it in your browser: open the dashboard, open the developer console,
  run `localStorage.setItem('he_sales_growth','on')`, then reload. A collapsible
  **Sales & Growth** group appears.
- To hide it again: `localStorage.removeItem('he_sales_growth')` and reload.
- Turning it on only shows **read-only / draft-only** pages filled with clearly
  labelled **synthetic** data. It does not connect anything or send anything.

## What the AI can NEVER do (enforced in code, not just policy)

- **Never send** an email, SMS or message. There is no "send" mode. Gmail is not
  connected.
- **Never approve or ship a sample.** Only you can, and only within a budget.
- **Never move money, change a price, a discount, MOQ or MSRP.**
- **Never touch production, Shopify, customer data, backups or secrets.**
- **Never make a medical/therapeutic claim.** The claim firewall blocks it and a
  blocked draft can never be approved.
- **Never contact a do-not-contact (opt-out) lead.** An opt-out suppresses all
  further contact immediately.

If any of these were ever violated the safety check (`assertInvariants`) throws
and the page shows an error instead of proceeding — it "fails closed".

## What each area does (the 42 pages, grouped)

- **See & prioritize:** Growth Command Center, Owner Daily Queue, Owner Briefs,
  Needs-attention counts.
- **Review & approve:** Sales Approvals, Reply & Follow-up Center, Sample
  Operating System, Content Planner. *Approve never means send* — it means
  "ready for you to send/act by hand".
- **Plan & simulate:** Pipeline, Forecast, Scenario & What-If Lab, Campaign Lab,
  Outreach Studio. Everything is labelled SIMULATION / ESTIMATE / NOT GUARANTEED.
- **Analyze:** Sales Analytics, Lead Source Quality, Territory & Expansion, Lost
  Deal Analysis, Retention, Anomaly Center, Agent Scorecards, AI Cost Center.
- **Prepare:** Meeting & Deal Prep, Lead Detail, Wholesale Readiness, Commercial
  & Line Sheet.
- **Document & export:** Reporting Center, Export Center (safe CSV).
- **Audit & control:** Audit & Explainability, Sales Settings & Controls, Owner
  Decision Center, Sales Safety Center, Sales Privacy Center.

## How the safety controls work

- **Feature flag:** the master switch. OFF hides everything.
- **Global AI pause (kill switch):** stops any AI work; the read-only pages still
  open.
- **Agent modes:** every advisory agent is OFF by default; an enabled one can
  still only advise (flag/score/draft), never act.
- **AI budget:** a per-day and per-month spend cap with a hard stop; routine work
  uses free deterministic code (no AI spend).
- **Sample budget:** a monthly cap; you approve every sample.
- **Claim firewall & DNC:** always on.

You can see all of these, live, on the **Sales Safety Center** and **Sales
Settings & Controls** pages.

## Playbooks — what to do if…

- **A draft looks wrong / off-brand:** don't approve it; edit or discard it. No
  draft is ever sent on its own.
- **A reply looks mis-classified:** it's only a label; open the lead and respond
  by hand. The classifier never acts on its own.
- **An opt-out wasn't respected (DNC concern):** stop, check the Reply &
  Follow-up Center opt-out bucket, and confirm the lead is suppressed. Nothing is
  sent regardless, because send is disabled.
- **A sample looks wrong:** nothing ships without you; decline it on the Sample
  Operating System page.
- **AI cost looks high:** open AI Cost Center; use the global AI pause; the hard
  stop prevents overspend.
- **A provider is slow/failing (future, once enabled):** routing always falls
  back to the free deterministic template, so the pages keep working.
- **Future Gmail outage:** irrelevant while Gmail is disconnected; drafts are
  unaffected.
- **A duplicate website/Gmail lead (future):** the duplicate detector flags it;
  nothing is merged without your review.
- **You want to stop everything fast:** use the global AI pause, or turn the
  feature flag OFF (`localStorage.removeItem('he_sales_growth')`), or — for a
  permanent change — have a reviewed pull request turn it off; the live site is
  unaffected either way because nothing is deployed.

## Rollback (how to undo)

- **Per flag:** OFF instantly hides and disables the whole subsystem; no deploy
  needed.
- **Per commit:** every change is a small, isolated `sales:` commit; reverting
  one removes that piece with no effect on the rest.
- **Per page:** a page is one `<section>` + one loader + one nav entry; removing
  those three removes the page.
- **Nothing to roll back in production:** none of this is merged or deployed;
  `main` is untouched.

## What still needs YOU (owner/legal/external — not code)

Connecting a sales Gmail, ever enabling send, setting the real wholesale price /
MOQ / MSRP / approved claims / certifications, legal review, provider API keys,
the website inquiry feed, and finally merging/deploying. Until you decide each of
these, the Owner Decision Center and Readiness Center show them as pending — never
as done.
