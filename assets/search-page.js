// Search page logic (EXT10b, U46/M5b: moved out of search.html so the page's
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

  const typeLabels = {
    customer: 'Customer',
    order: 'Order',
    supplier: 'Supplier',
    inventory_item: 'Inventory'
  };

  function renderResults(rows, term) {
    const box = document.getElementById('results');
    if (!term) {
      box.replaceChildren(Object.assign(document.createElement('div'), { className: 'empty', textContent: 'Start typing to search across customers, orders, suppliers, and inventory.' }));
      return;
    }
    if (!rows || rows.length === 0) {
      box.innerHTML = `<div class="empty">No matches for "${esc(term)}".</div>`;
      return;
    }
    box.innerHTML = rows.map(r => `
      <div class="result-row">
        <span class="badge">${esc(typeLabels[r.result_type] || r.result_type)}</span>
        <div>
          <div class="result-label">${esc(r.label)}</div>
          ${r.subtitle ? `<div class="result-subtitle">${esc(r.subtitle)}</div>` : ''}
        </div>
      </div>
    `).join('');
  }

  let debounceTimer;
  function onSearchInput(e) {
    const term = e.target.value.trim();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      if (!term) {
        renderResults([], '');
        return;
      }
      const { data, error } = await sb.rpc('global_search', { search_term: term });
      if (error) {
        document.getElementById('results').innerHTML = `<div class="error">Search failed: ${esc(plainError(error))}</div>`;
        return;
      }
      renderResults(data, term);
    }, 300);
  }

  async function init() {
    const { data: { session } } = await sb.auth.getSession();
    document.getElementById('loading').style.display = 'none';

    if (!session || !session.user) {
      document.getElementById('signed-out').style.display = 'block';
      return;
    }

    document.getElementById('app').style.display = 'block';
    document.getElementById('search-input').addEventListener('input', onSearchInput);
  }

  init();
})();
