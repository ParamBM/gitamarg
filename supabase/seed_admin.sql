-- Local/dev seed data for GitaMarg.
-- Creates an admin auth user and matching public.users profile.
--
-- Email: admin@gmail.com
-- Password: admin@123

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  seeded_admin_user_id UUID := '11111111-1111-1111-1111-111111111111';
  admin_user_id UUID;
BEGIN
  SELECT id
  INTO admin_user_id
  FROM auth.users
  WHERE LOWER(email) = LOWER('admin@gmail.com')
  ORDER BY created_at
  LIMIT 1;

  admin_user_id := COALESCE(admin_user_id, seeded_admin_user_id);

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    admin_user_id,
    'authenticated',
    'authenticated',
    'admin@gmail.com',
    extensions.crypt('admin@123', extensions.gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Admin","full_name":"Admin"}'::jsonb,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    encrypted_password = EXCLUDED.encrypted_password,
    email_confirmed_at = COALESCE(auth.users.email_confirmed_at, NOW()),
    raw_app_meta_data = EXCLUDED.raw_app_meta_data,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data,
    updated_at = NOW();

  DELETE FROM auth.identities
  WHERE user_id = admin_user_id
    AND provider = 'email'
    AND provider_id = 'admin@gmail.com';

  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES (
    admin_user_id,
    admin_user_id,
    admin_user_id::text,
    jsonb_build_object(
      'sub', admin_user_id::text,
      'email', 'admin@gmail.com',
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT (provider, provider_id) DO UPDATE
  SET
    user_id = EXCLUDED.user_id,
    identity_data = EXCLUDED.identity_data,
    updated_at = NOW();

  INSERT INTO public.users (
    id,
    email,
    name,
    avatar_url,
    plan,
    role,
    signup_date_ist,
    created_at,
    updated_at
  )
  VALUES (
    admin_user_id,
    'admin@gmail.com',
    'Admin',
    NULL,
    'free',
    'admin',
    (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    role = 'admin',
    updated_at = NOW();
END $$;
