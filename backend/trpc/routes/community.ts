import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";
import { supabase } from "../../lib/supabase";

export const communityRouter = createTRPCRouter({
  // Get user's community profile
  getProfile: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const { data, error } = await supabase
        .from("community_profiles")
        .select("*")
        .eq("user_id", input.userId)
        .single();

      if (error) throw new Error(error.message);
      return data;
    }),

  // Create or update community profile
  upsertProfile: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        username: z.string(),
        displayName: z.string(),
        avatarColor: z.string(),
        bio: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { data, error } = await supabase
        .from("community_profiles")
        .upsert(
          {
            user_id: input.userId,
            username: input.username,
            display_name: input.displayName,
            avatar_color: input.avatarColor,
            bio: input.bio,
          },
          { onConflict: "user_id" }
        )
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    }),

  // Get groups user is member of
  getUserGroups: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const { data, error } = await supabase
        .from("community_group_members")
        .select("group_id, community_groups(*)")
        .eq("user_id", input.userId);

      if (error) throw new Error(error.message);
      return data?.map((item: any) => item.community_groups) || [];
    }),

  // Create a new group
  createGroup: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        name: z.string(),
        description: z.string().optional(),
        coverImage: z.string().optional(),
        inviteCode: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { data, error } = await supabase
        .from("community_groups")
        .insert({
          name: input.name,
          description: input.description,
          cover_image: input.coverImage,
          invite_code: input.inviteCode,
          created_by: input.userId,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);

      // Add creator as member
      await supabase.from("community_group_members").insert({
        group_id: data.id,
        user_id: input.userId,
      });

      return data;
    }),

  // Join a group by invite code
  joinGroup: publicProcedure
    .input(z.object({ userId: z.string(), inviteCode: z.string() }))
    .mutation(async ({ input }) => {
      // Find group by invite code
      const { data: group, error: groupError } = await supabase
        .from("community_groups")
        .select("id")
        .eq("invite_code", input.inviteCode)
        .single();

      if (groupError || !group) {
        throw new Error("Invalid invite code");
      }

      // Add user to group
      const { data, error } = await supabase
        .from("community_group_members")
        .insert({
          group_id: group.id,
          user_id: input.userId,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    }),

  // Get posts for a group
  getGroupPosts: publicProcedure
    .input(
      z.object({
        groupId: z.string().optional(),
        userId: z.string().optional(),
        limit: z.number().default(50),
      })
    )
    .query(async ({ input }) => {
      let query = supabase
        .from("community_posts")
        .select(
          "*, community_profiles!user_id(username, display_name, avatar_color)"
        )
        .order("created_at", { ascending: false })
        .limit(input.limit);

      if (input.groupId) {
        query = query.eq("group_id", input.groupId);
      } else if (input.userId) {
        query = query.eq("user_id", input.userId);
      }

      const { data, error } = await query;

      if (error) throw new Error(error.message);
      return data || [];
    }),

  // Create a post
  createPost: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        groupId: z.string().optional(),
        caption: z.string().optional(),
        mealType: z.string().optional(),
        foodName: z.string(),
        calories: z.number(),
        protein: z.number(),
        carbs: z.number(),
        fat: z.number(),
        photoUri: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { data, error } = await supabase
        .from("community_posts")
        .insert({
          user_id: input.userId,
          group_id: input.groupId,
          caption: input.caption,
          meal_type: input.mealType,
          food_name: input.foodName,
          calories: input.calories,
          protein: input.protein,
          carbs: input.carbs,
          fat: input.fat,
          photo_uri: input.photoUri,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    }),

  // Toggle like on a post
  toggleLike: publicProcedure
    .input(z.object({ userId: z.string(), postId: z.string() }))
    .mutation(async ({ input }) => {
      // Check if like exists
      const { data: existing } = await supabase
        .from("community_post_likes")
        .select("id")
        .eq("post_id", input.postId)
        .eq("user_id", input.userId)
        .single();

      if (existing) {
        // Unlike
        const { error } = await supabase
          .from("community_post_likes")
          .delete()
          .eq("post_id", input.postId)
          .eq("user_id", input.userId);

        if (error) throw new Error(error.message);
        return { liked: false };
      } else {
        // Like
        const { error } = await supabase
          .from("community_post_likes")
          .insert({
            post_id: input.postId,
            user_id: input.userId,
          });

        if (error) throw new Error(error.message);
        return { liked: true };
      }
    }),

  // Get comments for a post
  getPostComments: publicProcedure
    .input(z.object({ postId: z.string() }))
    .query(async ({ input }) => {
      const { data, error } = await supabase
        .from("community_comments")
        .select(
          "*, community_profiles!user_id(username, display_name, avatar_color)"
        )
        .eq("post_id", input.postId)
        .order("created_at", { ascending: true });

      if (error) throw new Error(error.message);
      return data || [];
    }),

  // Create a comment
  createComment: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        postId: z.string(),
        content: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { data, error } = await supabase
        .from("community_comments")
        .insert({
          post_id: input.postId,
          user_id: input.userId,
          content: input.content,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    }),

  // Delete a post
  deletePost: publicProcedure
    .input(z.object({ userId: z.string(), postId: z.string() }))
    .mutation(async ({ input }) => {
      const { error } = await supabase
        .from("community_posts")
        .delete()
        .eq("id", input.postId)
        .eq("user_id", input.userId);

      if (error) throw new Error(error.message);
      return { success: true };
    }),
});
