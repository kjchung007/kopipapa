-- Product-level choices shared by customer ordering and the counter POS.
alter table public.products
  add column if not exists size_options jsonb not null default '[{"name":"Regular","price_delta_cents":0},{"name":"Large","price_delta_cents":100}]'::jsonb,
  add column if not exists temperature_options text[] not null default array['Iced','Hot']::text[],
  add column if not exists topping_options jsonb not null default '[]'::jsonb;

alter table public.products drop constraint if exists products_size_options_shape;
alter table public.products add constraint products_size_options_shape check (
  jsonb_typeof(size_options)='array' and jsonb_array_length(size_options) between 1 and 10
);
alter table public.products drop constraint if exists products_temperature_options_shape;
alter table public.products add constraint products_temperature_options_shape check (
  cardinality(temperature_options) between 1 and 10
);
alter table public.products drop constraint if exists products_topping_options_shape;
alter table public.products add constraint products_topping_options_shape check (
  jsonb_typeof(topping_options)='array' and jsonb_array_length(topping_options) <= 30
);

alter table public.orders
  add column if not exists order_channel text not null default 'online',
  add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.orders alter column user_id drop not null;
alter table public.orders drop constraint if exists orders_order_channel_check;
alter table public.orders add constraint orders_order_channel_check
  check (order_channel in ('online','counter'));
alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method is null or payment_method in ('fpx','touch_n_go','cash','card','other'));

create or replace function private.create_counter_order_impl(
  p_store_id bigint,
  p_customer_name text,
  p_items jsonb,
  p_payment_method text
) returns public.orders
language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid := (select auth.uid());
  v_staff public.staff%rowtype;
  v_order public.orders;
  v_subtotal integer := 0;
  v_item_count integer := 0;
begin
  if v_user is null then raise exception 'Staff sign-in is required'; end if;
  select * into v_staff from public.staff
    where user_id=v_user and active limit 1;
  if not found then raise exception 'This account is not an active staff account'; end if;
  if v_staff.role <> 'global_admin'::public.admin_role and v_staff.store_id is distinct from p_store_id then
    raise exception 'You can only create orders for your assigned branch';
  end if;
  if not exists(select 1 from public.stores where id=p_store_id and active) then
    raise exception 'Choose an active branch';
  end if;
  if p_payment_method not in ('cash','card','other') then
    raise exception 'Choose cash, card, or other payment';
  end if;
  if jsonb_typeof(coalesce(p_items,'[]'::jsonb)) <> 'array' then
    raise exception 'Order items must be an array';
  end if;

  with requested as (
    select * from jsonb_to_recordset(p_items)
      as i(product_id bigint,quantity integer,customization jsonb)
  ), priced as (
    select i.product_id,i.quantity,coalesce(i.customization,'{}'::jsonb) customization,
      p.price_cents,
      coalesce((select (s->>'price_delta_cents')::integer from jsonb_array_elements(p.size_options) s
        where s->>'name'=i.customization->>'size' limit 1),0) size_delta,
      coalesce((select sum((t->>'price_cents')::integer) from jsonb_array_elements(p.topping_options) t
        where t->>'name' in (select jsonb_array_elements_text(coalesce(i.customization->'toppings','[]'::jsonb)))),0)::integer topping_delta
    from requested i
    join public.products p on p.id=i.product_id and p.available
    left join public.store_product_availability spa on spa.product_id=p.id and spa.store_id=p_store_id
    where i.quantity between 1 and 20 and coalesce(spa.available,true)
      and exists(select 1 from jsonb_array_elements(p.size_options) s where s->>'name'=i.customization->>'size')
      and coalesce(i.customization->>'temperature','')=any(p.temperature_options)
      and not exists (
        select 1 from jsonb_array_elements_text(coalesce(i.customization->'toppings','[]'::jsonb)) as chosen(name)
        where not exists(select 1 from jsonb_array_elements(p.topping_options) t where t->>'name'=chosen.name)
      )
  )
  select coalesce(sum((price_cents+size_delta+topping_delta)*quantity),0)::integer,
         coalesce(sum(quantity),0)::integer
  into v_subtotal,v_item_count from priced;
  if v_subtotal <= 0 or v_item_count <= 0 then raise exception 'Order has no available items'; end if;

  insert into public.orders(
    user_id,store_id,customer_name,total_cents,subtotal,discount_amount,tax_amount,
    final_total,payment_status,payment_method,status,order_channel,created_by
  ) values (
    null,p_store_id,left(coalesce(nullif(trim(p_customer_name),''),'Walk-in'),80),
    v_subtotal,v_subtotal,0,0,v_subtotal,'paid',p_payment_method,'new','counter',v_user
  ) returning * into v_order;

  insert into public.order_items(order_id,product_id,product_name,unit_price_cents,quantity,customization)
  select v_order.id,p.id,p.name,
    p.price_cents+
      coalesce((select (s->>'price_delta_cents')::integer from jsonb_array_elements(p.size_options) s
        where s->>'name'=i.customization->>'size' limit 1),0)+
      coalesce((select sum((t->>'price_cents')::integer) from jsonb_array_elements(p.topping_options) t
        where t->>'name' in (select jsonb_array_elements_text(coalesce(i.customization->'toppings','[]'::jsonb)))),0)::integer,
    i.quantity,coalesce(i.customization,'{}'::jsonb)
  from jsonb_to_recordset(p_items) as i(product_id bigint,quantity integer,customization jsonb)
  join public.products p on p.id=i.product_id and p.available
  left join public.store_product_availability spa on spa.product_id=p.id and spa.store_id=p_store_id
  where i.quantity between 1 and 20 and coalesce(spa.available,true);
  return v_order;
