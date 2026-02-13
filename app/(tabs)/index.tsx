import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
const SCREEN_WIDTH = Dimensions.get('window').width;
const CAROUSEL_CARD_WIDTH = SCREEN_WIDTH - 40;
const CAROUSEL_GAP = 12;
const SUGAR_TARGET_G = 25;
const FIBER_TARGET_G = 25;
const SODIUM_TARGET_MG = 2300;
import { Stack, router } from 'expo-router';
import { Flame, X, Check, Camera, ImageIcon, ChevronLeft, ChevronRight, Calendar, RefreshCw, Trash2, Plus, Bookmark, Clock, Star, Share2, Edit3, PlusCircle, Search as SearchIcon, Droplets, Minus, Footprints, Dumbbell, ChevronRight as ChevronRightIcon, Utensils, Target, TrendingDown, TrendingUp, Zap, MessageSquare, Send } from 'lucide-react-native';
import { useNutrition, useTodayProgress, PendingFoodEntry } from '@/contexts/NutritionContext';
import { useTheme } from '@/contexts/ThemeContext';
import { FoodEntry, MealAnalysis } from '@/types/nutrition';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { analyzeMealPhoto } from '@/utils/photoAnalysis';
import { getTodayKey } from '@/utils/nutritionCalculations';
import { searchUSDAFoods, USDAFoodItem } from '@/utils/usdaApi';
import { searchFoods } from '@/lib/foodsApi';
import { FoodSearchResult } from '@/types/food';
import ProgressRing from '@/components/ProgressRing';
import { useExercise } from '@/contexts/ExerciseContext';
import { QUICK_EXERCISES, QuickExercise, ExerciseType } from '@/types/exercise';
import { ANIMATION_DURATION } from '@/constants/animations';
import { getTimeBasedMessage, getProgressMessage, getCalorieFeedback, MotivationalMessage } from '@/constants/motivationalMessages';

