// Sales & Growth — provider-neutral AI drafting interface.
//
// The sales system never calls an AI provider directly. It asks this drafter for
// a draft; the drafter delegates to a PROVIDER. Today the only configured
// provider is a deterministic, offline, zero-cost TEMPLATE provider — it needs no
// API key, no network and no spend, and it is what runs in tests and in the
// dashboard until the owner explicitly enables a paid provider. Claude / OpenAI /
// other providers are declared but NOT CONFIGURED: calling one throws a clear
// error instead of silently reaching the network. This keeps the whole system
// swappable later without rewriting the callers, and free to run now.
//
// Pure: no DOM, no network, no send. Dual-mode: works as a Node module (require)
// and registers itself as a browser module when the HE registry is present.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-ai'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // A provider turns a (kind, context) request into { subject, body }. It must be
  // deterministic for a given input when `deterministic` is true (so tests and
  // the audit trail are reproducible).
  //
  // The TEMPLATE provider fills fixed, owner-reviewable templates from context.
  // It makes no claims about the product beyond what the caller passes in, and it
  // never invents health/skincare effects.
  const templateProvider = {
    name: 'template',
    available: true,
    deterministic: true,
    cost: 'none',
    generate(kind, ctx) {
      const c = ctx || {};
      const store = String(c.storeName || 'your store').trim();
      const contact = c.contactName ? String(c.contactName).trim() : '';
      const greeting = contact ? `Hi ${contact},` : `Hi ${store} team,`;
      const product = String(c.productName || 'our body-care line').trim();
      const sender = String(c.senderName || 'Health Endeavors').trim();
      const templates = {
        // First wholesale introduction.
        intro: () => ({
          subject: `Wholesale enquiry — ${product} for ${store}`,
          body: [greeting, '',
            `I'm reaching out from ${sender}. We make ${product}, and I think it could fit ${store}'s shelves well.`,
            'Would you be open to a short conversation about carrying it at wholesale? I can send a line sheet and pricing.',
            '', 'Thanks for your time,', sender].join('\n'),
        }),
        // A gentle follow-up when there was no reply.
        followup: () => ({
          subject: `Re: Wholesale enquiry — ${product} for ${store}`,
          body: [greeting, '',
            `Just following up on my note about carrying ${product} at ${store}. No pressure at all — happy to send the line sheet if it's useful.`,
            '', 'Best,', sender].join('\n'),
        }),
        // A reply to an interested store.
        reply_interested: () => ({
          subject: `Re: Wholesale enquiry — ${product} for ${store}`,
          body: [greeting, '',
            'Thanks so much — glad to hear it. I\'ve attached the line sheet and wholesale pricing. Would a quick call this week suit you?',
            '', 'Looking forward to it,', sender].join('\n'),
        }),
      };
      const t = templates[kind];
      if (!t) throw new Error('he-sales-ai: unknown draft kind "' + kind + '"');
      const out = t();
      return { subject: out.subject, body: out.body, provider: this.name, kind };
    },
  };

  // Providers that are declared but must be enabled by the owner before use. They
  // never reach the network from here; calling one is a loud, safe failure.
  function notConfigured(name) {
    return {
      name, available: false, deterministic: false, cost: 'paid',
      generate() {
        throw new Error('he-sales-ai: provider "' + name + '" is not configured. '
          + 'The owner must enable it (API key + explicit approval) before it can be used. '
          + 'Until then, use the free deterministic "template" provider.');
      },
    };
  }

  const PROVIDERS = {
    template: templateProvider,
    claude: notConfigured('claude'),
    openai: notConfigured('openai'),
  };

  // createDrafter({ provider }) → { draft(kind, ctx), providerName, available }.
  // Defaults to the free template provider. Passing an unknown provider name is a
  // clear error, never a silent fallback to a paid one.
  function createDrafter(opts) {
    const name = (opts && opts.provider) || 'template';
    const provider = PROVIDERS[name];
    if (!provider) throw new Error('he-sales-ai: unknown provider "' + name + '". Known: ' + Object.keys(PROVIDERS).join(', '));
    return {
      providerName: provider.name,
      available: provider.available,
      // Returns a DRAFT only. This function never sends anything anywhere.
      draft(kind, ctx) {
        const d = provider.generate(kind, ctx);
        return Object.assign({ status: 'DRAFT', sent: false, createdWith: provider.name }, d);
      },
    };
  }

  return { createDrafter, templateProvider, PROVIDERS, notConfigured };
}));
