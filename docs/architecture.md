# Architecture

## Product boundaries

Kopi Papa serves one physical shop while retaining `shop_id` on operational records so permissions and data ownership remain explicit.

The MVP supports pickup orders paid by card. It excludes delivery, loyalty, coupons, inventory depletion, table service, and scheduled ordering.

## Deployable applications

1. `web` is a Next.js application for SEO-friendly brand and menu content.
2. `order` is a mobile-first Vite/React PWA for customers.
3. `staff` is a tablet-first Vite/React PWA for live order production.
4. `admin` is a desktop-first Vite/React application for menu and shop management.

Each application is independently deployable. They share domain contracts and design primitives, not page-level features.

## Backend boundaries

Supabase provides Postgres, Auth, Realtime, Storage, database functions, and Edge Functions. Browser clients may directly read data only where explicit grants and Row Level Security policies permit it.

Security-sensitive operations—including authoritative pricing, order creation, payment creation, payment reconciliation, refunds, and privileged administration—must execute in trusted database or Edge Function code.

Stripe webhook events are the source of truth for payment completion. Browser payment results are user-interface hints only.

## Data rules

- Money is stored as integer minor units with an ISO currency code.
- Every submitted order item stores immutable name, option, tax, and price snapshots.
- Historical totals never depend on the current menu.
- Public order numbers are separate from internal UUID primary keys.
- State changes are recorded in an append-only order status event log.
- Idempotency keys protect order creation and payment processing.
- Dates are stored in UTC and displayed using the shop timezone (`Asia/Singapore` initially).

## MVP authentication

Customer checkout may be completed as a guest. Customer accounts can be added without changing the order model because `orders.customer_id` is nullable.

Staff and owner access requires Supabase Auth. Authorization is derived from protected staff membership data or trusted app metadata, never user-editable metadata.

## Offline behavior

The PWAs may cache the application shell and published menu for resilient browsing. Creating or paying for an order always requires a live server validation. The product must never promise successful offline ordering.
