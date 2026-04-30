create extension if not exists "pgcrypto";

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
  amount_idr numeric(12,2) not null default 0,
  commission_idr numeric(12,2) not null default 0,
  status text not null default 'converted',
  created_at timestamptz not null default now()
);

create table if not exists commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references affiliates(id) on delete cascade,
  amount_idr numeric(12,2) not null default 0,
  status text not null default 'confirmed',
  created_at timestamptz not null default now()
);

create index if not exists idx_affiliates_promo_code on affiliates(promo_code);
create index if not exists idx_referrals_affiliate_created on referrals(affiliate_id, created_at desc);
create index if not exists idx_commissions_affiliate_created on commissions(affiliate_id, created_at desc);
create extension if not exists "pgcrypto";

create table if not exists affiliates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  referral_code text not null unique,
  payment_method text,
  payment_details text,
  social_links jsonb not null default '{}'::jsonb,
  notification_preferences jsonb not null default '{"email":true,"product":true,"milestones":true}'::jsonb,
  role text not null default 'affiliate',
  created_at timestamptz not null default now()
);

create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references affiliates(id) on delete cascade,
  referred_user_id uuid not null unique,
  referred_email text not null,
  ip_address text not null,
  user_agent text not null,
  status text not null default 'signup',
  created_at timestamptz not null default now()
);

create table if not exists affiliate_metrics (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references affiliates(id) on delete cascade,
  period_start timestamptz not null default now(),
  clicks int not null default 0,
  visits int not null default 0,
  signups int not null default 0,
  conversions int not null default 0,
  rewards numeric(10,2) not null default 0,
  points int generated always as ((signups * 5) + (conversions * 20)) stored
);

create table if not exists payouts (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references affiliates(id) on delete cascade,
  amount_usd numeric(10,2) not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists affiliate_events (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references affiliates(id) on delete cascade,
  event_type text not null,
  message text not null,
  points_delta int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references affiliates(id) on delete cascade,
  referral_id uuid references referrals(id) on delete set null,
  amount_usd numeric(10,2) not null,
  status text not null default 'pending',
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists marketing_assets (
  id uuid primary key default gen_random_uuid(),
  asset_type text not null,
  title text not null,
  description text,
  file_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_affiliate_metrics_affiliate_id on affiliate_metrics(affiliate_id);
create index if not exists idx_referrals_affiliate_id on referrals(affiliate_id);
create index if not exists idx_referrals_created_at on referrals(created_at desc);
create index if not exists idx_affiliates_referral_code on affiliates(referral_code);
create index if not exists idx_affiliate_events_affiliate_id on affiliate_events(affiliate_id,created_at desc);
