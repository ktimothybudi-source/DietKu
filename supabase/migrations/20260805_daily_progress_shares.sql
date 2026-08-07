-- Shared daily nutrition progress for community group goal visibility.
-- Stores day aggregates only (not meal-level food_entries).

CREATE TABLE IF NOT EXISTS public.daily_progress_shares (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  calories_eaten NUMERIC(8, 2) NOT NULL DEFAULT 0,
  protein_eaten NUMERIC(8, 2) NOT NULL DEFAULT 0,
  carbs_eaten NUMERIC(8, 2) NOT NULL DEFAULT 0,
  fat_eaten NUMERIC(8, 2) NOT NULL DEFAULT 0,
  calories_target NUMERIC(8, 2) NOT NULL DEFAULT 0,
  protein_target NUMERIC(8, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_progress_shares_date
  ON public.daily_progress_shares (date);

CREATE INDEX IF NOT EXISTS idx_daily_progress_shares_user_date
  ON public.daily_progress_shares (user_id, date DESC);

COMMENT ON TABLE public.daily_progress_shares IS
  'Day-level calorie/protein progress shared with community group mates.';

ALTER TABLE public.daily_progress_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own or groupmate daily progress" ON public.daily_progress_shares;
CREATE POLICY "Users can view own or groupmate daily progress"
  ON public.daily_progress_shares
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.community_group_members me
      INNER JOIN public.community_group_members them
        ON them.group_id = me.group_id
      WHERE me.user_id = auth.uid()
        AND them.user_id = daily_progress_shares.user_id
    )
  );

DROP POLICY IF EXISTS "Users can upsert own daily progress" ON public.daily_progress_shares;
CREATE POLICY "Users can upsert own daily progress"
  ON public.daily_progress_shares
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own daily progress" ON public.daily_progress_shares;
CREATE POLICY "Users can update own daily progress"
  ON public.daily_progress_shares
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own daily progress" ON public.daily_progress_shares;
CREATE POLICY "Users can delete own daily progress"
  ON public.daily_progress_shares
  FOR DELETE
  USING (auth.uid() = user_id);
