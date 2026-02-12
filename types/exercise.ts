export interface ExerciseEntry {
  id: string;
  type: ExerciseType;
  name: string;
  caloriesBurned: number;
  duration?: number;
  description?: string;
  timestamp: number;
  date: string;
}

export type ExerciseType = 'run' | 'weight_lifting' | 'swim' | 'cycling' | 'walk' | 'yoga' | 'hiit' | 'describe' | 'manual';

export interface QuickExercise {
  type: ExerciseType;
  label: string;
  emoji: string;
  caloriesPerMinute: number;
}

export const QUICK_EXERCISES: QuickExercise[] = [
  { type: 'run', label: 'Lari', emoji: '🏃', caloriesPerMinute: 10 },
  { type: 'weight_lifting', label: 'Angkat Beban', emoji: '🏋️', caloriesPerMinute: 7 },
  { type: 'swim', label: 'Renang', emoji: '🏊', caloriesPerMinute: 9 },
  { type: 'cycling', label: 'Bersepeda', emoji: '🚴', caloriesPerMinute: 8 },
  { type: 'walk', label: 'Jalan Kaki', emoji: '🚶', caloriesPerMinute: 4 },
  { type: 'yoga', label: 'Yoga', emoji: '🧘', caloriesPerMinute: 4 },
  { type: 'hiit', label: 'HIIT', emoji: '⚡', caloriesPerMinute: 12 },
];

export interface StepsData {
  [date: string]: number;
}
