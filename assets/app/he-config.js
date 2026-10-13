// assets/app/he-config.js — fixed configuration: sidebar groups, icons, help text, status and label maps, agent registry, limits
// EXT15: moved unchanged out of assets/owner-login-app.js (initApp). Its inputs
// arrive explicitly in ctx; it returns only what other code still uses. Map:
// docs/ops/APPLICATION_MODULE_MAP_EXT15.md. Created once, by the app, in order.
window.HE.modules.define('he-config', { api: 1, needs: [] }, function (ctx) {
    const RET_ORDER_CAP = 200;
    // Safety net (EXT4): Supabase returns at most 1,000 rows per request and
    // does not say when it cut a list short. Totals and money use complete
    // paged reads (fetchAllRows); the plain lists (products, lots, purchase
    // orders, compliance records) read the whole table in one request. If
    // one of those ever comes back with 1,000 rows, say the list may be
    // incomplete instead of letting it look whole. Reads with an explicit
    // limit or page (offset/limit) are not affected.
    const ROW_CAP = 1000;

    // EXT9: the stock buttons can use the all-or-nothing database functions
    // R1–R5 (docs/ops/sql/drafts/10_…) instead of the chains of browser
    // requests above. Each button switches only after the owner has installed
    // the functions AND turned on its own switch on Feature Switches
    // (drafts/21_… adds the switches, all off). A switch that is off, missing
    // or cannot be read means today's path, unchanged. Read at every click, so
    // turning a switch off takes effect at once (rollback without a deploy).
    const STOCK_FN_FLAGS = {
      receive: 'stock_fn_receive_po', recall: 'stock_fn_recall', ret: 'stock_fn_return',
      adjust: 'stock_fn_adjust', deleteProduct: 'stock_fn_delete_product',
    };
    // EXT10b (missions 75-79): what each high-risk switch depends on, shown on
    // Feature Switches. Off is always safe; on is refused until this exists.
    const FLAG_DEPENDS = {
      stock_fn_receive_po: 'database function receive_purchase_order (R1, drafts/10) installed and verified (V8 fingerprint)',
      stock_fn_recall: 'database function quarantine_recall (R2, drafts/10) installed and verified (V8)',
      stock_fn_return: 'database function receive_return (R3, drafts/10) installed and verified (V8)',
      stock_fn_adjust: 'database function adjust_inventory (R4, drafts/10) installed and verified (V8)',
      stock_fn_delete_product: 'database function delete_unused_product (R5, drafts/10) installed and verified (V8)',
      request_keys: 'request-key columns (drafts/19) installed (V11)',
      integrity_results_home: 'nightly check tables (drafts/25 + drafts/29) installed with a first run (V12)',
    };
    // ---------- theme ----------
    // Three settings, cycled by the header button: Auto (follows your Mac),
    // Light, Dark. The choice is remembered in this browser only.
    const THEME_ORDER = ['auto', 'light', 'dark'];
    const THEME_FACE = { auto: '🌗', light: '☀️', dark: '🌙' };
    const THEME_NAME = { auto: 'Follows your Mac', light: 'Light', dark: 'Dark' };

    // Gives every "nothing here yet" message a small icon, without touching the
    // dozens of places that write those messages. Loading messages are skipped.
    const EMPTY_ICONS = [
      [/order/i, '🧾'], [/product|inventory|stock/i, '📦'], [/return/i, '↩️'],
      [/expense/i, '💳'], [/task/i, '✅'], [/incident/i, '🚨'], [/approval/i, '✋'],
      [/question|inquir/i, '💬'], [/procedure|sop/i, '📘'], [/hold/i, '⚖️'],
      [/evidence/i, '🗄️'], [/recycle|deleted/i, '🗑️'], [/activity|history/i, '👣'],
      [/calendar|event/i, '📅'], [/report/i, '📈'], [/rule|flag/i, '🎛️'],
    ];

    // ---------- sidebar navigation + search ----------
    // Every page we've built, grouped by topic. Add a new panel's id/label
    // here and it shows up in the sidebar automatically — nothing else to wire up.
    // Each group carries a colour and each page a small icon, so the sidebar
    // can be navigated by eye rather than by reading every label.
    const SIDEBAR_GROUPS = [
      { label: 'Overview', color: '#1f7a8c', pages: [
        { id: 'attentionPanel', label: 'Needs Your Attention' },
        { id: 'dailySummaryPanel', label: 'Daily Summary' },
        { id: 'reportHistoryPanel', label: 'Report History' },
        { id: 'calendarPanel', label: 'Calendar' },
      ]},
      { label: 'Sales', color: '#b8734a', pages: [
        { id: 'ordersPanel', label: 'Orders & Revenue' },
      ]},
      { label: 'Inventory', color: '#8a6d3b', pages: [
        { id: 'inventoryPanel', label: 'Inventory' },
        { id: 'returnsPanel', label: 'Returns' },
        { id: 'suppliersPanel', label: 'Suppliers' },
        { id: 'purchaseOrdersPanel', label: 'Purchase Orders' },
        { id: 'qualityControlPanel', label: 'Quality Control' },
      ]},
      { label: 'Finance', color: '#2f7d4f', pages: [
        { id: 'expensesPanel', label: 'Expenses' },
        { id: 'accountingPanel', label: 'Accounting' },
        { id: 'taxRecordsPanel', label: 'Tax Records' },
      ]},
      { label: 'Operations', color: '#3f6fa8', pages: [
        { id: 'tasksPanel', label: 'Tasks' },
        { id: 'incidentsPanel', label: 'Incidents' },
        { id: 'evidenceLockerPanel', label: 'Evidence Locker' },
        { id: 'documentsPanel', label: 'Documents' },
      ]},
      { label: 'Customers & AI', color: '#7a5aa8', pages: [
        { id: 'inquiriesPanel', label: 'Customer Inquiries' },
        { id: 'aiPanel', label: 'AI Agent Activity' },
      ]},
      { label: 'Admin', color: '#9c5a72', pages: [
        { id: 'flagsPanel', label: 'Feature Flags' },
        { id: 'businessRulesPanel', label: 'Business Rules' },
        { id: 'approvalsPanel', label: 'Approval Queue' },
        { id: 'sessionsPanel', label: 'Active Sessions' },
        { id: 'activityPanel', label: 'Employee Activity' },
        { id: 'sopsPanel', label: 'Procedures (SOPs)' },
        { id: 'featureRequestsPanel', label: 'Feature Requests' },
      ]},
      // Built and working, but rarely needed day to day — folded up by default
      // so the sidebar is shorter. One click opens it; searching still finds
      // these pages, and it opens by itself if you're on one of them.
      { label: 'Compliance', color: '#8a6d6d', collapsible: true, pages: [
        { id: 'recallsPanel', label: 'Recalls' },
        { id: 'adverseEventsPanel', label: 'Adverse Event Reports' },
        { id: 'legalHoldsPanel', label: 'Legal Holds' },
        { id: 'continuityPanel', label: 'Business Continuity' },
      ]},
    ];
    const ICON_PATHS = {
      attentionPanel:      '<path d="M8 2.2a3.2 3.2 0 0 0-3.2 3.2c0 3.1-1.2 4-1.2 4h8.8s-1.2-.9-1.2-4A3.2 3.2 0 0 0 8 2.2Z"/><path d="M6.6 11.6a1.6 1.6 0 0 0 2.8 0"/>',
      dailySummaryPanel:   '<circle cx="8" cy="8" r="2.6"/><path d="M8 1.6v1.1M8 13.3v1.1M1.6 8h1.1M13.3 8h1.1M3.6 3.6l.8.8M11.6 11.6l.8.8M12.4 3.6l-.8.8M4.4 11.6l-.8.8"/>',
      reportHistoryPanel:  '<path d="M2.5 13.4h11"/><path d="M4.8 13.4V8.2M8 13.4V4.4M11.2 13.4v-3.2"/>',
      calendarPanel:       '<rect x="2.4" y="3.4" width="11.2" height="10.2" rx="2"/><path d="M2.4 6.4h11.2M5.6 2.2v2.2M10.4 2.2v2.2"/>',
      ordersPanel:         '<path d="M4 2.2h8v11.6l-2-1.2-2 1.2-2-1.2-2 1.2Z"/><path d="M6.2 5.6h3.6M6.2 8.2h3.6"/>',
      inventoryPanel:      '<path d="M2.6 5.4 8 2.6l5.4 2.8v5.2L8 13.4l-5.4-2.8Z"/><path d="M2.6 5.4 8 8.2l5.4-2.8M8 8.2v5.2"/>',
      returnsPanel:        '<path d="M3.2 7.2h6.2a3 3 0 0 1 0 6H6.8"/><path d="m5.6 4.4-2.4 2.8 2.4 2.6"/>',
      expensesPanel:       '<rect x="2" y="4" width="12" height="8.4" rx="2"/><path d="M2 7h12M4.6 10h2.4"/>',
      accountingPanel:     '<rect x="3.4" y="2" width="9.2" height="12" rx="2"/><path d="M5.8 5h4.4"/><path d="M6.2 8.4h.01M8 8.4h.01M9.8 8.4h.01M6.2 11h.01M8 11h.01M9.8 11h.01"/>',
      taxRecordsPanel:     '<rect x="3" y="1.5" width="10" height="13" rx="1.5"/><path d="M5.5 5h5M5.5 7.5h5M5.5 10h3"/>',
      tasksPanel:          '<rect x="2.4" y="2.4" width="11.2" height="11.2" rx="2.8"/><path d="m5.4 8.2 1.8 1.8 3.4-3.6"/>',
      incidentsPanel:      '<path d="M8 2.6 14 13H2Z"/><path d="M8 6.6v3M8 11.4h.01"/>',
      evidenceLockerPanel: '<rect x="2" y="3" width="12" height="3" rx="1"/><path d="M3.2 6v6a1.6 1.6 0 0 0 1.6 1.6h6.4A1.6 1.6 0 0 0 12.8 12V6"/><path d="M6.6 8.8h2.8"/>',
      documentsPanel:      '<path d="M4.4 2h5l2.2 2.2v9.4a1 1 0 0 1-1 1H4.4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z"/><path d="M9.4 2v2.6H12"/><path d="M5.6 8.4h4.8M5.6 10.8h4.8"/>',
      adverseEventsPanel:  '<circle cx="8" cy="8" r="5.8"/><path d="M8 5.4v5.2M5.4 8h5.2"/>',
      inquiriesPanel:      '<path d="M13.4 8.4c0 2.5-2.4 4.5-5.4 4.5-.7 0-1.4-.1-2-.3l-3 1.2 1-2.5C3.1 10.5 2.6 9.5 2.6 8.4 2.6 5.9 5 3.9 8 3.9s5.4 2 5.4 4.5Z"/>',
      aiPanel:             '<path d="M8 2.4 9.4 6.4 13.4 7.8 9.4 9.2 8 13.2 6.6 9.2 2.6 7.8 6.6 6.4Z"/>',
      continuityPanel:     '<path d="M8 2.2 13 4v4c0 3-2.2 5-5 5.8C5.2 13 3 11 3 8V4Z"/><path d="m6.2 7.9 1.4 1.4 2.6-2.8"/>',
      flagsPanel:          '<rect x="1.8" y="4.6" width="12.4" height="6.8" rx="3.4"/><circle cx="10.6" cy="8" r="1.9"/>',
      businessRulesPanel:  '<path d="M2.6 5.2h10.8M2.6 10.8h10.8"/><circle cx="6" cy="5.2" r="1.6"/><circle cx="10.4" cy="10.8" r="1.6"/>',
      approvalsPanel:      '<circle cx="8" cy="8" r="5.8"/><path d="m5.6 8.2 1.7 1.7 3.2-3.5"/>',
      sessionsPanel:       '<rect x="2" y="3" width="12" height="8" rx="1.8"/><path d="M6 13.6h4M8 11v2.6"/>',
      activityPanel:       '<path d="M2.8 8a5.2 5.2 0 1 0 1.5-3.7"/><path d="M2.4 2.9v2.6h2.6"/><path d="M8 5.4V8l1.8 1.1"/>',
      sopsPanel:           '<path d="M4 2.6h6.2a1.8 1.8 0 0 1 1.8 1.8v9H5.8A1.8 1.8 0 0 1 4 11.6Z"/><path d="M6.2 5.8h3.6M6.2 8.2h3.6"/>',
      featureRequestsPanel:'<path d="M6 11.4a4 4 0 1 1 4 0v1.2H6Z"/><path d="M6.6 14h2.8"/>',
      legalHoldsPanel:     '<rect x="3.4" y="7" width="9.2" height="6.4" rx="2"/><path d="M5.8 7V5.4a2.2 2.2 0 0 1 4.4 0V7"/>',
      suppliersPanel:      '<path d="M2.4 6.2h11.2v7a1.2 1.2 0 0 1-1.2 1.2H3.6a1.2 1.2 0 0 1-1.2-1.2Z"/><path d="M2 3.2h12v3H2Z"/><path d="M6.6 9.4h2.8"/>',
      purchaseOrdersPanel: '<path d="M4.2 2.2h5l2.8 2.8v8.8H4.2Z"/><path d="M9 2.2V5h2.9"/><path d="M6.2 8.4h3.6M6.2 10.8h2.4"/>',
      qualityControlPanel: '<rect x="3.4" y="2.6" width="9.2" height="11.2" rx="1.4"/><path d="M6 2.6V2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v.6"/><path d="m5.8 8.4 1.5 1.5 3-3.4"/>',
      recallsPanel:        '<path d="M8 1.8 14.6 13.4H1.4Z"/><path d="M8 6.4v3.2"/><circle cx="8" cy="11.6" r="0.15" fill="currentColor" stroke="none"/>',
    };

    // Smart Universal Search: every load function that fetches real records
    // (orders, tasks, incidents, etc.) also drops its rows in here, so typing
    // in the sidebar search box can find "Jane Doe" or "order 1042" no matter
    // which page it actually lives on. Scoped strictly to data already inside
    // this dashboard — it has nothing to do with the future public website
    // or buyer-login idea, which is a separate, later project.
    const SEARCH_INDEX = {
      orders: [], tasks: [], incidents: [], approvals: [], sops: [],
      featureRequests: [], evidence: [], adverseEvents: [], legalHolds: [],
      attention: [], expenses: [], inventory: [], returns: [], people: [],
      suppliers: [], purchaseOrders: [], qualityChecks: [], recalls: [],
      documents: [],
    };

    // Business Rules: each row's `config` is a small jsonb object whose one
    // key varies per rule (e.g. {"days":5} vs {"cap_usd":30}). These two maps
    // tell the page which key inside `config` holds the editable number for a
    // known rule_key, and what unit to show next to it. Any rule_key added
    // later that isn't listed here still works — it just falls back to a
    // plain "edit as JSON" box instead of a friendly number field, so this
    // page never breaks when a new rule is added straight in SQL.
    const BUSINESS_RULE_CONFIG_KEY = {
      ai_monthly_spend_cap_usd: 'cap_usd',
      invoice_missing_threshold_hours: 'hours',
      order_stuck_unfulfilled_days: 'days',
      refund_review_threshold_usd: 'amount',
      shipping_delay_threshold_days: 'days',
      stuck_task_threshold_days: 'days',
    };
    const BUSINESS_RULE_UNIT_LABELS = {
      ai_monthly_spend_cap_usd: '$ / month',
      invoice_missing_threshold_hours: 'hours',
      order_stuck_unfulfilled_days: 'days',
      refund_review_threshold_usd: '$',
      shipping_delay_threshold_days: 'days',
      stuck_task_threshold_days: 'days',
    };

    // Inventory bucket values (must match the database check constraint on
    // inventory_adjustments.bucket) mapped to friendly labels.
    const INVENTORY_BUCKET_LABELS = {
      available: 'Available',
      reserved: 'Reserved',
      damaged: 'Damaged',
      sample: 'Sample',
      wholesale: 'Wholesale',
      promotional: 'Promotional',
      returned: 'Returned',
      recalled: 'Recalled',
    };

    // Return status/condition values below must match the real database check
    // constraints on the returns table (verified directly against pg_constraint,
    // not assumed) — status: requested/approved/rejected/received/refunded/closed,
    // product_condition: resalable/damaged/used/unknown. Reason has no check
    // constraint (plain text), so its list here is just a UI convenience.
    // Disposition is a dashboard-added column (see September 21, 2026 fix note)
    // used only to drive the automatic Inventory restock when a return is
    // marked Received — it isn't part of the original returns table.
    const RETURN_STATUS_LABELS = {
      requested: 'Requested',
      approved: 'Approved',
      rejected: 'Rejected',
      received: 'Received',
      refunded: 'Refunded',
      closed: 'Closed',
    };
    const RETURN_REASON_LABELS = {
      wrong_item: 'Wrong item sent',
      damaged_in_transit: 'Damaged in transit',
      changed_mind: 'Customer changed their mind',
      defective: "Defective / didn't work as expected",
      other: 'Other',
    };
    const RETURN_CONDITION_LABELS = {
      resalable: 'Resalable / unopened',
      damaged: 'Damaged',
      used: 'Used but functional',
      unknown: 'Unknown / not yet inspected',
    };
    // X11-06: these name what was CHOSEN on Mark Received, not proof that the
    // stock moved (a restock can fail after the return is saved; Inventory's
    // adjustment history is the proof).
    const RETURN_DISPOSITION_LABELS = {
      restock_available: 'Restock to Available',
      restock_damaged: 'Move to Damaged',
      discard: 'Discard (no restock)',
    };

    // Expense category values (must match the database check constraint) mapped
    // to the friendly labels shown in the dropdown and everywhere else.
    const EXPENSE_CATEGORY_LABELS = {
      packaging: 'Packaging',
      ingredients: 'Ingredients / Raw Materials',
      shipping_supplies: 'Shipping Supplies',
      advertising: 'Advertising / Marketing',
      software: 'Software / Subscriptions',
      manufacturing: 'Manufacturing',
      other: 'Other',
    };


    // ---- Built-in guide ----
    // Answers "how do I…" without a network call or an AI bill. Entries are
    // searched by the command palette alongside pages and records, so the same
    // \u2318K you use to navigate also explains things.
    const HELP = [
      { id:'returns', page:'returnsPanel', title:'How returns work',
        keys:'return refund restock approve reject receive',
        body:'A return always points at one line on one order, never a loose product. Pick the order, pick the item, give a reason and the condition it came back in.|The flow is: Requested, then you Approve or Reject. On approval you choose what happens to the item — restock it to Available, move it to Damaged, or discard it — and press Mark Received. Choosing "restock to Available" adjusts Inventory for you, so you never type the same number twice.|Refunds here are record-only. Marking a return refunded writes it down; it never moves money by itself.' },
      { id:'inventory', page:'inventoryPanel', title:'Inventory and low-stock alerts',
        keys:'inventory stock low threshold product buckets damaged',
        body:'Stock is split into buckets — Available, Reserved, Damaged, Sample, Wholesale, Promotional, Returned — so damaged goods never look sellable.|Set "low-stock alert when Available drops below" on any product and it earns a Low stock badge once it falls under that number. Leave it blank for no alert.' },
      { id:'activity', page:'activityPanel', title:'Seeing who did what',
        keys:'activity audit history who changed log employee account number',
        body:'Every change in the system is recorded: who, when, which record, and exactly which fields changed. Search by name, 9-digit account number, area, or anything inside a change.|Hover any record anywhere in the dashboard and press Space to see that record\u2019s full history as a before-and-after diff.|Changes made by automatic jobs show as "System / automatic" because nobody was signed in. On pages holding customer details or your formula, only the field names are recorded, never the values.' },
      { id:'rules', page:'businessRulesPanel', title:'Changing what the AI agents watch for',
        keys:'business rules threshold agent spend cap stuck days alert',
        body:'These numbers are the triggers your agents act on — how many days an order can sit unfulfilled, the refund amount that needs review, the monthly AI spend cap.|Changing a number here changes agent behaviour immediately, with no code and no deploy. Because of that, edits ask for your password.' },
      { id:'alerts', page:'attentionPanel', title:'Needs Your Attention, and the activity watcher',
        keys:'attention alerts unusual deletion overnight suspicious reminder',
        body:'This page combines everything waiting on you: tasks, approvals, compliance items, incidents, calendar events and your own reminders, soonest first.|An hourly watcher also lands alerts here — if anyone deletes an unusual number of records, or a signed-in person makes changes overnight. Thresholds live in Business Rules.' },
      { id:'calendar', page:'calendarPanel', title:'Using the calendar',
        keys:'calendar day week month appointment note filter event',
        body:'Day and Week list every appointment with its time; Month is the overview. Click any day in Month to jump into it.|The chips under the date show or hide individual calendars. Click an event to open it and leave yourself a note — press \u2318 and Return to save.|Your notes live separately from the synced calendar, so the nightly sync can never overwrite them.' },
      { id:'accounts', page:'activityPanel', title:'Accounts and account numbers',
        keys:'account number people role owner administrator employee login',
        body:'Everyone who signs in has their own account and a permanent 9-digit number that never changes. The number identifies a person in the activity feed and in search; it is never used to log in, so knowing one grants nothing.|An Administrator can see every other person\u2019s activity but never the Owner\u2019s, and only in areas they already have access to.' },
      { id:'expenses', page:'expensesPanel', title:'Logging expenses',
        keys:'expense receipt vendor category cost spending',
        body:'Log what you spend by category and vendor, with an optional receipt. Expenses feed the Accounting page, which works out profit live by combining them with order revenue.|Deleted expenses go to a recycle bin rather than disappearing, so a mistake is always recoverable.' },
      { id:'approvals', page:'approvalsPanel', title:'The approval queue',
        keys:'approval approve deny sign off request refund review',
        body:'When an agent finds something above a threshold — a large refund, a cancellation — it opens a request here instead of acting alone.|Nothing in this system moves money or messages a customer without you approving it first.' },
      { id:'search', page:'activityPanel', title:'Finding anything quickly',
        keys:'search find command palette shortcut keyboard jump',
        body:'Press \u2318K anywhere for the command palette. It searches pages, people, orders, tasks, returns and these guide entries all at once. Arrow keys move, Return opens.|Press / to jump to the sidebar search, and ? to see every keyboard shortcut.' },
      { id:'darkmode', page:'attentionPanel', title:'Dark mode and installing on your iPhone',
        keys:'dark mode theme iphone install home screen app mobile',
        body:'The button in the header cycles between following your Mac, always light, and always dark. Your choice is remembered on that device.|On iPhone, open the dashboard in Safari, tap Share, then Add to Home Screen. It gets its own icon and opens full-screen with no address bar.' },
      { id:'keys-basics', page:'attentionPanel', title:'Keyboard shortcuts — the essentials',
        keys:'keyboard shortcut key command hotkey quick escape space search palette help forgot',
        body:'\u2318K opens the command palette from anywhere — it searches pages, people, orders, records and this guide all at once. Arrow keys move, Return opens, Escape closes.|/ jumps to the sidebar search. ? shows the full shortcut list. Escape closes whatever is open.|Space inspects the record your mouse is over — hover any row anywhere in the dashboard and press it to see that record\u2019s full history.|\u2318\u21E7R reloads the data without reloading the page.' },
      { id:'keys-moving', page:'attentionPanel', title:'Moving around with the keyboard',
        keys:'keyboard navigate go back forward jump page pinned j k rows arrow move between pages',
        body:'Press g then a letter to go straight to a page: g then n for Needs Your Attention, o for Orders, i for Inventory, r for Returns, e for Expenses, t for Tasks, a for Employee Activity, c for Calendar, s for Procedures, b for Business Rules, x for Incidents, q for the Approval Queue.|\u2318[ and \u2318] move back and forward through the pages you have visited, like a browser.|\u23181 to \u23189 jump to your pinned pages — the starred ones at the top of the sidebar.|J and K move a highlight down and up through the rows on a page, and Return opens the highlighted row. That lets you work through a list without the mouse.' },
      { id:'keys-calendar', page:'calendarPanel', title:'Keyboard shortcuts on the calendar',
        keys:'calendar keyboard arrow day week month today note save shortcut',
        body:'While you are on the Calendar: \u2190 and \u2192 move to the previous or next day, week or month, depending on which view you are in.|D, W and M switch between Day, Week and Month. T jumps back to today.|With an event open, \u2318Return saves your note and Escape closes it without saving.' },
      { id:'keys-doing', page:'attentionPanel', title:'Doing things quickly',
        keys:'reminder quick add new note export spreadsheet refresh offline pin star favourite',
        body:'\u2318N opens a reminder box from anywhere in the dashboard. Type what you need to remember, press Return, and it appears in Needs Your Attention.|The star beside any page name in the sidebar pins it to the top, and pinned pages are what \u23181 to \u23189 jump to.|Employee Activity has an Export to spreadsheet button that downloads whatever is currently on screen, filters included.|The dashboard refreshes itself every few minutes in the background, and again the moment you come back online.' },
      { id:'gestures', page:'attentionPanel', title:'Using it on your iPhone',
        keys:'iphone ipad phone mobile swipe pull refresh gesture touch home screen install app',
        body:'Pull down on any page to refresh it. Swipe left or right to move to the next or previous page.|Tap a row to inspect it — Space is for the Mac, tapping does the same thing on a phone.|To install it properly: open the dashboard in Safari, tap Share, then Add to Home Screen. It gets its own icon and opens full-screen with no address bar.' },
      { id:'products', page:'inventoryPanel', title:'Adding a product to your catalogue',
        keys:'product add catalogue sku price cost new item create lotion',
        body:'Everything starts here. A purchase order can only put stock away against a product that exists, a return can only be restocked against one, and inventory counts only what is in the catalogue.|Add one on the Inventory page: a name is all that is required, but give it a SKU \u2014 a short code you invent, like HE-COCOA-8OZ. **Use exactly the same SKU in Shopify.** Deliveries and returns both find products by SKU, so a mismatch means they silently fail to update your stock.|SKUs must be unique and are treated the same whether you type them in capitals or not.|Status can be draft while you are still setting up, then active once you are selling it. Cost, retail and wholesale prices are optional and can be filled in later.' },
      { id:'purchasing', page:'purchaseOrdersPanel', title:'Ordering stock and receiving deliveries',
        keys:'purchase order supplier manufacturer stock receive delivery buy ordering po restock cost',
        body:'Add whoever you buy from on the Suppliers page first — manufacturer, packaging, lab, freight. Purchase orders are raised against them.|Create a draft purchase order, then add what you\u2019re buying line by line. A line can point at a product in your catalogue, or be free text for things like bottles, labels and raw materials that aren\u2019t products.|Move it through Ordered and Shipped as it progresses. When the delivery turns up, press Receive delivery: every line linked to a catalogue product is added to Inventory automatically, and the whole cost \u2014 items, shipping and tax \u2014 is written into Expenses under the category you chose. That keeps Accounting right without entering anything twice.|Lines that aren\u2019t catalogue products are still costed; they just can\u2019t be stocked, and the system tells you when that happens.|Receiving also works out the **true cost** of each unit by sharing shipping and tax across the lines in proportion to their value. That is the figure to set your prices against \u2014 the raw unit cost flatters your margin.|Track deposits and balances with the Payment setting on each order. If a delivery passes its expected date and hasn\u2019t arrived, it appears in Needs Your Attention, and turns high priority after a week.' },
      { id:'lots', page:'inventoryPanel', title:'Batch and lot tracking',
        keys:'lot batch number tracking expire expiry recall production run trace',
        body:'When you receive a delivery, you can give each catalogue line a lot number \u2014 whatever your manufacturer prints on that batch. Leave it blank if they don\u2019t give you one.|Receiving the same lot number again for the same product just adds to it, so a delivery that arrives in two shipments still counts as one batch.|The Inventory page shows every lot still on hand for a product, oldest first \u2014 sell or ship the oldest one first. If this ever needs a recall, you know exactly how much of that batch exists and which delivery it came from.|Tracing a lot all the way to a specific customer order needs your Shopify orders connected, which comes later \u2014 today this covers the receiving and on-hand side.' },
      { id:'quality', page:'qualityControlPanel', title:'Quality Control',
        keys:'quality control check inspection defect complaint fail pass escalate incident test',
        body:'Log any inspection, defect or complaint here \u2014 tie it to a specific lot when you can, or to a product generally, or leave it unlinked entirely.|A check that fails and hasn\u2019t been marked resolved shows up in Needs Your Attention automatically.|If something is serious enough to need a real investigation, press Escalate to Incident \u2014 it opens an Incident with the same severity and a sensible category already filled in, and links back to the check that started it.' },
      { id:'recalls', page:'recallsPanel', title:'Recalling a batch',
        keys:'recall batch lot quarantine pull withdraw safety',
        body:'A recall always points at one specific lot. Initiating one just records that you\u2019re looking into it \u2014 it shows up in Needs Your Attention as high priority immediately and stays there until resolved.|Quarantine stock actually moves that lot\u2019s remaining units out of Available into a separate Recalled bucket, so nothing can be sold from it by accident. It also logs the movement the same way any other stock adjustment does.|Escalate to Incident opens a real Incident under Product Safety with the same severity, for when this needs a proper investigation trail.|Honest limit: this covers what\u2019s still in your possession. Tracing a recalled lot to orders that already shipped needs Shopify orders connected \u2014 not built yet, same as batch tracing generally.' },
      { id:'legal', page:'legalHoldsPanel', title:'Legal holds',
        keys:'legal hold preserve evidence dispute retention delete',
        body:'A legal hold marks records that must be preserved — during a dispute, a claim, or an investigation. While a hold is active, routine clean-up must leave those records alone.|Releasing a hold is recorded in the activity log, with who released it and when.' },
      { id:'documents', page:'documentsPanel', title:'Documents',
        keys:'document contract insurance certification tax license expire expiration upload file',
        body:'A central place for paperwork that isn’t tied to one specific incident — contracts, certifications, insurance, tax documents, packaging specs, wholesale agreements, and so on. That’s the difference from Evidence Locker, which only holds evidence for a specific incident.|Upload the file itself, or just paste a link to where it already lives — you don’t need both.|Optionally link a document to a supplier, an incident, or a purchase order so it shows up in context.|Set an expiration date and it’ll show a color-coded warning here as it approaches or passes, and once it’s within 30 days (or already expired) it also shows up in Needs Your Attention.|Only the Owner or an Administrator can delete a document; any active team member can add or view one.' },
      { id:'systemmode', page:'flagsPanel', title:'System mode',
        keys:'system mode emergency ai kill switch limited no-ai pause banner',
        body:'One master switch for the whole system, with four settings: Normal (everything runs as usual), Limited AI (only high-confidence, low-risk AI actions run), No AI (every AI agent is paused, but rule-based automation like alerts and inventory math keeps running), and Emergency (AI paused and the Shopify Order Sync flag switched off too).|Changing it away from Normal shows a colored banner at the top of every page for every team member, until it’s changed back to Normal.|Choosing No AI or Emergency also best-effort pauses Agent #7 (Customer Service) — the only one of the 9 agents that calls a paid AI model — over on the AI Agent Activity page, using the same per-agent switch described there.|Honest limits: this is enforced everywhere the dashboard itself checks the mode — today that’s the Customer Service Agent’s pause switch and the Shopify Order Sync flag. It does not force-disable anyone’s login or revoke sessions that are already active — that would need a server-side change beyond what a dashboard can do. Use the Active Sessions page if you need to end a specific session right now — switching to Emergency mode will remind you to go check it.|Every change is recorded with who changed it and when.' },
    ];

    // ---- Global keyboard layer ----
    const GO_TO = {
      n: 'attentionPanel', o: 'ordersPanel', i: 'inventoryPanel', r: 'returnsPanel',
      e: 'expensesPanel', t: 'tasksPanel', a: 'activityPanel', c: 'calendarPanel',
      s: 'sopsPanel', b: 'businessRulesPanel', x: 'incidentsPanel', q: 'approvalsPanel',
    };

    // ---------- Employee Activity ----------
    // Reads from the protected `employee_activity` database function rather than
    // from the raw activity log. That function decides what the signed-in person
    // is allowed to see: the Owner sees everything; an Administrator sees other
    // people's activity but never the Owner's, and only in areas they already
    // have access to. Those rules live in the database, so they hold no matter
    // how the data is requested — this page can't widen them.
    const ACTIVITY_PAGE_SIZE = 50;    // which entry the mouse is over, for the Space shortcut

    // Fields worth showing as a record's name, in order of preference, so an
    // entry reads "Orders · TEST-0001" instead of "record 6eaf9306".
    const RECORD_TITLE_KEYS = [
      'order_number','incident_number','title','name','display_name','product_name',
      'label','sku','rule_key','flag_key','email','vendor','question_text','agent_name',
    ];

    const ROLE_LABELS = {
      owner: 'Owner',
      administrator: 'Administrator',
      employee: 'Employee',
      ai_agent: 'AI Agent',
    };

    // Friendlier names for a few areas whose table name doesn't read well on
    // its own. Anything not listed here falls back to the label the database
    // already builds, so a new table never breaks this page.
    const ACTIVITY_AREA_LABELS = {
      profiles: 'Accounts',
      sop_documents: 'Procedures (SOPs)',
      ai_model_config: 'AI Model Config',
      prompt_versions: 'AI Prompt Versions',
      approval_requests: 'Approval Queue',
      calendar_events: 'Calendar',
      personal_calendar_events: 'Personal Calendar',
      agent_controls: 'Agent Switches',
      product_price_history: 'Price History',
      manual_attention_items: 'Manual Reminders',
      privacy_deletion_requests: 'Privacy Deletion Requests',
      adverse_event_reports: 'Adverse Event Reports',
    };

    // ---- Quick Look everywhere ----
    // Most pages already tag their rows with the record's id. This map says
    // which table each page's rows belong to, so hovering a row anywhere and
    // pressing Space can look that exact record up. Rows that carry their own
    // table name (data-rec-table) or a more specific id attribute win over it.
    const PANEL_RECORD_TABLE = {
      ordersPanel: 'orders',
      tasksPanel: 'tasks',
      incidentsPanel: 'incidents',
      inventoryPanel: 'products',
      returnsPanel: 'returns',
      suppliersPanel: 'suppliers',
      purchaseOrdersPanel: 'purchase_orders',
      qualityControlPanel: 'quality_checks',
      recallsPanel: 'recalls',
      expensesPanel: 'expenses',
      approvalsPanel: 'approval_requests',
      sopsPanel: 'sop_documents',
      featureRequestsPanel: 'feature_requests',
      evidenceLockerPanel: 'evidence_locker',
      documentsPanel: 'documents',
      adverseEventsPanel: 'adverse_event_reports',
      legalHoldsPanel: 'legal_holds',
      inquiriesPanel: 'customer_inquiries',
      flagsPanel: 'feature_flags',
      businessRulesPanel: 'business_rules',
      continuityPanel: 'service_status',
      calendarPanel: 'calendar_events',
      aiPanel: 'ai_decision_log',
    };
    // Row-level id attributes that already exist in the dashboard, mapped to
    // the table they belong to.
    const RECORD_ID_ATTRS = [
      { attr: 'data-rec-id', table: null },        // table comes from data-rec-table
      { attr: 'data-product-id', table: 'products' },
      { attr: 'data-return-id', table: 'returns' },
      { attr: 'data-id', table: null },            // table comes from the panel
    ];

    // ---------- needs your attention ----------
    const ITEM_TYPE_LABELS = {
      task: 'Task',
      approval: 'Approval',
      compliance: 'Compliance',
      privacy_deletion: 'Privacy',
      incident: 'Incident',
      calendar_event: 'Calendar',
      manual: 'Reminder',
      alert: 'Alert',
      purchase_order: 'Delivery',
      quality_check: 'Quality check',
      recall: 'Recall',
      document: 'Document',
      low_stock: 'Low stock',
    }; // PROPOSED default (owner decision X8-D4): one missed night + slack
    const NIGHTLY_PAGES = { F01: 'tasksPanel', F02: 'tasksPanel', F03: 'approvalsPanel', F04: 'recallsPanel', F05: 'purchaseOrdersPanel',
      F06: 'ordersPanel', F07: 'suppliersPanel', F08: 'inventoryPanel', F09: 'expensesPanel', F10: 'returnsPanel', F11: 'ordersPanel',
      F12: 'ordersPanel', F13: 'ordersPanel', F14: 'inventoryPanel', F15: 'returnsPanel' };
    // EXT11 (installation status + switch drift): which database steps the
    // page can see, read-only, using the same harmless probes the switches use
    // before they turn on (a stock function is called with an id that does not
    // exist and refuses; the other two read one column / one table).
    const DB_STEPS = [
      ['stock_fn_receive_po', 'R1 receive'], ['stock_fn_recall', 'R2 recall'], ['stock_fn_return', 'R3 return'],
      ['stock_fn_adjust', 'R4 adjust'], ['stock_fn_delete_product', 'R5 delete'], ['request_keys', 'request keys'], ['integrity_results_home', 'nightly check'],
    ];

    // ---------- calendar mode ----------
    // The owner sees their synced Apple Calendar (calendar_events). Everyone
    // else (e.g. an Administrator) gets their own private, manually-entered
    // calendar (personal_calendar_events) — nobody sees anyone else's.
    const APPLE_CAL_HINT = 'Your synced Apple Calendar. Day and Week list every appointment with its time; Month gives you the overview. Use the chips to show or hide a calendar, and open any event to leave yourself a note — notes are yours and survive every sync.';

    // ---------- calendar month grid ----------
    const CAL_COLORS = ['#3E6B52','#1f7a8c','#b8734a','#7a5c9e','#2f7d4f','#b8860b','#4a7fb8','#a04a6f'];

    // ---------- Suppliers & Purchase Orders ----------
    // A purchase order is what you've ordered from a supplier. Its lines can
    // optionally point at a product in your catalogue — the ones that do are
    // received straight into Inventory; the ones that don't (bottles, labels,
    // raw materials) are just costed. Receiving also writes the spend into
    // Expenses, so Accounting stays honest without double entry.
    const SUPPLIER_TYPE_LABELS = {
      manufacturer: 'Manufacturer', supplier: 'Supplier', packaging: 'Packaging',
      lab: 'Lab', freight: 'Freight', other: 'Other',
    };
    const PO_STATUS_LABELS = {
      draft: 'Draft', ordered: 'Ordered', shipped: 'Shipped',
      received: 'Received', cancelled: 'Cancelled',
    };
    const PAYMENT_LABELS = { unpaid: 'Unpaid', partial: 'Part paid', paid: 'Paid' };
    // Purchase-order state machine: the only status each button may move an
    // order FROM. Receiving has its own path (draft/received/cancelled can't be
    // received). Used as the database-side condition, so a stale page can
    // never, for example, turn a received order into a cancelled one.
    const PO_ALLOWED_FROM = {
      ordered: ['draft'],
      shipped: ['ordered'],
      cancelled: ['draft', 'ordered', 'shipped'],
      received: ['ordered', 'shipped'],
    };
    // Lines, shipping and tax can only change while the order is still being
    // put together; after that the logged expense would no longer match.
    const PO_EDITABLE = ['draft', 'ordered'];
    const QC_TYPE_LABELS = {
      incoming_inspection: 'Incoming inspection', packaging_defect: 'Packaging defect',
      customer_complaint: 'Customer complaint', manufacturing_issue: 'Manufacturing issue', other: 'Other',
    };
    const QC_RESULT_LABELS = { pending: 'Pending', pass: 'Pass', fail: 'Fail' };
    const QC_SEVERITY_LABELS = { low: 'Low', normal: 'Normal', high: 'High', critical: 'Critical' };
    const RECALL_STATUS_LABELS = { initiated: 'Initiated', quarantined: 'Quarantined', resolved: 'Resolved' };

    // Task status buttons. Only these moves are allowed from the dashboard:
    //   open -> in_progress, open -> done, in_progress -> done.
    // The update only succeeds if the task is STILL in an allowed starting
    // status (checked by the database in the same statement), so a double
    // click, a second person, or an agent changing it at the same moment can
    // never push it through a move that isn't on this list. The dashboard never
    // creates tasks - agents do - so these buttons can't create duplicates.
    // Every change goes through the normal logged-in update, so the tasks
    // change-history (audit) trigger and access rules apply exactly as before.
    const TASK_STATUS_LABELS = { open: 'Open', in_progress: 'In progress', done: 'Done', cancelled: 'Cancelled' };
    // "Mark done" always comes first, so it sits in the same spot for open and
    // in-progress tasks: clicking "Mark in progress" never slides another
    // button under the cursor (which caused accidental "done" clicks).
    const TASK_NEXT_ACTIONS = {
      open: [{ to: 'done', label: 'Mark done' }, { to: 'in_progress', label: 'Mark in progress' }],
      in_progress: [{ to: 'done', label: 'Mark done' }],
    };
    // EXT7: "Reopen" (done -> open) from the Recently finished list. Only a
    // task that is still "done" can be reopened; a cancelled task stays
    // cancelled (agents cancel tasks for a reason the dashboard can't see).
    const TASK_ALLOWED_FROM = { in_progress: ['open'], done: ['open', 'in_progress'], open: ['done'] };

    // The permanent, honest record of what each agent is built to do and what
    // it's NOT allowed to do alone — the "AI permission audit" the blueprint
    // asks for (item #22). Hand-written, not pulled from a table: this
    // describes the system's own design, not data that changes at runtime,
    // so it lives here the same way QC_TYPE_LABELS etc. do. Whenever an
    // agent's actual behavior changes, this list should be updated to match.
    const AGENT_REGISTRY = [
      { num: 1, name: 'Invoice Agent', ai: false, trigger: true, status: 'Runs automatically inside the database the moment an order is created or changes — but only while its switch is on (see the state badge). The dashboard cannot see the trigger itself or a last-run time for this agent.',
        desc: 'Generates, re-syncs, and voids invoices whenever an order is created or changes.',
        touches: ['orders (read)', 'invoices (write)'],
        limit: 'Fully automatic. Only ever creates paperwork — never touches money or sends anything. Its pause switch is real: turning it off stops it from creating, re-syncing, or voiding any invoice — new orders still save fine, they just won’t get invoiced until it’s back on.', enforced: true },
      { num: 2, name: 'Order Intake Agent', ai: false, intendedOff: true, status: 'Last recorded state (September 26, 2026): switched off — its GitHub workflow was disabled until the store has products, so it should not start by itself when GitHub minutes reset on October 1. This dashboard cannot see GitHub, so check GitHub → Actions before relying on this; turning it back on is a deliberate step (Enable workflow).',
        desc: 'Flags missing info, financial mismatches, bad addresses, and duplicate order numbers.',
        touches: ['orders (read)', 'tasks (write)'],
        limit: 'Fully automatic. Only opens a task for you to look at — never edits or cancels an order itself.', enforced: false },
      { num: 3, name: 'Order Monitoring Agent', ai: false, intendedOff: true, status: 'Last recorded state (September 26, 2026): switched off — its GitHub workflow was disabled until the store has products, so it should not start by itself when GitHub minutes reset on October 1. This dashboard cannot see GitHub, so check GitHub → Actions before relying on this; turning it back on is a deliberate step (Enable workflow).',
        desc: 'Flags large refunds/cancellations, Shopify fraud flags, and stuck-unfulfilled orders.',
        touches: ['orders (read)', 'approval_requests (write)', 'tasks (write)'],
        limit: 'Never acts alone above your threshold. A refund or cancellation over the limit opens a real approval request and waits for you — it cannot approve its own request.', enforced: false },
      { num: 4, name: 'Retail/Wholesale Agent', ai: false, status: 'Migrated to Supabase pg_cron September 26, 2026 (runs hourly at :03 inside the database — no longer waits on GitHub Actions minutes). The old GitHub schedule was removed the same night. If someone links or deletes an order while it is working, it leaves that order alone.',
        desc: 'Links or creates a customer record per order and tags it retail vs. wholesale.',
        touches: ['orders (read + link customer)', 'customers (write)', 'tasks (write, email-mismatch review only)'],
        limit: 'Fully automatic. Organizing only — no pricing, money, or communication involved. Never changes a customer link once set; a mismatch only opens a task for a person.', enforced: true, cronJobName: 'agent_4_retail_wholesale' },
      { num: 5, name: 'Shipping/Tracking Agent', ai: false, status: 'Migrated to Supabase pg_cron September 26, 2026 (runs hourly at :10 inside the database — no longer waits on GitHub Actions minutes). Live pause test passed the same day; the old GitHub schedule was removed (manual run kept). A cancelled shipment never raises an alert, even if its old tracking status still says in transit.',
        desc: 'Syncs Shopify tracking and flags failed or delayed deliveries, using your own Business Rules thresholds.',
        touches: ['orders (read)', 'shipments (write)', 'business_rules (read)', 'tasks (write)', 'ai_decision_log (write)'],
        limit: 'Fully automatic. Only opens a task — never contacts a carrier or a customer. A delayed task stays open after delivery until a person closes it. Handles up to 500 orders per run. If Shopify marks a fulfillment error/failure but tracking says delivered, it still opens the failed-review task, because the data contradicts itself and a person should look.', enforced: true, cronJobName: 'agent_5_shipping_tracking' },
      { num: 6, name: 'Customer Notification Agent', ai: false, status: 'Migrated to Supabase pg_cron (runs hourly at :05 inside the database — no longer waits on GitHub Actions minutes). 32 clean hourly runs and a live pause test passed September 26, 2026; the old GitHub schedule was removed the same night. Still dry-run only, no email service connected yet.',
        desc: 'Logs what it would email a customer for each order event (received / shipped / delivered / delayed / cancelled / refunded).',
        touches: ['customer_notifications (write)'], dryRun: true,
        limit: 'Cannot actually send anything — no email service is connected yet. Right now it can only write a log entry of what it would have sent.', enforced: true, cronJobName: 'agent_6_customer_notifications' },
      { num: 7, name: 'Customer Service Agent', ai: true, intendedOff: true, status: 'Last recorded state (September 26, 2026): switched off — its GitHub workflow was disabled until the store has products, so it should not start by itself when GitHub minutes reset on October 1. This dashboard cannot see GitHub, so check GitHub → Actions before relying on this; turning it back on is a deliberate step (Enable workflow).',
        desc: "Drafts a reply to a customer question using that order's context and any procedures you've marked visible to it.",
        touches: ['customer_inquiries (read/write)', 'orders (read)', 'sop_documents (read — opt-in per procedure only)', 'ai_decision_log (write)'],
        limit: 'Never sends anything itself — every reply is a draft you review, edit, and copy yourself. An independent keyword check (refunds, health/safety, anger, legal threats) forces human review even if the AI itself sounded confident. Capped at $30/month in AI spending; drafting pauses for the rest of the month if that’s hit.', enforced: false },
      { num: 8, name: 'Supervisor Agent', ai: false, intendedOff: true, status: 'Last recorded state (September 26, 2026): switched off — its GitHub workflow was disabled until the store has products, so it should not start by itself when GitHub minutes reset on October 1. This dashboard cannot see GitHub, so check GitHub → Actions before relying on this; turning it back on is a deliberate step (Enable workflow).',
        desc: 'Checks for orders missing an invoice, stalled tasks, and orders/shipments that disagree with each other.',
        touches: ['orders (read)', 'invoices (read)', 'tasks (read/write)', 'shipments (read)', 'wholesale_inquiries (read)', 'contact_messages (read)'],
        limit: 'Fully automatic. Only opens a task when something looks wrong — never edits the records it’s checking.', enforced: false },
      { num: 9, name: 'Accounting Agent', ai: false, dashboardOnly: true, status: 'Live now — dashboard-only, no scheduled job to wait on',
        desc: 'Rolls up real order revenue and your logged expenses into a live net-profit figure.',
        touches: ['orders (read)', 'expenses (read)'],
        limit: 'Not really an "agent" that acts on anything — it only computes and displays. Organizes and shows only; never moves money.', enforced: false },
      { num: 10, name: 'Tax Record Agent', ai: false, dashboardOnly: true, status: 'Live now — dashboard-only, no scheduled job to wait on',
        desc: 'Categorizes income and expenses, estimates cost of goods sold, tracks sales tax collected, and flags expenses with no receipt on file — builds a report to hand to your accountant.',
        touches: ['orders (read)', 'expenses (read)', 'order_items (read)', 'products (read)'],
        limit: 'Not really an "agent" that acts on anything — it only organizes and displays. Never files taxes, never contacts the IRS or any state, and never moves money.', enforced: false },
    ];
    const AGENT_STALE_AFTER_HOURS = 2;

    // Customer Inquiries: every question a customer has asked, and the reply
    // the Customer Service Agent (Agent #7) drafted for it, if any. Kept as
    // one fetch, filtered on the page, so switching the dropdown doesn't hit
    // the database again.
    const INQ_STATUS_LABELS = { new: 'New', drafted: 'Drafted', needs_review: 'Needs Review', answered: 'Answered' };
    const INQ_ANSWERED_CAP = 100;

    // Flags that start real outside effects and must stay off until their
    // launch checks are done (R9). The switch still works — the owner decides —
    // but turning one ON takes an explicit extra confirmation, and the page
    // says why it is blocked. (The real protection is the database's own
    // permissions; this only prevents an accidental click.)
    const LAUNCH_BLOCKED_FLAGS = {
      shopify_order_sync: 'Kept off on purpose. Blocked until launch checks: keep off until the stock fixes (R1–R4) are live and Agent #1 (invoices) is confirmed on — otherwise real orders can be miscounted or left without an invoice. Turning it on here only flips the switch; nothing is sent to Shopify from this page.',
    };

    const SYSTEM_MODE_LABELS = {
      NORMAL:     { label: 'Normal',     desc: 'Everything runs as usual.',                                    bg: '#e7f3ea', fg: '#1e6b34', border: '#bfe3c8' },
      LIMITED_AI: { label: 'Limited AI', desc: 'Only high-confidence, low-risk AI actions run.',                bg: '#fff4dd', fg: '#8a5b00', border: '#f2d999' },
      NO_AI:      { label: 'No AI',      desc: 'Every AI agent is paused; rule-based automation keeps running.', bg: '#fff0e6', fg: '#a03d00', border: '#f5c7a3' },
      EMERGENCY:  { label: 'Emergency',  desc: 'AI paused and Shopify Order Sync switched off. Rule-based agents (#1 invoices, #4, #5, #6) keep running.',                bg: '#fbe6e6', fg: '#9e1b1b', border: '#f0bdbd' },
    };

    // Feature Requests: a running, trackable list of things you've asked for or
    // want added/changed — so it lives in the system (with a status you can watch
    // move along) instead of only in a chat conversation.
    const FR_STATUS_LABELS = { requested: 'Requested', in_progress: 'In progress', done: 'Done' };
    const FR_NEXT_STATUS = { requested: 'in_progress', in_progress: 'done' };
    const FR_NEXT_LABEL = { requested: 'Mark in progress', in_progress: 'Mark done' };

    // ---------- Documents ----------
    // General-purpose document storage (Blueprint spec item #29) — separate
    // from Evidence Locker, which is only ever tied to one specific incident.
    // The `documents` table and its RLS already existed, unused, before this
    // (staff can add/view, only Owner/Administrator can delete) — verified
    // live via information_schema before writing any of this.
    // The document link types the database accepts besides "not linked" (Query A).
    const DOCUMENT_LINK_TYPES = ['supplier'];
    // Exactly the categories the database accepts (documents_category_check,
    // Query A). Lab reports, invoices, packaging specs etc. go under the
    // closest one or "Other" until the owner decides to widen that rule.
    const DOCUMENT_CATEGORY_LABELS = {
      contract: 'Contract',
      insurance: 'Insurance',
      certification: 'Certification',
      license: 'License / Permit',
      tax: 'Tax Document',
      manufacturing_agreement: 'Manufacturing Agreement',
      other: 'Other',
    };

  // EXT18: the lookup tables are read with database or customer text as the key
  // (a status, a category, a table name). Without a prototype, a value such as
  // "constructor" or "__proto__" finds nothing instead of a built-in function.
  [STOCK_FN_FLAGS, FLAG_DEPENDS, THEME_FACE, THEME_NAME, ICON_PATHS, SEARCH_INDEX, BUSINESS_RULE_CONFIG_KEY, BUSINESS_RULE_UNIT_LABELS, INVENTORY_BUCKET_LABELS, RETURN_STATUS_LABELS, RETURN_REASON_LABELS, RETURN_CONDITION_LABELS, RETURN_DISPOSITION_LABELS, EXPENSE_CATEGORY_LABELS, GO_TO, ROLE_LABELS, ACTIVITY_AREA_LABELS, PANEL_RECORD_TABLE, ITEM_TYPE_LABELS, NIGHTLY_PAGES, SUPPLIER_TYPE_LABELS, PO_STATUS_LABELS, PAYMENT_LABELS, PO_ALLOWED_FROM, QC_TYPE_LABELS, QC_RESULT_LABELS, QC_SEVERITY_LABELS, RECALL_STATUS_LABELS, TASK_STATUS_LABELS, TASK_NEXT_ACTIONS, TASK_ALLOWED_FROM, INQ_STATUS_LABELS, LAUNCH_BLOCKED_FLAGS, SYSTEM_MODE_LABELS, FR_STATUS_LABELS, FR_NEXT_STATUS, FR_NEXT_LABEL, DOCUMENT_CATEGORY_LABELS].forEach(o => Object.setPrototypeOf(o, null));
  return { RET_ORDER_CAP, ROW_CAP, STOCK_FN_FLAGS, FLAG_DEPENDS, THEME_ORDER, THEME_FACE, THEME_NAME, EMPTY_ICONS, SIDEBAR_GROUPS, ICON_PATHS, SEARCH_INDEX, BUSINESS_RULE_CONFIG_KEY, BUSINESS_RULE_UNIT_LABELS, INVENTORY_BUCKET_LABELS, RETURN_STATUS_LABELS, RETURN_REASON_LABELS, RETURN_CONDITION_LABELS, RETURN_DISPOSITION_LABELS, EXPENSE_CATEGORY_LABELS, HELP, GO_TO, ACTIVITY_PAGE_SIZE, RECORD_TITLE_KEYS, ROLE_LABELS, ACTIVITY_AREA_LABELS, PANEL_RECORD_TABLE, RECORD_ID_ATTRS, ITEM_TYPE_LABELS, NIGHTLY_PAGES, DB_STEPS, APPLE_CAL_HINT, CAL_COLORS, SUPPLIER_TYPE_LABELS, PO_STATUS_LABELS, PAYMENT_LABELS, PO_ALLOWED_FROM, PO_EDITABLE, QC_TYPE_LABELS, QC_RESULT_LABELS, QC_SEVERITY_LABELS, RECALL_STATUS_LABELS, TASK_STATUS_LABELS, TASK_NEXT_ACTIONS, TASK_ALLOWED_FROM, AGENT_REGISTRY, AGENT_STALE_AFTER_HOURS, INQ_STATUS_LABELS, INQ_ANSWERED_CAP, LAUNCH_BLOCKED_FLAGS, SYSTEM_MODE_LABELS, FR_STATUS_LABELS, FR_NEXT_STATUS, FR_NEXT_LABEL, DOCUMENT_LINK_TYPES, DOCUMENT_CATEGORY_LABELS };
});
