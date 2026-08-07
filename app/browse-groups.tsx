import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCommunity } from '@/contexts/CommunityContext';
import { useNutrition } from '@/contexts/NutritionContext';
import { supabase } from '@/lib/supabase';
import { normalizeGroupInviteCode } from '@/lib/groupInviteLink';
import {
  stashPendingGroupInviteCode,
  consumePendingGroupInviteCode,
  peekPendingGroupInviteCode,
} from '@/lib/pendingGroupInviteCode';
import { Ticket, ArrowRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export default function BrowseGroupsScreen() {
  const { theme } = useTheme();
  const { l } = useLanguage();
  const { joinGroupAsync, hasProfile, isLoading: communityLoading } = useCommunity();
  const { authState, authInitialized } = useNutrition();
  const headerHeight = useHeaderHeight();
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const [inviteCode, setInviteCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const shouldAutoJoinRef = useRef(false);
  const autoJoinAttemptedRef = useRef(false);
  const redirectedForGateRef = useRef(false);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/community');
  }, []);

  // Prefill from deep link or a stored pending code
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rawParam = typeof params.code === 'string' ? params.code : params.code?.[0];
      const fromParam = normalizeGroupInviteCode(rawParam ?? '');
      if (fromParam) {
        shouldAutoJoinRef.current = true;
        try {
          await stashPendingGroupInviteCode(fromParam);
        } catch {
          // ignore storage failures
        }
        if (!cancelled) setInviteCode(fromParam);
        return;
      }

      try {
        const pending = await peekPendingGroupInviteCode();
        if (pending && !cancelled) {
          shouldAutoJoinRef.current = true;
          setInviteCode(pending);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.code]);

  const joinWithCode = useCallback(async (codeRaw: string) => {
    const code = normalizeGroupInviteCode(codeRaw);
    if (!code) {
      Alert.alert(l('Kode Kosong', 'Empty Code'), l('Masukkan kode undangan grup.', 'Enter the group invite code.'));
      return;
    }
    if (!authState.isSignedIn) {
      try {
        await stashPendingGroupInviteCode(code);
      } catch {
        // ignore
      }
      if (!redirectedForGateRef.current) {
        redirectedForGateRef.current = true;
        Alert.alert(
          l('Masuk Diperlukan', 'Sign In Required'),
          l('Silakan masuk terlebih dahulu untuk bergabung ke grup.', 'Please sign in first to join the group.'),
          [{ text: 'OK', onPress: () => router.push('/sign-in') }]
        );
      }
      return;
    }
    if (communityLoading) return;
    if (!hasProfile) {
      try {
        await stashPendingGroupInviteCode(code);
      } catch {
        // ignore
      }
      if (!redirectedForGateRef.current) {
        redirectedForGateRef.current = true;
        Alert.alert(
          l('Profil Komunitas', 'Community Profile'),
          l('Silakan lengkapi profil komunitas terlebih dahulu.', 'Please complete your community profile first.'),
          [{ text: 'OK', onPress: () => router.push('/setup-community-profile') }]
        );
      }
      return;
    }

    setIsJoining(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const { data, error } = await supabase
        .from('community_groups')
        .select('id')
        .eq('invite_code', code)
        .maybeSingle();
      if (error) throw error;
      if (!data?.id) {
        Alert.alert(l('Kode Tidak Ditemukan', 'Code Not Found'), l('Kode grup tidak valid. Coba cek lagi.', 'Group code is invalid. Please check again.'));
        return;
      }

      await joinGroupAsync(data.id);
      try {
        await consumePendingGroupInviteCode();
      } catch {
        // ignore
      }
      Alert.alert(l('Berhasil', 'Success'), l('Kamu berhasil bergabung ke grup.', 'You joined the group successfully.'));
      handleBack();
    } catch (error) {
      console.error('Join group by code error:', error);
      if (error instanceof Error) {
        Alert.alert(l('Gagal Gabung Grup', 'Failed to Join Group'), error.message || l('Terjadi kesalahan saat memproses kode.', 'An error occurred while processing the code.'));
      } else {
        Alert.alert(l('Gagal Gabung Grup', 'Failed to Join Group'), l('Terjadi kesalahan saat memproses kode.', 'An error occurred while processing the code.'));
      }
    } finally {
      setIsJoining(false);
    }
  }, [authState.isSignedIn, communityLoading, hasProfile, joinGroupAsync, handleBack, l]);

  const handleJoinByCode = useCallback(async () => {
    await joinWithCode(inviteCode);
  }, [inviteCode, joinWithCode]);

  // Auto-join when opened via invite link (or resumed pending code)
  useEffect(() => {
    if (!shouldAutoJoinRef.current || autoJoinAttemptedRef.current) return;
    if (!authInitialized || communityLoading || isJoining) return;
    const code = normalizeGroupInviteCode(inviteCode);
    if (!code) return;

    // Wait until gated user completes sign-in / community profile before joining
    if (!authState.isSignedIn) {
      if (!redirectedForGateRef.current) {
        redirectedForGateRef.current = true;
        void joinWithCode(code);
      }
      return;
    }

    if (!hasProfile) {
      if (!redirectedForGateRef.current) {
        redirectedForGateRef.current = true;
        void joinWithCode(code);
      }
      return;
    }

    autoJoinAttemptedRef.current = true;
    void joinWithCode(code);
  }, [
    authInitialized,
    communityLoading,
    isJoining,
    inviteCode,
    authState.isSignedIn,
    hasProfile,
    joinWithCode,
  ]);

  return (
    <>
      <Stack.Screen
        options={{
          title: l('Cari Grup', 'Find Group'),
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
        style={[styles.container, { backgroundColor: theme.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={headerHeight}
      >
        <ScrollView
          contentContainerStyle={styles.codeSection}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          bounces={false}
        >
          <View style={[styles.codeCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.codeIconWrap, { backgroundColor: theme.primary + '12' }]}>
              <Ticket size={34} color={theme.primary} />
            </View>
            <Text style={[styles.codeTitle, { color: theme.text }]}>{l('Gabung Dengan Kode', 'Join With Code')}</Text>
            <Text style={[styles.codeDesc, { color: theme.textSecondary }]}>
              {l(
                'Masukkan kode undangan atau buka link undangan dari admin grup untuk bergabung.',
                'Enter an invite code or open an invite link from the group admin to join.'
              )}
            </Text>
            <View style={[styles.codeInputWrap, { borderColor: theme.border }]}>
              <TextInput
                style={[styles.codeInput, { color: theme.text }]}
                value={inviteCode}
                onChangeText={(text) => setInviteCode(normalizeGroupInviteCode(text))}
                placeholder={l('ABC123', 'ABC123')}
                placeholderTextColor={theme.textTertiary}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={6}
                returnKeyType="done"
              />
            </View>
            <TouchableOpacity
              style={[styles.joinCodeBtn, { backgroundColor: theme.primary }]}
              onPress={handleJoinByCode}
              activeOpacity={0.8}
              disabled={isJoining}
            >
              <Text style={[styles.joinCodeBtnText, { color: '#FFFFFF' }]}>
                {isJoining ? l('Menggabungkan...', 'Joining...') : l('Gabung Grup', 'Join Group')}
              </Text>
              {!isJoining ? <ArrowRight size={18} color="#FFFFFF" /> : null}
            </TouchableOpacity>
          </View>
        </ScrollView>
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
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
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
  headerBackBtn: {
    paddingVertical: 6,
    paddingRight: 8,
  },
  headerBackText: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
});
