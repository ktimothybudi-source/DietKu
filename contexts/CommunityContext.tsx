import createContextHook from '@nkzw/create-context-hook';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { CommunityProfile, FoodPost, PostComment, CommunityGroup, GroupMember, generateInviteCode } from '@/types/community';
import { useNutrition } from '@/contexts/NutritionContext';
import { FoodEntry } from '@/types/nutrition';
import { eventEmitter } from '@/utils/eventEmitter';
import { supabase } from '@/lib/supabase';
import { notifyGroupFoodScanned } from '@/utils/pushNotifications';
import { deleteImageFromSupabase, resolveMealPhotoForDatabase } from '@/utils/supabaseStorage';
import { fetchPremiumBypassUserIdSet } from '@/utils/communityPremium';

const COMMUNITY_POST_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const COMMUNITY_PHOTO_BUCKET = 'meal-photos';
const genUuid = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

type DbProfile = {
  user_id: string;
  username: string;
  display_name: string;
  avatar_color: string;
  bio: string | null;
  created_at: string;
};

type DbGroup = {
  id: string;
  name: string;
  description: string | null;
  cover_image: string | null;
  invite_code: string;
  created_by: string;
  privacy: 'private' | 'public';
  created_at: string;
};

type DbGroupMember = {
  group_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
};

type DbPost = {
  id: string;
  user_id: string;
  group_id: string;
  caption: string | null;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack' | null;
  food_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  photo_uri: string | null;
  created_at: string;
};

type DbLike = {
  post_id: string;
  user_id: string;
};

type DbComment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

const toTs = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : Date.now());
const isRemoteImage = (uri?: string | null) => !!uri && /^https?:\/\//i.test(uri);
const getStoragePathFromUrl = (uri: string): string | null => {
  if (!uri) return null;
  if (!isRemoteImage(uri)) {
    // Already a storage object path (e.g. "userId/file.jpg")
    return uri;
  }
  const publicMarker = `/storage/v1/object/public/${COMMUNITY_PHOTO_BUCKET}/`;
  const signMarker = `/storage/v1/object/sign/${COMMUNITY_PHOTO_BUCKET}/`;
  const objectMarker = `/storage/v1/object/${COMMUNITY_PHOTO_BUCKET}/`;
  if (uri.includes(publicMarker)) {
    return decodeURIComponent(uri.split(publicMarker)[1]?.split('?')[0] || '');
  }
  if (uri.includes(signMarker)) {
    return decodeURIComponent(uri.split(signMarker)[1]?.split('?')[0] || '');
  }
  if (uri.includes(objectMarker)) {
    return decodeURIComponent(uri.split(objectMarker)[1]?.split('?')[0] || '');
  }
  return null;
};

