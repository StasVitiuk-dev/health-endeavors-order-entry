// Supplier document checklist by supplier type (owner decision of Nov 16).
// Pure, Node-only, synthetic, read-only.
//   purchases          quote or order confirmation · supplier invoice · packing slip (where applicable)
//   lotion lab         approved ingredient list per formula · batch or lot record and certificate of analysis per batch
//   bottles and pumps  component specification per component
//   labels / printing  approved artwork and printer proof per artwork
// and it shows which documents are missing or awaiting review.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const D = require('../../assets/suppliers/he-supplier-docs.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

const FX = D.fixtures();
const sup = id => FX.suppliers.find(s => s.id === id);
const check = (id, opts) => D.supplierChecklist(sup(id), FX.context, FX.documents, Object.assign({ asOf: FX.asOf }, opts || {}));
const line = (c, key, subjectId) => c.rows.find(r => r.key === key && r.subjectId === subjectId);

test('the checklist holds exactly the documents the owner named, by kind of supplier', () => {
  const c = D.DEFAULT_CHECKLIST;
  expect(c.purchase.map(d => d.key)).toEqual(['quote_or_order_confirmation', 'supplier_invoice', 'packing_slip']);
  expect(c.profiles.lotion_lab.documents.map(d => [d.key, d.per])).toEqual([['approved_ingredient_list', 'formula'], ['batch_record', 'batch'], ['certificate_of_analysis', 'batch']]);
  expect(c.profiles.bottles_pumps.documents.map(d => [d.key, d.per])).toEqual([['component_specification', 'component']]);
  expect(c.profiles.labels_printing.documents.map(d => [d.key, d.per])).toEqual([['approved_artwork', 'artwork'], ['printer_proof', 'artwork']]);
  expect(D.checkChecklist(c)).toEqual([]);
  // The supplier types are the ones the suppliers table allows.
  expect(Object.keys(c.profilesByType).sort()).toEqual(['freight', 'lab', 'manufacturer', 'other', 'packaging', 'supplier']);
});

test('lotion lab: ingredient list per formula, batch record and certificate of analysis per batch', () => {
  const c = check('SUP-LAB');
  expect(c.profiles.map(p => p.key)).toEqual(['lotion_lab']);
  expect(c.rows.filter(r => r.key === 'approved_ingredient_list').map(r => r.subjectLabel)).toEqual(['Formula Honey Milk', 'Formula Vegan']);
  expect(c.rows.filter(r => r.key === 'batch_record').map(r => r.subjectLabel)).toEqual(['Batch LOT-204', 'Batch LOT-205']);
  expect(c.rows.filter(r => r.key === 'certificate_of_analysis').map(r => r.subjectLabel)).toEqual(['Batch LOT-204', 'Batch LOT-205']);
  // One batch is complete; the other has a certificate waiting for review and no batch record.
  expect(line(c, 'certificate_of_analysis', 'B-204').status).toBe('APPROVED');
  expect(line(c, 'certificate_of_analysis', 'B-205').status).toBe('AWAITING_REVIEW');
  expect(line(c, 'batch_record', 'B-205').status).toBe('MISSING');
  expect(line(c, 'approved_ingredient_list', 'F-VEGAN').status).toBe('MISSING');
  expect(c).toMatchObject({ missing: 3, awaitingReview: 2, approved: 5, total: 10, needsAttention: true, readOnly: true });
});

test('purchases: each document is expected only once the order has reached the stage it belongs to', () => {
  const lab = check('SUP-LAB');
  // Received and paid: all three.
  expect(lab.rows.filter(r => r.subjectId === 'PO-LAB-1').map(r => r.key)).toEqual(['quote_or_order_confirmation', 'supplier_invoice', 'packing_slip']);
  // Only ordered: the confirmation, not yet an invoice or a packing slip.
  expect(lab.rows.filter(r => r.subjectId === 'PO-LAB-2').map(r => r.key)).toEqual(['quote_or_order_confirmation']);
  // Shipped: confirmation and invoice, no packing slip until it arrives.
  expect(check('SUP-BOT').rows.filter(r => r.subjectId === 'PO-BOT-1').map(r => r.key)).toEqual(['quote_or_order_confirmation', 'supplier_invoice']);
  // A draft asks for nothing; nor does a cancelled or deleted order.
  expect(check('SUP-LBL').rows.filter(r => r.subjectKind === 'purchase')).toEqual([]);
  const inv = D.DEFAULT_CHECKLIST.purchase[1];
  expect(D.purchaseDocApplies(inv, { status: 'cancelled', payment_status: 'paid' })).toBe(false);
  expect(D.purchaseDocApplies(inv, { status: 'received', deleted_at: '2026-11-01' })).toBe(false);
  // Paid in advance: the invoice is expected even though nothing has shipped.
  expect(D.purchaseDocApplies(inv, { status: 'ordered', payment_status: 'partial' })).toBe(true);
  expect(D.purchaseDocApplies(D.DEFAULT_CHECKLIST.purchase[2], { status: 'ordered', payment_status: 'paid' })).toBe(false);
});

