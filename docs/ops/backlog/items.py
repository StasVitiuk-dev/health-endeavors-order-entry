# Master platform backlog (2026-10-06) as data. Generates
# docs/ops/MASTER_PLATFORM_BACKLOG_2026-10-06.md (python3 docs/ops/backlog/items.py).
# Fields: id, area, title, why, P, launch impact, effort, deps, safe in branch
# (Y/N/P=partly), owner action (Y/N), production access (Y/N), status, merged-from
# (other places the same item was recorded; counted as deduplicated candidates).
# Status: DONE (this branch, tested), QUEUED, BLOCKED-QC (needs Query C),
# BLOCKED-OWNER, BLOCKED-PROD (needs an approved production change),
# BLOCKED-EXT (external info), DEFERRED (P4 / after launch).
I = []
def a(id, area, title, why, p, impact, effort, deps, safe, owner, prod, status, merged=()):
    I.append(dict(id=id, area=area, title=title, why=why, p=p, impact=impact, effort=effort, deps=deps,
                  safe=safe, owner=owner, prod=prod, status=status, merged=list(merged)))

# ---------------- Inventory / stock (R1–R5)
a('INV-01','Inventory','Install R1 receive_purchase_order (all-or-nothing receive)','Double stock + duplicate expense on retry/drop (reproduced)','P0','Blocker','L','Query C; owner approval','N','Y','Y','BLOCKED-PROD',['PROJECT_RECORD R1','known bug 1','po-receive wanted test'])
a('INV-02','Inventory','Install R2 quarantine_recall','Quarantine twice / partial on drop','P0','Blocker','M','Query C; approval','N','Y','Y','BLOCKED-PROD',['R2','known bug 2'])
a('INV-03','Inventory','Install R3 receive_return','Double restock on drop','P0','Blocker','M','Query C; approval','N','Y','Y','BLOCKED-PROD',['R3','known bug 7'])
a('INV-04','Inventory','Install R4 adjust_inventory','Lost updates / below-zero race in the browser path','P0','Blocker','M','Query C; approval','N','Y','Y','BLOCKED-PROD',['R4','known bug 3'])
a('INV-05','Inventory','Install R5 delete_unused_product','Product delete atomicity','P1','High','S','approval','N','Y','Y','BLOCKED-PROD',['R5','known bug 5'])
a('INV-06','Inventory','Dashboard PR: call R1–R5 instead of multi-step table writes','The browser path stays non-atomic until switched','P0','Blocker','L','INV-01..05 installed','P','Y','N','BLOCKED-PROD')
a('INV-07','Inventory','R1–R5 drafts reconciled with Query A schema','Drafts were written on a guessed schema','P1','High','M','Query A','Y','N','N','DONE')
a('INV-08','Inventory','Product-first lock order in every draft workflow','Deadlocks delete vs receive/quarantine (control reproduces)','P1','High','S','—','Y','N','N','DONE')
a('INV-09','Inventory','Lot upsert on real unique index','Same new lot on two deliveries collided','P1','Medium','S','—','Y','N','N','DONE')
a('INV-10','Inventory','Optional expected-value (stale) check on adjust_inventory','Resent request / stale tab applied twice','P1','Medium','S','—','Y','N','N','DONE')
a('INV-11','Inventory','delete_unused_product: permission + any-bucket stock + 0-row check','False success under RLS; +5/−5 read as empty','P1','Medium','S','—','Y','N','N','DONE')
a('INV-12','Inventory','Failure injection at every write of R1–R4 (fingerprint unchanged)','Prove all-or-nothing','P1','High','M','—','Y','N','N','DONE')
a('INV-13','Inventory','Stress S10–S19 (60 stale tabs, hot row, delete races, killed connection…)','Concurrency proof','P1','High','M','—','Y','N','N','DONE')
a('INV-14','Inventory','Stress: 100 concurrent callers mixed across all R-functions, repeated','Push concurrency beyond 60–80 callers','P2','Medium','S','—','Y','N','N','DONE')
a('INV-15','Inventory','R-functions: recalled stock cannot be restocked/adjusted below zero by recall paths; quarantine twice on two recalls of one lot','Edge of over-quarantine (D-ops-4)','P2','Medium','S','D-ops-4','Y','Y','N','QUEUED')
a('INV-16','Inventory','One active recall per lot (partial unique index or status check)','Two recalls can quarantine the same lot twice','P1','Medium','S','D-ops-4; approval','P','Y','Y','BLOCKED-OWNER',['D-ops-4'])
a('INV-17','Inventory','Partial-quantity returns in the dashboard (p_quantity)','Today the whole line is restocked','P2','Medium','M','D-ops-5','P','Y','N','BLOCKED-OWNER',['D-ops-5'])
a('INV-18','Inventory','Expense date for received PO uses business date (Central)','UTC date wrong in US evenings','P2','Medium','S','D-ops-3','P','Y','N','BLOCKED-OWNER',['D-ops-3','PR #11 note'])
a('INV-19','Inventory','Optional CHECK constraints (recalled >= 0, one expense per PO note)','Database-level safety net; Query B shows they apply cleanly','P2','Medium','S','approval','N','Y','Y','BLOCKED-PROD')
a('INV-20','Inventory','Revoke direct table writes on stock tables after R1–R5 (functions become the only path)','Legacy direct-write path bypasses the checks','P1','High','S','INV-06; Query C §8; approval','N','Y','Y','BLOCKED-PROD')
a('INV-21','Inventory','Rollout order R1 → R4 → R2 → R3 → R5','Money impact first','P1','High','S','D-ops-1','N','Y','N','BLOCKED-OWNER',['D-ops-1'])
a('INV-22','Inventory','Agents/automations writing stock directly (D-ops-6)','Would bypass R1–R5','P0','Blocker','S','Query C §5–7','N','Y','N','BLOCKED-QC',['D-ops-6'])
a('INV-23','Inventory','Browser: claim-first receive/return/recall; compare-and-set stock','Interim protection until R1–R5','P1','High','M','—','Y','N','N','DONE',['overnight 10-05'])
a('INV-24','Inventory','Product delete: permission, in-use check, stock row restore','False success; lost stock row','P1','High','S','—','Y','N','N','DONE')
a('INV-25','Inventory','Whole-unit catalogue PO lines; deleted POs locked; case-insensitive SKU','Real schema alignment','P1','High','S','Query A','Y','N','N','DONE')
a('INV-26','Inventory','Employee restock refused up front','Half-received return','P1','High','S','Query A','Y','N','N','DONE')
a('INV-27','Inventory','SQL draft tests for lot numbers with only whitespace / unicode / mixed case duplicates','Lot identity edge cases','P3','Low','S','—','Y','N','N','DONE')
a('INV-28','Inventory','Wanted (test.fail) atomicity tests flip to passing once dashboard calls R1–R4','Keeps the goal visible','P3','Low','S','INV-06','Y','N','N','BLOCKED-PROD')

