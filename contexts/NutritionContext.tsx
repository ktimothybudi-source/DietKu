import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { UserProfile, FoodEntry, DailyTargets, MealAnalysis, FavoriteMeal, RecentMeal } from '@/types/nutrition';
import { calculateDailyTargets, getTodayKey } from '@/utils/nutritionCalculations';
import { analyzeMealPhoto } from '@/utils/photoAnalysis';
import * as Haptics from 'expo-haptics';

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

const AUTH_KEY = 'nutrition_auth';

interface AuthState {
  isSignedIn: boolean;
  email: string | null;
}

const getStorageKey = (baseKey: string, email: string | null) => {
  if (!email) return baseKey;
  const sanitizedEmail = email.replace(/[^a-zA-Z0-9]/g, '_');
  return `${baseKey}_${sanitizedEmail}`;
};

export interface PendingFoodEntry {
  id: string;
  photoUri: string;
  base64: string;
  timestamp: number;
  status: 'analyzing' | 'done' | 'error';
  analysis?: MealAnalysis;
  error?: string;
}

const BASE_PROFILE_KEY = 'nutrition_profile';
const BASE_FOOD_LOG_KEY = 'nutrition_food_log';
const BASE_STREAK_KEY = 'nutrition_streak';
const BASE_WEIGHT_HISTORY_KEY = 'nutrition_weight_history';
const BASE_FAVORITES_KEY = 'nutrition_favorites';
const BASE_RECENT_MEALS_KEY = 'nutrition_recent_meals';

