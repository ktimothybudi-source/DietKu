export const DEFAULT_SERVING_SIZE_G = 100;

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
  energy_kcal?: number | null;
  protein_g?: number | null;
  fat_g?: number | null;
  carb_g?: number | null;
  serving_size_g?: number | null;
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
  servingSizeG: number;
  image: string | null;
}

export interface MealTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

function convertPer100gToServing(valuePer100g: number, servingSizeG: number): number {
  return Math.round((valuePer100g * servingSizeG) / 100);
}

export function mapSupabaseFoodToSearchResult(food: SupabaseFoodItem): FoodSearchResult {
  const servingSizeG = food.serving_size_g ?? DEFAULT_SERVING_SIZE_G;

  const caloriesMinRaw = food.energy_kcal_min ?? food.energy_kcal ?? 0;
  const caloriesMaxRaw = food.energy_kcal_max ?? food.energy_kcal ?? caloriesMinRaw;
  const proteinMinRaw = food.protein_g_min ?? food.protein_g ?? 0;
  const proteinMaxRaw = food.protein_g_max ?? food.protein_g ?? proteinMinRaw;
  const fatMinRaw = food.fat_g_min ?? food.fat_g ?? 0;
  const fatMaxRaw = food.fat_g_max ?? food.fat_g ?? fatMinRaw;
  const carbsMinRaw = food.carb_g_min ?? food.carb_g ?? 0;
  const carbsMaxRaw = food.carb_g_max ?? food.carb_g ?? carbsMinRaw;

  return {
    id: food.id,
    name: food.name,
    caloriesMin: convertPer100gToServing(caloriesMinRaw, servingSizeG),
    caloriesMax: convertPer100gToServing(caloriesMaxRaw, servingSizeG),
    proteinMin: convertPer100gToServing(proteinMinRaw, servingSizeG),
    proteinMax: convertPer100gToServing(proteinMaxRaw, servingSizeG),
    fatMin: convertPer100gToServing(fatMinRaw, servingSizeG),
    fatMax: convertPer100gToServing(fatMaxRaw, servingSizeG),
    carbsMin: convertPer100gToServing(carbsMinRaw, servingSizeG),
    carbsMax: convertPer100gToServing(carbsMaxRaw, servingSizeG),
    servingSizeG,
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