test('bottles and pumps: a specification per component; a supplier can have more than one kind of work', () => {
  const c = check('SUP-BOT');
  expect(c.profiles.map(p => p.label)).toEqual(['Bottles and pumps', 'Printed labels or direct bottle printing']);
  expect(c.rows.filter(r => r.key === 'component_specification').map(r => [r.subjectLabel, r.status])).toEqual([['Component 8 oz bottle', 'APPROVED'], ['Component 24-410 pump', 'REJECTED']]);
  expect(line(c, 'component_specification', 'C-PUMP-24').note).toBe('Wrong neck size on the drawing');
  // Direct bottle printing: artwork waiting for review, no printer proof yet.
  expect(line(c, 'approved_artwork', 'A-BOTTLE-V1').status).toBe('AWAITING_REVIEW');
  expect(line(c, 'printer_proof', 'A-BOTTLE-V1').status).toBe('MISSING');
  // A rejected document has to be replaced, so it counts as missing work.
  expect(c).toMatchObject({ missing: 3, awaitingReview: 1, approved: 2 });
  expect(c.counts).toEqual({ MISSING: 2, REJECTED: 1, EXPIRED: 0, AWAITING_REVIEW: 1, APPROVED: 2 });
});

test('labels: approved artwork and a printer proof for each artwork', () => {
  const c = check('SUP-LBL');
  expect(c.rows.map(r => [r.key, r.subjectLabel, r.status])).toEqual([
    ['approved_artwork', 'Artwork Honey Milk label v3', 'APPROVED'],
    ['printer_proof', 'Artwork Honey Milk label v3', 'MISSING']]);
});

test('a document counts only when someone reviewed and approved it', () => {
  expect(D.documentState({ status: 'received' })).toBe('AWAITING_REVIEW');
  expect(D.documentState({ status: 'approved' })).toBe('AWAITING_REVIEW');                                   // nobody's name on it
  expect(D.documentState({ status: 'approved', reviewedBy: 'owner' })).toBe('AWAITING_REVIEW');              // no date
  expect(D.documentState({ status: 'approved', reviewedBy: 'owner', reviewedAt: '2026-11-01' })).toBe('APPROVED');
  expect(D.documentState({ status: 'APPROVED', reviewedBy: 'owner', reviewedAt: '2026-11-01' })).toBe('APPROVED');
  expect(D.documentState({ status: 'rejected', reviewedBy: 'owner', reviewedAt: '2026-11-01' })).toBe('REJECTED');
  expect(D.documentState({ status: 'approved', reviewedBy: 'owner', reviewedAt: '2026-01-01', expiresOn: '2026-11-15' }, '2026-11-16')).toBe('EXPIRED');
  expect(D.documentState({ status: 'approved', reviewedBy: 'owner', reviewedAt: '2026-01-01', expiresOn: '2026-11-16' }, '2026-11-16')).toBe('APPROVED');
  expect(D.documentState({ status: 'approved', reviewedBy: 'owner', reviewedAt: '2026-01-01', expiresOn: 'next year' }, '2026-11-16')).toBe('AWAITING_REVIEW');
  for (const bad of [null, undefined, {}, 'x', 0]) expect(D.documentState(bad)).toBe('AWAITING_REVIEW');
  // A document for another supplier, another subject or another kind satisfies nothing.
  const docs = [{ supplier_id: 'SUP-LBL', kind: 'printer_proof', subjectKind: 'artwork', subjectId: 'A-BOTTLE-V1', status: 'approved', reviewedBy: 'owner', reviewedAt: '2026-11-01' }];
  expect(line(D.supplierChecklist(sup('SUP-BOT'), FX.context, docs, { asOf: FX.asOf }), 'printer_proof', 'A-BOTTLE-V1').status).toBe('MISSING');
  // When several copies exist, an approved one wins over an older rejected one.
  const two = FX.documents.concat([{ supplier_id: 'SUP-BOT', kind: 'component_specification', subjectKind: 'component', subjectId: 'C-PUMP-24', status: 'approved', reviewedBy: 'owner', reviewedAt: '2026-11-12' }]);
  expect(line(D.supplierChecklist(sup('SUP-BOT'), FX.context, two, { asOf: FX.asOf }), 'component_specification', 'C-PUMP-24').status).toBe('APPROVED');
});

