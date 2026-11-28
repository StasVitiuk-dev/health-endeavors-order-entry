# Settings shared by every device: how they behave

Status: CURRENT for the code on branch `claude/shared-settings-live` (PR pending the owner's merge) ·
written 2026-11-27 (night). The database part (drafts/50 and drafts/74) is **installed and verified in
production** (owner's screenshots, Nov 27; see `sql-review/ITEM_10_…` and `ITEM_19_…`). This page is the
one place that describes the behaviour; the SQL review items describe the install.

## What is shared, and who may change it

| Setting (key) | What | Who reads it | Who saves it | Read when |
|---|---|---|---|---|
| `feature_switches` | the preview switches | everyone signed in (an employee gets only the "every employee" switches) | owner, administrator | at sign-in |
| `menu_layout` | the menu the owner chose | everyone signed in | owner, administrator | at sign-in |
| `profit_estimates` | Real profit fee and postage estimates | owner, administrator | owner, administrator | when Accounting opens |
| `recap_printed` | the last day the daily recap was opened for printing | owner, administrator | owner, administrator | when Home / Backups open |
| `handoffs_handled` | agent hand-offs marked handled | owner, administrator | owner, administrator | when Home / AI Agents open |
| `launch_list` | the Launch page marks | owner, administrator | owner, administrator | when the Launch page opens |
| `store_campaign`, `customer_emails`, `content_helper` | the owner's draft wording | owner, administrator | owner, administrator | when those pages open |

The database decides, not the page: `set_shared_setting()` refuses anyone but an active owner or
administrator; a setting marked for owner and administrators is never sent to staff, managers, AI agent
accounts, switched-off accounts or visitors (proven on a throwaway database,
`sql/local-test/shared_settings_test.sh`, sections 2–3, including a manager and an AI agent account since
Nov 27 night). Every save is in `audit_log` under the row's id, with the person who saved it
(`shared_settings_audit_id_test.sh`).

## It is not live sync

A change made on one device reaches another device **the next time that device reads it**: the next
sign-in or page reload for switches and the menu, the next time the page opens for the rest. Nothing is
pushed to a device that already has the page open. Two devices saving the same list at the same moment
keep both changes (the save carries the version it read; a "conflict" makes the page read, join and save
again: `shared-settings-race-ext25`, and the database test 4b). A single switch: the last choice wins.

## When the database cannot be reached

- The page **never** says "for every device" unless the database confirmed the save.
- Reading fails (no connection, sign-in expired, refused): Feature Flags says the shared switches could
  not be read and, until they can, a switch applies to this browser only (with the reason, for example
  "JWT expired"); the Launch page says its marks are kept in this browser and why. The database library
  tries a failed read again a few times first (about 8 seconds), so "Checking…" can show until then.
- Saving fails: nothing changes anywhere; the switch's own row says "Not changed: …" with the reason.
- A switch or setting kept in a browser is **only a display choice**. It never gives anyone the right to
  change stock, send anything, change a role or save money records: those are checked by the database for
  every request (row rules and the functions' own checks), whatever the browser shows.

## Tests (where each case is covered)

| Case | Covered by |
|---|---|
| table and function missing (a database without the step) | `shared-switches-ext24` "on a database without…", `launch-page-ext25`, `drafts-every-device-ext24`, `backups-page-ext22`, `attention-feed-ext24` (`backend.missingTables`) |
| function missing, table there | `shared-settings-failures-ext26` |
| installed, empty | `shared-switches-ext24` (first share), `drafts-every-device-ext24`, `preview-switches-ext21` |
| installed, with values | `shared-switches-ext24`, `real-profit-ext24`, `menu-layouts-ext24`, `launch-page-ext25` |
| refused (no permission) | `shared-switches-ext24`, `menu-layouts-ext24`, `real-profit-ext24`; the database test for each role |
| sign-in expired (401) on reading and on saving | `shared-settings-failures-ext26` |
| no connection on reading and on saving | `shared-settings-failures-ext26`, `launch-page-ext25` |
| two devices at once (conflict) | `shared-settings-race-ext25`, database test 4b |
| a double press | `shared-settings-failures-ext26` |
| an employee never gets owner-only switches, even if the browser had one on | `shared-switches-ext24` |

| two real browser windows signed in at once (one owner on two devices; an employee's device) | `shared-settings-two-devices-ext26` |

**Not covered by browser tests:** a real two-device race against the real database function (proven on the
throwaway database with two connections, test 4b, and at the module level); live push to an open page
(not built: a device reads again at sign-in or reload).

## The change of Nov 27 (night): which test expectations changed, and why

`SHARED_SETTINGS_LIVE = true` made the shared settings the rule on every device. The made-up database the
browser tests use now answers like production: the settings table exists (empty unless a test fills it)
and `set_shared_setting` works for the owner and administrators. A test can still say the step is missing
(`backend.missingTables = ['shared_settings']`).

**Changed because the intended default changed** (the old behaviour is kept as its own "database without
the shared settings" case wherever it mattered):

- `agent-diary-ext24`: a hand-off marked handled is saved as one shared setting (was: nothing written); no
  business table is written and no other function is called by the press.
- `attention-feed-ext24`, `backups-page-ext22`, `drafts-every-device-ext24`, `shared-switches-ext24`: the
  former "as shipped" tests became the "database without the shared settings" case; new "as shipped now"
  tests check the shared save.
- `launch-page-ext25`: 12 database steps instead of 13 (the shared settings are no longer a step to
  install); "Mark as done" in this browser became the "database without" case.
- `menu-layouts-ext24`: at sign-in the dashboard now **reads** two settings (switches, menu) and saves
  nothing; choosing a menu saves it for every device.
- `record-switches-ext24`, `preview-switches-ext21`: the "Settings shared by every device" switch is gone
  (13 rows instead of 14); turning a preview on answers "for every device".

**Genuine defects found and fixed in the dashboard:**

1. After choosing a menu, the keyboard focus was lost when "Saved for every device" appeared (the second
   redraw replaced the button). Fixed; the test checks the focus after the save.
2. The retired one-browser switch was still read from the browser. Removed: an old value does nothing.
3. Feature Flags said every switch applies "to this browser only, not saved to the database", even with the
   shared settings in use. Now it says where a switch applies just below.
4. When the shared switches could not be read, Feature Flags said nothing about where a switch applies.
   Now it says they could not be read, gives the reason, and that a switch is this browser's only.
5. The Launch page's fallback text pointed to the removed switch and gave no reason. Now it says why
   (not installed, could not be read, or the save failed).

**Corrected test mistakes (in tests written the same night):** a check that "no other function was called"
counted the dashboard's ordinary read functions at sign-in; it now counts only what the press itself sent.
A check on the number of "404" errors counted only one setting's reads; it now counts every request to the
missing table.
