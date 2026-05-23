-- Adds account roles for admin-only surfaces and quota bypass.

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
CHECK (role IN ('user', 'admin'));

CREATE INDEX IF NOT EXISTS idx_users_role
ON public.users(role);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url, signup_date_ist, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE,
    'user'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.check_and_increment_quota(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_plan TEXT;
  v_role TEXT;
  v_signup_date DATE;
  v_today_ist DATE;
  v_limit INT;
  v_used INT;
  v_is_day_one BOOLEAN;
BEGIN
  v_today_ist := (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;

  SELECT plan, role, signup_date_ist
  INTO v_plan, v_role, v_signup_date
  FROM public.users
  WHERE id = p_user_id;

  IF v_role = 'admin' OR v_plan IN ('monthly', 'annual') THEN
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
