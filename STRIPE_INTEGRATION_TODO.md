# Stripe integration: remaining steps

The $499 refundable deposit (taken after the confirmation call) now uses Stripe's **embedded payment form** on RENUABL's own deposit page (`/deposit?ref=RN-1234`), instead of redirecting to a Stripe-hosted page.

## Values to Replace

There are no placeholder values to replace. The existing Checkout Session already had real values for the `sample_only` parameters, and they were kept:

**Files containing these values:**

- [src/lib/server/stripe.ts](src/lib/server/stripe.ts)

| Field      | Current Value                                                                         | What to Set                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| mode       | `payment`                                                                             | Keep: the deposit is a one-time charge.                                                                                                    |
| line_items | Inline `price_data`: AUD, 49900 cents (from `DEPOSIT` in `src/lib/domain/deposit.ts`) | Keep. Optional: create a "Refundable installation deposit" Price in the Dashboard and use its `price_…` ID instead of inline `price_data`. |

## Configured Parameters

These parameters were configured in Checkout Studio and are already set correctly.

**Files containing these parameters:**

- [src/lib/server/stripe.ts](src/lib/server/stripe.ts) (Checkout Session and the API version)
- [src/lib/services/stripe-form.ts](src/lib/services/stripe-form.ts) (Stripe.js, beta flag and appearance)

| Parameter                   | Value                                                                            |
| --------------------------- | -------------------------------------------------------------------------------- |
| ui_mode                     | `form` (the installed `stripe` SDK is 22.6.2, which is 21.0.0 or above)          |
| billing_address_collection  | `auto`                                                                           |
| phone_number_collection     | `{ enabled: false }`                                                             |
| automatic_tax               | `{ enabled: false }`                                                             |
| payment_method_collection   | Not sent: it applies only to `subscription` mode, and the deposit uses `payment` |
| submit_type                 | `book`                                                                           |
| shipping_address_collection | `{ allowed_countries: ["AU"] }`                                                  |
| locale                      | `en-GB`                                                                          |
| integration_identifier      | `custom_embedded_web_0002`                                                       |
| API version                 | `2026-03-25.dahlia; custom_checkout_payment_form_preview=v1`                     |
| Stripe.js                   | `https://js.stripe.com/dahlia/stripe.js`, beta `custom_checkout_payment_form_1`  |
| Appearance                  | theme `stripe`, labels `auto`, inputs `spaced`, the configured colours and fonts |

The session also keeps RENUABL's own wiring, which the webhook and receipts depend on: `customer_email`, `client_reference_id`, `metadata` and `payment_intent_data` (the reservation reference). `success_url` and `cancel_url` were replaced with `return_url` (`/deposit/paid?ref=…&session_id={CHECKOUT_SESSION_ID}`), which the embedded form requires.

## Setup

Set these in Vercel → Project → Settings → Environment Variables, then **redeploy**:

| Variable                             | Where to find it                                                                                                                                         | Notes                                                               |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `STRIPE_SECRET_KEY`                  | Stripe → Developers → API keys → **Secret key** → Reveal. Starts with `sk_test_` (testing) or `sk_live_` (launch).                                       | Server only. Never prefix with `NEXT_PUBLIC_`.                      |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe → Developers → API keys → **Publishable key**. Starts with `pk_test_` or `pk_live_`.                                                              | New. Browser-safe. Use the same mode (test/live) as the secret key. |
| `STRIPE_WEBHOOK_SECRET`              | Stripe → Developers → Webhooks → Add endpoint `https://<your-site>/api/stripe/webhook`, event `checkout.session.completed` → Signing secret (`whsec_…`). | Notes paid deposits on the customer's HubSpot contact.              |

Paste each value exactly: no quotes and no spaces. Then open `https://<your-site>/api/status`. It should show `"stripe":{"key":"test","accepted":true,"webhookSecret":true}`. If it shows `"key":"invalid"`, the secret key variable holds something that isn't a secret key (often the `pk_…` publishable key, or a value in quotes).

No new dependencies: Stripe.js is loaded from js.stripe.com at runtime, as PCI rules require (never bundled).

## Files

- [src/lib/server/stripe.ts](src/lib/server/stripe.ts): Stripe client (with the API version) and the Checkout Session, returning its client secret.
- [src/app/api/deposit/checkout/route.ts](src/app/api/deposit/checkout/route.ts): `POST { reference, email? }` → `{ ok, client_secret }` (JSON, no redirect).
- [src/lib/services/stripe-form.ts](src/lib/services/stripe-form.ts): new. Loads Stripe.js, starts the Checkout Form SDK with the appearance, mounts the form and wires `confirm`.
- [src/components/consumer/deposit-pay.tsx](src/components/consumer/deposit-pay.tsx): renders the form in `#checkout-form` on the deposit page.
- [src/app/api/stripe/webhook/route.ts](src/app/api/stripe/webhook/route.ts): unchanged; handles `checkout.session.completed`.

## How it works

1. After the confirmation call, RENUABL sends the customer `https://<your-site>/deposit?ref=RN-1234&email=…`.
2. The page asks `/api/deposit/checkout` for a Checkout Session ($499 AUD, reservation attached) and gets its client secret.
3. Stripe's payment form is mounted on the page: card, Apple Pay and Google Pay, with an Australian address. The button reads "Book".
4. On confirm, Stripe takes the payment and returns the customer to `/deposit/paid?ref=RN-1234&session_id=…`.
5. Stripe calls the webhook; the paid deposit is noted on the customer's HubSpot contact.

## Testing

Use test keys (`sk_test_…` and `pk_test_…`) and open `/deposit?ref=RN-1234`.

| Card                  | Result                        |
| --------------------- | ----------------------------- |
| `4242 4242 4242 4242` | Succeeds                      |
| `4000 0025 0000 3155` | Asks for 3D Secure            |
| `4000 0000 0000 9995` | Declined (insufficient funds) |

Use any future expiry, any CVC and any postcode. Payments appear in Stripe → Payments (test mode). To test the webhook locally: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

## Next steps

- Before launch, switch both keys to live (`sk_live_…`, `pk_live_…`), add a live-mode webhook endpoint and its secret, then redeploy.
- Optional: have `/deposit/paid` check the session (`session_id`) server-side before saying the deposit was received.
- Refunds: from Stripe → Payments → the payment → Refund (the deposit is refundable until the installation partner confirms the site visit).
- Publish the deposit's refund terms with the privacy policy and terms before taking real payments.

## Resources

- https://support.stripe.com
- https://docs.stripe.com/mcp
