-- The six-argument overload must require all six arguments. Otherwise a
-- five-argument call also matches it and PostgreSQL reports an ambiguous RPC.
create or replace function private.create_pickup_order_impl(
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

  -- Call the private five-argument implementation explicitly. Calling the
  -- overloaded public API here was the source of the ambiguity.
  created_order := private.create_pickup_order_impl(
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
end
$$;

-- PostgreSQL requires a drop/recreate when removing argument defaults.
drop function public.create_pickup_order(text,jsonb,bigint,bigint,text,text);

create function public.create_pickup_order(
  p_customer_name text,
  p_items jsonb,
  p_store_id bigint,
  p_user_voucher_id bigint,
  p_secret_code text,
  p_payment_method text
) returns public.orders
language sql
security invoker
set search_path = ''
as $$
  select private.create_pickup_order_impl($1, $2, $3, $4, $5, $6)
$$;

revoke all on function private.create_pickup_order_impl(text,jsonb,bigint,bigint,text,text) from public, anon;
grant execute on function private.create_pickup_order_impl(text,jsonb,bigint,bigint,text,text) to authenticated;
revoke all on function public.create_pickup_order(text,jsonb,bigint,bigint,text,text) from public, anon;
grant execute on function public.create_pickup_order(text,jsonb,bigint,bigint,text,text) to authenticated;

notify pgrst, 'reload schema';
