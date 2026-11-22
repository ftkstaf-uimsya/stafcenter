-- Migrasi 007: Data Master Kelas & DPM serta Modul Sirkulasi Invent (Alat Kantor Staf)
-- Jalankan file ini di SQL Editor Supabase setelah migrasi 001-006.
-- Mencakup:
-- 1. Tabel baru: academic_classes, office_kit_items, office_kit_loans
-- 2. Kolom relasi class_id & class_code pada bookings
-- 3. Upsert Data Master Fakultas & 7 Program Studi resmi (MPI, PBA, TBIG, TBIN, TMTK, TIPA, PAI)
-- 4. Seed data awal Kelas & DPM, Katalog Alat Kantor Staf (Kabel HDMI, Stop Kontak, Remote TV), dan Sirkulasi Invent
-- 5. Kebijakan RLS serta perluasan sarpras_notes dan sarpras_attachments untuk 'class', 'office_kit', 'office_loan'

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. TABEL DATA MASTER KELAS & DPM (academic_classes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.academic_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_code VARCHAR(20) NOT NULL UNIQUE,
  prodi VARCHAR(16) NOT NULL CHECK (
    prodi IN ('MPI', 'PBA', 'TBIG', 'TBIN', 'TMTK', 'TIPA', 'PAI')
  ),
  unit_id UUID REFERENCES public.campus_units(id) ON DELETE SET NULL,
  angkatan_year VARCHAR(2) NOT NULL CHECK (angkatan_year ~ '^[0-9]{2}$'),
  class_section VARCHAR(2) NOT NULL CHECK (class_section IN ('A', 'B', 'C', 'D')),
  dpm_name VARCHAR(120) NOT NULL,
  dpm_phone VARCHAR(40) NOT NULL DEFAULT '-',
  students_count INTEGER NOT NULL DEFAULT 30 CHECK (students_count >= 1 AND students_count <= 200),
  default_room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_academic_classes_combo UNIQUE (prodi, angkatan_year, class_section)
);

CREATE INDEX IF NOT EXISTS idx_academic_classes_prodi ON public.academic_classes(prodi);
CREATE INDEX IF NOT EXISTS idx_academic_classes_unit ON public.academic_classes(unit_id);
CREATE INDEX IF NOT EXISTS idx_academic_classes_room ON public.academic_classes(default_room_id);
CREATE INDEX IF NOT EXISTS idx_academic_classes_active ON public.academic_classes(is_active);

-- ============================================================================
-- 2. TABEL KATALOG BARANG KANTOR STAF (office_kit_items)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.office_kit_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(40) NOT NULL CHECK (
    category IN (
      'Kabel HDMI',
      'Stop Kontak',
      'Remote TV',
      'Kunci & Akses',
      'Adapter & Converter',
      'Lainnya'
    )
  ),
  brand_spec VARCHAR(120) NOT NULL DEFAULT '-',
  storage_tray VARCHAR(100) NOT NULL DEFAULT 'Loker Kantor Staf',
  linked_room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  condition VARCHAR(30) NOT NULL DEFAULT 'Baik' CHECK (
    condition IN ('Baik', 'Rusak Ringan', 'Rusak Berat', 'Hilang')
  ),
  status VARCHAR(20) NOT NULL DEFAULT 'Tersedia' CHECK (
    status IN ('Tersedia', 'Dipinjam', 'Perbaikan')
  ),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_office_kit_items_cat ON public.office_kit_items(category);
CREATE INDEX IF NOT EXISTS idx_office_kit_items_status ON public.office_kit_items(status);
CREATE INDEX IF NOT EXISTS idx_office_kit_items_room ON public.office_kit_items(linked_room_id);