# ---------------- State machine / contracts
a('SM-01','State machine','Mock enforces Query A CHECK rules on every write; impossible-data guard','Class of "denied" bugs','P1','High','M','Query A','Y','N','N','DONE')
a('SM-02','State machine','Document categories match DB (5 of 10 refused)','Uploads failed','P1','High','S','—','Y','N','N','DONE')
a('SM-03','State machine','Static audit of dropdowns, maps, transitions, literals','Coverage of unclicked values','P1','High','S','—','Y','N','N','DONE')
a('SM-04','State machine','Add Query C §9 rules (incidents, legal holds, FR, QC, inquiries, service_status, system_mode, enums) to db-constraints.js','Remaining tables unverified','P1','High','S','Query C','Y','N','N','BLOCKED-QC')
a('SM-05','State machine','incidents.severity accepts "normal"? (recall/QC escalation)','Escalation could fail for normal severity','P1','Medium','S','Query C §9','Y','N','N','BLOCKED-QC')
a('SM-06','State machine','orders.channel enum vs manual order entry values','A manual sale type could be refused','P1','Medium','S','Query C §9','Y','N','N','BLOCKED-QC')
a('SM-07','State machine','Approval Deny writes "rejected"; rejected = closed everywhere','Live bug (Query A)','P0','High','S','—','Y','N','N','DONE')
a('SM-08','State machine','Tasks: no transition out of done/cancelled; buttons have DB guards','Backwards moves','P1','Medium','S','—','Y','N','N','DONE')
a('SM-09','State machine','Feature requests: status advance guard + values vs DB','Unverified values','P2','Low','S','Query C §9','Y','N','N','BLOCKED-QC')
a('SM-10','State machine','Returns: re-open after refund impossible; approve only from requested','N13 finding','P1','High','S','—','Y','N','N','DONE',['N13'])
a('SM-11','State machine','Purchase orders: no backwards move; Cancel only draft/ordered/shipped','Cancel-after-receive','P1','High','S','—','Y','N','N','DONE')
a('SM-12','State machine','Document link types: supplier or none','Live bug (Query A)','P0','High','S','—','Y','N','N','DONE')
a('SM-13','State machine','Recall resolve needs note; never-quarantined needs second press','Compliance record','P1','Medium','S','—','Y','N','N','DONE')
a('SM-14','State machine','Legal hold release only active; FDA flag only once','Compliance','P1','Medium','S','—','Y','N','N','DONE')
a('SM-15','State machine','Customer inquiry "answered" guarded; severity/draft unguarded','Last write wins on drafts','P3','Low','S','—','Y','N','N','DONE')
a('SM-16','State machine','Service status change unguarded (stale overwrite)','Low consequence','P3','Low','S','—','Y','N','N','DONE')
a('SM-17','State machine','Agent switch / flag / system mode guarded','Stale tab flips','P1','High','S','—','Y','N','N','DONE')

