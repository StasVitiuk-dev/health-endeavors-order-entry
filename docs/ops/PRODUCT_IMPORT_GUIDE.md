# Adding your product list (import)

Status: CURRENT (built Nov 23, 2026; behind the **Product list import** switch, off) · for Stas.
Code: `assets/inventory/he-product-import.js` (the checker) and the Inventory page section.
Tests: `tests/specs/product-import-ext23.spec.js`.

## What it does

You fill in one spreadsheet with all your products. The dashboard checks **every line** and shows
what's wrong, in plain words, with the row number. **Nothing is added while any line has a
problem.** When everything is right, one button adds the new products. Products already in the
dashboard are never changed by the import. Running the same file twice adds nothing twice.

## Steps (about 15 minutes once the list is ready)

1. Dashboard → **Feature Flags** → Preview features → turn on **Product list import**.
2. **Inventory** → section **Import a product list** → **Download the template**.
3. Open it in Numbers, Excel or Google Sheets. One row per product:

   | Column | What to put | Example |
   |---|---|---|
   | name | the product name | Lavender Body Lotion |
   | size | the size (added to the name) | 8 oz |
   | sku | the product code; the same one goes in Shopify. Empty = the dashboard suggests one | HE-LAVENDER-8OZ |
   | retail_price | the price for customers | 24.00 |
   | wholesale_price | the price for stores | 12.00 |
   | cost | what one unit costs you (optional, for profit) | 4.50 |
   | status | **active** = selling now, **draft** = later | active |
   | packaging | optional | 8 oz glass jar |

   **Delete the two EXAMPLE rows.** No formulas or ingredient amounts: they are not needed here.
4. Save as **CSV** (Numbers: File → Export To → CSV; Excel: Save As → CSV; Google Sheets: File →
   Download → CSV).
5. Back on Inventory: **Your product list (CSV)** → choose the file. Every line appears with a result:
   - **New**: will be added.
   - **Already there**: identical product already in the dashboard, skipped.
   - **Already there, different**: same SKU with other details; listed, **not** changed (change it
     on the product itself if the file is right).
   - **Fix in the file**: the reason is shown in red. Fix the spreadsheet, save, choose it again.
6. Rows without a SKU: tick **Use the suggested SKU** if the suggestion is fine (then use the same
   SKU in Shopify), or type your own SKU in the file.
7. When the summary says "N products ready to add", press **Add N new products**.
8. Optional: **Save the checked list (CSV)** keeps a copy of what was checked.

## What it checks

- **Must fix:** no name; no SKU; a SKU with spaces or odd characters; the same SKU twice (capital
  letters don't count as different); a price that isn't a plain amount (use 12.50, not 12,50), is
  negative or has too many decimals; wholesale higher than retail; an unknown status; an active
  product without a retail price; a leftover EXAMPLE row.
- **Worth a look (doesn't block):** selling below cost; no cost; the same name twice; a name already
  in the dashboard under another SKU; a price above $500; a column it doesn't use.

## Limits

- Owner and administrators only. Up to 500 products and 1 MB per file.
- The list is read in your browser; only the new products are sent, the same way as **Add a product**.
- Shopify is not changed by this: products still have to be in Shopify with the **same SKUs**
  (launch item R8). A later step can compare the two lists.
