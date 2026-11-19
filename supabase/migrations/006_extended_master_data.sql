-- Migrasi 006: Data Master Prioritas 1 (Unit/Prodi/Ormawa, Teknisi & Vendor, dan Master Referensi)
-- Jalankan file ini di SQL Editor Supabase setelah migrasi 001-005.
-- Mencakup:
-- 1. Tabel baru: campus_units, maintenance_vendors, asset_categories, funding_sources, consumable_categories, consumable_units
-- 2. Seed data standar kampus untuk seluruh tabel baru
-- 3. Pelepasan CHECK constraint statis pada assets.category dan consumables.category/unit
-- 4. Penambahan kolom Foreign Key relasional pada tabel eksisting + backfill otomatis dari data teks lama
-- 5. Kebijakan RLS serta perluasan sarpras_notes dan sarpras_attachments untuk entitas 'unit' dan 'vendor'

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. TABEL MASTER BARU
-- ============================================================================

-- 1A. Master Fakultas, Program Studi, Unit Kerja & Ormawa (campus_units)
CREATE TABLE IF NOT EXISTS public.campus_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  unit_type VARCHAR(40) NOT NULL DEFAULT 'Program Studi' CHECK (
    unit_type IN ('Fakultas', 'Program Studi', 'Biro & Unit Kerja', 'Ormawa / UKM')
  ),
  parent_unit_id UUID REFERENCES public.campus_units(id) ON DELETE SET NULL,
  leader_name VARCHAR(150),
  phone VARCHAR(40),
  email VARCHAR(150),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campus_units_type ON public.campus_units(unit_type);
CREATE INDEX IF NOT EXISTS idx_campus_units_active ON public.campus_units(is_active);
CREATE INDEX IF NOT EXISTS idx_campus_units_parent ON public.campus_units(parent_unit_id);

-- 1B. Master Teknisi & Vendor Pemeliharaan (maintenance_vendors)
CREATE TABLE IF NOT EXISTS public.maintenance_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  vendor_type VARCHAR(30) NOT NULL DEFAULT 'Vendor Eksternal' CHECK (
    vendor_type IN ('Teknisi Internal', 'Vendor Eksternal')
  ),
  specialty VARCHAR(80) NOT NULL DEFAULT 'Umum / Multi-Bidang',
  pic_name VARCHAR(120) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  email VARCHAR(150),
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_vendors_type ON public.maintenance_vendors(vendor_type);
CREATE INDEX IF NOT EXISTS idx_maintenance_vendors_active ON public.maintenance_vendors(is_active);

-- 1C. Master Kategori Inventaris Aset (asset_categories)
CREATE TABLE IF NOT EXISTS public.asset_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(16) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  useful_life_years INTEGER NOT NULL DEFAULT 5 CHECK (useful_life_years >= 1 AND useful_life_years <= 50),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1D. Master Sumber Dana Pengadaan (funding_sources)
CREATE TABLE IF NOT EXISTS public.funding_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL UNIQUE,
  source_type VARCHAR(40) NOT NULL DEFAULT 'Internal Kampus' CHECK (
    source_type IN ('Internal Kampus', 'Yayasan', 'Hibah Pemerintah', 'Kerjasama / CSR', 'Lainnya')
  ),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1E. Master Kategori BHP / ATK (consumable_categories)
CREATE TABLE IF NOT EXISTS public.consumable_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(80) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1F. Master Satuan BHP / ATK (consumable_units)
CREATE TABLE IF NOT EXISTS public.consumable_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(40) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. SEED DATA STANDAR KAMPUS UNTUK MASTER BARU
-- ============================================================================

