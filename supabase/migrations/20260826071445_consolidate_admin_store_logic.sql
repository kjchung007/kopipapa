-- Admin form timestamps and PostgREST schema-cache repair.
alter table public.categories add column if not exists updated_at timestamptz not null default now();
alter table public.staff add column if not exists updated_at timestamptz not null default now();

-- Durable historical sales totals. An order is counted at most once.
alter table public.products add column if not exists sold integer not null default 0 check (sold >= 0);
alter table public.orders add column if not exists sold_counted_at timestamptz;

update public.products p
set sold = totals.quantity
from (
  select oi.product_id, sum(oi.quantity)::integer as quantity
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.status = 'completed' and oi.product_id is not null
  group by oi.product_id
) totals
where p.id = totals.product_id;

update public.products p
set sold = 0
where not exists (
  select 1 from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.status = 'completed' and oi.product_id = p.id
);

update public.orders set sold_counted_at = coalesce(sold_counted_at, updated_at, now()) where status = 'completed';

create or replace function private.count_completed_order_sales() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'completed'
     and old.status is distinct from 'completed'
     and old.sold_counted_at is null then
    update public.products p
    set sold = p.sold + sold_items.quantity
    from (
      select oi.product_id, sum(oi.quantity)::integer as quantity
      from public.order_items oi
      where oi.order_id = new.id and oi.product_id is not null
      group by oi.product_id
    ) sold_items
    where p.id = sold_items.product_id;
    new.sold_counted_at := now();
  end if;
  return new;
end
$$;

revoke all on function private.count_completed_order_sales() from public, anon, authenticated;
drop trigger if exists count_completed_order_sales on public.orders;
create trigger count_completed_order_sales
before update of status on public.orders
for each row execute function private.count_completed_order_sales();

-- A row-locked sequence per store makes order numbers safe under concurrent checkout.
create table if not exists private.store_order_sequences (
  store_id bigint primary key references public.stores(id) on delete cascade,
  last_value bigint not null default 0 check (last_value >= 0)
);
revoke all on private.store_order_sequences from public, anon, authenticated;

alter table public.orders alter column order_number drop expression if exists;

with numbered as (
  select id, store_id, row_number() over (partition by store_id order by created_at, id) as store_number
  from public.orders
  where store_id is not null
)
update public.orders o
set order_number = format('KP%s-%s', numbered.store_id, lpad(numbered.store_number::text, 4, '0'))
from numbered
where o.id = numbered.id;

insert into private.store_order_sequences(store_id, last_value)
select store_id, count(*)::bigint from public.orders where store_id is not null group by store_id
on conflict (store_id) do update set last_value = greatest(private.store_order_sequences.last_value, excluded.last_value);

create unique index if not exists orders_order_number_key on public.orders(order_number);

create or replace function private.assign_store_order_number() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare next_value bigint;
begin
  if new.store_id is null then
    raise exception 'A store is required before creating an order';
  end if;

  insert into private.store_order_sequences(store_id, last_value)
  values (new.store_id, 1)
  on conflict (store_id) do update
  set last_value = private.store_order_sequences.last_value + 1
  returning last_value into next_value;

  new.order_number := format('KP%s-%s', new.store_id, lpad(next_value::text, 4, '0'));
  return new;
end
$$;

revoke all on function private.assign_store_order_number() from public, anon, authenticated;
drop trigger if exists assign_store_order_number on public.orders;
create trigger assign_store_order_number
before insert on public.orders
for each row execute function private.assign_store_order_number();

notify pgrst, 'reload schema';
