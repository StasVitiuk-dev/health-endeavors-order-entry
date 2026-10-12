// assets/app/he-status.js — system status: environment label, page versions, database-step checks, freshness limits, attention seen-state
// EXT15: moved unchanged out of assets/owner-login-app.js (initApp). Its inputs
// arrive explicitly in ctx; it returns only what other code still uses. Map:
// docs/ops/APPLICATION_MODULE_MAP_EXT15.md. Created once, by the app, in order.
window.HE.modules.define('he-status', { api: 1, needs: ['DB_STEPS','STOCK_FN_PROBES','SUPABASE_URL','stockFunctionInstalled','supabase'] }, function (ctx) {
    const { DB_STEPS, STOCK_FN_PROBES, SUPABASE_URL, stockFunctionInstalled, supabase } = ctx;
    // EXT8: "Checks: what needs a look" (helpers: attentionFindings). Every
    // read settles on its own; a failed one shows as "could not check".
    const ATTN_SEEN_KEY = 'he.attnSeen';
    function attnSeenGet(){ try { return JSON.parse(localStorage.getItem(ATTN_SEEN_KEY) || '{}') || {}; } catch (_) { return {}; } }
    function attnSeenSet(v){ try { localStorage.setItem(ATTN_SEEN_KEY, JSON.stringify(v)); } catch (_) { /* storage blocked: just not remembered */ } }
    const attnSignature = f => f.key + '|' + f.count + '|' + (f.oldest || '');
    const ATTN_STALE_MS = 15 * 60 * 1000;

    // EXT10 (U43): the nightly integrity check (Query F run by the database,
    // drafts/25 + 29) on Home. Read-only. Off / not installed = says so (NOT
    // VERIFIED), never "fine". States per check: PASS (0 found), WARN (stuck
    // work or a probable duplicate), FAIL (a record pointing at the wrong
    // thing or an impossible value). The whole card is STALE when the last
    // successful run is older than NIGHTLY_STALE_MS, FAIL when the last
    // attempt failed, UNKNOWN when it cannot be read.
    const NIGHTLY_STALE_MS = 26 * 60 * 60 * 1000;
    // nightlyCheckLevel / nightlyOverall live in the helpers file (pure, unit-tested).
    const isMissingRelation = err => !!err && (['42P01', 'PGRST205', 'PGRST200'].includes(String(err.code)) || /does not exist|could not find the table/i.test(String(err.message || '')));

    // EXT10b (missions 63-66): read-only System status + a safe diagnostic summary.
    function environmentLabel(){
      if (/staging-demo\.invalid/.test(SUPABASE_URL)) return { key: 'STAGING', text: 'STAGING (synthetic data, not production)' };
      if (location.host === 'stasvitiuk-dev.github.io') return { key: 'PRODUCTION', text: 'PRODUCTION (live dashboard)' };
      return { key: 'OTHER', text: 'NOT PRODUCTION (' + (location.host || 'local file') + ')' };
    }
    function assetVersions(){
      const pick = re => { const el = [...document.querySelectorAll('script[src], link[href]')].map(e => e.getAttribute('src') || e.getAttribute('href')).find(u => re.test(u || '')); const m = el && el.match(/[?&]v=([0-9a-f]+)/); return m ? m[1] : 'unknown'; };
      return 'helpers API ' + window.HE.helpers.API + ', helpers ' + pick(/owner-login-helpers\.js/) + ', styles ' + pick(/owner-login\.css/);
    }
    async function dbStepInstalled(flag){
      if (STOCK_FN_PROBES[flag]) return stockFunctionInstalled(flag);
      try {
        if (flag === 'request_keys') {
          const { error } = await supabase.from('expenses').select('client_request_id').limit(1);
          return !error ? true : (String(error.code) === '42703' || String(error.code) === 'PGRST204' || /client_request_id/.test(error.message || '')) ? false : null;
        }
        const { error } = await supabase.from('integrity_check_runs').select('id').limit(1);
        return !error ? true : isMissingRelation(error) ? false : null;
      } catch (e) { return null; }
    }
    async function dbStepsStatus(){
      const [installed, flagsRes] = await Promise.all([
        Promise.all(DB_STEPS.map(([flag]) => dbStepInstalled(flag))),
        supabase.from('feature_flags').select('flag_key, enabled').in('flag_key', DB_STEPS.map(([f]) => f)).then(r => r, e => ({ error: e })),
      ]);
      const word = v => v === true ? 'installed' : v === false ? 'not installed' : 'UNKNOWN';
      const steps = DB_STEPS.map(([flag, label], i) => label + ': ' + word(installed[i])).join(' · ');
      let safety;
      if (flagsRes.error) safety = 'UNKNOWN — the switches could not be read';
      else {
        const on = new Set((flagsRes.data || []).filter(f => f.enabled === true).map(f => f.flag_key));
        const broken = DB_STEPS.filter(([flag], i) => on.has(flag) && installed[i] === false).map(([, l]) => l);
        const unsure = DB_STEPS.filter(([flag], i) => on.has(flag) && installed[i] === null).map(([, l]) => l);
        safety = broken.length ? 'PROBLEM: switched ON but its database step is missing: ' + broken.join(', ') + '. Turn that switch OFF on Feature Switches and tell the owner.'
          : unsure.length ? 'UNKNOWN: switched ON but the database step could not be confirmed: ' + unsure.join(', ')
          : on.size ? 'OK: every switch that is ON has its database step (' + on.size + ' on)' : 'OK: all of these switches are OFF';
      }
      return { steps, safety };
    }

  return { environmentLabel, assetVersions, isMissingRelation, dbStepsStatus, NIGHTLY_STALE_MS, ATTN_STALE_MS, attnSeenGet, attnSeenSet, attnSignature };
});
