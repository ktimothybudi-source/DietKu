import createContextHook from '@nkzw/create-context-hook';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { UserProfile, FoodEntry, DailyTargets, MealAnalysis, FavoriteMeal, RecentMeal } from '@/types/nutrition';
import { calculateDailyTargets, getTodayKey, sumMidpointMicrosFromItems } from '@/utils/nutritionCalculations';
import { analyzeMealPhoto } from '@/utils/photoAnalysis';
import { mapScanErrorToUserMessage } from '@/utils/scanErrorMessages';
import { saveImagePermanently } from '@/utils/imageStorage';
import {
  supabase,
  SUPABASE_URL,
  SupabaseProfile,
  SupabaseFoodEntry,
  SupabaseWeightHistory,
  SupabaseStreak,
} from '@/lib/supabase';
import {
  clearExpectUserInitiatedSignOut,
  consumeExpectUserInitiatedSignOut,
  setExpectUserInitiatedSignOut,
} from '@/lib/authSignOutFlag';
import {
  MEAL_PHOTOS_BUCKET,
  resolveMealPhotoForDatabase,
  getMealPhotoStoragePathFromValue,
} from '@/utils/supabaseStorage';
import { cleanupExpiredMealPhotoCache, getCachedMealPhotoUri } from '@/utils/mealPhotoCache';
import type { DbMealType } from '@/lib/mealDefaults';
import { getPremiumWriteGate } from '@/lib/premiumWriteGate';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Session } from '@supabase/supabase-js';
import { eventEmitter } from '@/utils/eventEmitter';
import { useLanguage } from '@/contexts/LanguageContext';

interface FoodLog {
  [date: string]: FoodEntry[];
}

interface StreakData {
  currentStreak: number;
  bestStreak: number;
  lastLoggedDate: string;
  graceUsedThisWeek: boolean;
}

interface WeightEntry {
  date: string;
  weight: number;
  timestamp: number;
}

interface AuthState {
  isSignedIn: boolean;
  email: string | null;
  userId: string | null;
}

export interface PendingFoodEntry {
  id: string;
  photoUri: string;
  permanentPhotoUri?: string;
  base64: string;
  timestamp: number;
  status: 'analyzing' | 'done' | 'error';
  analysis?: MealAnalysis;
  error?: string;
}

