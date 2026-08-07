import React, { useState, useCallback } from 'react';
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
  Image,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCommunity } from '@/contexts/CommunityContext';
import { useNutrition } from '@/contexts/NutritionContext';
import { GROUP_COVERS } from '@/types/community';
import { Check, Lock, Camera } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

type Privacy = 'private';

export default function CreateGroupScreen() {
  const { theme } = useTheme();
  const { l } = useLanguage();
  const { createGroup, hasProfile } = useCommunity();
  const { authState } = useNutrition();
  const headerHeight = useHeaderHeight();

  const [name, setName] = useState('');
  const [privacy, setPrivacy] = useState<Privacy>('private');
  const [selectedCover, setSelectedCover] = useState(GROUP_COVERS[0]);
  const [isCreating, setIsCreating] = useState(false);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/community');
  }, []);

  const handleCreate = useCallback(async () => {
    console.log('create-group:submit', name, privacy);
    if (isCreating) return;
    if (!name.trim()) {
      Alert.alert(l('Nama Diperlukan', 'Name Required'), l('Masukkan nama untuk grup kamu.', 'Enter a name for your group.'));
      return;
    }
    if (name.trim().length < 3) {
      Alert.alert(l('Nama Terlalu Pendek', 'Name Too Short'), l('Nama grup minimal 3 karakter.', 'Group name must be at least 3 characters.'));
      return;
    }
    if (!authState.userId) {
      Alert.alert(l('Masuk Diperlukan', 'Sign In Required'), l('Silakan masuk kembali lalu coba buat grup.', 'Please sign in again and try creating a group.'));
      return;
    }

    if (!hasProfile) {
      Alert.alert(l('Profil Komunitas Diperlukan', 'Community Profile Required'), l('Buat profil komunitas dulu sebelum membuat grup.', 'Create your community profile before creating a group.'));
      return;
    }

    try {
      setIsCreating(true);
      await createGroup({
        name: name.trim(),
        description: '',
        coverImage: selectedCover,
        privacy,
        creatorId: authState.userId,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      handleBack();
    } catch (error) {
      console.error('create-group failed:', error);
      const message = error instanceof Error ? error.message : l('Gagal membuat grup. Coba lagi.', 'Failed to create group. Please try again.');
      Alert.alert(l('Gagal Buat Grup', 'Failed to Create Group'), message);
    } finally {
      setIsCreating(false);
    }
  }, [name, privacy, selectedCover, createGroup, authState.userId, hasProfile, isCreating, handleBack]);

  return (
    <>
      <Stack.Screen
        options={{
          title: l('Buat Grup Baru', 'Create New Group'),
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity onPress={handleBack} activeOpacity={0.7} style={styles.headerBackBtn}>
              <Text style={[styles.headerBackText, { color: theme.primary }]}>Back</Text>
            </TouchableOpacity>
          ),
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
          <View style={styles.coverSection}>
            <Image source={{ uri: selectedCover }} style={styles.coverPreview} />
            <View style={[styles.coverOverlay, { backgroundColor: 'rgba(0,0,0,0.25)' }]}>
              <Camera size={20} color="#FFFFFF" />
              <Text style={styles.coverOverlayText}>{l('Pilih Cover', 'Choose Cover')}</Text>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.coverGrid}
          >
            {GROUP_COVERS.map((cover) => (
              <TouchableOpacity
                key={cover}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedCover(cover);
                }}
                activeOpacity={0.8}
                style={[
                  styles.coverThumb,
                  selectedCover === cover && { borderColor: theme.primary, borderWidth: 2.5 },
                ]}
              >
                <Image source={{ uri: cover }} style={styles.coverThumbImage} />
                {selectedCover === cover && (
                  <View style={[styles.coverCheck, { backgroundColor: theme.primary }]}>
                    <Check size={12} color="#FFFFFF" strokeWidth={3} />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.text }]}>{l('Nama Grup', 'Group Name')}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, color: theme.text }]}
                value={name}
                onChangeText={setName}
                placeholder={l('Contoh: Healthy Squad', 'Example: Healthy Squad')}
                placeholderTextColor={theme.textTertiary}
                maxLength={40}
                testID="create-group-name"
              />
              <Text style={[styles.charCount, { color: theme.textTertiary }]}>{name.length}/40</Text>
            </View>

          </View>

          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.label, { color: theme.text, marginBottom: 12 }]}>{l('Privasi Grup', 'Group Privacy')}</Text>

            <TouchableOpacity
              style={[
                styles.privacyOption,
                { borderColor: privacy === 'private' ? theme.primary : theme.border },
                privacy === 'private' && { backgroundColor: theme.primary + '0A' },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setPrivacy('private');
              }}
              activeOpacity={0.8}
              testID="create-group-private"
            >
              <View style={[styles.privacyIcon, { backgroundColor: theme.warning + '18' }]}>
                <Lock size={18} color={theme.warning} />
              </View>
              <View style={styles.privacyText}>
                <Text style={[styles.privacyTitle, { color: theme.text }]}>{l('Privat', 'Private')}</Text>
                <Text style={[styles.privacyDesc, { color: theme.textSecondary }]}>
                  {l('Hanya bisa bergabung lewat kode undangan', 'Can only be joined with an invite code')}
                </Text>
              </View>
              {privacy === 'private' && (
                <View style={[styles.privacyCheck, { backgroundColor: theme.primary }]}>
                  <Check size={14} color="#FFFFFF" strokeWidth={3} />
                </View>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.createBtn, { backgroundColor: theme.primary }, isCreating && { opacity: 0.6 }]}
            onPress={handleCreate}
            activeOpacity={0.8}
            disabled={isCreating}
            testID="create-group-submit"
          >
            <Text style={styles.createBtnText}>{isCreating ? l('Membuat...', 'Creating...') : l('Buat Grup', 'Create Group')}</Text>
          </TouchableOpacity>

          <View style={{ height: 60 }} />
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
    paddingBottom: 20,
  },
  coverSection: {
    height: 160,
    position: 'relative',
  },
  coverPreview: {
    width: '100%',
    height: '100%',
  },
  coverOverlay: {
    position: 'absolute',
    bottom: 12,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  coverOverlayText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  coverGrid: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  coverThumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  coverThumbImage: {
    width: '100%',
    height: '100%',
  },
  coverCheck: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    marginBottom: 14,
  },
  field: {
    marginBottom: 16,
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
  textArea: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    height: 90,
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  privacyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 12,
  },
  privacyIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyText: {
    flex: 1,
  },
  privacyTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
  privacyDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  privacyCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtn: {
    marginHorizontal: 16,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  createBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  headerBackBtn: {
    paddingVertical: 6,
    paddingRight: 8,
  },
  headerBackText: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
});
