import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Modal,
  KeyboardAvoidingView,
  Dimensions,
} from 'react-native';
import { Stack } from 'expo-router';
import { 
  TrendingUp, 
  TrendingDown, 
  Scale, 
  Award,
  Calendar,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  Target,
  Flame,
  Zap,
  Trash2,
  Camera,
  Image as ImageIcon,
  Droplets,
  Footprints,
  Activity,
  Dumbbell,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNutrition } from '@/contexts/NutritionContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useExercise } from '@/contexts/ExerciseContext';
import { FoodEntry } from '@/types/nutrition';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type TimeRange = '7h' | '30h' | '90h';

interface DayData {
  date: string;
  dateKey: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  entries: FoodEntry[];
}

function formatDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getTimeRangeDays(range: TimeRange): number {
  switch (range) {
    case '7h': return 7;
    case '30h': return 30;
    case '90h': return 90;
  }
}

export default function AnalyticsScreen() {
  const nutrition = useNutrition() as any;
  const { profile, dailyTargets, foodLog, streakData, weightHistory } = nutrition;
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const exerciseData = useExercise();
  const nutritionRaw = nutrition as any;

  const [timeRange, setTimeRange] = useState<TimeRange>('7h');
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [weightError, setWeightError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() };
  });
  const [showEditWeightModal, setShowEditWeightModal] = useState(false);
  const [selectedWeightEntry, setSelectedWeightEntry] = useState<{ date: string; weight: number } | null>(null);
  const [editWeightInput, setEditWeightInput] = useState('');
  const [bodyPhotos, setBodyPhotos] = useState<{ uri: string; date: string; label: string }[]>([]);
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  const setupReady = !!profile && !!dailyTargets;
  const timeRangeDays = getTimeRangeDays(timeRange);

  const dayData = useMemo<DayData[]>(() => {
    const log = (foodLog as Record<string, FoodEntry[]>) || {};
    const days: DayData[] = [];
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - (timeRangeDays - 1));

    const cursor = new Date(startDate);
    cursor.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setHours(0, 0, 0, 0);

    while (cursor <= end) {
      const dateKey = formatDateKey(cursor);
      const entries = log[dateKey] || [];

      const totals = entries.reduce(
        (acc, entry) => ({
          calories: acc.calories + (entry.calories || 0),
          protein: acc.protein + (entry.protein || 0),
          carbs: acc.carbs + (entry.carbs || 0),
          fat: acc.fat + (entry.fat || 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );

      days.push({
        date: cursor.toLocaleDateString('id-ID', { month: 'short', day: 'numeric' }),
        dateKey,
        calories: totals.calories,
        protein: totals.protein,
        carbs: totals.carbs,
        fat: totals.fat,
        entries,
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    return days;
  }, [foodLog, timeRangeDays]);

  const weightChartData = useMemo(() => {
    let list = (weightHistory || [])
      .filter((w: any) => Number.isFinite(new Date(w.date).getTime()))
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Add initial weight from profile if no weight history exists
    if (profile?.weight && list.length === 0) {
      const today = new Date();
      const todayKey = formatDateKey(today);
      list = [{
        date: todayKey,
        weight: profile.weight,
        timestamp: Date.now(),
      }];
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - timeRangeDays);
    return list.filter((w: any) => new Date(w.date) >= cutoff);
  }, [weightHistory, timeRangeDays, profile]);

  const stats = useMemo(() => {
    const daysWithData = dayData.filter(d => d.entries.length > 0);
    const totalCalories = daysWithData.reduce((sum, d) => sum + d.calories, 0);
    const avgCalories = daysWithData.length > 0 ? Math.round(totalCalories / daysWithData.length) : 0;

    const targetCalories = dailyTargets?.calories ?? 2000;
    const daysWithinTarget = daysWithData.filter(
      d => Math.abs(d.calories - targetCalories) <= targetCalories * 0.1
    ).length;

    const consistencyPercentage =
      daysWithData.length > 0 ? Math.round((daysWithinTarget / daysWithData.length) * 100) : 0;

    const initialWeight = profile?.weight ?? 0;
    const startWeight = weightChartData.length > 0 ? weightChartData[0].weight : initialWeight;
    const currentWeight = weightChartData.length > 0 
      ? weightChartData[weightChartData.length - 1].weight 
      : initialWeight;
    const weightChange = currentWeight - initialWeight;

    const targetWeight = profile?.goalWeight ?? 0;
    let weightProgress = 0;
    if (targetWeight > 0 && initialWeight > 0 && targetWeight !== initialWeight) {
      const totalToChange = Math.abs(initialWeight - targetWeight);
      const currentChanged = Math.abs(initialWeight - currentWeight);
      const isCorrectDirection = (initialWeight > targetWeight && currentWeight <= initialWeight) ||
                                  (initialWeight < targetWeight && currentWeight >= initialWeight);
      if (isCorrectDirection) {
        weightProgress = Math.min(100, Math.max(0, Math.round((currentChanged / totalToChange) * 100)));
      }
    }

    // Calculate average macros
    const totalProtein = daysWithData.reduce((sum, d) => sum + d.protein, 0);
    const totalCarbs = daysWithData.reduce((sum, d) => sum + d.carbs, 0);
    const totalFat = daysWithData.reduce((sum, d) => sum + d.fat, 0);
    const avgProtein = daysWithData.length > 0 ? Math.round(totalProtein / daysWithData.length) : 0;
    const avgCarbs = daysWithData.length > 0 ? Math.round(totalCarbs / daysWithData.length) : 0;
    const avgFat = daysWithData.length > 0 ? Math.round(totalFat / daysWithData.length) : 0;

    return {
      avgCalories,
      avgProtein,
      avgCarbs,
      avgFat,
      daysLogged: daysWithData.length,
      consistencyPercentage,
      daysWithinTarget,
      weightChange,
      targetCalories,
      startWeight,
      currentWeight,
      initialWeight,
      targetWeight,
      weightProgress,
    };
  }, [dayData, dailyTargets, profile, weightChartData]);

  const handleDotPress = (entry: { date: string; weight: number }) => {
    setSelectedWeightEntry(entry);
    setEditWeightInput(entry.weight.toString());
    setShowEditWeightModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const updateWeight = async () => {
    if (!selectedWeightEntry) return;
    
    const raw = editWeightInput.replace(',', '.').trim();
    const value = Number(raw);

    if (!raw || !Number.isFinite(value) || value <= 0 || value > 500) {
      return;
    }

    try {
      if (typeof nutrition.updateWeightEntry === 'function') {
        nutrition.updateWeightEntry(selectedWeightEntry.date, value);
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowEditWeightModal(false);
      setSelectedWeightEntry(null);
    } catch (error) {
      console.error('Failed to update weight:', error);
    }
  };

  const deleteWeight = async () => {
    if (!selectedWeightEntry) return;

    try {
      if (typeof nutrition.deleteWeightEntry === 'function') {
        nutrition.deleteWeightEntry(selectedWeightEntry.date);
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowEditWeightModal(false);
      setSelectedWeightEntry(null);
    } catch (error) {
      console.error('Failed to delete weight:', error);
    }
  };

  const openWeightModal = () => {
    setWeightInput('');
    setWeightError(null);
    setSelectedDate(new Date());
    setShowWeightModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const logWeight = async () => {
    setWeightError(null);
    const raw = weightInput.replace(',', '.').trim();
    const value = Number(raw);

    if (!raw || !Number.isFinite(value) || value <= 0 || value > 500) {
      setWeightError('Masukkan berat yang valid');
      return;
    }

    try {
      const dateKey = formatDateKey(selectedDate);
      
      if (typeof nutrition.addWeightEntry === 'function') {
        nutrition.addWeightEntry(dateKey, value);
        console.log('Weight logged successfully:', { dateKey, value });
      } else {
        console.error('addWeightEntry function not available');
        setWeightError('Fungsi tidak tersedia');
        return;
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setWeightInput('');
      setShowWeightModal(false);
    } catch (error) {
      console.error('Failed to log weight:', error);
      setWeightError('Gagal menyimpan');
    }
  };

  const formatDisplayDate = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    if (formatDateKey(date) === formatDateKey(today)) {
      return 'Hari ini';
    }
    if (formatDateKey(date) === formatDateKey(yesterday)) {
      return 'Kemarin';
    }
    return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' });
  };

  const openCalendarPicker = () => {
    const date = new Date(selectedDate);
    setCalendarMonth({ year: date.getFullYear(), month: date.getMonth() });
    setShowCalendarPicker(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const selectDateFromCalendar = (day: number) => {
    const newDate = new Date(calendarMonth.year, calendarMonth.month, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const minDate = new Date(today);
    minDate.setDate(minDate.getDate() - 30);
    
    if (newDate <= today && newDate >= minDate) {
      setSelectedDate(newDate);
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const minDate = new Date(today);
    minDate.setDate(minDate.getDate() - 30);
    
    const days: { day: number; isCurrentMonth: boolean; isSelectable: boolean; isSelected: boolean; isToday: boolean }[] = [];
    
    for (let i = 0; i < firstDay; i++) {
      days.push({ day: 0, isCurrentMonth: false, isSelectable: false, isSelected: false, isToday: false });
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const isSelectable = date <= today && date >= minDate;
      const isSelected = formatDateKey(date) === formatDateKey(selectedDate);
      const isToday = formatDateKey(date) === formatDateKey(today);
      days.push({ day, isCurrentMonth: true, isSelectable, isSelected, isToday });
    }
    
    return days;
  };

  const getMonthName = (month: number) => {
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return months[month];
  };

  const renderCalorieChart = () => {
    const displayDays = timeRange === '7h' ? dayData.slice(-7) : 
                        timeRange === '30h' ? dayData.slice(-30) : dayData.slice(-90);
    
    const maxCalories = Math.max(...displayDays.map(d => d.calories), stats.targetCalories);
    const chartHeight = 140;
    
    const getVisibleDays = () => {
      if (timeRange === '7h') return displayDays;
      if (timeRange === '30h') {
        const step = 2;
        return displayDays.filter((_, i) => i % step === 0 || i === displayDays.length - 1);
      }
      const step = 7;
      return displayDays.filter((_, i) => i % step === 0 || i === displayDays.length - 1);
    };

    const visibleDays = getVisibleDays();

    const avgCaloriesInRange = displayDays.filter(d => d.entries.length > 0).length > 0 
      ? Math.round(displayDays.filter(d => d.entries.length > 0).reduce((sum, d) => sum + d.calories, 0) / displayDays.filter(d => d.entries.length > 0).length)
      : 0;

    const getAxisLabel = (day: DayData, index: number) => {
      const date = new Date(day.dateKey);
      const todayKey = formatDateKey(new Date());
      
      if (timeRange === '7h') {
        if (day.dateKey === todayKey) return 'Hari ini';
        return date.toLocaleDateString('id-ID', { day: 'numeric' });
      } else if (timeRange === '30h') {
        return date.toLocaleDateString('id-ID', { day: 'numeric' });
      } else {
        return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      }
    };

    return (
      <View style={[styles.chartCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.chartHeader}>
          <View style={styles.chartTitleRow}>
            <View style={[styles.chartIconWrap, { backgroundColor: '#FF6B35' + '15' }]}>
              <Flame size={18} color="#FF6B35" />
            </View>
            <View>
              <Text style={[styles.chartTitle, { color: theme.text }]}>Kalori Harian</Text>
              <Text style={[styles.chartSubtitle, { color: theme.textSecondary }]}>
                Rata-rata: {avgCaloriesInRange} kkal
              </Text>
            </View>
          </View>
          <View style={[styles.targetBadge, { backgroundColor: theme.primary + '12' }]}>
            <Target size={12} color={theme.primary} />
            <Text style={[styles.targetBadgeText, { color: theme.primary }]}>{stats.targetCalories}</Text>
          </View>
        </View>
        
        <View style={[styles.chartContainer, { height: chartHeight + 50 }]}>
          <View style={[styles.targetLine, { bottom: (stats.targetCalories / maxCalories) * chartHeight + 30 }]}>
            <View style={[styles.targetLineDash, { backgroundColor: theme.primary }]} />
          </View>
          
          <View style={styles.barsContainer}>
            {visibleDays.map((day, index) => {
              const barHeight = maxCalories > 0 ? (day.calories / maxCalories) * chartHeight : 0;
              const isOverTarget = day.calories > stats.targetCalories;
              const isToday = day.dateKey === formatDateKey(new Date());
              const hasData = day.calories > 0;
              
              return (
                <View key={day.dateKey} style={styles.barColumn}>
                  {hasData && timeRange === '7h' && (
                    <Text style={[styles.barValue, { color: isOverTarget ? theme.destructive : theme.primary }]}>
                      {day.calories}
                    </Text>
                  )}
                  {!hasData && timeRange === '7h' && (
                    <Text style={[styles.barValue, { color: theme.textTertiary }]}>-</Text>
                  )}
                  <View 
                    style={[
                      styles.bar, 
                      { 
                        height: Math.max(barHeight, 6),
                        backgroundColor: !hasData 
                          ? theme.border 
                          : isOverTarget 
                            ? theme.destructive 
                            : theme.primary,
                        borderRadius: 8,
                      },
                      isToday && { 
                        borderWidth: 2,
                        borderColor: theme.primary,
                      }
                    ]} 
                  />
                  <Text 
                    style={[
                      styles.barLabel, 
                      { color: isToday ? theme.primary : theme.textTertiary },
                      isToday && { fontWeight: '700' as const }
                    ]}
                    numberOfLines={1}
                  >
                    {getAxisLabel(day, index)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={[styles.chartLegend, { borderTopColor: theme.border }]}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.primary }]} />
            <Text style={[styles.legendText, { color: theme.textSecondary }]}>Sesuai target</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.destructive }]} />
            <Text style={[styles.legendText, { color: theme.textSecondary }]}>Melebihi target</Text>
          </View>
        </View>
      </View>
    );
  };

  const goalProjection = useMemo(() => {
    if (!profile?.goalWeight || !profile?.weight) return null;
    
    const targetWeight = profile.goalWeight;
    const initialWeight = profile.weight;
    const currentWeight = stats.currentWeight || initialWeight;
    const goal = profile.goal;
    
    if (targetWeight === initialWeight) return null;
    
    // If no weight history yet, show estimated projection based on safe rate
    if (weightChartData.length < 2) {
      const remainingWeight = Math.abs(targetWeight - currentWeight);
      const safeWeeklyRate = goal === 'lose' ? 0.5 : goal === 'gain' ? 0.3 : 0;
      
      if (safeWeeklyRate === 0 || remainingWeight === 0) return null;
      
      const weeksToGoal = remainingWeight / safeWeeklyRate;
      const daysToGoal = Math.ceil(weeksToGoal * 7);
      
      const projectedDate = new Date();
      projectedDate.setDate(projectedDate.getDate() + daysToGoal);
      
      return {
        type: 'estimated' as const,
        date: projectedDate,
        daysRemaining: daysToGoal,
        weeklyRate: safeWeeklyRate,
      };
    }
    
    const firstEntry = weightChartData[0];
    const lastEntry = weightChartData[weightChartData.length - 1];
    const daysPassed = Math.max(1, Math.ceil(
      (new Date(lastEntry.date).getTime() - new Date(firstEntry.date).getTime()) / (1000 * 60 * 60 * 24)
    ));
    
    const weightChangeTotal = lastEntry.weight - firstEntry.weight;
    const dailyRate = weightChangeTotal / daysPassed;
    
    if (dailyRate === 0) {
      return { type: 'no_change' as const, message: 'Belum ada perubahan' };
    }
    
    const remainingWeight = targetWeight - currentWeight;
    
    // Check if moving in the right direction
    const isMovingRight = (goal === 'lose' && dailyRate < 0) || 
                          (goal === 'gain' && dailyRate > 0) ||
                          (goal === 'maintain' && Math.abs(dailyRate) < 0.02);
    
    if (!isMovingRight && goal !== 'maintain') {
      return { type: 'wrong_direction' as const, message: 'Perlu penyesuaian pola' };
    }
    
    const daysToGoal = Math.abs(remainingWeight / dailyRate);
    
    if (daysToGoal > 365 * 3) {
      return { type: 'too_long' as const, message: 'Lebih dari 3 tahun' };
    }
    
    const projectedDate = new Date();
    projectedDate.setDate(projectedDate.getDate() + Math.ceil(daysToGoal));
    
    return {
      type: 'projected' as const,
      date: projectedDate,
      daysRemaining: Math.ceil(daysToGoal),
      weeklyRate: Math.abs(dailyRate * 7),
    };
  }, [profile, stats.currentWeight, weightChartData]);

  const weightChanges = useMemo(() => {
    if (!weightChartData || weightChartData.length === 0) return [];
    const periods = [
      { label: '3 hari', days: 3 },
      { label: '7 hari', days: 7 },
      { label: '14 hari', days: 14 },
      { label: '30 hari', days: 30 },
      { label: '90 hari', days: 90 },
      { label: 'Semua', days: 9999 },
    ];
    const latestWeight = weightChartData[weightChartData.length - 1]?.weight ?? 0;
    return periods.map(period => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - period.days);
      const filteredEntries = period.days === 9999
        ? weightChartData
        : weightChartData.filter((w: any) => new Date(w.date) <= cutoff);
      const pastWeight = filteredEntries.length > 0
        ? (period.days === 9999 ? filteredEntries[0].weight : filteredEntries[filteredEntries.length - 1].weight)
        : null;
      if (pastWeight === null) return { label: period.label, change: 0, trend: 'none' as const };
      const change = latestWeight - pastWeight;
      const trend = change > 0.05 ? 'up' as const : change < -0.05 ? 'down' as const : 'none' as const;
      return { label: period.label, change: Math.round(change * 10) / 10, trend };
    });
  }, [weightChartData]);

  const expenditureChanges = useMemo(() => {
    const periods = [
      { label: '3 hari', days: 3 },
      { label: '7 hari', days: 7 },
      { label: '14 hari', days: 14 },
      { label: '30 hari', days: 30 },
      { label: '90 hari', days: 90 },
    ];
    return periods.map(period => {
      const recentDays = dayData.slice(-period.days);
      const olderStart = Math.max(0, dayData.length - period.days * 2);
      const olderEnd = Math.max(0, dayData.length - period.days);
      const olderDays = dayData.slice(olderStart, olderEnd);
      const recentWithData = recentDays.filter(d => d.calories > 0);
      const olderWithData = olderDays.filter(d => d.calories > 0);
      const recentAvg = recentWithData.length > 0 ? recentWithData.reduce((s, d) => s + d.calories, 0) / recentWithData.length : 0;
      const olderAvg = olderWithData.length > 0 ? olderWithData.reduce((s, d) => s + d.calories, 0) / olderWithData.length : 0;
      const change = olderAvg > 0 ? recentAvg - olderAvg : 0;
      const trend = change > 10 ? 'up' as const : change < -10 ? 'down' as const : 'none' as const;
      return { label: period.label, change: Math.round(change * 10) / 10, trend };
    });
  }, [dayData]);

  const renderWeightSection = () => {
    const hasWeightData = weightChartData.length >= 1;
    const targetWeight = stats.targetWeight;
    const goal = profile?.goal;
    
    const getWeightChangeColor = () => {
      if (stats.weightChange === 0) return theme.textSecondary;
      if (goal === 'lose') {
        return stats.weightChange < 0 ? theme.primary : theme.destructive;
      }
      if (goal === 'gain') {
        return stats.weightChange > 0 ? theme.primary : theme.destructive;
      }
      return Math.abs(stats.weightChange) < 1 ? theme.primary : '#F59E0B';
    };

    return (
      <View style={[styles.weightSection, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.weightHeader}>
          <View style={styles.chartTitleRow}>
            <View style={[styles.chartIconWrap, { backgroundColor: '#3B82F6' + '15' }]}>
              <Scale size={18} color="#3B82F6" />
            </View>
            <View>
              <Text style={[styles.chartTitle, { color: theme.text }]}>Berat Badan</Text>
              <Text style={[styles.chartSubtitle, { color: theme.textSecondary }]}>
                {hasWeightData ? 'Tren perubahan' : 'Catat untuk melihat tren'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.recordBtn, { backgroundColor: '#3B82F6' }]}
            onPress={openWeightModal}
            activeOpacity={0.8}
          >
            <Plus size={16} color="#FFF" />
            <Text style={styles.recordBtnText}>Catat</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.weightStats}>
          <View style={styles.weightStatItem}>
            <Text style={[styles.weightStatValue, { color: theme.text }]}>
              {hasWeightData ? stats.currentWeight.toFixed(1) : (profile?.weight?.toFixed(1) ?? '-')}
            </Text>
            <Text style={[styles.weightStatLabel, { color: theme.textSecondary }]}>kg saat ini</Text>
          </View>
          
          <View style={[styles.weightStatDivider, { backgroundColor: theme.border }]} />
          
          <View style={styles.weightStatItem}>
            <View style={styles.weightChangeDisplay}>
              {stats.weightChange !== 0 && (
                stats.weightChange > 0 ? 
                  <TrendingUp size={18} color={getWeightChangeColor()} /> : 
                  <TrendingDown size={18} color={getWeightChangeColor()} />
              )}
              <Text style={[styles.weightStatValue, { color: getWeightChangeColor() }]}>
                {stats.weightChange > 0 ? '+' : ''}{stats.weightChange.toFixed(1)}
              </Text>
            </View>
            <Text style={[styles.weightStatLabel, { color: theme.textSecondary }]}>kg perubahan</Text>
          </View>

          <View style={[styles.weightStatDivider, { backgroundColor: theme.border }]} />
          <View style={styles.weightStatItem}>
            <View style={styles.weightChangeDisplay}>
              <Target size={16} color={theme.primary} />
              <Text style={[styles.weightStatValue, { color: theme.primary, fontSize: 22 }]}>
                {targetWeight > 0 ? targetWeight.toFixed(1) : '-'}
              </Text>
            </View>
            <Text style={[styles.weightStatLabel, { color: theme.textSecondary }]}>kg target</Text>
          </View>
        </View>

        {renderWeightGraph()}

        <View style={styles.weightTimeRange}>
          {(['7h', '30h', '90h'] as const).map(range => (
            <TouchableOpacity
              key={range}
              style={[
                styles.weightTimeRangePill,
                { backgroundColor: theme.background, borderColor: theme.border },
                timeRange === range && { backgroundColor: theme.primary, borderColor: theme.primary },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setTimeRange(range);
              }}
              activeOpacity={0.8}
            >
              <Text style={[
                styles.weightTimeRangeText,
                { color: theme.textSecondary },
                timeRange === range && { color: '#ffffff' },
              ]}>
                {range === '7h' ? '7 Hari' : range === '30h' ? '30 Hari' : '90 Hari'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        {goalProjection && targetWeight > 0 && (
          <View style={[styles.projectionCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
            {(goalProjection.type === 'projected' || goalProjection.type === 'estimated') ? (
              <View style={styles.projectionContent}>
                <Text style={[styles.projectionFriendlyText, { color: theme.text }]}>
                  🎯 Kamu akan mencapai berat impianmu sekitar
                </Text>
                <Text style={[styles.projectionDate, { color: theme.primary }]}>
                  {goalProjection.date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </Text>
                <Text style={[styles.projectionSubtext, { color: theme.textSecondary }]}>
                  ~{goalProjection.daysRemaining} hari lagi • {goalProjection.weeklyRate.toFixed(1)} kg/minggu
                </Text>
              </View>
            ) : (
              <View style={styles.projectionContent}>
                <Text style={[styles.projectionFriendlyText, { color: '#F59E0B' }]}>
                  {goalProjection.message === 'Belum ada perubahan' 
                    ? '📊 Terus catat beratmu untuk melihat proyeksi'
                    : goalProjection.message === 'Perlu penyesuaian pola'
                    ? '💪 Ayo sesuaikan pola makanmu untuk mencapai target!'
                    : '⏳ Proyeksi membutuhkan waktu lebih lama'}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderWeightGraph = () => {
    if (weightChartData.length < 1) return null;

    const weights = weightChartData.map((w: any) => w.weight);
    const targetWeight = profile?.goalWeight ?? 0;
    const allWeights = targetWeight > 0 ? [...weights, targetWeight] : weights;
    const minWeight = Math.min(...allWeights) - 2;
    const maxWeight = Math.max(...allWeights) + 2;
    const chartHeight = 120;
    const labelWidth = 50;
    const horizontalPadding = 16;
    const chartWidth = SCREEN_WIDTH - 80 - labelWidth - horizontalPadding;

    const points = weightChartData.map((w: any, index: number) => {
      const x = weightChartData.length === 1 
        ? chartWidth / 2 
        : (index / (weightChartData.length - 1)) * chartWidth;
      const y = maxWeight === minWeight 
        ? chartHeight / 2 
        : chartHeight - ((w.weight - minWeight) / (maxWeight - minWeight)) * chartHeight;
      return { x, y, weight: w.weight, date: w.date };
    });

    const targetY = targetWeight > 0 && maxWeight !== minWeight
      ? chartHeight - ((targetWeight - minWeight) / (maxWeight - minWeight)) * chartHeight
      : null;

    return (
      <View style={styles.weightGraphContainer}>
        <View style={styles.graphWrapper}>
          <View style={[styles.graphYLabels, { height: chartHeight }]}>
            <Text style={[styles.graphLabel, { color: theme.textTertiary }]}>{maxWeight.toFixed(0)} kg</Text>
            {targetWeight > 0 && (
              <Text style={[styles.graphLabel, styles.targetLabel, { color: theme.primary }]}>
                {targetWeight.toFixed(0)} kg
              </Text>
            )}
            <Text style={[styles.graphLabel, { color: theme.textTertiary }]}>{minWeight.toFixed(0)} kg</Text>
          </View>
          
          <View style={[styles.weightGraph, { height: chartHeight, width: chartWidth }]}>
            {targetY !== null && (
              <View 
                style={[
                  styles.targetGraphLine, 
                  { 
                    top: targetY,
                    backgroundColor: theme.primary + '40',
                  }
                ]} 
              />
            )}
            {points.map((point: { x: number; y: number; weight: number; date: string }, index: number) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.graphDotTouchable,
                  {
                    left: point.x - 14,
                    top: point.y - 14,
                  }
                ]}
                onPress={() => handleDotPress({ date: point.date, weight: point.weight })}
                activeOpacity={0.7}
              >
                <View style={[styles.graphDot, { backgroundColor: '#3B82F6' }]} />
              </TouchableOpacity>
            ))}
            {points.length > 1 && points.map((point: { x: number; y: number; weight: number; date: string }, index: number) => {
              if (index === 0) return null;
              const prev = points[index - 1];
              const dx = point.x - prev.x;
              const dy = point.y - prev.y;
              const length = Math.sqrt(dx * dx + dy * dy);
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);
              
              return (
                <View
                  key={`line-${index}`}
                  style={[
                    styles.graphLine,
                    {
                      width: length,
                      left: prev.x,
                      top: prev.y,
                      backgroundColor: '#3B82F6',
                      transform: [{ rotate: `${angle}deg` }],
                    }
                  ]}
                />
              );
            })}
          </View>
        </View>

        <View style={[styles.graphDateLabels, { marginLeft: labelWidth }]}>
          {weightChartData.length === 1 ? (
            <Text style={[styles.graphDateLabel, { color: theme.textTertiary, textAlign: 'center', flex: 1 }]}>
              {new Date(weightChartData[0].date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
            </Text>
          ) : (
            <>
              <Text style={[styles.graphDateLabel, { color: theme.textTertiary }]}>
                {new Date(weightChartData[0].date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
              </Text>
              <Text style={[styles.graphDateLabel, { color: theme.textTertiary }]}>
                {new Date(weightChartData[weightChartData.length - 1].date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
              </Text>
            </>
          )}
        </View>
      </View>
    );
  };

  const renderMacroChart = () => {
    const targetProtein = dailyTargets?.protein ?? 0;
    const targetCarbs = dailyTargets ? Math.round((dailyTargets.carbsMin + dailyTargets.carbsMax) / 2) : 0;
    const targetFat = dailyTargets ? Math.round((dailyTargets.fatMin + dailyTargets.fatMax) / 2) : 0;
    
    const macros = [
      { 
        name: 'Protein', 
        avg: stats.avgProtein, 
        target: targetProtein, 
        color: '#3B82F6',
        unit: 'g'
      },
      { 
        name: 'Karbohidrat', 
        avg: stats.avgCarbs, 
        target: targetCarbs, 
        color: '#F59E0B',
        unit: 'g'
      },
      { 
        name: 'Lemak', 
        avg: stats.avgFat, 
        target: targetFat, 
        color: theme.destructive,
        unit: 'g'
      },
    ];

    return (
      <View style={[styles.chartCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.chartHeader}>
          <View style={styles.chartTitleRow}>
            <View style={[styles.chartIconWrap, { backgroundColor: '#8B5CF6' + '15' }]}>
              <Zap size={18} color="#8B5CF6" />
            </View>
            <View>
              <Text style={[styles.chartTitle, { color: theme.text }]}>Makro Harian</Text>
              <Text style={[styles.chartSubtitle, { color: theme.textSecondary }]}>
                Rata-rata {timeRange === '7h' ? '7 hari' : timeRange === '30h' ? '30 hari' : '90 hari'} terakhir
              </Text>
            </View>
          </View>
        </View>
        
        <View style={styles.macroListContainer}>
          {macros.map((macro) => {
            const progress = macro.target > 0 ? Math.min((macro.avg / macro.target) * 100, 150) : 0;
            const clampedProgress = Math.min(progress, 100);
            const isOver = macro.avg > macro.target && macro.target > 0;
            
            return (
              <View key={macro.name} style={styles.macroListItem}>
                <View style={styles.macroListHeader}>
                  <View style={styles.macroListLeft}>
                    <View style={[styles.macroColorDot, { backgroundColor: macro.color }]} />
                    <Text style={[styles.macroListName, { color: theme.text }]}>{macro.name}</Text>
                  </View>
                  <View style={styles.macroListRight}>
                    <Text style={[styles.macroListValue, { color: isOver ? theme.destructive : theme.text }]}>
                      {macro.avg}
                    </Text>
                    <Text style={[styles.macroListTarget, { color: theme.textTertiary }]}>
                      / {macro.target}{macro.unit}
                    </Text>
                  </View>
                </View>
                <View style={[styles.macroProgressBg, { backgroundColor: theme.border }]}>
                  <View 
                    style={[
                      styles.macroProgressFill, 
                      { 
                        width: `${clampedProgress}%`,
                        backgroundColor: isOver ? theme.destructive : macro.color,
                      }
                    ]} 
                  />
                </View>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const takeBodyPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        console.log('Camera permission not granted');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        const today = new Date();
        const newPhoto = {
          uri: result.assets[0].uri,
          date: formatDateKey(today),
          label: today.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
        };
        setBodyPhotos(prev => [newPhoto, ...prev]);
        setShowPhotoModal(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Failed to take photo:', error);
    }
  };

  const pickBodyPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        console.log('Media library permission not granted');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        const today = new Date();
        const newPhoto = {
          uri: result.assets[0].uri,
          date: formatDateKey(today),
          label: today.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
        };
        setBodyPhotos(prev => [newPhoto, ...prev]);
        setShowPhotoModal(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Failed to pick photo:', error);
    }
  };

  const renderBodyProgress = () => {
    return (
      <View style={[styles.chartCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.chartHeader}>
          <View style={styles.chartTitleRow}>
            <View style={[styles.chartIconWrap, { backgroundColor: '#8B5CF6' + '15' }]}>
              <Camera size={18} color="#8B5CF6" />
            </View>
            <Text style={[styles.chartTitle, { color: theme.text }]}>Foto Kemajuan</Text>
          </View>
          <TouchableOpacity
            style={[styles.fotoBtn, { backgroundColor: '#8B5CF6' }]}
            onPress={() => { setShowPhotoModal(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            activeOpacity={0.8}
          >
            <Plus size={14} color="#FFF" />
            <Text style={styles.fotoBtnText}>Foto</Text>
          </TouchableOpacity>
        </View>

        {bodyPhotos.length === 0 ? (
          <TouchableOpacity
            style={[styles.emptyPhotoState, { borderColor: theme.border }]}
            onPress={() => { setShowPhotoModal(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            activeOpacity={0.7}
          >
            <View style={[styles.emptyPhotoIcon, { backgroundColor: '#8B5CF6' + '10' }]}>
              <Camera size={28} color="#8B5CF6" />
            </View>
            <Text style={[styles.emptyPhotoTitle, { color: theme.text }]}>Mulai dokumentasi</Text>
            <Text style={[styles.emptyPhotoText, { color: theme.textSecondary }]}>
              Ambil foto pertamamu untuk melihat perubahan dari waktu ke waktu
            </Text>
          </TouchableOpacity>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
            {bodyPhotos.map((photo, index) => (
              <View key={index} style={styles.photoCard}>
                <View style={[styles.photoImageWrap, { backgroundColor: theme.background }]}>
                  <ImageIcon size={32} color={theme.textTertiary} />
                  <Text style={[styles.photoPlaceholder, { color: theme.textTertiary }]}>Foto</Text>
                </View>
                <Text style={[styles.photoDateLabel, { color: theme.textSecondary }]}>{photo.label}</Text>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    );
  };

  const renderStreakVisualization = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const weekLabels = ['M', 'S', 'S', 'R', 'K', 'J', 'S'];
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dayOfWeek);
    const log = (foodLog as Record<string, FoodEntry[]>) || {};
    const weekDaysData = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      const dateKey = formatDateKey(date);
      const hasEntries = (log[dateKey] || []).length > 0;
      const isToday = dateKey === formatDateKey(new Date());
      const isFuture = date > today;
      return { day: weekLabels[i], logged: hasEntries, isToday, isFuture };
    });
    return (
      <View style={styles.streakRow}>
        <View style={[styles.streakCardLeft, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Flame size={28} color="#FF6B35" fill="#FF6B35" />
          <Text style={[styles.streakCardNumber, { color: theme.text }]}>{streakData?.currentStreak ?? 0}</Text>
          <Text style={[styles.streakCardLabel, { color: theme.textSecondary }]}>Day Streak</Text>
          <View style={styles.weekDotsRow}>
            {weekDaysData.map((d, i) => (
              <View key={i} style={styles.weekDotCol}>
                <Text style={[styles.weekDotDayLabel, { color: d.isToday ? theme.primary : theme.textTertiary }]}>{d.day}</Text>
                <View style={[
                  styles.weekDotCircle,
                  { backgroundColor: d.logged ? theme.primary : d.isFuture ? 'transparent' : theme.border },
                  d.isToday && !d.logged && { borderWidth: 2, borderColor: theme.primary, backgroundColor: 'transparent' },
                ]} />
              </View>
            ))}
          </View>
        </View>
        <View style={[styles.streakCardRight, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Target size={28} color="#3B82F6" />
          <Text style={[styles.streakCardNumber, { color: theme.text }]}>{stats.weightProgress}%</Text>
          <Text style={[styles.streakCardLabel, { color: theme.textSecondary }]}>tercapai</Text>
        </View>
      </View>
    );
  };

  const renderWeightChanges = () => {
    if (weightChanges.length === 0) return null;
    return (
      <View style={[styles.chartCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.chartHeader}>
          <View style={styles.chartTitleRow}>
            <View style={[styles.chartIconWrap, { backgroundColor: '#3B82F6' + '15' }]}>
              <Scale size={18} color="#3B82F6" />
            </View>
            <Text style={[styles.chartTitle, { color: theme.text }]}>Perubahan Berat</Text>
          </View>
        </View>
        {weightChanges.map((item, i) => (
          <View key={i} style={[styles.changeRow, i < weightChanges.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
            <Text style={[styles.changeLabel, { color: theme.textSecondary }]}>{item.label}</Text>
            <View style={[styles.changeTrendBar, { backgroundColor: item.trend === 'down' ? '#3B82F620' : item.trend === 'up' ? '#F59E0B20' : theme.border }]} />
            <Text style={[styles.changeValue, { color: theme.text }]}>{item.change > 0 ? '+' : ''}{item.change} kg</Text>
            <Text style={[styles.changeTrend, { color: item.trend === 'down' ? '#3B82F6' : item.trend === 'up' ? '#F59E0B' : theme.textTertiary }]}>
              {item.trend === 'up' ? '↗ Naik' : item.trend === 'down' ? '↘ Turun' : '→ Tetap'}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const renderWeeklyEnergy = () => {
    const last7 = dayData.slice(-7);
    const weekData = last7.map(d => {
      const dateExercises = exerciseData.exercises?.[d.dateKey] || [];
      const dateSteps = exerciseData.stepsData?.[d.dateKey] || 0;
      const stepsCals = Math.round(dateSteps * 0.04);
      const exerciseCals = (dateExercises as any[]).reduce((sum: number, e: any) => sum + (e.caloriesBurned || 0), 0);
      const burned = stepsCals + exerciseCals;
      return { ...d, burned, consumed: d.calories };
    });
    const totalBurned = weekData.reduce((sum, d) => sum + d.burned, 0);
    const totalConsumed = weekData.reduce((sum, d) => sum + d.consumed, 0);
    const totalEnergy = totalConsumed - totalBurned;
    const maxVal = Math.max(...weekData.map(d => Math.max(d.burned, d.consumed)), 1);
    const chartHeight = 130;
    return (
      <View style={[styles.chartCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.chartHeader}>
          <View style={styles.chartTitleRow}>
            <View style={[styles.chartIconWrap, { backgroundColor: '#22C55E15' }]}>
              <Zap size={18} color="#22C55E" />
            </View>
            <Text style={[styles.chartTitle, { color: theme.text }]}>Energi Mingguan</Text>
          </View>
        </View>
        <View style={styles.energyStatsRow}>
          <View style={styles.energyStat}>
            <Text style={[styles.energyStatLabel, { color: theme.textSecondary }]}>Terbakar</Text>
            <Text style={[styles.energyStatValue, { color: '#F59E0B' }]}>{totalBurned.toLocaleString()}</Text>
            <Text style={[styles.energyStatUnit, { color: theme.textTertiary }]}>cal</Text>
          </View>
          <View style={styles.energyStat}>
            <Text style={[styles.energyStatLabel, { color: theme.textSecondary }]}>Dikonsumsi</Text>
            <Text style={[styles.energyStatValue, { color: theme.primary }]}>{totalConsumed.toLocaleString()}</Text>
            <Text style={[styles.energyStatUnit, { color: theme.textTertiary }]}>cal</Text>
          </View>
          <View style={styles.energyStat}>
            <Text style={[styles.energyStatLabel, { color: theme.textSecondary }]}>Energi</Text>
            <Text style={[styles.energyStatValue, { color: totalEnergy >= 0 ? theme.destructive : '#3B82F6' }]}>{totalEnergy >= 0 ? '+' : ''}{totalEnergy}</Text>
            <Text style={[styles.energyStatUnit, { color: theme.textTertiary }]}>cal</Text>
          </View>
        </View>
        <View style={[styles.energyChartArea, { height: chartHeight + 30 }]}>
          {weekData.map((d) => {
            const burnedH = maxVal > 0 ? (d.burned / maxVal) * chartHeight : 0;
            const consumedH = maxVal > 0 ? (d.consumed / maxVal) * chartHeight : 0;
            const dayLabel = new Date(d.dateKey).toLocaleDateString('id-ID', { weekday: 'short' }).slice(0, 3);
            return (
              <View key={d.dateKey} style={styles.energyBarCol}>
                <View style={styles.energyBarPair}>
                  <View style={[styles.energyBar, { height: Math.max(burnedH, 3), backgroundColor: '#F59E0B' }]} />
                  <View style={[styles.energyBar, { height: Math.max(consumedH, 3), backgroundColor: theme.primary }]} />
                </View>
                <Text style={[styles.energyDayLabel, { color: theme.textTertiary }]}>{dayLabel}</Text>
              </View>
            );
          })}
        </View>
        <View style={[styles.chartLegend, { borderTopColor: theme.border }]}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
            <Text style={[styles.legendText, { color: theme.textSecondary }]}>Terbakar</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.primary }]} />
            <Text style={[styles.legendText, { color: theme.textSecondary }]}>Dikonsumsi</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderExpenditureChanges = () => {
    return (
      <View style={[styles.chartCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.chartHeader}>
          <View style={styles.chartTitleRow}>
            <View style={[styles.chartIconWrap, { backgroundColor: '#F59E0B15' }]}>
              <TrendingUp size={18} color="#F59E0B" />
            </View>
            <Text style={[styles.chartTitle, { color: theme.text }]}>Perubahan Konsumsi</Text>
          </View>
        </View>
        {expenditureChanges.map((item, i) => (
          <View key={i} style={[styles.changeRow, i < expenditureChanges.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
            <Text style={[styles.changeLabel, { color: theme.textSecondary }]}>{item.label}</Text>
            <View style={[styles.changeTrendBar, { backgroundColor: item.trend === 'up' ? '#F59E0B20' : item.trend === 'down' ? '#3B82F620' : theme.border }]} />
            <Text style={[styles.changeValue, { color: theme.text }]}>{item.change > 0 ? '+' : ''}{item.change} cal</Text>
            <Text style={[styles.changeTrend, { color: item.trend === 'up' ? '#F59E0B' : item.trend === 'down' ? '#3B82F6' : theme.textTertiary }]}>
              {item.trend === 'up' ? '↗ Naik' : item.trend === 'down' ? '↘ Turun' : '→ Tetap'}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const microsTrend = useMemo(() => {
    const waterData = nutritionRaw.waterCups || nutritionRaw.getTodayWaterCups ? {} : {};
    const sugarData = nutritionRaw.sugarUnits || {};
    const fiberData = nutritionRaw.fiberUnits || {};
    const sodiumData = nutritionRaw.sodiumUnits || {};

    const rawWater = (typeof nutritionRaw.waterCups === 'object' && nutritionRaw.waterCups !== null) ? nutritionRaw.waterCups : waterData;
    const rawSugar = (typeof nutritionRaw.sugarUnits === 'object' && nutritionRaw.sugarUnits !== null) ? nutritionRaw.sugarUnits : sugarData;
    const rawFiber = (typeof nutritionRaw.fiberUnits === 'object' && nutritionRaw.fiberUnits !== null) ? nutritionRaw.fiberUnits : fiberData;
    const rawSodium = (typeof nutritionRaw.sodiumUnits === 'object' && nutritionRaw.sodiumUnits !== null) ? nutritionRaw.sodiumUnits : sodiumData;

    const days = timeRangeDays;
    const today = new Date();
    let totalWater = 0, totalSugar = 0, totalFiber = 0, totalSodium = 0;
    let daysWithWater = 0, daysWithSugar = 0, daysWithFiber = 0, daysWithSodium = 0;

    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = formatDateKey(d);
      const w = rawWater[key] || 0;
      const s = rawSugar[key] || 0;
      const f = rawFiber[key] || 0;
      const n = rawSodium[key] || 0;
      if (w > 0) { totalWater += w; daysWithWater++; }
      if (s > 0) { totalSugar += s; daysWithSugar++; }
      if (f > 0) { totalFiber += f; daysWithFiber++; }
      if (n > 0) { totalSodium += n; daysWithSodium++; }
    }

    return {
      avgWater: daysWithWater > 0 ? Math.round((totalWater / daysWithWater) * 10) / 10 : 0,
      avgSugar: daysWithSugar > 0 ? Math.round((totalSugar / daysWithSugar) * 10) / 10 : 0,
      avgFiber: daysWithFiber > 0 ? Math.round((totalFiber / daysWithFiber) * 10) / 10 : 0,
      avgSodium: daysWithSodium > 0 ? Math.round(totalSodium / daysWithSodium) : 0,
      daysWithWater,
      daysWithSugar,
      daysWithFiber,
      daysWithSodium,
      todayWater: rawWater[formatDateKey(today)] || 0,
      todaySugar: rawSugar[formatDateKey(today)] || 0,
      todayFiber: rawFiber[formatDateKey(today)] || 0,
      todaySodium: rawSodium[formatDateKey(today)] || 0,
    };
  }, [nutritionRaw, timeRangeDays]);

  const activityTrend = useMemo(() => {
    const stepsData = exerciseData.stepsData || {};
    const exercisesData = exerciseData.exercises || {};
    const days = timeRangeDays;
    const today = new Date();
    let totalSteps = 0, totalExerciseCals = 0, totalStepsCals = 0;
    let daysWithSteps = 0, daysWithExercise = 0;
    let totalExerciseDuration = 0;

    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = formatDateKey(d);
      const steps = stepsData[key] || 0;
      const dayExercises = exercisesData[key] || [];
      const exCals = (dayExercises as any[]).reduce((sum: number, e: any) => sum + (e.caloriesBurned || 0), 0);
      const exDuration = (dayExercises as any[]).reduce((sum: number, e: any) => sum + (e.duration || 0), 0);
      if (steps > 0) { totalSteps += steps; daysWithSteps++; }
      if (dayExercises.length > 0) { totalExerciseCals += exCals; totalExerciseDuration += exDuration; daysWithExercise++; }
      totalStepsCals += Math.round(steps * 0.04);
    }

    const todayKey = formatDateKey(today);
    const todaySteps = stepsData[todayKey] || 0;
    const todayExercises = exercisesData[todayKey] || [];
    const todayExCals = (todayExercises as any[]).reduce((sum: number, e: any) => sum + (e.caloriesBurned || 0), 0);
    const todayStepsCals = Math.round(todaySteps * 0.04);

    return {
      avgSteps: daysWithSteps > 0 ? Math.round(totalSteps / daysWithSteps) : 0,
      avgExerciseCals: daysWithExercise > 0 ? Math.round(totalExerciseCals / daysWithExercise) : 0,
      avgExerciseDuration: daysWithExercise > 0 ? Math.round(totalExerciseDuration / daysWithExercise) : 0,
      totalBurned: totalStepsCals + totalExerciseCals,
      daysWithSteps,
      daysWithExercise,
      todaySteps,
      todayExCals,
      todayStepsCals,
      todayTotalBurned: todayStepsCals + todayExCals,
    };
  }, [exerciseData, timeRangeDays]);

  const renderMicrosSection = () => {
    const micros = [
      {
        name: 'Gula',
        value: microsTrend.todaySugar,
        avg: microsTrend.avgSugar,
        target: 25,
        unit: 'g',
        color: '#F59E0B',
        isLessBetter: true,
      },
      {
        name: 'Serat',
        value: microsTrend.todayFiber,
        avg: microsTrend.avgFiber,
        target: 25,
        unit: 'g',
        color: '#22C55E',
        isLessBetter: false,
      },
      {
        name: 'Sodium',
        value: microsTrend.todaySodium,
        avg: microsTrend.avgSodium,
        target: 2300,
        unit: 'mg',
        color: '#EF4444',
        isLessBetter: true,
      },
    ];

    return (
      <View style={[styles.chartCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.chartHeader}>
          <View style={styles.chartTitleRow}>
            <View style={[styles.chartIconWrap, { backgroundColor: '#F59E0B' + '15' }]}>
              <Zap size={18} color="#F59E0B" />
            </View>
            <View>
              <Text style={[styles.chartTitle, { color: theme.text }]}>Mikronutrien</Text>
              <Text style={[styles.chartSubtitle, { color: theme.textSecondary }]}>
                Rata-rata {timeRange === '7h' ? '7 hari' : timeRange === '30h' ? '30 hari' : '90 hari'} terakhir
              </Text>
            </View>
          </View>
        </View>

        {micros.map((micro) => {
          const progress = micro.target > 0 ? Math.min((micro.avg / micro.target) * 100, 100) : 0;
          const isOverLimit = micro.isLessBetter && micro.avg > micro.target;
          const isGood = micro.isLessBetter ? micro.avg <= micro.target : micro.avg >= micro.target;

          return (
            <View key={micro.name} style={styles.microRow}>
              <View style={styles.microRowHeader}>
                <View style={styles.microRowLeft}>
                  <View style={[styles.microColorDot, { backgroundColor: micro.color }]} />
                  <Text style={[styles.microRowName, { color: theme.text }]}>{micro.name}</Text>
                </View>
                <View style={styles.microRowRight}>
                  <Text style={[styles.microRowAvg, { color: isOverLimit ? theme.destructive : theme.text }]}>
                    {micro.avg}
                  </Text>
                  <Text style={[styles.microRowTarget, { color: theme.textTertiary }]}>
                    / {micro.target}{micro.unit}
                  </Text>
                  {isGood && (
                    <Text style={styles.microGoodBadge}>✓</Text>
                  )}
                </View>
              </View>
              <View style={[styles.microProgressBg, { backgroundColor: theme.border }]}>
                <View
                  style={[
                    styles.microProgressFill,
                    {
                      width: `${progress}%`,
                      backgroundColor: isOverLimit ? theme.destructive : micro.color,
                    },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderWaterSection = () => {
    const waterTarget = 8;
    const waterProgress = waterTarget > 0 ? Math.min((microsTrend.todayWater / waterTarget) * 100, 100) : 0;

    return (
      <View style={[styles.chartCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.chartHeader}>
          <View style={styles.chartTitleRow}>
            <View style={[styles.chartIconWrap, { backgroundColor: '#06B6D4' + '15' }]}>
              <Droplets size={18} color="#06B6D4" />
            </View>
            <View>
              <Text style={[styles.chartTitle, { color: theme.text }]}>Air</Text>
              <Text style={[styles.chartSubtitle, { color: theme.textSecondary }]}>
                Rata-rata {timeRange === '7h' ? '7 hari' : timeRange === '30h' ? '30 hari' : '90 hari'} terakhir
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.waterTrendRow}>
          <View style={styles.waterTrendLeft}>
            <Droplets size={20} color="#06B6D4" />
            <View>
              <Text style={[styles.waterTrendLabel, { color: theme.text }]}>Air Hari Ini</Text>
              <Text style={[styles.waterTrendSub, { color: theme.textSecondary }]}>
                Rata-rata: {microsTrend.avgWater} gelas/hari
              </Text>
            </View>
          </View>
          <View style={styles.waterTrendRight}>
            <Text style={[styles.waterTrendValue, { color: '#06B6D4' }]}>{microsTrend.todayWater}</Text>
            <Text style={[styles.waterTrendTarget, { color: theme.textTertiary }]}>/ {waterTarget}</Text>
          </View>
        </View>
        <View style={[styles.waterProgressBg, { backgroundColor: theme.border }]}>
          <View style={[styles.waterProgressFill, { width: `${waterProgress}%`, backgroundColor: '#06B6D4' }]} />
        </View>
      </View>
    );
  };

  const renderActivitySection = () => {
    const stepsGoal = 10000;
    const stepsProgress = stepsGoal > 0 ? Math.min((activityTrend.todaySteps / stepsGoal) * 100, 100) : 0;

    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const key = formatDateKey(d);
      const steps = (exerciseData.stepsData || {})[key] || 0;
      const dayLabel = d.toLocaleDateString('id-ID', { weekday: 'short' }).slice(0, 2);
      const isToday = key === formatDateKey(new Date());
      return { key, steps, dayLabel, isToday };
    });
    const maxSteps = Math.max(...last7.map(d => d.steps), 1);
    const stepsChartHeight = 80;

    return (
      <View style={[styles.chartCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.chartHeader}>
          <View style={styles.chartTitleRow}>
            <View style={[styles.chartIconWrap, { backgroundColor: '#10B981' + '15' }]}>
              <Activity size={18} color="#10B981" />
            </View>
            <View>
              <Text style={[styles.chartTitle, { color: theme.text }]}>Aktivitas</Text>
              <Text style={[styles.chartSubtitle, { color: theme.textSecondary }]}>
                Langkah & kalori terbakar
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.activityStatsRow}>
          <View style={[styles.activityStatCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Footprints size={18} color="#10B981" />
            <Text style={[styles.activityStatValue, { color: theme.text }]}>
              {activityTrend.todaySteps.toLocaleString()}
            </Text>
            <Text style={[styles.activityStatLabel, { color: theme.textSecondary }]}>langkah</Text>
            <View style={[styles.activityMiniProgress, { backgroundColor: theme.border }]}>
              <View style={[styles.activityMiniProgressFill, { width: `${stepsProgress}%`, backgroundColor: '#10B981' }]} />
            </View>
          </View>

          <View style={[styles.activityStatCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Flame size={18} color="#F59E0B" />
            <Text style={[styles.activityStatValue, { color: theme.text }]}>
              {activityTrend.todayTotalBurned}
            </Text>
            <Text style={[styles.activityStatLabel, { color: theme.textSecondary }]}>cal terbakar</Text>
            <View style={styles.activityBurnBreakdown}>
              <Text style={[styles.activityBurnDetail, { color: theme.textTertiary }]}>
                {activityTrend.todayStepsCals} langkah
              </Text>
              <Text style={[styles.activityBurnDetail, { color: theme.textTertiary }]}>
                + {activityTrend.todayExCals} latihan
              </Text>
            </View>
          </View>

          <View style={[styles.activityStatCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Dumbbell size={18} color="#8B5CF6" />
            <Text style={[styles.activityStatValue, { color: theme.text }]}>
              {activityTrend.avgExerciseDuration}
            </Text>
            <Text style={[styles.activityStatLabel, { color: theme.textSecondary }]}>mnt/hari</Text>
            <Text style={[styles.activityBurnDetail, { color: theme.textTertiary }]}>
              avg {activityTrend.avgExerciseCals} cal
            </Text>
          </View>
        </View>

        <View style={styles.stepsChartSection}>
          <Text style={[styles.stepsChartTitle, { color: theme.textSecondary }]}>Langkah 7 hari terakhir</Text>
          <View style={[styles.stepsChartArea, { height: stepsChartHeight + 30 }]}>
            {last7.map((d) => {
              const barH = maxSteps > 0 ? (d.steps / maxSteps) * stepsChartHeight : 0;
              return (
                <View key={d.key} style={styles.stepsBarCol}>
                  {d.steps > 0 && (
                    <Text style={[styles.stepsBarValue, { color: d.isToday ? '#10B981' : theme.textTertiary }]}>
                      {d.steps >= 1000 ? `${(d.steps / 1000).toFixed(1)}k` : d.steps}
                    </Text>
                  )}
                  <View
                    style={[
                      styles.stepsBar,
                      {
                        height: Math.max(barH, 4),
                        backgroundColor: d.isToday ? '#10B981' : '#10B981' + '40',
                      },
                      d.isToday && { borderWidth: 2, borderColor: '#10B981' },
                    ]}
                  />
                  <Text
                    style={[
                      styles.stepsDayLabel,
                      { color: d.isToday ? '#10B981' : theme.textTertiary },
                      d.isToday && { fontWeight: '700' as const },
                    ]}
                  >
                    {d.dayLabel}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={[styles.activityAvgRow, { borderTopColor: theme.border }]}>
          <View style={styles.activityAvgItem}>
            <Text style={[styles.activityAvgLabel, { color: theme.textSecondary }]}>Avg langkah</Text>
            <Text style={[styles.activityAvgValue, { color: theme.text }]}>
              {activityTrend.avgSteps.toLocaleString()}
            </Text>
          </View>
          <View style={[styles.activityAvgDivider, { backgroundColor: theme.border }]} />
          <View style={styles.activityAvgItem}>
            <Text style={[styles.activityAvgLabel, { color: theme.textSecondary }]}>Total terbakar</Text>
            <Text style={[styles.activityAvgValue, { color: theme.text }]}>
              {activityTrend.totalBurned.toLocaleString()} cal
            </Text>
          </View>
          <View style={[styles.activityAvgDivider, { backgroundColor: theme.border }]} />
          <View style={styles.activityAvgItem}>
            <Text style={[styles.activityAvgLabel, { color: theme.textSecondary }]}>Hari aktif</Text>
            <Text style={[styles.activityAvgValue, { color: theme.text }]}>
              {Math.max(activityTrend.daysWithSteps, activityTrend.daysWithExercise)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderBMICard = () => {
    if (!profile?.height || !profile?.weight) return null;
    const heightM = profile.height / 100;
    const bmi = profile.weight / (heightM * heightM);
    const bmiRounded = Math.round(bmi * 10) / 10;
    let category = '';
    let categoryColor = '';
    if (bmi < 18.5) { category = 'Kurus'; categoryColor = '#3B82F6'; }
    else if (bmi < 25) { category = 'Normal'; categoryColor = '#22C55E'; }
    else if (bmi < 30) { category = 'Berlebih'; categoryColor = '#F59E0B'; }
    else { category = 'Obesitas'; categoryColor = '#EF4444'; }
    const scalePosition = Math.max(0, Math.min(100, ((bmi - 15) / 25) * 100));
    return (
      <View style={[styles.bmiCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.bmiHeader}>
          <Text style={[styles.bmiTitle, { color: theme.text }]}>BMI Kamu</Text>
        </View>
        <View style={styles.bmiValueRow}>
          <Text style={[styles.bmiValueText, { color: theme.text }]}>{bmiRounded}</Text>
          <View style={[styles.bmiBadge, { backgroundColor: categoryColor + '18' }]}>
            <Text style={[styles.bmiBadgeText, { color: categoryColor }]}>{category}</Text>
          </View>
        </View>
        <View style={styles.bmiScaleWrapper}>
          <View style={styles.bmiScaleBar}>
            <View style={[styles.bmiSegment, { backgroundColor: '#3B82F6', flex: 14 }]} />
            <View style={[styles.bmiSegment, { backgroundColor: '#22C55E', flex: 26 }]} />
            <View style={[styles.bmiSegment, { backgroundColor: '#F59E0B', flex: 20 }]} />
            <View style={[styles.bmiSegment, { backgroundColor: '#EF4444', flex: 40 }]} />
          </View>
          <View style={[styles.bmiPointer, { left: `${scalePosition}%` }]}>
            <View style={[styles.bmiPointerLine, { backgroundColor: theme.text }]} />
          </View>
        </View>
        <View style={styles.bmiLegendRow}>
          <View style={styles.bmiLegendCol}>
            <View style={[styles.bmiLegendDot, { backgroundColor: '#3B82F6' }]} />
            <Text style={[styles.bmiLegendLabel, { color: theme.textTertiary }]}>Kurus</Text>
            <Text style={[styles.bmiLegendRange, { color: theme.textTertiary }]}>&lt;18.5</Text>
          </View>
          <View style={styles.bmiLegendCol}>
            <View style={[styles.bmiLegendDot, { backgroundColor: '#22C55E' }]} />
            <Text style={[styles.bmiLegendLabel, { color: theme.textTertiary }]}>Normal</Text>
            <Text style={[styles.bmiLegendRange, { color: theme.textTertiary }]}>18.5-24.9</Text>
          </View>
          <View style={styles.bmiLegendCol}>
            <View style={[styles.bmiLegendDot, { backgroundColor: '#F59E0B' }]} />
            <Text style={[styles.bmiLegendLabel, { color: theme.textTertiary }]}>Berlebih</Text>
            <Text style={[styles.bmiLegendRange, { color: theme.textTertiary }]}>25.0-29.9</Text>
          </View>
          <View style={styles.bmiLegendCol}>
            <View style={[styles.bmiLegendDot, { backgroundColor: '#EF4444' }]} />
            <Text style={[styles.bmiLegendLabel, { color: theme.textTertiary }]}>Obesitas</Text>
            <Text style={[styles.bmiLegendRange, { color: theme.textTertiary }]}>&gt;30.0</Text>
          </View>
        </View>
      </View>
    );
  };

  if (!setupReady) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Kemajuan</Text>
          </View>
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.card }]}>
              <TrendingUp size={32} color={theme.textTertiary} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Belum ada data</Text>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              Lengkapi profil dan mulai catat makananmu untuk melihat analitik
            </Text>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Kemajuan</Text>
          </View>

          {renderStreakVisualization()}
          {renderWeightSection()}
          {renderBodyProgress()}
          {renderWeightChanges()}
          {renderCalorieChart()}
          {renderActivitySection()}
          {renderWeeklyEnergy()}
          {renderExpenditureChanges()}
          {renderMacroChart()}
          {renderMicrosSection()}
          {renderWaterSection()}
          {renderBMICard()}

          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={[styles.statIconWrap, { backgroundColor: '#FF6B35' + '15' }]}>
                <Flame size={18} color="#FF6B35" fill="#FF6B35" />
              </View>
              <Text style={[styles.statValue, { color: theme.text }]}>{streakData?.currentStreak ?? 0}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Streak</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={[styles.statIconWrap, { backgroundColor: '#F59E0B' + '15' }]}>
                <Award size={18} color="#F59E0B" />
              </View>
              <Text style={[styles.statValue, { color: theme.text }]}>{streakData?.bestStreak ?? 0}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Rekor</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={[styles.statIconWrap, { backgroundColor: theme.primary + '15' }]}>
                <Calendar size={18} color={theme.primary} />
              </View>
              <Text style={[styles.statValue, { color: theme.text }]}>{stats.daysLogged}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Hari</Text>
            </View>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </View>

      <Modal
        visible={showWeightModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowWeightModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowWeightModal(false)}
          />
          
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Catat Berat Badan</Text>
              <TouchableOpacity 
                onPress={() => setShowWeightModal(false)}
                style={[styles.modalCloseBtn, { backgroundColor: theme.background }]}
              >
                <X size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Berat badan (kg)</Text>
              <TextInput
                value={weightInput}
                onChangeText={setWeightInput}
                placeholder={stats.currentWeight > 0 ? stats.currentWeight.toFixed(1) : '70.0'}
                placeholderTextColor={theme.textTertiary}
                keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
                style={[styles.weightInputLarge, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                autoFocus
              />
              {weightError && <Text style={styles.weightError}>{weightError}</Text>}
              
              {stats.currentWeight > 0 && (
                <Text style={[styles.currentWeightHint, { color: theme.textTertiary }]}>
                  Berat terakhir: {stats.currentWeight.toFixed(1)} kg
                </Text>
              )}

              <Text style={[styles.modalLabel, { color: theme.textSecondary, marginTop: 24 }]}>Tanggal</Text>
              <TouchableOpacity
                style={[styles.datePickerButton, { backgroundColor: theme.background, borderColor: theme.border }]}
                onPress={openCalendarPicker}
                activeOpacity={0.7}
              >
                <Calendar size={20} color={theme.primary} />
                <Text style={[styles.datePickerButtonText, { color: theme.text }]}>
                  {formatDisplayDate(selectedDate)}
                </Text>
                <ChevronRight size={18} color={theme.textTertiary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: theme.border }]}
                onPress={() => setShowWeightModal(false)}
                activeOpacity={0.7}
              >
                <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: '#3B82F6' }]}
                onPress={logWeight}
                activeOpacity={0.8}
              >
                <Text style={styles.saveButtonText}>Simpan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
        visible={showPhotoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPhotoModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowPhotoModal(false)}
        />
        <View style={[styles.modalContainer, { justifyContent: 'flex-end' }]}>
          <View style={[styles.photoModalContent, { backgroundColor: theme.card }]}>
            <View style={styles.photoModalHandle}>
              <View style={[styles.photoModalHandleBar, { backgroundColor: theme.border }]} />
            </View>
            <Text style={[styles.photoModalTitle, { color: theme.text }]}>Foto Kemajuan Tubuh</Text>
            <Text style={[styles.photoModalSubtitle, { color: theme.textSecondary }]}>
              Dokumentasi perubahan tubuhmu secara berkala
            </Text>
            <TouchableOpacity
              style={[styles.photoModalOption, { backgroundColor: '#8B5CF6' + '10' }]}
              onPress={takeBodyPhoto}
              activeOpacity={0.7}
            >
              <View style={[styles.photoModalIconWrap, { backgroundColor: '#8B5CF6' + '20' }]}>
                <Camera size={22} color="#8B5CF6" />
              </View>
              <View style={styles.photoModalOptionText}>
                <Text style={[styles.photoModalOptionTitle, { color: theme.text }]}>Ambil Foto</Text>
                <Text style={[styles.photoModalOptionDesc, { color: theme.textSecondary }]}>Gunakan kamera untuk foto baru</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.photoModalOption, { backgroundColor: '#3B82F6' + '10' }]}
              onPress={pickBodyPhoto}
              activeOpacity={0.7}
            >
              <View style={[styles.photoModalIconWrap, { backgroundColor: '#3B82F6' + '20' }]}>
                <ImageIcon size={22} color="#3B82F6" />
              </View>
              <View style={styles.photoModalOptionText}>
                <Text style={[styles.photoModalOptionTitle, { color: theme.text }]}>Pilih dari Galeri</Text>
                <Text style={[styles.photoModalOptionDesc, { color: theme.textSecondary }]}>Pilih foto yang sudah ada</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.photoModalCancel, { borderColor: theme.border }]}
              onPress={() => setShowPhotoModal(false)}
              activeOpacity={0.7}
            >
              <Text style={[styles.photoModalCancelText, { color: theme.textSecondary }]}>Batal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showEditWeightModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditWeightModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowEditWeightModal(false)}
          />
          
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Edit Berat Badan</Text>
              <TouchableOpacity 
                onPress={() => setShowEditWeightModal(false)}
                style={[styles.modalCloseBtn, { backgroundColor: theme.background }]}
              >
                <X size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {selectedWeightEntry && (
                <Text style={[styles.editDateLabel, { color: theme.textSecondary }]}>
                  {new Date(selectedWeightEntry.date).toLocaleDateString('id-ID', { 
                    weekday: 'long', 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric' 
                  })}
                </Text>
              )}
              
              <Text style={[styles.modalLabel, { color: theme.textSecondary, marginTop: 16 }]}>Berat badan (kg)</Text>
              <TextInput
                value={editWeightInput}
                onChangeText={setEditWeightInput}
                placeholder="70.0"
                placeholderTextColor={theme.textTertiary}
                keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
                style={[styles.weightInputLarge, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                autoFocus
              />
            </View>

            <View style={styles.editModalFooter}>
              <TouchableOpacity
                style={[styles.deleteWeightBtn, { borderColor: theme.destructive }]}
                onPress={deleteWeight}
                activeOpacity={0.7}
              >
                <Trash2 size={18} color="#C53030" />
                <Text style={styles.deleteWeightBtnText}>Hapus</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: '#3B82F6', flex: 1 }]}
                onPress={updateWeight}
                activeOpacity={0.8}
              >
                <Text style={styles.saveButtonText}>Simpan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  progressBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  progressBadgeText: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
  weightTimeRange: {
    flexDirection: 'row' as const,
    gap: 8,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  weightTimeRangePill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center' as const,
  },
  weightTimeRangeText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  weightSection: {
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
  },
  weightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  chartTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chartIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  chartSubtitle: {
    fontSize: 11,
    fontWeight: '500' as const,
    marginTop: 2,
    opacity: 0.7,
  },
  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  recordBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  weightStats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  weightStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  weightStatDivider: {
    width: 1,
    height: 40,
  },
  weightStatValue: {
    fontSize: 24,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  weightStatLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    marginTop: 4,
  },
  weightChangeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  emptyWeightState: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyWeightText: {
    fontSize: 14,
    fontWeight: '500' as const,
    textAlign: 'center',
    lineHeight: 20,
  },
  weightGraphContainer: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  graphWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  graphYLabels: {
    width: 50,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 8,
  },
  weightGraph: {
    position: 'relative',
    flex: 1,
  },
  graphDotTouchable: {
    position: 'absolute',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  graphDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  graphLine: {
    position: 'absolute',
    height: 2,
    borderRadius: 1,
    transformOrigin: 'left center',
  },
  targetGraphLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
    borderStyle: 'dashed',
  },
  graphLabel: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
  targetLabel: {
    fontWeight: '600' as const,
  },
  graphDateLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  graphDateLabel: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
  projectionCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  projectionFriendlyText: {
    fontSize: 15,
    fontWeight: '600' as const,
    marginBottom: 4,
    lineHeight: 22,
  },
  projectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  estimatedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 'auto',
  },
  estimatedBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#F59E0B',
  },
  projectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  projectionContent: {
    gap: 2,
  },
  projectionDate: {
    fontSize: 17,
    fontWeight: '700' as const,
  },
  projectionSubtext: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  projectionMessage: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  chartCard: {
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  targetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  targetBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  chartContainer: {
    position: 'relative',
  },
  targetLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  targetLineDash: {
    flex: 1,
    height: 1,
    opacity: 0.4,
  },
  barsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: '100%',
    paddingTop: 24,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    maxWidth: 50,
  },
  bar: {
    width: '65%',
    minHeight: 4,
    maxWidth: 24,
  },
  barLabel: {
    fontSize: 10,
    fontWeight: '500' as const,
    textAlign: 'center',
  },
  barValue: {
    fontSize: 10,
    fontWeight: '600' as const,
    height: 14,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  macroListContainer: {
    gap: 16,
  },
  macroListItem: {
    gap: 10,
  },
  macroListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  macroListLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  macroColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  macroListName: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  macroListRight: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  macroListValue: {
    fontSize: 17,
    fontWeight: '700' as const,
  },
  macroListTarget: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  macroProgressBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  macroProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  statCard: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    marginTop: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500' as const,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: SCREEN_WIDTH - 48,
    borderRadius: 14,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 0,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    padding: 20,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 10,
  },
  datePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  dateNavBtn: {
    padding: 14,
  },
  dateDisplay: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
  },
  dateDisplayText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  weightInputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  weightInput: {
    flex: 1,
    height: 60,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 20,
    fontSize: 28,
    fontWeight: '700' as const,
    textAlign: 'center',
  },
  weightInputLarge: {
    height: 60,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 20,
    fontSize: 30,
    fontWeight: '800' as const,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  weightUnitBox: {
    width: 60,
    height: 60,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightUnit: {
    fontSize: 18,
    fontWeight: '600' as const,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  datePickerButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  weightError: {
    color: '#C53030',
    fontSize: 13,
    fontWeight: '600' as const,
    marginTop: 10,
  },
  currentWeightHint: {
    fontSize: 13,
    fontWeight: '500' as const,
    marginTop: 16,
    textAlign: 'center',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    paddingTop: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  editDateLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  editModalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    paddingTop: 8,
  },
  deleteWeightBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1,
  },
  deleteWeightBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#C53030',
  },
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarModalContent: {
    width: SCREEN_WIDTH - 48,
    borderRadius: 14,
    padding: 20,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  calendarNavBtn: {
    padding: 8,
  },
  calendarMonthText: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  calendarWeekdays: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  calendarWeekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600' as const,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  streakRow: {
    flexDirection: 'row' as const,
    gap: 10,
    marginBottom: 16,
  },
  streakCardLeft: {
    flex: 3,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    alignItems: 'center' as const,
    gap: 6,
  },
  streakCardRight: {
    flex: 2,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
  },
  streakCardNumber: {
    fontSize: 28,
    fontWeight: '800' as const,
    letterSpacing: -1,
  },
  streakCardLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  weekDotsRow: {
    flexDirection: 'row' as const,
    gap: 6,
    marginTop: 8,
  },
  weekDotCol: {
    alignItems: 'center' as const,
    gap: 4,
  },
  weekDotDayLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
  },
  weekDotCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  changeRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 14,
    gap: 10,
  },
  changeLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    width: 60,
  },
  changeTrendBar: {
    width: 32,
    height: 16,
    borderRadius: 4,
  },
  changeValue: {
    fontSize: 15,
    fontWeight: '700' as const,
    flex: 1,
    textAlign: 'right' as const,
  },
  changeTrend: {
    fontSize: 13,
    fontWeight: '600' as const,
    width: 72,
    textAlign: 'right' as const,
  },
  energyStatsRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 20,
  },
  energyStat: {
    alignItems: 'center' as const,
    flex: 1,
  },
  energyStatLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    marginBottom: 4,
  },
  energyStatValue: {
    fontSize: 20,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  energyStatUnit: {
    fontSize: 12,
    fontWeight: '500' as const,
    marginTop: 2,
  },
  energyChartArea: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-end' as const,
    paddingBottom: 24,
  },
  energyBarCol: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'flex-end' as const,
    gap: 6,
  },
  energyBarPair: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    gap: 3,
  },
  energyBar: {
    width: 14,
    borderRadius: 4,
    minHeight: 3,
  },
  energyDayLabel: {
    fontSize: 10,
    fontWeight: '500' as const,
  },
  bmiCard: {
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
  },
  bmiHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
  },
  bmiTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  bmiValueRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    marginBottom: 20,
  },
  bmiValueText: {
    fontSize: 36,
    fontWeight: '800' as const,
    letterSpacing: -1,
  },
  bmiBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  bmiBadgeText: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  bmiScaleWrapper: {
    position: 'relative' as const,
    marginBottom: 20,
    height: 20,
  },
  bmiScaleBar: {
    flexDirection: 'row' as const,
    height: 10,
    borderRadius: 5,
    overflow: 'hidden' as const,
    marginTop: 5,
  },
  bmiSegment: {
    height: '100%' as const,
  },
  bmiPointer: {
    position: 'absolute' as const,
    top: 0,
    width: 3,
    height: 20,
    marginLeft: -1.5,
  },
  bmiPointerLine: {
    width: 3,
    height: 20,
    borderRadius: 1.5,
  },
  bmiLegendRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
  },
  bmiLegendCol: {
    alignItems: 'center' as const,
    gap: 3,
  },
  bmiLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bmiLegendLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  bmiLegendRange: {
    fontSize: 10,
    fontWeight: '500' as const,
  },
  emptyPhotoState: {
    alignItems: 'center' as const,
    paddingVertical: 28,
    borderWidth: 1,
    borderStyle: 'dashed' as const,
    borderRadius: 12,
  },
  emptyPhotoIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 12,
  },
  emptyPhotoTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  emptyPhotoText: {
    fontSize: 13,
    fontWeight: '500' as const,
    textAlign: 'center' as const,
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  photoScroll: {
    marginHorizontal: -4,
  },
  photoCard: {
    marginHorizontal: 4,
    alignItems: 'center' as const,
    gap: 6,
  },
  photoImageWrap: {
    width: 90,
    height: 120,
    borderRadius: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 4,
  },
  photoPlaceholder: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
  photoDateLabel: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
  photoModalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    width: '100%' as const,
  },
  photoModalHandle: {
    alignItems: 'center' as const,
    marginBottom: 20,
  },
  photoModalHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  photoModalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  photoModalSubtitle: {
    fontSize: 14,
    fontWeight: '500' as const,
    marginBottom: 24,
  },
  photoModalOption: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 14,
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
  },
  photoModalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  photoModalOptionText: {
    flex: 1,
    gap: 2,
  },
  photoModalOptionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  photoModalOptionDesc: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  photoModalCancel: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center' as const,
  },
  photoModalCancelText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  fotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  fotoBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  waterTrendRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 10,
  },
  waterTrendLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  waterTrendLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  waterTrendSub: {
    fontSize: 12,
    fontWeight: '500' as const,
    marginTop: 1,
  },
  waterTrendRight: {
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
    gap: 2,
  },
  waterTrendValue: {
    fontSize: 22,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  waterTrendTarget: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  waterProgressBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden' as const,
    marginBottom: 4,
  },
  waterProgressFill: {
    height: '100%' as const,
    borderRadius: 4,
  },
  microsDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginVertical: 16,
  },
  microRow: {
    gap: 8,
    marginBottom: 14,
  },
  microRowHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  microRowLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  microColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  microRowName: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  microRowRight: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
  },
  microRowAvg: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  microRowTarget: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  microGoodBadge: {
    fontSize: 13,
    color: '#22C55E',
    fontWeight: '700' as const,
    marginLeft: 4,
  },
  microProgressBg: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden' as const,
  },
  microProgressFill: {
    height: '100%' as const,
    borderRadius: 3,
  },
  activityStatsRow: {
    flexDirection: 'row' as const,
    gap: 8,
    marginBottom: 16,
  },
  activityStatCard: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center' as const,
    gap: 4,
  },
  activityStatValue: {
    fontSize: 18,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  activityStatLabel: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
  activityMiniProgress: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden' as const,
    width: '100%' as const,
    marginTop: 4,
  },
  activityMiniProgressFill: {
    height: '100%' as const,
    borderRadius: 2,
  },
  activityBurnBreakdown: {
    alignItems: 'center' as const,
    marginTop: 2,
  },
  activityBurnDetail: {
    fontSize: 10,
    fontWeight: '500' as const,
  },
  stepsChartSection: {
    marginBottom: 8,
  },
  stepsChartTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    marginBottom: 12,
  },
  stepsChartArea: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-end' as const,
    paddingBottom: 24,
  },
  stepsBarCol: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'flex-end' as const,
    gap: 4,
  },
  stepsBar: {
    width: '55%' as const,
    borderRadius: 6,
    maxWidth: 24,
  },
  stepsBarValue: {
    fontSize: 9,
    fontWeight: '600' as const,
  },
  stepsDayLabel: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
  activityAvgRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  activityAvgItem: {
    flex: 1,
    alignItems: 'center' as const,
    gap: 2,
  },
  activityAvgLabel: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
  activityAvgValue: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
  activityAvgDivider: {
    width: 1,
    height: 28,
  },
});
