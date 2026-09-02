alter table public.orders
  add column if not exists payment_status text not null default 'pending',
  add column if not exists payment_method text,
  add column if not exists hitpay_payment_request_id text,
  add column if not exists hitpay_checkout_url text,
  add column if not exists payment_initiated_at timestamptz,
  add column if not exists paid_at timestamptz;

alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check
  check (payment_status in ('pending','paid','failed','cancelled','refunded'));

alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method is null or payment_method in ('fpx','touch_n_go'));

create unique index if not exists orders_hitpay_payment_request_uidx
  on public.orders(hitpay_payment_request_id)
  where hitpay_payment_request_id is not null;

create index if not exists orders_payment_status_created_idx
  on public.orders(payment_status,created_at desc);

update public.orders
set payment_status = 'paid',
    paid_at = coalesce(paid_at,updated_at)
where payment_method is null
  and hitpay_payment_request_id is null;

create or replace function private.refresh_store_queue(p_store_id bigint) returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.store_queue_metrics(store_id, active_cups, updated_at)
  select p_store_id,
         coalesce(sum(oi.quantity) filter (
           where o.payment_status = 'paid' and o.status in ('new','preparing')
         ),0)::integer,
         now()
  from public.orders o
  left join public.order_items oi on oi.order_id=o.id
  where o.store_id=p_store_id
  on conflict (store_id) do update
  set active_cups=excluded.active_cups, updated_at=excluded.updated_at
$$;

drop trigger if exists refresh_queue_on_order on public.orders;
create trigger refresh_queue_on_order
after insert or delete or update of status,store_id,payment_status on public.orders
for each row execute function private.refresh_queue_after_order();

create or replace function public.create_pickup_order(
  p_customer_name text,
  p_items jsonb,
  p_store_id bigint,
  p_user_voucher_id bigint,
  p_secret_code text,
  p_payment_method text
) returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_order public.orders;
begin
  if p_payment_method not in ('fpx','touch_n_go') then
    raise exception 'Choose FPX or Touch n Go to continue.';
  end if;

  created_order := public.create_pickup_order(
    p_customer_name,
    p_items,
    p_store_id,
    p_user_voucher_id,
    p_secret_code
  );

  update public.orders
  set payment_method = p_payment_method,
      payment_status = 'pending'
  where id = created_order.id
  returning * into created_order;

  return created_order;
end;
$$;

revoke all on function public.create_pickup_order(text,jsonb,bigint,bigint,text,text) from public,anon;
grant execute on function public.create_pickup_order(text,jsonb,bigint,bigint,text,text) to authenticated;

comment on column public.orders.payment_method is 'HitPay method selected by the customer: fpx or touch_n_go.';
comment on column public.orders.hitpay_payment_request_id is 'HitPay payment request ID used for idempotent webhook reconciliation.';

notify pgrst, 'reload schema';
