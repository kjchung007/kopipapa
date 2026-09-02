create or replace function public.purchase_reward(p_template_id bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid = (select auth.uid());
  v_template public.voucher_templates%rowtype;
  v_id bigint;
begin
  if v_user is null or coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false) then
    raise exception 'Sign in with an account to use rewards.';
  end if;
  if not coalesce((select points_enabled from public.reward_settings where id=true),false) then
    raise exception 'The Voucher Shop is currently unavailable.';
  end if;
  select * into v_template from public.voucher_templates
  where id=p_template_id and active and available_in_shop and point_cost is not null
    and (expires_at is null or expires_at>now()) for update;
  if not found then raise exception 'This reward is not available.'; end if;
  update public.reward_accounts
  set points_balance=points_balance-v_template.point_cost,updated_at=now()
  where user_id=v_user and points_balance>=v_template.point_cost;
  if not found then raise exception 'You do not have enough points.'; end if;
  insert into public.reward_ledger(user_id,entry_type,points_delta,note)
  values(v_user,'points_spent',-v_template.point_cost,'Purchased '||v_template.title);
  insert into public.user_vouchers(user_id,voucher_template_id,source,expires_at)
  values(v_user,v_template.id,'points_shop',v_template.expires_at) returning id into v_id;
  return v_id;
end $$;

revoke all on function public.purchase_reward(bigint) from public,anon;
grant execute on function public.purchase_reward(bigint) to authenticated;
