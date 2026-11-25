// The sales channel of every order (owner's list: "All Orders with channel
// badges"; Nov 24: Shopify is the hub, so Amazon, Etsy and TikTok orders arrive
// in the same orders list and must be told apart at a glance). Names the channel
// of an order, counts orders per channel, and filters a list by channel.
//
//   channelOf(order)        -> 'shopify' | 'amazon' | 'etsy' | 'tiktok' | 'wholesale' | 'manual' | 'other'
//   NAMES[key]              -> the word on the badge
//   tally(orders)           -> [{ key, name, count }]  (only channels that occur, fixed order)
//   pick(orders, key)       -> the orders of one channel ('all' = every order)
//
// Pure: no page, no database.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.views = root.HE.views || {})['he-order-channels'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ORDER = Object.freeze(['shopify', 'amazon', 'etsy', 'tiktok', 'wholesale', 'manual', 'other']);
  const NAMES = Object.freeze({ shopify: 'Website', amazon: 'Amazon', etsy: 'Etsy', tiktok: 'TikTok', wholesale: 'Wholesale', manual: 'By hand', other: 'Other' });
  // how the channel may be written in an order (lower case, spaces and dashes as underscores)
  const ALIASES = Object.freeze({
    shopify: 'shopify', website: 'shopify', web: 'shopify', online_store: 'shopify', online: 'shopify', storefront: 'shopify',
    amazon: 'amazon', amazon_us: 'amazon', amazon_com: 'amazon',
    etsy: 'etsy',
    tiktok: 'tiktok', tiktok_shop: 'tiktok', tik_tok: 'tiktok',
    wholesale: 'wholesale', b2b: 'wholesale',
    manual: 'manual', phone: 'manual', in_person: 'manual', by_hand: 'manual', draft: 'manual',
  });
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

  function channelOf(order) {
    if (!isObj(order)) return 'other';
    const raw = typeof order.channel === 'string' && order.channel.trim() ? order.channel : (typeof order.source === 'string' ? order.source : '');
    const key = raw.trim().toLowerCase().slice(0, 40).replace(/[\s.-]+/g, '_');
    return Object.prototype.hasOwnProperty.call(ALIASES, key) ? ALIASES[key] : 'other';
  }

  function tally(orders) {
    const counts = Object.create(null);
    (Array.isArray(orders) ? orders : []).forEach(o => { if (isObj(o)) { const k = channelOf(o); counts[k] = (counts[k] || 0) + 1; } });
    return ORDER.filter(k => counts[k]).map(k => ({ key: k, name: NAMES[k], count: counts[k] }));
  }

  function pick(orders, key) {
    const list = (Array.isArray(orders) ? orders : []).filter(isObj);
    if (key === 'all' || !Object.prototype.hasOwnProperty.call(NAMES, key)) return list;
    return list.filter(o => channelOf(o) === key);
  }

  return { ORDER, NAMES, channelOf, tally, pick };
}));
