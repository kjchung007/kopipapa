alter table public.voucher_templates
  add column if not exists buy_scope text,
  add column if not exists buy_category_ids bigint[] not null default '{}',
  add column if not exists buy_product_ids bigint[] not null default '{}',
  add column if not exists free_quantity integer not null default 1,
  add column if not exists free_scope text,
  add column if not exists free_category_ids bigint[] not null default '{}',
  add column if not exists free_product_ids bigint[] not null default '{}';

update public.voucher_templates
set buy_scope = coalesce(buy_scope, valid_scope),
    buy_category_ids = case when valid_scope='category' and category_id is not null then array[category_id] else buy_category_ids end,
    buy_product_ids = case when valid_scope='product' and product_id is not null then array[product_id] else buy_product_ids end,
    free_scope = coalesce(free_scope, valid_scope),
    free_category_ids = case when valid_scope='category' and category_id is not null then array[category_id] else free_category_ids end,
    free_product_ids = case when valid_scope='product' and product_id is not null then array[product_id] else free_product_ids end;

alter table public.voucher_templates
  alter column buy_scope set default 'any_drink',
  alter column buy_scope set not null,
  alter column free_scope set default 'any_drink',
  alter column free_scope set not null;

alter table public.voucher_templates drop constraint if exists voucher_templates_buy_scope_check;
alter table public.voucher_templates add constraint voucher_templates_buy_scope_check
  check (buy_scope in ('any_drink','category','product'));
alter table public.voucher_templates drop constraint if exists voucher_templates_free_scope_check;
alter table public.voucher_templates add constraint voucher_templates_free_scope_check
  check (free_scope in ('any_drink','category','product'));
alter table public.voucher_templates drop constraint if exists voucher_templates_free_quantity_check;
alter table public.voucher_templates add constraint voucher_templates_free_quantity_check
  check (free_quantity between 1 and 20);
alter table public.voucher_templates drop constraint if exists voucher_templates_buy_targets_check;
alter table public.voucher_templates add constraint voucher_templates_buy_targets_check check (
  (buy_scope='any_drink') or
  (buy_scope='category' and cardinality(buy_category_ids)>0) or
  (buy_scope='product' and cardinality(buy_product_ids)>0)
);
alter table public.voucher_templates drop constraint if exists voucher_templates_free_targets_check;
alter table public.voucher_templates add constraint voucher_templates_free_targets_check check (
  (free_scope='any_drink') or
  (free_scope='category' and cardinality(free_category_ids)>0) or
  (free_scope='product' and cardinality(free_product_ids)>0)
);

create table if not exists public.customer_cart_items (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  store_id bigint not null references public.stores(id) on delete cascade,
  item_key text not null check (char_length(item_key) between 1 and 180),
  product_id bigint not null references public.products(id) on delete cascade,
  quantity integer not null check (quantity between 1 and 20),
  customization jsonb not null default '{}'::jsonb,
  source text not null default 'menu' check (source in ('menu','upsell')),
  updated_at timestamptz not null default now(),
  unique(user_id,store_id,item_key)
);
create index if not exists customer_cart_items_owner_store_idx on public.customer_cart_items(user_id,store_id);
create index if not exists customer_cart_items_product_idx on public.customer_cart_items(product_id);
create index if not exists customer_cart_items_store_idx on public.customer_cart_items(store_id);
alter table public.customer_cart_items enable row level security;
drop policy if exists customer_cart_items_owner_select on public.customer_cart_items;
create policy customer_cart_items_owner_select on public.customer_cart_items for select to authenticated
  using ((select auth.uid())=user_id);
drop policy if exists customer_cart_items_owner_insert on public.customer_cart_items;
create policy customer_cart_items_owner_insert on public.customer_cart_items for insert to authenticated
  with check ((select auth.uid())=user_id);
drop policy if exists customer_cart_items_owner_update on public.customer_cart_items;
create policy customer_cart_items_owner_update on public.customer_cart_items for update to authenticated
  using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists customer_cart_items_owner_delete on public.customer_cart_items;
create policy customer_cart_items_owner_delete on public.customer_cart_items for delete to authenticated
  using ((select auth.uid())=user_id);
grant select,insert,update,delete on public.customer_cart_items to authenticated;
grant usage,select on sequence public.customer_cart_items_id_seq to authenticated;

