// DRAFT (2026-11-28). NOT DEPLOYED. Supabase Edge Function "shopify-orders-sync", only for R9 path B
// (docs/ops/R9_SHOPIFY_ORDERS_DESIGN.md). Deploying it, storing its secrets and scheduling it are the
// owner's steps, after approving drafts/78 and this file. Never run it beside another order import:
// order lines would be written twice (switch the old import off first).
//
// Secrets (set in Supabase -> Edge Functions -> Secrets; never in code or chat):
//   SHOPIFY_STORE_DOMAIN   for example your-store.myshopify.com
//   SHOPIFY_ORDERS_TOKEN   the access key of a custom app with ONLY the read_orders scope
//   SYNC_TRIGGER_SECRET    a long random string; the schedule sends it, so nobody else can start the sync
// Provided by Supabase automatically: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
import { runSync, daysFrom, API_VERSION } from './sync-core.mjs';

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
  const shop = env('SHOPIFY_STORE_DOMAIN'), token = env('SHOPIFY_ORDERS_TOKEN');
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
  const db = {
    // the dashboard's own switch (Feature Flags; Emergency turns it off): off, missing or unreadable = do nothing
    async syncSwitchOn() {
      const r = await fetch(`${base}/rest/v1/feature_flags?flag_key=eq.shopify_order_sync&select=enabled`, {
        headers: { apikey: service, authorization: `Bearer ${service}` },
      });
      if (!r.ok) return false;
      const rows = await r.json();
      return Array.isArray(rows) && rows.length === 1 && rows[0] && rows[0].enabled === true;
    },
    async rpc(name: string, args: unknown) {
      const r = await fetch(`${base}/rest/v1/rpc/${name}`, {
        method: 'POST', headers: { apikey: service, authorization: `Bearer ${service}`, 'content-type': 'application/json' }, body: JSON.stringify(args),
      });
      let body: any = null; try { body = await r.json(); } catch { body = null; }
      if (!r.ok) throw new Error((body && body.message ? String(body.message) : `Running ${name} failed`) + ` (${r.status}).`);
      return body;
    },
  };
  // optional {"days": N} (1 to 60): a catch-up run after a pause longer than 3 days
  let reqBody: unknown = null; try { reqBody = await req.json(); } catch { reqBody = null; }
  try {
    return Response.json(await runSync({ fetchJson, db, sinceDays: daysFrom(reqBody) }));
  } catch (e) {
    // the message never contains the access key: only status codes and Shopify's own words
    return Response.json({ ok: false, error: String((e as Error).message).slice(0, 300) }, { status: 502 });
  }
});
