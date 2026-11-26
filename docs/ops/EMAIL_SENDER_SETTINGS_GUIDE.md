# Email on the business's own domain: the settings that keep it out of spam

Written November 26, 2026, at the owner's request ("Email set up on your own domain, with the
settings that stop your emails landing in spam"). Status: **PROPOSED** guide; nothing is set up yet.
This is point 3 of `docs/ops/EMAIL_SENDING_PLAN_2026-11-24.md` ("the domain's sender settings").

Related: which addresses and mailboxes, `docs/ops/BUSINESS_EMAIL_PLAN.md`; which sending service,
`docs/ops/EMAIL_SERVICE_COMPARISON_2026-11-24.md`.

## Before you start

- **Two choices come first** (OWNER DECISION REQUIRED): the mailbox provider (the plan proposes
  Google Workspace) and where the domain is managed (the company where the domain was bought, or
  Shopify if it was bought through Shopify). The steps below are written for Google Workspace and
  Shopify; other providers use the same three settings with their own values.
- **These settings are public on purpose.** Anyone on the internet can look them up; that is how
  inbox providers check them. A screenshot of the domain's settings page is fine to share with
  Claude. What is **never** shared: passwords, recovery codes, or the sign-in to the domain
  company or Google.
- **Claude never makes these changes.** You enter them, one at a time, with Claude guiding. Each
  change can be undone by deleting the line you added.
- Each setting can take **up to 48 hours** to be seen everywhere. That is normal.

## The three settings, in plain words

| Setting | What it proves | Where it goes |
|---|---|---|
| **SPF** | "These companies may send email for our domain" | one text line on the domain |
| **DKIM** | "This email was signed by our domain and not changed on the way" | one line per sender (Google, Shopify), each given to you by that sender |
| **DMARC** | "If an email fails the checks, here is what to do, and send us a report" | one text line on the domain, added last |

Gmail requires SPF or DKIM from every sender, and all three from large senders; Shopify needs a
DMARC line so the store's emails go out from the business's own address instead of a
`shopifyemail.com` one. Setting all three from the start is the safe choice.

## Step by step (one sitting of about 30 minutes, then a check two days later)

### Step 1. Mail delivery (MX): where email to the domain arrives

Done during Google Workspace sign-up. Google's current value is **one** line:

| Type | Host / name | Value | Priority |
|---|---|---|---|
| MX | `@` (or blank) | `smtp.google.com` | 1 |

- Some domain companies want a dot at the end (`smtp.google.com.`); use what their page shows.
- Remove old mail lines only when Google's setup page says to.

### Step 2. SPF: who may send

| Type | Host / name | Value |
|---|---|---|
| TXT | `@` (or blank) | `v=spf1 include:_spf.google.com ~all` |

- **Only one SPF line per domain.** If one already exists, change it instead of adding a second;
  two SPF lines break both.
- Shopify does **not** need to be added here: its own settings (step 4) cover it.
- If an email sending service is chosen later (Resend, Postmark, Amazon SES), it gives its own
  settings; Claude will check then whether this line changes.

### Step 3. DKIM for Google: the signature

1. In the Google Admin console: Apps → Google Workspace → Gmail → **Authenticate email**.
   Google lets you do this 24–72 hours after Gmail is turned on for the business.
2. Choose the domain, **Generate new record**, key length **2048**, prefix `google` (the default).
3. Google shows a host (`google._domainkey`) and a long value starting `v=DKIM1;`. Add it at the
   domain company as a **TXT** line, exactly as shown.
4. Back in Google, press **Start authentication**. It can say "not yet" for up to 48 hours.

### Step 4. Shopify's sender settings (its DKIM and SPF)

1. Shopify admin → Settings → **Notifications** → Sender email: set it to an address on the
   business's domain (for example orders@ or hello@; see the address plan).
2. Press **Authenticate** (or "Authenticate domain"). Shopify shows several **CNAME** lines. Add
   **every one** shown, exactly as shown. If the domain is at Cloudflare, GoDaddy or IONOS, Shopify
   can add them itself; if the domain was bought through Shopify, it is done already.
3. Never delete these lines later: removing them makes the store's emails bounce.

This is an action in Shopify, so it is done by the owner (CLAUDE.md: no Shopify changes by Claude).

### Step 5. DMARC: what to do with fakes (last, at least 48 hours after steps 2–4)

| Type | Host / name | Value |
|---|---|---|
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@YOUR-DOMAIN` |

- `p=none` means "only report, block nothing" while everything is checked. Make `dmarc@` an
  **alias** of the owner's mailbox (free; see the address plan). The reports are automatic
  summaries, not customer mail.
- **After 2–4 weeks** with clean reports, change `p=none` to `p=quarantine` (fakes go to spam).
  `p=reject` can come later; it is not needed at this size.

### Step 6. The check (two days later, read-only)

Send one email from the new mailbox to a personal Gmail address, open it, choose **Show
original**, and send Claude a screenshot of the top part. Expected:

| Line | Expected |
|---|---|
| SPF | PASS |
| DKIM | PASS |
| DMARC | PASS |

Then do the same with Shopify's **test notification** (Settings → Notifications → an order
confirmation → Send test). If anything says FAIL, nothing is broken for customers yet; Claude finds
which line differs.

## The separate outreach domain (only when store outreach by email begins)

The address plan keeps cold emails to stores on a **second domain**, so a spam complaint can never
hurt order and support mail. That domain gets the same steps 1–6 of its own (its own SPF, DKIM and
DMARC; Shopify's step 4 is not needed there), then a 2–3 week **warm-up**: a handful of emails a
day, growing slowly to about 30–35 a day per mailbox. The sending guard in database draft 56
already starts slowly (20 a day in the first week) and stops a campaign after 2 spam complaints.

## Rules that stay in force

- Nothing is sent to customers or stores until the owner approves a specific first send.
- Every marketing email has a working "unsubscribe" and the business postal address (a PO box or
  virtual mailbox, never the home address).
- Spam complaints stay under 0.1% (Gmail's guideline; it must never reach 0.3%).
- No password, key or recovery code ever goes into chat, this repository, or a pull request.

## Sources (read November 26, 2026 through web search summaries; confirm on the page itself on the day)

- Google Workspace Help: MX https://support.google.com/a/answer/16004259 · SPF https://support.google.com/a/answer/33786 · DKIM https://support.google.com/a/answer/174124 · DMARC https://support.google.com/a/answer/2466580
- Gmail sender guidelines: https://support.google.com/mail/answer/81126
- Shopify Help Center: https://help.shopify.com/en/manual/intro-to-shopify/initial-setup/setup-your-email · https://help.shopify.com/en/manual/intro-to-shopify/initial-setup/email-rewrites
