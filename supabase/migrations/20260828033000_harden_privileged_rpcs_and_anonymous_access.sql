-- Keep privileged implementations out of the exposed public schema.
create schema if not exists private;

do $migration$
declare
  v_signature regprocedure;
  v_definition text;
begin
  foreach v_signature in array array[
    'public.create_pickup_order(text,jsonb,bigint,bigint,text)'::regprocedure,
    'public.create_pickup_order(text,jsonb,bigint,bigint,text,text)'::regprocedure,
    'public.preview_checkout_voucher(jsonb,bigint,bigint,text)'::regprocedure,
    'public.purchase_reward(bigint)'::regprocedure,
    'public.use_reward_voucher(bigint)'::regprocedure
  ] loop
    select pg_get_functiondef(v_signature::oid) into v_definition;
    v_definition := replace(
      v_definition,
      'FUNCTION public.' || split_part(v_signature::text, '(', 1),
      'FUNCTION private.' || split_part(v_signature::text, '(', 1) || '_impl'
    );
    execute v_definition;
  end loop;
end
$migration$;

create or replace function public.preview_checkout_voucher(
  p_items jsonb,
  p_store_id bigint,
  p_user_voucher_id bigint default null,
  p_secret_code text default null
) returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.preview_checkout_voucher_impl($1, $2, $3, $4)
$$;

create or replace function public.create_pickup_order(
  p_customer_name text,
  p_items jsonb,
  p_store_id bigint,
  p_user_voucher_id bigint default null,
  p_secret_code text default null
) returns public.orders
language sql
security invoker
set search_path = ''
as $$
  select private.create_pickup_order_impl($1, $2, $3, $4, $5)
$$;

create or replace function public.create_pickup_order(
  p_customer_name text,
  p_items jsonb,
  p_store_id bigint,
  p_user_voucher_id bigint default null,
  p_secret_code text default null,
  p_payment_method text default null
) returns public.orders
language sql
security invoker
set search_path = ''
as $$
  select private.create_pickup_order_impl($1, $2, $3, $4, $5, $6)
$$;

create or replace function public.purchase_reward(p_template_id bigint)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null or coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false) then
    raise exception 'A permanent account is required to purchase rewards';
  end if;
  return private.purchase_reward_impl(p_template_id);
end
$$;

create or replace function public.use_reward_voucher(p_user_voucher_id bigint)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null or coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false) then
    raise exception 'A permanent account is required to use rewards';
  end if;
  perform private.use_reward_voucher_impl(p_user_voucher_id);
end
$$;

revoke all on all functions in schema private from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.create_pickup_order_impl(text,jsonb,bigint,bigint,text) to authenticated;
grant execute on function private.create_pickup_order_impl(text,jsonb,bigint,bigint,text,text) to authenticated;
grant execute on function private.preview_checkout_voucher_impl(jsonb,bigint,bigint,text) to authenticated;
grant execute on function private.purchase_reward_impl(bigint) to authenticated;
grant execute on function private.use_reward_voucher_impl(bigint) to authenticated;

revoke all on function public.create_pickup_order(text,jsonb,bigint,bigint,text) from public, anon;
revoke all on function public.create_pickup_order(text,jsonb,bigint,bigint,text,text) from public, anon;
revoke all on function public.preview_checkout_voucher(jsonb,bigint,bigint,text) from public, anon;
revoke all on function public.purchase_reward(bigint) from public, anon;
revoke all on function public.use_reward_voucher(bigint) from public, anon;
grant execute on function public.create_pickup_order(text,jsonb,bigint,bigint,text) to authenticated;
grant execute on function public.create_pickup_order(text,jsonb,bigint,bigint,text,text) to authenticated;
grant execute on function public.preview_checkout_voucher(jsonb,bigint,bigint,text) to authenticated;
grant execute on function public.purchase_reward(bigint) to authenticated;
grant execute on function public.use_reward_voucher(bigint) to authenticated;

-- Anonymous Supabase users share the authenticated Postgres role. Sensitive
-- policies therefore need an explicit permanent-account check in addition to
-- their existing ownership/staff predicates.
do $policies$
declare
  p record;
  v_using text;
  v_check text;
  v_permanent text := '(not coalesce(((select auth.jwt())->>''is_anonymous'')::boolean, false))';
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where
      (schemaname = 'public' and tablename in
        ('admin_users','staff','reward_accounts','reward_ledger','user_vouchers','voucher_codes'))
      or (schemaname = 'public' and tablename = 'voucher_templates')
      or (schemaname = 'public' and tablename = 'reward_settings' and policyname = 'reward_settings_admin_write')
      or (schemaname = 'storage' and tablename = 'objects' and policyname like 'Public assets admin %')
  loop
    v_using := case when p.qual is null then null else '(' || p.qual || ') and ' || v_permanent end;
    v_check := case when p.with_check is null then null else '(' || p.with_check || ') and ' || v_permanent end;

    execute format(
      'alter policy %I on %I.%I %s %s',
      p.policyname,
      p.schemaname,
      p.tablename,
      case when v_using is null then '' else 'using (' || v_using || ')' end,
      case when v_check is null then '' else 'with check (' || v_check || ')' end
    );
  end loop;
end
$policies$;
