import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { CommunityProfile, FoodPost, PostComment, AVATAR_COLORS } from '@/types/community';
import { MOCK_POSTS, MOCK_COMMENTS } from '@/mocks/communityPosts';
import { useNutrition } from '@/contexts/NutritionContext';

const COMMUNITY_PROFILE_KEY = 'community_profile';
const COMMUNITY_POSTS_KEY = 'community_posts';
const COMMUNITY_COMMENTS_KEY = 'community_comments';

export const [CommunityProvider, useCommunity] = createContextHook(() => {
  const queryClient = useQueryClient();
  const { authState, profile } = useNutrition();

  const [communityProfile, setCommunityProfile] = useState<CommunityProfile | null>(null);
  const [posts, setPosts] = useState<FoodPost[]>([]);
  const [comments, setComments] = useState<PostComment[]>([]);

  const profileQuery = useQuery({
    queryKey: ['community_profile', authState.email],
    queryFn: async () => {
      if (!authState.email) return null;
      const key = `${COMMUNITY_PROFILE_KEY}_${authState.email.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        console.log('Community profile loaded:', stored);
        return JSON.parse(stored) as CommunityProfile;
      }
      return null;
    },
    enabled: !!authState.email,
  });

  const postsQuery = useQuery({
    queryKey: ['community_posts'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(COMMUNITY_POSTS_KEY);
      if (stored) {
        const userPosts = JSON.parse(stored) as FoodPost[];
        console.log('Loaded user posts:', userPosts.length);
        return userPosts;
      }
      return [];
    },
  });

  const commentsQuery = useQuery({
    queryKey: ['community_comments'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(COMMUNITY_COMMENTS_KEY);
      if (stored) {
        const userComments = JSON.parse(stored) as PostComment[];
        console.log('Loaded user comments:', userComments.length);
        return userComments;
      }
      return [];
    },
  });

  useEffect(() => {
    if (profileQuery.data) {
      setCommunityProfile(profileQuery.data);
    }
  }, [profileQuery.data]);

  useEffect(() => {
    const userPosts = postsQuery.data || [];
    const allPosts = [...MOCK_POSTS, ...userPosts].sort((a, b) => b.createdAt - a.createdAt);
    setPosts(allPosts);
  }, [postsQuery.data]);

  useEffect(() => {
    const userComments = commentsQuery.data || [];
    const allComments = [...MOCK_COMMENTS, ...userComments].sort((a, b) => a.createdAt - b.createdAt);
    setComments(allComments);
  }, [commentsQuery.data]);

  const saveProfileMutation = useMutation({
    mutationFn: async (newProfile: CommunityProfile) => {
      if (!authState.email) throw new Error('Not signed in');
      const key = `${COMMUNITY_PROFILE_KEY}_${authState.email.replace(/[^a-zA-Z0-9]/g, '_')}`;
      await AsyncStorage.setItem(key, JSON.stringify(newProfile));
      return newProfile;
    },
    onSuccess: (data) => {
      setCommunityProfile(data);
      queryClient.invalidateQueries({ queryKey: ['community_profile'] });
      console.log('Community profile saved:', data.username);
    },
  });

  const savePostMutation = useMutation({
    mutationFn: async (newPost: FoodPost) => {
      const stored = await AsyncStorage.getItem(COMMUNITY_POSTS_KEY);
      const existing = stored ? JSON.parse(stored) as FoodPost[] : [];
      const updated = [newPost, ...existing];
      await AsyncStorage.setItem(COMMUNITY_POSTS_KEY, JSON.stringify(updated));
      return updated;
    },
    onSuccess: (data) => {
      const allPosts = [...MOCK_POSTS, ...data].sort((a, b) => b.createdAt - a.createdAt);
      setPosts(allPosts);
      queryClient.invalidateQueries({ queryKey: ['community_posts'] });
      console.log('Post saved, total user posts:', data.length);
    },
  });

  const toggleLikeMutation = useMutation({
    mutationFn: async ({ postId, userId }: { postId: string; userId: string }) => {
      const isMockPost = MOCK_POSTS.some(p => p.id === postId);

      if (isMockPost) {
        return { postId, userId, source: 'mock' as const };
      }

      const stored = await AsyncStorage.getItem(COMMUNITY_POSTS_KEY);
      const userPosts = stored ? JSON.parse(stored) as FoodPost[] : [];
      const updated = userPosts.map(post => {
        if (post.id === postId) {
          const liked = post.likes.includes(userId);
          return {
            ...post,
            likes: liked
              ? post.likes.filter(id => id !== userId)
              : [...post.likes, userId],
          };
        }
        return post;
      });
      await AsyncStorage.setItem(COMMUNITY_POSTS_KEY, JSON.stringify(updated));
      return { postId, userId, source: 'user' as const };
    },
    onSuccess: (result) => {
      setPosts(prev => prev.map(post => {
        if (post.id === result.postId) {
          const liked = post.likes.includes(result.userId);
          return {
            ...post,
            likes: liked
              ? post.likes.filter(id => id !== result.userId)
              : [...post.likes, result.userId],
          };
        }
        return post;
      }));
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async (newComment: PostComment) => {
      const stored = await AsyncStorage.getItem(COMMUNITY_COMMENTS_KEY);
      const existing = stored ? JSON.parse(stored) as PostComment[] : [];
      const updated = [...existing, newComment];
      await AsyncStorage.setItem(COMMUNITY_COMMENTS_KEY, JSON.stringify(updated));
      return newComment;
    },
    onSuccess: (newComment) => {
      setComments(prev => [...prev, newComment].sort((a, b) => a.createdAt - b.createdAt));
      setPosts(prev => prev.map(post => {
        if (post.id === newComment.postId) {
          return { ...post, commentCount: post.commentCount + 1 };
        }
        return post;
      }));
      queryClient.invalidateQueries({ queryKey: ['community_comments'] });
      console.log('Comment added to post:', newComment.postId);
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const stored = await AsyncStorage.getItem(COMMUNITY_POSTS_KEY);
      const existing = stored ? JSON.parse(stored) as FoodPost[] : [];
      const updated = existing.filter(p => p.id !== postId);
      await AsyncStorage.setItem(COMMUNITY_POSTS_KEY, JSON.stringify(updated));

      const storedComments = await AsyncStorage.getItem(COMMUNITY_COMMENTS_KEY);
      const existingComments = storedComments ? JSON.parse(storedComments) as PostComment[] : [];
      const updatedComments = existingComments.filter(c => c.postId !== postId);
      await AsyncStorage.setItem(COMMUNITY_COMMENTS_KEY, JSON.stringify(updatedComments));

      return postId;
    },
    onSuccess: (postId) => {
      setPosts(prev => prev.filter(p => p.id !== postId));
      setComments(prev => prev.filter(c => c.postId !== postId));
      queryClient.invalidateQueries({ queryKey: ['community_posts'] });
      queryClient.invalidateQueries({ queryKey: ['community_comments'] });
    },
  });

  const saveCommunityProfile = useCallback((newProfile: CommunityProfile) => {
    saveProfileMutation.mutate(newProfile);
  }, [saveProfileMutation]);

  const createPost = useCallback((post: Omit<FoodPost, 'id' | 'createdAt' | 'likes' | 'commentCount'>) => {
    const newPost: FoodPost = {
      ...post,
      id: `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      likes: [],
      commentCount: 0,
    };
    savePostMutation.mutate(newPost);
    return newPost;
  }, [savePostMutation]);

  const toggleLike = useCallback((postId: string) => {
    const userId = communityProfile?.userId || authState.userId || 'anonymous';
    toggleLikeMutation.mutate({ postId, userId });
  }, [toggleLikeMutation, communityProfile, authState.userId]);

  const addComment = useCallback((postId: string, text: string) => {
    if (!communityProfile) return;
    const newComment: PostComment = {
      id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      postId,
      userId: communityProfile.userId,
      username: communityProfile.username,
      displayName: communityProfile.displayName,
      avatarColor: communityProfile.avatarColor,
      text,
      createdAt: Date.now(),
    };
    addCommentMutation.mutate(newComment);
  }, [addCommentMutation, communityProfile]);

  const deletePost = useCallback((postId: string) => {
    deletePostMutation.mutate(postId);
  }, [deletePostMutation]);

  const getPostComments = useCallback((postId: string) => {
    return comments.filter(c => c.postId === postId);
  }, [comments]);

  const hasProfile = !!communityProfile;
  const isLoading = profileQuery.isLoading || postsQuery.isLoading;

  return {
    communityProfile,
    posts,
    comments,
    hasProfile,
    isLoading,
    saveCommunityProfile,
    createPost,
    toggleLike,
    addComment,
    deletePost,
    getPostComments,
  };
});
