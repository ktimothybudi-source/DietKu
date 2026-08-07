import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCommunity } from '@/contexts/CommunityContext';
import { useNutrition } from '@/contexts/NutritionContext';
import { AVATAR_COLORS, CommunityProfile } from '@/types/community';
import { peekPendingGroupInviteCode } from '@/lib/pendingGroupInviteCode';
import { Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
export default function SetupCommunityProfileScreen() {
  const { theme } = useTheme();
  const { l } = useLanguage();
  const { saveCommunityProfile, communityProfile } = useCommunity();
  const { authState } = useNutrition();
  const headerHeight = useHeaderHeight();

  const [username, setUsername] = useState(communityProfile?.username || '');
  const [selectedColor, setSelectedColor] = useState(communityProfile?.avatarColor || AVATAR_COLORS[0]);

  const initials = username
    .trim()
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  const handleSave = async () => {
    const trimmedUsername = username.trim().toLowerCase().replace(/[^a-z0-9._]/g, '');
    if (!trimmedUsername || trimmedUsername.length < 3) {
      Alert.alert(l('Username Invalid', 'Invalid Username'), l('Username harus minimal 3 karakter (huruf, angka, titik, underscore).', 'Username must be at least 3 characters (letters, numbers, dots, underscore).'));
      return;
    }

    const newProfile: CommunityProfile = {
      userId: authState.userId || `local_${Date.now()}`,
      username: trimmedUsername,
      displayName: trimmedUsername,
      avatarColor: selectedColor,
      bio: undefined,
      joinedAt: communityProfile?.joinedAt || Date.now(),
    };

    try {
      await saveCommunityProfile(newProfile);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      try {
        const pendingGroupCode = await peekPendingGroupInviteCode();
        if (pendingGroupCode) {
          router.replace(`/browse-groups?code=${encodeURIComponent(pendingGroupCode)}`);
          return;
        }
      } catch {
        // fall through
      }
      router.replace('/(tabs)/community');
    } catch (error) {
      console.error('Save community profile error:', error);
      Alert.alert(
        l('Gagal', 'Failed'),
        l('Gagal menyimpan profil. Coba lagi.', 'Failed to save profile. Please try again.')
      );
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: communityProfile ? l('Edit Profil Komunitas', 'Edit Community Profile') : l('Setup Profil', 'Setup Profile'),
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerShadowVisible: false,
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={headerHeight}
      >
        <ScrollView
          style={[styles.container, { backgroundColor: theme.background }]}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {!communityProfile ? (
            <Text style={[styles.stepText, { color: theme.primary }]}>
              {l('Langkah 1 dari 2', 'Step 1 of 2')}
            </Text>
          ) : null}
          <View style={styles.avatarSection}>
            <View style={[styles.bigAvatar, { backgroundColor: selectedColor }]}>
              <Text style={styles.bigAvatarText}>{initials}</Text>
            </View>
            <Text style={[styles.avatarHint, { color: theme.textSecondary }]}>{l('Pilih warna avatar', 'Choose avatar color')}</Text>
            <View style={styles.colorGrid}>
              {AVATAR_COLORS.map(color => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    selectedColor === color && styles.colorSelected,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedColor(color);
                  }}
                  activeOpacity={0.7}
                >
                  {selectedColor === color && <Check size={18} color="#FFFFFF" strokeWidth={3} />}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={[styles.formCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.text }]}>Username</Text>
              <View style={[styles.inputWrapper, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                <Text style={[styles.inputPrefix, { color: theme.textTertiary }]}>@</Text>
                <TextInput
                  style={[styles.inputWithPrefix, { color: theme.text }]}
                  value={username}
                  onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
                  placeholder={l('username', 'username')}
                  placeholderTextColor={theme.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={20}
                />
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: theme.primary }]}
            onPress={handleSave}
            activeOpacity={0.8}
          >
            <Text style={styles.saveBtnText}>
              {communityProfile ? l('Simpan Perubahan', 'Save Changes') : l('Buat Profil', 'Create Profile')}
            </Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  stepText: {
    fontSize: 12,
    fontWeight: '700' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    textAlign: 'center',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  bigAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  bigAvatarText: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  avatarHint: {
    fontSize: 13,
    marginBottom: 14,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSelected: {
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  formCard: {
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    marginBottom: 20,
  },
  field: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  inputPrefix: {
    fontSize: 15,
    fontWeight: '600' as const,
    marginRight: 2,
  },
  inputWithPrefix: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 12,
  },
  saveBtn: {
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
