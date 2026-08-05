import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { User, Settings as SettingsIcon, LogIn, LogOut, Globe, Moon, Sun, ChevronRight, UserCircle, Target, Flame, FileText, Shield, RefreshCw, Gift, UserX, Bell } from 'lucide-react-native';
import { useNutrition } from '@/contexts/NutritionContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCommunity } from '@/contexts/CommunityContext';
import { useNotifications } from '@/contexts/NotificationContext';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { deleteAccountViaBackend } from '@/utils/accountDeletion';

export default function ProfileScreen() {
  const { profile, dailyTargets, authState, signOut, signOutAfterAccountDeleted } = useNutrition();
  const { theme, themeMode, toggleTheme } = useTheme();
  const { language, t, l } = useLanguage();
  const { communityProfile, hasProfile } = useCommunity();
  const {
    settings: notificationSettings,
    enableNotifications,
    disableNotifications,
    isLoading: notificationsLoading,
  } = useNotifications();
  const insets = useSafeAreaInsets();
  const [deletingAccount, setDeletingAccount] = useState(false);

  const mapDeleteAccountError = (result: { error: string; status?: number; code?: string }) => {
    if (result.code === 'not_signed_in') {
      return l('Sesi login sudah berakhir. Silakan login ulang lalu coba lagi.', 'Your session has ended. Please sign in again and try again.');
    }
    if (result.code === 'account_deletion_disabled' || result.status === 503) {
      return l(
        'Fitur hapus akun belum aktif di server. Pastikan backend memiliki SUPABASE_SERVICE_ROLE_KEY.',
        'Account deletion is not enabled on the server yet. Ensure backend has SUPABASE_SERVICE_ROLE_KEY.'
      );
    }
    if (result.code === 'backend_route_not_found' || result.status === 404) {
      return l(
        'Endpoint hapus akun belum tersedia di server. Deploy backend terbaru dan pastikan route /api/account/delete aktif.',
        'Account deletion endpoint is not available on the server yet. Deploy the latest backend and ensure /api/account/delete is active.'
      );
    }
    if (result.code === 'timeout' || result.code === 'network_error') {
      return l('Koneksi ke server gagal. Coba lagi saat internet stabil.', 'Could not reach the server. Please try again with a stable connection.');
    }
    if (result.code === 'invalid_or_expired_session' || result.status === 401) {
      return l('Sesi login tidak valid. Login ulang lalu coba hapus akun lagi.', 'Your login session is invalid. Sign in again and retry account deletion.');
    }
    return result.error || l('Terjadi kesalahan. Coba lagi.', 'Something went wrong. Please try again.');
  };

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
    router.replace('/sign-in');
  };

  const handleSignOut = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      t.profile.signOutTitle,
      t.profile.signOutMessage,
      [
        { text: t.profile.cancel, style: 'cancel' },
        {
          text: t.profile.signOut,
          style: 'destructive',
          onPress: () => signOut(),
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

  const handleCommunityProfile = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/setup-community-profile');
  };

  const handleReferralShare = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/referral-share');
  };

  const handleDeleteAccount = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      l('Hapus akun', 'Delete account'),
      l(
        'Akun dan data Anda akan dihapus permanen dari DietKu. Ini tidak bisa dibatalkan. Lanjutkan?',
        'Your account and data will be permanently removed from DietKu. This cannot be undone. Continue?'
      ),
      [
        { text: l('Batal', 'Cancel'), style: 'cancel' },
        {
          text: l('Hapus', 'Delete'),
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              l('Konfirmasi terakhir', 'Final confirmation'),
              l(
                'Ketuk Hapus permanen untuk menghapus akun Anda sekarang.',
                'Tap Permanently delete to remove your account now.'
              ),
              [
                { text: l('Batal', 'Cancel'), style: 'cancel' },
                {
                  text: l('Hapus permanen', 'Permanently delete'),
                  style: 'destructive',
                  onPress: async () => {
                    if (deletingAccount) return;
                    setDeletingAccount(true);
                    try {
                      const result = await deleteAccountViaBackend();
                      if (!result.ok) {
                        Alert.alert(
                          l('Gagal menghapus akun', 'Could not delete account'),
                          mapDeleteAccountError(result),
                          [{ text: 'OK' }]
                        );
                        return;
                      }
                      await signOutAfterAccountDeleted();
                    } finally {
                      setDeletingAccount(false);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.headerSection, { paddingTop: insets.top + 16 }]}>
          <Text style={[styles.greeting, { color: theme.text }]}>{t.profile.title}</Text>
        </View>

        <ScrollView style={styles.scrollContent} contentContainerStyle={styles.content}>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <UserCircle size={20} color={theme.primary} />
                <Text style={[styles.cardTitle, { color: theme.text }]}>{t.profile.account}</Text>
              </View>
            </View>

            {authState.isSignedIn ? (
              <>
                <View style={[styles.statusRow, { backgroundColor: theme.background }]}>
                  <Text style={[styles.statusText, { color: theme.textSecondary }]}>{t.profile.connectedAs}: {authState.email}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.row, { borderTopColor: theme.border }]}
                  onPress={handleReferralShare}
                  activeOpacity={0.7}
                >
                  <View style={styles.rowLeft}>
                    <Gift size={20} color={theme.primary} />
                    <Text style={[styles.rowLabel, { color: theme.text }]}>{t.profile.invites}</Text>
                  </View>
                  <ChevronRight size={20} color={theme.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.row, { borderTopColor: theme.border }]}
                  onPress={handleSignOut}
                  activeOpacity={0.7}
                >
                  <View style={styles.rowLeft}>
                    <LogOut size={20} color={theme.textSecondary} />
                    <Text style={[styles.rowLabel, { color: theme.text }]}>{t.profile.signOut}</Text>
                  </View>
                  <ChevronRight size={20} color={theme.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.row, { borderTopColor: theme.border }]}
                  onPress={handleDeleteAccount}
                  activeOpacity={0.7}
                  disabled={deletingAccount}
                >
                  <View style={styles.rowLeft}>
                    {deletingAccount ? (
                      <ActivityIndicator size="small" color="#C53030" />
                    ) : (
                      <UserX size={20} color="#C53030" />
                    )}
                    <Text style={[styles.rowLabel, { color: '#C53030' }]}>
                      {l('Hapus akun', 'Delete account')}
                    </Text>
                  </View>
                  <ChevronRight size={20} color={theme.textSecondary} />
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={[styles.statusRow, { backgroundColor: theme.background }]}>
                  <Text style={[styles.statusText, { color: theme.textSecondary }]}>{t.profile.notSignedIn}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.row, { borderTopColor: theme.border }]}
                  onPress={handleSignIn}
                  activeOpacity={0.7}
                >
                  <View style={styles.rowLeft}>
                    <LogIn size={20} color={theme.primary} />
                    <Text style={[styles.rowLabel, { color: theme.text }]}>{t.profile.signIn}</Text>
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
                <Text style={[styles.cardTitle, { color: theme.text }]}>{t.profile.settings}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.row}
              onPress={handleLanguagePress}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <Globe size={20} color={theme.textSecondary} />
                <Text style={[styles.rowLabel, { color: theme.text }]}>{t.profile.language}</Text>
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
                <Text style={[styles.rowLabel, { color: theme.text }]}>{t.profile.theme}</Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={[styles.themeModeText, { color: theme.textSecondary }]}>{t.profile.darkMode}</Text>
                <Switch
                  value={themeMode === 'dark'}
                  onValueChange={handleToggleTheme}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            <View style={[styles.row, { borderTopColor: theme.border }]}>
              <View style={styles.rowLeft}>
                <Bell size={20} color={theme.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowLabel, { color: theme.text }]}>
                    {l('Notifikasi', 'Notifications')}
                  </Text>
                  <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
                    {l(
                      'Pengingat scan harian & update grup',
                      'Daily scan reminders & group updates'
                    )}
                  </Text>
                </View>
              </View>
              <Switch
                value={notificationSettings.enabled && notificationSettings.permissionGranted}
                disabled={notificationsLoading}
                onValueChange={(value) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (value) {
                    void enableNotifications();
                  } else {
                    void disableNotifications();
                  }
                }}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <User size={20} color={theme.primary} />
                <Text style={[styles.cardTitle, { color: theme.text }]}>{t.profile.personalInfo}</Text>
              </View>
            </View>

            <View style={styles.profileStats}>
              {profile.name && (
                <View style={[styles.statRow, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t.profile.name}</Text>
                  <Text style={[styles.statValue, { color: theme.text }]}>{profile.name}</Text>
                </View>
              )}
              <View style={[styles.statRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t.profile.age}</Text>
                <Text style={[styles.statValue, { color: theme.text }]}>{profile.age} {t.profile.yearsSuffix}</Text>
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
                <User size={20} color={theme.primary} />
                <Text style={[styles.cardTitle, { color: theme.text }]}>Profil Komunitas</Text>
              </View>
            </View>

            {hasProfile && communityProfile ? (
              <View style={styles.profileStats}>
                <View style={[styles.statRow, { borderBottomWidth: 0 }]}>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Username</Text>
                  <Text style={[styles.statValue, { color: theme.text }]}>@{communityProfile.username}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.emptyFavorites}>
                <Text style={[styles.emptyFavoritesText, { color: theme.textSecondary }]}>Belum ada profil komunitas</Text>
                <Text style={[styles.emptyFavoritesSubtext, { color: theme.textTertiary }]}>Buat profil untuk berinteraksi di komunitas</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.editButton, { backgroundColor: theme.primary, marginTop: 12 }]}
              onPress={handleCommunityProfile}
              activeOpacity={0.8}
            >
              <Text style={styles.editButtonText}>
                {hasProfile ? 'Edit Profil Komunitas' : 'Buat Profil Komunitas'}
              </Text>
            </TouchableOpacity>
          </View>

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
                router.push('/legal-terms');
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
                router.push('/legal-privacy');
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
                router.push('/legal-restore-purchase');
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
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  greeting: {
    fontSize: 26,
    fontWeight: '800' as const,
    marginBottom: 4,
    letterSpacing: -0.5,
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
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
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
    fontSize: 15,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  statusRow: {
    padding: 10,
    borderRadius: 8,
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
    fontSize: 15,
    fontWeight: '700' as const,
  },
  editButton: {
    borderRadius: 20,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    letterSpacing: 0.2,
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
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
