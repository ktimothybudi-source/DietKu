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
