export interface CommunityProfile {
  userId: string;
  username: string;
  displayName: string;
  avatarColor: string;
  bio?: string;
  joinedAt: number;
}

export interface CommunityGroup {
  id: string;
  name: string;
  description: string;
  coverImage: string;
  inviteCode: string;
  privacy: 'public' | 'private';
  creatorId: string;
  members: GroupMember[];
  createdAt: number;
}

export interface GroupMember {
  userId: string;
  displayName: string;
  username: string;
  avatarColor: string;
  role: 'admin' | 'member';
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
  groupId?: string;
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

export const GROUP_COVERS = [
  'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1505576399279-0d754f0d7a04?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1606787366850-de6330128bfc?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=400&q=80',
];

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
