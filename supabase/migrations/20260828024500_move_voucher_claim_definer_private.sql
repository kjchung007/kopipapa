create or replace function private.claim_voucher_code_impl(p_code text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_code public.voucher_codes%rowtype;
  v_template public.voucher_templates%rowtype;
  v_id bigint;
begin
  if v_user is null then
    raise exception 'Authentication required.';
  end if;
  if coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false) then
    raise exception 'Sign in with an account to claim rewards.';
  end if;
  if nullif(trim(p_code),'') is null or char_length(trim(p_code)) > 64 then
    raise exception 'Enter a valid voucher code.';
  end if;

  select * into v_code
  from public.voucher_codes
  where code=upper(trim(p_code))
  for update;

  if not found or not v_code.active or v_code.claim_count>=v_code.max_claims
     or (v_code.expires_at is not null and v_code.expires_at<=now()) then
    raise exception 'This code is invalid, expired, or already claimed.';
  end if;
  if exists(
    select 1 from public.user_vouchers
    where user_id=v_user and voucher_code_id=v_code.id
  ) then
    raise exception 'You have already claimed this code.';
  end if;

  select * into v_template
  from public.voucher_templates
  where id=v_code.voucher_template_id and active
    and (expires_at is null or expires_at>now());
  if not found then raise exception 'This voucher is no longer available.'; end if;

  insert into public.user_vouchers(user_id,voucher_template_id,voucher_code_id,source,expires_at)
  values(v_user,v_template.id,v_code.id,'secret_code',coalesce(v_code.expires_at,v_template.expires_at))
  returning id into v_id;

  update public.voucher_codes
  set claim_count=claim_count+1,
      active=(claim_count+1<max_claims)
  where id=v_code.id;
  return v_id;
end $$;

revoke all on function private.claim_voucher_code_impl(text) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.claim_voucher_code_impl(text) to authenticated;

create or replace function public.claim_voucher_code(p_code text)
returns bigint
language sql
security invoker
set search_path = ''
as $$
  select private.claim_voucher_code_impl(p_code);
$$;

revoke all on function public.claim_voucher_code(text) from public,anon;
grant execute on function public.claim_voucher_code(text) to authenticated;
notify pgrst,'reload schema';
