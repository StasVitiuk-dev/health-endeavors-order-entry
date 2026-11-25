# Owner accounts and the owner's private history: what protects them, and what is still unknown

Status: **PROPOSED · OWNER DECISION REQUIRED (one boundary question) · read-only look needed** ·
written 2026-11-25 · tasks 3 and 4 of the owner's completion queue of Nov 25.
Nothing here is installed. Nothing here changes production. No secrets, no customer data.

Read with: `OWNER_DECISION_2026-11-24_ADMINISTRATOR_NEAR_OWNER.md` (the decision),
`sql-review/ITEM_16_DRAFTS_62_64_PEOPLE_LEVELS.md` (people levels, drafts 62/64),
`sql-review/ITEM_17_PEOPLE_ACCOUNTS_HELPER.md` (the sign-in helper).

## Part A — Task 3: nobody below the owner can change an owner account

### A1. Every path, and what stops it

The owner decision (Nov 24): an administrator must not "do anything with the owner's accounts".
Drafts 62/64 and the helper (item 17) were written for exactly this, so this task needed **no new
draft**; this table checks every path the queue named against them.

| Path | What stops a lower level | Where it is enforced | Proven by |
|---|---|---|---|
| Change an owner's name or department | the row rules let an administrator or manager see and change only accounts **below** their level; an owner row matches nothing | database row rules (drafts/64) | `people_levels_test.sh`: "an administrator's own UPDATE of an owner's row matches nothing"; "an administrator cannot rename the owner" |
| Change an owner's level, or make anyone an owner | the guard: a level can only be set to one below your own; nobody is ever made an owner, the owner included | database guard (drafts/64 replaces today's guard, same name) | "nobody is made an owner, the owner included"; "an administrator's own UPDATE cannot make themselves an owner" |
| Promote yourself | same guard; nobody changes their own level | database guard | "an administrator cannot change their own level"; "an employee cannot raise their own level" |
| Suspend, remove or bring back an owner | the functions refuse an owner and the emergency account outright, whoever asks | database functions (drafts/64) | "an administrator cannot touch the owner"; "the emergency account and the other owner are not changed from here, even by the owner" |
| Delete an account | no delete permission for anyone | database grants (today + drafts/64) | "nobody deletes an account" |
| Change an owner's email or account number on the account row | the guard allows only name, department, level and status through these paths | database guard | "an administrator cannot change another person's email or account number" |
| The emergency ("break-glass") mark | owner-only, as today | database guard | "an administrator cannot set the emergency mark" |
| Set a new password for an owner | the helper asks the database first, with the asker's own sign-in; the answer is no for an owner, the emergency account, an equal level and yourself | helper program (item 17) + database question `people_allow` | `people_accounts_core_test.mjs` (41 checks); "for the owner, the other administrator or yourself: no"; "the emergency account: no, even for the owner" |
| Block an owner's sign-in | the same question, the same no | helper + database | same tests |
| Change the sign-in email of an owner | **no path exists**: the helper has no email-change request; the dashboard has none; only the owner themselves, signed in, through the sign-in provider | sign-in provider | no request exists to test; recorded here so a future change is reviewed against this table |
| The privileged key that could do anything | lives only inside the helper at the provider; never in the dashboard (public code) | provider settings | the safety tests (`hard-walls`, `no-live-send`) allow one named helper only, whose code must pass the no-send checks |
| Lock out the last owner | nobody can suspend or demote themselves; owner rows are untouched by every function; nobody can make or unmake an owner from the dashboard | database functions + guard | "nobody suspends themselves, the owner included" |
| Impersonation | not built, and not to be built | — | the safety tests refuse any program other than the one named helper |

### A2. Sessions after a change (what is true, and what is not)

- After an account is **suspended**, the dashboard checks the account on every page load and stops.
  A page that is already open keeps its current sign-in until it runs out (at most about an hour);
  the helper's **block** stops new sign-ins and renewals (item 17, "Block and the page that is
  already open").
- After a **level change**, the new level applies at the next page load; the database applies it to
  every request at once, because every rule asks the level fresh.

### A3. What is still unknown (and the read-only look that settles it)

The guard and row rules **in production today** have never been read in full. Drafts/64 saves
today's guard text before replacing it, and its review guide (item 16) starts with **one
read-only look** that lists today's rules on the accounts table. That look is the only step
needed for task 3; it is already written: `ITEM_16_DRAFTS_62_64_PEOPLE_LEVELS.md`, section
"Before you run it: one read-only look". What its result proves: whether any rule today lets a
lower level write an owner row (if yes, drafts/64 still closes it, because the guard runs on every
change whatever rule let it through, but I would tell you before you install).

