// One or two synthetic rows for every table a dashboard page reads beyond the
// business basics in business-data.js (orders, products, expenses, returns,
// tasks). Used by sweeps that visit every page. Everything here is made up;
// the rows were collected from the page tests that already use them.
const ROWS = {
  adverse_event_reports: [{id: 'ae-1',product_name: 'SYNTHETIC product A',date_received: '2026-09-28',description: 'SYNTHETIC report',outcome_type: 'other',fda_report_deadline: '2026-10-20',fda_reported: false,fda_reported_at: null,reporter_name: null,reporter_contact: null,created_at: '2026-09-28T00:00:00Z'}],
  agent_controls: [{agent_num: 4,enabled: null,updated_by: null,updated_at: null}],
  ai_decision_log: [{id: 'ai-1',agent_key: 'customer_service_agent',output_summary: 'SYNTHETIC',confidence: 0.9,escalated_to_human: false,cost_usd: 12.5,created_at: '2026-06-14T15:00:00Z'}],
  ai_model_config: [{agent_name: 'SYNTHETIC customer_service_agent_with_a_long_name',provider: 'synthetic-provider-with-long-name',model: 'synthetic-model-name-that-is-quite-long-2026-10',fallback_provider: null,fallback_model: 'synthetic-fallback-model-also-long-2026'}],
  approval_requests: [{id: 'ap-1',action_type: 'synthetic',summary: 'SYNTHETIC pending request',status: 'pending',created_at: '2026-09-20T00:00:00Z'}],
  business_rules: [{id: 'br-1',rule_key: 'refund_review_threshold_usd',label: 'SYNTHETIC Refund review',description: 'SYNTHETIC',config: {amount: 100},is_active: true}],
  calendar_notes: [{id: 'cn-1',event_uid: 'uid-work',note: 'SYNTHETIC old note'}],
  customer_inquiries: [{id: 'inq-1',customer_name: 'SYNTHETIC Low',customer_email: 'low@example.test',question_text: 'SYNTHETIC where is my order',status: 'drafted',severity: 'low',ai_draft_reply: 'SYNTHETIC draft A',created_at: '2026-09-22T00:00:00Z'}],
  daily_reports: [{id: 'dr-1',report_date: '2026-10-10',orders_count: 3,revenue: '100.00',currency: 'USD',new_inquiries_count: 1,tasks_opened_count: 0,incidents_opened_count: 0,ai_calls_count: 2,ai_cost: '0.05',emailed_at: null},{id: 'dr-2',report_date: '2026-10-11',orders_count: 2,revenue: '80.00',currency: 'USD',new_inquiries_count: 0,tasks_opened_count: 0,incidents_opened_count: 0,ai_calls_count: 1,ai_cost: '0.02',emailed_at: null}],
  documents: [{id: 'doc-1',title: 'SYNTHETIC COA',category: 'other',related_type: null,related_id: null,document_url: null,file_path: null,issued_date: null,expiration_date: null,notes: null,created_at: '2026-09-20T00:00:00Z'}],
  feature_flags: [{id: 'ff-adj',flag_key: 'stock_fn_adjust',label: 'stock_fn_adjust',description: 'SYNTHETIC',enabled: true}],
  feature_requests: [{id: 'fr-1',title: 'SYNTHETIC request',description: null,priority: 'normal',status: 'requested',requested_at: '2026-09-20T00:00:00Z',deleted_at: null}],
  incidents: [{id: 'inc-1',incident_number: 'INC-1',title: 'SYNTHETIC incident',created_at: '2026-09-20T00:00:00Z'}],
  inventory_lots: [{id: 'lot-1',lot_number: 'L-1',product_id: 'prod-a',quantity_remaining: 5,products: {name: 'SYNTHETIC product A',sku: 'SYN-A'}}],
  legal_holds: [{id: 'lh-1',title: 'SYNTHETIC order dispute',description: null,related_type: 'order',related_reference: 'SYN-1001',placed_at: '2026-09-20T00:00:00Z',status: 'active'},{id: 'lh-2',title: 'SYNTHETIC released hold',description: null,related_type: null,related_reference: null,placed_at: '2026-09-01T00:00:00Z',status: 'released',released_at: '2026-09-10T00:00:00Z'}],
  purchase_orders: [{id: 'po-r',po_number: 'PO-R',status: 'received',supplier_id: null,currency: 'USD',shipping_cost: 0,tax: 0,payment_status: 'unpaid',created_at: '2026-09-01T00:00:00Z',deleted_at: null,purchase_order_items: [{id: 'l1',product_id: 'p1',quantity: 5,quantity_received: 2}]}],
  quality_checks: [{id: 'qc-esc',check_type: 'packaging_defect',result: 'fail',severity: 'high',product_id: null,lot_id: null,description: 'SYNTHETIC crushed box',incident_id: null,created_by: null,created_at: '2026-10-01T00:00:00Z',updated_at: '2026-10-01T00:00:00Z'}],
  recalls: [{id: 'rc-1',reason: 'SYNTHETIC contamination report',severity: 'high',status: 'initiated',quantity_quarantined: null,resolution: null,resolved_at: null,incident_id: null,created_at: '2026-09-20T00:00:00Z',lot_id: 'lot-1',product_id: 'prod-a',products: {name: 'SYNTHETIC product A',sku: 'SYN-A'},inventory_lots: {lot_number: 'L-1'},incidents: null}],
  service_status: [{id: 'svc-1',service_name: 'SYNTHETIC Email',category: 'comms',status: 'operational',notes: null,updated_at: '2026-10-01T10:00:00Z'},{id: 'svc-2',service_name: 'SYNTHETIC Printer',category: 'office',status: 'maintenance',notes: null,updated_at: '2026-10-01T10:00:00Z'}],
  sop_documents: [{id: 'sop-1',title: 'SYNTHETIC Returns procedure',category: 'service',content: 'SYNTHETIC steps',updated_at: '2026-10-01T10:00:00Z',agent_visible: false}],
  suppliers: [{id: 'sup-1',name: 'SYNTHETIC Active',supplier_type: 'manufacturer',contact_name: null,email: null,phone: null,notes: null,is_active: true},{id: 'sup-2',name: 'SYNTHETIC Unset',supplier_type: 'lab',contact_name: null,email: null,phone: null,notes: null,is_active: null}],
};