# ---------------- Mutations / permissions / UX honesty
a('MU-01','Mutations','Silent RLS refusals reported as success (10 paths)','False "done"','P1','High','M','—','Y','N','N','DONE')
a('MU-02','Mutations','Escalate to incident at most once (QC, recall)','Duplicate/orphan incidents','P1','Medium','S','—','Y','N','N','DONE')
a('MU-03','Mutations','PO payment status guarded','Stale Paid → Unpaid','P2','Medium','S','—','Y','N','N','DONE')
a('MU-04','Mutations','Second press on Receive delivery and Mark Refunded','One-click irreversible','P2','Medium','S','—','Y','N','N','DONE')
a('MU-05','Mutations','Reminder double submit (form + quick add Enter)','Duplicates','P3','Low','S','—','Y','N','N','DONE')
a('MU-06','Mutations','Emergency mode: Shopify sync off / Agent #7 pause failures only logged to console; page says success','In an emergency the owner believes sync is off when it is not','P1','High','S','—','Y','N','N','DONE')
a('MU-07','Mutations','Sweep: every remaining .update/.delete without row check (calendar, inquiries, service status, reminders dismiss)','Complete the silent-refusal class','P2','Medium','S','—','Y','N','N','DONE')
a('MU-08','Mutations','Raw DB/RLS errors: plain explanation without hiding detail','Owner understands refusals','P2','Medium','S','—','Y','N','N','DONE')
a('MU-09','Mutations','Raw errors still show table/policy names (e.g. "for table evidence_locker")','Unnecessary internal detail in UI','P3','Low','S','—','Y','N','N','DONE')
a('MU-10','Mutations','Owner / Administrator / employee behaviour tested separately for each owner-only action','Role regressions','P2','Medium','M','—','Y','N','N','DONE')
a('MU-11','Mutations','Legal hold should block deletes of related records?','Compliance meaning of a hold','P1','Medium','M','owner decision','P','Y','N','BLOCKED-OWNER')
a('MU-12','Mutations','Product edit concurrent-edit guard (updated_at)','Last save wins','P3','Low','S','—','Y','N','N','DEFERRED')
a('MU-13','Mutations','Session revoke (rpc) result not checked for "nothing revoked"','Could claim a device was logged out','P2','Medium','S','—','Y','N','N','DONE')
a('MU-14','Mutations','Business rules threshold: stale overwrite (config) unguarded','Two owners editing','P3','Low','S','—','Y','N','N','DONE')
a('MU-15','Mutations','Password re-check Enter-twice sends two checks','PR #13','P2','Low','S','—','Y','N','N','DONE',['PR #13'])

