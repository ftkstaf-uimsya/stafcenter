-- Migrasi 011: Modul Tugas Akhir (Skripsi & Artikel Jurnal - Proposal & Sidang)
-- Jalankan file ini di SQL Editor Supabase. Script bersifat idempoten.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. TABEL ALUR KERJA TUGAS AKHIR (thesis_workflows)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.thesis_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_code VARCHAR(40) NOT NULL UNIQUE,
  track VARCHAR(24) NOT NULL CHECK (
    track IN ('skripsi', 'artikel_jurnal')
  ),
  stage VARCHAR(16) NOT NULL CHECK (
    stage IN ('proposal', 'sidang')
  ),
  board_column VARCHAR(24) NOT NULL DEFAULT 'berkas_daftar' CHECK (
    board_column IN ('berkas_daftar', 'bikin_jadwal', 'bikin_surat', 'selesai_arsip')
  ),
  student_name VARCHAR(150) NOT NULL,
  student_nim VARCHAR(30) NOT NULL,
  student_phone VARCHAR(40) NOT NULL DEFAULT '-',
  prodi VARCHAR(16) NOT NULL CHECK (
    prodi IN ('MPI', 'PBA', 'TBIG', 'TBIN', 'TMTK', 'TIPA', 'PAI')
  ),
  class_id UUID REFERENCES public.academic_classes(id) ON DELETE SET NULL,
  class_code VARCHAR(20),
  title TEXT NOT NULL,
  journal_name VARCHAR(200),
  journal_url TEXT,
  supervisor_1_id UUID REFERENCES public.lecturers(id) ON DELETE SET NULL,
  supervisor_2_id UUID REFERENCES public.lecturers(id) ON DELETE SET NULL,
  examiner_1_id UUID REFERENCES public.lecturers(id) ON DELETE SET NULL,
  examiner_2_id UUID REFERENCES public.lecturers(id) ON DELETE SET NULL,
  registered_at DATE NOT NULL DEFAULT CURRENT_DATE,
  document_notes TEXT,
  schedule_date DATE,
  schedule_start_time VARCHAR(10),
  schedule_end_time VARCHAR(10),
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  letter_number VARCHAR(80),
  letter_date DATE,
  letter_signer_official_id UUID REFERENCES public.campus_officials(id) ON DELETE SET NULL,
  letter_status VARCHAR(20) NOT NULL DEFAULT 'Belum Dibuat' CHECK (
    letter_status IN ('Belum Dibuat', 'Draft', 'Siap TTD', 'Terbit')
  ),
  archived_at TIMESTAMPTZ,
  archive_notes TEXT,
  source_workflow_id UUID REFERENCES public.thesis_workflows(id) ON DELETE SET NULL,
  created_by_staff VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_thesis_workflows_board
  ON public.thesis_workflows (track, stage, board_column, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_thesis_workflows_prodi
  ON public.thesis_workflows (prodi);

CREATE INDEX IF NOT EXISTS idx_thesis_workflows_schedule_date
  ON public.thesis_workflows (schedule_date);

CREATE INDEX IF NOT EXISTS idx_thesis_workflows_room
  ON public.thesis_workflows (room_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_thesis_source
  ON public.thesis_workflows (source_workflow_id)
  WHERE source_workflow_id IS NOT NULL;

ALTER TABLE public.thesis_workflows ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. PERLUAS ENTITY_TYPE PADA CATATAN & LAMPIRAN SARPRAS
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
      EXECUTE format('ALTER TABLE public.sarpras_attachments DROP CONSTRAINT %I', v_con.conname);
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