// Columns that hold free text typed or pasted by a person (or written by an
// agent). Named one by one: other text columns only accept fixed values.
const FREE_TEXT = {
  tasks: ['title'], orders: ['customer_name'], order_items: ['product_name'], products: ['name'],
  expenses: ['vendor', 'note'], returns: ['reason', 'notes'],
  feature_flags: ['label', 'description'], purchase_orders: ['po_number', 'notes'], calendar_notes: ['note'],
  legal_holds: ['title', 'description', 'related_reference'], approval_requests: ['summary'], documents: ['title', 'notes'],
  suppliers: ['name', 'contact_name', 'phone', 'notes'], ai_decision_log: ['output_summary'], recalls: ['reason', 'resolution'],
  inventory_lots: ['lot_number'], adverse_event_reports: ['product_name', 'description', 'reporter_name', 'reporter_contact'],
  ai_model_config: ['agent_name', 'provider', 'model'], incidents: ['title', 'incident_number'], quality_checks: ['description'],
  business_rules: ['label', 'description'], service_status: ['service_name', 'notes'], sop_documents: ['title', 'content'],
  feature_requests: ['title', 'description'], customer_inquiries: ['customer_name', 'question_text', 'ai_draft_reply'],
};

// Fills every table above that the test has not already filled.
function seedEveryPage(backend) {
  for (const [name, rows] of Object.entries(ROWS)) {
    if (!Array.isArray(backend.tables[name]) || !backend.tables[name].length) backend.tables[name] = JSON.parse(JSON.stringify(rows));
  }
}

module.exports = { ROWS, FREE_TEXT, seedEveryPage };
