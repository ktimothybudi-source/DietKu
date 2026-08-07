import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  Animated,
  RefreshControl,
  Alert,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import {
  Heart,
  MessageCircle,
  Plus,
  Utensils,
  Trash2,
  Clock,
  Send,
  Users,
  UserPlus,
  Search,
  Globe,
  Settings,
  ChevronDown,
  Share2,
  Target,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCommunity } from '@/contexts/CommunityContext';
import { useNutrition } from '@/contexts/NutritionContext';
import { FoodPost, MEAL_TYPE_LABELS, GroupMember } from '@/types/community';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { communityStyles as styles } from '@/styles/communityStyles';
import { PremiumDisplayName } from '@/components/PremiumDisplayName';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { shareGroupInvite } from '@/lib/shareGroupInvite';
import { getTodayKey } from '@/utils/nutritionCalculations';
import {
  DailyGoalStatus,
  DailyProgressShare,
  getCaloriesProgressPercent,
  getDailyGoalStatus,
  mapDailyProgressRow,
} from '@/utils/dailyProgressShare';

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

type CommunityView = 'feed' | 'goals';

type MemberGoalRow = {
  member: GroupMember;
  isMe: boolean;
  caloriesEaten: number;
  caloriesTarget: number;
  proteinEaten: number;
  proteinTarget: number;
  status: DailyGoalStatus;
  caloriesPercent: number;
};

function goalStatusLabel(
  status: DailyGoalStatus,
  l: (idText: string, enText: string) => string
): string {
  switch (status) {
    case 'hit':
      return l('Goal tercapai', 'Goal hit');
    case 'over':
      return l('Melebihi target', 'Over target');
    case 'in_progress':
      return l('Masih jalan', 'In progress');
    default:
      return l('Belum log', 'Not started');
  }
}

function goalStatusColor(
  status: DailyGoalStatus,
  theme: ReturnType<typeof useTheme>['theme']
): string {
  switch (status) {
    case 'hit':
      return theme.success;
    case 'over':
      return theme.warning;
    case 'in_progress':
      return theme.primary;
    default:
      return theme.textTertiary;
  }
}

const PostCard = React.memo(({ post, onLike, onComment, onDelete, currentUserId, theme, l }: {
  post: FoodPost;
  onLike: (id: string) => void;
  onComment: (id: string) => void;
  onDelete: (id: string) => void;
  currentUserId: string | null;
  theme: ReturnType<typeof useTheme>['theme'];
  l: (idText: string, enText: string) => string;
}) => {
  const isLiked = currentUserId ? post.likes.includes(currentUserId) : false;
  const isOwn = currentUserId === post.userId;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isAutoLog = (post as { isAutoLog?: boolean }).isAutoLog ?? !post.caption;
  const [imageFailed, setImageFailed] = useState(false);

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
    Alert.alert(l('Hapus Post', 'Delete Post'), l('Yakin ingin menghapus post ini?', 'Are you sure you want to delete this post?'), [
      { text: l('Batal', 'Cancel'), style: 'cancel' },
      { text: l('Hapus', 'Delete'), style: 'destructive', onPress: () => onDelete(post.id) },
    ]);
  }, [post.id, onDelete, l]);

  return (
    <View style={[styles.postCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.postHeader}>
        <TouchableOpacity style={styles.postUserInfo} activeOpacity={0.7} testID={`post-user-${post.id}`}>
          <Avatar name={post.displayName} color={post.avatarColor} size={38} />
          <View style={styles.postUserText}>
            <PremiumDisplayName
              text={post.displayName}
              premium={false}
              color={theme.text}
              fontSize={15}
              fontWeight="700"
            />
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
        {post.photoUri && !imageFailed ? (
          <Image
            source={{ uri: post.photoUri }}
            style={styles.postFoodImage}
            resizeMode="cover"
            onError={() => setImageFailed(true)}
          />
        ) : null}
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
            <Text style={[styles.macroLabel, { color: theme.textTertiary }]}>{l('Karbo', 'Carbs')}</Text>
          </View>
          <View style={[styles.macroDivider, { backgroundColor: theme.border }]} />
          <View style={styles.macroItem}>
            <Text style={[styles.macroValue, { color: theme.warning }]}>{post.fat}g</Text>
            <Text style={[styles.macroLabel, { color: theme.textTertiary }]}>{l('Lemak', 'Fat')}</Text>
          </View>
        </View>
      </View>

      {false && (
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
      )}
    </View>
  );
});

