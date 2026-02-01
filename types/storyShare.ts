export type HealthRating = 'sangat_sehat' | 'sehat' | 'cukup_sehat' | 'kurang_sehat';

export type StoryTemplate = 'minimal' | 'health_hero' | 'restaurant' | 'weekly_recap';

export type MealTime = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface StorySticker {
  id: string;
  type: StickerType;
  x: number;
  y: number;
  scale: number;
  style: 'filled' | 'outline' | 'blurred';
}

export type StickerType = 
  | 'high_protein'
  | 'meal_prep'
  | 'homemade'
  | 'cheat_meal'
  | 'post_workout'
  | 'clean_day'
  | 'under_target'
  | 'weekend';

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

export interface StoryShareSettings {
  template: StoryTemplate;
  showMacros: boolean;
  showHealthRating: boolean;
  showLocation: boolean;
  showTime: boolean;
  showUserName: boolean;
  showWatermark: boolean;
  healthRating: HealthRating;
  location: string | null;
  stickers: StorySticker[];
}

export interface WeeklyRecapData {
  avgCalories: number;
  avgProtein: number;
  totalMeals: number;
  streakDays: number;
  bestDay: string;
}
