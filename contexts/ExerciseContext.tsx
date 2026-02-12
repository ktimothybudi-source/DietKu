import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Platform } from 'react-native';
import { Pedometer } from 'expo-sensors';
import { ExerciseEntry, StepsData } from '@/types/exercise';
import { getTodayKey } from '@/utils/nutritionCalculations';
import { useNutrition } from '@/contexts/NutritionContext';
import * as Haptics from 'expo-haptics';

const BASE_EXERCISES_KEY = 'exercise_log';
const BASE_STEPS_KEY = 'steps_data';
const HEALTH_CONNECT_KEY = 'health_connect_enabled';

const getStorageKey = (baseKey: string, email: string | null) => {
  if (!email) return baseKey;
  const sanitizedEmail = email.replace(/[^a-zA-Z0-9]/g, '_');
  return `${baseKey}_${sanitizedEmail}`;
};

const STEPS_CALORIES_FACTOR = 0.04;

export const [ExerciseProvider, useExercise] = createContextHook(() => {
  const queryClient = useQueryClient();
  const { authState, selectedDate } = useNutrition();
  const [exercises, setExercises] = useState<{ [date: string]: ExerciseEntry[] }>({});
  const [stepsData, setStepsData] = useState<StepsData>({});
  const [healthConnectEnabled, setHealthConnectEnabled] = useState(false);
  const [pedometerAvailable, setPedometerAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      Pedometer.isAvailableAsync().then((available: boolean) => {
        console.log('Pedometer available:', available);
        setPedometerAvailable(available);
        if (available && healthConnectEnabled) {
          const end = new Date();
          const start = new Date();
          start.setHours(0, 0, 0, 0);
          Pedometer.getStepCountAsync(start, end).then((result: { steps: number }) => {
            console.log('Today steps from pedometer:', result.steps);
            const todayKey = getTodayKey();
            setStepsData(prev => ({ ...prev, [todayKey]: result.steps }));
          }).catch((err: unknown) => {
            console.log('Pedometer getStepCount error:', err);
          });
        }
      }).catch(() => {
        console.log('Pedometer not available');
        setPedometerAvailable(false);
      });
    }
  }, [healthConnectEnabled]);

  const exercisesQuery = useQuery({
    queryKey: ['exercise_log', authState.email],
    queryFn: async () => {
      const key = getStorageKey(BASE_EXERCISES_KEY, authState.email);
      const stored = await AsyncStorage.getItem(key);
      return stored ? JSON.parse(stored) : {};
    },
    enabled: authState.isSignedIn,
  });

  const stepsQuery = useQuery({
    queryKey: ['steps_data', authState.email],
    queryFn: async () => {
      const key = getStorageKey(BASE_STEPS_KEY, authState.email);
      const stored = await AsyncStorage.getItem(key);
      return stored ? JSON.parse(stored) : {};
    },
    enabled: authState.isSignedIn,
  });

  const healthConnectQuery = useQuery({
    queryKey: ['health_connect_enabled'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(HEALTH_CONNECT_KEY);
      return stored === 'true';
    },
  });

  useEffect(() => {
    if (exercisesQuery.data) {
      setExercises(exercisesQuery.data);
    }
  }, [exercisesQuery.data]);

  useEffect(() => {
    if (stepsQuery.data) {
      setStepsData(stepsQuery.data);
    }
  }, [stepsQuery.data]);

  useEffect(() => {
    if (healthConnectQuery.data !== undefined) {
      setHealthConnectEnabled(healthConnectQuery.data);
    }
  }, [healthConnectQuery.data]);

  const saveExercisesMutation = useMutation({
    mutationFn: async (newExercises: { [date: string]: ExerciseEntry[] }) => {
      const key = getStorageKey(BASE_EXERCISES_KEY, authState.email);
      await AsyncStorage.setItem(key, JSON.stringify(newExercises));
      return newExercises;
    },
    onSuccess: (data) => {
      setExercises(data);
      queryClient.setQueryData(['exercise_log', authState.email], data);
    },
  });

  const saveStepsMutation = useMutation({
    mutationFn: async (newSteps: StepsData) => {
      const key = getStorageKey(BASE_STEPS_KEY, authState.email);
      await AsyncStorage.setItem(key, JSON.stringify(newSteps));
      return newSteps;
    },
    onSuccess: (data) => {
      setStepsData(data);
      queryClient.setQueryData(['steps_data', authState.email], data);
    },
  });

  const saveHealthConnectMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      await AsyncStorage.setItem(HEALTH_CONNECT_KEY, enabled ? 'true' : 'false');
      return enabled;
    },
    onSuccess: (data) => {
      setHealthConnectEnabled(data);
    },
  });

  const addExercise = useCallback((entry: Omit<ExerciseEntry, 'id' | 'timestamp' | 'date'>) => {
    const todayKey = getTodayKey();
    const newEntry: ExerciseEntry = {
      ...entry,
      id: Date.now().toString(),
      timestamp: Date.now(),
      date: todayKey,
    };
    const dateExercises = exercises[todayKey] || [];
    const updated = {
      ...exercises,
      [todayKey]: [...dateExercises, newEntry],
    };
    saveExercisesMutation.mutate(updated);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    console.log('Exercise added:', newEntry);
  }, [exercises, saveExercisesMutation]);

  const deleteExercise = useCallback((exerciseId: string, date: string) => {
    const dateExercises = exercises[date] || [];
    const updated = {
      ...exercises,
      [date]: dateExercises.filter(e => e.id !== exerciseId),
    };
    saveExercisesMutation.mutate(updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [exercises, saveExercisesMutation]);

  const addSteps = useCallback((steps: number) => {
    const todayKey = getTodayKey();
    const current = stepsData[todayKey] || 0;
    const updated = { ...stepsData, [todayKey]: current + steps };
    saveStepsMutation.mutate(updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [stepsData, saveStepsMutation]);

  const setStepsForDate = useCallback((date: string, steps: number) => {
    const updated = { ...stepsData, [date]: steps };
    saveStepsMutation.mutate(updated);
  }, [stepsData, saveStepsMutation]);

  const enableHealthConnect = useCallback(() => {
    saveHealthConnectMutation.mutate(true);
  }, [saveHealthConnectMutation]);

  const disableHealthConnect = useCallback(() => {
    saveHealthConnectMutation.mutate(false);
  }, [saveHealthConnectMutation]);

  const todayExercises = useMemo(() => {
    return exercises[selectedDate] || [];
  }, [exercises, selectedDate]);

  const todaySteps = useMemo(() => {
    return stepsData[selectedDate] || 0;
  }, [stepsData, selectedDate]);

  const stepsCaloriesBurned = useMemo(() => {
    return Math.round(todaySteps * STEPS_CALORIES_FACTOR);
  }, [todaySteps]);

  const exerciseCaloriesBurned = useMemo(() => {
    return todayExercises.reduce((sum, e) => sum + e.caloriesBurned, 0);
  }, [todayExercises]);

  const totalCaloriesBurned = useMemo(() => {
    return stepsCaloriesBurned + exerciseCaloriesBurned;
  }, [stepsCaloriesBurned, exerciseCaloriesBurned]);

  return {
    exercises,
    stepsData,
    healthConnectEnabled,
    pedometerAvailable,
    todayExercises,
    todaySteps,
    stepsCaloriesBurned,
    exerciseCaloriesBurned,
    totalCaloriesBurned,
    addExercise,
    deleteExercise,
    addSteps,
    setStepsForDate,
    enableHealthConnect,
    disableHealthConnect,
    isLoading: exercisesQuery.isLoading || stepsQuery.isLoading,
  };
});
