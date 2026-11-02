# Schema contract (EXT19)

Status: **CURRENT on the feature branch.** Local schema = the real table shapes from the owner's Query A export. This is not a production check.

## 1. What it checks

`npm run schema:contract` (`tests/tools/schema-contract.js`) reads every Supabase call in the dashboard code:

- `.from()` with its `.select()` list, including nested relations;
- filters and ordering;
- the paged readers.

Every table and column named there must exist in the local real-shape schema, be a known table outside the Query A export (checked in production by Query D), or be a column a SQL draft adds.

**Today:** 41 tables and 278 columns named by the page. PASS. 24 known outside tables, with stale entries refused.

The **mock database** now also refuses a read that names a column the table does not have (`42703`), as the real database does, for the 18 known tables.

## 2. Real bug it found

System mode and the agent switches read `profiles.full_name` to show who changed them. The real table has `display_name`, not `full_name`. In production that read fails, so "Last changed by …" never showed a name. Both places now read `display_name`, with the e-mail as fallback. The test fails on the old code, and a mutant restoring `full_name` is caught.

## 3. Limits

- Writes (insert/update objects) and RPC arguments are not parsed yet.
- Tables outside the 18 are not column-checked (their shape is unknown until Query D).