# ---------------- Storage / uploads
a('ST-01','Storage','Saved record never loses its file on dropped reply','Data loss','P0','High','S','—','Y','N','N','DONE')
a('ST-02','Storage','Evidence/receipt orphan cleanup; document delete removes file','Orphans','P1','Medium','S','—','Y','N','N','DONE',['security review S10'])
a('ST-03','Storage','Size/type check before upload','Late failure; active content','P2','Low','S','—','Y','N','N','DONE')
a('ST-04','Storage','Receipt delete: storage removed but DB clear fails → record points at missing file','Documented, acceptable; test it','P3','Low','S','—','Y','N','N','DONE')
a('ST-05','Storage','Malicious filenames (path traversal, unicode, very long) produce safe storage paths','Path safety','P2','Medium','S','—','Y','N','N','DONE')
a('ST-06','Storage','Path collision: same name in the same millisecond','Upload error','P3','Low','S','—','Y','N','N','DONE')
a('ST-07','Storage','Read-only check of bucket privacy, size limits, MIME rules and storage policies','Unknown production settings','P1','Medium','S','owner runs a read-only check','N','Y','Y','BLOCKED-PROD')
a('ST-08','Storage','Read-only listing of orphaned objects created before the fixes','Cleanup scope','P3','Low','S','owner','N','Y','Y','BLOCKED-PROD')
a('ST-09','Storage','Server-side atomic upload+record (signed upload + DB function) design','Browser cannot make two systems atomic','P3','Low','M','design only','Y','N','N','QUEUED')
a('ST-10','Storage','Signed-URL lifetime (60 s) and download link behaviour documented','Expired links','P4','Low','S','—','Y','N','N','DEFERRED')

# ---------------- Reporting / money
a('RP-01','Reporting','Totals complete beyond 1,000 rows (Accounting, Tax, Business Health, Daily Summary)','Silent undercount','P0','High','M','—','Y','N','N','DONE',['N14'])
a('RP-02','Reporting','Boundary tests 0/1/999/1,000/1,001/10,000 rows for Accounting and Tax totals','Off-by-one at page edges','P2','Medium','S','—','Y','N','N','DONE')
a('RP-03','Reporting','Refund accounting decision N4 (subtract vs full)','Revenue correctness','P1','High','S','owner decision','P','Y','N','BLOCKED-OWNER',['N4'])
a('RP-04','Reporting','Accounting/Tax date ranges in Central time vs UTC','Evening orders counted on the wrong day','P1','Medium','S','D-ops-3 / owner','P','Y','N','BLOCKED-OWNER',['PR #11 note'])
a('RP-05','Reporting','Deleted (soft) orders and expenses excluded from all totals — test','Double counting','P2','Medium','S','—','Y','N','N','DONE')
a('RP-06','Reporting','Duplicate PO expenses detection in reports','Duplicate expense visibility','P3','Low','S','—','Y','N','N','QUEUED')
a('RP-07','Reporting','Tax CSV export = figures on screen at scale (2,500 rows)','Export truncation','P2','Medium','S','—','Y','N','N','DONE')
a('RP-08','Reporting','Partial refunds counted in full (listed for review)','Known limitation','P2','Medium','M','N4','P','Y','N','BLOCKED-OWNER')
a('RP-09','Reporting','Sales tax by state requires state field on real orders','Unverified until first real order','P2','Medium','S','first real order','N','Y','N','BLOCKED-EXT')
a('RP-10','Reporting','report_totals draft reconciled with real NOT NULL columns (orders.channel, returns.reason)','Draft test assumed the guessed schema','P2','Medium','S','Query A','Y','N','N','DONE')
a('RP-10','Reporting','AI spend this month complete beyond 1,000 log rows','Spend cap check','P2','Medium','S','—','Y','N','N','DONE')

