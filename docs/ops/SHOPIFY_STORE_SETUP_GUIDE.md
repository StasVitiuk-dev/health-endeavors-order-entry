# Shopify store setup: click by click (launch plan, days 6 and 8)

Status: **PROPOSED** · written Nov 28, 2026 (night) for `LAUNCH_PLAN_2_WEEKS.md` days 6 (simple theme) and
8 (payments, shipping, policies). **Shopify stays off-limits to Claude** unless you approve a specific task;
these are steps **you** click. Shopify renames menus now and then: if a name below doesn't match what you
see, send a screenshot and Claude finds the new place. Never paste passwords, bank numbers, tax IDs or ID
photos into chat; they go only into Shopify's own forms.

Order: do the sections in this order. Each is 10–20 minutes. Stop after any section.

| Section | When (plan day) | Needs first |
|---|---|---|
| A. Store details | any time | the business's legal name and official address (as registered) |
| B. Simple theme | day 6 | logo file (PNG), two brand colours |
| C. Products | day 4–6 | the product list from the lab (R8) and photos |
| D. Payments | day 8 | business bank account, EIN (from the IRS letter) |
| E. Shipping | day 8 | decisions P5–P7 in the store policy drafts (sent to you as a file on Nov 28, not kept in this public repository until you decide where store texts live); one packed box weighed |
| F. Taxes | day 8 | your tax answers (Illinois registration and rate; plan item 3) |
| G. Policies | day 8 | the store policy drafts approved |
| H. Checkout and notifications | day 8 | the `support@` address (email provider decision) |
| I. Before opening | day 11 | everything above; then the test order (`TEST_ORDER_CHECKLIST.md`) |

## A. Store details (5 minutes)

1. Shopify admin → **Settings** (bottom left) → **General** (or "Store details").
2. **Store name:** the brand name customers see.
3. **Store contact email:** `support@` (until it exists, leave the current one and change it later).
4. **Billing information / Business address:** the **official business address**, exactly as registered.
   Not a home address (see `TIKTOK_SHOP_SETUP_CHECKLIST.md`, item 9).
5. **Store currency:** US dollar. **Time zone:** Central Time (the dashboard counts days in Central time).
6. **Units:** pounds and ounces.
7. Save. Screenshot.

## B. Simple theme (20–40 minutes)

The custom website comes after launch; the store opens with Shopify's free theme **Dawn** (or "Horizon"
if Shopify now offers that as its free default).

1. **Online Store → Themes.** If Dawn is not there: **Add theme → Shopify themes → Dawn → Add**.
2. On Dawn: **Customize**.
3. **Theme settings** (the gear or paint-brush icon) → **Logo**: upload the logo PNG; **Colors**: set the
   two brand colours; **Typography**: one clean font for headings, one for text.
