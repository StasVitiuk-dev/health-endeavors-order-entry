// A shorter menu (owner, Nov 24: "I like how it is right now, I just want less
// of them: put some inside each other if it is the same topic"). The menu keeps
// its look, headings and page names; a layout only puts same-topic pages inside
// one another, where they show as a row of buttons at the top of the page.
// Owner's decision (Nov 24): "let's go with A option": everyone starts with
// "1. A little shorter". Chosen on Feature Flags; "Today's menu" puts every page
// back on its own line. (The rest of the suite runs with the full menu: see
// tests/helpers/dashboard.js, shippedMenu.)
// assets/views/he-menu-layouts.js. Reads only; every value is made up.
const M = require('../../assets/views/he-menu-layouts.js');
const { test, expect, login, gotoPage, openMenuIfMobile } = require('../helpers/dashboard');

const node = (ti) => test.skip(ti.project.name !== 'desktop', 'Node-only; run once');
const TODAY = [
  { label: 'Overview', color: '#1f7a8c', pages: [['attentionPanel', 'Needs Your Attention'], ['dailySummaryPanel', 'Daily Summary'], ['reportHistoryPanel', 'Report History'], ['calendarPanel', 'Calendar']] },
  { label: 'Sales', color: '#b8734a', pages: [['ordersPanel', 'Orders & Revenue']] },
  { label: 'Inventory', color: '#8a6d3b', pages: [['inventoryPanel', 'Inventory'], ['returnsPanel', 'Returns'], ['suppliersPanel', 'Suppliers'], ['purchaseOrdersPanel', 'Purchase Orders'], ['qualityControlPanel', 'Quality Control']] },
  { label: 'Finance', color: '#2f7d4f', pages: [['expensesPanel', 'Expenses'], ['accountingPanel', 'Accounting'], ['taxRecordsPanel', 'Tax Records']] },
  { label: 'Operations', color: '#3f6fa8', pages: [['tasksPanel', 'Tasks'], ['incidentsPanel', 'Incidents'], ['evidenceLockerPanel', 'Evidence Locker'], ['documentsPanel', 'Documents']] },
  { label: 'Customers & AI', color: '#7a5aa8', pages: [['inquiriesPanel', 'Customer Inquiries'], ['aiPanel', 'AI Agent Activity']] },
  { label: 'Admin', color: '#9c5a72', pages: [['flagsPanel', 'Feature Flags'], ['businessRulesPanel', 'Business Rules'], ['approvalsPanel', 'Approval Queue'], ['sessionsPanel', 'Active Sessions'], ['activityPanel', 'Employee Activity'], ['sopsPanel', 'Procedures (SOPs)'], ['featureRequestsPanel', 'Feature Requests']] },
  { label: 'Compliance', color: '#8a6d6d', collapsible: true, pages: [['recallsPanel', 'Recalls'], ['adverseEventsPanel', 'Adverse Event Reports'], ['legalHoldsPanel', 'Legal Holds'], ['continuityPanel', 'Business Continuity']] },
].map(g => Object.assign({}, g, { pages: g.pages.map(([id, label]) => ({ id, label })) }));
const idsOf = (groups) => [].concat(...groups.map(g => g.pages.map(p => p.id)));
const insideOf = (layout) => [].concat(...layout.groups.map(g => [].concat(...g.pages.map(p => p.tabs.map(t => t.id)))));

