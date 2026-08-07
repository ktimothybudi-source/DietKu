import { supabase } from '@/lib/supabase';
import { getTodayKey } from '@/utils/nutritionCalculations';

export type DailyGoalStatus = 'hit' | 'in_progress' | 'over' | 'not_started';

export interface DailyProgressShare {
  userId: string;
  date: string;
  caloriesEaten: number;
  proteinEaten: number;
  carbsEaten: number;
  fatEaten: number;
  caloriesTarget: number;
  proteinTarget: number;
  updatedAt: number;
}

export interface DailyProgressPayload {
  caloriesEaten: number;
  proteinEaten: number;
  carbsEaten: number;
  fatEaten: number;
  caloriesTarget: number;
  proteinTarget: number;
}

/** Match dashboard celebration band: 90–110% of calorie target. */
export function getDailyGoalStatus(
  caloriesEaten: number,
  caloriesTarget: number
): DailyGoalStatus {
  if (!caloriesTarget || caloriesTarget <= 0) return 'not_started';
  if (caloriesEaten <= 0) return 'not_started';
  const pct = (caloriesEaten / caloriesTarget) * 100;
  if (pct >= 90 && pct <= 110) return 'hit';
  if (pct > 110) return 'over';
  return 'in_progress';
}

export function getCaloriesProgressPercent(
  caloriesEaten: number,
  caloriesTarget: number
): number {
  if (!caloriesTarget || caloriesTarget <= 0) return 0;
  return Math.max(0, (caloriesEaten / caloriesTarget) * 100);
}

export async function upsertDailyProgressShare(
  userId: string,
  payload: DailyProgressPayload,
  dateKey: string = getTodayKey()
): Promise<void> {
  const { error } = await supabase.from('daily_progress_shares').upsert(
    {
      user_id: userId,
      date: dateKey,
      calories_eaten: Math.round(payload.caloriesEaten),
      protein_eaten: Math.round(payload.proteinEaten),
      carbs_eaten: Math.round(payload.carbsEaten),
      fat_eaten: Math.round(payload.fatEaten),
      calories_target: Math.round(payload.caloriesTarget),
      protein_target: Math.round(payload.proteinTarget),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,date' }
  );

  if (error) {
    // Table may not exist until migration is applied; fail soft.
    console.warn('[dailyProgressShare] upsert failed:', error.message);
  }
}

export function mapDailyProgressRow(row: {
  user_id: string;
  date: string;
  calories_eaten: number | string;
  protein_eaten: number | string;
  carbs_eaten: number | string;
  fat_eaten: number | string;
  calories_target: number | string;
  protein_target: number | string;
  updated_at: string;
}): DailyProgressShare {
  return {
    userId: row.user_id,
    date: row.date,
    caloriesEaten: Number(row.calories_eaten) || 0,
    proteinEaten: Number(row.protein_eaten) || 0,
    carbsEaten: Number(row.carbs_eaten) || 0,
    fatEaten: Number(row.fat_eaten) || 0,
    caloriesTarget: Number(row.calories_target) || 0,
    proteinTarget: Number(row.protein_target) || 0,
    updatedAt: new Date(row.updated_at).getTime(),
  };
}