export default function HomeScreen() {
  const { profile, dailyTargets, todayEntries, todayTotals, addFoodEntry, deleteFoodEntry, isLoading, streakData, selectedDate, setSelectedDate, pendingEntries, confirmPendingEntry, removePendingEntry, retryPendingEntry, favorites, recentMeals, addToFavorites, removeFromFavorites, isFavorite, logFromFavorite, logFromRecent, removeFromRecent, shouldSuggestFavorite, addWaterCup, removeWaterCup, getTodayWaterCups, addSugarUnit, removeSugarUnit, getTodaySugarUnits, addFiberUnit, removeFiberUnit, getTodayFiberUnits, addSodiumUnit, removeSodiumUnit, getTodaySodiumUnits } = useNutrition();
  const { todaySteps, stepsCaloriesBurned, exerciseCaloriesBurned, totalCaloriesBurned, todayExercises, addExercise } = useExercise();
  const { theme } = useTheme();
  const progress = useTodayProgress();
  const [modalVisible, setModalVisible] = useState(false);
  const [foodName, setFoodName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<MealAnalysis | null>(null);
  
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [selectedPending, setSelectedPending] = useState<PendingFoodEntry | null>(null);
  const [lastPendingCount, setLastPendingCount] = useState(0);
  const [addFoodModalVisible, setAddFoodModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'recent' | 'favorit' | 'scan' | 'search'>('recent');
  const [usdaSearchQuery, setUsdaSearchQuery] = useState('');
  const [usdaSearchResults, setUsdaSearchResults] = useState<USDAFoodItem[]>([]);
  const [supabaseFoodResults, setSupabaseFoodResults] = useState<FoodSearchResult[]>([]);
  const [usdaSearching, setUsdaSearching] = useState(false);
  const [usdaSearchError, setUsdaSearchError] = useState<string | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showFavoriteToast, setShowFavoriteToast] = useState(false);
  const [favoriteToastMessage, setFavoriteToastMessage] = useState('');
  const [showSuggestFavorite, setShowSuggestFavorite] = useState(false);
  const [suggestedMealName, setSuggestedMealName] = useState('');
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() };
  });
  const [shownPendingIds, setShownPendingIds] = useState<Set<string>>(new Set());
  const [motivationalMessage, setMotivationalMessage] = useState<MotivationalMessage & { isWarning?: boolean; isCelebration?: boolean } | null>(null);
  const [showMotivationalToast, setShowMotivationalToast] = useState(false);
  const motivationalToastAnim = useRef(new Animated.Value(-100)).current;
  const motivationalToastOpacity = useRef(new Animated.Value(0)).current;
  const [notificationQueue, setNotificationQueue] = useState<(MotivationalMessage & { isWarning?: boolean; isCelebration?: boolean })[]>([]);
  const [targetReachedToday, setTargetReachedToday] = useState(false);
  const isShowingToast = useRef(false);
  const [editedItems, setEditedItems] = useState<{
    name: string;
    portion: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }[]>([]);
  
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemPortion, setEditItemPortion] = useState('');
  const [editItemCalories, setEditItemCalories] = useState('');
  const [editItemProtein, setEditItemProtein] = useState('');
  const [editItemCarbs, setEditItemCarbs] = useState('');
  const [editItemFat, setEditItemFat] = useState('');
  const [showAddItem, setShowAddItem] = useState(false);
  const [hasEdited, setHasEdited] = useState(false);

  const [viewingLoggedEntryId, setViewingLoggedEntryId] = useState<string | null>(null);
  const [carouselPage, setCarouselPage] = useState(0);
  const [exerciseMode, setExerciseMode] = useState<'quick' | 'describe' | 'manual'>('quick');
  const [selectedQuickExercise, setSelectedQuickExercise] = useState<QuickExercise | null>(null);
  const [quickDuration, setQuickDuration] = useState('');
  const [exerciseDescription, setExerciseDescription] = useState('');
  const [isAnalyzingExercise, setIsAnalyzingExercise] = useState(false);
  const [manualExName, setManualExName] = useState('');
  const [manualExCalories, setManualExCalories] = useState('');
  const [manualExDuration, setManualExDuration] = useState('');
  
  const pendingModalScrollRef = useRef<ScrollView>(null);
  
  
  const caloriesAnimValue = useRef(new Animated.Value(0)).current;
  const proteinAnimValue = useRef(new Animated.Value(0)).current;
  const remainingAnimValue = useRef(new Animated.Value(0)).current;

  const showSingleToast = useCallback((message: MotivationalMessage & { isWarning?: boolean; isCelebration?: boolean }) => {
    isShowingToast.current = true;
    setMotivationalMessage(message);
    setShowMotivationalToast(true);
    
    Animated.parallel([
      Animated.spring(motivationalToastAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }),
      Animated.timing(motivationalToastOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
    
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(motivationalToastAnim, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(motivationalToastOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowMotivationalToast(false);
        isShowingToast.current = false;
      });
    }, 2500);
  }, [motivationalToastAnim, motivationalToastOpacity]);

  const queueNotification = useCallback((message: MotivationalMessage & { isWarning?: boolean; isCelebration?: boolean }) => {
    setNotificationQueue(prev => [...prev, message]);
  }, []);

  useEffect(() => {
    if (notificationQueue.length > 0 && !isShowingToast.current) {
      const [next, ...rest] = notificationQueue;
      setNotificationQueue(rest);
      showSingleToast(next);
    }
  }, [notificationQueue, showSingleToast]);

  useEffect(() => {
    const todayKey = getTodayKey();
    if (selectedDate !== todayKey) {
      setTargetReachedToday(false);
    }
  }, [selectedDate]);

  const prevEntriesCount = useRef(todayEntries.length);
  
  useEffect(() => {
    if (todayEntries.length > prevEntriesCount.current && progress && streakData && profile && dailyTargets) {
      const caloriesOver = todayTotals.calories - dailyTargets.calories;
      const calorieFeedback = getCalorieFeedback(caloriesOver, profile.goal, dailyTargets.calories);
      
      const justReachedTarget = progress.caloriesProgress >= 90 && progress.caloriesProgress <= 110;
      
      if (calorieFeedback) {
        queueNotification({ text: calorieFeedback.text, emoji: calorieFeedback.emoji, isWarning: calorieFeedback.isWarning, isCelebration: calorieFeedback.isCelebration });
      }
      
      if (justReachedTarget && !targetReachedToday) {
        setTargetReachedToday(true);
        const progressMsg = getProgressMessage(
          progress.caloriesProgress,
          progress.proteinProgress,
          streakData.currentStreak
        );
        if (!calorieFeedback) {
          queueNotification(progressMsg);
        } else {
          setTimeout(() => queueNotification(progressMsg), 100);
        }
      } else if (!calorieFeedback && !targetReachedToday) {
        const message = getProgressMessage(
          progress.caloriesProgress,
          progress.proteinProgress,
          streakData.currentStreak
        );
        queueNotification(message);
      }
    }
    prevEntriesCount.current = todayEntries.length;
  }, [todayEntries.length, progress, streakData, queueNotification, profile, dailyTargets, todayTotals.calories, targetReachedToday]);

  useEffect(() => {
    Animated.timing(caloriesAnimValue, {
      toValue: todayTotals.calories,
      duration: ANIMATION_DURATION.medium,
      useNativeDriver: false,
    }).start();
  }, [todayTotals.calories, caloriesAnimValue]);

  useEffect(() => {
    Animated.timing(proteinAnimValue, {
      toValue: todayTotals.protein,
      duration: ANIMATION_DURATION.medium,
      useNativeDriver: false,
    }).start();
  }, [todayTotals.protein, proteinAnimValue]);

  useEffect(() => {
    Animated.timing(remainingAnimValue, {
      toValue: progress?.caloriesRemaining || 0,
      duration: ANIMATION_DURATION.medium,
      useNativeDriver: false,
    }).start();
  }, [progress?.caloriesRemaining, remainingAnimValue]);

  useEffect(() => {
    const donePending = pendingEntries.find(p => p.status === 'done' && !shownPendingIds.has(p.id));
    if (donePending && donePending.analysis && !selectedPending) {
      setShownPendingIds(prev => new Set(prev).add(donePending.id));
      
      const analysis = donePending.analysis;
      const avgCalories = Math.round((analysis.totalCaloriesMin + analysis.totalCaloriesMax) / 2);
      const avgProtein = Math.round((analysis.totalProteinMin + analysis.totalProteinMax) / 2);
      const avgCarbs = Math.round(analysis.items.reduce((sum, item) => sum + (item.carbsMin + item.carbsMax) / 2, 0));
      const avgFat = Math.round(analysis.items.reduce((sum, item) => sum + (item.fatMin + item.fatMax) / 2, 0));
      const foodNames = analysis.items.map(item => item.name).join(', ');
      
      addFoodEntry({
        name: foodNames,
        calories: avgCalories,
        protein: avgProtein,
        carbs: avgCarbs,
        fat: avgFat,
        photoUri: donePending.photoUri,
      });

      const avgSugar = Math.round(analysis.items.reduce((sum, item) => sum + ((item.sugarMin ?? 0) + (item.sugarMax ?? 0)) / 2, 0));
      const avgFiber = Math.round(analysis.items.reduce((sum, item) => sum + ((item.fiberMin ?? 0) + (item.fiberMax ?? 0)) / 2, 0));
      const avgSodium = Math.round(analysis.items.reduce((sum, item) => sum + ((item.sodiumMin ?? 0) + (item.sodiumMax ?? 0)) / 2, 0));
      if (avgSugar > 0) addSugarUnit(avgSugar);
      if (avgFiber > 0) addFiberUnit(avgFiber);
      if (avgSodium > 0) addSodiumUnit(avgSodium);
      
      const items = analysis.items.map(item => ({
        name: item.name,
        portion: item.portion,
        calories: Math.round((item.caloriesMin + item.caloriesMax) / 2),
        protein: Math.round((item.proteinMin + item.proteinMax) / 2),
        carbs: Math.round((item.carbsMin + item.carbsMax) / 2),
        fat: Math.round((item.fatMin + item.fatMax) / 2),
      }));
      setEditedItems(items);
      setHasEdited(false);
      setSelectedPending(donePending);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setLastPendingCount(pendingEntries.length);
  }, [pendingEntries, selectedPending, shownPendingIds, addFoodEntry]);

  const getFormattedDate = (dateKey: string) => {
    const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return `${days[date.getDay()]}, ${day} ${months[date.getMonth()]} ${year}`;
  };

  const isToday = selectedDate === getTodayKey();
  
  const goToPreviousDay = () => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() - 1);
    const newDateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    setSelectedDate(newDateKey);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const goToNextDay = () => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + 1);
    const newDateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    if (newDateKey <= getTodayKey()) {
      setSelectedDate(newDateKey);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const goToToday = () => {
    setSelectedDate(getTodayKey());
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const openCalendarPicker = () => {
    const [year, month] = selectedDate.split('-').map(Number);
    setCalendarMonth({ year, month: month - 1 });
    setShowCalendarPicker(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const selectDateFromCalendar = (day: number) => {
    const newDateKey = `${calendarMonth.year}-${String(calendarMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const todayKey = getTodayKey();
    if (newDateKey <= todayKey) {
      setSelectedDate(newDateKey);
      setShowCalendarPicker(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const goToPreviousMonth = () => {
    setCalendarMonth(prev => {
      if (prev.month === 0) {
        return { year: prev.year - 1, month: 11 };
      }
      return { year: prev.year, month: prev.month - 1 };
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const goToNextMonth = () => {
    const today = new Date();
    const nextMonth = calendarMonth.month === 11 ? 0 : calendarMonth.month + 1;
    const nextYear = calendarMonth.month === 11 ? calendarMonth.year + 1 : calendarMonth.year;
    
    if (nextYear < today.getFullYear() || (nextYear === today.getFullYear() && nextMonth <= today.getMonth())) {
      setCalendarMonth({ year: nextYear, month: nextMonth });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const getCalendarDays = () => {
    const { year, month } = calendarMonth;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayKey = getTodayKey();
    
    const days: { day: number; isCurrentMonth: boolean; isSelectable: boolean; isSelected: boolean; isToday: boolean }[] = [];
    
    for (let i = 0; i < firstDay; i++) {
      days.push({ day: 0, isCurrentMonth: false, isSelectable: false, isSelected: false, isToday: false });
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isSelectable = dateKey <= todayKey;
      const isSelected = dateKey === selectedDate;
      const isToday = dateKey === todayKey;
      days.push({ day, isCurrentMonth: true, isSelectable, isSelected, isToday });
    }
    
    return days;
  };

  const getMonthName = (month: number) => {
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return months[month];
  };

  const handleUSDASearch = useCallback((query: string) => {
    setUsdaSearchQuery(query);
    setUsdaSearchError(null);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (!query.trim()) {
      setUsdaSearchResults([]);
      setSupabaseFoodResults([]);
      setUsdaSearching(false);
      return;
    }
    
    setUsdaSearching(true);
    
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        console.log('Searching foods for:', query);
        
        const [supabaseResults, usdaResults] = await Promise.all([
          searchFoods(query, 15),
          searchUSDAFoods(query, 15),
        ]);
        
        setSupabaseFoodResults(supabaseResults);
        setUsdaSearchResults(usdaResults);
        setUsdaSearchError(null);
      } catch (error) {
        console.error('Food search error:', error);
        setUsdaSearchError('Gagal mencari makanan. Coba lagi.');
        setUsdaSearchResults([]);
        setSupabaseFoodResults([]);
      } finally {
        setUsdaSearching(false);
      }
    }, 500);
  }, []);

  const healthScore = useMemo(() => {
    if (!progress || !dailyTargets || todayEntries.length === 0) {
      return { score: 0, message: 'Mulai catat makananmu untuk melihat Health Score.', color: '#9A9A9A' };
    }
    let score = 0;
    const calPct = todayTotals.calories / dailyTargets.calories;
    if (calPct >= 0.85 && calPct <= 1.05) score += 3;
    else if (calPct >= 0.7 && calPct <= 1.15) score += 2;
    else if (calPct > 0.3) score += 1;
    const protPct = dailyTargets.protein > 0 ? todayTotals.protein / dailyTargets.protein : 0;
    if (protPct >= 0.85) score += 2;
    else if (protPct >= 0.5) score += 1;
    const carbTarget = (dailyTargets.carbsMin + dailyTargets.carbsMax) / 2;
    const fatTarget = (dailyTargets.fatMin + dailyTargets.fatMax) / 2;
    if (carbTarget > 0 && fatTarget > 0) {
      const carbPct = todayTotals.carbs / carbTarget;
      const fatPct = todayTotals.fat / fatTarget;
      if (carbPct >= 0.7 && carbPct <= 1.3 && fatPct >= 0.7 && fatPct <= 1.3) score += 2;
      else if (carbPct > 0.4 || fatPct > 0.4) score += 1;
    }
    const water = getTodayWaterCups();
    if (water >= 6) score += 2;
    else if (water >= 3) score += 1;
    if (totalCaloriesBurned > 100 || todaySteps > 5000) score += 1;
    score = Math.min(score, 10);
    let message = '';
    if (score >= 9) message = 'Luar biasa! Semua target nutrisimu tercapai dengan sempurna.';
    else if (score >= 7) message = 'Progres bagus! Pertahankan keseimbangan makro dan tetap terhidrasi.';
    else if (score >= 5) {
      if (protPct < 0.7) message = 'Awal yang baik. Fokus tingkatkan asupan proteinmu.';
      else if (calPct > 1.15) message = 'Kalorimu sedikit berlebih, kurangi porsi makan berikutnya.';
      else message = 'Terus lanjutkan! Jaga pola makanmu tetap seimbang.';
    } else if (score >= 3) message = 'Usaha yang bagus! Coba lebih dekatkan ke target kalorimu.';
    else message = 'Catat lebih banyak makanan untuk meningkatkan Health Score-mu.';
    const color = score >= 8 ? '#22C55E' : score >= 6 ? '#EAB308' : score >= 4 ? '#F97316' : '#EF4444';
    return { score, message, color };
  }, [progress, dailyTargets, todayTotals, todayEntries.length, getTodayWaterCups, totalCaloriesBurned, todaySteps]);

  React.useEffect(() => {
    if (!isLoading && !profile) {
      const timer = setTimeout(() => {
        try {
          router.replace('/onboarding');
        } catch (e) {
          console.log('Navigation not ready yet, retrying...', e);
          setTimeout(() => {
            router.replace('/onboarding');
          }, 500);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [profile, isLoading]);

  if (isLoading) {
    return null;
  }



  if (!profile || !dailyTargets) {
    return null;
  }

  const handleAddFood = () => {
    if (!foodName || !calories) {
      return;
    }

    const estimatedCarbs = Math.round((parseInt(calories) - (parseInt(protein || '0') * 4)) / 4 * 0.6);
    const estimatedFat = Math.round((parseInt(calories) - (parseInt(protein || '0') * 4)) / 9 * 0.4);

    addFoodEntry({
      name: foodName,
      calories: parseInt(calories),
      protein: parseInt(protein || '0'),
      carbs: estimatedCarbs,
      fat: estimatedFat,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    resetModal();
  };

  const resetModal = () => {
    setFoodName('');
    setCalories('');
    setProtein('');
    setPhotoUri(null);
    setAnalysis(null);
    setShowManualEntry(false);
    setModalVisible(false);
  };

  const handleViewEntry = (entry: FoodEntry) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const items = entry.name.split(',').map((name, index) => {
      const itemCount = entry.name.split(',').length;
      return {
        name: name.trim(),
        portion: '1 porsi',
        calories: Math.round(entry.calories / itemCount),
        protein: Math.round(entry.protein / itemCount),
        carbs: Math.round(entry.carbs / itemCount),
        fat: Math.round(entry.fat / itemCount),
      };
    });
    
    const fakePending: PendingFoodEntry = {
      id: `view-${entry.id}`,
      photoUri: entry.photoUri || '',
      base64: '',
      timestamp: entry.timestamp,
      status: 'done',
      analysis: {
        items: items.map(item => ({
          name: item.name,
          portion: item.portion,
          caloriesMin: item.calories,
          caloriesMax: item.calories,
          proteinMin: item.protein,
          proteinMax: item.protein,
          carbsMin: item.carbs,
          carbsMax: item.carbs,
          fatMin: item.fat,
          fatMax: item.fat,
        })),
        totalCaloriesMin: entry.calories,
        totalCaloriesMax: entry.calories,
        totalProteinMin: entry.protein,
        totalProteinMax: entry.protein,
        confidence: 'high',
      },
    };
    
    setViewingLoggedEntryId(entry.id);
    setEditedItems(items);
    setHasEdited(false);
    setEditingItemIndex(null);
    setShowAddItem(false);
    setSelectedPending(fakePending);
  };

  const handleShareEntry = (entry: FoodEntry) => {
    const mealName = entry.name.split(',')[0].replace(/\s*\/\s*/g, ' ').replace(/\s+or\s+/gi, ' ').replace(/about\s+/gi, '').trim();
    const mealSubtitle = entry.name.split(',').map(n => n.trim().split(' ')[0]).join(' • ');
    setSelectedPending(null);
    setViewingLoggedEntryId(null);
    router.push({
      pathname: '/story-share',
      params: {
        mealName,
        mealSubtitle,
        calories: entry.calories.toString(),
        protein: entry.protein.toString(),
        carbs: entry.carbs.toString(),
        fat: entry.fat.toString(),
        timestamp: entry.timestamp.toString(),
      },
    });
  };

  

  

  const handlePendingPress = (pending: PendingFoodEntry) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPending(pending);
    if (pending.status === 'done' && pending.analysis) {
      const items = pending.analysis.items.map(item => ({
        name: item.name,
        portion: item.portion,
        calories: Math.round((item.caloriesMin + item.caloriesMax) / 2),
        protein: Math.round((item.proteinMin + item.proteinMax) / 2),
        carbs: Math.round((item.carbsMin + item.carbsMax) / 2),
        fat: Math.round((item.fatMin + item.fatMax) / 2),
      }));
      setEditedItems(items);
      setHasEdited(false);
    }
  };

  const handleClosePendingModal = () => {
    if (hasEdited) {
      Alert.alert(
        'Perubahan Belum Disimpan',
        'Anda memiliki perubahan yang belum disimpan. Yakin ingin keluar?',
        [
          { text: 'Batal', style: 'cancel' },
          { 
            text: 'Keluar', 
            style: 'destructive',
            onPress: () => {
              if (selectedPending && shownPendingIds.has(selectedPending.id) && !viewingLoggedEntryId) {
                removePendingEntry(selectedPending.id);
              }
              setSelectedPending(null);
              setEditedItems([]);
              setHasEdited(false);
              setEditingItemIndex(null);
              setShowAddItem(false);
              setViewingLoggedEntryId(null);
            }
          },
        ]
      );
    } else {
      if (selectedPending && shownPendingIds.has(selectedPending.id) && !viewingLoggedEntryId) {
        removePendingEntry(selectedPending.id);
      }
      setSelectedPending(null);
      setEditedItems([]);
      setHasEdited(false);
      setEditingItemIndex(null);
      setShowAddItem(false);
      setViewingLoggedEntryId(null);
    }
  };

  const handleStartEditItem = (index: number) => {
    const item = editedItems[index];
    setEditingItemIndex(index);
    setEditItemName(item.name);
    setEditItemPortion(item.portion);
    setEditItemCalories(item.calories.toString());
    setEditItemProtein(item.protein.toString());
    setEditItemCarbs(item.carbs.toString());
    setEditItemFat(item.fat.toString());
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSaveEditItem = () => {
    if (editingItemIndex === null) return;
    const updated = [...editedItems];
    updated[editingItemIndex] = {
      name: editItemName || 'Makanan',
      portion: editItemPortion || '1 porsi',
      calories: parseInt(editItemCalories) || 0,
      protein: parseInt(editItemProtein) || 0,
      carbs: parseInt(editItemCarbs) || 0,
      fat: parseInt(editItemFat) || 0,
    };
    setEditedItems(updated);
    setEditingItemIndex(null);
    setHasEdited(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleDeleteItem = (index: number) => {
    const updated = editedItems.filter((_, i) => i !== index);
    setEditedItems(updated);
    setEditingItemIndex(null);
    setHasEdited(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleAddNewItem = () => {
    setShowAddItem(true);
    setEditItemName('');
    setEditItemPortion('');
    setEditItemCalories('');
    setEditItemProtein('');
    setEditItemCarbs('');
    setEditItemFat('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSaveNewItem = () => {
    const newItem = {
      name: editItemName || 'Makanan Baru',
      portion: editItemPortion || '1 porsi',
      calories: parseInt(editItemCalories) || 0,
      protein: parseInt(editItemProtein) || 0,
      carbs: parseInt(editItemCarbs) || 0,
      fat: parseInt(editItemFat) || 0,
    };
    setEditedItems([...editedItems, newItem]);
    setShowAddItem(false);
    setHasEdited(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const getEditedTotals = () => {
    return editedItems.reduce((acc, item) => ({
      calories: acc.calories + item.calories,
      protein: acc.protein + item.protein,
      carbs: acc.carbs + item.carbs,
      fat: acc.fat + item.fat,
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  };

  const handleConfirmEdited = () => {
    if (!selectedPending || editedItems.length === 0) return;
    const totals = getEditedTotals();
    const foodNames = editedItems.map(item => item.name).join(', ');
    
    if (viewingLoggedEntryId) {
      deleteFoodEntry(viewingLoggedEntryId);
      addFoodEntry({
        name: foodNames,
        calories: totals.calories,
        protein: totals.protein,
        carbs: totals.carbs,
        fat: totals.fat,
        photoUri: selectedPending.photoUri || undefined,
      });
    } else if (hasEdited) {
      addFoodEntry({
        name: foodNames,
        calories: totals.calories,
        protein: totals.protein,
        carbs: totals.carbs,
        fat: totals.fat,
        photoUri: selectedPending.photoUri,
      });
      removePendingEntry(selectedPending.id);
    } else {
      removePendingEntry(selectedPending.id);
    }
    
    setSelectedPending(null);
    setEditedItems([]);
    setHasEdited(false);
    setViewingLoggedEntryId(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };



  const handleSaveToFavorite = () => {
    if (!selectedPending || !selectedPending.analysis) return;
    const analysis = selectedPending.analysis;
    const mealName = analysis.items.map(i => i.name).join(', ');
    
    if (isFavorite(mealName)) {
      const favorite = favorites.find(f => f.name.toLowerCase().trim() === mealName.toLowerCase().trim());
      if (favorite) {
        removeFromFavorites(favorite.id);
        setFavoriteToastMessage('Dihapus dari Favorit');
        setShowFavoriteToast(true);
        setTimeout(() => setShowFavoriteToast(false), 2000);
      }
    } else {
      const avgCalories = Math.round((analysis.totalCaloriesMin + analysis.totalCaloriesMax) / 2);
      const avgProtein = Math.round((analysis.totalProteinMin + analysis.totalProteinMax) / 2);
      const avgCarbs = Math.round(analysis.items.reduce((sum, item) => sum + (item.carbsMin + item.carbsMax) / 2, 0));
      const avgFat = Math.round(analysis.items.reduce((sum, item) => sum + (item.fatMin + item.fatMax) / 2, 0));
      
      const added = addToFavorites({
        name: mealName,
        calories: avgCalories,
        protein: avgProtein,
        carbs: avgCarbs,
        fat: avgFat,
      });
      
      if (added) {
        setFavoriteToastMessage('Disimpan ke Favorit ⭐');
        setShowFavoriteToast(true);
        setTimeout(() => setShowFavoriteToast(false), 2000);
      }
    }
  };

  const handleQuickLogFavorite = (favoriteId: string) => {
    logFromFavorite(favoriteId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAddFoodModalVisible(false);
  };

  const handleQuickLogRecent = (recentId: string) => {
    logFromRecent(recentId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAddFoodModalVisible(false);
  };

  const handleSaveSuggestedFavorite = () => {
    const recent = recentMeals.find(r => r.name.toLowerCase().trim() === suggestedMealName.toLowerCase().trim());
    if (recent) {
      addToFavorites({
        name: recent.name,
        calories: recent.calories,
        protein: recent.protein,
        carbs: recent.carbs,
        fat: recent.fat,
      });
    }
    setShowSuggestFavorite(false);
  };

  const handleRemovePending = () => {
    if (!selectedPending) return;
    removePendingEntry(selectedPending.id);
    setSelectedPending(null);
  };

  const handleRetryPending = () => {
    if (!selectedPending) return;
    retryPendingEntry(selectedPending.id);
    setSelectedPending(null);
  };



  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      setModalVisible(true);
      if (result.assets[0].base64) {
        await analyzePhoto(result.assets[0].base64);
      }
    }
  };

  const analyzePhoto = async (base64: string) => {
    setAnalyzing(true);
    try {
      const result = await analyzeMealPhoto(base64);
      setAnalysis(result);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Photo analysis error:', error);
      Alert.alert('Analysis failed', 'Could not analyze the photo. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAddFromAnalysis = () => {
    if (!analysis) return;

    const avgCalories = Math.round((analysis.totalCaloriesMin + analysis.totalCaloriesMax) / 2);
    const avgProtein = Math.round((analysis.totalProteinMin + analysis.totalProteinMax) / 2);
    const foodNames = analysis.items.map(item => item.name).join(', ');

    const estimatedCarbs = Math.round((avgCalories - (avgProtein * 4)) / 4 * 0.6);
    const estimatedFat = Math.round((avgCalories - (avgProtein * 4)) / 9 * 0.4);

    addFoodEntry({
      name: foodNames,
      calories: avgCalories,
      protein: avgProtein,
      carbs: estimatedCarbs,
      fat: estimatedFat,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    resetModal();
  };

  const getMealTimeLabel = (timestamp: number) => {
    const date = new Date(timestamp);
    const hours = date.getHours();
    const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    
    if (hours >= 5 && hours < 11) return { label: 'Sarapan', time: timeStr };
    if (hours >= 11 && hours < 16) return { label: 'Makan Siang', time: timeStr };
    if (hours >= 16 && hours < 21) return { label: 'Makan Malam', time: timeStr };
    return { label: 'Camilan', time: timeStr };
  };

  const handleSelectUSDAFood = (food: USDAFoodItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    addFoodEntry({
      name: food.brandName ? `${food.description} (${food.brandName})` : food.description,
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
    });
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAddFoodModalVisible(false);
    setUsdaSearchQuery('');
    setUsdaSearchResults([]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.background }]}>
          <View style={styles.headerTop}>
            <View style={styles.appNameContainer}>
              <Image 
                source={require('@/assets/images/icon.png')} 
                style={styles.appLogo}
                resizeMode="contain"
              />
              <View>
                <Text style={[styles.appName, { color: theme.text }]}>DietKu</Text>
              </View>
            </View>
            {streakData.currentStreak > 0 && (
              <View style={styles.streakBadge}>
                <Flame size={18} color="#FF6B35" />
                <Text style={styles.streakText}>{streakData.currentStreak}</Text>
              </View>
            )}
          </View>


          
          <View style={styles.dateNavigation}>
            <TouchableOpacity 
              style={[styles.dateNavButton, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={goToPreviousDay}
              activeOpacity={0.7}
            >
              <ChevronLeft size={20} color={theme.text} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.dateCenter}
              onPress={openCalendarPicker}
              activeOpacity={0.7}
            >
              <View style={styles.dateTouchable}>
                <Text style={[styles.dateText, { color: theme.text }]}>{getFormattedDate(selectedDate)}</Text>
                <Calendar size={16} color={theme.textSecondary} style={{ marginLeft: 6 }} />
              </View>
              {!isToday && (
                <TouchableOpacity
                  style={[styles.todayButton, { backgroundColor: theme.primary }]}
                  onPress={(e) => {
                    e.stopPropagation();
                    goToToday();
                  }}
                  activeOpacity={0.7}
                >
                  <Calendar size={12} color="#FFFFFF" />
                  <Text style={styles.todayButtonText}>Hari Ini</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.dateNavButton, { backgroundColor: theme.card, borderColor: theme.border, opacity: isToday ? 0.5 : 1 }]}
              onPress={goToNextDay}
              activeOpacity={0.7}
              disabled={isToday}
            >
              <ChevronRight size={20} color={theme.text} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.carouselContainer}>
            <ScrollView
              horizontal
              pagingEnabled={false}
              showsHorizontalScrollIndicator={false}
              onScroll={(e) => {
                const page = Math.round(e.nativeEvent.contentOffset.x / (CAROUSEL_CARD_WIDTH + CAROUSEL_GAP));
                setCarouselPage(page);
              }}
              scrollEventThrottle={16}
              contentContainerStyle={{ paddingHorizontal: 20, gap: CAROUSEL_GAP, alignItems: 'stretch' }}
              decelerationRate="fast"
              snapToInterval={CAROUSEL_CARD_WIDTH + CAROUSEL_GAP}
              snapToAlignment="start"
            >
              {(() => {
                const proteinPct = dailyTargets.protein > 0 ? Math.round((todayTotals.protein / dailyTargets.protein) * 100) : 0;
                const carbsTarget = dailyTargets.carbsMax || 250;
                const carbsPct = carbsTarget > 0 ? Math.round((todayTotals.carbs / carbsTarget) * 100) : 0;
                const fatTarget = dailyTargets.fatMax || 70;
                const fatPct = fatTarget > 0 ? Math.round((todayTotals.fat / fatTarget) * 100) : 0;
                return (
                  <View style={styles.carouselPageContainer}>
                    <View style={[styles.separatedCard, { backgroundColor: theme.card }]}>
                    <View style={styles.heroCalorieRow}>
                      <View style={styles.heroRingWrap}>
                        <ProgressRing
                          progress={Math.min((progress?.caloriesProgress || 0), 100)}
                          size={110}
                          strokeWidth={12}
                          color={(progress?.isOver || false) ? '#C53030' : '#4CAF7D'}
                          backgroundColor={theme.border}
                        >
                          <View style={styles.heroRingContent}>
                            <Flame size={16} color={theme.textTertiary} />
                            <Text style={[styles.heroCalValue, { color: progress?.isOver ? theme.destructive : theme.text }]}>
                              {todayTotals.calories}
                            </Text>
                            <Text style={[styles.heroCalLabel, { color: theme.textSecondary }]}>kalori</Text>
                          </View>
                        </ProgressRing>
                      </View>
                      <View style={styles.heroDetailsCol}>
                        <View style={styles.heroStatRow}>
                          <Target size={13} color="#4CAF7D" />
                          <Text style={[styles.heroStatLabel, { color: theme.textSecondary }]}>Target</Text>
                          <Text style={[styles.heroStatValue, { color: theme.text }]}>{dailyTargets.calories.toLocaleString()}</Text>
                        </View>
                        <View style={styles.heroStatRow}>
                          <Utensils size={13} color="#F59E0B" />
                          <Text style={[styles.heroStatLabel, { color: theme.textSecondary }]}>Makan</Text>
                          <Text style={[styles.heroStatValue, { color: '#F59E0B' }]}>-{todayTotals.calories.toLocaleString()}</Text>
                        </View>
                        <View style={styles.heroStatRow}>
                          <Dumbbell size={13} color="#4CAF7D" />
                          <Text style={[styles.heroStatLabel, { color: theme.textSecondary }]}>Olahraga</Text>
                          <Text style={[styles.heroStatValue, { color: '#4CAF7D' }]}>+{totalCaloriesBurned}</Text>
                        </View>
                        <View style={[styles.heroRemainingDivider, { backgroundColor: theme.border }]} />
                        <Text style={[styles.heroRemainingLabel, { color: theme.textSecondary }]}>{progress?.isOver ? 'BERLEBIH' : 'TERSISA'}</Text>
                        <Text style={[styles.heroRemainingValue, { color: progress?.isOver ? theme.destructive : theme.text }]}>
                          {progress?.isOver ? `+${Math.abs(progress?.caloriesRemaining || 0).toLocaleString()}` : Math.max(0, progress?.caloriesRemaining || 0).toLocaleString()}
                        </Text>
                      </View>
                    </View>
                    </View>
                    <View style={styles.macroCardsRow}>
                      <View style={[styles.macroSeparateCard, styles.separatedCard, { backgroundColor: theme.card }]}>
                        <ProgressRing
                          progress={Math.min(proteinPct, 100)}
                          size={44}
                          strokeWidth={5}
                          color="#FF8A80"
                          backgroundColor={theme.border}
                        >
                          <Text style={styles.macroCardEmoji}>🍗</Text>
                        </ProgressRing>
                        <View style={styles.macroCardValues}>
                          <Text style={[styles.macroCardCurrent, { color: theme.text }]}>{todayTotals.protein}</Text>
                          <Text style={[styles.macroCardTarget, { color: theme.textTertiary }]}>/ {dailyTargets.protein}g</Text>
                        </View>
                        <View style={styles.macroCardFooter}>
                          <Text style={[styles.macroCardName, { color: theme.textSecondary }]}>Protein</Text>
                          <View style={[styles.macroCardPctBadge, { backgroundColor: 'rgba(255,138,128,0.15)' }]}>
                            <Text style={[styles.macroCardPctText, { color: '#FF8A80' }]}>{proteinPct}%</Text>
                          </View>
                        </View>
                      </View>
                      <View style={[styles.macroSeparateCard, styles.separatedCard, { backgroundColor: theme.card }]}>
                        <ProgressRing
                          progress={Math.min(carbsPct, 100)}
                          size={44}
                          strokeWidth={5}
                          color="#FFD54F"
                          backgroundColor={theme.border}
                        >
                          <Text style={styles.macroCardEmoji}>🌾</Text>
                        </ProgressRing>
                        <View style={styles.macroCardValues}>
                          <Text style={[styles.macroCardCurrent, { color: theme.text }]}>{todayTotals.carbs}</Text>
                          <Text style={[styles.macroCardTarget, { color: theme.textTertiary }]}>/ {carbsTarget}g</Text>
                        </View>
                        <View style={styles.macroCardFooter}>
                          <Text style={[styles.macroCardName, { color: theme.textSecondary }]}>Karbo</Text>
                          <View style={[styles.macroCardPctBadge, { backgroundColor: 'rgba(255,213,79,0.15)' }]}>
                            <Text style={[styles.macroCardPctText, { color: '#F0C040' }]}>{carbsPct}%</Text>
                          </View>
                        </View>
                      </View>
                      <View style={[styles.macroSeparateCard, styles.separatedCard, { backgroundColor: theme.card }]}>
                        <ProgressRing
                          progress={Math.min(fatPct, 100)}
                          size={44}
                          strokeWidth={5}
                          color="#80DEEA"
                          backgroundColor={theme.border}
                        >
                          <Text style={styles.macroCardEmoji}>🥑</Text>
                        </ProgressRing>
                        <View style={styles.macroCardValues}>
                          <Text style={[styles.macroCardCurrent, { color: theme.text }]}>{todayTotals.fat}</Text>
                          <Text style={[styles.macroCardTarget, { color: theme.textTertiary }]}>/ {fatTarget}g</Text>
                        </View>
                        <View style={styles.macroCardFooter}>
                          <Text style={[styles.macroCardName, { color: theme.textSecondary }]}>Lemak</Text>
                          <View style={[styles.macroCardPctBadge, { backgroundColor: 'rgba(128,222,234,0.15)' }]}>
                            <Text style={[styles.macroCardPctText, { color: '#80DEEA' }]}>{fatPct}%</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })()}

              <View style={styles.carouselPageContainer}>
                {(() => {
                  const currentSugar = getTodaySugarUnits();
                  const currentFiber = getTodayFiberUnits();
                  const currentSodium = getTodaySodiumUnits();
                  const sugarPct = SUGAR_TARGET_G > 0 ? Math.round((currentSugar / SUGAR_TARGET_G) * 100) : 0;
                  const fiberPct = FIBER_TARGET_G > 0 ? Math.round((currentFiber / FIBER_TARGET_G) * 100) : 0;
                  const sodiumPct = SODIUM_TARGET_MG > 0 ? Math.round((currentSodium / SODIUM_TARGET_MG) * 100) : 0;
                  return (
                    <View style={styles.macroCardsRow}>
                      <View style={[styles.macroSeparateCard, styles.separatedCard, { backgroundColor: theme.card }]}>
                        <ProgressRing
                          progress={Math.min(sugarPct, 100)}
                          size={44}
                          strokeWidth={5}
                          color="#EC4899"
                          backgroundColor={theme.border}
                        >
                          <Text style={styles.macroCardEmoji}>🍬</Text>
                        </ProgressRing>
                        <View style={styles.macroCardValues}>
                          <Text style={[styles.macroCardCurrent, { color: theme.text }]}>{currentSugar}</Text>
                          <Text style={[styles.macroCardTarget, { color: theme.textTertiary }]}>/ {SUGAR_TARGET_G}g</Text>
                        </View>
                        <View style={styles.macroCardFooter}>
                          <Text style={[styles.macroCardName, { color: theme.textSecondary }]}>Gula</Text>
                          <View style={[styles.macroCardPctBadge, { backgroundColor: 'rgba(236,72,153,0.15)' }]}>
                            <Text style={[styles.macroCardPctText, { color: '#EC4899' }]}>{sugarPct}%</Text>
                          </View>
                        </View>
                      </View>
                      <View style={[styles.macroSeparateCard, styles.separatedCard, { backgroundColor: theme.card }]}>
                        <ProgressRing
                          progress={Math.min(fiberPct, 100)}
                          size={44}
                          strokeWidth={5}
                          color="#8B5CF6"
                          backgroundColor={theme.border}
                        >
                          <Text style={styles.macroCardEmoji}>🥦</Text>
                        </ProgressRing>
                        <View style={styles.macroCardValues}>
                          <Text style={[styles.macroCardCurrent, { color: theme.text }]}>{currentFiber}</Text>
                          <Text style={[styles.macroCardTarget, { color: theme.textTertiary }]}>/ {FIBER_TARGET_G}g</Text>
                        </View>
                        <View style={styles.macroCardFooter}>
                          <Text style={[styles.macroCardName, { color: theme.textSecondary }]}>Serat</Text>
                          <View style={[styles.macroCardPctBadge, { backgroundColor: 'rgba(139,92,246,0.15)' }]}>
                            <Text style={[styles.macroCardPctText, { color: '#8B5CF6' }]}>{fiberPct}%</Text>
                          </View>
                        </View>
                      </View>
                      <View style={[styles.macroSeparateCard, styles.separatedCard, { backgroundColor: theme.card }]}>
                        <ProgressRing
                          progress={Math.min(sodiumPct, 100)}
                          size={44}
                          strokeWidth={5}
                          color="#F97316"
                          backgroundColor={theme.border}
                        >
                          <Text style={styles.macroCardEmoji}>🧂</Text>
                        </ProgressRing>
                        <View style={styles.macroCardValues}>
                          <Text style={[styles.macroCardCurrent, { color: theme.text }]}>{currentSodium < 1000 ? currentSodium : (currentSodium / 1000).toFixed(1)}</Text>
                          <Text style={[styles.macroCardTarget, { color: theme.textTertiary }]}>/ {(SODIUM_TARGET_MG / 1000).toFixed(1)}g</Text>
                        </View>
                        <View style={styles.macroCardFooter}>
                          <Text style={[styles.macroCardName, { color: theme.textSecondary }]}>Sodium</Text>
                          <View style={[styles.macroCardPctBadge, { backgroundColor: 'rgba(249,115,22,0.15)' }]}>
                            <Text style={[styles.macroCardPctText, { color: '#F97316' }]}>{sodiumPct}%</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                })()}
                <View style={[styles.separatedCard, styles.waterCardExpanded, { backgroundColor: theme.card, flex: 1 }]}>
                  {(() => {
                    const currentWater = getTodayWaterCups();
                    const waterTarget = 8;
                    const waterPct = Math.round((currentWater / waterTarget) * 100);
                    return (
                      <View style={styles.waterCompactExpanded}>
                        <View style={styles.waterHeaderExpanded}>
                          <View style={styles.waterIconBadge}>
                            <Droplets size={18} color="#38BDF8" />
                          </View>
                          <View style={styles.waterHeaderTextCol}>
                            <Text style={[styles.waterTitleExpanded, { color: theme.text }]}>Air</Text>
                            <Text style={[styles.waterSubtitleExpanded, { color: theme.textTertiary }]}>{currentWater} dari {waterTarget} gelas</Text>
                          </View>
                          <View style={[styles.waterPctBadge, { backgroundColor: 'rgba(56,189,248,0.12)' }]}>
                            <Text style={styles.waterPctText}>{waterPct}%</Text>
                          </View>
                        </View>
                        <View style={styles.waterProgressBarWrap}>
                          <View style={[styles.waterProgressBarBg, { backgroundColor: theme.border }]}>
                            <View style={[styles.waterProgressBarFill, { width: `${Math.min(waterPct, 100)}%` }]} />
                          </View>
                        </View>
                        <View style={styles.waterControlsExpanded}>
                          <TouchableOpacity
                            style={[styles.waterBtnExpanded, { backgroundColor: theme.background, borderColor: theme.border }]}
                            onPress={removeWaterCup}
                            activeOpacity={0.7}
                          >
                            <Minus size={14} color={theme.textSecondary} />
                          </TouchableOpacity>
                          <View style={styles.waterDotsExpanded}>
                            {Array.from({ length: waterTarget }).map((_, i) => (
                              <View
                                key={i}
                                style={[
                                  styles.waterDotExpanded,
                                  { backgroundColor: i < currentWater ? '#38BDF8' : theme.border },
                                ]}
                              />
                            ))}
                          </View>
                          <TouchableOpacity
                            style={[styles.waterBtnExpanded, { backgroundColor: '#38BDF8', borderColor: 'transparent' }]}
                            onPress={addWaterCup}
                            activeOpacity={0.7}
                          >
                            <Plus size={14} color="#FFFFFF" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })()}
                </View>
              </View>

              <View style={styles.carouselPageContainer}>
                <View style={styles.activitySeparateRow}>
                  <TouchableOpacity
                    style={[styles.activitySeparateCard, styles.separatedCard, { backgroundColor: theme.card }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push('/log-exercise');
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.activitySeparateIconWrap, { backgroundColor: '#EFF6FF' }]}>
                      <Footprints size={16} color="#3B82F6" />
                    </View>
                    <Text style={[styles.activitySeparateVal, { color: theme.text }]}>{todaySteps.toLocaleString()}</Text>
                    <Text style={[styles.activitySeparateLabel, { color: theme.textSecondary }]}>Langkah</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.activitySeparateCard, styles.separatedCard, { backgroundColor: theme.card }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push('/log-exercise');
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.activitySeparateIconWrap, { backgroundColor: '#FEF2F2' }]}>
                      <Flame size={16} color="#EF4444" />
                    </View>
                    <Text style={[styles.activitySeparateVal, { color: theme.text }]}>{totalCaloriesBurned}</Text>
                    <Text style={[styles.activitySeparateLabel, { color: theme.textSecondary }]}>kcal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.activitySeparateCard, styles.separatedCard, { backgroundColor: theme.card }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push('/log-exercise');
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.activitySeparateIconWrap, { backgroundColor: '#FFFBEB' }]}>
                      <Dumbbell size={16} color="#F59E0B" />
                    </View>
                    <Text style={[styles.activitySeparateVal, { color: theme.text }]}>{todayExercises.length}</Text>
                    <Text style={[styles.activitySeparateLabel, { color: theme.textSecondary }]}>Latihan</Text>
                  </TouchableOpacity>
                </View>

                <View style={[styles.separatedCard, { backgroundColor: theme.card, flex: 1 }]}>
                  <View style={styles.exCardHeaderRow}>
                    <Text style={[styles.exCardTitle, { color: theme.text }]}>Catat Aktivitas</Text>
                  </View>
                  <View style={styles.exModeTabsCompact}>
                    {([{ key: 'quick' as const, label: 'Cepat', Icon: Zap }, { key: 'describe' as const, label: 'Jelaskan', Icon: MessageSquare }, { key: 'manual' as const, label: 'Manual', Icon: Edit3 }]).map(({ key, label, Icon }) => (
                      <TouchableOpacity
                        key={key}
                        style={[styles.exModeTabCompact, exerciseMode === key && { backgroundColor: theme.background }]}
                        onPress={() => {
                          setExerciseMode(key);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                        activeOpacity={0.7}
                      >
                        <Icon size={11} color={exerciseMode === key ? theme.primary : theme.textSecondary} />
                        <Text style={{ fontSize: 10, fontWeight: '600' as const, color: exerciseMode === key ? theme.primary : theme.textSecondary }}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.exFixedContent}>
                    {exerciseMode === 'quick' && (
                      <View style={styles.exQuickContentCompact}>
                        <View style={styles.exQuickGridCompact}>
                          {QUICK_EXERCISES.map((ex) => (
                            <TouchableOpacity
                              key={ex.type}
                              style={[
                                styles.exQuickGridChip,
                                { backgroundColor: theme.background, borderColor: selectedQuickExercise?.type === ex.type ? theme.primary : theme.border },
                                selectedQuickExercise?.type === ex.type && { borderWidth: 2 },
                              ]}
                              onPress={() => {
                                setSelectedQuickExercise(selectedQuickExercise?.type === ex.type ? null : ex);
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              }}
                              activeOpacity={0.7}
                            >
                              <Text style={{ fontSize: 14 }}>{ex.emoji}</Text>
                              <Text style={[{ fontSize: 10, fontWeight: '500' as const }, { color: theme.text }]}>{ex.label}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        {selectedQuickExercise && (
                          <View style={styles.exQuickInputRowCompact}>
                            <TextInput
                              style={[styles.exQuickInputCompact, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                              placeholder="Min"
                              placeholderTextColor={theme.textTertiary}
                              keyboardType="numeric"
                              value={quickDuration}
                              onChangeText={setQuickDuration}
                            />
                            <TouchableOpacity
                              style={[styles.exLogBtnCompact, !quickDuration && { opacity: 0.5 }]}
                              disabled={!quickDuration}
                              onPress={() => {
                                const mins = parseInt(quickDuration);
                                if (isNaN(mins) || mins <= 0) return;
                                addExercise({
                                  type: selectedQuickExercise.type,
                                  name: selectedQuickExercise.label,
                                  caloriesBurned: Math.round(selectedQuickExercise.caloriesPerMinute * mins),
                                  duration: mins,
                                });
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                setSelectedQuickExercise(null);
                                setQuickDuration('');
                              }}
                              activeOpacity={0.8}
                            >
                              <Check size={14} color="#FFF" />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    )}

                    {exerciseMode === 'describe' && (
                      <View style={styles.exDescribeContentCompact}>
                        <View style={styles.exDescribeInputRowCompact}>
                          <TextInput
                            style={[styles.exDescribeInputFixed, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                            placeholder="Contoh: Lari 30 menit di taman..."
                            placeholderTextColor={theme.textTertiary}
                            value={exerciseDescription}
                            onChangeText={setExerciseDescription}
                            multiline
                            numberOfLines={2}
                            textAlignVertical="top"
                          />
                          <TouchableOpacity
                            style={[styles.exLogBtnCompact, (!exerciseDescription.trim() || isAnalyzingExercise) && { opacity: 0.5 }]}
                            disabled={!exerciseDescription.trim() || isAnalyzingExercise}
                            onPress={async () => {
                              if (!exerciseDescription.trim()) return;
                              setIsAnalyzingExercise(true);
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                              try {
                                const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
                                if (!apiKey) {
                                  addExercise({ type: 'describe' as ExerciseType, name: exerciseDescription.trim(), caloriesBurned: Math.round(50 + Math.random() * 200), description: exerciseDescription.trim() });
                                  setExerciseDescription('');
                                  return;
                                }
                                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                                  body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: 'You estimate calories burned from exercise descriptions. Return ONLY a JSON object with "calories" (number) and "name" (short exercise name in Indonesian). Example: {"calories": 250, "name": "Renang 30 menit"}' }, { role: 'user', content: `Estimate calories burned: "${exerciseDescription.trim()}"` }], max_tokens: 100, temperature: 0.3 }),
                                });
                                const data = await response.json();
                                const aiContent = data.choices?.[0]?.message?.content || '';
                                let parsed: { calories: number; name: string };
                                try { const m = aiContent.match(/\{[\s\S]*\}/); parsed = JSON.parse(m ? m[0] : aiContent); } catch { parsed = { calories: 150, name: exerciseDescription.trim().slice(0, 30) }; }
                                addExercise({ type: 'describe' as ExerciseType, name: parsed.name || exerciseDescription.trim().slice(0, 30), caloriesBurned: parsed.calories || 150, description: exerciseDescription.trim() });
                                setExerciseDescription('');
                              } catch (error) {
                                console.error('Exercise describe error:', error);
                                addExercise({ type: 'describe' as ExerciseType, name: exerciseDescription.trim().slice(0, 30), caloriesBurned: 150, description: exerciseDescription.trim() });
                                setExerciseDescription('');
                              } finally {
                                setIsAnalyzingExercise(false);
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                              }
                            }}
                            activeOpacity={0.8}
                          >
                            {isAnalyzingExercise ? <ActivityIndicator size="small" color="#FFF" /> : <Send size={14} color="#FFF" />}
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    {exerciseMode === 'manual' && (
                      <View style={styles.exManualContentTight}>
                        <View style={styles.exManualRowTight}>
                          <TextInput
                            style={[styles.exManualInputTight, { flex: 1, backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                            placeholder="Nama aktivitas"
                            placeholderTextColor={theme.textTertiary}
                            value={manualExName}
                            onChangeText={setManualExName}
                          />
                        </View>
                        <View style={styles.exManualRowTight}>
                          <TextInput
                            style={[styles.exManualInputTight, { flex: 1, backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                            placeholder="Kalori"
                            placeholderTextColor={theme.textTertiary}
                            keyboardType="numeric"
                            value={manualExCalories}
                            onChangeText={setManualExCalories}
                          />
                          <TextInput
                            style={[styles.exManualInputTight, { flex: 1, backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                            placeholder="Menit"
                            placeholderTextColor={theme.textTertiary}
                            keyboardType="numeric"
                            value={manualExDuration}
                            onChangeText={setManualExDuration}
                          />
                          <TouchableOpacity
                            style={[styles.exLogBtnCompact, (!manualExName.trim() || !manualExCalories) && { opacity: 0.5 }]}
                            disabled={!manualExName.trim() || !manualExCalories}
                            onPress={() => {
                              const cals = parseInt(manualExCalories);
                              if (isNaN(cals) || cals <= 0) return;
                              addExercise({ type: 'manual' as ExerciseType, name: manualExName.trim(), caloriesBurned: cals, duration: manualExDuration ? parseInt(manualExDuration) : undefined });
                              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                              setManualExName('');
                              setManualExCalories('');
                              setManualExDuration('');
                            }}
                            activeOpacity={0.8}
                          >
                            <Check size={14} color="#FFF" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </ScrollView>
            <View style={styles.carouselDots}>
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.carouselDot,
                    { backgroundColor: carouselPage === i ? theme.primary : theme.border },
                    carouselPage === i && { width: 18 },
                  ]}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Makanan {isToday ? 'Hari Ini' : 'pada Tanggal Ini'}</Text>
              <Text style={[styles.foodCount, { color: theme.textSecondary }]}>{todayEntries.length + pendingEntries.length} item</Text>
            </View>

            {todayEntries.length === 0 && pendingEntries.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Flame size={48} color={theme.textTertiary} />
                </View>
                <Text style={[styles.emptyText, { color: theme.text }]}>Belum ada makanan yang dicatat</Text>
                <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>Ketuk tombol kamera untuk menambahkan makanan pertama Anda</Text>
              </View>
            ) : (
              <View style={styles.foodList}>
                {pendingEntries.map((pending) => {
                  const { label, time } = getMealTimeLabel(pending.timestamp);
                  const isAnalyzing = pending.status === 'analyzing';
                  const hasError = pending.status === 'error';
                  const isDone = pending.status === 'done';
                  
                  return (
                    <TouchableOpacity
                      key={pending.id}
                      style={[styles.foodItem, { backgroundColor: theme.card, borderColor: theme.border }]}
                      onPress={() => handlePendingPress(pending)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.pendingThumbnailContainer}>
                        <Image source={{ uri: pending.photoUri }} style={styles.pendingThumbnail} />
                        {isAnalyzing && (
                          <View style={styles.pendingOverlay}>
                            <ActivityIndicator size="small" color={theme.primary} />
                          </View>
                        )}
                        {hasError && (
                          <View style={[styles.pendingOverlay, styles.pendingErrorOverlay]}>
                            <X size={18} color="#C53030" />
                          </View>
                        )}

                      </View>
                      <View style={styles.foodInfo}>
                        <View style={styles.foodHeader}>
                          <Text style={[styles.mealTimeLabel, { color: theme.text }]} numberOfLines={1}>
                            {isAnalyzing ? 'Menganalisis...' : hasError ? 'Gagal analisis' : isDone && pending.analysis ? (pending.analysis.items[0]?.name.replace(/\s*\/\s*/g, ' ').replace(/\s+or\s+/gi, ' ').replace(/about\s+/gi, '').trim() || label) : label}
                          </Text>
                          <Text style={[styles.mealTime, { color: theme.textSecondary }]}>{time}</Text>
                        </View>
                        <Text style={[styles.foodCalories, { color: isAnalyzing ? theme.primary : hasError ? theme.destructive : theme.textTertiary }]}>
                          {isAnalyzing ? 'Sedang diproses...' : hasError ? 'Ketuk untuk coba lagi' : isDone && pending.analysis ? `${Math.round((pending.analysis.totalCaloriesMin + pending.analysis.totalCaloriesMax) / 2)} kcal` : ''}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
                {todayEntries.map((entry) => {
                  const { time } = getMealTimeLabel(entry.timestamp);
                  
                  return (
                    <TouchableOpacity
                      key={entry.id}
                      style={[styles.foodItem, { backgroundColor: theme.card, borderColor: theme.border }]}
                      onPress={() => handleViewEntry(entry)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.foodThumbnail, { backgroundColor: theme.background }]}>
                        <Camera size={18} color={theme.textSecondary} />
                      </View>
                      <View style={styles.foodInfo}>
                        <Text style={[styles.mealTimeLabel, { color: theme.text }]} numberOfLines={1}>
                          {entry.name.split(',')[0].replace(/\s*\/\s*/g, ' ').replace(/\s+or\s+/gi, ' ').replace(/about\s+/gi, '').trim()}
                        </Text>
                        <Text style={[styles.foodCalories, { color: theme.textTertiary }]}>{entry.calories} kcal</Text>
                      </View>
                      <View style={styles.timeDeleteColumn}>
                        <Text style={[styles.mealTime, { color: theme.textSecondary }]}>{time}</Text>
                        <TouchableOpacity
                          style={styles.deleteEntryButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            Alert.alert(
                              'Hapus Makanan',
                              'Yakin ingin menghapus makanan ini?',
                              [
                                { text: 'Batal', style: 'cancel' },
                                { 
                                  text: 'Hapus', 
                                  style: 'destructive',
                                  onPress: () => {
                                    deleteFoodEntry(entry.id);
                                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                  }
                                },
                              ]
                            );
                          }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Trash2 size={14} color={theme.textTertiary} />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.bottomPadding} />
        </ScrollView>

        <TouchableOpacity
          style={styles.fabCircle}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setActiveTab('recent');
            setAddFoodModalVisible(true);
          }}
          activeOpacity={0.8}
        >
          <Plus size={28} color="#FFFFFF" />
        </TouchableOpacity>

        {showMotivationalToast && motivationalMessage && (
          <Animated.View 
            style={[
              styles.motivationalToast,
              {
                transform: [{ translateY: motivationalToastAnim }],
                opacity: motivationalToastOpacity,
              }
            ]}
          >
            <View style={[
              styles.motivationalToastContent,
              motivationalMessage.isWarning && styles.motivationalToastWarning,
              motivationalMessage.isCelebration && styles.motivationalToastCelebration
            ]}>
              <Text style={styles.motivationalToastEmoji}>{motivationalMessage.emoji}</Text>
              <Text style={styles.motivationalToastText}>{motivationalMessage.text}</Text>
            </View>
          </Animated.View>
        )}

        <Modal
          visible={showCalendarPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowCalendarPicker(false)}
        >
          <TouchableOpacity
            style={styles.calendarModalOverlay}
            activeOpacity={1}
            onPress={() => setShowCalendarPicker(false)}
          >
            <View style={[styles.calendarModalContent, { backgroundColor: theme.card }]}>
              <TouchableOpacity activeOpacity={1}>
                <View style={styles.calendarHeader}>
                  <TouchableOpacity onPress={goToPreviousMonth} style={styles.calendarNavBtn}>
                    <ChevronLeft size={22} color={theme.text} />
                  </TouchableOpacity>
                  <Text style={[styles.calendarMonthText, { color: theme.text }]}>
                    {getMonthName(calendarMonth.month)} {calendarMonth.year}
                  </Text>
                  <TouchableOpacity 
                    onPress={goToNextMonth} 
                    style={[styles.calendarNavBtn, {
                      opacity: (calendarMonth.year === new Date().getFullYear() && calendarMonth.month >= new Date().getMonth()) ? 0.3 : 1
                    }]}
                  >
                    <ChevronRight size={22} color={theme.text} />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.calendarWeekdays}>
                  {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((day, i) => (
                    <Text key={i} style={[styles.calendarWeekday, { color: theme.textSecondary }]}>{day}</Text>
                  ))}
                </View>
                
                <View style={styles.calendarGrid}>
                  {getCalendarDays().map((item, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.calendarDay,
                        item.isSelected && styles.calendarDaySelected,
                        item.isToday && !item.isSelected && [styles.calendarDayToday, { borderColor: theme.primary }],
                      ]}
                      onPress={() => item.isCurrentMonth && item.isSelectable && selectDateFromCalendar(item.day)}
                      disabled={!item.isCurrentMonth || !item.isSelectable}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.calendarDayText,
                        { color: item.isCurrentMonth ? (item.isSelectable ? theme.text : theme.textTertiary) : 'transparent' },
                        item.isSelected && styles.calendarDayTextSelected,
                      ]}>
                        {item.day || ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        <Modal
          visible={modalVisible}
          transparent
          animationType="slide"
          onRequestClose={resetModal}
        >
          <KeyboardAvoidingView
            style={styles.modalContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={resetModal}
            />
            
            <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
              <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Tambah Makanan</Text>
                <TouchableOpacity onPress={resetModal}>
                  <X size={24} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>

                {analyzing && (
                  <View style={styles.analyzingContainer}>
                    <ActivityIndicator size="large" color={theme.primary} />
                    <Text style={[styles.analyzingText, { color: theme.textSecondary }]}>Menganalisis makanan Anda...</Text>
                  </View>
                )}

                {photoUri && !analyzing && analysis && (
                  <View style={styles.analysisContainer}>
                    <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                    
                    <View style={[styles.confidenceBadge, { backgroundColor: theme.background }]}>
                      <Text style={[styles.confidenceText, { color: theme.text }]}>
                        {analysis.confidence === 'high' ? 'Tinggi' : 
                         analysis.confidence === 'medium' ? 'Sedang' : 'Rendah'} kepercayaan
                      </Text>
                    </View>

                    <View style={[styles.totalEstimate, { backgroundColor: theme.background, borderColor: theme.border }]}>
                      <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>Estimasi Total</Text>
                      <Text style={[styles.totalCalories, { color: theme.text }]}>
                        {analysis.totalCaloriesMin} - {analysis.totalCaloriesMax} kcal
                      </Text>
                      <Text style={[styles.totalProtein, { color: theme.text }]}>
                        {analysis.totalProteinMin} - {analysis.totalProteinMax}g protein
                      </Text>
                    </View>

                    <View style={styles.itemsList}>
                      <Text style={[styles.itemsTitle, { color: theme.text }]}>Item Teridentifikasi</Text>
                      {analysis.items.map((item, index) => (
                        <View key={index} style={[styles.foodItemCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
                          <Text style={[styles.itemName, { color: theme.text }]}>{item.name}</Text>
                          <Text style={[styles.itemPortion, { color: theme.textSecondary }]}>{item.portion}</Text>
                          <Text style={[styles.itemCalories, { color: theme.textTertiary }]}>
                            {item.caloriesMin}-{item.caloriesMax} kcal • {item.proteinMin}-{item.proteinMax}g protein
                          </Text>
                        </View>
                      ))}
                    </View>

                    {analysis.tips && analysis.tips.length > 0 && (
                      <View style={[styles.tipsContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
                        <Text style={[styles.tipsTitle, { color: theme.text }]}>Tips</Text>
                        {analysis.tips.map((tip, index) => (
                          <Text key={index} style={[styles.tipText, { color: theme.textTertiary }]}>• {tip}</Text>
                        ))}
                      </View>
                    )}

                    <View style={styles.buttonRow}>
                      <TouchableOpacity
                        style={[styles.retakeButton, { backgroundColor: theme.background, borderColor: theme.border }]}
                        onPress={() => {
                          setPhotoUri(null);
                          setAnalysis(null);
                        }}
                      >
                        <Camera size={18} color={theme.textSecondary} />
                        <Text style={[styles.retakeText, { color: theme.textSecondary }]}>Ambil Ulang</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.confirmButton}
                        onPress={handleAddFromAnalysis}
                      >
                        <Check size={20} color="#FFFFFF" />
                        <Text style={styles.confirmText}>Tambah ke Log</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {!photoUri && !showManualEntry && (
                  <View style={[styles.bottomOptions, { backgroundColor: theme.background }]}>
                    <TouchableOpacity
                      style={styles.bottomOption}
                      onPress={handlePickImage}
                      activeOpacity={0.7}
                    >
                      <ImageIcon size={22} color={theme.text} />
                      <Text style={[styles.bottomOptionText, { color: theme.text }]}>Pilih dari galeri</Text>
                    </TouchableOpacity>
                    <View style={[styles.bottomOptionDivider, { backgroundColor: theme.border }]} />
                    <TouchableOpacity
                      style={styles.bottomOption}
                      onPress={() => {
                        setShowManualEntry(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.bottomOptionText, { color: theme.text }]}>Masukkan manual</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {showManualEntry && (
                  <View>
                    <TouchableOpacity
                      style={[styles.optionalImagePicker, { backgroundColor: theme.background, borderColor: theme.border }]}
                      onPress={async () => {
                        const result = await ImagePicker.launchImageLibraryAsync({
                          mediaTypes: ['images'],
                          allowsEditing: true,
                          aspect: [4, 3],
                          quality: 0.8,
                        });
                        if (!result.canceled && result.assets[0]) {
                          setPhotoUri(result.assets[0].uri);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      {photoUri ? (
                        <View style={styles.optionalImagePreviewContainer}>
                          <Image source={{ uri: photoUri }} style={styles.optionalImagePreview} />
                          <TouchableOpacity
                            style={styles.removeImageButton}
                            onPress={() => setPhotoUri(null)}
                          >
                            <X size={16} color="#FFFFFF" />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={styles.optionalImagePlaceholder}>
                          <ImageIcon size={24} color={theme.textTertiary} />
                          <Text style={[styles.optionalImageText, { color: theme.textSecondary }]}>Tambah Foto (Opsional)</Text>
                        </View>
                      )}
                    </TouchableOpacity>

                    <View style={styles.inputGroup}>
                      <Text style={[styles.inputLabel, { color: theme.text }]}>Apa yang Anda makan?</Text>
                      <TextInput
                        style={[styles.textInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                        placeholder="mis., Dada ayam, Nasi goreng..."
                        placeholderTextColor={theme.textSecondary}
                        value={foodName}
                        onChangeText={setFoodName}
                      />
                    </View>

                    <View style={styles.inputRow}>
                      <View style={[styles.inputGroup, styles.inputGroupHalf]}>
                        <Text style={[styles.inputLabel, { color: theme.text }]}>Kalori</Text>
                        <TextInput
                          style={[styles.textInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                          placeholder="250"
                          placeholderTextColor={theme.textSecondary}
                          keyboardType="numeric"
                          value={calories}
                          onChangeText={setCalories}
                        />
                      </View>

                      <View style={[styles.inputGroup, styles.inputGroupHalf]}>
                        <Text style={[styles.inputLabel, { color: theme.text }]}>Protein (g)</Text>
                        <TextInput
                          style={[styles.textInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                          placeholder="30"
                          placeholderTextColor={theme.textSecondary}
                          keyboardType="numeric"
                          value={protein}
                          onChangeText={setProtein}
                        />
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[styles.addButton, (!foodName || !calories) && styles.addButtonDisabled]}
                      onPress={handleAddFood}
                      disabled={!foodName || !calories}
                    >
                      <Check size={20} color="#FFFFFF" />
                      <Text style={styles.addButtonText}>Tambah Makanan</Text>
                    </TouchableOpacity>
                  </View>
                )}

              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
        {/* Pending Entry Detail Modal */}
        <Modal
          visible={!!selectedPending}
          transparent
          animationType="slide"
          onRequestClose={handleClosePendingModal}
        >
          <View style={styles.pendingModalContainer}>
            <TouchableOpacity
              style={styles.pendingModalOverlay}
              activeOpacity={1}
              onPress={handleClosePendingModal}
            />
            
            <View style={[styles.pendingModalContent, { backgroundColor: theme.card }]}>
              <View style={[styles.pendingModalHeader, { borderBottomColor: theme.border }]}>
                {selectedPending?.status === 'done' && selectedPending.analysis ? (
                  <View style={styles.pendingModalTitleContainer}>
                    <Text style={[styles.pendingModalTitle, { color: theme.text }]} numberOfLines={1}>
                      {(() => {
                        const items = selectedPending.analysis.items.map(i => i.name);
                        const mainDish = items[0] || 'Makanan';
                        return mainDish
                          .replace(/\s*\/\s*/g, ' ')
                          .replace(/\s+or\s+/gi, ' ')
                          .replace(/about\s+/gi, '')
                          .trim();
                      })()}
                    </Text>
                    <Text style={[styles.pendingModalSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
                      {selectedPending.analysis.items.map(item => {
                        const cleanName = item.name
                          .replace(/\s*\/\s*/g, ', ')
                          .replace(/\s+or\s+/gi, ', ')
                          .replace(/about\s+/gi, '')
                          .split(',')
                          .map(s => s.trim())
                          .filter(Boolean)[0] || item.name;
                        return cleanName;
                      }).join(' • ')}
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.pendingModalTitle, { color: theme.text }]}>
                    {selectedPending?.status === 'analyzing' ? 'Menganalisis...' : 
                     selectedPending?.status === 'error' ? 'Gagal Analisis' : 'Detail Makanan'}
                  </Text>
                )}
                <View style={styles.pendingHeaderActions}>
                  {selectedPending?.status === 'done' && selectedPending.analysis && (
                    <>
                      <TouchableOpacity
                        style={styles.shareHeaderButton}
                        onPress={() => {
                          if (!selectedPending?.analysis) return;
                          const analysis = selectedPending.analysis;
                          const mealName = analysis.items[0]?.name
                            .replace(/\s*\/\s*/g, ' ')
                            .replace(/\s+or\s+/gi, ' ')
                            .replace(/about\s+/gi, '')
                            .trim() || 'Makanan';
                          const mealSubtitle = analysis.items.map(item => {
                            const cleanName = item.name
                              .replace(/\s*\/\s*/g, ', ')
                              .replace(/\s+or\s+/gi, ', ')
                              .replace(/about\s+/gi, '')
                              .split(',')
                              .map(s => s.trim())
                              .filter(Boolean)[0] || item.name;
                            return cleanName;
                          }).join(' • ');
                          const avgCalories = Math.round((analysis.totalCaloriesMin + analysis.totalCaloriesMax) / 2);
                          const avgProtein = Math.round((analysis.totalProteinMin + analysis.totalProteinMax) / 2);
                          const avgCarbs = Math.round(analysis.items.reduce((sum, item) => sum + (item.carbsMin + item.carbsMax) / 2, 0));
                          const avgFat = Math.round(analysis.items.reduce((sum, item) => sum + (item.fatMin + item.fatMax) / 2, 0));
                          const photoUri = selectedPending.photoUri;
                          const timestamp = selectedPending.timestamp.toString();
                          
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          setSelectedPending(null);
                          setTimeout(() => {
                            router.push({
                              pathname: '/story-share',
                              params: {
                                mealName,
                                mealSubtitle,
                                calories: avgCalories.toString(),
                                protein: avgProtein.toString(),
                                carbs: avgCarbs.toString(),
                                fat: avgFat.toString(),
                                photoUri,
                                timestamp,
                              },
                            });
                          }, 100);
                        }}
                        activeOpacity={0.7}
                      >
                        <Share2 size={18} color="#FFFFFF" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.favoriteButton}
                        onPress={handleSaveToFavorite}
                        activeOpacity={0.7}
                      >
                        <Bookmark
                          size={22}
                          color={isFavorite(selectedPending.analysis.items.map(i => i.name).join(', ')) ? theme.primary : theme.textSecondary}
                          fill={isFavorite(selectedPending.analysis.items.map(i => i.name).join(', ')) ? theme.primary : 'transparent'}
                        />
                      </TouchableOpacity>
                    </>
                  )}
                  <TouchableOpacity onPress={handleClosePendingModal}>
                    <X size={24} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView 
                ref={pendingModalScrollRef}
                style={styles.pendingModalBody} 
                showsVerticalScrollIndicator={false}
                onContentSizeChange={() => {
                  if (selectedPending?.status === 'done') {
                    pendingModalScrollRef.current?.scrollTo({ y: 0, animated: true });
                  }
                }}
              >
                {selectedPending?.photoUri ? (
                  <Image source={{ uri: selectedPending.photoUri }} style={styles.pendingModalImage} />
                ) : (
                  <View style={[styles.viewEntryImageContainer, { backgroundColor: theme.background }]}>
                    <Camera size={48} color={theme.textTertiary} />
                  </View>
                )}

                {selectedPending?.status === 'analyzing' && (
                  <View style={styles.pendingAnalyzingState}>
                    <ActivityIndicator size="large" color={theme.primary} />
                    <Text style={[styles.pendingAnalyzingText, { color: theme.text }]}>Menganalisis makanan Anda...</Text>
                    <Text style={[styles.pendingAnalyzingSubtext, { color: theme.textSecondary }]}>Mohon tunggu sebentar</Text>
                  </View>
                )}

                {selectedPending?.status === 'error' && (
                  <View style={styles.pendingErrorState}>
                    <Text style={[styles.pendingErrorText, { color: theme.text }]}>Gagal menganalisis foto</Text>
                    <Text style={[styles.pendingErrorSubtext, { color: theme.textSecondary }]}>{selectedPending.error || 'Terjadi kesalahan'}</Text>
                    <View style={styles.pendingErrorButtons}>
                      <TouchableOpacity
                        style={[styles.pendingRetryButton, { backgroundColor: theme.background, borderColor: theme.border }]}
                        onPress={handleRetryPending}
                        activeOpacity={0.7}
                      >
                        <RefreshCw size={18} color={theme.text} />
                        <Text style={[styles.pendingRetryText, { color: theme.text }]}>Coba Lagi</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.pendingDeleteButton, { backgroundColor: 'rgba(197, 48, 48, 0.08)' }]}
                        onPress={handleRemovePending}
                        activeOpacity={0.7}
                      >
                        <Trash2 size={18} color="#C53030" />
                        <Text style={styles.pendingDeleteText}>Hapus</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {selectedPending?.status === 'done' && selectedPending.analysis && (
                  <View style={styles.pendingResultState}>
                    {(() => {
                      const totals = getEditedTotals();
                      return (
                        <View style={[styles.pendingTotalCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
                          <View style={styles.pendingCaloriesRow}>
                            <Text style={styles.pendingCaloriesEmoji}>🔥</Text>
                            <Text style={[styles.pendingCaloriesValue, { color: theme.text }]}>
                              {totals.calories}
                            </Text>
                            <Text style={[styles.pendingCaloriesUnit, { color: theme.textSecondary }]}>kcal</Text>
                          </View>
                          <View style={styles.pendingMacros}>
                            <View style={styles.pendingMacro}>
                              <Text style={styles.pendingMacroEmoji}>🥩</Text>
                              <Text style={[styles.pendingMacroValue, { color: theme.text }]}>
                                {totals.protein}g
                              </Text>
                              <Text style={[styles.pendingMacroLabel, { color: theme.textSecondary }]}>Protein</Text>
                            </View>
                            <View style={styles.pendingMacro}>
                              <Text style={styles.pendingMacroEmoji}>🌾</Text>
                              <Text style={[styles.pendingMacroValue, { color: theme.text }]}>
                                {totals.carbs}g
                              </Text>
                              <Text style={[styles.pendingMacroLabel, { color: theme.textSecondary }]}>Karbo</Text>
                            </View>
                            <View style={styles.pendingMacro}>
                              <Text style={styles.pendingMacroEmoji}>🥑</Text>
                              <Text style={[styles.pendingMacroValue, { color: theme.text }]}>
                                {totals.fat}g
                              </Text>
                              <Text style={[styles.pendingMacroLabel, { color: theme.textSecondary }]}>Lemak</Text>
                            </View>
                          </View>
                        </View>
                      );
                    })()}

                    <View style={styles.itemsTitleRow}>
                      <Text style={[styles.pendingItemsTitle, { color: theme.text }]}>Komponen Makanan</Text>
                      <TouchableOpacity
                        style={[styles.addItemButton, { backgroundColor: theme.background, borderColor: theme.border }]}
                        onPress={handleAddNewItem}
                        activeOpacity={0.7}
                      >
                        <PlusCircle size={16} color={theme.primary} />
                        <Text style={styles.addItemButtonText}>Tambah</Text>
                      </TouchableOpacity>
                    </View>

                    {showAddItem && (
                      <View style={[styles.editItemCard, { backgroundColor: theme.background, borderColor: theme.primary }]}>
                        <Text style={[styles.editItemTitle, { color: theme.text }]}>Tambah Item Baru</Text>
                        <View style={styles.editItemRow}>
                          <View style={styles.editItemField}>
                            <Text style={[styles.editItemLabel, { color: theme.textSecondary }]}>Nama</Text>
                            <TextInput
                              style={[styles.editItemInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                              placeholder="Nama makanan"
                              placeholderTextColor={theme.textTertiary}
                              value={editItemName}
                              onChangeText={setEditItemName}
                            />
                          </View>
                        </View>
                        <View style={styles.editItemRow}>
                          <View style={styles.editItemField}>
                            <Text style={[styles.editItemLabel, { color: theme.textSecondary }]}>Porsi</Text>
                            <TextInput
                              style={[styles.editItemInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                              placeholder="1 porsi"
                              placeholderTextColor={theme.textTertiary}
                              value={editItemPortion}
                              onChangeText={setEditItemPortion}
                            />
                          </View>
                        </View>
                        <View style={styles.editItemRowMulti}>
                          <View style={styles.editItemFieldSmall}>
                            <Text style={[styles.editItemLabel, { color: theme.textSecondary }]}>Kalori</Text>
                            <TextInput
                              style={[styles.editItemInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                              placeholder="0"
                              placeholderTextColor={theme.textTertiary}
                              keyboardType="numeric"
                              value={editItemCalories}
                              onChangeText={setEditItemCalories}
                            />
                          </View>
                          <View style={styles.editItemFieldSmall}>
                            <Text style={[styles.editItemLabel, { color: theme.textSecondary }]}>Protein</Text>
                            <TextInput
                              style={[styles.editItemInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                              placeholder="0"
                              placeholderTextColor={theme.textTertiary}
                              keyboardType="numeric"
                              value={editItemProtein}
                              onChangeText={setEditItemProtein}
                            />
                          </View>
                        </View>
                        <View style={styles.editItemRowMulti}>
                          <View style={styles.editItemFieldSmall}>
                            <Text style={[styles.editItemLabel, { color: theme.textSecondary }]}>Karbo</Text>
                            <TextInput
                              style={[styles.editItemInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                              placeholder="0"
                              placeholderTextColor={theme.textTertiary}
                              keyboardType="numeric"
                              value={editItemCarbs}
                              onChangeText={setEditItemCarbs}
                            />
                          </View>
                          <View style={styles.editItemFieldSmall}>
                            <Text style={[styles.editItemLabel, { color: theme.textSecondary }]}>Lemak</Text>
                            <TextInput
                              style={[styles.editItemInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                              placeholder="0"
                              placeholderTextColor={theme.textTertiary}
                              keyboardType="numeric"
                              value={editItemFat}
                              onChangeText={setEditItemFat}
                            />
                          </View>
                        </View>
                        <View style={styles.editItemActions}>
                          <TouchableOpacity
                            style={[styles.editItemCancelBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
                            onPress={() => setShowAddItem(false)}
                          >
                            <Text style={[styles.editItemCancelText, { color: theme.textSecondary }]}>Batal</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.editItemSaveBtn}
                            onPress={handleSaveNewItem}
                          >
                            <Text style={styles.editItemSaveText}>Simpan</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    {editedItems.map((item, index) => (
                      editingItemIndex === index ? (
                        <View key={index} style={[styles.editItemCard, { backgroundColor: theme.background, borderColor: theme.primary }]}>
                          <Text style={[styles.editItemTitle, { color: theme.text }]}>Edit Item</Text>
                          <View style={styles.editItemRow}>
                            <View style={styles.editItemField}>
                              <Text style={[styles.editItemLabel, { color: theme.textSecondary }]}>Nama</Text>
                              <TextInput
                                style={[styles.editItemInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                                placeholder="Nama makanan"
                                placeholderTextColor={theme.textTertiary}
                                value={editItemName}
                                onChangeText={setEditItemName}
                              />
                            </View>
                          </View>
                          <View style={styles.editItemRow}>
                            <View style={styles.editItemField}>
                              <Text style={[styles.editItemLabel, { color: theme.textSecondary }]}>Porsi</Text>
                              <TextInput
                                style={[styles.editItemInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                                placeholder="1 porsi"
                                placeholderTextColor={theme.textTertiary}
                                value={editItemPortion}
                                onChangeText={setEditItemPortion}
                              />
                            </View>
                          </View>
                          <View style={styles.editItemRowMulti}>
                            <View style={styles.editItemFieldSmall}>
                              <Text style={[styles.editItemLabel, { color: theme.textSecondary }]}>Kalori</Text>
                              <TextInput
                                style={[styles.editItemInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                                placeholder="0"
                                placeholderTextColor={theme.textTertiary}
                                keyboardType="numeric"
                                value={editItemCalories}
                                onChangeText={setEditItemCalories}
                              />
                            </View>
                            <View style={styles.editItemFieldSmall}>
                              <Text style={[styles.editItemLabel, { color: theme.textSecondary }]}>Protein</Text>
                              <TextInput
                                style={[styles.editItemInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                                placeholder="0"
                                placeholderTextColor={theme.textTertiary}
                                keyboardType="numeric"
                                value={editItemProtein}
                                onChangeText={setEditItemProtein}
                              />
                            </View>
                          </View>
                          <View style={styles.editItemRowMulti}>
                            <View style={styles.editItemFieldSmall}>
                              <Text style={[styles.editItemLabel, { color: theme.textSecondary }]}>Karbo</Text>
                              <TextInput
                                style={[styles.editItemInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                                placeholder="0"
                                placeholderTextColor={theme.textTertiary}
                                keyboardType="numeric"
                                value={editItemCarbs}
                                onChangeText={setEditItemCarbs}
                              />
                            </View>
                            <View style={styles.editItemFieldSmall}>
                              <Text style={[styles.editItemLabel, { color: theme.textSecondary }]}>Lemak</Text>
                              <TextInput
                                style={[styles.editItemInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                                placeholder="0"
                                placeholderTextColor={theme.textTertiary}
                                keyboardType="numeric"
                                value={editItemFat}
                                onChangeText={setEditItemFat}
                              />
                            </View>
                          </View>
                          <View style={styles.editItemActions}>
                            <TouchableOpacity
                              style={[styles.editItemDeleteBtn, { backgroundColor: 'rgba(197, 48, 48, 0.08)' }]}
                              onPress={() => handleDeleteItem(index)}
                            >
                              <Trash2 size={16} color="#C53030" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.editItemCancelBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
                              onPress={() => setEditingItemIndex(null)}
                            >
                              <Text style={[styles.editItemCancelText, { color: theme.textSecondary }]}>Batal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.editItemSaveBtn}
                              onPress={handleSaveEditItem}
                            >
                              <Text style={styles.editItemSaveText}>Simpan</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <TouchableOpacity
                          key={index}
                          style={[styles.pendingItemCard, { backgroundColor: theme.background, borderColor: theme.border }]}
                          onPress={() => handleStartEditItem(index)}
                          activeOpacity={0.7}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.pendingItemName, { color: theme.text }]}>
                              {item.name
                                .replace(/\s*\/\s*/g, ' ')
                                .replace(/\s+or\s+/gi, ' ')
                                .replace(/about\s+/gi, '')
                                .trim()}
                            </Text>
                            <Text style={[styles.pendingItemPortion, { color: theme.textSecondary }]}>
                              {item.portion
                                .replace(/about\s+/gi, '')
                                .replace(/approximately\s+/gi, '')
                                .trim()}
                            </Text>
                          </View>
                          <View style={styles.itemRightSection}>
                            <Text style={[styles.pendingItemCalories, { color: theme.textTertiary }]}>
                              {item.calories} kcal
                            </Text>
                            <Edit3 size={14} color={theme.textTertiary} />
                          </View>
                        </TouchableOpacity>
                      )
                    ))}

                    {(hasEdited || viewingLoggedEntryId) && (
                      <TouchableOpacity
                        style={styles.confirmEditedButton}
                        onPress={handleConfirmEdited}
                        activeOpacity={0.8}
                      >
                        <Check size={20} color="#FFFFFF" />
                        <Text style={styles.confirmEditedText}>
                          {viewingLoggedEntryId ? 'Simpan Perubahan' : 'Konfirmasi & Tambah ke Log'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      {showFavoriteToast && (
          <View style={[styles.favoriteToast, favoriteToastMessage.includes('Dihapus') && { backgroundColor: '#6B7280' }]}>
            <Star size={16} color={favoriteToastMessage.includes('Dihapus') ? '#FFFFFF' : '#FFC107'} fill={favoriteToastMessage.includes('Dihapus') ? 'transparent' : '#FFC107'} />
            <Text style={styles.favoriteToastText}>{favoriteToastMessage}</Text>
          </View>
        )}

        {showSuggestFavorite && (
          <View style={[styles.suggestFavoriteToast, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.suggestFavoriteText, { color: theme.text }]}>
              Simpan {suggestedMealName.split(',')[0]} ke Favorit?
            </Text>
            <View style={styles.suggestFavoriteButtons}>
              <TouchableOpacity
                style={[styles.suggestFavoriteBtn, { backgroundColor: theme.background }]}
                onPress={() => setShowSuggestFavorite(false)}
              >
                <Text style={[styles.suggestFavoriteBtnText, { color: theme.textSecondary }]}>Nanti</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.suggestFavoriteBtn, { backgroundColor: theme.primary }]}
                onPress={handleSaveSuggestedFavorite}
              >
                <Text style={[styles.suggestFavoriteBtnText, { color: '#FFFFFF' }]}>Simpan</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <Modal
          visible={addFoodModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setAddFoodModalVisible(false)}
        >
          <View style={styles.addFoodModalContainer}>
            <TouchableOpacity
              style={styles.addFoodModalOverlay}
              activeOpacity={1}
              onPress={() => setAddFoodModalVisible(false)}
            />
            
            <View style={[styles.addFoodModalContent, { backgroundColor: theme.card }]}>
              <View style={[styles.addFoodModalHeader, { borderBottomColor: theme.border }]}>
                <Text style={[styles.addFoodModalTitle, { color: theme.text }]}>Tambah Makanan</Text>
                <TouchableOpacity onPress={() => setAddFoodModalVisible(false)}>
                  <X size={24} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={[styles.tabContainer, { backgroundColor: theme.background }]}>
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'recent' && styles.tabActive, activeTab === 'recent' && { backgroundColor: theme.card }]}
                  onPress={() => setActiveTab('recent')}
                >
                  <Clock size={16} color={activeTab === 'recent' ? theme.primary : theme.textSecondary} />
                  <Text style={[styles.tabText, { color: activeTab === 'recent' ? theme.primary : theme.textSecondary }]}>Terakhir</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'favorit' && styles.tabActive, activeTab === 'favorit' && { backgroundColor: theme.card }]}
                  onPress={() => setActiveTab('favorit')}
                >
                  <Bookmark size={16} color={activeTab === 'favorit' ? theme.primary : theme.textSecondary} />
                  <Text style={[styles.tabText, { color: activeTab === 'favorit' ? theme.primary : theme.textSecondary }]}>Favorit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'search' && styles.tabActive, activeTab === 'search' && { backgroundColor: theme.card }]}
                  onPress={() => setActiveTab('search')}
                >
                  <SearchIcon size={16} color={activeTab === 'search' ? theme.primary : theme.textSecondary} />
                  <Text style={[styles.tabText, { color: activeTab === 'search' ? theme.primary : theme.textSecondary }]}>Cari</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'scan' && styles.tabActive, activeTab === 'scan' && { backgroundColor: theme.card }]}
                  onPress={() => {
                    setAddFoodModalVisible(false);
                    router.push('/camera-scan');
                  }}
                >
                  <Camera size={16} color={activeTab === 'scan' ? theme.primary : theme.textSecondary} />
                  <Text style={[styles.tabText, { color: activeTab === 'scan' ? theme.primary : theme.textSecondary }]}>Scan</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.addFoodModalBody} showsVerticalScrollIndicator={false}>
                {activeTab === 'recent' && (
                  <View style={styles.mealList}>
                    {recentMeals.length === 0 ? (
                      <View style={styles.emptyMealList}>
                        <Clock size={40} color={theme.textTertiary} />
                        <Text style={[styles.emptyMealText, { color: theme.textSecondary }]}>Belum ada makanan terakhir</Text>
                        <Text style={[styles.emptyMealSubtext, { color: theme.textTertiary }]}>Scan makanan untuk memulai</Text>
                      </View>
                    ) : (
                      recentMeals.slice(0, 20).map((meal) => (
                        <View
                          key={meal.id}
                          style={[styles.mealItem, { backgroundColor: theme.background, borderColor: theme.border }]}
                        >
                          <TouchableOpacity
                            style={styles.mealItemContent}
                            onPress={() => handleQuickLogRecent(meal.id)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.mealItemInfo}>
                              <Text style={[styles.mealItemName, { color: theme.text }]} numberOfLines={1}>
                                {meal.name.split(',')[0]}
                              </Text>
                              <Text style={[styles.mealItemCalories, { color: theme.textSecondary }]}>
                                {meal.calories} kcal
                              </Text>
                            </View>
                            <Plus size={20} color={theme.primary} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.removeRecentButton}
                            onPress={() => removeFromRecent(meal.id)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <X size={16} color={theme.textTertiary} />
                          </TouchableOpacity>
                        </View>
                      ))
                    )}
                  </View>
                )}

                {activeTab === 'favorit' && (
                  <View style={styles.mealList}>
                    {favorites.length === 0 ? (
                      <View style={styles.emptyMealList}>
                        <Bookmark size={40} color={theme.textTertiary} />
                        <Text style={[styles.emptyMealText, { color: theme.textSecondary }]}>Belum ada favorit</Text>
                        <Text style={[styles.emptyMealSubtext, { color: theme.textTertiary }]}>Simpan makanan dari detail untuk akses cepat</Text>
                      </View>
                    ) : (
                      favorites.map((meal) => (
                        <TouchableOpacity
                          key={meal.id}
                          style={[styles.mealItem, { backgroundColor: theme.background, borderColor: theme.border }]}
                          onPress={() => handleQuickLogFavorite(meal.id)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.mealItemInfo}>
                            <View style={styles.mealItemNameRow}>
                              <Star size={14} color="#FFC107" fill="#FFC107" />
                              <Text style={[styles.mealItemName, { color: theme.text }]} numberOfLines={1}>
                                {meal.name.split(',')[0]}
                              </Text>
                            </View>
                            <Text style={[styles.mealItemCalories, { color: theme.textSecondary }]}>
                              {meal.calories} kcal
                            </Text>
                          </View>
                          <Plus size={20} color={theme.primary} />
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                )}

                {activeTab === 'search' && (
                  <View style={styles.searchContainer}>
                    <View style={[styles.searchInputContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
                      <SearchIcon size={18} color={theme.textSecondary} />
                      <TextInput
                        style={[styles.searchInput, { color: theme.text }]}
                        placeholder="Cari makanan..."
                        placeholderTextColor={theme.textSecondary}
                        value={usdaSearchQuery}
                        onChangeText={handleUSDASearch}
                        autoFocus
                      />
                      {usdaSearchQuery.length > 0 && (
                        <TouchableOpacity
                          onPress={() => {
                            setUsdaSearchQuery('');
                            setUsdaSearchResults([]);
                          }}
                        >
                          <X size={18} color={theme.textSecondary} />
                        </TouchableOpacity>
                      )}
                    </View>

                    {usdaSearching && (
                      <View style={styles.searchLoadingContainer}>
                        <ActivityIndicator size="small" color={theme.primary} />
                        <Text style={[styles.searchLoadingText, { color: theme.textSecondary }]}>Mencari...</Text>
                      </View>
                    )}

                    {usdaSearchError && (
                      <View style={styles.searchErrorContainer}>
                        <Text style={styles.searchErrorText}>{usdaSearchError}</Text>
                      </View>
                    )}

                    {!usdaSearching && !usdaSearchError && usdaSearchResults.length === 0 && supabaseFoodResults.length === 0 && usdaSearchQuery.length > 0 && (
                      <View style={styles.emptyMealList}>
                        <SearchIcon size={40} color={theme.textTertiary} />
                        <Text style={[styles.emptyMealText, { color: theme.textSecondary }]}>Tidak ditemukan</Text>
                        <Text style={[styles.emptyMealSubtext, { color: theme.textTertiary }]}>Coba kata kunci lain</Text>
                      </View>
                    )}

                    {!usdaSearching && usdaSearchResults.length === 0 && supabaseFoodResults.length === 0 && usdaSearchQuery.length === 0 && (
                      <View style={styles.emptyMealList}>
                        <SearchIcon size={40} color={theme.textTertiary} />
                        <Text style={[styles.emptyMealText, { color: theme.textSecondary }]}>Cari Makanan</Text>
                        <Text style={[styles.emptyMealSubtext, { color: theme.textTertiary }]}>Ketik nama makanan untuk mencari</Text>
                      </View>
                    )}

                    {supabaseFoodResults.length > 0 && (
                      <View style={styles.mealList}>
                        <Text style={[styles.searchSectionTitle, { color: theme.textSecondary }]}>Database</Text>
                        {supabaseFoodResults.map((food) => (
                          <TouchableOpacity
                            key={`sb-${food.id}`}
                            style={[styles.mealItem, { backgroundColor: theme.background, borderColor: theme.border }]}
                            onPress={() => {
                              const avgCalories = Math.round((food.caloriesMin + food.caloriesMax) / 2);
                              const avgProtein = Math.round((food.proteinMin + food.proteinMax) / 2);
                              const avgCarbs = Math.round((food.carbsMin + food.carbsMax) / 2);
                              const avgFat = Math.round((food.fatMin + food.fatMax) / 2);
                              addFoodEntry({
                                name: food.name,
                                calories: avgCalories,
                                protein: avgProtein,
                                carbs: avgCarbs,
                                fat: avgFat,
                                photoUri: food.image || undefined,
                              });
                              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                              setAddFoodModalVisible(false);
                              setUsdaSearchQuery('');
                              setSupabaseFoodResults([]);
                              setUsdaSearchResults([]);
                            }}
                            activeOpacity={0.7}
                          >
                            {food.image && (
                              <Image source={{ uri: food.image }} style={styles.supabaseFoodImage} />
                            )}
                            <View style={styles.mealItemInfo}>
                              <Text style={[styles.mealItemName, { color: theme.text }]} numberOfLines={2}>
                                {food.name}
                              </Text>
                              <View style={styles.usdaNutrientRow}>
                                <Text style={[styles.mealItemCalories, { color: theme.textSecondary }]}>
                                  {food.caloriesMin === food.caloriesMax ? food.caloriesMin : `${food.caloriesMin}-${food.caloriesMax}`} kcal
                                </Text>
                                <Text style={[styles.usdaMacros, { color: theme.textTertiary }]}>
                                  P: {food.proteinMin === food.proteinMax ? food.proteinMin : `${food.proteinMin}-${food.proteinMax}`}g • C: {food.carbsMin === food.carbsMax ? food.carbsMin : `${food.carbsMin}-${food.carbsMax}`}g • F: {food.fatMin === food.fatMax ? food.fatMin : `${food.fatMin}-${food.fatMax}`}g
                                </Text>
                              </View>
                            </View>
                            <Plus size={20} color={theme.primary} />
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {usdaSearchResults.length > 0 && (
                      <View style={styles.mealList}>
                        {supabaseFoodResults.length > 0 && (
                          <Text style={[styles.searchSectionTitle, { color: theme.textSecondary, marginTop: 16 }]}>Database</Text>
                        )}
                        {usdaSearchResults.map((food) => (
                          <TouchableOpacity
                            key={food.fdcId}
                            style={[styles.mealItem, { backgroundColor: theme.background, borderColor: theme.border }]}
                            onPress={() => handleSelectUSDAFood(food)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.mealItemInfo}>
                              <Text style={[styles.mealItemName, { color: theme.text }]} numberOfLines={2}>
                                {food.description}
                              </Text>
                              {food.brandName && (
                                <Text style={[styles.usdaBrandName, { color: theme.textTertiary }]} numberOfLines={1}>
                                  {food.brandName}
                                </Text>
                              )}
                              <View style={styles.usdaNutrientRow}>
                                <Text style={[styles.mealItemCalories, { color: theme.textSecondary }]}>
                                  {food.calories} kcal
                                </Text>
                                <Text style={[styles.usdaMacros, { color: theme.textTertiary }]}>
                                  P: {food.protein}g • C: {food.carbs}g • F: {food.fat}g
                                </Text>
                              </View>
                            </View>
                            <Plus size={20} color={theme.primary} />
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </ScrollView>

              <View style={styles.addFoodModalFooter}>
                <TouchableOpacity
                  style={[styles.manualEntryButton, { backgroundColor: theme.background, borderColor: theme.border }]}
                  onPress={() => {
                    setAddFoodModalVisible(false);
                    setShowManualEntry(true);
                    setModalVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.manualEntryText, { color: theme.text }]}>Masukkan Manual</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>


      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateNavButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  dateTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  calendarModalContent: {
    borderRadius: 14,
    padding: 20,
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  calendarNavBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarMonthText: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  calendarWeekdays: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  calendarWeekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  calendarDaySelected: {
    backgroundColor: '#6C63FF',
  },
  calendarDayToday: {
    borderWidth: 2,
  },
  calendarDayText: {
    fontSize: 15,
    fontWeight: '500' as const,
  },
  calendarDayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700' as const,
  },
  todayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  todayButtonText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  appNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  appLogo: {
    width: 32,
    height: 32,
  },
  appName: {
    fontSize: 24,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },

  dateText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(180, 83, 9, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  streakText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#B45309',
  },
  motivationalToast: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    zIndex: 1000,
  },
  motivationalToastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6C63FF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  motivationalToastWarning: {
    backgroundColor: '#92400E',
  },
  motivationalToastCelebration: {
    backgroundColor: '#6C63FF',
  },
  motivationalToastEmoji: {
    fontSize: 20,
  },
  motivationalToastText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    lineHeight: 20,
  },
  content: {
    flex: 1,
  },
  topCardsSection: {
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 16,
  },
  calorieCard: {
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
  },
  macroSeparateCard: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center' as const,
    gap: 6,
  },
  macroCardEmoji: {
    fontSize: 15,
  },
  macroCardValues: {
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
    gap: 2,
  },
  macroCardCurrent: {
    fontSize: 18,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  macroCardTarget: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
  macroCardFooter: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  macroCardName: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  macroCardPctBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  macroCardPctText: {
    fontSize: 11,
    fontWeight: '700' as const,
  },
  sideBySideRow: {
    flexDirection: 'row' as const,
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 16,
  },
  sideBySideCardLeft: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    gap: 10,
  },
  sideBySideCardRight: {
    width: 140,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    gap: 0,
  },
  microVerticalList: {
    gap: 12,
  },
  microVerticalItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  microVerticalValue: {
    fontSize: 11,
    fontWeight: '700' as const,
  },
  microVerticalInfo: {
    flex: 1,
    gap: 1,
  },
  microVerticalLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  microVerticalTarget: {
    fontSize: 10,
    fontWeight: '500' as const,
  },
  microWaterDivider: {
    height: 1,
    alignSelf: 'stretch' as const,
    marginVertical: 12,
  },
  waterCardExpanded: {
  },
  waterCompactExpanded: {
    flex: 1,
    gap: 12,
    justifyContent: 'center' as const,
  },
  waterHeaderExpanded: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  waterIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(56,189,248,0.1)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  waterHeaderTextCol: {
    flex: 1,
    gap: 1,
  },
  waterTitleExpanded: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  waterSubtitleExpanded: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
  waterPctBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  waterPctText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#38BDF8',
  },
  waterProgressBarWrap: {
    paddingVertical: 2,
  },
  waterProgressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden' as const,
  },
  waterProgressBarFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#38BDF8',
  },
  waterControlsExpanded: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  waterBtnExpanded: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: 'transparent' as const,
  },
  waterDotsExpanded: {
    flex: 1,
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    justifyContent: 'center' as const,
    gap: 5,
  },
  waterDotExpanded: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  activitySeparateRow: {
    flexDirection: 'row' as const,
    gap: 10,
  },
  activitySeparateCard: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 18,
    paddingHorizontal: 8,
    gap: 8,
  },
  activitySeparateIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  activitySeparateVal: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  activitySeparateLabel: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
  activityMiniStatsCompact: {
    flexDirection: 'row' as const,
    gap: 6,
  },
  activityMiniStatCompact: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  activityMiniStatValCompact: {
    fontSize: 11,
    fontWeight: '700' as const,
  },
  exCardHeaderRow: {
    marginBottom: 8,
  },
  exCardTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  exCardSubtitle: {
    fontSize: 10,
    fontWeight: '400' as const,
    marginTop: 1,
  },
  exFixedContent: {
    flex: 1,
    minHeight: 105,
    justifyContent: 'center' as const,
  },
  exModeTabsCompact: {
    flexDirection: 'row' as const,
    borderRadius: 8,
    padding: 2,
    marginBottom: 8,
  },
  exModeTabCompact: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 3,
    paddingVertical: 5,
    borderRadius: 6,
  },
  exQuickContentCompact: {
    gap: 8,
  },
  exQuickGridCompact: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 6,
  },
  exQuickGridChip: {
    alignItems: 'center' as const,
    gap: 2,
    paddingVertical: 7,
    paddingHorizontal: 0,
    borderRadius: 10,
    borderWidth: 1,
    width: '22.5%' as unknown as number,
    minWidth: 58,
    flexGrow: 1,
  },
  exQuickInputRowCompact: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  exQuickInputCompact: {
    flex: 1,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 13,
  },
  exLogBtnCompact: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#4CAF7D',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  exDescribeContentCompact: {
    gap: 6,
  },
  exDescribeInputRowCompact: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    gap: 6,
  },
  exDescribeInputFixed: {
    flex: 1,
    height: 64,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    lineHeight: 18,
  },
  exManualContentTight: {
    gap: 6,
  },
  exManualRowTight: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
  },
  exManualInputTight: {
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    fontSize: 12,
  },
  carouselContainer: {
    marginBottom: 16,
    marginTop: 4,
  },
  carouselPageContainer: {
    width: CAROUSEL_CARD_WIDTH,
    gap: 8,
  },
  separatedCard: {
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  carouselCard: {
    width: CAROUSEL_CARD_WIDTH,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    alignItems: 'center' as const,
    gap: 0,
  },
  microCarouselContent: {
    gap: 12,
  },
  microCarouselRow: {
    flexDirection: 'row' as const,
    gap: 10,
  },
  microCarouselItem: {
    flex: 1,
    alignItems: 'center' as const,
    gap: 8,
  },
  microCarouselValue: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  heroCalorieRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    alignSelf: 'stretch' as const,
    gap: 14,
  },
  heroRingWrap: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  heroRingContent: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  heroCalValue: {
    fontSize: 22,
    fontWeight: '800' as const,
    letterSpacing: -1.5,
    lineHeight: 26,
    marginTop: 2,
  },
  heroCalLabel: {
    fontSize: 10,
    fontWeight: '500' as const,
    marginTop: 1,
  },
  heroDetailsCol: {
    flex: 1,
    gap: 6,
  },
  heroStatRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  heroStatLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    flex: 1,
  },
  heroStatValue: {
    fontSize: 13,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  heroRemainingDivider: {
    height: 1,
    alignSelf: 'stretch' as const,
    marginVertical: 2,
  },
  heroRemainingLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    textAlign: 'right' as const,
  },
  heroRemainingValue: {
    fontSize: 24,
    fontWeight: '800' as const,
    letterSpacing: -1.5,
    textAlign: 'right' as const,
    lineHeight: 28,
  },
  macroCardsRow: {
    flexDirection: 'row' as const,
    gap: 10,
  },
  macroMiniCard: {
    flex: 1,
    gap: 8,
  },
  macroMiniRingRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  macroMiniInfo: {
    flex: 1,
    gap: 1,
  },
  macroMiniValues: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  macroMiniCurrent: {
    fontSize: 15,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  macroMiniTarget: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
  macroMiniBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden' as const,
  },
  macroMiniBarFill: {
    height: '100%' as const,
    borderRadius: 2,
  },
  macroMiniName: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  carouselDots: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginTop: 10,
  },
  carouselDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  microCardTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
    alignSelf: 'flex-start' as const,
  },
  microCardSubtitle: {
    fontSize: 12,
    fontWeight: '500' as const,
    alignSelf: 'flex-start' as const,
    marginTop: 4,
  },
  combinedCard: {
    marginHorizontal: 20,
    marginBottom: 14,
    borderRadius: 14,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
    gap: 0,
  },
  combinedDivider: {
    height: 1,
    alignSelf: 'stretch',
    marginVertical: 16,
  },
  macroRingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignSelf: 'stretch',
    gap: 8,
  },
  mainRingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainRingContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainCalorieValue: {
    fontSize: 48,
    fontWeight: '800' as const,
    lineHeight: 54,
    letterSpacing: -2,
  },
  mainCalorieTarget: {
    fontSize: 20,
    fontWeight: '600' as const,
    marginTop: 4,
  },
  mainCalorieLabel: {
    fontSize: 14,
    marginTop: 4,
  },
  overIndicator: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(197, 48, 48, 0.08)',
    borderRadius: 12,
  },
  overIndicatorText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: '#C53030',
    opacity: 0.8,
  },
  targetIndicator: {
    marginTop: 8,
  },
  targetIndicatorText: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  microsCard: {
    marginHorizontal: 20,
    marginBottom: 14,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
  },
  miniMacroRingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 8,
  },
  microLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
  },
  waterCard: {
    marginHorizontal: 20,
    marginBottom: 14,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    gap: 12,
  },
  exerciseCard: {
    marginHorizontal: 20,
    marginBottom: 14,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    gap: 14,
  },

  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
  activityLogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  activityLogBtnText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  activityStatsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    alignSelf: 'stretch',
  },
  activityStatCard: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
  },
  activityStatValue: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  activityStatLabel: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
  activityBreakdownCard: {
    alignSelf: 'stretch',
    marginTop: 12,
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  activityBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityBreakdownLabel: {
    fontSize: 12,
  },
  activityBreakdownValue: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  extraNutrientsCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    gap: 14,
  },
  extraNutrientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  extraNutrientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: 72,
  },
  extraNutrientDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  extraNutrientName: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  extraNutrientBarContainer: {
    flex: 1,
  },
  extraNutrientBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  extraNutrientBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  extraNutrientValue: {
    fontSize: 11,
    fontWeight: '500' as const,
    minWidth: 72,
    textAlign: 'right' as const,
  },
  waterSection: {
    borderTopWidth: 1,
    paddingTop: 14,
    gap: 10,
  },
  nutrientTrackerSection: {
    gap: 10,
  },
  nutrientIconDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },

  waterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  waterTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  waterCount: {
    fontSize: 13,
    marginLeft: 'auto',
  },
  waterCupsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  waterBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  waterCupsDisplay: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  waterCupDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  macroRing: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  miniMacroRing: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  miniMacroRingValue: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
  miniMacroControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  miniControlBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  macroRingContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  macroRingValue: {
    fontSize: 15,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  macroRingLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
  },
  macroRingTarget: {
    fontSize: 11,
  },
  mealTimeLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  mealTime: {
    fontSize: 14,
  },
  deleteEntryButton: {
    padding: 4,
    marginTop: 4,
  },
  foodCalories: {
    fontSize: 14,
  },
  section: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  foodCount: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyIcon: {
    marginBottom: 20,
    opacity: 0.3,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    lineHeight: 20,
  },
  foodList: {
    gap: 10,
  },
  foodItem: {
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
  },
  foodThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  foodThumbnailImage: {
    width: '100%',
    height: '100%',
  },
  foodInfo: {
    flex: 1,
  },
  timeDeleteColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  foodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  fabCircle: {
    position: 'absolute' as const,
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6C63FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 100,
  },
  catatAktivitasCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F59E0B',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 12,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  catatAktivitasCardBtnText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  activityMiniStats: {
    flexDirection: 'row' as const,
    gap: 10,
    marginTop: 14,
    alignSelf: 'stretch' as const,
  },
  activityMiniStat: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  activityMiniStatVal: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  activitySeeAll: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  exModeTabs: {
    flexDirection: 'row' as const,
    borderRadius: 10,
    padding: 3,
    marginTop: 14,
    alignSelf: 'stretch' as const,
  },
  exModeTab: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
  },
  exModeTabText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  exQuickContent: {
    alignSelf: 'stretch' as const,
    marginTop: 12,
    gap: 10,
  },
  exQuickChips: {
    gap: 8,
  },
  exQuickChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  exQuickChipEmoji: {
    fontSize: 16,
  },
  exQuickChipLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  exQuickInputRow: {
    flexDirection: 'row' as const,
    gap: 8,
    alignItems: 'center' as const,
  },
  exQuickInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  exLogBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F59E0B',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  exDescribeContent: {
    alignSelf: 'stretch' as const,
    marginTop: 10,
  },
  exDescribeInputRow: {
    flexDirection: 'row' as const,
    gap: 8,
    alignItems: 'flex-end' as const,
  },
  exDescribeInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 80,
    minHeight: 38,
  },
  exManualContent: {
    alignSelf: 'stretch' as const,
    marginTop: 10,
    gap: 8,
  },
  exManualInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  exManualRow: {
    flexDirection: 'row' as const,
    gap: 8,
  },
  exManualInputHalf: {
    flex: 1,
  },
  exManualLogBtn: {
    width: 'auto' as const,
    flexDirection: 'row' as const,
    gap: 6,
    paddingHorizontal: 16,
    alignSelf: 'flex-end' as const,
  },
  waterInCarousel: {
    alignSelf: 'stretch',
    gap: 10,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
  },
  modalBody: {
    padding: 24,
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  inputGroupHalf: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  addButton: {
    backgroundColor: '#6C63FF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  bottomPadding: {
    height: 100,
  },
  analyzingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 16,
  },
  analyzingText: {
    fontSize: 16,
  },
  analysisContainer: {
    gap: 20,
    paddingBottom: 20,
  },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 16,
  },
  confidenceBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  confidenceText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  totalEstimate: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  totalCalories: {
    fontSize: 28,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  totalProtein: {
    fontSize: 16,
    fontWeight: '500' as const,
  },
  itemsList: {
    gap: 12,
  },
  itemsTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  foodItemCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  itemPortion: {
    fontSize: 14,
    marginBottom: 6,
  },
  itemCalories: {
    fontSize: 14,
  },
  tipsContainer: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  tipsTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  retakeButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  retakeText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  confirmButton: {
    flex: 2,
    backgroundColor: '#6C63FF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  bottomOptions: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  bottomOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 20,
  },
  bottomOptionText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  bottomOptionDivider: {
    height: 1,
  },
  pendingThumbnailContainer: {
    width: 48,
    height: 48,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  pendingThumbnail: {
    width: '100%',
    height: '100%',
  },
  pendingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingErrorOverlay: {
    backgroundColor: 'rgba(197, 48, 48, 0.2)',
  },

  foodDetailModalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  foodDetailModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  foodDetailModalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
  },
  foodDetailModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  foodDetailModalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  foodDetailModalBody: {
    padding: 20,
  },
  foodDetailName: {
    fontSize: 24,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  foodDetailTime: {
    fontSize: 14,
    marginBottom: 20,
  },
  foodDetailStatsContainer: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  foodDetailStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  foodDetailStatValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    marginBottom: 2,
  },
  foodDetailStatLabel: {
    fontSize: 12,
  },
  foodDetailStatDivider: {
    width: 1,
    marginHorizontal: 8,
  },
  foodDetailItemsSection: {
    marginBottom: 20,
  },
  foodDetailItemsTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  foodDetailItemText: {
    fontSize: 14,
    lineHeight: 22,
  },
  foodDetailShareButton: {
    backgroundColor: '#6C63FF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  foodDetailShareButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  pendingModalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  pendingModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  pendingModalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '90%',
  },
  pendingModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  pendingModalTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  pendingModalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  pendingModalSubtitle: {
    fontSize: 13,
    fontWeight: '500' as const,
    lineHeight: 16,
    marginTop: 2,
  },
  pendingModalBody: {
    padding: 20,
  },
  pendingModalImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 20,
  },
  pendingAnalyzingState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  pendingAnalyzingText: {
    fontSize: 18,
    fontWeight: '600' as const,
  },
  pendingAnalyzingSubtext: {
    fontSize: 14,
  },
  pendingErrorState: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  pendingErrorText: {
    fontSize: 18,
    fontWeight: '600' as const,
  },
  pendingErrorSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  pendingErrorButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  pendingRetryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  pendingRetryText: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  pendingDeleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  pendingDeleteText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#E5544B',
  },
  pendingResultState: {
    gap: 16,
    paddingBottom: 40,
  },
  pendingTotalCard: {
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
  },
  pendingTotalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  pendingFoodName: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 24,
    marginRight: 12,
  },
  pendingServingControls: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 8,
  },
  pendingServingBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingServingText: {
    fontSize: 16,
    fontWeight: '600' as const,
    minWidth: 20,
    textAlign: 'center',
  },
  pendingCaloriesRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 16,
  },
  pendingCaloriesEmoji: {
    fontSize: 24,
  },
  pendingCaloriesValue: {
    fontSize: 34,
    fontWeight: '800' as const,
    letterSpacing: -1,
  },
  pendingCaloriesUnit: {
    fontSize: 16,
  },
  pendingMacros: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  pendingMacro: {
    alignItems: 'center',
    gap: 4,
  },
  pendingMacroEmoji: {
    fontSize: 20,
  },
  pendingMacroValue: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  pendingMacroLabel: {
    fontSize: 12,
  },
  pendingItemsTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    marginTop: 8,
  },
  pendingItemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  pendingItemName: {
    fontSize: 15,
    fontWeight: '500' as const,
    marginBottom: 2,
  },
  pendingItemPortion: {
    fontSize: 13,
  },
  pendingItemCalories: {
    fontSize: 14,
  },
  itemRightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemsTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  addItemButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#6C63FF',
  },
  editItemCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    gap: 12,
  },
  editItemTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  editItemRow: {
    gap: 4,
  },
  editItemRowMulti: {
    flexDirection: 'row',
    gap: 12,
  },
  editItemField: {
    flex: 1,
  },
  editItemFieldSmall: {
    flex: 1,
  },
  editItemLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    marginBottom: 4,
  },
  editItemInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  editItemActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  editItemDeleteBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editItemCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  editItemCancelText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  editItemSaveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#6C63FF',
    alignItems: 'center',
  },
  editItemSaveText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  confirmEditedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6C63FF',
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 16,
  },
  confirmEditedText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  pendingResultButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  pendingCancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  pendingCancelText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  pendingConfirmButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#6C63FF',
  },
  pendingConfirmText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  viewEntryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  viewEntryTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  viewEntrySubtitle: {
    fontSize: 13,
  },
  viewEntryImageContainer: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  viewEntryTimeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  viewEntryTimeText: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  shareStoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
  },
  shareStoryText: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  pendingHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  favoriteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareHeaderButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#6C63FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteToast: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    backgroundColor: '#6C63FF',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  favoriteToastText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  suggestFavoriteToast: {
    position: 'absolute',
    bottom: 120,
    left: 24,
    right: 24,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  suggestFavoriteText: {
    fontSize: 15,
    fontWeight: '600' as const,
    marginBottom: 12,
    textAlign: 'center',
  },
  suggestFavoriteButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  suggestFavoriteBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  suggestFavoriteBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  addFoodModalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  addFoodModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  addFoodModalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
  },
  addFoodModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  addFoodModalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  addFoodModalBody: {
    padding: 20,
    maxHeight: 400,
  },
  mealList: {
    gap: 10,
  },
  mealItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  mealItemInfo: {
    flex: 1,
    flexShrink: 1,
    marginRight: 12,
  },
  mealItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  removeRecentButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  mealItemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    flex: 1,
  },
  mealItemName: {
    fontSize: 15,
    fontWeight: '600' as const,
    flex: 1,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  mealItemCalories: {
    fontSize: 13,
    marginTop: 4,
  },
  emptyMealList: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyMealText: {
    fontSize: 16,
    fontWeight: '600' as const,
    marginTop: 8,
  },
  emptyMealSubtext: {
    fontSize: 13,
  },
  addFoodModalFooter: {
    padding: 20,
    paddingBottom: 40,
  },
  manualEntryButton: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  manualEntryText: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  optionalImagePicker: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  optionalImagePlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  optionalImageText: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  optionalImagePreviewContainer: {
    position: 'relative',
  },
  optionalImagePreview: {
    width: '100%',
    height: 120,
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flex: 1,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500' as const,
  },
  searchLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  searchLoadingText: {
    fontSize: 14,
  },
  searchErrorContainer: {
    padding: 16,
    alignItems: 'center',
  },
  searchErrorText: {
    fontSize: 14,
    color: '#E5544B',
  },
  usdaBrandName: {
    fontSize: 12,
    marginTop: 2,
  },
  usdaNutrientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  usdaMacros: {
    fontSize: 11,
  },
  searchSectionTitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  supabaseFoodImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
  },
  healthScoreCard: {
    marginHorizontal: 24,
    marginBottom: 24,
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
  },
  healthScoreHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 14,
  },
  healthScoreTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  healthScoreValue: {
    fontSize: 20,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  healthScoreBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden' as const,
    marginBottom: 14,
  },
  healthScoreBarFill: {
    height: '100%' as const,
    borderRadius: 4,
  },
  healthScoreMessage: {
    fontSize: 14,
    fontWeight: '500' as const,
    lineHeight: 20,
  },
});
