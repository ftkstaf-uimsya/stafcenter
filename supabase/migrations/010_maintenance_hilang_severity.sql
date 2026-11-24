-- ==============================================================================
-- Migration 010: Support 'Hilang' in maintenance_logs.damage_severity & sync trigger
-- ==============================================================================

ALTER TABLE public.maintenance_logs
  DROP CONSTRAINT IF EXISTS maintenance_logs_damage_severity_check;

ALTER TABLE public.maintenance_logs
  ADD CONSTRAINT maintenance_logs_damage_severity_check
  CHECK (damage_severity IN ('Rusak Ringan', 'Rusak Berat', 'Hilang'));

CREATE OR REPLACE FUNCTION public.fn_sync_asset_condition_from_maintenance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asset_has_lost BOOLEAN := FALSE;
  v_asset_has_heavy BOOLEAN := FALSE;
  v_asset_has_light BOOLEAN := FALSE;
  v_kit_has_lost BOOLEAN := FALSE;
  v_kit_has_heavy BOOLEAN := FALSE;
  v_kit_has_light BOOLEAN := FALSE;
BEGIN
  IF NEW.asset_id IS NOT NULL THEN
    IF NEW.status = 'Selesai Diperbaiki' THEN
      SELECT
        EXISTS(
          SELECT 1 FROM public.maintenance_logs
          WHERE asset_id = NEW.asset_id
            AND id <> NEW.id
            AND status <> 'Selesai Diperbaiki'
            AND damage_severity = 'Hilang'
        ),
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
      INTO v_asset_has_lost, v_asset_has_heavy, v_asset_has_light;

      UPDATE public.assets
      SET
        condition = CASE
          WHEN v_asset_has_lost THEN 'Hilang'
          WHEN v_asset_has_heavy THEN 'Rusak Berat'
          WHEN v_asset_has_light THEN 'Rusak Ringan'
          WHEN condition IN ('Rusak Ringan', 'Rusak Berat', 'Hilang') THEN 'Baik'
          ELSE condition
        END,
        updated_at = NOW()
      WHERE id = NEW.asset_id;
    ELSIF NEW.damage_severity = 'Hilang' THEN
      UPDATE public.assets
      SET condition = 'Hilang', updated_at = NOW()
      WHERE id = NEW.asset_id;
    ELSIF NEW.damage_severity = 'Rusak Berat' THEN
      UPDATE public.assets
      SET condition = 'Rusak Berat', updated_at = NOW()
      WHERE id = NEW.asset_id AND condition <> 'Hilang';
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
            AND damage_severity = 'Hilang'
        ),
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
      INTO v_kit_has_lost, v_kit_has_heavy, v_kit_has_light;

      UPDATE public.office_kit_items
      SET
        condition = CASE
          WHEN v_kit_has_lost THEN 'Hilang'
          WHEN v_kit_has_heavy THEN 'Rusak Berat'
          WHEN v_kit_has_light THEN 'Rusak Ringan'
          WHEN condition IN ('Rusak Ringan', 'Rusak Berat', 'Hilang') THEN 'Baik'
          ELSE condition
        END,
        status = CASE
          WHEN (v_kit_has_lost OR v_kit_has_heavy OR v_kit_has_light) AND status = 'Tersedia' THEN 'Perbaikan'
          WHEN NOT v_kit_has_lost AND NOT v_kit_has_heavy AND NOT v_kit_has_light AND status = 'Perbaikan' THEN 'Tersedia'
          ELSE status
        END,
        updated_at = NOW()
      WHERE id = NEW.office_kit_item_id;
    ELSIF NEW.damage_severity = 'Hilang' THEN
      UPDATE public.office_kit_items
      SET
        condition = 'Hilang',
        status = CASE WHEN status = 'Tersedia' THEN 'Perbaikan' ELSE status END,
        updated_at = NOW()
      WHERE id = NEW.office_kit_item_id;
    ELSIF NEW.damage_severity = 'Rusak Berat' THEN
      UPDATE public.office_kit_items
      SET
        condition = CASE WHEN condition <> 'Hilang' THEN 'Rusak Berat' ELSE condition END,
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
