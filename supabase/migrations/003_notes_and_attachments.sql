-- Migrasi 003: Catatan Aktivitas, Lampiran Dokumen, dan Bucket Storage Sarpras
-- Jalankan file ini di Supabase SQL Editor untuk mengaktifkan fitur Catatan Drawer & Upload Foto/PDF.

CREATE TABLE IF NOT EXISTS public.sarpras_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(30) NOT NULL CHECK (
    entity_type IN ('booking', 'maintenance', 'asset', 'room', 'consumable')
  ),
  entity_id UUID NOT NULL,
  author_id UUID,
  author_name VARCHAR(120) NOT NULL,
  note_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sarpras_notes_entity
  ON public.sarpras_notes (entity_type, entity_id, created_at DESC);

ALTER TABLE public.sarpras_notes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.sarpras_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(30) NOT NULL CHECK (
    entity_type IN ('booking', 'maintenance', 'asset', 'room', 'consumable')
  ),
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

ALTER TABLE public.sarpras_attachments ENABLE ROW LEVEL SECURITY;

-- Bucket Supabase Storage untuk Foto Kerusakan & Dokumen BAST/PDF
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
