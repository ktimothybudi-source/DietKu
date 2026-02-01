import { UserProfile, DailyTargets, Goal, ActivityLevel, Sex } from '@/types/nutrition';

export function calculateBMR(weight: number, height: number, age: number, sex: Sex): number {
  if (sex === 'male') {
    return 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    return 10 * weight + 6.25 * height - 5 * age - 161;
  }
}

export function getActivityMultiplier(activityLevel: ActivityLevel): number {
  switch (activityLevel) {
    case 'low':
      return 1.2;
    case 'moderate':
      return 1.5;
    case 'high':
      return 1.8;
  }
}

export function getGoalAdjustment(goal: Goal): number {
  switch (goal) {
    case 'fat_loss':
      return -500;
    case 'maintenance':
      return 0;
    case 'muscle_gain':
      return 300;
  }
}

export function calculateDailyTargets(profile: UserProfile, targetWeight?: number): DailyTargets {
  const weightToUse = targetWeight || profile.goalWeight || profile.weight;
  const bmr = calculateBMR(weightToUse, profile.height, profile.age, profile.sex);
  const maintenanceCalories = Math.round(bmr * getActivityMultiplier(profile.activityLevel));
  
  let calorieAdjustment = getGoalAdjustment(profile.goal);
  if (profile.weeklyWeightChange !== undefined && profile.weeklyWeightChange !== 0) {
    calorieAdjustment = Math.round((profile.weeklyWeightChange * 7700) / 7);
  }
  
  const targetCalories = Math.round(maintenanceCalories + calorieAdjustment);
  
  const proteinGrams = Math.round(weightToUse * 2.2);
  const proteinCalories = proteinGrams * 4;
  
  const remainingCalories = targetCalories - proteinCalories;
  const fatCalories = remainingCalories * 0.3;
  const carbCalories = remainingCalories * 0.7;
  
  return {
    calories: targetCalories,
    protein: proteinGrams,
    carbsMin: Math.round((carbCalories * 0.8) / 4),
    carbsMax: Math.round((carbCalories * 1.2) / 4),
    fatMin: Math.round((fatCalories * 0.8) / 9),
    fatMax: Math.round((fatCalories * 1.2) / 9),
  };
}

export function getTodayKey(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}