test.describe('the three shorter menus (no browser)', () => {
  test('every page of today\'s menu is in each of them exactly once, under the name it has today', ({}, ti) => {
    node(ti);
    const all = idsOf(TODAY).sort();
    const nameToday = Object.fromEntries([].concat(...TODAY.map(g => g.pages.map(p => [p.id, p.label]))));
    expect(all).toHaveLength(30);
    for (const k of ['a', 'b', 'c']) {
      const L = M.build(k, TODAY);
      expect(insideOf(L).slice().sort(), k).toEqual(all);
      for (const g of L.groups) for (const p of g.pages) {
        expect(p.id, k).toBe(p.tabs[0].id);                                  // an entry opens its first page
        for (const t of p.tabs) expect(t.label, k + ' ' + t.id).toBe(nameToday[t.id]);
        if (k !== 'c') expect(p.label, k).toBe(nameToday[p.id]);             // and is called what that page is called today
      }
    }
    expect(['a', 'b', 'c'].map(k => M.count(M.build(k, TODAY)))).toEqual([16, 10, 6]);
  });

  test('the headings and their colours are today\'s; the shortest has one entry per heading', ({}, ti) => {
    node(ti);
    const colour = Object.fromEntries(TODAY.map(g => [g.label, g.color]));
    for (const k of ['a', 'b']) for (const g of M.build(k, TODAY).groups) { expect(colour[g.label], k + ' ' + g.label).toBeTruthy(); expect(g.color).toBe(colour[g.label]); }
    expect(M.build('a', TODAY).groups.map(g => g.label)).toEqual(TODAY.map(g => g.label));
    expect(M.build('b', TODAY).groups.map(g => g.label)).toEqual(['Overview', 'Sales', 'Inventory', 'Finance', 'Operations', 'Admin']);
    expect(M.build('c', TODAY).groups[0].pages.map(p => p.label)).toEqual(['Overview', 'Sales', 'Inventory', 'Finance', 'Operations', 'Admin']);
    const b = M.build('b', TODAY);
    expect(M.find(b, 'expensesPanel').tabs.map(t => t.label)).toEqual(['Accounting', 'Expenses', 'Tax Records']);
    expect(M.find(b, 'suppliersPanel').label).toBe('Inventory');
    expect(M.holds(M.find(b, 'recallsPanel'), 'qualityControlPanel')).toBe(true);
  });

  test('a page the list does not know stays in the menu where it is today (nothing can go missing)', ({}, ti) => {
    node(ti);
    const more = TODAY.map(g => g.label === 'Operations' ? Object.assign({}, g, { pages: g.pages.concat([{ id: 'backupsPanel', label: 'Backups & Printouts' }, { id: 'brandNewPanel', label: 'Brand new' }]) }) : g)
      .concat([{ label: 'Sales & Growth', color: '#6a7f3f', collapsible: true, pages: [{ id: 'salesCommandPanel', label: 'Growth Command Center' }, { id: 'salesLeadsPanel', label: 'Wholesale Leads' }] }]);
    for (const k of ['a', 'b', 'c']) {
      const L = M.build(k, more);
      expect(insideOf(L).slice().sort(), k).toEqual(idsOf(more).sort());
      const growth = L.groups.find(g => g.label === 'Sales & Growth');
      expect(growth.collapsible, k).toBe(true);
      expect(growth.pages.map(p => p.label)).toEqual(['Growth Command Center', 'Wholesale Leads']);
      expect(M.find(L, 'brandNewPanel').tabs).toHaveLength(1);
      expect(M.find(L, 'backupsPanel').tabs.length, k).toBeGreaterThan(1);    // Backups is placed by every layout
    }
    expect(M.build('a', more).groups.find(g => g.label === 'Operations').pages.map(p => p.label)).toContain('Brand new');
  });

  test('today\'s menu and anything unknown give no layout; odd input never throws', ({}, ti) => {
    node(ti);
    for (const k of ['', 'today', 'A', 'constructor', '__proto__', null, undefined, 7, {}, []]) { expect(M.keyOf(k)).toBe(''); expect(M.build(k, TODAY)).toBeNull(); }
    for (const junk of [null, undefined, 'x', 7, {}, [null, 'x', 7, {}, { pages: 'x' }, { pages: [null, 'x', {}, { id: 7 }, { id: '' }] }]]) {
      const L = M.build('b', junk);
      expect(L.groups).toEqual([]); expect(M.count(L)).toBe(0);
    }
    expect(M.find(null, 'x')).toBeNull(); expect(M.find({ groups: 'x' }, 'x')).toBeNull(); expect(M.holds(null, 'x')).toBe(false); expect(M.count(null)).toBe(0);
    expect(M.choices().map(c => c.key)).toEqual(['', 'a', 'b', 'c']);
    // what a browser kept: nothing or something unreadable is the owner's default; 'today' is the full menu
    expect(M.DEFAULT_KEY).toBe('a');
    expect([null, undefined, '', 'zzz', 'constructor', 7, {}].map(M.fromStored)).toEqual(['a', 'a', 'a', 'a', 'a', 'a', 'a']);
    expect(['today', 'a', 'b', 'c'].map(M.fromStored)).toEqual(['', 'a', 'b', 'c']);
    expect(['', 'a', 'b', 'c', 'zzz', null].map(M.toStored)).toEqual(['today', 'a', 'b', 'c', 'today', 'today']);
    expect(['', 'a', 'b', 'c'].map(k => M.fromStored(M.toStored(k)))).toEqual(['', 'a', 'b', 'c']);
    // the owner's choice for every device: only a real choice counts
    expect([{ layout: '' }, { layout: 'today' }, { layout: 'b' }].map(M.fromShared)).toEqual(['', '', 'b']);
    expect([null, undefined, 'x', 7, [], {}, { layout: 'zzz' }, { layout: 7 }, { layout: null }].map(M.fromShared)).toEqual([null, null, null, null, null, null, null, null, null]);
    expect(M.build('b', [{ label: 'X', pages: [{ id: 'accountingPanel', label: 'Accounting' }, { id: 'accountingPanel', label: 'Twice' }] }]).groups).toEqual(
      [{ label: 'Finance', color: '', collapsible: false, pages: [{ id: 'accountingPanel', label: 'Accounting', tabs: [{ id: 'accountingPanel', label: 'Accounting' }] }] }]);
  });
});

