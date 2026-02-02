import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
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
  ChevronRight,
  Plus,
} from 'lucide-react-native';
import { useNutrition } from '@/contexts/NutritionContext';
import { useTheme } from '@/contexts/ThemeContext';
import { FoodEntry } from '@/types/nutrition';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type TimeRange = '7h' | '30h' | '90h' | 'All';
type GraphTab = 'Berat' | 'Kalori' | 'Makro' | 'Target';

interface DayData {
  date: string;
  dateKey: string;
  calories: number;
  protein: number;
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
  const { theme, themeMode } = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = themeMode === 'dark';

  const [timeRange, setTimeRange] = useState<TimeRange>('All');
  const [graphTab, setGraphTab] = useState<GraphTab>('Berat');
  const [showWeightInput, setShowWeightInput] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [weightError, setWeightError] = useState<string | null>(null);

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

  const accentColor = '#4a7c6f';
  const cardBg = isDark ? '#1a1a1a' : '#ffffff';
  const pageBg = isDark ? '#0f0f0f' : '#f5f5f5';
  const pillBg = isDark ? '#2a2a2a' : '#ffffff';
  const textPrimary = isDark ? '#ffffff' : '#1a1a1a';
  const textSecondary = isDark ? '#888888' : '#666666';
  const textTertiary = isDark ? '#555555' : '#999999';

