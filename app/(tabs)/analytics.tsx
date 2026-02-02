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
} from 'lucide-react-native';
import { useNutrition } from '@/contexts/NutritionContext';
import { useTheme } from '@/contexts/ThemeContext';
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
                    <Text style={[styles.barValue, { color: isOverTarget ? '#EF4444' : '#10B981' }]}>
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
                            ? '#EF4444' 
                            : '#10B981',
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
            <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
            <Text style={[styles.legendText, { color: theme.textSecondary }]}>Sesuai target</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
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

  const renderWeightSection = () => {
    const hasWeightData = weightChartData.length >= 1;
    const targetWeight = stats.targetWeight;
    const goal = profile?.goal;
    
    const getWeightChangeColor = () => {
      if (stats.weightChange === 0) return theme.textSecondary;
      if (goal === 'lose') {
        return stats.weightChange < 0 ? '#10B981' : '#EF4444';
      }
      if (goal === 'gain') {
        return stats.weightChange > 0 ? '#10B981' : '#EF4444';
      }
      return Math.abs(stats.weightChange) < 1 ? '#10B981' : '#F59E0B';
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
        
        {goalProjection && targetWeight > 0 && (
          <View style={[styles.projectionCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
            {(goalProjection.type === 'projected' || goalProjection.type === 'estimated') ? (
              <View style={styles.projectionContent}>
                <Text style={[styles.projectionFriendlyText, { color: theme.text }]}>
                  🎯 Kamu akan mencapai berat impianmu sekitar
                </Text>
                <Text style={[styles.projectionDate, { color: '#10B981' }]}>
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
    const targetCarbs = dailyTargets?.carbs ?? 0;
    const targetFat = dailyTargets?.fat ?? 0;
    
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
        color: '#EF4444',
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
                    <Text style={[styles.macroListValue, { color: isOver ? '#EF4444' : theme.text }]}>
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
                        backgroundColor: isOver ? '#EF4444' : macro.color,
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

  if (!setupReady) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Analitik</Text>
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
            <Text style={[styles.headerTitle, { color: theme.text }]}>Analitik</Text>
            {profile?.goalWeight && profile?.weight && profile.goalWeight !== profile.weight && (
              <View style={[styles.progressBadge, { backgroundColor: stats.weightProgress >= 100 ? '#10B981' + '20' : '#3B82F6' + '15' }]}>
                <Target size={16} color={stats.weightProgress >= 100 ? '#10B981' : '#3B82F6'} />
                <Text style={[styles.progressBadgeText, { color: stats.weightProgress >= 100 ? '#10B981' : '#3B82F6' }]}>
                  {stats.weightProgress}% tercapai
                </Text>
              </View>
            )}
          </View>

          <View style={styles.timeRangeContainer}>
            {(['7h', '30h', '90h'] as const).map(range => (
              <TouchableOpacity
                key={range}
                style={[
                  styles.timeRangePill,
                  { backgroundColor: theme.card, borderColor: theme.border },
                  timeRange === range && { backgroundColor: theme.primary, borderColor: theme.primary },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setTimeRange(range);
                }}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.timeRangeText,
                  { color: theme.textSecondary },
                  timeRange === range && { color: '#ffffff' },
                ]}>
                  {range === '7h' ? '7 Hari' : range === '30h' ? '30 Hari' : '90 Hari'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {renderWeightSection()}
          {renderCalorieChart()}
          {renderMacroChart()}

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
              <View style={[styles.statIconWrap, { backgroundColor: '#10B981' + '15' }]}>
                <Calendar size={18} color="#10B981" />
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
                style={[styles.deleteWeightBtn, { borderColor: '#EF4444' }]}
                onPress={deleteWeight}
                activeOpacity={0.7}
              >
                <Trash2 size={18} color="#EF4444" />
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
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  progressBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  progressBadgeText: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
  timeRangeContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  timeRangePill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  timeRangeText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  weightSection: {
    borderRadius: 20,
    padding: 20,
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
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
  },
  chartSubtitle: {
    fontSize: 13,
    fontWeight: '500' as const,
    marginTop: 2,
  },
  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
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
    fontSize: 26,
    fontWeight: '700' as const,
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
    padding: 16,
    borderRadius: 14,
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
    borderRadius: 20,
    padding: 20,
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
    paddingVertical: 6,
    borderRadius: 10,
  },
  targetBadgeText: {
    fontSize: 13,
    fontWeight: '700' as const,
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
    width: '70%',
    minHeight: 6,
    maxWidth: 28,
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
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  macroProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700' as const,
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
    borderRadius: 24,
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
    height: 64,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 20,
    fontSize: 32,
    fontWeight: '700' as const,
    textAlign: 'center',
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
    color: '#EF4444',
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
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
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
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
  },
  deleteWeightBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#EF4444',
  },
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarModalContent: {
    width: SCREEN_WIDTH - 48,
    borderRadius: 20,
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
    backgroundColor: '#3B82F6',
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
});
