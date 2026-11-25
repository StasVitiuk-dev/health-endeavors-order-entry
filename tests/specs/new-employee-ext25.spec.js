// The "New Employee" page: its rules (owner's decisions, Nov 24 evening). Four roles;
// a person creates and manages only accounts below their own level; nobody creates
// or changes an owner; the new person types their own password. This file tests the
// rules only (no page, no database). Everything is made up.
const P = require('../../assets/views/he-people.js');
const { test, expect } = require('@playwright/test');

test.describe('who may do what (no browser)', () => {
  test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'run once'); });

  test('the page is for the owner, administrators and managers; an employee and anything else are kept out', () => {
    expect(['owner', 'administrator', 'manager', 'employee', 'ai_agent', '', null, undefined, 7, {}].map(P.canOpen))
      .toEqual([true, true, true, false, false, false, false, false, false, false]);
  });

  test('a role can only be given below one\'s own level, and Owner can never be given', () => {
    expect(P.assignable('owner')).toEqual(['administrator', 'manager', 'employee']);
    expect(P.assignable('administrator')).toEqual(['manager', 'employee']);
    expect(P.assignable('manager')).toEqual(['employee']);
    expect(P.assignable('employee')).toEqual([]);
    expect(P.assignable('ai_agent')).toEqual([]);
    for (const r of P.ROLES) expect(P.assignable(r)).not.toContain('owner');
    for (const r of P.ROLES) expect(typeof P.ROLE_LINE[r]).toBe('string');           // every role has its short line
  });

  test('managing an account: never an owner\'s, never one\'s own, never one at or above one\'s level', () => {
    const owner = { id: 'o1', role: 'owner' }, admin = { id: 'a1', role: 'administrator' }, manager = { id: 'm1', role: 'manager' };
    expect(P.canManage(owner, { id: 'a1', role: 'administrator' }).ok).toBe(true);
    expect(P.canManage(owner, { id: 'o2', role: 'owner' })).toEqual({ ok: false, reason: 'An owner\'s account cannot be changed from this page.' });
    expect(P.canManage(owner, { id: 'o1', role: 'owner' }).reason).toBe('Your own account is not changed from this page.');
    expect(P.canManage(admin, { id: 'o1', role: 'owner' }).ok).toBe(false);          // the partner cannot touch the owner
    expect(P.canManage(admin, { id: 'a2', role: 'administrator' }).reason).toBe('You can manage only accounts below your own level.');
    expect(P.canManage(admin, { id: 'm1', role: 'manager' }).ok).toBe(true);
    expect(P.canManage(admin, { id: 'e1', role: 'employee' }).ok).toBe(true);
    expect(P.canManage(manager, { id: 'e1', role: 'employee' }).ok).toBe(true);
    expect(P.canManage(manager, { id: 'm2', role: 'manager' }).ok).toBe(false);
    expect(P.canManage(manager, { id: 'a1', role: 'administrator' }).ok).toBe(false);
    expect(P.canManage({ id: 'e1', role: 'employee' }, { id: 'e2', role: 'employee' }).reason).toBe('Your role cannot manage accounts.');
    expect(P.canManage(owner, { id: 'x', role: 'ai_agent' }).reason).toBe('This kind of account is not managed here.');
    for (const junk of [null, undefined, 7, 'x', [], {}]) expect(P.canManage(junk, junk).ok).toBe(false);
  });
});