-- ============================================================================
-- 3. TABEL TRANSAKSI SIRKULASI INVENT KANTOR STAF (office_kit_loans)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.office_kit_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_code VARCHAR(40) NOT NULL UNIQUE,
  class_id UUID REFERENCES public.academic_classes(id) ON DELETE SET NULL,
  class_code VARCHAR(20) NOT NULL,
  prodi VARCHAR(16) NOT NULL CHECK (
    prodi IN ('MPI', 'PBA', 'TBIG', 'TBIN', 'TMTK', 'TIPA', 'PAI')
  ),
  dpm_name VARCHAR(120) NOT NULL,
  borrower_name VARCHAR(120) NOT NULL,
  borrower_phone VARCHAR(40) NOT NULL DEFAULT '-',
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  course_name VARCHAR(180),
  kit_item_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  kit_items_label TEXT NOT NULL,
  loan_date DATE NOT NULL DEFAULT CURRENT_DATE,
  borrow_time VARCHAR(10) NOT NULL,
  expected_return_time VARCHAR(10) NOT NULL,
  returned_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'Dipinjam' CHECK (
    status IN ('Dipinjam', 'Dikembalikan')
  ),
  handed_by_staff VARCHAR(120),
  received_by_staff VARCHAR(120),
  return_condition_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_office_kit_loans_class ON public.office_kit_loans(class_id);
CREATE INDEX IF NOT EXISTS idx_office_kit_loans_room ON public.office_kit_loans(room_id);
CREATE INDEX IF NOT EXISTS idx_office_kit_loans_status ON public.office_kit_loans(status);
CREATE INDEX IF NOT EXISTS idx_office_kit_loans_date ON public.office_kit_loans(loan_date);

-- Tambah kolom relasi kelas pada bookings eksisting
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.academic_classes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS class_code VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_bookings_class_id ON public.bookings(class_id);

-- ============================================================================
-- 4. SEED DATA 7 PRODI RESMI, KELAS & DPM, DAN KATALOG SIRKULASI INVENT
-- ============================================================================

