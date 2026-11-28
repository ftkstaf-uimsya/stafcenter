-- Migrasi 013: Meja Kerja Pixel Personal per Akun Staf (StafCenter)
-- Jalankan file ini di SQL Editor Supabase. Script bersifat idempoten.
-- Seluruh data bersifat privat per staff_id (berbeda untuk setiap akun staf yang login).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. PREFERENSI MEJA KERJA PER STAF
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.staff_workspace_preferences (
  staff_id UUID PRIMARY KEY REFERENCES public.staff_accounts(id) ON DELETE CASCADE,
  weather_city VARCHAR(80) NOT NULL DEFAULT 'Jakarta',
  weather_lat DOUBLE PRECISION NOT NULL DEFAULT -6.2088,
  weather_lon DOUBLE PRECISION NOT NULL DEFAULT 106.8456,
  room_theme VARCHAR(16) NOT NULL DEFAULT 'auto' CHECK (
    room_theme IN ('auto', 'day', 'night')
  ),
  reduce_motion BOOLEAN NOT NULL DEFAULT FALSE,
  pet_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  pet_name VARCHAR(40) NOT NULL DEFAULT 'Oyen',
  sound_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  pomodoro_focus_min INTEGER NOT NULL DEFAULT 25 CHECK (
    pomodoro_focus_min BETWEEN 1 AND 120
  ),
  pomodoro_short_min INTEGER NOT NULL DEFAULT 5 CHECK (
    pomodoro_short_min BETWEEN 1 AND 60
  ),
  pomodoro_long_min INTEGER NOT NULL DEFAULT 15 CHECK (
    pomodoro_long_min BETWEEN 1 AND 90
  ),
  widget_layout JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.staff_workspace_preferences ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. DAFTAR TUGAS HARIAN PER STAF (TO-DO LIST)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.staff_workspace_todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff_accounts(id) ON DELETE CASCADE,
  title VARCHAR(240) NOT NULL,
  is_done BOOLEAN NOT NULL DEFAULT FALSE,
  done_at TIMESTAMPTZ,
  todo_date DATE NOT NULL DEFAULT CURRENT_DATE,
  linked_source VARCHAR(40),
  linked_ref_id VARCHAR(80),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_workspace_todos_staff_date
  ON public.staff_workspace_todos (staff_id, todo_date, is_done, created_at);

ALTER TABLE public.staff_workspace_todos ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. STICKY NOTES PER STAF
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.staff_workspace_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff_accounts(id) ON DELETE CASCADE,
  title VARCHAR(80) NOT NULL DEFAULT 'CATATAN',
  content TEXT NOT NULL DEFAULT '',
  color_variant VARCHAR(16) NOT NULL DEFAULT 'yellow' CHECK (
    color_variant IN ('yellow', 'pink', 'mint', 'sky')
  ),
  pos_x INTEGER NOT NULL DEFAULT 24,
  pos_y INTEGER NOT NULL DEFAULT 24,
  is_pinned BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_workspace_notes_staff
  ON public.staff_workspace_notes (staff_id, created_at);

ALTER TABLE public.staff_workspace_notes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. JURNAL HARIAN PER STAF
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.staff_workspace_journals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff_accounts(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  mood VARCHAR(16) NOT NULL DEFAULT 'good' CHECK (
    mood IN ('great', 'good', 'neutral', 'sad', 'stressed')
  ),
  prompt_question VARCHAR(200) NOT NULL DEFAULT 'Apa satu pelajaran dari hari ini?',
  prompt_answer TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_staff_workspace_journal_day UNIQUE (staff_id, entry_date)
);

CREATE INDEX IF NOT EXISTS idx_staff_workspace_journals_staff_date
  ON public.staff_workspace_journals (staff_id, entry_date DESC);

ALTER TABLE public.staff_workspace_journals ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. AGENDA PRIBADI INTERNAL PER STAF
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.staff_workspace_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff_accounts(id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  event_date DATE NOT NULL,
  start_time VARCHAR(10) NOT NULL DEFAULT '09:00',
  end_time VARCHAR(10),
  category VARCHAR(24) NOT NULL DEFAULT 'pribadi' CHECK (
    category IN ('pribadi', 'rapat', 'kuliah', 'deadline', 'cuti')
  ),
  color_tag VARCHAR(16) NOT NULL DEFAULT 'amber' CHECK (
    color_tag IN ('amber', 'emerald', 'sky', 'rose')
  ),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_workspace_events_staff_date
  ON public.staff_workspace_events (staff_id, event_date, start_time);

ALTER TABLE public.staff_workspace_events ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. RIWAYAT SESI POMODORO HARIAN PER STAF
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.staff_pomodoro_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff_accounts(id) ON DELETE CASCADE,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  mode VARCHAR(16) NOT NULL CHECK (
    mode IN ('focus', 'short_break', 'long_break')
  ),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes >= 0),
  task_label VARCHAR(240),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_pomodoro_sessions_staff_date
  ON public.staff_pomodoro_sessions (staff_id, session_date, completed_at DESC);

ALTER TABLE public.staff_pomodoro_sessions ENABLE ROW LEVEL SECURITY;
