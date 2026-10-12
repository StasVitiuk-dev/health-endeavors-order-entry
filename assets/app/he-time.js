// assets/app/he-time.js — dates and calendar: today and yesterday ranges, date keys, calendar colours, event editor helpers, week and month labels
// EXT15: moved unchanged out of assets/owner-login-app.js (initApp). Its inputs
// arrive explicitly in ctx; it returns only what other code still uses. Map:
// docs/ops/APPLICATION_MODULE_MAP_EXT15.md. Created once, by the app, in order.
window.HE.modules.define('he-time', { api: 1, needs: ['CAL_COLORS','esc'] }, function (ctx) {
    const { CAL_COLORS, esc } = ctx;
    // Business Health strip: a handful of numbers you'd otherwise have to
    // visit 5-6 separate pages to piece together, computed fresh on every
    // landing-page load. Deliberately its own small set of direct queries
    // (rather than waiting on other panels' loaders, which run staggered in
    // the background and might not have populated yet) so these numbers are
    // right the moment the page opens, not a few seconds later. No new
    // tables, no AI calls — same tables every other panel already reads.
    function getTodayRange(){
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { start, end: now };
    }
    const PERSONAL_CAL_HINT = 'Your own calendar — only you can see these events. Add one below, or click an existing event to edit or delete it.';
    function colorForCalendar(name){
      const s = String(name || 'Calendar');
      let h = 0;
      for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
      return CAL_COLORS[h % CAL_COLORS.length];
    }
    function dateKey(d){
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    function eventDateKey(ev){
      // All-day events: use the date exactly as stored (avoids timezone shifting them a day off).
      if (ev.all_day && ev.starts_at) return ev.starts_at.slice(0, 10);
      return dateKey(new Date(ev.starts_at));
    }
    function fmtTimeShort(iso){
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleTimeString(undefined, { hour:'numeric', minute:'2-digit' });
    }
    // Inline editor for a personal (manually-entered) event: change title or
    // times, or delete it. Shown when you click one of your own events.
    function personalEventEditorHtml(ev){
      // EXT9: the values shown, so a save never overwrites a change made elsewhere meanwhile.
      const shown = JSON.stringify({ title: ev.summary == null ? null : ev.summary, starts_at: ev.starts_at || null, ends_at: ev.ends_at || null, all_day: !!ev.all_day });
      return '<div class="calNoteBox" data-personaluid="' + esc(ev.uid) + '" data-shown="' + esc(shown) + '">' +
        '<label style="margin-bottom:4px;">Title</label>' +
        '<input type="text" class="personalEditTitle" value="' + esc(ev.summary || '') + '" style="margin-bottom:10px;">' +
        '<label style="margin-bottom:4px;">Starts</label>' +
        '<input type="datetime-local" class="personalEditStart" value="' + esc(toDatetimeLocalValue(ev.starts_at, ev.all_day)) + '" style="margin-bottom:10px;">' +
        '<label style="margin-bottom:4px;">Ends (optional)</label>' +
        '<input type="datetime-local" class="personalEditEnd" value="' + esc(toDatetimeLocalValue(ev.ends_at, ev.all_day)) + '" style="margin-bottom:10px;">' +
        '<label style="margin:0 0 10px;font-weight:400;display:flex;align-items:center;gap:6px;">' +
          '<input type="checkbox" class="personalEditAllDay" style="width:auto;margin:0;"' + (ev.all_day ? ' checked' : '') + '> All day' +
        '</label>' +
        '<div class="calNoteRow">' +
          '<button type="button" class="small personalEditSave">Save</button>' +
          '<button type="button" class="small secondary personalEditDelete">Delete event</button>' +
        '</div></div>';
    }
    // Turns a stored timestamp into the "YYYY-MM-DDTHH:MM" format that a
    // datetime-local input expects, in your own local time.
    function toDatetimeLocalValue(iso, allDay){
      if (!iso) return '';
      if (allDay) return String(iso).slice(0, 10) + 'T00:00'; // stored as a plain date — don't shift it
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      const pad = n => String(n).padStart(2, '0');
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
        'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    }
    // Turns what's typed into the form into what gets stored. All-day events
    // are stored as midnight UTC on the chosen date, so they never drift a
    // day off (the calendar reads all-day dates exactly as stored).
    function personalTimesFromInputs(startVal, endVal, allDay){
      if (allDay) {
        const s = startVal.slice(0, 10);
        const e = endVal ? endVal.slice(0, 10) : null;
        return { starts_at: s + 'T00:00:00Z', ends_at: e ? e + 'T00:00:00Z' : null };
      }
      return {
        starts_at: new Date(startVal).toISOString(),
        ends_at: endVal ? new Date(endVal).toISOString() : null,
      };
    }

    // Daily Owner Business Health Summary: a live snapshot of yesterday
    // (midnight to midnight, your browser's local time) — nothing new is
    // tracked here, it just totals up what's already in orders, customer
    // inquiries, tasks, incidents, and the AI decision log.
    function getYesterdayRange(){
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfYesterday = new Date(startOfToday);
      startOfYesterday.setDate(startOfYesterday.getDate() - 1);
      return { start: startOfYesterday, end: startOfToday };
    }

    function weekGroupLabel(monday){
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const start = monday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const end = sunday.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      return `${start} – ${end}`;
    }
    function monthGroupLabel(d){
      return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }

  return { getTodayRange, getYesterdayRange, colorForCalendar, dateKey, eventDateKey, fmtTimeShort, personalEventEditorHtml, personalTimesFromInputs, PERSONAL_CAL_HINT, weekGroupLabel, monthGroupLabel };
});
