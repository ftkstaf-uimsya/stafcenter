-- Migrasi 004: Perbaikan Constraint Penghapusan, Snapshot Histori, dan Pembersihan Catatan Yatim
-- Jalankan file ini di Supabase SQL Editor untuk mendukung penghapusan Aset & Ruangan secara aman
-- dengan opsi menjaga arsip histori peminjaman/perbaikan (snapshot target) serta rekonsiliasi kondisi.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS deleted_target_label TEXT;

ALTER TABLE public.maintenance_logs
  ADD COLUMN IF NOT EXISTS deleted_target_label TEXT;

-- Perbarui CHECK constraint agar baris dengan deleted_target_label tetap sah setelah FK di-SET NULL
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS chk_booking_target;

ALTER TABLE public.bookings
  ADD CONSTRAINT chk_booking_target
  CHECK (room_id IS NOT NULL OR asset_id IS NOT NULL OR NULLIF(TRIM(COALESCE(deleted_target_label, '')), '') IS NOT NULL);

ALTER TABLE public.maintenance_logs
  DROP CONSTRAINT IF EXISTS chk_maintenance_target;

ALTER TABLE public.maintenance_logs
  ADD CONSTRAINT chk_maintenance_target
  CHECK (asset_id IS NOT NULL OR room_id IS NOT NULL OR NULLIF(TRIM(COALESCE(deleted_target_label, '')), '') IS NOT NULL);

-- Snapshot target sebelum Ruangan dihapus
CREATE OR REPLACE FUNCTION public.fn_snapshot_before_delete_room()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_label TEXT;
BEGIN
  v_label := 'Ruang ' || OLD.code || ' (' || OLD.name || ') [Dihapus]';

  UPDATE public.bookings
  SET
    deleted_target_label = CASE
      WHEN NULLIF(TRIM(COALESCE(deleted_target_label, '')), '') IS NULL THEN v_label
      ELSE deleted_target_label || ' | ' || v_label
    END,
    target_type = CASE
      WHEN target_type = 'Ruangan & Alat' AND asset_id IS NOT NULL THEN 'Alat'
      ELSE target_type
    END,
    updated_at = NOW()
  WHERE room_id = OLD.id;

  UPDATE public.maintenance_logs
  SET
    deleted_target_label = CASE
      WHEN NULLIF(TRIM(COALESCE(deleted_target_label, '')), '') IS NULL THEN v_label
      ELSE deleted_target_label || ' | ' || v_label
    END,
    updated_at = NOW()
  WHERE room_id = OLD.id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_before_delete_room ON public.rooms;
CREATE TRIGGER trg_snapshot_before_delete_room
BEFORE DELETE ON public.rooms
FOR EACH ROW
EXECUTE FUNCTION public.fn_snapshot_before_delete_room();

-- Snapshot target sebelum Aset dihapus
CREATE OR REPLACE FUNCTION public.fn_snapshot_before_delete_asset()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_label TEXT;
BEGIN
  v_label := 'Aset ' || OLD.inventory_code || ' (' || OLD.name || ') [Dihapus]';

  UPDATE public.bookings
  SET
    deleted_target_label = CASE
      WHEN NULLIF(TRIM(COALESCE(deleted_target_label, '')), '') IS NULL THEN v_label
      ELSE deleted_target_label || ' | ' || v_label
    END,
    target_type = CASE
      WHEN target_type = 'Ruangan & Alat' AND room_id IS NOT NULL THEN 'Ruangan'
      ELSE target_type
    END,
    updated_at = NOW()
  WHERE asset_id = OLD.id;

  UPDATE public.maintenance_logs
  SET
    deleted_target_label = CASE
      WHEN NULLIF(TRIM(COALESCE(deleted_target_label, '')), '') IS NULL THEN v_label
      ELSE deleted_target_label || ' | ' || v_label
    END,
    updated_at = NOW()
  WHERE asset_id = OLD.id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_before_delete_asset ON public.assets;
CREATE TRIGGER trg_snapshot_before_delete_asset
BEFORE DELETE ON public.assets
FOR EACH ROW
EXECUTE FUNCTION public.fn_snapshot_before_delete_asset();

-- Bersihkan sarpras_notes yatim ketika entitas induk dihapus
CREATE OR REPLACE FUNCTION public.fn_cleanup_entity_notes_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF to_regclass('public.sarpras_notes') IS NOT NULL THEN
    DELETE FROM public.sarpras_notes
    WHERE entity_type = TG_ARGV[0]
      AND entity_id = OLD.id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_notes_room ON public.rooms;
CREATE TRIGGER trg_cleanup_notes_room
AFTER DELETE ON public.rooms
FOR EACH ROW
EXECUTE FUNCTION public.fn_cleanup_entity_notes_on_delete('room');

DROP TRIGGER IF EXISTS trg_cleanup_notes_asset ON public.assets;
CREATE TRIGGER trg_cleanup_notes_asset
AFTER DELETE ON public.assets
FOR EACH ROW
EXECUTE FUNCTION public.fn_cleanup_entity_notes_on_delete('asset');

DROP TRIGGER IF EXISTS trg_cleanup_notes_booking ON public.bookings;
CREATE TRIGGER trg_cleanup_notes_booking
AFTER DELETE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.fn_cleanup_entity_notes_on_delete('booking');

DROP TRIGGER IF EXISTS trg_cleanup_notes_maintenance ON public.maintenance_logs;
CREATE TRIGGER trg_cleanup_notes_maintenance
AFTER DELETE ON public.maintenance_logs
FOR EACH ROW
EXECUTE FUNCTION public.fn_cleanup_entity_notes_on_delete('maintenance');

DROP TRIGGER IF EXISTS trg_cleanup_notes_consumable ON public.consumables;
CREATE TRIGGER trg_cleanup_notes_consumable
AFTER DELETE ON public.consumables
FOR EACH ROW
EXECUTE FUNCTION public.fn_cleanup_entity_notes_on_delete('consumable');

-- Rekonsiliasi kondisi aset & status ruang ketika tiket pemeliharaan dihapus
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
