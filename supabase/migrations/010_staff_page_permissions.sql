-- Migrasi 010: Otoritas Akses Halaman per Akun Staf (Kelola Hak Akses Master Admin)
-- Jalankan file ini di SQL Editor Supabase setelah migrasi 002.
-- Mencakup:
-- 1. Penambahan kolom allowed_pages (JSONB nullable) pada public.staff_accounts
-- 2. Pembaruan fungsi fn_verify_staff_login, fn_create_staff_account, dan fn_update_staff_account
--    untuk menyimpan dan mengembalikan daftar halaman yang boleh diakses oleh setiap user

ALTER TABLE public.staff_accounts
  ADD COLUMN IF NOT EXISTS allowed_pages JSONB DEFAULT NULL;

-- Hapus tanda tangan fungsi lama terlebih dahulu karena tipe RETURNS TABLE bertambah kolom allowed_pages
DROP FUNCTION IF EXISTS public.fn_verify_staff_login(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.fn_create_staff_account(TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.fn_create_staff_account(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.fn_update_staff_account(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT);
DROP FUNCTION IF EXISTS public.fn_update_staff_account(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, JSONB);

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
  is_active BOOLEAN,
  allowed_pages JSONB
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
    sa.is_active,
    sa.allowed_pages
  FROM public.staff_accounts sa
  WHERE LOWER(sa.username) = LOWER(TRIM(p_username))
    AND sa.is_active = TRUE
    AND sa.password_hash = crypt(p_password, sa.password_hash)
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_verify_staff_login(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_verify_staff_login(TEXT, TEXT) TO service_role;

-- Fungsi tambah akun staf baru beserta daftar halaman yang diizinkan
CREATE OR REPLACE FUNCTION public.fn_create_staff_account(
  p_username TEXT,
  p_full_name TEXT,
  p_email TEXT,
  p_role TEXT,
  p_password TEXT,
  p_allowed_pages JSONB DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  username VARCHAR,
  full_name VARCHAR,
  email VARCHAR,
  role VARCHAR,
  is_active BOOLEAN,
  allowed_pages JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id UUID;
  v_pages JSONB;
BEGIN
  v_pages := CASE
    WHEN p_role = 'master_admin' THEN NULL
    ELSE p_allowed_pages
  END;

  INSERT INTO public.staff_accounts (
    username,
    full_name,
    email,
    role,
    password_hash,
    is_active,
    allowed_pages
  ) VALUES (
    LOWER(TRIM(p_username)),
    TRIM(p_full_name),
    NULLIF(TRIM(COALESCE(p_email, '')), ''),
    p_role,
    crypt(p_password, gen_salt('bf')),
    TRUE,
    v_pages
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
    sa.allowed_pages,
    sa.created_at,
    sa.updated_at
  FROM public.staff_accounts sa
  WHERE sa.id = v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_create_staff_account(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_create_staff_account(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;

-- Fungsi edit akun staf beserta otoritas halaman yang boleh diakses
CREATE OR REPLACE FUNCTION public.fn_update_staff_account(
  p_id UUID,
  p_username TEXT,
  p_full_name TEXT,
  p_email TEXT,
  p_role TEXT,
  p_is_active BOOLEAN,
  p_new_password TEXT DEFAULT NULL,
  p_allowed_pages JSONB DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  username VARCHAR,
  full_name VARCHAR,
  email VARCHAR,
  role VARCHAR,
  is_active BOOLEAN,
  allowed_pages JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_pages JSONB;
BEGIN
  v_pages := CASE
    WHEN p_role = 'master_admin' THEN NULL
    ELSE COALESCE(p_allowed_pages, (SELECT sa_old.allowed_pages FROM public.staff_accounts sa_old WHERE sa_old.id = p_id))
  END;

  UPDATE public.staff_accounts
  SET
    username = LOWER(TRIM(p_username)),
    full_name = TRIM(p_full_name),
    email = NULLIF(TRIM(COALESCE(p_email, '')), ''),
    role = p_role,
    is_active = p_is_active,
    allowed_pages = v_pages,
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
    sa.allowed_pages,
    sa.created_at,
    sa.updated_at
  FROM public.staff_accounts sa
  WHERE sa.id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_update_staff_account(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_update_staff_account(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, JSONB) TO service_role;
