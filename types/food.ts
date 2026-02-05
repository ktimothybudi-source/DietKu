export interface SupabaseFoodItem {
  id: number;
  name: string;
  energy_kcal_min: number | null;
  energy_kcal_max: number | null;
  protein_g_min: number | null;
  protein_g_max: number | null;
  fat_g_min: number | null;
  fat_g_max: number | null;
  carb_g_min: number | null;
  carb_g_max: number | null;
  // Legacy single value columns (fallback)
  energy_kcal?: number | null;
  protein_g?: number | null;
  fat_g?: number | null;
  carb_g?: number | null;
  image: string | null;
}

export interface FoodSearchResult {
  id: number;
  name: string;
  caloriesMin: number;
  caloriesMax: number;
  proteinMin: number;
  proteinMax: number;
  fatMin: number;
  fatMax: number;
  carbsMin: number;
  carbsMax: number;
  image: string | null;
}

export interface MealTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function mapSupabaseFoodToSearchResult(food: SupabaseFoodItem): FoodSearchResult {
  // Handle both range columns and legacy single value columns
  const caloriesMin = food.energy_kcal_min ?? food.energy_kcal ?? 0;
  const caloriesMax = food.energy_kcal_max ?? food.energy_kcal ?? caloriesMin;
  const proteinMin = food.protein_g_min ?? food.protein_g ?? 0;
  const proteinMax = food.protein_g_max ?? food.protein_g ?? proteinMin;
  const fatMin = food.fat_g_min ?? food.fat_g ?? 0;
  const fatMax = food.fat_g_max ?? food.fat_g ?? fatMin;
  const carbsMin = food.carb_g_min ?? food.carb_g ?? 0;
  const carbsMax = food.carb_g_max ?? food.carb_g ?? carbsMin;

  return {
    id: food.id,
    name: food.name,
    caloriesMin,
    caloriesMax,
    proteinMin,
    proteinMax,
    fatMin,
    fatMax,
    carbsMin,
    carbsMax,
    image: food.image,
  };
}

export function formatNutrientRange(min: number, max: number, unit: string = ''): string {
  if (min === max) {
    return `${min}${unit}`;
  }
  return `${min}-${max}${unit}`;
}

export function getAverageFromRange(min: number, max: number): number {
  return Math.round((min + max) / 2);
}

export function addFoodToTotals(
  currentTotals: MealTotals,
  food: FoodSearchResult
): MealTotals {
  // Use average values when adding to totals
  return {
    calories: currentTotals.calories + getAverageFromRange(food.caloriesMin, food.caloriesMax),
    protein: currentTotals.protein + getAverageFromRange(food.proteinMin, food.proteinMax),
    carbs: currentTotals.carbs + getAverageFromRange(food.carbsMin, food.carbsMax),
    fat: currentTotals.fat + getAverageFromRange(food.fatMin, food.fatMax),
  };
}

export function createEmptyTotals(): MealTotals {
  return { calories: 0, protein: 0, carbs: 0, fat: 0 };
}
