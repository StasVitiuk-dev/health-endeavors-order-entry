// assets/app/he-suppliers.js — Suppliers: list
// EXT15: moved unchanged out of assets/owner-login-app.js (initApp). Its inputs
// arrive explicitly in ctx; it returns only what other code still uses. Map:
// docs/ops/APPLICATION_MODULE_MAP_EXT15.md. Created once, by the app, in order.
window.HE.modules.define('he-suppliers', { api: 1, needs: ['SEARCH_INDEX','SUPPLIER_TYPE_LABELS','boolGuard','esc','fetchAllRows','showDashError','staleMessage','updateIfUnchanged'] }, function (ctx) {
    const { SEARCH_INDEX, SUPPLIER_TYPE_LABELS, boolGuard, esc, fetchAllRows, showDashError, staleMessage, updateIfUnchanged } = ctx;
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
        document.getElementById('supplierStats').innerHTML = `
          <div class="stat"><div class="num">${active.length}</div><div class="lbl">Active suppliers</div></div>
          <div class="stat"><div class="num">${active.filter(s => s.supplier_type === 'manufacturer').length}</div><div class="lbl">Manufacturers</div></div>`;

        // keep the purchase-order dropdown in step
        const sel = document.getElementById('poSupplier');
        const keep = sel.value;
        sel.innerHTML = '<option value="">Supplier…</option>' + active.map(s =>
          `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
        sel.value = keep;

        document.getElementById('suppliersWrap').innerHTML = rows.length ? rows.map(s => `
          <div class="supRow${s.is_active ? '' : ' inactive'}" data-id="${esc(s.id)}">
            <div>
              <div class="sName">${esc(s.name)} <span class="badge">${esc(SUPPLIER_TYPE_LABELS[s.supplier_type] || s.supplier_type)}</span></div>
              <div class="sMeta">${[s.contact_name, s.email, s.phone].filter(Boolean).map(esc).join(' · ') || 'No contact details yet'}</div>
              ${s.notes ? `<div class="sMeta">${esc(s.notes)}</div>` : ''}
            </div>
            <button type="button" class="small secondary supToggleBtn">${s.is_active ? 'Deactivate' : 'Reactivate'}</button>
          </div>`).join('') : '<p class="empty">No suppliers yet. Add the manufacturer you\'re about to order from.</p>';

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
