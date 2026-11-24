// Money per channel (owner, Nov 24, gap 4): each sales channel's own money report,
// chosen as a file and read in the browser: what the channel really paid and
// charged, the real fee rate next to the Real profit estimate, and its payouts
// against the bank export. assets/reports/he-channel-money.js; Accounting, behind
// he_channel_money (OFF, on Feature Flags). Every value and every file is made up.
const C = require('../../assets/reports/he-channel-money.js');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { unnamedControls, contrastFailures } = require('../helpers/a11y-audit');

const node = (ti) => test.skip(ti.project.name !== 'desktop', 'Node-only; run once');
const file = (name, text) => ({ name, mimeType: 'text/csv', buffer: Buffer.from(text, 'utf8') });

const ETSY = `Date,Type,Title,Info,Currency,Amount,Fees & Taxes,Net
"November 20, 2026",Deposit,"$41.07 sent to your bank account",,USD,--,--,--
"November 12, 2026",Sale,"Payment for Order #3000000001",,USD,$27.00,--,$27.00
"November 12, 2026",Fee,"Transaction fee: SYN Lavender oil","Order #3000000001",USD,--,-$1.63,-$1.63
"November 12, 2026",Fee,"Processing fee","Order #3000000001",USD,--,-$1.06,-$1.06
"November 12, 2026",Tax,"Sales tax paid by buyer","Order #3000000001",USD,--,-$2.00,-$2.00
"November 13, 2026",Shipping,"USPS shipping label","Label #1",USD,--,-$4.15,-$4.15
"November 14, 2026",Sale,"Payment for Order #3000000002",,USD,$25.00,--,$25.00
"November 14, 2026",Fee,"Listing fee","Listing #1",USD,--,-$0.20,-$0.20
"November 15, 2026",Refund,"Refund to buyer for Order #3000000002",,USD,-$25.00,--,-$25.00
"November 16, 2026",Marketing,"Etsy Ads",,USD,--,-$1.00,-$1.00
not a date,Sale,"x",,USD,$1.00,--,$1.00
`;
const AMAZON = `"Includes Amazon Marketplace, Fulfillment by Amazon (FBA), and Amazon Webstore transactions"
"All amounts in USD, unless specified"
"date/time","settlement id","type","order id","sku","description","quantity","marketplace","fulfillment","product sales","product sales tax","shipping credits","shipping credits tax","promotional rebates","marketplace withheld tax","selling fees","fba fees","other transaction fees","other","total"
"Nov 10, 2026 9:15:01 AM PST","111","Order","113-0000001-0000001","LAV-30","SYN Lavender oil","1","amazon.com","Seller","20.00","1.60","3.00","0","0","-1.60","-3.45","0","0","0","19.55"
"Nov 11, 2026 9:15:01 AM PST","111","Order","113-0000002-0000002","LAV-30","SYN Lavender oil","2","amazon.com","Seller","40.00","3.20","0","0","0","-3.20","-6.00","0","0","0","34.00"
"Nov 12, 2026 9:15:01 AM PST","111","Service Fee","","","Subscription","","","","0","0","0","0","0","0","0","0","0","-39.99","-39.99"
"Nov 14, 2026 9:15:01 AM PST","111","Transfer","","","To your account ending 0000","","","","0","0","0","0","0","0","0","0","0","0","-13.56"
`;
const TIKTOK = `Order/adjustment ID,Type,Order settled time,Total settlement amount,Total revenue,Total fees
577000000000000001,Order,2026/11/12,17.40,20.00,-2.60
577000000000000002,Refund,2026/11/13,-17.40,-20.00,2.60
`;