# ---------------- Scale / pagination
a('SC-01','Scale','Calendar notes batched; inquiry orders chunked','URL overflow','P2','Medium','S','—','Y','N','N','DONE')
a('SC-02','Scale','Activity "Export to spreadsheet" exports only the rows loaded, silently','Partial audit export','P2','Medium','S','—','Y','N','N','DONE')
a('SC-03','Scale','Activity "Today" digest capped at 500 shows "500 changes"','Undercount','P2','Low','S','—','Y','N','N','DONE')
a('SC-04','Scale','Record Inspector history: 200 search matches filtered client-side → incomplete history','Audit view incomplete','P2','Medium','S','—','Y','N','N','DONE')
a('SC-05','Scale','"Showing first 1,000" notice for long lists (lots, products, POs)','Silent list truncation later','P3','Low','S','—','Y','N','N','DEFERRED')
a('SC-06','Scale','Lot pickers truncate after 1,000 lots','Older lots missing from pickers','P3','Low','S','—','Y','N','N','DEFERRED')
a('SC-07','Scale','Single reusable paging helper used by all totals (fetchAllRows/In)','Consistency','P3','Low','S','—','Y','N','N','DONE')
a('SC-08','Scale','Search (sidebar/palette) loads only already-loaded records — document','Search scope','P4','Low','S','—','Y','N','N','DEFERRED')

# ---------------- Security
a('SE-01','Security','Query D: elevated functions callable by anon — classify and review','Possible unauthenticated writes','P0','High','S','owner runs Query D','N','Y','Y','BLOCKED-OWNER')
a('SE-02','Security','Permission fixes from Query D (revoke/grant, gates)','Depends on Query D','P0','High','M','SE-01; approval','N','Y','Y','BLOCKED-PROD')
a('SE-03','Security','Escape output on search.html / dashboard.html','XSS','P1','High','S','—','Y','N','N','DONE',['R6','PR #7'])
a('SE-04','Security','Pin + SRI Supabase library on all pages','Supply chain','P1','High','S','—','Y','N','N','DONE',['R7'])
a('SE-05','Security','XSS second payload family across every text field','Escaping coverage','P1','High','S','—','Y','N','N','DONE')
a('SE-06','Security','CSV formula guard (= + - @ tab CR)','Spreadsheet injection','P1','Medium','S','—','Y','N','N','DONE',['PR #9'])
a('SE-07','Security','Link scheme allowlist (javascript:, data:, vbscript:)','Clickable code','P1','Medium','S','—','Y','N','N','DONE',['PR #10'])
a('SE-08','Security','Activity export CSV formula injection test (person/record text)','Second export path','P2','Medium','S','—','Y','N','N','DONE')
a('SE-09','Security','Bidi/RTL override and zero-width characters in names shown with clear isolation','Spoofed display text','P3','Low','S','—','Y','N','N','DONE')
a('SE-10','Security','Public repo hygiene scan in CI (no keys/emails in added files)','Prevent leaks','P3','Low','S','—','Y','N','N','DONE')
a('SE-11','Security','Password re-check covers every destructive action (matrix complete)','Consistency','P2','Medium','S','—','Y','N','N','DONE')
a('SE-12','Security','Task access hardening before more staff','Least privilege','P2','Medium','M','owner','N','Y','Y','BLOCKED-OWNER',['owner list'])
a('SE-13','Security','Failed-login history / login alerts','Detect account abuse','P4','Low','M','server side','N','Y','Y','DEFERRED',['owner list'])

# ---------------- Agents / automation
a('AG-01','Agents','Agent #1 (invoices) state verified ON before real orders','Orders without invoices','P0','Blocker','S','Query C §1/§3','N','Y','N','BLOCKED-QC',['pending check 5'])
a('AG-02','Agents','Truthful agent state (Unknown/Failed/Stale/Dry run)','No optimistic defaults','P1','High','M','—','Y','N','N','DONE')
a('AG-03','Agents','"error"/"fail" statuses show Failed; Agent #1 "Switch on"','Overclaim','P2','Medium','S','—','Y','N','N','DONE')
a('AG-04','Agents','Scheduled jobs list vs dashboard cron names reconciled','Stale job names','P2','Medium','S','Query C §5','Y','N','N','BLOCKED-QC')
a('AG-05','Agents','Shopify sync interlock + wording; Emergency switches it off','Premature sync','P1','High','S','—','Y','N','N','DONE',['R9'])
a('AG-06','Agents','No-send tripwires (email, Shopify)','No customer messages','P1','High','S','—','Y','N','N','DONE',['R10'])
a('AG-07','Agents','Agent run-history view','Operational visibility','P4','Low','M','—','Y','N','N','DEFERRED',['owner list'])
a('AG-08','Agents','Agent #8 migration to Supabase with dedupe','Reliability','P4','Low','L','owner','N','Y','Y','DEFERRED',['owner list'])
a('AG-09','Agents','Re-enable workflows / Shopify sync at launch','Operations','P1','Blocker','S','products; R1–R4','N','Y','Y','BLOCKED-OWNER',['R9'])
a('AG-10','Agents','Agent #6 real email service decision','Customer messages','P2','Medium','M','owner','N','Y','Y','BLOCKED-OWNER',['R10'])

