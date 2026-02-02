import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useNutrition } from '@/contexts/NutritionContext';
import { useTheme } from '@/contexts/ThemeContext';
import { UserProfile } from '@/types/nutrition';
import * as Haptics from 'expo-haptics';

export default function EditProfileScreen() {
  const { profile, saveProfile, isSaving } = useNutrition();
  const { theme } = useTheme();

  const [name, setName] = useState(profile?.name || '');
  const [age, setAge] = useState(profile?.age.toString() || '');
  const [sex, setSex] = useState<'male' | 'female'>(profile?.sex || 'male');
  const [height, setHeight] = useState(profile?.height.toString() || '');
  const [weight, setWeight] = useState(profile?.weight.toString() || '');
  const [goalWeight, setGoalWeight] = useState(profile?.goalWeight?.toString() || profile?.weight.toString() || '');
  const [goal, setGoal] = useState<'fat_loss' | 'maintenance' | 'muscle_gain'>(profile?.goal || 'maintenance');
  const [activityLevel, setActivityLevel] = useState<'low' | 'moderate' | 'high'>(profile?.activityLevel || 'moderate');
  const [weeklyWeightChange, setWeeklyWeightChange] = useState(profile?.weeklyWeightChange?.toString() || '');

  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const changed = 
      name !== (profile?.name || '') ||
      age !== profile?.age.toString() ||
      sex !== profile?.sex ||
      height !== profile?.height.toString() ||
      weight !== profile?.weight.toString() ||
      goalWeight !== (profile?.goalWeight?.toString() || profile?.weight.toString()) ||
      goal !== profile?.goal ||
      activityLevel !== profile?.activityLevel ||
      weeklyWeightChange !== (profile?.weeklyWeightChange?.toString() || '');
    setHasChanges(changed);
  }, [name, age, sex, height, weight, goalWeight, goal, activityLevel, weeklyWeightChange, profile]);

  const handleSave = () => {
    if (!age || !height || !weight || !goalWeight) {
      Alert.alert('Error', 'Mohon lengkapi semua field yang wajib diisi');
      return;
    }

    const ageNum = parseInt(age);
    const heightNum = parseInt(height);
    const weightNum = parseFloat(weight);
    const goalWeightNum = parseFloat(goalWeight);
    const weeklyWeightChangeNum = weeklyWeightChange ? parseFloat(weeklyWeightChange) : undefined;

    if (ageNum < 15 || ageNum > 100) {
      Alert.alert('Error', 'Usia harus antara 15-100 tahun');
      return;
    }

    if (heightNum < 100 || heightNum > 250) {
      Alert.alert('Error', 'Tinggi harus antara 100-250 cm');
      return;
    }

    if (weightNum < 30 || weightNum > 300) {
      Alert.alert('Error', 'Berat harus antara 30-300 kg');
      return;
    }

    if (goalWeightNum < 30 || goalWeightNum > 300) {
      Alert.alert('Error', 'Target berat harus antara 30-300 kg');
      return;
    }

    if (goal === 'muscle_gain' && goalWeightNum < weightNum) {
      Alert.alert('Perhatian', 'Untuk tujuan membangun otot, target berat tidak boleh lebih rendah dari berat saat ini.');
      return;
    }

    if (goal === 'fat_loss' && goalWeightNum > weightNum) {
      Alert.alert('Perhatian', 'Untuk tujuan menurunkan berat badan, target berat tidak boleh lebih tinggi dari berat saat ini.');
      return;
    }

    if (weeklyWeightChangeNum !== undefined && (weeklyWeightChangeNum < -2 || weeklyWeightChangeNum > 2)) {
      Alert.alert('Error', 'Target per minggu harus antara -2 sampai +2 kg');
      return;
    }

    const updatedProfile: UserProfile = {
      name: name.trim() || undefined,
      age: ageNum,
      sex,
      height: heightNum,
      weight: weightNum,
      goalWeight: goalWeightNum,
      goal,
      activityLevel,
      weeklyWeightChange: weeklyWeightChangeNum,
    };

    saveProfile(updatedProfile);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Berhasil', 'Profil berhasil diperbarui', [
      { text: 'OK', onPress: () => router.back() }
    ]);
  };

  const handleCancel = () => {
    if (hasChanges) {
      Alert.alert(
        'Batalkan Perubahan',
        'Perubahan yang Anda buat belum disimpan. Apakah Anda yakin ingin keluar?',
        [
          { text: 'Lanjutkan Edit', style: 'cancel' },
          { text: 'Batalkan', style: 'destructive', onPress: () => router.back() },
        ]
      );
    } else {
      router.back();
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Edit Profil',
          headerStyle: {
            backgroundColor: theme.background,
          },
          headerTintColor: theme.text,
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
              <Text style={[styles.headerButtonText, { color: theme.text }]}>Batal</Text>
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity 
              onPress={handleSave} 
              style={styles.headerButton}
              disabled={!hasChanges || isSaving}
            >
              <Text style={[
                styles.headerButtonText, 
                { color: hasChanges ? theme.primary : theme.textSecondary }
              ]}>
                {isSaving ? 'Menyimpan...' : 'Simpan'}
              </Text>
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView 
        style={[styles.container, { backgroundColor: theme.background }]} 
        contentContainerStyle={styles.content}
      >
        <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Info Dasar</Text>

          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.text }]}>Nama</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              value={name}
              onChangeText={setName}
              placeholder="Nama Anda"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.text }]}>Usia (tahun)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              value={age}
              onChangeText={setAge}
              keyboardType="number-pad"
              placeholder="25"
              placeholderTextColor={theme.textSecondary}
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.text }]}>Jenis Kelamin</Text>
            <View style={styles.optionRow}>
              <TouchableOpacity
                style={[
                  styles.option,
                  { borderColor: theme.border },
                  sex === 'male' && { backgroundColor: theme.primary, borderColor: theme.primary }
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSex('male');
                }}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.optionText,
                  { color: theme.text },
                  sex === 'male' && { color: '#FFFFFF' }
                ]}>Pria</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.option,
                  { borderColor: theme.border },
                  sex === 'female' && { backgroundColor: theme.primary, borderColor: theme.primary }
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSex('female');
                }}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.optionText,
                  { color: theme.text },
                  sex === 'female' && { color: '#FFFFFF' }
                ]}>Wanita</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.text }]}>Tinggi (cm)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              value={height}
              onChangeText={setHeight}
              keyboardType="number-pad"
              placeholder="170"
              placeholderTextColor={theme.textSecondary}
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.text }]}>Berat (kg)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              placeholder="70"
              placeholderTextColor={theme.textSecondary}
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.text }]}>Target Berat (kg)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              value={goalWeight}
              onChangeText={setGoalWeight}
              keyboardType="decimal-pad"
              placeholder="65"
              placeholderTextColor={theme.textSecondary}
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.text }]}>Target Per Minggu (kg)</Text>
            <Text style={[styles.fieldHint, { color: theme.textSecondary }]}>Gunakan angka negatif untuk menurunkan berat (contoh: -0.5)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              value={weeklyWeightChange}
              onChangeText={setWeeklyWeightChange}
              keyboardType="numeric"
              placeholder="-0.5"
              placeholderTextColor={theme.textSecondary}
            />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Tujuan</Text>

          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.text }]}>Tujuan Fitness</Text>
            <View style={styles.goalOptions}>
              <TouchableOpacity
                style={[
                  styles.goalOption,
                  { borderColor: theme.border },
                  goal === 'fat_loss' && { backgroundColor: theme.primary, borderColor: theme.primary }
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setGoal('fat_loss');
                }}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.goalOptionTitle,
                  { color: theme.text },
                  goal === 'fat_loss' && { color: '#FFFFFF' }
                ]}>Kurangi Lemak</Text>
                <Text style={[
                  styles.goalOptionDesc,
                  { color: theme.textSecondary },
                  goal === 'fat_loss' && { color: 'rgba(255, 255, 255, 0.8)' }
                ]}>Defisit kalori</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.goalOption,
                  { borderColor: theme.border },
                  goal === 'maintenance' && { backgroundColor: theme.primary, borderColor: theme.primary }
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setGoal('maintenance');
                }}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.goalOptionTitle,
                  { color: theme.text },
                  goal === 'maintenance' && { color: '#FFFFFF' }
                ]}>Pertahankan Berat</Text>
                <Text style={[
                  styles.goalOptionDesc,
                  { color: theme.textSecondary },
                  goal === 'maintenance' && { color: 'rgba(255, 255, 255, 0.8)' }
                ]}>Kalori seimbang</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.goalOption,
                  { borderColor: theme.border },
                  goal === 'muscle_gain' && { backgroundColor: theme.primary, borderColor: theme.primary }
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setGoal('muscle_gain');
                }}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.goalOptionTitle,
                  { color: theme.text },
                  goal === 'muscle_gain' && { color: '#FFFFFF' }
                ]}>Bangun Otot</Text>
                <Text style={[
                  styles.goalOptionDesc,
                  { color: theme.textSecondary },
                  goal === 'muscle_gain' && { color: 'rgba(255, 255, 255, 0.8)' }
                ]}>Surplus kalori</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Tingkat Aktivitas</Text>

          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.text }]}>Aktivitas Harian</Text>
            <View style={styles.goalOptions}>
              <TouchableOpacity
                style={[
                  styles.goalOption,
                  { borderColor: theme.border },
                  activityLevel === 'low' && { backgroundColor: theme.primary, borderColor: theme.primary }
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActivityLevel('low');
                }}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.goalOptionTitle,
                  { color: theme.text },
                  activityLevel === 'low' && { color: '#FFFFFF' }
                ]}>Rendah</Text>
                <Text style={[
                  styles.goalOptionDesc,
                  { color: theme.textSecondary },
                  activityLevel === 'low' && { color: 'rgba(255, 255, 255, 0.8)' }
                ]}>Duduk/kantor</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.goalOption,
                  { borderColor: theme.border },
                  activityLevel === 'moderate' && { backgroundColor: theme.primary, borderColor: theme.primary }
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActivityLevel('moderate');
                }}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.goalOptionTitle,
                  { color: theme.text },
                  activityLevel === 'moderate' && { color: '#FFFFFF' }
                ]}>Sedang</Text>
                <Text style={[
                  styles.goalOptionDesc,
                  { color: theme.textSecondary },
                  activityLevel === 'moderate' && { color: 'rgba(255, 255, 255, 0.8)' }
                ]}>Olahraga 3-5x/minggu</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.goalOption,
                  { borderColor: theme.border },
                  activityLevel === 'high' && { backgroundColor: theme.primary, borderColor: theme.primary }
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActivityLevel('high');
                }}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.goalOptionTitle,
                  { color: theme.text },
                  activityLevel === 'high' && { color: '#FFFFFF' }
                ]}>Tinggi</Text>
                <Text style={[
                  styles.goalOptionDesc,
                  { color: theme.textSecondary },
                  activityLevel === 'high' && { color: 'rgba(255, 255, 255, 0.8)' }
                ]}>Olahraga intensif</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
  },
  headerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  section: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    marginBottom: 20,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '600' as const,
    marginBottom: 10,
  },
  input: {
    borderWidth: 2,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  option: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  goalOptions: {
    gap: 12,
  },
  goalOption: {
    borderWidth: 2,
    borderRadius: 14,
    padding: 16,
  },
  goalOptionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  goalOptionDesc: {
    fontSize: 14,
  },
  bottomPadding: {
    height: 40,
  },
  fieldHint: {
    fontSize: 13,
    marginBottom: 8,
    fontStyle: 'italic' as const,
  },
});