INSERT INTO public.campus_units (id, code, name, unit_type, parent_unit_id, leader_name, phone, email, is_active, notes) VALUES
  ('31000000-0000-0000-0000-000000000001', 'FTK', 'Fakultas Teknik & Sains Terapan', 'Fakultas', NULL, 'Dekan Fakultas Teknik', '0812-3400-2001', 'ftk@kampus.ac.id', TRUE, 'Fakultas induk program studi keteknikan dan informatika.'),
  ('31000000-0000-0000-0000-000000000002', 'TIF', 'Teknik Informatika', 'Program Studi', '31000000-0000-0000-0000-000000000001', 'Dr. Eng. Lukman Hakim, M.T.', '0813-2211-9001', 'tif@kampus.ac.id', TRUE, 'Program studi homebase dosen dan praktikum komputasi.'),
  ('31000000-0000-0000-0000-000000000003', 'PSB', 'Pusat Bahasa & MKU', 'Biro & Unit Kerja', NULL, 'Nadia Kusuma, S.Pd., M.Hum.', '0812-7766-3310', 'pusatbahasa@kampus.ac.id', TRUE, 'Pengelola mata kuliah wajib universitas dan sertifikasi bahasa.'),
  ('31000000-0000-0000-0000-000000000004', 'BUS', 'Biro Umum & Sarana Prasarana', 'Biro & Unit Kerja', NULL, 'Hendra Wijaya, S.T.', '0812-3400-1101', 'sarpras@kampus.ac.id', TRUE, 'Pengelola gedung, inventaris, dan pemeliharaan fasilitas kampus.'),
  ('31000000-0000-0000-0000-000000000005', 'BAU', 'Biro Administrasi Umum', 'Biro & Unit Kerja', NULL, 'Drs. Bambang Sutrisno', '0812-3400-1103', 'bau@kampus.ac.id', TRUE, 'Pengelola rumah tangga kampus dan auditorium Graha Cendekia.'),
  ('31000000-0000-0000-0000-000000000006', 'BKS', 'Biro Keuangan & Sarpras', 'Biro & Unit Kerja', NULL, 'Siti Nurhaliza, S.E.', '0812-3400-1104', 'keuangan.sarpras@kampus.ac.id', TRUE, 'Pengelola anggaran pengadaan aset dan verifikasi BAST.'),
  ('31000000-0000-0000-0000-000000000007', 'BKA', 'Biro Kemahasiswaan & Alumni', 'Biro & Unit Kerja', NULL, 'Fajar Nugroho, S.Kom.', '0811-3344-5566', 'kemahasiswaan@kampus.ac.id', TRUE, 'Koordinator kegiatan mahasiswa, tracer study, dan Ormawa.'),
  ('31000000-0000-0000-0000-000000000008', 'BEM-U', 'BEM Universitas', 'Ormawa / UKM', NULL, 'Rizky Pratama', '0857-8899-1204', 'bem@kampus.ac.id', TRUE, 'Badan Eksekutif Mahasiswa tingkat universitas.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.maintenance_vendors (id, vendor_code, name, vendor_type, specialty, pic_name, phone, email, address, is_active, notes) VALUES
  ('32000000-0000-0000-0000-000000000001', 'TEK-INT-01', 'Tim Teknisi Internal Sarpras', 'Teknisi Internal', 'Umum / Multi-Bidang', 'Hendra Wijaya, S.T.', '0812-3400-1101', 'teknisi@kampus.ac.id', 'Ruang Workshop Sarpras GKB A Lt. Dasar', TRUE, 'Penanganan cepat kelistrikan ringan, proyektor, dan meubelair.'),
  ('32000000-0000-0000-0000-000000000002', 'VND-HVAC-01', 'CV Sejuk Teknik Mandiri', 'Vendor Eksternal', 'AC & Tata Udara (HVAC)', 'Pak Wahyu', '0812-9000-4421', 'sejukteknik@vendor.id', 'Jl. Industri Raya No. 18', TRUE, 'Mitra servis berkala dan perbaikan kompresor AC kampus.'),
  ('32000000-0000-0000-0000-000000000003', 'VND-AV-01', 'PT Suara Visual Nusantara', 'Vendor Eksternal', 'Audio Visual & Videotron', 'Rudi Hartono', '0813-8800-7712', 'support@suaravisual.co.id', 'Jl. Merdeka Selatan No. 45', TRUE, 'Kalibrasi sound system auditorium dan perangkat wireless microphone.')
ON CONFLICT (vendor_code) DO NOTHING;

INSERT INTO public.asset_categories (id, code, name, description, useful_life_years, is_active) VALUES
  ('33000000-0000-0000-0000-000000000001', 'ELK', 'Elektronik & Visual', 'Proyektor, Smart TV, kamera dokumentasi, dan perangkat optik.', 5, TRUE),
  ('33000000-0000-0000-0000-000000000002', 'MBL', 'Meubelair & Furnitur', 'Meja kuliah, kursi dosen, lemari arsip, dan papan tulis.', 8, TRUE),
  ('33000000-0000-0000-0000-000000000003', 'KOM', 'Komputer & Jaringan', 'PC workstation, server rack, switch, access point, dan UPS.', 4, TRUE),
  ('33000000-0000-0000-0000-000000000004', 'AUD', 'Audio & Pengeras Suara', 'Mikrofon wireless, mixer audio, dan speaker ruangan/aula.', 5, TRUE),
  ('33000000-0000-0000-0000-000000000005', 'KLM', 'Pendingin Udara', 'AC Split, AC Cassette, dan exhaust fan gedung.', 7, TRUE),
  ('33000000-0000-0000-0000-000000000006', 'LNY', 'Fasilitas Lainnya', 'Peralatan penunjang operasional kampus selain kategori utama.', 5, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.funding_sources (id, code, name, source_type, is_active, notes) VALUES
  ('34000000-0000-0000-0000-000000000001', 'DANA-OPS', 'Dana Operasional Kampus', 'Internal Kampus', TRUE, 'Anggaran rutin tahunan operasional sarana prasarana.'),
  ('34000000-0000-0000-0000-000000000002', 'HIBAH-DIKTI', 'Hibah Kemendikbudristek', 'Hibah Pemerintah', TRUE, 'Dana bantuan/hibah peralatan pembelajaran kementerian.'),
  ('34000000-0000-0000-0000-000000000003', 'DANA-LAB', 'Dana Pengembangan Lab', 'Internal Kampus', TRUE, 'Alokasi khusus pengadaan workstation dan alat praktikum.'),
  ('34000000-0000-0000-0000-000000000004', 'DANA-YYS', 'Dana Yayasan', 'Yayasan', TRUE, 'Pengadaan aset strategis melalui persetujuan yayasan.'),
  ('34000000-0000-0000-0000-000000000005', 'DANA-HMS', 'Dana Humas & Sarpras', 'Internal Kampus', TRUE, 'Anggaran gabungan dokumentasi dan perlengkapan publikasi.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.consumable_categories (id, code, name, description, is_active) VALUES
  ('35000000-0000-0000-0000-000000000001', 'BHP-ATK', 'ATK & Kelas', 'Spidol, penghapus papan, alat tulis, dan perlengkapan mengajar.', TRUE),
  ('35000000-0000-0000-0000-000000000002', 'BHP-KRT', 'Cetakan & Kertas', 'Kertas HVS, map dokumen, amplop, dan formulir cetak.', TRUE),
  ('35000000-0000-0000-0000-000000000003', 'BHP-TNT', 'Tinta & Toner', 'Tinta refill spidol, tinta printer, dan toner laserjet.', TRUE),
  ('35000000-0000-0000-0000-000000000004', 'BHP-KBR', 'Kebersihan & Sanitasi', 'Cairan pembersih lantai, tisu, sabun, dan disinfektan.', TRUE),
  ('35000000-0000-0000-0000-000000000005', 'BHP-KLS', 'Kelistrikan Ringan', 'Baterai AA/AAA, lampu LED, kabel ties, dan sekring.', TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.consumable_units (id, code, name, description, is_active) VALUES
  ('36000000-0000-0000-0000-000000000001', 'PCS', 'Pcs', 'Satuan per buah / unit tunggal.', TRUE),
  ('36000000-0000-0000-0000-000000000002', 'BOX', 'Box', 'Satuan per kotak / dus kemasan.', TRUE),
  ('36000000-0000-0000-0000-000000000003', 'RIM', 'Rim', 'Satuan kertas isi 500 lembar.', TRUE),
  ('36000000-0000-0000-0000-000000000004', 'BTL', 'Botol', 'Satuan cairan atau tinta kemasan botol.', TRUE),
  ('36000000-0000-0000-0000-000000000005', 'PCK', 'Pack', 'Satuan kemasan pak / bungkus.', TRUE),
  ('36000000-0000-0000-0000-000000000006', 'ROL', 'Roll', 'Satuan gulungan (lakban, kabel, tisu roll).', TRUE)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 3. LEPAS CHECK CONSTRAINT STATIS & TAMBAH KOLOM RELASI FK
-- ============================================================================

-- 3A. Lepas CHECK constraint statis pada assets.category dan consumables.category/unit
DO $$
DECLARE
  v_con RECORD;
BEGIN
  FOR v_con IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.assets'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%category%'
  LOOP
    EXECUTE format('ALTER TABLE public.assets DROP CONSTRAINT %I', v_con.conname);
  END LOOP;

  FOR v_con IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.consumables'::regclass
      AND contype = 'c'
      AND (pg_get_constraintdef(oid) ILIKE '%category%' OR pg_get_constraintdef(oid) ILIKE '%unit%')
  LOOP
    EXECUTE format('ALTER TABLE public.consumables DROP CONSTRAINT %I', v_con.conname);
  END LOOP;
END $$;

-- 3B. Tambah kolom FK relasional pada tabel eksisting (nullable agar aman untuk data lama & transisi)
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS pic_official_id UUID REFERENCES public.campus_officials(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pic_lecturer_id UUID REFERENCES public.lecturers(id) ON DELETE SET NULL;

ALTER TABLE public.lecturers
  ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.campus_units(id) ON DELETE SET NULL;

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.campus_units(id) ON DELETE SET NULL;

ALTER TABLE public.campus_officials
  ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.campus_units(id) ON DELETE SET NULL;

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS funding_source_id UUID REFERENCES public.funding_sources(id) ON DELETE SET NULL;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.campus_units(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS borrower_lecturer_id UUID REFERENCES public.lecturers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS borrower_official_id UUID REFERENCES public.campus_officials(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by_official_id UUID REFERENCES public.campus_officials(id) ON DELETE SET NULL;

ALTER TABLE public.maintenance_logs
  ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES public.maintenance_vendors(id) ON DELETE SET NULL;

ALTER TABLE public.consumable_transactions
  ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.campus_units(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rooms_pic_official ON public.rooms(pic_official_id);
CREATE INDEX IF NOT EXISTS idx_rooms_pic_lecturer ON public.rooms(pic_lecturer_id);
CREATE INDEX IF NOT EXISTS idx_lecturers_unit_id ON public.lecturers(unit_id);
CREATE INDEX IF NOT EXISTS idx_courses_unit_id ON public.courses(unit_id);
CREATE INDEX IF NOT EXISTS idx_campus_officials_unit_id ON public.campus_officials(unit_id);
CREATE INDEX IF NOT EXISTS idx_assets_funding_source_id ON public.assets(funding_source_id);
CREATE INDEX IF NOT EXISTS idx_bookings_unit_id ON public.bookings(unit_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_vendor_id ON public.maintenance_logs(vendor_id);
CREATE INDEX IF NOT EXISTS idx_consumable_tx_unit_id ON public.consumable_transactions(unit_id);

-- ============================================================================
-- 4. BACKFILL OTOMATIS DATA TEKS EKSISTING KE DATA MASTER BARU
-- ============================================================================

DO $$
DECLARE
  v_rec RECORD;
  v_unit_id UUID;
  v_fs_id UUID;
  v_vendor_id UUID;
  v_seq INTEGER := 100;
  v_clean_name TEXT;
BEGIN
  -- 4A. Pastikan seluruh kategori aset eksisting terdaftar di asset_categories
  FOR v_rec IN
    SELECT DISTINCT UPPER(TRIM(category)) AS cat_code, MAX(TRIM(category_label)) AS cat_label
    FROM public.assets
    WHERE NULLIF(TRIM(category), '') IS NOT NULL
    GROUP BY UPPER(TRIM(category))
  LOOP
    INSERT INTO public.asset_categories (code, name, description)
    VALUES (v_rec.cat_code, COALESCE(NULLIF(v_rec.cat_label, ''), v_rec.cat_code), 'Dibuat otomatis dari data inventaris eksisting.')
    ON CONFLICT (code) DO NOTHING;
  END LOOP;

  -- 4B. Pastikan seluruh kategori & satuan BHP eksisting terdaftar di master BHP
  FOR v_rec IN
    SELECT DISTINCT TRIM(category) AS cat_name
    FROM public.consumables
    WHERE NULLIF(TRIM(category), '') IS NOT NULL
  LOOP
    v_seq := v_seq + 1;
    INSERT INTO public.consumable_categories (code, name, description)
    VALUES ('BHP-' || v_seq, v_rec.cat_name, 'Dibuat otomatis dari data BHP eksisting.')
    ON CONFLICT (name) DO NOTHING;
  END LOOP;

  FOR v_rec IN
    SELECT DISTINCT TRIM(unit) AS unit_name
    FROM public.consumables
    WHERE NULLIF(TRIM(unit), '') IS NOT NULL
  LOOP
    INSERT INTO public.consumable_units (code, name, description)
    VALUES (UPPER(LEFT(REGEXP_REPLACE(v_rec.unit_name, '[^a-zA-Z0-9]', '', 'g'), 12)), v_rec.unit_name, 'Dibuat otomatis dari data BHP eksisting.')
    ON CONFLICT (name) DO NOTHING;
  END LOOP;

  -- 4C. Backfill Funding Sources untuk assets
  FOR v_rec IN
    SELECT DISTINCT TRIM(funding_source) AS fs_name
    FROM public.assets
    WHERE NULLIF(TRIM(funding_source), '') IS NOT NULL
  LOOP
    SELECT id INTO v_fs_id
    FROM public.funding_sources
    WHERE LOWER(TRIM(name)) = LOWER(v_rec.fs_name)
    LIMIT 1;

    IF v_fs_id IS NULL THEN
      v_seq := v_seq + 1;
      INSERT INTO public.funding_sources (code, name, source_type, notes)
      VALUES ('DANA-' || v_seq, v_rec.fs_name, 'Lainnya', 'Backfill otomatis dari data aset eksisting.')
      ON CONFLICT (name) DO NOTHING;
    END IF;
  END LOOP;

  UPDATE public.assets a
  SET funding_source_id = fs.id
  FROM public.funding_sources fs
  WHERE a.funding_source_id IS NULL
    AND LOWER(TRIM(COALESCE(a.funding_source, ''))) = LOWER(TRIM(fs.name));

  -- 4D. Backfill Campus Units dari lecturers, courses, campus_officials, bookings, dan consumable_transactions
  FOR v_rec IN
    SELECT DISTINCT TRIM(val) AS raw_unit, src_type
    FROM (
      SELECT homebase_prodi AS val, 'Program Studi' AS src_type FROM public.lecturers
      UNION ALL
      SELECT prodi AS val, 'Program Studi' AS src_type FROM public.courses
      UNION ALL
      SELECT unit_name AS val, 'Biro & Unit Kerja' AS src_type FROM public.campus_officials
      UNION ALL
      SELECT borrower_unit AS val,
        CASE WHEN borrower_role = 'Mahasiswa/Ormawa' THEN 'Ormawa / UKM' ELSE 'Biro & Unit Kerja' END AS src_type
      FROM public.bookings
      UNION ALL
      SELECT actor_unit AS val, 'Biro & Unit Kerja' AS src_type FROM public.consumable_transactions
    ) u
    WHERE NULLIF(TRIM(val), '') IS NOT NULL
      AND LOWER(TRIM(val)) <> 'semua program studi'
  LOOP
    v_clean_name := REGEXP_REPLACE(v_rec.raw_unit, '^Prodi\s+', '', 'i');

    SELECT id INTO v_unit_id
    FROM public.campus_units
    WHERE LOWER(TRIM(name)) = LOWER(v_rec.raw_unit)
       OR LOWER(TRIM(name)) = LOWER(v_clean_name)
    LIMIT 1;

    IF v_unit_id IS NULL THEN
      v_seq := v_seq + 1;
      INSERT INTO public.campus_units (code, name, unit_type, notes)
      VALUES (
        'UNIT-' || v_seq,
        v_clean_name,
        CASE
          WHEN v_rec.raw_unit ILIKE '%BEM%' OR v_rec.raw_unit ILIKE '%UKM%' OR v_rec.raw_unit ILIKE '%HIMA%' THEN 'Ormawa / UKM'
          WHEN v_rec.raw_unit ILIKE '%Fakultas%' THEN 'Fakultas'
          WHEN v_rec.raw_unit ILIKE '%Biro%' OR v_rec.raw_unit ILIKE '%Pusat%' OR v_rec.raw_unit ILIKE '%Bagian%' OR v_rec.raw_unit ILIKE '%Graha%' OR v_rec.raw_unit ILIKE '%GKB%' THEN 'Biro & Unit Kerja'
          ELSE v_rec.src_type
        END,
        'Backfill otomatis dari data teks eksisting.'
      )
      ON CONFLICT (code) DO NOTHING;
    END IF;
  END LOOP;

  UPDATE public.lecturers l
  SET unit_id = cu.id
  FROM public.campus_units cu
  WHERE l.unit_id IS NULL
    AND (
      LOWER(TRIM(l.homebase_prodi)) = LOWER(TRIM(cu.name))
      OR LOWER(REGEXP_REPLACE(TRIM(l.homebase_prodi), '^Prodi\s+', '', 'i')) = LOWER(TRIM(cu.name))
    );

  UPDATE public.courses c
  SET unit_id = cu.id
  FROM public.campus_units cu
  WHERE c.unit_id IS NULL
    AND (
      LOWER(TRIM(c.prodi)) = LOWER(TRIM(cu.name))
      OR LOWER(REGEXP_REPLACE(TRIM(c.prodi), '^Prodi\s+', '', 'i')) = LOWER(TRIM(cu.name))
    );

  UPDATE public.campus_officials o
  SET unit_id = cu.id
  FROM public.campus_units cu
  WHERE o.unit_id IS NULL
    AND LOWER(TRIM(o.unit_name)) = LOWER(TRIM(cu.name));

  UPDATE public.bookings b
  SET unit_id = cu.id
  FROM public.campus_units cu
  WHERE b.unit_id IS NULL
    AND (
      LOWER(TRIM(b.borrower_unit)) = LOWER(TRIM(cu.name))
      OR LOWER(REGEXP_REPLACE(TRIM(b.borrower_unit), '^Prodi\s+', '', 'i')) = LOWER(TRIM(cu.name))
    );

  UPDATE public.consumable_transactions ct
  SET unit_id = cu.id
  FROM public.campus_units cu
  WHERE ct.unit_id IS NULL
    AND LOWER(TRIM(ct.actor_unit)) = LOWER(TRIM(cu.name));

  -- 4E. Backfill PIC Ruangan ke campus_officials / lecturers
  UPDATE public.rooms r
  SET pic_official_id = o.id
  FROM public.campus_officials o
  WHERE r.pic_official_id IS NULL
    AND LOWER(TRIM(r.pic_name)) = LOWER(TRIM(o.full_name));

  UPDATE public.rooms r
  SET pic_lecturer_id = l.id
  FROM public.lecturers l
  WHERE r.pic_official_id IS NULL
    AND r.pic_lecturer_id IS NULL
    AND LOWER(TRIM(r.pic_name)) = LOWER(TRIM(l.full_name));

  -- 4F. Backfill Peminjam Dosen & Pengurus pada bookings
  UPDATE public.bookings b
  SET borrower_lecturer_id = l.id
  FROM public.lecturers l
  WHERE b.borrower_lecturer_id IS NULL
    AND b.borrower_role = 'Dosen'
    AND LOWER(TRIM(b.borrower_name)) = LOWER(TRIM(l.full_name));

  UPDATE public.bookings b
  SET borrower_official_id = o.id
  FROM public.campus_officials o
  WHERE b.borrower_official_id IS NULL
    AND b.borrower_role = 'Staf'
    AND LOWER(TRIM(b.borrower_name)) = LOWER(TRIM(o.full_name));

  UPDATE public.bookings b
  SET approved_by_official_id = o.id
  FROM public.campus_officials o
  WHERE b.approved_by_official_id IS NULL
    AND NULLIF(TRIM(COALESCE(b.approved_by, '')), '') IS NOT NULL
    AND LOWER(TRIM(b.approved_by)) = LOWER(TRIM(o.full_name));

  -- 4G. Backfill Vendor/Teknisi pada maintenance_logs
  FOR v_rec IN
    SELECT id, TRIM(technician_vendor) AS tv
    FROM public.maintenance_logs
    WHERE vendor_id IS NULL
      AND NULLIF(TRIM(COALESCE(technician_vendor, '')), '') IS NOT NULL
  LOOP
    SELECT id INTO v_vendor_id
    FROM public.maintenance_vendors mv
    WHERE LOWER(v_rec.tv) LIKE '%' || LOWER(TRIM(mv.name)) || '%'
       OR LOWER(TRIM(mv.name)) = LOWER(v_rec.tv)
    LIMIT 1;

    IF v_vendor_id IS NULL THEN
      v_seq := v_seq + 1;
      INSERT INTO public.maintenance_vendors (vendor_code, name, vendor_type, specialty, pic_name, phone, notes)
      VALUES ('VND-' || v_seq, v_rec.tv, 'Vendor Eksternal', 'Umum / Multi-Bidang', v_rec.tv, '-', 'Backfill otomatis dari tiket pemeliharaan eksisting.')
      RETURNING id INTO v_vendor_id;
    END IF;

    UPDATE public.maintenance_logs
    SET vendor_id = v_vendor_id
    WHERE id = v_rec.id;
  END LOOP;
END $$;

-- ============================================================================
-- 5. RLS POLICIES UNTUK SELURUH TABEL DATA MASTER BARU
-- ============================================================================

ALTER TABLE public.campus_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funding_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumable_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumable_units ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'campus_units' AND policyname = 'Read campus_units for campus users') THEN
    CREATE POLICY "Read campus_units for campus users" ON public.campus_units FOR SELECT TO anon, authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'campus_units' AND policyname = 'Manage campus_units for authenticated staff') THEN
    CREATE POLICY "Manage campus_units for authenticated staff" ON public.campus_units FOR ALL TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'maintenance_vendors' AND policyname = 'Read maintenance_vendors for campus users') THEN
    CREATE POLICY "Read maintenance_vendors for campus users" ON public.maintenance_vendors FOR SELECT TO anon, authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'maintenance_vendors' AND policyname = 'Manage maintenance_vendors for authenticated staff') THEN
    CREATE POLICY "Manage maintenance_vendors for authenticated staff" ON public.maintenance_vendors FOR ALL TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'asset_categories' AND policyname = 'Read asset_categories for campus users') THEN
    CREATE POLICY "Read asset_categories for campus users" ON public.asset_categories FOR SELECT TO anon, authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'asset_categories' AND policyname = 'Manage asset_categories for authenticated staff') THEN
    CREATE POLICY "Manage asset_categories for authenticated staff" ON public.asset_categories FOR ALL TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'funding_sources' AND policyname = 'Read funding_sources for campus users') THEN
    CREATE POLICY "Read funding_sources for campus users" ON public.funding_sources FOR SELECT TO anon, authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'funding_sources' AND policyname = 'Manage funding_sources for authenticated staff') THEN
    CREATE POLICY "Manage funding_sources for authenticated staff" ON public.funding_sources FOR ALL TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'consumable_categories' AND policyname = 'Read consumable_categories for campus users') THEN
    CREATE POLICY "Read consumable_categories for campus users" ON public.consumable_categories FOR SELECT TO anon, authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'consumable_categories' AND policyname = 'Manage consumable_categories for authenticated staff') THEN
    CREATE POLICY "Manage consumable_categories for authenticated staff" ON public.consumable_categories FOR ALL TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'consumable_units' AND policyname = 'Read consumable_units for campus users') THEN
    CREATE POLICY "Read consumable_units for campus users" ON public.consumable_units FOR SELECT TO anon, authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'consumable_units' AND policyname = 'Manage consumable_units for authenticated staff') THEN
    CREATE POLICY "Manage consumable_units for authenticated staff" ON public.consumable_units FOR ALL TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);
  END IF;
END $$;

-- ============================================================================
-- 6. PERLUAS DUKUNGAN CATATAN & LAMPIRAN UNTUK ENTITAS 'unit' DAN 'vendor'
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
      CHECK (entity_type IN ('booking', 'maintenance', 'asset', 'room', 'consumable', 'lecturer', 'course', 'official', 'unit', 'vendor'));
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
      CHECK (entity_type IN ('booking', 'maintenance', 'asset', 'room', 'consumable', 'lecturer', 'course', 'official', 'unit', 'vendor'));
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.fn_cleanup_entity_notes_on_delete()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_cleanup_notes_unit ON public.campus_units;
    CREATE TRIGGER trg_cleanup_notes_unit
    AFTER DELETE ON public.campus_units
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_cleanup_entity_notes_on_delete('unit');

    DROP TRIGGER IF EXISTS trg_cleanup_notes_vendor ON public.maintenance_vendors;
    CREATE TRIGGER trg_cleanup_notes_vendor
    AFTER DELETE ON public.maintenance_vendors
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_cleanup_entity_notes_on_delete('vendor');
  END IF;
END $$;
