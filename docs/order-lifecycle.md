# Order lifecycle

## States

```text
draft
  -> pending_payment
  -> paid
  -> accepted
  -> preparing
  -> ready
  -> completed

pending_payment -> payment_failed
paid            -> cancelled
accepted        -> cancelled
```

`draft` is normally client-side cart state. A persisted order begins at `pending_payment` after the server validates menu availability and reconstructs its price.

## Transition authority

| From | To | Authority |
| --- | --- | --- |
| draft | pending_payment | trusted order-creation operation |
| pending_payment | paid | verified Stripe webhook only |
| pending_payment | payment_failed | verified Stripe webhook or reconciliation job |
| paid | accepted | staff, manager, or owner |
| accepted | preparing | staff, manager, or owner |
| preparing | ready | staff, manager, or owner |
| ready | completed | staff, manager, or owner |
| paid/accepted | cancelled | manager or owner; refund rules apply |

No client may update `orders.status` directly. A controlled operation validates the actor, current state, target state, and side effects, then records the transition and event atomically.

## Invariants

- Only paid orders enter the normal production queue.
- The order total equals its authoritative server-created snapshots.
- Replayed requests cannot create duplicate orders or payments.
- A webhook is processed at most once, identified by its Stripe event ID.
- Realtime events prompt clients to refresh canonical database state.
