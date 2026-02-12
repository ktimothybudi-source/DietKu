export type Goal = 'fat_loss' | 'maintenance' | 'muscle_gain';
export type ActivityLevel = 'low' | 'moderate' | 'high';
export type Sex = 'male' | 'female';

export interface UserProfile {
  name?: string;
  age: number;
  sex: Sex;
  height: number;
  weight: number;
  goalWeight: number;
  goal: Goal;
  activityLevel: ActivityLevel;
  weeklyWeightChange?: number;
}

export interface FoodEntry {
  id: string;
  timestamp: number;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  photoUri?: string;
}

export interface DailyTargets {
  calories: number;
  protein: number;
  carbsMin: number;
  carbsMax: number;
  fatMin: number;
  fatMax: number;
}

export interface FoodItemEstimate {
  name: string;
  portion: string;
  caloriesMin: number;
  caloriesMax: number;
  proteinMin: number;
  proteinMax: number;
  carbsMin: number;
  carbsMax: number;
  fatMin: number;
  fatMax: number;
  sugarMin?: number;
  sugarMax?: number;
  fiberMin?: number;
  fiberMax?: number;
  sodiumMin?: number;
  sodiumMax?: number;
}

export interface MealAnalysis {
  items: FoodItemEstimate[];
  totalCaloriesMin: number;
  totalCaloriesMax: number;
  totalProteinMin: number;
  totalProteinMax: number;
  confidence: 'high' | 'medium' | 'low';
  tips?: string[];
}

export interface FavoriteMeal {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  createdAt: number;
  logCount: number;
}

export interface RecentMeal {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  lastLogged: number;
  logCount: number;
}
