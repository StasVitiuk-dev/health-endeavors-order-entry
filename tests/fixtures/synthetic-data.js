// Synthetic test data for the dashboard regression tests.
//
// Everything in this file is made up. None of it is copied from the real
// Health Endeavors database: no real customers, orders, employees, emails
// or keys. The test browser never talks to the real Supabase project; the
// mock in ../helpers/mock-supabase.js answers every request from this data.

const OWNER_USER = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'synthetic.owner@example.test',
  password: 'synthetic-password-not-real',
};

function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

// A fresh copy each call, so one test's changes never leak into another.
function buildTables() {
  return {
    profiles: [
      {
        id: OWNER_USER.id,
        role: 'owner',
        is_active: true,
        display_name: 'Synthetic Owner',
        full_name: 'Synthetic Owner',
        email: OWNER_USER.email,
      },
    ],
    tasks: [
      { id: 'task-open-1', title: 'SYNTHETIC open task one', priority: 'high', status: 'open', due_at: daysFromNow(1), created_at: daysFromNow(-3) },
      { id: 'task-open-2', title: 'SYNTHETIC open task two', priority: 'normal', status: 'open', due_at: daysFromNow(2), created_at: daysFromNow(-3) },
      { id: 'task-progress-1', title: 'SYNTHETIC in-progress task', priority: 'normal', status: 'in_progress', due_at: daysFromNow(3), created_at: daysFromNow(-3) },
      { id: 'task-overdue-1', title: 'SYNTHETIC overdue open task', priority: 'low', status: 'open', due_at: daysFromNow(-2), created_at: daysFromNow(-5) },
      { id: 'task-done-1', title: 'SYNTHETIC finished task', priority: 'normal', status: 'done', due_at: daysFromNow(4), created_at: daysFromNow(-6) },
      { id: 'task-cancelled-1', title: 'SYNTHETIC cancelled task', priority: 'normal', status: 'cancelled', due_at: daysFromNow(5), created_at: daysFromNow(-6) },
    ],
  };
}

module.exports = { OWNER_USER, buildTables, daysFromNow };
