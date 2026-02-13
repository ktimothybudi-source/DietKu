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
  background: '#FFFFFF',
  card: '#FFFFFF',
  text: '#1A1A2E',
  textSecondary: '#6E6E82',
  textTertiary: '#AEAEB8',
  border: '#EEEDF2',
  primary: '#6C63FF',
  primaryMuted: '#8B85FF',
  accent: '#6C63FF',
  tabBar: '#FFFFFF',
  tabBarInactive: '#AEAEB8',
  surfaceElevated: '#F5F5F7',
  destructive: '#E5544B',
  success: '#4CAF7D',
  warning: '#E5A84B',
};

const darkTheme: Theme = {
  background: '#0F0F18',
  card: '#1A1A28',
  text: '#F2F2F8',
  textSecondary: '#9898B0',
  textTertiary: '#5E5E78',
  border: '#2A2A3C',
  primary: '#8B85FF',
  primaryMuted: '#6C63FF',
  accent: '#A9A4FF',
  tabBar: '#0F0F18',
  tabBarInactive: '#5E5E78',
  surfaceElevated: '#22223A',
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
