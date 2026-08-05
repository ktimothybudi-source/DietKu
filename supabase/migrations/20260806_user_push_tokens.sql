-- Expo push tokens for remote notifications (scan reminders still use local scheduling).
-- Used to alert group members when someone logs/scans food.

CREATE TABLE IF NOT EXISTS public.user_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL,
  platform TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_push_tokens_user_token_unique UNIQUE (user_id, expo_push_token)
);

CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id
  ON public.user_push_tokens (user_id);

CREATE INDEX IF NOT EXISTS idx_user_push_tokens_token
  ON public.user_push_tokens (expo_push_token);

COMMENT ON TABLE public.user_push_tokens IS
  'Expo push tokens per device for DietKu remote notifications.';

ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own push tokens" ON public.user_push_tokens;
CREATE POLICY "Users can view own push tokens"
  ON public.user_push_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own push tokens" ON public.user_push_tokens;
CREATE POLICY "Users can insert own push tokens"
  ON public.user_push_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own push tokens" ON public.user_push_tokens;
CREATE POLICY "Users can update own push tokens"
  ON public.user_push_tokens
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own push tokens" ON public.user_push_tokens;
CREATE POLICY "Users can delete own push tokens"
  ON public.user_push_tokens
  FOR DELETE
  USING (auth.uid() = user_id);