# ---------------- Store / Shopify
a('SH-01','Shopify','Real products with exact SKUs (dashboard = Shopify)','Returns/receives find products by SKU','P1','Blocker','S','owner','N','Y','Y','BLOCKED-OWNER',['R8'])
a('SH-02','Shopify','Sync design decision (D-4)','How orders/stock flow','P1','Blocker','M','owner','N','Y','N','BLOCKED-OWNER',['D-4'])
a('SH-03','Shopify','Order status words match Accounting/Tax classification after launch','Revenue classification','P2','Medium','S','first real orders','N','Y','N','BLOCKED-EXT',['pending check 4'])

# ---------------- Empty / partial states
a('EM-01','Empty states','Every page clean on empty DB; products without movement','First launch','P2','Medium','S','—','Y','N','N','DONE')
a('EM-02','Empty states','System mode default shown as default, not as saved','Unknown ≠ Normal','P2','Medium','S','—','Y','N','N','DONE')
a('EM-03','Empty states','Business Health "Paused agents 0" when agent switches could not be read','Unknown shown as zero','P2','Medium','S','—','Y','N','N','DONE')
a('EM-04','Empty states','Pages when a single loader fails (one table errors) — rest still render, error says which','Partial failure','P2','Medium','S','—','Y','N','N','DONE')
a('EM-05','Empty states','Missing feature_flags row for shopify_order_sync: say "not configured", not "off"','Unknown vs off','P2','Medium','S','—','Y','N','N','DONE')
a('EM-06','Empty states','Product without inventory row: Inventory page shows it with "no stock row" warning','Broken invariant visible','P3','Low','S','—','Y','N','N','DONE')

# ---------------- Accessibility / responsive
a('AX-01','Accessibility','Accessible names, unique ids, phone tap targets, dialog focus','Screen readers / phone','P2','Medium','S','—','Y','N','N','DONE')
a('AX-02','Accessibility','Status/error banner announced to screen readers (role=alert / aria-live)','Errors not announced','P2','Medium','S','—','Y','N','N','DONE')
a('AX-03','Accessibility','Toasts announced (aria-live polite)','Success not announced','P3','Low','S','—','Y','N','N','DONE')
a('AX-04','Accessibility','prefers-reduced-motion respected for animations','Motion sensitivity','P3','Low','S','—','Y','N','N','DONE')
a('AX-05','Accessibility','Keyboard: every overlay closes with Escape and returns focus','Keyboard users','P2','Medium','S','—','Y','N','N','DONE')
a('AX-06','Accessibility','Colour contrast check of badges in light/dark','Readability','P3','Low','S','—','Y','N','N','DONE')
a('AX-07','Accessibility','Dark theme: white text on bright blue/red fills (buttons 3.0:1, Delete 2.8:1) and default-blue links (1.8:1)','Found by the AA contrast test (2026-10-06)','P2','Medium','S','—','Y','N','N','DONE')
a('AX-08','Accessibility','64 hard-coded grey inline text colours ignored the theme (labels 1.6:1 in dark; dates 3.1:1 in light)','Found by the AA contrast test (2026-10-06)','P2','Medium','S','—','Y','N','N','DONE')
a('AX-09','Accessibility','Contrast of text inside plain divs/spans (test covers badges, buttons, hints, empty states, labels, links, stat labels)','Remaining coverage gap','P3','Low','S','—','Y','N','N','QUEUED')
a('RS-01','Responsive','Key workflows at narrow desktop (800px) and tablet (768px)','Untested widths','P2','Medium','S','—','Y','N','N','DONE')
a('RS-02','Responsive','Phone swipe in tables; PO tap opens history','PR #12, #14','P2','Medium','S','—','Y','N','N','DONE',['PR #12','PR #14'])
a('RS-03','Responsive','Real iPhone Safari check of task buttons','Chromium only in tests','P2','Medium','S','owner','N','Y','N','BLOCKED-OWNER',['pending check 1'])

