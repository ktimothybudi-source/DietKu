import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useState, useEffect, useMemo } from 'react';
import { UserProfile, FoodEntry, DailyTargets } from '@/types/nutrition';
import { calculateDailyTargets, getTodayKey } from '@/utils/nutritionCalculations';

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

const PROFILE_KEY = 'nutrition_profile';
const FOOD_LOG_KEY = 'nutrition_food_log';
const STREAK_KEY = 'nutrition_streak';
const WEIGHT_HISTORY_KEY = 'nutrition_weight_history';

export const [NutritionProvider, useNutrition] = createContextHook(() => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [foodLog, setFoodLog] = useState<FoodLog>({});
  const [weightHistory, setWeightHistory] = useState<WeightEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayKey());
  const [streakData, setStreakData] = useState<StreakData>({
    currentStreak: 0,
    bestStreak: 0,
    lastLoggedDate: '',
    graceUsedThisWeek: false,
  });

  const profileQuery = useQuery({
    queryKey: ['nutrition_profile'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(PROFILE_KEY);
      return stored ? JSON.parse(stored) : null;
    },
  });

  const foodLogQuery = useQuery({
    queryKey: ['nutrition_food_log'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(FOOD_LOG_KEY);
      return stored ? JSON.parse(stored) : {};
    },
  });

  const streakQuery = useQuery({
    queryKey: ['nutrition_streak'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STREAK_KEY);
      return stored ? JSON.parse(stored) : {
        currentStreak: 0,
        bestStreak: 0,
        lastLoggedDate: '',
        graceUsedThisWeek: false,
      };
    },
  });

  const weightHistoryQuery = useQuery({
    queryKey: ['nutrition_weight_history'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(WEIGHT_HISTORY_KEY);
      return stored ? JSON.parse(stored) : [];
    },
  });

  const saveProfileMutation = useMutation({
    mutationFn: async (newProfile: UserProfile) => {
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(newProfile));
      return newProfile;
    },
    onSuccess: (data) => {
      setProfile(data);
    },
  });

  const saveFoodLogMutation = useMutation({
    mutationFn: async (newLog: FoodLog) => {
      await AsyncStorage.setItem(FOOD_LOG_KEY, JSON.stringify(newLog));
      return newLog;
    },
    onSuccess: (data) => {
      setFoodLog(data);
    },
  });

  const saveStreakMutation = useMutation({
    mutationFn: async (newStreak: StreakData) => {
      await AsyncStorage.setItem(STREAK_KEY, JSON.stringify(newStreak));
      return newStreak;
    },
    onSuccess: (data) => {
      setStreakData(data);
    },
  });

  const saveWeightHistoryMutation = useMutation({
    mutationFn: async (newHistory: WeightEntry[]) => {
      await AsyncStorage.setItem(WEIGHT_HISTORY_KEY, JSON.stringify(newHistory));
      return newHistory;
    },
    onSuccess: (data) => {
      setWeightHistory(data);
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

  const saveProfile = (newProfile: UserProfile) => {
    saveProfileMutation.mutate(newProfile);
    
    const todayKey = getTodayKey();
    const existingEntry = weightHistory.find(entry => entry.date === todayKey);
    
    if (!existingEntry && profile && newProfile.weight !== profile.weight) {
      const newEntry: WeightEntry = {
        date: todayKey,
        weight: newProfile.weight,
        timestamp: Date.now(),
      };
      saveWeightHistoryMutation.mutate([...weightHistory, newEntry]);
    } else if (existingEntry && newProfile.weight !== existingEntry.weight) {
      const updatedHistory = weightHistory.map(entry => 
        entry.date === todayKey 
          ? { ...entry, weight: newProfile.weight, timestamp: Date.now() }
          : entry
      );
      saveWeightHistoryMutation.mutate(updatedHistory);
    }
  };

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
  };

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
    if (!profile) return null;
    return calculateDailyTargets(profile);
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
    isLoading: profileQuery.isLoading || foodLogQuery.isLoading || streakQuery.isLoading || weightHistoryQuery.isLoading,
    isSaving: saveProfileMutation.isPending || saveFoodLogMutation.isPending || saveStreakMutation.isPending || saveWeightHistoryMutation.isPending,
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
