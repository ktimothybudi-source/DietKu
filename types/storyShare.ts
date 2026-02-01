export type HealthRating = 'sangat_sehat' | 'sehat' | 'cukup_sehat' | 'kurang_sehat';

export type MealTime = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type StickerCategory = 'macros' | 'health' | 'labels' | 'location';

export type StickerType = 
  | 'protein'
  | 'carbs'
  | 'fat'
  | 'sangat_sehat'
  | 'sehat'
  | 'cukup_sehat'
  | 'kurang_sehat'
  | 'high_protein'
  | 'homemade'
  | 'cheat_meal'
  | 'clean_day'
  | 'post_workout'
  | 'add_location';

export interface CanvasElement {
  id: string;
  type: 'text' | 'sticker' | 'meal_name' | 'calories' | 'watermark';
  x: number;
  y: number;
  scale: number;
  rotation: number;
  style: 'filled' | 'outline' | 'blur';
  content?: string;
  stickerType?: StickerType;
  fontStyle?: 'default' | 'bold' | 'light';
  color?: string;
}

export interface StoryShareData {
  mealName: string;
  mealSubtitle?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  photoUri?: string;
  timestamp: number;
}

export interface TextStyle {
  id: string;
  name: string;
  fontWeight: 'normal' | 'bold' | '300';
}

export interface ColorOption {
  id: string;
  color: string;
  name: string;
}
