export interface CommunityProfile {
  userId: string;
  username: string;
  displayName: string;
  avatarColor: string;
  bio?: string;
  joinedAt: number;
}

export interface FoodPost {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatarColor: string;
  caption: string;
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  photoUri?: string;
  likes: string[];
  commentCount: number;
  createdAt: number;
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}

export interface PostComment {
  id: string;
  postId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarColor: string;
  text: string;
  createdAt: number;
}

export const AVATAR_COLORS = [
  '#6C63FF',
  '#8B85FF',
  '#5B5FC7',
  '#264653',
  '#2A9D8F',
  '#E76F51',
  '#F4A261',
  '#E9C46A',
  '#6D597A',
  '#B56576',
  '#355070',
  '#E56B6F',
];

export const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: 'Sarapan',
  lunch: 'Makan Siang',
  dinner: 'Makan Malam',
  snack: 'Camilan',
};
