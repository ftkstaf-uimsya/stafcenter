-- Migrasi 002: Tabel Akun Staf & Master Admin untuk StafCenter
-- Jalankan file ini di Supabase SQL Editor agar login username/password dan fitur Kelola Akun Master Admin aktif.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.staff_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(60) NOT NULL UNIQUE,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(150),
  role VARCHAR(30) NOT NULL DEFAULT 'staff' CHECK (role IN ('master_admin', 'staff')),
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_accounts_username_lower
  ON public.staff_accounts (LOWER(username));

ALTER TABLE public.staff_accounts ENABLE ROW LEVEL SECURITY;

-- Tidak ada policy untuk anon/authenticated agar password_hash hanya diakses via service_role di server Next.js.

-- Fungsi verifikasi login username & kata sandi
CREATE OR REPLACE FUNCTION public.fn_verify_staff_login(
  p_username TEXT,
  p_password TEXT
)
RETURNS TABLE (
  id UUID,
  username VARCHAR,
  full_name VARCHAR,
  email VARCHAR,
  role VARCHAR,
  is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sa.id,
    sa.username,
    sa.full_name,
    sa.email,
    sa.role,
    sa.is_active
  FROM public.staff_accounts sa
  WHERE LOWER(sa.username) = LOWER(TRIM(p_username))
    AND sa.is_active = TRUE
    AND sa.password_hash = crypt(p_password, sa.password_hash)
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_verify_staff_login(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_verify_staff_login(TEXT, TEXT) TO service_role;

-- Fungsi tambah akun staf baru oleh Master Admin
CREATE OR REPLACE FUNCTION public.fn_create_staff_account(
  p_username TEXT,
  p_full_name TEXT,
  p_email TEXT,
  p_role TEXT,
  p_password TEXT
)
RETURNS TABLE (
  id UUID,
  username VARCHAR,
  full_name VARCHAR,
  email VARCHAR,
  role VARCHAR,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.staff_accounts (
    username,
    full_name,
    email,
    role,
    password_hash,
    is_active
  ) VALUES (
    LOWER(TRIM(p_username)),
    TRIM(p_full_name),
    NULLIF(TRIM(COALESCE(p_email, '')), ''),
    p_role,
    crypt(p_password, gen_salt('bf')),
    TRUE
  )
  RETURNING staff_accounts.id INTO v_id;

  RETURN QUERY
  SELECT
    sa.id,
    sa.username,
    sa.full_name,
    sa.email,
    sa.role,
    sa.is_active,
    sa.created_at,
    sa.updated_at
  FROM public.staff_accounts sa
  WHERE sa.id = v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_create_staff_account(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_create_staff_account(TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- Fungsi edit akun staf oleh Master Admin (kata sandi opsional)
CREATE OR REPLACE FUNCTION public.fn_update_staff_account(
  p_id UUID,
  p_username TEXT,
  p_full_name TEXT,
  p_email TEXT,
  p_role TEXT,
  p_is_active BOOLEAN,
  p_new_password TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  username VARCHAR,
  full_name VARCHAR,
  email VARCHAR,
  role VARCHAR,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE public.staff_accounts
  SET
    username = LOWER(TRIM(p_username)),
    full_name = TRIM(p_full_name),
    email = NULLIF(TRIM(COALESCE(p_email, '')), ''),
    role = p_role,
    is_active = p_is_active,
    password_hash = CASE
      WHEN p_new_password IS NOT NULL AND LENGTH(p_new_password) > 0
      THEN crypt(p_new_password, gen_salt('bf'))
      ELSE password_hash
    END,
    updated_at = NOW()
  WHERE staff_accounts.id = p_id;

  RETURN QUERY
  SELECT
    sa.id,
    sa.username,
    sa.full_name,
    sa.email,
    sa.role,
    sa.is_active,
    sa.created_at,
    sa.updated_at
  FROM public.staff_accounts sa
  WHERE sa.id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_update_staff_account(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_update_staff_account(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) TO service_role;

-- Seed akun Master Admin bawaan (username: staf)
INSERT INTO public.staff_accounts (
  username,
  full_name,
  email,
  role,
  password_hash,
  is_active
) VALUES (
  'staf',
  'Master Admin Biro Sarpras',
  'ftkstaf@gmail.com',
  'master_admin',
  crypt('stafftk@123', gen_salt('bf')),
  TRUE
)
ON CONFLICT (username) DO NOTHING;
