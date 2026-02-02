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
  Flame, 
  TrendingUp, 
  TrendingDown, 
  Scale, 
  Award,
  Calendar,
  Lightbulb,
  Plus,
  X,
} from 'lucide-react-native';
import { useNutrition } from '@/contexts/NutritionContext';
import { useTheme } from '@/contexts/ThemeContext';
import { FoodEntry } from '@/types/nutrition';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type TimeRange = '7h' | '30h' | '90h' | 'All';

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
    case 'All': return 365;
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
    const list = (weightHistory || [])
      .filter((w: any) => Number.isFinite(new Date(w.date).getTime()))
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - timeRangeDays);
    return list.filter((w: any) => new Date(w.date) >= cutoff);
  }, [weightHistory, timeRangeDays]);

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

    const startWeight = weightChartData.length > 0 ? weightChartData[0].weight : profile?.weight ?? 0;
    const currentWeight = profile?.weight ?? 0;
    const weightChange = currentWeight - startWeight;

    const totalProtein = daysWithData.reduce((sum, d) => sum + d.protein, 0);
    const avgProtein = daysWithData.length > 0 ? Math.round(totalProtein / daysWithData.length) : 0;

    const totalCarbs = daysWithData.reduce((sum, d) => sum + d.carbs, 0);
    const avgCarbs = daysWithData.length > 0 ? Math.round(totalCarbs / daysWithData.length) : 0;

    const totalFat = daysWithData.reduce((sum, d) => sum + d.fat, 0);
    const avgFat = daysWithData.length > 0 ? Math.round(totalFat / daysWithData.length) : 0;

    return {
      avgCalories,
      daysLogged: daysWithData.length,
      consistencyPercentage,
      daysWithinTarget,
      weightChange,
      avgProtein,
      avgCarbs,
      avgFat,
      targetCalories,
      startWeight,
      currentWeight,
    };
  }, [dayData, dailyTargets, profile, weightChartData]);

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
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const dateKey = formatDateKey(selectedDate);

      const addWeightEntry = nutrition?.addWeightEntry;
      const addWeight = nutrition?.addWeight;
      const updateProfileWeight = nutrition?.updateProfileWeight;

      if (typeof addWeightEntry === 'function') {
        await addWeightEntry({ date: dateKey, weight: value });
      } else if (typeof addWeight === 'function') {
        await addWeight(dateKey, value);
      } else if (typeof updateProfileWeight === 'function') {
        await updateProfileWeight(value);
      }

      setWeightInput('');
      setShowWeightModal(false);
    } catch {
      setWeightError('Gagal menyimpan');
    }
  };

  const getDateOptions = () => {
    const options: Date[] = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      options.push(date);
    }
    return options;
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
    return date.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const getInsightMessage = () => {
    if (stats.daysLogged < 7) {
      return `Kami butuh minimal ${7 - stats.daysLogged} hari lagi untuk wawasan yang lebih akurat.`;
    }
    if (stats.consistencyPercentage >= 80) {
      return 'Konsistensi kamu luar biasa! Terus pertahankan pola makan sehatmu.';
    }
    if (stats.consistencyPercentage >= 50) {
      return 'Progresmu bagus! Coba tingkatkan konsistensi untuk hasil optimal.';
    }
    return 'Yuk mulai catat makananmu lebih rutin untuk hasil yang lebih baik.';
  };

  const getAxisLabel = (day: DayData, index: number, totalDays: number, range: TimeRange) => {
    const date = new Date(day.dateKey);
    if (range === '7h') {
      return date.toLocaleDateString('id-ID', { weekday: 'short' }).slice(0, 2);
    } else if (range === '30h') {
      if (index === 0 || index === totalDays - 1 || index % 5 === 0) {
        return date.toLocaleDateString('id-ID', { day: 'numeric' });
      }
      return '';
    } else if (range === '90h') {
      if (index === 0 || index === totalDays - 1 || index % 15 === 0) {
        return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }).replace(' ', '\n');
      }
      return '';
    } else {
      if (index === 0 || index === totalDays - 1 || index % 30 === 0) {
        return date.toLocaleDateString('id-ID', { month: 'short' });
      }
      return '';
    }
  };

  const renderCalorieChart = () => {
    const displayDays = timeRange === '7h' ? dayData.slice(-7) : 
                        timeRange === '30h' ? dayData.slice(-30) :
                        timeRange === '90h' ? dayData.slice(-90) : dayData;
    
    const maxCalories = Math.max(...displayDays.map(d => d.calories), stats.targetCalories);
    const chartHeight = 120;
    
    const maxBars = timeRange === '7h' ? 7 : timeRange === '30h' ? 15 : timeRange === '90h' ? 12 : 12;
    const step = displayDays.length > maxBars ? Math.ceil(displayDays.length / maxBars) : 1;
    const visibleDays = displayDays.filter((_, i) => i % step === 0 || i === displayDays.length - 1);

    const avgCaloriesInRange = displayDays.filter(d => d.entries.length > 0).length > 0 
      ? Math.round(displayDays.filter(d => d.entries.length > 0).reduce((sum, d) => sum + d.calories, 0) / displayDays.filter(d => d.entries.length > 0).length)
      : 0;

    return (
      <View style={[styles.chartCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.chartHeader}>
          <View>
            <Text style={[styles.chartTitle, { color: theme.text }]}>Kalori Harian</Text>
            <Text style={[styles.chartSubtitle, { color: theme.textSecondary }]}>
              Rata-rata: {avgCaloriesInRange} kkal
            </Text>
          </View>
          <View style={[styles.avgBadge, { backgroundColor: theme.primary + '15' }]}>
            <Text style={[styles.avgBadgeText, { color: theme.primary }]}>Target: {stats.targetCalories}</Text>
          </View>
        </View>
        
        <View style={[styles.chartContainer, { height: chartHeight + 40 }]}>
          <View style={[styles.targetLine, { bottom: (stats.targetCalories / maxCalories) * chartHeight + 20 }]}>
            <View style={[styles.targetLineDash, { backgroundColor: theme.primary }]} />
            <Text style={[styles.targetLineLabel, { color: theme.primary }]}>{stats.targetCalories}</Text>
          </View>
          
          <View style={styles.barsContainer}>
            {visibleDays.map((day, index) => {
              const barHeight = maxCalories > 0 ? (day.calories / maxCalories) * chartHeight : 0;
              const isOverTarget = day.calories > stats.targetCalories;
              const isToday = day.dateKey === formatDateKey(new Date());
              const axisLabel = getAxisLabel(day, index, visibleDays.length, timeRange);
              
              return (
                <View key={day.dateKey} style={styles.barColumn}>
                  <Text style={[styles.barValue, { color: theme.textTertiary }]}>
                    {day.calories > 0 && timeRange === '7h' ? day.calories : ''}
                  </Text>
                  <View 
                    style={[
                      styles.bar, 
                      { 
                        height: Math.max(barHeight, 4),
                        backgroundColor: day.calories === 0 
                          ? theme.border 
                          : isOverTarget 
                            ? '#EF4444' 
                            : '#10B981',
                        opacity: isToday ? 1 : 0.7,
                        borderWidth: isToday ? 2 : 0,
                        borderColor: isToday ? theme.primary : 'transparent',
                      }
                    ]} 
                  />
                  <Text style={[styles.barLabel, { color: isToday ? theme.primary : theme.textTertiary, fontWeight: isToday ? '700' as const : '500' as const }]}>
                    {axisLabel}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.chartLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
            <Text style={[styles.legendText, { color: theme.textSecondary }]}>Di bawah target</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
            <Text style={[styles.legendText, { color: theme.textSecondary }]}>Di atas target</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderWeightChart = () => {
    if (weightChartData.length < 2) {
      return (
        <View style={[styles.chartCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={[styles.chartTitle, { color: theme.text }]}>Berat Badan</Text>
              <Text style={[styles.chartSubtitle, { color: theme.textSecondary }]}>Tren perubahan</Text>
            </View>
            <TouchableOpacity
              style={[styles.recordBtn, { backgroundColor: theme.primary + '20' }]}
              onPress={openWeightModal}
              activeOpacity={0.7}
            >
              <Plus size={14} color={theme.primary} />
              <Text style={[styles.recordBtnText, { color: theme.primary }]}>Catat</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.emptyChartState}>
            <Scale size={32} color={theme.textTertiary} />
            <Text style={[styles.emptyChartText, { color: theme.textSecondary }]}>
              Catat berat badan minimal 2× untuk melihat grafik tren
            </Text>
          </View>
        </View>
      );
    }

    const weights = weightChartData.map((w: any) => w.weight);
    const minWeight = Math.min(...weights) - 2;
    const maxWeight = Math.max(...weights) + 2;
    const chartHeight = 100;
    const chartWidth = SCREEN_WIDTH - 80;

    const points = weightChartData.map((w: any, index: number) => {
      const x = (index / (weightChartData.length - 1)) * chartWidth;
      const y = chartHeight - ((w.weight - minWeight) / (maxWeight - minWeight)) * chartHeight;
      return { x, y, weight: w.weight, date: w.date };
    });

    return (
      <View style={[styles.chartCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.chartHeader}>
          <View>
            <Text style={[styles.chartTitle, { color: theme.text }]}>Berat Badan</Text>
            <Text style={[styles.chartSubtitle, { color: theme.textSecondary }]}>Tren perubahan</Text>
          </View>
          <TouchableOpacity
            style={[styles.recordBtn, { backgroundColor: theme.primary + '20' }]}
            onPress={openWeightModal}
            activeOpacity={0.7}
          >
            <Plus size={14} color={theme.primary} />
            <Text style={[styles.recordBtnText, { color: theme.primary }]}>Catat</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.lineChartContainer, { height: chartHeight + 40 }]}>
          <View style={styles.lineChart}>
            {points.map((point: { x: number; y: number; weight: number; date: string }, index: number) => (
              <View
                key={index}
                style={[
                  styles.chartDot,
                  {
                    left: point.x - 4,
                    top: point.y - 4,
                    backgroundColor: theme.primary,
                  }
                ]}
              />
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
                    styles.chartLine,
                    {
                      width: length,
                      left: prev.x,
                      top: prev.y,
                      backgroundColor: theme.primary,
                      transform: [{ rotate: `${angle}deg` }],
                    }
                  ]}
                />
              );
            })}
          </View>
          
          <View style={styles.weightLabels}>
            <Text style={[styles.weightLabel, { color: theme.textTertiary }]}>{maxWeight.toFixed(1)} kg</Text>
            <Text style={[styles.weightLabel, { color: theme.textTertiary }]}>{minWeight.toFixed(1)} kg</Text>
          </View>
        </View>

        <View style={styles.weightSummary}>
          <View style={styles.weightSummaryItem}>
            <Text style={[styles.weightSummaryValue, { color: theme.text }]}>{stats.currentWeight.toFixed(1)}</Text>
            <Text style={[styles.weightSummaryLabel, { color: theme.textSecondary }]}>Saat ini (kg)</Text>
          </View>
          <View style={[styles.weightSummaryDivider, { backgroundColor: theme.border }]} />
          <View style={styles.weightSummaryItem}>
            <View style={styles.weightChangeRow}>
              {stats.weightChange !== 0 && (
                stats.weightChange > 0 ? 
                  <TrendingUp size={16} color="#F59E0B" /> : 
                  <TrendingDown size={16} color="#10B981" />
              )}
              <Text style={[styles.weightSummaryValue, { color: stats.weightChange > 0 ? '#F59E0B' : '#10B981' }]}>
                {stats.weightChange > 0 ? '+' : ''}{stats.weightChange.toFixed(1)}
              </Text>
            </View>
            <Text style={[styles.weightSummaryLabel, { color: theme.textSecondary }]}>Perubahan (kg)</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderMacroChart = () => {
    const total = stats.avgProtein + stats.avgCarbs + stats.avgFat;
    const hasData = total > 0;
    
    const proteinPercent = hasData ? (stats.avgProtein / total) * 100 : 33;
    const carbsPercent = hasData ? (stats.avgCarbs / total) * 100 : 33;
    const fatPercent = hasData ? (stats.avgFat / total) * 100 : 34;

    const proteinCalories = stats.avgProtein * 4;
    const carbsCalories = stats.avgCarbs * 4;
    const fatCalories = stats.avgFat * 9;
    const totalMacroCalories = proteinCalories + carbsCalories + fatCalories;

    if (!hasData) {
      return (
        <View style={[styles.chartCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.chartHeader}>
            <Text style={[styles.chartTitle, { color: theme.text }]}>Distribusi Makro</Text>
            <Text style={[styles.chartSubtitle, { color: theme.textSecondary }]}>Rata-rata harian</Text>
          </View>
          <View style={styles.emptyChartState}>
            <Flame size={32} color={theme.textTertiary} />
            <Text style={[styles.emptyChartText, { color: theme.textSecondary }]}>
              Catat makanan untuk melihat distribusi makro
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.chartCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.chartHeader}>
          <View>
            <Text style={[styles.chartTitle, { color: theme.text }]}>Distribusi Makro</Text>
            <Text style={[styles.chartSubtitle, { color: theme.textSecondary }]}>Total: {totalMacroCalories} kkal/hari</Text>
          </View>
        </View>

        <View style={styles.macroBarContainer}>
          <View style={styles.macroBar}>
            <View style={[styles.macroBarSegment, { width: `${proteinPercent}%`, backgroundColor: '#10B981' }]} />
            <View style={[styles.macroBarSegment, { width: `${carbsPercent}%`, backgroundColor: '#3B82F6' }]} />
            <View style={[styles.macroBarSegment, { width: `${fatPercent}%`, backgroundColor: '#F59E0B' }]} />
          </View>
        </View>

        <View style={styles.macroDetails}>
          <View style={[styles.macroDetailCard, { backgroundColor: '#10B981' + '15' }]}>
            <View style={styles.macroDetailHeader}>
              <View style={[styles.macroLegendDot, { backgroundColor: '#10B981' }]} />
              <Text style={[styles.macroDetailTitle, { color: '#10B981' }]}>Protein</Text>
            </View>
            <Text style={[styles.macroDetailValue, { color: theme.text }]}>{stats.avgProtein}g</Text>
            <Text style={[styles.macroDetailPercent, { color: theme.textSecondary }]}>{Math.round(proteinPercent)}%</Text>
            <Text style={[styles.macroDetailCalories, { color: theme.textTertiary }]}>{proteinCalories} kkal</Text>
          </View>
          
          <View style={[styles.macroDetailCard, { backgroundColor: '#3B82F6' + '15' }]}>
            <View style={styles.macroDetailHeader}>
              <View style={[styles.macroLegendDot, { backgroundColor: '#3B82F6' }]} />
              <Text style={[styles.macroDetailTitle, { color: '#3B82F6' }]}>Karbohidrat</Text>
            </View>
            <Text style={[styles.macroDetailValue, { color: theme.text }]}>{stats.avgCarbs}g</Text>
            <Text style={[styles.macroDetailPercent, { color: theme.textSecondary }]}>{Math.round(carbsPercent)}%</Text>
            <Text style={[styles.macroDetailCalories, { color: theme.textTertiary }]}>{carbsCalories} kkal</Text>
          </View>
          
          <View style={[styles.macroDetailCard, { backgroundColor: '#F59E0B' + '15' }]}>
            <View style={styles.macroDetailHeader}>
              <View style={[styles.macroLegendDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={[styles.macroDetailTitle, { color: '#F59E0B' }]}>Lemak</Text>
            </View>
            <Text style={[styles.macroDetailValue, { color: theme.text }]}>{stats.avgFat}g</Text>
            <Text style={[styles.macroDetailPercent, { color: theme.textSecondary }]}>{Math.round(fatPercent)}%</Text>
            <Text style={[styles.macroDetailCalories, { color: theme.textTertiary }]}>{fatCalories} kkal</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderProteinTrendChart = () => {
    const displayDays = timeRange === '7h' ? dayData.slice(-7) : 
                        timeRange === '30h' ? dayData.slice(-30) :
                        timeRange === '90h' ? dayData.slice(-90) : dayData;
    
    const daysWithProtein = displayDays.filter(d => d.protein > 0);
    if (daysWithProtein.length < 2) {
      return (
        <View style={[styles.chartCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.chartHeader}>
            <Text style={[styles.chartTitle, { color: theme.text }]}>Tren Protein</Text>
            <Text style={[styles.chartSubtitle, { color: theme.textSecondary }]}>Asupan harian</Text>
          </View>
          <View style={styles.emptyChartState}>
            <TrendingUp size={32} color={theme.textTertiary} />
            <Text style={[styles.emptyChartText, { color: theme.textSecondary }]}>
              Catat makanan minimal 2 hari untuk melihat tren protein
            </Text>
          </View>
        </View>
      );
    }

    const targetProtein = dailyTargets?.protein ?? 50;
    const maxProtein = Math.max(...displayDays.map(d => d.protein), targetProtein);
    const chartHeight = 100;
    
    const maxBars = timeRange === '7h' ? 7 : timeRange === '30h' ? 15 : timeRange === '90h' ? 12 : 12;
    const step = displayDays.length > maxBars ? Math.ceil(displayDays.length / maxBars) : 1;
    const visibleDays = displayDays.filter((_, i) => i % step === 0 || i === displayDays.length - 1);

    return (
      <View style={[styles.chartCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.chartHeader}>
          <View>
            <Text style={[styles.chartTitle, { color: theme.text }]}>Tren Protein</Text>
            <Text style={[styles.chartSubtitle, { color: theme.textSecondary }]}>
              Rata-rata: {stats.avgProtein}g/hari
            </Text>
          </View>
          <View style={[styles.avgBadge, { backgroundColor: '#10B981' + '15' }]}>
            <Text style={[styles.avgBadgeText, { color: '#10B981' }]}>Target: {targetProtein}g</Text>
          </View>
        </View>

        <View style={[styles.chartContainer, { height: chartHeight + 40 }]}>
          <View style={[styles.targetLine, { bottom: (targetProtein / maxProtein) * chartHeight + 20 }]}>
            <View style={[styles.targetLineDash, { backgroundColor: '#10B981' }]} />
            <Text style={[styles.targetLineLabel, { color: '#10B981' }]}>{targetProtein}g</Text>
          </View>
          
          <View style={styles.barsContainer}>
            {visibleDays.map((day, index) => {
              const barHeight = maxProtein > 0 ? (day.protein / maxProtein) * chartHeight : 0;
              const isOverTarget = day.protein >= targetProtein;
              const isToday = day.dateKey === formatDateKey(new Date());
              const axisLabel = getAxisLabel(day, index, visibleDays.length, timeRange);
              
              return (
                <View key={day.dateKey} style={styles.barColumn}>
                  <Text style={[styles.barValue, { color: theme.textTertiary }]}>
                    {day.protein > 0 && timeRange === '7h' ? day.protein : ''}
                  </Text>
                  <View 
                    style={[
                      styles.bar, 
                      { 
                        height: Math.max(barHeight, 4),
                        backgroundColor: day.protein === 0 
                          ? theme.border 
                          : isOverTarget 
                            ? '#10B981' 
                            : '#10B981' + '60',
                        opacity: isToday ? 1 : 0.8,
                        borderWidth: isToday ? 2 : 0,
                        borderColor: isToday ? '#10B981' : 'transparent',
                      }
                    ]} 
                  />
                  <Text style={[styles.barLabel, { color: isToday ? '#10B981' : theme.textTertiary, fontWeight: isToday ? '700' as const : '500' as const }]}>
                    {axisLabel}
                  </Text>
                </View>
              );
            })}
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
            {!!streakData?.currentStreak && streakData.currentStreak > 0 && (
              <View style={styles.streakBadge}>
                <Flame size={16} color="#FF6B35" fill="#FF6B35" />
                <Text style={styles.streakBadgeText}>{streakData.currentStreak}</Text>
              </View>
            )}
          </View>

          <View style={styles.timeRangeContainer}>
            {(['7h', '30h', '90h', 'All'] as const).map(range => (
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
                  {range}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {renderWeightChart()}
          {renderCalorieChart()}
          {renderProteinTrendChart()}
          {renderMacroChart()}

          <View style={styles.streakSection}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Konsistensi & Streak</Text>
            <View style={styles.streakGrid}>
              <View style={[styles.streakCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={[styles.streakIconWrap, { backgroundColor: '#FF6B35' + '20' }]}>
                  <Flame size={20} color="#FF6B35" fill="#FF6B35" />
                </View>
                <Text style={[styles.streakValue, { color: theme.text }]}>{streakData?.currentStreak ?? 0}</Text>
                <Text style={[styles.streakLabel, { color: theme.textSecondary }]}>Streak saat ini</Text>
              </View>
              <View style={[styles.streakCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={[styles.streakIconWrap, { backgroundColor: '#F59E0B' + '20' }]}>
                  <Award size={20} color="#F59E0B" />
                </View>
                <Text style={[styles.streakValue, { color: theme.text }]}>{streakData?.bestStreak ?? 0}</Text>
                <Text style={[styles.streakLabel, { color: theme.textSecondary }]}>Rekor terbaik</Text>
              </View>
              <View style={[styles.streakCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={[styles.streakIconWrap, { backgroundColor: theme.primary + '20' }]}>
                  <Calendar size={20} color={theme.primary} />
                </View>
                <Text style={[styles.streakValue, { color: theme.text }]}>{stats.daysLogged}</Text>
                <Text style={[styles.streakLabel, { color: theme.textSecondary }]}>Hari tercatat</Text>
              </View>
            </View>
          </View>

          <View style={styles.insightSection}>
            <View style={styles.insightHeader}>
              <Lightbulb size={18} color={theme.textSecondary} />
              <Text style={[styles.insightTitle, { color: theme.text }]}>Wawasan</Text>
            </View>
            <View style={[styles.insightCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.insightText, { color: theme.textSecondary }]}>
                {getInsightMessage()}
              </Text>
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
              <TouchableOpacity onPress={() => setShowWeightModal(false)}>
                <X size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Pilih tanggal</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                style={styles.datePickerScroll}
                contentContainerStyle={styles.datePickerContent}
              >
                {getDateOptions().map((date) => {
                  const isSelected = formatDateKey(date) === formatDateKey(selectedDate);
                  return (
                    <TouchableOpacity
                      key={formatDateKey(date)}
                      style={[
                        styles.dateOption,
                        { backgroundColor: theme.background, borderColor: theme.border },
                        isSelected && { backgroundColor: theme.primary, borderColor: theme.primary },
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedDate(date);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.dateOptionText,
                        { color: theme.textSecondary },
                        isSelected && { color: '#FFFFFF' },
                      ]}>
                        {formatDisplayDate(date)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={[styles.modalLabel, { color: theme.textSecondary, marginTop: 16 }]}>Berat badan</Text>
              <View style={styles.weightInputContainer}>
                <TextInput
                  value={weightInput}
                  onChangeText={setWeightInput}
                  placeholder="72.5"
                  placeholderTextColor={theme.textTertiary}
                  keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
                  style={[styles.modalWeightInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                  autoFocus
                />
                <Text style={[styles.weightUnitLarge, { color: theme.textSecondary }]}>kg</Text>
              </View>
              {weightError && <Text style={styles.weightError}>{weightError}</Text>}
              
              {stats.currentWeight > 0 && (
                <Text style={[styles.currentWeightHint, { color: theme.textTertiary }]}>
                  Berat terakhir: {stats.currentWeight.toFixed(1)} kg
                </Text>
              )}
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.cancelButton, { backgroundColor: theme.background, borderColor: theme.border }]}
                onPress={() => setShowWeightModal(false)}
                activeOpacity={0.7}
              >
                <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: theme.primary }]}
                onPress={logWeight}
                activeOpacity={0.7}
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
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  streakBadgeText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#FF6B35',
  },
  timeRangeContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  timeRangePill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  timeRangeText: {
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
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  chartSubtitle: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  recordBtnText: {
    fontSize: 13,
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
    gap: 8,
  },
  targetLineDash: {
    flex: 1,
    height: 1,
    opacity: 0.5,
  },
  targetLineLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
  },
  barsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: '100%',
    paddingTop: 20,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  bar: {
    width: 20,
    borderRadius: 6,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 10,
    fontWeight: '500' as const,
  },
  lineChartContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  lineChart: {
    flex: 1,
    position: 'relative',
  },
  chartDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chartLine: {
    position: 'absolute',
    height: 2,
    borderRadius: 1,
    transformOrigin: 'left center',
  },
  weightLabels: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 20,
    justifyContent: 'space-between',
  },
  weightLabel: {
    fontSize: 10,
    fontWeight: '500' as const,
  },
  weightSummary: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weightSummaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  weightSummaryDivider: {
    width: 1,
    height: 40,
    marginHorizontal: 16,
  },
  weightChangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  weightSummaryValue: {
    fontSize: 24,
    fontWeight: '700' as const,
  },
  weightSummaryLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    marginTop: 4,
  },
  emptyChartState: {
    alignItems: 'center',
    paddingVertical: 30,
    gap: 12,
  },
  emptyChartText: {
    fontSize: 14,
    fontWeight: '500' as const,
    textAlign: 'center',
    lineHeight: 20,
  },
  macroBarContainer: {
    marginBottom: 20,
  },
  macroBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  macroBarSegment: {
    height: '100%',
  },
  macroLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  macroLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  macroLegendLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  macroLegendValue: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  macroDetails: {
    flexDirection: 'row',
    gap: 10,
  },
  macroDetailCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  macroDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  macroDetailTitle: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  macroDetailValue: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  macroDetailPercent: {
    fontSize: 12,
    fontWeight: '600' as const,
    marginTop: 2,
  },
  macroDetailCalories: {
    fontSize: 10,
    fontWeight: '500' as const,
    marginTop: 2,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
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
  avgBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  avgBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  barValue: {
    fontSize: 9,
    fontWeight: '500' as const,
    marginBottom: 4,
    height: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    marginBottom: 14,
  },
  streakSection: {
    marginTop: 8,
  },
  streakGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  streakCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  streakIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  streakValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  streakLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  insightSection: {
    marginTop: 24,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  insightCard: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
  },
  insightText: {
    fontSize: 14,
    fontWeight: '500' as const,
    lineHeight: 22,
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
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
  modalBody: {
    padding: 20,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    marginBottom: 12,
  },
  weightInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalWeightInput: {
    flex: 1,
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 24,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  weightUnitLarge: {
    fontSize: 20,
    fontWeight: '600' as const,
  },
  weightError: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600' as const,
    marginTop: 8,
  },
  currentWeightHint: {
    fontSize: 13,
    fontWeight: '500' as const,
    marginTop: 12,
    textAlign: 'center',
  },
  datePickerScroll: {
    marginBottom: 4,
  },
  datePickerContent: {
    gap: 8,
  },
  dateOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  dateOptionText: {
    fontSize: 13,
    fontWeight: '600' as const,
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
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
});
