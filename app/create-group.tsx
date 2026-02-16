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
import { useTheme } from '@/contexts/ThemeContext';
import { useCommunity } from '@/contexts/CommunityContext';
import { useNutrition } from '@/contexts/NutritionContext';
import { GROUP_COVERS } from '@/types/community';
import { Check, Lock, Globe, Camera } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

type Privacy = 'public' | 'private';

export default function CreateGroupScreen() {
  const { theme } = useTheme();
  const { createGroup, hasProfile } = useCommunity();
  const { authState } = useNutrition();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState<Privacy>('public');
  const [selectedCover, setSelectedCover] = useState(GROUP_COVERS[0]);

  const handleCreate = useCallback(() => {
    console.log('create-group:submit', name, privacy);
    if (!name.trim()) {
      Alert.alert('Nama Diperlukan', 'Masukkan nama untuk grup kamu.');
      return;
    }
    if (name.trim().length < 3) {
      Alert.alert('Nama Terlalu Pendek', 'Nama grup minimal 3 karakter.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Deskripsi Diperlukan', 'Tambahkan deskripsi singkat untuk grup.');
      return;
    }

    createGroup({
      name: name.trim(),
      description: description.trim(),
      coverImage: selectedCover,
      privacy,
      creatorId: authState.userId || 'local',
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  }, [name, description, privacy, selectedCover, createGroup, authState.userId]);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Buat Grup Baru',
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
          <View style={styles.coverSection}>
            <Image source={{ uri: selectedCover }} style={styles.coverPreview} />
            <View style={[styles.coverOverlay, { backgroundColor: 'rgba(0,0,0,0.25)' }]}>
              <Camera size={20} color="#FFFFFF" />
              <Text style={styles.coverOverlayText}>Pilih Cover</Text>
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
              <Text style={[styles.label, { color: theme.text }]}>Nama Grup</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, color: theme.text }]}
                value={name}
                onChangeText={setName}
                placeholder="Contoh: Healthy Squad"
                placeholderTextColor={theme.textTertiary}
                maxLength={40}
                testID="create-group-name"
              />
              <Text style={[styles.charCount, { color: theme.textTertiary }]}>{name.length}/40</Text>
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.text }]}>Deskripsi</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, color: theme.text }]}
                value={description}
                onChangeText={setDescription}
                placeholder="Ceritakan tentang grup ini..."
                placeholderTextColor={theme.textTertiary}
                multiline
                maxLength={200}
                textAlignVertical="top"
                testID="create-group-desc"
              />
              <Text style={[styles.charCount, { color: theme.textTertiary }]}>{description.length}/200</Text>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.label, { color: theme.text, marginBottom: 12 }]}>Privasi Grup</Text>

            <TouchableOpacity
              style={[
                styles.privacyOption,
                { borderColor: privacy === 'public' ? theme.primary : theme.border },
                privacy === 'public' && { backgroundColor: theme.primary + '0A' },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setPrivacy('public');
              }}
              activeOpacity={0.8}
              testID="create-group-public"
            >
              <View style={[styles.privacyIcon, { backgroundColor: theme.success + '18' }]}>
                <Globe size={18} color={theme.success} />
              </View>
              <View style={styles.privacyText}>
                <Text style={[styles.privacyTitle, { color: theme.text }]}>Publik</Text>
                <Text style={[styles.privacyDesc, { color: theme.textSecondary }]}>
                  Siapa saja bisa menemukan dan bergabung
                </Text>
              </View>
              {privacy === 'public' && (
                <View style={[styles.privacyCheck, { backgroundColor: theme.primary }]}>
                  <Check size={14} color="#FFFFFF" strokeWidth={3} />
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.privacyOption,
                { borderColor: privacy === 'private' ? theme.primary : theme.border, marginTop: 10 },
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
                <Text style={[styles.privacyTitle, { color: theme.text }]}>Privat</Text>
                <Text style={[styles.privacyDesc, { color: theme.textSecondary }]}>
                  Hanya bisa bergabung lewat kode undangan
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
            style={[styles.createBtn, { backgroundColor: theme.primary }]}
            onPress={handleCreate}
            activeOpacity={0.8}
            testID="create-group-submit"
          >
            <Text style={styles.createBtnText}>Buat Grup</Text>
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
});
