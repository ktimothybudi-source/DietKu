import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { CommunityProfile, FoodPost, PostComment, CommunityGroup, GroupMember, AVATAR_COLORS, generateInviteCode } from '@/types/community';
import { MOCK_POSTS, MOCK_COMMENTS, MOCK_GROUPS } from '@/mocks/communityPosts';
import { useNutrition } from '@/contexts/NutritionContext';
import { FoodEntry } from '@/types/nutrition';
import { eventEmitter } from '@/utils/eventEmitter';

const COMMUNITY_PROFILE_KEY = 'community_profile';
const COMMUNITY_POSTS_KEY = 'community_posts';
const COMMUNITY_COMMENTS_KEY = 'community_comments';
const USER_GROUPS_KEY = 'community_user_groups';
const ACTIVE_GROUP_KEY = 'community_active_group';
const CUSTOM_GROUPS_KEY = 'community_custom_groups';

export const [CommunityProvider, useCommunity] = createContextHook(() => {
  const queryClient = useQueryClient();
  const { authState, profile } = useNutrition();

  const [communityProfile, setCommunityProfile] = useState<CommunityProfile | null>(null);
  const [posts, setPosts] = useState<FoodPost[]>([]);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [joinedGroupIds, setJoinedGroupIds] = useState<string[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [allGroups, setAllGroups] = useState<CommunityGroup[]>([...MOCK_GROUPS]);

  const joinedGroupIdsQuery = useQuery({
    queryKey: ['community_user_groups'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(USER_GROUPS_KEY);
      console.log('Community joined groups:', stored);
      return stored ? JSON.parse(stored) as string[] : [];
    },
  });

  const activeGroupQuery = useQuery({
    queryKey: ['community_active_group'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(ACTIVE_GROUP_KEY);
      console.log('Community active group:', stored);
      return stored || null;
    },
  });

  const customGroupsQuery = useQuery({
    queryKey: ['community_custom_groups'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(CUSTOM_GROUPS_KEY);
      console.log('Community custom groups:', stored);
      return stored ? JSON.parse(stored) as CommunityGroup[] : [];
    },
  });

  useEffect(() => {
    if (joinedGroupIdsQuery.data !== undefined) {
      setJoinedGroupIds(joinedGroupIdsQuery.data);
    }
  }, [joinedGroupIdsQuery.data]);

  useEffect(() => {
    if (activeGroupQuery.data !== undefined) {
      setActiveGroupId(activeGroupQuery.data);
    }
  }, [activeGroupQuery.data]);

  useEffect(() => {
    if (customGroupsQuery.data) {
      const merged = [...MOCK_GROUPS];
      for (const cg of customGroupsQuery.data) {
        if (!merged.find(g => g.id === cg.id)) {
          merged.push(cg);
        }
      }
      setAllGroups(merged);
    }
  }, [customGroupsQuery.data]);

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
            likes: liked ? post.likes.filter(id => id !== userId) : [...post.likes, userId],
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
            likes: liked ? post.likes.filter(id => id !== result.userId) : [...post.likes, result.userId],
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

  const joinGroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      const current = await AsyncStorage.getItem(USER_GROUPS_KEY);
      const ids = current ? JSON.parse(current) as string[] : [];
      if (!ids.includes(groupId)) {
        ids.push(groupId);
      }
      await AsyncStorage.setItem(USER_GROUPS_KEY, JSON.stringify(ids));
      await AsyncStorage.setItem(ACTIVE_GROUP_KEY, groupId);

      if (communityProfile) {
        const stored = await AsyncStorage.getItem(CUSTOM_GROUPS_KEY);
        const customGroups = stored ? JSON.parse(stored) as CommunityGroup[] : [];
        const groupIdx = customGroups.findIndex(g => g.id === groupId);
        if (groupIdx >= 0) {
          const alreadyMember = customGroups[groupIdx].members.some(m => m.userId === communityProfile.userId);
          if (!alreadyMember) {
            customGroups[groupIdx].members.push({
              userId: communityProfile.userId,
              displayName: communityProfile.displayName,
              username: communityProfile.username,
              avatarColor: communityProfile.avatarColor,
              role: 'member',
              joinedAt: Date.now(),
            });
            await AsyncStorage.setItem(CUSTOM_GROUPS_KEY, JSON.stringify(customGroups));
          }
        }
      }

      return { ids, activeId: groupId };
    },
    onSuccess: (data) => {
      setJoinedGroupIds(data.ids);
      setActiveGroupId(data.activeId);
      queryClient.invalidateQueries({ queryKey: ['community_user_groups'] });
      queryClient.invalidateQueries({ queryKey: ['community_active_group'] });
      queryClient.invalidateQueries({ queryKey: ['community_custom_groups'] });
      console.log('Joined group:', data.activeId);
    },
  });

  const leaveGroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      const current = await AsyncStorage.getItem(USER_GROUPS_KEY);
      const ids = current ? JSON.parse(current) as string[] : [];
      const updated = ids.filter(id => id !== groupId);
      await AsyncStorage.setItem(USER_GROUPS_KEY, JSON.stringify(updated));

      const currentActive = await AsyncStorage.getItem(ACTIVE_GROUP_KEY);
      let newActive: string | null = currentActive;
      if (currentActive === groupId) {
        newActive = updated.length > 0 ? updated[0] : null;
        if (newActive) {
          await AsyncStorage.setItem(ACTIVE_GROUP_KEY, newActive);
        } else {
          await AsyncStorage.removeItem(ACTIVE_GROUP_KEY);
        }
      }

      return { ids: updated, activeId: newActive };
    },
    onSuccess: (data) => {
      setJoinedGroupIds(data.ids);
      setActiveGroupId(data.activeId);
      queryClient.invalidateQueries({ queryKey: ['community_user_groups'] });
      queryClient.invalidateQueries({ queryKey: ['community_active_group'] });
      console.log('Left group, remaining:', data.ids.length);
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: async (group: Omit<CommunityGroup, 'id' | 'createdAt' | 'inviteCode' | 'members'>) => {
      const newGroup: CommunityGroup = {
        ...group,
        id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        inviteCode: generateInviteCode(),
        members: communityProfile ? [{
          userId: communityProfile.userId,
          displayName: communityProfile.displayName,
          username: communityProfile.username,
          avatarColor: communityProfile.avatarColor,
          role: 'admin' as const,
          joinedAt: Date.now(),
        }] : [],
        createdAt: Date.now(),
      };

      const stored = await AsyncStorage.getItem(CUSTOM_GROUPS_KEY);
      const existing = stored ? JSON.parse(stored) as CommunityGroup[] : [];
      const updated = [newGroup, ...existing];
      await AsyncStorage.setItem(CUSTOM_GROUPS_KEY, JSON.stringify(updated));

      const currentIds = await AsyncStorage.getItem(USER_GROUPS_KEY);
      const ids = currentIds ? JSON.parse(currentIds) as string[] : [];
      ids.push(newGroup.id);
      await AsyncStorage.setItem(USER_GROUPS_KEY, JSON.stringify(ids));
      await AsyncStorage.setItem(ACTIVE_GROUP_KEY, newGroup.id);

      return { group: newGroup, ids };
    },
    onSuccess: (data) => {
      setAllGroups(prev => {
        const exists = prev.find(g => g.id === data.group.id);
        if (exists) return prev;
        return [data.group, ...prev];
      });
      setJoinedGroupIds(data.ids);
      setActiveGroupId(data.group.id);
      queryClient.invalidateQueries({ queryKey: ['community_custom_groups'] });
      queryClient.invalidateQueries({ queryKey: ['community_user_groups'] });
      queryClient.invalidateQueries({ queryKey: ['community_active_group'] });
      console.log('Created group:', data.group.name, 'code:', data.group.inviteCode);
    },
  });

  const switchActiveGroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      await AsyncStorage.setItem(ACTIVE_GROUP_KEY, groupId);
      return groupId;
    },
    onSuccess: (groupId) => {
      setActiveGroupId(groupId);
      queryClient.invalidateQueries({ queryKey: ['community_active_group'] });
      console.log('Switched active group to:', groupId);
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
      groupId: activeGroupId || undefined,
    };
    savePostMutation.mutate(newPost);
    return newPost;
  }, [savePostMutation, activeGroupId]);

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

  const joinGroup = useCallback((groupId: string) => {
    joinGroupMutation.mutate(groupId);
  }, [joinGroupMutation]);

  const leaveGroup = useCallback((groupId: string) => {
    leaveGroupMutation.mutate(groupId);
  }, [leaveGroupMutation]);

  const createGroup = useCallback((group: Omit<CommunityGroup, 'id' | 'createdAt' | 'inviteCode' | 'members'>) => {
    createGroupMutation.mutate(group);
  }, [createGroupMutation]);

  const switchActiveGroup = useCallback((groupId: string) => {
    switchActiveGroupMutation.mutate(groupId);
  }, [switchActiveGroupMutation]);

  const findGroupByInviteCode = useCallback((code: string): CommunityGroup | undefined => {
    const upperCode = code.toUpperCase().trim();
    return allGroups.find(g => g.inviteCode === upperCode);
  }, [allGroups]);

  const discoverableGroups = useMemo(() => {
    return allGroups.filter(g => g.privacy === 'public' && !joinedGroupIds.includes(g.id));
  }, [allGroups, joinedGroupIds]);

  const joinedGroups = useMemo(() => {
    return allGroups.filter(g => joinedGroupIds.includes(g.id));
  }, [allGroups, joinedGroupIds]);

  const activeGroup = useMemo(() => {
    if (!activeGroupId) return null;
    return allGroups.find(g => g.id === activeGroupId) || null;
  }, [allGroups, activeGroupId]);

  const hasJoinedGroup = joinedGroupIds.length > 0;
  const hasProfile = !!communityProfile;
  const isLoading = profileQuery.isLoading || postsQuery.isLoading || joinedGroupIdsQuery.isLoading;

  useEffect(() => {
    const handleFoodEntryAdded = (data: any) => {
      const { foodEntry } = data as { foodEntry: Omit<FoodEntry, 'id' | 'timestamp'> };
      
      if (!communityProfile || !hasJoinedGroup) {
        console.log('Skipping auto-post: No profile or not in a group');
        return;
      }

      console.log('Auto-posting food entry to community:', foodEntry.name);
      
      const newPost: FoodPost = {
        id: `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: communityProfile.userId,
        username: communityProfile.username,
        displayName: communityProfile.displayName,
        avatarColor: communityProfile.avatarColor,
        caption: '',
        foodName: foodEntry.name,
        calories: Math.round(foodEntry.calories),
        protein: Math.round(foodEntry.protein),
        carbs: Math.round(foodEntry.carbs),
        fat: Math.round(foodEntry.fat),
        createdAt: Date.now(),
        likes: [],
        commentCount: 0,
        groupId: activeGroupId || undefined,
      };
      
      savePostMutation.mutate(newPost);
    };

    eventEmitter.on('foodEntryAdded', handleFoodEntryAdded);
    return () => eventEmitter.off('foodEntryAdded', handleFoodEntryAdded);
  }, [communityProfile, hasJoinedGroup, activeGroupId, savePostMutation]);

  return {
    communityProfile,
    posts,
    comments,
    hasProfile,
    hasJoinedGroup,
    isLoading,
    joinedGroupIds,
    joinedGroups,
    activeGroup,
    activeGroupId,
    allGroups,
    discoverableGroups,
    joinGroup,
    leaveGroup,
    createGroup,
    switchActiveGroup,
    findGroupByInviteCode,
    saveCommunityProfile,
    createPost,
    toggleLike,
    addComment,
    deletePost,
    getPostComments,
  };
});
