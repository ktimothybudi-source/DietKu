import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import {
  DAILY_REMINDER_SLOTS,
  pickDailyReminderMessage,
} from '@/constants/notificationMessages';

const NOTIFICATION_STORAGE_KEY = '@notification_settings';
const ANDROID_CHANNEL_ID = 'dietku-reminders';

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
  /** Community “teman baru scan makanan” push alerts */
  communityAlertsEnabled: boolean;
}

interface NotificationContextType {
  settings: NotificationSettings;
  requestPermission: () => Promise<boolean>;
  enableNotifications: () => Promise<void>;
  disableNotifications: () => Promise<void>;
  setCommunityAlertsEnabled: (enabled: boolean) => Promise<void>;
  scheduleNotifications: () => Promise<void>;
  cancelAllNotifications: () => Promise<void>;
  /** Persist Expo push token for the signed-in user (call when auth is ready). */
  syncPushTokenForUser: (userId: string | null) => Promise<void>;
  isLoading: boolean;
}

const defaultSettings: NotificationSettings = {
  enabled: false,
  permissionGranted: false,
  communityAlertsEnabled: true,
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

function getEasProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ||
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId
  );
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Pengingat DietKu',
    description: 'Pengingat scan makanan dan update grup',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#2D6A4F',
    sound: 'default',
  });
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const saveSettings = useCallback(async (newSettings: NotificationSettings) => {
    try {
      await AsyncStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Failed to save notification settings:', error);
    }
  }, []);

  const cancelAllNotifications = useCallback(async () => {
    try {
      if (Platform.OS === 'web') return;
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Failed to cancel notifications:', error);
    }
  }, []);

  const scheduleNotifications = useCallback(async () => {
    try {
      if (Platform.OS === 'web') return;
      if (!settingsRef.current.enabled || !settingsRef.current.permissionGranted) return;

      await ensureAndroidChannel();
      await Notifications.cancelAllScheduledNotificationsAsync();

      const now = new Date();
      for (const slot of DAILY_REMINDER_SLOTS) {
        const copy = pickDailyReminderMessage(slot.pool, slot.id, now);
        await Notifications.scheduleNotificationAsync({
          identifier: slot.id,
          content: {
            title: copy.title,
            body: copy.body,
            sound: true,
            data: { type: 'meal_reminder', slotId: slot.id },
            ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : null),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: slot.hour,
            minute: slot.minute,
          },
        });
      }

      console.log('Daily reminder notifications scheduled');
    } catch (error) {
      console.error('Failed to schedule notifications:', error);
    }
  }, []);

  const registerExpoPushToken = useCallback(async (userId: string) => {
    if (Platform.OS === 'web') return;
    try {
      const projectId = getEasProjectId();
      if (!projectId) {
        console.warn('Missing EAS projectId — cannot register Expo push token');
        return;
      }

      const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
      const expoPushToken = tokenResult.data;
      if (!expoPushToken) return;

      const { error } = await supabase.from('user_push_tokens').upsert(
        {
          user_id: userId,
          expo_push_token: expoPushToken,
          platform: Platform.OS,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,expo_push_token' }
      );

      if (error) {
        // Migration may not be applied yet — non-fatal for local reminders.
        console.warn('Failed to save push token:', error.message);
      }
    } catch (error) {
      console.warn('Push token registration failed (ok on simulator):', error);
    }
  }, []);

  const removeExpoPushTokens = useCallback(async (userId: string) => {
    try {
      await supabase.from('user_push_tokens').delete().eq('user_id', userId);
    } catch (error) {
      console.warn('Failed to remove push tokens:', error);
    }
  }, []);

  const syncPushTokenForUser = useCallback(
    async (userId: string | null) => {
      if (!userId || Platform.OS === 'web') return;
      const { enabled, permissionGranted } = settingsRef.current;
      if (!enabled || !permissionGranted) return;
      await registerExpoPushToken(userId);
    },
    [registerExpoPushToken]
  );

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const stored = await AsyncStorage.getItem(NOTIFICATION_STORAGE_KEY);
        if (stored && mounted) {
          const parsed = JSON.parse(stored) as Partial<NotificationSettings>;
          setSettings((prev) => ({
            ...prev,
            ...parsed,
            communityAlertsEnabled:
              typeof parsed.communityAlertsEnabled === 'boolean'
                ? parsed.communityAlertsEnabled
                : true,
          }));
        }
      } catch (error) {
        console.error('Failed to load notification settings:', error);
      }

      try {
        if (Platform.OS !== 'web') {
          await ensureAndroidChannel();
          const { status } = await Notifications.getPermissionsAsync();
          if (mounted) {
            setSettings((prev) => ({ ...prev, permissionGranted: status === 'granted' }));
          }
        }
      } catch (error) {
        console.error('Failed to check permission status:', error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Re-schedule when enabled settings have finished loading / when app returns to foreground.
  useEffect(() => {
    if (isLoading) return;
    if (settings.enabled && settings.permissionGranted) {
      void scheduleNotifications();
    }
  }, [isLoading, settings.enabled, settings.permissionGranted, scheduleNotifications]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && settingsRef.current.enabled && settingsRef.current.permissionGranted) {
        void scheduleNotifications();
      }
    });
    return () => sub.remove();
  }, [scheduleNotifications]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'web') return false;

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      const granted = finalStatus === 'granted';
      const next = { ...settingsRef.current, permissionGranted: granted };
      await saveSettings(next);
      return granted;
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return false;
    }
  }, [saveSettings]);

  const enableNotifications = useCallback(async () => {
    try {
      const granted = await requestPermission();
      if (!granted) return;

      const next: NotificationSettings = {
        ...settingsRef.current,
        enabled: true,
        permissionGranted: true,
      };
      await saveSettings(next);
      await scheduleNotifications();

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user?.id) {
        await registerExpoPushToken(session.user.id);
      }
    } catch (error) {
      console.error('Failed to enable notifications:', error);
    }
  }, [requestPermission, saveSettings, scheduleNotifications, registerExpoPushToken]);

  const disableNotifications = useCallback(async () => {
    try {
      await cancelAllNotifications();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user?.id) {
        await removeExpoPushTokens(session.user.id);
      }
      const next: NotificationSettings = {
        ...settingsRef.current,
        enabled: false,
      };
      await saveSettings(next);
    } catch (error) {
      console.error('Failed to disable notifications:', error);
    }
  }, [cancelAllNotifications, removeExpoPushTokens, saveSettings]);

  const setCommunityAlertsEnabled = useCallback(
    async (enabled: boolean) => {
      const next = { ...settingsRef.current, communityAlertsEnabled: enabled };
      await saveSettings(next);
      if (!enabled) return;
      // Keep token registered if main notifications are on
      if (settingsRef.current.enabled && settingsRef.current.permissionGranted) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user?.id) {
          await registerExpoPushToken(session.user.id);
        }
      }
    },
    [saveSettings, registerExpoPushToken]
  );

  return (
    <NotificationContext.Provider
      value={{
        settings,
        requestPermission,
        enableNotifications,
        disableNotifications,
        setCommunityAlertsEnabled,
        scheduleNotifications,
        cancelAllNotifications,
        syncPushTokenForUser,
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
