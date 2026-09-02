# HitPay sandbox setup

The database migration and both Supabase Edge Functions are already part of this repository. Complete these configuration steps before testing checkout.

## 1. Add Edge Function secrets

In Supabase, open **Project Settings → Edge Functions → Secrets** and add:

- `HITPAY_API_KEY`: the business API key from your HitPay Sandbox dashboard.
- `HITPAY_SALT`: the webhook salt from the same HitPay Sandbox account.
- `APP_URL`: the customer application origin, without a trailing slash. For local browser testing use `http://localhost:5173`; for a hosted preview use its HTTPS origin.

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are supplied automatically by Supabase. Never add any of these secrets to a Vite environment file.

## 2. Register the webhook in HitPay

In the HitPay Sandbox dashboard, open **Developers → Webhook Endpoints**, create an endpoint, and subscribe it to `payment_request.completed`.

Webhook URL:

```text
https://qzgadlmlcsugwjshypwo.supabase.co/functions/v1/hitpay-webhook
```

The webhook function intentionally has gateway JWT verification disabled because HitPay is not a Supabase user. It authenticates every request with the raw-body `Hitpay-Signature` HMAC before touching an order.

## 3. Enable payment methods

In HitPay, open **Settings → Payment Methods** and enable FPX and Touch ’n Go for the Malaysian business account.

The API method codes used by the app are:

- FPX: `fpx`
- Touch ’n Go: `touch_n_go`

HitPay currently marks normal one-time FPX and Touch ’n Go checkout simulation as unavailable in Sandbox. The request, redirect, database, and webhook integration can be exercised in Sandbox, but a genuine successful method authorization may require HitPay live activation or a sandbox-supported test method.

## 4. Test the flow

1. Sign in to the customer app and select a pickup store.
2. Add items and open checkout.
3. Choose FPX or Touch ’n Go.
4. Press **Pay now**.
5. Confirm the browser opens HitPay's hosted checkout.
6. After a signed completed webhook, confirm the order shows `Paid` in both customer Order Details and the admin Orders table.

Unpaid orders remain visible for audit purposes, but staff cannot accept them and they do not contribute to the Now Brewing queue.
