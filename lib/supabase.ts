import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export interface SupabaseProfile {
  id: string;
  email: string | null;
  name: string | null;
  gender: string | null;
  birth_date: string | null;
  height: number | null;
  weight: number | null;
  target_weight: number | null;
  activity_level: string | null;
  goal: string | null;
  daily_calories: number | null;
  protein_target: number | null;
  carbs_target: number | null;
  fat_target: number | null;
  created_at: string;
  updated_at: string;
}

export interface SupabaseFoodEntry {
  id: string;
  user_id: string;
  date: string;
  meal_type: string | null;
  food_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  photo_uri: string | null;
  created_at: string;
}

export interface SupabaseWeightHistory {
  id: string;
  user_id: string;
  weight: number;
  recorded_at: string;
}

export interface SupabaseFood {
  id: number;
  name: string;
  calories: number;
  proteins: number;
  fat: number;
  carbohydrate: number;
  image: string | null;
}

export async function searchSupabaseFoods(query: string, limit: number = 25): Promise<SupabaseFood[]> {
  if (!query.trim()) {
    return [];
  }

  try {
    console.log('Searching Supabase food database for:', query);
    
    const { data, error } = await supabase
      .from('food')
      .select('*')
      .ilike('name', `%${query}%`)
      .limit(limit);
    
    if (error) {
      console.error('Supabase food search error:', error);
      return [];
    }
    
    console.log('Supabase food results:', data?.length || 0);
    return (data || []) as SupabaseFood[];
  } catch (error) {
    console.error('Error searching Supabase foods:', error);
    return [];
  }
}
