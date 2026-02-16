-- Row Level Security (RLS) Policies for Supabase
-- Run this after creating the schema to enable security

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE weight_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE steps_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE recent_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE water_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE micronutrients_tracking ENABLE ROW LEVEL SECURITY;

-- Food table is public read-only
ALTER TABLE food ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Food entries policies
CREATE POLICY "Users can view their own food entries"
  ON food_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own food entries"
  ON food_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own food entries"
  ON food_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own food entries"
  ON food_entries FOR DELETE
  USING (auth.uid() = user_id);

-- Weight history policies
CREATE POLICY "Users can view their own weight history"
  ON weight_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own weight history"
  ON weight_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own weight history"
  ON weight_history FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own weight history"
  ON weight_history FOR DELETE
  USING (auth.uid() = user_id);

-- Exercise entries policies
CREATE POLICY "Users can view their own exercise entries"
  ON exercise_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own exercise entries"
  ON exercise_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own exercise entries"
  ON exercise_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own exercise entries"
  ON exercise_entries FOR DELETE
  USING (auth.uid() = user_id);

-- Steps data policies
CREATE POLICY "Users can view their own steps data"
  ON steps_data FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own steps data"
  ON steps_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own steps data"
  ON steps_data FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own steps data"
  ON steps_data FOR DELETE
  USING (auth.uid() = user_id);

-- Food table policies (public read-only)
CREATE POLICY "Anyone can view food database"
  ON food FOR SELECT
  USING (true);

-- Community profiles policies
CREATE POLICY "Users can view all community profiles"
  ON community_profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own community profile"
  ON community_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own community profile"
  ON community_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Community groups policies
CREATE POLICY "Anyone can view public groups"
  ON community_groups FOR SELECT
  USING (true);

CREATE POLICY "Users can create groups"
  ON community_groups FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Group creators can update their groups"
  ON community_groups FOR UPDATE
  USING (auth.uid() = created_by);

-- Community group members policies
CREATE POLICY "Users can view group members"
  ON community_group_members FOR SELECT
  USING (true);

CREATE POLICY "Users can join groups"
  ON community_group_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave groups"
  ON community_group_members FOR DELETE
  USING (auth.uid() = user_id);

-- Community posts policies
CREATE POLICY "Users can view posts in groups they're members of"
  ON community_posts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM community_group_members
      WHERE group_id = community_posts.group_id
      AND user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "Users can create posts in groups they're members of"
  ON community_posts FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND (
      group_id IS NULL OR EXISTS (
        SELECT 1 FROM community_group_members
        WHERE group_id = community_posts.group_id
        AND user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update their own posts"
  ON community_posts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts"
  ON community_posts FOR DELETE
  USING (auth.uid() = user_id);

-- Community post likes policies
CREATE POLICY "Users can view likes"
  ON community_post_likes FOR SELECT
  USING (true);

CREATE POLICY "Users can like posts"
  ON community_post_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike posts"
  ON community_post_likes FOR DELETE
  USING (auth.uid() = user_id);

-- Community comments policies
CREATE POLICY "Users can view comments on posts they can see"
  ON community_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM community_posts
      WHERE id = community_comments.post_id
      AND (
        EXISTS (
          SELECT 1 FROM community_group_members
          WHERE group_id = community_posts.group_id
          AND user_id = auth.uid()
        )
        OR community_posts.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create comments"
  ON community_comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND EXISTS (
      SELECT 1 FROM community_posts
      WHERE id = community_comments.post_id
      AND (
        group_id IS NULL OR EXISTS (
          SELECT 1 FROM community_group_members
          WHERE group_id = community_posts.group_id
          AND user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can update their own comments"
  ON community_comments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON community_comments FOR DELETE
  USING (auth.uid() = user_id);

-- Favorites policies
CREATE POLICY "Users can view their own favorites"
  ON favorites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own favorites"
  ON favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own favorites"
  ON favorites FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorites"
  ON favorites FOR DELETE
  USING (auth.uid() = user_id);

-- Recent meals policies
CREATE POLICY "Users can view their own recent meals"
  ON recent_meals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recent meals"
  ON recent_meals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recent meals"
  ON recent_meals FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recent meals"
  ON recent_meals FOR DELETE
  USING (auth.uid() = user_id);

-- Water tracking policies
CREATE POLICY "Users can view their own water tracking"
  ON water_tracking FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own water tracking"
  ON water_tracking FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own water tracking"
  ON water_tracking FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own water tracking"
  ON water_tracking FOR DELETE
  USING (auth.uid() = user_id);

-- Micronutrients tracking policies
CREATE POLICY "Users can view their own micronutrients tracking"
  ON micronutrients_tracking FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own micronutrients tracking"
  ON micronutrients_tracking FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own micronutrients tracking"
  ON micronutrients_tracking FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own micronutrients tracking"
  ON micronutrients_tracking FOR DELETE
  USING (auth.uid() = user_id);
