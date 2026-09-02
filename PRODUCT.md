# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React monorepo: Vite for the customer ordering PWA, staff interface, and admin dashboard; Next.js for the brand website; Tailwind CSS; Supabase for Postgres, Auth, Realtime, Storage, and Edge Functions; HitPay hosted checkout for FPX and Touch ’n Go payments.

## Users

- Primary: mobile customers who want to order ahead and collect drinks without queueing at a single Kopi Papa shop.
- Operational: baristas using a tablet to receive and progress paid orders.
- Administrative: the shop owner managing menu availability, staff access, and basic performance reporting.

## Product Purpose

Kopi Papa enables customers to browse approximately 20 launch items, customize drinks, pay online, and follow pickup progress. Success means a customer can place a correct order quickly and staff can produce it without relying on a separate manual channel.

## Positioning

The exact market position and distinctive brand claim remain open. Future work must not invent claims about coffee sourcing, heritage, pricing, speed, or quality until the owner confirms them.

## Operating Context

- One physical shop, initially using the Asia/Singapore timezone.
- Pickup only for the MVP; delivery is deferred.
- Customers often order one-handed on a phone and may be in a hurry.
- Staff manage live orders on a tablet in a noisy, interruption-heavy preparation environment.
- The initial menu is expected to contain about 20 items grouped into a small number of categories.

## Capabilities and Constraints

- Home is the primary customer entry point, with an order-type decision, campaign carousel, and direct shortcuts into the core journey.
- Customers must choose an order type before entering Menu. Pickup is available for the MVP; Delivery is clearly presented as coming soon.
- Identity is requested when a customer adds to cart or opens account-specific areas. Ordering requires a verified email/password, Google, or Apple account; anonymous guest sessions are not supported.
- Customers select pickup, browse categories, customize products, review a cart, pay by card, and track order status.
- Authoritative prices and availability are validated by trusted backend code.
- Signed HitPay webhooks, not the browser redirect, determine payment completion.
- Supabase Realtime notifies customer and staff interfaces of order changes; Postgres remains canonical.
- Money uses integer minor units and order items retain immutable product, modifier, and price snapshots.
- Loyalty, points, vouchers, gift cards, merchandise, delivery, scheduled ordering, table service, and detailed inventory are outside the MVP.

## Brand Commitments

- Product name: Kopi Papa.
- Preserve the existing dark navy and gold identity shown in the owner's university brand-site reference. The ordering experience should feel like the same brand, not a generic beige coffee application.
- The customer menu uses a persistent vertical drink-category rail on the left, inspired by the useful navigation pattern in the supplied CHAGEE and ZUS references.
- The mobile bottom navigation contains Home, Menu, Orders, and Profile and reserves Safari safe-area space so browser chrome does not obstruct it.
- CHAGEE and ZUS screenshots are interaction references only. Their branding, promotional artwork, copy, and visual identity must not be copied.

## Evidence on Hand

- Two user-provided screenshots showing CHAGEE and ZUS mobile menu structures.
- One user-provided screenshot of the previous Kopi Papa brand website, establishing dark navy, gold, and warm tan as incumbent brand colors.
- CHAGEE's public mini-program was supplied as an interaction reference.
- No confirmed Kopi Papa logo, product photography, menu copy, pricing, sourcing claims, testimonials, or brand guidelines are on hand yet.

## Product Principles

- Make pickup ordering faster than joining a counter queue.
- Show the real price and required choices before cart submission.
- Keep the primary ordering path usable without registration or promotional distractions.
- Make current shop, availability, wait estimate, and order status unmistakable.
- Prefer a dependable operational flow over loyalty and campaign complexity.

## Accessibility & Inclusion

The mobile ordering flow must support keyboard use, screen readers, adequate contrast, large touch targets, clear validation, and reduced-motion preferences. English is the initial language; localization remains an open future decision.
