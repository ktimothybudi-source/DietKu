-- Affiliate dashboard: track trial starts (trial_active) vs paid conversions (converted).
-- Links app referral_redemptions → public.referrals / commissions for the affiliate website.

-- ---------------------------------------------------------------------------
-- Affiliate tables (same shape as affiliate-platform/supabase/schema.sql)
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  promo_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  referred_user_id TEXT NOT NULL,
  subscription_plan TEXT,
  amount_idr NUMERIC(12,2) NOT NULL DEFAULT 0,
  commission_idr NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'trial_active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  referral_id UUID UNIQUE REFERENCES public.referrals(id) ON DELETE SET NULL,
  amount_idr NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.affiliates ADD COLUMN IF NOT EXISTS promo_code TEXT;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS amount_idr NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS commission_idr NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS subscription_plan TEXT;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS app_redemption_id UUID;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS referral_code_id UUID;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_referred_user_id
  ON public.referrals (referred_user_id);

CREATE INDEX IF NOT EXISTS idx_referrals_affiliate_status
  ON public.referrals (affiliate_id, status, created_at DESC);

ALTER TABLE public.referrals DROP CONSTRAINT IF EXISTS referrals_status_check;
ALTER TABLE public.referrals
  ADD CONSTRAINT referrals_status_check
  CHECK (status IN ('trial_active', 'converted', 'expired', 'cancelled'));

ALTER TABLE public.referrals DROP CONSTRAINT IF EXISTS referrals_subscription_plan_check;
ALTER TABLE public.referrals
  ADD CONSTRAINT referrals_subscription_plan_check
  CHECK (subscription_plan IS NULL OR subscription_plan IN ('bulanan', 'tahunan'));

-- Commission triggers (30% on converted purchase amount)
CREATE OR REPLACE FUNCTION public.set_referral_commission_30pct()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(NEW.amount_idr, 0) < 0 THEN
    RAISE EXCEPTION 'amount_idr cannot be negative';
  END IF;
  NEW.commission_idr := ROUND(COALESCE(NEW.amount_idr, 0) * 0.30, 2);
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_referral_commission_30pct ON public.referrals;
CREATE TRIGGER trg_set_referral_commission_30pct
  BEFORE INSERT OR UPDATE OF amount_idr
  ON public.referrals
  FOR EACH ROW
  EXECUTE FUNCTION public.set_referral_commission_30pct();

CREATE OR REPLACE FUNCTION public.sync_referral_commission_to_earnings()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status <> 'converted' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.commissions (affiliate_id, referral_id, amount_idr, status)
  VALUES (NEW.affiliate_id, NEW.id, NEW.commission_idr, 'confirmed')
  ON CONFLICT (referral_id)
  DO UPDATE SET
    amount_idr = EXCLUDED.amount_idr,
    status = EXCLUDED.status;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_referral_commission_to_earnings ON public.referrals;
CREATE TRIGGER trg_sync_referral_commission_to_earnings
  AFTER INSERT OR UPDATE OF amount_idr, commission_idr, status
  ON public.referrals
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_referral_commission_to_earnings();

