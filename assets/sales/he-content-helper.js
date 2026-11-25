// Content helper — several ready options, and another on request (owner, Nov 24:
// "it will have to have ready different options ... and be able to make a new one
// any time"). One product and the owner's own story in; out come drafts for a post,
// an ad headline, an ad text, an email paragraph and a short video, each in several
// angles and three tones. DRAFTS ONLY: nothing is posted, sent or spent.
//
// Two rules keep it honest:
//   * It never invents a fact. The only facts in a draft are the product's name and
//     the owner's own story, quoted; everything around them is neutral wording.
//   * Every option passes the claim firewall (assets/sales/he-sales-claims.js). An
//     option with a health or medical claim is blocked, and says which words.
// The options come from fixed patterns, not from an AI model, so "another" walks
// through the patterns and says when it has shown them all.
//
//   KINDS, TONES, ANGLES, LOOKS
//   checkInput({ product, story })                         -> { ok, problems, product, story }
//   options({ product, story, kind, tone, count, round }, deps) -> { ok, problems, options, round, rounds, total, last }
//       option: { id, kind, tone, angle, angleName, text, chars, limit, blocked, findings }
//   video({ product, story, tone, round }, deps)           -> { ok, problems, script, shots, blocked, findings }
//   week({ product, story, tone, round }, deps)            -> { ok, problems, days: [{ day, kind, kindName, text, shots?, blocked, findings }], blocked }
//   checkOwn(text, kind, deps)                             -> { ok, empty, chars, limit, tooLong, blocked, findings }
//
// deps = { claims: he-sales-claims }. Pure. Dual-mode (Node require + browser HE.sales).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-content-helper'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const KINDS = Object.freeze({
    post: Object.freeze({ key: 'post', name: 'Post', limit: 300, what: 'A caption for Instagram or TikTok.' }),
    adHeadline: Object.freeze({ key: 'adHeadline', name: 'Ad headline', limit: 40, what: 'The bold line of an ad.' }),
    adText: Object.freeze({ key: 'adText', name: 'Ad text', limit: 125, what: 'The short text under an ad\'s headline.' }),
    email: Object.freeze({ key: 'email', name: 'Email paragraph', limit: 500, what: 'One paragraph for an email to customers or stores.' }) });
  const TONES = Object.freeze({ plain: 'Plain', friendly: 'Friendly', premium: 'Premium' });
  const ANGLES = Object.freeze([
    Object.freeze({ key: 'story', name: 'Your story first' }), Object.freeze({ key: 'product', name: 'The product first' }),
    Object.freeze({ key: 'question', name: 'A question' }), Object.freeze({ key: 'short', name: 'Short and direct' }),
    Object.freeze({ key: 'gift', name: 'As a gift' }), Object.freeze({ key: 'maker', name: 'From the maker' })]);
  // ready looks for a text card: font, colours, layout (classes in the stylesheet; no picture is made)
  const LOOKS = Object.freeze([
    Object.freeze({ key: 'clean', name: 'Clean', what: 'Simple letters, lots of white.' }), Object.freeze({ key: 'warm', name: 'Warm', what: 'Soft cream and brown, rounded letters.' }),
    Object.freeze({ key: 'bold', name: 'Bold', what: 'Big dark letters on a strong colour.' }), Object.freeze({ key: 'classic', name: 'Classic', what: 'Bookish letters, centred.' }),
    Object.freeze({ key: 'fresh', name: 'Fresh', what: 'Green and light, text to the left.' }), Object.freeze({ key: 'night', name: 'Night', what: 'Light letters on dark.' })]);

  const str = (v, max) => (typeof v === 'string' ? v : (typeof v === 'number' && isFinite(v) ? String(v) : '')).replace(/\s+/g, ' ').trim().slice(0, max || 2000);
  const obj = (v) => (v !== null && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const upFirst = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
  const endStop = (t) => (/[.!?…]$/.test(t) ? t : t + '.');
  // the story cut to fit, at a word, never in the middle of one
  function fit(text, max) {
    if (text.length <= max) return text;
    const cut = text.slice(0, Math.max(0, max - 1)); const at = cut.lastIndexOf(' ');
    let out = at > 20 ? cut.slice(0, at) : cut, end = out.length;
    while (end > 0 && ' ,;:.-\t\n'.indexOf(out.charAt(end - 1)) !== -1) end -= 1;   // no dangling comma or dash before the mark
    return out.slice(0, end) + '…';
  }
  const firstSentence = (t) => { const m = /^(.{10,}?[.!?])(\s|$)/.exec(t); return m ? m[1] : t; };

  function checkInput(input) {
    const i = obj(input), product = str(i.product, 200), story = str(i.story, 2000), problems = [];
    if (product.length < 2) problems.push('Type the product\'s name.');
    if (product.length > 80) problems.push('The product\'s name is too long (80 characters at most).');
    if (story.length < 20) problems.push('Write your story in a sentence or two (at least 20 characters): what it is, who it is for, or what a customer said.');
    if (story.length > 600) problems.push('The story is too long (600 characters at most). One or two sentences work best.');
    return { ok: problems.length === 0, problems: problems, product: product, story: story };
  }

  // neutral wording only: openers and closers carry no fact about the product
  const OPEN = {
    plain: ['Meet {p}.', 'This is {p}.', 'About {p}.'],
    friendly: ['Say hello to {p}!', 'We want you to meet {p}.', 'Here is {p}, and we love it.'],
    premium: ['Introducing {p}.', '{p}, made with care.', 'Discover {p}.'] };
  const CLOSE = {
    plain: ['See it on our site.', 'Find it in our shop.', 'Take a look.'],
    friendly: ['Come take a look!', 'We would love for you to try it.', 'Have a look, we think you will like it.'],
    premium: ['Yours to discover.', 'See the details in our shop.', 'A closer look awaits.'] };
  const ASK = { plain: ['Looking for something new for your routine?', 'Curious about {p}?', 'Have you seen {p} yet?'],
    friendly: ['Ready for a new favourite?', 'Have you met {p} yet?', 'Want to know what we have been working on?'],
    premium: ['In search of something considered?', 'Have you discovered {p}?', 'What belongs in your routine?'] };
  const GIFT = { plain: ['For you, or for someone you care about.', 'A gift idea: {p}.', 'Thinking of a gift?'],
    friendly: ['Spoil yourself, or someone you love!', 'Gift idea alert: {p}!', 'Know someone who would love this?'],
    premium: ['A thoughtful gift: {p}.', 'For someone who notices the details.', 'A gift worth giving.'] };
  const MAKER = { plain: ['A note from us about {p}.', 'From our hands to yours: {p}.', 'Why we made {p}.'],
    friendly: ['A little note from us about {p}!', 'We made {p}, and here is why.', 'From us to you: {p}.'],
    premium: ['A word from the maker of {p}.', 'The thinking behind {p}.', 'Made by us: {p}.'] };

  function compose(kind, angle, tone, v, product, story) {
    const p = (t) => t.replace(/\{p\}/g, product);
    const open = p(OPEN[tone][v]), close = CLOSE[tone][v], one = endStop(upFirst(firstSentence(story))), all = endStop(upFirst(story));
    if (kind === 'adHeadline') {
      const heads = { story: fit(upFirst(firstSentence(story)).replace(/[.!?]$/, ''), 40), product: product, question: p(ASK[tone][v]), short: p(['Meet {p}', '{p} is here', 'Try {p}'][v]),
        gift: p(GIFT[tone][v]).replace(/[.!]$/, ''), maker: p(MAKER[tone][v]).replace(/[.!]$/, '') };
      return heads[angle];
    }
    const room = KINDS[kind].limit;
    const build = { story: (s) => s + ' ' + open + ' ' + close, product: (s) => open + ' ' + s + ' ' + close, question: (s) => p(ASK[tone][v]) + ' ' + s + ' ' + close,
      short: (s) => [product + ': ' + s, s + ' That is ' + product + '.', product + '. ' + s][v], gift: (s) => p(GIFT[tone][v]) + ' ' + s + ' ' + close, maker: (s) => p(MAKER[tone][v]) + ' ' + s + ' ' + close };
    const base = kind === 'adText' ? one : all;
    const frame = build[angle]('').length;                 // what the wording around the story takes
    return build[angle](fit(base, Math.max(24, room - frame))).replace(/\s+/g, ' ').trim();
  }

  function scan(text, deps) {
    const c = deps && deps.claims && typeof deps.claims.scan === 'function' ? deps.claims.scan(text) : null;
    if (!c) return { blocked: true, findings: [{ family: 'unavailable', match: 'the wording check is not available' }] };   // fails closed
    const f = Array.isArray(c.findings) ? c.findings : [];
    return { blocked: f.length > 0, findings: f };
  }

  // one option; null when it cannot fit (a name too long for a headline is left out, never cut)
  function make(kind, angle, tone, v, product, story, deps) {
    const text = compose(kind, angle.key, tone, v, product, story);
    if (!text || text.length > KINDS[kind].limit) return null;
    const s = scan(text, deps);
    return { id: kind + '-' + tone + '-' + angle.key + '-' + v, kind: kind, tone: tone, angle: angle.key, angleName: angle.name, text: text, chars: text.length, limit: KINDS[kind].limit, blocked: s.blocked, findings: s.findings };
  }

  function options(input, deps) {
    const i = obj(input), c = checkInput(i);
    const kind = Object.prototype.hasOwnProperty.call(KINDS, i.kind) ? i.kind : null;
    const tone = Object.prototype.hasOwnProperty.call(TONES, i.tone) ? i.tone : 'plain';
    const count = Number.isInteger(i.count) && i.count >= 1 && i.count <= 6 ? i.count : 3;
    const problems = c.problems.slice();
    if (!kind) problems.push('Choose what to write: a post, an ad headline, an ad text or an email paragraph.');
    if (problems.length) return { ok: false, problems: problems, options: [], round: 0, rounds: 0, total: 0, last: false };
    // every angle in each of the three wordings, without repeats, then shown a few at a time
    const all = [];
    for (let slot = 0; slot < ANGLES.length * 3; slot += 1) {
      const o = make(kind, ANGLES[slot % ANGLES.length], tone, Math.floor(slot / ANGLES.length), c.product, c.story, deps);
      if (o && !all.some(x => x.text === o.text)) all.push(o);
    }
    const rounds = Math.max(1, Math.ceil(all.length / count));
    const round = Number.isInteger(i.round) && i.round >= 0 ? i.round % rounds : 0;
    return { ok: true, problems: [], options: all.slice(round * count, round * count + count), round: round, rounds: rounds, total: all.length, last: round === rounds - 1 };
  }

  // a 15-30 second video: what to say, and what to film (generic shots; nothing about the product is assumed)
  const SHOTS = [
    ['The product in your hand, close up, steady for two seconds.', 'You opening it or using it, in good light.', 'The label, filling the frame.', 'You, saying the last line to the camera.'],
    ['You, saying the first line to the camera.', 'The product on a plain surface, the camera slowly moving closer.', 'A close-up of it being used.', 'The product and its box together, steady for two seconds.'],
    ['A hand placing the product into the frame.', 'The label, filling the frame.', 'You using it, from the side.', 'The product alone, steady, while the last line is read.']];
  function video(input, deps) {
    const i = obj(input), c = checkInput(i);
    const tone = Object.prototype.hasOwnProperty.call(TONES, i.tone) ? i.tone : 'plain';
    const v = Number.isInteger(i.round) && i.round >= 0 ? i.round % 3 : 0;
    if (!c.ok) return { ok: false, problems: c.problems, script: [], shots: [], blocked: false, findings: [], round: v, rounds: 3, last: false };
    const script = [OPEN[tone][v].replace(/\{p\}/g, c.product), fit(endStop(upFirst(c.story)), 220), CLOSE[tone][v]];
    const s = scan(script.join(' '), deps);
    return { ok: true, problems: [], script: script, shots: SHOTS[v].slice(), blocked: s.blocked, findings: s.findings, round: v, rounds: 3, last: v === 2 };
  }

  // one week of drafts: what to put out on which day (a suggestion; nothing is scheduled or posted)
  const WEEK = [['Monday', 'post', 'story'], ['Tuesday', 'adHeadline', 'product'], ['Tuesday', 'adText', 'product'], ['Wednesday', 'post', 'question'],
    ['Thursday', 'email', 'maker'], ['Friday', 'video', ''], ['Saturday', 'post', 'gift'], ['Sunday', 'rest', '']];
  function week(input, deps) {
    const i = obj(input), c = checkInput(i);
    const tone = Object.prototype.hasOwnProperty.call(TONES, i.tone) ? i.tone : 'plain';
    const v = Number.isInteger(i.round) && i.round >= 0 ? i.round % 3 : 0;
    if (!c.ok) return { ok: false, problems: c.problems, days: [], blocked: 0, round: v, rounds: 3, last: false };
    const days = WEEK.map(([day, kind, angleKey]) => {
      if (kind === 'rest') return { day: day, kind: 'rest', kindName: 'Rest', text: 'Nothing new today. Read the week\'s comments and messages and answer them.', blocked: false, findings: [] };
      if (kind === 'video') { const r = video({ product: c.product, story: c.story, tone: tone, round: v }, deps); return { day: day, kind: 'video', kindName: 'Short video', text: r.script.join(' '), shots: r.shots, blocked: r.blocked, findings: r.findings }; }
      const o = make(kind, ANGLES.find(a => a.key === angleKey), tone, v, c.product, c.story, deps);
      return o ? { day: day, kind: kind, kindName: KINDS[kind].name, text: o.text, blocked: o.blocked, findings: o.findings } : null;
    }).filter(Boolean);
    return { ok: true, problems: [], days: days, blocked: days.filter(d => d.blocked).length, round: v, rounds: 3, last: v === 2 };
  }

  // the owner's own wording: checked the same way, against the same length
  function checkOwn(text, kind, deps) {
    const t = str(text, 4000), k = Object.prototype.hasOwnProperty.call(KINDS, kind) ? KINDS[kind] : null, limit = k ? k.limit : 500;
    if (!t) return { ok: false, empty: true, chars: 0, limit: limit, tooLong: false, blocked: false, findings: [] };
    const s = scan(t, deps);
    return { ok: !s.blocked && t.length <= limit, empty: false, chars: t.length, limit: limit, tooLong: t.length > limit, blocked: s.blocked, findings: s.findings };
  }

  return { KINDS, TONES, ANGLES, LOOKS, checkInput, options, video, week, checkOwn };
}));
