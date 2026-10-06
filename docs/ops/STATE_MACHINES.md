# Workflow state machines (generated)

**Generated** from `tests/fixtures/state-machines.js` (`node tests/fixtures/state-machines.js --md`). `state-machine.spec.js` checks the fixture against the page's transition constants and the database's allowed values, and fails if this file is out of date. "From" is the condition sent with the write: a stale tab cannot apply a move from any other state (tested per state in `state-transitions*.spec.js`).

## tasks (`tasks.status`)

States: `open`, `in_progress`, `done`, `cancelled`. Terminal: `done`, `cancelled`.

| From | To | Button |
|---|---|---|
| `open` | `in_progress` | Mark in progress |
| `open`, `in_progress` | `done` | Mark done |

Not possible from the dashboard: `in_progress→open`, `done→open`, `cancelled→open`, `done→in_progress`, `cancelled→in_progress`, `cancelled→done`, `open→cancelled`, `in_progress→cancelled`, `done→cancelled`.

cancelled is a valid database value but no dashboard button sets it (agents may).

## purchase_orders (`purchase_orders.status`)

States: `draft`, `ordered`, `shipped`, `received`, `cancelled`. Terminal: `received`, `cancelled`.

| From | To | Button |
|---|---|---|
| `draft` | `ordered` | Mark as ordered |
| `ordered` | `shipped` | Mark as shipped |
| `draft`, `ordered`, `shipped` | `cancelled` | Cancel |
| `ordered`, `shipped` | `received` | Receive delivery |

Not possible from the dashboard: `ordered→draft`, `shipped→draft`, `received→draft`, `cancelled→draft`, `shipped→ordered`, `received→ordered`, `cancelled→ordered`, `draft→shipped`, `received→shipped`, `cancelled→shipped`, `draft→received`, `cancelled→received`, `received→cancelled`.

Lines, shipping and tax editable only while draft or ordered (PO_EDITABLE). Receive is claim-first, then re-reads the order (EXT5).

## returns (`returns.status`)

States: `requested`, `approved`, `rejected`, `received`, `refunded`, `closed`. Terminal: `closed`.

| From | To | Button |
|---|---|---|
| `requested` | `approved` | Approve |
| `requested` | `rejected` | Reject |
| `approved` | `received` | Mark Received |
| `received` | `refunded` | Mark Refunded |
| `rejected`, `refunded`, `received` | `closed` | Close |

Not possible from the dashboard: `approved→requested`, `rejected→requested`, `received→requested`, `refunded→requested`, `closed→requested`, `rejected→approved`, `received→approved`, `refunded→approved`, `closed→approved`, `approved→rejected`, `received→rejected`, `refunded→rejected`, `closed→rejected`, `requested→received`, `rejected→received`, `refunded→received`, `closed→received`, `requested→refunded`, `approved→refunded`, `rejected→refunded`, `closed→refunded`, `requested→closed`, `approved→closed`.

Refund accounting policy is owner decision N4; the dashboard records, it never pays.

## recalls (`recalls.status`)

States: `initiated`, `quarantined`, `resolved`. Terminal: `resolved`.

| From | To | Button |
|---|---|---|
| `initiated` | `quarantined` | Quarantine stock |
| `quarantined`, `initiated` | `resolved` | Mark resolved |

Not possible from the dashboard: `quarantined→initiated`, `resolved→initiated`, `resolved→quarantined`.

Resolving a never-quarantined recall needs a second, deliberate press and a resolution note.

## approval_requests (`approval_requests.status`)

States: `pending`, `approved`, `rejected`. Terminal: `approved`, `rejected`.

| From | To | Button |
|---|---|---|
| `pending` | `approved` | Approve (password) |
| `pending` | `rejected` | Deny (password) |

Not possible from the dashboard: `approved→pending`, `rejected→pending`, `rejected→approved`, `approved→rejected`.

## feature_requests (`feature_requests.status`)

States: `requested`, `in_progress`, `done`. Terminal: `done`.

| From | To | Button |
|---|---|---|
| `requested` | `in_progress` | Mark in progress |
| `in_progress` | `done` | Mark done |

Not possible from the dashboard: `in_progress→requested`, `done→requested`, `done→in_progress`, `requested→done`.

Database allowed values not verified yet (Query C section 9).

## legal_holds (`legal_holds.status`)

States: `active`, `released`. Terminal: `released`.

| From | To | Button |
|---|---|---|
| `active` | `released` | Release (password) |

Not possible from the dashboard: `released→active`.

Database allowed values not verified yet (Query C section 9).

## adverse_event_fda_flag (`adverse_event_reports.fda_reported`)

States: `false`, `true`. Terminal: `true`.

| From | To | Button |
|---|---|---|
| `false` | `true` | Mark reported to FDA (second press) |

Not possible from the dashboard: `true→false`.