  if (!setupReady) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { backgroundColor: pageBg, paddingTop: insets.top }]}>
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: textPrimary }]}>Analitik</Text>
          </View>
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: cardBg }]}>
              <TrendingUp size={32} color={textTertiary} />
            </View>
            <Text style={[styles.emptyTitle, { color: textPrimary }]}>Belum ada data</Text>
            <Text style={[styles.emptyText, { color: textSecondary }]}>
              Lengkapi profil dan mulai catat makananmu untuk melihat analitik
            </Text>
          </View>
        </View>
      </>
    );
  }

  const renderWeightContent = () => (
    <View style={[styles.contentCard, { backgroundColor: cardBg }]}>
      <View style={styles.contentCardHeader}>
        <View>
          <Text style={[styles.contentCardTitle, { color: textPrimary }]}>Perubahan berat badan</Text>
          <Text style={[styles.contentCardSubtitle, { color: textSecondary }]}>Berat saat ini</Text>
        </View>
        <TouchableOpacity
          style={[styles.recordBtn, { backgroundColor: isDark ? '#2a3a35' : '#e8f5f0' }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowWeightInput(!showWeightInput);
          }}
          activeOpacity={0.7}
        >
          <Plus size={14} color={accentColor} />
          <Text style={[styles.recordBtnText, { color: accentColor }]}>Catat</Text>
        </TouchableOpacity>
      </View>

      {showWeightInput && (
        <View style={[styles.weightInputCard, { backgroundColor: isDark ? '#252525' : '#f8f8f8', borderColor: isDark ? '#333' : '#e5e5e5' }]}>
          <View style={styles.weightInputRow}>
            <TextInput
              value={weightInput}
              onChangeText={setWeightInput}
              placeholder="72.5"
              placeholderTextColor={textTertiary}
              keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
              style={[styles.weightInput, { backgroundColor: cardBg, borderColor: isDark ? '#333' : '#e5e5e5', color: textPrimary }]}
            />
            <Text style={[styles.weightUnit, { color: textSecondary }]}>kg</Text>
            <TouchableOpacity style={[styles.weightSaveBtn, { backgroundColor: accentColor }]} onPress={logWeightToday}>
              <Text style={styles.weightSaveBtnText}>Simpan</Text>
            </TouchableOpacity>
          </View>
          {weightError && <Text style={styles.weightError}>{weightError}</Text>}
        </View>
      )}

      <View style={styles.weightStatsRow}>
        <View style={styles.weightStatItem}>
          <Text style={[styles.weightStatValue, { color: textPrimary }]}>
            {stats.currentWeight.toFixed(1)}
            <Text style={[styles.weightStatUnit, { color: textSecondary }]}> kg</Text>
          </Text>
          <Text style={[styles.weightStatLabel, { color: textSecondary }]}>Berat saat ini</Text>
        </View>
        <View style={styles.weightStatItem}>
          <View style={styles.weightChangeRow}>
            {stats.weightChange !== 0 && (
              stats.weightChange > 0 ? 
                <TrendingUp size={16} color="#f59e0b" /> : 
                <TrendingDown size={16} color="#22c55e" />
            )}
            <Text style={[styles.weightStatValue, { color: textPrimary }]}>
              {Math.abs(stats.weightChange).toFixed(1)}
              <Text style={[styles.weightStatUnit, { color: textSecondary }]}> kg</Text>
            </Text>
          </View>
          <Text style={[styles.weightStatLabel, { color: textSecondary }]}>perubahan</Text>
        </View>
      </View>

      {weightChartData.length < 2 && (
        <Text style={[styles.infoText, { color: textTertiary }]}>
          Catat berat badan 2× untuk mulai melihat tren.
        </Text>
      )}

      <TouchableOpacity style={[styles.ctaBtn, { borderTopColor: isDark ? '#2a2a2a' : '#f0f0f0' }]} activeOpacity={0.7}>
        <Text style={[styles.ctaBtnText, { color: textPrimary }]}>Mulai catat hari ini</Text>
        <ChevronRight size={18} color={textSecondary} />
      </TouchableOpacity>
    </View>
  );

  const renderCaloriesContent = () => (
    <View style={[styles.contentCard, { backgroundColor: cardBg }]}>
      <View style={styles.contentCardHeader}>
        <View>
          <Text style={[styles.contentCardTitle, { color: textPrimary }]}>Asupan kalori</Text>
          <Text style={[styles.contentCardSubtitle, { color: textSecondary }]}>Rata-rata harian</Text>
        </View>
      </View>

      <View style={styles.weightStatsRow}>
        <View style={styles.weightStatItem}>
          <Text style={[styles.weightStatValue, { color: textPrimary }]}>
            {stats.avgCalories}
            <Text style={[styles.weightStatUnit, { color: textSecondary }]}> kcal</Text>
          </Text>
          <Text style={[styles.weightStatLabel, { color: textSecondary }]}>Rata-rata</Text>
        </View>
        <View style={styles.weightStatItem}>
          <Text style={[styles.weightStatValue, { color: textPrimary }]}>
            {stats.targetCalories}
            <Text style={[styles.weightStatUnit, { color: textSecondary }]}> kcal</Text>
          </Text>
          <Text style={[styles.weightStatLabel, { color: textSecondary }]}>Target</Text>
        </View>
      </View>

      {stats.daysLogged < 3 && (
        <Text style={[styles.infoText, { color: textTertiary }]}>
          Catat makanan 3 hari untuk melihat analisis.
        </Text>
      )}
    </View>
  );

  const renderMacrosContent = () => {
    const remaining = Math.max(0, stats.avgCalories - stats.avgProtein * 4);
    const avgFat = Math.round((remaining * 0.3) / 9);
    const avgCarbs = Math.round((remaining * 0.7) / 4);

    return (
      <View style={[styles.contentCard, { backgroundColor: cardBg }]}>
        <View style={styles.contentCardHeader}>
          <View>
            <Text style={[styles.contentCardTitle, { color: textPrimary }]}>Makronutrien</Text>
            <Text style={[styles.contentCardSubtitle, { color: textSecondary }]}>Distribusi harian</Text>
          </View>
        </View>

        <View style={styles.macroGrid}>
          <View style={[styles.macroItem, { backgroundColor: isDark ? '#1a2e1a' : '#f0fdf4' }]}>
            <Text style={[styles.macroValue, { color: '#22c55e' }]}>{stats.avgProtein}g</Text>
            <Text style={[styles.macroLabel, { color: textSecondary }]}>Protein</Text>
          </View>
          <View style={[styles.macroItem, { backgroundColor: isDark ? '#2d2a1a' : '#fffbeb' }]}>
            <Text style={[styles.macroValue, { color: '#f59e0b' }]}>{avgFat}g</Text>
            <Text style={[styles.macroLabel, { color: textSecondary }]}>Lemak</Text>
          </View>
          <View style={[styles.macroItem, { backgroundColor: isDark ? '#1a1a2e' : '#eff6ff' }]}>
            <Text style={[styles.macroValue, { color: '#3b82f6' }]}>{avgCarbs}g</Text>
            <Text style={[styles.macroLabel, { color: textSecondary }]}>Karbo</Text>
          </View>
        </View>

        {stats.daysLogged < 7 && (
          <Text style={[styles.infoText, { color: textTertiary }]}>
            Catat makanan 7 hari untuk analisis lebih akurat.
          </Text>
        )}
      </View>
    );
  };

  const renderTargetContent = () => (
    <View style={[styles.contentCard, { backgroundColor: cardBg }]}>
      <View style={styles.contentCardHeader}>
        <View>
          <Text style={[styles.contentCardTitle, { color: textPrimary }]}>Target harian</Text>
          <Text style={[styles.contentCardSubtitle, { color: textSecondary }]}>Pencapaian target</Text>
        </View>
      </View>

      <View style={styles.weightStatsRow}>
        <View style={styles.weightStatItem}>
          <Text style={[styles.weightStatValue, { color: textPrimary }]}>
            {stats.consistencyPercentage}
            <Text style={[styles.weightStatUnit, { color: textSecondary }]}>%</Text>
          </Text>
          <Text style={[styles.weightStatLabel, { color: textSecondary }]}>Konsistensi</Text>
        </View>
        <View style={styles.weightStatItem}>
          <Text style={[styles.weightStatValue, { color: textPrimary }]}>
            {stats.daysWithinTarget}
            <Text style={[styles.weightStatUnit, { color: textSecondary }]}> hari</Text>
          </Text>
          <Text style={[styles.weightStatLabel, { color: textSecondary }]}>Sesuai target</Text>
        </View>
      </View>
    </View>
  );

  const renderGraphContent = () => {
    switch (graphTab) {
      case 'Berat': return renderWeightContent();
      case 'Kalori': return renderCaloriesContent();
      case 'Makro': return renderMacrosContent();
      case 'Target': return renderTargetContent();
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { backgroundColor: pageBg }]}>
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: textPrimary }]}>Analitik</Text>
            {!!streakData?.currentStreak && streakData.currentStreak > 0 && (
              <View style={styles.streakBadge}>
                <Flame size={16} color="#e07850" fill="#e07850" />
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
                  { backgroundColor: pillBg },
                  timeRange === range && { backgroundColor: accentColor },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setTimeRange(range);
                }}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.timeRangeText,
                  { color: textSecondary },
                  timeRange === range && { color: '#ffffff' },
                ]}>
                  {range}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { color: textPrimary }]}>Grafik</Text>
          
          <View style={styles.graphTabsContainer}>
            {(['Berat', 'Kalori', 'Makro', 'Target'] as const).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.graphTab,
                  { backgroundColor: pillBg },
                  graphTab === tab && { backgroundColor: accentColor },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setGraphTab(tab);
                }}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.graphTabText,
                  { color: textSecondary },
                  graphTab === tab && { color: '#ffffff' },
                ]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {renderGraphContent()}

          <Text style={[styles.sectionTitle, { color: textPrimary, marginTop: 24 }]}>Konsistensi & Streak</Text>

          <View style={styles.streakGrid}>
            <View style={[styles.streakCard, { backgroundColor: cardBg }]}>
              <View style={[styles.streakIconWrap, { backgroundColor: isDark ? '#2d2018' : '#fff5f0' }]}>
                <Flame size={20} color="#e07850" fill="#e07850" />
              </View>
              <Text style={[styles.streakValue, { color: textPrimary }]}>{streakData?.currentStreak ?? 0}</Text>
              <Text style={[styles.streakLabel, { color: textSecondary }]}>Streak saat ini</Text>
            </View>
            <View style={[styles.streakCard, { backgroundColor: cardBg }]}>
              <View style={[styles.streakIconWrap, { backgroundColor: isDark ? '#2d2a18' : '#fefce8' }]}>
                <Award size={20} color="#d4a520" />
              </View>
              <Text style={[styles.streakValue, { color: textPrimary }]}>{streakData?.bestStreak ?? 0}</Text>
              <Text style={[styles.streakLabel, { color: textSecondary }]}>Rekor terbaik</Text>
            </View>
            <View style={[styles.streakCard, { backgroundColor: cardBg }]}>
              <View style={[styles.streakIconWrap, { backgroundColor: isDark ? '#182d2a' : '#f0fdf4' }]}>
                <Calendar size={20} color={accentColor} />
              </View>
              <Text style={[styles.streakValue, { color: textPrimary }]}>{stats.daysLogged}</Text>
              <Text style={[styles.streakLabel, { color: textSecondary }]}>Hari tercatat</Text>
            </View>
          </View>

          <View style={styles.insightSection}>
            <View style={styles.insightHeader}>
              <Lightbulb size={18} color={textSecondary} />
              <Text style={[styles.insightTitle, { color: textPrimary }]}>Wawasan</Text>
            </View>
            <View style={[styles.insightCard, { backgroundColor: cardBg }]}>
              <Text style={[styles.insightText, { color: textSecondary }]}>
                {getInsightMessage()}
              </Text>
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
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(224, 120, 80, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  streakBadgeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#e07850',
  },
  timeRangeContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 28,
  },
  timeRangePill: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 24,
  },
  timeRangeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
  },
  graphTabsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  graphTab: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  graphTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  contentCard: {
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  contentCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  contentCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  contentCardSubtitle: {
    fontSize: 13,
    fontWeight: '500',
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
    fontWeight: '600',
  },
  weightInputCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
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
    paddingHorizontal: 18,
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
    gap: 20,
    marginBottom: 16,
  },
  weightStatItem: {
    flex: 1,
  },
  weightStatValue: {
    fontSize: 32,
    fontWeight: '300',
    letterSpacing: -1,
  },
  weightStatUnit: {
    fontSize: 16,
    fontWeight: '500',
  },
  weightStatLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
  },
  weightChangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 20,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    marginTop: 8,
    borderTopWidth: 1,
  },
  ctaBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  macroGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  macroItem: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  macroValue: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  macroLabel: {
    fontSize: 12,
    fontWeight: '600',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
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
    fontWeight: '700',
    marginBottom: 4,
  },
  streakLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  insightSection: {
    marginTop: 28,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  insightCard: {
    padding: 18,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  insightText: {
    fontSize: 14,
    fontWeight: '500',
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
