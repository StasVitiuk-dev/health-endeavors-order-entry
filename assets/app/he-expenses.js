// assets/app/he-expenses.js — Expenses: list, receipts, delete to the recycle bin and restore list
// EXT15: moved unchanged out of assets/owner-login-app.js (initApp). Its inputs
// arrive explicitly in ctx; it returns only what other code still uses. Map:
// docs/ops/APPLICATION_MODULE_MAP_EXT15.md. Created once, by the app, in order.
window.HE.modules.define('he-expenses', { api: 1, needs: ['EXPENSE_CATEGORY_LABELS','LIST_LIMITS','SEARCH_INDEX','appendMore','confirmSecondPress','esc','fetchAllRows','fmtDate','fmtDateOnly','fmtMoney','listLimit','noRowsChanged','showDashError','staleMessage','supabase','updateIfUnchanged'] }, function (ctx) {
    const { EXPENSE_CATEGORY_LABELS, LIST_LIMITS, SEARCH_INDEX, appendMore, confirmSecondPress, esc, fetchAllRows, fmtDate, fmtDateOnly, fmtMoney, listLimit, noRowsChanged, showDashError, staleMessage, supabase, updateIfUnchanged } = ctx;
    // Expenses (manual entry — feeds the Accounting Agent's rollup)
    async function loadExpenses(){
      try {
        const { data: rows, error } = await supabase
          .from('expenses')
          .select('id, category, amount, expense_date, vendor, note, receipt_path')
          .is('deleted_at', null)
          .order('expense_date', { ascending: false })
          .limit(LIST_LIMITS.expenses = LIST_LIMITS.expenses || 200); // EXT9: Show more reaches older ones
        if (error) throw error;
        SEARCH_INDEX.expenses = rows;

        // The list shows the newest 200; the count and money total come from
        // every expense (paged, complete), never just the listed ones (X3-03).
        const allAmounts = await fetchAllRows('expenses', 'id, amount', q => q.is('deleted_at', null));
        const total = allAmounts.reduce((sum, r) => sum + Number(r.amount || 0), 0);
        document.getElementById('expenseStats').innerHTML = `
          <div class="stat"><div class="num">${allAmounts.length}</div><div class="lbl">Expenses on file</div></div>
          <div class="stat"><div class="num">${esc(fmtMoney(total, 'USD'))}</div><div class="lbl">Total logged</div></div>
        ` + (allAmounts.length > (rows || []).length ? `<p class="hint expensesCutNote u-flexbasis-100pct u-m-4-0-0">The list below shows the newest ${(rows || []).length} of ${allAmounts.length} expenses. The totals above include all of them.</p>` : '');

        if (!rows || !rows.length) {
          document.getElementById('expensesWrap').innerHTML = '<p class="empty">No expenses logged yet — add your first one below.</p>';
          return;
        }

        document.getElementById('expensesWrap').innerHTML = rows.map(r => `
          <div class="approvalRow" data-id="${esc(r.id)}" data-file-path="${esc(r.receipt_path || '')}">
            <div class="info">
              <b>${esc(EXPENSE_CATEGORY_LABELS[r.category] || r.category)}</b>
              <span class="badge">${esc(fmtMoney(r.amount, 'USD'))}</span>
              ${r.vendor ? `<div class="u-fs-12 u-c-muted u-mt-3">Vendor: ${esc(r.vendor)}</div>` : ''}
              ${r.note ? `<div class="u-fs-12 u-c-muted u-mt-3">${esc(r.note)}</div>` : ''}
              ${r.receipt_path ? `<div class="u-fs-12 u-mt-3"><a href="#" class="expFileLink">View receipt</a></div>` : ''}
              <br><span class="u-fs-11 u-c-muted">${esc(fmtDateOnly(r.expense_date))}</span>
            </div>
            <div class="actions">
              ${r.receipt_path ? `<button class="small expRemoveReceiptBtn">Remove receipt</button>` : ''}
              <button class="small deny expDeleteBtn">Delete</button>
            </div>
          </div>`).join('');
        appendMore('expensesWrap', 'expenses', rows.length, allAmounts.length, 'expenses', loadExpenses);
        document.querySelectorAll('.expDeleteBtn').forEach(btn => btn.addEventListener('click', () => deleteExpense(btn)));
        document.querySelectorAll('.expRemoveReceiptBtn').forEach(btn => btn.addEventListener('click', () => removeExpenseReceipt(btn)));
        document.querySelectorAll('.expFileLink').forEach(link => {
          link.addEventListener('click', async (ev) => {
            ev.preventDefault();
            const row = link.closest('.approvalRow');
            const path = row.getAttribute('data-file-path');
            if (!path) return;
            const originalText = link.textContent;
            link.textContent = 'Preparing…';
            try {
              const { data, error: signErr } = await supabase.storage.from('expense-receipts').createSignedUrl(path, 60);
              if (signErr) throw signErr;
              window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
            } catch (err) {
              showDashError('Could not open that receipt: ' + (err && err.message ? err.message : err));
            } finally {
              link.textContent = originalText;
            }
          });
        });
      } catch (err) {
        showDashError('Could not load expenses: ' + (err && err.message ? err.message : err));
      }
    }

    async function removeExpenseReceipt(btn){
      const row = btn.closest('.approvalRow');
      const id = row.getAttribute('data-id');
      const path = row.getAttribute('data-file-path');
      if (!path) return;
      // Receipts are tax records and this deletes the file for good, so it
      // takes a second press (finding N10; whether files should be deleted at
      // all is an open owner decision).
      if (!confirmSecondPress(btn, 'Delete receipt file for good?')) return;
      btn.disabled = true;
      try {
        // Unlink first (only if the row still points at this exact file), then
        // remove the file. If the second step fails, the result is a stray
        // file nobody can see — never an expense pointing at a missing file.
        const changed = await updateIfUnchanged('expenses', id, { receipt_path: null }, { receipt_path: path });
        if (!changed) { showDashError(staleMessage('That expense')); loadExpenses(); return; }
        const { error: removeErr } = await supabase.storage.from('expense-receipts').remove([path]);
        if (removeErr) showDashError('The receipt was unlinked from the expense, but the file itself could not be deleted from storage: ' + (removeErr.message || removeErr));
        loadExpenses();
      } catch (err) {
        btn.disabled = false;
        showDashError('Could not remove that receipt: ' + (err && err.message ? err.message : err));
      }
    }

    async function deleteExpense(btn){
      const row = btn.closest('.approvalRow');
      const id = row.getAttribute('data-id');
      row.querySelectorAll('button').forEach(b => b.disabled = true);
      try {
        // Soft delete, same as Feature Requests and Orders: stamps deleted_at
        // instead of removing the row, so it's recoverable from the recycle bin.
        const { data: changed, error } = await supabase.from('expenses').update({ deleted_at: new Date().toISOString() }).eq('id', id).is('deleted_at', null).select('id');
        if (error) throw error;
        if (noRowsChanged(changed)) { showDashError(staleMessage('That expense')); loadExpenses(); return; }
        loadExpenses();
        loadDeletedExpenses();
      } catch (err) {
        row.querySelectorAll('button').forEach(b => b.disabled = false);
        showDashError('Could not delete that expense: ' + (err && err.message ? err.message : err));
      }
    }

    async function loadDeletedExpenses(){
      try {
        const { data: deleted, error, count } = await supabase
          .from('expenses')
          .select('id, category, amount, deleted_at, receipt_path', { count: 'exact' })
          .not('deleted_at', 'is', null)
          .order('deleted_at', { ascending: false })
          .limit(listLimit('delExpenses'));
        if (error) throw error;

        if (!deleted || !deleted.length) {
          document.getElementById('deletedExpensesWrap').innerHTML = '<p class="empty">Recycle bin is empty.</p>';
          return;
        }
        document.getElementById('deletedExpensesWrap').innerHTML = deleted.map(r => `
          <div class="deletedRow" data-id="${esc(r.id)}">
            <div class="info"><b>${esc(EXPENSE_CATEGORY_LABELS[r.category] || r.category)} — ${esc(fmtMoney(r.amount, 'USD'))}</b><br>
            <span class="u-fs-11 u-c-muted">Deleted ${esc(fmtDate(r.deleted_at))}</span></div>
            <button class="small restoreExpenseBtn">Restore</button>
          </div>`).join('');
        appendMore('deletedExpensesWrap', 'delExpenses', deleted.length, count, 'deleted expenses', loadDeletedExpenses);
        document.querySelectorAll('.restoreExpenseBtn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const row = btn.closest('.deletedRow');
            const id = row.getAttribute('data-id');
            btn.disabled = true;
            try {
              // Only while it is still deleted (restored elsewhere = nothing to do). EXT4
              const { data: changed, error } = await supabase.from('expenses').update({ deleted_at: null }).eq('id', id).not('deleted_at', 'is', null).select('id');
              if (error) throw error;
              if (noRowsChanged(changed)) { showDashError(staleMessage('That expense')); loadExpenses(); return; }
              loadExpenses();
              loadDeletedExpenses();
            } catch (err) {
              btn.disabled = false;
              showDashError('Could not restore that expense: ' + (err && err.message ? err.message : err));
            }
          });
        });
      } catch (err) {
        showDashError('Could not load recently deleted expenses: ' + (err && err.message ? err.message : err));
      }
    }

  return { loadExpenses, loadDeletedExpenses };
});