test.describe('reading the reports (no browser)', () => {
  test('Etsy: sales, refunds, fees, postage labels, tax held, the payout; a bad line is listed, not guessed', ({}, ti) => {
    node(ti);
    const p = C.parseReport(ETSY, 'etsy');
    expect(p).toMatchObject({ ok: true, channel: 'etsy', confirmed: true, from: '2026-11-12', to: '2026-11-20' });
    expect(p.rows).toHaveLength(10);
    expect(p.problems).toEqual(['Line 12: the date "not a date" could not be read.']);
    const s = C.summarize(p.rows);
    // sales 27 + 25; refund -25; fees 1.63 + 1.06 + 0.20 + 1.00 (ads); label 4.15; tax 2.00; net 16.96
    expect(s).toMatchObject({ orders: 2, sales: 5200, refunds: -2500, fees: -389, postage: -415, tax: -200, net: 1696, payoutTotal: 4107, feePercent: 14.4 });
    expect(s.payouts).toEqual([{ day: '2026-11-20', cents: 4107, label: '$41.07 sent to your bank account' }]);
    expect(C.expectedDeposits(p)).toEqual([{ ref: 'etsy-payout-2026-11-20-1', kind: 'other', date: '2026-11-20', amountCents: 4107, label: 'Etsy payout of $41.07' }]);
  });

  test('Amazon: found by column names under the notes lines; tax the marketplace keeps is not sales; the transfer is the payout', ({}, ti) => {
    node(ti);
    const p = C.parseReport(AMAZON, 'amazon');
    expect(p).toMatchObject({ ok: true, channel: 'amazon', confirmed: false, from: '2026-11-10', to: '2026-11-14' });
    expect(p.used).toMatchObject({ day: 'date/time', net: 'total', gross: 'product sales + shipping credits + promotional rebates', fees: 'selling fees + fba fees + other transaction fees' });
    const s = C.summarize(p.rows);
    expect(s).toMatchObject({ orders: 2, sales: 6300, refunds: 0, fees: -4944, tax: 0, net: 1356, payoutTotal: 1356, feePercent: 78.5 });
  });

  test('TikTok Shop: found by column names; a refund reverses the sale and its fee', ({}, ti) => {
    node(ti);
    const p = C.parseReport(TIKTOK);                       // recognised without being told the channel
    expect(p).toMatchObject({ ok: true, channel: 'tiktok', confirmed: false });
    expect(C.summarize(p.rows)).toMatchObject({ orders: 1, sales: 2000, refunds: -2000, fees: 0, net: 0, feePercent: null });
  });

  test('the real fees against the estimate', ({}, ti) => {
    node(ti);
    const s = C.summarize(C.parseReport(ETSY).rows);       // fees $3.89 on $27.00 after refunds, 2 orders
    expect(C.feeCheck(s, { percent: 9.5, perOrder: 0.45 })).toMatchObject({ verdict: 'close', actualCents: 389, estimateCents: 347 });
    expect(C.feeCheck(s, { percent: 2, perOrder: 0 })).toMatchObject({ verdict: 'higher', differenceCents: 335 });
    expect(C.feeCheck(s, { percent: 2, perOrder: 0 }).message).toBe('Fees were $3.89 (14.4% of sales). Your estimate gives $0.54: the real fees are $3.35 higher. Raise the estimate.');
    expect(C.feeCheck(s, { percent: 30, perOrder: 1 }).verdict).toBe('lower');
    expect(C.feeCheck(s, { percent: null, perOrder: null })).toMatchObject({ verdict: 'no_estimate', actualPercent: 14.4 });
    expect(C.feeCheck(C.summarize([]), { percent: 5, perOrder: 0 }).verdict).toBe('unknown');
  });

  test('what is refused, in plain words; malformed input never throws', ({}, ti) => {
    node(ti);
    expect(C.parseReport('').reason).toBe('The file is empty.');
    expect(C.parseReport(null).reason).toBe('The file is empty.');
    expect(C.parseReport('a,b\n1,2').reason).toBe('The columns of this file were not recognised as an Etsy, Amazon or TikTok Shop money report.');
    expect(C.parseReport(ETSY, 'amazon').reason).toMatch(/^This does not look like the Amazon report: its columns were not found\./);
    expect(C.parseReport(ETSY, 'ebay').reason).toBe('This channel is not known.');
    expect(C.parseReport('x'.repeat(C.MAX_BYTES + 1)).reason).toBe('The file is larger than 5 MB; export a shorter period.');
    expect(C.parseReport('Date,Type,Title,Info,Currency,Amount,Fees & Taxes,Net\n"November 12, 2026",Sale,"x",,USD,abc,--,--\n')).toMatchObject({ ok: false, reason: 'No line in the file could be read.' });
    expect(C.summarize([null, 'x', {}, { day: '2026-11-12', kind: 'sale', gross: 'abc' }])).toMatchObject({ lines: 1, sales: 0, orders: 1 });
    expect([C.toCents('$1,234.56'), C.toCents('-$12.00'), C.toCents('(12.00)'), C.toCents('12.00 USD'), C.toCents('--', true), C.toCents('--'), C.toCents('1.234')]).toEqual([123456, -1200, -1200, 1200, 0, null, null]);
    expect([C.toDay('November 12, 2026'), C.toDay('Nov 10, 2026 9:15:01 AM PST'), C.toDay('2026/11/12'), C.toDay('11/12/2026'), C.toDay('February 30, 2026'), C.toDay('soon')]).toEqual(['2026-11-12', '2026-11-10', '2026-11-12', '2026-11-12', null, null]);
  });
});

