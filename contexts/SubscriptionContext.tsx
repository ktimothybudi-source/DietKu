import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/** Comma-separated emails treated as Premium (UI + scan bypass sync). Remove when using real subscriptions only. */
function parsePremiumEmailAllowlist(): Set<string> {
  const raw = process.env.EXPO_PUBLIC_PREMIUM_EMAIL_ALLOWLIST ?? '';
  return new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Alert, Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import { callAIProxy } from '@/utils/aiProxy';
import { useNutrition } from '@/contexts/NutritionContext';
import { supabase } from '@/lib/supabase';
import { setPremiumWriteGate } from '@/lib/premiumWriteGate';

const REVENUECAT_ANDROID_API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ||
  process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ||
  '';
const REVENUECAT_IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || '';
/** RevenueCat Test Store public key — required for Expo Go; never ship to stores with this. https://rev.cat/sdk-test-store */
const REVENUECAT_TEST_STORE_API_KEY =
  (process.env.EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY ?? '').trim();
const PREMIUM_ENTITLEMENT_ID = 'premium';
const ALWAYS_PREMIUM_EMAILS = new Set(['testers@dietku.com', 'testers2@dietku.com']);

function isRunningInExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

/** Play subscription IDs when offerings return no packages (override via EAS env if yours differ). */
const ANDROID_SUB_MONTHLY = (
  process.env.EXPO_PUBLIC_ANDROID_SUBSCRIPTION_MONTHLY ?? 'dietku_premium_monthly'
).trim();
const ANDROID_SUB_YEARLY = (
  process.env.EXPO_PUBLIC_ANDROID_SUBSCRIPTION_YEARLY ?? 'dietku_premium_yearly'
).trim();
/** Google Play base plan IDs (Billing v5 store product is often `subscriptionId:basePlanId`). */
const ANDROID_BASEPLAN_MONTHLY = (
  process.env.EXPO_PUBLIC_ANDROID_BASEPLAN_MONTHLY ?? 'monthly'
).trim();
const ANDROID_BASEPLAN_YEARLY = (
  process.env.EXPO_PUBLIC_ANDROID_BASEPLAN_YEARLY ?? 'tahunan'
).trim();
/** App Store subscription product IDs (must match App Store Connect / RevenueCat iOS mapping). */
/** Must match App Store Connect subscription Product IDs exactly. */
const IOS_SUB_MONTHLY = (process.env.EXPO_PUBLIC_IOS_SUBSCRIPTION_MONTHLY ?? 'bulanan').trim();
const IOS_SUB_YEARLY = (process.env.EXPO_PUBLIC_IOS_SUBSCRIPTION_YEARLY ?? 'tahunan').trim();

type RevenuePackage = any;
type OfferingsResult = any;
type CustomerInfoResult = any;

function hasPremiumEntitlement(customerInfo: CustomerInfoResult): boolean {
  const active = customerInfo?.entitlements?.active ?? {};
  return Boolean(active?.[PREMIUM_ENTITLEMENT_ID]);
}

function formatPurchaseError(error: unknown): string | null {
  if (error == null) return 'Unknown error';
  const e = error as {
    userCancelled?: boolean;
    message?: string;
    readableErrorCode?: string;
    underlyingErrorMessage?: string;
    info?: { backendErrorCode?: number; statusCode?: number };
  };
  if (e.userCancelled) return null;
  const bits = [e.message, e.readableErrorCode, e.underlyingErrorMessage].filter(
    (x): x is string => typeof x === 'string' && x.trim().length > 0
  );
  const msg = bits.length ? bits.join(' — ') : String(error);
  return msg.length > 450 ? `${msg.slice(0, 450)}…` : msg;
}

function isRevenueCatInvalidApiKey(error: unknown): boolean {
  const e = error as any;
  const underlying = String(e?.underlyingErrorMessage ?? '');
  const message = String(e?.message ?? '');
  const backendErrorCode = e?.info?.backendErrorCode;

  // RevenueCat surfaces Invalid API Key as 401 with backendErrorCode: 7225 (observed in logs).
  if (backendErrorCode === 7225) return true;
  return underlying.toLowerCase().includes('invalid api key') || message.toLowerCase().includes('invalid api key');
}

function getRevenueCatDebugSnapshot(apiKey: string, expoGo: boolean, error?: unknown) {
  const e = error as any;
  return {
    platform: Platform.OS,
    expoGo,
    appOwnership: Constants.appOwnership ?? null,
    executionEnvironment: Constants.executionEnvironment ?? null,
    bundleId: Constants.expoConfig?.ios?.bundleIdentifier ?? null,
    packageName: Constants.expoConfig?.android?.package ?? null,
    keyPrefix: apiKey ? apiKey.slice(0, 8) : null,
    keyLen: apiKey ? apiKey.length : 0,
    message: e?.message ?? null,
    readableErrorCode: e?.readableErrorCode ?? null,
    underlyingErrorMessage: e?.underlyingErrorMessage ?? null,
    backendErrorCode: e?.info?.backendErrorCode ?? null,
    statusCode: e?.info?.statusCode ?? null,
    code: e?.code ?? null,
  };
}

async function fetchAndroidSubscriptionStoreProduct(
  period: 'monthly' | 'annual'
): Promise<any | null> {
  const subId = period === 'monthly' ? ANDROID_SUB_MONTHLY : ANDROID_SUB_YEARLY;
  const basePlan =
    period === 'monthly' ? ANDROID_BASEPLAN_MONTHLY : ANDROID_BASEPLAN_YEARLY;
  if (!subId) return null;
  const candidates: string[] = [];
  if (basePlan) candidates.push(`${subId}:${basePlan}`);
  candidates.push(subId);
  const unique = [...new Set(candidates)];
  const products = await Purchases.getProducts(unique, Purchases.PRODUCT_CATEGORY.SUBSCRIPTION);
  if (!products.length) return null;
  for (const id of unique) {
    const p = products.find((x: any) => x.identifier === id);
    if (p) return p;
  }
  return products[0] ?? null;
}

async function fetchIosSubscriptionStoreProduct(
  period: 'monthly' | 'annual'
): Promise<any | null> {
  const id = period === 'monthly' ? IOS_SUB_MONTHLY : IOS_SUB_YEARLY;
  if (!id) return null;
  const products = await Purchases.getProducts([id], Purchases.PRODUCT_CATEGORY.SUBSCRIPTION);
  return products.find((x: any) => x.identifier === id) ?? products[0] ?? null;
}

function getOfferingPackages(offerings: OfferingsResult): any[] {
  const current = offerings?.current;
  if (current?.availablePackages?.length) return current.availablePackages;
  const all = offerings?.all as Record<string, { availablePackages?: any[] }> | undefined;
  const fromDefault = all?.default?.availablePackages;
  if (fromDefault?.length) return fromDefault;
  const first = all ? Object.values(all).find((o) => o?.availablePackages?.length) : null;
  return first?.availablePackages ?? [];
}

/** Prefer current, then default, then any offering that has packages or dashboard monthly/annual slots. */
function getPrimaryOffering(offerings: OfferingsResult): any | null {
  if (!offerings) return null;
  const all = offerings.all as Record<string, any> | undefined;
  const hasSignals = (o: any) =>
    Boolean(
      o?.availablePackages?.length ||
        o?.monthly ||
        o?.annual ||
        o?.weekly ||
        o?.lifetime
    );
  const cur = offerings.current;
  if (cur && hasSignals(cur)) return cur;
  if (all?.default && hasSignals(all.default)) return all.default;
  if (all) {
    const withPkgs = Object.values(all).find((o) => o?.availablePackages?.length);
    if (withPkgs) return withPkgs;
    const withSlots = Object.values(all).find((o) => o?.monthly || o?.annual);
    if (withSlots) return withSlots;
  }
  return cur ?? all?.default ?? null;
}

function subscriptionPeriodBucket(pkg: any): 'monthly' | 'annual' | null {
  const p = pkg?.product?.subscriptionPeriod;
  if (p === 'P1M') return 'monthly';
  if (p === 'P1Y') return 'annual';
  return null;
}

function pickMonthlyAndAnnualPackages(offerings: OfferingsResult) {
  const primary = getPrimaryOffering(offerings);
  const fromPrimary = primary?.availablePackages ?? [];
  const fromFallback = getOfferingPackages(offerings);
  const available =
    fromPrimary.length > 0 ? fromPrimary : fromFallback.length > 0 ? fromFallback : fromPrimary;

  const type = (pkg: any) => String(pkg?.packageType ?? '').toUpperCase();
  const ident = (pkg: any) => String(pkg?.identifier ?? '').toLowerCase();

  let monthly = primary?.monthly ?? null;
  let annual = primary?.annual ?? null;

  if (!monthly) {
    monthly =
      available.find((pkg: any) => type(pkg) === 'MONTHLY') ||
      available.find((pkg: any) => ident(pkg) === '$rc_monthly') ||
      available.find((pkg: any) => subscriptionPeriodBucket(pkg) === 'monthly') ||
      null;
  }
  if (!annual) {
    annual =
      available.find((pkg: any) => type(pkg) === 'ANNUAL') ||
      available.find((pkg: any) => ident(pkg) === '$rc_annual') ||
      available.find((pkg: any) => subscriptionPeriodBucket(pkg) === 'annual') ||
      null;
  }

  // Custom package types in RevenueCat (wrong slot) but standard store products still work
  if (!monthly) {
    monthly =
      available.find(
        (pkg: any) =>
          ident(pkg).includes('monthly') || ident(pkg).includes('month') || ident(pkg).includes('bulan')
      ) || null;
  }
  if (!annual) {
    annual =
      available.find(
        (pkg: any) =>
          ident(pkg).includes('annual') ||
          ident(pkg).includes('year') ||
          ident(pkg).includes('tahun')
      ) || null;
  }

  return { monthly, annual };
}

async function syncPremiumToBackend(userId: string, premium: boolean, source = 'revenuecat') {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) return;

  await callAIProxy('subscription-sync', {
    userId,
    isPremium: premium,
    source,
    accessToken,
  });
}