-- Resolve affiliate_id for a referral_codes row (website affiliates only, not in-app creators).
CREATE OR REPLACE FUNCTION public.resolve_affiliate_id_for_referral_code(p_referral_code_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id
  FROM public.referral_codes rc
  JOIN auth.users u ON u.id = rc.owner_user_id
  JOIN public.affiliates a ON lower(a.email) = lower(u.email)
  WHERE rc.id = p_referral_code_id
  LIMIT 1;
$$;

-- Called when a buyer successfully redeems an affiliate referral code in the app.
CREATE OR REPLACE FUNCTION public.record_affiliate_referral_trial(
  p_referral_code_id UUID,
  p_redeemer_user_id UUID,
  p_redemption_id UUID,
  p_trial_days INTEGER DEFAULT 7
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_affiliate_id UUID;
BEGIN
  v_affiliate_id := public.resolve_affiliate_id_for_referral_code(p_referral_code_id);
  IF v_affiliate_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.referrals (
    affiliate_id,
    referred_user_id,
    subscription_plan,
    amount_idr,
    status,
    app_redemption_id,
    referral_code_id,
    trial_started_at
  ) VALUES (
    v_affiliate_id,
    p_redeemer_user_id::TEXT,
    'tahunan',
    0,
    'trial_active',
    p_redemption_id,
    p_referral_code_id,
    NOW()
  )
  ON CONFLICT (referred_user_id)
  DO UPDATE SET
    affiliate_id = EXCLUDED.affiliate_id,
    referral_code_id = EXCLUDED.referral_code_id,
    app_redemption_id = EXCLUDED.app_redemption_id,
    trial_started_at = COALESCE(public.referrals.trial_started_at, EXCLUDED.trial_started_at),
    status = CASE
      WHEN public.referrals.status = 'converted' THEN public.referrals.status
      ELSE 'trial_active'
    END,
    updated_at = NOW();
END;
$$;

-- Called when store billing reports a paid subscription (webhook or app sync).
CREATE OR REPLACE FUNCTION public.mark_affiliate_referral_paid(
  p_redeemer_user_id UUID,
  p_subscription_plan TEXT DEFAULT 'tahunan',
  p_amount_idr NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.referrals%ROWTYPE;
  v_plan TEXT;
  v_amount NUMERIC(12,2);
BEGIN
  v_plan := CASE
    WHEN lower(coalesce(p_subscription_plan, '')) IN ('bulanan', 'monthly', 'dietku_premium_monthly') THEN 'bulanan'
    ELSE 'tahunan'
  END;

  v_amount := COALESCE(
    p_amount_idr,
    CASE WHEN v_plan = 'bulanan' THEN 39000::NUMERIC ELSE 129000::NUMERIC END
  );

  UPDATE public.referrals r
  SET
    status = 'converted',
    subscription_plan = v_plan,
    amount_idr = v_amount,
    converted_at = COALESCE(r.converted_at, NOW()),
    updated_at = NOW()
  WHERE r.referred_user_id = p_redeemer_user_id::TEXT
    AND r.status IN ('trial_active', 'expired', 'cancelled')
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NO_TRIAL_REFERRAL');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'referral_id', v_row.id,
    'affiliate_id', v_row.affiliate_id,
    'commission_idr', v_row.commission_idr,
    'amount_idr', v_row.amount_idr
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_affiliate_referral_expired(p_redeemer_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.referrals
  SET status = 'expired', updated_at = NOW()
  WHERE referred_user_id = p_redeemer_user_id::TEXT
    AND status = 'trial_active';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN jsonb_build_object('ok', v_updated > 0);
END;
$$;

REVOKE ALL ON FUNCTION public.record_affiliate_referral_trial(UUID, UUID, UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_affiliate_referral_paid(UUID, TEXT, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_affiliate_referral_expired(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_affiliate_referral_trial(UUID, UUID, UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_affiliate_referral_paid(UUID, TEXT, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_affiliate_referral_expired(UUID) TO service_role;

-- Backfill trial rows from existing app redemptions (affiliate codes only).
INSERT INTO public.referrals (
  affiliate_id,
  referred_user_id,
  subscription_plan,
  amount_idr,
  status,
  app_redemption_id,
  referral_code_id,
  trial_started_at,
  created_at
)
SELECT
  public.resolve_affiliate_id_for_referral_code(r.referral_code_id),
  r.redeemer_user_id::TEXT,
  'tahunan',
  0,
  'trial_active',
  r.id,
  r.referral_code_id,
  r.redeemed_at,
  r.redeemed_at
FROM public.referral_redemptions r
WHERE public.resolve_affiliate_id_for_referral_code(r.referral_code_id) IS NOT NULL
ON CONFLICT (referred_user_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- redeem_referral_code: store promo payload + affiliate trial tracking
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_referral_code(
  p_raw_code TEXT,
  p_client_meta JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_norm TEXT;
  v_row public.referral_codes%ROWTYPE;
  v_cnt INTEGER;
  v_has_paid BOOLEAN;
  v_already_redeemed BOOLEAN;
  v_rate_window INTERVAL := INTERVAL '15 minutes';
  v_rate_max INTEGER := 24;
  v_store_promo_code TEXT := 'FM34DCK3';
  v_app_store_apple_id TEXT := '6761396062';
  v_redemption_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    PERFORM public.log_referral_attempt(NULL, p_raw_code, NULL, 'failure', 'not_authenticated', p_client_meta);
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED', 'message', 'Masuk diperlukan.');
  END IF;

  SELECT COUNT(*)::INT INTO v_cnt
  FROM public.referral_attempt_logs a
  WHERE a.actor_user_id = v_uid
    AND a.created_at > NOW() - v_rate_window;
  IF v_cnt >= v_rate_max THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'RATE_LIMITED',
      'message', 'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.'
    );
  END IF;

  v_norm := public.normalize_referral_code(p_raw_code);
  IF v_norm IS NULL OR LENGTH(v_norm) < 4 THEN
    PERFORM public.log_referral_attempt(v_uid, p_raw_code, v_norm, 'failure', 'invalid_code', p_client_meta);
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CODE', 'message', 'Kode tidak valid.');
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.referral_redemptions r WHERE r.redeemer_user_id = v_uid)
    INTO v_already_redeemed;
  IF v_already_redeemed THEN
    PERFORM public.log_referral_attempt(v_uid, p_raw_code, v_norm, 'failure', 'already_redeemed', p_client_meta);
    RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_REDEEMED',
      'message', 'Akun ini sudah pernah menggunakan kode undangan.');
  END IF;

  SELECT public.user_has_blocking_paid_entitlement(v_uid) INTO v_has_paid;
  IF v_has_paid THEN
    PERFORM public.log_referral_attempt(v_uid, p_raw_code, v_norm, 'failure', 'has_active_subscription', p_client_meta);
    RETURN jsonb_build_object('ok', false, 'error', 'HAS_ACTIVE_SUBSCRIPTION',
      'message', 'Tidak dapat menggunakan kode saat langganan aktif.');
  END IF;

  SELECT * INTO v_row FROM public.referral_codes WHERE code_normalized = v_norm FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM public.log_referral_attempt(v_uid, p_raw_code, v_norm, 'failure', 'invalid_code', p_client_meta);
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CODE', 'message', 'Kode tidak ditemukan.');
  END IF;

  IF NOT v_row.is_active THEN
    PERFORM public.log_referral_attempt(v_uid, p_raw_code, v_norm, 'failure', 'inactive', p_client_meta);
    RETURN jsonb_build_object('ok', false, 'error', 'INACTIVE', 'message', 'Kode ini tidak aktif.');
  END IF;

  IF v_row.expires_at IS NOT NULL AND v_row.expires_at < NOW() THEN
    PERFORM public.log_referral_attempt(v_uid, p_raw_code, v_norm, 'failure', 'expired', p_client_meta);
    RETURN jsonb_build_object('ok', false, 'error', 'EXPIRED', 'message', 'Kode sudah kedaluwarsa.');
  END IF;

  IF v_row.owner_user_id = v_uid THEN
    PERFORM public.log_referral_attempt(v_uid, p_raw_code, v_norm, 'failure', 'own_code', p_client_meta);
    RETURN jsonb_build_object('ok', false, 'error', 'OWN_CODE', 'message', 'Tidak dapat menggunakan kode sendiri.');
  END IF;

  IF v_row.usage_limit IS NOT NULL THEN
    SELECT COUNT(*)::INT INTO v_cnt FROM public.referral_redemptions r WHERE r.referral_code_id = v_row.id;
    IF v_cnt >= v_row.usage_limit THEN
      PERFORM public.log_referral_attempt(v_uid, p_raw_code, v_norm, 'failure', 'usage_limit_reached', p_client_meta);
      RETURN jsonb_build_object('ok', false, 'error', 'USAGE_LIMIT_REACHED',
        'message', 'Kode ini sudah mencapai batas penggunaan.');
    END IF;
  END IF;

  INSERT INTO public.referral_redemptions (
    referral_code_id, redeemer_user_id, trial_days_granted, trial_ends_at, client_meta
  ) VALUES (
    v_row.id, v_uid, v_row.trial_days, NOW(), p_client_meta
  )
  RETURNING id INTO v_redemption_id;

  PERFORM public.record_affiliate_referral_trial(v_row.id, v_uid, v_redemption_id, v_row.trial_days);
  PERFORM public.log_referral_attempt(v_uid, p_raw_code, v_norm, 'success', NULL, p_client_meta);

  RETURN jsonb_build_object(
    'ok', true,
    'trial_days', v_row.trial_days,
    'trial_ends_at', null,
    'referral_code_id', v_row.id,
    'google_play_promo_code', v_store_promo_code,
    'google_play_redeem_url', 'https://play.google.com/redeem?code=' || v_store_promo_code,
    'app_store_offer_code', v_store_promo_code,
    'app_store_redeem_url',
      'https://apps.apple.com/redeem?ctx=offercodes&id=' || v_app_store_apple_id || '&code=' || v_store_promo_code,
    'grant_method', 'store_promo'
  );
EXCEPTION
  WHEN unique_violation THEN
    PERFORM public.log_referral_attempt(v_uid, p_raw_code, v_norm, 'failure', 'already_redeemed', p_client_meta);
    RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_REDEEMED',
      'message', 'Penggunaan ganda terdeteksi.');
  WHEN OTHERS THEN
    PERFORM public.log_referral_attempt(v_uid, p_raw_code, v_norm, 'failure', 'internal_error',
      jsonb_build_object('detail', SQLERRM));
    RETURN jsonb_build_object('ok', false, 'error', 'INTERNAL_ERROR', 'message', 'Terjadi kesalahan. Coba lagi.');
END;
$$;
