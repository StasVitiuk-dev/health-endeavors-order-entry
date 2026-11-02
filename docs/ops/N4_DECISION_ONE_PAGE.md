# One question for your accountant: refunds (N4)

**Status:** OWNER DECISION REQUIRED (2026-10-10). Nothing is decided here. Detail: `N4-refunds-accounting-map.md`.

**The situation, in one paragraph.** When a customer gets money back, the dashboard can record it on the Returns page ("Mark Refunded", with the amount). It never moves money; you refund outside the dashboard. Today the money pages (Accounting, Tax Records) **do not subtract** those recorded refunds: an order only stops counting as revenue if the order itself is marked cancelled or refunded. So, for an order that stays "paid" but had a refund recorded on Returns, revenue and profit look higher than they really are.

**The question (pick one):**

| Option | What the dashboard does | When it fits |
|---|---|---|
| **A. Keep today's rule** | Revenue changes only by the order's status. Recorded refunds are listed but not subtracted | Refunds are always reflected on the order (e.g. Shopify marks it refunded) |
| **B. Subtract recorded refunds** | Accounting and Tax Records subtract the refund amount, **in the month of the refund**, never twice for the same order; a tile shows how much was subtracted | Refunds are recorded on Returns and the order stays "paid" |
| **C. Your accountant's rule** | e.g. subtract in the month of the original sale, or treat partial refunds differently | Tell us the rule; Claude implements it with tests |

Two small follow-ups the accountant may answer at the same time: (1) partial refunds: subtract the recorded amount, or keep "full total, needs review"? (2) once Shopify sync is on, which source is the truth for refunds (Shopify or the Returns page), so a refund is never counted twice?

**What happens after you answer:** a one-line switch in the dashboard (both A and B are already built and tested: `refund-policy.spec.js`), shown to you in a pull request before anything goes live. **Until you answer, option A stays.**
