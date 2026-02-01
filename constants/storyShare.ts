import { HealthRating, StickerType, StoryTemplate } from '@/types/storyShare';

export const HEALTH_RATING_CONFIG: Record<HealthRating, { label: string; color: string; bgColor: string }> = {
  sangat_sehat: { label: 'Sangat Sehat', color: '#059669', bgColor: 'rgba(5, 150, 105, 0.2)' },
  sehat: { label: 'Sehat', color: '#10B981', bgColor: 'rgba(16, 185, 129, 0.2)' },
  cukup_sehat: { label: 'Cukup Sehat', color: '#F59E0B', bgColor: 'rgba(245, 158, 11, 0.2)' },
  kurang_sehat: { label: 'Kurang Sehat', color: '#EF4444', bgColor: 'rgba(239, 68, 68, 0.2)' },
};

export const STICKER_CONFIG: Record<StickerType, { label: string; emoji: string }> = {
  high_protein: { label: 'High Protein', emoji: '💪' },
  meal_prep: { label: 'Meal Prep', emoji: '🍱' },
  homemade: { label: 'Homemade', emoji: '🏠' },
  cheat_meal: { label: 'Cheat Meal', emoji: '🍕' },
  post_workout: { label: 'Post Workout', emoji: '🏋️' },
  clean_day: { label: 'Clean Day', emoji: '✨' },
  under_target: { label: 'Under Target', emoji: '🎯' },
  weekend: { label: 'Weekend', emoji: '🌴' },
};

export const TEMPLATE_CONFIG: Record<StoryTemplate, { name: string; description: string }> = {
  minimal: { name: 'Minimal', description: 'Clean & simple' },
  health_hero: { name: 'Health Score', description: 'Show your rating' },
  restaurant: { name: 'Restaurant', description: 'Location focused' },
  weekly_recap: { name: 'Weekly', description: 'Your week summary' },
};

export const MEAL_TIME_LABELS: Record<string, string> = {
  breakfast: 'Sarapan',
  lunch: 'Makan Siang',
  dinner: 'Makan Malam',
  snack: 'Camilan',
};

export const HEALTH_RATING_ORDER: HealthRating[] = ['sangat_sehat', 'sehat', 'cukup_sehat', 'kurang_sehat'];

export const DEFAULT_SHARE_SETTINGS = {
  template: 'minimal' as StoryTemplate,
  showMacros: true,
  showHealthRating: true,
  showLocation: false,
  showTime: true,
  showUserName: false,
  showWatermark: true,
  healthRating: 'sehat' as HealthRating,
  location: null,
  stickers: [],
};
