import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native';
import { Gift } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import { useNutrition } from '@/contexts/NutritionContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import {
  redeemReferralCode,
  invalidateReferralProfile,
  redeemErrorMessageForUi,
  DEFAULT_REFERRAL_STORE_PROMO_CODE,
  googlePlayRedeemUrl,
  appStoreRedeemUrl,
} from '@/lib/referral';
import { consumePendingReferralCode } from '@/lib/pendingReferralCode';

const STORE_LABEL = Platform.OS === 'ios' ? 'App Store' : 'Play Store';

export type PaywallReferralSectionHandle = {
  /** Current raw input value. */
  getCode: () => string;
  /**
   * Redeems code if non-empty. Returns `true` if redeemed or if blank.
   * Returns `false` if there is an error (and sets UI error).
   */
  redeemIfFilled: (source: string) => Promise<boolean>;
};

type Props = {
  /** Light text on white (subscribe page) vs theme (modal). */
  variant: 'light' | 'themed';
  textPrimary?: string;
  textSecondary?: string;
  borderColor?: string;
  inputBg?: string;
  accentColor?: string;
  /** Subscribe screen only: one-shot consume AsyncStorage + auto-redeem. */
  consumePendingOnMount?: boolean;
  /** e.g. route ?ref=CODE from subscribe screen */
  deepLinkRef?: string | null;
  /** When true: copy + form only (for sheet modal); no floating promo card. */
  forModal?: boolean;
  /** Overrides default modal intro when `forModal` (e.g. onboarding optional step). */
  modalIntro?: string;
  onModalClose?: () => void;
  /** Hide the explicit "Gunakan kode" button; parent can call `redeemIfFilled` via ref. */
  hideRedeemButton?: boolean;
};

