-- Missing branch-stock rows inherit the master product availability.
-- Only an explicit false row marks a globally available product sold out at a store.
create or replace function public.create_pickup_order(
  p_customer_name text,
  p_items jsonb,
  p_store_id bigint
) returns public.orders
language plpgsql
set search_path = ''
as $$
declare
  created_order public.orders;
  expected_total integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1 from public.stores s
    where s.id = p_store_id and s.active and s.accepting_pickup
  ) then
    raise exception 'This store is not accepting pickup orders';
  end if;

  select coalesce(sum(
    (p.price_cents + case when coalesce(i.customization->>'size','') like 'Large%' then 100 else 0 end)
    * i.quantity
  ), 0)::integer
  into expected_total
  from jsonb_to_recordset(p_items) as i(product_id bigint, quantity integer, customization jsonb)
  join public.products p on p.id = i.product_id and p.available
  left join public.store_product_availability spa
    on spa.product_id = p.id and spa.store_id = p_store_id
  where i.quantity between 1 and 20
    and coalesce(spa.available, true);

  if expected_total <= 0 then
    raise exception 'The selected items are currently unavailable at this store';
  end if;

  insert into public.orders(user_id, store_id, customer_name, total_cents)
  values (
    (select auth.uid()),
    p_store_id,
    left(coalesce(nullif(trim(p_customer_name),''),'Guest'),80),
    expected_total
  )
  returning * into created_order;

  insert into public.order_items(order_id, product_id, product_name, unit_price_cents, quantity, customization)
  select
    created_order.id,
    p.id,
    p.name,
    p.price_cents + case when coalesce(i.customization->>'size','') like 'Large%' then 100 else 0 end,
    i.quantity,
    coalesce(i.customization,'{}'::jsonb)
  from jsonb_to_recordset(p_items) as i(product_id bigint, quantity integer, customization jsonb)
  join public.products p on p.id = i.product_id and p.available
  left join public.store_product_availability spa
    on spa.product_id = p.id and spa.store_id = p_store_id
  where i.quantity between 1 and 20
    and coalesce(spa.available, true);

  return created_order;
end;
$$;

revoke all on function public.create_pickup_order(text,jsonb,bigint) from public;
grant execute on function public.create_pickup_order(text,jsonb,bigint) to authenticated;
notify pgrst, 'reload schema';