# ---------------- Search / palette / calendar / misc UX
a('UX-01','UX','Sidebar search: typing a page name + Enter opens that page (test.fixme)','Known behaviour gap; owner said palette Enter→guide looks deliberate','P3','Low','S','owner decision','Y','Y','N','BLOCKED-OWNER',['general.spec fixme','known bug 11'])
a('UX-02','UX','Palette first keys lost after Cmd+K','Typing lost','P3','Low','S','—','Y','N','N','DONE')
a('UX-03','UX','US-evening dates (expense/AE defaults, lot expiry, file names, tax receipt list)','Off by one day','P2','Medium','S','—','Y','N','N','DONE',['PR #11','known bug 9'])
a('UX-04','UX','Stale agent status text #2/#3/#7/#8','Wording','P3','Low','S','—','Y','N','N','DONE',['PR #8'])
a('UX-05','UX','"Recently done + Reopen" on Tasks','Owner wish','P4','Low','M','—','Y','N','N','DEFERRED',['owner list'])
a('UX-06','UX','Administrator tries personal calendar','Pending check','P3','Low','S','owner','N','Y','N','BLOCKED-OWNER',['pending check 2'])

# ---------------- Tests / CI / harness
a('TQ-01','Tests','Flaky palette tests fixed at root; employee delete test robust','Trust in suite','P3','Medium','S','—','Y','N','N','DONE')
a('TQ-02','Tests','Mutation tests for page-side guards (stale guard, noRowsChanged, escaping, paging, upload cleanup)','Prove tests bite','P3','Medium','M','—','Y','N','N','DONE')
a('TQ-03','Tests','Mock: DELETE representation, ilike, constraints, URL limits','Realism','P3','Medium','S','—','Y','N','N','DONE')
a('TQ-04','Tests','Mock refuses NOT NULL omissions for all Query A columns (not only status columns)','Inserts missing required fields','P3','Medium','S','—','Y','N','N','DONE')
a('TQ-05','Tests','Request baseline kept current','Unexpected requests','P3','Low','S','—','Y','N','N','DONE')
a('CI-01','CI','Tests-only workflow ready, least privilege','Automated checks','P2','Medium','S','—','Y','N','N','DONE')
a('CI-02','CI','Activate CI (owner opens/merges the PR) and make Playwright required','Gate merges','P2','Medium','S','owner','N','Y','Y','BLOCKED-OWNER')
a('CI-03','CI','Verify pinned action SHAs against release tags','Supply chain','P2','Low','S','owner (other repos out of scope)','N','Y','N','BLOCKED-OWNER')
a('CI-04','CI','Optional SQL job (local Postgres service) for draft tests','Draft regressions caught in CI','P3','Low','M','CI-02','Y','Y','N','QUEUED')
a('CI-05','CI','Secret/PII scan step in CI','Public repo hygiene','P3','Low','S','—','Y','N','N','DONE')

# ---------------- Modularization / maintainability
a('MD-01','Modularization','Steps 1, 2, 2b (CSS, icon, 28 pure helpers)','Smaller main file','P3','Low','M','—','Y','N','N','DONE')
a('MD-02','Modularization','Move confirmSecondPress + small DOM helpers','Next safe slice','P3','Low','S','—','Y','N','N','DONE')
a('MD-03','Modularization','HE namespace + start registry + feature modules','Plan step 3','P3','Low','L','open PRs merged','N','Y','N','BLOCKED-OWNER')
a('MD-04','Modularization','Upload helpers (uploadThenSave) to a module with supabase injected','Reuse/testing','P3','Low','S','—','Y','N','N','QUEUED')