end $$;

revoke all on function private.create_counter_order_impl(bigint,text,jsonb,text) from public,anon,authenticated;
-- The public SECURITY INVOKER wrapper executes as the signed-in staff member,
-- so it needs permission to delegate to this non-exposed implementation.
-- The implementation independently validates auth.uid(), staff status, and store scope.
grant execute on function private.create_counter_order_impl(bigint,text,jsonb,text) to authenticated;

create or replace function public.create_counter_order(
  p_store_id bigint,p_customer_name text,p_items jsonb,p_payment_method text
) returns public.orders language plpgsql security invoker set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Staff sign-in is required'; end if;
  if not exists(select 1 from public.staff s where s.user_id=auth.uid() and s.active
    and (s.role='global_admin'::public.admin_role or s.store_id=p_store_id)) then
    raise exception 'You cannot create an order for this branch';
  end if;
  return private.create_counter_order_impl(p_store_id,p_customer_name,p_items,p_payment_method);
end $$;
revoke all on function public.create_counter_order(bigint,text,jsonb,text) from public,anon;
grant execute on function public.create_counter_order(bigint,text,jsonb,text) to authenticated;

-- Public waiting board projection: deliberately contains no customer identity or item details.
create table if not exists public.waiting_board_entries (
  order_id bigint primary key references public.orders(id) on delete cascade,
  store_id bigint not null references public.stores(id) on delete cascade,
  order_number text not null,
  status text not null check (status in ('preparing','ready')),
  updated_at timestamptz not null default now()
);
create index if not exists waiting_board_entries_store_status_idx
  on public.waiting_board_entries(store_id,status,updated_at);
alter table public.waiting_board_entries enable row level security;
drop policy if exists public_can_read_active_store_waiting_board on public.waiting_board_entries;
create policy public_can_read_active_store_waiting_board on public.waiting_board_entries
  for select to anon,authenticated using (
    exists(select 1 from public.stores s where s.id=store_id and s.active)
  );
revoke all on public.waiting_board_entries from public;
grant select on public.waiting_board_entries to anon,authenticated;

create or replace function private.sync_waiting_board_entry()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status in ('preparing','ready') and
     (new.payment_status='paid' or new.order_channel='counter') then
    insert into public.waiting_board_entries(order_id,store_id,order_number,status,updated_at)
      values(new.id,new.store_id,new.order_number,new.status,now())
      on conflict(order_id) do update set store_id=excluded.store_id,
        order_number=excluded.order_number,status=excluded.status,updated_at=now();
  else
    delete from public.waiting_board_entries where order_id=new.id;
  end if;
  return new;
end $$;
revoke all on function private.sync_waiting_board_entry() from public,anon,authenticated;
drop trigger if exists sync_waiting_board_entry on public.orders;
create trigger sync_waiting_board_entry after insert or update of status,payment_status,store_id,order_number
  on public.orders for each row execute function private.sync_waiting_board_entry();

insert into public.waiting_board_entries(order_id,store_id,order_number,status,updated_at)
select id,store_id,order_number,status,coalesce(updated_at,created_at,now())
from public.orders where status in ('preparing','ready')
  and (payment_status='paid' or order_channel='counter')
on conflict(order_id) do update set status=excluded.status,updated_at=excluded.updated_at;

do $$ begin
  begin alter publication supabase_realtime add table public.waiting_board_entries;
  exception when duplicate_object then null; end;
end $$;
notify pgrst,'reload schema';
