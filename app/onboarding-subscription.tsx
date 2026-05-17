import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Check, Circle } from 'lucide-react-native';
import { ResizeMode, Video } from 'expo-av';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useNutrition } from '@/contexts/NutritionContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  SUBSCRIPTION_MONTHLY_IDR_FALLBACK,
  SUBSCRIPTION_YEARLY_EQUIV_MONTHLY_ROUNDED,
  SUBSCRIPTION_YEARLY_IDR_FALLBACK,
} from '@/lib/subscriptionPricing';
import { DIETKU_PRIVACY_URL, DIETKU_TERMS_URL } from '@/lib/legalLinks';
import { supabase } from '@/lib/supabase';

type PlanType = 'annual' | 'monthly';

function formatYearlyEquivalent(monthlyEquivalent: number): string {
  return `Rp ${monthlyEquivalent.toLocaleString('id-ID')}/bln`;
}

export default function OnboardingSubscriptionScreen() {
  const params = useLocalSearchParams<{ from?: string | string[] }>();
  const {
    isPremium,
    isLoading: subscriptionLoading,
    purchaseBusy,
    monthlyPackage,
    annualPackage,
    purchaseMonthly,
    purchaseAnnual,
    restorePurchases,
  } = useSubscription();
  const { authState } = useNutrition();
  const insets = useSafeAreaInsets();
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('annual');
  const [annualTrialDays, setAnnualTrialDays] = useState(3);
  const from = typeof params.from === 'string' ? params.from : params.from?.[0];

  useEffect(() => {
    if (subscriptionLoading) return;
    if (!isPremium) return;
    router.replace('/(tabs)');
  }, [subscriptionLoading, isPremium]);

  useEffect(() => {
    let cancelled = false;

    async function loadTrialDaysFromInviteStatus() {
      if (!authState.userId) {
        if (!cancelled) setAnnualTrialDays(3);
        return;
      }

      const { data, error } = await supabase
        .from('referral_redemptions')
        .select('id')
        .eq('redeemer_user_id', authState.userId)
        .limit(1);

      if (cancelled) return;
      if (!error && Array.isArray(data) && data.length > 0) {
        setAnnualTrialDays(7);
        return;
      }

      setAnnualTrialDays(3);
    }

    loadTrialDaysFromInviteStatus();
    return () => {
      cancelled = true;
    };
  }, [authState.userId]);

  const monthlyPrice = monthlyPackage?.product?.priceString ?? SUBSCRIPTION_MONTHLY_IDR_FALLBACK;
  const annualPrice = annualPackage?.product?.priceString ?? SUBSCRIPTION_YEARLY_IDR_FALLBACK;
  const annualEquivalent = useMemo(() => {
    const fromStore = annualPackage?.product?.pricePerMonth;
    if (typeof fromStore === 'string' && fromStore.trim().length > 0) return fromStore.trim();
    return formatYearlyEquivalent(SUBSCRIPTION_YEARLY_EQUIV_MONTHLY_ROUNDED);
  }, [annualPackage?.product?.pricePerMonth]);

  const openExternalUrl = async (url: string) => {
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) return;
    await Linking.openURL(url);
  };

  const onContinueSubscription = async () => {
    if (purchaseBusy) return;
    if (selectedPlan === 'annual') {
      const ok = await purchaseAnnual();
      if (ok) router.replace('/(tabs)');
      return;
    }
    const ok = await purchaseMonthly();
    if (ok) router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={[styles.content, { paddingTop: Math.max(insets.top - 10, 2), paddingBottom: Math.max(insets.bottom, 4) }]}>
        <TouchableOpacity
          style={styles.backButtonTop}
          onPress={() => {
            if (from === 'login') {
              router.replace('/sign-in');
              return;
            }
            if (router.canGoBack()) {
              router.back();
              return;
            }
            router.replace('/onboarding');
          }}
          activeOpacity={0.7}
        >
          <ArrowLeft size={24} color="#666666" />
        </TouchableOpacity>
        <Text style={styles.title}>DietKu</Text>

        <View style={styles.previewCard}>
          <Video
            source={require('../assets/videos/subscription-preview.mp4')}
            style={styles.previewVideo}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay
            isLooping
            isMuted
            useNativeControls={false}
          />
        </View>

        <View style={styles.planRow}>
          <TouchableOpacity
            style={[styles.planCard, selectedPlan === 'annual' && styles.planCardSelected]}
            onPress={() => setSelectedPlan('annual')}
            activeOpacity={0.85}
          >
            <View style={styles.trialBadge}>
              <Text style={styles.trialBadgeText}>Coba Gratis {annualTrialDays} Hari</Text>
            </View>
            <Text style={styles.planLabel}>Tahunan</Text>
            <Text style={styles.planPrice} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
              {annualPrice}/thn
            </Text>
            <Text style={styles.planSubtle}>Setara {annualEquivalent}</Text>
            <Text style={styles.planTrialDisclosure}>
              Setelah trial {annualTrialDays} hari, ditagih {annualPrice}/tahun dan diperpanjang otomatis.
            </Text>
            <View style={styles.checkWrap}>
              {selectedPlan === 'annual' ? (
                <View style={styles.checkSelected}>
                  <Check size={14} color="#FFFFFF" />
                </View>
              ) : (
                <Circle size={20} color="#CFCFDA" />
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.planCard, selectedPlan === 'monthly' && styles.planCardSelected]}
            onPress={() => setSelectedPlan('monthly')}
            activeOpacity={0.85}
          >
            <Text style={styles.planLabel}>Bulanan</Text>
            <Text style={styles.planPrice} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
              {monthlyPrice}/bln
            </Text>
            <Text style={styles.planSubtle}>Ditagih {monthlyPrice}/bulan</Text>
            <Text style={styles.planTrialDisclosure}>Jika ada trial, setelah trial berakhir ditagih otomatis.</Text>
            <View style={styles.checkWrap}>
              {selectedPlan === 'monthly' ? (
                <View style={styles.checkSelected}>
                  <Check size={14} color="#FFFFFF" />
                </View>
              ) : (
                <Circle size={20} color="#CFCFDA" />
              )}
            </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.continueBtn, purchaseBusy && styles.continueBtnDisabled]}
          onPress={onContinueSubscription}
          disabled={purchaseBusy}
          activeOpacity={0.9}
        >
          {purchaseBusy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.continueText}>Lanjut</Text>}
        </TouchableOpacity>

        <Text style={styles.disclosure}>
          Langganan diperpanjang otomatis kecuali dibatalkan setidaknya 24 jam sebelum akhir periode berjalan.
          {Platform.OS === 'ios'
            ? ' Kelola langganan kapan saja di Pengaturan App Store.'
            : ' Kelola langganan kapan saja di pengaturan Google Play.'}
        </Text>

        <View style={styles.footerRow}>
          <TouchableOpacity onPress={() => restorePurchases()} activeOpacity={0.7}>
            <Text style={styles.footerLink}>Pulihkan Pembayaran</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => openExternalUrl(DIETKU_TERMS_URL)} activeOpacity={0.7}>
            <Text style={styles.footerLink}>Ketentuan</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => openExternalUrl(DIETKU_PRIVACY_URL)} activeOpacity={0.7}>
            <Text style={styles.footerLink}>Privasi</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#EEEDEB' },
  content: { flex: 1, paddingHorizontal: 18 },
  backButtonTop: {
    alignSelf: 'flex-start',
    padding: 4,
    marginBottom: 6,
  },
  title: { textAlign: 'center', fontSize: 30, fontWeight: '800', color: '#101217', marginTop: -24, marginBottom: 6 },
  previewCard: {
    flex: 1.45,
    minHeight: 390,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#EEEDEB',
    marginBottom: 4,
  },
  previewVideo: {
    width: '100%',
    height: '100%',
    backgroundColor: '#EEEDEB',
  },
  planRow: { flexDirection: 'row', gap: 10, marginTop: 0 },
  planCard: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#D2D4DD',
    borderRadius: 12,
    padding: 12,
    position: 'relative',
    minHeight: 98,
    backgroundColor: '#FFFFFF',
  },
  planCardSelected: { borderColor: '#36C56A', backgroundColor: '#F8FFF9' },
  trialBadge: {
    position: 'absolute',
    top: -10,
    left: 14,
    backgroundColor: '#29BC60',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  trialBadgeText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  planLabel: { fontSize: 15, fontWeight: '700', color: '#121418', marginTop: 4 },
  planPrice: { fontSize: 18, fontWeight: '700', color: '#121418', marginTop: 2 },
  planSubtle: { color: '#747683', fontSize: 12, marginTop: 3, fontWeight: '600' },
  planTrialDisclosure: {
    color: '#8A8D98',
    fontSize: 11,
    marginTop: 4,
    lineHeight: 14,
  },
  checkWrap: { position: 'absolute', top: 12, right: 10 },
  checkSelected: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#29BC60',
  },
  continueBtn: {
    backgroundColor: '#29BC60',
    borderRadius: 12,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  continueBtnDisabled: { opacity: 0.7 },
  continueText: { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  disclosure: {
    marginTop: 8,
    fontSize: 10,
    lineHeight: 14,
    color: '#7B7D87',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  footerRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 0,
  },
  footerLink: { fontSize: 13, color: '#29BC60', fontWeight: '700' },
});
