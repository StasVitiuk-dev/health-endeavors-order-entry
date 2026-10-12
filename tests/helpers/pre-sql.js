// EXT11: the production database as it is TODAY, i.e. right after the
// dashboard code is merged and BEFORE any of the prepared SQL is installed:
//   - the stock functions R1–R5 (drafts/10) do not exist      -> PGRST202
//   - the request-key columns (drafts/19) do not exist          -> 42703
//   - the nightly check tables (drafts/25 + 29) do not exist    -> PGRST205
// The shared mock otherwise answers as if everything were installed (an
// unknown function replies [] and any column is accepted), so tests that
// claim "nothing breaks before the SQL" must use this.
const STOCK_FUNCTIONS = ['receive_purchase_order', 'quarantine_recall', 'receive_return', 'adjust_inventory', 'delete_unused_product'];

async function preSqlProduction(page, backend) {
  for (const fn of STOCK_FUNCTIONS) {
    backend.rpc[fn] = () => ({ __error: { status: 404, code: 'PGRST202', message: 'Could not find the function public.' + fn + ' in the schema cache' } });
  }
  const cors = { 'access-control-allow-origin': '*' };
  await page.context().route(/\/rest\/v1\/[a-z_]+\?[^#]*client_request_id/, r => r.fulfill({ status: 400, contentType: 'application/json', headers: cors,
    body: JSON.stringify({ code: '42703', message: 'column "client_request_id" does not exist' }) }));
  await page.context().route(/\/rest\/v1\/integrity_check_(runs|results)/, r => r.fulfill({ status: 404, contentType: 'application/json', headers: cors,
    body: JSON.stringify({ code: 'PGRST205', message: "Could not find the table 'public.integrity_check_runs' in the schema cache" }) }));
}

module.exports = { preSqlProduction, STOCK_FUNCTIONS };
