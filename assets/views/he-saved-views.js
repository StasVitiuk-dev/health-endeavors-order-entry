// #65 Saved views & filters. Pure, synthetic-safe, personal. A person can save
// the current filter set for a list screen (Orders, Wholesale, Inventory) under
// a name, restore it, set a default, rename, delete, and reset the screen.
//
// Design:
//   * PERSONAL & isolated: every key is namespaced by userId, so one person's
//     views are never visible to another (permission by construction).
//   * STORAGE-AGNOSTIC: operates on a tiny { getItem/setItem/removeItem } adapter.
//     In the browser pass localStorage; in tests pass an in-memory object. If
//     storage is unavailable (private window, blocked, mobile quota), every
//     operation degrades gracefully — it never throws and the screen still works.
//   * SAFE DATA: a saved view holds only a plain filter object + metadata; names
//     are trimmed and capped; a per-screen cap bounds how many are kept.
//
// Pure. Dual-mode (Node require + browser HE.views registry).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.views = root.HE.views || {})['he-saved-views'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Screens that support saved views. A view for any other screen is refused.
  const VIEW_PANELS = ['ordersPanel', 'wholesalePanel', 'inventoryPanel'];
  const MAX_VIEWS = 20;        // per person, per screen
  const MAX_NAME = 60;

  // A storage adapter that never throws, wrapping a backing store (localStorage
  // or a plain object). On any failure it reports unavailable and no-ops.
  function safeStorage(backing) {
    const b = backing || null;
    return {
      available: !!b,
      get: function (k) { try { return b ? b.getItem(k) : null; } catch (e) { return null; } },
      set: function (k, v) { try { if (b) { b.setItem(k, v); return true; } } catch (e) {} return false; },
      del: function (k) { try { if (b) { b.removeItem(k); return true; } } catch (e) {} return false; },
    };
  }

  function keyFor(userId, panel) { return 'he_views|' + String(userId || 'anon') + '|' + String(panel); }

  function cleanName(name) { return String(name == null ? '' : name).trim().slice(0, MAX_NAME); }

  // Create a per-(user, screen) view store over a storage adapter.
  // opts: { storage, userId, panel, cap }. storage is a localStorage-like object.
  function createViewStore(opts) {
    const o = opts || {};
    const panel = o.panel;
    if (VIEW_PANELS.indexOf(panel) === -1) throw new Error('he-saved-views: unknown view panel: ' + panel);
    const store = safeStorage(o.storage);
    const userId = o.userId || 'anon';
    const cap = (typeof o.cap === 'number' && o.cap > 0) ? o.cap : MAX_VIEWS;
    const key = keyFor(userId, panel);

    function readAll() {
      const raw = store.get(key);
      if (!raw) return { views: [], defaultName: null };
      try {
        const parsed = JSON.parse(raw);
        return { views: Array.isArray(parsed.views) ? parsed.views : [], defaultName: parsed.defaultName || null };
      } catch (e) { return { views: [], defaultName: null }; }
    }
    function writeAll(state) { return store.set(key, JSON.stringify({ views: state.views, defaultName: state.defaultName })); }

    return {
      panel: panel, userId: userId, available: store.available,
      // Save (or overwrite) a named view with a plain filter object.
      save: function (name, filters, atISO) {
        const n = cleanName(name);
        if (!n) return { ok: false, reason: 'a view needs a name' };
        if (filters == null || typeof filters !== 'object' || Array.isArray(filters)) return { ok: false, reason: 'filters must be an object' };
        const state = readAll();
        const existing = state.views.find(v => v.name === n);
        if (existing) { existing.filters = filters; existing.updatedAt = atISO || null; }
        else {
          if (state.views.length >= cap) return { ok: false, reason: 'view limit reached (' + cap + '); delete one first', cap: cap };
          state.views.push({ name: n, filters: filters, createdAt: atISO || null, updatedAt: atISO || null });
        }
        const wrote = writeAll(state);
        return { ok: wrote, persisted: wrote, view: { name: n, filters: filters },
          reason: wrote ? null : 'storage unavailable — view held for this screen only' };
      },
      list: function () { return readAll().views.map(v => ({ name: v.name, filters: v.filters, createdAt: v.createdAt, updatedAt: v.updatedAt })); },
      // Restore a saved view's filters (null if the name is unknown).
      restore: function (name) {
        const v = readAll().views.find(x => x.name === cleanName(name));
        return v ? v.filters : null;
      },
      rename: function (from, to) {
        const state = readAll();
        const v = state.views.find(x => x.name === cleanName(from));
        if (!v) return { ok: false, reason: 'no such view' };
        const n = cleanName(to);
        if (!n) return { ok: false, reason: 'a view needs a name' };
        if (state.views.some(x => x.name === n && x !== v)) return { ok: false, reason: 'a view with that name already exists' };
        if (state.defaultName === v.name) state.defaultName = n;
        v.name = n;
        return { ok: writeAll(state), name: n };
      },
      remove: function (name) {
        const state = readAll();
        const n = cleanName(name);
        const before = state.views.length;
        state.views = state.views.filter(v => v.name !== n);
        if (state.defaultName === n) state.defaultName = null;
        if (state.views.length === before) return { ok: false, reason: 'no such view' };
        return { ok: writeAll(state), removed: n };
      },
      setDefault: function (name) {
        const state = readAll();
        const n = cleanName(name);
        if (!state.views.some(v => v.name === n)) return { ok: false, reason: 'no such view' };
        state.defaultName = n;
        return { ok: writeAll(state), defaultName: n };
      },
      getDefault: function () {
        const state = readAll();
        if (!state.defaultName) return null;
        const v = state.views.find(x => x.name === state.defaultName);
        return v ? { name: v.name, filters: v.filters } : null;
      },
      // Reset the screen: forget the current unsaved filter selection. This does
      // NOT delete saved views (clearAll does). Returns the empty filter set.
      reset: function () { return {}; },
      // Delete every saved view for this person on this screen.
      clearAll: function () { return { ok: store.del(key) }; },
    };
  }

  return { VIEW_PANELS, MAX_VIEWS, MAX_NAME, safeStorage, keyFor, cleanName, createViewStore };
}));
