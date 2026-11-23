-- Migrasi 009: Dukungan Pelaporan Kerusakan Alat Kantor Staf pada Pemeliharaan
-- Jalankan file ini di SQL Editor Supabase setelah migrasi 001-008.
-- Mencakup:
-- 1. Penambahan kolom office_kit_item_id + indeks FK pada public.maintenance_logs
-- 2. Pembaruan constraint chk_maintenance_target agar Alat Kantor Staf universal sah dilaporkan
-- 3. Pembaruan trigger fn_sync_asset_condition_from_maintenance dan fn_reconcile_after_delete_maintenance
-- 4. Penambahan trigger snapshot sebelum penghapusan barang kantor staf (trg_snapshot_before_delete_office_kit)

ALTER TABLE public.maintenance_logs
  ADD COLUMN IF NOT EXISTS office_kit_item_id UUID REFERENCES public.office_kit_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_maintenance_office_kit_item_id
  ON public.maintenance_logs(office_kit_item_id);

ALTER TABLE public.maintenance_logs
  DROP CONSTRAINT IF EXISTS chk_maintenance_target;

ALTER TABLE public.maintenance_logs
  ADD CONSTRAINT chk_maintenance_target
  CHECK (
    asset_id IS NOT NULL
    OR room_id IS NOT NULL
    OR office_kit_item_id IS NOT NULL
    OR NULLIF(TRIM(COALESCE(deleted_target_label, '')), '') IS NOT NULL
  );

-- Sinkronisasi otomatis kondisi Aset Inventaris & Alat Kantor Staf saat tiket pemeliharaan dibuat / diperbarui
CREATE OR REPLACE FUNCTION public.fn_sync_asset_condition_from_maintenance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_asset_has_heavy BOOLEAN;
  v_asset_has_light BOOLEAN;
  v_kit_has_heavy BOOLEAN;
  v_kit_has_light BOOLEAN;
BEGIN
  IF NEW.asset_id IS NOT NULL THEN
    IF NEW.status = 'Selesai Diperbaiki' THEN
      SELECT
        EXISTS(
          SELECT 1 FROM public.maintenance_logs
          WHERE asset_id = NEW.asset_id
            AND id <> NEW.id
            AND status <> 'Selesai Diperbaiki'
            AND damage_severity = 'Rusak Berat'
        ),
        EXISTS(
          SELECT 1 FROM public.maintenance_logs
          WHERE asset_id = NEW.asset_id
            AND id <> NEW.id
            AND status <> 'Selesai Diperbaiki'
            AND damage_severity = 'Rusak Ringan'
        )
      INTO v_asset_has_heavy, v_asset_has_light;

      UPDATE public.assets
      SET
        condition = CASE
          WHEN v_asset_has_heavy THEN 'Rusak Berat'
          WHEN v_asset_has_light THEN 'Rusak Ringan'
          WHEN condition IN ('Rusak Ringan', 'Rusak Berat') THEN 'Baik'
          ELSE condition
        END,
        updated_at = NOW()
      WHERE id = NEW.asset_id;
    ELSIF NEW.damage_severity = 'Rusak Berat' THEN
      UPDATE public.assets
      SET condition = 'Rusak Berat', updated_at = NOW()
      WHERE id = NEW.asset_id;
    ELSIF NEW.damage_severity = 'Rusak Ringan' THEN
      UPDATE public.assets
      SET condition = 'Rusak Ringan', updated_at = NOW()
      WHERE id = NEW.asset_id AND condition = 'Baik';
    END IF;
  END IF;

  IF NEW.office_kit_item_id IS NOT NULL THEN
    IF NEW.status = 'Selesai Diperbaiki' THEN
      SELECT
        EXISTS(
          SELECT 1 FROM public.maintenance_logs
          WHERE office_kit_item_id = NEW.office_kit_item_id
            AND id <> NEW.id
            AND status <> 'Selesai Diperbaiki'
            AND damage_severity = 'Rusak Berat'
        ),
        EXISTS(
          SELECT 1 FROM public.maintenance_logs
          WHERE office_kit_item_id = NEW.office_kit_item_id
            AND id <> NEW.id
            AND status <> 'Selesai Diperbaiki'
            AND damage_severity = 'Rusak Ringan'
        )
      INTO v_kit_has_heavy, v_kit_has_light;

      UPDATE public.office_kit_items
      SET
        condition = CASE
          WHEN v_kit_has_heavy THEN 'Rusak Berat'
          WHEN v_kit_has_light THEN 'Rusak Ringan'
          WHEN condition IN ('Rusak Ringan', 'Rusak Berat') THEN 'Baik'
          ELSE condition
        END,
        status = CASE
          WHEN (v_kit_has_heavy OR v_kit_has_light) AND status = 'Tersedia' THEN 'Perbaikan'
          WHEN NOT v_kit_has_heavy AND NOT v_kit_has_light AND status = 'Perbaikan' THEN 'Tersedia'
          ELSE status
        END,
        updated_at = NOW()
      WHERE id = NEW.office_kit_item_id;
    ELSIF NEW.damage_severity = 'Rusak Berat' THEN
      UPDATE public.office_kit_items
      SET
        condition = 'Rusak Berat',
        status = CASE WHEN status = 'Tersedia' THEN 'Perbaikan' ELSE status END,
        updated_at = NOW()
      WHERE id = NEW.office_kit_item_id;
    ELSIF NEW.damage_severity = 'Rusak Ringan' THEN
      UPDATE public.office_kit_items
      SET
        condition = CASE WHEN condition = 'Baik' THEN 'Rusak Ringan' ELSE condition END,
        status = CASE WHEN status = 'Tersedia' THEN 'Perbaikan' ELSE status END,
        updated_at = NOW()
      WHERE id = NEW.office_kit_item_id;
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

