import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { User, Settings as SettingsIcon, LogIn, LogOut, Globe, Moon, Sun, ChevronRight, UserCircle, Target, Flame, Bookmark, Trash2, Star, FileText, Shield, RefreshCw } from 'lucide-react-native';
import { useNutrition } from '@/contexts/NutritionContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import * as Haptics from 'expo-haptics';

export default function ProfileScreen() {
  const { profile, dailyTargets, favorites, removeFromFavorites } = useNutrition();
  const { theme, themeMode, toggleTheme } = useTheme();
  const { language } = useLanguage();
  const [isSignedIn, setIsSignedIn] = useState(false);

  if (!profile || !dailyTargets) {
    return null;
  }

  const goalText = {
    fat_loss: 'Kurangi Lemak',
    maintenance: 'Pertahankan Berat',
    muscle_gain: 'Bangun Otot',
  };

  const activityText = {
    low: 'Rendah',
    moderate: 'Sedang',
    high: 'Tinggi',
  };

  const handleToggleTheme = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleTheme();
  };

  const handleSignIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/sign-in');
  };

  const handleSignOut = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Keluar',
      'Apakah Anda yakin ingin keluar?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Keluar',
          style: 'destructive',
          onPress: () => setIsSignedIn(false),
        },
      ]
    );
  };

  const handleLanguagePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/language-picker');
  };

  const handleEditProfile = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/edit-profile');
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.headerSection}>
          <Text style={[styles.greeting, { color: theme.text }]}>Profil</Text>
        </View>

        <ScrollView style={styles.scrollContent} contentContainerStyle={styles.content}>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <UserCircle size={20} color={theme.primary} />
                <Text style={[styles.cardTitle, { color: theme.text }]}>Akun</Text>
              </View>
            </View>

            {isSignedIn ? (
              <>
                <View style={[styles.statusRow, { backgroundColor: theme.background }]}>
                  <Text style={[styles.statusText, { color: theme.textSecondary }]}>Terhubung sebagai: user@email.com</Text>
                </View>
                <TouchableOpacity
                  style={[styles.row, { borderTopColor: theme.border }]}
                  onPress={handleSignOut}
                  activeOpacity={0.7}
                >
                  <View style={styles.rowLeft}>
                    <LogOut size={20} color={theme.textSecondary} />
                    <Text style={[styles.rowLabel, { color: theme.text }]}>Keluar</Text>
                  </View>
                  <ChevronRight size={20} color={theme.textSecondary} />
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={[styles.statusRow, { backgroundColor: theme.background }]}>
                  <Text style={[styles.statusText, { color: theme.textSecondary }]}>Belum masuk</Text>
                </View>
                <TouchableOpacity
                  style={[styles.row, { borderTopColor: theme.border }]}
                  onPress={handleSignIn}
                  activeOpacity={0.7}
                >
                  <View style={styles.rowLeft}>
                    <LogIn size={20} color={theme.primary} />
                    <Text style={[styles.rowLabel, { color: theme.text }]}>Masuk</Text>
                  </View>
                  <ChevronRight size={20} color={theme.textSecondary} />
                </TouchableOpacity>
              </>
            )}
          </View>

          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <SettingsIcon size={20} color={theme.primary} />
                <Text style={[styles.cardTitle, { color: theme.text }]}>Pengaturan</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.row}
              onPress={handleLanguagePress}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <Globe size={20} color={theme.textSecondary} />
                <Text style={[styles.rowLabel, { color: theme.text }]}>Bahasa</Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={[styles.rowValue, { color: theme.textSecondary }]}>
                  {language === 'id' ? 'Indonesia' : 'English'}
                </Text>
                <ChevronRight size={20} color={theme.textSecondary} />
              </View>
            </TouchableOpacity>

            <View style={[styles.row, { borderTopColor: theme.border }]}>
              <View style={styles.rowLeft}>
                {themeMode === 'dark' ? <Moon size={20} color={theme.textSecondary} /> : <Sun size={20} color={theme.textSecondary} />}
                <Text style={[styles.rowLabel, { color: theme.text }]}>Tema</Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={[styles.themeModeText, { color: theme.textSecondary }]}>Gelap</Text>
                <Switch
                  value={themeMode === 'dark'}
                  onValueChange={handleToggleTheme}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <User size={20} color={theme.primary} />
                <Text style={[styles.cardTitle, { color: theme.text }]}>Informasi Pribadi</Text>
              </View>
            </View>

            <View style={styles.profileStats}>
              {profile.name && (
                <View style={[styles.statRow, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Nama</Text>
                  <Text style={[styles.statValue, { color: theme.text }]}>{profile.name}</Text>
                </View>
              )}
              <View style={[styles.statRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Usia</Text>
                <Text style={[styles.statValue, { color: theme.text }]}>{profile.age} tahun</Text>
              </View>
              <View style={[styles.statRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Jenis Kelamin</Text>
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {profile.sex === 'male' ? 'Pria' : 'Wanita'}
                </Text>
              </View>
              <View style={[styles.statRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Tinggi</Text>
                <Text style={[styles.statValue, { color: theme.text }]}>{profile.height} cm</Text>
              </View>
              <View style={[styles.statRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Berat Saat Ini</Text>
                <Text style={[styles.statValue, { color: theme.text }]}>{profile.weight} kg</Text>
              </View>
              <View style={[styles.statRow, { borderBottomWidth: 0 }]}>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Target Berat</Text>
                <Text style={[styles.statValue, { color: theme.text }]}>{profile.goalWeight || profile.weight} kg</Text>
              </View>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <Target size={20} color={theme.primary} />
                <Text style={[styles.cardTitle, { color: theme.text }]}>Tujuan & Aktivitas</Text>
              </View>
            </View>

            <View style={styles.profileStats}>
              <View style={[styles.statRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Tujuan</Text>
                <Text style={[styles.statValue, { color: theme.text }]}>{goalText[profile.goal]}</Text>
              </View>
              <View style={[styles.statRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Target Per Minggu</Text>
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {profile.weeklyWeightChange !== undefined 
                    ? `${profile.weeklyWeightChange > 0 ? '+' : ''}${profile.weeklyWeightChange} kg/minggu`
                    : 'Tidak diatur'
                  }
                </Text>
              </View>
              <View style={[styles.statRow, { borderBottomWidth: 0 }]}>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Tingkat Aktivitas</Text>
                <Text style={[styles.statValue, { color: theme.text }]}>{activityText[profile.activityLevel]}</Text>
              </View>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <Flame size={20} color={theme.primary} />
                <Text style={[styles.cardTitle, { color: theme.text }]}>Target Harian</Text>
              </View>
            </View>

            <View style={styles.profileStats}>
              <View style={[styles.statRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Kalori</Text>
                <Text style={[styles.statValue, { color: theme.text }]}>{dailyTargets.calories} kcal</Text>
              </View>
              <View style={[styles.statRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Protein</Text>
                <Text style={[styles.statValue, { color: theme.text }]}>{dailyTargets.protein}g</Text>
              </View>
              <View style={[styles.statRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Karbo</Text>
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {dailyTargets.carbsMin}-{dailyTargets.carbsMax}g
                </Text>
              </View>
              <View style={[styles.statRow, { borderBottomWidth: 0 }]}>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Lemak</Text>
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {dailyTargets.fatMin}-{dailyTargets.fatMax}g
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <Bookmark size={20} color={theme.primary} />
                <Text style={[styles.cardTitle, { color: theme.text }]}>Makanan Favorit</Text>
              </View>
              {favorites.length > 0 && (
                <Text style={[styles.favoriteCount, { color: theme.textSecondary }]}>{favorites.length} item</Text>
              )}
            </View>

            {favorites.length === 0 ? (
              <View style={styles.emptyFavorites}>
                <Star size={32} color={theme.textTertiary} />
                <Text style={[styles.emptyFavoritesText, { color: theme.textSecondary }]}>Belum ada favorit</Text>
                <Text style={[styles.emptyFavoritesSubtext, { color: theme.textTertiary }]}>Simpan makanan dari detail untuk akses cepat</Text>
              </View>
            ) : (
              <View style={styles.favoritesList}>
                {favorites.map((favorite, index) => (
                  <View
                    key={favorite.id}
                    style={[
                      styles.favoriteItem,
                      { borderBottomColor: theme.border },
                      index === favorites.length - 1 && { borderBottomWidth: 0 }
                    ]}
                  >
                    <View style={styles.favoriteInfo}>
                      <Text style={[styles.favoriteName, { color: theme.text }]} numberOfLines={1}>
                        {favorite.name.split(',')[0]}
                      </Text>
                      <Text style={[styles.favoriteCalories, { color: theme.textSecondary }]}>
                        {favorite.calories} kcal • {favorite.protein}g protein
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.deleteButton, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        removeFromFavorites(favorite.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <Trash2 size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.editButton, { backgroundColor: theme.primary }]}
            onPress={handleEditProfile}
            activeOpacity={0.8}
          >
            <Text style={styles.editButtonText}>Edit Profil</Text>
          </TouchableOpacity>

          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <FileText size={20} color={theme.primary} />
                <Text style={[styles.cardTitle, { color: theme.text }]}>Legal</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.row}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <FileText size={20} color={theme.textSecondary} />
                <Text style={[styles.rowLabel, { color: theme.text }]}>Ketentuan Layanan</Text>
              </View>
              <ChevronRight size={20} color={theme.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.row, { borderTopColor: theme.border }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <Shield size={20} color={theme.textSecondary} />
                <Text style={[styles.rowLabel, { color: theme.text }]}>Kebijakan Privasi</Text>
              </View>
              <ChevronRight size={20} color={theme.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.row, { borderTopColor: theme.border }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <RefreshCw size={20} color={theme.textSecondary} />
                <Text style={[styles.rowLabel, { color: theme.text }]}>Pulihkan Pembelian</Text>
              </View>
              <ChevronRight size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.bottomPadding} />
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerSection: {
    paddingTop: 58,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  greeting: {
    fontSize: 30,
    fontWeight: '900' as const,
    marginBottom: 4,
  },
  scrollContent: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingTop: 0,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
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
  cardHeader: {
    marginBottom: 16,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
  },
  statusRow: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '500' as const,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowValue: {
    fontSize: 15,
  },
  themeModeText: {
    fontSize: 15,
    marginRight: 8,
  },
  profileStats: {
    gap: 0,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  statLabel: {
    fontSize: 15,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  editButton: {
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  bottomPadding: {
    height: 40,
  },
  favoriteCount: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  emptyFavorites: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyFavoritesText: {
    fontSize: 15,
    fontWeight: '600' as const,
    marginTop: 4,
  },
  emptyFavoritesSubtext: {
    fontSize: 13,
    textAlign: 'center',
  },
  favoritesList: {
    gap: 0,
  },
  favoriteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  favoriteInfo: {
    flex: 1,
    marginRight: 12,
  },
  favoriteName: {
    fontSize: 15,
    fontWeight: '600' as const,
    marginBottom: 2,
  },
  favoriteCalories: {
    fontSize: 13,
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
