-- Keep affiliate website promo_code and app referral_codes in sync.
-- One source of truth behavior:
-- - Affiliate updates promo_code on public.affiliates
-- - Trigger mirrors it into public.referral_codes (code_kind='affiliate')
-- - App redeem RPC reads public.referral_codes, so both flows stay aligned.

create or replace function public.sync_affiliate_code_to_referral_codes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_user_id uuid;
  v_code text;
  v_existing_code_owner uuid;
begin
  v_code := upper(trim(new.promo_code));
  if v_code is null or length(v_code) < 4 then
    return new;
  end if;

  -- Link affiliate row to auth user via email.
  select u.id
  into v_owner_user_id
  from auth.users u
  where lower(u.email) = lower(new.email)
  limit 1;

  -- If no auth user exists yet, skip sync for now.
  if v_owner_user_id is null then
    return new;
  end if;

  -- Guard against assigning code already owned by another affiliate owner.
  select rc.owner_user_id
  into v_existing_code_owner
  from public.referral_codes rc
  where rc.code_normalized = v_code
  limit 1;

  if v_existing_code_owner is not null and v_existing_code_owner <> v_owner_user_id then
    raise exception 'Promo code % is already linked to another account.', v_code;
  end if;

  insert into public.referral_codes (
    code_normalized,
    owner_user_id,
    code_kind,
    trial_days,
    is_active,
    usage_limit,
    expires_at,
    created_by
  ) values (
    v_code,
    v_owner_user_id,
    'affiliate',
    7,
    true,
    null,
    null,
    v_owner_user_id
  )
  on conflict (owner_user_id) where code_kind = 'affiliate'
  do update
  set
    code_normalized = excluded.code_normalized,
    trial_days = 7,
    is_active = true,
    usage_limit = null,
    expires_at = null,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists trg_sync_affiliate_code_to_referral_codes on public.affiliates;
create trigger trg_sync_affiliate_code_to_referral_codes
after insert or update of promo_code, email
on public.affiliates
for each row
execute function public.sync_affiliate_code_to_referral_codes();

-- Backfill existing affiliates into referral_codes.
with affiliates_mapped as (
  select
    upper(trim(a.promo_code)) as code_normalized,
    u.id as owner_user_id
  from public.affiliates a
  join auth.users u on lower(u.email) = lower(a.email)
  where a.promo_code is not null
    and length(trim(a.promo_code)) >= 4
)
insert into public.referral_codes (
  code_normalized,
  owner_user_id,
  code_kind,
  trial_days,
  is_active,
  usage_limit,
  expires_at,
  created_by
)
select
  am.code_normalized,
  am.owner_user_id,
  'affiliate',
  7,
  true,
  null,
  null,
  am.owner_user_id
from affiliates_mapped am
on conflict (owner_user_id) where code_kind = 'affiliate'
do update
set
  code_normalized = excluded.code_normalized,
  trial_days = 7,
  is_active = true,
  usage_limit = null,
  expires_at = null,
  updated_at = now();
