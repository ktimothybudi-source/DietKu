import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
} from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useCommunity } from '@/contexts/CommunityContext';
import { useNutrition } from '@/contexts/NutritionContext';
import { MEAL_TYPE_LABELS } from '@/types/community';
import { Heart, Send, Utensils, Clock, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Baru saja';
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} hari lalu`;
  return `${Math.floor(days / 7)} minggu lalu`;
}

function Avatar({ name, color, size = 36 }: { name: string; color: string; size?: number }) {
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

export default function PostDetailScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { theme } = useTheme();
  const { posts, toggleLike, addComment, getPostComments, deletePost, communityProfile } = useCommunity();
  const { authState } = useNutrition();
  const [commentText, setCommentText] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const post = posts.find(p => p.id === postId);
  const postComments = getPostComments(postId || '');
  const currentUserId = communityProfile?.userId || authState.userId || null;
  const isLiked = currentUserId ? (post?.likes.includes(currentUserId) ?? false) : false;
  const isOwn = currentUserId === post?.userId;

  const likeScale = useRef(new Animated.Value(1)).current;

  const handleLike = useCallback(() => {
    if (!postId) return;
    if (!authState.isSignedIn) {
      Alert.alert('Masuk Diperlukan', 'Silakan masuk untuk menyukai post.');
      return;
    }
    if (!communityProfile) {
      router.push('/setup-community-profile');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(likeScale, { toValue: 1.4, duration: 100, useNativeDriver: true }),
      Animated.timing(likeScale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    toggleLike(postId);
  }, [postId, authState.isSignedIn, communityProfile, toggleLike, likeScale]);

  const handleSendComment = useCallback(() => {
    if (!commentText.trim() || !postId) return;
    if (!authState.isSignedIn) {
      Alert.alert('Masuk Diperlukan', 'Silakan masuk untuk berkomentar.');
      return;
    }
    if (!communityProfile) {
      router.push('/setup-community-profile');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addComment(postId, commentText.trim());
    setCommentText('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
  }, [commentText, postId, authState.isSignedIn, communityProfile, addComment]);

  const handleDelete = useCallback(() => {
    if (!postId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Hapus Post', 'Yakin ingin menghapus post ini?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: () => {
          deletePost(postId);
          router.back();
        },
      },
    ]);
  }, [postId, deletePost]);

  if (!post) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Post',
            headerStyle: { backgroundColor: theme.background },
            headerTintColor: theme.text,
            headerShadowVisible: false,
          }}
        />
        <View style={[styles.container, { backgroundColor: theme.background }]}>
          <View style={styles.notFound}>
            <Text style={[styles.notFoundText, { color: theme.textSecondary }]}>Post tidak ditemukan</Text>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Post',
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerShadowVisible: false,
          headerRight: isOwn
            ? () => (
                <TouchableOpacity onPress={handleDelete} style={styles.headerDeleteBtn} activeOpacity={0.7}>
                  <Trash2 size={18} color={theme.destructive} />
                </TouchableOpacity>
              )
            : undefined,
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={[styles.container, { backgroundColor: theme.background }]}>
          <ScrollView
            ref={scrollRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.postSection, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.postHeader}>
                <Avatar name={post.displayName} color={post.avatarColor} size={42} />
                <View style={styles.postUserText}>
                  <Text style={[styles.postDisplayName, { color: theme.text }]}>{post.displayName}</Text>
                  <View style={styles.postMeta}>
                    <Text style={[styles.postUsername, { color: theme.textTertiary }]}>@{post.username}</Text>
                    <Text style={[styles.postDot, { color: theme.textTertiary }]}>·</Text>
                    <Clock size={12} color={theme.textTertiary} />
                    <Text style={[styles.postTime, { color: theme.textTertiary }]}>{timeAgo(post.createdAt)}</Text>
                  </View>
                </View>
              </View>

              {post.caption ? (
                <Text style={[styles.postCaption, { color: theme.text }]}>{post.caption}</Text>
              ) : null}

              <View style={[styles.foodCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                <View style={styles.foodCardHeader}>
                  <Utensils size={15} color={theme.primary} />
                  <Text style={[styles.foodName, { color: theme.text }]}>{post.foodName}</Text>
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
                <TouchableOpacity style={styles.actionBtn} onPress={handleLike} activeOpacity={0.7}>
                  <Animated.View style={{ transform: [{ scale: likeScale }] }}>
                    <Heart
                      size={20}
                      color={isLiked ? '#E53E3E' : theme.textTertiary}
                      fill={isLiked ? '#E53E3E' : 'transparent'}
                    />
                  </Animated.View>
                  <Text style={[styles.actionLabel, { color: isLiked ? '#E53E3E' : theme.textTertiary }]}>
                    {post.likes.length} {post.likes.length === 1 ? 'suka' : 'suka'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.commentsSection}>
              <Text style={[styles.commentsTitle, { color: theme.text }]}>
                Komentar ({postComments.length})
              </Text>

              {postComments.length === 0 ? (
                <View style={styles.noComments}>
                  <Text style={[styles.noCommentsText, { color: theme.textTertiary }]}>
                    Belum ada komentar. Jadilah yang pertama!
                  </Text>
                </View>
              ) : (
                postComments.map(comment => (
                  <View
                    key={comment.id}
                    style={[styles.commentItem, { borderBottomColor: theme.border }]}
                  >
                    <Avatar name={comment.displayName} color={comment.avatarColor} size={32} />
                    <View style={styles.commentContent}>
                      <View style={styles.commentHeader}>
                        <Text style={[styles.commentName, { color: theme.text }]}>{comment.displayName}</Text>
                        <Text style={[styles.commentTime, { color: theme.textTertiary }]}>
                          {timeAgo(comment.createdAt)}
                        </Text>
                      </View>
                      <Text style={[styles.commentText, { color: theme.text }]}>{comment.text}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>

          <View style={[styles.inputBar, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
            {communityProfile && (
              <Avatar name={communityProfile.displayName} color={communityProfile.avatarColor} size={30} />
            )}
            <TextInput
              style={[styles.commentInput, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, color: theme.text }]}
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Tulis komentar..."
              placeholderTextColor={theme.textTertiary}
              maxLength={200}
              returnKeyType="send"
              onSubmitEditing={handleSendComment}
            />
            <TouchableOpacity
              onPress={handleSendComment}
              disabled={!commentText.trim()}
              activeOpacity={0.7}
              style={[styles.sendBtn, { backgroundColor: commentText.trim() ? theme.primary : theme.border }]}
            >
              <Send size={16} color={commentText.trim() ? '#FFFFFF' : theme.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundText: {
    fontSize: 15,
  },
  headerDeleteBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  postSection: {
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    marginBottom: 16,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
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
    marginLeft: 12,
    flex: 1,
  },
  postDisplayName: {
    fontSize: 16,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  postMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
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
  postCaption: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 14,
  },
  foodCard: {
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  foodCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  foodName: {
    fontSize: 15,
    fontWeight: '600' as const,
    flex: 1,
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
    fontSize: 16,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  macroLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  macroDivider: {
    width: 1,
    height: 30,
  },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  commentsSection: {
    paddingHorizontal: 4,
  },
  commentsTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    marginBottom: 14,
    letterSpacing: -0.2,
  },
  noComments: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  noCommentsText: {
    fontSize: 14,
  },
  commentItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentName: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  commentTime: {
    fontSize: 12,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 30 : 10,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
    fontSize: 14,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
