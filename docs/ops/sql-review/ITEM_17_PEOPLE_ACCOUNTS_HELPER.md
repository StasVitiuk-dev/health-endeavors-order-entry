# Review item 17 — the New Employee helper program (creates sign-ins)

Status: **READY FOR YOUR REVIEW — not deployed** · written 2026-11-25 ·
OWNER DECISION REQUIRED (approve the deploy, or not yet) · comes AFTER review item 16

This is the second part of the **New Employee** page (your decision of Nov 24). Review item 16
(drafts 62 and 64) teaches the database the four levels. This item is the small program that does
the part the database cannot do: create the sign-in itself, set a password, and block or unblock a
sign-in. Nothing here has been deployed. I never deploy it myself: you do, after approving it.

## Why a separate program

A sign-in (email and password) lives with the sign-in provider (Supabase Auth), not in our
tables. Creating one needs the provider's own key, the service key. That key can do anything, so it
must **never** be in the dashboard (the dashboard's code is public). The program runs at Supabase,
holds the key there, and the dashboard asks it.

## What it does, and nothing else

| Request | Who may ask (the database decides) | What happens |
|---|---|---|
| Create an account | Owner: administrator, manager, employee. Administrator: manager, employee. Manager: employee. Never an owner | 1. the database is asked "may this person create this level?" with **their own** sign-in · 2. only on yes, the sign-in is created with the work email and the password the new person typed · 3. the account is switched on at the chosen level, again asked with the asker's own sign-in |
| Set a new password | Only for an account below your level | asked first, then set; the password is never shown again or written down |
| Block a sign-in | Only for an account below your level | asked first, then the person can no longer sign in |
| Unblock | the same | the person can sign in again |

It never deletes a sign-in or an account, never sends an email, never reads or changes anything
else, and never writes a password or the key into an answer or a log.

**If step 3 of "create" is refused** (for example the account row is missing), the program blocks
the new sign-in at once, so nobody can use a half-made account, and the page says so in plain words.

**Block and the page that is already open:** after a block, the person cannot sign in again or
renew their sign-in. A page they already have open keeps its current sign-in until it runs out
(at most about an hour). To stop them at once as well, the page also suspends the account in the
database (review item 16), which the dashboard checks on every load.

## The exact files

| File | Lines | Fingerprint (SHA-256, first 16) |
|---|---|---|
| `docs/ops/edge-drafts/people-accounts/people-core.mjs` (the rules) | 175 | `0ccb18196e78f7a3` |
| `docs/ops/edge-drafts/people-accounts/index.ts` (the Supabase wrapper) | 49 | `c43a6141ed153738` |

## Settings it needs (none of them typed into chat)

Set in Supabase → Edge Functions → people-accounts → Secrets, by you:

- `ALLOWED_ORIGIN`: the dashboard's address, exactly `https://stasvitiuk-dev.github.io`. Any other
  website calling the program is refused.
- `WORK_EMAIL_DOMAIN`: the business email domain, once it exists. Until then leave it empty, and
  any address is accepted (the page also checks).

The service key, the public key and the project address are given to the program by Supabase
itself; nobody copies them anywhere.

## Before you deploy: one read-only look (1 minute)

The program expects that when a sign-in is created, the account row in our accounts table appears
by itself (switched off, level employee), the way it did for the accounts you have today. This
query **only reads**; it lists the names of the automatic steps on new sign-ins. Send me the result
(names only, no data):

```sql
-- READ ONLY. Changes nothing.
select t.tgname as step, p.proname as runs, t.tgenabled as enabled
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
where t.tgrelid = 'auth.users'::regclass
  and not t.tgisinternal
order by 1;
```

If the list is empty, the account row does not appear by itself, and the program would block every
new sign-in (safe, but useless): I would then add the missing step to a database draft first.

## The deploy, when you approve it (after item 16 is installed)

I will walk you through it screen by screen at the time (Supabase's screens change often), with
screenshots at each step. In short: create the function "people-accounts" in the Supabase
dashboard, paste the two files, keep "Verify JWT" switched on, add the two settings above, deploy.
Then one test with a made-up employee on your Mac: create, sign in as them in a Private Window,
block, unblock.

## How to undo it

Delete the function in Supabase → Edge Functions (the program holds nothing; deleting it changes no
account and no sign-in). Accounts created with it stay, like any other account; a manager or
higher can suspend or remove them on the page.

## How it was tested

`docs/ops/sql/local-test/people_accounts_core_test.mjs` runs the program's rules against a throwaway
local database with drafts 62 and 64 installed (made to look like production, made-up accounts) and
a made-up sign-in provider. **41 checks, all pass.** They cover: only the dashboard's address and a
signed-in person may ask; the fields are checked first (no owner, a real email, a proper password,
the work domain); an employee cannot create anyone; a manager only employees; an administrator
managers and employees, not another administrator; the owner an administrator; the same email
twice; a switched-off account cannot ask; a half-made account is blocked at once; passwords, block
and unblock only below your level (never the owner, the emergency account or yourself); plain
answers when the database step is not installed, the sign-in ran out, or the provider fails; no
password in any answer. A deliberate break (skipping the database's yes/no question) makes 14 of the
checks fail, so they would catch it.

## Known limits

- Tested with a made-up provider, not with Supabase itself. The first real use (one made-up
  employee) is the real test, and is part of the deploy.
- No limit on how many requests a person can send per minute; every request still needs the
  database's yes for that person.
- It does not show last sign-in times (not needed for the first version).
- The page that uses it is the next step (behind a switch, under Admin); without the page, nobody
  calls the program.
