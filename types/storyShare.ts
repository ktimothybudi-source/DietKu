export type HealthRating = 'sangat_sehat' | 'sehat' | 'cukup_sehat' | 'kurang_sehat';

export type TemplateId = 'minimal' | 'health_focus' | 'restaurant' | 'weekly';

export interface StoryTemplate {
  id: TemplateId;
  name: string;
  description: string;
  gradientColors: string[];
  accentColor: string;
}

export interface IncludeOptions {
  macros: boolean;
  healthRating: boolean;
  location: boolean;
  time: boolean;
  name: boolean;
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

export interface LocationData {
  type: 'current' | 'search' | 'custom';
  name: string;
}

export const HEALTH_RATINGS: { id: HealthRating; label: string; icon: string; color: string }[] = [
  { id: 'sangat_sehat', label: 'Sangat Sehat', icon: '💚', color: '#059669' },
  { id: 'sehat', label: 'Sehat', icon: '✅', color: '#6C63FF' },
  { id: 'cukup_sehat', label: 'Cukup Sehat', icon: '⚠️', color: '#F59E0B' },
  { id: 'kurang_sehat', label: 'Kurang Sehat', icon: '❌', color: '#EF4444' },
];