PostCard.displayName = 'PostCard';

const MemberGoalCard = React.memo(({
  row,
  theme,
  l,
}: {
  row: MemberGoalRow;
  theme: ReturnType<typeof useTheme>['theme'];
  l: (idText: string, enText: string) => string;
}) => {
  const statusColor = goalStatusColor(row.status, theme);
  const barWidth = Math.min(100, row.caloriesPercent);

  return (
    <View
      style={[styles.goalCard, { backgroundColor: theme.card, borderColor: theme.border }]}
      testID={`goal-row-${row.member.userId}`}
    >
      <View style={styles.goalCardHeader}>
        <Avatar name={row.member.displayName} color={row.member.avatarColor} size={40} />
        <View style={styles.goalCardInfo}>
          <Text style={[styles.goalCardName, { color: theme.text }]} numberOfLines={1}>
            {row.member.displayName}
            {row.isMe ? ` ${l('(kamu)', '(you)')}` : ''}
          </Text>
          <Text style={[styles.goalCardUsername, { color: theme.textTertiary }]} numberOfLines={1}>
            @{row.member.username}
          </Text>
        </View>
        <View style={[styles.goalStatusBadge, { backgroundColor: statusColor + '20' }]}>
          <Text style={[styles.goalStatusText, { color: statusColor }]}>
            {goalStatusLabel(row.status, l)}
          </Text>
        </View>
      </View>

      <View style={[styles.goalBarTrack, { backgroundColor: theme.surfaceElevated }]}>
        <View
          style={[
            styles.goalBarFill,
            {
              width: `${barWidth}%`,
              backgroundColor: statusColor,
            },
          ]}
        />
      </View>

      <View style={styles.goalMetaRow}>
        <Text style={[styles.goalMetaText, { color: theme.text }]}>
          {Math.round(row.caloriesEaten)} / {Math.round(row.caloriesTarget) || '—'} kcal
        </Text>
        <Text style={[styles.goalMetaSecondary, { color: theme.textSecondary }]}>
          {row.proteinTarget > 0
            ? `${Math.round(row.proteinEaten)}/${Math.round(row.proteinTarget)}g P`
            : l('Protein belum di-share', 'Protein not shared yet')}
        </Text>
      </View>
    </View>
  );
});

MemberGoalCard.displayName = 'MemberGoalCard';

type ChatMessage = {
  id: string;
  groupId: string;
  userId: string;
  displayName: string;
  avatarColor: string;
  message: string;
  createdAt: number;
};

type TimelineItem =
  | { type: 'post'; id: string; createdAt: number; post: FoodPost }
  | { type: 'chat'; id: string; createdAt: number; chat: ChatMessage };

