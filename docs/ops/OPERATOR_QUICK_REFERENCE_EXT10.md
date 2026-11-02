# Operator quick reference (EXT10)

**Status:** CURRENT for the dashboard on the EXT10 branch (2026-10-11). After the merge this is how the live dashboard behaves. Short, one card per situation. Detail: `OPERATIONS_RUNBOOK_INDEX_EXT9.md`.

## 1. Every day (2 minutes)

1. Open **Home**. Read "Checks: what needs a look" (red = data that cannot be right; amber = to do; grey = info). "Could not check" means unknown, **not** fine.
2. Look at **Nightly integrity check**: PASS / WARN / FAIL / STALE / NOT VERIFIED. Until it is installed it says "Not set up yet": that is expected.
3. Work "Needs your attention" from the top (soonest due first).
4. If a result says "from … minutes ago, may be out of date", press **Check again**.

## 2. Words the dashboard uses

| Word | Meaning | What to do |
|---|---|---|
| **already saved by an earlier attempt** | your first press was saved, the reply was lost; nothing was added twice | check the list; re-enter only if you had changed something since |
| **Pressing the button again is safe** | request keys are on: a retry cannot create a duplicate | press again |
| **may or may not have been saved. Check the list** | request keys are off: a retry could duplicate | look at the list first |
| **changed since the page loaded / changed elsewhere** | someone (or another tab) saved first; your change was not applied | reload, look, decide again |
| **—** instead of an amount | the figure could not be read (not zero) | tell the owner; do not treat as $0 |
| **NOT VERIFIED / UNKNOWN** | the dashboard cannot prove it either way | never read as "fine" |
| **Receipt status unknown — do not press Receive again** | a receive lost its connection | press "Check this order now" and follow what it says |
| **Next step:** (on a Home check) | what is expected of you for that row | do that, or tell the owner |
| **Off — on purpose** (agent) | switched off by decision until launch | nothing |

## 3. Incident (something is wrong)

1. Stop changing the affected records. 2. Screenshot what you see (no customer details in messages). 3. Incidents page → new incident with severity; link evidence in the Evidence Locker (a file is optional). 4. If it involves stock or money, tell the owner before correcting anything. 5. Escalating a quality check or recall creates **at most one** incident, even if two people press at once.

## 4. Data conflict ("changed elsewhere")

Reload the page → compare with what you intended → redo only what is still needed. Never press repeatedly to "force" it: the dashboard will keep refusing a stale change on purpose.

## 5. Manual stock adjustment

Inventory → pick product and bucket → amount (+ adds, − removes) → **reason** (always write why: "count correction 12 Oct", "damaged in storage"). A bucket can never go below zero. If it says the stock changed since the page loaded, reload and re-count. Once the owner turns on `stock_fn_adjust`, the change and its history are saved in one step.

## 6. Receiving a purchase order

Purchase Orders → open the order (status Ordered or Shipped) → enter lot numbers for catalogue lines → **Receive delivery** (press twice: the second press confirms). Stock, lots and one expense are recorded. If the page reports a partial failure, it lists exactly what to finish by hand; do not press Receive again. A received order cannot be received twice. On a phone the lines show as cards; the lot box is inside the card.

## 7. Returns

Returns → log the return against the order line → Approve → when the parcel arrives, **Mark received** with what happens to it (restock available / restock damaged / discard). Today the whole line is restocked (partial returns are an owner decision). **Mark refunded** only records a refund you made elsewhere; the dashboard never moves money.

## 8. What the dashboard never does

Send messages to customers · move money · issue refunds · make accounting or tax entries · delete products that have history · turn switches on by itself.
