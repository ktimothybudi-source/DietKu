import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Circle, CircleX } from 'lucide-react-native';
import { useSubscription } from '@/contexts/SubscriptionContext';
import {
  SUBSCRIPTION_MONTHLY_IDR_FALLBACK,
  SUBSCRIPTION_YEARLY_IDR_FALLBACK,
  SUBSCRIPTION_YEARLY_EQUIV_MONTHLY_ROUNDED,
} from '@/lib/subscriptionPricing';
import { DIETKU_PRIVACY_URL, DIETKU_TERMS_URL } from '@/lib/legalLinks';

type PlanType = 'annual' | 'monthly';

function formatYearlyEquivalent(monthlyEquivalent: number): string {
  return `Rp ${monthlyEquivalent.toLocaleString('id-ID')}/bln`;
}

/**
 * Custom DietKu paywall UI (not RevenueCat native paywall).
 */
export default function PremiumPaywallModal() {
  const {
    showPaywall,
    paywallDismissible,
    closePaywall,
    purchaseBusy,
    monthlyPackage,
    annualPackage,
    purchaseMonthly,
    purchaseAnnual,
    restorePurchases,
  } = useSubscription();
  const insets = useSafeAreaInsets();
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('annual');

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

  const onContinue = async () => {
    if (purchaseBusy) return;
    if (selectedPlan === 'annual') {
      await purchaseAnnual();
      return;
    }
    await purchaseMonthly();
  };

  return (
    <Modal animationType="slide" visible={showPaywall} transparent presentationStyle="overFullScreen">
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            if (paywallDismissible) closePaywall();
          }}
        />
        <View style={styles.sheet}>
          {paywallDismissible ? (
            <TouchableOpacity style={styles.closeButton} onPress={() => closePaywall()} activeOpacity={0.7}>
              <CircleX size={26} color="#C0C0C8" />
            </TouchableOpacity>
          ) : null}

          <View style={styles.content}>
            <View style={styles.logoPill}>
              <Image
                source={require("../assets/images/icon.png")}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.title}>DietKu</Text>
            <Text style={styles.subtitle}>Semua yang kamu butuhkan untuk diet lebih efektif</Text>

            <View style={styles.featureCard}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                bounces
                style={styles.featureScroll}
                contentContainerStyle={styles.featureScrollContent}
              >
                {[
                  ['Scan makanan otomatis', 'Catat kalori lebih cepat dengan pemindaian makanan otomatis'],
                  ['Rencana diet personal', 'Rencana diet disesuaikan dengan target dan gaya hidupmu'],
                  ['Tracking kalori harian', 'Pantau kalori dan makro secara lengkap setiap hari'],
                  ['Komunitas dukungan', 'Dapatkan dukungan dan motivasi dari komunitas'],
                  ['Statistik kemajuan', 'Lihat perkembangan dan data statistik untuk membantu capai targetmu'],
                ].map(([title, desc]) => (
                  <View style={styles.featureRow} key={title}>
                    <Check size={16} color="#22C55E" />
                    <View style={styles.featureTextWrap}>
                      <Text style={styles.featureTitle}>{title}</Text>
                      <Text style={styles.featureDesc}>{desc}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>

            <View style={styles.bottomSection}>
            <View style={styles.planRow}>
              <TouchableOpacity
                style={[styles.planCard, styles.planCardActive, selectedPlan === 'annual' && styles.planCardSelected]}
                onPress={() => setSelectedPlan('annual')}
                activeOpacity={0.85}
              >
                <View style={styles.trialBadge}>
                  <Text style={styles.trialBadgeText}>Coba Gratis 3 Hari</Text>
                </View>
                <Text style={styles.planLabel}>Tahunan</Text>
                <Text style={styles.planPrice} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
                  {annualPrice}/thn
                </Text>
                <Text style={styles.planSubtle}>Setara {annualEquivalent}</Text>
                <Text style={styles.planTrialDisclosure}>
                  Setelah trial, ditagih {annualPrice}/tahun dan diperpanjang otomatis.
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
                <Text style={styles.planTrialDisclosure}>
                  Jika ada trial, setelah trial berakhir ditagih otomatis.
                </Text>
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
              onPress={onContinue}
              disabled={purchaseBusy}
              activeOpacity={0.9}
            >
              {purchaseBusy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.continueText}>Lanjut</Text>
              )}
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
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 10, 16, 0.45)',
  },
  sheet: {
    height: '94%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 10,
    paddingBottom: 0,
  },
  closeButton: {
    alignSelf: 'flex-end',
    marginRight: 14,
    marginBottom: 2,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 0,
    flex: 1,
    minHeight: 0,
  },
  logoPill: {
    alignSelf: 'center',
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#F4F4F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  logoImage: {
    width: 40,
    height: 40,
  },
  title: {
    textAlign: 'center',
    fontSize: 34,
    fontWeight: '800',
    color: '#101217',
    marginTop: 8,
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 14,
    color: '#70727D',
    marginTop: 4,
    marginBottom: 10,
  },
  featureCard: {
    flex: 1,
    minHeight: 0,
    borderRadius: 16,
    backgroundColor: '#F4F4F5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  featureScroll: {
    flex: 1,
    minHeight: 0,
  },
  featureScrollContent: {
    gap: 10,
    paddingVertical: 4,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  featureTextWrap: { flex: 1 },
  featureTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#101217',
  },
  featureDesc: {
    fontSize: 12,
    color: '#70727D',
    lineHeight: 17,
    marginTop: 2,
  },
  bottomSection: {
    flexShrink: 0,
  },
  planRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
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
  planCardActive: {
    borderColor: '#36C56A',
  },
  planCardSelected: {
    borderColor: '#36C56A',
    backgroundColor: '#F8FFF9',
  },
  trialBadge: {
    position: 'absolute',
    top: -10,
    left: 14,
    backgroundColor: '#29BC60',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  trialBadgeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  planLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#121418',
    marginTop: 4,
  },
  planPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#121418',
    marginTop: 2,
  },
  planSubtle: {
    color: '#747683',
    fontSize: 12,
    marginTop: 3,
    fontWeight: '600',
  },
  planTrialDisclosure: {
    color: '#8A8D98',
    fontSize: 11,
    marginTop: 4,
    lineHeight: 14,
  },
  checkWrap: {
    position: 'absolute',
    top: 12,
    right: 10,
  },
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
    marginTop: 12,
  },
  continueBtnDisabled: { opacity: 0.7 },
  continueText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  disclosure: {
    marginTop: 10,
    fontSize: 10,
    lineHeight: 14,
    color: '#7B7D87',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  footerRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 0,
  },
  footerLink: {
    fontSize: 13,
    color: '#29BC60',
    fontWeight: '700',
  },
});
