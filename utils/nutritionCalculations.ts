import { UserProfile, DailyTargets, ActivityLevel, Sex } from '@/types/nutrition';

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
      return 1.55;
    case 'high':
      return 1.725;
  }
}

export function calculateTDEE(weight: number, height: number, age: number, sex: Sex, activityLevel: ActivityLevel): number {
  const bmr = calculateBMR(weight, height, age, sex);
  return Math.round(bmr * getActivityMultiplier(activityLevel));
}

export function calculateCalorieAdjustment(profile: UserProfile): number {
  const { weight, goalWeight, goal, weeklyWeightChange } = profile;
  
  if (weeklyWeightChange !== undefined && weeklyWeightChange !== 0) {
    const caloriesPerKg = 7700;
    const dailyAdjustment = (weeklyWeightChange * caloriesPerKg) / 7;
    
    if (goal === 'fat_loss') {
      return -Math.abs(Math.round(dailyAdjustment));
    } else if (goal === 'muscle_gain') {
      return Math.abs(Math.round(dailyAdjustment));
    }
    return 0;
  }
  
  if (goalWeight && goalWeight !== weight) {
    if (goal === 'fat_loss' || goalWeight < weight) {
      return -500;
    } else if (goal === 'muscle_gain' || goalWeight > weight) {
      return 300;
    }
  }
  
  switch (goal) {
    case 'fat_loss':
      return -500;
    case 'muscle_gain':
      return 300;
    case 'maintenance':
    default:
      return 0;
  }
}

export function calculateDailyTargets(profile: UserProfile): DailyTargets {
  const { weight, height, age, sex, activityLevel } = profile;
  
  const tdee = calculateTDEE(weight, height, age, sex, activityLevel);
  const calorieAdjustment = calculateCalorieAdjustment(profile);
  const targetCalories = Math.max(1200, tdee + calorieAdjustment);
  
  console.log('Calorie calculation:', {
    weight,
    height,
    age,
    sex,
    activityLevel,
    bmr: calculateBMR(weight, height, age, sex),
    tdee,
    calorieAdjustment,
    targetCalories,
    goal: profile.goal,
    weeklyWeightChange: profile.weeklyWeightChange,
  });
  
  const proteinGrams = Math.round(weight * 2);
  const proteinCalories = proteinGrams * 4;
  
  const fatPercentage = 0.25;
  const fatCalories = targetCalories * fatPercentage;
  const fatGrams = Math.round(fatCalories / 9);
  
  const remainingCalories = targetCalories - proteinCalories - fatCalories;
  const carbGrams = Math.round(remainingCalories / 4);
  
  const fatMin = Math.round(fatGrams * 0.85);
  const fatMax = Math.round(fatGrams * 1.15);
  const carbsMin = Math.round(carbGrams * 0.85);
  const carbsMax = Math.round(carbGrams * 1.15);
  
  return {
    calories: targetCalories,
    protein: proteinGrams,
    carbsMin,
    carbsMax,
    fatMin,
    fatMax,
  };
}

export function getTodayKey(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

export function calculateWeeksToGoal(currentWeight: number, goalWeight: number, weeklyChange: number): number {
  if (weeklyChange === 0 || currentWeight === goalWeight) return 0;
  const weightDiff = Math.abs(goalWeight - currentWeight);
  return Math.ceil(weightDiff / Math.abs(weeklyChange));
}

export function getProjectedGoalDate(currentWeight: number, goalWeight: number, weeklyChange: number): Date | null {
  if (weeklyChange === 0 || currentWeight === goalWeight) return null;
  const weeks = calculateWeeksToGoal(currentWeight, goalWeight, weeklyChange);
  const projectedDate = new Date();
  projectedDate.setDate(projectedDate.getDate() + weeks * 7);
  return projectedDate;
}
