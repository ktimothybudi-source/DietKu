import { StoryTemplate, TemplateId } from '@/types/storyShare';

export const STORY_TEMPLATES: StoryTemplate[] = [
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean and simple',
    gradientColors: ['rgba(0,0,0,0.3)', 'transparent', 'rgba(0,0,0,0.7)'],
    accentColor: '#FFFFFF',
  },
  {
    id: 'health_focus',
    name: 'Health Focus',
    description: 'Emphasize nutrition',
    gradientColors: ['rgba(108,99,255,0.3)', 'transparent', 'rgba(0,0,0,0.8)'],
    accentColor: '#6C63FF',
  },
  {
    id: 'restaurant',
    name: 'Restaurant',
    description: 'Foodie vibes',
    gradientColors: ['rgba(245,158,11,0.2)', 'transparent', 'rgba(0,0,0,0.85)'],
    accentColor: '#F59E0B',
  },
  {
    id: 'weekly',
    name: 'Weekly',
    description: 'Progress tracking',
    gradientColors: ['rgba(99,102,241,0.3)', 'transparent', 'rgba(0,0,0,0.8)'],
    accentColor: '#6366F1',
  },
];

export const LOCATION_PRESETS = [
  { id: 'homemade', name: 'Homemade', icon: '🏠' },
  { id: 'restaurant', name: 'Restaurant', icon: '🍽️' },
  { id: 'cafe', name: 'Cafe', icon: '☕' },
  { id: 'office', name: 'Office', icon: '🏢' },
  { id: 'gym', name: 'Gym', icon: '💪' },
];

export const getTemplateById = (id: TemplateId): StoryTemplate => {
  return STORY_TEMPLATES.find(t => t.id === id) || STORY_TEMPLATES[0];
};
