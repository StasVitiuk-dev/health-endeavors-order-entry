# Owner decision, Nov 24, 2026 (evening): administrators get almost everything the owner has

**Status:** DECIDED by the owner in chat. Building it: NOT STARTED (plan below). Nothing in
production was changed. No account name or email is written here.

## The decision, in the owner's words (shortened)

The owner's business partner uses an Administrator account. Asked whether to make that account an
Owner or to keep it an Administrator, the owner answered: keep it an Administrator, but it "needs to
have power almost like owner". The partner must **not** be able to:

1. **shut the system off completely** (the System mode switch on Feature Flags);
2. **read the owner's own history record** (Claude's reading: what the owner's own accounts did, as
   shown on Employee Activity. Stated back to the owner in chat; to correct if it was meant
   differently);
3. **do anything with the owner's accounts** (change them, deactivate them, change their role).

Everything else the owner can do, an administrator should be able to do too, "because she is a
co-owner".

The request began with one concrete thing: the administrator account should see the owner-only
section "features that save real records" on Feature Flags and be able to turn those switches on
and off.

## What this changes compared with earlier decisions (written down, not silently chosen)

- **Nov 23:** "money, revenue and sensitive documents are for the owner and administrators only".
  Still true; this decision widens what administrators may *do*, not who sees money.
- **Decision 5 (stock-count adjustments): owner-only approval, enforced in the database
  (drafts/34).** The new decision supersedes it for administrators: OWNER DECISION REQUIRED only on
  whether a person may approve *their own* proposal (today the owner approves what others propose).
  Until answered, the safer rule is kept in the plan: nobody approves their own proposal, except
  the owner.
- **Drafts/50 (shared settings): "only the owner saves".** To become "the owner and administrators
  save", before the draft is installed.
- **Drafts/56 (saved email campaigns): "only the owner can save, pause or stop a campaign".** To
  become the owner and administrators.
- **Supplier documents: owner-only approval and owner-only private files.** To become the owner and
  administrators.

## Where the owner-only rule sits today (found by reading the dashboard's code, Nov 24)

On the page (each has, or will have, a matching rule in the database):

| Area | Today | After this decision |
|---|---|---|
| Feature Flags → features that save real records | owner only | owner and administrators |
| Preview switches, the menu and settings "for every device" (shared settings, drafts/50) | only the owner's choice is saved for everyone | owner and administrators |
| Feature Flags → Other switches (for example Shopify Order Sync) | owner only | owner and administrators |
| **Feature Flags → System mode** | owner only | **stays owner only** |
| Deliveries waiting for approval (partial receiving, drafts/40) | owner approves | owner and administrators |
| Returns: inspection, approving a return to a supplier, corrections | owner | owner and administrators |
| Supplier documents: approve or reject, private files, settings | owner | owner and administrators |
| Tax rate: confirming the rate | owner | owner and administrators |
| Saved email campaigns: save, pause, stop | owner | owner and administrators |
| **Employee Activity** | administrators see everyone's entries | **administrators do not see the owner's entries** |
| The owner's calendar on the Calendar page | owner | stays owner only (it is the owner's own calendar) |

In the database (cannot be read from the repository; needs a read-only check with the owner):

- who may change `feature_flags`, the system mode, and `profiles` rows (the accounts);
- who may read `audit_log` (Employee Activity).

The dashboard has **no page that changes an account**; accounts are managed in the database
provider's own console. So point 3 of the decision is a database rule to confirm, not a page change.

## Plan (PROPOSED order; each piece is its own small pull request)

1. The switches the owner asked about: the "features that save real records" section and the
   switches "for every device", for administrators as well; drafts/50 changed before it is installed.
2. A read-only check of the production rules for `feature_flags`, the system mode, `profiles` and
   `audit_log` (SQL given to the owner in chat; it changes nothing).
3. The approvals (deliveries, returns, supplier documents, tax rate, saved campaigns): page and
   database drafts together, one area per pull request.
4. Employee Activity: the owner's entries hidden from administrators (a database draft and the page).
5. A database draft that makes sure an administrator cannot change an owner's account, if the check
   in step 2 shows it is possible today.

## Known limitation, told to the owner

The rule is by role: **every** Administrator account gets this, also one created later. Other
staff should be given the lower role.
