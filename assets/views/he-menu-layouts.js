// A shorter menu (owner, Nov 23-24: "I like how it is right now, I just want
// less of them: put some inside each other if it is the same topic"). The menu
// keeps its look, its group headings and its page names. A layout only says
// which of today's pages sit INSIDE another page of the same topic, where they
// appear as a row of buttons at the top of that page. Three variations, from a
// little shorter to the shortest; '' is the menu with every page on its own line.
//
// Owner's decision (Nov 24): "let's go with A option": variation 1 ("A little
// shorter") is the menu everyone starts with (DEFAULT_KEY). The full menu and the
// other two stay one click away under Feature Flags -> Menu.
//
// Nothing is removed in any layout: a page the list does not place stays in the
// menu under its own group exactly as today, so a page added later (or one
// behind a switch, such as Sales & Growth) can never go missing.
//
//   LAYOUTS[key]            { name, what, groups: [{ label, pages: [[sectionId, ...] | { label, tabs: [sectionId, ...] }] }] }
//   build(key, todaysGroups) -> { key, name, groups: [{ label, color, collapsible, pages: [{ id, label, tabs: [{ id, label }] }] }] } | null
//   find(layout, sectionId)  -> the menu page that section sits on, or null
//   holds(page, sectionId)   -> true when the section is that page or one of its tabs
//   count(layout)            -> how many entries the menu has
//   choices()                -> [{ key, name, what }] for the picker
//   fromStored(text)         -> the layout for what this browser kept (nothing kept = the default)
//   toStored(key)            -> what to keep in the browser ('today' for the full menu)
//   fromShared(value)        -> the layout the owner saved for every device, or null when there is none
//
// Pure: no page, no database. docs/ops/MENU_REORGANISATION_OPTIONS_2026-11-24.md
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.views = root.HE.views || {})['he-menu-layouts'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const QUALITY = ['qualityControlPanel', 'recallsPanel', 'adverseEventsPanel'];
  const MONEY = ['accountingPanel', 'expensesPanel', 'taxRecordsPanel'];
  const SETTINGS = ['flagsPanel', 'businessRulesPanel', 'featureRequestsPanel'];

  const LAYOUTS = {
    a: {
      name: '1. A little shorter',
      what: 'The same groups. Only the closest pairs are joined: for example Expenses and Tax Records are inside Accounting, Suppliers inside Purchase Orders, Recalls inside Quality Control.',
      groups: [
        { label: 'Overview', pages: [['attentionPanel'], ['dailySummaryPanel', 'reportHistoryPanel'], ['calendarPanel']] },
        { label: 'Sales', pages: [['ordersPanel', 'returnsPanel']] },
        { label: 'Inventory', pages: [['inventoryPanel'], ['purchaseOrdersPanel', 'suppliersPanel'], QUALITY] },
        { label: 'Finance', pages: [MONEY] },
        { label: 'Operations', pages: [['tasksPanel', 'approvalsPanel'], ['incidentsPanel'], ['documentsPanel', 'evidenceLockerPanel', 'sopsPanel', 'backupsPanel']] },
        { label: 'Customers & AI', pages: [['inquiriesPanel'], ['aiPanel']] },
        { label: 'Admin', pages: [SETTINGS, ['activityPanel', 'sessionsPanel']] },
        { label: 'Compliance', pages: [['legalHoldsPanel', 'continuityPanel']] },
      ],
    },
    b: {
      name: '2. One page per topic',
      what: 'Six groups, ten pages. Everything about an order (the order, its return, the customer\'s question) is on one page; so is everything about stock, money, documents and the team.',
      groups: [
        { label: 'Overview', pages: [['attentionPanel'], ['dailySummaryPanel', 'reportHistoryPanel', 'calendarPanel']] },
        { label: 'Sales', pages: [['ordersPanel', 'returnsPanel', 'inquiriesPanel']] },
        { label: 'Inventory', pages: [['inventoryPanel', 'purchaseOrdersPanel', 'suppliersPanel'], QUALITY] },
        { label: 'Finance', pages: [MONEY] },
        { label: 'Operations', pages: [['tasksPanel', 'approvalsPanel', 'incidentsPanel'], ['documentsPanel', 'evidenceLockerPanel', 'sopsPanel', 'backupsPanel', 'legalHoldsPanel', 'continuityPanel']] },
        { label: 'Admin', pages: [SETTINGS, ['activityPanel', 'sessionsPanel', 'aiPanel']] },
      ],
    },
    c: {
      name: '3. Shortest',
      what: 'Six entries, one per group: Overview, Sales, Inventory, Finance, Operations, Admin. Every page of a group is inside it.',
      groups: [
        { label: '', pages: [
          { label: 'Overview', tabs: ['attentionPanel', 'dailySummaryPanel', 'reportHistoryPanel', 'calendarPanel'] },
          { label: 'Sales', tabs: ['ordersPanel', 'returnsPanel', 'inquiriesPanel'] },
          { label: 'Inventory', tabs: ['inventoryPanel', 'purchaseOrdersPanel', 'suppliersPanel'].concat(QUALITY) },
          { label: 'Finance', tabs: MONEY },
          { label: 'Operations', tabs: ['tasksPanel', 'approvalsPanel', 'incidentsPanel', 'documentsPanel', 'evidenceLockerPanel', 'sopsPanel', 'aiPanel'] },
          { label: 'Admin', tabs: SETTINGS.concat(['activityPanel', 'sessionsPanel', 'backupsPanel', 'legalHoldsPanel', 'continuityPanel']) },
        ] },
      ],
    },
  };
  Object.freeze(LAYOUTS);

  const DEFAULT_KEY = 'a';          // owner's decision, Nov 24
  const FULL = 'today';             // how "every page on its own line" is written down
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const keyOf = (v) => (typeof v === 'string' && Object.prototype.hasOwnProperty.call(LAYOUTS, v) ? v : '');
  // what this browser kept: nothing (or something unreadable) is the default; 'today' is the full menu
  function fromStored(text) {
    if (text === FULL) return '';
    return keyOf(text) || DEFAULT_KEY;
  }
  function toStored(key) { return keyOf(key) || FULL; }
  // the owner's choice for every device: { layout: 'a' | 'b' | 'c' | '' | 'today' }; anything else is no choice
  function fromShared(value) {
    if (!isObj(value) || typeof value.layout !== 'string') return null;
    if (value.layout === '' || value.layout === FULL) return '';
    return keyOf(value.layout) || null;
  }

  // todaysGroups: the menu as it is today, [{ label, color, collapsible, pages: [{ id, label }] }]
  function build(key, todaysGroups) {
    const k = keyOf(key);
    if (!k) return null;
    const today = (Array.isArray(todaysGroups) ? todaysGroups : []).filter(g => isObj(g) && Array.isArray(g.pages));
    const name = Object.create(null), colour = Object.create(null), placed = Object.create(null);
    today.forEach(g => {
      if (typeof g.label === 'string' && typeof g.color === 'string') colour[g.label] = g.color;
      g.pages.forEach(p => { if (isObj(p) && typeof p.id === 'string' && p.id && !name[p.id]) name[p.id] = typeof p.label === 'string' && p.label ? p.label : p.id; });
    });
    const groups = [];
    LAYOUTS[k].groups.forEach(g => {
      const pages = [];
      g.pages.forEach(entry => {
        const ids = (Array.isArray(entry) ? entry : entry.tabs).filter(id => name[id] && !placed[id] && (placed[id] = true));
        if (!ids.length) return;
        pages.push({ id: ids[0], label: !Array.isArray(entry) && entry.label ? entry.label : name[ids[0]], tabs: ids.map(id => ({ id: id, label: name[id] })) });
      });
      if (pages.length) groups.push({ label: g.label, color: colour[g.label] || '', collapsible: false, pages: pages });
    });
    // what the list did not place stays where it is today
    today.forEach(g => {
      const left = g.pages.filter(p => isObj(p) && name[p.id] && !placed[p.id] && (placed[p.id] = true)).map(p => ({ id: p.id, label: name[p.id], tabs: [{ id: p.id, label: name[p.id] }] }));
      if (!left.length) return;
      const same = groups.find(x => x.label && x.label === g.label);
      if (same) same.pages.push(...left);
      else groups.push({ label: typeof g.label === 'string' ? g.label : '', color: typeof g.color === 'string' ? g.color : '', collapsible: g.collapsible === true, pages: left });
    });
    return { key: k, name: LAYOUTS[k].name, groups: groups };
  }

  function holds(page, sectionId) {
    return isObj(page) && Array.isArray(page.tabs) && page.tabs.some(t => t.id === sectionId);
  }
  function find(layout, sectionId) {
    if (!isObj(layout) || !Array.isArray(layout.groups)) return null;
    for (const g of layout.groups) for (const pg of (g.pages || [])) if (holds(pg, sectionId)) return pg;
    return null;
  }
  function count(layout) {
    return isObj(layout) && Array.isArray(layout.groups) ? layout.groups.reduce((n, g) => n + (g.pages || []).length, 0) : 0;
  }

  function choices() {
    return [{ key: '', name: 'Today\'s menu', what: 'The full menu, every page on its own line.' }]
      .concat(Object.keys(LAYOUTS).map(k => ({ key: k, name: LAYOUTS[k].name, what: LAYOUTS[k].what })));
  }

  return { LAYOUTS, DEFAULT_KEY, FULL, keyOf, fromStored, toStored, fromShared, build, find, holds, count, choices };
}));
