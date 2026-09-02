alter table public.stores add column if not exists minutes_per_cup numeric(5,2) not null default 1.50;
alter table public.stores add column if not exists buffer_minutes integer not null default 3;
alter table public.stores drop constraint if exists stores_minutes_per_cup_check;
alter table public.stores add constraint stores_minutes_per_cup_check check (minutes_per_cup > 0 and minutes_per_cup <= 30);
alter table public.stores drop constraint if exists stores_buffer_minutes_check;
alter table public.stores add constraint stores_buffer_minutes_check check (buffer_minutes between 0 and 120);

create table if not exists public.store_queue_metrics (
  store_id bigint primary key references public.stores(id) on delete cascade,
  active_cups integer not null default 0 check (active_cups >= 0),
  updated_at timestamptz not null default now()
);

alter table public.store_queue_metrics enable row level security;
drop policy if exists "public can read active store queue" on public.store_queue_metrics;
create policy "public can read active store queue" on public.store_queue_metrics
for select to anon, authenticated
using (exists (select 1 from public.stores where stores.id=store_queue_metrics.store_id and stores.is_active));

create or replace function private.refresh_store_queue(p_store_id bigint) returns void
language sql security definer set search_path=''
as $$
  insert into public.store_queue_metrics(store_id,active_cups,updated_at)
  select p_store_id,coalesce(sum(oi.quantity) filter (where o.status in ('new','preparing')),0)::integer,now()
  from public.orders o left join public.order_items oi on oi.order_id=o.id
  where o.store_id=p_store_id
  on conflict (store_id) do update set active_cups=excluded.active_cups,updated_at=excluded.updated_at
$$;

create or replace function private.refresh_queue_after_order() returns trigger
language plpgsql security definer set search_path=''
as $$
begin
  perform private.refresh_store_queue(coalesce(new.store_id,old.store_id));
  if tg_op='UPDATE' and old.store_id is distinct from new.store_id then perform private.refresh_store_queue(old.store_id); end if;
  return coalesce(new,old);
end
$$;

create or replace function private.refresh_queue_after_item() returns trigger
language plpgsql security definer set search_path=''
as $$
declare v_store_id bigint;
begin
  select store_id into v_store_id from public.orders where id=coalesce(new.order_id,old.order_id);
  perform private.refresh_store_queue(v_store_id);
  return coalesce(new,old);
end
$$;

drop trigger if exists refresh_queue_on_order on public.orders;
create trigger refresh_queue_on_order after insert or delete or update of status,store_id on public.orders for each row execute function private.refresh_queue_after_order();
drop trigger if exists refresh_queue_on_item on public.order_items;
create trigger refresh_queue_on_item after insert or delete or update of quantity,order_id on public.order_items for each row execute function private.refresh_queue_after_item();

insert into public.store_queue_metrics(store_id) select id from public.stores on conflict (store_id) do nothing;
do $$ begin
  alter publication supabase_realtime add table public.store_queue_metrics;
exception when duplicate_object then null;
end $$;