export default function CommunityScreen() {
  const { theme } = useTheme();
  const { l } = useLanguage();
  const timelineListRef = useRef<FlatList<TimelineItem>>(null);
  const {
    posts, toggleLike, deletePost, hasProfile, communityProfile,
    hasJoinedGroup, activeGroup, joinedGroups,
    switchActiveGroup,
  } = useCommunity();
  const { authState, dailyTargets, foodLog } = useNutrition();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [communityView, setCommunityView] = useState<CommunityView>('feed');
  const queryClient = useQueryClient();

  const scrollTimelineToLatest = useCallback(() => {
    timelineListRef.current?.scrollToEnd({ animated: false });
  }, []);

  /** After opening Komunitas / switching group, allow a short window where layout/image loads snap to latest */
  const snapToBottomUntilRef = useRef(0);

  useFocusEffect(
    useCallback(() => {
      /** Timeline is oldest → newest; snap to bottom when opening Komunitas or switching grup */
      snapToBottomUntilRef.current = Date.now() + 2500;
      const timers: ReturnType<typeof setTimeout>[] = [0, 80, 250, 600].map((ms) =>
        setTimeout(scrollTimelineToLatest, ms)
      );
      return () => {
        timers.forEach(clearTimeout);
        setShowGroupPicker(false);
      };
    }, [activeGroup?.id, scrollTimelineToLatest]),
  );

  useEffect(() => {
    const event = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(event, () => {
      requestAnimationFrame(() => scrollTimelineToLatest());
    });
    return () => sub.remove();
  }, [scrollTimelineToLatest]);

  const currentUserId = communityProfile?.userId || authState.userId || null;
  const todayKey = getTodayKey();

  const memberIds = useMemo(() => {
    return (activeGroup?.members || []).map((m) => m.userId);
  }, [activeGroup?.members]);

  const groupProgressQuery = useQuery({
    queryKey: ['community_group_progress', activeGroup?.id || 'none', todayKey, memberIds.join(',')],
    enabled: !!activeGroup?.id && memberIds.length > 0 && communityView === 'goals',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_progress_shares')
        .select(
          'user_id, date, calories_eaten, protein_eaten, carbs_eaten, fat_eaten, calories_target, protein_target, updated_at'
        )
        .eq('date', todayKey)
        .in('user_id', memberIds);
      if (error) throw error;
      return ((data || []) as Array<{
        user_id: string;
        date: string;
        calories_eaten: number | string;
        protein_eaten: number | string;
        carbs_eaten: number | string;
        fat_eaten: number | string;
        calories_target: number | string;
        protein_target: number | string;
        updated_at: string;
      }>).map(mapDailyProgressRow);
    },
    staleTime: 15_000,
  });

  const liveSelfTotals = useMemo(() => {
    const entries = foodLog[todayKey] || [];
    return entries.reduce(
      (acc, entry) => ({
        calories: acc.calories + entry.calories,
        protein: acc.protein + entry.protein,
        carbs: acc.carbs + entry.carbs,
        fat: acc.fat + entry.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [foodLog, todayKey]);

  const memberGoalRows = useMemo<MemberGoalRow[]>(() => {
    if (!activeGroup) return [];
    const shareMap = new Map<string, DailyProgressShare>();
    for (const share of groupProgressQuery.data || []) {
      shareMap.set(share.userId, share);
    }

    const rows: MemberGoalRow[] = activeGroup.members.map((member) => {
      const isMe = !!currentUserId && member.userId === currentUserId;
      const share = shareMap.get(member.userId);

      let caloriesEaten = share?.caloriesEaten ?? 0;
      let caloriesTarget = share?.caloriesTarget ?? 0;
      let proteinEaten = share?.proteinEaten ?? 0;
      let proteinTarget = share?.proteinTarget ?? 0;

      if (isMe && dailyTargets) {
        caloriesEaten = liveSelfTotals.calories;
        caloriesTarget = dailyTargets.calories;
        proteinEaten = liveSelfTotals.protein;
        proteinTarget = dailyTargets.protein;
      }

      const status = getDailyGoalStatus(caloriesEaten, caloriesTarget);
      const caloriesPercent = getCaloriesProgressPercent(caloriesEaten, caloriesTarget);

      return {
        member,
        isMe,
        caloriesEaten,
        caloriesTarget,
        proteinEaten,
        proteinTarget,
        status,
        caloriesPercent,
      };
    });

    const statusRank: Record<DailyGoalStatus, number> = {
      hit: 0,
      in_progress: 1,
      over: 2,
      not_started: 3,
    };

    return rows.sort((a, b) => {
      if (a.isMe !== b.isMe) return a.isMe ? -1 : 1;
      const rankDiff = statusRank[a.status] - statusRank[b.status];
      if (rankDiff !== 0) return rankDiff;
      return b.caloriesPercent - a.caloriesPercent;
    });
  }, [activeGroup, groupProgressQuery.data, currentUserId, dailyTargets, liveSelfTotals]);

  const chatMessagesQuery = useQuery({
    queryKey: ['community_group_messages', activeGroup?.id || 'none'],
    enabled: !!activeGroup?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('community_group_messages')
        .select('id, group_id, user_id, message, created_at')
        .eq('group_id', activeGroup!.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const rows = (data || []) as Array<{
        id: string;
        group_id: string;
        user_id: string;
        message: string;
        created_at: string;
      }>;
      const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
      const { data: profilesData, error: profilesError } = await supabase
        .from('community_profiles')
        .select('user_id, display_name, avatar_color')
        .in('user_id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);
      if (profilesError) throw profilesError;
      const profileMap = Object.fromEntries(
        ((profilesData || []) as Array<{ user_id: string; display_name: string; avatar_color: string }>).map((p) => [p.user_id, p])
      );
      return rows.map((r) => ({
        id: r.id,
        groupId: r.group_id,
        userId: r.user_id,
        displayName: profileMap[r.user_id]?.display_name || 'User',
        avatarColor: profileMap[r.user_id]?.avatar_color || '#22C55E',
        message: r.message,
        createdAt: new Date(r.created_at).getTime(),
      })) as ChatMessage[];
    },
  });

  const sendChatMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!activeGroup?.id || !currentUserId) return;
      const { error } = await supabase.from('community_group_messages').insert({
        group_id: activeGroup.id,
        user_id: currentUserId,
        message,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community_group_messages', activeGroup?.id || 'none'] });
    },
  });

  const chatMessages = useMemo<ChatMessage[]>(() => {
    return chatMessagesQuery.data || [];
  }, [chatMessagesQuery.data]);

  const handleCreatePost = useCallback(() => {
    console.log('community:create-post');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!authState.isSignedIn) {
      Alert.alert(l('Masuk Diperlukan', 'Sign In Required'), l('Silakan masuk terlebih dahulu untuk membuat post.', 'Please sign in first to create a post.'), [
        { text: l('Batal', 'Cancel'), style: 'cancel' },
        { text: l('Masuk', 'Sign In'), onPress: () => router.replace('/sign-in') },
      ]);
      return;
    }
    if (!hasProfile) {
      router.push('/setup-community-profile');
      return;
    }
    router.push('/create-post');
  }, [authState.isSignedIn, hasProfile, l]);

  const handleSettings = useCallback(() => {
    if (!activeGroup) return;
    console.log('community:group-settings', activeGroup.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: '/group-settings', params: { groupId: activeGroup.id } });
  }, [activeGroup]);

  const handleShareGroup = useCallback(async () => {
    if (!activeGroup) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await shareGroupInvite({
        groupName: activeGroup.name,
        inviteCode: activeGroup.inviteCode,
        l,
      });
    } catch (e) {
      console.log('community:share-group cancelled or failed', e);
    }
  }, [activeGroup, l]);

  const handleComment = useCallback((postId: string) => {
    console.log('community:comment', postId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/post-detail', params: { postId } });
  }, []);

  const handleLike = useCallback((postId: string) => {
    console.log('community:like', postId);
    if (!authState.isSignedIn) {
      Alert.alert(l('Masuk Diperlukan', 'Sign In Required'), l('Silakan masuk untuk menyukai post.', 'Please sign in to like posts.'));
      return;
    }
    if (!hasProfile) {
      router.push('/setup-community-profile');
      return;
    }
    toggleLike(postId);
  }, [authState.isSignedIn, hasProfile, toggleLike, l]);

  const handleRefresh = useCallback(async () => {
    console.log('community:refresh');
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['community_posts'] }),
      queryClient.invalidateQueries({ queryKey: ['community_comments'] }),
      queryClient.invalidateQueries({ queryKey: ['community_likes'] }),
      queryClient.invalidateQueries({ queryKey: ['community_group_messages', activeGroup?.id || 'none'] }),
      queryClient.invalidateQueries({ queryKey: ['community_premium_bypass_users'] }),
      queryClient.invalidateQueries({ queryKey: ['community_group_progress'] }),
    ]);
    setTimeout(() => setRefreshing(false), 400);
  }, [queryClient, activeGroup?.id]);

  const handleSendChat = useCallback(() => {
    console.log('community:send-chat', chatInput);
    if (!chatInput.trim() || !activeGroup) return;
    sendChatMutation.mutate(chatInput.trim());
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setChatInput('');
    snapToBottomUntilRef.current = Date.now() + 1500;
    requestAnimationFrame(() => scrollTimelineToLatest());
  }, [chatInput, activeGroup, sendChatMutation, scrollTimelineToLatest]);

  const handleCreateGroup = useCallback(() => {
    console.log('community:create-group');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!authState.isSignedIn) {
      Alert.alert(l('Masuk Diperlukan', 'Sign In Required'), l('Silakan masuk terlebih dahulu.', 'Please sign in first.'), [
        { text: l('Batal', 'Cancel'), style: 'cancel' },
        { text: l('Masuk', 'Sign In'), onPress: () => router.replace('/sign-in') },
      ]);
      return;
    }
    if (!hasProfile) {
      router.push('/setup-community-profile');
      return;
    }
    router.push('/create-group');
  }, [authState.isSignedIn, hasProfile, l]);

  const handleSwitchGroup = useCallback((groupId: string) => {
    console.log('community:switch-group', groupId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    switchActiveGroup(groupId);
    setShowGroupPicker(false);
  }, [switchActiveGroup]);

  const handleSelectView = useCallback((view: CommunityView) => {
    if (view === communityView) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCommunityView(view);
  }, [communityView]);

  const renderChatMessage = useCallback(({
    item,
    isGrouped,
    isGroupEnd,
  }: {
    item: ChatMessage;
    isGrouped: boolean;
    isGroupEnd: boolean;
  }) => {
    const isMe = currentUserId === item.userId;
    const showAvatar = !isMe && isGroupEnd;
    const showName = !isMe && !isGrouped;
    const showTime = isGroupEnd;

    return (
      <View
        style={[
          styles.chatRow,
          isMe ? styles.chatRowMe : styles.chatRowOther,
          isGrouped && styles.chatRowGrouped,
        ]}
      >
        {!isMe && (
          showAvatar
            ? <Avatar name={item.displayName} color={item.avatarColor} size={30} />
            : <View style={styles.chatAvatarSpacer} />
        )}
        <View
          style={[
            styles.chatBubble,
            isGrouped && (isMe ? styles.chatBubbleMeContinue : styles.chatBubbleOtherContinue),
            !isGroupEnd && (isMe ? styles.chatBubbleMeSoftEnd : styles.chatBubbleOtherSoftEnd),
            isGroupEnd && (isMe ? styles.chatBubbleMeTail : styles.chatBubbleOtherTail),
            {
              backgroundColor: isMe ? theme.primary : theme.surfaceElevated,
              borderColor: isMe ? theme.primary : theme.border,
            },
          ]}
        >
          {showName && (
            <View style={styles.chatName}>
              <PremiumDisplayName
                text={item.displayName}
                premium={false}
                color={theme.primary}
                fontSize={12}
                fontWeight="700"
              />
            </View>
          )}
          <Text style={[styles.chatMessage, { color: isMe ? '#FFFFFF' : theme.text }]}>{item.message}</Text>
          {showTime && (
            <Text style={[styles.chatTime, { color: isMe ? 'rgba(255,255,255,0.72)' : theme.textTertiary }]}>
              {timeAgo(item.createdAt)}
            </Text>
          )}
        </View>
      </View>
    );
  }, [currentUserId, theme]);

  const activeGroupPosts = useMemo(() => {
    if (!activeGroup) return [];
    return posts.filter(post => post.groupId === activeGroup.id);
  }, [posts, activeGroup]);

  const timelineItems = useMemo<TimelineItem[]>(() => {
    const postItems: TimelineItem[] = activeGroupPosts.map((post) => ({
      type: 'post',
      id: `post-${post.id}`,
      createdAt: post.createdAt,
      post,
    }));
    const chatItems: TimelineItem[] = chatMessages.map((chat) => ({
      type: 'chat',
      id: `chat-${chat.id}`,
      createdAt: chat.createdAt,
      chat,
    }));
    return [...postItems, ...chatItems].sort((a, b) => a.createdAt - b.createdAt);
  }, [activeGroupPosts, chatMessages]);

  const renderTimelineItem = useCallback(({ item, index }: { item: TimelineItem; index: number }) => {
    if (item.type === 'post') {
      return (
        <PostCard
          post={item.post}
          onLike={handleLike}
          onComment={handleComment}
          onDelete={deletePost}
          currentUserId={currentUserId}
          theme={theme}
          l={l}
        />
      );
    }

    const prev = timelineItems[index - 1];
    const next = timelineItems[index + 1];
    const isGrouped = prev?.type === 'chat' && prev.chat.userId === item.chat.userId;
    const isGroupEnd = !(next?.type === 'chat' && next.chat.userId === item.chat.userId);

    return renderChatMessage({
      item: item.chat,
      isGrouped,
      isGroupEnd,
    });
  }, [handleLike, handleComment, deletePost, currentUserId, theme, l, renderChatMessage, timelineItems]);

  const renderGoalRow = useCallback(({ item }: { item: MemberGoalRow }) => (
    <MemberGoalCard row={item} theme={theme} l={l} />
  ), [theme, l]);

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
              <Text style={[styles.groupPickerMembers, { color: theme.textTertiary }]}>{g.members.length} {l('anggota', 'members')}</Text>
            </View>
            {g.id === activeGroup?.id && (
              <View style={[styles.groupPickerActive, { backgroundColor: theme.primary }]}>
                <Text style={styles.groupPickerActiveText}>{l('Aktif', 'Active')}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  ) : null;

  if (!authState.isSignedIn) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { backgroundColor: theme.background }]}>
          <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>{l('Komunitas', 'Community')}</Text>
          </View>

          <ScrollView
            style={styles.listFlex}
            contentContainerStyle={styles.noGroupScroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.noGroupIconWrap, { backgroundColor: theme.primary + '12' }]}>
              <Users size={48} color={theme.primary} strokeWidth={1.5} />
            </View>
            <Text style={[styles.onboardingStepText, { color: theme.primary }]}>
              {l('Langkah 1 dari 3', 'Step 1 of 3')}
            </Text>
            <Text style={[styles.noGroupTitle, { color: theme.text }]}>{l('Masuk untuk Komunitas', 'Sign In to Community')}</Text>
            <Text style={[styles.noGroupDesc, { color: theme.textSecondary }]}>
              {l(
                'Masuk dulu untuk membuat profil komunitas, bergabung ke grup, dan berbagi progress.',
                'Sign in first to create your community profile, join groups, and share your progress.'
              )}
            </Text>

            <View style={styles.noGroupActions}>
              <TouchableOpacity
                style={[styles.joinGroupBtn, { backgroundColor: theme.primary }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.replace('/sign-in');
                }}
                activeOpacity={0.8}
                testID="community-sign-in-required"
              >
                <Text style={styles.joinGroupBtnText}>{l('Masuk', 'Sign In')}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </>
    );
  }

  if (!hasProfile) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { backgroundColor: theme.background }]}>
          <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>{l('Komunitas', 'Community')}</Text>
          </View>

          <ScrollView
            style={styles.listFlex}
            contentContainerStyle={styles.noGroupScroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.noGroupIconWrap, { backgroundColor: theme.primary + '12' }]}>
              <UserPlus size={48} color={theme.primary} strokeWidth={1.5} />
            </View>
            <Text style={[styles.onboardingStepText, { color: theme.primary }]}>
              {l('Langkah 1 dari 2', 'Step 1 of 2')}
            </Text>
            <Text style={[styles.noGroupTitle, { color: theme.text }]}>{l('Buat Profil Komunitas', 'Create Community Profile')}</Text>
            <Text style={[styles.noGroupDesc, { color: theme.textSecondary }]}>
              {l(
                'Sebelum masuk ke fitur komunitas, buat username dan nama tampilan Anda dulu.',
                'Before entering community features, create your username and display name first.'
              )}
            </Text>

            <View style={styles.noGroupActions}>
              <TouchableOpacity
                style={[styles.joinGroupBtn, { backgroundColor: theme.primary }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push('/setup-community-profile');
                }}
                activeOpacity={0.8}
                testID="community-create-profile"
              >
                <Text style={styles.joinGroupBtnText}>{l('Buat Profil', 'Create Profile')}</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.noGroupFeatures, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.featuresTitle, { color: theme.text }]}>{l('Setelah profil siap', 'After profile setup')}</Text>
              {[
                { icon: <Users size={16} color={theme.primary} />, text: l('Buat atau gabung ke grup privat', 'Create or join private groups') },
                { icon: <Utensils size={16} color={theme.primary} />, text: l('Bagikan makanan dan progres', 'Share meals and progress') },
                { icon: <MessageCircle size={16} color={theme.primary} />, text: l('Chat dengan anggota grup', 'Chat with group members') },
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

  if (!hasJoinedGroup) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { backgroundColor: theme.background }]}>
          <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>{l('Komunitas', 'Community')}</Text>
          </View>

          <ScrollView
            style={styles.listFlex}
            contentContainerStyle={styles.noGroupScroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.noGroupIconWrap, { backgroundColor: theme.primary + '12' }]}>
              <Users size={48} color={theme.primary} strokeWidth={1.5} />
            </View>
            <Text style={[styles.onboardingStepText, { color: theme.primary }]}>
              {l('Langkah 2 dari 2', 'Step 2 of 2')}
            </Text>
            <Text style={[styles.noGroupTitle, { color: theme.text }]}>{l('Belum Ada Grup', 'No Group Yet')}</Text>
            <Text style={[styles.noGroupDesc, { color: theme.textSecondary }]}>
              {l('Fitur grup publik sedang dinonaktifkan. Untuk saat ini kamu hanya bisa membuat grup privat.', 'Public groups are currently disabled. For now you can only create private groups.')}
            </Text>

            <View style={styles.noGroupActions}>
              <TouchableOpacity
                style={[styles.createGroupBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
                onPress={handleCreateGroup}
                activeOpacity={0.8}
                testID="community-create-group"
              >
                <Plus size={18} color={theme.primary} strokeWidth={2.5} />
                <Text style={[styles.createGroupBtnText, { color: theme.text }]}>{l('Buat Grup Baru', 'Create New Group')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createGroupBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
                onPress={() => router.push('/browse-groups')}
                activeOpacity={0.8}
                testID="community-join-group-by-code"
              >
                <Search size={18} color={theme.primary} strokeWidth={2.5} />
                <Text style={[styles.createGroupBtnText, { color: theme.text }]}>{l('Gabung dengan Kode', 'Join with Code')}</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.noGroupFeatures, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.featuresTitle, { color: theme.text }]}>{l('Apa yang bisa kamu lakukan', 'What you can do')}</Text>
              {[
                { icon: <Globe size={16} color={theme.primary} />, text: l('Lihat feed makanan anggota grup privat', 'See private group members food feed') },
                { icon: <MessageCircle size={16} color={theme.primary} />, text: l('Chat dan diskusi nutrisi', 'Chat and nutrition discussion') },
                { icon: <UserPlus size={16} color={theme.primary} />, text: l('Undang teman ke grup kamu', 'Invite your friends to your group') },
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

      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
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
                {activeGroup?.name || l('Komunitas', 'Community')}
              </Text>
              <ChevronDown size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          ) : (
            <Text style={[styles.headerTitle, { color: theme.text }]}>
              {activeGroup?.name || l('Komunitas', 'Community')}
            </Text>
          )}
          {activeGroup && (
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={[styles.settingsIconBtn, { backgroundColor: theme.success }]}
                onPress={handleShareGroup}
                activeOpacity={0.8}
                testID="community-share-group"
              >
                <Share2 size={18} color="#FFFFFF" strokeWidth={2.5} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.settingsIconBtn, { backgroundColor: theme.primary }]}
                onPress={handleSettings}
                activeOpacity={0.8}
                testID="community-settings"
              >
                <Settings size={18} color="#FFFFFF" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              {
                backgroundColor: communityView === 'feed' ? theme.primary : theme.card,
                borderColor: communityView === 'feed' ? theme.primary : theme.border,
              },
            ]}
            onPress={() => handleSelectView('feed')}
            activeOpacity={0.8}
            testID="community-tab-feed"
          >
            <Text style={[styles.tabLabel, { color: communityView === 'feed' ? '#FFFFFF' : theme.textSecondary }]}>
              {l('Feed', 'Feed')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabButton,
              {
                backgroundColor: communityView === 'goals' ? theme.primary : theme.card,
                borderColor: communityView === 'goals' ? theme.primary : theme.border,
              },
            ]}
            onPress={() => handleSelectView('goals')}
            activeOpacity={0.8}
            testID="community-tab-goals"
          >
            <Text style={[styles.tabLabel, { color: communityView === 'goals' ? '#FFFFFF' : theme.textSecondary }]}>
              {l('Target Bersama', 'Shared Goals')}
            </Text>
          </TouchableOpacity>
        </View>

        {GroupPickerDropdown}

        {communityView === 'feed' ? (
          <>
            <FlatList
              ref={timelineListRef}
              style={styles.listFlex}
              data={timelineItems}
              renderItem={renderTimelineItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={[styles.listContent, { paddingBottom: 16 }]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              onContentSizeChange={() => {
                if (Date.now() < snapToBottomUntilRef.current) {
                  scrollTimelineToLatest();
                }
              }}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
              }
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <MessageCircle size={48} color={theme.textTertiary} />
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>{l('Belum Ada Aktivitas', 'No Activity Yet')}</Text>
                  <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                    {l('Kirim chat atau upload post makanan pertama di grup ini.', 'Send a chat or upload the first meal post in this group.')}
                  </Text>
                </View>
              }
            />

            <View style={[styles.chatInputWrap, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <TouchableOpacity
                style={[styles.chatSend, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, borderWidth: 1 }]}
                onPress={handleCreatePost}
                activeOpacity={0.8}
                testID="community-create-post-quick"
              >
                <Plus size={16} color={theme.primary} />
              </TouchableOpacity>
              <TextInput
                style={[styles.chatInput, { color: theme.text }]}
                placeholder=""
                placeholderTextColor={theme.textTertiary}
                value={chatInput}
                onChangeText={setChatInput}
                testID="community-chat-input"
                returnKeyType="send"
                onSubmitEditing={handleSendChat}
                blurOnSubmit={false}
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
          </>
        ) : (
          <FlatList
            style={styles.listFlex}
            data={memberGoalRows}
            renderItem={renderGoalRow}
            keyExtractor={(item) => item.member.userId}
            contentContainerStyle={styles.goalProgressList}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
            }
            ListHeaderComponent={
              <Text style={[styles.goalTabHint, { color: theme.textSecondary }]}>
                {l(
                  'Status kalori harian anggota grup. Goal tercapai di 90–110% target.',
                  'Group members’ daily calorie status. Goal hit means 90–110% of target.'
                )}
              </Text>
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Target size={48} color={theme.textTertiary} />
                <Text style={[styles.emptyTitle, { color: theme.text }]}>{l('Belum Ada Anggota', 'No Members Yet')}</Text>
                <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                  {l('Undang teman ke grup untuk melihat progress goal hari ini.', "Invite friends to see today’s goal progress.")}
                </Text>
              </View>
            }
          />
        )}
      </KeyboardAvoidingView>
    </>
  );
}