INSERT INTO public.campus_units (id, code, name, unit_type, parent_unit_id, leader_name, phone, email, is_active, notes) VALUES
  ('31000000-0000-0000-0000-000000000010', 'FTIK', 'Fakultas Tarbiyah dan Ilmu Keguruan', 'Fakultas', NULL, 'Dekan FTIK', '0812-3400-2010', 'ftik@kampus.ac.id', TRUE, 'Fakultas induk tujuh program studi kependidikan.'),
  ('31000000-0000-0000-0000-000000000011', 'MPI', 'Manajemen Pendidikan Islam', 'Program Studi', '31000000-0000-0000-0000-000000000010', 'Kaprodi MPI', '0813-2211-9101', 'mpi@kampus.ac.id', TRUE, 'Program Studi Manajemen Pendidikan Islam.'),
  ('31000000-0000-0000-0000-000000000012', 'PBA', 'Pendidikan Bahasa Arab', 'Program Studi', '31000000-0000-0000-0000-000000000010', 'Kaprodi PBA', '0813-2211-9102', 'pba@kampus.ac.id', TRUE, 'Program Studi Pendidikan Bahasa Arab.'),
  ('31000000-0000-0000-0000-000000000013', 'TBIG', 'Tadris Bahasa Inggris', 'Program Studi', '31000000-0000-0000-0000-000000000010', 'Kaprodi TBIG', '0813-2211-9103', 'tbig@kampus.ac.id', TRUE, 'Program Studi Tadris Bahasa Inggris.'),
  ('31000000-0000-0000-0000-000000000014', 'TBIN', 'Tadris Bahasa Indonesia', 'Program Studi', '31000000-0000-0000-0000-000000000010', 'Kaprodi TBIN', '0813-2211-9104', 'tbin@kampus.ac.id', TRUE, 'Program Studi Tadris Bahasa Indonesia.'),
  ('31000000-0000-0000-0000-000000000015', 'TMTK', 'Tadris Matematika', 'Program Studi', '31000000-0000-0000-0000-000000000010', 'Kaprodi TMTK', '0813-2211-9105', 'tmtk@kampus.ac.id', TRUE, 'Program Studi Tadris Matematika.'),
  ('31000000-0000-0000-0000-000000000016', 'TIPA', 'Tadris Ilmu Pengetahuan Alam', 'Program Studi', '31000000-0000-0000-0000-000000000010', 'Kaprodi TIPA', '0813-2211-9106', 'tipa@kampus.ac.id', TRUE, 'Program Studi Tadris Ilmu Pengetahuan Alam.'),
  ('31000000-0000-0000-0000-000000000017', 'PAI', 'Pendidikan Agama Islam', 'Program Studi', '31000000-0000-0000-0000-000000000010', 'Kaprodi PAI', '0813-2211-9107', 'pai@kampus.ac.id', TRUE, 'Program Studi Pendidikan Agama Islam.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.academic_classes (id, class_code, prodi, unit_id, angkatan_year, class_section, dpm_name, dpm_phone, students_count, default_room_id, is_active, notes) VALUES
  ('41000000-0000-0000-0000-000000000001', 'MPI-24A', 'MPI', '31000000-0000-0000-0000-000000000011', '24', 'A', 'Ahmad Fauzan', '0852-4411-2401', 34, 'c2000000-0000-0000-0000-000000000001', TRUE, 'Kelas reguler pagi angkatan 2024.'),
  ('41000000-0000-0000-0000-000000000002', 'PAI-24A', 'PAI', '31000000-0000-0000-0000-000000000017', '24', 'A', 'Muhammad Ridwan', '0852-4411-2402', 38, NULL, TRUE, 'Kelas PAI angkatan 2024 bagian A.'),
  ('41000000-0000-0000-0000-000000000003', 'PBA-24B', 'PBA', '31000000-0000-0000-0000-000000000012', '24', 'B', 'Siti Rahmawati', '0852-4411-2403', 32, NULL, TRUE, 'Kelas PBA angkatan 2024 bagian B.'),
  ('41000000-0000-0000-0000-000000000004', 'TBIG-24A', 'TBIG', '31000000-0000-0000-0000-000000000013', '24', 'A', 'Nabila Azzahra', '0852-4411-2404', 35, NULL, TRUE, 'Kelas TBIG angkatan 2024 bagian A.'),
  ('41000000-0000-0000-0000-000000000005', 'TBIN-25A', 'TBIN', '31000000-0000-0000-0000-000000000014', '25', 'A', 'Bagus Setiawan', '0852-4411-2501', 36, NULL, TRUE, 'Kelas TBIN angkatan 2025 bagian A.'),
  ('41000000-0000-0000-0000-000000000006', 'TMTK-25B', 'TMTK', '31000000-0000-0000-0000-000000000015', '25', 'B', 'Dewi Anggraini', '0852-4411-2502', 31, NULL, TRUE, 'Kelas TMTK angkatan 2025 bagian B.'),
  ('41000000-0000-0000-0000-000000000007', 'TIPA-23A', 'TIPA', '31000000-0000-0000-0000-000000000016', '23', 'A', 'Rizki Hidayat', '0852-4411-2301', 29, NULL, TRUE, 'Kelas TIPA angkatan 2023 bagian A.')
ON CONFLICT (class_code) DO NOTHING;

INSERT INTO public.office_kit_items (id, kit_code, name, category, brand_spec, storage_tray, linked_room_id, condition, status, is_active, notes) VALUES
  ('42000000-0000-0000-0000-000000000001', 'KST-HDMI-01', 'Kabel HDMI 5 Meter #01', 'Kabel HDMI', 'Vention HDMI 2.0 Braided 5M', 'Kotak Kabel Loker A1 - Kantor Staf', NULL, 'Baik', 'Dipinjam', TRUE, 'Pinjaman harian mahasiswa untuk koneksi laptop ke Smart TV/proyektor.'),
  ('42000000-0000-0000-0000-000000000002', 'KST-HDMI-02', 'Kabel HDMI 5 Meter #02', 'Kabel HDMI', 'Ugreen HDMI 2.0 High Speed 5M', 'Kotak Kabel Loker A1 - Kantor Staf', NULL, 'Baik', 'Tersedia', TRUE, 'Siap dipinjamkan dari meja piket kantor staf.'),
  ('42000000-0000-0000-0000-000000000003', 'KST-HDMI-03', 'Kabel HDMI 3 Meter #03', 'Kabel HDMI', 'Vention HDMI 2.0 3M', 'Kotak Kabel Loker A1 - Kantor Staf', NULL, 'Baik', 'Tersedia', TRUE, 'Cadangan untuk kelas dengan meja dosen dekat Smart TV.'),
  ('42000000-0000-0000-0000-000000000004', 'KST-STK-01', 'Stop Kontak 4 Lubang + Kabel 5M #01', 'Stop Kontak', 'Uticon 4 Soket Arde + Saklar 5M', 'Rak Stop Kontak B1 - Kantor Staf', NULL, 'Baik', 'Dipinjam', TRUE, 'Dilengkapi saklar on/off pengaman beban.'),
  ('42000000-0000-0000-0000-000000000005', 'KST-STK-02', 'Stop Kontak 4 Lubang + Kabel 5M #02', 'Stop Kontak', 'Broco 4 Soket Kuningan 5M', 'Rak Stop Kontak B1 - Kantor Staf', NULL, 'Baik', 'Tersedia', TRUE, 'Terminal listrik portabel ruang kuliah.'),
  ('42000000-0000-0000-0000-000000000006', 'KST-STK-03', 'Stop Kontak Roll 10 Meter #03', 'Stop Kontak', 'Kenmaster Box Roll 10M', 'Rak Stop Kontak B1 - Kantor Staf', NULL, 'Baik', 'Tersedia', TRUE, 'Untuk kegiatan diskusi atau presentasi di ruang besar.'),
  ('42000000-0000-0000-0000-000000000007', 'KST-RMT-01', 'Remote Smart TV Ruang 1-SM6', 'Remote TV', 'LG Magic Remote Smart TV', 'Laci Remote C1 - Kantor Staf', 'c2000000-0000-0000-0000-000000000001', 'Baik', 'Dipinjam', TRUE, 'Remote khusus Smart TV 65 inch ruang 1-SM6.'),
  ('42000000-0000-0000-0000-000000000008', 'KST-RMT-02', 'Remote Smart TV Cadangan #02', 'Remote TV', 'Samsung / Universal IR Smart TV', 'Laci Remote C1 - Kantor Staf', NULL, 'Baik', 'Tersedia', TRUE, 'Remote TV universal untuk ruang kelas reguler.'),
  ('42000000-0000-0000-0000-000000000009', 'KST-RMT-03', 'Remote Proyektor / TV Ruang 2-SM4', 'Remote TV', 'Universal Smart TV & Projector', 'Laci Remote C1 - Kantor Staf', 'c2000000-0000-0000-0000-000000000005', 'Baik', 'Tersedia', TRUE, 'Disimpan di kantor staf agar tidak tertinggal di ruang kelas.')
ON CONFLICT (kit_code) DO NOTHING;

INSERT INTO public.office_kit_loans (id, loan_code, class_id, class_code, prodi, dpm_name, borrower_name, borrower_phone, room_id, course_name, kit_item_ids, kit_items_label, loan_date, borrow_time, expected_return_time, returned_at, status, handed_by_staff, received_by_staff, return_condition_notes) VALUES
  (
    '43000000-0000-0000-0000-000000000001',
    'SRK-202611-001',
    '41000000-0000-0000-0000-000000000001',
    'MPI-24A',
    'MPI',
    'Ahmad Fauzan',
    'Rizal Mahendra (Perwakilan MPI-24A)',
    '0852-4411-2401',
    'c2000000-0000-0000-0000-000000000001',
    'Manajemen Mutu Pendidikan',
    '["42000000-0000-0000-0000-000000000001","42000000-0000-0000-0000-000000000004","42000000-0000-0000-0000-000000000007"]'::jsonb,
    'KST-HDMI-01 (Kabel HDMI 5 Meter #01), KST-STK-01 (Stop Kontak 4 Lubang + Kabel 5M #01), KST-RMT-01 (Remote Smart TV Ruang 1-SM6)',
    CURRENT_DATE,
    '08:00',
    '10:30',
    NULL,
    'Dipinjam',
    'Staf Piket Kantor',
    NULL,
    NULL
  ),
  (
    '43000000-0000-0000-0000-000000000002',
    'SRK-202611-002',
    '41000000-0000-0000-0000-000000000002',
    'PAI-24A',
    'PAI',
    'Muhammad Ridwan',
    'Muhammad Ridwan (DPM)',
    '0852-4411-2402',
    NULL,
    'Metodologi Pembelajaran PAI',
    '["42000000-0000-0000-0000-000000000002","42000000-0000-0000-0000-000000000005"]'::jsonb,
    'KST-HDMI-02 (Kabel HDMI 5 Meter #02), KST-STK-02 (Stop Kontak 4 Lubang + Kabel 5M #02)',
    CURRENT_DATE - INTERVAL '1 day',
    '13:00',
    '15:30',
    NOW() - INTERVAL '20 hours',
    'Dikembalikan',
    'Staf Piket Kantor',
    'Staf Piket Kantor',
    'Kabel HDMI dan stop kontak kembali dalam kondisi lengkap dan rapi.'
  )
ON CONFLICT (loan_code) DO NOTHING;

-- ============================================================================
-- 5. RLS POLICIES UNTUK TABEL BARU
-- ============================================================================

ALTER TABLE public.academic_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_kit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_kit_loans ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'academic_classes' AND policyname = 'Read academic_classes for campus users') THEN
    CREATE POLICY "Read academic_classes for campus users" ON public.academic_classes FOR SELECT TO anon, authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'academic_classes' AND policyname = 'Manage academic_classes for authenticated staff') THEN
    CREATE POLICY "Manage academic_classes for authenticated staff" ON public.academic_classes FOR ALL TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'office_kit_items' AND policyname = 'Read office_kit_items for campus users') THEN
    CREATE POLICY "Read office_kit_items for campus users" ON public.office_kit_items FOR SELECT TO anon, authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'office_kit_items' AND policyname = 'Manage office_kit_items for authenticated staff') THEN
    CREATE POLICY "Manage office_kit_items for authenticated staff" ON public.office_kit_items FOR ALL TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'office_kit_loans' AND policyname = 'Read office_kit_loans for campus users') THEN
    CREATE POLICY "Read office_kit_loans for campus users" ON public.office_kit_loans FOR SELECT TO anon, authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'office_kit_loans' AND policyname = 'Manage office_kit_loans for authenticated staff') THEN
    CREATE POLICY "Manage office_kit_loans for authenticated staff" ON public.office_kit_loans FOR ALL TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);
  END IF;
