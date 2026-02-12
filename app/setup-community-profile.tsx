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
import { useTheme } from '@/contexts/ThemeContext';
import { useCommunity } from '@/contexts/CommunityContext';
import { useNutrition } from '@/contexts/NutritionContext';
import { AVATAR_COLORS, CommunityProfile } from '@/types/community';
import { Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export default function SetupCommunityProfileScreen() {
  const { theme } = useTheme();
  const { saveCommunityProfile, communityProfile } = useCommunity();
  const { authState, profile } = useNutrition();

  const [username, setUsername] = useState(communityProfile?.username || '');
  const [displayName, setDisplayName] = useState(communityProfile?.displayName || profile?.name || '');
  const [bio, setBio] = useState(communityProfile?.bio || '');
  const [selectedColor, setSelectedColor] = useState(communityProfile?.avatarColor || AVATAR_COLORS[0]);

  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  const handleSave = () => {
    const trimmedUsername = username.trim().toLowerCase().replace(/[^a-z0-9._]/g, '');
    if (!trimmedUsername || trimmedUsername.length < 3) {
      Alert.alert('Username Invalid', 'Username harus minimal 3 karakter (huruf, angka, titik, underscore).');
      return;
    }
    if (!displayName.trim()) {
      Alert.alert('Nama Diperlukan', 'Masukkan nama tampilan Anda.');
      return;
    }

    const newProfile: CommunityProfile = {
      userId: authState.userId || `local_${Date.now()}`,
      username: trimmedUsername,
      displayName: displayName.trim(),
      avatarColor: selectedColor,
      bio: bio.trim() || undefined,
      joinedAt: communityProfile?.joinedAt || Date.now(),
    };

    saveCommunityProfile(newProfile);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: communityProfile ? 'Edit Profil Komunitas' : 'Setup Profil',
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerShadowVisible: false,
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={[styles.container, { backgroundColor: theme.background }]}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.avatarSection}>
            <View style={[styles.bigAvatar, { backgroundColor: selectedColor }]}>
              <Text style={styles.bigAvatarText}>{initials}</Text>
            </View>
            <Text style={[styles.avatarHint, { color: theme.textSecondary }]}>Pilih warna avatar</Text>
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
                  placeholder="username"
                  placeholderTextColor={theme.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={20}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.text }]}>Nama Tampilan</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, color: theme.text }]}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Nama Anda"
                placeholderTextColor={theme.textTertiary}
                maxLength={30}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.text }]}>Bio</Text>
              <TextInput
                style={[styles.bioInput, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, color: theme.text }]}
                value={bio}
                onChangeText={setBio}
                placeholder="Ceritakan sedikit tentang diri Anda..."
                placeholderTextColor={theme.textTertiary}
                multiline
                maxLength={100}
                textAlignVertical="top"
              />
              <Text style={[styles.charCount, { color: theme.textTertiary }]}>{bio.length}/100</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: theme.primary }]}
            onPress={handleSave}
            activeOpacity={0.8}
          >
            <Text style={styles.saveBtnText}>
              {communityProfile ? 'Simpan Perubahan' : 'Buat Profil'}
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
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
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
  bioInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    height: 80,
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
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