test.describe('adding a person (no browser)', () => {
  test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'run once'); });
  const good = { name: '  SYNTHETIC  Person ', email: ' New.Person@Example.TEST ', role: 'employee', department: 'Packing' };

  test('a name, a work email and a role below one\'s own; the email is tidied; mistakes are said in plain words', () => {
    expect(P.checkNew(good, 'manager')).toEqual({ ok: true, problems: [], value: { name: 'SYNTHETIC Person', email: 'new.person@example.test', role: 'employee', department: 'Packing' } });
    expect(P.checkNew({}, 'owner').problems).toEqual(['Type the person\'s name.', 'Type their work email address.', 'Choose a role.']);
    expect(P.checkNew(Object.assign({}, good, { email: 'not an email' }), 'owner').problems).toEqual(['That is not an email address.']);
    expect(P.checkNew(Object.assign({}, good, { role: 'owner' }), 'owner').problems).toEqual(['An owner cannot be created from this page.']);
    expect(P.checkNew(Object.assign({}, good, { role: 'administrator' }), 'administrator').problems).toEqual(['You can give only roles below your own level.']);
    expect(P.checkNew(Object.assign({}, good, { role: 'manager' }), 'manager').problems).toEqual(['You can give only roles below your own level.']);
    expect(P.checkNew(good, 'employee').problems).toEqual(['Your role cannot add people.']);
    expect(P.checkNew(Object.assign({}, good, { name: 'x'.repeat(81) }), 'owner').problems[0]).toContain('too long');
    for (const junk of [null, undefined, 7, 'x', []]) expect(P.checkNew(junk, junk, junk).ok).toBe(false);
  });

  test('with a work address set, a personal address is refused', () => {
    expect(P.checkNew(good, 'owner', { workDomain: 'example.test' }).ok).toBe(true);
    expect(P.checkNew(good, 'owner', { workDomain: '@Example.TEST' }).ok).toBe(true);
    expect(P.checkNew(Object.assign({}, good, { email: 'someone@mail.example' }), 'owner', { workDomain: 'example.test' }).problems)
      .toEqual(['Use their work address (it ends with @example.test), not a personal one.']);
    expect(P.checkNew(Object.assign({}, good, { email: 'x@evil-example.test' }), 'owner', { workDomain: 'example.test' }).ok).toBe(false);   // the ending alone is not enough
  });

  test('the password the new person types: long enough, typed twice the same, not their email, not one character repeated', () => {
    const about = { email: 'new.person@example.test' };
    expect(P.checkPassword('correct horse staple', 'correct horse staple', about)).toEqual({ ok: true, problems: [] });
    expect(P.checkPassword('short', 'short', about).problems).toEqual(['The password needs at least 10 characters.']);
    expect(P.checkPassword('correct horse staple', 'correct horse stapel', about).problems).toEqual(['The two passwords are not the same. Type it again.']);
    expect(P.checkPassword('New.Person-2026!', 'New.Person-2026!', about).problems).toEqual(['The password must not contain the email address.']);
    expect(P.checkPassword('aaaaaaaaaaaa', 'aaaaaaaaaaaa', about).problems).toEqual(['The password cannot be one character repeated.']);
    expect(P.checkPassword('x'.repeat(73), 'x'.repeat(73), about).problems[0]).toContain('too long');
    for (const junk of [null, undefined, 7, {}, []]) expect(P.checkPassword(junk, junk, junk).ok).toBe(false);
  });

  test('a temporary password: 16 characters in four groups, no look-alike characters, never from weak or missing randomness', () => {
    let n = 0;
    const counting = (len) => Array.from({ length: len }, () => (n++) % 256);
    const pw = P.tempPassword(counting);
    expect(pw).toMatch(/^[A-HJ-NP-Za-kmnp-z2-9]{4}(-[A-HJ-NP-Za-kmnp-z2-9]{4}){3}$/);
    expect(pw).not.toMatch(/[0Oo1lI]/);
    expect(P.tempPassword(() => [])).toBe('');                                         // no randomness: no password at all
    expect(P.tempPassword(() => Array(32).fill(255))).toBe('');                        // only numbers that would favour some letters: refused
    expect(P.tempPassword(() => null)).toBe('');
    const real = P.tempPassword();                                                     // the system's own randomness
    expect(real).toMatch(/^[A-HJ-NP-Za-kmnp-z2-9]{4}(-[A-HJ-NP-Za-kmnp-z2-9]{4}){3}$/);
    expect(P.tempPassword()).not.toBe(real);
    // every character of the alphabet is equally likely: 224 of the 256 numbers are used, 4 for each of 56 characters
    const seen = Object.create(null);
    for (let b = 0; b < 256; b += 1) { const one = P.tempPassword(() => Array(32).fill(b)); if (one) seen[one[0]] = (seen[one[0]] || 0) + 1; }
    expect(Object.keys(seen)).toHaveLength(56);
    expect(new Set(Object.values(seen))).toEqual(new Set([4]));
  });
});

