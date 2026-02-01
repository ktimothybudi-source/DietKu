import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Flame, X, Check, Camera, ImageIcon, ChevronLeft, ChevronRight, Calendar, RefreshCw, Trash2, Plus, Bookmark, Clock, Star, Share2 } from 'lucide-react-native';
import { useNutrition, useTodayProgress, PendingFoodEntry } from '@/contexts/NutritionContext';
import { useTheme } from '@/contexts/ThemeContext';
import { FoodEntry, MealAnalysis } from '@/types/nutrition';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { analyzeMealPhoto } from '@/utils/photoAnalysis';
import { getTodayKey } from '@/utils/nutritionCalculations';
import ProgressRing from '@/components/ProgressRing';

export default function HomeScreen() {
  const { profile, dailyTargets, todayEntries, todayTotals, addFoodEntry, isLoading, streakData, selectedDate, setSelectedDate, pendingEntries, confirmPendingEntry, removePendingEntry, retryPendingEntry, favorites, recentMeals, addToFavorites, removeFromFavorites, isFavorite, logFromFavorite, logFromRecent, shouldSuggestFavorite } = useNutrition();
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
  const [activeTab, setActiveTab] = useState<'recent' | 'favorit' | 'scan'>('recent');
  const [showFavoriteToast, setShowFavoriteToast] = useState(false);
  const [favoriteToastMessage, setFavoriteToastMessage] = useState('');
  const [showSuggestFavorite, setShowSuggestFavorite] = useState(false);
  const [suggestedMealName, setSuggestedMealName] = useState('');
  const [shownPendingIds, setShownPendingIds] = useState<Set<string>>(new Set());
  
  const pendingModalScrollRef = useRef<ScrollView>(null);
  
  
  const caloriesAnimValue = useRef(new Animated.Value(0)).current;
  const proteinAnimValue = useRef(new Animated.Value(0)).current;
  const remainingAnimValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(caloriesAnimValue, {
      toValue: todayTotals.calories,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [todayTotals.calories, caloriesAnimValue]);

  useEffect(() => {
    Animated.timing(proteinAnimValue, {
      toValue: todayTotals.protein,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [todayTotals.protein, proteinAnimValue]);

  useEffect(() => {
    Animated.timing(remainingAnimValue, {
      toValue: progress?.caloriesRemaining || 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [progress?.caloriesRemaining, remainingAnimValue]);

  useEffect(() => {
    const donePending = pendingEntries.find(p => p.status === 'done' && !shownPendingIds.has(p.id));
    if (donePending && donePending.analysis && !selectedPending) {
      setSelectedPending(donePending);
      setShownPendingIds(prev => new Set(prev).add(donePending.id));
    }
    setLastPendingCount(pendingEntries.length);
  }, [pendingEntries, selectedPending, shownPendingIds]);

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

  React.useEffect(() => {
    if (!isLoading && !profile) {
      router.replace('/onboarding');
    }
  }, [profile, isLoading]);

  if (isLoading) {
    return null;
  }

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return 'Selamat pagi';
    if (hour >= 11 && hour < 15) return 'Selamat siang';
    if (hour >= 15 && hour < 18) return 'Selamat sore';
    return 'Selamat malam';
  };

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
    setSelectedPending(pending);
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
                {profile.name && (
                  <Text style={[styles.greetingText, { color: theme.textSecondary }]}>
                    {getGreeting()}, {profile.name}! 👋
                  </Text>
                )}
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
            
            <View style={styles.dateCenter}>
              <Text style={[styles.dateText, { color: theme.text }]}>{getFormattedDate(selectedDate)}</Text>
              {!isToday && (
                <TouchableOpacity
                  style={[styles.todayButton, { backgroundColor: theme.primary }]}
                  onPress={goToToday}
                  activeOpacity={0.7}
                >
                  <Calendar size={12} color="#FFFFFF" />
                  <Text style={styles.todayButtonText}>Hari Ini</Text>
                </TouchableOpacity>
              )}
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

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.mainCalorieCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.mainRingContainer}>
              <ProgressRing
                progress={Math.min((progress?.caloriesProgress || 0), 100)}
                size={240}
                strokeWidth={18}
                color={(progress?.isOver || false) ? '#EF4444' : '#10B981'}
                backgroundColor={theme.border}
              >
                <View style={styles.mainRingContent}>
                  <Text style={[styles.mainCalorieValue, { color: theme.text }]}>
                    {Math.max(0, progress?.caloriesRemaining || 0)}
                  </Text>
                  <Text style={[styles.mainCalorieLabel, { color: theme.textSecondary }]}>kcal left</Text>
                </View>
              </ProgressRing>
            </View>
          </View>

          <View style={styles.macroRingsCard}>
            <View style={styles.macroRing}>
              <ProgressRing
                progress={Math.min((progress?.proteinProgress || 0), 100)}
                size={100}
                strokeWidth={8}
                color="#10B981"
                backgroundColor={theme.border}
              >
                <View style={styles.macroRingContent}>
                  <Text style={[styles.macroRingValue, { color: theme.text }]}>{todayTotals.protein}g</Text>
                </View>
              </ProgressRing>
              <Text style={[styles.macroRingLabel, { color: theme.textSecondary }]}>Protein</Text>
              <Text style={[styles.macroRingTarget, { color: theme.textTertiary }]}>{dailyTargets.protein}g</Text>
            </View>
            
            <View style={styles.macroRing}>
              <ProgressRing
                progress={Math.min((todayTotals.carbs / (dailyTargets.carbsMax || 250)) * 100, 100)}
                size={100}
                strokeWidth={8}
                color="#3B82F6"
                backgroundColor={theme.border}
              >
                <View style={styles.macroRingContent}>
                  <Text style={[styles.macroRingValue, { color: theme.text }]}>{todayTotals.carbs}g</Text>
                </View>
              </ProgressRing>
              <Text style={[styles.macroRingLabel, { color: theme.textSecondary }]}>Carbs</Text>
              <Text style={[styles.macroRingTarget, { color: theme.textTertiary }]}>{dailyTargets.carbsMax}g</Text>
            </View>
            
            <View style={styles.macroRing}>
              <ProgressRing
                progress={Math.min((todayTotals.fat / (dailyTargets.fatMax || 70)) * 100, 100)}
                size={100}
                strokeWidth={8}
                color="#F59E0B"
                backgroundColor={theme.border}
              >
                <View style={styles.macroRingContent}>
                  <Text style={[styles.macroRingValue, { color: theme.text }]}>{todayTotals.fat}g</Text>
                </View>
              </ProgressRing>
              <Text style={[styles.macroRingLabel, { color: theme.textSecondary }]}>Fat</Text>
              <Text style={[styles.macroRingTarget, { color: theme.textTertiary }]}>{dailyTargets.fatMax}g</Text>
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
                            <ActivityIndicator size="small" color="#10B981" />
                          </View>
                        )}
                        {hasError && (
                          <View style={[styles.pendingOverlay, styles.pendingErrorOverlay]}>
                            <X size={18} color="#EF4444" />
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
                        <Text style={[styles.foodCalories, { color: isAnalyzing ? '#10B981' : hasError ? '#EF4444' : theme.textTertiary }]}>
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
                        <View style={styles.foodHeader}>
                          <Text style={[styles.mealTimeLabel, { color: theme.text }]} numberOfLines={1}>
                            {entry.name.split(',')[0].replace(/\s*\/\s*/g, ' ').replace(/\s+or\s+/gi, ' ').replace(/about\s+/gi, '').trim()}
                          </Text>
                          <Text style={[styles.mealTime, { color: theme.textSecondary }]}>{time}</Text>
                        </View>
                        <Text style={[styles.foodCalories, { color: theme.textTertiary }]}>{entry.calories} kcal</Text>
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
          style={styles.fab}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setActiveTab('recent');
            setAddFoodModalVisible(true);
          }}
        >
          <Plus size={28} color="#FFFFFF" />
        </TouchableOpacity>

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
                    <ActivityIndicator size="large" color="#10B981" />
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
          onRequestClose={() => setSelectedPending(null)}
        >
          <View style={styles.pendingModalContainer}>
            <TouchableOpacity
              style={styles.pendingModalOverlay}
              activeOpacity={1}
              onPress={() => setSelectedPending(null)}
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
                          color={isFavorite(selectedPending.analysis.items.map(i => i.name).join(', ')) ? '#10B981' : theme.textSecondary}
                          fill={isFavorite(selectedPending.analysis.items.map(i => i.name).join(', ')) ? '#10B981' : 'transparent'}
                        />
                      </TouchableOpacity>
                    </>
                  )}
                  <TouchableOpacity onPress={() => setSelectedPending(null)}>
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
                {selectedPending?.photoUri && (
                  <Image source={{ uri: selectedPending.photoUri }} style={styles.pendingModalImage} />
                )}

                {selectedPending?.status === 'analyzing' && (
                  <View style={styles.pendingAnalyzingState}>
                    <ActivityIndicator size="large" color="#10B981" />
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
                        style={[styles.pendingDeleteButton, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}
                        onPress={handleRemovePending}
                        activeOpacity={0.7}
                      >
                        <Trash2 size={18} color="#EF4444" />
                        <Text style={styles.pendingDeleteText}>Hapus</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {selectedPending?.status === 'done' && selectedPending.analysis && (
                  <View style={styles.pendingResultState}>
                    <View style={[styles.pendingTotalCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
                      <View style={styles.pendingCaloriesRow}>
                        <Text style={styles.pendingCaloriesEmoji}>🔥</Text>
                        <Text style={[styles.pendingCaloriesValue, { color: theme.text }]}>
                          {Math.round((selectedPending.analysis.totalCaloriesMin + selectedPending.analysis.totalCaloriesMax) / 2)}
                        </Text>
                        <Text style={[styles.pendingCaloriesUnit, { color: theme.textSecondary }]}>kcal</Text>
                      </View>
                      <View style={styles.pendingMacros}>
                        <View style={styles.pendingMacro}>
                          <Text style={styles.pendingMacroEmoji}>🥩</Text>
                          <Text style={[styles.pendingMacroValue, { color: theme.text }]}>
                            {Math.round((selectedPending.analysis.totalProteinMin + selectedPending.analysis.totalProteinMax) / 2)}g
                          </Text>
                          <Text style={[styles.pendingMacroLabel, { color: theme.textSecondary }]}>Protein</Text>
                        </View>
                        <View style={styles.pendingMacro}>
                          <Text style={styles.pendingMacroEmoji}>🌾</Text>
                          <Text style={[styles.pendingMacroValue, { color: theme.text }]}>
                            {Math.round(selectedPending.analysis.items.reduce((sum, item) => sum + (item.carbsMin + item.carbsMax) / 2, 0))}g
                          </Text>
                          <Text style={[styles.pendingMacroLabel, { color: theme.textSecondary }]}>Karbo</Text>
                        </View>
                        <View style={styles.pendingMacro}>
                          <Text style={styles.pendingMacroEmoji}>🥑</Text>
                          <Text style={[styles.pendingMacroValue, { color: theme.text }]}>
                            {Math.round(selectedPending.analysis.items.reduce((sum, item) => sum + (item.fatMin + item.fatMax) / 2, 0))}g
                          </Text>
                          <Text style={[styles.pendingMacroLabel, { color: theme.textSecondary }]}>Lemak</Text>
                        </View>
                      </View>
                    </View>

                    <Text style={[styles.pendingItemsTitle, { color: theme.text }]}>Komponen Makanan</Text>
                    {selectedPending.analysis.items.map((item, index) => (
                      <View key={index} style={[styles.pendingItemCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
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
                        <Text style={[styles.pendingItemCalories, { color: theme.textTertiary }]}>
                          {Math.round((item.caloriesMin + item.caloriesMax) / 2)} kcal
                        </Text>
                      </View>
                    ))}




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
                style={[styles.suggestFavoriteBtn, { backgroundColor: '#10B981' }]}
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
                        <TouchableOpacity
                          key={meal.id}
                          style={[styles.mealItem, { backgroundColor: theme.background, borderColor: theme.border }]}
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
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dateNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateNavButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  todayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
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
    fontSize: 30,
    fontWeight: '900' as const,
  },
  greetingText: {
    fontSize: 13,
    fontWeight: '500' as const,
    marginTop: 2,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 107, 53, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  streakText: {
    fontSize: 14,
    fontWeight: '800' as const,
    color: '#FF6B35',
  },
  content: {
    flex: 1,
  },
  mainCalorieCard: {
    marginHorizontal: 24,
    marginBottom: 20,
    borderRadius: 24,
    padding: 32,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
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
    fontSize: 52,
    fontWeight: '700' as const,
    lineHeight: 60,
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
  macroRingsCard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 24,
    marginBottom: 32,
    gap: 12,
  },
  macroRing: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  macroRingContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  macroRingValue: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  macroRingLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  macroRingTarget: {
    fontSize: 12,
  },
  mealTimeLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  mealTime: {
    fontSize: 14,
  },
  foodCalories: {
    fontSize: 14,
  },
  section: {
    marginHorizontal: 24,
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
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
    gap: 12,
  },
  foodItem: {
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  foodThumbnail: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  foodInfo: {
    flex: 1,
  },
  foodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
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
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 18,
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
    height: 120,
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
    backgroundColor: '#10B981',
    borderRadius: 12,
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
    width: 56,
    height: 56,
    borderRadius: 12,
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
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
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
    borderRadius: 16,
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
    color: '#EF4444',
  },
  pendingResultState: {
    gap: 16,
    paddingBottom: 40,
  },
  pendingTotalCard: {
    borderRadius: 16,
    padding: 20,
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
    fontSize: 36,
    fontWeight: '700' as const,
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
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#10B981',
  },
  pendingConfirmText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
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
    borderRadius: 18,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  favoriteToast: {
    position: 'absolute',
    bottom: 120,
    left: 24,
    right: 24,
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
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
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  mealItemInfo: {
    flex: 1,
    marginRight: 12,
  },
  mealItemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mealItemName: {
    fontSize: 15,
    fontWeight: '600' as const,
    flex: 1,
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
});
