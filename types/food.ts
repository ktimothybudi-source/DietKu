export interface SupabaseFoodItem {
  id: number;
  name: string;
  energy_kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carb_g: number | null;
  image: string | null;
}

export interface FoodSearchResult {
  id: number;
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  image: string | null;
}

export interface MealTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function mapSupabaseFoodToSearchResult(food: SupabaseFoodItem): FoodSearchResult {
  return {
    id: food.id,
    name: food.name,
    calories: food.energy_kcal ?? 0,
    protein: food.protein_g ?? 0,
    fat: food.fat_g ?? 0,
    carbs: food.carb_g ?? 0,
    image: food.image,
  };
}

export function addFoodToTotals(
  currentTotals: MealTotals,
  food: FoodSearchResult
): MealTotals {
  return {
    calories: currentTotals.calories + food.calories,
    protein: currentTotals.protein + food.protein,
    carbs: currentTotals.carbs + food.carbs,
    fat: currentTotals.fat + food.fat,
  };
}

export function createEmptyTotals(): MealTotals {
  return { calories: 0, protein: 0, carbs: 0, fat: 0 };
}
