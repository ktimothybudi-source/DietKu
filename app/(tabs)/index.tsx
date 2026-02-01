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
import { Flame, X, Check, Camera, ImageIcon, ChevronLeft, ChevronRight, Calendar } from 'lucide-react-native';
import { useNutrition, useTodayProgress } from '@/contexts/NutritionContext';
import { useTheme } from '@/contexts/ThemeContext';
import { FoodEntry, MealAnalysis } from '@/types/nutrition';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { analyzeMealPhoto } from '@/utils/photoAnalysis';
import { getTodayKey } from '@/utils/nutritionCalculations';
import ProgressRing from '@/components/ProgressRing';

export default function HomeScreen() {
  const { profile, dailyTargets, todayEntries, todayTotals, addFoodEntry, updateFoodEntry, isLoading, streakData, selectedDate, setSelectedDate } = useNutrition();
  const { theme } = useTheme();
  const progress = useTodayProgress();
  const [modalVisible, setModalVisible] = useState(false);
  const [foodName, setFoodName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<MealAnalysis | null>(null);
  const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  
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
    setEditingEntry(null);
    setShowManualEntry(false);
    setModalVisible(false);
  };

  const handleEditEntry = (entry: FoodEntry) => {
    setEditingEntry(entry);
    setFoodName(entry.name);
    setCalories(entry.calories.toString());
    setProtein(entry.protein.toString());
    setModalVisible(true);
  };

  const handleUpdateFood = () => {
    if (!editingEntry || !foodName || !calories) return;

    const estimatedCarbs = Math.round((parseInt(calories) - (parseInt(protein || '0') * 4)) / 4 * 0.6);
    const estimatedFat = Math.round((parseInt(calories) - (parseInt(protein || '0') * 4)) / 9 * 0.4);

    updateFoodEntry(editingEntry.id, {
      name: foodName,
      calories: parseInt(calories),
      protein: parseInt(protein || '0'),
      carbs: estimatedCarbs,
      fat: estimatedFat,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    resetModal();
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
              <Text style={[styles.foodCount, { color: theme.textSecondary }]}>{todayEntries.length} item</Text>
            </View>

            {todayEntries.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Flame size={48} color={theme.textTertiary} />
                </View>
                <Text style={[styles.emptyText, { color: theme.text }]}>Belum ada makanan yang dicatat</Text>
                <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>Ketuk tombol kamera untuk menambahkan makanan pertama Anda</Text>
              </View>
            ) : (
              <View style={styles.foodList}>
                {todayEntries.map((entry) => {
                  const { label, time } = getMealTimeLabel(entry.timestamp);
                  
                  return (
                    <TouchableOpacity
                      key={entry.id}
                      style={[styles.foodItem, { backgroundColor: theme.card, borderColor: theme.border }]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        handleEditEntry(entry);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.foodThumbnail, { backgroundColor: theme.background }]}>
                        <Camera size={18} color={theme.textSecondary} />
                      </View>
                      <View style={styles.foodInfo}>
                        <View style={styles.foodHeader}>
                          <Text style={[styles.mealTimeLabel, { color: theme.text }]}>{label}</Text>
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
            router.push('/camera-scan');
          }}
        >
          <Camera size={28} color="#FFFFFF" />
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
                <Text style={[styles.modalTitle, { color: theme.text }]}>{editingEntry ? 'Edit Makanan' : 'Tambah Makanan'}</Text>
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

                {!editingEntry && !photoUri && !showManualEntry && (
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

                {!editingEntry && showManualEntry && (
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

                {editingEntry && (
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
                      onPress={handleUpdateFood}
                      disabled={!foodName || !calories}
                    >
                      <Check size={20} color="#FFFFFF" />
                      <Text style={styles.addButtonText}>Perbarui Makanan</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
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
    fontSize: 28,
    fontWeight: '700' as const,
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
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  streakText: {
    fontSize: 18,
    fontWeight: '700' as const,
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
});
