-- Anonymous Auth users share the authenticated database role. Explicitly
-- exclude them now that customer access requires a permanent account.
alter policy customer_cart_items_owner_select on public.customer_cart_items
  using ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
alter policy customer_cart_items_owner_insert on public.customer_cart_items
  with check ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
alter policy customer_cart_items_owner_update on public.customer_cart_items
  using ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false))
  with check ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
alter policy customer_cart_items_owner_delete on public.customer_cart_items
  using ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));

alter policy users_create_own_orders on public.orders
  with check ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
alter policy users_and_staff_read_orders on public.orders
  using (not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false) and
    (user_id=(select auth.uid()) or exists (
      select 1 from public.staff s where s.user_id=(select auth.uid()) and s.active
      and (s.role='global_admin'::public.admin_role or s.store_id=orders.store_id)
    )));

alter policy users_create_own_order_items on public.order_items
  with check (not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false) and exists (
    select 1 from public.orders o where o.id=order_items.order_id and o.user_id=(select auth.uid())
  ));
alter policy users_and_staff_read_order_items on public.order_items
  using (not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false) and exists (
    select 1 from public.orders o where o.id=order_items.order_id and
    (o.user_id=(select auth.uid()) or exists (
      select 1 from public.staff s where s.user_id=(select auth.uid()) and s.active
      and (s.role='global_admin'::public.admin_role or s.store_id=o.store_id)
    ))
  ));

alter policy users_insert_own_profile on public.profiles
  with check ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
alter policy users_read_own_profile on public.profiles
  using (not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false) and
    ((select auth.uid())=user_id or exists(select 1 from public.admin_users a where a.user_id=(select auth.uid()))));
alter policy users_update_own_profile on public.profiles
  using ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false))
  with check ((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));

create or replace function public.create_pickup_order(
  p_customer_name text,p_items jsonb,p_store_id bigint,
  p_user_voucher_id bigint default null,p_secret_code text default null
) returns public.orders language plpgsql security invoker set search_path='' as $$
begin
  if auth.uid() is null or coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false) then
    raise exception 'A verified account is required to place an order';
  end if;
  return private.create_pickup_order_impl(p_customer_name,p_items,p_store_id,p_user_voucher_id,p_secret_code);
end $$;

drop function public.create_pickup_order(text,jsonb,bigint,bigint,text,text);
create function public.create_pickup_order(
  p_customer_name text,p_items jsonb,p_store_id bigint,
  p_user_voucher_id bigint,p_secret_code text,p_payment_method text
) returns public.orders language plpgsql security invoker set search_path='' as $$
begin
  if auth.uid() is null or coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false) then
    raise exception 'A verified account is required to place an order';
  end if;
  return private.create_pickup_order_impl(p_customer_name,p_items,p_store_id,p_user_voucher_id,p_secret_code,p_payment_method);
end $$;

create or replace function public.preview_checkout_voucher(
  p_items jsonb,p_store_id bigint,p_user_voucher_id bigint default null,p_secret_code text default null
) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
  if auth.uid() is null or coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false) then
    raise exception 'A verified account is required to use checkout';
  end if;
  return private.preview_checkout_voucher_impl(p_items,p_store_id,p_user_voucher_id,p_secret_code);
end $$;

revoke all on function public.create_pickup_order(text,jsonb,bigint,bigint,text) from public,anon;
revoke all on function public.create_pickup_order(text,jsonb,bigint,bigint,text,text) from public,anon;
revoke all on function public.preview_checkout_voucher(jsonb,bigint,bigint,text) from public,anon;
grant execute on function public.create_pickup_order(text,jsonb,bigint,bigint,text) to authenticated;
grant execute on function public.create_pickup_order(text,jsonb,bigint,bigint,text,text) to authenticated;
grant execute on function public.preview_checkout_voucher(jsonb,bigint,bigint,text) to authenticated;

notify pgrst, 'reload schema';
