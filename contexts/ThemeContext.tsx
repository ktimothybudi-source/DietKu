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
  tabBar: string;
  tabBarInactive: string;
}

const lightTheme: Theme = {
  background: '#FFFFFF',
  card: '#F5F5F5',
  text: '#000000',
  textSecondary: '#666666',
  textTertiary: '#999999',
  border: '#E5E5E5',
  primary: '#10B981',
  tabBar: '#FFFFFF',
  tabBarInactive: '#999999',
};

const darkTheme: Theme = {
  background: '#0A0A0A',
  card: '#111111',
  text: '#FFFFFF',
  textSecondary: '#888888',
  textTertiary: '#666666',
  border: '#1F1F1F',
  primary: '#10B981',
  tabBar: '#0A0A0A',
  tabBarInactive: '#666666',
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