const mapSupabaseProfileToUserProfile = (sp: SupabaseProfile): UserProfile => {
  const goal = (sp.goal === 'fat_loss' || sp.goal === 'maintenance' || sp.goal === 'muscle_gain') ? sp.goal : 'maintenance';

  const hasStoredWeekly =
    sp.weekly_weight_change != null && !Number.isNaN(Number(sp.weekly_weight_change));

  // Derive weeklyWeightChange from goal only when not persisted (legacy rows)
  let weeklyWeightChange: number | undefined;
  if (hasStoredWeekly) {
    weeklyWeightChange = Number(sp.weekly_weight_change);
  } else if (goal === 'fat_loss') {
    weeklyWeightChange = 0.5;
  } else if (goal === 'muscle_gain') {
    weeklyWeightChange = 0.3;
  } else {
    weeklyWeightChange = 0;
  }

  return {
    name: sp.name || undefined,
    age: sp.birth_date ? Math.floor((Date.now() - new Date(sp.birth_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 25,
    sex: (sp.gender === 'male' || sp.gender === 'female') ? sp.gender : 'male',
    height: sp.height || 170,
    weight: sp.weight || 70,
    goalWeight: sp.target_weight || sp.weight || 70,
    goal,
    activityLevel: (sp.activity_level === 'low' || sp.activity_level === 'moderate' || sp.activity_level === 'high') ? sp.activity_level : 'moderate',
    weeklyWeightChange,
  };
};

const mapSupabaseFoodEntryToFoodEntry = (sfe: SupabaseFoodEntry): FoodEntry => ({
  id: sfe.id,
  timestamp: new Date(sfe.created_at).getTime(),
  name: sfe.food_name,
  calories: sfe.calories,
  protein: sfe.protein,
  carbs: sfe.carbs,
  fat: sfe.fat,
  sugar: sfe.sugar ?? 0,
  fiber: sfe.fiber ?? 0,
  sodium: sfe.sodium ?? 0,
  photoUri: sfe.photo_uri || undefined,
  loggedMealId: sfe.logged_meal_id ?? undefined,
});

const mapFavoriteRow = (f: Record<string, unknown>): FavoriteMeal => ({
  id: String(f.id),
  name: String(f.name ?? ''),
  calories: Number(f.calories ?? 0),
  protein: Number(f.protein ?? 0),
  carbs: Number(f.carbs ?? 0),
  fat: Number(f.fat ?? 0),
  createdAt: new Date(String(f.created_at)).getTime(),
  logCount: Number(f.log_count ?? 0),
});

export const [NutritionProvider, useNutrition] = createContextHook(() => {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [foodLog, setFoodLog] = useState<FoodLog>({});
  const [weightHistory, setWeightHistory] = useState<WeightEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayKey());
  const [pendingEntries, setPendingEntries] = useState<PendingFoodEntry[]>([]);
  const [streakData, setStreakData] = useState<StreakData>({
    currentStreak: 0,
    bestStreak: 0,
    lastLoggedDate: '',
    graceUsedThisWeek: false,
  });
  const [favorites, setFavorites] = useState<FavoriteMeal[]>([]);
  const [recentMeals, setRecentMeals] = useState<RecentMeal[]>([]);
  const [authState, setAuthState] = useState<AuthState>({ isSignedIn: false, email: null, userId: null });
  const [, setSession] = useState<Session | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [waterCups, setWaterCups] = useState<{ [date: string]: number }>({});
  const [sugarUnits, setSugarUnits] = useState<{ [date: string]: number }>({});
  const [fiberUnits, setFiberUnits] = useState<{ [date: string]: number }>({});
  const [sodiumUnits, setSodiumUnits] = useState<{ [date: string]: number }>({});

  // React Native: keep GoTrue’s auto-refresh running whenever possible. Pausing on Android caused more
  // “logged out after background” reports than any timer issue.
  //
  // On resume: restore UI from getSession() only. Call refreshSession() if the access JWT is *already*
  // expired — not “about to expire”. Pre‑refresh on a flaky cell connection often triggers _removeSession
  // client-side and feels like random sign-out.
  useEffect(() => {
    const isInvalidRefreshTokenError = (err: unknown): boolean => {
      const msg = err instanceof Error ? err.message : String(err ?? '');
      return /invalid refresh token|refresh token not found/i.test(msg);
    };
    const isLikelyOfflineError = (err: unknown): boolean => {
      const msg = err instanceof Error ? err.message : String(err ?? '');
      return /network request failed|failed to fetch|networkerror|network error|request timed out|timeout/i.test(
        msg
      );
    };
    const hasAuthBackendConnectivity = async (): Promise<boolean> => {
      if (!SUPABASE_URL) return true;
      try {
        const healthUrl = `${SUPABASE_URL}/auth/v1/health`;
        const res = await fetch(healthUrl, { method: 'GET' });
        return res.ok;
      } catch {
        return false;
      }
    };

    const clearBrokenLocalSession = async () => {
      try {
        // Local scope avoids failing when server-side token/session is already gone.
        await (supabase.auth as any).signOut?.({ scope: 'local' });
      } catch {
        // ignore
      }
      clearExpectUserInitiatedSignOut();
      setSession(null);
      setAuthState({ isSignedIn: false, email: null, userId: null });
    };

    const recoverFromInvalidRefreshToken = async (): Promise<boolean> => {
      const waits = [250, 750, 1500];
      for (const waitMs of waits) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.user) continue;
          setSession(session);
          setAuthState({
            isSignedIn: true,
            email: session.user.email || null,
            userId: session.user.id,
          });
          return true;
        } catch {
          // keep retrying
        }
      }
      return false;
    };

    const onAppState = (state: AppStateStatus) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
        void (async () => {
          let session: Session | null = null;
          try {
            const res = await supabase.auth.getSession();
            session = res.data.session;
          } catch (e) {
            if (isInvalidRefreshTokenError(e)) {
              const recovered = await recoverFromInvalidRefreshToken();
              if (recovered) return;
              console.warn('Invalid refresh token on resume; clearing local session.');
              await clearBrokenLocalSession();
              return;
            }
            throw e;
          }
          if (!session?.user) return;
          setSession(session);
          setAuthState({
            isSignedIn: true,
            email: session.user.email || null,
            userId: session.user.id,
          });
          const nowSec = Math.floor(Date.now() / 1000);
          const exp = session.expires_at ?? 0;
          const alreadyExpired = exp > 0 && exp < nowSec;
          if (!alreadyExpired) return;
          const { data: refreshed, error } = await supabase.auth.refreshSession();
          if (error) {
            if (isInvalidRefreshTokenError(error)) {
              const recovered = await recoverFromInvalidRefreshToken();
              if (recovered) return;
              console.warn('Invalid refresh token while refreshing on resume; clearing local session.');
              await clearBrokenLocalSession();
              return;
            }
            console.warn('Auth refresh on resume (expired JWT) failed:', error.message);
            return;
          }
          if (!refreshed.session?.user) return;
          setSession(refreshed.session);
          setAuthState({
            isSignedIn: true,
            email: refreshed.session.user.email || null,
            userId: refreshed.session.user.id,
          });
        })();
      }
    };
    const sub = AppState.addEventListener('change', onAppState);
    onAppState(AppState.currentState);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const isInvalidRefreshTokenError = (err: unknown): boolean => {
      const msg = err instanceof Error ? err.message : String(err ?? '');
      return /invalid refresh token|refresh token not found/i.test(msg);
    };

    const clearBrokenLocalSession = async () => {
      try {
        await (supabase.auth as any).signOut?.({ scope: 'local' });
      } catch {
        // ignore
      }
      clearExpectUserInitiatedSignOut();
      setSession(null);
      setAuthState({ isSignedIn: false, email: null, userId: null });
    };

    const applyAuthSession = (session: Session | null) => {
      setSession(session);
      if (!session?.user) return false;
      setAuthState({
        isSignedIn: true,
        email: session.user.email || null,
        userId: session.user.id,
      });
      return true;
    };

    void (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log('Initial session:', session?.user?.email);
        void applyAuthSession(session);
      } catch (e) {
        if (isInvalidRefreshTokenError(e)) {
          console.warn('Invalid refresh token at startup; clearing local session.');
          await clearBrokenLocalSession();
          return;
        }
        console.warn('Initial getSession failed:', e);
      } finally {
        setAuthInitialized(true);
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session?.user?.email ?? '(no user)');
      if (applyAuthSession(session)) return;

      if (event === 'SIGNED_OUT') {
        if (consumeExpectUserInitiatedSignOut()) {
          setSession(null);
          setAuthState({ isSignedIn: false, email: null, userId: null });
          return;
        }
        // GoTrue can emit SIGNED_OUT while storage is briefly inconsistent or refresh races. Don’t clear
        // the app immediately — confirm session is really gone after several reads.
        void (async () => {
          const delaysMs = [100, 250, 500, 1000, 2000, 4000];
          for (const waitMs of delaysMs) {
            await new Promise((resolve) => setTimeout(resolve, waitMs));
            let recovered: Session | null = null;
            try {
              const res = await supabase.auth.getSession();
              recovered = res.data.session;
            } catch (e) {
              if (isInvalidRefreshTokenError(e)) {
                await clearBrokenLocalSession();
                return;
              }
              continue;
            }
            if (applyAuthSession(recovered)) {
              console.log('Auth recovered after SIGNED_OUT event; keeping user signed in.');
              return;
            }
          }
          const authBackendReachable = await hasAuthBackendConnectivity();
          if (!authBackendReachable) {
            console.warn(
              'Auth SIGNED_OUT happened while offline/unreachable; preserving signed-in UI state.'
            );
            return;
          }
          console.warn('Auth SIGNED_OUT confirmed after retries (online) — clearing local auth state.');
          clearExpectUserInitiatedSignOut();
          setSession(null);
          setAuthState({ isSignedIn: false, email: null, userId: null });
        })();
        return;
      }

      // Transient null session (refresh in flight, etc.)
      void (async () => {
        const waits = [150, 500, 1200, 2500];
        for (const waitMs of waits) {
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          let recovered: Session | null = null;
          try {
            const res = await supabase.auth.getSession();
            recovered = res.data.session;
          } catch (e) {
            if (isInvalidRefreshTokenError(e)) {
              await clearBrokenLocalSession();
              return;
            }
            if (isLikelyOfflineError(e)) {
              return;
            }
            continue;
          }
          if (applyAuthSession(recovered)) return;
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const profileQuery = useQuery({
    queryKey: ['supabase_profile', authState.userId],
    queryFn: async () => {
      if (!authState.userId) return null;
      console.log('Fetching profile from Supabase for:', authState.userId);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authState.userId)
        .single();
      
      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
      console.log('Profile fetched:', data);
      return data as SupabaseProfile;
    },
    enabled: authState.isSignedIn && !!authState.userId,
  });

  const foodEntriesQuery = useQuery({
    queryKey: ['supabase_food_entries', authState.userId],
    queryFn: async () => {
      if (!authState.userId) return [];
      console.log('Fetching food entries from Supabase');
      await cleanupExpiredMealPhotoCache();
      const { data, error } = await supabase
        .from('food_entries')
        .select('*')
        .eq('user_id', authState.userId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching food entries:', error);
        return [];
      }
      const rows = (data || []) as SupabaseFoodEntry[];
      const signedTtlSec = 60 * 60 * 24 * 30;
      const withPhotoUrls = await Promise.all(
        rows.map(async (row) => {
          const raw = row.photo_uri;
          if (!raw) return row;
          const path = getMealPhotoStoragePathFromValue(raw);
          if (!path) return row;
          const { data: signedData, error: signedError } = await supabase.storage
            .from(MEAL_PHOTOS_BUCKET)
            .createSignedUrl(path, signedTtlSec);
          const remoteUrl = (!signedError && signedData?.signedUrl)
            ? signedData.signedUrl
            : supabase.storage.from(MEAL_PHOTOS_BUCKET).getPublicUrl(path).data.publicUrl;
          if (!remoteUrl) return row;
          try {
            const cachedLocalUri = await getCachedMealPhotoUri(path, remoteUrl);
            return { ...row, photo_uri: cachedLocalUri };
          } catch (cacheError) {
            console.warn('Food entry photo local cache failed:', path, cacheError);
          }
          if (!signedError && signedData?.signedUrl) {
            return { ...row, photo_uri: signedData.signedUrl };
          }
          console.warn('Food entry photo signed URL failed:', path, signedError?.message);
          const { data: publicData } = supabase.storage.from(MEAL_PHOTOS_BUCKET).getPublicUrl(path);
          if (publicData?.publicUrl) {
            return { ...row, photo_uri: publicData.publicUrl };
          }
          return row;
        })
      );
      return withPhotoUrls;
    },
    enabled: authState.isSignedIn && !!authState.userId,
  });

  const weightHistoryQuery = useQuery({
    queryKey: ['supabase_weight_history', authState.userId],
    queryFn: async () => {
      if (!authState.userId) return [];
      console.log('Fetching weight history from Supabase');
      const { data, error } = await supabase
        .from('weight_history')
        .select('*')
        .eq('user_id', authState.userId)
        .order('recorded_at', { ascending: true });
      
      if (error) {
        console.error('Error fetching weight history:', error);
        return [];
      }
      return data as SupabaseWeightHistory[];
    },
    enabled: authState.isSignedIn && !!authState.userId,
  });

  const streakQuery = useQuery({
    queryKey: ['supabase_streak', authState.userId],
    queryFn: async () => {
      if (!authState.userId) {
        return {
          currentStreak: 0,
          bestStreak: 0,
          lastLoggedDate: '',
          graceUsedThisWeek: false,
        };
      }

      const { data, error } = await supabase
        .from('streaks')
        .select('*')
        .eq('user_id', authState.userId)
        .maybeSingle<SupabaseStreak>();

      if (error) {
        console.error('Error fetching streak from Supabase:', error);
        return {
          currentStreak: 0,
          bestStreak: 0,
          lastLoggedDate: '',
          graceUsedThisWeek: false,
        };
      }

      if (!data) {
        return {
          currentStreak: 0,
          bestStreak: 0,
          lastLoggedDate: '',
          graceUsedThisWeek: false,
        };
      }

      return {
        currentStreak: data.current_streak ?? 0,
        bestStreak: data.best_streak ?? 0,
        lastLoggedDate: data.last_logged_date ?? '',
        graceUsedThisWeek: data.grace_used_week ?? false,
      } as StreakData;
    },
    enabled: authState.isSignedIn && !!authState.userId,
  });

  const favoritesQuery = useQuery({
    queryKey: ['nutrition_favorites', authState.userId],
    queryFn: async () => {
      if (!authState.userId) return [];
      const { data, error } = await supabase
        .from('favorites')
        .select('*')
        .eq('user_id', authState.userId)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Error fetching favorites:', error);
        return [];
      }
      return (data || []).map((f: any) => mapFavoriteRow(f)) as FavoriteMeal[];
    },
    enabled: authState.isSignedIn && !!authState.userId,
  });

  const waterQuery = useQuery({
    queryKey: ['nutrition_water', authState.userId],
    queryFn: async () => {
      if (!authState.userId) return {};
      const { data, error } = await supabase
        .from('water_tracking')
        .select('date, cups')
        .eq('user_id', authState.userId);
      if (error) {
        console.error('Error fetching water tracking:', error);
        return {};
      }
      return Object.fromEntries((data || []).map((r: any) => [r.date, Number(r.cups || 0)]));
    },
    enabled: authState.isSignedIn && !!authState.userId,
  });

  const sugarQuery = useQuery({
    queryKey: ['nutrition_sugar', authState.userId],
    queryFn: async () => {
      if (!authState.userId) return {};
      const { data, error } = await supabase
        .from('micronutrients_tracking')
        .select('date, sugar_units')
        .eq('user_id', authState.userId);
      if (error) {
        console.error('Error fetching sugar tracking:', error);
        return {};
      }
      return Object.fromEntries((data || []).map((r: any) => [r.date, Number(r.sugar_units || 0)]));
    },
    enabled: authState.isSignedIn && !!authState.userId,
  });

  const fiberQuery = useQuery({
    queryKey: ['nutrition_fiber', authState.userId],
    queryFn: async () => {
      if (!authState.userId) return {};
      const { data, error } = await supabase
        .from('micronutrients_tracking')
        .select('date, fiber_units')
        .eq('user_id', authState.userId);
      if (error) {
        console.error('Error fetching fiber tracking:', error);
        return {};
      }
      return Object.fromEntries((data || []).map((r: any) => [r.date, Number(r.fiber_units || 0)]));
    },
    enabled: authState.isSignedIn && !!authState.userId,
  });

  const sodiumQuery = useQuery({
    queryKey: ['nutrition_sodium', authState.userId],
    queryFn: async () => {
      if (!authState.userId) return {};
      const { data, error } = await supabase
        .from('micronutrients_tracking')
        .select('date, sodium_units')
        .eq('user_id', authState.userId);
      if (error) {
        console.error('Error fetching sodium tracking:', error);
        return {};
      }
      return Object.fromEntries((data || []).map((r: any) => [r.date, Number(r.sodium_units || 0)]));
    },
    enabled: authState.isSignedIn && !!authState.userId,
  });

  const recentMealsQuery = useQuery({
    queryKey: ['nutrition_recent_meals', authState.userId],
    queryFn: async () => {
      if (!authState.userId) return [];
      const { data, error } = await supabase
        .from('recent_meals')
        .select('*')
        .eq('user_id', authState.userId)
        .order('last_logged_at', { ascending: false });
      if (error) {
        console.error('Error fetching recent meals:', error);
        return [];
      }
      return (data || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        calories: Number(r.calories || 0),
        protein: Number(r.protein || 0),
        carbs: Number(r.carbs || 0),
        fat: Number(r.fat || 0),
        lastLogged: new Date(r.last_logged_at).getTime(),
        logCount: Number(r.log_count || 1),
      })) as RecentMeal[];
    },
    enabled: authState.isSignedIn && !!authState.userId,
  });

  useEffect(() => {
    if (profileQuery.data) {
      const mapped = mapSupabaseProfileToUserProfile(profileQuery.data);
      setProfile(mapped);
      console.log('Profile state updated from Supabase:', mapped);
    }
  }, [profileQuery.data]);

  useEffect(() => {
    if (foodEntriesQuery.data) {
      const grouped: FoodLog = {};
      foodEntriesQuery.data.forEach(entry => {
        const rawDate = entry.date as unknown as string;
        const dateKey = rawDate.split('T')[0];
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(mapSupabaseFoodEntryToFoodEntry(entry));
      });
      setFoodLog(grouped);
      console.log('Food log updated from Supabase');
    }
  }, [foodEntriesQuery.data]);

  useEffect(() => {
    if (weightHistoryQuery.data) {
      const mapped: WeightEntry[] = weightHistoryQuery.data.map(wh => ({
        date: wh.recorded_at.split('T')[0],
        weight: wh.weight,
        timestamp: new Date(wh.recorded_at).getTime(),
      }));
      setWeightHistory(mapped);
      console.log('Weight history updated from Supabase');
    }
  }, [weightHistoryQuery.data]);

  useEffect(() => {
    if (streakQuery.data) {
      setStreakData(streakQuery.data);
    }
  }, [streakQuery.data]);

  useEffect(() => {
    if (favoritesQuery.data !== undefined) {
      setFavorites(favoritesQuery.data);
    }
  }, [favoritesQuery.data]);

  useEffect(() => {
    if (recentMealsQuery.data) {
      setRecentMeals(recentMealsQuery.data);
    }
  }, [recentMealsQuery.data]);

  useEffect(() => {
    if (waterQuery.data) {
      setWaterCups(waterQuery.data);
    }
  }, [waterQuery.data]);

  useEffect(() => {
    if (sugarQuery.data) {
      setSugarUnits(sugarQuery.data);
    }
  }, [sugarQuery.data]);

  useEffect(() => {
    if (fiberQuery.data) {
      setFiberUnits(fiberQuery.data);
    }
  }, [fiberQuery.data]);

  useEffect(() => {
    if (sodiumQuery.data) {
      setSodiumUnits(sodiumQuery.data);
    }
  }, [sodiumQuery.data]);

  const saveProfileMutation = useMutation({
    mutationFn: async (newProfile: UserProfile) => {
      if (!authState.userId) throw new Error('Not authenticated');
      
      // Calculate daily targets based on profile
      const calculatedTargets = calculateDailyTargets(newProfile);
      console.log('Saving profile to Supabase with targets:', newProfile, calculatedTargets);
      
      // Calculate birth_date from age
      const birthDate = new Date();
      birthDate.setFullYear(birthDate.getFullYear() - newProfile.age);
      const birthDateStr = birthDate.toISOString().split('T')[0];
      
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: authState.userId,
          email: authState.email,
          name: newProfile.name || null,
          gender: newProfile.sex,
          birth_date: birthDateStr,
          height: newProfile.height,
          weight: newProfile.weight,
          target_weight: newProfile.goalWeight,
          activity_level: newProfile.activityLevel,
          goal: newProfile.goal,
          weekly_weight_change: newProfile.weeklyWeightChange ?? null,
          daily_calories: calculatedTargets.calories,
          protein_target: calculatedTargets.protein,
          carbs_target: Math.round((calculatedTargets.carbsMin + calculatedTargets.carbsMax) / 2),
          fat_target: Math.round((calculatedTargets.fatMin + calculatedTargets.fatMax) / 2),
          updated_at: new Date().toISOString(),
        });
      
      if (error) {
        console.error('Error saving profile:', error);
        throw error;
      }
      return newProfile;
    },
    onSuccess: (data) => {
      setProfile(data);
      queryClient.invalidateQueries({ queryKey: ['supabase_profile'] });
      console.log('Profile saved successfully');
    },
  });

  const saveFoodEntryMutation = useMutation({
    mutationFn: async ({ entry, dateKey }: { entry: Omit<FoodEntry, 'id' | 'timestamp'>; dateKey: string }) => {
      if (!authState.userId) {
        console.error('Save food entry failed: Not authenticated, userId:', authState.userId);
        throw new Error('Not authenticated');
      }
      
      console.log('Saving food entry to Supabase:', {
        userId: authState.userId,
        date: dateKey,
        entry: entry,
      });

      const photo_uri = await resolveMealPhotoForDatabase(entry.photoUri, authState.userId);
      
      const insertData = {
        user_id: authState.userId,
        date: dateKey,
        food_name: entry.name,
        calories: Math.round((entry.calories || 0) * 10) / 10,
        protein: Math.round((entry.protein || 0) * 10) / 10,
        carbs: Math.round((entry.carbs || 0) * 10) / 10,
        fat: Math.round((entry.fat || 0) * 10) / 10,
        sugar: Math.round((entry.sugar || 0) * 10) / 10,
        fiber: Math.round((entry.fiber || 0) * 10) / 10,
        sodium: Math.round((entry.sodium || 0) * 10) / 10,
        photo_uri,
      };
      
      console.log('Insert data:', insertData);
      
      const { data, error } = await supabase
        .from('food_entries')
        .insert(insertData)
        .select()
        .single();
      
      if (error) {
        console.error('Error saving food entry:', error.message, error.code, error.details, error.hint);
        throw new Error(`Failed to save food: ${error.message}`);
      }
      
      console.log('Food entry saved successfully:', data);
      return data as SupabaseFoodEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase_food_entries'] });
      console.log('Food entry mutation completed successfully');
    },
    onError: (error) => {
      console.error('Food entry mutation error:', error);
    },
  });

  const saveComposedMealMutation = useMutation({
    mutationFn: async ({
      dateKey,
      displayName,
      mealType,
      lines,
    }: {
      dateKey: string;
      displayName: string;
      mealType: DbMealType;
      lines: Array<{
        foodId: number;
        foodName: string;
        grams: number;
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
      }>;
    }) => {
      if (!authState.userId) throw new Error('Not authenticated');
      if (lines.length === 0) throw new Error('No items in meal');

      const totals = lines.reduce(
        (a, l) => ({
          cal: a.cal + l.calories,
          p: a.p + l.protein,
          c: a.c + l.carbs,
          f: a.f + l.fat,
        }),
        { cal: 0, p: 0, c: 0, f: 0 }
      );

      const { data: mealRow, error: mealErr } = await supabase
        .from('logged_meals')
        .insert({
          user_id: authState.userId,
          date: dateKey,
          display_name: displayName,
          meal_type: mealType,
          calories: Math.round(totals.cal * 10) / 10,
          protein: Math.round(totals.p * 10) / 10,
          carbs: Math.round(totals.c * 10) / 10,
          fat: Math.round(totals.f * 10) / 10,
        })
        .select('id')
        .single();

      if (mealErr || !mealRow) {
        console.error('logged_meals insert:', mealErr);
        throw new Error(mealErr?.message || 'Failed to save meal');
      }

      const mealId = String(mealRow.id);

      const itemRows = lines.map((l, i) => ({
        logged_meal_id: mealId,
        food_id: l.foodId,
        food_name: l.foodName,
        grams: l.grams,
        calories: Math.round(l.calories * 10) / 10,
        protein: Math.round(l.protein * 10) / 10,
        carbs: Math.round(l.carbs * 10) / 10,
        fat: Math.round(l.fat * 10) / 10,
        sort_order: i,
      }));

      const { error: itemsErr } = await supabase.from('logged_meal_items').insert(itemRows);
      if (itemsErr) {
        await supabase.from('logged_meals').delete().eq('id', mealId);
        throw new Error(itemsErr.message);
      }

      const entryPayload = {
        user_id: authState.userId,
        date: dateKey,
        meal_type: mealType,
        food_name: displayName,
        calories: Math.round(totals.cal * 10) / 10,
        protein: Math.round(totals.p * 10) / 10,
        carbs: Math.round(totals.c * 10) / 10,
        fat: Math.round(totals.f * 10) / 10,
        sugar: 0,
        fiber: 0,
        sodium: 0,
        photo_uri: null as string | null,
        logged_meal_id: mealId,
      };

      const { error: entryErr } = await supabase.from('food_entries').insert(entryPayload);
      if (entryErr) {
        await supabase.from('logged_meals').delete().eq('id', mealId);
        throw new Error(entryErr.message);
      }

      return { mealId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase_food_entries'] });
    },
  });

  const deleteFoodEntryMutation = useMutation({
    mutationFn: async (entryId: string) => {
      if (!authState.userId) throw new Error('Not authenticated');
      
      console.log('Deleting food entry:', entryId);
      const { error } = await supabase
        .from('food_entries')
        .delete()
        .eq('id', entryId)
        .eq('user_id', authState.userId);
      
      if (error) {
        console.error('Error deleting food entry:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase_food_entries'] });
    },
  });

  const updateFoodEntryMutation = useMutation({
    mutationFn: async ({ entryId, updates }: { entryId: string; updates: Omit<FoodEntry, 'id' | 'timestamp'> }) => {
      if (!authState.userId) throw new Error('Not authenticated');
      
      console.log('Updating food entry:', entryId, updates);
      const patch: {
        food_name: string;
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
        photo_uri?: string | null;
      } = {
        food_name: updates.name,
        calories: updates.calories,
        protein: updates.protein,
        carbs: updates.carbs,
        fat: updates.fat,
      };
      if ('photoUri' in updates) {
        patch.photo_uri = await resolveMealPhotoForDatabase(updates.photoUri, authState.userId);
      }
      const { error } = await supabase
        .from('food_entries')
        .update(patch)
        .eq('id', entryId)
        .eq('user_id', authState.userId);
      
      if (error) {
        console.error('Error updating food entry:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase_food_entries'] });
    },
  });

  const saveWeightHistoryMutation = useMutation({
    mutationFn: async ({ dateKey, weight }: { dateKey: string; weight: number }) => {
      if (!authState.userId) throw new Error('Not authenticated');
      
      console.log('Saving weight to Supabase:', { dateKey, weight });
      const recordedAt = new Date(`${dateKey}T00:00:00.000Z`).toISOString();
      const utcDayStart = recordedAt;
      const utcNext = new Date(utcDayStart);
      utcNext.setUTCDate(utcNext.getUTCDate() + 1);
      const utcDayEnd = utcNext.toISOString();

      const [year, month, day] = dateKey.split('-').map(Number);
      const localDayStartDate = new Date(year, month - 1, day);
      localDayStartDate.setHours(0, 0, 0, 0);
      const localDayStart = localDayStartDate.toISOString();
      const localDayEndDate = new Date(localDayStartDate);
      localDayEndDate.setDate(localDayEndDate.getDate() + 1);
      const localDayEnd = localDayEndDate.toISOString();

      const { data: existingRowsUtc, error: selectUtcError } = await supabase
        .from('weight_history')
        .select('id, recorded_at')
        .eq('user_id', authState.userId)
        .gte('recorded_at', utcDayStart)
        .lt('recorded_at', utcDayEnd);

      if (selectUtcError) {
        console.error('Error checking existing weight row (UTC window):', selectUtcError);
        throw selectUtcError;
      }

      const { data: existingRowsLocal, error: selectLocalError } = await supabase
        .from('weight_history')
        .select('id, recorded_at')
        .eq('user_id', authState.userId)
        .gte('recorded_at', localDayStart)
        .lt('recorded_at', localDayEnd);

      if (selectLocalError) {
        console.error('Error checking existing weight row (local window):', selectLocalError);
        throw selectLocalError;
      }

      const merged = [...(existingRowsUtc || []), ...(existingRowsLocal || [])];
      const uniqueById = Array.from(new Map(merged.map((row: any) => [row.id, row])).values());
      const existingRow = uniqueById.sort((a: any, b: any) => b.recorded_at.localeCompare(a.recorded_at))[0];

      if (existingRow?.id) {
        const { error: updateError } = await supabase
          .from('weight_history')
          .update({ weight })
          .eq('id', existingRow.id)
          .eq('user_id', authState.userId);

        if (updateError) {
          console.error('Error updating existing weight row:', updateError);
          throw updateError;
        }

        if (uniqueById.length > 1) {
          const duplicateIds = uniqueById.filter((row: any) => row.id !== existingRow.id).map((row: any) => row.id);
          if (duplicateIds.length > 0) {
            const { error: deleteDupError } = await supabase
              .from('weight_history')
              .delete()
              .in('id', duplicateIds)
              .eq('user_id', authState.userId);
            if (deleteDupError) {
              console.error('Error deleting duplicate weight rows:', deleteDupError);
            }
          }
        }
      } else {
        const { error: insertError } = await supabase
          .from('weight_history')
          .insert({
            user_id: authState.userId,
            weight,
            recorded_at: recordedAt,
          });

        if (insertError) {
          console.error('Error inserting weight row:', insertError);
          throw insertError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase_weight_history'] });
    },
  });

  const deleteWeightHistoryMutation = useMutation({
    mutationFn: async (dateKey: string) => {
      if (!authState.userId) throw new Error('Not authenticated');
      const recordedAt = new Date(`${dateKey}T00:00:00.000Z`).toISOString();
      const utcDayStart = recordedAt;
      const utcNext = new Date(utcDayStart);
      utcNext.setUTCDate(utcNext.getUTCDate() + 1);
      const utcDayEnd = utcNext.toISOString();

      const [year, month, day] = dateKey.split('-').map(Number);
      const localDayStartDate = new Date(year, month - 1, day);
      localDayStartDate.setHours(0, 0, 0, 0);
      const localDayStart = localDayStartDate.toISOString();
      const localDayEndDate = new Date(localDayStartDate);
      localDayEndDate.setDate(localDayEndDate.getDate() + 1);
      const localDayEnd = localDayEndDate.toISOString();

      const { data: rowsUtc, error: selectUtcError } = await supabase
        .from('weight_history')
        .select('id')
        .eq('user_id', authState.userId)
        .gte('recorded_at', utcDayStart)
        .lt('recorded_at', utcDayEnd);

      if (selectUtcError) {
        console.error('Error selecting weight rows for deletion (UTC):', selectUtcError);
        throw selectUtcError;
      }

      const { data: rowsLocal, error: selectLocalError } = await supabase
        .from('weight_history')
        .select('id')
        .eq('user_id', authState.userId)
        .gte('recorded_at', localDayStart)
        .lt('recorded_at', localDayEnd);

      if (selectLocalError) {
        console.error('Error selecting weight rows for deletion (local):', selectLocalError);
        throw selectLocalError;
      }

      const mergedRows = [...(rowsUtc || []), ...(rowsLocal || [])];
      const ids = Array.from(new Set(mergedRows.map((row: any) => row.id)));

      if (ids.length === 0) return;

      const { error } = await supabase
        .from('weight_history')
        .delete()
        .eq('user_id', authState.userId)
        .in('id', ids);
      
      if (error) {
        console.error('Error deleting weight:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase_weight_history'] });
    },
  });

  const saveStreakMutation = useMutation({
    mutationFn: async (newStreak: StreakData) => {
      if (!authState.userId) {
        throw new Error('Not authenticated');
      }

      const payload = {
        user_id: authState.userId,
        current_streak: newStreak.currentStreak,
        best_streak: newStreak.bestStreak,
        last_logged_date: newStreak.lastLoggedDate || null,
        grace_used_week: newStreak.graceUsedThisWeek,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('streaks')
        .upsert(payload, {
          onConflict: 'user_id',
        })
        .select()
        .maybeSingle<SupabaseStreak>();

      if (error) {
        console.error('Error saving streak to Supabase:', error);
        throw error;
      }

      return newStreak;
    },
    onSuccess: (data) => {
      setStreakData(data);
      queryClient.setQueryData(['supabase_streak', authState.userId], data);
    },
  });

  const insertFavoriteMutation = useMutation({
    mutationFn: async (meal: Omit<FavoriteMeal, 'id' | 'createdAt' | 'logCount'>) => {
      if (!authState.userId) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('favorites')
        .insert({
          user_id: authState.userId,
          name: meal.name,
          calories: meal.calories,
          protein: meal.protein,
          carbs: meal.carbs,
          fat: meal.fat,
          log_count: 0,
        })
        .select('*')
        .single();
      if (error) throw error;
      return mapFavoriteRow(data as Record<string, unknown>);
    },
    onSuccess: (row) => {
      queryClient.setQueryData(
        ['nutrition_favorites', authState.userId],
        (old: FavoriteMeal[] | undefined) => [row, ...(old ?? []).filter((f) => f.id !== row.id)],
      );
    },
    onError: (e) => console.error('Insert favorite failed:', e),
  });

  const deleteFavoriteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!authState.userId) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('id', id)
        .eq('user_id', authState.userId);
      if (error) throw error;
      return id;
    },
    onSuccess: (removedId) => {
      queryClient.setQueryData(
        ['nutrition_favorites', authState.userId],
        (old: FavoriteMeal[] | undefined) => (old ?? []).filter((f) => f.id !== removedId),
      );
    },
    onError: (e) => console.error('Delete favorite failed:', e),
  });

  type FavoriteDbPatch = {
    name?: string;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    log_count?: number;
  };

  const patchFavoriteMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: FavoriteDbPatch }) => {
      if (!authState.userId) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('favorites')
        .update(patch)
        .eq('id', id)
        .eq('user_id', authState.userId)
        .select('*')
        .single();
      if (error) throw error;
      return mapFavoriteRow(data as Record<string, unknown>);
    },
    onSuccess: (row) => {
      queryClient.setQueryData(
        ['nutrition_favorites', authState.userId],
        (old: FavoriteMeal[] | undefined) => (old ?? []).map((f) => (f.id === row.id ? row : f)),
      );
    },
    onError: (e) => console.error('Update favorite failed:', e),
  });

  /** Full replace — only for reordering; avoids delete-all races on add/remove. */
  const replaceFavoritesMutation = useMutation({
    mutationFn: async (newFavorites: FavoriteMeal[]) => {
      if (!authState.userId) throw new Error('Not authenticated');
      const { error: deleteError } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', authState.userId);
      if (deleteError) throw deleteError;
      if (newFavorites.length > 0) {
        const payload = newFavorites.map((f) => ({
          user_id: authState.userId,
          name: f.name,
          calories: f.calories,
          protein: f.protein,
          carbs: f.carbs,
          fat: f.fat,
          log_count: Math.max(0, Math.round(f.logCount || 0)),
        }));
        const { error: insertError } = await supabase.from('favorites').insert(payload);
        if (insertError) throw insertError;
      }
      const { data, error } = await supabase
        .from('favorites')
        .select('*')
        .eq('user_id', authState.userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((f: any) => mapFavoriteRow(f)) as FavoriteMeal[];
    },
    onSuccess: (data) => {
      setFavorites(data);
      queryClient.setQueryData(['nutrition_favorites', authState.userId], data);
    },
    onError: (e) => console.error('Replace favorites failed:', e),
  });

  const saveWaterMutation = useMutation({
    mutationFn: async (newWater: { [date: string]: number }) => {
      if (!authState.userId) throw new Error('Not authenticated');
      const upserts = Object.entries(newWater).map(([date, cups]) => ({
        user_id: authState.userId,
        date,
        cups: Math.max(0, Math.round(cups)),
      }));
      if (upserts.length > 0) {
        const { error } = await supabase
          .from('water_tracking')
          .upsert(upserts, { onConflict: 'user_id,date' });
        if (error) throw error;
      }
      return newWater;
    },
    onSuccess: (data) => {
      setWaterCups(data);
      queryClient.setQueryData(['nutrition_water', authState.userId], data);
    },
  });

  const saveSugarMutation = useMutation({
    mutationFn: async (newData: { [date: string]: number }) => {
      if (!authState.userId) throw new Error('Not authenticated');
      const upserts = Object.entries(newData).map(([date, sugarUnitsValue]) => ({
        user_id: authState.userId,
        date,
        sugar_units: Math.max(0, Number(sugarUnitsValue || 0)),
      }));
      if (upserts.length > 0) {
        const { error } = await supabase
          .from('micronutrients_tracking')
          .upsert(upserts, { onConflict: 'user_id,date' });
        if (error) throw error;
      }
      return newData;
    },
    onSuccess: (data) => {
      setSugarUnits(data);
      queryClient.setQueryData(['nutrition_sugar', authState.userId], data);
    },
  });

  const saveFiberMutation = useMutation({
    mutationFn: async (newData: { [date: string]: number }) => {
      if (!authState.userId) throw new Error('Not authenticated');
      const upserts = Object.entries(newData).map(([date, fiberUnitsValue]) => ({
        user_id: authState.userId,
        date,
        fiber_units: Math.max(0, Number(fiberUnitsValue || 0)),
      }));
      if (upserts.length > 0) {
        const { error } = await supabase
          .from('micronutrients_tracking')
          .upsert(upserts, { onConflict: 'user_id,date' });
        if (error) throw error;
      }
      return newData;
    },
    onSuccess: (data) => {
      setFiberUnits(data);
      queryClient.setQueryData(['nutrition_fiber', authState.userId], data);
    },
  });

  const saveSodiumMutation = useMutation({
    mutationFn: async (newData: { [date: string]: number }) => {
      if (!authState.userId) throw new Error('Not authenticated');
      const upserts = Object.entries(newData).map(([date, sodiumUnitsValue]) => ({
        user_id: authState.userId,
        date,
        sodium_units: Math.max(0, Math.round(Number(sodiumUnitsValue || 0))),
      }));
      if (upserts.length > 0) {
        const { error } = await supabase
          .from('micronutrients_tracking')
          .upsert(upserts, { onConflict: 'user_id,date' });
        if (error) throw error;
      }
      return newData;
    },
    onSuccess: (data) => {
      setSodiumUnits(data);
      queryClient.setQueryData(['nutrition_sodium', authState.userId], data);
    },
  });

  const saveRecentMealsMutation = useMutation({
    mutationFn: async (newRecent: RecentMeal[]) => {
      if (!authState.userId) throw new Error('Not authenticated');
      const { error: deleteError } = await supabase
        .from('recent_meals')
        .delete()
        .eq('user_id', authState.userId);
      if (deleteError) throw deleteError;
      if (newRecent.length > 0) {
        const payload = newRecent.slice(0, 50).map((r) => ({
          user_id: authState.userId,
          name: r.name,
          calories: r.calories,
          protein: r.protein,
          carbs: r.carbs,
          fat: r.fat,
          log_count: Math.max(0, Math.round(r.logCount || 1)),
          last_logged_at: new Date(r.lastLogged).toISOString(),
        }));
        const { error: insertError } = await supabase.from('recent_meals').insert(payload);
        if (insertError) throw insertError;
      }
      const { data, error } = await supabase
        .from('recent_meals')
        .select('*')
        .eq('user_id', authState.userId)
        .order('last_logged_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        calories: Number(r.calories || 0),
        protein: Number(r.protein || 0),
        carbs: Number(r.carbs || 0),
        fat: Number(r.fat || 0),
        lastLogged: new Date(r.last_logged_at).getTime(),
        logCount: Number(r.log_count || 1),
      })) as RecentMeal[];
    },
    onSuccess: (data) => {
      setRecentMeals(data);
      queryClient.setQueryData(['nutrition_recent_meals', authState.userId], data);
    },
  });

  const updateStreak = (dateKey: string) => {
    const today = new Date();
    const todayKey = getTodayKey();

    // Normalize new log date
    const [year, month, day] = dateKey.split('-').map(Number);
    const logDate = new Date(year, month - 1, day);
    logDate.setHours(0, 0, 0, 0);

    let newStreak = { ...streakData };

    // If we've never logged before, start streak at this date (as long as it's not in the future)
    if (!newStreak.lastLoggedDate) {
      if (dateKey <= todayKey) {
        newStreak.currentStreak = 1;
        newStreak.lastLoggedDate = dateKey;
      }
    } else {
      const lastDateParts = newStreak.lastLoggedDate.split('-').map(Number);
      const lastLogDate = new Date(lastDateParts[0], lastDateParts[1] - 1, lastDateParts[2]);
      lastLogDate.setHours(0, 0, 0, 0);

      const diffDays = Math.round((logDate.getTime() - lastLogDate.getTime()) / (1000 * 60 * 60 * 24));

      // Ignore logs that are before the last logged date (backfilling earlier history)
      if (diffDays <= 0) {
        return;
      }

      if (diffDays === 1) {
        // Perfect consecutive day, extend streak
        newStreak.currentStreak = newStreak.currentStreak + 1;
        newStreak.lastLoggedDate = dateKey;
      } else if (diffDays === 2 && !newStreak.graceUsedThisWeek) {
        // One missed day, consume grace and still extend
        newStreak.currentStreak = newStreak.currentStreak + 1;
        newStreak.graceUsedThisWeek = true;
        newStreak.lastLoggedDate = dateKey;
      } else if (diffDays > 0) {
        // Bigger gap: start a new streak from this date
        newStreak.currentStreak = 1;
        newStreak.lastLoggedDate = dateKey;
      }

      // Weekly reset of grace flag based on calendar week
      const startOfWeek = new Date(today);
      startOfWeek.setHours(0, 0, 0, 0);
      startOfWeek.setDate(today.getDate() - today.getDay());
      if (lastLogDate < startOfWeek) {
        newStreak.graceUsedThisWeek = false;
      }
    }

    if (newStreak.currentStreak > newStreak.bestStreak) {
      newStreak.bestStreak = newStreak.currentStreak;
    }

    if (JSON.stringify(newStreak) !== JSON.stringify(streakData)) {
      saveStreakMutation.mutate(newStreak);
    }
  };

  const saveProfile = useCallback((newProfile: UserProfile) => {
    console.log('Saving profile:', newProfile);
    saveProfileMutation.mutate(newProfile);
    
    const todayKey = getTodayKey();
    const existingEntry = weightHistory.find(entry => entry.date === todayKey);
    
    if (!existingEntry && profile && newProfile.weight !== profile.weight) {
      saveWeightHistoryMutation.mutate({ dateKey: todayKey, weight: newProfile.weight });
    } else if (existingEntry && newProfile.weight !== existingEntry.weight) {
      saveWeightHistoryMutation.mutate({ dateKey: todayKey, weight: newProfile.weight });
    }
  }, [profile, weightHistory, saveProfileMutation, saveWeightHistoryMutation]);

  const updateRecentMeals = useCallback((entry: Omit<FoodEntry, 'id' | 'timestamp'>) => {
    const normalizedName = entry.name.toLowerCase().trim();
    const existingIndex = recentMeals.findIndex(
      m => m.name.toLowerCase().trim() === normalizedName
    );

    let updatedRecent: RecentMeal[];
    if (existingIndex >= 0) {
      const existing = recentMeals[existingIndex];
      updatedRecent = [
        { ...existing, lastLogged: Date.now(), logCount: existing.logCount + 1 },
        ...recentMeals.filter((_, i) => i !== existingIndex),
      ];
    } else {
      const newRecent: RecentMeal = {
        id: Date.now().toString(),
        name: entry.name,
        calories: entry.calories,
        protein: entry.protein,
        carbs: entry.carbs,
        fat: entry.fat,
        lastLogged: Date.now(),
        logCount: 1,
      };
      updatedRecent = [newRecent, ...recentMeals].slice(0, 50);
    }
    saveRecentMealsMutation.mutate(updatedRecent);
  }, [recentMeals, saveRecentMealsMutation]);

  const addFoodEntry = useCallback(async (entry: Omit<FoodEntry, 'id' | 'timestamp'>, autoPostToCommunity: boolean = true) => {
    console.log('[addFoodEntry] Adding entry:', entry);
    console.log('[addFoodEntry] Auth state:', authState);
    
    if (!authState.isSignedIn || !authState.userId) {
      console.error('[addFoodEntry] Cannot add food: User not authenticated');
      return false;
    }

    const premium = getPremiumWriteGate();
    const entryForStore: Omit<FoodEntry, 'id' | 'timestamp'> = premium
      ? entry
      : { ...entry, sugar: 0, fiber: 0, sodium: 0 };
    
    const logDateKey = selectedDate || getTodayKey();
    const optimisticId = `local-${Date.now()}`;
    const optimisticEntry: FoodEntry = {
      id: optimisticId,
      timestamp: Date.now(),
      ...entryForStore,
    };

    // Optimistic UI: show saved entry immediately in dashboard/log.
    setFoodLog((prev) => {
      const current = prev[logDateKey] || [];
      return {
        ...prev,
        [logDateKey]: [optimisticEntry, ...current],
      };
    });

    const savedOk = await new Promise<boolean>((resolve) => {
      saveFoodEntryMutation.mutate(
        { entry: entryForStore, dateKey: logDateKey },
        {
          onSuccess: (saved) => {
            const savedEntry = mapSupabaseFoodEntryToFoodEntry(saved);
            setFoodLog((prev) => {
              const current = prev[logDateKey] || [];
              const withoutOptimistic = current.filter((item) => item.id !== optimisticId);
              return {
                ...prev,
                [logDateKey]: [savedEntry, ...withoutOptimistic],
              };
            });
            updateStreak(logDateKey);
            updateRecentMeals(entryForStore);

            if (autoPostToCommunity) {
              const foodEntryForCommunity: Omit<FoodEntry, 'id' | 'timestamp'> = {
                ...entryForStore,
                photoUri: saved.photo_uri || undefined,
              };
              eventEmitter.emit('foodEntryAdded', {
                foodEntry: foodEntryForCommunity,
                timestamp: Date.now(),
              });
            }
            resolve(true);
          },
          onError: (error) => {
            console.error('[addFoodEntry] Save failed:', error);
            // Rollback optimistic item when remote save fails.
            setFoodLog((prev) => {
              const current = prev[logDateKey] || [];
              return {
                ...prev,
                [logDateKey]: current.filter((item) => item.id !== optimisticId),
              };
            });
            resolve(false);
          },
        }
      );
    });

    return savedOk;
  }, [saveFoodEntryMutation, authState, selectedDate, updateRecentMeals]);

  const addComposedMeal = useCallback(
    (
      payload: {
        displayName: string;
        mealType: DbMealType;
        lines: Array<{
          foodId: number;
          foodName: string;
          grams: number;
          calories: number;
          protein: number;
          carbs: number;
          fat: number;
        }>;
      },
      autoPostToCommunity: boolean = true
    ) => {
      if (!authState.isSignedIn || !authState.userId) {
        console.error('[addComposedMeal] Not authenticated');
        return;
      }

      const logDateKey = selectedDate || getTodayKey();
      const totals = payload.lines.reduce(
        (a, l) => ({
          calories: a.calories + l.calories,
          protein: a.protein + l.protein,
          carbs: a.carbs + l.carbs,
          fat: a.fat + l.fat,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );

      const entryForStore: Omit<FoodEntry, 'id' | 'timestamp'> = {
        name: payload.displayName,
        calories: Math.round(totals.calories),
        protein: Math.round(totals.protein),
        carbs: Math.round(totals.carbs),
        fat: Math.round(totals.fat),
        sugar: 0,
        fiber: 0,
        sodium: 0,
      };

      saveComposedMealMutation.mutate(
        {
          dateKey: logDateKey,
          displayName: payload.displayName,
          mealType: payload.mealType,
          lines: payload.lines,
        },
        {
          onSuccess: () => {
            updateStreak(logDateKey);
            updateRecentMeals(entryForStore);

            if (autoPostToCommunity) {
              eventEmitter.emit('foodEntryAdded', {
                foodEntry: entryForStore,
                timestamp: Date.now(),
              });
            }
          },
        }
      );
    },
    [saveComposedMealMutation, authState, selectedDate, updateRecentMeals]
  );

  const addToFavorites = useCallback((meal: Omit<FavoriteMeal, 'id' | 'createdAt' | 'logCount'>) => {
    const normalizedName = meal.name.toLowerCase().trim();
    const exists = favorites.some(f => f.name.toLowerCase().trim() === normalizedName);
    if (exists) return false;

    insertFavoriteMutation.mutate(meal);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    return true;
  }, [favorites, insertFavoriteMutation]);

  const removeFromFavorites = useCallback((favoriteId: string) => {
    deleteFavoriteMutation.mutate(favoriteId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [deleteFavoriteMutation]);

  const updateFavorite = useCallback(
    (favoriteId: string, updates: Partial<Omit<FavoriteMeal, 'id' | 'createdAt'>>) => {
      const patch: FavoriteDbPatch = {};
      if (updates.name !== undefined) patch.name = updates.name;
      if (updates.calories !== undefined) patch.calories = updates.calories;
      if (updates.protein !== undefined) patch.protein = updates.protein;
      if (updates.carbs !== undefined) patch.carbs = updates.carbs;
      if (updates.fat !== undefined) patch.fat = updates.fat;
      if (updates.logCount !== undefined) patch.log_count = updates.logCount;
      if (Object.keys(patch).length === 0) return;
      patchFavoriteMutation.mutate({ id: favoriteId, patch });
    },
    [patchFavoriteMutation],
  );

  const reorderFavorites = useCallback(
    (newOrder: FavoriteMeal[]) => {
      replaceFavoritesMutation.mutate(newOrder);
    },
    [replaceFavoritesMutation],
  );

  const isFavorite = useCallback((mealName: string) => {
    const normalizedName = mealName.toLowerCase().trim();
    return favorites.some(f => f.name.toLowerCase().trim() === normalizedName);
  }, [favorites]);

  const logFromFavorite = useCallback(
    (favoriteId: string) => {
      const favorite = favorites.find(f => f.id === favoriteId);
      if (!favorite) return;

      addFoodEntry({
        name: favorite.name,
        calories: favorite.calories,
        protein: favorite.protein,
        carbs: favorite.carbs,
        fat: favorite.fat,
      });

      patchFavoriteMutation.mutate({
        id: favoriteId,
        patch: { log_count: Math.max(0, favorite.logCount + 1) },
      });
    },
    [favorites, addFoodEntry, patchFavoriteMutation],
  );

  const logFromRecent = useCallback((recentId: string) => {
    const recent = recentMeals.find(r => r.id === recentId);
    if (!recent) return;

    addFoodEntry({
      name: recent.name,
      calories: recent.calories,
      protein: recent.protein,
      carbs: recent.carbs,
      fat: recent.fat,
    });
  }, [recentMeals, addFoodEntry]);

  const { mutate: mutateRecentMeals } = saveRecentMealsMutation;

  const signIn = useCallback(async (email: string, password: string) => {
    console.log('Signing in user:', email);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      console.error('Sign in error:', error);
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('INVALID_CREDENTIALS');
      }
      throw error;
    }
    
    console.log('Sign in successful:', data.user?.email);
    return data;
  }, []);

  const signUp = useCallback(async (email: string, password: string, profileData?: Partial<UserProfile> & { birthDate?: Date }) => {
    console.log('Signing up user:', email);
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: profileData?.name || null,
          gender: profileData?.sex || null,
          height: profileData?.height || null,
          weight: profileData?.weight || null,
          target_weight: profileData?.goalWeight || null,
          activity_level: profileData?.activityLevel || null,
          goal: profileData?.goal || null,
        },
      },
    });
    
    if (error) {
      console.error('Sign up error:', error.message, error);
      throw error;
    }

    console.log('Sign up response:', { user: data.user?.id, session: !!data.session });
    
    if (!data.user) {
      throw new Error('No user returned from sign up');
    }

    // Check if we have a session (email confirmation disabled) or not (email confirmation enabled)
    if (data.session && profileData) {
      // User is immediately authenticated, create profile
      console.log('Session available, creating profile...');
      
      // Calculate birth_date from birthDate or age
      let birthDateStr: string | null = null;
      if (profileData.birthDate) {
        birthDateStr = profileData.birthDate.toISOString().split('T')[0];
      } else if (profileData.age) {
        const birthDate = new Date();
        birthDate.setFullYear(birthDate.getFullYear() - profileData.age);
        birthDateStr = birthDate.toISOString().split('T')[0];
      }
      
      // Calculate targets for the new profile
      const newProfileForCalc: UserProfile = {
        name: profileData.name,
        age: profileData.age || 25,
        sex: profileData.sex || 'male',
        height: profileData.height || 170,
        weight: profileData.weight || 70,
        goalWeight: profileData.goalWeight || profileData.weight || 70,
        goal: profileData.goal || 'maintenance',
        activityLevel: profileData.activityLevel || 'moderate',
        weeklyWeightChange: profileData.weeklyWeightChange,
      };
      const calculatedTargets = calculateDailyTargets(newProfileForCalc);
      console.log('Calculated targets for new user:', calculatedTargets, 'birthDate:', birthDateStr);
      
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: data.user.id,
          email: email,
          name: profileData.name || null,
          gender: profileData.sex || null,
          birth_date: birthDateStr,
          height: profileData.height || null,
          weight: profileData.weight || null,
          target_weight: profileData.goalWeight || null,
          activity_level: profileData.activityLevel || null,
          goal: profileData.goal || null,
          weekly_weight_change: profileData.weeklyWeightChange ?? null,
          daily_calories: calculatedTargets.calories,
          protein_target: calculatedTargets.protein,
          carbs_target: Math.round((calculatedTargets.carbsMin + calculatedTargets.carbsMax) / 2),
          fat_target: Math.round((calculatedTargets.fatMin + calculatedTargets.fatMax) / 2),
        });
      
      if (profileError) {
        console.error('Error creating profile:', profileError.message, profileError);
        // Don't throw here, user is created but profile failed - can retry later
      } else {
        console.log('Profile created successfully');
        // Set the profile locally immediately so we don't wait for query
        const newProfile: UserProfile = {
          name: profileData.name,
          age: profileData.age || 25,
          sex: profileData.sex || 'male',
          height: profileData.height || 170,
          weight: profileData.weight || 70,
          goalWeight: profileData.goalWeight || profileData.weight || 70,
          goal: profileData.goal || 'maintenance',
          activityLevel: profileData.activityLevel || 'moderate',
          weeklyWeightChange: profileData.weeklyWeightChange,
        };
        setProfile(newProfile);
        // Also invalidate queries to refresh from server
        queryClient.invalidateQueries({ queryKey: ['supabase_profile'] });
      }
    } else if (!data.session) {
      // Email confirmation is required - but user trigger should create empty profile
      console.log('Email confirmation required or user already exists. Check your email.');
    }
    
    console.log('Sign up successful:', data.user?.email);
    return data;
  }, [queryClient]);

  const signOut = useCallback(async () => {
    console.log('Signing out user');
    setExpectUserInitiatedSignOut(true);
    try {
      await supabase.auth.signOut();
    } catch (e) {
      setExpectUserInitiatedSignOut(false);
      console.error('signOut failed:', e);
      return;
    }
    setProfile(null);
    setFoodLog({});
    setWeightHistory([]);
    setStreakData({
      currentStreak: 0,
      bestStreak: 0,
      lastLoggedDate: '',
      graceUsedThisWeek: false,
    });
    setFavorites([]);
    setRecentMeals([]);
    queryClient.clear();
    setTimeout(() => {
      clearExpectUserInitiatedSignOut();
      router.replace('/onboarding');
    }, 100);
  }, [queryClient]);

  /** After server-side account deletion, Supabase signOut may fail — still clear local session. */
  const signOutAfterAccountDeleted = useCallback(async () => {
    setExpectUserInitiatedSignOut(true);
    try {
      await supabase.auth.signOut();
    } catch {
      // User may already be removed server-side
    }
    setProfile(null);
    setFoodLog({});
    setWeightHistory([]);
    setStreakData({
      currentStreak: 0,
      bestStreak: 0,
      lastLoggedDate: '',
      graceUsedThisWeek: false,
    });
    setFavorites([]);
    setRecentMeals([]);
    queryClient.clear();
    setTimeout(() => {
      clearExpectUserInitiatedSignOut();
      router.replace('/onboarding');
    }, 100);
  }, [queryClient]);

  const addWaterCup = useCallback(() => {
    if (!getPremiumWriteGate()) return;
    const dateKey = selectedDate || getTodayKey();
    const current = waterCups[dateKey] || 0;
    const updated = { ...waterCups, [dateKey]: current + 1 };
    saveWaterMutation.mutate(updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [waterCups, saveWaterMutation, selectedDate]);

  const removeWaterCup = useCallback(() => {
    if (!getPremiumWriteGate()) return;
    const dateKey = selectedDate || getTodayKey();
    const current = waterCups[dateKey] || 0;
    if (current <= 0) return;
    const updated = { ...waterCups, [dateKey]: current - 1 };
    saveWaterMutation.mutate(updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [waterCups, saveWaterMutation, selectedDate]);

  const getTodayWaterCups = useCallback(() => {
    return waterCups[selectedDate] || 0;
  }, [waterCups, selectedDate]);

  const addSugarUnit = useCallback((amount: number = 1) => {
    if (!getPremiumWriteGate()) return;
    const dateKey = selectedDate || getTodayKey();
    const current = sugarUnits[dateKey] || 0;
    const updated = { ...sugarUnits, [dateKey]: Math.round((current + amount) * 10) / 10 };
    saveSugarMutation.mutate(updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [sugarUnits, saveSugarMutation, selectedDate]);

  const removeSugarUnit = useCallback(() => {
    if (!getPremiumWriteGate()) return;
    const dateKey = selectedDate || getTodayKey();
    const current = sugarUnits[dateKey] || 0;
    if (current <= 0) return;
    const updated = { ...sugarUnits, [dateKey]: current - 1 };
    saveSugarMutation.mutate(updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [sugarUnits, saveSugarMutation, selectedDate]);

  const getTodaySugarUnits = useCallback(() => {
    return sugarUnits[selectedDate] || 0;
  }, [sugarUnits, selectedDate]);

  const addFiberUnit = useCallback((amount: number = 1) => {
    if (!getPremiumWriteGate()) return;
    const dateKey = selectedDate || getTodayKey();
    const current = fiberUnits[dateKey] || 0;
    const updated = { ...fiberUnits, [dateKey]: Math.round((current + amount) * 10) / 10 };
    saveFiberMutation.mutate(updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [fiberUnits, saveFiberMutation, selectedDate]);

  const removeFiberUnit = useCallback(() => {
    if (!getPremiumWriteGate()) return;
    const dateKey = selectedDate || getTodayKey();
    const current = fiberUnits[dateKey] || 0;
    if (current <= 0) return;
    const updated = { ...fiberUnits, [dateKey]: current - 1 };
    saveFiberMutation.mutate(updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [fiberUnits, saveFiberMutation, selectedDate]);

  const getTodayFiberUnits = useCallback(() => {
    return fiberUnits[selectedDate] || 0;
  }, [fiberUnits, selectedDate]);

  const addSodiumUnit = useCallback((amount: number = 1) => {
    if (!getPremiumWriteGate()) return;
    const dateKey = selectedDate || getTodayKey();
    const current = sodiumUnits[dateKey] || 0;
    const updated = { ...sodiumUnits, [dateKey]: Math.round(current + amount) };
    saveSodiumMutation.mutate(updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [sodiumUnits, saveSodiumMutation, selectedDate]);

  const removeSodiumUnit = useCallback(() => {
    if (!getPremiumWriteGate()) return;
    const dateKey = selectedDate || getTodayKey();
    const current = sodiumUnits[dateKey] || 0;
    if (current <= 0) return;
    const updated = { ...sodiumUnits, [dateKey]: current - 1 };
    saveSodiumMutation.mutate(updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [sodiumUnits, saveSodiumMutation, selectedDate]);

  const getTodaySodiumUnits = useCallback(() => {
    return sodiumUnits[selectedDate] || 0;
  }, [sodiumUnits, selectedDate]);

  const removeFromRecent = useCallback((recentId: string) => {
    const updatedRecent = recentMeals.filter(r => r.id !== recentId);
    mutateRecentMeals(updatedRecent);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [recentMeals, mutateRecentMeals]);

  const addWeightEntry = useCallback((dateKey: string, weight: number) => {
    console.log('Adding weight entry:', { dateKey, weight });
    saveWeightHistoryMutation.mutate({ dateKey, weight });
    
    const latestDateKey = weightHistory.length > 0
      ? [...weightHistory].sort((a, b) => a.date.localeCompare(b.date))[weightHistory.length - 1].date
      : null;
    const shouldAffectCurrentWeight = !latestDateKey || dateKey >= latestDateKey;

    if (profile && shouldAffectCurrentWeight) {
      const updatedProfile = { ...profile, weight };
      saveProfileMutation.mutate(updatedProfile);
    }
  }, [saveWeightHistoryMutation, profile, saveProfileMutation]);

  const updateWeightEntry = useCallback((dateKey: string, newWeight: number) => {
    console.log('Updating weight entry:', { dateKey, newWeight });
    saveWeightHistoryMutation.mutate({ dateKey, weight: newWeight });
    
    const latestEntry = [...weightHistory].sort((a, b) => b.date.localeCompare(a.date))[0];
    
    if (profile && latestEntry && latestEntry.date === dateKey) {
      const updatedProfile = { ...profile, weight: newWeight };
      saveProfileMutation.mutate(updatedProfile);
    }
  }, [weightHistory, saveWeightHistoryMutation, profile, saveProfileMutation]);

  const deleteWeightEntry = useCallback((dateKey: string) => {
    console.log('Deleting weight entry:', { dateKey });
    deleteWeightHistoryMutation.mutate(dateKey);
    
    const updatedHistory = weightHistory.filter(entry => entry.date !== dateKey);
    if (updatedHistory.length > 0 && profile) {
      const sortedHistory = [...updatedHistory].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const latestEntry = sortedHistory[0];
      if (latestEntry.weight !== profile.weight) {
        const updatedProfile = { ...profile, weight: latestEntry.weight };
        saveProfileMutation.mutate(updatedProfile);
      }
    }
  }, [weightHistory, deleteWeightHistoryMutation, profile, saveProfileMutation]);

  const shouldSuggestFavorite = useCallback((mealName: string): boolean => {
    const normalizedName = mealName.toLowerCase().trim();
    if (favorites.some(f => f.name.toLowerCase().trim() === normalizedName)) {
      return false;
    }
    const recent = recentMeals.find(r => r.name.toLowerCase().trim() === normalizedName);
    return recent ? recent.logCount >= 3 : false;
  }, [favorites, recentMeals]);

  const addPendingEntry = useCallback((photoUri: string, base64: string) => {
    const newPending: PendingFoodEntry = {
      id: Date.now().toString(),
      photoUri,
      base64,
      timestamp: Date.now(),
      status: 'analyzing',
    };
    setPendingEntries(prev => [...prev, newPending]);

    const persistPhoto = () => {
      saveImagePermanently(photoUri)
        .then((permanentUri) => {
          setPendingEntries(prev =>
            prev.map(entry =>
              entry.id === newPending.id
                ? { ...entry, permanentPhotoUri: permanentUri }
                : entry
            )
          );
        })
        .catch((error) => {
          console.error('Error saving image:', error);
        });
    };

    analyzeMealPhoto(base64, { userId: authState.userId, language })
      .then((analysis) => {
        setPendingEntries(prev =>
          prev.map(entry =>
            entry.id === newPending.id
              ? { ...entry, status: 'done' as const, analysis }
              : entry
          )
        );
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      })
      .catch((error) => {
        const raw = error instanceof Error && error.message ? error.message : 'Gagal menganalisis foto';
        const message = mapScanErrorToUserMessage(raw, language);
        console.warn('Photo analysis error:', { raw, message });
        setPendingEntries(prev =>
          prev.map(entry =>
            entry.id === newPending.id
              ? { ...entry, status: 'error' as const, error: message }
              : entry
          )
        );
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      })
      .finally(persistPhoto);

    return newPending.id;
  }, [authState.userId, language]);

  const confirmPendingEntry = useCallback((pendingId: string, servings: number = 1) => {
    const pending = pendingEntries.find(p => p.id === pendingId);
    if (!pending || pending.status !== 'done' || !pending.analysis) return;

    const analysis = pending.analysis;
    const avgCalories = Math.round((analysis.totalCaloriesMin + analysis.totalCaloriesMax) / 2) * servings;
    const avgProtein = Math.round((analysis.totalProteinMin + analysis.totalProteinMax) / 2) * servings;
    const avgCarbs = analysis.items.reduce((sum, item) => sum + (item.carbsMin + item.carbsMax) / 2, 0) * servings;
    const avgFat = analysis.items.reduce((sum, item) => sum + (item.fatMin + item.fatMax) / 2, 0) * servings;
    const foodNames = analysis.items.map(item => item.name).join(', ');
    const micros = sumMidpointMicrosFromItems(analysis.items, servings);

    addFoodEntry({
      name: foodNames,
      calories: Math.round(avgCalories),
      protein: Math.round(avgProtein),
      carbs: Math.round(avgCarbs),
      fat: Math.round(avgFat),
      sugar: micros.sugar,
      fiber: micros.fiber,
      sodium: micros.sodium,
      photoUri: pending.permanentPhotoUri || pending.photoUri,
    });

    setPendingEntries(prev => prev.filter(p => p.id !== pendingId));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [pendingEntries, addFoodEntry]);

  const removePendingEntry = useCallback((pendingId: string) => {
    setPendingEntries(prev => prev.filter(p => p.id !== pendingId));
  }, []);

  const retryPendingEntry = useCallback((pendingId: string) => {
    const pending = pendingEntries.find(p => p.id === pendingId);
    if (!pending) return;

    setPendingEntries(prev =>
      prev.map(entry =>
        entry.id === pendingId
          ? { ...entry, status: 'analyzing' as const, error: undefined }
          : entry
      )
    );

    analyzeMealPhoto(pending.base64, { userId: authState.userId, language })
      .then((analysis) => {
        setPendingEntries(prev =>
          prev.map(entry =>
            entry.id === pendingId
              ? { ...entry, status: 'done' as const, analysis }
              : entry
          )
        );
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      })
      .catch((error) => {
        const raw = error instanceof Error && error.message ? error.message : 'Gagal menganalisis foto';
        const message = mapScanErrorToUserMessage(raw, language);
        console.warn('Photo analysis error:', { raw, message });
        setPendingEntries(prev =>
          prev.map(entry =>
            entry.id === pendingId
              ? { ...entry, status: 'error' as const, error: message }
              : entry
          )
        );
      });
  }, [pendingEntries, authState.userId, language]);

  const deleteFoodEntry = useCallback((entryId: string) => {
    const dateKey = selectedDate || getTodayKey();
    const previousEntries = foodLog[dateKey] || [];
    const target = previousEntries.find((entry) => entry.id === entryId);
    if (!target) return;

    // Optimistic UI: remove immediately from dashboard/log.
    setFoodLog((prev) => ({
      ...prev,
      [dateKey]: (prev[dateKey] || []).filter((entry) => entry.id !== entryId),
    }));

    // Local-only optimistic item, no remote delete required.
    if (entryId.startsWith('local-')) {
      return;
    }

    deleteFoodEntryMutation.mutate(entryId, {
      onError: (error) => {
        console.error('[deleteFoodEntry] Delete failed, restoring local entry:', error);
        setFoodLog((prev) => ({
          ...prev,
          [dateKey]: [target, ...(prev[dateKey] || [])],
        }));
      },
    });
  }, [deleteFoodEntryMutation, selectedDate, foodLog]);

  const updateFoodEntry = useCallback((entryId: string, updates: Omit<FoodEntry, 'id' | 'timestamp'>) => {
    updateFoodEntryMutation.mutate({ entryId, updates });
  }, [updateFoodEntryMutation]);

  const referralTrialEndsAt = profileQuery.data?.referral_trial_ends_at ?? null;

  const dailyTargets: DailyTargets | null = useMemo(() => {
    if (!profile) {
      console.log('No profile, cannot calculate dailyTargets');
      return null;
    }
    const targets = calculateDailyTargets(profile);
    console.log('Daily targets calculated:', targets);
    return targets;
  }, [profile]);

  const todayEntries = useMemo(() => {
    return foodLog[selectedDate] || [];
  }, [foodLog, selectedDate]);

  const todayTotals = useMemo(() => {
    return todayEntries.reduce(
      (acc, entry) => ({
        calories: acc.calories + entry.calories,
        protein: acc.protein + entry.protein,
        carbs: acc.carbs + entry.carbs,
        fat: acc.fat + entry.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [todayEntries]);

  const clearAllData = useCallback(async () => {
    try {
      setExpectUserInitiatedSignOut(true);
      try {
        await supabase.auth.signOut();
      } catch {
        setExpectUserInitiatedSignOut(false);
        throw new Error('signOut failed');
      }
      setProfile(null);
      setFoodLog({});
      setWeightHistory([]);
      setStreakData({
        currentStreak: 0,
        bestStreak: 0,
        lastLoggedDate: '',
        graceUsedThisWeek: false,
      });
      setFavorites([]);
      setRecentMeals([]);
      queryClient.clear();
      clearExpectUserInitiatedSignOut();
      console.log('All data cleared');
    } catch (error) {
      console.error('Error clearing data:', error);
    }
  }, [queryClient]);

  return {
    profile,
    referralTrialEndsAt,
    saveProfile,
    dailyTargets,
    todayEntries,
    todayTotals,
    foodLog,
    weightHistory,
    addFoodEntry,
    addComposedMeal,
    updateFoodEntry,
    deleteFoodEntry,
    streakData,
    selectedDate,
    setSelectedDate,
    pendingEntries,
    addPendingEntry,
    confirmPendingEntry,
    removePendingEntry,
    retryPendingEntry,
    favorites,
    recentMeals,
    addToFavorites,
    removeFromFavorites,
    updateFavorite,
    reorderFavorites,
    isFavorite,
    logFromFavorite,
    logFromRecent,
    removeFromRecent,
    shouldSuggestFavorite,
    addWaterCup,
    removeWaterCup,
    getTodayWaterCups,
    waterCups,
    addSugarUnit,
    removeSugarUnit,
    getTodaySugarUnits,
    sugarUnits,
    addFiberUnit,
    removeFiberUnit,
    getTodayFiberUnits,
    fiberUnits,
    addSodiumUnit,
    removeSodiumUnit,
    getTodaySodiumUnits,
    sodiumUnits,
    addWeightEntry,
    authState,
    authInitialized,
    signIn,
    signUp,
    signOut,
    signOutAfterAccountDeleted,
    updateWeightEntry,
    deleteWeightEntry,
    clearAllData,
    isLoading: profileQuery.isLoading || foodEntriesQuery.isLoading || weightHistoryQuery.isLoading || streakQuery.isLoading || favoritesQuery.isLoading || recentMealsQuery.isLoading || waterQuery.isLoading || sugarQuery.isLoading || fiberQuery.isLoading || sodiumQuery.isLoading,
    isSaving:
      saveProfileMutation.isPending ||
      saveFoodEntryMutation.isPending ||
      saveComposedMealMutation.isPending ||
      saveWeightHistoryMutation.isPending ||
      insertFavoriteMutation.isPending ||
      deleteFavoriteMutation.isPending ||
      patchFavoriteMutation.isPending ||
      replaceFavoritesMutation.isPending ||
      saveRecentMealsMutation.isPending,
  };
});

export function useTodayProgress() {
  const { dailyTargets, todayTotals } = useNutrition();

  return useMemo(() => {
    if (!dailyTargets) return null;

    const caloriesRemaining = dailyTargets.calories - todayTotals.calories;
    const proteinRemaining = dailyTargets.protein - todayTotals.protein;
    const caloriesProgress = (todayTotals.calories / dailyTargets.calories) * 100;
    const proteinProgress = (todayTotals.protein / dailyTargets.protein) * 100;

    const isOnTrack = caloriesRemaining >= 0 && caloriesRemaining < dailyTargets.calories * 0.2;
    const isOver = caloriesRemaining < 0;
    const strongProtein = proteinProgress >= 90;

    return {
      caloriesRemaining,
      proteinRemaining,
      caloriesProgress,
      proteinProgress,
      isOnTrack,
      isOver,
      strongProtein,
    };
  }, [dailyTargets, todayTotals]);
}
