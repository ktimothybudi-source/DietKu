import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const NOTIFICATION_STORAGE_KEY = '@notification_settings';
const MEAL_REMINDER_ID = 'daily-meal-reminder';
const STREAK_REMINDER_ID = 'daily-streak-reminder';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface NotificationSettings {
  enabled: boolean;
  permissionGranted: boolean;
  mealReminderTime: { hour: number; minute: number };
  streakReminderTime: { hour: number; minute: number };
}

interface NotificationContextType {
  settings: NotificationSettings;
  requestPermission: () => Promise<boolean>;
  enableNotifications: () => Promise<void>;
  disableNotifications: () => Promise<void>;
  scheduleNotifications: () => Promise<void>;
  cancelAllNotifications: () => Promise<void>;
  isLoading: boolean;
}

const defaultSettings: NotificationSettings = {
  enabled: false,
  permissionGranted: false,
  mealReminderTime: { hour: 19, minute: 0 },
  streakReminderTime: { hour: 20, minute: 0 },
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
    checkPermissionStatus();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(NOTIFICATION_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings((prev) => ({ ...prev, ...parsed }));
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async (newSettings: NotificationSettings) => {
    try {
      await AsyncStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Failed to save notification settings:', error);
    }
  };

  const checkPermissionStatus = async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      const granted = status === 'granted';
      setSettings((prev) => ({ ...prev, permissionGranted: granted }));
    } catch (error) {
      console.error('Failed to check permission status:', error);
    }
  };

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'web') {
        return false;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      const granted = finalStatus === 'granted';
      
      const newSettings = { ...settings, permissionGranted: granted };
      await saveSettings(newSettings);

      return granted;
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return false;
    }
  }, [settings]);

  const scheduleNotifications = useCallback(async () => {
    try {
      if (Platform.OS === 'web') {
        return;
      }

      await Notifications.cancelAllScheduledNotificationsAsync();

      await Notifications.scheduleNotificationAsync({
        identifier: MEAL_REMINDER_ID,
        content: {
          title: 'Jangan lupa log makanan hari ini 🔥',
          body: 'Tetap konsisten dengan tracking makananmu!',
          sound: true,
        },
        trigger: {
          hour: settings.mealReminderTime.hour,
          minute: settings.mealReminderTime.minute,
          repeats: true,
        } as any,
      });

      await Notifications.scheduleNotificationAsync({
        identifier: STREAK_REMINDER_ID,
        content: {
          title: 'Streak kamu masih aman 💪',
          body: 'Yuk, log makananmu sebelum hari berakhir!',
          sound: true,
        },
        trigger: {
          hour: settings.streakReminderTime.hour,
          minute: settings.streakReminderTime.minute,
          repeats: true,
        } as any,
      });

      console.log('Notifications scheduled successfully');
    } catch (error) {
      console.error('Failed to schedule notifications:', error);
    }
  }, [settings.mealReminderTime, settings.streakReminderTime]);

  const cancelAllNotifications = useCallback(async () => {
    try {
      if (Platform.OS === 'web') {
        return;
      }

      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('All notifications cancelled');
    } catch (error) {
      console.error('Failed to cancel notifications:', error);
    }
  }, []);

  const enableNotifications = useCallback(async () => {
    try {
      const granted = await requestPermission();
      
      if (granted) {
        const newSettings = { ...settings, enabled: true, permissionGranted: true };
        await saveSettings(newSettings);
        await scheduleNotifications();
      }
    } catch (error) {
      console.error('Failed to enable notifications:', error);
    }
  }, [settings, requestPermission, scheduleNotifications]);

  const disableNotifications = useCallback(async () => {
    try {
      await cancelAllNotifications();
      const newSettings = { ...settings, enabled: false };
      await saveSettings(newSettings);
    } catch (error) {
      console.error('Failed to disable notifications:', error);
    }
  }, [settings, cancelAllNotifications]);

  return (
    <NotificationContext.Provider
      value={{
        settings,
        requestPermission,
        enableNotifications,
        disableNotifications,
        scheduleNotifications,
        cancelAllNotifications,
        isLoading,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
