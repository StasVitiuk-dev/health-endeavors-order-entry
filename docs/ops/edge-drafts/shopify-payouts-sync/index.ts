// DRAFT (2026-11-22). NOT DEPLOYED. Supabase Edge Function "shopify-payouts-sync".
// Deploying it, storing its secrets and scheduling it are the owner's steps,
// after approving drafts/42 and this file (see
// docs/ops/sql-review/ITEM_6_SHOPIFY_FEED_AND_MONEY_MATCHING.md).
//
// Secrets (set in Supabase -> Edge Functions -> Secrets; never in code or chat):
//   SHOPIFY_STORE_DOMAIN   for example your-store.myshopify.com
//   SHOPIFY_ADMIN_TOKEN    the read-only access key of a custom app with the
//                          scopes read_shopify_payments_accounts and
//                          read_shopify_payments_payouts, nothing else
//   SYNC_TRIGGER_SECRET    a long random string; the daily schedule sends it,
//                          so nobody else can start the sync
// Provided by Supabase automatically: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
import { runSync, API_VERSION } from './sync-core.mjs';

const env = (k: string) => Deno.env.get(k) ?? '';

function sameSecret(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Not found', { status: 404 });
  if (!sameSecret(req.headers.get('x-sync-secret') ?? '', env('SYNC_TRIGGER_SECRET'))) return new Response('Forbidden', { status: 403 });
  const shop = env('SHOPIFY_STORE_DOMAIN'), token = env('SHOPIFY_ADMIN_TOKEN');
  const base = env('SUPABASE_URL'), service = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!/^[a-z0-9-]+\.myshopify\.com$/.test(shop) || !token || !base || !service) {
    return Response.json({ ok: false, error: 'The sync is not configured (a secret is missing).' }, { status: 500 });
  }
  const fetchJson = async (payload: unknown) => {
    const r = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-shopify-access-token': token }, body: JSON.stringify(payload),
    });
    let body: unknown = null; try { body = await r.json(); } catch { body = null; }
    return { status: r.status, body };
  };
  const rest = (path: string, init: RequestInit) => fetch(`${base}/rest/v1/${path}`, {
    ...init, headers: { apikey: service, authorization: `Bearer ${service}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  const db = {
    async upsert(table: string, rows: unknown[]) {
      const r = await rest(`${table}?on_conflict=id`, { method: 'POST', headers: { prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows) });
      if (!r.ok) throw new Error(`Saving ${table} failed (${r.status}).`);
    },
    async rpc(name: string) {
      const r = await rest(`rpc/${name}`, { method: 'POST', body: '{}' });
      if (!r.ok) throw new Error(`Running ${name} failed (${r.status}).`);
      return await r.json();
    },
  };
  try {
    const result = await runSync({ fetchJson, db });
    return Response.json(result);
  } catch (e) {
    // the message never contains the access key: only status codes and Shopify's own words
    return Response.json({ ok: false, error: String((e as Error).message).slice(0, 300) }, { status: 502 });
  }
});
