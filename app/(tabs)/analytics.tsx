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
  CheckCircle,
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
    const currentWeight = weightChartData.length > 0 
      ? weightChartData[weightChartData.length - 1].weight 
      : profile?.weight ?? 0;
    const weightChange = weightChartData.length >= 2 
      ? currentWeight - startWeight 
      : 0;

    const targetWeight = profile?.targetWeight ?? 0;
    const initialWeight = profile?.weight ?? 0;
    let weightProgress = 0;
    if (targetWeight > 0 && initialWeight > 0 && targetWeight !== initialWeight) {
      const totalToLose = initialWeight - targetWeight;
      const currentLost = initialWeight - currentWeight;
      weightProgress = Math.min(100, Math.max(0, Math.round((currentLost / totalToLose) * 100)));
    }

    return {
      avgCalories,
      daysLogged: daysWithData.length,
      consistencyPercentage,
      daysWithinTarget,
      weightChange,
      targetCalories,
      startWeight,
      currentWeight,
      weightProgress,
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

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (direction === 'prev' ? -1 : 1));
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const minDate = new Date(today);
    minDate.setDate(minDate.getDate() - 30);
    
    if (newDate <= today && newDate >= minDate) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedDate(newDate);
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

  const canGoNext = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(selectedDate);
    selected.setHours(0, 0, 0, 0);
    return selected < today;
  };

  const canGoPrev = () => {
    const minDate = new Date();
    minDate.setDate(minDate.getDate() - 30);
    minDate.setHours(0, 0, 0, 0);
    const selected = new Date(selectedDate);
    selected.setHours(0, 0, 0, 0);
    return selected > minDate;
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

  const renderWeightSection = () => {
    const hasWeightData = weightChartData.length >= 1;
    const targetWeight = profile?.targetWeight ?? 0;
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

          {targetWeight > 0 && (
            <>
              <View style={[styles.weightStatDivider, { backgroundColor: theme.border }]} />
              <View style={styles.weightStatItem}>
                <Text style={[styles.weightStatValue, { color: theme.primary }]}>
                  {targetWeight.toFixed(1)}
                </Text>
                <Text style={[styles.weightStatLabel, { color: theme.textSecondary }]}>kg target</Text>
              </View>
            </>
          )}
        </View>

        {renderWeightGraph()}
      </View>
    );
  };

  const renderWeightGraph = () => {
    if (weightChartData.length < 1) return null;

    const weights = weightChartData.map((w: any) => w.weight);
    const minWeight = Math.min(...weights) - 2;
    const maxWeight = Math.max(...weights) + 2;
    const chartHeight = 100;
    const chartWidth = SCREEN_WIDTH - 80;

    const points = weightChartData.map((w: any, index: number) => {
      const x = weightChartData.length === 1 
        ? chartWidth / 2 
        : (index / (weightChartData.length - 1)) * chartWidth;
      const y = maxWeight === minWeight 
        ? chartHeight / 2 
        : chartHeight - ((w.weight - minWeight) / (maxWeight - minWeight)) * chartHeight;
      return { x, y, weight: w.weight, date: w.date };
    });

    return (
      <View style={styles.weightGraphContainer}>
        <View style={[styles.weightGraph, { height: chartHeight }]}>
          {points.map((point: { x: number; y: number; weight: number; date: string }, index: number) => (
            <View
              key={index}
              style={[
                styles.graphDot,
                {
                  left: point.x - 5,
                  top: point.y - 5,
                  backgroundColor: '#3B82F6',
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
        
        <View style={styles.graphLabels}>
          <Text style={[styles.graphLabel, { color: theme.textTertiary }]}>{maxWeight.toFixed(1)} kg</Text>
          <Text style={[styles.graphLabel, { color: theme.textTertiary }]}>{minWeight.toFixed(1)} kg</Text>
        </View>

        <View style={styles.graphDateLabels}>
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
            {profile?.targetWeight && profile.targetWeight > 0 && (
              <View style={[styles.progressBadge, { backgroundColor: stats.weightProgress >= 100 ? '#10B981' + '20' : theme.primary + '15' }]}>
                <CheckCircle size={16} color={stats.weightProgress >= 100 ? '#10B981' : theme.primary} />
                <Text style={[styles.progressBadgeText, { color: stats.weightProgress >= 100 ? '#10B981' : theme.primary }]}>
                  {stats.weightProgress}%
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
              <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Tanggal</Text>
              <View style={[styles.datePickerRow, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <TouchableOpacity 
                  onPress={() => navigateDate('prev')}
                  style={[styles.dateNavBtn, !canGoPrev() && { opacity: 0.3 }]}
                  disabled={!canGoPrev()}
                >
                  <ChevronLeft size={22} color={theme.text} />
                </TouchableOpacity>
                <View style={styles.dateDisplay}>
                  <Text style={[styles.dateDisplayText, { color: theme.text }]}>
                    {formatDisplayDate(selectedDate)}
                  </Text>
                </View>
                <TouchableOpacity 
                  onPress={() => navigateDate('next')}
                  style={[styles.dateNavBtn, !canGoNext() && { opacity: 0.3 }]}
                  disabled={!canGoNext()}
                >
                  <ChevronRight size={22} color={theme.text} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.modalLabel, { color: theme.textSecondary, marginTop: 20 }]}>Berat badan</Text>
              <View style={styles.weightInputRow}>
                <TextInput
                  value={weightInput}
                  onChangeText={setWeightInput}
                  placeholder="0.0"
                  placeholderTextColor={theme.textTertiary}
                  keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
                  style={[styles.weightInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                  autoFocus
                />
                <View style={[styles.weightUnitBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
                  <Text style={[styles.weightUnit, { color: theme.textSecondary }]}>kg</Text>
                </View>
              </View>
              {weightError && <Text style={styles.weightError}>{weightError}</Text>}
              
              {stats.currentWeight > 0 && (
                <Text style={[styles.currentWeightHint, { color: theme.textTertiary }]}>
                  Terakhir dicatat: {stats.currentWeight.toFixed(1)} kg
                </Text>
              )}
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
  weightGraph: {
    position: 'relative',
    marginHorizontal: 10,
  },
  graphDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  graphLine: {
    position: 'absolute',
    height: 2,
    borderRadius: 1,
    transformOrigin: 'left center',
  },
  graphLabels: {
    position: 'absolute',
    right: 0,
    top: 0,
    height: 100,
    justifyContent: 'space-between',
  },
  graphLabel: {
    fontSize: 10,
    fontWeight: '500' as const,
  },
  graphDateLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingHorizontal: 4,
  },
  graphDateLabel: {
    fontSize: 11,
    fontWeight: '500' as const,
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
});
