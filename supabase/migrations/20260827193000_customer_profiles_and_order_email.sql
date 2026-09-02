alter table public.profiles
  add column if not exists phone text;

alter table public.orders
  add column if not exists customer_email text;

create or replace function public.capture_order_customer_email()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.customer_email is null or btrim(new.customer_email) = '' then
    select email into new.customer_email
    from auth.users
    where id = new.user_id;
  end if;
  return new;
end;
$$;

revoke all on function public.capture_order_customer_email() from public, anon, authenticated;

drop trigger if exists capture_order_customer_email on public.orders;
create trigger capture_order_customer_email
before insert or update of user_id on public.orders
for each row execute function public.capture_order_customer_email();

update public.orders o
set customer_email = u.email
from auth.users u
where u.id = o.user_id
  and (o.customer_email is null or btrim(o.customer_email) = '');

comment on column public.profiles.phone is 'Customer-managed contact phone number.';
comment on column public.orders.customer_email is 'Immutable-at-checkout customer email snapshot populated by the database.';
