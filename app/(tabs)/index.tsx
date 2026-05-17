import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';

import { indexStyles as styles } from '@/styles/indexStyles';
const SCREEN_WIDTH = Dimensions.get('window').width;
const CAROUSEL_CARD_WIDTH = SCREEN_WIDTH - 28;
const CAROUSEL_GAP = 12;

import { Stack, router } from 'expo-router';
import { Flame, X, Camera, ImageIcon, ChevronLeft, ChevronRight, Trash2, Plus, Bookmark, Clock, Star, Search as SearchIcon, Droplets, Minus, ChevronRight as ChevronRightIcon, Utensils, Target, TrendingDown, TrendingUp } from 'lucide-react-native';
import { useNutrition, useTodayProgress, PendingFoodEntry } from '@/contexts/NutritionContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { FoodEntry, MealAnalysis } from '@/types/nutrition';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { analyzeMealPhoto } from '@/utils/photoAnalysis';
import { warmAiProxy } from '@/utils/aiProxy';
import { optimizeImageForScan } from '@/utils/imageOptimization';
import {
  getTodayKey,
  calculateSugarTargetFromCalories,
  calculateFiberTargetFromCalories,
  calculateSodiumTargetMg,
  calculateWaterTargetCups,
  sumMidpointMicrosFromItems,
} from '@/utils/nutritionCalculations';
import { searchUSDAFoods, USDAFoodItem } from '@/utils/usdaApi';
import { searchFoods } from '@/lib/foodsApi';
import { FoodSearchResult } from '@/types/food';
import ProgressRing from '@/components/ProgressRing';
import { DietKuWordmark } from '@/components/DietKuWordmark';
import { useExercise } from '@/contexts/ExerciseContext';
import { ANIMATION_DURATION } from '@/constants/animations';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTimeBasedMessage, getProgressMessage, getCalorieFeedback, MotivationalMessage } from '@/constants/motivationalMessages';