export const [NutritionProvider, useNutrition] = createContextHook(() => {
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
  const [authState, setAuthState] = useState<AuthState>({ isSignedIn: false, email: null });
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  const authQuery = useQuery({
    queryKey: ['nutrition_auth'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(AUTH_KEY);
      console.log('Auth state loaded from storage:', stored);
      return stored ? JSON.parse(stored) : { isSignedIn: false, email: null };
    },
  });

  useEffect(() => {
    if (authQuery.data !== undefined) {
      setAuthState(authQuery.data);
      setCurrentUserEmail(authQuery.data.email);
      console.log('Auth loaded, current user email:', authQuery.data.email);
    }
  }, [authQuery.data]);

  const profileQuery = useQuery({
    queryKey: ['nutrition_profile', currentUserEmail],
    queryFn: async () => {
      const key = getStorageKey(BASE_PROFILE_KEY, currentUserEmail);
      const stored = await AsyncStorage.getItem(key);
      console.log('Profile loaded from storage for user:', currentUserEmail, stored);
      return stored ? JSON.parse(stored) : null;
    },
    enabled: authQuery.isSuccess,
  });

  const foodLogQuery = useQuery({
    queryKey: ['nutrition_food_log', currentUserEmail],
    queryFn: async () => {
      const key = getStorageKey(BASE_FOOD_LOG_KEY, currentUserEmail);
      const stored = await AsyncStorage.getItem(key);
      console.log('Food log loaded for user:', currentUserEmail);
      return stored ? JSON.parse(stored) : {};
    },
    enabled: authQuery.isSuccess,
  });

  const streakQuery = useQuery({
    queryKey: ['nutrition_streak', currentUserEmail],
    queryFn: async () => {
      const key = getStorageKey(BASE_STREAK_KEY, currentUserEmail);
      const stored = await AsyncStorage.getItem(key);
      return stored ? JSON.parse(stored) : {
        currentStreak: 0,
        bestStreak: 0,
        lastLoggedDate: '',
        graceUsedThisWeek: false,
      };
    },
    enabled: authQuery.isSuccess,
  });

  const weightHistoryQuery = useQuery({
    queryKey: ['nutrition_weight_history', currentUserEmail],
    queryFn: async () => {
      const key = getStorageKey(BASE_WEIGHT_HISTORY_KEY, currentUserEmail);
      const stored = await AsyncStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    },
    enabled: authQuery.isSuccess,
  });

  const favoritesQuery = useQuery({
    queryKey: ['nutrition_favorites', currentUserEmail],
    queryFn: async () => {
      const key = getStorageKey(BASE_FAVORITES_KEY, currentUserEmail);
      const stored = await AsyncStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    },
    enabled: authQuery.isSuccess,
  });

  const recentMealsQuery = useQuery({
    queryKey: ['nutrition_recent_meals', currentUserEmail],
    queryFn: async () => {
      const key = getStorageKey(BASE_RECENT_MEALS_KEY, currentUserEmail);
      const stored = await AsyncStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    },
    enabled: authQuery.isSuccess,
  });

  const saveProfileMutation = useMutation({
    mutationFn: async (newProfile: UserProfile) => {
      const key = getStorageKey(BASE_PROFILE_KEY, currentUserEmail);
      await AsyncStorage.setItem(key, JSON.stringify(newProfile));
      console.log('Profile saved to storage for user:', currentUserEmail, newProfile);
      return newProfile;
    },
    onSuccess: (data) => {
      setProfile(data);
      queryClient.setQueryData(['nutrition_profile', currentUserEmail], data);
      console.log('Profile state updated, dailyTargets will recalculate');
    },
  });

  const saveFoodLogMutation = useMutation({
    mutationFn: async (newLog: FoodLog) => {
      const key = getStorageKey(BASE_FOOD_LOG_KEY, currentUserEmail);
      await AsyncStorage.setItem(key, JSON.stringify(newLog));
      return newLog;
    },
    onSuccess: (data) => {
      setFoodLog(data);
      queryClient.setQueryData(['nutrition_food_log', currentUserEmail], data);
    },
  });

  const saveStreakMutation = useMutation({
    mutationFn: async (newStreak: StreakData) => {
      const key = getStorageKey(BASE_STREAK_KEY, currentUserEmail);
      await AsyncStorage.setItem(key, JSON.stringify(newStreak));
      return newStreak;
    },
    onSuccess: (data) => {
      setStreakData(data);
      queryClient.setQueryData(['nutrition_streak', currentUserEmail], data);
    },
  });

  const saveWeightHistoryMutation = useMutation({
    mutationFn: async (newHistory: WeightEntry[]) => {
      const key = getStorageKey(BASE_WEIGHT_HISTORY_KEY, currentUserEmail);
      await AsyncStorage.setItem(key, JSON.stringify(newHistory));
      return newHistory;
    },
    onSuccess: (data) => {
      setWeightHistory(data);
      queryClient.setQueryData(['nutrition_weight_history', currentUserEmail], data);
    },
  });

  const saveFavoritesMutation = useMutation({
    mutationFn: async (newFavorites: FavoriteMeal[]) => {
      const key = getStorageKey(BASE_FAVORITES_KEY, currentUserEmail);
      await AsyncStorage.setItem(key, JSON.stringify(newFavorites));
      return newFavorites;
    },
    onSuccess: (data) => {
      setFavorites(data);
      queryClient.setQueryData(['nutrition_favorites', currentUserEmail], data);
    },
  });

  const saveRecentMealsMutation = useMutation({
    mutationFn: async (newRecent: RecentMeal[]) => {
      const key = getStorageKey(BASE_RECENT_MEALS_KEY, currentUserEmail);
      await AsyncStorage.setItem(key, JSON.stringify(newRecent));
      return newRecent;
    },
    onSuccess: (data) => {
      setRecentMeals(data);
      queryClient.setQueryData(['nutrition_recent_meals', currentUserEmail], data);
    },
  });

  const saveAuthMutation = useMutation({
    mutationFn: async (newAuth: AuthState) => {
      await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(newAuth));
      console.log('Auth state saved to storage:', newAuth);
      return newAuth;
    },
    onSuccess: (data) => {
      setAuthState(data);
      setCurrentUserEmail(data.email);
      queryClient.setQueryData(['nutrition_auth'], data);
      queryClient.invalidateQueries({ queryKey: ['nutrition_profile'] });
      queryClient.invalidateQueries({ queryKey: ['nutrition_food_log'] });
      queryClient.invalidateQueries({ queryKey: ['nutrition_streak'] });
      queryClient.invalidateQueries({ queryKey: ['nutrition_weight_history'] });
      queryClient.invalidateQueries({ queryKey: ['nutrition_favorites'] });
      queryClient.invalidateQueries({ queryKey: ['nutrition_recent_meals'] });
      console.log('Auth updated, invalidated all user-specific queries for:', data.email);
    },
  });

  useEffect(() => {
    if (profileQuery.data !== undefined) {
      setProfile(profileQuery.data);
    }
  }, [profileQuery.data]);

  useEffect(() => {
    if (foodLogQuery.data !== undefined) {
      setFoodLog(foodLogQuery.data);
    }
  }, [foodLogQuery.data]);

  useEffect(() => {
    if (streakQuery.data !== undefined) {
      setStreakData(streakQuery.data);
    }
  }, [streakQuery.data]);

  useEffect(() => {
    if (weightHistoryQuery.data !== undefined) {
      setWeightHistory(weightHistoryQuery.data);
    }
  }, [weightHistoryQuery.data]);

  useEffect(() => {
    if (favoritesQuery.data !== undefined) {
      setFavorites(favoritesQuery.data);
    }
  }, [favoritesQuery.data]);

  useEffect(() => {
    if (recentMealsQuery.data !== undefined) {
      setRecentMeals(recentMealsQuery.data);
    }
  }, [recentMealsQuery.data]);



  const updateStreak = (dateKey: string) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    
    const daysSinceLastLog = streakData.lastLoggedDate ? 
      Math.floor((today.getTime() - new Date(streakData.lastLoggedDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;

    let newStreak = { ...streakData };

    if (dateKey === streakData.lastLoggedDate) {
      return;
    }

    if (streakData.lastLoggedDate === '') {
      newStreak.currentStreak = 1;
      newStreak.lastLoggedDate = dateKey;
    } else if (streakData.lastLoggedDate === yesterdayKey) {
      newStreak.currentStreak = streakData.currentStreak + 1;
      newStreak.lastLoggedDate = dateKey;
    } else if (daysSinceLastLog === 1) {
      newStreak.currentStreak = streakData.currentStreak + 1;
      newStreak.lastLoggedDate = dateKey;
    } else if (daysSinceLastLog === 2 && !streakData.graceUsedThisWeek) {
      newStreak.currentStreak = streakData.currentStreak + 1;
      newStreak.graceUsedThisWeek = true;
      newStreak.lastLoggedDate = dateKey;
    } else if (daysSinceLastLog > 1) {
      newStreak.currentStreak = 1;
      newStreak.lastLoggedDate = dateKey;
    }

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const lastLogDate = new Date(streakData.lastLoggedDate);
    if (lastLogDate < startOfWeek) {
      newStreak.graceUsedThisWeek = false;
    }

    if (newStreak.currentStreak > newStreak.bestStreak) {
      newStreak.bestStreak = newStreak.currentStreak;
    }

    if (JSON.stringify(newStreak) !== JSON.stringify(streakData)) {
      saveStreakMutation.mutate(newStreak);
    }
  };

  const { mutate: mutateProfile } = saveProfileMutation;
  const { mutate: mutateWeightHistoryFn } = saveWeightHistoryMutation;

  const saveProfile = useCallback((newProfile: UserProfile) => {
    console.log('Saving profile:', newProfile);
    mutateProfile(newProfile);
    
    const todayKey = getTodayKey();
    const existingEntry = weightHistory.find(entry => entry.date === todayKey);
    
    if (!existingEntry && profile && newProfile.weight !== profile.weight) {
      const newEntry: WeightEntry = {
        date: todayKey,
        weight: newProfile.weight,
        timestamp: Date.now(),
      };
      mutateWeightHistoryFn([...weightHistory, newEntry]);
    } else if (existingEntry && newProfile.weight !== existingEntry.weight) {
      const updatedHistory = weightHistory.map(entry => 
        entry.date === todayKey 
          ? { ...entry, weight: newProfile.weight, timestamp: Date.now() }
          : entry
      );
      mutateWeightHistoryFn(updatedHistory);
    }
  }, [profile, weightHistory, mutateProfile, mutateWeightHistoryFn]);

  const addFoodEntry = (entry: Omit<FoodEntry, 'id' | 'timestamp'>) => {
    const todayKey = getTodayKey();
    const newEntry: FoodEntry = {
      ...entry,
      id: Date.now().toString(),
      timestamp: Date.now(),
    };

    const updatedLog = {
      ...foodLog,
      [todayKey]: [...(foodLog[todayKey] || []), newEntry],
    };

    saveFoodLogMutation.mutate(updatedLog);
    updateStreak(todayKey);
    updateRecentMeals(entry);
  };

  const updateRecentMeals = (entry: Omit<FoodEntry, 'id' | 'timestamp'>) => {
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
  };

  const { mutate: mutateFavorites } = saveFavoritesMutation;
  const { mutate: mutateFoodLog } = saveFoodLogMutation;

  const addToFavorites = useCallback((meal: Omit<FavoriteMeal, 'id' | 'createdAt' | 'logCount'>) => {
    const normalizedName = meal.name.toLowerCase().trim();
    const exists = favorites.some(f => f.name.toLowerCase().trim() === normalizedName);
    if (exists) return false;

    const newFavorite: FavoriteMeal = {
      ...meal,
      id: Date.now().toString(),
      createdAt: Date.now(),
      logCount: 0,
    };
    mutateFavorites([newFavorite, ...favorites]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    return true;
  }, [favorites, mutateFavorites]);

  const removeFromFavorites = useCallback((favoriteId: string) => {
    const updatedFavorites = favorites.filter(f => f.id !== favoriteId);
    mutateFavorites(updatedFavorites);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [favorites, mutateFavorites]);

  const updateFavorite = useCallback((favoriteId: string, updates: Partial<Omit<FavoriteMeal, 'id' | 'createdAt'>>) => {
    const updatedFavorites = favorites.map(f =>
      f.id === favoriteId ? { ...f, ...updates } : f
    );
    mutateFavorites(updatedFavorites);
  }, [favorites, mutateFavorites]);

  const reorderFavorites = useCallback((newOrder: FavoriteMeal[]) => {
    mutateFavorites(newOrder);
  }, [mutateFavorites]);

  const isFavorite = useCallback((mealName: string) => {
    const normalizedName = mealName.toLowerCase().trim();
    return favorites.some(f => f.name.toLowerCase().trim() === normalizedName);
  }, [favorites]);

  const logFromFavorite = useCallback((favoriteId: string) => {
    const favorite = favorites.find(f => f.id === favoriteId);
    if (!favorite) return;

    const todayKey = getTodayKey();
    const newEntry: FoodEntry = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      name: favorite.name,
      calories: favorite.calories,
      protein: favorite.protein,
      carbs: favorite.carbs,
      fat: favorite.fat,
    };

    const updatedLog = {
      ...foodLog,
      [todayKey]: [...(foodLog[todayKey] || []), newEntry],
    };
    mutateFoodLog(updatedLog);

    const updatedFavorites = favorites.map(f =>
      f.id === favoriteId ? { ...f, logCount: f.logCount + 1 } : f
    );
    mutateFavorites(updatedFavorites);
  }, [favorites, foodLog, mutateFoodLog, mutateFavorites]);

  const logFromRecent = useCallback((recentId: string) => {
    const recent = recentMeals.find(r => r.id === recentId);
    if (!recent) return;

    const todayKey = getTodayKey();
    const newEntry: FoodEntry = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      name: recent.name,
      calories: recent.calories,
      protein: recent.protein,
      carbs: recent.carbs,
      fat: recent.fat,
    };

    const updatedLog = {
      ...foodLog,
      [todayKey]: [...(foodLog[todayKey] || []), newEntry],
    };
    mutateFoodLog(updatedLog);
  }, [recentMeals, foodLog, mutateFoodLog]);

  const { mutate: mutateRecentMeals } = saveRecentMealsMutation;
  const { mutate: mutateAuth } = saveAuthMutation;

  const signIn = useCallback((email: string) => {
    console.log('Signing in user:', email);
    mutateAuth({ isSignedIn: true, email });
  }, [mutateAuth]);

  const signOut = useCallback(() => {
    console.log('Signing out user');
    mutateAuth({ isSignedIn: false, email: null });
  }, [mutateAuth]);

  const removeFromRecent = useCallback((recentId: string) => {
    const updatedRecent = recentMeals.filter(r => r.id !== recentId);
    mutateRecentMeals(updatedRecent);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [recentMeals, mutateRecentMeals]);

  const { mutate: mutateWeightHistory } = saveWeightHistoryMutation;

  const addWeightEntry = useCallback((dateKey: string, weight: number) => {
    console.log('Adding weight entry:', { dateKey, weight });
    
    const existingIndex = weightHistory.findIndex(entry => entry.date === dateKey);
    let updatedHistory: WeightEntry[];
    
    if (existingIndex >= 0) {
      updatedHistory = weightHistory.map((entry, i) =>
        i === existingIndex
          ? { ...entry, weight, timestamp: Date.now() }
          : entry
      );
    } else {
      const newEntry: WeightEntry = {
        date: dateKey,
        weight,
        timestamp: Date.now(),
      };
      updatedHistory = [...weightHistory, newEntry].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
    }
    
    mutateWeightHistory(updatedHistory);
    
    if (profile) {
      const updatedProfile = { ...profile, weight };
      mutateProfile(updatedProfile);
      console.log('Profile weight updated for calorie recalculation:', weight);
    }
    
    console.log('Weight entry saved:', { dateKey, weight, historyLength: updatedHistory.length });
  }, [weightHistory, mutateWeightHistory, profile, mutateProfile]);

  const updateWeightEntry = useCallback((dateKey: string, newWeight: number) => {
    console.log('Updating weight entry:', { dateKey, newWeight });
    
    const updatedHistory = weightHistory.map(entry =>
      entry.date === dateKey
        ? { ...entry, weight: newWeight, timestamp: Date.now() }
        : entry
    );
    mutateWeightHistory(updatedHistory);
    
    const sortedHistory = [...updatedHistory].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const latestEntry = sortedHistory[0];
    
    if (profile && latestEntry && latestEntry.date === dateKey) {
      const updatedProfile = { ...profile, weight: newWeight };
      mutateProfile(updatedProfile);
      console.log('Profile weight updated after weight entry update:', newWeight);
    }
  }, [weightHistory, mutateWeightHistory, profile, mutateProfile]);

  const deleteWeightEntry = useCallback((dateKey: string) => {
    console.log('Deleting weight entry:', { dateKey });
    
    const updatedHistory = weightHistory.filter(entry => entry.date !== dateKey);
    mutateWeightHistory(updatedHistory);
    
    if (updatedHistory.length > 0 && profile) {
      const sortedHistory = [...updatedHistory].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const latestEntry = sortedHistory[0];
      if (latestEntry.weight !== profile.weight) {
        const updatedProfile = { ...profile, weight: latestEntry.weight };
        mutateProfile(updatedProfile);
        console.log('Profile weight updated after deletion to latest:', latestEntry.weight);
      }
    }
    
    console.log('Weight entry deleted:', { dateKey, remainingEntries: updatedHistory.length });
  }, [weightHistory, mutateWeightHistory, profile, mutateProfile]);

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

    analyzeMealPhoto(base64)
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
        console.error('Photo analysis error:', error);
        setPendingEntries(prev =>
          prev.map(entry =>
            entry.id === newPending.id
              ? { ...entry, status: 'error' as const, error: 'Gagal menganalisis foto' }
              : entry
          )
        );
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      });

    return newPending.id;
  }, []);

  const confirmPendingEntry = useCallback((pendingId: string, servings: number = 1) => {
    const pending = pendingEntries.find(p => p.id === pendingId);
    if (!pending || pending.status !== 'done' || !pending.analysis) return;

    const analysis = pending.analysis;
    const avgCalories = Math.round((analysis.totalCaloriesMin + analysis.totalCaloriesMax) / 2) * servings;
    const avgProtein = Math.round((analysis.totalProteinMin + analysis.totalProteinMax) / 2) * servings;
    const avgCarbs = analysis.items.reduce((sum, item) => sum + (item.carbsMin + item.carbsMax) / 2, 0) * servings;
    const avgFat = analysis.items.reduce((sum, item) => sum + (item.fatMin + item.fatMax) / 2, 0) * servings;
    const foodNames = analysis.items.map(item => item.name).join(', ');

    addFoodEntry({
      name: foodNames,
      calories: Math.round(avgCalories),
      protein: Math.round(avgProtein),
      carbs: Math.round(avgCarbs),
      fat: Math.round(avgFat),
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

    analyzeMealPhoto(pending.base64)
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
        console.error('Photo analysis error:', error);
        setPendingEntries(prev =>
          prev.map(entry =>
            entry.id === pendingId
              ? { ...entry, status: 'error' as const, error: 'Gagal menganalisis foto' }
              : entry
          )
        );
      });
  }, [pendingEntries]);

  const deleteFoodEntry = (entryId: string) => {
    const todayKey = getTodayKey();
    const todayEntries = foodLog[todayKey] || [];
    const updatedEntries = todayEntries.filter(entry => entry.id !== entryId);

    const updatedLog = {
      ...foodLog,
      [todayKey]: updatedEntries,
    };

    saveFoodLogMutation.mutate(updatedLog);
  };

  const updateFoodEntry = (entryId: string, updates: Omit<FoodEntry, 'id' | 'timestamp'>) => {
    const todayKey = getTodayKey();
    const todayEntries = foodLog[todayKey] || [];
    const updatedEntries = todayEntries.map(entry => 
      entry.id === entryId 
        ? { ...entry, ...updates }
        : entry
    );

    const updatedLog = {
      ...foodLog,
      [todayKey]: updatedEntries,
    };

    saveFoodLogMutation.mutate(updatedLog);
  };

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
      const keysToRemove = [
        getStorageKey(BASE_PROFILE_KEY, currentUserEmail),
        getStorageKey(BASE_FOOD_LOG_KEY, currentUserEmail),
        getStorageKey(BASE_STREAK_KEY, currentUserEmail),
        getStorageKey(BASE_WEIGHT_HISTORY_KEY, currentUserEmail),
        getStorageKey(BASE_FAVORITES_KEY, currentUserEmail),
        getStorageKey(BASE_RECENT_MEALS_KEY, currentUserEmail),
        AUTH_KEY,
      ];
      await AsyncStorage.multiRemove(keysToRemove);
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
      setAuthState({ isSignedIn: false, email: null });
      queryClient.clear();
      console.log('All data cleared');
    } catch (error) {
      console.error('Error clearing data:', error);
    }
  }, [queryClient, currentUserEmail]);

  return {
    profile,
    saveProfile,
    dailyTargets,
    todayEntries,
    todayTotals,
    foodLog,
    weightHistory,
    addFoodEntry,
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
    addWeightEntry,
    authState,
    signIn,
    signOut,
    updateWeightEntry,
    deleteWeightEntry,
    clearAllData,
    isLoading: profileQuery.isLoading || foodLogQuery.isLoading || streakQuery.isLoading || weightHistoryQuery.isLoading || favoritesQuery.isLoading || recentMealsQuery.isLoading || authQuery.isLoading,
    isSaving: saveProfileMutation.isPending || saveFoodLogMutation.isPending || saveStreakMutation.isPending || saveWeightHistoryMutation.isPending || saveFavoritesMutation.isPending || saveRecentMealsMutation.isPending || saveAuthMutation.isPending,
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
