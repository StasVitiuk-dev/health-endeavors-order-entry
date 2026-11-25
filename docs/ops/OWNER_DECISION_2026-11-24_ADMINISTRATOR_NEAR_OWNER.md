# Owner decision, Nov 24, 2026 (evening): administrators get almost everything the owner has

**Status:** DECIDED by the owner in chat. Building it: IN PROGRESS. Piece 1 of the plan below is PR #86 (not merged). Nothing in
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
  (drafts/34).** The new decision supersedes it for administrators. ANSWERED the same evening: an
  administrator needs no approval from the owner, also for their own proposals; the owner is told
  about it instead. An employee's proposal is still approved by the owner or an administrator.
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
6. A page (and its database draft) where the owner and administrators add and approve people and
   set roles below Owner.
7. The owner's Home and daily summary say what an administrator did.

## What else to keep for the owner only: ANSWERED by the owner (Nov 24, evening)

Asked "what else would you recommend to close from her account", Claude proposed six things to keep
for the owner only. The owner answered each one. The partner is a co-owner (named on the business's
tax documents as a partner), will not be online much, and the account is there to stay informed and
for emergencies.

| # | Claude's proposal (keep for the owner only) | The owner's answer |
|---|---|---|
| 1 | Adding or removing accounts, changing anyone's role | **Not kept.** An administrator must be able to create accounts and approve people. (Still true from the first decision: nothing may be done to the owner's own accounts. Claude's reading, told to the owner: making someone an Owner also stays with the owner.) |
| 2 | Approving one's own requests | **Not kept.** No approval by the owner is needed for what the partner does. Instead the owner wants to **be told about everything the partner does**: "I do want to be able to see everything". Employee Activity already records it; more is to be added so the owner is told without looking (see the plan). |
| 3 | Releasing a legal hold | **Not kept.** An administrator may release one too. |
| 4 | Backups and restoring from a backup | **Not kept.** Mostly the owner does it, but in an emergency the partner must be able to as well. |
| 5 | The monthly AI spending limit; the final approval to start sending real emails | **Not kept.** An administrator may do both. |
| 6 | The sign-ins behind the dashboard (the database provider, the code host, the store's owner login) | **Kept.** Only the owner, and the owner's emergency account. "This part is totally my job." |

**So, for the owner only, in total:** the System mode switch; reading the owner's own history;
anything done to the owner's accounts (including making someone an Owner); and the sign-ins behind
the dashboard. Everything else an administrator may do.

**New work that follows from the answers** (added to the plan):

- **Accounts from the dashboard.** Today no page creates or approves an account; that is done in the
  database provider's console, which stays with the owner (point 6). For an administrator to create
  accounts and approve people, a page and a database draft are needed: add a person, approve them,
  set or change a role below Owner, deactivate. Never an owner's account.
- **The owner is told what an administrator did.** Each significant action by an administrator
  (an approval, a switch, a new account, a released hold, a restore, a campaign saved) shows on the
  owner's Home, and in the daily summary, without the owner having to search Employee Activity.

## The People page (PROPOSED by Claude on Nov 24, evening; the owner asked for it)

The owner asked for a page where the owner, the partner and other administrators ("future
managers") can create a new employee account. Claude's proposal, given in chat:

1. The new person **asks for an account themselves** on the sign-in page: name, email, and a
   password only they know. Nobody else handles a password.
2. The account **waits for approval**: until then the person sees only that it is waiting.
3. On a **People page under Admin**, the owner or an administrator sees who is waiting, approves
   with a role, changes a role later, or deactivates someone who left.
4. Nobody can touch an owner's account from this page, and nobody can make someone an Owner.
5. Every approval, role change and deactivation is shown to the owner on Home, with who did it.

Why not "create the login from the dashboard": that needs the database's master key inside the
page, where anyone could read it. That key must never be in the browser or in this repository.

**The owner's answer to this proposal (same evening): not "ask, then approve".** The owner wants
a button with which the owner and administrators **create the account themselves**. Employees will
be given a **work email address**; personal addresses are not to be used, so nobody sends a request
on their own. This DEPRECATES steps 1 and 2 above; steps 3 to 5 stand.

What that needs, told to the owner in chat (PROPOSED, nothing built):

- Creating a login needs the database's master key, which must stay on the server. So one small
  server-side function is needed at the database provider: the dashboard asks it, it checks that the
  person asking is the owner or an administrator, and only then creates the login. The function gets
  the key from the provider by itself: the owner never copies or pastes a key, and no key enters
  this repository. Installing it is a deployment the owner does once, guided, after approving it.
- Sign-ups by strangers stay switched off. Only the function creates accounts.
- First password: a temporary one shown once to whoever created the account, and the new person
  must choose their own at the first sign-in. (An emailed invitation is the alternative; it depends
  on the work mailbox existing first.)
- Work addresses need the business's own email domain, which is already on the owner's list
  (`docs/ops/BUSINESS_EMAIL_PLAN.md`).

Also proposed for the page: reset a forgotten password, deactivate someone who left (signed out
everywhere, history kept), change a role, and a list showing role, active or not, and last sign-in.

**OWNER DECISION REQUIRED (asked in chat, not answered yet):** since this evening Administrator
means "almost an Owner". A future manager made an Administrator would get all of it. Claude
recommends a fourth role, **Manager**: approves new employees and runs the daily work, without the
co-owner powers.

**Not known yet (needs the read-only check below and one look at the sign-in settings):** whether a
new sign-up already gets a row in the accounts table by itself, whether sign-ups are allowed at
all, and what the present rules on the accounts table let an administrator do.

### Read-only check of how accounts are set up (given to the owner in chat on Nov 24)

It reads only the shape: the accounts table's columns, how many accounts each role has (counts, no
names or emails), the rules on four tables, the triggers, and the helper functions the rules use.
It changes nothing. Tried on a throwaway local database first.

```sql
with t(tbl) as (values ('profiles'), ('feature_flags'), ('system_mode'), ('audit_log'))
select '1 column' as section, 'profiles' as item,
       lpad(c.ordinal_position::text, 2, '0') || ' ' || c.column_name || ' ' || c.data_type ||
       case when c.is_nullable = 'NO' then ' NOT NULL' else '' end ||
       case when c.column_default is not null then ' default ' || left(c.column_default, 40) else '' end as detail
  from information_schema.columns c
 where c.table_schema = 'public' and c.table_name = 'profiles'
union all
select '2 roles in use', coalesce(p.role, '(none)'), 'active: ' || p.is_active::text || ', accounts: ' || count(*)::text
  from public.profiles p group by p.role, p.is_active
union all
select '3 rule', pol.tablename::text, pol.policyname || ' | ' || pol.cmd || ' | for: ' || array_to_string(pol.roles, ',') ||
       ' | when: ' || coalesce(left(pol.qual, 200), '-') || ' | check: ' || coalesce(left(pol.with_check, 200), '-')
  from pg_policies pol join t on t.tbl = pol.tablename::text
 where pol.schemaname = 'public'
union all
select '4 row level security', cl.relname::text, case when cl.relrowsecurity then 'ON' else 'OFF' end
  from pg_class cl
  join pg_namespace n on n.oid = cl.relnamespace and n.nspname = 'public'
  join t on t.tbl = cl.relname::text
 where cl.relkind in ('r', 'p')
union all
select '5 trigger', n.nspname || '.' || cl.relname, tg.tgname || ' -> ' || p.proname
  from pg_trigger tg
  join pg_class cl on cl.oid = tg.tgrelid
  join pg_namespace n on n.oid = cl.relnamespace
  join pg_proc p on p.oid = tg.tgfoid
 where not tg.tgisinternal
   and ((n.nspname = 'public' and cl.relname::text in (select tbl from t)) or (n.nspname = 'auth' and cl.relname = 'users'))
union all
select '6 helper function', p.proname::text,
       case when p.prosecdef then 'runs with its owner''s rights' else 'runs with the caller''s rights' end ||
       ' | ' || left(regexp_replace(p.prosrc, '\s+', ' ', 'g'), 300)
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and (p.proname in ('is_owner', 'is_owner_or_admin', 'current_role', 'is_active_staff', 'is_admin')
        or p.oid in (select tg.tgfoid from pg_trigger tg
                       join pg_class cl on cl.oid = tg.tgrelid
                       join pg_namespace n2 on n2.oid = cl.relnamespace
                      where n2.nspname = 'auth' and cl.relname = 'users' and not tg.tgisinternal))
order by 1, 2, 3;
```

## Known limitation, told to the owner

The rule is by role: **every** Administrator account gets this, also one created later. Other
staff should be given the lower role.
