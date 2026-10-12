// assets/app/he-tasks.js — Tasks page: list, recently done, status changes (guarded: only if still in the expected state)
// EXT15: moved unchanged out of assets/owner-login-app.js (initApp). Its inputs
// arrive explicitly in ctx; it returns only what other code still uses. Map:
// docs/ops/APPLICATION_MODULE_MAP_EXT15.md. Created once, by the app, in order.
window.HE.modules.define('he-tasks', { api: 1, needs: ['CLOSED_IN','SEARCH_INDEX','TASK_ALLOWED_FROM','TASK_NEXT_ACTIONS','TASK_STATUS_LABELS','esc','explainDbError','fmtDate','isClosedStatus','isOverdue','showDashError','supabase'] }, function (ctx) {
    const { CLOSED_IN, SEARCH_INDEX, TASK_ALLOWED_FROM, TASK_NEXT_ACTIONS, TASK_STATUS_LABELS, esc, explainDbError, fmtDate, isClosedStatus, isOverdue, showDashError, supabase } = ctx;
    async function changeTaskStatus(btn){
      const row = btn.closest('tr');
      const id = row && row.getAttribute('data-id');
      const to = btn.getAttribute('data-to');
      const allowedFrom = TASK_ALLOWED_FROM[to];
      if (!id || !allowedFrom) return;
      if (to === 'done' || to === 'open') {
        const titleEl = row.querySelector('.taskTitle');
        const title = titleEl ? titleEl.textContent.trim() : 'this task';
        const question = to === 'done' ? 'Mark this task done?' : 'Reopen this task? It goes back to the open list.';
        if (!window.confirm(question + '\n\n' + title)) return;
      }
      row.querySelectorAll('.taskStatusBtn').forEach(b => { b.disabled = true; });
      try {
        const { data, error } = await supabase
          .from('tasks')
          .update({ status: to })
          .eq('id', id)
          .in('status', allowedFrom)
          .select('id, status');
        if (error) throw error;
        if (!data || data.length === 0) {
          showDashError('That task was already changed (by someone else or an agent), or you don\'t have permission to change it. The list has been refreshed.');
        }
      } catch (err) {
        showDashError('Could not update that task: ' + (err && err.message ? err.message : err));
      } finally {
        loadTasks();
      }
    }

    // Finished/cancelled tasks, newest change first (EXT7). Returns the rows
    // so search can find them; a failure here never hides the open list.
    async function loadRecentlyDoneTasks(){
      const wrap = document.getElementById('recentDoneWrap');
      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('id, title, priority, status, due_at, updated_at')
          .in('status', ['done', 'cancelled'])
          .order('updated_at', { ascending: false, nullsFirst: false })
          .limit(10);
        if (error) throw error;
        const rows = data || [];
        if (wrap) {
          wrap.innerHTML = !rows.length ? '<p class="empty">No finished tasks yet.</p>' : `
            <table class="phoneCards"><thead><tr><th>Title</th><th>Status</th><th>Last changed</th></tr></thead>
            <tbody>${rows.map(t => `
              <tr data-id="${esc(t.id)}">
                <td class="u-ws-normal u-minw-190">
                  <div class="taskTitle">${esc(t.title)}</div>
                  ${(TASK_ALLOWED_FROM.open || []).includes(t.status)
                    ? '<div class="taskActions u-mt-8"><button type="button" class="small taskStatusBtn" data-to="open">Reopen</button></div>' : ''}
                </td>
                <td>${esc(TASK_STATUS_LABELS[t.status] || t.status || '—')}</td>
                <td>${esc(t.updated_at ? fmtDate(t.updated_at) : 'Unknown')}</td>
              </tr>`).join('')}</tbody></table>`;
          wrap.querySelectorAll('.taskStatusBtn').forEach(btn => btn.addEventListener('click', () => changeTaskStatus(btn)));
        }
        return rows;
      } catch (err) {
        if (wrap) wrap.innerHTML = '<p class="empty u-c-warn">Could not load recently finished tasks: ' + esc(explainDbError((err && err.message) || String(err))) + '</p>';
        return [];
      }
    }

    async function loadTasks(){
      try {
        const { data: tasks, error, count } = await supabase
          .from('tasks')
          .select('id, title, priority, status, due_at', { count: 'exact' })
          .not('status', 'in', CLOSED_IN)
          .order('due_at', { ascending: true, nullsFirst: false })
          .limit(100);
        if (error) throw error;

        // EXT7: only open tasks are read, so the 100-row cap and the count
        // apply to open tasks. Before, the newest 100 of ALL tasks were read
        // and filtered here, so once enough finished tasks piled up, open ones
        // silently fell off the list.
        const open = tasks.filter(t => !isClosedStatus(t.status));
        const truncated = count != null && count > tasks.length;
        const cutoffNote = truncated
          ? `<p class="hint u-m-0-0-8 u-c-warn">Showing the ${tasks.length} soonest-due of ${count} open tasks.</p>` : '';
        const recent = await loadRecentlyDoneTasks();
        SEARCH_INDEX.tasks = tasks.concat(recent);
        if (!open.length) {
          document.getElementById('tasksTableWrap').innerHTML = cutoffNote + '<p class="empty">No open tasks.</p>';
        } else {
          document.getElementById('tasksTableWrap').innerHTML = `
            ${cutoffNote}
            <table class="phoneCards"><thead><tr><th>Title</th><th>Priority</th><th>Status</th><th>Due</th></tr></thead>
            <tbody>${open.map(t => `
              <tr class="${isOverdue(t.due_at, t.status) ? 'overdue' : ''}" data-id="${esc(t.id)}">
                <td class="u-ws-normal u-minw-190">
                  <div class="taskTitle">${esc(t.title)}</div>
                  <div class="taskActions u-d-flex u-fwr-wrap u-gap-6 u-mt-8">${(TASK_NEXT_ACTIONS[t.status] || []).map(a =>
                    `<button type="button" class="small taskStatusBtn" data-to="${esc(a.to)}">${esc(a.label)}</button>`).join('')}</div>
                </td>
                <td><span class="badge">${esc(t.priority || '—')}</span></td>
                <td>${esc(TASK_STATUS_LABELS[t.status] || t.status || '—')}</td>
                <td>${esc(fmtDate(t.due_at))}</td>
              </tr>`).join('')}</tbody></table>`;
          document.querySelectorAll('#tasksTableWrap .taskStatusBtn').forEach(btn =>
            btn.addEventListener('click', () => changeTaskStatus(btn)));
        }
      } catch (err) {
        showDashError('Could not load tasks: ' + (err && err.message ? err.message : err));
      }
    }

  return { loadTasks };
});
