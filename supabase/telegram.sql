-- ─────────────────────────────────────────────────────────────────
--  Telegram integration — run once in Supabase SQL editor
-- ─────────────────────────────────────────────────────────────────

-- 1. Add telegram_chat_id to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_chat_id text;

-- 2. Table for temporary linking tokens (expire in 10 min)
CREATE TABLE IF NOT EXISTS public.telegram_link_tokens (
  token      text        PRIMARY KEY,
  profile_id uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_link_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "telegram_link_tokens_select_own" ON public.telegram_link_tokens;
CREATE POLICY "telegram_link_tokens_select_own"
  ON public.telegram_link_tokens FOR SELECT TO authenticated
  USING (public.current_profile_id() = profile_id);

DROP POLICY IF EXISTS "telegram_link_tokens_insert_own" ON public.telegram_link_tokens;
CREATE POLICY "telegram_link_tokens_insert_own"
  ON public.telegram_link_tokens FOR INSERT TO authenticated
  WITH CHECK (public.current_profile_id() = profile_id);

-- 3. RPC: generate a linking token (8-char uppercase hex, expires 10 min)
CREATE OR REPLACE FUNCTION public.generate_telegram_link_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_token      text;
BEGIN
  v_profile_id := public.current_profile_id();
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Profilo non trovato';
  END IF;

  -- Remove stale tokens for this profile
  DELETE FROM public.telegram_link_tokens WHERE profile_id = v_profile_id;

  -- 8-char uppercase hex token from a random UUID (no extension needed)
  v_token := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  INSERT INTO public.telegram_link_tokens (token, profile_id)
  VALUES (v_token, v_profile_id);

  RETURN v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_telegram_link_token() TO authenticated;

-- 4. RPC: unlink Telegram account
CREATE OR REPLACE FUNCTION public.unlink_telegram()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  v_profile_id := public.current_profile_id();
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Profilo non trovato';
  END IF;

  UPDATE public.profiles
    SET telegram_chat_id = NULL, updated_at = now()
  WHERE id = v_profile_id;

  DELETE FROM public.telegram_link_tokens WHERE profile_id = v_profile_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.unlink_telegram() TO authenticated;