# ---------------- Docs / process / owner
a('DOC-01','Docs','Audits recorded (state machine, mutations, storage, pagination, launch readiness)','Durable record','P3','Medium','S','—','Y','N','N','DONE')
a('DOC-02','Docs','Merge order for open PRs #5–#24 and this branch','Safe rollout','P2','High','S','owner','Y','Y','N','BLOCKED-OWNER',['pr-merge-order.md'])
a('DOC-03','Docs','Owner runbook: how to install R1–R5 and roll back (click-by-click)','Production change by owner','P1','High','S','—','Y','N','N','DONE')
a('DOC-04','Docs','Mark superseded statements in older docs (guessed schema, "BLOCKED ON QUERY A/B")','Stale docs','P3','Low','S','—','Y','N','N','DONE')
a('DOC-05','Docs','Task v2 live checks (refresh, audit_log, Cancel, iPhone, 2nd account)','Pending owner checks','P2','Medium','S','owner','N','Y','N','BLOCKED-OWNER',['pending check 1'])
a('DOC-06','Docs','Document category list decision','DB rule vs wishes','P2','Low','S','owner','N','Y','Y','BLOCKED-OWNER')
a('DOC-07','Docs','Query C run and results analysed','Unblocks SM-04..06, INV-22, AG-01/04','P0','Blocker','S','owner runs it','N','Y','Y','BLOCKED-OWNER')
a('DOC-08','Docs','Activity-log retention policy','Storage growth / privacy','P4','Low','S','owner','N','Y','N','DEFERRED',['owner list'])
a('DOC-09','Docs','Invoice status decision (issued vs draft)','Agent #1 output','P3','Low','S','owner','N','Y','N','BLOCKED-OWNER',['owner list'])

if __name__ == '__main__':
    import collections, os
    order = {'P0':0,'P1':1,'P2':2,'P3':3,'P4':4}
    st = collections.Counter(i['status'] for i in I)
    pr = collections.Counter((i['p'], i['status']=='DONE') for i in I)
    merged = sum(len(i['merged']) for i in I)
    out = []
    out.append('# Master platform backlog (2026-10-06)\n')
    out.append('Internal dashboard/platform only. Generated from `docs/ops/backlog/items.py` (edit the data there, then run `python3 docs/ops/backlog/items.py`). No production secrets or private business data.\n')
    out.append(f'**{len(I)} deduplicated items** from {len(I)+merged} raw candidates ({merged} duplicates merged: the same item recorded in PROJECT_RECORD, the overnight review, PRs, owner lists, decision registers and tests).\n')
    out.append('Status counts: ' + ', '.join(f'{k} {v}' for k,v in sorted(st.items())) + '\n')
    rows = []
    for p in ['P0','P1','P2','P3','P4']:
        tot = sum(1 for i in I if i['p']==p); done = sum(1 for i in I if i['p']==p and i['status']=='DONE')
        rows.append(f'| {p} | {tot} | {done} | {tot-done} |')
    out.append('| Priority | Items | Done (branch) | Remaining |\n|---|---|---|---|\n' + '\n'.join(rows) + '\n')
    out.append('Priorities: P0 data loss / security / financial corruption / destructive · P1 launch blocker / correctness / concurrency / permission · P2 reliability / scale / accessibility / major UX · P3 maintainability / tests / docs · P4 future.\n')
    out.append('"Done" = implemented and tested on `claude/platform-overnight-implementation` — **not merged, not live**.\n')
    for p in ['P0','P1','P2','P3','P4']:
        out.append(f'\n## {p}\n')
        out.append('| ID | Area | Item | Why it matters | Launch impact | Effort | Depends on | Safe in branch | Owner | Prod | Status |')
        out.append('|---|---|---|---|---|---|---|---|---|---|---|')
        for i in sorted([x for x in I if x['p']==p], key=lambda x:(x['status']=='DONE', x['id'])):
            out.append(f"| {i['id']} | {i['area']} | {i['title']} | {i['why']} | {i['impact']} | {i['effort']} | {i['deps']} | {i['safe']} | {i['owner']} | {i['prod']} | {i['status']} |")
    out.append('\n## Merged duplicates (provenance)\n')
    for i in I:
        if i['merged']: out.append(f"- {i['id']}: {', '.join(i['merged'])}")
    path = os.path.join(os.path.dirname(__file__), '..', 'MASTER_PLATFORM_BACKLOG_2026-10-06.md')
    open(path,'w').write('\n'.join(out) + '\n')
    print(len(I), 'items;', merged, 'merged;', dict(st))
