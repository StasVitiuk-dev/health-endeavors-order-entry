# Visitor rights review (Query G, check G04)

Status: **CURRENT** (2026-10-18). A read-only paper review. Nothing in production was changed or run for it. It uses only the owner's Query G result from 2026-10-18 and this repository's code.

"Visitor" here means anyone who is not signed in. They use the public key that every web page carries (the `anon` role).

## 1. What G04 found

On 77 objects (61 tables + 16 views), visitors hold Supabase's default rights: SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES and TRIGGER. These rights exist on every new Supabase project unless someone removes them. G04 marks them FAIL because they are much wider than visitors need.

The 17th view, `needs_attention`, is not in this list, so visitors do not hold all rights on it (see `PRODUCTION_CHANGE_LOG.md`, FIX 1B).

## 2. What actually protects the data today

A right is only half of the lock. The other half is row-level security (RLS).

| Layer | Status (checked in the owner's Query G and G2 results) |
|---|---|
| RLS turned on | all 61 tables (G01 PASS) |
| Policies that let visitors in | only **3**, all **INSERT only**, see §3. All other policies require a signed-in user (`auth.uid()`, role checks), so a visitor matches none of them |
| Views | all 17 use the reader's rights (`security_invoker`) since FIX 1B, so the table rules above apply to them too (G2, all PASS) |
| Tables with RLS on and no policy (G07) | 5 tables. Visitors and signed-in users get nothing there |

**Conclusion for today:** through the public API, visitors can add rows to the 3 form tables, and nothing else. They cannot read, change or delete any table or view. The wide rights are a **missing second lock**, not an open door.

The rights TRUNCATE, TRIGGER and REFERENCES are not checked by RLS. But the public API (`/rest/v1/`) offers only read, add, change, delete and function calls, so visitors cannot reach those three rights through it.

## 3. What visitors really need

| Object | Visitor policy | Who uses it | Needed right |
|---|---|---|---|
| `contact_messages` | "Public can submit contact messages": INSERT, check `true` | probably the public website's contact form (separate project, not in this repository) | INSERT only |
| `waitlist_signups` | "Anyone can join the waitlist": INSERT, check `true` | probably the public website's waitlist form | INSERT only |
| `wholesale_inquiries` | "Public can submit wholesale inquiries": INSERT, check `true` | probably the public website's wholesale form | INSERT only |
| the other 74 objects | none | nobody who is not signed in | **nothing** |

The dashboard: no page in this repository writes to these three tables. The dashboard only reads `contact_messages` and `wholesale_inquiries` for signed-in staff (`assets/app/he-config.js`). All dashboard data reads and writes run after sign-in, and the permission map already says visitors must have nothing (`PERMISSION_RLS_MAP_EXT9.md`, row "anon").

**OWNER DECISION REQUIRED (later):** confirm whether the public website sends its contact, waitlist and wholesale forms straight to these tables. If a form asks the database to send the new row back after saving, it would also need a visitor read rule, which does not exist. So today those forms must already work with INSERT alone.

## 4. What could break if the extra rights were removed later

| Change (not prepared, not proposed yet) | Risk |
|---|---|
| Remove visitor rights from the 74 objects visitors don't use | Very low for the dashboard, because every request runs signed in. Supabase may add the default rights again to tables created later, so the check would need repeating after each new table |
| Remove everything except INSERT on the 3 form tables | The public website forms keep working if they only add rows. They must be tested on the website after the change |
| Remove INSERT on the 3 form tables | **Breaks** the public forms. Not recommended |

## 5. Related item found while reviewing (not G04)

Query G's check **G06** lists functions that visitors may call. A function can run with its owner's rights and skip RLS. Whether any of them is a real problem depends on whether it checks who is calling. Query G cannot see that.

That question is answered by read-only **Query D** (`sql/03_READONLY_D_definer_function_identity_check.sql`, prepared and tested locally). It returns only names and yes/no answers, never function code. The function names are withheld here until Query D has been read, in line with this log's rule of not publishing unconfirmed weaknesses.

Order of importance: G06 / Query D comes **before** tidying G04. G04 is a second lock on doors that are already closed. G06 could be an open door, or nothing; nobody knows yet.

## 6. Next steps

1. **Read-only:** the owner runs Query D, and Claude reads the result. CURRENT next step.
2. Then decide whether any function needs a fix (one change at a time, each approved separately).
3. Later, PROPOSED: a G04 tidy-up as in §4, once the owner has confirmed which website forms use the 3 tables.