const choose = (page, key) => page.addInitScript((k) => { try { localStorage.setItem('he_menu_layout', k); } catch (e) {} }, key);
const links = (page) => page.locator('#sidebarGroups .sidebarGroup:not(.u-groupcolor-copper) .sidebarLink');
const tabs = (page) => page.locator('#menuTabs [data-menutab] .menuTabName');
const openEntry = async (page, id) => { await openMenuIfMobile(page); await page.locator('#sidebarGroups .sidebarLink[data-page="' + id + '"]').first().click(); };
const sharedReads = (backend) => backend.requests.filter(r => r.table === 'shared_settings' && !r.params.some(([k, v]) => k === 'limit' && v === '0'))
  .map(r => r.method + ' ' + ((r.params.find(([k]) => k === 'key') || [])[1] || '').replace(/^eq\./, '')).sort();
const noSideways = (page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);

test.describe('on the dashboard', () => {
  test('with the full menu chosen: every page on its own line and no row of buttons', async ({ page, backend }) => {
    await login(page);
    await gotoPage(page, 'accountingPanel');
    await expect(page.locator('#menuTabs')).toHaveCount(0);
    await gotoPage(page, 'flagsPanel');
    await expect(page.locator('[data-menulayoutpicker]')).toHaveAttribute('data-menulayoutpicker', 'today');
    await expect(page.locator('[data-menulayout="today"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-menulayout-lines]')).toHaveAttribute('data-menulayout-lines', '30');
    await openMenuIfMobile(page);
    expect(await page.locator('#sidebarGroups .sidebarLink[data-inside]').count()).toBe(0);
    // Nov 27: the shared settings are in use on every device. At sign-in the dashboard only READS the switches and
    // the menu the owner chose for everyone (one row each); nothing is saved until someone chooses.
    expect(sharedReads(backend)).toEqual(['GET feature_switches', 'GET menu_layout']);
  });

  test('choosing a shorter menu: same-topic pages go inside one another, and "Today\'s menu" puts them back', async ({ page, backend }) => {
    await login(page);
    await gotoPage(page, 'flagsPanel');
    await page.locator('[data-menulayout="b"]').click();
    await expect(page.locator('[data-menulayoutpicker]')).toHaveAttribute('data-menulayoutpicker', 'b');
    await expect(page.locator('[data-menulayout="b"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-menulayout="b"]')).toBeFocused();
    await expect(page.locator('[data-menulayout-lines]')).toHaveAttribute('data-menulayout-lines', '10');
    // Nov 27: the owner's choice is saved for every phone and computer (the shared settings are in use); the keyboard stays on the button
    await expect(page.locator('[data-menulayout-msg]')).toContainText('Saved: every phone and computer');
    await expect(page.locator('[data-menulayout="b"]')).toBeFocused();
    expect(backend.requests.filter(r => r.rpc === 'set_shared_setting').map(r => r.body)).toEqual([{ p_key: 'menu_layout', p_value: { layout: 'b' }, p_audience: 'staff' }]);
    // Feature Flags itself now has two pages inside it
    await expect(tabs(page)).toHaveText(['Feature Flags', 'Business Rules', 'Feature Requests']);
    await openMenuIfMobile(page);
    await expect(links(page)).toHaveCount(10);
    await expect(page.locator('#sidebarGroups .groupLabel')).toHaveText(['Overview', 'Sales', 'Inventory', 'Finance', 'Operations', 'Admin']);
    await expect(page.locator('#sidebarGroups .sidebarLink[data-page="expensesPanel"]')).toHaveCount(0);

    await openEntry(page, 'accountingPanel');
    await expect(page.locator('section#accountingPanel')).toHaveClass(/activePage/);
    await expect(tabs(page)).toHaveText(['Accounting', 'Expenses', 'Tax Records']);
    await expect(page.locator('#menuTabs')).toHaveAttribute('aria-label', 'Pages inside Accounting');
    await expect(page.locator('#menuTabs [aria-current="page"]')).toHaveText('Accounting');
    await page.locator('#menuTabs [data-menutab="expensesPanel"]').click();
    await expect(page.locator('section#expensesPanel')).toHaveClass(/activePage/);
    await expect(page.locator('section#accountingPanel')).not.toHaveClass(/activePage/);
    await expect(page.locator('#menuTabs [aria-current="page"]')).toHaveText('Expenses');
    // the menu entry stays lit while a page inside it is open
    await expect(page.locator('#sidebarGroups .sidebarLink[data-page="accountingPanel"]')).toHaveClass(/active/);
    await expect(page.locator('#sidebarGroups .sidebarLink.active')).toHaveCount(1);
    expect(await noSideways(page)).toBe(true);

    // kept after a reload, and the page that was open comes back with its row of buttons
    await page.reload();
    await expect(page.locator('section#expensesPanel')).toHaveClass(/activePage/, { timeout: 20000 });
    await expect(page.locator('#menuTabs [aria-current="page"]')).toHaveText('Expenses');

    await openEntry(page, 'flagsPanel');
    await page.locator('[data-menulayout="today"]').click();
    await expect(page.locator('#menuTabs')).toHaveCount(0);
    await openMenuIfMobile(page);
    await expect(page.locator('#sidebarGroups .sidebarLink[data-page="expensesPanel"]')).toHaveCount(1);
    expect(await page.locator('#sidebarGroups .sidebarLink[data-inside]').count()).toBe(0);
    expect(await page.evaluate(() => localStorage.getItem('he_menu_layout'))).toBe('today');
  });

  for (const k of ['a', 'b', 'c']) {
    test('menu ' + k + ': every page can still be opened, from its entry or from the row of buttons', async ({ page }) => {
      test.setTimeout(120000);
      await choose(page, k);
      await login(page);
      const L = M.build(k, TODAY);
      await openMenuIfMobile(page);
      await expect(links(page)).toHaveCount(M.count(L));
      const seen = [];
      for (const g of L.groups) for (const entry of g.pages) {
        await openEntry(page, entry.id);
        await expect(page.locator('section#' + entry.id)).toHaveClass(/activePage/);
        if (entry.tabs.length < 2) { await expect(page.locator('#menuTabs')).toHaveCount(0); seen.push(entry.id); continue; }
        await expect(tabs(page)).toHaveText(entry.tabs.map(t => t.label));
        for (const t of entry.tabs) {
          await page.locator('#menuTabs [data-menutab="' + t.id + '"]').click();
          await expect(page.locator('section#' + t.id)).toHaveClass(/activePage/);
          await expect(page.locator('main.contentArea > section.panel.activePage')).toHaveCount(1);
          seen.push(t.id);
        }
        expect(await noSideways(page), k + ' ' + entry.label).toBe(true);
      }
      expect(seen.slice().sort()).toEqual(idsOf(TODAY).sort());
    });
  }

  test('search still finds a page that is inside another, and a link to it opens it with its row of buttons', async ({ page }) => {
    await choose(page, 'c');
    await login(page);
    await openMenuIfMobile(page);
    await page.fill('#sidebarSearch', 'tax rec');
    await page.locator('#sidebarGroups .sidebarLink[data-page="taxRecordsPanel"]:not(.searchResultLink)').first().click();
    await expect(page.locator('section#taxRecordsPanel')).toHaveClass(/activePage/);
    await expect(page.locator('#menuTabs')).toHaveAttribute('aria-label', 'Pages inside Finance');
    await expect(page.locator('#menuTabs [aria-current="page"]')).toHaveText('Tax Records');
    await page.goto(page.url().split('#')[0] + '#page=recallsPanel');
    await expect(page.locator('section#recallsPanel')).toHaveClass(/activePage/, { timeout: 20000 });
    await expect(page.locator('#menuTabs [aria-current="page"]')).toHaveText('Recalls');
    await expect(page.locator('#menuTabs')).toHaveAttribute('aria-label', 'Pages inside Inventory');
  });

  test('a count on a page inside shows on its entry and on its button, so nothing that needs attention is hidden', async ({ page }) => {
    await login(page);
    await openMenuIfMobile(page);
    const badge = page.locator('#sidebarGroups .sidebarGroup:not(.u-groupcolor-copper) .sidebarLink[data-page="tasksPanel"] .sidebarBadge');
    await expect(badge).toHaveCount(1);
    const before = Number(await badge.innerText());
    expect(before).toBeGreaterThan(0);
    await gotoPage(page, 'flagsPanel');
    await page.locator('[data-menulayout="c"]').click();
    await openEntry(page, 'tasksPanel');
    await expect(page.locator('#menuTabs [data-menutab="tasksPanel"] .sidebarBadge')).toHaveText(String(before));
    const onTabs = await page.locator('#menuTabs .sidebarBadge').allInnerTexts();
    const total = onTabs.reduce((n, t) => n + Number(t), 0);
    await openMenuIfMobile(page);
    await expect(page.locator('#sidebarGroups .sidebarLink[data-page="tasksPanel"] .sidebarBadge')).toHaveText(String(total));
    expect(total).toBeGreaterThanOrEqual(before);
  });

  test('keyboard: a button in the row is pressed with Enter and keeps the focus on the page that opened', async ({ page }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'keyboard');
    await choose(page, 'b');
    await login(page);
    await gotoPage(page, 'accountingPanel');
    await page.locator('#menuTabs [data-menutab="taxRecordsPanel"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('section#taxRecordsPanel')).toHaveClass(/activePage/);
    await expect(page.locator('#menuTabs [data-menutab="taxRecordsPanel"]')).toBeFocused();
    await expect(page.locator('#menuTabs [data-menutab="taxRecordsPanel"]')).toHaveAttribute('aria-current', 'page');
  });

  test('a narrow window (790 wide): the longest row of buttons wraps and the page does not scroll sideways', async ({ page }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'window width');
    await choose(page, 'c');
    await page.setViewportSize({ width: 790, height: 900 });
    await login(page);
    await page.goto(page.url().split('#')[0] + '#page=flagsPanel');
    await expect(page.locator('section#flagsPanel')).toHaveClass(/activePage/, { timeout: 20000 });
    await expect(tabs(page)).toHaveCount(7);
    expect(await noSideways(page)).toBe(true);
    const box = await page.locator('#menuTabs').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(791);
  });
});

