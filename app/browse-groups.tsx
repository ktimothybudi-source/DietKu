import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useCommunity } from '@/contexts/CommunityContext';
import { useNutrition } from '@/contexts/NutritionContext';
import { CommunityGroup } from '@/types/community';
import { Search, Users, Lock, Globe, Ticket, ArrowRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export default function BrowseGroupsScreen() {
  const { theme } = useTheme();
  const { discoverableGroups, joinGroup, findGroupByInviteCode, hasProfile, joinedGroupIds } = useCommunity();
  const { authState } = useNutrition();

  const [search, setSearch] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [activeTab, setActiveTab] = useState<'browse' | 'code'>('browse');

  const filteredGroups = search.trim()
    ? discoverableGroups.filter(g =>
        g.name.toLowerCase().includes(search.toLowerCase()) ||
        g.description.toLowerCase().includes(search.toLowerCase())
      )
    : discoverableGroups;

  const handleJoin = useCallback((groupId: string) => {
    console.log('browse-groups:join', groupId);
    if (!authState.isSignedIn) {
      Alert.alert('Masuk Diperlukan', 'Silakan masuk terlebih dahulu.', [
        { text: 'Batal', style: 'cancel' },
        { text: 'Masuk', onPress: () => router.push('/sign-in') },
      ]);
      return;
    }
    if (!hasProfile) {
      router.push('/setup-community-profile');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    joinGroup(groupId);
    Alert.alert('Berhasil!', 'Kamu sudah bergabung ke grup.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  }, [authState.isSignedIn, hasProfile, joinGroup]);

  const handleJoinByCode = useCallback(() => {
    console.log('browse-groups:join-by-code', inviteCode);
    const code = inviteCode.trim().toUpperCase();
    if (!code || code.length < 4) {
      Alert.alert('Kode Tidak Valid', 'Masukkan kode undangan yang valid.');
      return;
    }
    if (!authState.isSignedIn) {
      Alert.alert('Masuk Diperlukan', 'Silakan masuk terlebih dahulu.', [
        { text: 'Batal', style: 'cancel' },
        { text: 'Masuk', onPress: () => router.push('/sign-in') },
      ]);
      return;
    }
    if (!hasProfile) {
      router.push('/setup-community-profile');
      return;
    }

    const group = findGroupByInviteCode(code);
    if (!group) {
      Alert.alert('Grup Tidak Ditemukan', 'Kode undangan tidak cocok dengan grup manapun. Pastikan kode sudah benar.');
      return;
    }
    if (joinedGroupIds.includes(group.id)) {
      Alert.alert('Sudah Bergabung', 'Kamu sudah menjadi anggota grup ini.');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    joinGroup(group.id);
    Alert.alert('Berhasil!', `Kamu bergabung ke "${group.name}"!`, [
      { text: 'OK', onPress: () => router.back() },
    ]);
  }, [inviteCode, authState.isSignedIn, hasProfile, findGroupByInviteCode, joinedGroupIds, joinGroup]);

  const renderGroup = useCallback(({ item }: { item: CommunityGroup }) => (
    <View style={[styles.groupCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Image source={{ uri: item.coverImage }} style={styles.groupCover} />
      <View style={styles.groupInfo}>
        <View style={styles.groupTitleRow}>
          <Text style={[styles.groupName, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
          {item.privacy === 'private' ? (
            <Lock size={13} color={theme.textTertiary} />
          ) : (
            <Globe size={13} color={theme.success} />
          )}
        </View>
        <Text style={[styles.groupDesc, { color: theme.textSecondary }]} numberOfLines={2}>
          {item.description}
        </Text>
        <View style={styles.groupMeta}>
          <Users size={13} color={theme.textTertiary} />
          <Text style={[styles.groupMembers, { color: theme.textTertiary }]}>
            {item.members.length} anggota
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={[styles.joinBtn, { backgroundColor: theme.primary }]}
        onPress={() => handleJoin(item.id)}
        activeOpacity={0.8}
        testID={`join-group-${item.id}`}
      >
        <Text style={styles.joinBtnText}>Gabung</Text>
      </TouchableOpacity>
    </View>
  ), [theme, handleJoin]);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Cari Grup',
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerShadowVisible: false,
        }}
      />

      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[
              styles.tabBtn,
              { borderColor: theme.border },
              activeTab === 'browse' && { backgroundColor: theme.primary, borderColor: theme.primary },
            ]}
            onPress={() => setActiveTab('browse')}
            activeOpacity={0.8}
          >
            <Search size={14} color={activeTab === 'browse' ? '#FFFFFF' : theme.textSecondary} />
            <Text style={[
              styles.tabText,
              { color: activeTab === 'browse' ? '#FFFFFF' : theme.textSecondary },
            ]}>Jelajahi</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabBtn,
              { borderColor: theme.border },
              activeTab === 'code' && { backgroundColor: theme.primary, borderColor: theme.primary },
            ]}
            onPress={() => setActiveTab('code')}
            activeOpacity={0.8}
          >
            <Ticket size={14} color={activeTab === 'code' ? '#FFFFFF' : theme.textSecondary} />
            <Text style={[
              styles.tabText,
              { color: activeTab === 'code' ? '#FFFFFF' : theme.textSecondary },
            ]}>Kode Undangan</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'browse' ? (
          <>
            <View style={[styles.searchWrap, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <Search size={18} color={theme.textTertiary} />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder="Cari grup..."
                placeholderTextColor={theme.textTertiary}
                value={search}
                onChangeText={setSearch}
                testID="browse-groups-search"
              />
            </View>

            <FlatList
              data={filteredGroups}
              renderItem={renderGroup}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Users size={40} color={theme.textTertiary} />
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>
                    {search ? 'Tidak Ada Hasil' : 'Belum Ada Grup Publik'}
                  </Text>
                  <Text style={[styles.emptyDesc, { color: theme.textSecondary }]}>
                    {search
                      ? 'Coba kata kunci lain atau gabung lewat kode undangan.'
                      : 'Buat grup pertama atau gabung lewat kode undangan.'}
                  </Text>
                </View>
              }
            />
          </>
        ) : (
          <View style={styles.codeSection}>
            <View style={[styles.codeCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={[styles.codeIconWrap, { backgroundColor: theme.primary + '12' }]}>
                <Ticket size={32} color={theme.primary} strokeWidth={1.5} />
              </View>
              <Text style={[styles.codeTitle, { color: theme.text }]}>Punya Kode Undangan?</Text>
              <Text style={[styles.codeDesc, { color: theme.textSecondary }]}>
                Masukkan kode 6 digit yang diberikan admin grup untuk bergabung langsung.
              </Text>

              <View style={[styles.codeInputWrap, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                <TextInput
                  style={[styles.codeInput, { color: theme.text }]}
                  value={inviteCode}
                  onChangeText={(t) => setInviteCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  placeholder="XXXXXX"
                  placeholderTextColor={theme.textTertiary}
                  maxLength={6}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  testID="invite-code-input"
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.joinCodeBtn,
                  { backgroundColor: inviteCode.length >= 4 ? theme.primary : theme.border },
                ]}
                onPress={handleJoinByCode}
                activeOpacity={0.8}
                disabled={inviteCode.length < 4}
                testID="join-by-code-btn"
              >
                <Text style={[
                  styles.joinCodeBtnText,
                  { color: inviteCode.length >= 4 ? '#FFFFFF' : theme.textTertiary },
                ]}>Gabung Grup</Text>
                <ArrowRight size={16} color={inviteCode.length >= 4 ? '#FFFFFF' : theme.textTertiary} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 10,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  searchWrap: {
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    gap: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 12,
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },
  groupCover: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  groupInfo: {
    flex: 1,
  },
  groupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  groupName: {
    fontSize: 15,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
    flex: 1,
  },
  groupDesc: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  groupMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
  },
  groupMembers: {
    fontSize: 12,
  },
  joinBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
  },
  joinBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700' as const,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    marginTop: 8,
  },
  emptyDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  codeSection: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  codeCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  codeIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  codeTitle: {
    fontSize: 19,
    fontWeight: '800' as const,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  codeDesc: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 24,
  },
  codeInputWrap: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  codeInput: {
    fontSize: 24,
    fontWeight: '800' as const,
    textAlign: 'center',
    paddingVertical: 16,
    letterSpacing: 8,
  },
  joinCodeBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 12,
  },
  joinCodeBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
});