-- Rekonsiliasi kondisi aset, alat kantor staf, & status ruang ketika tiket pemeliharaan dihapus
CREATE OR REPLACE FUNCTION public.fn_reconcile_after_delete_maintenance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_heavy BOOLEAN;
  v_has_light BOOLEAN;
  v_has_urgent_room BOOLEAN;
  v_has_kit_heavy BOOLEAN;
  v_has_kit_light BOOLEAN;
BEGIN
  IF OLD.asset_id IS NOT NULL THEN
    SELECT
      EXISTS(
        SELECT 1 FROM public.maintenance_logs
        WHERE asset_id = OLD.asset_id
          AND status <> 'Selesai Diperbaiki'
          AND damage_severity = 'Rusak Berat'
      ),
      EXISTS(
        SELECT 1 FROM public.maintenance_logs
        WHERE asset_id = OLD.asset_id
          AND status <> 'Selesai Diperbaiki'
          AND damage_severity = 'Rusak Ringan'
      )
    INTO v_has_heavy, v_has_light;

    UPDATE public.assets
    SET
      condition = CASE
        WHEN v_has_heavy THEN 'Rusak Berat'
        WHEN v_has_light THEN 'Rusak Ringan'
        WHEN condition IN ('Rusak Ringan', 'Rusak Berat') THEN 'Baik'
        ELSE condition
      END,
      updated_at = NOW()
    WHERE id = OLD.asset_id;
  END IF;

  IF OLD.office_kit_item_id IS NOT NULL THEN
    SELECT
      EXISTS(
        SELECT 1 FROM public.maintenance_logs
        WHERE office_kit_item_id = OLD.office_kit_item_id
          AND status <> 'Selesai Diperbaiki'
          AND damage_severity = 'Rusak Berat'
      ),
      EXISTS(
        SELECT 1 FROM public.maintenance_logs
        WHERE office_kit_item_id = OLD.office_kit_item_id
          AND status <> 'Selesai Diperbaiki'
          AND damage_severity = 'Rusak Ringan'
      )
    INTO v_has_kit_heavy, v_has_kit_light;

    UPDATE public.office_kit_items
    SET
      condition = CASE
        WHEN v_has_kit_heavy THEN 'Rusak Berat'
        WHEN v_has_kit_light THEN 'Rusak Ringan'
        WHEN condition IN ('Rusak Ringan', 'Rusak Berat') THEN 'Baik'
        ELSE condition
      END,
      status = CASE
        WHEN (v_has_kit_heavy OR v_has_kit_light) AND status = 'Tersedia' THEN 'Perbaikan'
        WHEN NOT v_has_kit_heavy AND NOT v_has_kit_light AND status = 'Perbaikan' THEN 'Tersedia'
        ELSE status
      END,
      updated_at = NOW()
    WHERE id = OLD.office_kit_item_id;
  END IF;

  IF OLD.room_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.maintenance_logs
      WHERE room_id = OLD.room_id
        AND status <> 'Selesai Diperbaiki'
        AND priority = 'Tinggi/Darurat'
    )
    INTO v_has_urgent_room;

    IF NOT v_has_urgent_room THEN
      UPDATE public.rooms
      SET status = 'Tersedia', updated_at = NOW()
      WHERE id = OLD.room_id
        AND status = 'Perbaikan';
    END IF;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_reconcile_after_delete_maintenance ON public.maintenance_logs;
CREATE TRIGGER trg_reconcile_after_delete_maintenance
AFTER DELETE ON public.maintenance_logs
FOR EACH ROW
EXECUTE FUNCTION public.fn_reconcile_after_delete_maintenance();

-- Snapshot label target sebelum barang kantor staf dihapus agar histori tiket pemeliharaan tetap sah
CREATE OR REPLACE FUNCTION public.fn_snapshot_before_delete_office_kit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_label TEXT;
BEGIN
  v_label := 'Alat Kantor ' || OLD.kit_code || ' (' || OLD.name || ') [Dihapus]';

  UPDATE public.maintenance_logs
  SET
    deleted_target_label = CASE
      WHEN NULLIF(TRIM(COALESCE(deleted_target_label, '')), '') IS NULL THEN v_label
      ELSE deleted_target_label || ' | ' || v_label
    END,
    updated_at = NOW()
  WHERE office_kit_item_id = OLD.id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_before_delete_office_kit ON public.office_kit_items;
CREATE TRIGGER trg_snapshot_before_delete_office_kit
BEFORE DELETE ON public.office_kit_items
FOR EACH ROW
EXECUTE FUNCTION public.fn_snapshot_before_delete_office_kit();
