// DRAFT (2026-11-25). NOT DEPLOYED. Supabase Edge Function "people-accounts".
// The New Employee page's helper program: create a sign-in, set a password, block or
// unblock a sign-in, each only after the database said yes for the person who asked
// (drafts/64, people_allow, asked with that person's own sign-in). The rules are in
// people-core.mjs. Deploying it is the owner's step, after approving drafts/62 and 64
// and this file (see docs/ops/sql-review/ITEM_17_PEOPLE_ACCOUNTS_HELPER.md).
//
// Settings (Supabase -> Edge Functions -> this function -> Secrets). None is typed into
// chat, code or a document:
//   ALLOWED_ORIGIN     the dashboard's address, exactly: https://stasvitiuk-dev.github.io
//   WORK_EMAIL_DOMAIN  the business email domain (for example yourbusiness.com), once it
//                      exists; empty = any address is accepted
// Provided by Supabase automatically: SUPABASE_URL, SUPABASE_ANON_KEY,
// SUPABASE_SERVICE_ROLE_KEY. The service key is used for the four sign-in calls only,
// never for the database, and never leaves this program.
import { handle } from './people-core.mjs';

const env = (k: string) => Deno.env.get(k) ?? '';

Deno.serve(async (req: Request) => {
  const base = env('SUPABASE_URL'), anon = env('SUPABASE_ANON_KEY'), service = env('SUPABASE_SERVICE_ROLE_KEY');
  const asJson = async (r: Response) => { let body: unknown = null; try { body = await r.json(); } catch { body = null; } return { status: r.status, body }; };
  const deps = (base && anon && service) ? {
    config: { allowedOrigin: env('ALLOWED_ORIGIN'), workDomain: env('WORK_EMAIL_DOMAIN') },
    // the database, as the person who asked: their own sign-in, the public key
    userDb: {
      rpc: async (token: string, name: string, args: Record<string, unknown>) => asJson(await fetch(`${base}/rest/v1/rpc/${name}`, {
        method: 'POST', headers: { apikey: anon, authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(args),
      })),
    },
    // the sign-in provider, with the key
    authAdmin: {
      createUser: async (attrs: Record<string, unknown>) => asJson(await fetch(`${base}/auth/v1/admin/users`, {
        method: 'POST', headers: { apikey: service, authorization: `Bearer ${service}`, 'content-type': 'application/json' }, body: JSON.stringify(attrs),
      })),
      updateUser: async (id: string, attrs: Record<string, unknown>) => asJson(await fetch(`${base}/auth/v1/admin/users/${encodeURIComponent(id)}`, {
        method: 'PUT', headers: { apikey: service, authorization: `Bearer ${service}`, 'content-type': 'application/json' }, body: JSON.stringify(attrs),
      })),
    },
  } : { config: { allowedOrigin: env('ALLOWED_ORIGIN') } };
  let body: unknown = null;
  if (req.method === 'POST') {
    const raw = await req.text();
    if (raw.length > 4000) return new Response(JSON.stringify({ ok: false, message: 'The request is too long.' }), { status: 413, headers: { 'content-type': 'application/json' } });
    try { body = JSON.parse(raw); } catch { body = null; }
  }
  const out = await handle({ method: req.method, origin: req.headers.get('origin') ?? '', authorization: req.headers.get('authorization') ?? '', body }, deps);
  return new Response(out.body == null ? null : JSON.stringify(out.body), { status: out.status, headers: out.headers });
});
