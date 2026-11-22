-- Migrasi 008: Security Hardening Database (RLS Strict & Search Path Isolation)
-- Jalankan file ini di Supabase SQL Editor untuk:
-- 1. Mencabut akses baca publik (role anon) pada seluruh 19 tabel agar NEXT_PUBLIC_SUPABASE_ANON_KEY
--    tidak dapat digunakan untuk membaca/mengunduh data internal tanpa melewati server Next.js.
-- 2. Menambahkan SET search_path = public pada fungsi trigger operasional.
-- 3. Menambahkan policy RLS eksplisit untuk sarpras_notes dan sarpras_attachments.

-- ============================================================================
-- 1. PERBAIKI SEARCH_PATH PADA FUNGSI TRIGGER OPERASIONAL
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_sync_asset_condition_from_maintenance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.fn_apply_consumable_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
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

-- ============================================================================
-- 2. CABUT AKSES ANON PADA SELURUH TABEL & TERAPKAN READ POLICY AUTHENTICATED
-- ============================================================================

DO $$
DECLARE
  v_item RECORD;
BEGIN
  FOR v_item IN
    SELECT * FROM (
      VALUES
        ('buildings', 'Read buildings for campus users'),
        ('rooms', 'Read rooms for campus users'),
        ('assets', 'Read assets for campus users'),
        ('bookings', 'Read bookings for campus users'),
        ('maintenance_logs', 'Read maintenance logs for campus users'),
        ('consumables', 'Read consumables for campus users'),
        ('consumable_transactions', 'Read consumable transactions for campus users'),
        ('lecturers', 'Read lecturers for campus users'),
        ('courses', 'Read courses for campus users'),
        ('campus_officials', 'Read campus officials for campus users'),
        ('campus_units', 'Read campus_units for campus users'),
        ('maintenance_vendors', 'Read maintenance_vendors for campus users'),
        ('asset_categories', 'Read asset_categories for campus users'),
        ('funding_sources', 'Read funding_sources for campus users'),
        ('consumable_categories', 'Read consumable_categories for campus users'),
        ('consumable_units', 'Read consumable_units for campus users'),
        ('academic_classes', 'Read academic_classes for campus users'),
        ('office_kit_items', 'Read office_kit_items for campus users'),
        ('office_kit_loans', 'Read office_kit_loans for campus users')
    ) AS t(tbl_name, old_policy)
  LOOP
    IF to_regclass('public.' || v_item.tbl_name) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_item.tbl_name);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_item.old_policy, v_item.tbl_name);
      EXECUTE format(
        'DROP POLICY IF EXISTS %I ON public.%I',
        'Read ' || v_item.tbl_name || ' for authenticated staff',
        v_item.tbl_name
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL)',
        'Read ' || v_item.tbl_name || ' for authenticated staff',
        v_item.tbl_name
      );
    END IF;
  END LOOP;

  -- ==========================================================================
  -- 3. KEBIJAKAN RLS EKSPLISIT UNTUK SARPRAS_NOTES & SARPRAS_ATTACHMENTS
  -- ==========================================================================

  IF to_regclass('public.sarpras_notes') IS NOT NULL THEN
    ALTER TABLE public.sarpras_notes ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Manage sarpras_notes for authenticated staff" ON public.sarpras_notes;
    CREATE POLICY "Manage sarpras_notes for authenticated staff"
      ON public.sarpras_notes
      FOR ALL
      TO authenticated
      USING ((select auth.uid()) IS NOT NULL)
      WITH CHECK ((select auth.uid()) IS NOT NULL);
  END IF;

  IF to_regclass('public.sarpras_attachments') IS NOT NULL THEN
    ALTER TABLE public.sarpras_attachments ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Manage sarpras_attachments for authenticated staff" ON public.sarpras_attachments;
    CREATE POLICY "Manage sarpras_attachments for authenticated staff"
      ON public.sarpras_attachments
      FOR ALL
      TO authenticated
      USING ((select auth.uid()) IS NOT NULL)
      WITH CHECK ((select auth.uid()) IS NOT NULL);
  END IF;
END $$;
