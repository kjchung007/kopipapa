alter table public.reward_settings
  add column if not exists points_enabled boolean not null default true,
  add column if not exists stamp_enabled boolean not null default false;

update public.reward_settings
set points_enabled = active_system = 'points',
    stamp_enabled = active_system = 'stamp'
where id = true;

create or replace function private.award_completed_order_rewards()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.reward_settings%rowtype;
  v_points integer;
  v_stamps integer;
  v_rewards integer;
  v_template public.voucher_templates%rowtype;
begin
  if new.status <> 'completed' or old.status = 'completed' or new.user_id is null then return new; end if;
  if coalesce((select is_anonymous from auth.users where id = new.user_id), false) then return new; end if;

  select * into v_settings from public.reward_settings where id = true;
  insert into public.reward_accounts(user_id) values(new.user_id) on conflict(user_id) do nothing;

  if v_settings.points_enabled then
    v_points = floor(new.total_cents::numeric * v_settings.points_per_rm / 100)::integer;
    update public.reward_accounts
    set points_balance = points_balance + v_points,
        lifetime_points = lifetime_points + v_points,
        updated_at = now()
    where user_id = new.user_id;
    insert into public.reward_ledger(user_id,order_id,entry_type,points_delta,note)
    values(new.user_id,new.id,'points_earned',v_points,'Points from '||new.order_number)
    on conflict do nothing;
  end if;

  if v_settings.stamp_enabled then
    select coalesce(sum(quantity),0)::integer into v_stamps
    from public.order_items where order_id = new.id;
    update public.reward_accounts
    set stamp_count = stamp_count + v_stamps, updated_at = now()
    where user_id = new.user_id
    returning stamp_count / v_settings.stamp_threshold into v_rewards;
    insert into public.reward_ledger(user_id,order_id,entry_type,stamps_delta,note)
    values(new.user_id,new.id,'stamps_earned',v_stamps,'Stamps from '||new.order_number)
    on conflict do nothing;
    if v_rewards > 0 and v_settings.stamp_reward_template_id is not null then
      select * into v_template from public.voucher_templates
      where id = v_settings.stamp_reward_template_id and active;
      if found then
        insert into public.user_vouchers(user_id,voucher_template_id,source,expires_at)
        select new.user_id,v_template.id,'stamp_reward',v_template.expires_at
        from generate_series(1,v_rewards);
        update public.reward_accounts
        set stamp_count = stamp_count - (v_rewards * v_settings.stamp_threshold)
        where user_id = new.user_id;
      end if;
    end if;
  end if;
  return new;
end $$;

notify pgrst, 'reload schema';
