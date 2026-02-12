import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Animated,
  RefreshControl,
  Alert,
  TextInput,
} from 'react-native';
import { Stack, router } from 'expo-router';
import {
  Heart,
  MessageCircle,
  Plus,
  Utensils,
  Trash2,
  Clock,
  Link as LinkIcon,
  Trophy,
  Send,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useCommunity } from '@/contexts/CommunityContext';
import { useNutrition } from '@/contexts/NutritionContext';
import { FoodPost, MEAL_TYPE_LABELS } from '@/types/community';
import * as Haptics from 'expo-haptics';

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Baru saja';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

function Avatar({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
}

const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    const navigatorAny = (globalThis as { navigator?: { clipboard?: { writeText?: (value: string) => Promise<void> } } }).navigator;
    if (navigatorAny?.clipboard?.writeText) {
      await navigatorAny.clipboard.writeText(text);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Clipboard error:', error);
    return false;
  }
};

const PostCard = React.memo(({ post, onLike, onComment, onDelete, currentUserId, theme }: {
  post: FoodPost;
  onLike: (id: string) => void;
  onComment: (id: string) => void;
  onDelete: (id: string) => void;
  currentUserId: string | null;
  theme: ReturnType<typeof useTheme>['theme'];
}) => {
  const isLiked = currentUserId ? post.likes.includes(currentUserId) : false;
  const isOwn = currentUserId === post.userId;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isAutoLog = (post as { isAutoLog?: boolean }).isAutoLog ?? !post.caption;

  const handleLike = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.3, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    onLike(post.id);
  }, [post.id, onLike, scaleAnim]);

  const handleDelete = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Hapus Post', 'Yakin ingin menghapus post ini?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: () => onDelete(post.id) },
    ]);
  }, [post.id, onDelete]);

  return (
    <View style={[styles.postCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.postHeader}>
        <TouchableOpacity style={styles.postUserInfo} activeOpacity={0.7} testID={`post-user-${post.id}`}>
          <Avatar name={post.displayName} color={post.avatarColor} size={38} />
          <View style={styles.postUserText}>
            <Text style={[styles.postDisplayName, { color: theme.text }]}>{post.displayName}</Text>
            <View style={styles.postMeta}>
              <Text style={[styles.postUsername, { color: theme.textTertiary }]}>@{post.username}</Text>
              <Text style={[styles.postDot, { color: theme.textTertiary }]}>·</Text>
              <Clock size={11} color={theme.textTertiary} />
              <Text style={[styles.postTime, { color: theme.textTertiary }]}>{timeAgo(post.createdAt)}</Text>
            </View>
          </View>
        </TouchableOpacity>
        {isOwn && (
          <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn} activeOpacity={0.7} testID={`post-delete-${post.id}`}>
            <Trash2 size={16} color={theme.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {post.caption ? (
        <Text style={[styles.postCaption, { color: theme.text }]}>{post.caption}</Text>
      ) : null}

      <View style={[styles.foodCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
        <View style={styles.foodCardHeader}>
          <Utensils size={14} color={theme.primary} />
          <Text style={[styles.foodName, { color: theme.text }]} numberOfLines={1}>{post.foodName}</Text>
          {isAutoLog ? (
            <View style={[styles.autoBadge, { backgroundColor: theme.accent + '18' }]}>
              <Text style={[styles.autoBadgeText, { color: theme.accent }]}>Auto</Text>
            </View>
          ) : null}
          {post.mealType && (
            <View style={[styles.mealBadge, { backgroundColor: theme.primary + '18' }]}>
              <Text style={[styles.mealBadgeText, { color: theme.primary }]}>
                {MEAL_TYPE_LABELS[post.mealType] || post.mealType}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.macroRow}>
          <View style={styles.macroItem}>
            <Text style={[styles.macroValue, { color: theme.text }]}>{post.calories}</Text>
            <Text style={[styles.macroLabel, { color: theme.textTertiary }]}>kcal</Text>
          </View>
          <View style={[styles.macroDivider, { backgroundColor: theme.border }]} />
          <View style={styles.macroItem}>
            <Text style={[styles.macroValue, { color: theme.primary }]}>{post.protein}g</Text>
            <Text style={[styles.macroLabel, { color: theme.textTertiary }]}>Protein</Text>
          </View>
          <View style={[styles.macroDivider, { backgroundColor: theme.border }]} />
          <View style={styles.macroItem}>
            <Text style={[styles.macroValue, { color: theme.accent }]}>{post.carbs}g</Text>
            <Text style={[styles.macroLabel, { color: theme.textTertiary }]}>Karbo</Text>
          </View>
          <View style={[styles.macroDivider, { backgroundColor: theme.border }]} />
          <View style={styles.macroItem}>
            <Text style={[styles.macroValue, { color: theme.warning }]}>{post.fat}g</Text>
            <Text style={[styles.macroLabel, { color: theme.textTertiary }]}>Lemak</Text>
          </View>
        </View>
      </View>

      <View style={styles.postActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleLike} activeOpacity={0.7} testID={`post-like-${post.id}`}>
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <Heart
              size={19}
              color={isLiked ? '#E53E3E' : theme.textTertiary}
              fill={isLiked ? '#E53E3E' : 'transparent'}
            />
          </Animated.View>
          <Text style={[styles.actionCount, { color: isLiked ? '#E53E3E' : theme.textTertiary }]}>
            {post.likes.length}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => onComment(post.id)}
          activeOpacity={0.7}
          testID={`post-comment-${post.id}`}
        >
          <MessageCircle size={19} color={theme.textTertiary} />
          <Text style={[styles.actionCount, { color: theme.textTertiary }]}>{post.commentCount}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

type GroupTab = 'feed' | 'chat' | 'leaderboard';

type ChatMessage = {
  id: string;
  userId: string;
  displayName: string;
  avatarColor: string;
  message: string;
  createdAt: number;
};

type LeaderEntry = {
  id: string;
  userId: string;
  displayName: string;
  avatarColor: string;
  streakDays: number;
  caloriesAvg: number;
};

export default function CommunityScreen() {
  const { theme } = useTheme();
  const { posts, toggleLike, deletePost, hasProfile, communityProfile } = useCommunity();
  const { authState } = useNutrition();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<GroupTab>('feed');
  const [chatInput, setChatInput] = useState('');

  const currentUserId = communityProfile?.userId || authState.userId || null;

  const inviteLink = 'dietku.app/invite/alpha-squad';

  const chatMessages = useMemo<ChatMessage[]>(() => [
    {
      id: 'c1',
      userId: 'u1',
      displayName: 'Maya Putri',
      avatarColor: '#2E7D5B',
      message: 'Target protein hari ini 120g. Siapa yang sudah tercapai?',
      createdAt: Date.now() - 1000 * 60 * 6,
    },
    {
      id: 'c2',
      userId: currentUserId || 'u2',
      displayName: 'Kamu',
      avatarColor: '#1F3D2A',
      message: 'Aku baru 85g, mau tambah snack tinggi protein.',
      createdAt: Date.now() - 1000 * 60 * 4,
    },
    {
      id: 'c3',
      userId: 'u3',
      displayName: 'Rizky Adi',
      avatarColor: '#3D5B6A',
      message: 'Ada rekomendasi menu tinggi serat nggak?',
      createdAt: Date.now() - 1000 * 60 * 2,
    },
  ], [currentUserId]);

  const leaderboard = useMemo<LeaderEntry[]>(() => [
    { id: 'l1', userId: 'u4', displayName: 'Nadia', avatarColor: '#3C4A62', streakDays: 26, caloriesAvg: 1880 },
    { id: 'l2', userId: 'u1', displayName: 'Maya', avatarColor: '#2E7D5B', streakDays: 21, caloriesAvg: 2050 },
    { id: 'l3', userId: 'u3', displayName: 'Rizky', avatarColor: '#3D5B6A', streakDays: 18, caloriesAvg: 1985 },
    { id: 'l4', userId: 'u5', displayName: 'Fajar', avatarColor: '#6B4F3B', streakDays: 14, caloriesAvg: 2140 },
  ], []);

  const handleCreatePost = useCallback(() => {
    console.log('community:create-post');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!authState.isSignedIn) {
      Alert.alert('Masuk Diperlukan', 'Silakan masuk terlebih dahulu untuk membuat post.', [
        { text: 'Batal', style: 'cancel' },
        { text: 'Masuk', onPress: () => router.push('/sign-in') },
      ]);
      return;
    }
    if (!hasProfile) {
      router.push('/setup-community-profile');
      return;
    }
    router.push('/create-post');
  }, [authState.isSignedIn, hasProfile]);

  const handleComment = useCallback((postId: string) => {
    console.log('community:comment', postId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/post-detail', params: { postId } });
  }, []);

  const handleLike = useCallback((postId: string) => {
    console.log('community:like', postId);
    if (!authState.isSignedIn) {
      Alert.alert('Masuk Diperlukan', 'Silakan masuk untuk menyukai post.');
      return;
    }
    if (!hasProfile) {
      router.push('/setup-community-profile');
      return;
    }
    toggleLike(postId);
  }, [authState.isSignedIn, hasProfile, toggleLike]);

  const handleRefresh = useCallback(async () => {
    console.log('community:refresh');
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const handleCopyInvite = useCallback(async () => {
    console.log('community:copy-invite');
    const copied = await copyToClipboard(inviteLink);
    if (copied) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Link Disalin', 'Bagikan link ini untuk mengundang anggota ke grup.');
      return;
    }
    Alert.alert('Salin Manual', 'Tidak bisa menyalin otomatis. Silakan salin link di atas secara manual.');
  }, [inviteLink]);

  const handleSendChat = useCallback(() => {
    console.log('community:send-chat', chatInput);
    if (!chatInput.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setChatInput('');
  }, [chatInput]);

  const renderPost = useCallback(({ item }: { item: FoodPost }) => (
    <PostCard
      post={item}
      onLike={handleLike}
      onComment={handleComment}
      onDelete={deletePost}
      currentUserId={currentUserId}
      theme={theme}
    />
  ), [handleLike, handleComment, deletePost, currentUserId, theme]);

  const renderChatMessage = useCallback(({ item }: { item: ChatMessage }) => {
    const isMe = currentUserId === item.userId;
    return (
      <View style={[styles.chatRow, isMe ? styles.chatRowMe : styles.chatRowOther]}>
        {!isMe && <Avatar name={item.displayName} color={item.avatarColor} size={32} />}
        <View style={[styles.chatBubble, { backgroundColor: isMe ? theme.primary : theme.surfaceElevated, borderColor: theme.border }]}>
          <Text style={[styles.chatName, { color: isMe ? '#FFFFFF' : theme.text }]}>{item.displayName}</Text>
          <Text style={[styles.chatMessage, { color: isMe ? '#FFFFFF' : theme.text }]}>{item.message}</Text>
          <Text style={[styles.chatTime, { color: isMe ? 'rgba(255,255,255,0.75)' : theme.textTertiary }]}>{timeAgo(item.createdAt)}</Text>
        </View>
      </View>
    );
  }, [currentUserId, theme]);

  const renderLeader = useCallback(({ item, index }: { item: LeaderEntry; index: number }) => (
    <View style={[styles.leaderRow, { borderColor: theme.border }]}> 
      <View style={styles.leaderRankWrap}>
        <Text style={[styles.leaderRank, { color: theme.text }]}>{index + 1}</Text>
      </View>
      <Avatar name={item.displayName} color={item.avatarColor} size={36} />
      <View style={styles.leaderInfo}>
        <Text style={[styles.leaderName, { color: theme.text }]}>{item.displayName}</Text>
        <Text style={[styles.leaderMeta, { color: theme.textTertiary }]}>{item.caloriesAvg} kcal rata-rata</Text>
      </View>
      <View style={[styles.leaderStreak, { backgroundColor: theme.primary + '18' }]}> 
        <Trophy size={14} color={theme.primary} />
        <Text style={[styles.leaderStreakText, { color: theme.primary }]}>{item.streakDays} hari</Text>
      </View>
    </View>
  ), [theme]);

  const keyExtractor = useCallback((item: FoodPost) => item.id, []);

  const HeaderContent = (
    <View style={styles.headerContent}>
      <View style={[styles.groupCard, { backgroundColor: theme.card, borderColor: theme.border }]}> 
        <View style={styles.groupHeaderRow}>
          <View>
            <Text style={[styles.groupTitle, { color: theme.text }]}>Alpha Squad</Text>
            <Text style={[styles.groupSubtitle, { color: theme.textSecondary }]}>14 anggota · Feed otomatis dari log makanan</Text>
          </View>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=200&q=80' }}
            style={styles.groupCover}
          />
        </View>
        <TouchableOpacity
          style={[styles.inviteButton, { borderColor: theme.border }]}
          onPress={handleCopyInvite}
          activeOpacity={0.8}
          testID="group-invite"
        >
          <LinkIcon size={16} color={theme.text} />
          <Text style={[styles.inviteText, { color: theme.text }]}>{inviteLink}</Text>
          <Text style={[styles.inviteAction, { color: theme.primary }]}>Salin</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabRow}>
        {([
          { key: 'feed', label: 'Feed' },
          { key: 'chat', label: 'Chat' },
          { key: 'leaderboard', label: 'Leaderboard' },
        ] as { key: GroupTab; label: string }[]).map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabButton, { backgroundColor: isActive ? theme.primary : 'transparent', borderColor: theme.border }]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.8}
              testID={`community-tab-${tab.key}`}
            >
              <Text style={[styles.tabLabel, { color: isActive ? '#FFFFFF' : theme.textSecondary }]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.container, { backgroundColor: theme.background }]}> 
        <View style={[styles.header, { borderBottomColor: theme.border }]}> 
          <Text style={[styles.headerTitle, { color: theme.text }]}>Komunitas</Text>
          <TouchableOpacity
            style={[styles.createBtn, { backgroundColor: theme.primary }]}
            onPress={handleCreatePost}
            activeOpacity={0.8}
            testID="community-create"
          >
            <Plus size={18} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        {activeTab === 'feed' ? (
          <FlatList
            data={posts}
            renderItem={renderPost}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
            }
            ListHeaderComponent={HeaderContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Utensils size={48} color={theme.textTertiary} />
                <Text style={[styles.emptyTitle, { color: theme.text }]}>Belum Ada Post</Text>
                <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>Bagikan makanan Anda dan lihat apa yang dimakan orang lain!</Text>
              </View>
            }
          />
        ) : null}

        {activeTab === 'chat' ? (
          <FlatList
            data={chatMessages}
            renderItem={renderChatMessage}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.chatContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={HeaderContent}
          />
        ) : null}

        {activeTab === 'leaderboard' ? (
          <FlatList
            data={leaderboard}
            renderItem={renderLeader}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.leaderContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={HeaderContent}
          />
        ) : null}

        {activeTab === 'chat' ? (
          <View style={[styles.chatInputWrap, { backgroundColor: theme.card, borderColor: theme.border }]}> 
            <TextInput
              style={[styles.chatInput, { color: theme.text }]}
              placeholder="Tulis pesan ke grup"
              placeholderTextColor={theme.textTertiary}
              value={chatInput}
              onChangeText={setChatInput}
              testID="community-chat-input"
            />
            <TouchableOpacity
              style={[styles.chatSend, { backgroundColor: theme.primary }]}
              onPress={handleSendChat}
              activeOpacity={0.8}
              testID="community-chat-send"
            >
              <Send size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 58,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  createBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    paddingTop: 12,
  },
  groupCard: {
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  groupTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  groupSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  groupCover: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  inviteButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inviteText: {
    flex: 1,
    fontSize: 13,
  },
  inviteAction: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 14,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  listContent: {
    paddingVertical: 8,
  },
  postCard: {
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  postUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '700' as const,
  },
  postUserText: {
    marginLeft: 10,
    flex: 1,
  },
  postDisplayName: {
    fontSize: 15,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  postMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  postUsername: {
    fontSize: 13,
  },
  postDot: {
    fontSize: 13,
  },
  postTime: {
    fontSize: 12,
  },
  deleteBtn: {
    padding: 8,
  },
  postCaption: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
    letterSpacing: -0.1,
  },
  foodCard: {
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  foodCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  foodName: {
    fontSize: 14,
    fontWeight: '600' as const,
    flex: 1,
  },
  autoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  autoBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
  },
  mealBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  mealBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  macroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  macroItem: {
    flex: 1,
    alignItems: 'center',
  },
  macroValue: {
    fontSize: 15,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  macroLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  macroDivider: {
    width: 1,
    height: 28,
  },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  actionCount: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 100,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  chatContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 120,
    gap: 12,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  chatRowMe: {
    justifyContent: 'flex-end',
  },
  chatRowOther: {
    justifyContent: 'flex-start',
  },
  chatBubble: {
    maxWidth: '78%',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  chatName: {
    fontSize: 12,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  chatMessage: {
    fontSize: 14,
    lineHeight: 19,
  },
  chatTime: {
    fontSize: 11,
    marginTop: 6,
  },
  chatInputWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 10,
  },
  chatInput: {
    flex: 1,
    fontSize: 14,
  },
  chatSend: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaderContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 30,
    gap: 10,
  },
  leaderRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  leaderRankWrap: {
    width: 24,
    alignItems: 'center',
  },
  leaderRank: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  leaderInfo: {
    flex: 1,
  },
  leaderName: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  leaderMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  leaderStreak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
  },
  leaderStreakText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
});