test.describe('as shipped (owner, Nov 24: "let\'s go with A option")', () => {
  test.use({ shippedMenu: true });

  test('a browser that never chose starts with "1. A little shorter": 16 lines, same headings, only reads from the database', async ({ page, backend }) => {
    await login(page);
    expect(await page.evaluate(() => localStorage.getItem('he_menu_layout'))).toBeNull();
    await openMenuIfMobile(page);
    await expect(links(page)).toHaveCount(16);
    await expect(page.locator('#sidebarGroups .groupLabel')).toHaveText(['Overview', 'Sales', 'Inventory', 'Finance', 'Operations', 'Customers & AI', 'Admin', 'Compliance']);
    await expect(page.locator('#sidebarGroups .sidebarLink[data-page="expensesPanel"]')).toHaveCount(0);
    await gotoPage(page, 'expensesPanel');                                      // through Accounting and its row of buttons
    await expect(tabs(page)).toHaveText(['Accounting', 'Expenses', 'Tax Records']);
    await expect(page.locator('#menuTabs [aria-current="page"] .menuTabName')).toHaveText('Expenses');
    await gotoPage(page, 'flagsPanel');
    await expect(page.locator('[data-menulayoutpicker]')).toHaveAttribute('data-menulayoutpicker', 'a');
    await expect(page.locator('[data-menulayout="a"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-menulayout-lines]')).toHaveAttribute('data-menulayout-lines', '16');
    // Nov 27: the shared settings are in use on every device. At sign-in the dashboard only READS the switches and
    // the menu the owner chose for everyone (one row each); nothing is saved until someone chooses.
    expect(sharedReads(backend)).toEqual(['GET feature_switches', 'GET menu_layout']);
    expect(backend.requests.filter(r => r.rpc === 'set_shared_setting')).toEqual([]);
  });

  test('"Today\'s menu" puts every page back on its own line, and that choice is kept after a reload', async ({ page }) => {
    await login(page);
    await gotoPage(page, 'flagsPanel');
    await page.locator('[data-menulayout="today"]').click();
    await expect(page.locator('#menuTabs')).toHaveCount(0);
    await openMenuIfMobile(page);
    await expect(links(page)).toHaveCount(30 - 4);                               // Compliance is folded as before: its 4 pages show when opened
    await expect(page.locator('#sidebarGroups .sidebarLink[data-page="expensesPanel"]')).toHaveCount(1);
    expect(await page.evaluate(() => localStorage.getItem('he_menu_layout'))).toBe('today');
    await page.reload();
    await expect(page.locator('section#flagsPanel')).toHaveClass(/activePage/, { timeout: 20000 });
    await openMenuIfMobile(page);
    await expect(page.locator('#sidebarGroups .sidebarLink[data-page="expensesPanel"]')).toHaveCount(1);
    expect(await page.locator('#sidebarGroups .sidebarLink[data-inside]').count()).toBe(0);
  });

  test('something unreadable kept in the browser is treated as no choice', async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.setItem('he_menu_layout', '{"x":1}'); } catch (e) {} });
    await login(page);
    await openMenuIfMobile(page);
    await expect(links(page)).toHaveCount(16);
  });

  test('every page of the shipped menu opens and has no accessibility-name or sideways-scroll problem in its row of buttons', async ({ page }) => {
    test.setTimeout(120000);
    await login(page);
    for (const id of idsOf(TODAY)) {
      await gotoPage(page, id);
      await expect(page.locator('main.contentArea > section.panel.activePage')).toHaveCount(1);
      const row = page.locator('#menuTabs');
      if (await row.count()) {
        await expect(row).toHaveAttribute('aria-label', /^Pages inside /);
        await expect(row.locator('[aria-current="page"]')).toHaveCount(1);
        expect(await row.locator('button').evaluateAll(bs => bs.every(b => (b.textContent || '').trim().length > 0))).toBe(true);
      }
      expect(await noSideways(page), id).toBe(true);
    }
  });
});

