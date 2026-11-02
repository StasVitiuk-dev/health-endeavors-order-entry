// Dashboard page logic (EXT10b, U46/M5b: moved out of dashboard.html so the page's
// Content-Security-Policy no longer needs 'unsafe-inline' for scripts).
(function(){
  // The pinned library did not load (offline, or altered bytes refused): say so plainly.
  if (!window.supabase) {
    const p = document.createElement('p');
    p.id = 'libraryError'; p.setAttribute('role', 'alert');
    p.style.cssText = 'margin:16px;padding:12px;border:1px solid #d70015;border-radius:8px;color:#d70015;';
    p.textContent = "This page couldn't load a required file. Check your internet connection and reload the page.";
    document.body.insertBefore(p, document.body.firstChild);
    return;
  }
  const SUPABASE_URL = "https://uizrazyehilyzmwttsrn.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_n0sEzZK0JMtwgk280a3YXA_zxtnheqj";
  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  // Signed out in another tab: reload into the signed-out view instead of
  // staying on a page whose requests now go out without a sign-in (EXT3).
  sb.auth.onAuthStateChange(event => {
    const app = document.getElementById('app');
    if (event === 'SIGNED_OUT' && app && app.style.display === 'block') window.location.reload();
  });

  // Turns text from the database into plain text before it is placed on the
  // page, so a name or message containing <, >, & or quotes is shown as
  // written instead of being treated as page code. Same helper as
  // owner-login.html.
  // Plain words instead of raw database / browser text (EXT3, 2026-10-06).
  function plainError(err){
    const m = String((err && err.message) || err || '');
    if (/Failed to fetch|Load failed|NetworkError/i.test(m)) return 'the connection dropped. Check you are online and reload the page.';
    if (/row-level security|permission denied|42501/i.test(m)) return 'your account is not allowed to see this.';
    if (/JWT expired|PGRST301/i.test(m)) return 'your sign-in has expired. Sign in again.';
    return m.replace(/ for (table|relation) "[^"]*"/gi, '').replace(/ constraint "[^"]*"/gi, ' rule');
  }
  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function fmtTime(iso) {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function statClass(value, warnAt, dangerAt) {
    if (dangerAt !== undefined && value >= dangerAt) return 'danger';
    if (warnAt !== undefined && value >= warnAt) return 'warn';
    return '';
  }

  function renderStats(row) {
    const stats = [
      { label: 'System mode', value: row.system_mode ?? '—' },
      { label: 'Open incidents', value: row.open_incidents ?? 0, cls: statClass(row.open_incidents ?? 0, 1, 3) },
      { label: 'Critical incidents', value: row.critical_incidents ?? 0, cls: statClass(row.critical_incidents ?? 0, 1, 1) },
      { label: 'Open tasks', value: row.open_tasks ?? 0 },
      { label: 'Overdue tasks', value: row.overdue_tasks ?? 0, cls: statClass(row.overdue_tasks ?? 0, 1, 3) },
      { label: 'Open alerts', value: row.open_alerts ?? 0, cls: statClass(row.open_alerts ?? 0, 1, 3) },
      { label: 'Security changes (24h)', value: row.security_changes_last_24h ?? 0 },
      { label: 'Profile changes (7d)', value: row.profile_changes_last_7d ?? 0 },
    ];
    const grid = document.getElementById('stat-grid');
    grid.innerHTML = stats.map(s => `
      <div class="stat">
        <p class="stat-label">${esc(s.label)}</p>
        <p class="stat-value ${s.cls || ''}">${esc(s.value)}</p>
      </div>
    `).join('');
  }

  function renderActivity(rows) {
    const list = document.getElementById('activity-list');
    if (!rows || rows.length === 0) {
      list.replaceChildren(Object.assign(document.createElement('div'), { className: 'empty', textContent: 'Nothing yet — this fills in as incidents, tasks, and alerts happen.' }));
      return;
    }
    list.innerHTML = rows.map(r => `
      <div class="activity-row">
        <span class="badge">${esc(r.item_type)}</span>
        <span>${esc(r.label)}</span>
        <span class="activity-status">${esc(r.status)}</span>
        <span class="activity-time">${fmtTime(r.created_at)}</span>
      </div>
    `).join('');
  }

  async function loadDashboard() {
    const { data: summaryRows, error: summaryErr } = await sb
      .from('owner_dashboard_summary')
      .select('*')
      .single();

    if (summaryErr) {
      document.getElementById('stat-grid').innerHTML = `<div class="error">Couldn't load summary: ${esc(plainError(summaryErr))}</div>`;
    } else {
      renderStats(summaryRows);
    }

    const { data: activityRows, error: activityErr } = await sb
      .from('owner_dashboard_recent_activity')
      .select('*');

    if (activityErr) {
      document.getElementById('activity-list').innerHTML = `<div class="error">Couldn't load activity: ${esc(plainError(activityErr))}</div>`;
    } else {
      renderActivity(activityRows);
    }
  }
  function startOfMonthISO() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
  }

  async function fetchAiSpendCap() {
    const { data } = await sb
      .from('business_rules')
      .select('config')
      .eq('rule_key', 'ai_monthly_spend_cap_usd')
      .eq('is_active', true)
      .maybeSingle();
    if (data && data.config && data.config.cap_usd) {
      return Number(data.config.cap_usd);
    }
    return 30;
  }

  async function fetchAiSpendRows() {
    const { data, error } = await sb
      .from('ai_decision_log')
      .select('*')
      .gte('created_at', startOfMonthISO())
      .gt('cost_usd', 0)
      .order('created_at', { ascending: false });
    if (error) return [];
    return data || [];
  }

  function renderAiSpend(rows, cap) {
    const total = rows.reduce((sum, r) => sum + Number(r.cost_usd || 0), 0);
    const pct = cap > 0 ? Math.min((total / cap) * 100, 100) : 0;
    let barClass = '';
    if (total >= cap) barClass = 'danger';
    else if (pct >= 70) barClass = 'warn';

    document.getElementById('ai-spend-summary').innerHTML = `
      <div class="ai-spend-numbers">
        <span>$${total.toFixed(2)} spent this month</span>
        <span>$${cap.toFixed(2)} cap</span>
      </div>
      <div class="ai-spend-bar-track">
        <div class="ai-spend-bar-fill ${barClass}"></div>
      </div>
    `;
    // EXT16: set through the CSS object model (allowed by style-src 'self'); an inline style in markup is blocked
    const fill = document.querySelector('#ai-spend-summary .ai-spend-bar-fill');
    if (fill) fill.style.width = Math.max(0, Math.min(100, Number(pct) || 0)) + '%';

    const list = document.getElementById('ai-spend-list');
    if (!rows || rows.length === 0) {
      list.replaceChildren(Object.assign(document.createElement('div'), { className: 'empty', textContent: 'No AI costs recorded yet this month.' }));
      return;
    }
    list.innerHTML = rows.slice(0, 10).map(r => `
      <div class="activity-row">
        <span class="badge">${esc(r.agent_key)}</span>
        <span>${esc(r.output_summary)}</span>
        <span class="activity-status">$${Number(r.cost_usd).toFixed(2)}</span>
        <span class="activity-time">${fmtTime(r.created_at)}</span>
      </div>
    `).join('');
  }

  async function loadAiSpend() {
    const [cap, rows] = await Promise.all([fetchAiSpendCap(), fetchAiSpendRows()]);
    renderAiSpend(rows, cap);
  }

  async function init() {
    const { data: { session } } = await sb.auth.getSession();
    document.getElementById('loading').style.display = 'none';

    if (!session || !session.user) {
      document.getElementById('signed-out').style.display = 'block';
      return;
    }

    document.getElementById('app').style.display = 'block';
    document.getElementById('user-email').textContent = session.user.email || '';
    document.getElementById('sign-out-btn').addEventListener('click', async () => {
      await sb.auth.signOut();
      window.location.href = './';
    });

    loadDashboard();    loadAiSpend();
  }

  init();
})();