export const [CommunityProvider, useCommunity] = createContextHook(() => {
  const queryClient = useQueryClient();
  const { authState } = useNutrition();
  const userId = authState.userId;
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: ['community_profile', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('community_profiles')
        .select('user_id, username, display_name, avatar_color, bio, created_at')
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as unknown as DbProfile;
      const mapped: CommunityProfile = {
        userId: row.user_id,
        username: row.username,
        displayName: row.display_name,
        avatarColor: row.avatar_color,
        bio: row.bio ?? undefined,
        joinedAt: toTs(row.created_at),
      };
      return mapped;
    },
  });

  const membershipsQuery = useQuery({
    queryKey: ['community_memberships', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('community_group_members')
        .select('group_id, user_id, role, joined_at')
        .eq('user_id', userId!);
      if (error) throw error;
      return (data || []) as unknown as DbGroupMember[];
    },
  });

  const joinedGroupIds = useMemo(
    () => (membershipsQuery.data || []).map((m) => m.group_id),
    [membershipsQuery.data]
  );

  const groupsQuery = useQuery({
    queryKey: ['community_groups_joined', joinedGroupIds.join('|')],
    enabled: joinedGroupIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('community_groups')
        .select('id, name, description, cover_image, invite_code, created_by, privacy, created_at')
        .in('id', joinedGroupIds);
      if (error) throw error;
      return (data || []) as unknown as DbGroup[];
    },
  });

  const groupMembersQuery = useQuery({
    queryKey: ['community_group_members_all', joinedGroupIds.join('|')],
    enabled: joinedGroupIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('community_group_members')
        .select('group_id, user_id, role, joined_at')
        .in('group_id', joinedGroupIds);
      if (error) throw error;
      const members = (data || []) as unknown as DbGroupMember[];
      const profileIds = Array.from(new Set(members.map((m) => m.user_id)));
      let profileMap: Record<string, DbProfile> = {};
      if (profileIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('community_profiles')
          .select('user_id, username, display_name, avatar_color, bio, created_at')
          .in('user_id', profileIds);
        if (profilesError) throw profilesError;
        profileMap = Object.fromEntries(
          ((profilesData || []) as unknown as DbProfile[]).map((p) => [p.user_id, p])
        );
      }
      return { members, profileMap };
    },
  });

  const postsRawQuery = useQuery({
    queryKey: ['community_posts', joinedGroupIds.join('|')],
    enabled: joinedGroupIds.length > 0,
    queryFn: async () => {
      const oldestIso = new Date(Date.now() - COMMUNITY_POST_TTL_MS).toISOString();
      const { data, error } = await supabase
        .from('community_posts')
        .select('id, user_id, group_id, caption, meal_type, food_name, calories, protein, carbs, fat, photo_uri, created_at')
        .in('group_id', joinedGroupIds)
        .gte('created_at', oldestIso)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = ((data || []) as unknown as DbPost[]);
      const withSignedUrls = await Promise.all(rows.map(async (row) => {
        if (!row.photo_uri) return row;
        const path = getStoragePathFromUrl(row.photo_uri);
        if (!path) return row;
        const { data: signedData, error: signedError } = await supabase.storage
          .from(COMMUNITY_PHOTO_BUCKET)
          .createSignedUrl(path, 60 * 60 * 24 * 30);
        if (!signedError && signedData?.signedUrl) {
          return { ...row, photo_uri: signedData.signedUrl };
        }
        console.warn('Failed to create signed URL for community photo path:', path, signedError?.message);
        const { data: publicData } = supabase.storage.from(COMMUNITY_PHOTO_BUCKET).getPublicUrl(path);
        if (publicData?.publicUrl) {
          return { ...row, photo_uri: publicData.publicUrl };
        }
        // Keep original value for debugging instead of silently dropping it.
        return row;
      }));
      return withSignedUrls;
    },
  });

  const postAuthorsQuery = useQuery({
    queryKey: ['community_post_authors', (postsRawQuery.data || []).map((p) => p.user_id).join('|')],
    enabled: (postsRawQuery.data || []).length > 0,
    queryFn: async () => {
      const authorIds = Array.from(new Set((postsRawQuery.data || []).map((p) => p.user_id)));
      if (authorIds.length === 0) return {} as Record<string, DbProfile>;
      const { data, error } = await supabase
        .from('community_profiles')
        .select('user_id, username, display_name, avatar_color, bio, created_at')
        .in('user_id', authorIds);
      if (error) throw error;
      return Object.fromEntries(((data || []) as unknown as DbProfile[]).map((p) => [p.user_id, p])) as Record<string, DbProfile>;
    },
  });

  const likesQuery = useQuery({
    queryKey: ['community_likes', (postsRawQuery.data || []).map((p) => p.id).join('|')],
    enabled: (postsRawQuery.data || []).length > 0,
    queryFn: async () => {
      const postIds = (postsRawQuery.data || []).map((p) => p.id);
      const { data, error } = await supabase
        .from('community_post_likes')
        .select('post_id, user_id')
        .in('post_id', postIds);
      if (error) throw error;
      return (data || []) as unknown as DbLike[];
    },
  });

  const commentsRawQuery = useQuery({
    queryKey: ['community_comments', (postsRawQuery.data || []).map((p) => p.id).join('|')],
    enabled: (postsRawQuery.data || []).length > 0,
    queryFn: async () => {
      const postIds = (postsRawQuery.data || []).map((p) => p.id);
      const { data, error } = await supabase
        .from('community_comments')
        .select('id, post_id, user_id, content, created_at')
        .in('post_id', postIds)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const rows = (data || []) as unknown as DbComment[];
      const userIds = Array.from(new Set(rows.map((c) => c.user_id)));
      let profileMap: Record<string, DbProfile> = {};
      if (userIds.length > 0) {
        const { data: profilesData, error: pErr } = await supabase
          .from('community_profiles')
          .select('user_id, username, display_name, avatar_color, bio, created_at')
          .in('user_id', userIds);
        if (pErr) throw pErr;
        profileMap = Object.fromEntries(
          ((profilesData || []) as unknown as DbProfile[]).map((p) => [p.user_id, p])
        );
      }
      return { rows, profileMap };
    },
  });

  const allGroups = useMemo<CommunityGroup[]>(() => {
    const groups = groupsQuery.data || [];
    const members = groupMembersQuery.data?.members || [];
    const profileMap = groupMembersQuery.data?.profileMap || {};
    return groups.map((g) => {
      const groupMembers: GroupMember[] = members
        .filter((m) => m.group_id === g.id)
        .map((m) => {
          const p = profileMap[m.user_id];
          return {
            userId: m.user_id,
            username: p?.username || 'user',
            displayName: p?.display_name || 'User',
            avatarColor: p?.avatar_color || '#22C55E',
            role: m.role,
            joinedAt: toTs(m.joined_at),
          };
        });
      return {
        id: g.id,
        name: g.name,
        description: g.description || '',
        coverImage: g.cover_image || '',
        inviteCode: g.invite_code,
        privacy: (g.privacy || 'private') as 'private' | 'public',
        creatorId: g.created_by,
        members: groupMembers,
        createdAt: toTs(g.created_at),
      };
    });
  }, [groupsQuery.data, groupMembersQuery.data]);

  const communityProfile = profileQuery.data || null;

  const comments = useMemo<PostComment[]>(() => {
    const rows = commentsRawQuery.data?.rows || [];
    const profileMap = commentsRawQuery.data?.profileMap || {};
    return rows.map((c) => {
      const p = profileMap[c.user_id];
      return {
        id: c.id,
        postId: c.post_id,
        userId: c.user_id,
        username: p?.username || 'user',
        displayName: p?.display_name || 'User',
        avatarColor: p?.avatar_color || '#22C55E',
        text: c.content,
        createdAt: toTs(c.created_at),
      };
    });
  }, [commentsRawQuery.data]);

  const premiumCandidateUserIds = useMemo(() => {
    const s = new Set<string>();
    (postsRawQuery.data || []).forEach((p) => s.add(p.user_id));
    (commentsRawQuery.data?.rows || []).forEach((c) => s.add(c.user_id));
    (groupMembersQuery.data?.members || []).forEach((m) => s.add(m.user_id));
    return Array.from(s).filter(Boolean).sort();
  }, [postsRawQuery.data, commentsRawQuery.data, groupMembersQuery.data]);

  const premiumBypassSetQuery = useQuery({
    queryKey: ['community_premium_bypass_users', premiumCandidateUserIds.join('|')],
    enabled: !!userId && premiumCandidateUserIds.length > 0,
    staleTime: 2 * 60 * 1000,
    queryFn: () => fetchPremiumBypassUserIdSet(premiumCandidateUserIds),
  });

  const isUserPremiumInCommunity = useCallback(
    (id: string) => premiumBypassSetQuery.data?.has(id) ?? false,
    [premiumBypassSetQuery.data],
  );

  const posts = useMemo<FoodPost[]>(() => {
    const rows = postsRawQuery.data || [];
    const likes = likesQuery.data || [];
    const likesByPost: Record<string, string[]> = {};
    likes.forEach((l) => {
      if (!likesByPost[l.post_id]) likesByPost[l.post_id] = [];
      likesByPost[l.post_id].push(l.user_id);
    });
    const commentsCountByPost: Record<string, number> = {};
    comments.forEach((c) => {
      commentsCountByPost[c.postId] = (commentsCountByPost[c.postId] || 0) + 1;
    });
    const profileMap = postAuthorsQuery.data || {};
    const premiumSet = premiumBypassSetQuery.data;
    return rows.map((p) => {
      const author = profileMap[p.user_id];
      return {
        id: p.id,
        userId: p.user_id,
        username: author?.username || 'user',
        displayName: author?.display_name || 'User',
        authorPremium: premiumSet?.has(p.user_id) ?? false,
        avatarColor: author?.avatar_color || '#22C55E',
        caption: p.caption || '',
        foodName: p.food_name,
        calories: Math.round(Number(p.calories || 0)),
        protein: Math.round(Number(p.protein || 0)),
        carbs: Math.round(Number(p.carbs || 0)),
        fat: Math.round(Number(p.fat || 0)),
        photoUri: p.photo_uri
          ? (
            isRemoteImage(p.photo_uri)
              ? p.photo_uri
              : supabase.storage.from(COMMUNITY_PHOTO_BUCKET).getPublicUrl(p.photo_uri).data.publicUrl
          )
          : undefined,
        likes: likesByPost[p.id] || [],
        commentCount: commentsCountByPost[p.id] || 0,
        createdAt: toTs(p.created_at),
        mealType: p.meal_type || undefined,
        groupId: p.group_id,
      };
    });
  }, [postsRawQuery.data, likesQuery.data, comments, postAuthorsQuery.data, premiumBypassSetQuery.data]);

  useEffect(() => {
    if (!activeGroupId) {
      setActiveGroupId(joinedGroupIds[0] || null);
      return;
    }
    if (activeGroupId && !joinedGroupIds.includes(activeGroupId)) {
      setActiveGroupId(joinedGroupIds[0] || null);
    }
  }, [joinedGroupIds, activeGroupId]);

  const saveProfileMutation = useMutation({
    mutationFn: async (newProfile: CommunityProfile) => {
      if (!userId) throw new Error('Not authenticated');
      const { error } = await supabase.from('community_profiles').upsert(
        {
          user_id: userId,
          username: newProfile.username,
          display_name: newProfile.displayName,
          avatar_color: newProfile.avatarColor,
          bio: newProfile.bio || null,
        },
        { onConflict: 'user_id' }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community_profile'] });
      queryClient.invalidateQueries({ queryKey: ['community_group_members_all'] });
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: async (group: Omit<CommunityGroup, 'id' | 'createdAt' | 'inviteCode' | 'members'>) => {
      if (!userId) throw new Error('Not authenticated');
      const inviteCode = generateInviteCode();
      const newGroupId = genUuid();
      const { error } = await supabase
        .from('community_groups')
        .insert({
          id: newGroupId,
          name: group.name,
          description: group.description || '',
          cover_image: group.coverImage || null,
          invite_code: inviteCode,
          created_by: userId,
          privacy: group.privacy,
        });
      if (error) throw error;
      const { error: memberError } = await supabase
        .from('community_group_members')
        .insert({ group_id: newGroupId, user_id: userId, role: 'admin' });
      if (memberError) throw memberError;
      return newGroupId;
    },
    onSuccess: (newGroupId) => {
      setActiveGroupId(newGroupId);
      queryClient.invalidateQueries({ queryKey: ['community_memberships'] });
      queryClient.invalidateQueries({ queryKey: ['community_groups_joined'] });
      queryClient.invalidateQueries({ queryKey: ['community_group_members_all'] });
    },
    onError: (error) => {
      console.error('Failed to create community group:', JSON.stringify(error));
    },
  });

  const joinGroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      if (!userId) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('community_group_members')
        .insert({ group_id: groupId, user_id: userId, role: 'member' });
      if (error && error.code !== '23505') throw error;
      return groupId;
    },
    onSuccess: (groupId) => {
      setActiveGroupId(groupId);
      queryClient.invalidateQueries({ queryKey: ['community_memberships'] });
      queryClient.invalidateQueries({ queryKey: ['community_groups_joined'] });
      queryClient.invalidateQueries({ queryKey: ['community_group_members_all'] });
    },
  });

  const leaveGroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      if (!userId) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('community_group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community_memberships'] });
      queryClient.invalidateQueries({ queryKey: ['community_groups_joined'] });
      queryClient.invalidateQueries({ queryKey: ['community_group_members_all'] });
      queryClient.invalidateQueries({ queryKey: ['community_posts'] });
      queryClient.invalidateQueries({ queryKey: ['community_comments'] });
      queryClient.invalidateQueries({ queryKey: ['community_likes'] });
    },
  });

  const updateGroupNameMutation = useMutation({
    mutationFn: async ({ groupId, name }: { groupId: string; name: string }) => {
      if (!userId) throw new Error('Not authenticated');
      const trimmed = name.trim();
      if (trimmed.length < 3) throw new Error('GROUP_NAME_TOO_SHORT');
      if (trimmed.length > 60) throw new Error('GROUP_NAME_TOO_LONG');
      const { error } = await supabase
        .from('community_groups')
        .update({ name: trimmed })
        .eq('id', groupId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community_groups_joined'] });
    },
    onError: (error) => {
      console.error('Failed to update group name:', error);
    },
  });

  const createPostMutation = useMutation({
    mutationFn: async (post: Omit<FoodPost, 'id' | 'createdAt' | 'likes' | 'commentCount'>) => {
      if (!userId || !activeGroupId) throw new Error('Missing auth or active group');
      let photoUri: string | null = null;
      if (post.photoUri) {
        try {
          photoUri = await resolveMealPhotoForDatabase(post.photoUri, userId);
          console.log('Community createPost photo_uri for DB:', photoUri);
        } catch (error) {
          console.error('Failed to prepare community photo:', error);
          photoUri = null;
        }
      }
      const { data, error } = await supabase.from('community_posts').insert({
        user_id: userId,
        group_id: activeGroupId,
        caption: post.caption || '',
        meal_type: post.mealType || null,
        food_name: post.foodName,
        calories: post.calories,
        protein: post.protein,
        carbs: post.carbs,
        fat: post.fat,
        photo_uri: photoUri,
      }).select('id, user_id, group_id, caption, meal_type, food_name, calories, protein, carbs, fat, photo_uri, created_at').single();
      if (error) throw error;
      return data as unknown as DbPost;
    },
    onMutate: async (post) => {
      const optimisticId = `local-post-${Date.now()}`;
      await queryClient.cancelQueries({ queryKey: ['community_posts'] });
      queryClient.setQueriesData(
        { queryKey: ['community_posts'] },
        (old: DbPost[] | undefined) => {
          const optimistic: DbPost = {
            id: optimisticId,
            user_id: userId || '',
            group_id: activeGroupId || '',
            caption: post.caption || '',
            meal_type: (post.mealType as DbPost['meal_type']) || null,
            food_name: post.foodName,
            calories: post.calories,
            protein: post.protein,
            carbs: post.carbs,
            fat: post.fat,
            photo_uri: post.photoUri || null,
            created_at: new Date().toISOString(),
          };
          return [optimistic, ...(old || [])];
        }
      );
      return { optimisticId };
    },
    onSuccess: (savedPost, post, context) => {
      if (context?.optimisticId) {
        queryClient.setQueriesData(
          { queryKey: ['community_posts'] },
          (old: DbPost[] | undefined) => {
            const rows = old || [];
            const withoutOptimistic = rows.filter((p) => p.id !== context.optimisticId);
            return [savedPost, ...withoutOptimistic];
          }
        );
      }
      queryClient.invalidateQueries({ queryKey: ['community_posts'] });

      // Notify other group members (Indonesian “baru scan makanan” push).
      void (async () => {
        try {
          const groupId = savedPost.group_id || activeGroupId;
          if (!groupId) return;

          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!session?.access_token) return;

          const displayName =
            post.displayName ||
            post.username ||
            communityProfile?.displayName ||
            communityProfile?.username ||
            'Teman grup';

          await notifyGroupFoodScanned({
            accessToken: session.access_token,
            groupId,
            foodName: post.foodName || savedPost.food_name || 'makanan',
            calories: post.calories ?? savedPost.calories ?? 0,
            displayName,
          });
        } catch (err) {
          console.warn('Community food-scan push skipped:', err);
        }
      })();
    },
    onError: (_error, _post, context) => {
      if (context?.optimisticId) {
        queryClient.setQueriesData(
          { queryKey: ['community_posts'] },
          (old: DbPost[] | undefined) => (old || []).filter((p) => p.id !== context.optimisticId)
        );
      }
      console.error('Failed to create community post:', _error);
    },
  });

  const toggleLikeMutation = useMutation({
    mutationFn: async ({ postId }: { postId: string }) => {
      if (!userId) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('community_post_likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        const { error: deleteError } = await supabase.from('community_post_likes').delete().eq('id', (data as any).id);
        if (deleteError) throw deleteError;
        return;
      }
      const { error: insertError } = await supabase.from('community_post_likes').insert({ post_id: postId, user_id: userId });
      if (insertError) throw insertError;
    },
    onMutate: async ({ postId }) => {
      if (!userId) return;
      await queryClient.cancelQueries({ queryKey: ['community_likes'] });
      queryClient.setQueriesData(
        { queryKey: ['community_likes'] },
        (old: DbLike[] | undefined) => {
          const likes = old || [];
          const exists = likes.some((l) => l.post_id === postId && l.user_id === userId);
          if (exists) {
            return likes.filter((l) => !(l.post_id === postId && l.user_id === userId));
          }
          return [...likes, { post_id: postId, user_id: userId }];
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community_likes'] });
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ postId, text }: { postId: string; text: string }) => {
      if (!userId) throw new Error('Not authenticated');
      const { error } = await supabase.from('community_comments').insert({
        post_id: postId,
        user_id: userId,
        content: text,
      });
      if (error) throw error;
    },
    onMutate: async ({ postId, text }) => {
      if (!userId) return;
      const optimisticId = `local-comment-${Date.now()}`;
      await queryClient.cancelQueries({ queryKey: ['community_comments'] });
      queryClient.setQueriesData(
        { queryKey: ['community_comments'] },
        (old: { rows: DbComment[]; profileMap: Record<string, DbProfile> } | undefined) => {
          const prev = old || { rows: [], profileMap: {} };
          const row: DbComment = {
            id: optimisticId,
            post_id: postId,
            user_id: userId,
            content: text,
            created_at: new Date().toISOString(),
          };
          return { ...prev, rows: [...prev.rows, row] };
        }
      );
      return { optimisticId };
    },
    onError: (_error, _vars, context) => {
      if (!context?.optimisticId) return;
      queryClient.setQueriesData(
        { queryKey: ['community_comments'] },
        (old: { rows: DbComment[]; profileMap: Record<string, DbProfile> } | undefined) => {
          if (!old) return old;
          return { ...old, rows: old.rows.filter((c) => c.id !== context.optimisticId) };
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community_comments'] });
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const { data: existingPost, error: selectError } = await supabase
        .from('community_posts')
        .select('photo_uri')
        .eq('id', postId)
        .maybeSingle();
      if (selectError) throw selectError;

      const { error } = await supabase.from('community_posts').delete().eq('id', postId);
      if (error) throw error;

      const photoUri = (existingPost as { photo_uri?: string | null } | null)?.photo_uri;
      if (photoUri) {
        try {
          const storagePath = getStoragePathFromUrl(photoUri);
          if (storagePath) {
            const { error: storageError } = await supabase.storage
              .from(COMMUNITY_PHOTO_BUCKET)
              .remove([storagePath]);
            if (storageError) {
              throw storageError;
            }
          } else if (isRemoteImage(photoUri)) {
            await deleteImageFromSupabase(photoUri);
          }
        } catch (storageError) {
          // Keep post deletion successful even if storage cleanup fails.
          console.error('Failed to delete community post image from storage:', storageError);
        }
      }
    },
    onMutate: async (postId: string) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ['community_posts'] }),
        queryClient.cancelQueries({ queryKey: ['community_comments'] }),
        queryClient.cancelQueries({ queryKey: ['community_likes'] }),
      ]);
      const previousPosts = queryClient.getQueriesData<DbPost[]>({ queryKey: ['community_posts'] });
      const previousComments = queryClient.getQueriesData<{ rows: DbComment[]; profileMap: Record<string, DbProfile> }>({ queryKey: ['community_comments'] });
      const previousLikes = queryClient.getQueriesData<DbLike[]>({ queryKey: ['community_likes'] });
      queryClient.setQueriesData(
        { queryKey: ['community_posts'] },
        (old: DbPost[] | undefined) => (old || []).filter((p) => p.id !== postId)
      );
      queryClient.setQueriesData(
        { queryKey: ['community_comments'] },
        (old: { rows: DbComment[]; profileMap: Record<string, DbProfile> } | undefined) => {
          if (!old) return old;
          return { ...old, rows: old.rows.filter((c) => c.post_id !== postId) };
        }
      );
      queryClient.setQueriesData(
        { queryKey: ['community_likes'] },
        (old: DbLike[] | undefined) => (old || []).filter((l) => l.post_id !== postId)
      );
      return { previousPosts, previousComments, previousLikes };
    },
    onError: (_error, _postId, context) => {
      context?.previousPosts?.forEach(([key, data]) => queryClient.setQueryData(key, data));
      context?.previousComments?.forEach(([key, data]) => queryClient.setQueryData(key, data));
      context?.previousLikes?.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community_posts'] });
      queryClient.invalidateQueries({ queryKey: ['community_comments'] });
      queryClient.invalidateQueries({ queryKey: ['community_likes'] });
    },
  });

  const saveCommunityProfile = useCallback(async (newProfile: CommunityProfile) => {
    await saveProfileMutation.mutateAsync(newProfile);
    await queryClient.invalidateQueries({ queryKey: ['community_profile'] });
  }, [saveProfileMutation, queryClient]);

  const createPost = useCallback((post: Omit<FoodPost, 'id' | 'createdAt' | 'likes' | 'commentCount'>) => {
    createPostMutation.mutate(post);
    return null;
  }, [createPostMutation]);

  const toggleLike = useCallback((postId: string) => {
    toggleLikeMutation.mutate({ postId });
  }, [toggleLikeMutation]);

  const addComment = useCallback((postId: string, text: string) => {
    addCommentMutation.mutate({ postId, text });
  }, [addCommentMutation]);

  const deletePost = useCallback((postId: string) => {
    deletePostMutation.mutate(postId);
  }, [deletePostMutation]);

  const getPostComments = useCallback((postId: string) => comments.filter((c) => c.postId === postId), [comments]);
  const joinGroup = useCallback((groupId: string) => joinGroupMutation.mutate(groupId), [joinGroupMutation]);
  const joinGroupAsync = useCallback(async (groupId: string) => {
    return await joinGroupMutation.mutateAsync(groupId);
  }, [joinGroupMutation]);
  const leaveGroup = useCallback((groupId: string) => leaveGroupMutation.mutate(groupId), [leaveGroupMutation]);
  const updateGroupName = useCallback(
    async (groupId: string, name: string) => {
      await updateGroupNameMutation.mutateAsync({ groupId, name });
    },
    [updateGroupNameMutation]
  );
  const createGroup = useCallback(async (group: Omit<CommunityGroup, 'id' | 'createdAt' | 'inviteCode' | 'members'>) => {
    await createGroupMutation.mutateAsync(group);
  }, [createGroupMutation]);
  const switchActiveGroup = useCallback((groupId: string) => setActiveGroupId(groupId), []);
  const findGroupByInviteCode = useCallback((code: string): CommunityGroup | undefined => {
    const upperCode = code.toUpperCase().trim();
    return allGroups.find((g) => g.inviteCode === upperCode);
  }, [allGroups]);

  const discoverableGroups: CommunityGroup[] = [];
  const joinedGroups = useMemo(() => allGroups.filter((g) => joinedGroupIds.includes(g.id)), [allGroups, joinedGroupIds]);
  const activeGroup = useMemo(() => (activeGroupId ? allGroups.find((g) => g.id === activeGroupId) || null : null), [allGroups, activeGroupId]);
  const hasJoinedGroup = joinedGroups.length > 0;
  const hasProfile = !!communityProfile;
  const isLoading = profileQuery.isLoading || membershipsQuery.isLoading || groupsQuery.isLoading;

  useEffect(() => {
    const handleFoodEntryAdded = (data: any) => {
      const { foodEntry } = data as { foodEntry: Omit<FoodEntry, 'id' | 'timestamp'> };
      if (!communityProfile || !hasJoinedGroup || !activeGroupId) return;
      createPostMutation.mutate({
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
        photoUri: foodEntry.photoUri,
        mealType: undefined,
      });
    };

    eventEmitter.on('foodEntryAdded', handleFoodEntryAdded);
    return () => eventEmitter.off('foodEntryAdded', handleFoodEntryAdded);
  }, [communityProfile, hasJoinedGroup, activeGroupId, createPostMutation]);

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
    joinGroupAsync,
    leaveGroup,
    updateGroupName,
    createGroup,
    switchActiveGroup,
    findGroupByInviteCode,
    saveCommunityProfile,
    createPost,
    toggleLike,
    addComment,
    deletePost,
    getPostComments,
    isUserPremiumInCommunity,
  };
});
