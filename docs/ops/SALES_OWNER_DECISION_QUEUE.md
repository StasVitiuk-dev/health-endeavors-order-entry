# Sales & Growth — owner decision queue (durable record)

Status: ACTIVE · Branch `claude/platform-ext20-adversarial-completion-2026-10-13`
· Source revision at queue start: **`60bbb2e`** (main `d3db7bc`, untouched) · For:
Stas · Started 2026-10-27

Durable record of the step-by-step owner approval workflow. Each row is **one**
decision, kept separate (review ≠ enter facts ≠ choose Gmail ≠ connect mailbox ≠
read-only ≠ draft ≠ send ≠ merge ≠ deploy). **Nothing here is approved yet**; an
automated hook, a prior push, or a clean checkpoint is NOT owner approval.
Uncertainty or silence is NOT consent.

Type key: **(a)** information to supply · **(b)** bounded decision · **(c)**
external action needing its own separate approval.

Status values: UNANSWERED / APPROVED / DECLINED / LATER / NOT_SURE. Record the
exact value supplied (for type-a) only when the owner states it; never infer it
from historical materials.

## Does it block publishing the INERT (flag-OFF) dashboard, or only LATER live use?
- **Publishing the inert flag-OFF dashboard** is blocked ONLY by Q11 (review +
  merge) — and that requires a reviewable release plan first. With Sales OFF, the
  merged dashboard shows no Sales pages and the engines are not instantiated.
- **Q1–Q10** (business facts, Gmail, mailbox, drafting, sending) block ONLY later
  **live Sales/AI use**. They do NOT block publishing the inert dashboard.

## Queue (ordered by real dependency)
| # | Type | Decision | Status | Value (if type-a) |
|---|------|----------|--------|-------------------|
| Q0 | (b) | Which track first: publish inert dashboard, prepare live-Sales facts, or both in parallel? | UNANSWERED | — |
| Q1 | (a) | Approved **wholesale price** per unit (what a wholesale buyer pays) | UNANSWERED | — |
| Q2 | (a) | Approved **MOQ** (minimum order quantity) | UNANSWERED | — |
| Q3 | (a) | Approved **MSRP** (suggested retail price), if used on the line sheet | UNANSWERED | — |
| Q4 | (a) | The **exact approved product-claim wording** (legally cleared) — separate from any price | UNANSWERED | — |
| Q5 | (b) | Keep the Sales feature flag **default-OFF** after any future merge? (recommend YES) | UNANSWERED | — |
| Q6 | (b) | **Choose** which Gmail inbox would be the future sales inbox (identity only — not connecting) | UNANSWERED | — |
| Q7 | (c) | **Connect** that mailbox via a secure owner-run step (OAuth; no keys pasted to chat) | UNANSWERED | — |
| Q8 | (c) | Enable **read-only** mailbox access | UNANSWERED | — |
| Q9 | (c) | Enable **AI drafting** via a paid provider (API key via secure setup, not chat) | UNANSWERED | — |
| Q10 | (c) | Enable **sending** (highest-risk; no send path exists today) | UNANSWERED | — |
| Q11 | (c) | **Review + merge** the branch to publish the inert flag-OFF dashboard (needs a release plan first) | UNANSWERED | — |
| Q12 | (c) | **Deploy / confirm live** after merge (GitHub Pages publishes `main`) | UNANSWERED | — |

## Per-item detail
- **Q1 wholesale price (a):** unlocks the Commercial & Line Sheet / Wholesale
  Readiness price fields (still flag-OFF). Cost: none. Data access: none. Live
  effect: none. Still blocked after: Q2–Q4 + legal (Q4). Deferrable: yes.
  *Recommendation:* supply the single current approved per-unit wholesale price.
- **Q2 MOQ (a):** unlocks MOQ on the line sheet. Same zero cost/effect.
  Deferrable: yes.
- **Q3 MSRP (a):** optional; only needed if the line sheet shows a suggested
  retail price. Deferrable: yes.
- **Q4 approved claims (a):** unlocks approving outreach/content wording for real
  use. The claim firewall assists but does not certify; only your legally cleared
  wording is authoritative. Supply the exact approved phrases (not historical
  brochure text). Deferrable: yes; nothing live until set.
- **Q5 flag default-OFF (b):** *Recommendation: YES.* Keeps the dashboard inert
  on merge until you deliberately enable Sales. No cost/effect.
- **Q6 choose Gmail (b):** just naming which address would be used later — no
  connection, no access. Deferrable: yes.
- **Q7 connect mailbox (c):** an **owner-executed secure OAuth step** (you click
  through Google sign-in; no password/API key is ever pasted into chat). Separate
  approval; blocked by Q6. Live effect: grants the app a Google token.
- **Q8 read-only access (c):** separate from connecting; read-only is lower risk
  than send. Blocked by Q7.
- **Q9 AI drafting / provider key (c):** optional; free deterministic templates
  work without it. Key goes in via a secure owner setup step, not chat. Cost:
  per-provider usage within the hard budget cap. Deferrable: yes.
- **Q10 enable sending (c):** highest risk; today there is no send path. Strongly
  recommend keeping OFF until Q1–Q4 + legal + Q7/Q8 are done and reviewed.
- **Q11 review + merge (c):** publishes the inert dashboard. **Requires a release
  plan first:** exact source revision, required-check evidence, assessment of the
  large non-Sales branch changes, default-OFF effect, rollback, production
  consequences. I will prepare that plan for your review; I will NOT merge until
  you approve that exact release.
- **Q12 deploy/confirm live (c):** merging to `main` is itself the GitHub Pages
  deploy; this row is the post-merge live verification. Only you do it.

## Decision log (append as answers arrive)
- 2026-10-27: queue created from the OWNER ACTION PACKET at `60bbb2e`. No answers
  yet. First question posed: **Q0**.
