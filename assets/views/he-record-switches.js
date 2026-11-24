// Switches that save real records (owner rule, Nov 24: "everything I can turn on,
// off or pause on the dashboard"). Unlike the previews, each of these reads and
// writes real records once its database step is installed. They appear on Feature
// Flags for the OWNER only, with the database step each needs and whether it is
// installed (checked live, read only). Turning one on is possible only when its
// step is installed, and asks for a second tap; turning off always works.
// A switch is a note in this browser only (like the previews).
//
// Pure apart from the database client it is GIVEN. Dual-mode (Node + HE.views).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.views = root.HE.views || {})['he-record-switches'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // probe: a table only that database step creates (read with limit 0: no rows read)
  const RECORD_SWITCHES = Object.freeze([
    { key: 'he_tax_rates', name: 'Confirmed tax rates', where: 'Tax Records (and a Home notice)', draft: 'drafts/46 (review item 8)', probe: 'tax_rates',
      what: 'You confirm your sales tax rate with its start day and source; invoices use only a rate you confirmed.' },
    { key: 'he_invoice_payments', name: 'Invoice payments', where: 'Accounting', draft: 'drafts/32 (review item 1)', probe: 'invoice_payments',
      what: 'Record payments against issued wholesale invoices (part payments, reversals).' },
    { key: 'he_money_issues', name: 'Saved money differences', where: 'Home and Accounting', draft: 'drafts/42', probe: 'money_match_issues',
      what: 'Keeps the money differences found by money matching until someone checks them.' },
    { key: 'he_receiving_store', name: 'Deliveries and returns to suppliers', where: 'Inventory', draft: 'drafts/40 (staff also need drafts/44)', probe: 'receiving_records',
      what: 'Records deliveries received in parts and units sent back; stock changes only when you approve.' },
    { key: 'he_supplier_documents_store', name: 'Supplier documents (saved)', where: 'Suppliers', draft: 'drafts/36 and 38', probe: 'supplier_documents', needs: 'he_supplier_documents',
      what: 'Saves supplier documents and their review; needs the Supplier documents preview on too.' },
    { key: 'he_shared_settings', name: 'Settings shared by every device', where: 'Feature Flags and Accounting', draft: 'drafts/50 (review item 10)', probe: 'shared_settings',
      what: 'Your switches and your Real profit numbers are kept in the database, the same on every phone and computer. Turn it on here to start in this browser; it becomes the rule for every device with a small update after the step is installed.' },
    { key: 'he_order_costs', name: 'Real fees and postage per order', where: 'Accounting', draft: 'drafts/52 (review item 11)', probe: 'order_costs',
      what: 'Real profit uses each order\'s real fee and postage where they are saved, instead of your estimates; Money per channel can save the real fees from a channel\'s report.' },
    { key: 'he_order_batches', name: 'Batch on each order', where: 'Orders', draft: 'drafts/54 (review item 12)', probe: 'order_batches',
      what: 'When packing, scan the batch sticker onto the order. "Who got a batch" then lists every order that received it. A wrong scan is voided with a reason, never deleted.' },
    { key: 'he_incident_close', name: 'Close an incident with a note', where: 'Incidents', draft: 'No database step needed', probe: 'incidents',
      what: 'The owner and administrators get a "Record what was done" button on each open incident: write what was done, then keep it open or close it. Nothing is deleted; closed incidents stay listed with their note.' },
    { key: 'he_email_sending', name: 'Saved email campaigns', where: 'Store Campaigns and Customer Emails', draft: 'drafts/56', probe: 'email_campaigns',
      what: 'Saves a campaign you approved and the list of who it goes to in the database, with the sending guard (slow start, do-not-email list, automatic stop). It still sends nothing: the sending program is separate and not connected.' },
    { key: 'he_my_settings', name: 'Your own settings on every device', where: 'Home (Needs you now)', draft: 'drafts/58', probe: 'my_settings',
      what: 'What you set aside until tomorrow on Home follows you to every phone and computer you sign in to. Each person has their own; nobody else sees them.' },
    { key: 'he_dropoff', name: 'Drop-off receipts', where: 'Orders', draft: 'drafts/48 (review item 9)', probe: 'order_parcels',
      what: 'One carrier receipt marks every parcel on it dropped off.' },
  ]);

  // -> 'installed' | 'not_installed' | 'unknown'
  async function probe(client, sw) {
    if (!client || typeof client.from !== 'function' || !sw || !sw.probe) return 'unknown';
    try {
      const res = await client.from(sw.probe).select('*').limit(0);
      if (!res || !res.error) return 'installed';
      const code = String(res.error.code || ''), msg = String(res.error.message || '');
      if (code === '42P01' || code === 'PGRST205' || /does not exist|could not find the table/i.test(msg)) return 'not_installed';
      return 'unknown';
    } catch (e) { return 'unknown'; }
  }

  // what the row offers, given whether it is on and the install state
  function action(on, state) {
    if (on) return { button: 'Turn off', allowed: true, note: state === 'not_installed' ? 'On, but its database step is not installed: it only says so on its page.' : '' };
    if (state === 'installed') return { button: 'Turn on', allowed: true, note: '' };
    if (state === 'not_installed') return { button: 'Turn on', allowed: false, note: 'Install its database step first.' };
    return { button: 'Turn on', allowed: false, note: 'Could not check its database step just now. Try again later.' };
  }

  const STATE_WORD = { installed: 'Installed', not_installed: 'Not installed yet', unknown: 'Could not check' };

  return { RECORD_SWITCHES, STATE_WORD, probe, action };
}));
