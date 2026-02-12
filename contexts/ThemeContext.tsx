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
  background: '#F6F5F0',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textSecondary: '#5C5C5C',
  textTertiary: '#9A9A9A',
  border: '#E4E2DB',
  primary: '#1B4332',
  primaryMuted: '#2D6A4F',
  accent: '#3A7D5C',
  tabBar: '#FFFFFF',
  tabBarInactive: '#9A9A9A',
  surfaceElevated: '#F0EEE8',
  destructive: '#C53030',
  success: '#276749',
  warning: '#B7791F',
};

const darkTheme: Theme = {
  background: '#0D0D0D',
  card: '#171717',
  text: '#F5F5F3',
  textSecondary: '#A0A0A0',
  textTertiary: '#666666',
  border: '#262626',
  primary: '#4ADE80',
  primaryMuted: '#22C55E',
  accent: '#86EFAC',
  tabBar: '#0D0D0D',
  tabBarInactive: '#666666',
  surfaceElevated: '#1F1F1F',
  destructive: '#FC8181',
  success: '#68D391',
  warning: '#F6E05E',
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
