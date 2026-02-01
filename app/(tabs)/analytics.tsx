import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  TextInput,
  Platform,
} from 'react-native';
import { Stack } from 'expo-router';
import { Flame, Calendar, Target, Award, Lightbulb, Plus } from 'lucide-react-native';
import { Svg, Path, Circle, G, Line } from 'react-native-svg';
import { useNutrition } from '@/contexts/NutritionContext';
import { useTheme } from '@/contexts/ThemeContext';
import { FoodEntry } from '@/types/nutrition';
import * as Haptics from 'expo-haptics';

type TimeRange = 7 | 30 | 90 | 'all';

interface DayData {
  date: string;
  dateKey: string;
  calories: number;
  protein: number;
  entries: FoodEntry[];
}

const PANEL_TABS = [
  { key: 0, label: 'Berat' },
  { key: 1, label: 'Kalori' },
  { key: 2, label: 'Makro' },
  { key: 3, label: 'Target' },
] as const;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function SectionGate({
  enabled,
  message,
  radius = 18,
  children,
  isDark = false,
}: {
  enabled: boolean;
  message: string;
  radius?: number;
  children: React.ReactNode;
  isDark?: boolean;
}) {
  return (
    <View style={{ position: 'relative', borderRadius: radius, overflow: 'hidden' }}>
      {children}
      {!enabled && (
        <View style={[gateStyles.overlay, { borderRadius: radius, backgroundColor: isDark ? 'rgba(10,10,10,0.90)' : 'rgba(255,255,255,0.90)' }]} pointerEvents="none">
          <View style={[gateStyles.badge, { backgroundColor: isDark ? '#111111' : '#FFFFFF', borderColor: isDark ? '#1F1F1F' : '#E7E7E7' }]}>
            <Text style={[gateStyles.title, { color: isDark ? '#FFFFFF' : '#111111' }]}>Belum cukup data</Text>
            <Text style={[gateStyles.subtitle, { color: isDark ? '#888888' : '#666666' }]}>{message}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const gateStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  badge: {
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    maxWidth: 340,
  },
  title: {
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '700',
  },
});

function parseISODateKey(dateKey: string) {
  const d = new Date(`${dateKey}T00:00:00`);
  return Number.isFinite(d.getTime()) ? d : null;
}

function formatDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthShort(d: Date) {
  return d.toLocaleDateString('id-ID', { month: 'short' });
}

function dayMonthLabel(dateKey: string) {
  const d = parseISODateKey(dateKey);
  if (!d) return '';
  const dd = String(d.getDate());
  const mm = d.toLocaleDateString('id-ID', { month: 'short' });
  return `${dd} ${mm}`;
}

export default function AnalyticsScreen() {
  const nutrition = useNutrition() as any;
  const { profile, dailyTargets, foodLog, streakData, weightHistory } = nutrition;
  const { theme, themeMode } = useTheme();

  const [timeRange, setTimeRange] = useState<TimeRange>(30);

  const screenWidth = Dimensions.get('window').width;
  const pageWidth = screenWidth - 48;

  const pagerRef = useRef<ScrollView>(null);
  const [activePanel, setActivePanel] = useState(0);

  const [showWeightLogger, setShowWeightLogger] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [weightLogError, setWeightLogError] = useState<string | null>(null);
  const [weightLogSuccess, setWeightLogSuccess] = useState<string | null>(null);

  const setupReady = !!profile && !!dailyTargets;
  const panelCount = 4;

  const allTimeStartDate = useMemo(() => {
    let min: Date | null = null;

    const keys = Object.keys((foodLog as Record<string, FoodEntry[]>) || {});
    for (const k of keys) {
      const d = parseISODateKey(k);
      if (!d) continue;
      if (!min || d < min) min = d;
    }

    for (const w of weightHistory || []) {
      const d = new Date(w.date);
      if (!Number.isFinite(d.getTime())) continue;
      if (!min || d < min) min = d;
    }

    return min;
  }, [foodLog, weightHistory]);

  const dayData = useMemo<DayData[]>(() => {
    const log = (foodLog as Record<string, FoodEntry[]>) || {};
    const days: DayData[] = [];
    const today = new Date();

    let startDate: Date;
    if (timeRange === 'all') {
      startDate = allTimeStartDate ? new Date(allTimeStartDate) : new Date(today);
    } else {
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - (timeRange - 1));
    }

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
  }, [foodLog, timeRange, allTimeStartDate]);

  const weightChartData = useMemo(() => {
    const list = (weightHistory || [])
      .filter((w: any) => Number.isFinite(new Date(w.date).getTime()))
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (timeRange === 'all') return list;

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

    const avgVsTarget = avgCalories - targetCalories;

    const startWeight = weightChartData.length > 0 ? weightChartData[0].weight : profile?.weight ?? 0;
    const currentWeight = profile?.weight ?? 0;
    const weightChange = currentWeight - startWeight;

    const totalProtein = daysWithData.reduce((sum, d) => sum + d.protein, 0);
    const avgProtein = daysWithData.length > 0 ? Math.round(totalProtein / daysWithData.length) : 0;

    return {
      avgCalories,
      daysLogged: daysWithData.length,
      avgVsTarget,
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
    if (!profile) return null;
    if (!goalTargetWeight) return null;
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

  const encouragement = useMemo(() => {
    if (!setupReady) return null;

    const pct = goalProgress?.pct ?? null;
    const days = stats.daysLogged;

    if (pct != null && days >= 3) {
      const nicePct = Math.round(pct);
      if (nicePct >= 95) return `Hampir selesai, kamu sudah ${nicePct}% menuju target!`;
      if (nicePct >= 70) return `Mantap, kamu sudah ${nicePct}% menuju target!`;
      if (nicePct >= 40) return `Bagus banget, kamu sudah ${nicePct}% menuju target. Lanjut ya!`;
      if (nicePct >= 15) return `Awal yang solid, kamu sudah ${nicePct}% menuju target.`;
      return `Kamu sudah mulai, ${nicePct}% menuju target. Konsisten ya!`;
    }

    if (stats.daysLogged >= 7 && stats.consistencyPercentage >= 60) {
      return `Konsistensi kamu keren, ${stats.consistencyPercentage}% hari sesuai target.`;
    }

    if (stats.daysLogged >= 3) {
      return 'Keren, kamu sudah mulai konsisten. Sedikit demi sedikit jadi hasil besar.';
    }

    return null;
  }, [setupReady, goalProgress?.pct, stats.daysLogged, stats.consistencyPercentage]);

  const maxCalories = useMemo(() => {
    const maxLogged = dayData.length ? Math.max(...dayData.map(d => d.calories)) : 0;
    const target = dailyTargets?.calories ?? 2000;
    return Math.max(maxLogged, target, 100);
  }, [dayData, dailyTargets?.calories]);

  const barWidth = useMemo(() => {
    const denom = timeRange === 'all' ? Math.max(30, dayData.length) : timeRange;
    return Math.max(8, pageWidth / denom - 3);
  }, [pageWidth, timeRange, dayData.length]);

  const targetPct = useMemo(() => {
    const target = dailyTargets?.calories ?? 2000;
    return maxCalories > 0 ? (target / maxCalories) * 100 : 50;
  }, [dailyTargets?.calories, maxCalories]);

  const xLabelEvery = useMemo(() => {
    const n = dayData.length;
    if (n <= 7) return 1;
    if (n <= 30) return 6;
    if (n <= 90) return 12;
    return Math.ceil(n / 8);
  }, [dayData.length]);

  const insights = useMemo(() => {
    const result: { text: string; icon?: string }[] = [];

    if (stats.daysLogged >= 7) {
      const mealProtein: Record<string, number[]> = {};
      dayData.forEach(day => {
        day.entries.forEach(entry => {
          const hour = new Date(entry.timestamp).getHours();
          const meal =
            hour >= 5 && hour < 11
              ? 'breakfast'
              : hour >= 11 && hour < 16
              ? 'lunch'
              : hour >= 16 && hour < 21
              ? 'dinner'
              : 'snack';

          if (!mealProtein[meal]) mealProtein[meal] = [];
          mealProtein[meal].push(entry.protein || 0);
        });
      });

      const avgProteinByMeal = Object.entries(mealProtein).map(([meal, proteins]) => ({
        meal,
        avg: proteins.length ? proteins.reduce((a, b) => a + b, 0) / proteins.length : 0,
      }));

      if (avgProteinByMeal.length > 0) {
        const lowestMeal = avgProteinByMeal.reduce((min, curr) => (curr.avg < min.avg ? curr : min));
        const mealNames: Record<string, string> = {
          breakfast: 'sarapan',
          lunch: 'makan siang',
          dinner: 'makan malam',
          snack: 'camilan',
        };
        result.push({ text: `Protein paling rendah saat ${mealNames[lowestMeal.meal]}`, icon: '🍳' });
      }

      const last7 = dayData.slice(-7);
      const weekdayEntries = last7.filter((_, i) => i < 5);
      const weekendEntries = last7.filter((_, i) => i >= 5);

      const weekdayAvg = weekdayEntries.length
        ? weekdayEntries.reduce((s, d) => s + d.calories, 0) / weekdayEntries.length
        : 0;

      const weekendAvg = weekendEntries.length
        ? weekendEntries.reduce((s, d) => s + d.calories, 0) / weekendEntries.length
        : 0;

      if (weekendAvg > weekdayAvg + 50) {
        result.push({
          text: `Akhir pekan +${Math.round(weekendAvg - weekdayAvg)} kcal rata-rata`,
          icon: '📅',
        });
      }

      const target = dailyTargets?.calories ?? 2000;
      const weekdayConsistency = weekdayEntries.filter(d => Math.abs(d.calories - target) <= target * 0.1).length;
      if (weekdayConsistency >= 4) result.push({ text: 'Pola makan paling stabil di hari kerja', icon: '✅' });
    }

    if (result.length === 0 && stats.daysLogged >= 3) {
      result.push({ text: 'Kamu sudah mulai. Konsisten sedikit demi sedikit ya.', icon: '💪' });
    }

    return result.slice(0, 3);
  }, [stats.daysLogged, dayData, dailyTargets?.calories]);

  const goalForecast = useMemo(() => {
    if (!profile) return null;
    if (stats.daysLogged < 14) return null;
    if (weightChartData.length < 2) return null;

    const rangeDays = timeRange === 'all' ? Math.max(30, dayData.length) : timeRange;

    const ratePerDay = stats.weightChange / rangeDays;
    if (Math.abs(ratePerDay) < 0.01) return null;

    const targetWeight = goalTargetWeight ?? profile.weight;
    const daysToGoal = Math.abs((targetWeight - profile.weight) / ratePerDay);
    if (!Number.isFinite(daysToGoal)) return null;
    if (daysToGoal > 365 || daysToGoal < 7) return null;

    const projectedDate = new Date();
    projectedDate.setDate(projectedDate.getDate() + daysToGoal);

    const dateStr = projectedDate.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    return {
      targetWeight,
      projectedDate: dateStr,
      daysToGoal: Math.round(daysToGoal),
    };
  }, [profile, stats.daysLogged, stats.weightChange, timeRange, weightChartData, dayData.length, goalTargetWeight]);

  const rangeLabel = timeRange === 'all' ? 'Semua' : `${timeRange} hari`;

  const updateDotsFromOffset = (x: number) => {
    const idx = Math.round(x / pageWidth);
    setActivePanel(clamp(idx, 0, panelCount - 1));
  };

  const onPagerScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    updateDotsFromOffset(e.nativeEvent.contentOffset.x);
  };

  const onPagerScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    updateDotsFromOffset(e.nativeEvent.contentOffset.x);
  };

  const jumpToPanel = (idx: number) => {
    const clamped = clamp(idx, 0, panelCount - 1);
    setActivePanel(clamped);
    pagerRef.current?.scrollTo({ x: clamped * pageWidth, y: 0, animated: true });
  };

  const logWeightToday = async () => {
    setWeightLogError(null);
    setWeightLogSuccess(null);

    const raw = weightInput.replace(',', '.').trim();
    const value = Number(raw);

    if (!raw || !Number.isFinite(value) || value <= 0 || value > 500) {
      setWeightLogError('Masukkan angka berat yang valid, contoh: 72.5');
      return;
    }

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const today = new Date();
      const dateKey = formatDateKey(today);

      const addWeightEntry = nutrition?.addWeightEntry;
      const addWeight = nutrition?.addWeight;
      const setWeight = nutrition?.setWeight;
      const updateProfileWeight = nutrition?.updateProfileWeight;

      if (typeof addWeightEntry === 'function') {
        await addWeightEntry({ date: dateKey, weight: value });
      } else if (typeof addWeight === 'function') {
        await addWeight(dateKey, value);
      } else if (typeof updateProfileWeight === 'function') {
        await updateProfileWeight(value);
      } else if (typeof setWeight === 'function') {
        await setWeight(value);
      }

      setWeightInput('');
      setShowWeightLogger(false);
      setWeightLogSuccess('Berhasil dicatat. Keren, lanjutkan ya.');
    } catch {
      setWeightLogError('Gagal menyimpan. Coba lagi ya.');
    }
  };

  if (!setupReady) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { paddingTop: 58, backgroundColor: theme.background }]}>
          <View style={styles.header}>
            <View>
              <Text style={[styles.greeting, { color: theme.text }]}>Analitik</Text>
            </View>
          </View>
          <View style={[styles.card, { marginHorizontal: 24, backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Belum siap</Text>
            <Text style={[styles.muted, { color: theme.textSecondary }]}>Atur profil dan target harian supaya grafik dan proyeksi bisa tampil.</Text>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: theme.text }]}>Analitik</Text>
          </View>

          {!!streakData?.currentStreak && streakData.currentStreak > 0 && (
            <View style={[styles.headerStreak, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Flame size={18} color="#FF6B35" fill="#FF6B35" />
              <Text style={[styles.headerStreakText, { color: theme.text }]}>{streakData.currentStreak}</Text>
            </View>
          )}
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Time range */}
          <View style={[styles.timeRangeSelector, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {([
              { key: 7 as const, label: '7h' },
              { key: 30 as const, label: '30h' },
              { key: 90 as const, label: '90h' },
              { key: 'all' as const, label: 'All' },
            ] as const).map(item => (
              <TouchableOpacity
                key={String(item.key)}
                style={[styles.timeRangeButton, timeRange === item.key && styles.timeRangeButtonActive]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setTimeRange(item.key);
                }}
                activeOpacity={0.9}
              >
                <Text style={[styles.timeRangeText, { color: timeRange === item.key ? '#FFFFFF' : theme.textSecondary }, timeRange === item.key && styles.timeRangeTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Positive reinforcement card */}
          {(encouragement || weightLogSuccess) && (
            <View style={[styles.goodNewsCard, { backgroundColor: themeMode === 'dark' ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.10)', borderColor: themeMode === 'dark' ? 'rgba(16,185,129,0.35)' : 'rgba(16,185,129,0.25)' }]}>
              <Text style={styles.goodNewsTitle}>{encouragement ?? 'Mantap!'}</Text>
              {!!weightLogSuccess && <Text style={styles.goodNewsSub}>{weightLogSuccess}</Text>}
              {goalProgress && goalTargetWeight != null && (
                <View style={styles.progressRow}>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${goalProgress.pct}%` }]} />
                  </View>
                  <Text style={styles.progressText}>{Math.round(goalProgress.pct)}%</Text>
                </View>
              )}
            </View>
          )}

          {/* Pager header */}
          <View style={styles.pagerHeaderRow}>
            <Text style={[styles.pagerHeaderTitle, { color: theme.text }]}>Grafik</Text>
          </View>

          {/* Pager tabs */}
          <View style={styles.pagerTabs}>
            {PANEL_TABS.map(t => {
              const active = activePanel === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    jumpToPanel(t.key);
                  }}
                  style={[styles.pagerTab, { backgroundColor: theme.card, borderColor: active ? theme.primary : theme.border }]}
                  activeOpacity={0.9}
                >
                  <Text style={[styles.pagerTabText, { color: active ? '#0E7A5A' : theme.textSecondary }]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Pager */}
          <View style={styles.pagerBlock}>
            <ScrollView
              ref={pagerRef}
              horizontal
              pagingEnabled
              snapToInterval={pageWidth}
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              onScroll={onPagerScroll}
              onMomentumScrollEnd={onPagerScrollEnd}
              onScrollEndDrag={onPagerScrollEnd}
            >
              {/* 1 Weight */}
              <View style={[styles.pagerPage, { width: pageWidth }]}>
                <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <View style={styles.cardHeaderRow}>
                    <View>
                      <Text style={[styles.cardTitle, { color: theme.text }]}>Perubahan berat badan</Text>
                      <Text style={[styles.cardSub, { color: theme.textSecondary }]}>{rangeLabel}</Text>
                    </View>

                    <TouchableOpacity
                      style={[styles.addBtn, { backgroundColor: theme.background, borderColor: theme.border }]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setWeightLogError(null);
                        setWeightLogSuccess(null);
                        setShowWeightLogger(v => !v);
                      }}
                      activeOpacity={0.9}
                    >
                      <Plus size={16} color="#10B981" />
                      <Text style={styles.addBtnText}>Catat</Text>
                    </TouchableOpacity>
                  </View>

                  {showWeightLogger && (
                    <View style={[styles.loggerCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
                      <Text style={[styles.loggerTitle, { color: theme.text }]}>Catat berat hari ini</Text>
                      <View style={styles.loggerRow}>
                        <TextInput
                          value={weightInput}
                          onChangeText={setWeightInput}
                          placeholder="contoh: 72.5"
                          placeholderTextColor={theme.textTertiary}
                          keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
                          style={[styles.loggerInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                        />
                        <TouchableOpacity style={styles.loggerSave} onPress={logWeightToday} activeOpacity={0.9}>
                          <Text style={styles.loggerSaveText}>Simpan</Text>
                        </TouchableOpacity>
                      </View>
                      {!!weightLogError && <Text style={styles.errorText}>{weightLogError}</Text>}
                      <Text style={[styles.loggerHint, { color: theme.textSecondary }]}>Tip: catat di waktu yang mirip tiap hari biar tren lebih akurat.</Text>
                    </View>
                  )}

                  <SectionGate
                    enabled={weightChartData.length >= 2}
                    message="Catat berat badan minimal 2 kali untuk melihat tren."
                    radius={18}
                    isDark={themeMode === 'dark'}
                  >
                    <View>
                      <View style={styles.weightKpiRow}>
                        <View style={[styles.kpiBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
                          <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Awal</Text>
                          <Text style={[styles.kpiBig, { color: theme.text }]}>
                            {(weightChartData[0]?.weight ?? profile?.weight ?? 0).toFixed(1)}
                          </Text>
                          <Text style={[styles.kpiSmall, { color: theme.textTertiary }]}>kg</Text>
                        </View>

                        <View style={[styles.kpiBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
                          <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Sekarang</Text>
                          <Text style={[styles.kpiBig, { color: theme.text }]}>{(profile?.weight ?? 0).toFixed(1)}</Text>
                          <Text style={[styles.kpiSmall, { color: theme.textTertiary }]}>kg</Text>
                        </View>

                        <View style={[styles.kpiBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
                          <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Perubahan</Text>
                          <Text style={[styles.kpiBig, { color: '#10B981' }]}>
                            {stats.weightChange > 0 ? '+' : ''}
                            {stats.weightChange.toFixed(1)}
                          </Text>
                          <Text style={[styles.kpiSmall, { color: theme.textTertiary }]}>kg</Text>
                        </View>
                      </View>

                      {goalProgress && goalTargetWeight != null && (
                        <View style={[styles.goalLineCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
                          <Text style={[styles.goalLineText, { color: theme.textSecondary }]}>
                            Kamu sudah <Text style={styles.goalLineStrong}>{Math.round(goalProgress.pct)}%</Text> menuju
                            target {goalTargetWeight.toFixed(1)} kg
                          </Text>
                          <View style={styles.progressBarThin}>
                            <View style={[styles.progressFillThin, { width: `${goalProgress.pct}%` }]} />
                          </View>
                        </View>
                      )}

                      <View style={[styles.whiteChart, { backgroundColor: theme.background }]}>
                        <Svg width="100%" height="190" viewBox="0 0 100 100" preserveAspectRatio="none">
                          {weightChartData.length > 1 &&
                            (() => {
                              const minW = Math.min(...weightChartData.map((w: any) => w.weight));
                              const maxW = Math.max(...weightChartData.map((w: any) => w.weight));
                              const range = maxW - minW || 1;

                              const pad = 6;
                              const minY = pad;
                              const maxY = 100 - pad;

                              const points = weightChartData.map((p: any, i: number) => {
                                const x = (i / (weightChartData.length - 1)) * 100;
                                const y = maxY - ((p.weight - minW) / range) * (maxY - minY);
                                return { x, y, w: p.weight, date: p.date };
                              });

                              const d = `M ${points.map((p: any) => `${p.x},${p.y}`).join(' L ')}`;

                              const y25 = maxY - 0.25 * (maxY - minY);
                              const y50 = maxY - 0.5 * (maxY - minY);
                              const y75 = maxY - 0.75 * (maxY - minY);

                              return (
                                <>
                                  <Line x1="0" y1={y25} x2="100" y2={y25} stroke={theme.border} strokeWidth="0.6" />
                                  <Line x1="0" y1={y50} x2="100" y2={y50} stroke={theme.border} strokeWidth="0.6" />
                                  <Line x1="0" y1={y75} x2="100" y2={y75} stroke={theme.border} strokeWidth="0.6" />

                                  <Path
                                    d={d}
                                    fill="none"
                                    stroke="#10B981"
                                    strokeWidth="2.4"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />

                                  {points.map((p: { x: number; y: number; w: number; date: string }, i: number) => (
                                    <Circle key={`${p.date}-${i}`} cx={p.x} cy={p.y} r="2.2" fill="#10B981" />
                                  ))}
                                </>
                              );
                            })()}
                        </Svg>

                        {weightChartData.length > 1 && (
                          <View style={styles.axisLabels}>
                            <Text style={[styles.axisLabelText, { color: theme.textTertiary }]}>
                              {Math.min(...weightChartData.map((w: any) => w.weight)).toFixed(1)} kg
                            </Text>
                            <Text style={[styles.axisLabelText, { color: theme.textTertiary }]}>
                              {Math.max(...weightChartData.map((w: any) => w.weight)).toFixed(1)} kg
                            </Text>
                          </View>
                        )}
                      </View>

                      {weightChartData.length > 1 && (
                        <View style={styles.xLabelsRow}>
                          {(() => {
                            const n = weightChartData.length;
                            const pick = n <= 4 ? 1 : Math.ceil(n / 4);
                            const items: { k: string; label: string }[] = [];

                            for (let i = 0; i < n; i += pick) {
                              const dateKey = String(weightChartData[i].date).slice(0, 10);
                              const d = new Date(weightChartData[i].date);
                              const label = `${d.getDate()} ${monthShort(d)}`;
                              items.push({ k: `${dateKey}-${i}`, label });
                            }

                            if (items.length < 2) return null;

                            return (
                              <View style={styles.xLabelSpread}>
                                {items.slice(0, 4).map(it => (
                                  <Text key={it.k} style={[styles.xLabelText, { color: theme.textSecondary }]}>
                                    {it.label}
                                  </Text>
                                ))}
                              </View>
                            );
                          })()}
                        </View>
                      )}
                    </View>
                  </SectionGate>
                </View>
              </View>

              {/* 2 Calories */}
              <View style={[styles.pagerPage, { width: pageWidth }]}>
                <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <View style={styles.cardHeaderRow}>
                    <View>
                      <Text style={[styles.cardTitle, { color: theme.text }]}>Kalori vs Target</Text>
                      <Text style={[styles.cardSub, { color: theme.textSecondary }]}>{rangeLabel}</Text>
                    </View>
                    <View style={[styles.pill, { backgroundColor: themeMode === 'dark' ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.12)', borderColor: themeMode === 'dark' ? 'rgba(16,185,129,0.35)' : 'rgba(16,185,129,0.22)' }]}>
                      <Text style={styles.pillText}>Target {dailyTargets?.calories ?? 0} kcal</Text>
                    </View>
                  </View>

                  <View style={styles.kpiRow}>
                    <View style={[styles.kpiBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
                      <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Rata-rata</Text>
                      <Text style={[styles.kpiBig, { color: theme.text }]}>{stats.avgCalories}</Text>
                      <Text style={[styles.kpiSmall, { color: theme.textTertiary }]}>kcal</Text>
                    </View>
                    <View style={[styles.kpiBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
                      <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Dalam target</Text>
                      <Text style={[styles.kpiBig, { color: theme.text }]}>{stats.consistencyPercentage}%</Text>
                      <Text style={[styles.kpiSmall, { color: theme.textTertiary }]}>hari</Text>
                    </View>
                  </View>

                  <SectionGate
                    enabled={stats.daysLogged >= 3}
                    message="Catat makanan minimal 3 hari untuk melihat tren."
                    radius={18}
                    isDark={themeMode === 'dark'}
                  >
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartScrollContent}>
                      <View style={styles.barChart}>
                        <View style={[styles.targetLine, { top: `${100 - targetPct}%` }]}>
                          <View style={[styles.targetLineDash, { backgroundColor: theme.textTertiary }]} />
                          <Text style={[styles.targetLabel, { color: theme.textTertiary }]}>Target</Text>
                        </View>

                        <View style={styles.barsContainer}>
                          {dayData.map((day, idx) => {
                            const heightPct = maxCalories > 0 ? (day.calories / maxCalories) * 100 : 0;
                            const target = dailyTargets?.calories ?? 2000;
                            const within = Math.abs(day.calories - target) <= target * 0.1;
                            const over = day.calories > target * 1.1;

                            const barColor =
                              day.entries.length === 0
                                ? theme.border
                                : within
                                ? '#10B981'
                                : over
                                ? '#F59E0B'
                                : '#10B981';

                            const showLabel = idx % xLabelEvery === 0 || idx === dayData.length - 1;

                            return (
                              <View key={day.dateKey} style={styles.barWrapper}>
                                <View style={styles.barContainer}>
                                  <View
                                    style={[
                                      styles.bar,
                                      {
                                        height: `${heightPct}%`,
                                        width: barWidth,
                                        backgroundColor: barColor,
                                      },
                                    ]}
                                  />
                                </View>
                                {showLabel && <Text style={[styles.barLabel, { color: theme.textSecondary }]}>{dayMonthLabel(day.dateKey)}</Text>}
                              </View>
                            );
                          })}
                        </View>

                        <View style={styles.yHintRow}>
                          <Text style={[styles.yHintText, { color: theme.textTertiary }]}>{maxCalories} kcal</Text>
                          <Text style={[styles.yHintText, { color: theme.textTertiary }]}>0</Text>
                        </View>
                      </View>
                    </ScrollView>
                  </SectionGate>

                  <View style={styles.legendRow}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
                      <Text style={[styles.legendText, { color: theme.textSecondary }]}>Dalam target</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
                      <Text style={[styles.legendText, { color: theme.textSecondary }]}>Di atas target</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: theme.border }]} />
                      <Text style={[styles.legendText, { color: theme.textSecondary }]}>Belum dicatat</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* 3 Macros */}
              <View style={[styles.pagerPage, { width: pageWidth }]}>
                <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <View style={styles.cardHeaderRow}>
                    <View>
                      <Text style={[styles.cardTitle, { color: theme.text }]}>Keseimbangan Makro</Text>
                      <Text style={[styles.cardSub, { color: theme.textSecondary }]}>{rangeLabel}</Text>
                    </View>
                  </View>

                  <SectionGate enabled={stats.daysLogged >= 7} message="Catat makanan minimal 7 hari untuk melihat analisis makro." radius={18} isDark={themeMode === 'dark'}>
                    {(() => {
                      const remaining = Math.max(0, stats.avgCalories - stats.avgProtein * 4);
                      const avgFat = Math.round((remaining * 0.3) / 9);
                      const avgCarbs = Math.round((remaining * 0.7) / 4);

                      const proteinCals = stats.avgProtein * 4;
                      const fatCals = avgFat * 9;
                      const carbsCals = avgCarbs * 4;
                      const totalCals = proteinCals + fatCals + carbsCals;

                      const proteinPercent = totalCals > 0 ? (proteinCals / totalCals) * 100 : 0;
                      const fatPercent = totalCals > 0 ? (fatCals / totalCals) * 100 : 0;
                      const carbsPercent = totalCals > 0 ? (carbsCals / totalCals) * 100 : 0;

                      const circumference = 2 * Math.PI * 50;
                      const proteinDash = (proteinPercent / 100) * circumference;
                      const fatDash = (fatPercent / 100) * circumference;
                      const carbsDash = (carbsPercent / 100) * circumference;

                      return (
                        <View style={styles.macroRow}>
                          <View style={[styles.macroRingWrap, { backgroundColor: theme.background, borderColor: theme.border }]}>
                            <Svg width="140" height="140" viewBox="0 0 140 140">
                              <G rotation="-90" originX="70" originY="70">
                                <Circle cx="70" cy="70" r="50" stroke={theme.border} strokeWidth="12" fill="none" />
                                <Circle
                                  cx="70"
                                  cy="70"
                                  r="50"
                                  stroke="#10B981"
                                  strokeWidth="12"
                                  fill="none"
                                  strokeDasharray={`${proteinDash} ${circumference}`}
                                  strokeDashoffset={0}
                                  strokeLinecap="round"
                                />
                                <Circle
                                  cx="70"
                                  cy="70"
                                  r="50"
                                  stroke="#F59E0B"
                                  strokeWidth="12"
                                  fill="none"
                                  strokeDasharray={`${fatDash} ${circumference}`}
                                  strokeDashoffset={-proteinDash}
                                  strokeLinecap="round"
                                />
                                <Circle
                                  cx="70"
                                  cy="70"
                                  r="50"
                                  stroke="#3B82F6"
                                  strokeWidth="12"
                                  fill="none"
                                  strokeDasharray={`${carbsDash} ${circumference}`}
                                  strokeDashoffset={-(proteinDash + fatDash)}
                                  strokeLinecap="round"
                                />
                              </G>
                            </Svg>
                            <View style={styles.macroCenter}>
                              <Text style={[styles.macroCenterText, { color: theme.textSecondary }]}>Makro</Text>
                            </View>
                          </View>

                          <View style={styles.macroList}>
                            <View style={styles.macroItem}>
                              <View style={[styles.macroDot, { backgroundColor: '#10B981' }]} />
                              <View style={styles.macroTextCol}>
                                <Text style={[styles.macroLabel, { color: theme.textSecondary }]}>Protein</Text>
                                <Text style={[styles.macroValue, { color: theme.text }]}>
                                  {stats.avgProtein}g ({Math.round(proteinPercent)}%)
                                </Text>
                              </View>
                            </View>

                            <View style={styles.macroItem}>
                              <View style={[styles.macroDot, { backgroundColor: '#F59E0B' }]} />
                              <View style={styles.macroTextCol}>
                                <Text style={[styles.macroLabel, { color: theme.textSecondary }]}>Lemak</Text>
                                <Text style={[styles.macroValue, { color: theme.text }]}>
                                  {avgFat}g ({Math.round(fatPercent)}%)
                                </Text>
                              </View>
                            </View>

                            <View style={styles.macroItem}>
                              <View style={[styles.macroDot, { backgroundColor: '#3B82F6' }]} />
                              <View style={styles.macroTextCol}>
                                <Text style={[styles.macroLabel, { color: theme.textSecondary }]}>Karbo</Text>
                                <Text style={[styles.macroValue, { color: theme.text }]}>
                                  {avgCarbs}g ({Math.round(carbsPercent)}%)
                                </Text>
                              </View>
                            </View>
                          </View>
                        </View>
                      );
                    })()}
                  </SectionGate>
                </View>
              </View>

              {/* 4 Forecast */}
              <View style={[styles.pagerPage, { width: pageWidth }]}>
                <View style={[styles.card, { alignItems: 'center' }]}>
                  <View style={styles.forecastIcon}>
                    <Target size={26} color="#10B981" />
                  </View>
                  <Text style={[styles.forecastTitle, { color: theme.text }]}>Proyeksi Target</Text>
                  <Text style={[styles.forecastSub, { color: theme.textSecondary }]}>Berdasarkan tren berat badan</Text>

                  <SectionGate
                    enabled={goalForecast != null}
                    message="Butuh minimal 14 hari catatan dan minimal 2 data berat badan untuk proyeksi."
                    radius={18}
                    isDark={themeMode === 'dark'}
                  >
                    <View style={{ width: '100%', alignItems: 'center' }}>
                      {goalForecast ? (
                        <>
                          <Text style={[styles.forecastText, { color: theme.textSecondary }]}>
                            Dengan pola saat ini, target {goalForecast.targetWeight.toFixed(1)} kg diperkirakan tercapai sekitar
                          </Text>
                          <Text style={styles.forecastDate}>{goalForecast.projectedDate}</Text>
                          <Text style={[styles.forecastFoot, { color: theme.textSecondary }]}>Sekitar {goalForecast.daysToGoal} hari lagi</Text>
                        </>
                      ) : (
                        <Text style={[styles.forecastText, { color: theme.textSecondary }]}>Proyeksi akan muncul setelah datanya cukup.</Text>
                      )}
                    </View>
                  </SectionGate>
                </View>
              </View>
            </ScrollView>
          </View>

          {/* Streak */}
          <View style={styles.streakSection}>
            <Text style={[styles.sectionHeading, { color: theme.text }]}>Konsistensi & Streak</Text>
            <View style={styles.streakGrid}>
              <View style={[styles.streakItem, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Flame size={22} color="#FF6B35" fill="#FF6B35" />
                <Text style={[styles.streakValue, { color: theme.text }]}>{streakData?.currentStreak ?? 0}</Text>
                <Text style={[styles.streakLabel, { color: theme.textSecondary }]}>Streak saat ini</Text>
              </View>
              <View style={[styles.streakItem, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Award size={22} color="#F59E0B" />
                <Text style={[styles.streakValue, { color: theme.text }]}>{streakData?.bestStreak ?? 0}</Text>
                <Text style={[styles.streakLabel, { color: theme.textSecondary }]}>Rekor terbaik</Text>
              </View>
              <View style={[styles.streakItem, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Calendar size={22} color="#10B981" />
                <Text style={[styles.streakValue, { color: theme.text }]}>{stats.daysLogged}</Text>
                <Text style={[styles.streakLabel, { color: theme.textSecondary }]}>Hari tercatat</Text>
              </View>
            </View>
          </View>

          {/* Wawasan */}
          <View style={styles.insightsSection}>
            <View style={styles.sectionRow}>
              <Lightbulb size={18} color="#10B981" />
              <Text style={[styles.sectionHeading, { color: theme.text }]}>Wawasan</Text>
            </View>

            <SectionGate enabled={stats.daysLogged >= 7} message="Catat makanan minimal 7 hari untuk wawasan yang lebih akurat." radius={18} isDark={themeMode === 'dark'}>
              <View>
                {insights.length > 0 ? (
                  insights.map((insight, index) => (
                    <View key={index} style={[styles.insightCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                      {insight.icon && <Text style={styles.insightIcon}>{insight.icon}</Text>}
                      <Text style={[styles.insightText, { color: theme.textSecondary }]}>{insight.text}</Text>
                    </View>
                  ))
                ) : (
                  <View style={[styles.insightCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <Text style={[styles.insightText, { color: theme.textSecondary }]}>Belum ada wawasan untuk ditampilkan.</Text>
                  </View>
                )}
              </View>
            </SectionGate>
          </View>

          <View style={styles.bottomPadding} />
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    paddingHorizontal: 24,
    paddingTop: 58,
    paddingBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: { fontSize: 30, fontWeight: '900', marginBottom: 4 },
  subtitle: { fontSize: 14, fontWeight: '600' },

  headerStreak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  headerStreakText: { fontSize: 14, fontWeight: '800' },

  content: { flex: 1 },

  timeRangeSelector: {
    flexDirection: 'row',
    marginHorizontal: 24,
    marginBottom: 12,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
  },
  timeRangeButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
  timeRangeButtonActive: { backgroundColor: '#10B981' },
  timeRangeText: { fontSize: 13, fontWeight: '800' },
  timeRangeTextActive: { color: '#FFFFFF' },

  goodNewsCard: {
    marginHorizontal: 24,
    marginBottom: 14,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
  },
  goodNewsTitle: { fontSize: 15, fontWeight: '800', color: '#0E7A5A', lineHeight: 20 },
  goodNewsSub: { marginTop: 6, fontSize: 13, fontWeight: '700', color: '#166B55' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  progressBar: {
    flex: 1,
    height: 10,
    backgroundColor: 'rgba(16,185,129,0.18)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#10B981', borderRadius: 999 },
  progressText: { fontSize: 12, fontWeight: '800', color: '#0E7A5A' },

  pagerHeaderRow: {
    marginHorizontal: 24,
    marginTop: 2,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pagerHeaderTitle: { fontSize: 16, fontWeight: '800' },

  pagerTabs: {
    marginHorizontal: 24,
    marginBottom: 12,
    flexDirection: 'row',
    gap: 8,
  },
  pagerTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  pagerTabText: {
    fontSize: 12,
    fontWeight: '800',
  },

  pagerBlock: { marginHorizontal: 24, marginBottom: 22 },
  pagerPage: {},

  card: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },

  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  cardSub: { fontSize: 12, fontWeight: '700', marginTop: 3 },

  pill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  pillText: { fontSize: 12, fontWeight: '800', color: '#0E7A5A' },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
  },
  addBtnText: { fontSize: 12, fontWeight: '800', color: '#0E7A5A' },

  loggerCard: {
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  loggerTitle: { fontSize: 13, fontWeight: '800', marginBottom: 10 },
  loggerRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  loggerInput: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '700',
  },
  loggerSave: {
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loggerSaveText: { fontSize: 13, fontWeight: '900', color: '#FFFFFF' },
  loggerHint: { marginTop: 8, fontSize: 12, fontWeight: '600', lineHeight: 16 },
  errorText: { marginTop: 8, fontSize: 12, fontWeight: '800', color: '#DC2626' },

  kpiRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  weightKpiRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  kpiBox: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
  },
  kpiLabel: { fontSize: 12, fontWeight: '800' },
  kpiBig: { fontSize: 20, fontWeight: '900', marginTop: 6 },
  kpiSmall: { fontSize: 12, fontWeight: '700', marginTop: 2 },

  goalLineCard: {
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  goalLineText: { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  goalLineStrong: { fontWeight: '900', color: '#0E7A5A' },
  progressBarThin: {
    marginTop: 10,
    height: 8,
    backgroundColor: 'rgba(16,185,129,0.18)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFillThin: { height: '100%', backgroundColor: '#10B981', borderRadius: 999 },

  whiteChart: {
    height: 190,
    borderRadius: 16,
    padding: 12,
    borderWidth: 0,
    position: 'relative',
  },
  axisLabels: {
    position: 'absolute',
    left: 10,
    top: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  axisLabelText: { fontSize: 11, fontWeight: '800' },
  xLabelsRow: { marginTop: 10 },
  xLabelSpread: { flexDirection: 'row', justifyContent: 'space-between' },
  xLabelText: { fontSize: 11, fontWeight: '800' },

  chartScrollContent: { paddingVertical: 2 },
  barChart: { height: 220, position: 'relative', paddingHorizontal: 6, paddingBottom: 6 },
  targetLine: { position: 'absolute', left: 0, right: 0, height: 18, zIndex: 1 },
  targetLineDash: { position: 'absolute', left: 0, right: 0, top: 8, height: 1, opacity: 0.35 },
  targetLabel: { position: 'absolute', right: 0, top: 0, fontSize: 11, fontWeight: '800' },

  barsContainer: { flexDirection: 'row', alignItems: 'flex-end', height: 190, gap: 8, paddingTop: 16 },
  barWrapper: { alignItems: 'center', gap: 8 },
  barContainer: { height: 170, justifyContent: 'flex-end' },
  bar: { borderTopLeftRadius: 7, borderTopRightRadius: 7, minHeight: 4 },
  barLabel: { fontSize: 10, fontWeight: '800', textAlign: 'center', width: 44 },

  yHintRow: { marginTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  yHintText: { fontSize: 11, fontWeight: '800' },

  legendRow: { marginTop: 12, flexDirection: 'row', justifyContent: 'center', gap: 14, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, fontWeight: '700' },

  macroRow: { flexDirection: 'row', gap: 14, alignItems: 'center', marginTop: 6 },
  macroRingWrap: {
    width: 140,
    height: 140,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  macroCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  macroCenterText: { fontSize: 12, fontWeight: '800' },

  macroList: { flex: 1, gap: 12 },
  macroItem: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  macroDot: { width: 10, height: 10, borderRadius: 5 },
  macroTextCol: { flex: 1 },
  macroLabel: { fontSize: 12, fontWeight: '800' },
  macroValue: { fontSize: 14, fontWeight: '900', marginTop: 2 },

  forecastIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(16,185,129,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  forecastTitle: { fontSize: 18, fontWeight: '900' },
  forecastSub: { fontSize: 12, fontWeight: '700', marginTop: 4, marginBottom: 12 },
  forecastText: { fontSize: 14, fontWeight: '700', textAlign: 'center', lineHeight: 20 },
  forecastDate: { fontSize: 20, fontWeight: '900', color: '#10B981', marginTop: 10 },
  forecastFoot: { fontSize: 12, fontWeight: '700', marginTop: 4 },

  sectionHeading: { fontSize: 16, fontWeight: '800' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },

  streakSection: { marginHorizontal: 24, marginBottom: 18 },
  streakGrid: { flexDirection: 'row', gap: 12, marginTop: 12 },
  streakItem: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 6,
  },
  streakValue: { fontSize: 20, fontWeight: '900' },
  streakLabel: { fontSize: 11, fontWeight: '700', textAlign: 'center' },

  insightsSection: { marginHorizontal: 24, marginBottom: 24 },
  insightCard: {
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  insightIcon: { fontSize: 18 },
  insightText: { fontSize: 14, fontWeight: '700', lineHeight: 20, flex: 1 },

  bottomPadding: { height: 40 },

  muted: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
});
