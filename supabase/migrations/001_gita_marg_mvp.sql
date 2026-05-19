-- Gita Marg MVP 1.0 schema
-- Run this in the Supabase SQL Editor.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'monthly', 'annual')),
  questions_today INT NOT NULL DEFAULT 0,
  signup_date_ist DATE NOT NULL DEFAULT ((NOW() AT TIME ZONE 'Asia/Kolkata')::DATE),
  total_questions INT NOT NULL DEFAULT 0,
  total_saved INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.guidance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  problem_text TEXT NOT NULL,
  problem_embedding vector(768),
  shloka_id TEXT NOT NULL,
  chapter INT NOT NULL,
  verse INT NOT NULL,
  sanskrit TEXT NOT NULL,
  transliteration TEXT NOT NULL,
  meaning_english TEXT NOT NULL,
  meaning_hindi TEXT,
  advice TEXT NOT NULL,
  is_bookmarked BOOLEAN NOT NULL DEFAULT FALSE,
  is_shared BOOLEAN NOT NULL DEFAULT FALSE,
  user_rating SMALLINT,
  was_helpful BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.daily_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date_ist DATE NOT NULL,
  questions_used INT NOT NULL DEFAULT 0,
  UNIQUE (user_id, date_ist)
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  razorpay_order_id TEXT UNIQUE,
  razorpay_payment_id TEXT UNIQUE,
  razorpay_signature TEXT,
  plan TEXT NOT NULL CHECK (plan IN ('monthly', 'annual')),
  amount_paise INT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','expired','cancelled','failed')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guidance_user_created
ON public.guidance(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_guidance_bookmarked
ON public.guidance(user_id, is_bookmarked)
WHERE is_bookmarked = TRUE;

CREATE INDEX IF NOT EXISTS idx_guidance_shloka_id
ON public.guidance(shloka_id);

CREATE INDEX IF NOT EXISTS idx_guidance_embedding
ON public.guidance USING ivfflat (problem_embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status
ON public.subscriptions(user_id, status);

CREATE INDEX IF NOT EXISTS idx_daily_quotas_user_date
ON public.daily_quotas(user_id, date_ist);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guidance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_quotas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS own_profile ON public.users;
DROP POLICY IF EXISTS own_guidance ON public.guidance;
DROP POLICY IF EXISTS own_subscriptions ON public.subscriptions;
DROP POLICY IF EXISTS own_quotas ON public.daily_quotas;

CREATE POLICY own_profile ON public.users
FOR SELECT USING (auth.uid() = id);

CREATE POLICY own_guidance ON public.guidance
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY own_subscriptions ON public.subscriptions
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY own_quotas ON public.daily_quotas
FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url, signup_date_ist)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.check_and_increment_quota(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_plan TEXT;
  v_signup_date DATE;
  v_today_ist DATE;
  v_limit INT;
  v_used INT;
  v_is_day_one BOOLEAN;
BEGIN
  v_today_ist := (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;

  SELECT plan, signup_date_ist
  INTO v_plan, v_signup_date
  FROM public.users
  WHERE id = p_user_id;

  IF v_plan IN ('monthly', 'annual') THEN
    RETURN json_build_object(
      'allowed', true,
      'used', 0,
      'limit', 9999,
      'is_day_one', false
    );
  END IF;

  v_is_day_one := (v_signup_date = v_today_ist);
  v_limit := CASE WHEN v_is_day_one THEN 3 ELSE 1 END;

  INSERT INTO public.daily_quotas (user_id, date_ist, questions_used)
  VALUES (p_user_id, v_today_ist, 1)
  ON CONFLICT (user_id, date_ist)
  DO UPDATE SET questions_used = daily_quotas.questions_used + 1
  RETURNING questions_used INTO v_used;

  IF v_used > v_limit THEN
    UPDATE public.daily_quotas
    SET questions_used = v_limit
    WHERE user_id = p_user_id AND date_ist = v_today_ist;

    RETURN json_build_object(
      'allowed', false,
      'used', v_limit,
      'limit', v_limit,
      'is_day_one', v_is_day_one
    );
  END IF;

  RETURN json_build_object(
    'allowed', true,
    'used', v_used,
    'limit', v_limit,
    'is_day_one', v_is_day_one
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
