# Permissions

## Actors

- **Public visitor:** signed-out person browsing published shop and menu data.
- **Guest customer:** customer holding a short-lived, unguessable order-access token.
- **Customer:** authenticated user accessing only their own records.
- **Staff:** authenticated shop worker managing the production queue.
- **Manager:** staff member with operational cancellation and availability controls.
- **Owner:** administrator managing staff, menu, settings, and analytics.
- **Service:** trusted Edge Function or webhook process holding server-only credentials.

## Access matrix

| Capability | Public | Guest/customer | Staff | Manager | Owner | Service |
| --- | --- | --- | --- | --- | --- | --- |
| Read published menu | Yes | Yes | Yes | Yes | Yes | Yes |
| Create validated order | No direct table write | Via trusted operation | No | No | No | Yes |
| Read an order | No | Own/token-bound | Shop orders | Shop orders | Shop orders | Yes |
| Change production status | No | No | Allowed transitions | Allowed transitions | Allowed transitions | Yes |
| Change availability | No | No | Sold-out toggle only | Yes | Yes | Yes |
| Manage menu | No | No | No | Optional later | Yes | Yes |
| Manage staff | No | No | No | No | Yes | Yes |
| Set payment state | No | No | No | No | No | Verified service only |
| View analytics | No | No | No | Optional later | Yes | Yes |

## Supabase policy requirements

- Enable RLS on every table in an exposed schema.
- Revoke default client privileges and grant back only required operations.
- Write separate policies per operation and role.
- Ownership policies include explicit predicates; `TO authenticated` alone is insufficient.
- Update policies use both `USING` and `WITH CHECK`, plus the required select policy.
- Index every column used for ownership or membership filtering.
- Protected views use `security_invoker = true` where supported or remain in an unexposed schema.
- Service-role and Stripe secret keys never enter browser bundles.
- Authorization never trusts `user_metadata`.
