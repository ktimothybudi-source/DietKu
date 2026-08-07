import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserProfile, FoodEntry } from '@/types/nutrition';

const CACHE_VERSION = 1;
const PREFIX = `dietku_dashboard_v${CACHE_VERSION}:`;

export type DashboardFoodLog = Record<string, FoodEntry[]>;

export interface DashboardStreakSnapshot {
  currentStreak: number;
  bestStreak: number;
  lastLoggedDate: string;
  graceUsedThisWeek: boolean;
}

export interface DashboardCacheSnapshot {
  profile: UserProfile | null;
  foodLog: DashboardFoodLog;
  streak: DashboardStreakSnapshot | null;
  waterCups: Record<string, number>;
  savedAt: number;
}

function profileKey(userId: string) {
  return `${PREFIX}${userId}:bundle`;
}

/** Keep only recent days so cold-start cache stays small. */
export function pruneFoodLog(foodLog: DashboardFoodLog, keepDays = 21): DashboardFoodLog {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - keepDays);
  const cutoffKey = cutoff.toISOString().slice(0, 10);

  const next: DashboardFoodLog = {};
  for (const [dateKey, entries] of Object.entries(foodLog)) {
    if (dateKey >= cutoffKey && entries?.length) {
      next[dateKey] = entries;
    }
  }
  return next;
}

export async function loadDashboardCache(userId: string): Promise<DashboardCacheSnapshot | null> {
  if (!userId) return null;
  try {
    const raw = await AsyncStorage.getItem(profileKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DashboardCacheSnapshot;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      profile: parsed.profile ?? null,
      foodLog: parsed.foodLog && typeof parsed.foodLog === 'object' ? parsed.foodLog : {},
      streak: parsed.streak ?? null,
      waterCups: parsed.waterCups && typeof parsed.waterCups === 'object' ? parsed.waterCups : {},
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : 0,
    };
  } catch (e) {
    console.warn('loadDashboardCache failed:', e);
    return null;
  }
}

export async function saveDashboardCache(
  userId: string,
  snapshot: Omit<DashboardCacheSnapshot, 'savedAt'>
): Promise<void> {
  if (!userId) return;
  try {
    const payload: DashboardCacheSnapshot = {
      profile: snapshot.profile,
      foodLog: pruneFoodLog(snapshot.foodLog),
      streak: snapshot.streak,
      waterCups: snapshot.waterCups,
      savedAt: Date.now(),
    };
    await AsyncStorage.setItem(profileKey(userId), JSON.stringify(payload));
  } catch (e) {
    console.warn('saveDashboardCache failed:', e);
  }
}

export async function clearDashboardCache(userId?: string | null): Promise<void> {
  try {
    if (userId) {
      await AsyncStorage.removeItem(profileKey(userId));
      return;
    }
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith(PREFIX));
    if (ours.length) await AsyncStorage.multiRemove(ours);
  } catch (e) {
    console.warn('clearDashboardCache failed:', e);
  }
}
