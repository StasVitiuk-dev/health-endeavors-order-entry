// Pure helpers for owner-login.html: formatting, totals, status rules.
// No DOM, no Supabase, no shared state — so they can be read, tested and
// changed on their own. Loaded (with ?v=<content hash>) before the page's
// main script; the page takes them from window.HE.helpers.
// Moved here unchanged from owner-login.html on 2026-10-05 (modularization
// step 2). Unit tests: tests/specs/helpers-unit.spec.js, refund-policy.spec.js.
(function () {
  'use strict';

    // ---------- small helpers ----------
    function esc(s){
      if (s === null || s === undefined) return '';
      // Bidi override/isolate controls (U+202A–202E, U+2066–2069) are dropped:
      // they can make text display reversed ("invoice\u202Efdp.exe" shows as
      // "invoiceexe.pdf") and have no use in business data (SE-09).
      return String(s).replace(/[\u202A-\u202E\u2066-\u2069]/g, '')
        .replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }

    // One CSV cell, quoted. Spreadsheet apps run a cell that starts with
    // = + - @ (or a tab / line break) as a formula, so text like a vendor or
    // person name starting with one of those gets a leading apostrophe and is
    // shown as plain text. Plain numbers and money amounts (including
    // negatives like -$20.00) are left exactly as they are.
    function csvCell(c){
      let s = String(c === null || c === undefined ? '' : c);
      if (/^[=+\-@\t\r]/.test(s) && !/^[-+]?\$?[\d,]+(\.\d+)?%?$/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    }

    function fmtMoney(amount, currency){
      // Round to whole cents first, and never show "-$0.00": a total that is
      // really zero can come out as -0.00000000000000005 in floating point
      // (0.30 − (0.10 + 0.20)), which the formatter prints with a minus (EXT6).
      // (toPrecision(15) first, so 12.345 → 1234.5 → $12.35, not 1234.4999… → $12.34)
      // Half a cent rounds away from zero, as the currency formatter itself does.
      const c = Number((Number(amount || 0) * 100).toPrecision(15));
      let n = Math.sign(c) * Math.round(Math.abs(c)) / 100;
      if (n === 0 || !isFinite(n)) n = 0;
      try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(n);
      } catch (e) {
        return '$' + n.toFixed(2);
      }
    }

    const CLOSED_WORDS = ['done','complete','completed','resolved','closed','cancelled','canceled','denied','rejected','approved','fulfilled'];

    function isClosedStatus(status){
      if (!status) return false;
      return CLOSED_WORDS.includes(String(status).toLowerCase());
    }

    function isOverdue(due_at, status){
      if (!due_at) return false;
      if (isClosedStatus(status)) return false;
      return new Date(due_at).getTime() < Date.now();
    }

    // Rules whose number must be a whole number inside a range before it can be
    // saved. Checked in the browser before the password prompt, so a bad value
    // never reaches the database or the agents that read it. Only the shipping
    // delay rule is listed for now; others can be added with one line each.
    const BUSINESS_RULE_WHOLE_NUMBER_LIMITS = {
      shipping_delay_threshold_days: { key: 'days', min: 1, max: 365 },
    };

    // Returns an error message if newConfig breaks that rule's limits, or '' if it's fine.
    function businessRuleValueError(ruleKey, label, newConfig){
      const lim = BUSINESS_RULE_WHOLE_NUMBER_LIMITS[ruleKey];
      if (!lim) return '';
      const v = (newConfig && typeof newConfig === 'object' && !Array.isArray(newConfig)) ? newConfig[lim.key] : undefined;
      if (typeof v !== 'number' || !Number.isInteger(v) || v < lim.min || v > lim.max) {
        return '"' + label + '" must be a whole number from ' + lim.min + ' to ' + lim.max + '. Nothing was saved.';
      }
      return '';
    }

    function fmtAccountNumber(n){
      const s = String(n || '');
      return s.length === 9 ? `${s.slice(0,3)}-${s.slice(3,6)}-${s.slice(6)}` : s;
    }

    // ilike treats % and _ as wildcards. Escape them so a typed lot number
    // like "A_1" only ever matches "A_1" (any letter case), never "AB1".
    function likeLiteral(text){
      return String(text).replace(/[\\%_]/g, ch => '\\' + ch);
    }

    function poLinesTotal(po){
      return (po.purchase_order_items || [])
        .reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unit_cost || 0), 0);
    }

    // Rounded to whole cents: this amount is saved as the delivery's expense,
    // and 3 x 0.10 in floating point is 0.30000000000000004 (EXT4). A unit
    // cost with fractions of a cent (0.125) still adds up exactly per line.
    function poGrandTotal(po){
      return Math.round((poLinesTotal(po) + Number(po.shipping_cost || 0) + Number(po.tax || 0)) * 100) / 100;
    }

    function timeAgo(iso){
      if (!iso) return null;
      const ms = Date.now() - new Date(iso).getTime();
      const mins = Math.round(ms / 60000);
      if (mins < 1) return 'just now';
      if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
      const hours = Math.round(mins / 60);
      if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
      const days = Math.round(hours / 24);
      return `${days} day${days === 1 ? '' : 's'} ago`;
    }

    function startOfWeekMonday(d){
      const day = d.getDay(); // 0=Sun..6=Sat
      const diff = (day === 0 ? -6 : 1) - day; // shift back to Monday
      const monday = new Date(d);
      monday.setDate(d.getDate() + diff);
      monday.setHours(0, 0, 0, 0);
      return monday;
    }

    // Adds up daily_reports rows into weekly or monthly buckets. Reused for
    // both views — only the grouping key/label functions differ.
    function rollupReports(reports, keyFn, labelFn){
      const groups = new Map();
      reports.forEach(r => {
        const d = new Date(r.report_date + 'T00:00:00');
        const key = keyFn(d);
        if (!groups.has(key)) {
          groups.set(key, {
            sortKey: key, label: labelFn(d), currency: r.currency || 'USD',
            orders_count: 0, revenue: 0, new_inquiries_count: 0,
            tasks_opened_count: 0, incidents_opened_count: 0,
            ai_calls_count: 0, ai_cost: 0,
          });
        }
        const g = groups.get(key);
        g.orders_count += Number(r.orders_count || 0);
        g.revenue += Number(r.revenue || 0);
        g.new_inquiries_count += Number(r.new_inquiries_count || 0);
        g.tasks_opened_count += Number(r.tasks_opened_count || 0);
        g.incidents_opened_count += Number(r.incidents_opened_count || 0);
        g.ai_calls_count += Number(r.ai_calls_count || 0);
        g.ai_cost += Number(r.ai_cost || 0);
      });
      return Array.from(groups.values()).sort((a, b) => b.sortKey.localeCompare(a.sortKey));
    }

    // Session & Device Management: turns Supabase's own built-in login-session
    // tracking into something visible and controllable in the dashboard, so a
    // login you don't recognize can be spotted and logged out remotely.
    // Reads a friendly guess at the device/browser from the raw user-agent string
    // Supabase already records — this is a simple heuristic, not exact for every
    // possible browser, but good enough to recognize your own devices at a glance.
    function deviceLabel(ua){
      if (!ua) return 'Unknown device';
      const device = /iPhone/i.test(ua) ? 'iPhone'
        : /iPad/i.test(ua) ? 'iPad'
        : /Android/i.test(ua) ? 'Android device'
        : /Macintosh/i.test(ua) ? 'Mac'
        : /Windows/i.test(ua) ? 'Windows PC'
        : 'Device';
      const browser = /Edg\//.test(ua) ? 'Edge'
        : (/Chrome\//.test(ua) && !/Chromium/.test(ua)) ? 'Chrome'
        : (/Safari\//.test(ua) && !/Chrome\//.test(ua)) ? 'Safari'
        : /Firefox\//.test(ua) ? 'Firefox'
        : '';
      return browser ? `${device} · ${browser}` : device;
    }

    // Adverse Event Reports (FDA / MoCRA)
    function fmtDateOnly(dateStr){
      if (!dateStr) return '—';
      const d = new Date(dateStr + 'T00:00:00');
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }

    // ---------- Returns (tied to Orders, Order Items, and Inventory) ----------
    // Schema note (verified directly against the real table on September 21,
    // 2026, after the first version of this page was found to be built
    // against an assumed schema that didn't match reality): returns links to
    // a specific order_item (its full quantity — no partial-quantity
    // returns), not directly to a product. Its real status flow is
    // requested -> approved/rejected -> received -> refunded -> closed.
    // order_items has no product_id (only sku/product_name copied in at the
    // time of the order), so the automatic Inventory restock below looks up
    // the matching product by SKU. `disposition` is a small additive column
    // added purely to drive that restock — it isn't otherwise part of the
    // original table.
    // The most that can sensibly be refunded for one return: the value of the
    // order line it is for (line_total, or quantity × unit_price). Empty when
    // the line has no price on file, in which case no cap is applied.
    function returnLineValue(item){
      if (!item) return '';
      if (item.line_total !== null && item.line_total !== undefined && item.line_total !== '') return String(Number(item.line_total));
      if (item.unit_price !== null && item.unit_price !== undefined && item.quantity !== null && item.quantity !== undefined) {
        return String(Math.round(Number(item.unit_price) * Number(item.quantity) * 100) / 100);
      }
      return '';
    }

    // Looks for keywords in the status text instead of one exact hardcoded
    // string — safer than guessing exactly how Shopify's sync will spell a
    // status, since no real orders exist yet to check against.
    function classifyOrderStatus(status){
      const s = (status || '').toLowerCase();
      const isCancelled = s.includes('cancel');
      const isRefund = s.includes('refund');
      const isPartialRefund = isRefund && s.includes('partial');
      return { isCancelled, isRefund, isPartialRefund };
    }

    function refundsToSubtract(orders, returnRefunds, policy){
      if (policy !== 'subtract_return_refunds') return 0;
      const excludedIds = new Set((orders || []).filter(o => {
        const c = classifyOrderStatus(o.status);
        return c.isCancelled || (c.isRefund && !c.isPartialRefund);
      }).map(o => o.id));
      return (returnRefunds || []).reduce((sum, r) =>
        excludedIds.has(r.order_id) ? sum : sum + Number(r.refund_amount || 0), 0);
    }

    // Reuses expenses' own existing category list (see the expenses_category_check
    // constraint) rather than inventing a new one. The COGS/Operating split is a
    // starting point for your accountant, not a filed tax position.
    const TAX_CATEGORY_MAP = {
      ingredients:       { group: 'cogs', label: 'Ingredients' },
      packaging:         { group: 'cogs', label: 'Packaging' },
      manufacturing:     { group: 'cogs', label: 'Manufacturing' },
      shipping_supplies: { group: 'operating', label: 'Shipping Supplies' },
      advertising:       { group: 'operating', label: 'Advertising' },
      software:          { group: 'operating', label: 'Software' },
      other:             { group: 'operating', label: 'Other' },
    };

  window.HE = window.HE || {};

    // ---------- moved from owner-login.html on 2026-10-06 (modularization step 3) ----------
    // A browser-level network failure (no reply at all). The request may or
    // may not have reached the database, so the honest advice is "check
    // before retrying", not "try again".
    function isNetworkError(err){
      const m = String((err && err.message) || err || '');
      return /Failed to fetch|NetworkError|Load failed|network|connection/i.test(m) && !(err && err.code);
    }

    // Guard for an on/off column as the page showed it: "on" must still be
    // true; "off" may be false or empty (null).
    function boolGuard(shownOn){ return shownOn ? true : { notIs: true }; }

    // An update/delete that row-level security refuses doesn't error: it
    // just changes nothing. Ask for the changed rows back (.select('id')) and
    // call this, so the page never says "done" when nothing was done.
    function noRowsChanged(data){ return !data || (Array.isArray(data) && data.length === 0); }

    function staleMessage(what){
      return (what || 'That item') + ' was already changed — by someone else, another tab or an agent — or you don\'t have permission to change it. Nothing was overwritten; the list has been refreshed.';
    }

    // Database refusals arrive as technical text ("new row violates
    // row-level security policy for table …", "violates check constraint
    // …", "JWT expired"). Replace the internal part (table, policy and
    // constraint names) with plain words, and say what it means.
    function explainDbError(text){
      let t = String(text == null ? '' : text);
      const isPermission = /row-level security|permission denied for|insufficient_privilege/i.test(t);
      t = t.replace(/new row violates row-level security policy( for table "[^"]*")?/gi, 'not permitted')
           .replace(/permission denied for (table|relation|function|schema|sequence) "?[\w.]+"?/gi, 'not permitted')
           .replace(/(new row for relation "[^"]*" )?violates check constraint "[^"]*"/gi, 'a value the database does not accept')
           .replace(/violates foreign key constraint "[^"]*"( on table "[^"]*")?/gi, 'it is still linked to other records')
           .replace(/duplicate key value violates unique constraint "[^"]*"/gi, 'that value is already used by another record');
      if (isPermission && !/only the Owner or an Administrator/i.test(t)) {
        return t + ' — You don’t have permission for this; only the Owner or an Administrator can do it. Nothing was changed by this step.';
      }
      if (/JWT expired|invalid JWT|PGRST301/i.test(t) && !/sign in again/i.test(t)) {
        return t + ' — Your sign-in has expired. Sign in again, then retry.';
      }
      // A dropped connection ("Failed to fetch" in Chrome, "Load failed" in
      // Safari, "NetworkError" in Firefox) says nothing about whether the
      // database already saved the change. Say so plainly instead of the raw
      // browser text, so nobody assumes "not saved" and does it twice (EXT3).
      if (/Failed to fetch|Load failed|NetworkError when attempting to fetch/i.test(t) && !/may or may not|cannot tell whether/i.test(t)) {
        return t.replace(/:?\s*(TypeError:\s*)?(Failed to fetch|Load failed|NetworkError when attempting to fetch resource\.?)/i, '')
          + ' — The connection dropped before the dashboard heard back, so it cannot tell whether this was saved. Reload the page and check before trying again.';
      }
      // A gateway or hosting problem (502 / 503 / 504) arrives as a whole web
      // page, and a reply cut off half-way arrives as a fragment of data.
      // Neither says whether the database already saved the change, and the
      // raw text means nothing to a person (EXT4).
      const UNKNOWN = ' so the dashboard cannot tell whether this was saved. Wait a minute, reload the page and check before trying again.';
      const html = t.search(/<!DOCTYPE|<html[\s>]|<head[\s>]|<body[\s>]/i);
      if (html !== -1) {
        return t.slice(0, html).replace(/[\s:—-]+$/, '') + ' — The server sent back an error page instead of an answer (it may be briefly unavailable),' + UNKNOWN;
      }
      const fragment = t.search(/[[{]\s*("|\{|\[|$)/);
      if (fragment !== -1 && !/[\]}]\s*$/.test(t.slice(fragment))) {
        return t.slice(0, fragment).replace(/[\s:—-]+$/, '') + ' — The server’s reply was cut off,' + UNKNOWN;
      }
      // The database gave up on this one step and undid it: two changes
      // collided (deadlock), it waited too long (statement timeout), or the
      // record was busy (lock not available). Unlike a dropped connection,
      // these are certain: the step was NOT saved (EXT6). Earlier steps of a
      // multi-step action are reported by the caller, as before.
      if (/deadlock detected|canceling statement due to (statement|lock) timeout|could not obtain lock on row/i.test(t) && !/try again/i.test(t)) {
        const why = /deadlock/i.test(t) ? 'two changes to the same records collided'
          : /lock timeout|could not obtain lock/i.test(t) ? 'the record was busy with another change'
          : 'the database took too long';
        return t.replace(/:?\s*(ERROR:\s*)?(deadlock detected|canceling statement due to (statement|lock) timeout|could not obtain lock on row in relation "[^"]*")\.?/i, '')
          + ' — The database undid this step because ' + why + '. Nothing was changed by this step. Wait a moment, reload the page and try again.';
      }
      if (/Too Many Requests|rate limit/i.test(t) && !/wait a minute/i.test(t)) {
        return t.replace(/:?\s*Too Many Requests\.?/i, '') + ' — The server is busy right now (too many requests). Nothing was changed by this step. Wait a minute, then try again.';
      }
      return t;
    }

    // Uploads: checked before anything is sent. Web pages, scripts and
    // programs could run code when the stored file is opened, and a very
    // large file would only fail after a long upload.
    const UPLOAD_MAX_BYTES = 50 * 1024 * 1024;
    function uploadProblem(file){
      if (!file) return null;
      // An empty (0-byte) file is almost always a failed download or a broken
      // export; storing it would look like a saved receipt with nothing in it.
      if (file.size === 0) return 'That file is empty (0 bytes), so it was not uploaded. Open it on your computer to check it, then try again. Nothing was saved.';
      if (file.size > UPLOAD_MAX_BYTES) return 'That file is ' + Math.ceil(file.size / 1048576) + ' MB; the limit is 50 MB. Nothing was uploaded.';
      if (/\.(html?|xhtml|svg|js|mjs|php|exe|bat|cmd|sh|msi)$/i.test(file.name || '')) {
        return 'Files of that type (web pages, scripts, programs) can’t be uploaded. Save it as a PDF or an image instead. Nothing was uploaded.';
      }
      return null;
    }


    // ---------- moved from owner-login.html on 2026-10-06 (modularization step 2c) ----------
    // Two-press confirmation for actions that are hard to undo: the first
    // press only re-labels the button; a second press within 4 seconds
    // returns true. Same pattern as product Delete.
    function confirmSecondPress(btn, armedLabel){
      if (btn.dataset.armed === '1') { btn.dataset.armed = '0'; return true; }
      const original = btn.dataset.label || btn.textContent;
      btn.dataset.label = original;
      btn.dataset.armed = '1';
      btn.textContent = armedLabel;
      setTimeout(() => {
        if (btn.dataset.armed === '1') { btn.dataset.armed = '0'; btn.textContent = original; }
      }, 4000);
      return false;
    }

    // Time plus a short random part: two uploads of the same name in the same
    // millisecond (two tabs, a fast retry) no longer collide on one path.
    function uploadStamp(){ return Date.now() + '-' + Math.random().toString(36).slice(2, 8); }

    // A storage-safe file name: letters, digits, dot, dash, underscore only
    // (no slashes, so no folders or "../"), no leading dots, and at most 100
    // characters with the extension kept, so very long names can't make the
    // upload fail at the storage limit.
    function safeStorageName(name){
      let n = String(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.{2,}/g, '.').replace(/_+/g, '_').replace(/^[._]+/, '');
      if (!n || n === '_') n = 'file';
      if (n.length > 100) {
        const dot = n.lastIndexOf('.');
        const ext = dot > 0 && n.length - dot <= 10 ? n.slice(dot) : '';
        n = n.slice(0, 100 - ext.length) + ext;
      }
      return n;
    }

    // One typed number, checked before anything is saved (X3-05/06, 2026-10-06).
    // Returns '' when fine, otherwise a plain sentence saying what is wrong.
    // Blank is refused unless allowBlank (so a blank never silently becomes
    // 0), and "1e400", NaN, negatives (below min), huge values (above max)
    // and fractions (when integer) are refused instead of being saved or
    // silently cut.
    function numberInputError(raw, opts){
      const o = opts || {};
      const label = o.label || 'That value';
      const text = String(raw === null || raw === undefined ? '' : raw).trim();
      if (text === '') return o.allowBlank ? '' : label + ' is empty. Enter a number.';
      const n = Number(text);
      if (!Number.isFinite(n)) return label + ' must be a plain number: digits and one decimal point only (no $, commas, spaces or words), for example 1200.50.';
      const min = o.min === undefined ? 0 : o.min;
      const max = o.max === undefined ? 1e9 : o.max;
      if (o.minExclusive ? n <= min : n < min) return label + (o.minExclusive ? ' must be more than ' : ' cannot be less than ') + min + '.';
      if (n > max) return label + ' is too large (more than ' + max.toLocaleString('en-US') + ').';
      if (o.integer && !Number.isInteger(n)) return label + ' must be a whole number.';
      // Money: at most this many decimal places (2 = whole cents), so a
      // typo like 10.005 is caught instead of saved as a fraction of a cent.
      if (!o.integer && o.decimals !== undefined) {
        const f = Math.pow(10, o.decimals);
        if (Math.abs(Math.round(n * f) - n * f) > 1e-6) return label + (o.decimals === 2 ? ' can only go down to whole cents (2 decimal places).' : ' can have at most ' + o.decimals + ' decimal places.');
      }
      return '';
    }

    // ---- Date ranges (moved from the page, step 2d, EXT3). All use the
    // viewer's own calendar (Central for the business); "now" can be given
    // so tests can pin the date.
    // Today's date (or the given date) as YYYY-MM-DD on the viewer's own
    // calendar. toISOString() gives the UTC date instead, which in US time
    // zones is already "tomorrow" every evening.
    function localDateString(d){
      const t = d || new Date();
      return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
    }
    // Accounting: start of Today / last 7 days / This Month (local midnight), or null for all time.
    function acctRangeStart(range, now){
      now = now || new Date();
      if (range === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (range === 'week') { const d = new Date(now); d.setDate(d.getDate() - 7); return d; }
      if (range === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
      return null; // all time
    }
    // Tax Records: This Year / Last Year as [start, end) at local midnight.
    function taxRangeStart(range, now){
      now = now || new Date();
      if (range === 'year') return { start: new Date(now.getFullYear(), 0, 1), end: null };
      if (range === 'lastyear') return { start: new Date(now.getFullYear() - 1, 0, 1), end: new Date(now.getFullYear(), 0, 1) };
      return { start: null, end: null }; // all time
    }

    // Agent error text can quote an e-mail address or a key from a failed
    // call. Shown on screen (and in screenshots people share), so mask them,
    // the same way Query C does, and cap the length (F3-06, EXT3).
    function maskSensitive(text){
      const t = String(text === null || text === undefined ? '' : text)
        .replace(/[^\s@:;,()<>]+@[^\s@:;,()<>]+/g, '[email]')
        .replace(/[A-Za-z0-9_.=+\/-]{24,}/g, '[token]');
      return t.length > 300 ? t.slice(0, 300) + '…' : t;
    }

    // EXT7: one key per US state for "Sales tax by state". Shopify sends the
    // full name ("California") and a code ("CA"); other sources may send
    // either, in any case or spacing. Grouping by the raw text split one
    // state into several rows. Outside the US: "Ontario (CA)".
    const US_STATE_CODES = {
      ALABAMA:'AL', ALASKA:'AK', ARIZONA:'AZ', ARKANSAS:'AR', CALIFORNIA:'CA', COLORADO:'CO', CONNECTICUT:'CT', DELAWARE:'DE',
      'DISTRICT OF COLUMBIA':'DC', FLORIDA:'FL', GEORGIA:'GA', HAWAII:'HI', IDAHO:'ID', ILLINOIS:'IL', INDIANA:'IN', IOWA:'IA',
      KANSAS:'KS', KENTUCKY:'KY', LOUISIANA:'LA', MAINE:'ME', MARYLAND:'MD', MASSACHUSETTS:'MA', MICHIGAN:'MI', MINNESOTA:'MN',
      MISSISSIPPI:'MS', MISSOURI:'MO', MONTANA:'MT', NEBRASKA:'NE', NEVADA:'NV', 'NEW HAMPSHIRE':'NH', 'NEW JERSEY':'NJ',
      'NEW MEXICO':'NM', 'NEW YORK':'NY', 'NORTH CAROLINA':'NC', 'NORTH DAKOTA':'ND', OHIO:'OH', OKLAHOMA:'OK', OREGON:'OR',
      PENNSYLVANIA:'PA', 'RHODE ISLAND':'RI', 'SOUTH CAROLINA':'SC', 'SOUTH DAKOTA':'SD', TENNESSEE:'TN', TEXAS:'TX', UTAH:'UT',
      VERMONT:'VT', VIRGINIA:'VA', WASHINGTON:'WA', 'WEST VIRGINIA':'WV', WISCONSIN:'WI', WYOMING:'WY', 'PUERTO RICO':'PR',
    };
    const US_CODES = new Set(Object.values(US_STATE_CODES));
    function taxStateKey(addr){
      if (!addr || typeof addr !== 'object') return null;
      const country = String(addr.country_code || '').trim().toUpperCase();
      const code = String(addr.province_code || '').trim().toUpperCase();
      const name = String(addr.province || '').trim().replace(/\s+/g, ' ');
      if (!code && !name) return null;
      if (country && country !== 'US') return (name || code) + ' (' + country + ')';
      if (US_CODES.has(code)) return code;
      const up = name.toUpperCase();
      if (US_CODES.has(up)) return up;
      return US_STATE_CODES[up] || name;
    }

  // Bump API when a helper's name or arguments change, so a page that loaded
  // an older copy refuses to start instead of running mixed code.
  window.HE.helpers = Object.freeze({
    API: 7, // EXT7: taxStateKey added
    esc,
    csvCell,
    fmtMoney,
    fmtDateOnly,
    CLOSED_WORDS,
    isClosedStatus,
    isOverdue,
    classifyOrderStatus,
    refundsToSubtract,
    poLinesTotal,
    poGrandTotal,
    likeLiteral,
    returnLineValue,
    fmtAccountNumber,
    deviceLabel,
    timeAgo,
    startOfWeekMonday,
    rollupReports,
    BUSINESS_RULE_WHOLE_NUMBER_LIMITS,
    businessRuleValueError,
    TAX_CATEGORY_MAP,
    isNetworkError,
    boolGuard,
    noRowsChanged,
    staleMessage,
    explainDbError,
    UPLOAD_MAX_BYTES,
    uploadProblem,
    confirmSecondPress,
    uploadStamp,
    safeStorageName,
    numberInputError,
    localDateString,
    acctRangeStart,
    taxRangeStart,
    maskSensitive,
    taxStateKey,
  });
})();