END $$;

-- ============================================================================
-- 6. PERLUAS DUKUNGAN CATATAN & LAMPIRAN UNTUK 'class', 'office_kit', 'office_loan'
-- ============================================================================

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
      CHECK (entity_type IN ('booking', 'maintenance', 'asset', 'room', 'consumable', 'lecturer', 'course', 'official', 'unit', 'vendor', 'class', 'office_kit', 'office_loan'));
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
      CHECK (entity_type IN ('booking', 'maintenance', 'asset', 'room', 'consumable', 'lecturer', 'course', 'official', 'unit', 'vendor', 'class', 'office_kit', 'office_loan'));
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.fn_cleanup_entity_notes_on_delete()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_cleanup_notes_class ON public.academic_classes;
    CREATE TRIGGER trg_cleanup_notes_class
    AFTER DELETE ON public.academic_classes
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_cleanup_entity_notes_on_delete('class');

    DROP TRIGGER IF EXISTS trg_cleanup_notes_office_kit ON public.office_kit_items;
    CREATE TRIGGER trg_cleanup_notes_office_kit
    AFTER DELETE ON public.office_kit_items
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_cleanup_entity_notes_on_delete('office_kit');

    DROP TRIGGER IF EXISTS trg_cleanup_notes_office_loan ON public.office_kit_loans;
    CREATE TRIGGER trg_cleanup_notes_office_loan
    AFTER DELETE ON public.office_kit_loans
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_cleanup_entity_notes_on_delete('office_loan');
  END IF;
END $$;
