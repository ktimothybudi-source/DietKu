import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useState, useEffect } from 'react';

const THEME_KEY = 'app_theme';

export type ThemeMode = 'light' | 'dark';

export interface Theme {
  background: string;
  card: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  primary: string;
  primaryMuted: string;
  accent: string;
  tabBar: string;
  tabBarInactive: string;
  surfaceElevated: string;
  destructive: string;
  success: string;
  warning: string;
}

const lightTheme: Theme = {
  background: '#F4FBF6',
  card: '#FFFFFF',
  text: '#1A1A2E',
  textSecondary: '#5F7467',
  textTertiary: '#98A89D',
  border: '#DDEDE2',
  primary: '#22C55E',
  primaryMuted: '#4ADE80',
  accent: '#16A34A',
  tabBar: '#F4FBF6',
  tabBarInactive: '#98A89D',
  surfaceElevated: '#ECF7EF',
  destructive: '#E5544B',
  success: '#4CAF7D',
  warning: '#E5A84B',
};

const darkTheme: Theme = {
  background: '#0A0A0A',
  card: '#141414',
  text: '#F2F2F2',
  textSecondary: '#A3A3A3',
  textTertiary: '#6B6B6B',
  border: '#262626',
  primary: '#22C55E',
  primaryMuted: '#4ADE80',
  accent: '#34D399',
  tabBar: '#0A0A0A',
  tabBarInactive: '#6B6B6B',
  surfaceElevated: '#1A1A1A',
  destructive: '#FF7B73',
  success: '#6DD8A0',
  warning: '#FFD06B',
};

export const [ThemeProvider, useTheme] = createContextHook(() => {
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');

  const themeQuery = useQuery({
    queryKey: ['app_theme'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(THEME_KEY);
      return (stored as ThemeMode) || 'light';
    },
  });

  const saveThemeMutation = useMutation({
    mutationFn: async (mode: ThemeMode) => {
      await AsyncStorage.setItem(THEME_KEY, mode);
      return mode;
    },
    onSuccess: (data) => {
      setThemeMode(data);
    },
  });

  useEffect(() => {
    if (themeQuery.data !== undefined) {
      setThemeMode(themeQuery.data);
    }
  }, [themeQuery.data]);

  const toggleTheme = () => {
    const newMode = themeMode === 'light' ? 'dark' : 'light';
    saveThemeMutation.mutate(newMode);
  };

  const theme = themeMode === 'light' ? lightTheme : darkTheme;

  return {
    themeMode,
    theme,
    toggleTheme,
    isLoading: themeQuery.isLoading,
  };
});
