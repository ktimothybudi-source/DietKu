import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  TextInput,
  Platform,

} from 'react-native';
import { Stack } from 'expo-router';
import { 
  Flame, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Scale, 
  Utensils,
  ChevronRight,
  Plus,

  Calendar,
  Zap,
  Award,
} from 'lucide-react-native';
import { Svg, Path, Circle, G, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useNutrition } from '@/contexts/NutritionContext';
import { useTheme } from '@/contexts/ThemeContext';
import { FoodEntry } from '@/types/nutrition';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type TimeRange = 7 | 30 | 90;

interface DayData {
  date: string;
  dateKey: string;
  calories: number;
  protein: number;
  entries: FoodEntry[];
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function parseISODateKey(dateKey: string) {
  const d = new Date(`${dateKey}T00:00:00`);
  return Number.isFinite(d.getTime()) ? d : null;
}

function formatDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function AnalyticsScreen() {
  const nutrition = useNutrition() as any;
  const { profile, dailyTargets, foodLog, streakData, weightHistory } = nutrition;
  const { theme, themeMode } = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = themeMode === 'dark';

  const [timeRange, setTimeRange] = useState<TimeRange>(30);
  const [expandedSection, setExpandedSection] = useState<string | null>('weight');
  const [showWeightInput, setShowWeightInput] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [weightError, setWeightError] = useState<string | null>(null);

  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - 64;

  const setupReady = !!profile && !!dailyTargets;

  const dayData = useMemo<DayData[]>(() => {
    const log = (foodLog as Record<string, FoodEntry[]>) || {};
    const days: DayData[] = [];
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - (timeRange - 1));

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
        }),
        { calories: 0, protein: 0 }
      );

      days.push({
        date: cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        dateKey,
        calories: totals.calories,
        protein: totals.protein,
        entries,
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    return days;
  }, [foodLog, timeRange]);

  const weightChartData = useMemo(() => {
    const list = (weightHistory || [])
      .filter((w: any) => Number.isFinite(new Date(w.date).getTime()))
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - timeRange);
    return list.filter((w: any) => new Date(w.date) >= cutoff);
  }, [weightHistory, timeRange]);

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

    return {
      avgCalories,
      daysLogged: daysWithData.length,
      consistencyPercentage,
      daysWithinTarget,
      weightChange,
      avgProtein,
      targetCalories,
      startWeight,
      currentWeight,
    };
  }, [dayData, dailyTargets, profile, weightChartData]);

  const goalTargetWeight = useMemo(() => {
    if (!profile) return null;
    return profile.goal === 'fat_loss'
      ? profile.weight - 5
      : profile.goal === 'muscle_gain'
      ? profile.weight + 3
      : profile.weight;
  }, [profile]);

  const goalProgress = useMemo(() => {
    if (!profile || !goalTargetWeight) return null;
    if (!Number.isFinite(stats.startWeight) || !Number.isFinite(stats.currentWeight)) return null;

    const start = stats.startWeight;
    const now = stats.currentWeight;
    const target = goalTargetWeight;

    const denom = target - start;
    if (Math.abs(denom) < 0.0001) return { pct: 100, remaining: 0 };

    const raw = ((now - start) / denom) * 100;
    const pct = clamp(raw, 0, 100);
    const remaining = target - now;
    return { pct, remaining };
  }, [profile, goalTargetWeight, stats.startWeight, stats.currentWeight]);

  const maxCalories = useMemo(() => {
    const maxLogged = dayData.length ? Math.max(...dayData.map(d => d.calories)) : 0;
    const target = dailyTargets?.calories ?? 2000;
    return Math.max(maxLogged, target, 100);
  }, [dayData, dailyTargets?.calories]);

  const logWeightToday = async () => {
    setWeightError(null);
    const raw = weightInput.replace(',', '.').trim();
    const value = Number(raw);

    if (!raw || !Number.isFinite(value) || value <= 0 || value > 500) {
      setWeightError('Masukkan berat yang valid');
      return;
    }

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const today = new Date();
      const dateKey = formatDateKey(today);

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
      setShowWeightInput(false);
    } catch {
      setWeightError('Gagal menyimpan');
    }
  };

  const toggleSection = (section: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedSection(expandedSection === section ? null : section);
  };

  const goalLabel = useMemo(() => {
    if (!profile?.goal) return '';
    const labels: Record<string, string> = {
      fat_loss: 'Turunkan berat',
      muscle_gain: 'Bangun otot',
      maintain: 'Jaga berat',
    };
    return labels[profile.goal] || '';
  }, [profile?.goal]);

  if (!setupReady) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Analitik</Text>
          </View>
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5' }]}>
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
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 8 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.headerTitle, { color: theme.text }]}>Analitik</Text>
              <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>{timeRange} hari terakhir</Text>
            </View>
            {!!streakData?.currentStreak && streakData.currentStreak > 0 && (
              <View style={styles.streakBadge}>
                <Flame size={16} color="#FF6B35" fill="#FF6B35" />
                <Text style={styles.streakBadgeText}>{streakData.currentStreak}</Text>
              </View>
            )}
          </View>

          {/* Time Range Pills */}
          <View style={styles.timeRangeContainer}>
            {([7, 30, 90] as const).map(range => (
              <TouchableOpacity
                key={range}
                style={[
                  styles.timeRangePill,
                  { backgroundColor: isDark ? '#1a1a1a' : '#f0f0f0' },
                  timeRange === range && styles.timeRangePillActive,
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
                  timeRange === range && styles.timeRangeTextActive,
                ]}>
                  {range}h
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Summary Cards */}
          <View style={styles.summaryGrid}>
            <View style={[styles.summaryCard, { backgroundColor: isDark ? '#0d2818' : '#ecfdf5' }]}>
              <View style={[styles.summaryIconWrap, { backgroundColor: isDark ? '#134e2a' : '#d1fae5' }]}>
                <Utensils size={18} color="#10B981" />
              </View>
              <Text style={[styles.summaryValue, { color: '#10B981' }]}>{stats.avgCalories}</Text>
              <Text style={[styles.summaryLabel, { color: isDark ? '#6ee7b7' : '#059669' }]}>kcal/hari</Text>
            </View>

            <View style={[styles.summaryCard, { backgroundColor: isDark ? '#1a1625' : '#f5f3ff' }]}>
              <View style={[styles.summaryIconWrap, { backgroundColor: isDark ? '#312e58' : '#ede9fe' }]}>
                <Target size={18} color="#8B5CF6" />
              </View>
              <Text style={[styles.summaryValue, { color: '#8B5CF6' }]}>{stats.consistencyPercentage}%</Text>
              <Text style={[styles.summaryLabel, { color: isDark ? '#c4b5fd' : '#7c3aed' }]}>konsisten</Text>
            </View>

            <View style={[styles.summaryCard, { backgroundColor: isDark ? '#1a1410' : '#fff7ed' }]}>
              <View style={[styles.summaryIconWrap, { backgroundColor: isDark ? '#3d2814' : '#fed7aa' }]}>
                <Zap size={18} color="#F59E0B" />
              </View>
              <Text style={[styles.summaryValue, { color: '#F59E0B' }]}>{stats.avgProtein}g</Text>
              <Text style={[styles.summaryLabel, { color: isDark ? '#fcd34d' : '#d97706' }]}>protein</Text>
            </View>
          </View>

          {/* Weight Section */}
          <TouchableOpacity 
            style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => toggleSection('weight')}
            activeOpacity={0.9}
          >
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionIcon, { backgroundColor: isDark ? '#1a2e1a' : '#dcfce7' }]}>
                  <Scale size={18} color="#22c55e" />
                </View>
                <View>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Berat Badan</Text>
                  <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                    {stats.currentWeight.toFixed(1)} kg • {stats.weightChange >= 0 ? '+' : ''}{stats.weightChange.toFixed(1)} kg
                  </Text>
                </View>
              </View>
              <ChevronRight 
                size={20} 
                color={theme.textTertiary} 
                style={{ transform: [{ rotate: expandedSection === 'weight' ? '90deg' : '0deg' }] }}
              />
            </View>

            {expandedSection === 'weight' && (
              <View style={styles.sectionContent}>
                {/* Weight Logger */}
                <TouchableOpacity
                  style={[styles.logWeightBtn, { backgroundColor: isDark ? '#1a2e1a' : '#f0fdf4', borderColor: isDark ? '#22543d' : '#bbf7d0' }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowWeightInput(!showWeightInput);
                  }}
                  activeOpacity={0.8}
                >
                  <Plus size={16} color="#22c55e" />
                  <Text style={styles.logWeightText}>Catat berat hari ini</Text>
                </TouchableOpacity>

                {showWeightInput && (
                  <View style={[styles.weightInputCard, { backgroundColor: isDark ? '#111' : '#fafafa', borderColor: theme.border }]}>
                    <View style={styles.weightInputRow}>
                      <TextInput
                        value={weightInput}
                        onChangeText={setWeightInput}
                        placeholder="72.5"
                        placeholderTextColor={theme.textTertiary}
                        keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
                        style={[styles.weightInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                      />
                      <Text style={[styles.weightUnit, { color: theme.textSecondary }]}>kg</Text>
                      <TouchableOpacity style={styles.weightSaveBtn} onPress={logWeightToday}>
                        <Text style={styles.weightSaveBtnText}>Simpan</Text>
                      </TouchableOpacity>
                    </View>
                    {weightError && <Text style={styles.weightError}>{weightError}</Text>}
                  </View>
                )}

                {/* Weight Stats */}
                <View style={styles.weightStatsRow}>
                  <View style={[styles.weightStatBox, { backgroundColor: isDark ? '#111' : '#fafafa' }]}>
                    <Text style={[styles.weightStatLabel, { color: theme.textSecondary }]}>Awal</Text>
                    <Text style={[styles.weightStatValue, { color: theme.text }]}>{stats.startWeight.toFixed(1)}</Text>
                  </View>
                  <View style={styles.weightStatArrow}>
                    {stats.weightChange <= 0 ? (
                      <TrendingDown size={20} color="#22c55e" />
                    ) : (
                      <TrendingUp size={20} color="#f59e0b" />
                    )}
                  </View>
                  <View style={[styles.weightStatBox, { backgroundColor: isDark ? '#111' : '#fafafa' }]}>
                    <Text style={[styles.weightStatLabel, { color: theme.textSecondary }]}>Sekarang</Text>
                    <Text style={[styles.weightStatValue, { color: theme.text }]}>{stats.currentWeight.toFixed(1)}</Text>
                  </View>
                </View>

                {/* Goal Progress */}
                {goalProgress && goalTargetWeight && (
                  <View style={[styles.goalProgressCard, { backgroundColor: isDark ? '#0d1f12' : '#f0fdf4' }]}>
                    <View style={styles.goalProgressHeader}>
                      <Text style={[styles.goalProgressLabel, { color: isDark ? '#86efac' : '#166534' }]}>{goalLabel}</Text>
                      <Text style={[styles.goalProgressPct, { color: '#22c55e' }]}>{Math.round(goalProgress.pct)}%</Text>
                    </View>
                    <View style={[styles.goalProgressBar, { backgroundColor: isDark ? '#1a3a1a' : '#dcfce7' }]}>
                      <View style={[styles.goalProgressFill, { width: `${goalProgress.pct}%` }]} />
                    </View>
                    <Text style={[styles.goalProgressText, { color: isDark ? '#6ee7b7' : '#15803d' }]}>
                      {Math.abs(goalProgress.remaining).toFixed(1)} kg lagi menuju {goalTargetWeight.toFixed(1)} kg
                    </Text>
                  </View>
                )}

                {/* Weight Chart */}
                {weightChartData.length >= 2 && (
                  <View style={[styles.chartContainer, { backgroundColor: isDark ? '#111' : '#fafafa' }]}>
                    <Svg width={chartWidth} height={140} viewBox={`0 0 ${chartWidth} 140`}>
                      <Defs>
                        <LinearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                          <Stop offset="0" stopColor="#22c55e" stopOpacity="0.3" />
                          <Stop offset="1" stopColor="#22c55e" stopOpacity="0" />
                        </LinearGradient>
                      </Defs>
                      {(() => {
                        const minW = Math.min(...weightChartData.map((w: any) => w.weight));
                        const maxW = Math.max(...weightChartData.map((w: any) => w.weight));
                        const range = maxW - minW || 1;
                        const pad = 20;

                        const points = weightChartData.map((p: any, i: number) => {
                          const x = pad + (i / (weightChartData.length - 1)) * (chartWidth - pad * 2);
                          const y = 120 - ((p.weight - minW) / range) * 100;
                          return { x, y };
                        });

                        const linePath = `M ${points.map((p: {x: number; y: number}) => `${p.x},${p.y}`).join(' L ')}`;
                        const areaPath = `${linePath} L ${points[points.length - 1].x},130 L ${points[0].x},130 Z`;

                        return (
                          <>
                            <Line x1={pad} y1={20} x2={chartWidth - pad} y2={20} stroke={theme.border} strokeWidth="1" strokeDasharray="4,4" />
                            <Line x1={pad} y1={70} x2={chartWidth - pad} y2={70} stroke={theme.border} strokeWidth="1" strokeDasharray="4,4" />
                            <Line x1={pad} y1={120} x2={chartWidth - pad} y2={120} stroke={theme.border} strokeWidth="1" strokeDasharray="4,4" />
                            <Path d={areaPath} fill="url(#weightGrad)" />
                            <Path d={linePath} fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                            {points.map((p: {x: number; y: number}, i: number) => (
                              <Circle key={i} cx={p.x} cy={p.y} r="4" fill="#22c55e" />
                            ))}
                          </>
                        );
                      })()}
                    </Svg>
                    <View style={styles.chartLabels}>
                      <Text style={[styles.chartLabel, { color: theme.textTertiary }]}>{Math.max(...weightChartData.map((w: any) => w.weight)).toFixed(1)}</Text>
                      <Text style={[styles.chartLabel, { color: theme.textTertiary }]}>{Math.min(...weightChartData.map((w: any) => w.weight)).toFixed(1)}</Text>
                    </View>
                  </View>
                )}

                {weightChartData.length < 2 && (
                  <View style={[styles.emptyChart, { backgroundColor: isDark ? '#111' : '#fafafa' }]}>
                    <Text style={[styles.emptyChartText, { color: theme.textTertiary }]}>
                      Catat berat minimal 2x untuk melihat grafik
                    </Text>
                  </View>
                )}
              </View>
            )}
          </TouchableOpacity>

          {/* Calories Section */}
          <TouchableOpacity 
            style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => toggleSection('calories')}
            activeOpacity={0.9}
          >
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionIcon, { backgroundColor: isDark ? '#2d1a1a' : '#fef2f2' }]}>
                  <Flame size={18} color="#ef4444" />
                </View>
                <View>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Kalori Harian</Text>
                  <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                    {stats.avgCalories} / {stats.targetCalories} kcal rata-rata
                  </Text>
                </View>
              </View>
              <ChevronRight 
                size={20} 
                color={theme.textTertiary} 
                style={{ transform: [{ rotate: expandedSection === 'calories' ? '90deg' : '0deg' }] }}
              />
            </View>

            {expandedSection === 'calories' && (
              <View style={styles.sectionContent}>
                {/* Calorie Bar Chart */}
                {stats.daysLogged >= 3 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.barChartScroll}>
                    <View style={styles.barChart}>
                      {dayData.slice(-14).map((day, idx) => {
                        const heightPct = maxCalories > 0 ? (day.calories / maxCalories) * 100 : 0;
                        const target = dailyTargets?.calories ?? 2000;
                        const within = Math.abs(day.calories - target) <= target * 0.1;
                        const over = day.calories > target * 1.1;
                        const isEmpty = day.entries.length === 0;

                        const barColor = isEmpty 
                          ? (isDark ? '#2a2a2a' : '#e5e5e5')
                          : within 
                            ? '#22c55e' 
                            : over 
                              ? '#f59e0b' 
                              : '#3b82f6';

                        const d = parseISODateKey(day.dateKey);
                        const label = d ? d.getDate().toString() : '';

                        return (
                          <View key={day.dateKey} style={styles.barItem}>
                            <View style={[styles.barTrack, { backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5' }]}>
                              <View style={[styles.bar, { height: `${heightPct}%`, backgroundColor: barColor }]} />
                            </View>
                            <Text style={[styles.barLabel, { color: theme.textTertiary }]}>{label}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </ScrollView>
                ) : (
                  <View style={[styles.emptyChart, { backgroundColor: isDark ? '#111' : '#fafafa' }]}>
                    <Text style={[styles.emptyChartText, { color: theme.textTertiary }]}>
                      Catat makanan minimal 3 hari untuk melihat grafik
                    </Text>
                  </View>
                )}

                {/* Legend */}
                <View style={styles.legendRow}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#22c55e' }]} />
                    <Text style={[styles.legendText, { color: theme.textSecondary }]}>Sesuai target</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
                    <Text style={[styles.legendText, { color: theme.textSecondary }]}>Di atas</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#3b82f6' }]} />
                    <Text style={[styles.legendText, { color: theme.textSecondary }]}>Di bawah</Text>
                  </View>
                </View>
              </View>
            )}
          </TouchableOpacity>

          {/* Macros Section */}
          <TouchableOpacity 
            style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => toggleSection('macros')}
            activeOpacity={0.9}
          >
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionIcon, { backgroundColor: isDark ? '#1a1a2e' : '#eef2ff' }]}>
                  <Zap size={18} color="#6366f1" />
                </View>
                <View>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Makronutrien</Text>
                  <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                    Protein {stats.avgProtein}g rata-rata
                  </Text>
                </View>
              </View>
              <ChevronRight 
                size={20} 
                color={theme.textTertiary} 
                style={{ transform: [{ rotate: expandedSection === 'macros' ? '90deg' : '0deg' }] }}
              />
            </View>

            {expandedSection === 'macros' && (
              <View style={styles.sectionContent}>
                {stats.daysLogged >= 7 ? (
                  <>
                    {(() => {
                      const remaining = Math.max(0, stats.avgCalories - stats.avgProtein * 4);
                      const avgFat = Math.round((remaining * 0.3) / 9);
                      const avgCarbs = Math.round((remaining * 0.7) / 4);

                      const proteinCals = stats.avgProtein * 4;
                      const fatCals = avgFat * 9;
                      const carbsCals = avgCarbs * 4;
                      const totalCals = proteinCals + fatCals + carbsCals;

                      const proteinPct = totalCals > 0 ? Math.round((proteinCals / totalCals) * 100) : 0;
                      const fatPct = totalCals > 0 ? Math.round((fatCals / totalCals) * 100) : 0;
                      const carbsPct = totalCals > 0 ? Math.round((carbsCals / totalCals) * 100) : 0;

                      return (
                        <View style={styles.macroContent}>
                          {/* Macro Ring */}
                          <View style={styles.macroRingContainer}>
                            <Svg width={120} height={120} viewBox="0 0 120 120">
                              <G rotation="-90" originX="60" originY="60">
                                <Circle cx="60" cy="60" r="45" stroke={isDark ? '#2a2a2a' : '#e5e5e5'} strokeWidth="14" fill="none" />
                                <Circle
                                  cx="60" cy="60" r="45"
                                  stroke="#22c55e"
                                  strokeWidth="14"
                                  fill="none"
                                  strokeDasharray={`${(proteinPct / 100) * 283} 283`}
                                  strokeLinecap="round"
                                />
                                <Circle
                                  cx="60" cy="60" r="45"
                                  stroke="#f59e0b"
                                  strokeWidth="14"
                                  fill="none"
                                  strokeDasharray={`${(fatPct / 100) * 283} 283`}
                                  strokeDashoffset={-(proteinPct / 100) * 283}
                                  strokeLinecap="round"
                                />
                                <Circle
                                  cx="60" cy="60" r="45"
                                  stroke="#3b82f6"
                                  strokeWidth="14"
                                  fill="none"
                                  strokeDasharray={`${(carbsPct / 100) * 283} 283`}
                                  strokeDashoffset={-((proteinPct + fatPct) / 100) * 283}
                                  strokeLinecap="round"
                                />
                              </G>
                            </Svg>
                          </View>

                          {/* Macro List */}
                          <View style={styles.macroList}>
                            <View style={styles.macroItem}>
                              <View style={[styles.macroDot, { backgroundColor: '#22c55e' }]} />
                              <View style={styles.macroInfo}>
                                <Text style={[styles.macroName, { color: theme.textSecondary }]}>Protein</Text>
                                <Text style={[styles.macroValue, { color: theme.text }]}>{stats.avgProtein}g</Text>
                              </View>
                              <Text style={[styles.macroPct, { color: theme.textTertiary }]}>{proteinPct}%</Text>
                            </View>
                            <View style={styles.macroItem}>
                              <View style={[styles.macroDot, { backgroundColor: '#f59e0b' }]} />
                              <View style={styles.macroInfo}>
                                <Text style={[styles.macroName, { color: theme.textSecondary }]}>Lemak</Text>
                                <Text style={[styles.macroValue, { color: theme.text }]}>{avgFat}g</Text>
                              </View>
                              <Text style={[styles.macroPct, { color: theme.textTertiary }]}>{fatPct}%</Text>
                            </View>
                            <View style={styles.macroItem}>
                              <View style={[styles.macroDot, { backgroundColor: '#3b82f6' }]} />
                              <View style={styles.macroInfo}>
                                <Text style={[styles.macroName, { color: theme.textSecondary }]}>Karbo</Text>
                                <Text style={[styles.macroValue, { color: theme.text }]}>{avgCarbs}g</Text>
                              </View>
                              <Text style={[styles.macroPct, { color: theme.textTertiary }]}>{carbsPct}%</Text>
                            </View>
                          </View>
                        </View>
                      );
                    })()}
                  </>
                ) : (
                  <View style={[styles.emptyChart, { backgroundColor: isDark ? '#111' : '#fafafa' }]}>
                    <Text style={[styles.emptyChartText, { color: theme.textTertiary }]}>
                      Catat makanan minimal 7 hari untuk analisis makro
                    </Text>
                  </View>
                )}
              </View>
            )}
          </TouchableOpacity>

          {/* Streak & Stats */}
          <View style={styles.streakGrid}>
            <View style={[styles.streakCard, { backgroundColor: isDark ? '#1f1510' : '#fff7ed' }]}>
              <Flame size={24} color="#f97316" fill="#f97316" />
              <Text style={[styles.streakValue, { color: '#f97316' }]}>{streakData?.currentStreak ?? 0}</Text>
              <Text style={[styles.streakLabel, { color: isDark ? '#fdba74' : '#c2410c' }]}>Streak</Text>
            </View>
            <View style={[styles.streakCard, { backgroundColor: isDark ? '#1a1a10' : '#fefce8' }]}>
              <Award size={24} color="#eab308" />
              <Text style={[styles.streakValue, { color: '#eab308' }]}>{streakData?.bestStreak ?? 0}</Text>
              <Text style={[styles.streakLabel, { color: isDark ? '#fde047' : '#a16207' }]}>Rekor</Text>
            </View>
            <View style={[styles.streakCard, { backgroundColor: isDark ? '#101a1f' : '#f0f9ff' }]}>
              <Calendar size={24} color="#0ea5e9" />
              <Text style={[styles.streakValue, { color: '#0ea5e9' }]}>{stats.daysLogged}</Text>
              <Text style={[styles.streakLabel, { color: isDark ? '#7dd3fc' : '#0369a1' }]}>Hari</Text>
            </View>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </View>
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
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingTop: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  streakBadgeText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#f97316',
  },
  timeRangeContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  timeRangePill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  timeRangePillActive: {
    backgroundColor: '#10B981',
  },
  timeRangeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  timeRangeTextActive: {
    color: '#fff',
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  summaryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  sectionCard: {
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  sectionContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  logWeightBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  logWeightText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#22c55e',
  },
  weightInputCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  weightInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  weightInput: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '600',
  },
  weightUnit: {
    fontSize: 16,
    fontWeight: '600',
  },
  weightSaveBtn: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  weightSaveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  weightError: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
  weightStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  weightStatBox: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  weightStatLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  weightStatValue: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4,
  },
  weightStatArrow: {
    width: 40,
    alignItems: 'center',
  },
  goalProgressCard: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
  },
  goalProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  goalProgressLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  goalProgressPct: {
    fontSize: 15,
    fontWeight: '800',
  },
  goalProgressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  goalProgressFill: {
    height: '100%',
    backgroundColor: '#22c55e',
    borderRadius: 4,
  },
  goalProgressText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 10,
    textAlign: 'center',
  },
  chartContainer: {
    borderRadius: 14,
    padding: 12,
    position: 'relative',
  },
  chartLabels: {
    position: 'absolute',
    right: 16,
    top: 16,
    bottom: 16,
    justifyContent: 'space-between',
  },
  chartLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  emptyChart: {
    height: 100,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyChartText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  barChartScroll: {
    marginBottom: 12,
  },
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 140,
    gap: 6,
    paddingRight: 20,
  },
  barItem: {
    alignItems: 'center',
    width: 24,
  },
  barTrack: {
    width: 20,
    height: 120,
    borderRadius: 10,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  bar: {
    width: '100%',
    borderRadius: 10,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 6,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    flexWrap: 'wrap',
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
    fontWeight: '600',
  },
  macroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  macroRingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  macroList: {
    flex: 1,
    gap: 14,
  },
  macroItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  macroDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  macroInfo: {
    flex: 1,
  },
  macroName: {
    fontSize: 12,
    fontWeight: '600',
  },
  macroValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  macroPct: {
    fontSize: 14,
    fontWeight: '700',
  },
  streakGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  streakCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    gap: 6,
  },
  streakValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  streakLabel: {
    fontSize: 12,
    fontWeight: '700',
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
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
  },
});
