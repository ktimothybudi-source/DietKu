import { StickerCategory, StickerType, TextStyle, ColorOption } from '@/types/storyShare';

export const STICKER_CATEGORIES: { id: StickerCategory; name: string; stickers: StickerType[] }[] = [
  {
    id: 'macros',
    name: 'Macros',
    stickers: ['protein', 'carbs', 'fat'],
  },
  {
    id: 'health',
    name: 'Health',
    stickers: ['sangat_sehat', 'sehat', 'cukup_sehat', 'kurang_sehat'],
  },
  {
    id: 'labels',
    name: 'Labels',
    stickers: ['high_protein', 'homemade', 'cheat_meal', 'clean_day', 'post_workout'],
  },
  {
    id: 'location',
    name: 'Location',
    stickers: ['add_location'],
  },
];

export const STICKER_CONFIG: Record<StickerType, { label: string; icon: string; color: string; bgColor: string }> = {
  protein: { label: 'Protein', icon: '💪', color: '#EF4444', bgColor: 'rgba(239, 68, 68, 0.2)' },
  carbs: { label: 'Carbs', icon: '🍞', color: '#F59E0B', bgColor: 'rgba(245, 158, 11, 0.2)' },
  fat: { label: 'Fat', icon: '🥑', color: '#8B5CF6', bgColor: 'rgba(139, 92, 246, 0.2)' },
  sangat_sehat: { label: 'Sangat Sehat', icon: '💚', color: '#059669', bgColor: 'rgba(5, 150, 105, 0.2)' },
  sehat: { label: 'Sehat', icon: '✅', color: '#10B981', bgColor: 'rgba(16, 185, 129, 0.2)' },
  cukup_sehat: { label: 'Cukup Sehat', icon: '⚠️', color: '#F59E0B', bgColor: 'rgba(245, 158, 11, 0.2)' },
  kurang_sehat: { label: 'Kurang Sehat', icon: '❌', color: '#EF4444', bgColor: 'rgba(239, 68, 68, 0.2)' },
  high_protein: { label: 'High Protein', icon: '💪', color: '#10B981', bgColor: 'rgba(16, 185, 129, 0.2)' },
  homemade: { label: 'Homemade', icon: '🏠', color: '#F59E0B', bgColor: 'rgba(245, 158, 11, 0.2)' },
  cheat_meal: { label: 'Cheat Meal', icon: '🍕', color: '#EF4444', bgColor: 'rgba(239, 68, 68, 0.2)' },
  clean_day: { label: 'Clean Day', icon: '✨', color: '#10B981', bgColor: 'rgba(16, 185, 129, 0.2)' },
  post_workout: { label: 'Post Workout', icon: '🏋️', color: '#3B82F6', bgColor: 'rgba(59, 130, 246, 0.2)' },
  add_location: { label: 'Add Location', icon: '📍', color: '#EC4899', bgColor: 'rgba(236, 72, 153, 0.2)' },
};

export const TEXT_STYLES: TextStyle[] = [
  { id: 'default', name: 'Regular', fontWeight: 'normal' },
  { id: 'bold', name: 'Bold', fontWeight: 'bold' },
  { id: 'light', name: 'Light', fontWeight: '300' },
];

export const COLOR_OPTIONS: ColorOption[] = [
  { id: 'white', color: '#FFFFFF', name: 'White' },
  { id: 'green', color: '#10B981', name: 'Green' },
  { id: 'gray', color: '#9CA3AF', name: 'Gray' },
];

export const CANVAS_WIDTH = 1080;
export const CANVAS_HEIGHT = 1920;
