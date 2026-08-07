import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCommunity } from '@/contexts/CommunityContext';
import { GroupMember } from '@/types/community';
import { buildGroupInviteLink } from '@/lib/groupInviteLink';
import { buildGroupInviteShareCopy, shareGroupInvite } from '@/lib/shareGroupInvite';
import {
  Copy,
  Share2,
  LogOut,
  Users,
  Shield,
  Crown,
  Lock,
  Globe,
  Pencil,
  Check,
  X,
  Link2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (Platform.OS === 'web') {
      const navigatorAny = (globalThis as { navigator?: { clipboard?: { writeText?: (value: string) => Promise<void> } } }).navigator;
      if (navigatorAny?.clipboard?.writeText) {
        await navigatorAny.clipboard.writeText(text);
        return true;
      }
      return false;
    }
    const Clipboard = await import('expo-clipboard');
    await Clipboard.setStringAsync(text);
    return true;
  } catch (error) {
    console.error('Clipboard error:', error);
    return false;
  }
};

export default function GroupSettingsScreen() {
  const { theme } = useTheme();
  const { l } = useLanguage();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { allGroups, leaveGroup, updateGroupName, communityProfile } = useCommunity();
  const headerHeight = useHeaderHeight();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/community');
  }, []);

  const group = useMemo(() => {
    return allGroups.find(g => g.id === groupId) || null;
  }, [allGroups, groupId]);

  useEffect(() => {
    if (group) setEditName(group.name);
  }, [group?.id, group?.name]);

  const handleStartEditName = useCallback(() => {
    if (!group) return;
    setEditName(group.name);
    setIsEditingName(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [group]);

  const handleCancelEditName = useCallback(() => {
    if (group) setEditName(group.name);
    setIsEditingName(false);
  }, [group]);

  const handleSaveGroupName = useCallback(async () => {
    if (!group || isSavingName) return;
    const trimmed = editName.trim();
    if (trimmed.length < 3) {
      Alert.alert(
        l('Nama Terlalu Pendek', 'Name Too Short'),
        l('Nama grup minimal 3 karakter.', 'Group name must be at least 3 characters.')
      );
      return;
    }
    if (trimmed.length > 60) {
      Alert.alert(
        l('Nama Terlalu Panjang', 'Name Too Long'),
        l('Nama grup maksimal 60 karakter.', 'Group name must be at most 60 characters.')
      );
      return;
    }
    if (trimmed === group.name) {
      setIsEditingName(false);
      return;
    }
    try {
      setIsSavingName(true);
      await updateGroupName(group.id, trimmed);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsEditingName(false);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      const message =
        code === 'GROUP_NAME_TOO_SHORT'
          ? l('Nama grup minimal 3 karakter.', 'Group name must be at least 3 characters.')
          : code === 'GROUP_NAME_TOO_LONG'
            ? l('Nama grup maksimal 60 karakter.', 'Group name must be at most 60 characters.')
            : l('Gagal mengubah nama grup. Coba lagi.', 'Failed to update group name. Please try again.');
      Alert.alert(l('Gagal', 'Failed'), message);
    } finally {
      setIsSavingName(false);
    }
  }, [group, editName, isSavingName, updateGroupName, l]);

  const handleCopyCode = useCallback(async () => {
    if (!group) return;
    console.log('group-settings:copy-code', group.inviteCode);
    const copied = await copyToClipboard(group.inviteCode);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (copied) {
      Alert.alert(l('Kode Disalin!', 'Code Copied!'), l(`Kode undangan "${group.inviteCode}" sudah disalin. Bagikan ke teman untuk mengundang mereka.`, `Invite code "${group.inviteCode}" copied. Share it with your friends.`));
    } else {
      Alert.alert(l('Kode Undangan', 'Invite Code'), l(`Kode: ${group.inviteCode}\n\nBagikan kode ini ke teman untuk mengundang mereka ke grup.`, `Code: ${group.inviteCode}\n\nShare this code with your friends to invite them.`));
    }
  }, [group, l]);

  const handleCopyLink = useCallback(async () => {
    if (!group) return;
    const inviteLink = buildGroupInviteLink(group.inviteCode);
    const copy = buildGroupInviteShareCopy(group.name, group.inviteCode, l);
    console.log('group-settings:copy-link', inviteLink);
    const copied = await copyToClipboard(inviteLink);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (copied) {
      Alert.alert(copy.copiedTitle, copy.copiedBody);
    } else {
      Alert.alert(l('Link Undangan', 'Invite Link'), inviteLink);
    }
  }, [group, l]);

  const handleShareInvite = useCallback(async () => {
    if (!group) return;
    console.log('group-settings:share-invite', group.inviteCode, buildGroupInviteLink(group.inviteCode));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = await shareGroupInvite({
        groupName: group.name,
        inviteCode: group.inviteCode,
        l,
        copyToClipboard,
      });
      if (result === 'copied') {
        const copy = buildGroupInviteShareCopy(group.name, group.inviteCode, l);
        Alert.alert(copy.copiedTitle, copy.copiedBody);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.startsWith('Gabung ke grup') || msg.startsWith('Join the group')) {
        Alert.alert(l('Undangan', 'Invite'), msg);
        return;
      }
      console.log('Share cancelled or failed:', e);
    }
  }, [group, l]);

  const handleLeaveGroup = useCallback(() => {
    if (!group) return;
    console.log('group-settings:leave', group.id);
    Alert.alert(
      l('Keluar dari Grup?', 'Leave Group?'),
      l(`Kamu yakin ingin keluar dari "${group.name}"? Kamu bisa bergabung kembali nanti.`, `Are you sure you want to leave "${group.name}"? You can rejoin later.`),
      [
        { text: l('Batal', 'Cancel'), style: 'cancel' },
        {
          text: l('Keluar', 'Leave'),
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            leaveGroup(group.id);
            handleBack();
          },
        },
      ]
    );
  }, [group, leaveGroup, handleBack, l]);

  if (!group) {
    return (
      <>
        <Stack.Screen
          options={{
            title: l('Pengaturan Grup', 'Group Settings'),
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
        <View style={[styles.container, { backgroundColor: theme.background }]}>
          <View style={styles.errorState}>
            <Text style={[styles.errorText, { color: theme.textSecondary }]}>{l('Grup tidak ditemukan', 'Group not found')}</Text>
          </View>
        </View>
      </>
    );
  }

  const renderMember = (member: GroupMember, index: number) => {
    const initials = member.displayName
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    return (
      <View key={member.userId + index} style={[styles.memberRow, { borderColor: theme.border }]}>
        <View style={[styles.memberAvatar, { backgroundColor: member.avatarColor }]}>
          <Text style={styles.memberAvatarText}>{initials}</Text>
        </View>
        <View style={styles.memberInfo}>
          <Text style={[styles.memberName, { color: theme.text }]}>{member.displayName}</Text>
          <Text style={[styles.memberUsername, { color: theme.textTertiary }]}>@{member.username}</Text>
        </View>
        {member.role === 'admin' && (
          <View style={[styles.roleBadge, { backgroundColor: theme.warning + '18' }]}>
            <Crown size={12} color={theme.warning} />
            <Text style={[styles.roleBadgeText, { color: theme.warning }]}>Admin</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: l('Pengaturan Grup', 'Group Settings'),
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
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <Image source={{ uri: group.coverImage }} style={styles.coverImage} />

        <View style={styles.groupHeader}>
          {isEditingName ? (
            <View style={styles.nameEditBlock}>
              <TextInput
                style={[
                  styles.nameEditInput,
                  {
                    color: theme.text,
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                  },
                ]}
                value={editName}
                onChangeText={setEditName}
                placeholder={l('Nama grup', 'Group name')}
                placeholderTextColor={theme.textTertiary}
                maxLength={60}
                autoFocus
                editable={!isSavingName}
                testID="group-name-input"
              />
              <View style={styles.nameEditActions}>
                <TouchableOpacity
                  style={[styles.nameEditBtn, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
                  onPress={handleCancelEditName}
                  disabled={isSavingName}
                  activeOpacity={0.7}
                >
                  <X size={18} color={theme.textSecondary} />
                  <Text style={[styles.nameEditBtnText, { color: theme.textSecondary }]}>{l('Batal', 'Cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.nameEditBtn, { backgroundColor: theme.primary }]}
                  onPress={handleSaveGroupName}
                  disabled={isSavingName || !editName.trim()}
                  activeOpacity={0.8}
                  testID="group-name-save"
                >
                  {isSavingName ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Check size={18} color="#FFFFFF" />
                      <Text style={styles.nameEditBtnTextPrimary}>{l('Simpan', 'Save')}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.groupTitleRow}>
              <Text style={[styles.groupName, { color: theme.text, flex: 1 }]} numberOfLines={2}>
                {group.name}
              </Text>
              {group.privacy === 'private' ? (
                <Lock size={16} color={theme.warning} />
              ) : (
                <Globe size={16} color={theme.success} />
              )}
              <TouchableOpacity
                onPress={handleStartEditName}
                style={[styles.editNameIconBtn, { backgroundColor: theme.primary + '18' }]}
                activeOpacity={0.7}
                testID="group-edit-name"
              >
                <Pencil size={16} color={theme.primary} />
              </TouchableOpacity>
            </View>
          )}
          <Text style={[styles.groupDesc, { color: theme.textSecondary }]}>{group.description}</Text>
          <View style={styles.groupStats}>
            <View style={styles.statItem}>
              <Users size={14} color={theme.textTertiary} />
              <Text style={[styles.statText, { color: theme.textTertiary }]}>{group.members.length} {l('anggota', 'members')}</Text>
            </View>
            <View style={styles.statItem}>
              <Shield size={14} color={theme.textTertiary} />
              <Text style={[styles.statText, { color: theme.textTertiary }]}>
                {group.privacy === 'public' ? l('Publik', 'Public') : l('Privat', 'Private')}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.inviteCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{l('Undang Teman', 'Invite Friends')}</Text>
          <Text style={[styles.inviteHint, { color: theme.textSecondary }]}>
            {l(
              'Bagikan link ini. Teman yang tap: buka DietKu kalau sudah punya app, atau diarahkan ke App Store / Play Store.',
              'Share this link. Friends with DietKu open the app; others go to the App Store / Play Store.'
            )}
          </Text>

          <View style={[styles.codeDisplay, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
            <Text style={[styles.codeText, { color: theme.primary }]}>{group.inviteCode}</Text>
          </View>
          <Text
            style={[styles.inviteLinkPreview, { color: theme.textSecondary }]}
            numberOfLines={2}
            selectable
          >
            {buildGroupInviteLink(group.inviteCode)}
          </Text>

          <TouchableOpacity
            style={[styles.shareInvitePrimary, { backgroundColor: theme.success }]}
            onPress={handleShareInvite}
            activeOpacity={0.8}
            testID="group-share-invite"
          >
            <Share2 size={18} color="#FFFFFF" />
            <Text style={styles.inviteBtnText}>{l('Bagikan Link Undangan', 'Share Invite Link')}</Text>
          </TouchableOpacity>

          <View style={styles.inviteActions}>
            <TouchableOpacity
              style={[styles.inviteBtn, { backgroundColor: theme.primary }]}
              onPress={handleCopyCode}
              activeOpacity={0.8}
              testID="group-copy-code"
            >
              <Copy size={16} color="#FFFFFF" />
              <Text style={styles.inviteBtnText}>{l('Salin Kode', 'Copy Code')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.inviteBtn, { backgroundColor: theme.primary }]}
              onPress={handleCopyLink}
              activeOpacity={0.8}
              testID="group-copy-link"
            >
              <Link2 size={16} color="#FFFFFF" />
              <Text style={styles.inviteBtnText}>{l('Salin Link', 'Copy Link')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.membersCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {l('Anggota', 'Members')} ({group.members.length})
          </Text>
          {group.members.map(renderMember)}
        </View>

        <TouchableOpacity
          style={[styles.leaveBtn, { borderColor: theme.destructive }]}
          onPress={handleLeaveGroup}
          activeOpacity={0.8}
          testID="group-leave"
        >
          <LogOut size={18} color={theme.destructive} />
          <Text style={[styles.leaveBtnText, { color: theme.destructive }]}>{l('Keluar dari Grup', 'Leave Group')}</Text>
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
  coverImage: {
    width: '100%',
    height: 160,
  },
  groupHeader: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
  },
  groupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  editNameIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameEditBlock: {
    marginBottom: 8,
  },
  nameEditInput: {
    fontSize: 18,
    fontWeight: '700' as const,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  nameEditActions: {
    flexDirection: 'row',
    gap: 10,
  },
  nameEditBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  nameEditBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  nameEditBtnTextPrimary: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  groupName: {
    fontSize: 22,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  groupDesc: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  groupStats: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statText: {
    fontSize: 13,
  },
  inviteCard: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  inviteHint: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  codeDisplay: {
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 10,
  },
  codeText: {
    fontSize: 28,
    fontWeight: '800' as const,
    letterSpacing: 8,
  },
  inviteLinkPreview: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginBottom: 14,
  },
  shareInvitePrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  inviteActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  inviteBtn: {
    flexGrow: 1,
    flexBasis: '40%',
    minWidth: 120,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
  },
  inviteBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700' as const,
  },
  membersCard: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
    marginBottom: 14,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    gap: 12,
  },
  memberAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  memberUsername: {
    fontSize: 12,
    marginTop: 1,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
  },
  leaveBtn: {
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  leaveBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 15,
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
