alter table public.orders
  add column if not exists payment_bank text;

alter table public.orders drop constraint if exists orders_payment_bank_check;
alter table public.orders add constraint orders_payment_bank_check check (
  payment_bank is null or payment_bank in (
    'maybank2u','cimb_clicks','public_bank','rhb_now','hong_leong','ambank','bank_islam'
  )
);

comment on column public.orders.payment_bank is
  'Customer-selected FPX bank identifier; null for non-FPX payments.';

-- Keep cancellation and payment state synchronized regardless of which staff
-- interface performs the update.
create or replace function private.sync_cancelled_order_payment()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.status='cancelled' and old.status is distinct from new.status
     and new.payment_status <> 'refunded' then
    new.payment_status := 'cancelled';
  end if;
  return new;
end $$;

revoke all on function private.sync_cancelled_order_payment() from public,anon,authenticated;
drop trigger if exists sync_cancelled_order_payment on public.orders;
create trigger sync_cancelled_order_payment
before update of status on public.orders
for each row execute function private.sync_cancelled_order_payment();

-- Harden the paid implementation with its own identity check rather than only
-- relying on the public wrapper and the delegated five-argument function.
create or replace function private.create_pickup_order_impl(
  p_customer_name text,p_items jsonb,p_store_id bigint,p_user_voucher_id bigint,
  p_secret_code text,p_payment_method text
) returns public.orders language plpgsql security definer set search_path='' as $$
declare
  v_user uuid := (select auth.uid());
  created_order public.orders;
begin
  if v_user is null or coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false) then
    raise exception 'A verified account is required to place an order';
  end if;
  if p_payment_method not in ('fpx','touch_n_go') then
    raise exception 'Choose FPX or Touch n Go to continue.';
  end if;
  created_order := private.create_pickup_order_impl(
    p_customer_name,p_items,p_store_id,p_user_voucher_id,p_secret_code
  );
  update public.orders set payment_method=p_payment_method,payment_status='pending'
  where id=created_order.id and user_id=v_user returning * into created_order;
  if created_order.id is null then raise exception 'Order could not be secured for this account'; end if;
  return created_order;
end $$;

revoke all on function private.create_pickup_order_impl(text,jsonb,bigint,bigint,text,text) from public,anon;
grant execute on function private.create_pickup_order_impl(text,jsonb,bigint,bigint,text,text) to authenticated;

-- This is an internal trigger, not an RPC. Keep it private with an empty
-- search path and fully-qualified objects.
create or replace function private.capture_order_customer_email()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.customer_email is null or btrim(new.customer_email)='' then
    select u.email into new.customer_email from auth.users u where u.id=new.user_id;
  end if;
  return new;
end $$;

revoke all on function private.capture_order_customer_email() from public,anon,authenticated;
drop trigger if exists capture_order_customer_email on public.orders;
create trigger capture_order_customer_email before insert on public.orders
for each row execute function private.capture_order_customer_email();
drop function if exists public.capture_order_customer_email();

notify pgrst,'reload schema';
