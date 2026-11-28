"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { generateUuid } from "@/lib/supabase/client";
import { useSarpras } from "@/lib/supabase/sarpras-context";
import { useTodayWibIso } from "@/lib/sarpras/sirkulasi-utils";
import { WeatherSnapshot } from "@/lib/workspace/holidays";
import {
  WorkspaceEventCategory,
  WorkspaceEventColorTag,
  WorkspaceJournalEntry,
  WorkspaceJournalMood,
  WorkspaceNoteColor,
  WorkspacePersonalEvent,
  WorkspacePomodoroMode,
  WorkspacePomodoroSession,
  WorkspacePreferences,
  WorkspaceStickyNote,
  WorkspaceTodo,
} from "@/types/sarpras";

const LOCAL_STORAGE_PREFIX = "stafcenter_workspace_v1:";

export const JOURNAL_PROMPTS = [
  "Apa satu pelajaran dari hari ini?",
  "Hal kecil apa yang berjalan lancar di loket atau meja kerja hari ini?",
  "Pekerjaan apa yang paling melegakan setelah selesai hari ini?",
  "Apa satu hal yang ingin diperbaiki untuk esok hari?",
  "Momen apa yang patut disyukuri hari ini?",
];

export function getPromptForDate(dateIso: string): string {
  const num = Number(dateIso.replace(/-/g, "")) || 0;
  return JOURNAL_PROMPTS[num % JOURNAL_PROMPTS.length];
}

function buildDefaultPreferences(staffId: string): WorkspacePreferences {
  return {
    staff_id: staffId,
    weather_city: process.env.NEXT_PUBLIC_CAMPUS_CITY || "Jakarta",
    weather_lat: -6.2088,
    weather_lon: 106.8456,
    room_theme: "auto",
    reduce_motion: false,
    pet_enabled: true,
    pet_name: "Oyen",
    sound_enabled: true,
    pomodoro_focus_min: 25,
    pomodoro_short_min: 5,
    pomodoro_long_min: 15,
    widget_layout: {},
  };
}

function buildSeedWorkspaceState(
  staffId: string,
  todayIso: string
): LocalWorkspaceSnapshot {
  return {
    preferences: buildDefaultPreferences(staffId),
    todos: [
      {
        id: generateUuid(),
        staff_id: staffId,
        title: "Cek alat kelas yang masih dipinjam sesi pagi",
        is_done: false,
        done_at: null,
        todo_date: todayIso,
        linked_source: "manual",
        linked_ref_id: null,
        sort_order: 1,
        created_at: new Date().toISOString(),
      },
      {
        id: generateUuid(),
        staff_id: staffId,
        title: "Verifikasi berkas pendaftaran seminar & sidang",
        is_done: false,
        done_at: null,
        todo_date: todayIso,
        linked_source: "manual",
        linked_ref_id: null,
        sort_order: 2,
        created_at: new Date().toISOString(),
      },
    ],
    notes: [
      {
        id: generateUuid(),
        staff_id: staffId,
        title: "CATATAN",
        content:
          "- Cek kabel HDMI cadangan\n- Siapkan jadwal ruang sidang\n- Jangan lupa istirahat sebentar",
        color_variant: "yellow",
        pos_x: 24,
        pos_y: 24,
        is_pinned: true,
        created_at: new Date().toISOString(),
      },
    ],
    journals: [],
    events: [],
    pomodoroSessions: [],
  };
}

interface LocalWorkspaceSnapshot {
  preferences: WorkspacePreferences;
  todos: WorkspaceTodo[];
  notes: WorkspaceStickyNote[];
  journals: WorkspaceJournalEntry[];
  events: WorkspacePersonalEvent[];
  pomodoroSessions: WorkspacePomodoroSession[];
}

