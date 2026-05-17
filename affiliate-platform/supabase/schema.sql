create extension if not exists "pgcrypto";

-- This schema matches the current affiliate API routes:
-- - affiliates uses promo_code
-- - referrals/commissions use amount_idr fields
create table if not exists affiliates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  promo_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references affiliates(id) on delete cascade,
  referred_user_id text not null,
  subscription_plan text,
  amount_idr numeric(12,2) not null default 0,
  commission_idr numeric(12,2) not null default 0,
  status text not null default 'trial_active',
  created_at timestamptz not null default now()
);

create table if not exists commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references affiliates(id) on delete cascade,
  referral_id uuid unique references referrals(id) on delete set null,
  amount_idr numeric(12,2) not null default 0,
  status text not null default 'confirmed',
  created_at timestamptz not null default now()
);

-- Migration-safe updates for databases that were created from older schema versions.
alter table if exists affiliates add column if not exists promo_code text;
alter table if exists referrals add column if not exists amount_idr numeric(12,2) not null default 0;
alter table if exists referrals add column if not exists commission_idr numeric(12,2) not null default 0;
alter table if exists referrals add column if not exists subscription_plan text;
alter table if exists commissions add column if not exists amount_idr numeric(12,2) not null default 0;
alter table if exists commissions add column if not exists referral_id uuid;
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'commissions_referral_id_fkey'
  ) then
    alter table commissions
      add constraint commissions_referral_id_fkey
      foreign key (referral_id) references referrals(id) on delete set null;
  end if;
end $$;
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'commissions_referral_id_key'
  ) then
    alter table commissions
      add constraint commissions_referral_id_key unique (referral_id);
  end if;
end $$;

alter table referrals drop constraint if exists referrals_subscription_plan_check;
alter table referrals
  add constraint referrals_subscription_plan_check
  check (subscription_plan is null or subscription_plan in ('bulanan', 'tahunan'));

alter table referrals drop constraint if exists referrals_status_check;
alter table referrals
  add constraint referrals_status_check
  check (status in ('trial_active', 'converted', 'expired', 'cancelled'));

alter table referrals add column if not exists app_redemption_id uuid;
alter table referrals add column if not exists referral_code_id uuid;
alter table referrals add column if not exists trial_started_at timestamptz;
alter table referrals add column if not exists converted_at timestamptz;
alter table referrals add column if not exists updated_at timestamptz not null default now();

create unique index if not exists idx_referrals_referred_user_id on referrals(referred_user_id);

-- Commission policy: affiliate earns 30% from each converted referral purchase.
create or replace function set_referral_commission_30pct()
returns trigger
language plpgsql
as $$
begin
  if coalesce(new.amount_idr, 0) < 0 then
    raise exception 'amount_idr cannot be negative';
  end if;
  new.commission_idr := round(coalesce(new.amount_idr, 0) * 0.30, 2);
  return new;
end;
$$;

drop trigger if exists trg_set_referral_commission_10pct on referrals;
drop trigger if exists trg_set_referral_commission_30pct on referrals;
create trigger trg_set_referral_commission_30pct
before insert or update of amount_idr
on referrals
for each row
execute function set_referral_commission_30pct();

create or replace function sync_referral_commission_to_earnings()
returns trigger
language plpgsql
as $$
begin
  if new.status <> 'converted' then
    return new;
  end if;

  insert into commissions (affiliate_id, referral_id, amount_idr, status)
  values (new.affiliate_id, new.id, new.commission_idr, 'confirmed')
  on conflict (referral_id)
  do update set amount_idr = excluded.amount_idr, status = excluded.status;

  return new;
end;
$$;

drop trigger if exists trg_sync_referral_commission_to_earnings on referrals;
create trigger trg_sync_referral_commission_to_earnings
after insert or update of amount_idr, commission_idr, status
on referrals
for each row
execute function sync_referral_commission_to_earnings();

-- Backfill existing converted referrals to 30% commission and sync earnings.
update referrals
set commission_idr = round(coalesce(amount_idr, 0) * 0.30, 2)
where status = 'converted';

insert into commissions (affiliate_id, referral_id, amount_idr, status)
select affiliate_id, id, commission_idr, 'confirmed'
from referrals
where status = 'converted'
on conflict (referral_id)
do update set amount_idr = excluded.amount_idr, status = excluded.status;

-- If old column exists, copy existing referral codes into promo_code.
update affiliates
set promo_code = referral_code
where promo_code is null
  and referral_code is not null;

-- Fill any remaining null promo codes so constraints/index can be applied safely.
update affiliates
set promo_code = upper(substr(md5(id::text), 1, 8))
where promo_code is null;

alter table affiliates alter column promo_code set not null;

create unique index if not exists idx_affiliates_promo_code on affiliates(promo_code);
create index if not exists idx_affiliates_email on affiliates(email);
create index if not exists idx_referrals_affiliate_created on referrals(affiliate_id, created_at desc);
create index if not exists idx_commissions_affiliate_created on commissions(affiliate_id, created_at desc);
