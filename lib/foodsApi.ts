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
    // Try 'food' table first (singular), fallback to 'foods' (plural)
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

    // Map the data - handle different column name formats
    const foods = (data || []).map((item: Record<string, unknown>) => {
      const mapped: SupabaseFoodItem = {
        id: item.id as number,
        name: item.name as string,
        energy_kcal: (item.energy_kcal ?? item.calories ?? 0) as number,
        protein_g: (item.protein_g ?? item.proteins ?? item.protein ?? 0) as number,
        fat_g: (item.fat_g ?? item.fat ?? 0) as number,
        carb_g: (item.carb_g ?? item.carbohydrate ?? item.carbs ?? 0) as number,
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
      .select('id, name, energy_kcal, protein_g, fat_g, carb_g, image')
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

    return mapSupabaseFoodToSearchResult(data as SupabaseFoodItem);
  } catch (error) {
    console.error('[foodsApi] getFoodById error:', error);
    return null;
  }
}
