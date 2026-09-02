# Kopi Papa

Kopi Papa is a four-surface coffee-shop platform built as a pnpm/Turborepo monorepo:

- `apps/web`: public brand and marketing website
- `apps/order`: customer ordering PWA
- `apps/staff`: barista and kitchen PWA
- `apps/admin`: owner administration dashboard

The shared backend is Supabase. Stripe Payment Intents will be integrated after the non-payment ordering flow is verified end to end.

## Local development

Prerequisites: Node.js 22+, pnpm 11+, Git, and Docker Desktop (for the local Supabase stack).

```powershell
pnpm install
pnpm dev
```

Run all quality checks with:

```powershell
pnpm check
```

See `docs/architecture.md`, `docs/order-lifecycle.md`, and `docs/permissions.md` before changing domain behavior.
# Local application links

Run the customer and admin applications in separate terminals from the repository root:

```powershell
pnpm dev:customer
pnpm dev:admin
```

- Customer ordering: http://localhost:5173/
- Admin dashboard: http://localhost:5174/

Both applications connect to the same Supabase project. The staff application remains deferred.