export const [SubscriptionProvider, useSubscription] = createContextHook(() => {
  const { authState, referralTrialEndsAt } = useNutrition();
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  /** RevenueCat entitlement only */
  const [rcPremium, setRcPremium] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallDismissible, setPaywallDismissible] = useState(true);
  const [paywallReason, setPaywallReason] = useState<string | null>(null);
  const [offerings, setOfferings] = useState<OfferingsResult | null>(null);
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  /** After logIn/logOut + getCustomerInfo; used to avoid syncing false before RC reflects this user (wipes Supabase gold / bypass). */
  const premiumSyncUserIdRef = useRef<string | null>(null);

  const allowlistPremium = useMemo(() => {
    const emails = parsePremiumEmailAllowlist();
    const email = (authState.email ?? '').toLowerCase();
    return email.length > 0 && (emails.has(email) || ALWAYS_PREMIUM_EMAILS.has(email));
  }, [authState.email]);

  const referralTrialActive = useMemo(() => {
    if (!referralTrialEndsAt) return false;
    return new Date(referralTrialEndsAt).getTime() > Date.now();
  }, [referralTrialEndsAt]);

  const isPremium = rcPremium || allowlistPremium || referralTrialActive;
  setPremiumWriteGate(isPremium);

  useEffect(() => {
    if (!authState.userId) return;

    const unlocked = rcPremium || allowlistPremium || referralTrialActive;
    // Do not clear server-side premium / community gold when we cannot know (no RC in build).
    if (!unlocked && !isConfigured && !allowlistPremium && !referralTrialActive) return;
    // Do not clear until RevenueCat has refreshed for this Supabase user (prevents race before logIn finishes).
    if (!unlocked && isConfigured && premiumSyncUserIdRef.current !== authState.userId) return;

    const source = rcPremium
      ? 'revenuecat'
      : allowlistPremium
        ? 'email_allowlist'
        : referralTrialActive
          ? 'referral_trial'
          : 'revenuecat';
    let cancelled = false;
    (async () => {
      try {
        setSyncBusy(true);
        await syncPremiumToBackend(authState.userId!, unlocked, source);
      } catch {
        // non-fatal
      } finally {
        if (!cancelled) setSyncBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authState.userId, rcPremium, allowlistPremium, referralTrialActive, isConfigured]);

  const refreshSubscription = useCallback(async () => {
    if (!isConfigured) return;

    try {
      const [nextOfferings, customerInfo] = await Promise.all([
        Purchases.getOfferings(),
        Purchases.getCustomerInfo(),
      ]);
      setOfferings(nextOfferings);
      setRcPremium(hasPremiumEntitlement(customerInfo));

      if (__DEV__) {
        try {
          const rcUserId = await Purchases.getAppUserID();
          console.log(
            '[RevenueCat] Paste this into dashboard → Customers search:',
            rcUserId,
            '| premium entitlement:',
            hasPremiumEntitlement(customerInfo)
          );
        } catch {
          // non-fatal
        }
      }

      if (__DEV__) {
        const primary = getPrimaryOffering(nextOfferings);
        const pkgs = getOfferingPackages(nextOfferings);
        if (!primary?.monthly && !primary?.annual && !pkgs.length) {
          console.warn('[RevenueCat] No packages on offering:', {
            currentId: nextOfferings?.current?.identifier ?? null,
            primaryId: primary?.identifier ?? null,
            allKeys: nextOfferings?.all ? Object.keys(nextOfferings.all) : [],
            availableCount: pkgs.length,
          });
        }
      }
    } catch (error) {
      if (isRevenueCatInvalidApiKey(error)) {
        console.warn('[RevenueCat] Invalid API key detected; disabling subscription sync.');
        setIsConfigured(false);
        setOfferings(null);
        setRcPremium(false);
      }
      console.warn('Failed to refresh subscription:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isConfigured]);

  useEffect(() => {
    let mounted = true;

    async function configurePurchases() {
      if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
        if (mounted) {
          setIsConfigured(false);
          setIsLoading(false);
        }
        return;
      }

      const expoGo = isRunningInExpoGo();
      const apiKey = expoGo
        ? REVENUECAT_TEST_STORE_API_KEY
        : Platform.OS === 'ios'
          ? REVENUECAT_IOS_API_KEY.trim()
          : REVENUECAT_ANDROID_API_KEY.trim();

      if (__DEV__) {
        console.log('[RevenueCat] configure:', {
          expoGo,
          platform: Platform.OS,
          keyPrefix: apiKey ? apiKey.slice(0, 6) : null,
          keyLen: apiKey ? apiKey.length : 0,
        });
      }

      if (!apiKey) {
        if (expoGo) {
          console.warn(
            'RevenueCat (Expo Go): add EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY from RevenueCat → Apps & providers → Test configuration → Test Store. iOS/Android SDK keys do not work in Expo Go. https://rev.cat/sdk-test-store'
          );
        } else {
          console.warn(
            Platform.OS === 'ios'
              ? 'RevenueCat is not configured: EXPO_PUBLIC_REVENUECAT_IOS_API_KEY missing'
              : 'RevenueCat is not configured: EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY (or EXPO_PUBLIC_REVENUECAT_API_KEY) missing'
          );
        }
        if (mounted) {
          setIsConfigured(false);
          setIsLoading(false);
        }
        return;
      }

      if (__DEV__ && expoGo) {
        console.log('[RevenueCat] Using Test Store API key (Expo Go).');
      }

      try {
        await Purchases.setLogLevel(__DEV__ ? Purchases.LOG_LEVEL.DEBUG : Purchases.LOG_LEVEL.WARN);
        await Purchases.configure({
          apiKey,
        });

        // Validate the key early so we don't spam logIn/getCustomerInfo when the key is wrong.
        // `configure()` may not throw even when the key is invalid; server errors happen on requests.
        try {
          await Purchases.getCustomerInfo();
        } catch (validationError) {
          if (isRevenueCatInvalidApiKey(validationError)) throw validationError;
          console.warn('[RevenueCat] Early validation failed (non-fatal):', validationError);
        }

        if (!mounted) return;
        setIsConfigured(true);
      } catch (error) {
        const debug = getRevenueCatDebugSnapshot(apiKey, expoGo, error);
        console.warn('Failed to configure RevenueCat:', debug);
        if (__DEV__) {
          Alert.alert(
            'RevenueCat config error',
            `msg=${String(debug.message ?? '-')}\nreadableCode=${String(debug.readableErrorCode ?? '-')}\nbackendCode=${String(debug.backendErrorCode ?? '-')}\nstatus=${String(debug.statusCode ?? '-')}\nkeyPrefix=${String(debug.keyPrefix ?? '-')}\nkeyLen=${String(debug.keyLen ?? '-')}\nbundle=${String(debug.bundleId ?? '-')}`
          );
        }
        if (mounted) {
          setIsConfigured(false);
          setIsLoading(false);
        }
      }
    }

    configurePurchases();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isConfigured) return;

    async function handleIdentity() {
      let shouldRefresh = true;
      try {
        if (authState.userId) {
          await Purchases.logIn(authState.userId);
        } else {
          await Purchases.logOut();
        }
      } catch (error) {
        if (isRevenueCatInvalidApiKey(error)) {
          shouldRefresh = false;
          setIsConfigured(false);
        }
        console.warn(
          'Failed to sync RevenueCat user identity:',
          getRevenueCatDebugSnapshot(
            Platform.OS === 'ios' ? REVENUECAT_IOS_API_KEY.trim() : REVENUECAT_ANDROID_API_KEY.trim(),
            isRunningInExpoGo(),
            error
          )
        );
      } finally {
        if (shouldRefresh) await refreshSubscription();
        premiumSyncUserIdRef.current = authState.userId ?? null;
      }
    }

    handleIdentity();
  }, [authState.userId, isConfigured, refreshSubscription]);

  const { monthlyPackage, annualPackage } = useMemo(() => {
    const pkg = pickMonthlyAndAnnualPackages(offerings);
    return {
      monthlyPackage: pkg.monthly,
      annualPackage: pkg.annual,
    };
  }, [offerings]);

  const openPaywall = useCallback(
    (reason?: string, opts?: { dismissible?: boolean }) => {
      if (isPremium) return;
      setPaywallReason(reason || null);
      setPaywallDismissible(opts?.dismissible !== false);
      setShowPaywall(true);
      void refreshSubscription();
    },
    [isPremium, refreshSubscription]
  );

  /** Pass `true` after RevenueCat UI closes so state clears even when the paywall was not user-dismissible. */
  const closePaywall = useCallback((force?: boolean) => {
    if (!force && !paywallDismissible) return;
    setShowPaywall(false);
  }, [paywallDismissible]);

  useEffect(() => {
    if (!isPremium) return;
    setShowPaywall(false);
  }, [isPremium]);

  const finalizePurchaseCustomerInfo = useCallback(
    async (customerInfo: CustomerInfoResult | undefined) => {
      let premium = hasPremiumEntitlement(customerInfo);
      if (!premium) {
        try {
          const synced = await Purchases.syncPurchasesForResult();
          premium = hasPremiumEntitlement(synced.customerInfo);
        } catch {
          // non-fatal
        }
      }
      setRcPremium(premium);
      if (premium) {
        setShowPaywall(false);
        Alert.alert('Berhasil', 'Langganan Premium aktif.');
      } else {
        Alert.alert(
          'Premium belum terdeteksi',
          'Jika pembayaran sudah berhasil, tunggu 1–2 menit lalu ketuk Pulihkan Pembelian.'
        );
      }
      return premium;
    },
    []
  );

  const purchasePackage = useCallback(
    async (pkg: RevenuePackage | null) => {
      if (!pkg) return false;
      try {
        setPurchaseBusy(true);
        const result = await Purchases.purchasePackage(pkg);
        return finalizePurchaseCustomerInfo(result?.customerInfo);
      } catch (error: unknown) {
        const detail = formatPurchaseError(error);
        if (detail) {
          Alert.alert('Pembelian gagal', `${detail}\n\nJika ini review sandbox: pastikan produk IAP aktif, Paid Apps Agreement disetujui, dan RevenueCat memakai kunci iOS yang benar.`);
        }
        return false;
      } finally {
        setPurchaseBusy(false);
      }
    },
    [finalizePurchaseCustomerInfo]
  );

  /** When offerings have no packages, buy by Play product id (still goes through RevenueCat). */
  const purchaseAndroidSubscriptionByProductId = useCallback(
    async (period: 'monthly' | 'annual') => {
      const productId = period === 'monthly' ? ANDROID_SUB_MONTHLY : ANDROID_SUB_YEARLY;
      if (!productId) {
        Alert.alert(
          'Paket belum tersedia',
          'Tambahkan EXPO_PUBLIC_ANDROID_SUBSCRIPTION_MONTHLY dan YEARLY di EAS (production), atau perbaiki Offering + produk di RevenueCat.'
        );
        return false;
      }
      if (!isConfigured) {
        Alert.alert(
          'Pembayaran belum siap',
          'Kunci RevenueCat Android belum ada di build ini. Set EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY di EAS production lalu build ulang.'
        );
        return false;
      }
      try {
        setPurchaseBusy(true);
        const storeProduct = await fetchAndroidSubscriptionStoreProduct(period);
        if (!storeProduct) {
          Alert.alert(
            'Produk Play belum tersedia',
            'Google Play belum mengembalikan langganan ini. Pasang app dari Internal/Open testing, pastikan akun Google adalah tester, dan cek ID + base plan di Play Console (contoh: dietku_premium_monthly + base plan monthly).'
          );
          return false;
        }
        const result = await Purchases.purchaseStoreProduct(storeProduct);
        return finalizePurchaseCustomerInfo(result?.customerInfo);
      } catch (error: unknown) {
        const detail = formatPurchaseError(error);
        if (detail) {
          Alert.alert('Pembelian gagal', detail);
        }
        return false;
      } finally {
        setPurchaseBusy(false);
      }
    },
    [isConfigured, finalizePurchaseCustomerInfo]
  );

  /** When offerings omit packages but App Store returns products (fix Offering or use this fallback). */
  const purchaseIosSubscriptionByProductId = useCallback(
    async (period: 'monthly' | 'annual') => {
      if (!isConfigured) {
        Alert.alert(
          'Pembayaran belum siap',
          'Kunci RevenueCat iOS belum ada di build ini. Set EXPO_PUBLIC_REVENUECAT_IOS_API_KEY di EAS lalu build ulang.'
        );
        return false;
      }
      try {
        setPurchaseBusy(true);
        const storeProduct = await fetchIosSubscriptionStoreProduct(period);
        if (!storeProduct) {
          Alert.alert(
            'Produk App Store belum tersedia',
            'Langganan belum tersedia saat ini. Coba lagi sebentar lagi atau ketuk Pulihkan Pembayaran. Jika masalah berlanjut, hubungi dukungan.'
          );
          return false;
        }
        const result = await Purchases.purchaseStoreProduct(storeProduct);
        return finalizePurchaseCustomerInfo(result?.customerInfo);
      } catch (error: unknown) {
        const detail = formatPurchaseError(error);
        if (detail) {
          Alert.alert('Pembelian gagal', detail);
        }
        return false;
      } finally {
        setPurchaseBusy(false);
      }
    },
    [isConfigured, finalizePurchaseCustomerInfo]
  );

  const purchaseMonthly = useCallback(async () => {
    if (monthlyPackage) return purchasePackage(monthlyPackage);
    if (Platform.OS === 'android') return purchaseAndroidSubscriptionByProductId('monthly');
    if (Platform.OS === 'ios') return purchaseIosSubscriptionByProductId('monthly');
    Alert.alert(
      'Paket belum tersedia',
      'Tidak ada paket bulanan dari RevenueCat. Periksa Offering di dashboard (iOS).'
    );
    return false;
  }, [
    monthlyPackage,
    purchasePackage,
    purchaseAndroidSubscriptionByProductId,
    purchaseIosSubscriptionByProductId,
  ]);

  const purchaseAnnual = useCallback(async () => {
    if (annualPackage) return purchasePackage(annualPackage);
    if (Platform.OS === 'android') return purchaseAndroidSubscriptionByProductId('annual');
    if (Platform.OS === 'ios') return purchaseIosSubscriptionByProductId('annual');
    Alert.alert(
      'Paket belum tersedia',
      'Tidak ada paket tahunan dari RevenueCat. Periksa Offering di dashboard (iOS).'
    );
    return false;
  }, [
    annualPackage,
    purchasePackage,
    purchaseAndroidSubscriptionByProductId,
    purchaseIosSubscriptionByProductId,
  ]);

  const restorePurchases = useCallback(async () => {
    try {
      setPurchaseBusy(true);
      const customerInfo = await Purchases.restorePurchases();
      const premium = hasPremiumEntitlement(customerInfo);
      setRcPremium(premium);
      Alert.alert(
        premium ? 'Berhasil' : 'Tidak ada pembelian',
        premium ? 'Premium berhasil dipulihkan.' : 'Tidak ada langganan aktif untuk dipulihkan.'
      );
      return premium;
    } catch (error: unknown) {
      const detail = formatPurchaseError(error);
      Alert.alert('Gagal memulihkan', detail || 'Silakan coba lagi.');
      return false;
    } finally {
      setPurchaseBusy(false);
    }
  }, [authState.userId]);

  return {
    isConfigured,
    isLoading,
    isPremium,
    purchaseBusy,
    syncBusy,
    showPaywall,
    paywallDismissible,
    paywallReason,
    monthlyPackage,
    annualPackage,
    openPaywall,
    closePaywall,
    purchaseMonthly,
    purchaseAnnual,
    restorePurchases,
    refreshSubscription,
  };
});
