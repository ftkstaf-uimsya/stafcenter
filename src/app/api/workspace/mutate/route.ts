import { NextRequest, NextResponse } from "next/server";
import {
  getVerifiedServerSession,
  verifySameOriginRequest,
} from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type WorkspaceMutationBody =
  | {
      action: "upsert_preferences";
      data: Record<string, unknown>;
    }
  | {
      action: "insert_todo";
      data: Record<string, unknown>;
    }
  | {
      action: "toggle_todo";
      id: string;
      is_done: boolean;
      done_at: string | null;
    }
  | {
      action: "delete_todo";
      id: string;
    }
  | {
      action: "clear_done_todos";
      todo_date?: string;
    }
  | {
      action: "insert_note";
      data: Record<string, unknown>;
    }
  | {
      action: "update_note";
      id: string;
      data: Record<string, unknown>;
    }
  | {
      action: "delete_note";
      id: string;
    }
  | {
      action: "upsert_journal";
      data: Record<string, unknown>;
    }
  | {
      action: "insert_event";
      data: Record<string, unknown>;
    }
  | {
      action: "delete_event";
      id: string;
    }
  | {
      action: "insert_pomodoro_session";
      data: Record<string, unknown>;
    };

function pickColumns(
  source: Record<string, unknown> | undefined,
  allowed: readonly string[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!source || typeof source !== "object") return out;
  for (const key of allowed) {
    if (key in source && source[key] !== undefined) {
      out[key] = source[key];
    }
  }
  return out;
}

export async function POST(request: NextRequest) {
  const csrf = verifySameOriginRequest(request);
  if (!csrf.ok) {
    return NextResponse.json({ error: csrf.error }, { status: 403 });
  }

  const session = await getVerifiedServerSession();
  if (!session) {
    return NextResponse.json(
      { error: "Sesi staf tidak valid atau telah berakhir." },
      { status: 401 }
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Konfigurasi server Supabase belum lengkap." },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json()) as WorkspaceMutationBody;

    switch (body.action) {
      case "upsert_preferences": {
        const clean = pickColumns(body.data, [
          "weather_city",
          "weather_lat",
          "weather_lon",
          "room_theme",
          "reduce_motion",
          "pet_enabled",
          "pet_name",
          "sound_enabled",
          "pomodoro_focus_min",
          "pomodoro_short_min",
          "pomodoro_long_min",
          "widget_layout",
        ]);
        const { error } = await supabase
          .from("staff_workspace_preferences")
          .upsert(
            {
              ...clean,
              staff_id: session.id,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "staff_id" }
          );
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ ok: true });
      }

      case "insert_todo": {
        const clean = pickColumns(body.data, [
          "id",
          "title",
          "is_done",
          "done_at",
          "todo_date",
          "linked_source",
          "linked_ref_id",
          "sort_order",
        ]);
        const title = String(clean.title || "").trim();
        if (!title) {
          return NextResponse.json(
            { error: "Judul tugas wajib diisi." },
            { status: 400 }
          );
        }
        const { data, error } = await supabase
          .from("staff_workspace_todos")
          .insert({
            ...clean,
            title: title.slice(0, 240),
            staff_id: session.id,
          })
          .select("*")
          .single();
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ ok: true, row: data });
      }

      case "toggle_todo": {
        const { error } = await supabase
          .from("staff_workspace_todos")
          .update({
            is_done: Boolean(body.is_done),
            done_at: body.is_done ? body.done_at || new Date().toISOString() : null,
          })
          .eq("id", body.id)
          .eq("staff_id", session.id);
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ ok: true });
      }

      case "delete_todo": {
        const { error } = await supabase
          .from("staff_workspace_todos")
          .delete()
          .eq("id", body.id)
          .eq("staff_id", session.id);
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ ok: true });
      }

      case "clear_done_todos": {
        let query = supabase
          .from("staff_workspace_todos")
          .delete()
          .eq("staff_id", session.id)
          .eq("is_done", true);
        if (body.todo_date) {
          query = query.eq("todo_date", body.todo_date);
        }
        const { error } = await query;
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ ok: true });
      }

      case "insert_note": {
        const clean = pickColumns(body.data, [
          "id",
          "title",
          "content",
          "color_variant",
          "pos_x",
          "pos_y",
          "is_pinned",
        ]);
        const { data, error } = await supabase
          .from("staff_workspace_notes")
          .insert({
            ...clean,
            staff_id: session.id,
          })
          .select("*")
          .single();
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ ok: true, row: data });
      }

      case "update_note": {
        const clean = pickColumns(body.data, [
          "title",
          "content",
          "color_variant",
          "pos_x",
          "pos_y",
          "is_pinned",
        ]);
        const { error } = await supabase
          .from("staff_workspace_notes")
          .update({
            ...clean,
            updated_at: new Date().toISOString(),
          })
          .eq("id", body.id)
          .eq("staff_id", session.id);
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ ok: true });
      }

      case "delete_note": {
        const { error } = await supabase
          .from("staff_workspace_notes")
          .delete()
          .eq("id", body.id)
          .eq("staff_id", session.id);
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ ok: true });
      }

      case "upsert_journal": {
        const clean = pickColumns(body.data, [
          "entry_date",
          "mood",
          "prompt_question",
          "prompt_answer",
          "content",
        ]);
        const entryDate = String(clean.entry_date || "").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
          return NextResponse.json(
            { error: "Tanggal jurnal tidak valid." },
            { status: 400 }
          );
        }
        const { data, error } = await supabase
          .from("staff_workspace_journals")
          .upsert(
            {
              ...clean,
              entry_date: entryDate,
              staff_id: session.id,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "staff_id,entry_date" }
          )
          .select("*")
          .single();
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ ok: true, row: data });
      }

      case "insert_event": {
        const clean = pickColumns(body.data, [
          "id",
          "title",
          "event_date",
          "start_time",
          "end_time",
          "category",
          "color_tag",
          "notes",
        ]);
        const title = String(clean.title || "").trim();
        if (!title) {
          return NextResponse.json(
            { error: "Judul agenda wajib diisi." },
            { status: 400 }
          );
        }
        const { data, error } = await supabase
          .from("staff_workspace_events")
          .insert({
            ...clean,
            title: title.slice(0, 180),
            staff_id: session.id,
          })
          .select("*")
          .single();
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ ok: true, row: data });
      }

      case "delete_event": {
        const { error } = await supabase
          .from("staff_workspace_events")
          .delete()
          .eq("id", body.id)
          .eq("staff_id", session.id);
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ ok: true });
      }

      case "insert_pomodoro_session": {
        const clean = pickColumns(body.data, [
          "id",
          "session_date",
          "mode",
          "duration_minutes",
          "task_label",
          "completed_at",
        ]);
        const { data, error } = await supabase
          .from("staff_pomodoro_sessions")
          .insert({
            ...clean,
            staff_id: session.id,
          })
          .select("*")
          .single();
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ ok: true, row: data });
      }

      default:
        return NextResponse.json(
          { error: "Aksi meja kerja tidak dikenal." },
          { status: 400 }
        );
    }
  } catch {
    return NextResponse.json(
      { error: "Format payload meja kerja tidak valid." },
      { status: 400 }
    );
  }
}
