// Printing on the owner's printers (Nov 23). The owner bought a Brother
// MFC-J1365DW (colour inkjet, US Letter: invoices, packing slips, reports,
// backups) and a Rollo Wireless Label Printer (4 x 6 inch thermal, black only).
// Checks: the 4 x 6 slip model (rows per label, never prices); the label sheet is
// on only while a label slip prints; the browser's own PDF of each printout has
// the right paper size (4 x 6 = 288 x 432 points, Letter = 612 x 792); and every
// printout is black on white whatever look or dark mode is on screen, so the
// Brother uses only its black cartridge. Synthetic data; nothing is sent to a
// printer (window.print is replaced, the PDF is made by the test browser).
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const INV = require('../../assets/invoice/he-invoice.js');

const lines = (n) => Array.from({ length: n }, (_, i) => ({ sku: 'SYN-SKU-' + (i + 1), quantity: i + 1, lotNumber: 'LOT-' + (i + 1), unitPrice: 5 }));
// page sizes of every page in a PDF, in points, rounded
function pdfPages(buf) {
  const s = buf.toString('latin1');
  return [...s.matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map(m => Math.round(+m[1]) + 'x' + Math.round(+m[2]));
}
async function openPreview(page, extra) {
  await page.addInitScript((x) => {
    try { localStorage.setItem('he_invoice_preview', 'on'); Object.keys(x || {}).forEach(k => localStorage.setItem(k, x[k])); } catch (e) {}
    window.print = () => {};
  }, extra || {});
  await login(page);
  await gotoPage(page, 'reportHistoryPanel');
  await expect(page.locator('#invoicePreviewHost [data-print="slip4x6"]')).toBeVisible();
}

test.describe('the 4 x 6 label slip model', () => {
  test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

  test('7 lines per label, heading on every label, never prices; Letter is unchanged', () => {
    const slip = INV.packingSlip({ orderId: 'SYN-1', allocations: lines(20), showPrices: true });
    const label = INV.packingSlipPrint(slip, { page: INV.LABEL_4X6.page });
    expect(label.page.page).toBe('label-4x6');
    expect(label.pageCount).toBe(3);
    expect(label.pages.map(p => p.rows.length)).toEqual([7, 7, 6]);
    expect(label.pages.every(p => p.headings.join() === 'Item,Qty,Lot')).toBe(true);
    expect(label.showPrices).toBe(false);
    expect(label.note).toMatch(/not an invoice and not a carrier label/);
    const letter = INV.packingSlipPrint(slip);
    expect(letter.page.page).toBe('us-letter');
    expect(letter.pageCount).toBe(1);
    expect(letter.showPrices).toBe(true);
    expect(letter.pages[0].headings).toEqual(['Item', 'Qty', 'Lot', 'Unit']);
    // nothing given -> nothing breaks
    expect(INV.packingSlipPrint(null, { page: 'label-4x6' }).pageCount).toBe(1);
  });
});

test('the label sheet is on only while a label slip prints', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'run once');
  await openPreview(page);
  const sheet = page.locator('#labelPrintCss');
  await expect(sheet).toHaveAttribute('media', 'not all');
  await page.locator('#invoicePreviewHost [data-print="slip4x6"]').click();
  await expect(sheet).toHaveAttribute('media', 'print');
  const host = page.locator('#invoicePrintHost');
  await expect(host.locator('.printPage[data-printsize="4x6"]')).toHaveCount(1);
  await expect(host.locator('.labelOrder')).toHaveText('Order SYN-preview');
  await expect(host.locator('thead th')).toHaveText(['Item', 'Qty', 'Lot']);
  await expect(host).toContainText('not an invoice, not a carrier label');
  // the print window closes -> back to Letter
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(sheet).toHaveAttribute('media', 'not all');
  // an invoice right after a label stays Letter even if the print window never reported closing
  await page.locator('#invoicePreviewHost [data-print="slip4x6"]').click();
  await page.locator('#invoicePreviewHost [data-print="invoice"]').click();
  await expect(sheet).toHaveAttribute('media', 'not all');
  await page.locator('#invoicePreviewHost [data-print="slip"]').click();
  await expect(sheet).toHaveAttribute('media', 'not all');
  await expect(host.locator('.printPage[data-printsize="letter"]')).toHaveCount(1);
});

test('the printouts come out on the right paper: 4 x 6 label, Letter invoice and slip', async ({ page, browserName }, ti) => {
  test.skip(ti.project.name !== 'desktop' || browserName !== 'chromium', 'PDF needs Chromium; run once');
  await openPreview(page);
  const pdf = () => page.pdf({ preferCSSPageSize: true, printBackground: false });
  await page.locator('#invoicePreviewHost [data-print="slip4x6"]').click();
  expect(pdfPages(await pdf())).toEqual(['288x432']);
  await page.locator('#invoicePreviewHost [data-print="slip"]').click();
  expect(pdfPages(await pdf())).toEqual(['612x792']);
  await page.locator('#invoicePreviewHost [data-print="invoice"]').click();
  expect(pdfPages(await pdf())).toEqual(['612x792']);
});

