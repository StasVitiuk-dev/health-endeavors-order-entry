// Feature switches shared by every device (owner decision, Nov 23 evening):
// turning a feature on once turns it on on every phone and computer. Work
// features are for every employee; money, revenue and sensitive documents are
// for the owner and administrators only. Only the owner flips a switch.
//
// The shared state is one setting, "feature_switches" (docs/ops/sql/drafts/50,
// readable by staff): { on: { he_order_slips: true, ... } }. At sign-in the
// dashboard reads it and makes this browser match (the features themselves keep
// reading the browser's copy, so nothing else changes). Until drafts/50 is
// installed, switches stay per browser as before.
//
// Pure. Dual-mode (Node require + browser HE.views registry). Never writes by
// itself: it is GIVEN the storage to bring in line.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.views = root.HE.views || {})['he-shared-switches'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const KEY = 'feature_switches';
  const AUDIENCE_WORD = { everyone: 'Every employee', owner_admin: 'Owner and administrators' };
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const KEY_OK = /^he_[a-z0-9_]{1,40}$/;
  const keysOf = (switches) => (Array.isArray(switches) ? switches : []).filter(s => s && KEY_OK.test(String(s.key || ''))).map(s => s.key);

  // 'everyone' only for keys on the given list; anything else is owner and administrators
  function audienceOf(key, everyone) {
    return Array.isArray(everyone) && everyone.indexOf(key) >= 0 ? 'everyone' : 'owner_admin';
  }
  const mayUse = (audience, role) => audience === 'everyone' || role === 'owner' || role === 'administrator';

  // what is on for THIS person: on in the shared state AND meant for their role
  function effective(value, switches, role, everyone) {
    const on = isObj(value) && isObj(value.on) ? value.on : {};
    const out = {};
    keysOf(switches).forEach(k => { out[k] = on[k] === true && mayUse(audienceOf(k, everyone), role); });
    return out;
  }

  // make the browser's copy match; -> the keys that changed (storage errors: none changed)
  function apply(map, storage) {
    const changed = [];
    if (!isObj(map) || !storage || typeof storage.getItem !== 'function') return changed;
    Object.keys(map).forEach(k => {
      if (!KEY_OK.test(k)) return;
      try {
        const was = storage.getItem(k) === 'on';
        if (map[k] === true && !was) { storage.setItem(k, 'on'); changed.push(k); }
        else if (map[k] !== true && was) { storage.removeItem(k); changed.push(k); }
      } catch (e) { /* storage blocked: nothing changed */ }
    });
    return changed;
  }

  // the browser's own switches as a shared value (used the first time the owner shares them)
  function fromStorage(switches, storage) {
    const on = {};
    keysOf(switches).forEach(k => { try { if (storage && storage.getItem(k) === 'on') on[k] = true; } catch (e) { /* off */ } });
    return { on: on };
  }

  // the shared value after one switch is turned on or off (only listed keys are ever kept)
  function nextValue(value, switches, key, turnOn) {
    const known = keysOf(switches);
    const on = {};
    const old = isObj(value) && isObj(value.on) ? value.on : {};
    known.forEach(k => { if (old[k] === true) on[k] = true; });
    if (known.indexOf(key) >= 0) { if (turnOn) on[key] = true; else delete on[key]; }
    return { on: on };
  }
  const allOff = () => ({ on: {} });
  // a short fingerprint of an effective map, to reload at most once per state
  const signature = (map) => Object.keys(isObj(map) ? map : {}).filter(k => map[k] === true).sort().join(',');

  return { KEY, AUDIENCE_WORD, audienceOf, mayUse, effective, apply, fromStorage, nextValue, allOff, signature };
}));
