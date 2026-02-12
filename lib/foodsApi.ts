import { supabase } from './supabase';
import { SupabaseFoodItem, FoodSearchResult, mapSupabaseFoodToSearchResult } from '@/types/food';

export async function searchFoods(
  query: string,
  limit: number = 50
): Promise<FoodSearchResult[]> {
  if (!query.trim()) {
    console.log('[foodsApi] Empty query, returning empty results');
    return [];
  }

  console.log('[foodsApi] Searching foods for:', query, 'limit:', limit);

  try {
    let data, error;
    
    // First try the 'food' table
    const result1 = await supabase
      .from('food')
      .select('*')
      .ilike('name', `%${query}%`)
      .limit(limit);
    
    if (!result1.error && result1.data && result1.data.length > 0) {
      console.log('[foodsApi] Found results in "food" table');
      data = result1.data;
      error = result1.error;
    } else {
      // Try 'foods' table as fallback
      console.log('[foodsApi] Trying "foods" table...');
      const result2 = await supabase
        .from('foods')
        .select('*')
        .ilike('name', `%${query}%`)
        .limit(limit);
      data = result2.data;
      error = result2.error;
    }

    if (error) {
      console.error('[foodsApi] Supabase error:', error.message, error.code, error.details);
      throw new Error(`Failed to search foods: ${error.message}`);
    }

    console.log('[foodsApi] Raw data:', JSON.stringify(data?.[0] || 'no data'));
    console.log('[foodsApi] Found', data?.length ?? 0, 'results');

    // Map the data - handle range columns and legacy single value columns
    const foods = (data || []).map((item: Record<string, unknown>) => {
      // Handle range columns (new format) with fallback to single value columns (legacy)
      const energyMin = item.energy_kcal_min ?? item.calories_min ?? item.energy_kcal ?? item.calories ?? 0;
      const energyMax = item.energy_kcal_max ?? item.calories_max ?? item.energy_kcal ?? item.calories ?? energyMin;
      const proteinMin = item.protein_g_min ?? item.protein_min ?? item.protein_g ?? item.proteins ?? item.protein ?? 0;
      const proteinMax = item.protein_g_max ?? item.protein_max ?? item.protein_g ?? item.proteins ?? item.protein ?? proteinMin;
      const fatMin = item.fat_g_min ?? item.fat_min ?? item.fat_g ?? item.fat ?? 0;
      const fatMax = item.fat_g_max ?? item.fat_max ?? item.fat_g ?? item.fat ?? fatMin;
      const carbMin = item.carb_g_min ?? item.carbs_min ?? item.carb_g ?? item.carbohydrate ?? item.carbs ?? 0;
      const carbMax = item.carb_g_max ?? item.carbs_max ?? item.carb_g ?? item.carbohydrate ?? item.carbs ?? carbMin;
      const servingSizeG = item.serving_size_g ?? item.serving_size ?? null;

      const mapped: SupabaseFoodItem = {
        id: item.id as number,
        name: item.name as string,
        energy_kcal_min: energyMin as number,
        energy_kcal_max: energyMax as number,
        protein_g_min: proteinMin as number,
        protein_g_max: proteinMax as number,
        fat_g_min: fatMin as number,
        fat_g_max: fatMax as number,
        carb_g_min: carbMin as number,
        carb_g_max: carbMax as number,
        serving_size_g: servingSizeG as number | null,
        image: (item.image ?? null) as string | null,
      };
      return mapped;
    });
    
    return foods.map(mapSupabaseFoodToSearchResult);
  } catch (error) {
    console.error('[foodsApi] Search error:', error);
    throw error;
  }
}

export async function getFoodById(id: number): Promise<FoodSearchResult | null> {
  console.log('[foodsApi] Fetching food by id:', id);

  try {
    const { data, error } = await supabase
      .from('foods')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[foodsApi] Supabase error:', error.message);
      return null;
    }

    if (!data) {
      console.log('[foodsApi] No food found with id:', id);
      return null;
    }

    const item = data as Record<string, unknown>;
    const energyMin = item.energy_kcal_min ?? item.energy_kcal ?? 0;
    const energyMax = item.energy_kcal_max ?? item.energy_kcal ?? energyMin;
    const proteinMin = item.protein_g_min ?? item.protein_g ?? 0;
    const proteinMax = item.protein_g_max ?? item.protein_g ?? proteinMin;
    const fatMin = item.fat_g_min ?? item.fat_g ?? 0;
    const fatMax = item.fat_g_max ?? item.fat_g ?? fatMin;
    const carbMin = item.carb_g_min ?? item.carb_g ?? 0;
    const carbMax = item.carb_g_max ?? item.carb_g ?? carbMin;
    const servingSizeG = item.serving_size_g ?? item.serving_size ?? null;

    const mapped: SupabaseFoodItem = {
      id: item.id as number,
      name: item.name as string,
      energy_kcal_min: energyMin as number,
      energy_kcal_max: energyMax as number,
      protein_g_min: proteinMin as number,
      protein_g_max: proteinMax as number,
      fat_g_min: fatMin as number,
      fat_g_max: fatMax as number,
      carb_g_min: carbMin as number,
      carb_g_max: carbMax as number,
      serving_size_g: servingSizeG as number | null,
      image: (item.image ?? null) as string | null,
    };

    return mapSupabaseFoodToSearchResult(mapped);
  } catch (error) {
    console.error('[foodsApi] getFoodById error:', error);
    return null;
  }
}
