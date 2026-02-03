import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { UserProfile, FoodEntry, DailyTargets, MealAnalysis, FavoriteMeal, RecentMeal } from '@/types/nutrition';
import { calculateDailyTargets, getTodayKey } from '@/utils/nutritionCalculations';
import { analyzeMealPhoto } from '@/utils/photoAnalysis';
import { supabase, SupabaseProfile, SupabaseFoodEntry, SupabaseWeightHistory } from '@/lib/supabase';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Session } from '@supabase/supabase-js';

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

const BASE_STREAK_KEY = 'nutrition_streak';
const BASE_FAVORITES_KEY = 'nutrition_favorites';
const BASE_RECENT_MEALS_KEY = 'nutrition_recent_meals';

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

const mapSupabaseProfileToUserProfile = (sp: SupabaseProfile): UserProfile => {
  const goal = (sp.goal === 'fat_loss' || sp.goal === 'maintenance' || sp.goal === 'muscle_gain') ? sp.goal : 'maintenance';
  
  // Derive weeklyWeightChange from goal if not stored
  let weeklyWeightChange = 0;
  if (goal === 'fat_loss') {
    weeklyWeightChange = 0.5; // Default 0.5kg/week loss
  } else if (goal === 'muscle_gain') {
    weeklyWeightChange = 0.3; // Default 0.3kg/week gain
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
});

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
  const [authState, setAuthState] = useState<AuthState>({ isSignedIn: false, email: null, userId: null });
  const [, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session:', session?.user?.email);
      setSession(session);
      if (session?.user) {
        setAuthState({
          isSignedIn: true,
          email: session.user.email || null,
          userId: session.user.id,
        });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state changed:', _event, session?.user?.email);
      setSession(session);
      if (session?.user) {
        setAuthState({
          isSignedIn: true,
          email: session.user.email || null,
          userId: session.user.id,
        });
      } else {
        setAuthState({ isSignedIn: false, email: null, userId: null });
      }
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
      const { data, error } = await supabase
        .from('food_entries')
        .select('*')
        .eq('user_id', authState.userId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching food entries:', error);
        return [];
      }
      return data as SupabaseFoodEntry[];
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
    queryKey: ['nutrition_streak', authState.email],
    queryFn: async () => {
      const key = getStorageKey(BASE_STREAK_KEY, authState.email);
      const stored = await AsyncStorage.getItem(key);
      return stored ? JSON.parse(stored) : {
        currentStreak: 0,
        bestStreak: 0,
        lastLoggedDate: '',
        graceUsedThisWeek: false,
      };
    },
    enabled: authState.isSignedIn,
  });

  const favoritesQuery = useQuery({
    queryKey: ['nutrition_favorites', authState.email],
    queryFn: async () => {
      const key = getStorageKey(BASE_FAVORITES_KEY, authState.email);
      const stored = await AsyncStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    },
    enabled: authState.isSignedIn,
  });

  const recentMealsQuery = useQuery({
    queryKey: ['nutrition_recent_meals', authState.email],
    queryFn: async () => {
      const key = getStorageKey(BASE_RECENT_MEALS_KEY, authState.email);
      const stored = await AsyncStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    },
    enabled: authState.isSignedIn,
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
        const dateKey = entry.date;
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
    if (favoritesQuery.data) {
      setFavorites(favoritesQuery.data);
    }
  }, [favoritesQuery.data]);

  useEffect(() => {
    if (recentMealsQuery.data) {
      setRecentMeals(recentMealsQuery.data);
    }
  }, [recentMealsQuery.data]);

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
    mutationFn: async (entry: Omit<FoodEntry, 'id' | 'timestamp'>) => {
      if (!authState.userId) throw new Error('Not authenticated');
      
      const todayKey = getTodayKey();
      console.log('Saving food entry to Supabase:', entry);
      const { data, error } = await supabase
        .from('food_entries')
        .insert({
          user_id: authState.userId,
          date: todayKey,
          food_name: entry.name,
          calories: entry.calories,
          protein: entry.protein,
          carbs: entry.carbs,
          fat: entry.fat,
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error saving food entry:', error);
        throw error;
      }
      return data as SupabaseFoodEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase_food_entries'] });
      console.log('Food entry saved successfully');
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
      const { error } = await supabase
        .from('food_entries')
        .update({
          food_name: updates.name,
          calories: updates.calories,
          protein: updates.protein,
          carbs: updates.carbs,
          fat: updates.fat,
        })
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
      const { error } = await supabase
        .from('weight_history')
        .upsert({
          user_id: authState.userId,
          weight,
          recorded_at: new Date(dateKey).toISOString(),
        }, {
          onConflict: 'user_id,recorded_at',
        });
      
      if (error) {
        console.error('Error saving weight:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase_weight_history'] });
    },
  });

  const deleteWeightHistoryMutation = useMutation({
    mutationFn: async (dateKey: string) => {
      if (!authState.userId) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('weight_history')
        .delete()
        .eq('user_id', authState.userId)
        .gte('recorded_at', `${dateKey}T00:00:00`)
        .lt('recorded_at', `${dateKey}T23:59:59`);
      
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
      const key = getStorageKey(BASE_STREAK_KEY, authState.email);
      await AsyncStorage.setItem(key, JSON.stringify(newStreak));
      return newStreak;
    },
    onSuccess: (data) => {
      setStreakData(data);
      queryClient.setQueryData(['nutrition_streak', authState.email], data);
    },
  });

  const saveFavoritesMutation = useMutation({
    mutationFn: async (newFavorites: FavoriteMeal[]) => {
      const key = getStorageKey(BASE_FAVORITES_KEY, authState.email);
      await AsyncStorage.setItem(key, JSON.stringify(newFavorites));
      return newFavorites;
    },
    onSuccess: (data) => {
      setFavorites(data);
      queryClient.setQueryData(['nutrition_favorites', authState.email], data);
    },
  });

  const saveRecentMealsMutation = useMutation({
    mutationFn: async (newRecent: RecentMeal[]) => {
      const key = getStorageKey(BASE_RECENT_MEALS_KEY, authState.email);
      await AsyncStorage.setItem(key, JSON.stringify(newRecent));
      return newRecent;
    },
    onSuccess: (data) => {
      setRecentMeals(data);
      queryClient.setQueryData(['nutrition_recent_meals', authState.email], data);
    },
  });

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

  const addFoodEntry = useCallback((entry: Omit<FoodEntry, 'id' | 'timestamp'>) => {
    const todayKey = getTodayKey();
    saveFoodEntryMutation.mutate(entry);
    updateStreak(todayKey);
    updateRecentMeals(entry);
  }, [saveFoodEntryMutation]);

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

    addFoodEntry({
      name: favorite.name,
      calories: favorite.calories,
      protein: favorite.protein,
      carbs: favorite.carbs,
      fat: favorite.fat,
    });

    const updatedFavorites = favorites.map(f =>
      f.id === favoriteId ? { ...f, logCount: f.logCount + 1 } : f
    );
    mutateFavorites(updatedFavorites);
  }, [favorites, addFoodEntry, mutateFavorites]);

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
    await supabase.auth.signOut();
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
      router.replace('/onboarding');
    }, 100);
  }, [queryClient]);

  const removeFromRecent = useCallback((recentId: string) => {
    const updatedRecent = recentMeals.filter(r => r.id !== recentId);
    mutateRecentMeals(updatedRecent);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [recentMeals, mutateRecentMeals]);

  const addWeightEntry = useCallback((dateKey: string, weight: number) => {
    console.log('Adding weight entry:', { dateKey, weight });
    saveWeightHistoryMutation.mutate({ dateKey, weight });
    
    if (profile) {
      const updatedProfile = { ...profile, weight };
      saveProfileMutation.mutate(updatedProfile);
    }
  }, [saveWeightHistoryMutation, profile, saveProfileMutation]);

  const updateWeightEntry = useCallback((dateKey: string, newWeight: number) => {
    console.log('Updating weight entry:', { dateKey, newWeight });
    saveWeightHistoryMutation.mutate({ dateKey, weight: newWeight });
    
    const sortedHistory = [...weightHistory].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const latestEntry = sortedHistory[0];
    
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

  const deleteFoodEntry = useCallback((entryId: string) => {
    deleteFoodEntryMutation.mutate(entryId);
  }, [deleteFoodEntryMutation]);

  const updateFoodEntry = useCallback((entryId: string, updates: Omit<FoodEntry, 'id' | 'timestamp'>) => {
    updateFoodEntryMutation.mutate({ entryId, updates });
  }, [updateFoodEntryMutation]);

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
      await supabase.auth.signOut();
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
      console.log('All data cleared');
    } catch (error) {
      console.error('Error clearing data:', error);
    }
  }, [queryClient]);

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
    signUp,
    signOut,
    updateWeightEntry,
    deleteWeightEntry,
    clearAllData,
    isLoading: profileQuery.isLoading || foodEntriesQuery.isLoading || weightHistoryQuery.isLoading || streakQuery.isLoading || favoritesQuery.isLoading || recentMealsQuery.isLoading,
    isSaving: saveProfileMutation.isPending || saveFoodEntryMutation.isPending || saveWeightHistoryMutation.isPending || saveFavoritesMutation.isPending || saveRecentMealsMutation.isPending,
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
