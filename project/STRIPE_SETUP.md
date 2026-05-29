# Stripe Setup Guide — CarNextDrive

This guide covers everything you need to do to enable real recurring Stripe
subscriptions (weekly and monthly) in your CarNextDrive site.

---

## 1. Get your Stripe API keys

1. Sign in to https://dashboard.stripe.com
2. Make sure the toggle in the top-left is set to **Test mode** (orange "TEST"
   pill is visible). Use test mode until you're 100% sure the flow works.
3. Go to **Developers → API keys** (https://dashboard.stripe.com/test/apikeys)
4. Copy these two values:
   - **Publishable key** (starts with `pk_test_…`) — not used right now, but
     keep it handy if you later add Stripe Elements.
   - **Secret key** (starts with `sk_test_…`) — server side only. **Never** put
     this in frontend code or commit it to git.

---

## 2. Add the keys locally (for development)

Copy `.env.example` to `.env` in the project root:

```bash
cp .env.example .env
```

Open `.env` and fill in:

```
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_WEBHOOK_SECRET=          # leave blank until step 5
```

Restart the dev server (`pnpm dev`) after editing `.env`.

> The pricing for each car is defined **only on the server** in
> `server/routes/stripe.ts` inside the `CAR_CATALOG` object. Edit prices there.
> Always keep `client/pages/Index.tsx` and `client/pages/VehicleDetail.tsx`
> display prices in sync with the server values.

---

## 3. Add the keys in production (Netlify)

In Netlify Dashboard → **Site settings → Environment variables → Add a
variable**, add:

| Key                      | Value                              | Notes        |
| ------------------------ | ---------------------------------- | ------------ |
| `STRIPE_SECRET_KEY`      | your `sk_live_…` (or `sk_test_…`)  | server only  |
| `STRIPE_WEBHOOK_SECRET`  | from step 5                        | server only  |
| `VITE_FORMSPREE_ENDPOINT` | your Formspree URL (optional)     | frontend     |
| `VITE_CLOUDINARY_CLOUD_NAME` | your Cloudinary cloud name (opt) | frontend     |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | unsigned preset name (opt)  | frontend     |

Then redeploy.

---

## 4. How the flow works

1. Customer chooses **Weekly** or **Monthly** on the vehicle detail page.
2. They click **Book This Car** → goes to `/signup?carId=…&plan=…&price=…`.
3. They fill in name, email, phone, license, ID and click **Submit Application
   & Pay**.
4. Frontend posts to `POST /api/create-checkout-session` with carId + plan +
   email + name + phone + (optional) licenseUrl + idUrl.
5. Backend looks up the car's price **server-side** (so it can't be tampered
   with), creates a real Stripe Checkout Session with `mode: subscription` and
   the correct `recurring.interval` (`week` or `month`), and returns the
   Checkout URL.
6. Frontend redirects to Stripe Checkout.
7. After payment Stripe redirects to `/success?session_id=…`.
8. The success page polls `GET /api/checkout-status/:sessionId` and shows the
   confirmation message: *"Application and payment submitted. We will review
   your application and email pickup details if approved."*

The customer is then on an active subscription that recurs every week (weekly
plan) or every month (monthly plan) until you cancel it in the Stripe
Dashboard.

---

## 5. Webhook setup

Webhooks let Stripe notify your server about subscription events (renewals,
failures, cancellations). Recommended even though we don't write to a DB.

### 5a. Create the webhook in Stripe

1. In Stripe Dashboard → **Developers → Webhooks** → **Add endpoint**
   (https://dashboard.stripe.com/test/webhooks).
2. **Endpoint URL**: `https://YOUR-NETLIFY-SITE.netlify.app/api/stripe-webhook`
3. **Events to send**: choose at minimum:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`
4. Click **Add endpoint**.
5. On the endpoint page, click **Reveal** under **Signing secret** and copy
   the value (starts with `whsec_…`).
6. Paste it into Netlify env vars as `STRIPE_WEBHOOK_SECRET` and redeploy.

### 5b. Test the webhook locally (optional)

Install the Stripe CLI: https://stripe.com/docs/stripe-cli, then:

```bash
stripe login
stripe listen --forward-to localhost:8080/api/stripe-webhook
```

The CLI prints a `whsec_…` value for local testing — put that in your local
`.env`. Trigger an event:

```bash
stripe trigger checkout.session.completed
```

Watch your server logs for `[stripe webhook] checkout.session.completed …`.

---

## 6. Test weekly & monthly recurring billing

### 6a. Use Stripe's test card

In Checkout, enter:

- **Card number**: `4242 4242 4242 4242`
- **Expiry**: any future date (e.g. `12 / 34`)
- **CVC**: any 3 digits (e.g. `123`)
- **ZIP**: any 5 digits

### 6b. End-to-end test

1. Open the site, pick a car (e.g. Chrysler 200), click **View Details**.
2. Choose **Weekly** plan, click **Book This Car**.
3. Fill the form (name, email, phone, license, ID) and submit.
4. You'll land on Stripe Checkout for `$349.00 / week`.
5. Pay with the test card.
6. You should land on `/success` with: *"Application and payment submitted. We
   will review your application and email pickup details if approved."*
7. In Stripe Dashboard → **Customers** you should see the new customer with an
   **Active** subscription billed weekly.
8. Repeat with **Monthly** plan and confirm the subscription billing interval
   is `Monthly`.

### 6c. Verify recurring billing without waiting a week/month

To verify the subscription will actually re-bill, in Stripe Dashboard →
**Customers → [the customer] → Subscriptions → … (kebab) → Advance test
clock** or use the Stripe CLI to advance time. Each "billing period" advance
triggers a new `invoice.payment_succeeded` event.

---

## 7. Manual workflow (no admin panel)

Per your requirements:

- **Review applications**: Stripe Dashboard → **Customers** shows email,
  metadata (carName, plan, licenseUrl, idUrl, etc). Formspree (if configured)
  also emails you these details.
- **Email pickup details**: do this from your own email once you approve.
- **End a rental**: Stripe Dashboard → **Customers → [customer] →
  Subscriptions → Cancel subscription**. Choose immediate or end-of-period.

---

## 8. Going live

When you're ready for real charges:

1. In Stripe Dashboard, flip top-left toggle from **Test mode** to **Live
   mode**.
2. Go to **Developers → API keys** and grab the **live** `sk_live_…` key.
3. Update `STRIPE_SECRET_KEY` in Netlify to the live key.
4. Create a **live** webhook endpoint (same URL, but under Live mode) and
   update `STRIPE_WEBHOOK_SECRET` accordingly.
5. Redeploy.

Done — your site now charges real money.

---

## 9. Security checklist

- [x] `STRIPE_SECRET_KEY` is **never** read from frontend code (only `server/`).
- [x] Prices live on the server (`CAR_CATALOG` in `server/routes/stripe.ts`),
      never trusted from the request body.
- [x] Webhook handler verifies signature using `STRIPE_WEBHOOK_SECRET` when
      set.
- [x] Success/cancel URLs are built from the request origin, never
      hardcoded.

---

## 10. Troubleshooting

- **"Stripe is not configured" error**: `STRIPE_SECRET_KEY` is missing/typo
  in your env. Redeploy after fixing.
- **Checkout opens but says "No such price"**: This site uses inline
  `price_data`, not preset Price IDs, so this shouldn't occur. If it does,
  check the Stripe Dashboard logs.
- **Webhook returns 400**: signature mismatch — wrong `STRIPE_WEBHOOK_SECRET`.
- **Customer charged but didn't land on success page**: They closed the tab.
  Stripe still completed the subscription. Confirm in Dashboard → Customers.