test.describe('the same menu on every device (shared settings in use)', () => {
  const shared = (page) => page.addInitScript(() => { try { localStorage.setItem('he_shared_settings', 'on'); } catch (e) {} });
  const row = (layout) => ({ key: 'menu_layout', value: { layout }, audience: 'staff', updated_at: '2026-11-24T16:00:00Z', updated_by: 'u-owner' });
  const saves = (backend) => backend.requests.filter(r => r.rpc === 'set_shared_setting').map(r => r.body);

  test('the owner\'s choice is saved for everyone, readable by employees', async ({ page, backend }) => {
    await shared(page);
    backend.tables.shared_settings = [];
    backend.rpc.set_shared_setting = (body) => { backend.tables.shared_settings = [row(body.p_value.layout)]; return { ok: true, updated_at: '2026-11-24T16:05:00Z' }; };
    await login(page);
    await gotoPage(page, 'flagsPanel');
    await page.locator('[data-menulayout="a"]').click();
    await expect(page.locator('[data-menulayout-msg]')).toContainText('Saved: every phone and computer');
    expect(saves(backend)).toEqual([{ p_key: 'menu_layout', p_value: { layout: 'a' }, p_audience: 'staff' }]);
    await page.locator('[data-menulayout="today"]').click();
    await expect.poll(() => saves(backend).length).toBe(2);
    expect(saves(backend)[1]).toEqual({ p_key: 'menu_layout', p_value: { layout: '' }, p_audience: 'staff' });
  });

  test('another device, and an employee, get the chosen menu at sign-in without saving anything', async ({ page, backend }) => {
    await shared(page);
    backend.tables.profiles[0].role = 'employee';
    backend.tables.shared_settings = [row('b')];
    await login(page);
    await openMenuIfMobile(page);
    await expect(page.locator('#sidebarGroups .sidebarLink[data-inside]').first()).toBeVisible();
    await expect(page.locator('#sidebarGroups .sidebarLink[data-page="expensesPanel"]')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('he_menu_layout'))).toBe('b');
    expect(saves(backend)).toEqual([]);
  });

  test('the owner went back to today\'s menu: a device that still had a shorter one follows', async ({ page, backend }) => {
    await shared(page); await choose(page, 'c');
    backend.tables.shared_settings = [row('')];
    await login(page);
    await openMenuIfMobile(page);
    await expect(page.locator('#sidebarGroups .sidebarLink[data-page="expensesPanel"]')).toHaveCount(1);
    expect(await page.locator('#sidebarGroups .sidebarLink[data-inside]').count()).toBe(0);
  });

  test('the database refuses or holds something odd: the choice stays in this browser and the menu still works', async ({ page, backend }) => {
    await shared(page);
    backend.tables.shared_settings = [row('zzz'), { key: 'menu_layout', value: 'x' }];
    backend.rpc.set_shared_setting = () => ({ __error: { status: 403, code: '42501', message: 'Only the owner or an administrator can change a shared setting.' } });
    await login(page);
    await openMenuIfMobile(page);
    expect(await page.locator('#sidebarGroups .sidebarLink[data-inside]').count()).toBe(0);     // an unknown name is no choice: this browser keeps its own
    await gotoPage(page, 'flagsPanel');
    await page.locator('[data-menulayout="b"]').click();
    await expect(page.locator('[data-menulayout-msg]')).toContainText('Could not save it for every device; it is kept in this browser.');
    await expect(tabs(page)).toHaveText(['Feature Flags', 'Business Rules', 'Feature Requests']);
  });
});