export function useWorkspace() {
  const { authUser, isLiveSupabase, notify } = useSarpras();
  const todayIso = useTodayWibIso();
  const staffKey = authUser?.id || "local-staff";
  const storageKey = `${LOCAL_STORAGE_PREFIX}${staffKey}`;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [migrationMissing, setMigrationMissing] = useState(false);

  const [preferences, setPreferences] = useState<WorkspacePreferences>(() =>
    buildDefaultPreferences(staffKey)
  );
  const [todos, setTodos] = useState<WorkspaceTodo[]>([]);
  const [notes, setNotes] = useState<WorkspaceStickyNote[]>([]);
  const [journals, setJournals] = useState<WorkspaceJournalEntry[]>([]);
  const [events, setEvents] = useState<WorkspacePersonalEvent[]>([]);
  const [pomodoroSessions, setPomodoroSessions] = useState<
    WorkspacePomodoroSession[]
  >([]);
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  const useServerStorage = isLiveSupabase && !migrationMissing && Boolean(authUser);

  const persistLocal = useCallback(
    (next: LocalWorkspaceSnapshot) => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Abaikan bila quota localStorage penuh
      }
    },
    [storageKey]
  );

  const snapshotCurrent = useCallback(
    (overrides?: Partial<LocalWorkspaceSnapshot>): LocalWorkspaceSnapshot => ({
      preferences: overrides?.preferences ?? preferences,
      todos: overrides?.todos ?? todos,
      notes: overrides?.notes ?? notes,
      journals: overrides?.journals ?? journals,
      events: overrides?.events ?? events,
      pomodoroSessions: overrides?.pomodoroSessions ?? pomodoroSessions,
    }),
    [preferences, todos, notes, journals, events, pomodoroSessions]
  );

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    const loadFromLocalStorage = () => {
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<LocalWorkspaceSnapshot>;
          setPreferences({
            ...buildDefaultPreferences(staffKey),
            ...(parsed.preferences || {}),
            staff_id: staffKey,
          });
          setTodos(Array.isArray(parsed.todos) ? parsed.todos : []);
          setNotes(Array.isArray(parsed.notes) ? parsed.notes : []);
          setJournals(Array.isArray(parsed.journals) ? parsed.journals : []);
          setEvents(Array.isArray(parsed.events) ? parsed.events : []);
          setPomodoroSessions(
            Array.isArray(parsed.pomodoroSessions) ? parsed.pomodoroSessions : []
          );
          return;
        }
      } catch {
        // Fallback ke seed baru jika JSON lokal rusak
      }
      const seeded = buildSeedWorkspaceState(staffKey, todayIso);
      setPreferences(seeded.preferences);
      setTodos(seeded.todos);
      setNotes(seeded.notes);
      setJournals(seeded.journals);
      setEvents(seeded.events);
      setPomodoroSessions(seeded.pomodoroSessions);
      persistLocal(seeded);
    };

    if (!isLiveSupabase) {
      loadFromLocalStorage();
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/workspace/bootstrap", {
        method: "GET",
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) {
        setLoadError(json.error || "Gagal memuat data Meja Kerja staf.");
        setLoading(false);
        return;
      }

      if (json.migrationMissing) {
        setMigrationMissing(true);
        loadFromLocalStorage();
        setLoading(false);
        return;
      }

      setMigrationMissing(false);
      setPreferences({
        ...buildDefaultPreferences(staffKey),
        ...(json.preferences || {}),
        staff_id: staffKey,
      });
      setTodos(Array.isArray(json.todos) ? json.todos : []);
      setNotes(Array.isArray(json.notes) ? json.notes : []);
      setJournals(Array.isArray(json.journals) ? json.journals : []);
      setEvents(Array.isArray(json.events) ? json.events : []);
      setPomodoroSessions(
        Array.isArray(json.pomodoroSessions) ? json.pomodoroSessions : []
      );
    } catch {
      setLoadError("Koneksi terputus saat mengambil data Meja Kerja staf.");
    } finally {
      setLoading(false);
    }
  }, [isLiveSupabase, persistLocal, staffKey, storageKey, todayIso]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const fetchWeather = useCallback(
    async (lat: number, lon: number, city: string) => {
      setWeatherLoading(true);
      try {
        const params = new URLSearchParams({
          lat: String(lat),
          lon: String(lon),
          city,
        });
        const res = await fetch(`/api/workspace/weather?${params.toString()}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const snap = (await res.json()) as WeatherSnapshot;
          setWeather(snap);
        }
      } catch {
        // Biarkan snapshot cuaca sebelumnya bila offline sementara
      } finally {
        setWeatherLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (loading) return;
    void fetchWeather(
      preferences.weather_lat,
      preferences.weather_lon,
      preferences.weather_city
    );
    const interval = setInterval(() => {
      void fetchWeather(
        preferences.weather_lat,
        preferences.weather_lon,
        preferences.weather_city
      );
    }, 20 * 60 * 1000);
    return () => clearInterval(interval);
  }, [
    fetchWeather,
    loading,
    preferences.weather_city,
    preferences.weather_lat,
    preferences.weather_lon,
  ]);

  const mutateServer = useCallback(
    async (payload: Record<string, unknown>): Promise<boolean> => {
      if (!useServerStorage) return true;
      try {
        const res = await fetch("/api/workspace/mutate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          notify(
            "error",
            "Gagal Menyimpan Meja Kerja",
            err.error || "Perubahan gagal dikirim ke server."
          );
          return false;
        }
        return true;
      } catch {
        notify(
          "error",
          "Koneksi Terputus",
          "Gagal menyinkronkan perubahan Meja Kerja."
        );
        return false;
      }
    },
    [notify, useServerStorage]
  );

  const updatePreferences = useCallback(
    async (patch: Partial<WorkspacePreferences>) => {
      const nextPref: WorkspacePreferences = {
        ...preferences,
        ...patch,
        staff_id: staffKey,
        updated_at: new Date().toISOString(),
      };
      setPreferences(nextPref);
      if (!useServerStorage) {
        persistLocal(snapshotCurrent({ preferences: nextPref }));
        return;
      }
      await mutateServer({ action: "upsert_preferences", data: nextPref });
    },
    [mutateServer, persistLocal, preferences, snapshotCurrent, staffKey, useServerStorage]
  );

  const addTodo = useCallback(
    async (
      title: string,
      options?: { linkedSource?: string; linkedRefId?: string; todoDate?: string }
    ) => {
      const clean = title.trim();
      if (!clean) return;
      const newTodo: WorkspaceTodo = {
        id: generateUuid(),
        staff_id: staffKey,
        title: clean.slice(0, 240),
        is_done: false,
        done_at: null,
        todo_date: options?.todoDate || todayIso,
        linked_source: options?.linkedSource || "manual",
        linked_ref_id: options?.linkedRefId || null,
        sort_order: todos.length + 1,
        created_at: new Date().toISOString(),
      };
      const nextTodos = [...todos, newTodo];
      setTodos(nextTodos);
      if (!useServerStorage) {
        persistLocal(snapshotCurrent({ todos: nextTodos }));
        return;
      }
      await mutateServer({ action: "insert_todo", data: newTodo });
    },
    [mutateServer, persistLocal, snapshotCurrent, staffKey, todayIso, todos, useServerStorage]
  );

  const toggleTodo = useCallback(
    async (id: string) => {
      const target = todos.find((t) => t.id === id);
      if (!target) return;
      const nextDone = !target.is_done;
      const doneAt = nextDone ? new Date().toISOString() : null;
      const nextTodos = todos.map((t) =>
        t.id === id ? { ...t, is_done: nextDone, done_at: doneAt } : t
      );
      setTodos(nextTodos);
      if (!useServerStorage) {
        persistLocal(snapshotCurrent({ todos: nextTodos }));
        return;
      }
      await mutateServer({
        action: "toggle_todo",
        id,
        is_done: nextDone,
        done_at: doneAt,
      });
    },
    [mutateServer, persistLocal, snapshotCurrent, todos, useServerStorage]
  );

  const deleteTodo = useCallback(
    async (id: string) => {
      const nextTodos = todos.filter((t) => t.id !== id);
      setTodos(nextTodos);
      if (!useServerStorage) {
        persistLocal(snapshotCurrent({ todos: nextTodos }));
        return;
      }
      await mutateServer({ action: "delete_todo", id });
    },
    [mutateServer, persistLocal, snapshotCurrent, todos, useServerStorage]
  );

  const clearDoneTodos = useCallback(
    async (todoDate?: string) => {
      const nextTodos = todos.filter((t) =>
        todoDate ? !(t.is_done && t.todo_date === todoDate) : !t.is_done
      );
      setTodos(nextTodos);
      if (!useServerStorage) {
        persistLocal(snapshotCurrent({ todos: nextTodos }));
        return;
      }
      await mutateServer({ action: "clear_done_todos", todo_date: todoDate });
    },
    [mutateServer, persistLocal, snapshotCurrent, todos, useServerStorage]
  );

  const addStickyNote = useCallback(
    async (
      content = "",
      color: WorkspaceNoteColor = "yellow",
      title = "CATATAN"
    ) => {
      const offset = (notes.length % 5) * 26;
      const newNote: WorkspaceStickyNote = {
        id: generateUuid(),
        staff_id: staffKey,
        title,
        content,
        color_variant: color,
        pos_x: 32 + offset,
        pos_y: 32 + offset,
        is_pinned: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const nextNotes = [...notes, newNote];
      setNotes(nextNotes);
      if (!useServerStorage) {
        persistLocal(snapshotCurrent({ notes: nextNotes }));
        return;
      }
      await mutateServer({ action: "insert_note", data: newNote });
    },
    [mutateServer, notes, persistLocal, snapshotCurrent, staffKey, useServerStorage]
  );

  const updateStickyNote = useCallback(
    async (id: string, patch: Partial<WorkspaceStickyNote>) => {
      const nextNotes = notes.map((n) =>
        n.id === id
          ? { ...n, ...patch, updated_at: new Date().toISOString() }
          : n
      );
      setNotes(nextNotes);
      if (!useServerStorage) {
        persistLocal(snapshotCurrent({ notes: nextNotes }));
        return;
      }
      await mutateServer({ action: "update_note", id, data: patch });
    },
    [mutateServer, notes, persistLocal, snapshotCurrent, useServerStorage]
  );

  const deleteStickyNote = useCallback(
    async (id: string) => {
      const nextNotes = notes.filter((n) => n.id !== id);
      setNotes(nextNotes);
      if (!useServerStorage) {
        persistLocal(snapshotCurrent({ notes: nextNotes }));
        return;
      }
      await mutateServer({ action: "delete_note", id });
    },
    [mutateServer, notes, persistLocal, snapshotCurrent, useServerStorage]
  );

  const saveJournalEntry = useCallback(
    async (payload: {
      entry_date: string;
      mood: WorkspaceJournalMood;
      prompt_question: string;
      prompt_answer: string;
      content: string;
    }) => {
      const existing = journals.find((j) => j.entry_date === payload.entry_date);
      const nextEntry: WorkspaceJournalEntry = {
        id: existing?.id || generateUuid(),
        staff_id: staffKey,
        entry_date: payload.entry_date,
        mood: payload.mood,
        prompt_question: payload.prompt_question,
        prompt_answer: payload.prompt_answer,
        content: payload.content,
        created_at: existing?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const nextJournals = [
        nextEntry,
        ...journals.filter((j) => j.entry_date !== payload.entry_date),
      ].sort((a, b) => b.entry_date.localeCompare(a.entry_date));
      setJournals(nextJournals);
      if (!useServerStorage) {
        persistLocal(snapshotCurrent({ journals: nextJournals }));
        return true;
      }
      return mutateServer({ action: "upsert_journal", data: payload });
    },
    [journals, mutateServer, persistLocal, snapshotCurrent, staffKey, useServerStorage]
  );

  const addPersonalEvent = useCallback(
    async (payload: {
      title: string;
      event_date: string;
      start_time: string;
      end_time?: string;
      category: WorkspaceEventCategory;
      color_tag: WorkspaceEventColorTag;
      notes?: string;
    }) => {
      const cleanTitle = payload.title.trim();
      if (!cleanTitle) return;
      const newEvent: WorkspacePersonalEvent = {
        id: generateUuid(),
        staff_id: staffKey,
        title: cleanTitle.slice(0, 180),
        event_date: payload.event_date,
        start_time: payload.start_time || "09:00",
        end_time: payload.end_time || null,
        category: payload.category,
        color_tag: payload.color_tag,
        notes: payload.notes || null,
        created_at: new Date().toISOString(),
      };
      const nextEvents = [...events, newEvent].sort((a, b) =>
        `${a.event_date} ${a.start_time}`.localeCompare(
          `${b.event_date} ${b.start_time}`
        )
      );
      setEvents(nextEvents);
      if (!useServerStorage) {
        persistLocal(snapshotCurrent({ events: nextEvents }));
        return;
      }
      await mutateServer({ action: "insert_event", data: newEvent });
    },
    [events, mutateServer, persistLocal, snapshotCurrent, staffKey, useServerStorage]
  );

  const deletePersonalEvent = useCallback(
    async (id: string) => {
      const nextEvents = events.filter((e) => e.id !== id);
      setEvents(nextEvents);
      if (!useServerStorage) {
        persistLocal(snapshotCurrent({ events: nextEvents }));
        return;
      }
      await mutateServer({ action: "delete_event", id });
    },
    [events, mutateServer, persistLocal, snapshotCurrent, useServerStorage]
  );

  const recordPomodoroSession = useCallback(
    async (
      mode: WorkspacePomodoroMode,
      durationMinutes: number,
      taskLabel?: string | null
    ) => {
      const entry: WorkspacePomodoroSession = {
        id: generateUuid(),
        staff_id: staffKey,
        session_date: todayIso,
        mode,
        duration_minutes: durationMinutes,
        task_label: taskLabel || null,
        completed_at: new Date().toISOString(),
      };
      const nextSessions = [entry, ...pomodoroSessions];
      setPomodoroSessions(nextSessions);
      if (!useServerStorage) {
        persistLocal(snapshotCurrent({ pomodoroSessions: nextSessions }));
        return;
      }
      await mutateServer({ action: "insert_pomodoro_session", data: entry });
    },
    [
      mutateServer,
      persistLocal,
      pomodoroSessions,
      snapshotCurrent,
      staffKey,
      todayIso,
      useServerStorage,
    ]
  );

  const todayFocusSessionsCount = useMemo(
    () =>
      pomodoroSessions.filter(
        (s) => s.session_date === todayIso && s.mode === "focus"
      ).length,
    [pomodoroSessions, todayIso]
  );

  const journalStreakDays = useMemo(() => {
    const filledDates = new Set(
      journals
        .filter((j) => j.content.trim().length > 0 || j.prompt_answer.trim().length > 0)
        .map((j) => j.entry_date)
    );
    if (filledDates.size === 0) return 0;

    let streak = 0;
    const cursor = new Date(`${todayIso}T00:00:00Z`);
    if (!filledDates.has(todayIso)) {
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    while (true) {
      const iso = cursor.toISOString().slice(0, 10);
      if (!filledDates.has(iso)) break;
      streak += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    return streak;
  }, [journals, todayIso]);

  return {
    loading,
    loadError,
    migrationMissing,
    reload: loadWorkspace,
    todayIso,
    staffName: authUser?.fullName || "Staf Kampus",
    preferences,
    updatePreferences,
    todos,
    addTodo,
    toggleTodo,
    deleteTodo,
    clearDoneTodos,
    notes,
    addStickyNote,
    updateStickyNote,
    deleteStickyNote,
    journals,
    saveJournalEntry,
    journalStreakDays,
    events,
    addPersonalEvent,
    deletePersonalEvent,
    pomodoroSessions,
    todayFocusSessionsCount,
    recordPomodoroSession,
    weather,
    weatherLoading,
    refreshWeather: () =>
      fetchWeather(
        preferences.weather_lat,
        preferences.weather_lon,
        preferences.weather_city
      ),
  };
}
