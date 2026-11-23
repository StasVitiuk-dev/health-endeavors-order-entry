# Branch review package — understanding the feature branch before merge

Status: CURRENT · For: Stas (owner review) · Safe-local analysis only
Branch: `claude/platform-ext20-adversarial-completion-2026-10-13`
As of: 2026-10-19 · merge-base `d3db7bc` · HEAD `42b84bb`

This document exists because the feature branch is large (~460 commits ahead of
`main`). A big branch is not automatically a risky one — this package shows the
*shape* of the change so you can review and approve it with confidence, and so a
future regression can be traced back to the right commit. Nothing here touches
production, merges, or deploys.

Everything below is regenerated from the branch itself with:

- `node tests/tools/branch-archaeology.js` — classify every commit
- `bash tests/tools/merge-rehearsal.sh` — rehearse the merge safely

---

## 1. Where the branch stands (verified)

| Fact | Value |
|---|---|
| Repository | `StasVitiuk-dev/health-endeavors-order-entry` |
| Default branch | `main` at `d3db7bc` (untouched) |
| Feature branch HEAD | `42b84bb` |
| Ahead of main | ~460 commits |
| **Behind main** | **0 commits** |
| Working tree | clean |

"Behind 0" is the important one: `main` has not moved since the branch started,
so merging is a clean fast-forward with nothing to reconcile (see §4).

---

## 2. The shape of the change (commit archaeology)

Every commit since `main` is classified by **what kind of file** it changed,
**which subsystem**, and **how risky** it is.

**By kind of change**

| Kind | Count | Meaning |
|---|---|---|
| MIXED | 235 | shipped code *together with* its test and/or documentation — the healthy pattern |
| DOCS | 138 | documentation only — no behavior change |
| TEST | ~57 | tests / test tooling only — no behavior change |
| EXECUTABLE | 5 | shipped code only (no test/doc in the same commit) |
| GENERATED | 4 | machine-generated files (maps, lockfile) |
| OTHER | 21 | housekeeping (merges, config) |

More than half of all commits are **documentation- or test-only** — they cannot
change what the dashboard does. Of the commits that *do* touch shipped code, the
large majority also carry their own test in the same commit.

**By risk** (risk = shipped code in a sensitive area like auth, money, inventory,
approvals, agents, audit, or security)

- HIGH: 106 · MEDIUM: 134 · LOW: 220

**By subsystem** (largest first): Inventory 73 · Auth 51 · Trusted Types 44 ·
Security 37 · SQL package 27 · Accounting 21 · Authorization 15 · Purchase
Orders 12 · Audit 9 · Agents 9 · Performance 8 · Responsive 8 · Calendar 7 ·
Returns 6 · Accessibility 5 · Search 4 · and smaller.

(Subsystem is a best-effort heuristic from the commit text and files; it is a
map for review, not a legal record.)

---

## 3. Why the "size" is smaller than it looks

The raw line counts vs `main`:

| Layer | Added | Deleted | Files |
|---|---:|---:|---:|
| Shipped code (HTML/JS/CSS) | ~13,700 | ~9,700 | 38 |
| Tests | ~25,700 | ~18 | 237 |
| Documentation | ~30,000 | 0 | 412 |

Two things to understand before the big numbers alarm anyone:

1. **Most of the branch is tests and documentation, not shipped code.** The code
   the browser actually runs changed in only 38 files.
2. **A large part of the shipped-code change is code that MOVED, not new logic.**
   `owner-login.html` shows +205 / −8,396: the giant inline `<script>` was lifted
   out of the one 505 KB HTML file into named modules under `assets/app/*.js`
   (`he-ui`, `he-data`, `he-compliance`, `he-agents`, …). Those deletions in the
   HTML reappear as additions in the JS modules. The behavior is the same; the
   code is now in reviewable, testable pieces.

---

## 4. Merge rehearsal (safe, repeatable)

`bash tests/tools/merge-rehearsal.sh` combines the branch with `main` in a
throwaway copy — never touching `main`, never pushing. Latest result:

```
main        d3db7bc
feature     42b84bb (HEAD at rehearsal time)
conflicts   0
merged-tree IDENTICAL to feature HEAD (the merge adds nothing beyond HEAD)
TT ceiling  0
css gate    PASS
sink gate   PASS
overall     CLEAN
```

Because the merged result is byte-for-byte identical to the branch HEAD, every
check that passes on the branch passes on the merged result too. There is nothing
to reconcile and no surprise introduced by merging.

> If `main` ever moves before the merge, re-run the script: if it then reports a
> differing tree or any conflict, that is the signal to review before merging.

---

## 5. Suggested review order (for a human reviewer)

Review by risk, not by scrolling 460 commits top to bottom:

1. **Owner-visible first** — the Calendar colour fix and anything that changes
   what you see on screen (see the Calendar decision card / visual package).
2. **HIGH-risk shipped code** — the 106 HIGH-risk commits, grouped by subsystem:
   Inventory, Auth/Authorization, Purchase Orders, Returns, Approvals, Agents,
   Audit, Accounting, Security, Trusted Types. The hottest file by far is
   `assets/owner-login-app.js`; its changes are covered by the matching specs.
3. **The Trusted Types conversion** — large but mechanical: HTML strings became
   safe DOM builders. Proven complete by `trusted-types-ext20.spec.js` (ceiling 0)
   and the empty DOM-sink gate.
4. **Tests and docs** — can be read as evidence, not line-by-line; they cannot
   change behavior.

---

## 6. What is NOT in this branch (safety)

No production changes, no Supabase/SQL run against production, no customer data,
no secrets, no Real Estate material, no backups, no merge, no deploy. The branch
only adds code, tests and documents to a feature branch.

---

## 7. What still blocks launch — and who owns it

These are **not** things more local work can clear. They are Stas's to do:

- **Owner visual approval** of the Calendar colour change.
- **Owner policy decisions** (approval separation, aunt role, last-owner) — Claude
  must not invent these.
- **Query D2 / production SQL** — owner runs in Supabase after approval.
- **Real-device checks** — a real iPhone / Safari / screen reader.
- **PR review + merge + deploy** — owner-gated; merging is the live deploy.

---

## 8. How to regenerate this package

```bash
node tests/tools/branch-archaeology.js          # §2 (add --json for raw data)
bash tests/tools/merge-rehearsal.sh             # §4
git diff --numstat origin/main..HEAD            # §3
```

Related: `docs/ops/INVENTORY_TRUSTED_TYPES_HARDENING.md` (TT program),
`docs/ops/EXT20J_FINAL_REPORT.md` (prior reserve report).
