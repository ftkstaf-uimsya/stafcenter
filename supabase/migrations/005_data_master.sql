-- Migrasi 005: Modul Data Master (Dosen, Mata Kuliah / Makul, dan Pengurus Kampus)
-- Jalankan file ini di SQL Editor Supabase untuk mengaktifkan tabel lecturers, courses, dan campus_officials
-- serta memperluas dukungan catatan & lampiran pada entitas Data Master.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Tabel Master Dosen (lecturers)
CREATE TABLE IF NOT EXISTS public.lecturers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nidn_nip VARCHAR(40) NOT NULL UNIQUE,
  full_name VARCHAR(150) NOT NULL,
  homebase_prodi VARCHAR(120) NOT NULL,
  employment_status VARCHAR(40) NOT NULL DEFAULT 'Dosen Tetap' CHECK (
    employment_status IN ('Dosen Tetap', 'Dosen Tidak Tetap', 'Dosen Tamu')
  ),
  academic_rank VARCHAR(60) NOT NULL DEFAULT '-',
  email VARCHAR(150),
  phone VARCHAR(40),
  office_room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lecturers_prodi ON public.lecturers(homebase_prodi);
CREATE INDEX IF NOT EXISTS idx_lecturers_office_room ON public.lecturers(office_room_id);
CREATE INDEX IF NOT EXISTS idx_lecturers_active ON public.lecturers(is_active);

-- 2. Tabel Master Mata Kuliah / MAKUL (courses)
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(180) NOT NULL,
  prodi VARCHAR(120) NOT NULL,
  semester INTEGER NOT NULL DEFAULT 1 CHECK (semester >= 1 AND semester <= 8),
  curriculum_year INTEGER NOT NULL DEFAULT 2024 CHECK (curriculum_year >= 2000 AND curriculum_year <= 2100),
  sks_theory INTEGER NOT NULL DEFAULT 2 CHECK (sks_theory >= 0 AND sks_theory <= 8),
  sks_practice INTEGER NOT NULL DEFAULT 0 CHECK (sks_practice >= 0 AND sks_practice <= 8),
  course_type VARCHAR(40) NOT NULL DEFAULT 'Wajib Prodi' CHECK (
    course_type IN ('Wajib Prodi', 'Wajib Universitas', 'Pilihan', 'Praktikum', 'Tugas Akhir')
  ),
  lecturer_id UUID REFERENCES public.lecturers(id) ON DELETE SET NULL,
  preferred_room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_courses_prodi ON public.courses(prodi);
CREATE INDEX IF NOT EXISTS idx_courses_semester ON public.courses(semester);
CREATE INDEX IF NOT EXISTS idx_courses_lecturer ON public.courses(lecturer_id);
CREATE INDEX IF NOT EXISTS idx_courses_room ON public.courses(preferred_room_id);

-- 3. Tabel Master Pengurus Kampus (campus_officials)
CREATE TABLE IF NOT EXISTS public.campus_officials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  official_code VARCHAR(40) NOT NULL UNIQUE,
  full_name VARCHAR(150) NOT NULL,
  position_title VARCHAR(150) NOT NULL,
  unit_name VARCHAR(120) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'Biro & Unit Administrasi' CHECK (
    category IN (
      'Pimpinan Kampus',
      'Dekanat & Prodi',
      'Biro & Unit Administrasi',
      'Koordinator Sarpras & Lab'
    )
  ),
  email VARCHAR(150),
  phone VARCHAR(40),
  period_label VARCHAR(50) NOT NULL DEFAULT '2024 - 2028',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campus_officials_category ON public.campus_officials(category);
CREATE INDEX IF NOT EXISTS idx_campus_officials_active ON public.campus_officials(is_active);

-- 4. Aktifkan RLS & Kebijakan Akses
ALTER TABLE public.lecturers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_officials ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'lecturers' AND policyname = 'Read lecturers for campus users') THEN
    CREATE POLICY "Read lecturers for campus users" ON public.lecturers FOR SELECT TO anon, authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'lecturers' AND policyname = 'Manage lecturers for authenticated staff') THEN
    CREATE POLICY "Manage lecturers for authenticated staff" ON public.lecturers FOR ALL TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'courses' AND policyname = 'Read courses for campus users') THEN
    CREATE POLICY "Read courses for campus users" ON public.courses FOR SELECT TO anon, authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'courses' AND policyname = 'Manage courses for authenticated staff') THEN
    CREATE POLICY "Manage courses for authenticated staff" ON public.courses FOR ALL TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'campus_officials' AND policyname = 'Read campus officials for campus users') THEN
    CREATE POLICY "Read campus officials for campus users" ON public.campus_officials FOR SELECT TO anon, authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'campus_officials' AND policyname = 'Manage campus officials for authenticated staff') THEN
    CREATE POLICY "Manage campus officials for authenticated staff" ON public.campus_officials FOR ALL TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);
  END IF;
END $$;

-- 5. Perluas CHECK constraint pada sarpras_notes dan sarpras_attachments bila tabel migrasi 003 sudah terpasang
DO $$
DECLARE
  v_con RECORD;
BEGIN
  IF to_regclass('public.sarpras_notes') IS NOT NULL THEN
    FOR v_con IN
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public.sarpras_notes'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%entity_type%'
    LOOP
      EXECUTE format('ALTER TABLE public.sarpras_notes DROP CONSTRAINT %I', v_con.conname);
    END LOOP;

    ALTER TABLE public.sarpras_notes
      ADD CONSTRAINT chk_sarpras_notes_entity_type
      CHECK (entity_type IN ('booking', 'maintenance', 'asset', 'room', 'consumable', 'lecturer', 'course', 'official'));
  END IF;

  IF to_regclass('public.sarpras_attachments') IS NOT NULL THEN
    FOR v_con IN
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public.sarpras_attachments'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%entity_type%'
    LOOP
      EXECUTE format('ALTER TABLE public.sarpras_attachments DROP CONSTRAINT %I', v_con.conname);
    END LOOP;

    ALTER TABLE public.sarpras_attachments
      ADD CONSTRAINT chk_sarpras_attachments_entity_type
      CHECK (entity_type IN ('booking', 'maintenance', 'asset', 'room', 'consumable', 'lecturer', 'course', 'official'));
  END IF;
END $$;

-- 6. Bersihkan sarpras_notes yatim ketika entitas Data Master baru dihapus
DO $$
BEGIN
  IF to_regprocedure('public.fn_cleanup_entity_notes_on_delete()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_cleanup_notes_lecturer ON public.lecturers;
    CREATE TRIGGER trg_cleanup_notes_lecturer
    AFTER DELETE ON public.lecturers
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_cleanup_entity_notes_on_delete('lecturer');

    DROP TRIGGER IF EXISTS trg_cleanup_notes_course ON public.courses;
    CREATE TRIGGER trg_cleanup_notes_course
    AFTER DELETE ON public.courses
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_cleanup_entity_notes_on_delete('course');

    DROP TRIGGER IF EXISTS trg_cleanup_notes_official ON public.campus_officials;
    CREATE TRIGGER trg_cleanup_notes_official
    AFTER DELETE ON public.campus_officials
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_cleanup_entity_notes_on_delete('official');
  END IF;
END $$;
