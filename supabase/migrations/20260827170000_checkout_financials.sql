alter table public.orders
  add column if not exists subtotal integer,
  add column if not exists discount_amount integer not null default 0,
  add column if not exists tax_amount integer not null default 0,
  add column if not exists voucher_id bigint references public.user_vouchers(id) on delete set null,
  add column if not exists voucher_title text,
  add column if not exists final_total integer,
  add column if not exists upsell_item_count integer not null default 0;

update public.orders
set subtotal = coalesce(subtotal, total_cents),
    final_total = coalesce(final_total, total_cents)
where subtotal is null or final_total is null;

alter table public.orders
  alter column subtotal set not null,
  alter column final_total set not null;

alter table public.orders drop constraint if exists orders_checkout_amounts_check;
alter table public.orders add constraint orders_checkout_amounts_check check (
  subtotal >= 0 and discount_amount >= 0 and tax_amount >= 0 and
  discount_amount <= subtotal and final_total = subtotal - discount_amount + tax_amount and
  total_cents = final_total and upsell_item_count >= 0
);

create index if not exists orders_voucher_id_idx on public.orders(voucher_id) where voucher_id is not null;
create index if not exists orders_store_created_financial_idx on public.orders(store_id, created_at desc) include (subtotal, discount_amount, final_total);