create or replace function public.replace_customer_cart(p_store_id bigint,p_items jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare v_user uuid=(select auth.uid()); v_rows integer; v_valid integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(coalesce(p_items,'[]'::jsonb)) <> 'array' then raise exception 'Cart items must be an array'; end if;
  select count(*)::integer into v_rows from jsonb_to_recordset(coalesce(p_items,'[]'::jsonb)) as i(item_key text,product_id bigint,quantity integer,customization jsonb,source text);
  if v_rows>100 then raise exception 'Cart cannot contain more than 100 selections'; end if;
  select count(*)::integer into v_valid
  from jsonb_to_recordset(coalesce(p_items,'[]'::jsonb)) as i(item_key text,product_id bigint,quantity integer,customization jsonb,source text)
  join public.products p on p.id=i.product_id
  where char_length(i.item_key) between 1 and 180 and i.quantity between 1 and 20 and coalesce(i.source,'menu') in ('menu','upsell');
  if v_valid<>v_rows then raise exception 'Cart contains invalid items'; end if;
  delete from public.customer_cart_items where user_id=v_user and store_id=p_store_id;
  insert into public.customer_cart_items(user_id,store_id,item_key,product_id,quantity,customization,source)
  select v_user,p_store_id,i.item_key,i.product_id,i.quantity,coalesce(i.customization,'{}'::jsonb),coalesce(i.source,'menu')
  from jsonb_to_recordset(coalesce(p_items,'[]'::jsonb)) as i(item_key text,product_id bigint,quantity integer,customization jsonb,source text);
end $$;
revoke all on function public.replace_customer_cart(bigint,jsonb) from public,anon;
grant execute on function public.replace_customer_cart(bigint,jsonb) to authenticated;

create or replace function public.preview_checkout_voucher(
  p_items jsonb,p_store_id bigint,p_user_voucher_id bigint default null,p_secret_code text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_user uuid=(select auth.uid()); v_template public.voucher_templates%rowtype; v_owned_id bigint;
  v_subtotal integer; v_buy_count integer:=0; v_free_count integer:=0; v_union_count integer:=0;
  v_discount integer:=0; v_missing integer; v_buy_label text; v_free_label text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_user_voucher_id is not null and nullif(trim(p_secret_code),'') is not null then raise exception 'Choose either a voucher or a secret code, not both.'; end if;
  select coalesce(sum((p.price_cents+case when coalesce(i.customization->>'size','') like 'Large%' then 100 else 0 end)*i.quantity),0)::integer into v_subtotal
  from jsonb_to_recordset(p_items) i(product_id bigint,quantity integer,customization jsonb,source text)
  join public.products p on p.id=i.product_id and p.available left join public.store_product_availability spa on spa.product_id=p.id and spa.store_id=p_store_id
  where i.quantity between 1 and 20 and coalesce(spa.available,true);
  if v_subtotal<=0 then raise exception 'Order has no available items.'; end if;
  if p_user_voucher_id is null and nullif(trim(p_secret_code),'') is null then return jsonb_build_object('discount_amount',0,'voucher_title',null,'user_voucher_id',null); end if;
  if p_user_voucher_id is not null then
    select vt.* into v_template from public.user_vouchers uv join public.voucher_templates vt on vt.id=uv.voucher_template_id
    where uv.id=p_user_voucher_id and uv.user_id=v_user and uv.status='active' and (uv.expires_at is null or uv.expires_at>now()) and vt.active;
    v_owned_id:=p_user_voucher_id;
  else
    select vt.* into v_template from public.voucher_codes vc join public.voucher_templates vt on vt.id=vc.voucher_template_id
    where vc.code=upper(trim(p_secret_code)) and vc.active and vc.claim_count<vc.max_claims and (vc.expires_at is null or vc.expires_at>now()) and vt.active and (vt.expires_at is null or vt.expires_at>now());
  end if;
  if not found then raise exception 'This voucher is invalid, expired, used, or unavailable.'; end if;

  v_buy_label:=case v_template.buy_scope when 'category' then 'selected-category drink' when 'product' then 'selected drink' else 'drink' end;
  v_free_label:=case v_template.free_scope when 'category' then 'selected free-category drink' when 'product' then 'selected free drink' else 'drink' end;
  with units as (
    select p.id,p.category_id,p.price_cents+case when coalesce(i.customization->>'size','') like 'Large%' then 100 else 0 end price
    from jsonb_to_recordset(p_items) i(product_id bigint,quantity integer,customization jsonb,source text)
    join public.products p on p.id=i.product_id and p.available
    left join public.store_product_availability spa on spa.product_id=p.id and spa.store_id=p_store_id
    cross join lateral generate_series(1,i.quantity)
    where i.quantity between 1 and 20 and coalesce(spa.available,true)
  ), flags as (
    select *,
      (v_template.buy_scope='any_drink' or (v_template.buy_scope='category' and category_id=any(v_template.buy_category_ids)) or (v_template.buy_scope='product' and id=any(v_template.buy_product_ids))) is_buy,
      (v_template.free_scope='any_drink' or (v_template.free_scope='category' and category_id=any(v_template.free_category_ids)) or (v_template.free_scope='product' and id=any(v_template.free_product_ids))) is_free
    from units
  ) select count(*) filter(where is_buy),count(*) filter(where is_free),count(*) filter(where is_buy or is_free)
    into v_buy_count,v_free_count,v_union_count from flags;

  if v_template.voucher_type='amount_off' then
    if v_subtotal<=v_template.amount_off_cents then raise exception 'Total order amount must be greater than the voucher value.'; end if;
    v_discount:=v_template.amount_off_cents;
  elsif v_template.voucher_type='free_drink' then
    if v_free_count<v_template.free_quantity then raise exception 'Add % more % to use this voucher.',v_template.free_quantity-v_free_count,v_free_label; end if;
    with units as (
      select p.id,p.category_id,p.price_cents+case when coalesce(i.customization->>'size','') like 'Large%' then 100 else 0 end price
      from jsonb_to_recordset(p_items) i(product_id bigint,quantity integer,customization jsonb,source text) join public.products p on p.id=i.product_id and p.available
      left join public.store_product_availability spa on spa.product_id=p.id and spa.store_id=p_store_id cross join lateral generate_series(1,i.quantity)
      where i.quantity between 1 and 20 and coalesce(spa.available,true)
    ) select coalesce(sum(price),0)::integer into v_discount from (select price from units where v_template.free_scope='any_drink' or (v_template.free_scope='category' and category_id=any(v_template.free_category_ids)) or (v_template.free_scope='product' and id=any(v_template.free_product_ids)) order by price limit v_template.free_quantity) d;
  else
    if v_buy_count<v_template.buy_quantity then raise exception 'Add % more % to meet the buy requirement.',v_template.buy_quantity-v_buy_count,v_buy_label; end if;
    if v_free_count<v_template.free_quantity then raise exception 'Add % more % to claim free.',v_template.free_quantity-v_free_count,v_free_label; end if;
    if v_union_count<v_template.buy_quantity+v_template.free_quantity then raise exception 'Add % more eligible item(s) so purchased and free drinks are separate.',v_template.buy_quantity+v_template.free_quantity-v_union_count; end if;
    with units as (
      select p.id,p.category_id,p.price_cents+case when coalesce(i.customization->>'size','') like 'Large%' then 100 else 0 end price
      from jsonb_to_recordset(p_items) i(product_id bigint,quantity integer,customization jsonb,source text) join public.products p on p.id=i.product_id and p.available
      left join public.store_product_availability spa on spa.product_id=p.id and spa.store_id=p_store_id cross join lateral generate_series(1,i.quantity)
      where i.quantity between 1 and 20 and coalesce(spa.available,true)
    ) select coalesce(sum(price),0)::integer into v_discount from (select price from units where v_template.free_scope='any_drink' or (v_template.free_scope='category' and category_id=any(v_template.free_category_ids)) or (v_template.free_scope='product' and id=any(v_template.free_product_ids)) order by price limit v_template.free_quantity) d;
  end if;
  return jsonb_build_object('discount_amount',v_discount,'voucher_title',v_template.title,'user_voucher_id',v_owned_id,'voucher_template_id',v_template.id);
end $$;
revoke all on function public.preview_checkout_voucher(jsonb,bigint,bigint,text) from public,anon;
grant execute on function public.preview_checkout_voucher(jsonb,bigint,bigint,text) to authenticated;

do $$ begin
  begin alter publication supabase_realtime add table public.customer_cart_items;
  exception when duplicate_object then null; end;
end $$;
notify pgrst,'reload schema';
