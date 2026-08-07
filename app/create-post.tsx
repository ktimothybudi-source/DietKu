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
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCommunity } from '@/contexts/CommunityContext';
import { useNutrition } from '@/contexts/NutritionContext';
import { MEAL_TYPE_LABELS } from '@/types/community';
import { Send, Utensils } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

export default function CreatePostScreen() {
  const { theme } = useTheme();
  const { l } = useLanguage();
  const { communityProfile, createPost } = useCommunity();
  const { todayEntries } = useNutrition();
  const headerHeight = useHeaderHeight();

  const [caption, setCaption] = useState('');
  const [foodName, setFoodName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [mealType, setMealType] = useState<typeof MEAL_TYPES[number]>('lunch');
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);
  const [selectedEntryPhotoUri, setSelectedEntryPhotoUri] = useState<string | undefined>(undefined);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/community');
  }, []);

  const handleSelectEntry = useCallback((entry: typeof todayEntries[0]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (selectedEntry === entry.id) {
      setSelectedEntry(null);
      setSelectedEntryPhotoUri(undefined);
      setFoodName('');
      setCalories('');
      setProtein('');
      setCarbs('');
      setFat('');
    } else {
      setSelectedEntry(entry.id);
      setFoodName(entry.name.split(',')[0]);
      setCalories(Math.round(entry.calories).toString());
      setProtein(Math.round(entry.protein).toString());
      setCarbs(Math.round(entry.carbs).toString());
      setFat(Math.round(entry.fat).toString());
      setSelectedEntryPhotoUri(entry.photoUri);
    }
  }, [selectedEntry]);

  const handlePost = useCallback(() => {
    if (!communityProfile) {
      Alert.alert(l('Error', 'Error'), l('Profil komunitas belum dibuat.', 'Community profile has not been created.'));
      return;
    }
    if (!foodName.trim()) {
      Alert.alert(l('Error', 'Error'), l('Masukkan nama makanan.', 'Enter food name.'));
      return;
    }
    const cal = parseInt(calories) || 0;
    const pro = parseInt(protein) || 0;
    const carb = parseInt(carbs) || 0;
    const f = parseInt(fat) || 0;

    if (cal <= 0) {
      Alert.alert(l('Error', 'Error'), l('Kalori harus lebih dari 0.', 'Calories must be greater than 0.'));
      return;
    }

    createPost({
      userId: communityProfile.userId,
      username: communityProfile.username,
      displayName: communityProfile.displayName,
      avatarColor: communityProfile.avatarColor,
      caption: caption.trim(),
      foodName: foodName.trim(),
      calories: cal,
      protein: pro,
      carbs: carb,
      fat: f,
      photoUri: selectedEntryPhotoUri,
      mealType,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    handleBack();
  }, [communityProfile, caption, foodName, calories, protein, carbs, fat, selectedEntryPhotoUri, mealType, createPost, handleBack, l]);

  return (
    <>
      <Stack.Screen
        options={{
          title: l('Buat Post', 'Create Post'),
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity onPress={handleBack} activeOpacity={0.7} style={styles.headerBackBtn}>
              <Text style={[styles.headerBackText, { color: theme.primary }]}>Back</Text>
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={handlePost} style={styles.headerBtn} activeOpacity={0.7}>
              <Send size={18} color={theme.primary} />
              <Text style={[styles.headerBtnText, { color: theme.primary }]}>{l('Post', 'Post')}</Text>
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
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{l('Caption', 'Caption')}</Text>
            <TextInput
              style={[styles.captionInput, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, color: theme.text }]}
              value={caption}
              onChangeText={setCaption}
              placeholder={l('Ceritakan tentang makanan Anda...', 'Tell us about your meal...')}
              placeholderTextColor={theme.textTertiary}
              multiline
              maxLength={300}
              textAlignVertical="top"
            />
            <Text style={[styles.charCount, { color: theme.textTertiary }]}>{caption.length}/300</Text>
          </View>

          {todayEntries.length > 0 && (
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{l('Pilih dari Log Hari Ini', "Pick from Today's Log")}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.entriesScroll}>
                {todayEntries.map(entry => (
                  <TouchableOpacity
                    key={entry.id}
                    style={[
                      styles.entryChip,
                      { borderColor: theme.border, backgroundColor: theme.surfaceElevated },
                      selectedEntry === entry.id && { borderColor: theme.primary, backgroundColor: theme.primary + '15' },
                    ]}
                    onPress={() => handleSelectEntry(entry)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.entryChipText,
                        { color: theme.text },
                        selectedEntry === entry.id && { color: theme.primary },
                      ]}
                      numberOfLines={1}
                    >
                      {entry.name.split(',')[0]}
                    </Text>
                    <Text style={[styles.entryChipCal, { color: theme.textTertiary }]}>
                      {Math.round(entry.calories)} kcal
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.sectionHeader}>
              <Utensils size={16} color={theme.primary} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{l('Detail Makanan', 'Food Details')}</Text>
            </View>

            <View style={styles.mealTypeRow}>
              {MEAL_TYPES.map(type => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.mealTypeBtn,
                    { borderColor: theme.border },
                    mealType === type && { backgroundColor: theme.primary, borderColor: theme.primary },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setMealType(type);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.mealTypeText,
                      { color: theme.textSecondary },
                      mealType === type && { color: '#FFFFFF' },
                    ]}
                  >
                    {MEAL_TYPE_LABELS[type]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>{l('Nama Makanan', 'Food Name')}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, color: theme.text }]}
                value={foodName}
                onChangeText={setFoodName}
                placeholder={l('Contoh: Nasi Goreng', 'Example: Fried rice')}
                placeholderTextColor={theme.textTertiary}
              />
            </View>

            <View style={styles.macroGrid}>
              <View style={styles.macroField}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>{l('Kalori', 'Calories')}</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, color: theme.text }]}
                  value={calories}
                  onChangeText={setCalories}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={theme.textTertiary}
                />
              </View>
              <View style={styles.macroField}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>{l('Protein (g)', 'Protein (g)')}</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, color: theme.text }]}
                  value={protein}
                  onChangeText={setProtein}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={theme.textTertiary}
                />
              </View>
            </View>

            <View style={styles.macroGrid}>
              <View style={styles.macroField}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>{l('Karbo (g)', 'Carbs (g)')}</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, color: theme.text }]}
                  value={carbs}
                  onChangeText={setCarbs}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={theme.textTertiary}
                />
              </View>
              <View style={styles.macroField}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>{l('Lemak (g)', 'Fat (g)')}</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, color: theme.text }]}
                  value={fat}
                  onChangeText={setFat}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={theme.textTertiary}
                />
              </View>
            </View>
          </View>

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
    padding: 16,
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  headerBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
  headerBackBtn: {
    paddingVertical: 6,
    paddingRight: 8,
  },
  headerBackText: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
  card: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    marginBottom: 10,
  },
  captionInput: {
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
    marginTop: 6,
  },
  entriesScroll: {
    marginTop: 4,
  },
  entryChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 10,
    minWidth: 100,
  },
  entryChipText: {
    fontSize: 13,
    fontWeight: '600' as const,
    marginBottom: 2,
  },
  entryChipCal: {
    fontSize: 12,
  },
  mealTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  mealTypeBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  mealTypeText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  field: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '600' as const,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
  },
  macroGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  macroField: {
    flex: 1,
  },
});
