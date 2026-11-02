// assets/app/he-suppliers.js — Suppliers: list
// EXT15: moved unchanged out of assets/owner-login-app.js (initApp). Its inputs
// arrive explicitly in ctx; it returns only what other code still uses. Map:
// docs/ops/APPLICATION_MODULE_MAP_EXT15.md. Created once, by the app, in order.
window.HE.modules.define('he-suppliers', { api: 1, needs: ['SEARCH_INDEX','SUPPLIER_TYPE_LABELS','boolGuard','fetchAllRows','h','showDashError','staleMessage','updateIfUnchanged'] }, function (ctx) {
    const { SEARCH_INDEX, SUPPLIER_TYPE_LABELS, boolGuard, fetchAllRows, h, showDashError, staleMessage, updateIfUnchanged } = ctx;
 // key: `${purchase_order_id}::${product_id}` -> array of {lot_number, quantity_received}

    async function loadSuppliers(){
      try {
        let data = null, error = null;
        try { data = (await fetchAllRows('suppliers', 'id, name, supplier_type, contact_name, email, phone, notes, is_active', q => q)).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))); }
        catch (e) { error = e; }
        if (error) throw error;
        const rows = data || [];
        SEARCH_INDEX.suppliers = rows;

        const active = rows.filter(s => s.is_active);
        // EXT20J: built as DOM nodes (h() text-ifies) instead of an HTML string, so
        // the Suppliers screen is safe under Trusted Types. Long/special supplier
        // names and notes were already esc()-ed; now they are text nodes.
        document.getElementById('supplierStats').replaceChildren(
          h('div', { class: 'stat' }, h('div', { class: 'num' }, active.length), h('div', { class: 'lbl' }, 'Active suppliers')),
          h('div', { class: 'stat' }, h('div', { class: 'num' }, active.filter(s => s.supplier_type === 'manufacturer').length), h('div', { class: 'lbl' }, 'Manufacturers')));

        // keep the purchase-order dropdown in step
        const sel = document.getElementById('poSupplier');
        const keep = sel.value;
        sel.replaceChildren(h('option', { value: '' }, 'Supplier…'), ...active.map(s => h('option', { value: s.id }, s.name)));
        sel.value = keep;

        const supplierRow = s => h('div', { class: 'supRow' + (s.is_active ? '' : ' inactive'), 'data-id': s.id },
          h('div', null,
            h('div', { class: 'sName' }, s.name, ' ', h('span', { class: 'badge' }, SUPPLIER_TYPE_LABELS[s.supplier_type] || s.supplier_type)),
            h('div', { class: 'sMeta' }, [s.contact_name, s.email, s.phone].filter(Boolean).join(' · ') || 'No contact details yet'),
            s.notes ? h('div', { class: 'sMeta' }, s.notes) : null),
          h('button', { type: 'button', class: 'small secondary supToggleBtn' }, s.is_active ? 'Deactivate' : 'Reactivate'));
        document.getElementById('suppliersWrap').replaceChildren(...(rows.length
          ? rows.map(supplierRow)
          : [h('p', { class: 'empty' }, 'No suppliers yet. Add the manufacturer you\'re about to order from.')]));

        document.querySelectorAll('.supToggleBtn').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const row = btn.closest('.supRow');
            const id = row.getAttribute('data-id');
            const nowActive = !row.classList.contains('inactive');
            btn.disabled = true;
            try {
              const changed = await updateIfUnchanged('suppliers', id,
                { is_active: !nowActive, updated_at: new Date().toISOString() }, { is_active: boolGuard(nowActive) });
              if (changed) toastOk(nowActive ? 'Supplier deactivated.' : 'Supplier reactivated.');
              else showDashError(staleMessage('That supplier'));
              loadSuppliers();
            } catch (err) {
              btn.disabled = false;
              showDashError('Could not update that supplier: ' + (err && err.message ? err.message : err));
            }
          });
        });
      } catch (err) {
        document.getElementById('suppliersWrap').replaceChildren();
        showDashError('Could not load suppliers: ' + (err && err.message ? err.message : err));
      }
    }

  return { loadSuppliers };
});
