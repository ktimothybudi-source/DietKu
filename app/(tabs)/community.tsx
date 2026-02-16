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
  ScrollView,
} from 'react-native';
import { Stack, router } from 'expo-router';
import {
  Heart,
  MessageCircle,
  Plus,
  Utensils,
  Trash2,
  Clock,
  Trophy,
  Send,
  Users,
  UserPlus,
  Search,
  Globe,
  Settings,
  ChevronDown,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useCommunity } from '@/contexts/CommunityContext';
import { useNutrition } from '@/contexts/NutritionContext';
import { FoodPost, MEAL_TYPE_LABELS, CommunityGroup } from '@/types/community';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const {
    posts, toggleLike, deletePost, hasProfile, communityProfile,
    hasJoinedGroup, joinGroup, activeGroup, joinedGroups,
    switchActiveGroup, joinedGroupIds,
  } = useCommunity();
  const { authState } = useNutrition();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<GroupTab>('feed');
  const [chatInput, setChatInput] = useState('');
  const [showGroupPicker, setShowGroupPicker] = useState(false);

  const currentUserId = communityProfile?.userId || authState.userId || null;

  const chatMessages = useMemo<ChatMessage[]>(() => {
    if (!activeGroup) return [];
    const members = activeGroup.members.slice(0, 3);
    return members.map((m, i) => ({
      id: `c${i}`,
      userId: m.userId,
      displayName: m.userId === currentUserId ? 'Kamu' : m.displayName,
      avatarColor: m.avatarColor,
      message: [
        'Target protein hari ini 120g. Siapa yang sudah tercapai?',
        'Aku baru 85g, mau tambah snack tinggi protein.',
        'Ada rekomendasi menu tinggi serat nggak?',
      ][i % 3],
      createdAt: Date.now() - 1000 * 60 * (6 - i * 2),
    }));
  }, [activeGroup, currentUserId]);

  const leaderboard = useMemo<LeaderEntry[]>(() => {
    if (!activeGroup) return [];
    return activeGroup.members.map((m, i) => ({
      id: `l${i}`,
      userId: m.userId,
      displayName: m.displayName,
      avatarColor: m.avatarColor,
      streakDays: Math.max(1, 26 - i * 5),
      caloriesAvg: 1880 + i * 70,
    }));
  }, [activeGroup]);

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

  const handleSendChat = useCallback(() => {
    console.log('community:send-chat', chatInput);
    if (!chatInput.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setChatInput('');
  }, [chatInput]);

  const handleBrowseGroups = useCallback(() => {
    console.log('community:browse-groups');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
    router.push('/browse-groups');
  }, [authState.isSignedIn, hasProfile]);

  const handleCreateGroup = useCallback(() => {
    console.log('community:create-group');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
    router.push('/create-group');
  }, [authState.isSignedIn, hasProfile]);

  const handleGroupSettings = useCallback(() => {
    if (!activeGroup) return;
    console.log('community:group-settings', activeGroup.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/group-settings', params: { groupId: activeGroup.id } });
  }, [activeGroup]);

  const handleSwitchGroup = useCallback((groupId: string) => {
    console.log('community:switch-group', groupId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    switchActiveGroup(groupId);
    setShowGroupPicker(false);
  }, [switchActiveGroup]);

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

  const GroupPickerDropdown = showGroupPicker ? (
    <View style={[styles.groupPickerOverlay]}>
      <TouchableOpacity
        style={styles.groupPickerBackdrop}
        onPress={() => setShowGroupPicker(false)}
        activeOpacity={1}
      />
      <View style={[styles.groupPickerDropdown, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {joinedGroups.map(g => (
          <TouchableOpacity
            key={g.id}
            style={[
              styles.groupPickerItem,
              { borderColor: theme.border },
              g.id === activeGroup?.id && { backgroundColor: theme.primary + '10' },
            ]}
            onPress={() => handleSwitchGroup(g.id)}
            activeOpacity={0.7}
          >
            <Image source={{ uri: g.coverImage }} style={styles.groupPickerThumb} />
            <View style={styles.groupPickerInfo}>
              <Text style={[styles.groupPickerName, { color: theme.text }]} numberOfLines={1}>{g.name}</Text>
              <Text style={[styles.groupPickerMembers, { color: theme.textTertiary }]}>{g.members.length} anggota</Text>
            </View>
            {g.id === activeGroup?.id && (
              <View style={[styles.groupPickerActive, { backgroundColor: theme.primary }]}>
                <Text style={styles.groupPickerActiveText}>Aktif</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.groupPickerItem, { borderColor: theme.border }]}
          onPress={() => {
            setShowGroupPicker(false);
            handleBrowseGroups();
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.groupPickerAddIcon, { backgroundColor: theme.primary + '12' }]}>
            <Plus size={16} color={theme.primary} />
          </View>
          <Text style={[styles.groupPickerAddText, { color: theme.primary }]}>Gabung Grup Lain</Text>
        </TouchableOpacity>
      </View>
    </View>
  ) : null;

  const HeaderContent = (
    <View style={styles.headerContent}>
      {activeGroup && (
        <View style={[styles.groupCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.groupHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.groupTitle, { color: theme.text }]}>{activeGroup.name}</Text>
              <Text style={[styles.groupSubtitle, { color: theme.textSecondary }]}>
                {activeGroup.members.length} anggota · {activeGroup.privacy === 'public' ? 'Publik' : 'Privat'}
              </Text>
            </View>
            <Image source={{ uri: activeGroup.coverImage }} style={styles.groupCover} />
          </View>
          <TouchableOpacity
            style={[styles.settingsBtn, { borderColor: theme.border }]}
            onPress={handleGroupSettings}
            activeOpacity={0.8}
            testID="group-settings-btn"
          >
            <Settings size={14} color={theme.textSecondary} />
            <Text style={[styles.settingsBtnText, { color: theme.textSecondary }]}>Pengaturan & Undang</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.tabRow}>
        {([
          { key: 'feed' as const, label: 'Feed' },
          { key: 'chat' as const, label: 'Chat' },
          { key: 'leaderboard' as const, label: 'Leaderboard' },
        ]).map(tab => {
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

  if (!hasJoinedGroup) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { backgroundColor: theme.background }]}>
          <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Komunitas</Text>
          </View>

          <ScrollView
            contentContainerStyle={styles.noGroupScroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.noGroupIconWrap, { backgroundColor: theme.primary + '12' }]}>
              <Users size={48} color={theme.primary} strokeWidth={1.5} />
            </View>
            <Text style={[styles.noGroupTitle, { color: theme.text }]}>Belum Ada Grup</Text>
            <Text style={[styles.noGroupDesc, { color: theme.textSecondary }]}>
              Bergabung dengan grup untuk berbagi progres makanan, chat, dan bersaing di leaderboard bersama teman-teman.
            </Text>

            <View style={styles.noGroupActions}>
              <TouchableOpacity
                style={[styles.joinGroupBtn, { backgroundColor: theme.primary }]}
                onPress={handleBrowseGroups}
                activeOpacity={0.8}
                testID="community-join-group"
              >
                <Search size={18} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.joinGroupBtnText}>Cari & Gabung Grup</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.createGroupBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
                onPress={handleCreateGroup}
                activeOpacity={0.8}
                testID="community-create-group"
              >
                <Plus size={18} color={theme.primary} strokeWidth={2.5} />
                <Text style={[styles.createGroupBtnText, { color: theme.text }]}>Buat Grup Baru</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.noGroupFeatures, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.featuresTitle, { color: theme.text }]}>Apa yang bisa kamu lakukan</Text>
              {[
                { icon: <Globe size={16} color={theme.primary} />, text: 'Lihat feed makanan anggota grup' },
                { icon: <MessageCircle size={16} color={theme.primary} />, text: 'Chat dan diskusi nutrisi' },
                { icon: <Trophy size={16} color={theme.primary} />, text: 'Bersaing di leaderboard streak' },
                { icon: <UserPlus size={16} color={theme.primary} />, text: 'Undang teman ke grup kamu' },
              ].map((feature, i) => (
                <View key={i} style={styles.featureRow}>
                  <View style={[styles.featureIconWrap, { backgroundColor: theme.primary + '12' }]}>
                    {feature.icon}
                  </View>
                  <Text style={[styles.featureText, { color: theme.textSecondary }]}>{feature.text}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          {joinedGroups.length > 1 ? (
            <TouchableOpacity
              style={styles.groupSwitcher}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowGroupPicker(!showGroupPicker);
              }}
              activeOpacity={0.7}
              testID="group-switcher"
            >
              <Text style={[styles.headerTitle, { color: theme.text }]}>
                {activeGroup?.name || 'Komunitas'}
              </Text>
              <ChevronDown size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          ) : (
            <Text style={[styles.headerTitle, { color: theme.text }]}>
              {activeGroup?.name || 'Komunitas'}
            </Text>
          )}
          <TouchableOpacity
            style={[styles.createBtn, { backgroundColor: theme.primary }]}
            onPress={handleCreatePost}
            activeOpacity={0.8}
            testID="community-create"
          >
            <Plus size={18} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        {GroupPickerDropdown}

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
    paddingHorizontal: 20,
    paddingBottom: 14,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  groupSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  createBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupPickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  groupPickerBackdrop: {
    flex: 1,
  },
  groupPickerDropdown: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    borderRadius: 14,
    borderWidth: 1,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  groupPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    gap: 10,
    borderBottomWidth: 0.5,
  },
  groupPickerThumb: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  groupPickerInfo: {
    flex: 1,
  },
  groupPickerName: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  groupPickerMembers: {
    fontSize: 12,
    marginTop: 1,
  },
  groupPickerActive: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  groupPickerActiveText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700' as const,
  },
  groupPickerAddIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupPickerAddText: {
    fontSize: 14,
    fontWeight: '600' as const,
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
  settingsBtn: {
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  settingsBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
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
  noGroupScroll: {
    paddingHorizontal: 24,
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 40,
  },
  noGroupIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  noGroupTitle: {
    fontSize: 22,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  noGroupDesc: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  noGroupActions: {
    width: '100%',
    gap: 12,
    marginBottom: 28,
  },
  joinGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 14,
    gap: 10,
  },
  joinGroupBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  createGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  createGroupBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  noGroupFeatures: {
    width: '100%',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    gap: 14,
  },
  featuresTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
});
