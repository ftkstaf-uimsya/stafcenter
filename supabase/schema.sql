-- Skema Database PostgreSQL (Supabase) untuk StafCenter: Modul Sarana Prasarana
-- Mencakup: buildings, rooms, assets, bookings, maintenance_logs, consumables, consumable_transactions
-- Dilengkapi Indeks Foreign Key, Trigger Otomatisasi, Kebijakan RLS, dan Seed Data Awal Kampus.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Tabel Gedung (buildings)
CREATE TABLE IF NOT EXISTS public.buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  floors_count INTEGER NOT NULL DEFAULT 1 CHECK (floors_count >= 1),
  zone VARCHAR(100) NOT NULL DEFAULT 'Kampus Utama',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabel Ruangan (rooms)
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE RESTRICT,
  floor INTEGER NOT NULL DEFAULT 1 CHECK (floor >= 1),
  category VARCHAR(50) NOT NULL CHECK (
    category IN ('Ruang Kelas', 'Laboratorium', 'Aula', 'Ruang Staf/Dosen')
  ),
  capacity INTEGER NOT NULL DEFAULT 30 CHECK (capacity >= 1),
  pic_name VARCHAR(120) NOT NULL,
  pic_contact VARCHAR(50),
  status VARCHAR(30) NOT NULL DEFAULT 'Tersedia' CHECK (
    status IN ('Tersedia', 'Digunakan', 'Perbaikan')
  ),
  facilities_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rooms_building_id ON public.rooms(building_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON public.rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_category ON public.rooms(category);

-- 3. Tabel Inventaris Aset & Barang (assets)
CREATE TABLE IF NOT EXISTS public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(180) NOT NULL,
  brand_model VARCHAR(150) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (
    category IN ('ELK', 'MBL', 'KOM', 'AUD', 'KLM', 'LNY')
  ),
  category_label VARCHAR(80) NOT NULL,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  procurement_year INTEGER NOT NULL CHECK (procurement_year >= 1990 AND procurement_year <= 2100),
  funding_source VARCHAR(100) NOT NULL,
  acquisition_cost NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (acquisition_cost >= 0),
  condition VARCHAR(30) NOT NULL DEFAULT 'Baik' CHECK (
    condition IN ('Baik', 'Rusak Ringan', 'Rusak Berat', 'Hilang')
  ),
  is_portable BOOLEAN NOT NULL DEFAULT FALSE,
  serial_number VARCHAR(100),
  photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_room_id ON public.assets(room_id);
CREATE INDEX IF NOT EXISTS idx_assets_condition ON public.assets(condition);
CREATE INDEX IF NOT EXISTS idx_assets_category ON public.assets(category);

-- 4. Tabel Peminjaman & Reservasi (bookings)
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_code VARCHAR(40) NOT NULL UNIQUE,
  borrower_name VARCHAR(120) NOT NULL,
  borrower_role VARCHAR(40) NOT NULL CHECK (
    borrower_role IN ('Dosen', 'Staf', 'Mahasiswa/Ormawa')
  ),
  borrower_unit VARCHAR(120) NOT NULL,
  borrower_phone VARCHAR(40) NOT NULL,
  target_type VARCHAR(20) NOT NULL CHECK (
    target_type IN ('Ruangan', 'Alat', 'Ruangan & Alat')
  ),
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  activity_name VARCHAR(200) NOT NULL,
  attendees_count INTEGER DEFAULT 1,
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'Menunggu Persetujuan' CHECK (
    status IN (
      'Menunggu Persetujuan',
      'Disetujui',
      'Sedang Dipinjam',
      'Selesai / Dikembalikan',
      'Ditolak'
    )
  ),
  return_condition_notes TEXT,
  approved_by VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_booking_target CHECK (room_id IS NOT NULL OR asset_id IS NOT NULL),
  CONSTRAINT chk_booking_time_order CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_bookings_room_date ON public.bookings(room_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_asset_date ON public.bookings(asset_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);

-- 5. Tabel Pemeliharaan & Laporan Kerusakan (maintenance_logs)
CREATE TABLE IF NOT EXISTS public.maintenance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_code VARCHAR(40) NOT NULL UNIQUE,
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  reporter_name VARCHAR(120) NOT NULL,
  reporter_role VARCHAR(60) NOT NULL,
  issue_title VARCHAR(180) NOT NULL,
  issue_description TEXT NOT NULL,
  damage_severity VARCHAR(30) NOT NULL DEFAULT 'Rusak Ringan' CHECK (
    damage_severity IN ('Rusak Ringan', 'Rusak Berat')
  ),
  priority VARCHAR(30) NOT NULL DEFAULT 'Sedang' CHECK (
    priority IN ('Rendah', 'Sedang', 'Tinggi/Darurat')
  ),
  photo_url TEXT,
  status VARCHAR(40) NOT NULL DEFAULT 'Dilaporkan' CHECK (
    status IN ('Dilaporkan', 'Dalam Pengerjaan', 'Selesai Diperbaiki')
  ),
  technician_vendor VARCHAR(150),
  repair_cost NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (repair_cost >= 0),
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_maintenance_target CHECK (asset_id IS NOT NULL OR room_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_maintenance_asset_id ON public.maintenance_logs(asset_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_room_id ON public.maintenance_logs(room_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON public.maintenance_logs(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_priority ON public.maintenance_logs(priority);

-- 6. Tabel Barang Habis Pakai / ATK (consumables)
CREATE TABLE IF NOT EXISTS public.consumables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(60) NOT NULL CHECK (
    category IN ('ATK & Kelas', 'Cetakan & Kertas', 'Tinta & Toner', 'Kebersihan & Sanitasi', 'Kelistrikan Ringan')
  ),
  unit VARCHAR(30) NOT NULL CHECK (
    unit IN ('Pcs', 'Box', 'Rim', 'Botol', 'Pack', 'Roll')
  ),
  current_stock INTEGER NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
  min_stock INTEGER NOT NULL DEFAULT 5 CHECK (min_stock >= 0),
  storage_location VARCHAR(120) NOT NULL DEFAULT 'Gudang Utama Sarpras Lt. 1',
  last_restocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consumables_category ON public.consumables(category);

-- 7. Tabel Log Mutasi Barang Habis Pakai (consumable_transactions)
CREATE TABLE IF NOT EXISTS public.consumable_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumable_id UUID NOT NULL REFERENCES public.consumables(id) ON DELETE CASCADE,
  transaction_type VARCHAR(20) NOT NULL CHECK (
    transaction_type IN ('Masuk', 'Keluar')
  ),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  actor_name VARCHAR(120) NOT NULL,
  actor_unit VARCHAR(120) NOT NULL,
  purpose_notes TEXT,
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consumable_tx_consumable_id ON public.consumable_transactions(consumable_id);
CREATE INDEX IF NOT EXISTS idx_consumable_tx_date ON public.consumable_transactions(transaction_date DESC);

-- TRIGGER 1: Sinkronisasi otomatis kondisi aset ketika laporan kerusakan dibuat atau diselesaikan
CREATE OR REPLACE FUNCTION public.fn_sync_asset_condition_from_maintenance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  IF NEW.asset_id IS NOT NULL THEN
    IF NEW.status = 'Selesai Diperbaiki' THEN
      UPDATE public.assets
      SET condition = 'Baik', updated_at = NOW()
      WHERE id = NEW.asset_id;
    ELSIF NEW.damage_severity = 'Rusak Berat' THEN
      UPDATE public.assets
      SET condition = 'Rusak Berat', updated_at = NOW()
      WHERE id = NEW.asset_id;
    ELSIF NEW.damage_severity = 'Rusak Ringan' AND NEW.status <> 'Selesai Diperbaiki' THEN
      UPDATE public.assets
      SET condition = 'Rusak Ringan', updated_at = NOW()
      WHERE id = NEW.asset_id AND condition = 'Baik';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_asset_condition ON public.maintenance_logs;
CREATE TRIGGER trg_sync_asset_condition
AFTER INSERT OR UPDATE ON public.maintenance_logs
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_asset_condition_from_maintenance();

-- TRIGGER 2: Mutasi otomatis stok BHP saat transaksi Masuk / Keluar dicatat
CREATE OR REPLACE FUNCTION public.fn_apply_consumable_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  IF NEW.transaction_type = 'Masuk' THEN
    UPDATE public.consumables
    SET current_stock = current_stock + NEW.quantity,
        last_restocked_at = NOW(),
        updated_at = NOW()
    WHERE id = NEW.consumable_id;
  ELSIF NEW.transaction_type = 'Keluar' THEN
    UPDATE public.consumables
    SET current_stock = current_stock - NEW.quantity,
        updated_at = NOW()
    WHERE id = NEW.consumable_id
      AND current_stock >= NEW.quantity;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Stok barang habis pakai tidak mencukupi untuk pengeluaran ini.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_consumable_tx ON public.consumable_transactions;

-- SEED DATA AWAL BERNUANSA KAMPUS
INSERT INTO public.buildings (id, code, name, floors_count, zone, description) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'GD-REKT', 'Gedung Rektorat & Administrasi Pusat', 4, 'Zona Barat', 'Pusat administrasi akademik, ruang rapat pimpinan, dan biro sarpras.'),
  ('b1000000-0000-0000-0000-000000000002', 'GD-SAINTEK', 'Gedung Kuliah Bersama Saintek (GKB A)', 5, 'Zona Utara', 'Gedung perkuliahan reguler dan laboratorium komputasi terpadu.'),
  ('b1000000-0000-0000-0000-000000000003', 'GD-AULA', 'Graha Cendekia & Pusat Kegiatan Mahasiswa', 2, 'Zona Tengah', 'Aula serbaguna, auditorium seminar nasional, dan sekretariat UKM.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.rooms (id, code, name, building_id, floor, category, capacity, pic_name, pic_contact, status, facilities_notes) VALUES
  ('c2000000-0000-0000-0000-000000000001', '1-SM6', 'Ruang Kelas Reguler 1-SM6', 'b1000000-0000-0000-0000-000000000002', 1, 'Ruang Kelas', 45, 'Hendra Wijaya, S.T.', '0812-3400-1101', 'Digunakan', 'Smart TV 65 inch, Proyektor Laser, 2 Unit AC Split 2 PK'),
  ('c2000000-0000-0000-0000-000000000002', 'LAB-KOM1', 'Laboratorium Pemrograman & Jaringan 1', 'b1000000-0000-0000-0000-000000000002', 2, 'Laboratorium', 40, 'Arif Rahman, M.Kom.', '0812-3400-1102', 'Digunakan', '40 Workstation PC, Server Rack Lokal, 3 Unit AC Cassette'),
  ('c2000000-0000-0000-0000-000000000003', 'AULA-GC1', 'Auditorium Utama Graha Cendekia', 'b1000000-0000-0000-0000-000000000003', 1, 'Aula', 350, 'Drs. Bambang Sutrisno', '0812-3400-1103', 'Tersedia', 'Videotron P2.5, Sound System Line Array, Panggung Rigging'),
  ('c2000000-0000-0000-0000-000000000004', 'R-DOSEN2', 'Ruang Dosen Fakultas Teknik & Transit', 'b1000000-0000-0000-0000-000000000001', 2, 'Ruang Staf/Dosen', 25, 'Siti Nurhaliza, S.E.', '0812-3400-1104', 'Tersedia', 'Meja Kubikal Dosen, Dispenser, Printer Jaringan, Loker Akademik'),
  ('c2000000-0000-0000-0000-000000000005', '2-SM4', 'Ruang Kelas Multimedia 2-SM4', 'b1000000-0000-0000-0000-000000000002', 2, 'Ruang Kelas', 40, 'Hendra Wijaya, S.T.', '0812-3400-1101', 'Perbaikan', 'Sedang perbaikan plafon dan instalasi pipa drainase AC')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.assets (id, inventory_code, name, brand_model, category, category_label, room_id, procurement_year, funding_source, acquisition_cost, condition, is_portable, serial_number, notes) VALUES
  ('a3000000-0000-0000-0000-000000000001', 'INV-ELK-2024-0001', 'Proyektor Laser WUXGA', 'Epson EB-L530U', 'ELK', 'Elektronik & Visual', 'c2000000-0000-0000-0000-000000000001', 2024, 'Hibah Kemendikbudristek', 28500000, 'Baik', false, 'EPS-L530-9921', 'Terpasang di bracket plafon ruang 1-SM6'),
  ('a3000000-0000-0000-0000-000000000002', 'INV-KLM-2023-0002', 'AC Split Inverter 2 PK', 'Daikin FTKQ50UVM4', 'KLM', 'Pendingin Udara', 'c2000000-0000-0000-0000-000000000001', 2023, 'Dana Operasional Kampus', 9200000, 'Baik', false, 'DKN-50U-4410', 'Servis berkala tiap 4 bulan'),
  ('a3000000-0000-0000-0000-000000000003', 'INV-KOM-2024-0003', 'PC Workstation Praktikum #01', 'Dell OptiPlex 7010 Tower i7', 'KOM', 'Komputer & Jaringan', 'c2000000-0000-0000-0000-000000000002', 2024, 'Dana Pengembangan Lab', 16400000, 'Baik', false, 'DLL-7010-001', 'RAM 32GB, NVMe 1TB'),
  ('a3000000-0000-0000-0000-000000000004', 'INV-AUD-2022-0004', 'Wireless Microphone Dual Handheld', 'Sennheiser EW-D 835-S Set', 'AUD', 'Audio & Pengeras Suara', 'c2000000-0000-0000-0000-000000000003', 2022, 'Dana Yayasan', 14800000, 'Rusak Ringan', true, 'SNH-EWD-772', 'Receiver channel B kadang putus sinyal'),
  ('a3000000-0000-0000-0000-000000000005', 'INV-KLM-2021-0005', 'AC Split Standard 2 PK Unit Barat', 'Panasonic CS-YN18WKJ', 'KLM', 'Pendingin Udara', 'c2000000-0000-0000-0000-000000000005', 2021, 'Dana Operasional Kampus', 7900000, 'Rusak Berat', false, 'PNS-18W-319', 'Kompresor mati dan pipa drainase bocor'),
  ('a3000000-0000-0000-0000-000000000006', 'INV-ELK-2025-0006', 'Proyektor Portabel Cadangan Biro', 'BenQ MH560 FHD', 'ELK', 'Elektronik & Visual', 'c2000000-0000-0000-0000-000000000004', 2025, 'Dana Operasional Kampus', 8400000, 'Baik', true, 'BNQ-560-882', 'Unit portabel untuk peminjaman lintas unit'),
  ('a3000000-0000-0000-0000-000000000007', 'INV-ELK-2024-0007', 'Kamera Mirrorless Dokumentasi Kampus', 'Sony Alpha a6400 Kit 16-50mm', 'ELK', 'Elektronik & Visual', 'c2000000-0000-0000-0000-000000000004', 2024, 'Dana Humas & Sarpras', 15200000, 'Baik', true, 'SNY-6400-511', 'Dilengkapi tas, 2 baterai NP-FW50, dan SD Card 128GB'),
  ('a3000000-0000-0000-0000-000000000008', 'INV-MBL-2023-0008', 'Meja Kuliah Lipat Modular (Set 20 Unit)', 'Chitose Folding Table FT-1845', 'MBL', 'Meubelair & Furnitur', 'c2000000-0000-0000-0000-000000000001', 2023, 'Dana Operasional Kampus', 32000000, 'Baik', false, 'CHT-FT-2023', 'Kondisi engsel pengunci seluruhnya normal')
ON CONFLICT (inventory_code) DO NOTHING;

INSERT INTO public.bookings (id, booking_code, borrower_name, borrower_role, borrower_unit, borrower_phone, target_type, room_id, asset_id, activity_name, attendees_count, booking_date, start_time, end_time, status, approved_by, return_condition_notes) VALUES
  ('d4000000-0000-0000-0000-000000000001', 'PJM-202611-001', 'Dr. Eng. Lukman Hakim, M.T.', 'Dosen', 'Prodi Teknik Informatika', '0813-2211-9001', 'Ruangan', 'c2000000-0000-0000-0000-000000000002', NULL, 'Praktikum Pengolahan Citra Digital & Visi Komputer', 38, CURRENT_DATE, '08:00', '11:30', 'Sedang Dipinjam', 'Hendra Wijaya, S.T.', NULL),
  ('d4000000-0000-0000-0000-000000000002', 'PJM-202611-002', 'Rizky Pratama (Ketua BEM)', 'Mahasiswa/Ormawa', 'BEM Universitas', '0857-8899-1204', 'Ruangan & Alat', 'c2000000-0000-0000-0000-000000000003', 'a3000000-0000-0000-0000-000000000007', 'Gladi Bersih Seminar Nasional Kepemimpinan Mahasiswa', 250, CURRENT_DATE, '13:00', '17:00', 'Disetujui', 'Drs. Bambang Sutrisno', NULL),
  ('d4000000-0000-0000-0000-000000000003', 'PJM-202611-003', 'Nadia Kusuma, S.Pd., M.Hum.', 'Dosen', 'Pusat Bahasa Kampus', '0812-7766-3310', 'Ruangan', 'c2000000-0000-0000-0000-000000000001', NULL, 'Kelas Intensif Academic Writing Semester Ganjil', 42, CURRENT_DATE, '09:00', '12:00', 'Sedang Dipinjam', 'Hendra Wijaya, S.T.', NULL),
  ('d4000000-0000-0000-0000-000000000004', 'PJM-202611-004', 'Fajar Nugroho, S.Kom.', 'Staf', 'Biro Kemahasiswaan & Alumni', '0811-3344-5566', 'Alat', NULL, 'a3000000-0000-0000-0000-000000000006', 'Rapat Koordinasi Tracer Study di Ruang Sidang Lt. 3', 20, CURRENT_DATE + 1, '09:00', '12:00', 'Menunggu Persetujuan', NULL, NULL)
ON CONFLICT (booking_code) DO NOTHING;

INSERT INTO public.maintenance_logs (id, ticket_code, asset_id, room_id, reporter_name, reporter_role, issue_title, issue_description, damage_severity, priority, status, technician_vendor, repair_cost, reported_at, resolution_notes) VALUES
  ('e5000000-0000-0000-0000-000000000001', 'MNT-202611-001', 'a3000000-0000-0000-0000-000000000005', 'c2000000-0000-0000-0000-000000000005', 'Hendra Wijaya, S.T.', 'PIC Ruangan GKB A', 'Kompresor AC mati & kebocoran pipa drainase plafon', 'Unit AC barat di ruang 2-SM4 mengeluarkan tetesan air deras ke deretan meja depan dan kompresor outdoor tidak menyala.', 'Rusak Berat', 'Tinggi/Darurat', 'Dalam Pengerjaan', 'CV Sejuk Teknik Mandiri (Teknisi: Pak Wahyu)', 1450000, NOW() - INTERVAL '1 day', 'Sedang penggantian kapasitor outdoor dan pengurasan jalur pipa pembuangan.'),
  ('e5000000-0000-0000-0000-000000000002', 'MNT-202611-002', 'a3000000-0000-0000-0000-000000000004', 'c2000000-0000-0000-0000-000000000003', 'Drs. Bambang Sutrisno', 'Koordinator Graha Cendekia', 'Sinyal mikrofon wireless Channel B putus-putus', 'Pada jarak lebih dari 8 meter dari panggung, suara mikrofon genggam kedua mengalami drop frekuensi.', 'Rusak Ringan', 'Sedang', 'Dilaporkan', NULL, 0, NOW() - INTERVAL '4 hours', NULL)
ON CONFLICT (ticket_code) DO NOTHING;

INSERT INTO public.consumables (id, code, name, category, unit, current_stock, min_stock, storage_location, last_restocked_at) VALUES
  ('f6000000-0000-0000-0000-000000000001', 'BHP-ATK-001', 'Spidol Whiteboard Snowman BG-12 Hitam', 'ATK & Kelas', 'Box', 4, 10, 'Lemari ATK A1 - Biro Sarpras', NOW() - INTERVAL '14 days'),
  ('f6000000-0000-0000-0000-000000000002', 'BHP-KRT-002', 'Kertas HVS A4 80gsm Sidu', 'Cetakan & Kertas', 'Rim', 38, 15, 'Rak Palet B2 - Gudang Utama', NOW() - INTERVAL '5 days'),
  ('f6000000-0000-0000-0000-000000000003', 'BHP-TNT-003', 'Tinta Refill Spidol Whiteboard Hitam', 'Tinta & Toner', 'Botol', 6, 12, 'Lemari ATK A1 - Biro Sarpras', NOW() - INTERVAL '20 days'),
  ('f6000000-0000-0000-0000-000000000004', 'BHP-KBR-004', 'Cairan Pembersih Lantai Karbol 5 Liter', 'Kebersihan & Sanitasi', 'Botol', 14, 6, 'Gudang Janitor GKB A Lt. Dasar', NOW() - INTERVAL '7 days'),
  ('f6000000-0000-0000-0000-000000000005', 'BHP-KLS-005', 'Baterai Alkaline AA (Untuk Mic & Remote AC)', 'Kelistrikan Ringan', 'Pack', 3, 8, 'Lemari ATK A2 - Biro Sarpras', NOW() - INTERVAL '18 days')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.consumable_transactions (id, consumable_id, transaction_type, quantity, actor_name, actor_unit, purpose_notes, transaction_date) VALUES
  ('07000000-0000-0000-0000-000000000001', 'f6000000-0000-0000-0000-000000000001', 'Keluar', 3, 'Hendra Wijaya, S.T.', 'GKB Saintek Lt. 1 & 2', 'Distribusi spidol awal pekan untuk 12 ruang kelas reguler', NOW() - INTERVAL '2 days'),
  ('07000000-0000-0000-0000-000000000002', 'f6000000-0000-0000-0000-000000000002', 'Masuk', 25, 'Siti Nurhaliza, S.E.', 'Bagian Pengadaan Sarpras', 'Pengadaan rutin bulanan kertas administrasi & soal ujian', NOW() - INTERVAL '5 days'),
  ('07000000-0000-0000-0000-000000000003', 'f6000000-0000-0000-0000-000000000005', 'Keluar', 4, 'Drs. Bambang Sutrisno', 'Graha Cendekia', 'Cadangan baterai mikrofon wireless untuk seminar nasional', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

-- AKTIFKAN TRIGGER SETELAH SEED DATA AWAL TERPASANG
CREATE TRIGGER trg_apply_consumable_tx
AFTER INSERT ON public.consumable_transactions
FOR EACH ROW
EXECUTE FUNCTION public.fn_apply_consumable_transaction();
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumable_transactions ENABLE ROW LEVEL SECURITY;

-- Kebijakan akses baca & operasional untuk staf terautentikasi (dan anon pada fase integrasi awal)
CREATE POLICY "Read buildings for campus users" ON public.buildings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Manage buildings for authenticated staff" ON public.buildings FOR ALL TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Read rooms for campus users" ON public.rooms FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Manage rooms for authenticated staff" ON public.rooms FOR ALL TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Read assets for campus users" ON public.assets FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Manage assets for authenticated staff" ON public.assets FOR ALL TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Read bookings for campus users" ON public.bookings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Manage bookings for authenticated staff" ON public.bookings FOR ALL TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Read maintenance logs for campus users" ON public.maintenance_logs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Manage maintenance logs for authenticated staff" ON public.maintenance_logs FOR ALL TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Read consumables for campus users" ON public.consumables FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Manage consumables for authenticated staff" ON public.consumables FOR ALL TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Read consumable transactions for campus users" ON public.consumable_transactions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Manage consumable transactions for authenticated staff" ON public.consumable_transactions FOR ALL TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);

-- SEED DATA AWAL BERNUANSA KAMPUS
INSERT INTO public.buildings (id, code, name, floors_count, zone, description) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'GD-REKT', 'Gedung Rektorat & Administrasi Pusat', 4, 'Zona Barat', 'Pusat administrasi akademik, ruang rapat pimpinan, dan biro sarpras.'),
  ('b1000000-0000-0000-0000-000000000002', 'GD-SAINTEK', 'Gedung Kuliah Bersama Saintek (GKB A)', 5, 'Zona Utara', 'Gedung perkuliahan reguler dan laboratorium komputasi terpadu.'),
  ('b1000000-0000-0000-0000-000000000003', 'GD-AULA', 'Graha Cendekia & Pusat Kegiatan Mahasiswa', 2, 'Zona Tengah', 'Aula serbaguna, auditorium seminar nasional, dan sekretariat UKM.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.rooms (id, code, name, building_id, floor, category, capacity, pic_name, pic_contact, status, facilities_notes) VALUES
  ('c2000000-0000-0000-0000-000000000001', '1-SM6', 'Ruang Kelas Reguler 1-SM6', 'b1000000-0000-0000-0000-000000000002', 1, 'Ruang Kelas', 45, 'Hendra Wijaya, S.T.', '0812-3400-1101', 'Digunakan', 'Smart TV 65 inch, Proyektor Laser, 2 Unit AC Split 2 PK'),
  ('c2000000-0000-0000-0000-000000000002', 'LAB-KOM1', 'Laboratorium Pemrograman & Jaringan 1', 'b1000000-0000-0000-0000-000000000002', 2, 'Laboratorium', 40, 'Arif Rahman, M.Kom.', '0812-3400-1102', 'Digunakan', '40 Workstation PC, Server Rack Lokal, 3 Unit AC Cassette'),
  ('c2000000-0000-0000-0000-000000000003', 'AULA-GC1', 'Auditorium Utama Graha Cendekia', 'b1000000-0000-0000-0000-000000000003', 1, 'Aula', 350, 'Drs. Bambang Sutrisno', '0812-3400-1103', 'Tersedia', 'Videotron P2.5, Sound System Line Array, Panggung Rigging'),
  ('c2000000-0000-0000-0000-000000000004', 'R-DOSEN2', 'Ruang Dosen Fakultas Teknik & Transit', 'b1000000-0000-0000-0000-000000000001', 2, 'Ruang Staf/Dosen', 25, 'Siti Nurhaliza, S.E.', '0812-3400-1104', 'Tersedia', 'Meja Kubikal Dosen, Dispenser, Printer Jaringan, Loker Akademik'),
  ('c2000000-0000-0000-0000-000000000005', '2-SM4', 'Ruang Kelas Multimedia 2-SM4', 'b1000000-0000-0000-0000-000000000002', 2, 'Ruang Kelas', 40, 'Hendra Wijaya, S.T.', '0812-3400-1101', 'Perbaikan', 'Sedang perbaikan plafon dan instalasi pipa drainase AC')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.assets (id, inventory_code, name, brand_model, category, category_label, room_id, procurement_year, funding_source, acquisition_cost, condition, is_portable, serial_number, notes) VALUES
  ('a3000000-0000-0000-0000-000000000001', 'INV-ELK-2024-0001', 'Proyektor Laser WUXGA', 'Epson EB-L530U', 'ELK', 'Elektronik & Visual', 'c2000000-0000-0000-0000-000000000001', 2024, 'Hibah Kemendikbudristek', 28500000, 'Baik', false, 'EPS-L530-9921', 'Terpasang di bracket plafon ruang 1-SM6'),
  ('a3000000-0000-0000-0000-000000000002', 'INV-KLM-2023-0002', 'AC Split Inverter 2 PK', 'Daikin FTKQ50UVM4', 'KLM', 'Pendingin Udara', 'c2000000-0000-0000-0000-000000000001', 2023, 'Dana Operasional Kampus', 9200000, 'Baik', false, 'DKN-50U-4410', 'Servis berkala tiap 4 bulan'),
  ('a3000000-0000-0000-0000-000000000003', 'INV-KOM-2024-0003', 'PC Workstation Praktikum #01', 'Dell OptiPlex 7010 Tower i7', 'KOM', 'Komputer & Jaringan', 'c2000000-0000-0000-0000-000000000002', 2024, 'Dana Pengembangan Lab', 16400000, 'Baik', false, 'DLL-7010-001', 'RAM 32GB, NVMe 1TB'),
  ('a3000000-0000-0000-0000-000000000004', 'INV-AUD-2022-0004', 'Wireless Microphone Dual Handheld', 'Sennheiser EW-D 835-S Set', 'AUD', 'Audio & Pengeras Suara', 'c2000000-0000-0000-0000-000000000003', 2022, 'Dana Yayasan', 14800000, 'Rusak Ringan', true, 'SNH-EWD-772', 'Receiver channel B kadang putus sinyal'),
  ('a3000000-0000-0000-0000-000000000005', 'INV-KLM-2021-0005', 'AC Split Standard 2 PK Unit Barat', 'Panasonic CS-YN18WKJ', 'KLM', 'Pendingin Udara', 'c2000000-0000-0000-0000-000000000005', 2021, 'Dana Operasional Kampus', 7900000, 'Rusak Berat', false, 'PNS-18W-319', 'Kompresor mati dan pipa drainase bocor'),
  ('a3000000-0000-0000-0000-000000000006', 'INV-ELK-2025-0006', 'Proyektor Portabel Cadangan Biro', 'BenQ MH560 FHD', 'ELK', 'Elektronik & Visual', 'c2000000-0000-0000-0000-000000000004', 2025, 'Dana Operasional Kampus', 8400000, 'Baik', true, 'BNQ-560-882', 'Unit portabel untuk peminjaman lintas unit'),
  ('a3000000-0000-0000-0000-000000000007', 'INV-ELK-2024-0007', 'Kamera Mirrorless Dokumentasi Kampus', 'Sony Alpha a6400 Kit 16-50mm', 'ELK', 'Elektronik & Visual', 'c2000000-0000-0000-0000-000000000004', 2024, 'Dana Humas & Sarpras', 15200000, 'Baik', true, 'SNY-6400-511', 'Dilengkapi tas, 2 baterai NP-FW50, dan SD Card 128GB'),
  ('a3000000-0000-0000-0000-000000000008', 'INV-MBL-2023-0008', 'Meja Kuliah Lipat Modular (Set 20 Unit)', 'Chitose Folding Table FT-1845', 'MBL', 'Meubelair & Furnitur', 'c2000000-0000-0000-0000-000000000001', 2023, 'Dana Operasional Kampus', 32000000, 'Baik', false, 'CHT-FT-2023', 'Kondisi engsel pengunci seluruhnya normal')
ON CONFLICT (inventory_code) DO NOTHING;

INSERT INTO public.bookings (id, booking_code, borrower_name, borrower_role, borrower_unit, borrower_phone, target_type, room_id, asset_id, activity_name, attendees_count, booking_date, start_time, end_time, status, approved_by, return_condition_notes) VALUES
  ('d4000000-0000-0000-0000-000000000001', 'PJM-202611-001', 'Dr. Eng. Lukman Hakim, M.T.', 'Dosen', 'Prodi Teknik Informatika', '0813-2211-9001', 'Ruangan', 'c2000000-0000-0000-0000-000000000002', NULL, 'Praktikum Pengolahan Citra Digital & Visi Komputer', 38, CURRENT_DATE, '08:00', '11:30', 'Sedang Dipinjam', 'Hendra Wijaya, S.T.', NULL),
  ('d4000000-0000-0000-0000-000000000002', 'PJM-202611-002', 'Rizky Pratama (Ketua BEM)', 'Mahasiswa/Ormawa', 'BEM Universitas', '0857-8899-1204', 'Ruangan & Alat', 'c2000000-0000-0000-0000-000000000003', 'a3000000-0000-0000-0000-000000000007', 'Gladi Bersih Seminar Nasional Kepemimpinan Mahasiswa', 250, CURRENT_DATE, '13:00', '17:00', 'Disetujui', 'Drs. Bambang Sutrisno', NULL),
  ('d4000000-0000-0000-0000-000000000003', 'PJM-202611-003', 'Nadia Kusuma, S.Pd., M.Hum.', 'Dosen', 'Pusat Bahasa Kampus', '0812-7766-3310', 'Ruangan', 'c2000000-0000-0000-0000-000000000001', NULL, 'Kelas Intensif Academic Writing Semester Ganjil', 42, CURRENT_DATE, '09:00', '12:00', 'Sedang Dipinjam', 'Hendra Wijaya, S.T.', NULL),
  ('d4000000-0000-0000-0000-000000000004', 'PJM-202611-004', 'Fajar Nugroho, S.Kom.', 'Staf', 'Biro Kemahasiswaan & Alumni', '0811-3344-5566', 'Alat', NULL, 'a3000000-0000-0000-0000-000000000006', 'Rapat Koordinasi Tracer Study di Ruang Sidang Lt. 3', 20, CURRENT_DATE + 1, '09:00', '12:00', 'Menunggu Persetujuan', NULL, NULL)
ON CONFLICT (booking_code) DO NOTHING;

INSERT INTO public.maintenance_logs (id, ticket_code, asset_id, room_id, reporter_name, reporter_role, issue_title, issue_description, damage_severity, priority, status, technician_vendor, repair_cost, reported_at, resolution_notes) VALUES
  ('e5000000-0000-0000-0000-000000000001', 'MNT-202611-001', 'a3000000-0000-0000-0000-000000000005', 'c2000000-0000-0000-0000-000000000005', 'Hendra Wijaya, S.T.', 'PIC Ruangan GKB A', 'Kompresor AC mati & kebocoran pipa drainase plafon', 'Unit AC barat di ruang 2-SM4 mengeluarkan tetesan air deras ke deretan meja depan dan kompresor outdoor tidak menyala.', 'Rusak Berat', 'Tinggi/Darurat', 'Dalam Pengerjaan', 'CV Sejuk Teknik Mandiri (Teknisi: Pak Wahyu)', 1450000, NOW() - INTERVAL '1 day', 'Sedang penggantian kapasitor outdoor dan pengurasan jalur pipa pembuangan.'),
  ('e5000000-0000-0000-0000-000000000002', 'MNT-202611-002', 'a3000000-0000-0000-0000-000000000004', 'c2000000-0000-0000-0000-000000000003', 'Drs. Bambang Sutrisno', 'Koordinator Graha Cendekia', 'Sinyal mikrofon wireless Channel B putus-putus', 'Pada jarak lebih dari 8 meter dari panggung, suara mikrofon genggam kedua mengalami drop frekuensi.', 'Rusak Ringan', 'Sedang', 'Dilaporkan', NULL, 0, NOW() - INTERVAL '4 hours', NULL)
ON CONFLICT (ticket_code) DO NOTHING;

INSERT INTO public.consumables (id, code, name, category, unit, current_stock, min_stock, storage_location, last_restocked_at) VALUES
  ('f6000000-0000-0000-0000-000000000001', 'BHP-ATK-001', 'Spidol Whiteboard Snowman BG-12 Hitam', 'ATK & Kelas', 'Box', 4, 10, 'Lemari ATK A1 - Biro Sarpras', NOW() - INTERVAL '14 days'),
  ('f6000000-0000-0000-0000-000000000002', 'BHP-KRT-002', 'Kertas HVS A4 80gsm Sidu', 'Cetakan & Kertas', 'Rim', 38, 15, 'Rak Palet B2 - Gudang Utama', NOW() - INTERVAL '5 days'),
  ('f6000000-0000-0000-0000-000000000003', 'BHP-TNT-003', 'Tinta Refill Spidol Whiteboard Hitam', 'Tinta & Toner', 'Botol', 6, 12, 'Lemari ATK A1 - Biro Sarpras', NOW() - INTERVAL '20 days'),
  ('f6000000-0000-0000-0000-000000000004', 'BHP-KBR-004', 'Cairan Pembersih Lantai Karbol 5 Liter', 'Kebersihan & Sanitasi', 'Botol', 14, 6, 'Gudang Janitor GKB A Lt. Dasar', NOW() - INTERVAL '7 days'),
  ('f6000000-0000-0000-0000-000000000005', 'BHP-KLS-005', 'Baterai Alkaline AA (Untuk Mic & Remote AC)', 'Kelistrikan Ringan', 'Pack', 3, 8, 'Lemari ATK A2 - Biro Sarpras', NOW() - INTERVAL '18 days')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.consumable_transactions (id, consumable_id, transaction_type, quantity, actor_name, actor_unit, purpose_notes, transaction_date) VALUES
  ('07000000-0000-0000-0000-000000000001', 'f6000000-0000-0000-0000-000000000001', 'Keluar', 3, 'Hendra Wijaya, S.T.', 'GKB Saintek Lt. 1 & 2', 'Distribusi spidol awal pekan untuk 12 ruang kelas reguler', NOW() - INTERVAL '2 days'),
  ('07000000-0000-0000-0000-000000000002', 'f6000000-0000-0000-0000-000000000002', 'Masuk', 25, 'Siti Nurhaliza, S.E.', 'Bagian Pengadaan Sarpras', 'Pengadaan rutin bulanan kertas administrasi & soal ujian', NOW() - INTERVAL '5 days'),
  ('07000000-0000-0000-0000-000000000003', 'f6000000-0000-0000-0000-000000000005', 'Keluar', 4, 'Drs. Bambang Sutrisno', 'Graha Cendekia', 'Cadangan baterai mikrofon wireless untuk seminar nasional', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;
