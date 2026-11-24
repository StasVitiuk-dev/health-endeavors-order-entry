// assets/app/he-agents.js — AI agents: switch states, scheduled-job health, honest status (unknown is never 'running'), paused banner
// EXT15: moved unchanged out of assets/owner-login-app.js (initApp). Its inputs
// arrive explicitly in ctx; it returns only what other code still uses. Map:
// docs/ops/APPLICATION_MODULE_MAP_EXT15.md. Created once, by the app, in order.
window.HE.modules.define('he-agents', { api: 1, needs: ['AGENT_REGISTRY','AGENT_STALE_AFTER_HOURS','currentUserId','fmtDate','getPageBadgeCount','h','maskSensitive','requireReauth','showDashError','showPage','staleMessage','supabase','toast','updateIfUnchanged'] }, function (ctx) {
    const { AGENT_REGISTRY, AGENT_STALE_AFTER_HOURS, currentUserId, fmtDate, getPageBadgeCount, h, maskSensitive, requireReauth, showDashError, showPage, staleMessage, supabase, toast, updateIfUnchanged } = ctx;
    let agentControlsByNum = Object.create(null);
    // EXT15: read access for Home, System status and Business Health. Read at the
    // moment of use (never copied before an await): loadAgentControls() may update them.
    function agentControls(){ return { state: agentControlsState, byNum: agentControlsByNum }; }
    // 'loading' until the first read, then 'ok' or 'failed'. When the switches
    // can't be read, every agent shows UNKNOWN — never "on" by default.
    let agentControlsState = 'loading'; // pg_cron agents run hourly; 2 missed hours = stale

    // The one honest state for each agent, from the data the dashboard can
    // actually see (agent_controls, its last_run_* columns, and whether the
    // scheduled job exists). Anything it cannot see is UNKNOWN, not "live".
    //   ENABLED · DISABLED · UNKNOWN · FAILED · STALE · DRY RUN · CALCULATED HERE
    function agentTruth(a, ctrl, nowMs){
      const now = nowMs || Date.now();
      if (a.dashboardOnly) return { key: 'calc', label: 'Calculated here', cls: 'sev-low', detail: 'Worked out by this page each time it opens; nothing runs in the background.' };
      if (agentControlsState === 'failed') return { key: 'unknown', label: 'Unknown', cls: '', detail: 'The agent switches could not be read, so the dashboard cannot say whether this agent is on.' };
      if (agentControlsState === 'loading') return { key: 'unknown', label: 'Checking…', cls: '', detail: '' };
      if (!ctrl) return { key: 'unknown', label: 'Unknown', cls: '', detail: 'No switch row for this agent in agent_controls.' };
      // EXT15 (malformed-data test): the switch must be exactly on or off. A missing
      // or odd value (null, "yes", 1) used to count as "on" and could show Enabled.
      if (typeof ctrl.enabled !== 'boolean') return { key: 'unknown', label: 'Unknown', cls: '', detail: 'The switch value for this agent is not a clear on/off, so the dashboard cannot say whether it is on. Check agent_controls (Query C).' };
      if (ctrl.enabled === false && a.intendedOff) {
        return { key: 'off-intended', label: 'Off — on purpose', cls: 'sev-low',
          detail: 'Switched off on purpose until the store launches (recorded decision). Nothing is wrong.' };
      }
      if (ctrl.enabled === false) {
        return { key: 'disabled', label: 'Disabled', cls: 'sev-medium',
          detail: a.enforced ? 'Paused: its own code checks this switch.' : 'Switch is off, but this agent does not check its switch yet — make sure its runner is off too.' };
      }
      // Agents word it differently ("failed", "error", "failure"…); any of
      // them is a failure, never a quiet "Enabled".
      if (/fail|error/i.test(String(ctrl.last_run_status || ''))) return { key: 'failed', label: 'Failed', cls: 'sev-high', detail: 'The last run failed' + (ctrl.last_error ? ': ' + maskSensitive(ctrl.last_error) : '.') };
      if (a.cronJobName && cronJobState !== 'ok') {
        return { key: 'unknown', label: 'Unknown', cls: '', detail: 'The list of scheduled jobs could not be read, so the dashboard cannot say whether this agent is running.' };
      }
      if (a.cronJobName) {
        const job = cronJobStatusByName[a.cronJobName];
        if (!job || !job.active) return { key: 'stale', label: 'Stale', cls: 'sev-high', detail: job ? 'Its scheduled job is not active, so it will not run.' : 'Its scheduled job could not be confirmed.' };
        const last = ctrl.last_run_at ? Date.parse(ctrl.last_run_at) : NaN;
        if (isNaN(last)) return { key: 'stale', label: 'Stale', cls: 'sev-high', detail: 'No run recorded yet.' };
        const hours = (now - last) / 3600000;
        if (hours > AGENT_STALE_AFTER_HOURS) return { key: 'stale', label: 'Stale', cls: 'sev-high', detail: 'Last run ' + Math.floor(hours) + ' hours ago; it should run every hour.' };
        if (a.dryRun) return { key: 'dryrun', label: 'Dry run', cls: 'sev-medium', detail: 'Running, but only logs what it would send — no email service is connected.' };
        return { key: 'enabled', label: 'Enabled', cls: 'sev-low', detail: 'Switch on and running on schedule.' };
      }
      // The switch is on, but the database trigger itself (which could be
      // disabled) and its last run are invisible here: say exactly that.
      if (a.trigger) return { key: 'enabled', label: 'Switch on', cls: 'sev-low', detail: 'Switch on. Runs inside the database on order changes; this page cannot see whether the trigger itself is enabled or when it last ran (Query C checks the trigger).' };
      // Agents that run on GitHub Actions (outside this dashboard's view) and
      // don't check their switch yet: "on" here proves nothing about reality.
      return { key: 'unknown', label: 'Unknown', cls: '', detail: 'Switch on, but this agent runs on GitHub Actions, which this dashboard cannot see, and it does not check its switch yet. Check GitHub → Actions.' };
    }
    // Populated from the get_agent_cron_status() RPC — jobname -> {jobname, schedule, active}.
    // Only ever has entries for agents actually migrated to pg_cron.
    let cronJobStatusByName = Object.create(null);
    // EXT10b: whether that schedule list could be read at all. If not, an
    // agent's schedule is UNKNOWN, never "stale".
    let cronJobState = 'loading';

    // One line of honest job-health text for an agent migrated to pg_cron.
    // Built from agent_controls' last_run_* columns (written by the agent's
    // own function on every run) plus whether the scheduled job itself is
    // still active in Supabase (from get_agent_cron_status()). Returns ''
    // for any agent that hasn't been migrated yet — nothing to show there.
    // EXT20G: returns a DOM node (or null) instead of an HTML string, so the
    // agents screen is safe under Trusted Types. Each "part" is an array of
    // nodes/strings; parts are joined with a middot separator.
    function agentJobHealthNode(a, ctrl){
      if (!a.cronJobName) return null;
      const cronInfo = cronJobStatusByName[a.cronJobName];
      const parts = [];
      if (cronInfo) {
        parts.push(cronInfo.active
          ? [h('span', { class: 'u-c-good' }, 'Scheduled job ', h('code', null, a.cronJobName), ' active'), ' (' + cronInfo.schedule + ')']
          : [h('span', { class: 'u-c-danger' }, 'Scheduled job ', h('code', null, a.cronJobName), ' is NOT active'), " — it won't run until re-scheduled"]);
      } else {
        parts.push([h('span', { class: 'u-c-warn' }, 'Could not confirm the scheduled job ', h('code', null, a.cronJobName), ' exists')]);
      }
      if (ctrl && ctrl.last_run_at) {
        // EXT15: a class instead of an inline colour (strict style policy).
        const statusClass = ctrl.last_run_status === 'failed' ? 'u-c-danger'
          : (ctrl.last_run_status === 'partial' ? 'u-c-warn' : 'u-c-muted');
        parts.push(['Last run ' + fmtDate(ctrl.last_run_at) + ' — ', h('span', { class: statusClass }, ctrl.last_run_status || 'unknown')]);
        if (ctrl.last_run_summary) parts.push([ctrl.last_run_summary]);
      } else {
        parts.push([h('span', { class: 'u-c-muted' }, 'No run recorded yet')]);
      }
      if (ctrl && ctrl.last_error) parts.push([h('span', { class: 'u-c-danger' }, 'Last error: ' + maskSensitive(ctrl.last_error))]);
      const body = [];
      parts.forEach((p, i) => { if (i) body.push(' · '); body.push(...p); });
      return h('div', { class: 'u-mt-6 u-fs-12 u-p-8-10 u-bg-paneln2 u-br-8' },
        h('b', { class: 'u-fs-11 u-tt-uppercase u-ls-0p02em u-c-muted' }, 'Job health'),
        h('br'),
        ...body);
    }

    // Agents at a glance (owner, Nov 24): every agent on one line at the top of the
    // page, from what the page already read. assets/views/he-agents-glance.js.
    // What is waiting for the owner, and where each agent's steps are written down.
    // The approvals arrive separately from the agent switches, so this one line is
    // refreshed whenever the menu's counts are (refreshAgentGlanceLinks): it must never
    // say "nothing is waiting" while the menu shows a number.
    function glanceLinksNode(){
      const waiting = Number(getPageBadgeCount('approvalsPanel')) || 0, diary = document.getElementById('agentDiaryHost');
      return h('p', { class: 'hint u-mt-0 agentGlanceLinks', 'data-glanceapprovals': String(waiting), 'data-glancesig': waiting + '|' + (diary ? 'd' : 'n') },
        waiting ? h('b', null, waiting + (waiting === 1 ? ' request is' : ' requests are') + ' waiting for your approval. ') : 'Nothing is waiting for your approval. ',
        h('button', { type: 'button', class: 'small secondary', 'data-glancego': 'approvalsPanel' }, 'Open Approval Queue'), ' ',
        diary ? h('button', { type: 'button', class: 'small secondary', 'data-glancediary': '1' }, 'See what each agent did')
          : h('span', { 'data-glancenodiary': '1' }, 'The step-by-step record of what each agent did is the Agent diary; turn it on under Feature Flags.'));
    }
    function refreshAgentGlanceLinks(){
      const old = document.querySelector('#agentGlanceHost .agentGlanceLinks'); if (!old) return;
      const waiting = Number(getPageBadgeCount('approvalsPanel')) || 0, diary = document.getElementById('agentDiaryHost');
      if (old.getAttribute('data-glancesig') === waiting + '|' + (diary ? 'd' : 'n')) return;     // nothing changed: leave it (and any keyboard focus) alone
      const held = old.contains(document.activeElement) ? (document.activeElement.getAttribute('data-glancego') ? '[data-glancego]' : '[data-glancediary]') : null;
      const fresh = glanceLinksNode();
      old.replaceWith(fresh);
      if (held) { const again = fresh.querySelector(held) || fresh.querySelector('[data-glancego]'); if (again) again.focus({ preventScroll: true }); }
    }
    function renderAgentGlance(){
      const G = (window.HE && window.HE.views && window.HE.views['he-agents-glance']) || null;
      const panel = document.getElementById('aiPanel');
      if (!G || !panel) return;
      let host = document.getElementById('agentGlanceHost');
      if (!host) { const lead = panel.querySelector('p.hint'); if (!lead) return; host = h('div', { id: 'agentGlanceHost', class: 'agentGlance' }); lead.after(host); }
      const rows = AGENT_REGISTRY.map(a => {
        const ctrl = agentControlsByNum[a.num];
        const truth = agentTruth(a, ctrl);
        return { num: a.num, name: a.name, truthKey: truth.key, label: truth.label, cls: truth.cls,
          ran: a.dashboardOnly ? 'each time this page opens' : G.lastRan(ctrl && ctrl.last_run_at) };
      });
      const sum = G.summarise(rows);
      host.replaceChildren(
        h('h3', { class: 'u-m-18-0-6 u-fs-15' }, 'Agents at a glance'),
        h('p', { class: 'hint u-mt-0', 'data-glancesum': [sum.on, sum.paused, sum.off, sum.look].join('/') }, sum.line + '. To pause or restart one, press "Its switch": it takes you to that agent below.'),
        glanceLinksNode(),
        h('ul', { class: 'agentGlanceList' }, rows.map(r => h('li', { class: 'agentGlanceRow', 'data-glance': r.num, 'data-glancestate': G.bucketOf(r.truthKey) },
          h('span', { class: 'agentGlanceName' }, '#' + r.num + ' ' + r.name),
          h('span', { class: 'badge ' + r.cls }, r.label),
          h('span', { class: 'agentGlanceRan' }, 'Last ran: ' + r.ran),
          h('button', { type: 'button', class: 'small secondary', 'data-agentjump': r.num, 'aria-label': 'Go to the switch of ' + r.name }, 'Its switch')))),
        // approved, not running yet: kept apart so they are never counted as working
        h('details', { class: 'agentPlanned u-mt-8', 'data-planned': String(G.PLANNED.length) },
          h('summary', null, G.PLANNED.length + ' more agents approved, not running yet'),
          h('p', { class: 'hint u-mt-6' }, 'You approved these on November 24. None of them runs or sends anything yet; each line says what exists today. An agent moves to the list above only when it really runs.'),
          h('ul', { class: 'agentGlanceList' }, G.PLANNED.map(a => h('li', { class: 'agentPlannedRow', 'data-plannedagent': a.key },
            h('div', { class: 'agentGlanceName' }, a.name),
            h('div', null, a.what),
            h('div', { class: 'agentGlanceRan' }, 'Sends: ' + a.sends),
            h('div', { class: 'agentGlanceRan' }, 'Now: ' + a.now))))));
    }
    document.addEventListener('click', (e) => {
      const go = e.target.closest('#agentGlanceHost [data-glancego]');
      if (go) { showPage(go.getAttribute('data-glancego')); return; }
      if (e.target.closest('#agentGlanceHost [data-glancediary]')) {
        const d = document.getElementById('agentDiaryHost'); if (!d) return;
        d.scrollIntoView({ block: 'start' }); d.setAttribute('tabindex', '-1'); d.focus({ preventScroll: true });
        return;
      }
      const b = e.target.closest('#agentGlanceHost [data-agentjump]'); if (!b) return;
      const card = document.querySelector('#agentRegistryWrap [data-agent="' + CSS.escape(b.getAttribute('data-agentjump')) + '"]'); if (!card) return;
      card.scrollIntoView({ block: 'center' });
      const sw = card.querySelector('input.agentToggle');
      if (sw && !sw.disabled) sw.focus({ preventScroll: true });
      else { card.setAttribute('tabindex', '-1'); card.focus({ preventScroll: true }); }
    });
    function renderAgentRegistry(){
      renderAgentGlance();
      // EXT20G: built as DOM nodes (h() text-ifies) instead of an HTML string;
      // same classes, data-* and switch wiring, safe under Trusted Types.
      document.getElementById('agentRegistryWrap').replaceChildren(...AGENT_REGISTRY.map(a => {
        const ctrl = agentControlsByNum[a.num];
        const truth = agentTruth(a, ctrl);
        // The switch only shows a position the dashboard actually read.
        const switchKnown = agentControlsState === 'ok' && !!ctrl;
        const enabled = switchKnown && ctrl.enabled !== false;
        const info = [
          h('b', null, `#${a.num} — ${a.name}`), ' ',
          h('span', { class: 'badge agentTruthBadge ' + truth.cls }, truth.label), ' ',
          a.ai ? h('span', { class: 'badge sev-medium' }, 'Uses a paid AI model') : h('span', { class: 'badge sev-low' }, 'Rule-based — no AI model'), ' ',
          a.enforced ? h('span', { class: 'badge sev-low' }, 'Switch enforced') : h('span', { class: 'badge sev-medium' }, 'Switch not yet enforced'),
        ];
        if (truth.detail) info.push(h('div', { class: 'agentTruthDetail u-fs-12p5 u-mt-4' }, truth.detail));
        info.push(h('div', { class: 'u-c-muted u-fs-12 u-mt-2' }, a.status));
        info.push(h('div', { class: 'u-mt-6' }, a.desc));
        info.push(h('div', { class: 'u-mt-6 u-fs-12p5 u-c-muted' }, h('b', null, 'Touches:'), ' ' + a.touches.join(', ')));
        info.push(h('div', { class: 'u-mt-6 u-fs-12p5' }, h('b', null, "Can't do alone:"), ' ' + a.limit));
        if (ctrl && ctrl.updated_at) info.push(h('div', { class: 'u-mt-6 u-fs-12 u-c-muted' }, 'Last changed ' + (ctrl.who ? 'by ' + ctrl.who + ' ' : '') + 'on ' + new Date(ctrl.updated_at).toLocaleString()));
        const jobHealth = agentJobHealthNode(a, ctrl);
        if (jobHealth) info.push(jobHealth);
        return h('div', { class: 'deletedRow u-ai-flex-start', 'data-agent': a.num, 'data-truth': truth.key },
          h('div', { class: 'info u-flex-1' }, ...info),
          h('label', { class: 'switch', title: !switchKnown ? 'Switch position unknown — it could not be read' : (enabled ? 'On — click to pause this agent' : 'Off — click to turn this agent back on') },
            h('input', { type: 'checkbox', class: 'agentToggle', 'data-num': a.num, 'data-name': a.name, checked: enabled, disabled: !switchKnown }),
            h('span', { class: 'slider' })));
      }));

      document.querySelectorAll('.agentToggle').forEach(cb => {
        cb.addEventListener('change', async () => {
          const num = Number(cb.getAttribute('data-num'));
          const name = cb.getAttribute('data-name');
          const newVal = cb.checked;
          // Same pattern as the other switches on this dashboard: flip it back
          // visually until the password confirmation actually goes through.
          cb.checked = !newVal;
          const ok = await requireReauth(newVal ? `turn ${name} back ON` : `pause ${name}`);
          if (!ok) return;
          cb.checked = newVal;
          cb.disabled = true;
          try {
            const uid = await currentUserId();
            // Only flips the switch this page showed: a stale page can't undo
            // a pause made elsewhere (or by Emergency / No AI mode).
            const changed = await updateIfUnchanged('agent_controls', { agent_num: num },
              { enabled: newVal, updated_by: uid, updated_at: new Date().toISOString() },
              // The page shows a switch as on unless it is exactly false.
              { enabled: newVal ? false : { notIs: false } });
            if (changed) toast((newVal ? 'Turned on: ' : 'Paused: ') + name);
            else showDashError(staleMessage('That agent switch'));
            await loadAgentControls();
          } catch (err) {
            cb.checked = !newVal;
            const msg = (err && err.message) || String(err);
            if (/row-level security|permission/i.test(msg)) {
              showDashError('Only the Owner or an Administrator can pause an agent.');
            } else {
              showDashError('Could not change that agent: ' + msg);
            }
          } finally {
            cb.disabled = false;
          }
        });
      });
    }

    async function loadAgentControls(){
      try {
        const { data: rows, error } = await supabase
          .from('agent_controls')
          .select('agent_num, enabled, updated_by, updated_at, last_run_at, last_run_status, last_run_summary, last_error');
        if (error) throw error;

        const byId = Object.create(null);
        (rows || []).forEach(r => { byId[r.agent_num] = r; });

        const uids = [...new Set((rows || []).map(r => r.updated_by).filter(Boolean))];
        if (uids.length) {
          // EXT19: profiles has display_name (Query A), not full_name: asking for
          // full_name failed, so "changed by" never showed a name.
          const { data: people } = await supabase.from('profiles').select('id, display_name, email').in('id', uids);
          const nameById = Object.create(null);
          (people || []).forEach(p => { nameById[p.id] = p.display_name || p.email; });
          Object.values(byId).forEach(r => { r.who = r.updated_by ? nameById[r.updated_by] : null; });
        }

        // Job health for agents migrated to pg_cron: whether the scheduled
        // job itself is still active in Supabase, alongside the last-run
        // columns above (which every migrated agent's own function writes
        // on every run). Best-effort — an agent still on GitHub Actions has
        // no cron job to find, and that's expected, not an error.
        try {
          const { data: cronRows, error: cronErr } = await supabase.rpc('get_agent_cron_status');
          if (!cronErr && cronRows) {
            cronJobStatusByName = Object.create(null);
            cronRows.forEach(j => { cronJobStatusByName[j.jobname] = j; });
            cronJobState = 'ok';
          } else cronJobState = 'failed';
        } catch (cronCatchErr) {
          cronJobState = 'failed';
          console.warn('Could not load cron job status:', cronCatchErr && cronCatchErr.message ? cronCatchErr.message : cronCatchErr);
        }

        agentControlsByNum = byId;
        agentControlsState = 'ok';
        renderAgentRegistry();
        renderPausedAgentsBanner();
      } catch (err) {
        // Not fatal, but never pretend: every agent shows UNKNOWN and the
        // switches are disabled until they can be read.
        console.warn('Could not load agent controls:', err && err.message ? err.message : err);
        agentControlsState = 'failed';
        agentControlsByNum = Object.create(null);
        if (document.getElementById('agentRegistryWrap')) renderAgentRegistry();
        renderPausedAgentsBanner();
      }
    }

    // A paused agent is easy to forget once you've left the AI Agent Activity
    // page — this puts a quiet reminder at the top of every page, the same
    // way the System Mode banner does, so it can't get lost.
    function renderPausedAgentsBanner(){
      const banner = document.getElementById('pausedAgentsBanner');
      if (!banner) return;
      if (agentControlsState === 'failed') {
        banner.style.display = 'block';
        banner.textContent = 'Agent switches could not be read — the dashboard cannot tell which agents are on. See AI Agent Activity.';
        return;
      }
      const paused = AGENT_REGISTRY
        .filter(a => agentControlsByNum[a.num] && agentControlsByNum[a.num].enabled === false);
      if (!paused.length) {
        banner.style.display = 'none';
        return;
      }
      banner.style.display = 'block';
      // Only say "genuinely paused" for the agents whose own code actually
      // checks this switch (see AGENT_REGISTRY's enforced flag) — anything
      // else is still just a recorded intent, not a real stop, and the
      // banner should never claim more than is actually true.
      if (paused.length === 1) {
        const a = paused[0];
        banner.textContent = a.enforced
          ? `Agent paused: #${a.num} ${a.name} — genuinely paused, its own code checks this before doing anything.`
          : `Agent paused: #${a.num} ${a.name} — recorded, but see AI Agent Activity for what that does and doesn't stop today.`;
      } else {
        const parts = paused.map(a => `#${a.num} ${a.name}${a.enforced ? '' : ' (recorded only, not yet enforced)'}`);
        banner.textContent = `${paused.length} agents paused: ${parts.join(', ')} — see AI Agent Activity for what each one does and doesn't stop.`;
      }
    }

  return { agentControls, agentTruth, loadAgentControls, refreshAgentGlanceLinks };
});