4. **Home page:** keep just four sections: a large image with one line about the brand, "Featured
   collection" (all products), "Image with text" (the brand story, two or three sentences), and the
   newsletter sign-up. Delete the rest (each section's ... menu → **Remove**).
5. **Footer:** add the menu "Policies" with the five policy pages (section G) and the Consumer Health Data
   Privacy page (the store policy drafts section 5, if the lawyer confirms it is needed).
6. **Product page:** show price, quantity, "Add to cart", description, and a "Ingredients" collapsible row.
7. **Save.** Do **not** publish the store yet (it stays password-protected until section I).
8. Screenshot the home page and one product page on the computer and on the phone.

Words on the pages: no medical claims ("treats", "cures", "heals"), same rule as the listings
(`TIKTOK_SHOP_SETUP_CHECKLIST.md`, item 13).

## C. Products (with the lab's list)

1. The lab's list goes into the dashboard's product import (Inventory → Import a product list, switch
   **Product list import**; `PRODUCT_IMPORT_GUIDE.md`). When every line is right, **Save for Shopify (CSV)**
   saves the same list as Shopify's import file (built Nov 28), so the products are typed once.
2. **Products → Import** → choose `products-for-shopify.csv` → **Upload and preview** → check one product → **Import**.
3. For each product, open it and check: photos, price, **SKU exactly as on the label**, weight (the file
   brings every product in with weight **0**, because the product list has no weights: type the packed
   weight of one bottle, so labels bought in Shopify are priced right; the flat shipping rate below does not
   use it), "Track quantity" **on**, and "Continue selling when out of stock" **off**.
4. Send Claude a screenshot of the product list. Claude compares SKUs with the dashboard's product list.

## D. Payments (10 minutes plus Shopify's checks)

1. **Settings → Payments.**
2. **Shopify Payments → Activate** (or "Complete account setup").
3. Choose **business type: company/LLC** (the business, not you personally), then enter the business's
   legal name, **EIN**, official address, and the bank account **in the business's name** for payouts.
   The representative's own details (name, date of birth, last digits of SSN) are asked for identity
   checks; type them only into this Shopify form.
4. **Statement descriptor:** the brand name customers will recognise on their card statement.
5. **Payout schedule:** daily or weekly (the dashboard's money matching works with either).
6. Leave **"Test mode"** on until the test order (section I).
7. Shopify may take 1–3 days to verify. Screenshot the "Payments" page when it says active.

Fees: Shopify Payments charges a card fee per order (in 2026 guides, about 2.9% + 30¢ on the Basic plan;
check your plan's page). The dashboard's "Money per channel" uses the real fee from the payout file.

## E. Shipping (15 minutes)

Decide P5–P7 in the store policy drafts first.

1. **Settings → Shipping and delivery.**
2. **General shipping rates → Manage.** Shipping origin: the **ship-from address** you choose (home or
   private mailbox; decision P8). Customers don't see this on the store, but it is printed on labels.
3. **Shipping zones:** keep **United States** only (delete other zones, or leave them with no rates).
4. Rates for the US zone, the simple choice for launch:
   - **Standard** flat rate: $[X] (Claude can suggest a number once one packed box is weighed and priced).
   - **Free** over $[threshold] (decision P7): add rate → "Free shipping" → condition "Based on order price"
     → minimum $[threshold].
5. **Packages:** add your real box size and empty weight (so carrier-calculated rates and labels are right).
6. **Shipping labels:** if you print labels in Shopify, set the Rollo label size to 4 × 6 inches.
7. Save. Screenshot.

## F. Taxes (10 minutes, after your tax answers)

1. **Settings → Taxes and duties → United States.**
2. **Collect sales tax** in **Illinois** (where you are registered) with your Illinois tax ID; add another
   state only when you register there (your accountant says when).
3. Keep **Shopify's automatic tax rates** (they include local rates) unless your accountant says otherwise.
4. "Charge tax on shipping rates": as your accountant says for Illinois.
5. The dashboard's tax screen holds the same rate for wholesale invoices (steps 8 and 6 of the database plan).
6. Screenshot.

## G. Policies (15 minutes)

1. **Settings → Policies.**
2. For each of **Return and refund**, **Privacy**, **Terms of service**, **Shipping**, **Contact
   information**: **Create from template**, then replace the text with the matching approved draft from
   the store policy drafts and fill the `[BRACKETS]`.
3. The Consumer Health Data Privacy page (section 5 of the drafts), if needed: **Online Store → Pages → Add
   page**, then link it in the footer **and** on the home page.
4. Save. Open the store preview and check every footer link opens.

## H. Checkout and notifications (10 minutes)

1. **Settings → Checkout:** customer contact = **email**; "Show a sign-up option at checkout" **on**, box
   **unchecked** by default (marketing only with consent); require first and last name.
2. **Settings → Notifications:** sender email = `support@`; open "Order confirmation" and "Shipping
   confirmation" and check the logo and store name look right. Change no other templates for launch.
3. **Settings → Users and permissions:** each person gets their own login; nobody shares the owner's.

## I. Before opening the store (day 11 onwards)

1. Run the test order: `TEST_ORDER_CHECKLIST.md` (fake card in test mode, then one real small order,
   refunded).
2. **Settings → Payments:** turn **test mode off**.
3. **Online Store → Preferences → Password protection:** off **only** on launch day, after the go/no-go
   (`LAUNCH_DAY_CHECKLIST.md`).

## What still needs a decision before these steps can finish

- How Shopify orders reach the dashboard at launch (R9). Today the order import runs in the private backups
  repository, which Claude does not open (`TEST_ORDER_CHECKLIST.md`, first table). **OWNER DECISION
  REQUIRED:** confirm that import is on and still working (path A), or choose path B, the read-only order
  program prepared Nov 28 (`sql-review/ITEM_24_SHOPIFY_ORDERS_PATH_B.md`; draft 42 is the payouts program and
  never reads orders). Design: `R9_SHOPIFY_ORDERS_DESIGN.md`. See `MORNING_LIST_2026-11-28.md`.
- The email provider (for `support@`), the returns address, the tax answers and the product list.

## Sources

- Shopify help, Adding store policies: https://help.shopify.com/en/manual/checkout-settings/refund-privacy-tos
- Shopify help, Choosing your store management settings: https://help.shopify.com/manual/intro-to-shopify/initial-setup/setup-store-management/
- 2026 setup guide (fees and shipping basics): https://websitesetup.org/build-online-store-shopify
