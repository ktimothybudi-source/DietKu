-- Include Google Play promo metadata in redeem response
-- so mobile app can auto-open the correct redeem code URL.

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
  v_google_play_promo_code TEXT := 'FM34DCK3';
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
    PERFORM public.log_referral_attempt(v_uid, p_raw_code, v_norm, 'failure', 'invalid_code',
      p_client_meta);
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CODE', 'message', 'Kode tidak valid.');
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.referral_redemptions r WHERE r.redeemer_user_id = v_uid)
    INTO v_already_redeemed;
  IF v_already_redeemed THEN
    PERFORM public.log_referral_attempt(v_uid, p_raw_code, v_norm, 'failure', 'already_redeemed',
      p_client_meta);
    RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_REDEEMED',
      'message', 'Akun ini sudah pernah menggunakan kode undangan.');
  END IF;

  SELECT public.user_has_blocking_paid_entitlement(v_uid) INTO v_has_paid;
  IF v_has_paid THEN
    PERFORM public.log_referral_attempt(v_uid, p_raw_code, v_norm, 'failure', 'has_active_subscription',
      p_client_meta);
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
    SELECT COUNT(*)::INT INTO v_cnt FROM public.referral_redemptions r
    WHERE r.referral_code_id = v_row.id;
    IF v_cnt >= v_row.usage_limit THEN
      PERFORM public.log_referral_attempt(v_uid, p_raw_code, v_norm, 'failure', 'usage_limit_reached',
        p_client_meta);
      RETURN jsonb_build_object('ok', false, 'error', 'USAGE_LIMIT_REACHED',
        'message', 'Kode ini sudah mencapai batas penggunaan.');
    END IF;
  END IF;

  INSERT INTO public.referral_redemptions (
    referral_code_id, redeemer_user_id, trial_days_granted, trial_ends_at, client_meta
  ) VALUES (
    v_row.id, v_uid, v_row.trial_days, NOW(), p_client_meta
  );

  PERFORM public.log_referral_attempt(v_uid, p_raw_code, v_norm, 'success', NULL, p_client_meta);

  RETURN jsonb_build_object(
    'ok', true,
    'trial_days', v_row.trial_days,
    'trial_ends_at', null,
    'referral_code_id', v_row.id,
    'google_play_promo_code', v_google_play_promo_code,
    'google_play_redeem_url', 'https://play.google.com/redeem?code=' || v_google_play_promo_code,
    'grant_method', 'google_play_promo'
  );
EXCEPTION
  WHEN unique_violation THEN
    PERFORM public.log_referral_attempt(v_uid, p_raw_code, v_norm, 'failure', 'already_redeemed',
      p_client_meta);
    RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_REDEEMED',
      'message', 'Penggunaan ganda terdeteksi.');
  WHEN OTHERS THEN
    PERFORM public.log_referral_attempt(v_uid, p_raw_code, v_norm, 'failure', 'internal_error',
      jsonb_build_object('detail', SQLERRM));
    RETURN jsonb_build_object('ok', false, 'error', 'INTERNAL_ERROR', 'message', 'Terjadi kesalahan. Coba lagi.');
END;
$$;