const PaywallReferralSection = forwardRef<PaywallReferralSectionHandle, Props>(function PaywallReferralSection(
  {
  variant,
  textPrimary = '#1A1A2E',
  textSecondary = '#6E6E82',
  borderColor = '#E5E5EA',
  inputBg = '#F5F5F7',
  accentColor = '#22C55E',
  consumePendingOnMount = false,
  deepLinkRef = null,
  forModal = false,
  modalIntro,
  onModalClose,
  hideRedeemButton = false,
  }: Props,
  ref,
) {
  const queryClient = useQueryClient();
  const { authState, referralTrialEndsAt } = useNutrition();
  const { isPremium, refreshSubscription } = useSubscription();
  const [expanded, setExpanded] = useState(forModal);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successDays, setSuccessDays] = useState<number | null>(null);
  const [storePromoCode, setStorePromoCode] = useState<string>(DEFAULT_REFERRAL_STORE_PROMO_CODE);

  const referralActive =
    referralTrialEndsAt != null && new Date(referralTrialEndsAt).getTime() > Date.now();

  const runRedeem = useCallback(
    async (raw: string, source: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;
      if (!authState.isSignedIn) {
        setErrorMsg('Masuk terlebih dahulu untuk menggunakan kode.');
        return;
      }
      setSubmitting(true);
      setErrorMsg(null);
      setSuccessDays(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      try {
        const res = await redeemReferralCode(trimmed, { screen: source });
        if (res.ok) {
          invalidateReferralProfile(queryClient);
          await refreshSubscription();
          setSuccessDays(res.trial_days);
          const promoCode = (
            Platform.OS === 'ios'
              ? (res.app_store_offer_code ?? res.google_play_promo_code)
              : (res.google_play_promo_code ?? res.app_store_offer_code)
          ?? DEFAULT_REFERRAL_STORE_PROMO_CODE)
            .trim()
            .toUpperCase();
          const redeemUrl =
            Platform.OS === 'ios'
              ? (res.app_store_redeem_url ?? appStoreRedeemUrl(promoCode))
              : (res.google_play_redeem_url ?? googlePlayRedeemUrl(promoCode));
          setStorePromoCode(promoCode);
          setCode('');
          if (Platform.OS === 'android' || Platform.OS === 'ios') {
            try {
              const canOpen = await Linking.canOpenURL(redeemUrl);
              if (canOpen) {
                await Linking.openURL(redeemUrl);
              }
            } catch {
              // Non-fatal: referral redemption is already recorded server-side.
            }
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          setErrorMsg(redeemErrorMessageForUi(res.error, res.message));
        }
      } finally {
        setSubmitting(false);
      }
    },
    [authState.isSignedIn, queryClient, refreshSubscription],
  );

  useImperativeHandle(
    ref,
    () => ({
      getCode: () => code,
      redeemIfFilled: async (source: string) => {
        const trimmed = code.trim();
        if (!trimmed) return true;
        if (submitting) return false;
        await runRedeem(trimmed, source);
        // If code wasn't cleared, treat as failure (error shown in UI).
        return code.trim().length === 0;
      },
    }),
    [code, submitting, runRedeem],
  );

  useEffect(() => {
    if (!consumePendingOnMount && !deepLinkRef?.trim()) return;
    let cancelled = false;
    (async () => {
      const fromStore = consumePendingOnMount ? await consumePendingReferralCode() : null;
      const raw = (fromStore ?? deepLinkRef ?? '').trim();
      if (cancelled || !raw) return;
      if (!forModal) setExpanded(true);
      setCode(raw);
      await runRedeem(raw, fromStore ? 'pending_storage' : 'deep_link');
    })();
    return () => {
      cancelled = true;
    };
  }, [consumePendingOnMount, deepLinkRef, runRedeem, forModal]);

  if (isPremium || referralActive) {
    return null;
  }

  const subtle = variant === 'light' ? '#888888' : textSecondary;
  const cardBg =
    variant === 'light' ? 'rgba(34, 197, 94, 0.08)' : `${accentColor}14`;
  const cardBorder = variant === 'light' ? 'rgba(34, 197, 94, 0.45)' : accentColor;

  const formBlock = (
    <>
      {!forModal ? (
        <View
          style={[
            styles.expandedHeader,
            { borderColor: cardBorder, backgroundColor: cardBg },
          ]}
        >
          <Gift size={20} color={accentColor} />
          <Text style={[styles.expandedTitle, { color: textPrimary }]}>Masukkan kode undangan</Text>
        </View>
      ) : (
        <Text style={[styles.modalIntro, { color: textSecondary }]}>
          {modalIntro ?? 'Punya kode undangan? Jika valid, Anda dapat free trial 7 hari untuk paket Tahunan.'}
        </Text>
      )}
      <Text style={[styles.label, { color: textSecondary }]}>Kode</Text>
      <Text style={[styles.helper, { color: textSecondary }]}>
        Kode valid akan mengaktifkan trial 7 hari untuk langganan Tahunan.
      </Text>
      <TextInput
        style={[
          styles.input,
          {
            color: textPrimary,
            borderColor,
            backgroundColor: inputBg,
          },
        ]}
        value={code}
        onChangeText={(x) => setCode(x.toUpperCase())}
        placeholder="contoh: A1B2C3D4"
        placeholderTextColor={subtle}
        autoCapitalize="characters"
        autoCorrect={false}
        editable={!submitting}
      />
      {errorMsg ? <Text style={styles.err}>{errorMsg}</Text> : null}
      {successDays != null ? (
        <Text style={[styles.ok, { color: accentColor }]}>
          Kode valid. Lanjutkan redeem di {STORE_LABEL} dengan kode {storePromoCode} untuk trial{' '}
          {successDays} hari paket Tahunan.
        </Text>
      ) : null}
      {!hideRedeemButton ? (
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: accentColor, opacity: submitting ? 0.7 : 1 }]}
          disabled={submitting || !code.trim()}
          onPress={() => runRedeem(code, 'paywall')}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.btnText}>Gunakan kode</Text>
          )}
        </TouchableOpacity>
      ) : null}
      {forModal && onModalClose ? (
        <TouchableOpacity onPress={onModalClose} style={styles.collapseBtn} hitSlop={{ top: 8, bottom: 8 }}>
          <Text style={[styles.collapseText, { color: textSecondary }]}>Tutup</Text>
        </TouchableOpacity>
      ) : !forModal ? (
        <TouchableOpacity
          onPress={() => {
            setExpanded(false);
            setErrorMsg(null);
          }}
          style={styles.collapseBtn}
          hitSlop={{ top: 8, bottom: 8 }}
        >
          <Text style={[styles.collapseText, { color: textSecondary }]}>Tutup</Text>
        </TouchableOpacity>
      ) : null}
    </>
  );

  if (forModal) {
    return <View style={styles.wrap}>{formBlock}</View>;
  }

  return (
    <View style={styles.wrap}>
      {!expanded ? (
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setExpanded(true);
          }}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Punya kode undangan?"
          style={[
            styles.promoCard,
            {
              backgroundColor: cardBg,
              borderColor: cardBorder,
            },
          ]}
        >
          <View style={[styles.iconCircle, { backgroundColor: `${accentColor}28` }]}>
            <Gift size={22} color={accentColor} />
          </View>
          <View style={styles.promoTextCol}>
            <Text style={[styles.promoTitle, { color: textPrimary }]}>Punya kode undangan?</Text>
            <Text style={[styles.promoSub, { color: textSecondary }]}>
              Tap di sini — dapatkan hari percobaan gratis sebelum berlangganan
            </Text>
          </View>
        </TouchableOpacity>
      ) : (
        formBlock
      )}
    </View>
  );
});

export default PaywallReferralSection;

const styles = StyleSheet.create({
  wrap: { marginTop: 4, gap: 10 },
  promoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 2,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoTextCol: { flex: 1, gap: 4 },
  promoTitle: { fontSize: 17, fontWeight: '800' },
  promoSub: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  expandedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  expandedTitle: { fontSize: 16, fontWeight: '800' },
  modalIntro: { fontSize: 15, fontWeight: '600', lineHeight: 22, textAlign: 'center', marginBottom: 4 },
  label: { fontSize: 13, fontWeight: '600' },
  helper: { fontSize: 12, marginTop: 2, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1,
  },
  err: { fontSize: 13, color: '#DC2626' },
  ok: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  btn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  collapseBtn: { alignSelf: 'center', paddingVertical: 6 },
  collapseText: { fontSize: 14, fontWeight: '600' },
});
