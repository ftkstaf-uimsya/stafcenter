-- ==============================================================================
-- Migration 012: Ensure sarpras_notes, sarpras_attachments, storage bucket,
-- and complete entity_type CHECK constraints (including office_kit & office_loan)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.sarpras_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(30) NOT NULL,
  entity_id UUID NOT NULL,
  author_id UUID,
  author_name VARCHAR(120) NOT NULL,
  note_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sarpras_notes_entity
  ON public.sarpras_notes (entity_type, entity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.sarpras_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(30) NOT NULL,
  entity_id UUID NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  file_size_bytes INTEGER NOT NULL DEFAULT 0,
  uploaded_by VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sarpras_attachments_entity
  ON public.sarpras_attachments (entity_type, entity_id, created_at DESC);

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
      EXECUTE format('ALTER TABLE public.sarpras_notes DROP CONSTRAINT IF EXISTS %I', v_con.conname);
    END LOOP;

    ALTER TABLE public.sarpras_notes
      ADD CONSTRAINT chk_sarpras_notes_entity_type
      CHECK (
        entity_type IN (
          'booking',
          'maintenance',
          'asset',
          'room',
          'consumable',
          'lecturer',
          'course',
          'official',
          'unit',
          'vendor',
          'class',
          'office_kit',
          'office_loan',
          'ta_skripsi_proposal',
          'ta_skripsi_sidang',
          'ta_artikel_proposal',
          'ta_artikel_sidang'
        )
      );
  END IF;

  IF to_regclass('public.sarpras_attachments') IS NOT NULL THEN
    FOR v_con IN
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public.sarpras_attachments'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%entity_type%'
    LOOP
      EXECUTE format('ALTER TABLE public.sarpras_attachments DROP CONSTRAINT IF EXISTS %I', v_con.conname);
    END LOOP;

    ALTER TABLE public.sarpras_attachments
      ADD CONSTRAINT chk_sarpras_attachments_entity_type
      CHECK (
        entity_type IN (
          'booking',
          'maintenance',
          'asset',
          'room',
          'consumable',
          'lecturer',
          'course',
          'official',
          'unit',
          'vendor',
          'class',
          'office_kit',
          'office_loan',
          'ta_skripsi_proposal',
          'ta_skripsi_sidang',
          'ta_artikel_proposal',
          'ta_artikel_sidang'
        )
      );
  END IF;
END $$;

ALTER TABLE public.sarpras_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sarpras_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Manage sarpras_notes for authenticated staff" ON public.sarpras_notes;
CREATE POLICY "Manage sarpras_notes for authenticated staff"
  ON public.sarpras_notes
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Manage sarpras_attachments for authenticated staff" ON public.sarpras_attachments;
CREATE POLICY "Manage sarpras_attachments for authenticated staff"
  ON public.sarpras_attachments
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public)
VALUES ('sarpras-files', 'sarpras-files', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public read sarpras-files'
  ) THEN
    CREATE POLICY "Public read sarpras-files"
      ON storage.objects
      FOR SELECT
      USING (bucket_id = 'sarpras-files');
  END IF;
END $$;