test.describe('the list of people and how much each did (no browser)', () => {
  test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'run once'); });
  const DAY = Date.parse('2026-11-24T06:00:00Z'), WEEK = Date.parse('2026-11-23T06:00:00Z');

  test('work is counted per person for today and this week; what cannot be read is left out, never guessed', () => {
    const rows = [
      { person: '#030', at: '2026-11-24T15:00:00Z' }, { person: '#030', at: '2026-11-24T16:00:00Z' }, { person: '#030', at: '2026-11-23T16:00:00Z' },
      { person: '#030', at: '2026-11-20T16:00:00Z' },                                  // last week: counted in neither
      { person: '#040', at: Date.parse('2026-11-24T07:00:00Z') },
      { person: '', at: '2026-11-24T15:00:00Z' }, { person: '#040', at: 'someday' }, null, 7, 'x'];
    expect(P.workCounts(rows, { todayStart: DAY, weekStart: WEEK })).toEqual({ '#030': { today: 2, week: 3 }, '#040': { today: 1, week: 1 } });
    expect(P.workCounts(null, null)).toEqual({});
    expect(P.workCounts(rows, {})).toEqual({ '#030': { today: 0, week: 0 }, '#040': { today: 0, week: 0 } });   // no day given: nothing is claimed
  });

  test('the list: active people first, higher roles first; each row says what this person may do to it', () => {
    const people = [
      { id: 'e1', name: 'SYNTHETIC Zed', email: 'zed@example.test', role: 'employee', active: true, accountNumber: '#040' },
      { id: 'o1', name: 'SYNTHETIC Owner', email: 'owner@example.test', role: 'owner', active: true, accountNumber: '#010' },
      { id: 'a1', name: 'SYNTHETIC Admin', email: 'admin@example.test', role: 'administrator', active: true, accountNumber: '#030' },
      { id: 'e2', name: 'SYNTHETIC Left', email: 'left@example.test', role: 'employee', active: false, accountNumber: '#050' },
      { id: 'm1', name: 'SYNTHETIC Manager', email: 'manager@example.test', role: 'manager', active: true, accountNumber: '#035' }];
    const asAdmin = P.listView(people, { id: 'a1', role: 'administrator' }, { '#040': { today: 2, week: 5 } });
    expect(asAdmin.map(r => r.id)).toEqual(['o1', 'a1', 'm1', 'e1', 'e2']);
    expect(asAdmin.map(r => r.canManage)).toEqual([false, false, true, true, true]);  // not the owner, not herself
    expect(asAdmin.find(r => r.id === 'o1').why).toBe('An owner\'s account cannot be changed from this page.');
    expect(asAdmin.find(r => r.id === 'e1')).toMatchObject({ roleWord: 'Employee', today: 2, week: 5, roles: ['manager'] });   // may be promoted to manager, not higher
    expect(asAdmin.find(r => r.id === 'm1').roles).toEqual(['employee']);
    expect(asAdmin.find(r => r.id === 'o1').roles).toEqual([]);
    const asManager = P.listView(people, { id: 'm1', role: 'manager' });
    expect(asManager.filter(r => r.canManage).map(r => r.id)).toEqual(['e1', 'e2']);
    expect(asManager.find(r => r.id === 'e1').roles).toEqual([]);                      // a manager cannot promote anyone
    for (const junk of [null, undefined, 7, 'x', {}]) expect(P.listView(junk, junk, junk)).toEqual([]);
  });

  test('what the database says, in plain words', () => {
    expect(P.friendlyError({ code: 'PGRST202', message: 'Could not find the function public.list_people' })).toContain('not installed in the database yet');
    expect(P.friendlyError({ code: '23505', message: 'duplicate key' })).toBe('An account with that email address already exists. Nothing was created.');
    expect(P.friendlyError({ code: '42501', message: 'An owner\'s account cannot be changed.' })).toBe('An owner\'s account cannot be changed.');
    expect(P.friendlyError({ code: '42501', message: 'permission denied for table profiles' })).toBe('You do not have permission to do that. Nothing was changed.');
    expect(P.friendlyError({ message: 'TypeError: Failed to fetch' })).toBe('Could not reach the database. Nothing was changed; try again.');
    for (const junk of [null, undefined, 7, 'x', {}]) expect(typeof P.friendlyError(junk)).toBe('string');
  });
});
