alter table public.stores
  add column if not exists opening_time time without time zone not null default time '10:00',
  add column if not exists closing_time time without time zone not null default time '22:00';

comment on column public.stores.opening_time is 'Branch opening time in the store local timezone.';
comment on column public.stores.closing_time is 'Branch closing time in the store local timezone. Equal opening and closing times represent 24-hour operation.';