// a Chase checking export with the Etsy payout in it (the bank side, he-money-match)
const CHASE = `Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #,
CREDIT,11/20/2026,"ETSY INC PAYOUT SYNTHETIC",41.07,ACH_CREDIT,1041.07,,
CREDIT,11/18/2026,"SYN TRANSFER FROM SAVINGS",100.00,ACCT_XFER,1000.00,,
`;

test.describe('on Accounting', () => {
  test('off by default: the page is unchanged', async ({ page }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    await login(page); await gotoPage(page, 'accountingPanel');
    await expect(page.locator('#acctStats')).toBeVisible();
    await expect(page.locator('#channelMoneyHost')).toHaveCount(0);
  });

  test('on: a report is read in the browser; real fees next to the estimate; payouts checked against the bank; nothing is sent', async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    const sent = [];
    page.on('request', r => { if (/SYN Lavender|3000000001|sent to your bank/.test(r.url() + (r.postData() || ''))) sent.push(r.method() + ' ' + r.url()); });
    await page.addInitScript(() => { try { localStorage.setItem('he_channel_money', 'on'); localStorage.setItem('he_money_match', 'on'); } catch (e) {} });
    await login(page); await gotoPage(page, 'accountingPanel');
    const host = page.locator('#channelMoneyHost');
    await expect(host.locator('h3')).toHaveText('Money per channel');
    expect(await page.evaluate(() => document.getElementById('moneyMatchHost').nextElementSibling.id)).toBe('channelMoneyHost');
    await expect(host.locator('.empty')).toContainText('No report chosen yet.');   // (an icon may be added in front)
    // a file that is not that channel's report is refused in plain words
    await host.locator('#cmFile_amazon').setInputFiles(file('etsy.csv', ETSY));
    await expect(host.locator('[data-cmmessage]')).toContainText('etsy.csv: This does not look like the Amazon report');
    await expect(host.locator('[data-cmchannel]')).toHaveCount(0);
    // the Etsy report
    await host.locator('#cmFile_etsy').setInputFiles(file('etsy-november.csv', ETSY));
    await expect(host.locator('[data-cmmessage]')).toHaveText('etsy-november.csv read: 10 lines. Nothing was uploaded.');
    const etsy = host.locator('[data-cmchannel="etsy"]');
    await expect(etsy.locator('h4')).toHaveText('Etsy · Nov 12, 2026 to Nov 20, 2026');
    await expect(etsy.locator('tr', { hasText: 'Sales' }).first()).toContainText('$52.00');
    await expect(etsy.locator('tr', { hasText: 'Fees' })).toContainText('-$3.89');
    await expect(etsy.locator('tr', { hasText: 'Fees' })).toContainText('14.4% of sales');
    await expect(etsy.locator('tr', { hasText: 'Postage labels' })).toContainText('-$4.15');
    await expect(etsy.locator('tr', { hasText: 'Sales tax held by the channel' })).toContainText('not your money');
    await expect(etsy.locator('tr', { hasText: 'Paid to your bank' })).toContainText('$41.07');
    await expect(etsy.locator('[data-cmfee]')).toHaveAttribute('data-cmfee', 'close');
    await expect(etsy).toContainText('1 could not be read');
    await expect(etsy.locator('[data-cmbank]')).toContainText('To check them against your bank, choose your bank export under Money matching.');
    await expect(etsy.locator('[data-cmunconfirmed]')).toHaveCount(0);          // Etsy's layout is the documented one
    // the bank export, chosen under money matching: the payout is found
    await page.locator('#moneyMatchHost #mmBank').setInputFiles(file('chase.csv', CHASE));
    await expect(etsy.locator('[data-cmbank="checked"] li')).toHaveCount(1);
    await expect(etsy.locator('[data-cmoutcome="MATCHED"]')).toContainText('Matched · Etsy payout of $41.07');
    // Amazon: read by column names, and it says so
    await host.locator('#cmFile_amazon').setInputFiles(file('amazon.csv', AMAZON));
    const amazon = host.locator('[data-cmchannel="amazon"]');
    await expect(amazon.locator('[data-cmunconfirmed]')).toContainText('has not been checked against one of your real exports yet');
    await expect(amazon).toContainText('Net: total');
    await expect(amazon.locator('[data-cmfee]')).toHaveAttribute('data-cmfee', 'higher');
    await expect(amazon.locator('[data-cmoutcome="MISSING"]')).toHaveCount(1);   // its $13.56 transfer is not in this bank file
    // remove
    await etsy.getByRole('button', { name: 'Remove the Etsy report' }).click();
    await expect(host.locator('[data-cmchannel="etsy"]')).toHaveCount(0);
    await expect(host.locator('[data-cmchannel="amazon"]')).toHaveCount(1);
    expect(sent).toEqual([]);
    expect(backend.requests.filter(r => r.method && r.method !== 'GET' && r.method !== 'HEAD' && !r.rpc && String(r.path || '').startsWith('/rest/v1/')).map(r => r.method + ' ' + r.path)).toEqual([]);
  });

  test('readable in light and dark; named controls; fits a phone', async ({ page }, ti) => {
    await page.addInitScript(() => { try { localStorage.setItem('he_channel_money', 'on'); } catch (e) {} });
    await login(page);
    const check = (loc) => loc.evaluate((root, src) => (new Function('return ' + src)())(root), contrastFailures.toString());
    for (const scheme of ti.project.name === 'desktop' ? ['light', 'dark'] : ['light']) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await gotoPage(page, 'accountingPanel');
      await page.locator('#channelMoneyHost #cmFile_etsy').setInputFiles(file('etsy.csv', ETSY));
      await expect(page.locator('#channelMoneyHost [data-cmchannel="etsy"]')).toHaveCount(1);   // the section redraws after each file: wait before the next
      await page.locator('#channelMoneyHost #cmFile_amazon').setInputFiles(file('amazon.csv', AMAZON));
      await expect(page.locator('#channelMoneyHost [data-cmchannel]')).toHaveCount(2);
      await page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))));
      expect(await check(page.locator('#channelMoneyHost')), scheme).toEqual([]);
      expect(await page.locator('#channelMoneyHost').evaluate(unnamedControls), scheme).toEqual([]);
    }
    if (ti.project.name === 'iphone') expect(await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth)).toBeLessThanOrEqual(1);
  });
});