export default function HomeScreen() {
  const { profile, dailyTargets, todayEntries, todayTotals, addFoodEntry, deleteFoodEntry, isLoading, streakData, selectedDate, setSelectedDate, pendingEntries, favorites, recentMeals, addToFavorites, removeFromFavorites, isFavorite, logFromFavorite, logFromRecent, removeFromRecent, shouldSuggestFavorite, addWaterCup, removeWaterCup, getTodayWaterCups, authState } = useNutrition();
  const { todaySteps, totalCaloriesBurned } = useExercise();
  const { theme } = useTheme();
  const { language, l } = useLanguage();
  const insets = useSafeAreaInsets();
  const bottomTabBarHeight = useBottomTabBarHeight();
  const progress = useTodayProgress();
  const [modalVisible, setModalVisible] = useState(false);
  const [foodName, setFoodName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<MealAnalysis | null>(null);
  
  const [showManualEntry, setShowManualEntry] = useState(false);
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
  const [shownPendingIds, setShownPendingIds] = useState<Set<string>>(new Set());
  const [motivationalMessage, setMotivationalMessage] = useState<MotivationalMessage & { isWarning?: boolean; isCelebration?: boolean } | null>(null);
  const [showMotivationalToast, setShowMotivationalToast] = useState(false);
  const motivationalToastAnim = useRef(new Animated.Value(-100)).current;
  const motivationalToastOpacity = useRef(new Animated.Value(0)).current;
  const [notificationQueue, setNotificationQueue] = useState<(MotivationalMessage & { isWarning?: boolean; isCelebration?: boolean })[]>([]);
  const [targetReachedToday, setTargetReachedToday] = useState(false);
  const isShowingToast = useRef(false);
  const [carouselPage, setCarouselPage] = useState(0);
  const [carouselPageHeight, setCarouselPageHeight] = useState<number>(0);

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
    if (donePending && donePending.analysis) {
      setShownPendingIds(prev => new Set(prev).add(donePending.id));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push({
        pathname: '/pending-food-detail',
        params: { pendingId: donePending.id, autoShown: '1' },
      });
    }
  }, [pendingEntries, shownPendingIds]);

  const getFormattedDate = (dateKey: string) => {
    const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return `${days[date.getDay()]}, ${day} ${months[date.getMonth()]} ${year}`;
  };

  const isToday = selectedDate === getTodayKey();
  const minDateKey = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - 6);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const homeScrollBottomPadding = useMemo(() => {
    const tabH =
      bottomTabBarHeight > 0
        ? bottomTabBarHeight
        : Platform.select({
            ios: 49 + insets.bottom,
            android: 56 + Math.max(insets.bottom, 8),
            default: 56,
          }) ?? 56;
    const fabReserve = 56 + 24 + 20;
    return tabH + fabReserve;
  }, [bottomTabBarHeight, insets.bottom]);

  const isAtMinDate = selectedDate <= minDateKey;
  
  const goToPreviousDay = () => {
    if (isAtMinDate) return;
    const [year, month, day] = selectedDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() - 1);
    const newDateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    if (newDateKey >= minDateKey) {
      setSelectedDate(newDateKey);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
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

  const todayMicros = useMemo(() => {
    const sugar = todayEntries.reduce((sum, entry) => sum + (entry.sugar ?? 0), 0);
    const fiber = todayEntries.reduce((sum, entry) => sum + (entry.fiber ?? 0), 0);
    const sodium = todayEntries.reduce((sum, entry) => sum + (entry.sodium ?? 0), 0);

    return {
      sugar: Math.round(sugar * 10) / 10,
      fiber: Math.round(fiber * 10) / 10,
      sodium: Math.round(sodium),
    };
  }, [todayEntries]);

  const sugarTarget = useMemo(
    () => calculateSugarTargetFromCalories(dailyTargets?.calories ?? 2000),
    [dailyTargets?.calories]
  );
  const fiberTarget = useMemo(
    () => calculateFiberTargetFromCalories(dailyTargets?.calories ?? 2000),
    [dailyTargets?.calories]
  );
  const sodiumTargetMg = useMemo(() => calculateSodiumTargetMg(), []);
  const waterTarget = useMemo(
    () => calculateWaterTargetCups(profile?.weight ?? 70),
    [profile?.weight]
  );
  const premiumPreview = useMemo(
    () => ({
      protein: 72,
      carbs: 180,
      fat: 55,
      sugar: 18,
      fiber: 14,
      sodium: 1100,
      water: 5,
    }),
    []
  );

  React.useEffect(() => {
    if (isLoading) return;
    if (profile) return;
    // Guard against transient profile/auth fetch gaps so signed-in users are not bounced to onboarding.
    if (authState.isSignedIn) return;
    const timer = setTimeout(() => {
      try {
        router.replace('/onboarding');
      } catch (e) {
        console.log('Navigation not ready yet, retrying...', e);
        setTimeout(() => {
          router.replace('/onboarding');
        }, 500);
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [profile, isLoading, authState.isSignedIn]);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.dashboardLoadingContainer}>
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={[styles.dashboardLoadingText, { color: theme.textSecondary }]}>
            {l('Memuat dashboard...', 'Loading dashboard...')}
          </Text>
        </View>
      </View>
    );
  }



  if (!profile || !dailyTargets) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.dashboardLoadingContainer}>
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={[styles.dashboardLoadingText, { color: theme.textSecondary }]}>
            {l('Menyiapkan data...', 'Preparing data...')}
          </Text>
        </View>
      </View>
    );
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
    router.push({
      pathname: '/pending-food-detail',
      params: { entryId: entry.id },
    });
  };

  const handleShareEntry = (entry: FoodEntry) => {
    const mealName = entry.name.split(',')[0].replace(/\s*\/\s*/g, ' ').replace(/\s+or\s+/gi, ' ').replace(/about\s+/gi, '').trim();
    const mealSubtitle = entry.name.split(',').map(n => n.trim().split(' ')[0]).join(' • ');
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
    router.push({
      pathname: '/pending-food-detail',
      params: { pendingId: pending.id },
    });
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

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.75,
      base64: false,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      const assetUri = result.assets[0].uri;
      setPhotoUri(assetUri);
      setModalVisible(true);
      try {
        const optimized = await optimizeImageForScan(assetUri);
        setPhotoUri(optimized.uri);
        await analyzePhoto(optimized.base64);
      } catch {
        Alert.alert(l('Analisis gagal', 'Analysis failed'), l('Foto tidak dapat diproses. Silakan coba lagi.', 'Could not process the photo. Please try again.'));
      }
    }
  };

  const analyzePhoto = async (base64: string) => {
    setAnalyzing(true);
    try {
      const result = await analyzeMealPhoto(base64, { userId: authState.userId, language });
      setAnalysis(result);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      const detail =
        error instanceof Error && error.message
          ? error.message
          : l('Foto tidak dapat dianalisis. Silakan coba lagi.', 'Could not analyze the photo. Please try again.');
      console.warn('Photo analysis error:', error);
      Alert.alert(l('Analisis gagal', 'Analysis failed'), detail);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAddFromAnalysis = () => {
    if (!analysis) return;

    const avgCalories = Math.round(((analysis.totalCaloriesMin + analysis.totalCaloriesMax) / 2) * 10) / 10;
    const avgProtein = Math.round(((analysis.totalProteinMin + analysis.totalProteinMax) / 2) * 10) / 10;
    const foodNames = analysis.items.map(item => item.name).join(', ');

    const estimatedCarbs = Math.round((((avgCalories - (avgProtein * 4)) / 4) * 0.6) * 10) / 10;
    const estimatedFat = Math.round((((avgCalories - (avgProtein * 4)) / 9) * 0.4) * 10) / 10;
    const micros = sumMidpointMicrosFromItems(analysis.items);

    addFoodEntry({
      name: foodNames,
      calories: avgCalories,
      protein: avgProtein,
      carbs: estimatedCarbs,
      fat: estimatedFat,
      sugar: micros.sugar,
      fiber: micros.fiber,
      sodium: micros.sodium,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    resetModal();
  };

  const getMealTimeLabel = (timestamp: number) => {
    const date = new Date(timestamp);
    const hours = date.getHours();
    const timeStr = date.toLocaleTimeString(language === 'en' ? 'en-US' : 'id-ID', { hour: 'numeric', minute: '2-digit' });
    
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
      sugar: Math.round(food.sugar * 10) / 10,
      fiber: Math.round(food.fiber * 10) / 10,
      sodium: Math.round(food.sodium),
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
        <View style={[styles.header, { backgroundColor: theme.background, paddingTop: insets.top + 16 }]}>
          <View style={styles.headerTop}>
            <View style={styles.appNameContainer}>
              <View>
                <DietKuWordmark premium={false} color={theme.text} fontSize={26} letterSpacing={-0.5} fontWeight="800" />
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
              style={[styles.dateNavButton, { backgroundColor: theme.card, borderColor: theme.border, opacity: isAtMinDate ? 0.5 : 1 }]}
              onPress={goToPreviousDay}
              activeOpacity={0.7}
              disabled={isAtMinDate}
            >
              <ChevronLeft size={20} color={theme.text} />
            </TouchableOpacity>
            
            <View style={styles.dateCenter}>
              <View style={styles.dateTouchable}>
                <Text style={[styles.dateText, { color: theme.text }]}>{getFormattedDate(selectedDate)}</Text>
              </View>
            </View>
            
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

        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: homeScrollBottomPadding }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.carouselContainer}>
            <View style={styles.carouselHorizontalScrollWrap}>
            <ScrollView
              horizontal
              pagingEnabled={false}
              showsHorizontalScrollIndicator={false}
              onScroll={(e) => {
                const page = Math.round(e.nativeEvent.contentOffset.x / (CAROUSEL_CARD_WIDTH + CAROUSEL_GAP));
                setCarouselPage(page);
              }}
              scrollEventThrottle={16}
              contentContainerStyle={{
                paddingHorizontal: 14,
                paddingBottom: 14,
                gap: CAROUSEL_GAP,
                alignItems: 'stretch',
              }}
              decelerationRate="fast"
              snapToInterval={CAROUSEL_CARD_WIDTH + CAROUSEL_GAP}
              snapToAlignment="start"
              style={{ backgroundColor: theme.background }}
              {...(Platform.OS === 'android'
                ? { overScrollMode: 'never' as const, nestedScrollEnabled: true }
                : {})}
            >
              {(() => {
                const carbsTarget = dailyTargets.carbsMax || 250;
                const fatTarget = dailyTargets.fatMax || 70;
                const proteinPct = dailyTargets.protein > 0 ? Math.round((todayTotals.protein / dailyTargets.protein) * 100) : 0;
                const carbsPct = carbsTarget > 0 ? Math.round((todayTotals.carbs / carbsTarget) * 100) : 0;
                const fatPct = fatTarget > 0 ? Math.round((todayTotals.fat / fatTarget) * 100) : 0;
                const proteinDisplay = todayTotals.protein;
                const carbsDisplay = todayTotals.carbs;
                const fatDisplay = todayTotals.fat;
                const proteinPctDisplay = proteinPct;
                const carbsPctDisplay = carbsPct;
                const fatPctDisplay = fatPct;
                const caloriesRemainingDisplay = progress
                  ? Math.round(Math.abs(progress.caloriesRemaining))
                  : 0;

                return (
                  <View style={styles.carouselPageContainer} onLayout={(e) => {
                    const h = e.nativeEvent.layout.height;
                    if (h > 0 && (carouselPageHeight === 0 || Math.abs(h - carouselPageHeight) > 2)) {
                      setCarouselPageHeight(h);
                    }
                  }}>
                    <View style={[styles.heroCardOutlined, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <View style={styles.heroCalorieRow}>
                      <View style={styles.heroRingWrap}>
                        <View style={[styles.heroRingOuterBorder, { borderColor: theme.border }]}>
                          <ProgressRing
                            progress={Math.min((progress?.caloriesProgress || 0), 100)}
                            size={130}
                            strokeWidth={6}
                            color={(progress?.isOver || false) ? '#C53030' : '#22C55E'}
                            backgroundColor={theme.border}
                          >
                            <View style={styles.heroRingContent}>
                              <Flame size={16} color={theme.textTertiary} />
                              <View style={styles.heroCalValueRow}>
                                <Text style={[styles.heroCalValue, { color: theme.text }]}>
                                  {caloriesRemainingDisplay}
                                </Text>
                              </View>
                              <Text style={[styles.heroCalSubLabel, { color: theme.textTertiary }]}>{progress?.isOver ? 'Berlebih' : 'Tersisa'}</Text>
                            </View>
                          </ProgressRing>
                        </View>
                      </View>
                      <View style={styles.heroDetailsCol}>
                        <View style={styles.heroSimpleRow}>
                          <Text style={[styles.heroSimpleLabel, { color: theme.textSecondary }]}>Target</Text>
                          <Text style={[styles.heroSimpleSeparator, { color: theme.textTertiary }]}> · </Text>
                          <Text style={[styles.heroSimpleValue, { color: theme.text }]}>{dailyTargets.calories.toLocaleString()}</Text>
                        </View>
                        <View style={[styles.heroSimpleDivider, { backgroundColor: theme.border }]} />
                        <View style={styles.heroSimpleRow}>
                          <Text style={[styles.heroSimpleLabel, { color: theme.textSecondary }]}>Termakan</Text>
                          <Text style={[styles.heroSimpleSeparator, { color: theme.textTertiary }]}> · </Text>
                          <Text style={[styles.heroSimpleValue, { color: theme.text }]}>{todayTotals.calories.toLocaleString()}</Text>
                        </View>
                      </View>
                    </View>
                    </View>
                    <View style={styles.premiumMaskSection}>
                      <View style={styles.macroCardsRow}>
                        <View style={[styles.macroSeparateCard, styles.separatedCard, { backgroundColor: theme.card }]}>
                        <ProgressRing
                          progress={Math.min(proteinPctDisplay, 100)}
                          size={44}
                          strokeWidth={5}
                          color="#FF8A80"
                          backgroundColor={theme.border}
                        >
                          <Text style={styles.macroCardEmoji}>🍗</Text>
                        </ProgressRing>
                        <View style={styles.macroCardValues}>
                          <Text style={[styles.macroCardCurrent, { color: theme.text }]}>{proteinDisplay}</Text>
                          <Text style={[styles.macroCardTarget, { color: theme.textTertiary }]}>/ {dailyTargets.protein}g</Text>
                        </View>
                        <View style={styles.macroCardFooter}>
                          <Text style={[styles.macroCardName, { color: theme.textSecondary }]}>Protein</Text>
                          <View style={[styles.macroCardPctBadge, { backgroundColor: 'rgba(255,138,128,0.15)' }]}>
                            <Text style={[styles.macroCardPctText, { color: '#FF8A80' }]}>{proteinPctDisplay}%</Text>
                          </View>
                        </View>
                        </View>
                        <View style={[styles.macroSeparateCard, styles.separatedCard, { backgroundColor: theme.card }]}>
                        <ProgressRing
                          progress={Math.min(carbsPctDisplay, 100)}
                          size={44}
                          strokeWidth={5}
                          color="#FFD54F"
                          backgroundColor={theme.border}
                        >
                          <Text style={styles.macroCardEmoji}>🌾</Text>
                        </ProgressRing>
                        <View style={styles.macroCardValues}>
                          <Text style={[styles.macroCardCurrent, { color: theme.text }]}>{carbsDisplay}</Text>
                          <Text style={[styles.macroCardTarget, { color: theme.textTertiary }]}>/ {carbsTarget}g</Text>
                        </View>
                        <View style={styles.macroCardFooter}>
                          <Text style={[styles.macroCardName, { color: theme.textSecondary }]}>Karbo</Text>
                          <View style={[styles.macroCardPctBadge, { backgroundColor: 'rgba(255,213,79,0.15)' }]}>
                            <Text style={[styles.macroCardPctText, { color: '#F0C040' }]}>{carbsPctDisplay}%</Text>
                          </View>
                        </View>
                        </View>
                        <View style={[styles.macroSeparateCard, styles.separatedCard, { backgroundColor: theme.card }]}>
                        <ProgressRing
                          progress={Math.min(fatPctDisplay, 100)}
                          size={44}
                          strokeWidth={5}
                          color="#80DEEA"
                          backgroundColor={theme.border}
                        >
                          <Text style={styles.macroCardEmoji}>🥑</Text>
                        </ProgressRing>
                        <View style={styles.macroCardValues}>
                          <Text style={[styles.macroCardCurrent, { color: theme.text }]}>{fatDisplay}</Text>
                          <Text style={[styles.macroCardTarget, { color: theme.textTertiary }]}>/ {fatTarget}g</Text>
                        </View>
                        <View style={styles.macroCardFooter}>
                          <Text style={[styles.macroCardName, { color: theme.textSecondary }]}>Lemak</Text>
                          <View style={[styles.macroCardPctBadge, { backgroundColor: 'rgba(128,222,234,0.15)' }]}>
                            <Text style={[styles.macroCardPctText, { color: '#80DEEA' }]}>{fatPctDisplay}%</Text>
                          </View>
                        </View>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })()}

              <View style={[styles.carouselPageContainer, carouselPageHeight > 0 && { height: carouselPageHeight }]}>
                <View style={styles.premiumMaskSection}>
                {(() => {
                  const currentSugar = todayMicros.sugar;
                  const currentFiber = todayMicros.fiber;
                  const currentSodium = todayMicros.sodium;
                  const sugarPct =
                    sugarTarget > 0 ? Math.round((currentSugar / sugarTarget) * 100) : 0;
                  const fiberPct =
                    fiberTarget > 0 ? Math.round((currentFiber / fiberTarget) * 100) : 0;
                  const sodiumPct =
                    sodiumTargetMg > 0 ? Math.round((currentSodium / sodiumTargetMg) * 100) : 0;
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
                          <Text style={[styles.macroCardTarget, { color: theme.textTertiary }]}>/ {sugarTarget}g</Text>
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
                          <Text style={[styles.macroCardTarget, { color: theme.textTertiary }]}>/ {fiberTarget}g</Text>
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
                          <Text style={[styles.macroCardTarget, { color: theme.textTertiary }]}>/ {(sodiumTargetMg / 1000).toFixed(1)}g</Text>
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
                </View>
                <View style={[styles.premiumMaskSection, { flex: 1 }]}>
                <View style={[styles.separatedCard, styles.waterCardExpanded, { backgroundColor: theme.card, flex: 1, minHeight: 0 }]}>
                  {(() => {
                    const liveWater = getTodayWaterCups();
                    const currentWater = liveWater;
                    const waterPct =
                      waterTarget > 0 ? Math.round((liveWater / waterTarget) * 100) : 0;
                    return (
                      <View style={styles.waterCompactExpanded}>
                        <View style={styles.waterHeaderExpanded}>
                          <View style={styles.waterIconBadge}>
                            <Droplets size={18} color="#38BDF8" />
                          </View>
                          <View style={styles.waterHeaderTextCol}>
                            <Text style={[styles.waterTitleExpanded, { color: theme.text }]}>Air</Text>
                            <Text style={[styles.waterSubtitleExpanded, { color: theme.textTertiary }]}>
                              {currentWater} dari {waterTarget} gelas
                            </Text>
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
                                  {
                                    backgroundColor:
                                      i < liveWater ? '#38BDF8' : theme.border,
                                  },
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
              </View>

            </ScrollView>
            </View>
            <View style={styles.carouselDots}>
              {[0, 1].map((i) => (
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
                        <ExpoImage
                          source={{ uri: pending.photoUri }}
                          style={styles.pendingThumbnail}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                          transition={0}
                        />
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
                  const isSyncing = entry.id.startsWith('local-');
                  
                  return (
                    <TouchableOpacity
                      key={entry.id}
                      style={[styles.foodItem, { backgroundColor: theme.card, borderColor: theme.border }]}
                      onPress={() => handleViewEntry(entry)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.foodThumbnail, { backgroundColor: theme.background }]}>
                        {entry.photoUri ? (
                          <ExpoImage
                            source={{ uri: entry.photoUri }}
                            style={styles.foodThumbnailImage}
                            contentFit="cover"
                            cachePolicy="memory-disk"
                            transition={0}
                          />
                        ) : (
                          <Camera size={18} color={theme.textSecondary} />
                        )}
                      </View>
                      <View style={styles.foodInfo}>
                        <View style={styles.foodTitleRow}>
                          <Text style={[styles.mealTimeLabel, { color: theme.text }]} numberOfLines={1}>
                            {entry.name.split(',')[0].replace(/\s*\/\s*/g, ' ').replace(/\s+or\s+/gi, ' ').replace(/about\s+/gi, '').trim()}
                          </Text>
                          {isSyncing && (
                            <View style={[styles.syncBadge, { backgroundColor: `${theme.primary}1A`, borderColor: `${theme.primary}66` }]}>
                              <Text style={[styles.syncBadgeText, { color: theme.primary }]}>
                                {l('Menyimpan...', 'Syncing...')}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.foodCalories, { color: theme.textTertiary }]}>{entry.calories} kcal</Text>
                      </View>
                      <View style={styles.timeDeleteColumn}>
                        <Text style={[styles.mealTime, { color: theme.textSecondary }]}>{time}</Text>
                        <TouchableOpacity
                          style={styles.deleteEntryButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            Alert.alert(
                              l('Hapus Makanan', 'Delete Food'),
                              l('Yakin ingin menghapus makanan ini?', 'Are you sure you want to delete this food entry?'),
                              [
                                { text: l('Batal', 'Cancel'), style: 'cancel' },
                                { 
                                  text: l('Hapus', 'Delete'), 
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

        {false && showMotivationalToast && motivationalMessage && (
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
              motivationalMessage?.isWarning && styles.motivationalToastWarning,
              motivationalMessage?.isCelebration && styles.motivationalToastCelebration
            ]}>
              <Text style={styles.motivationalToastEmoji}>{motivationalMessage?.emoji}</Text>
              <Text style={styles.motivationalToastText}>{motivationalMessage?.text}</Text>
            </View>
          </Animated.View>
        )}

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
                    <ExpoImage
                      source={{ uri: photoUri }}
                      style={styles.photoPreview}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      transition={0}
                    />
                    
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
                        setModalVisible(false);
                        setShowManualEntry(false);
                        router.push('/meal-builder');
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
                          <ExpoImage
                            source={{ uri: photoUri }}
                            style={styles.optionalImagePreview}
                            contentFit="cover"
                            cachePolicy="memory-disk"
                            transition={0}
                          />
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
                        placeholder={l('mis., Dada ayam, Nasi goreng...', 'e.g., Chicken breast, Fried rice...')}
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
                  style={[styles.tab, activeTab === 'scan' && styles.tabActive, activeTab === 'scan' && { backgroundColor: theme.card }]}
                  onPress={() => {
                    setAddFoodModalVisible(false);
                    warmAiProxy();
                    router.push('/camera-scan');
                  }}
                >
                  <Camera size={16} color={activeTab === 'scan' ? theme.primary : theme.textSecondary} />
                  <Text style={[styles.tabText, { color: activeTab === 'scan' ? theme.primary : theme.textSecondary }]}>Scan</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.addFoodModalBody} showsVerticalScrollIndicator={false}>
                {activeTab === 'recent' && (
                  <View>
                    {recentMeals.length === 0 ? (
                      <View style={styles.emptyMealList}>
                        <Clock size={40} color={theme.textTertiary} />
                        <Text style={[styles.emptyMealText, { color: theme.textSecondary }]}>Belum ada makanan terakhir</Text>
                        <Text style={[styles.emptyMealSubtext, { color: theme.textTertiary }]}>Scan makanan untuk memulai</Text>
                      </View>
                    ) : (
                      <View style={{ maxHeight: 152, overflow: 'hidden' }}>
                        <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                          <View style={styles.mealList}>
                            {recentMeals.map((meal) => (
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
                            ))}
                          </View>
                        </ScrollView>
                      </View>
                    )}
                  </View>
                )}

                {activeTab === 'favorit' && (
                  <View>
                    {favorites.length === 0 ? (
                      <View style={styles.emptyMealList}>
                        <Bookmark size={40} color={theme.textTertiary} />
                        <Text style={[styles.emptyMealText, { color: theme.textSecondary }]}>Belum ada favorit</Text>
                        <Text style={[styles.emptyMealSubtext, { color: theme.textTertiary }]}>Simpan makanan dari detail untuk akses cepat</Text>
                      </View>
                    ) : (
                      <View style={{ maxHeight: 152, overflow: 'hidden' }}>
                        <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                          <View style={styles.mealList}>
                            {favorites.map((meal) => (
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
                            ))}
                          </View>
                        </ScrollView>
                      </View>
                    )}
                  </View>
                )}

                {activeTab === 'search' && (
                  <View style={styles.searchContainer}>
                    <View style={[styles.searchInputContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
                      <SearchIcon size={18} color={theme.textSecondary} />
                      <TextInput
                        style={[styles.searchInput, { color: theme.text }]}
                        placeholder={l('Cari makanan...', 'Search food...')}
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
                        <Text style={[styles.searchLoadingText, { color: theme.textSecondary }]}>{l('Mencari...', 'Searching...')}</Text>
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
                        <Text style={[styles.emptyMealText, { color: theme.textSecondary }]}>{l('Tidak ditemukan', 'Not found')}</Text>
                        <Text style={[styles.emptyMealSubtext, { color: theme.textTertiary }]}>{l('Coba kata kunci lain', 'Try another keyword')}</Text>
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
                              <ExpoImage
                                source={{ uri: food.image }}
                                style={styles.supabaseFoodImage}
                                contentFit="cover"
                                cachePolicy="memory-disk"
                                transition={0}
                              />
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
                    router.push('/meal-builder');
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