create or replace function public.preview_checkout_voucher(
  p_items jsonb,
  p_store_id bigint,
  p_user_voucher_id bigint default null,
  p_secret_code text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_template public.voucher_templates%rowtype;
  v_owned_id bigint;
  v_subtotal integer;
  v_eligible_count integer := 0;
  v_lowest_eligible integer;
  v_discount integer := 0;
  v_missing integer;
  v_scope_label text := 'eligible item';
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_user_voucher_id is not null and nullif(trim(p_secret_code),'') is not null then
    raise exception 'Choose either a voucher or a secret code, not both.';
  end if;

  select coalesce(sum((p.price_cents + case when coalesce(i.customization->>'size','') like 'Large%' then 100 else 0 end) * i.quantity),0)::integer
  into v_subtotal
  from jsonb_to_recordset(p_items) as i(product_id bigint, quantity integer, customization jsonb, source text)
  join public.products p on p.id=i.product_id and p.available
  left join public.store_product_availability spa on spa.product_id=p.id and spa.store_id=p_store_id
  where i.quantity between 1 and 20 and coalesce(spa.available,true);

  if v_subtotal <= 0 then raise exception 'Order has no available items.'; end if;
  if p_user_voucher_id is null and nullif(trim(p_secret_code),'') is null then
    return jsonb_build_object('discount_amount',0,'voucher_title',null,'user_voucher_id',null);
  end if;

  if p_user_voucher_id is not null then
    select vt.* into v_template
    from public.user_vouchers uv
    join public.voucher_templates vt on vt.id=uv.voucher_template_id
    where uv.id=p_user_voucher_id and uv.user_id=v_user and uv.status='active'
      and (uv.expires_at is null or uv.expires_at>now()) and vt.active;
    v_owned_id := p_user_voucher_id;
  else
    select vt.* into v_template
    from public.voucher_codes vc
    join public.voucher_templates vt on vt.id=vc.voucher_template_id
    where vc.code=upper(trim(p_secret_code)) and vc.active and vc.claim_count<vc.max_claims
      and (vc.expires_at is null or vc.expires_at>now()) and vt.active
      and (vt.expires_at is null or vt.expires_at>now());
  end if;
  if not found then raise exception 'This voucher is invalid, expired, used, or unavailable.'; end if;

  if v_template.valid_scope='category' then
    select name into v_scope_label from public.categories where id=v_template.category_id;
  elsif v_template.valid_scope='product' then
    select name into v_scope_label from public.products where id=v_template.product_id;
  else
    v_scope_label := 'eligible item';
  end if;

  select coalesce(sum(i.quantity),0)::integer,
         min(p.price_cents + case when coalesce(i.customization->>'size','') like 'Large%' then 100 else 0 end)
  into v_eligible_count, v_lowest_eligible
  from jsonb_to_recordset(p_items) as i(product_id bigint, quantity integer, customization jsonb, source text)
  join public.products p on p.id=i.product_id and p.available
  left join public.store_product_availability spa on spa.product_id=p.id and spa.store_id=p_store_id
  where i.quantity between 1 and 20 and coalesce(spa.available,true)
    and (v_template.valid_scope='any_drink'
      or (v_template.valid_scope='category' and p.category_id=v_template.category_id)
      or (v_template.valid_scope='product' and p.id=v_template.product_id));

  if v_template.voucher_type='amount_off' then
    if v_subtotal <= v_template.amount_off_cents then
      raise exception 'Total order amount must be greater than the voucher value.';
    end if;
    v_discount := v_template.amount_off_cents;
  elsif v_template.voucher_type='free_drink' then
    if v_eligible_count < 1 then
      raise exception 'Add 1 more % to use this voucher.', v_scope_label;
    end if;
    v_discount := v_lowest_eligible;
  else
    v_missing := (v_template.buy_quantity + 1) - v_eligible_count;
    if v_missing > 0 then
      raise exception 'Add % more % to use this voucher.', v_missing, v_scope_label;
    end if;
    v_discount := v_lowest_eligible;
  end if;

  return jsonb_build_object(
    'discount_amount',v_discount,
    'voucher_title',v_template.title,
    'user_voucher_id',v_owned_id,
    'voucher_template_id',v_template.id
  );
end $$;

drop function if exists public.create_pickup_order(text,jsonb,bigint);
create or replace function public.create_pickup_order(
  p_customer_name text,
  p_items jsonb,
  p_store_id bigint,
  p_user_voucher_id bigint default null,
  p_secret_code text default null
) returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  created_order public.orders;
  v_preview jsonb;
  v_subtotal integer;
  v_discount integer;
  v_tax integer := 0;
  v_final integer;
  v_voucher_id bigint;
  v_voucher_title text;
  v_code public.voucher_codes%rowtype;
  v_template_id bigint;
  v_input_rows integer;
  v_valid_rows integer;
  v_upsell_count integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.stores where id=p_store_id and active and accepting_pickup) then
    raise exception 'This store is not accepting pickup orders';
  end if;

  select count(*)::integer into v_input_rows from jsonb_to_recordset(p_items) as i(product_id bigint,quantity integer,customization jsonb,source text);
  select count(*)::integer,
         coalesce(sum((p.price_cents + case when coalesce(i.customization->>'size','') like 'Large%' then 100 else 0 end) * i.quantity),0)::integer,
         coalesce(sum(case when i.source='upsell' then i.quantity else 0 end),0)::integer
  into v_valid_rows,v_subtotal,v_upsell_count
  from jsonb_to_recordset(p_items) as i(product_id bigint,quantity integer,customization jsonb,source text)
  join public.products p on p.id=i.product_id and p.available
  left join public.store_product_availability spa on spa.product_id=p.id and spa.store_id=p_store_id
  where i.quantity between 1 and 20 and coalesce(spa.available,true);
  if v_input_rows=0 or v_valid_rows<>v_input_rows then
    raise exception 'One or more cart items are unavailable. Refresh your cart and try again.';
  end if;

  v_preview := public.preview_checkout_voucher(p_items,p_store_id,p_user_voucher_id,p_secret_code);
  v_discount := coalesce((v_preview->>'discount_amount')::integer,0);
  v_voucher_id := (v_preview->>'user_voucher_id')::bigint;
  v_voucher_title := v_preview->>'voucher_title';
  v_template_id := (v_preview->>'voucher_template_id')::bigint;

  if p_user_voucher_id is not null then
    perform 1 from public.user_vouchers
    where id=p_user_voucher_id and user_id=v_user and status='active'
      and (expires_at is null or expires_at>now()) for update;
    if not found then raise exception 'This voucher was already used or is no longer available.'; end if;
  elsif nullif(trim(p_secret_code),'') is not null then
    select * into v_code from public.voucher_codes where code=upper(trim(p_secret_code)) for update;
    if not found or not v_code.active or v_code.claim_count>=v_code.max_claims or (v_code.expires_at is not null and v_code.expires_at<=now()) then
      raise exception 'This code is invalid, expired, or already claimed.';
    end if;
    if exists(select 1 from public.user_vouchers where user_id=v_user and voucher_code_id=v_code.id) then
      raise exception 'You have already claimed this code.';
    end if;
    insert into public.user_vouchers(user_id,voucher_template_id,voucher_code_id,source,expires_at)
    select v_user,v_template_id,v_code.id,'secret_code',coalesce(v_code.expires_at,vt.expires_at)
    from public.voucher_templates vt where vt.id=v_template_id
    returning id into v_voucher_id;
    update public.voucher_codes set claim_count=claim_count+1,active=(claim_count+1<max_claims) where id=v_code.id;
  end if;

  v_final := v_subtotal - v_discount + v_tax;
  insert into public.orders(user_id,store_id,customer_name,total_cents,subtotal,discount_amount,tax_amount,voucher_id,voucher_title,final_total,upsell_item_count)
  values(v_user,p_store_id,left(coalesce(nullif(trim(p_customer_name),''),'Guest'),80),v_final,v_subtotal,v_discount,v_tax,v_voucher_id,v_voucher_title,v_final,v_upsell_count)
  returning * into created_order;

  insert into public.order_items(order_id,product_id,product_name,unit_price_cents,quantity,customization)
  select created_order.id,p.id,p.name,
         p.price_cents + case when coalesce(i.customization->>'size','') like 'Large%' then 100 else 0 end,
         i.quantity,coalesce(i.customization,'{}'::jsonb)
  from jsonb_to_recordset(p_items) as i(product_id bigint,quantity integer,customization jsonb,source text)
  join public.products p on p.id=i.product_id and p.available
  left join public.store_product_availability spa on spa.product_id=p.id and spa.store_id=p_store_id
  where i.quantity between 1 and 20 and coalesce(spa.available,true);

  if v_voucher_id is not null then
    update public.user_vouchers set status='used',used_at=now(),order_id=created_order.id
    where id=v_voucher_id and user_id=v_user and status='active';
    if not found then raise exception 'This voucher could not be applied.'; end if;
  end if;
  return created_order;
end $$;

revoke all on function public.preview_checkout_voucher(jsonb,bigint,bigint,text) from public,anon;
revoke all on function public.create_pickup_order(text,jsonb,bigint,bigint,text) from public,anon;
grant execute on function public.preview_checkout_voucher(jsonb,bigint,bigint,text) to authenticated;
grant execute on function public.create_pickup_order(text,jsonb,bigint,bigint,text) to authenticated;

notify pgrst, 'reload schema';