test('reviewing a document: owner, administrator or manager, with a name and a time; a rejection says why; once only', () => {
  const doc = FX.documents.find(d => d.kind === 'certificate_of_analysis' && d.subjectId === 'B-205');
  const who = { role: 'owner', by: 'owner-stas', at: '2026-11-16T15:00:00Z' };
  expect(D.reviewDocument(doc, 'approved', { role: 'employee', by: 'x', at: 'y' }).reason).toMatch(/owner, an administrator or a manager/);
  expect(D.reviewDocument(doc, 'approved', { role: 'owner' }).reason).toMatch(/who reviewed it and when/);
  expect(D.reviewDocument(doc, 'maybe', who).reason).toMatch(/approved or rejected/);
  expect(D.reviewDocument(doc, 'rejected', who).reason).toMatch(/say why/);
  const ok = D.reviewDocument(doc, 'approved', who);
  expect(ok.ok).toBe(true);
  expect(ok.document).toMatchObject({ status: 'approved', reviewedBy: 'owner-stas', reviewedAt: '2026-11-16T15:00:00Z' });
  expect(doc.status).toBe('received');                                    // the original is untouched
  expect(D.reviewDocument(ok.document, 'approved', who)).toMatchObject({ ok: false, duplicate: true });
  const no = D.reviewDocument(doc, 'rejected', Object.assign({ note: 'The lot number on it is wrong' }, who));
  expect(no.document).toMatchObject({ status: 'rejected', reviewNote: 'The lot number on it is wrong' });
  // With the review recorded, the checklist line turns approved.
  const docs = FX.documents.map(d => d === doc ? ok.document : d);
  expect(line(D.supplierChecklist(sup('SUP-LAB'), FX.context, docs, { asOf: FX.asOf }), 'certificate_of_analysis', 'B-205').status).toBe('APPROVED');
});

test('the overview totals what is missing and awaiting review, suppliers with the most work first', () => {
  const o = D.overview(FX.suppliers, FX.context, FX.documents, { asOf: FX.asOf });
  expect(o.totals).toEqual({ suppliers: 3, documents: 18, missing: 7, awaitingReview: 3, approved: 8 });
  expect(o.suppliers.map(s => s.supplier.id)).toEqual(['SUP-LAB', 'SUP-BOT', 'SUP-LBL']);
  expect(o).toMatchObject({ ok: true, readOnly: true, label: 'SIMULATED' });
});

test('the checklist is configurable: another list can be passed in, and a broken one is refused, not half-used', () => {
  // The owner adds an insurance certificate for every lab and drops the packing slip.
  const mine = {
    purchase: D.DEFAULT_CHECKLIST.purchase.filter(d => d.key !== 'packing_slip'),
    profiles: { lotion_lab: { label: 'Lotion lab', documents: D.DEFAULT_CHECKLIST.profiles.lotion_lab.documents.concat([{ key: 'insurance_certificate', label: 'Insurance certificate', per: 'supplier' }]) } },
    profilesByType: { lab: ['lotion_lab'] },
  };
  expect(D.checkChecklist(mine)).toEqual([]);
  const c = check('SUP-LAB', { checklist: mine });
  expect(c.rows.some(r => r.key === 'packing_slip')).toBe(false);
  expect(c.rows.find(r => r.key === 'insurance_certificate')).toMatchObject({ subjectLabel: 'SYN Lotion Lab', status: 'MISSING' });
  // A supplier type with no profile simply gets the purchase documents.
  expect(D.profilesFor({ supplier_type: 'freight' })).toEqual([]);
  expect(D.profilesFor({ supplier_type: 'lab', documentProfiles: ['labels_printing', 'nonsense', 'labels_printing'] })).toEqual(['labels_printing']);
  const broken = [
    [null, /checklist is missing/],
    [{ purchase: 'x', profiles: {} }, /not a list/],
    [{ purchase: [], profiles: { a: { label: 'A', documents: [{ key: 'k', label: '', per: 'batch' }] } } }, /needs a key and a label/],
    [{ purchase: [], profiles: { a: { label: 'A', documents: [{ key: 'k', label: 'K', per: 'shipment' }] } } }, /unknown subject/],
    [{ purchase: [{ key: 'k', label: 'K', per: 'purchase', stages: ['received'] }], profiles: { a: { label: 'A', documents: [{ key: 'k', label: 'K2', per: 'batch' }] } } }, /used twice/],
    [{ purchase: [], profiles: {}, profilesByType: { lab: ['ghost'] } }, /unknown profile/],
  ];
  for (const [cl, why] of broken) {
    expect(D.checkChecklist(cl).join(' | ')).toMatch(why);
    const r = D.supplierChecklist(sup('SUP-LAB'), FX.context, FX.documents, { checklist: cl || undefined, asOf: FX.asOf });
    if (cl) { expect(r.ok).toBe(false); expect(r.rows).toEqual([]); }
  }
});

test('odd input never throws and never invents a document', () => {
  for (const bad of [undefined, null, 0, 'x', [], {}]) {
    const c = D.supplierChecklist(bad, bad, bad, { asOf: FX.asOf });
    expect(c.ok).toBe(true);
    expect(c.rows).toEqual([]);
    expect(D.overview(bad, bad, bad).totals.documents).toBe(0);
    expect(D.reviewDocument(bad, 'approved', { role: 'owner', by: 'o', at: 't' }).ok).toBe(bad && typeof bad === 'object' ? true : false);
  }
  const c = D.supplierChecklist(sup('SUP-LAB'), { purchaseOrders: [null, 'x', { supplier_id: 'SUP-LAB' }], batches: 'none' }, [null, 7, { supplier_id: 'SUP-LAB' }], { asOf: FX.asOf });
  expect(c.rows.filter(r => r.status === 'APPROVED')).toEqual([]);
});