for (const look of [null, 'aurora', 'graphite', 'original-plus']) {
  test('every printout is black on white, dark mode on screen' + (look ? ', look ' + look : ', today\'s look'), async ({ page }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    await page.emulateMedia({ colorScheme: 'dark' });
    await openPreview(page, look ? { he_new_look: 'on', he_look: look } : {});
    for (const what of ['invoice', 'slip', 'slip4x6']) {
      await page.locator('#invoicePreviewHost [data-print="' + what + '"]').click();
      await page.emulateMedia({ media: 'print', colorScheme: 'dark' });
      const bad = await page.locator('#invoicePrintHost').evaluate((root) => {
        const out = [];
        for (const el of [root, ...root.querySelectorAll('*')]) {
          const cs = getComputedStyle(el);
          if (cs.display === 'none') continue;
          if (cs.color !== 'rgb(0, 0, 0)') out.push(el.className + ' text ' + cs.color);
          if (!/^rgba\(0, 0, 0, 0\)$|^transparent$/.test(cs.backgroundColor)) out.push(el.className + ' fill ' + cs.backgroundColor);
          if (cs.backgroundImage !== 'none') out.push(el.className + ' image ' + cs.backgroundImage);
          for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
            if (parseFloat(cs['border' + side + 'Width']) > 0 && cs['border' + side + 'Style'] !== 'none' && cs['border' + side + 'Color'] !== 'rgb(0, 0, 0)') out.push(el.className + ' line ' + cs['border' + side + 'Color']);
          }
        }
        return out;
      });
      expect(bad, what).toEqual([]);
      expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), what).toBe('rgb(255, 255, 255)');
      await page.emulateMedia({ media: 'screen', colorScheme: 'dark' });
    }
  });
}

test('the printout typefaces load from this site and the invoice and label use them', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'run once');
  const fonts = [];
  page.on('response', r => { if (/\/assets\/fonts\/.+\.woff2/.test(r.url())) fonts.push(r.status()); });
  await openPreview(page);
  await expect.poll(() => page.evaluate(() => document.fonts.check('600 12px "HE Display"') && document.fonts.check('500 12px "HE Text"'))).toBe(true);
  expect(fonts.length).toBeGreaterThan(0);
  expect(fonts.every(s => s === 200)).toBe(true);
  await page.locator('#invoicePreviewHost [data-print="invoice"]').click();
  await page.emulateMedia({ media: 'print' });
  const fam = (sel) => page.locator(sel).first().evaluate(el => getComputedStyle(el).fontFamily);
  expect(await fam('#invoicePrintHost .printGrand')).toMatch(/^"HE Display"/);
  expect(await fam('#invoicePrintHost th')).toMatch(/^"HE Text"/);
  // a signature line (room above for a signature or stamp) and a date line beside the totals (invoice only; the label has none)
  await expect(page.locator('#invoicePrintHost [data-printsign] .printSignLine')).toHaveText(['Authorized signature / stamp', 'Date']);
  const sign = await page.locator('#invoicePrintHost [data-printsign] .printSignLine').first().boundingBox();
  const totals = await page.locator('#invoicePrintHost .printTotals').boundingBox();
  expect(sign.x + sign.width).toBeLessThan(totals.x);
  expect(sign.y).toBeGreaterThan(totals.y);
  await expect(page.locator('#invoicePrintHost [data-printsign]')).toHaveCount(1);
  await page.emulateMedia({ media: 'screen' });
  await page.locator('#invoicePreviewHost [data-print="slip4x6"]').click();
  await page.emulateMedia({ media: 'print' });
  expect(await fam('#invoicePrintHost .labelOrder')).toMatch(/^"HE Display"/);
  expect(await fam('#invoicePrintHost .printPage')).toMatch(/^"HE Text"/);
  await expect(page.locator('#invoicePrintHost [data-printsign]')).toHaveCount(0);
  // the closing: thank-you line and the owner's sign-off (the earlier "With gratitude" line is gone)
  await expect(page.locator('#invoicePrintHost .printFoot')).toContainText('Thank you for choosing Health Endeavors.');
  await expect(page.locator('#invoicePrintHost [data-printsignoff]')).toHaveText('We appreciate your business');
  await expect(page.locator('#invoicePrintHost')).not.toContainText(/gratitude/i);
});

test('print stylesheets change nothing on screen', async ({ page }) => {
  await login(page);
  // the print sheets exist and are not applied on screen
  await expect(page.locator('link[href^="assets/print/he-print.css"]')).toHaveAttribute('media', 'print');
  await expect(page.locator('#labelPrintCss')).toHaveAttribute('media', 'not all');
  await expect(page.locator('#invoicePrintHost')).toBeHidden();
});