## Part B — Task 4: the owner's private history

### B1. The boundary (PROPOSED; one question for the owner, marked below)

| What | Who sees it |
|---|---|
| **History entries made by an owner account** (what the owner, or the emergency account, changed: "the owner changed order X from A to B") | **the owner only** |
| History entries made by administrators, managers, employees and agents | the owner and administrators (as today) |
| **The business records themselves** (orders, stock, invoices, customers, settings) with their current values, even if the owner was the last to change them | everyone who may see them today; nothing is hidden because the owner edited it |
| A record changed by both the owner and an administrator | administrators see the administrator's entries; the owner's entries on it are left out |
| Sign-in records (sessions, devices, sign-in times) | each person their own; the owner's never to an administrator (already true: the sessions list shows "your own sessions") |
| Counts, notices and summaries shown to an administrator | counted only from what they may see; **no "N hidden" line** (that would itself tell them the owner was active) |
| Exports (Employee Activity CSV) | built from the same answer as the screen, so they follow automatically |
| The owner's Home note "what administrators changed" (#97) | already owner-only and already counts administrators' entries only |

**OWNER DECISION REQUIRED (one question):** should an administrator see that *something* changed
on a record (for example "changed by the owner" without the details), or nothing at all? The
proposal above is **nothing at all**. Until you answer, the draft follows the proposal.

The underlying history is **never deleted, rewritten or moved**. Only what an administrator is
shown changes.

### B2. Every path that can show history, and where the filter must sit

| Path | What it reads | Where the filter must sit | Today |
|---|---|---|---|
| Employee Activity page (list, filters, pages) | the database function `employee_activity` | **inside that function** (the page cannot be trusted to filter) | **UNKNOWN**: the function's own rule was never read (decision doc: "whose rule was not part of this check") |
| Employee Activity "people" strip | `employee_activity_people` | inside that function | UNKNOWN |
| Employee Activity CSV export | the rows already on the page | follows the function | follows |
| The history table itself | `audit_log`, read directly | row rule | **owner only** (live check of Nov 24) |
| Search page | `global_search` | inside that function | UNKNOWN whether it searches history at all |
| Record detail and history screens | the business tables + the history table | row rule on the history table | owner only (same live check) |
| Home note on administrators' changes (#97) | `employee_activity` | owner-only page part | owner only |

So the history table is already safe; the open question is the **functions** that read it on an
administrator's behalf. They run with raised rights in production (otherwise an administrator
could not see any history, since the table is owner-only), so they decide on their own.

### B3. The read-only look (send me the result; it changes nothing)

Paste into Supabase → SQL Editor, press Run, and send a screenshot of the result. It shows, for
each of the four functions, whether it runs with raised rights and how long its text is. It reads
no business data and no history entries.

```sql
-- READ ONLY. Changes nothing. Lists four functions and how they run.
select p.proname as function_name,
       p.prosecdef as runs_with_raised_rights,
       pg_get_function_identity_arguments(p.oid) as inputs,
       length(pg_get_functiondef(p.oid)) as text_length
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('employee_activity', 'employee_activity_people', 'global_search', 'list_my_sessions')
order by 1;
```

What each answer means:
- `runs_with_raised_rights = true` for `employee_activity`: the function decides alone who sees
  what. Then a second read-only look shows its text (I will give it to you then), and I write a
  draft that keeps it exactly as it is except one added line: leave out entries made by an owner
  account unless the person asking is an owner.
- `false`: it already runs with the asker's rights, so an administrator sees only what the
  history table lets them see (today: nothing). Then administrators cannot see the owner's
  history now, and the draft is instead the reverse task: let administrators see the **other**
  people's entries without the owner's (the decision's "everything else").
- A missing function: the page part using it does not work in production today; I note it.

### B4. What I prepared now, and what waits

| Item | State |
|---|---|
| The boundary (B1) | PROPOSED, one owner question |
| The list of paths (B2) | done |
| The read-only look (B3) | ready for the owner |
| The draft that filters inside `employee_activity` | **waits for B3** (writing it without the function's text would mean replacing code nobody has read, which the project rules forbid) |
| Tests | planned with the draft: owner sees all; administrator sees no owner entry on mixed records, in pages 1 and 2, in counts, in the CSV, through a direct call; an employee sees nothing more than today |
