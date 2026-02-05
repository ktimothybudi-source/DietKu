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
    const { data, error } = await supabase
      .from('foods')
      .select('id, name, energy_kcal, protein_g, fat_g, carb_g, image')
      .ilike('name', `%${query}%`)
      .limit(limit);

    if (error) {
      console.error('[foodsApi] Supabase error:', error.message, error.code);
      throw new Error(`Failed to search foods: ${error.message}`);
    }

    console.log('[foodsApi] Found', data?.length ?? 0, 'results');

    const foods = (data || []) as SupabaseFoodItem[];
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
