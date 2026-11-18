import { NextRequest, NextResponse } from "next/server";
import { getVerifiedServerSession } from "@/lib/auth/session";
import {
  getSupabaseServerClient,
  isServerSupabaseConfigured,
} from "@/lib/supabase/server";
import { INITIAL_ROOMS } from "@/lib/supabase/seed-data";
import { buildAssetImportTemplateBuffer } from "@/lib/sarpras/asset-excel";
import { RoomLookupRef } from "@/lib/sarpras/asset-import-shared";

export const dynamic = "force-dynamic";

const TEMPLATE_FILENAME = "Template_Import_Inventaris_StafCenter.xlsx";

async function resolveRoomsForTemplate(
  clientRooms?: RoomLookupRef[]
): Promise<{ rooms?: RoomLookupRef[]; errorResponse?: NextResponse }> {
  if (!isServerSupabaseConfigured()) {
    const fallback =
      Array.isArray(clientRooms) && clientRooms.length > 0
        ? clientRooms
        : INITIAL_ROOMS.map((r) => ({ id: r.id, code: r.code, name: r.name }));
    return { rooms: fallback };
  }

  const session = await getVerifiedServerSession();
  if (!session) {
    return {
      errorResponse: NextResponse.json(
        { error: "Sesi staf tidak valid. Silakan masuk kembali." },
        { status: 401 }
      ),
    };
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      errorResponse: NextResponse.json(
        { error: "Konfigurasi server Supabase belum lengkap." },
        { status: 503 }
      ),
    };
  }

  const { data, error } = await supabase
    .from("rooms")
    .select("id, code, name")
    .order("code");

  if (error) {
    return {
      errorResponse: NextResponse.json({ error: error.message }, { status: 500 }),
    };
  }

  return { rooms: (data || []) as RoomLookupRef[] };
}

function createTemplateResponse(buffer: Buffer): NextResponse {
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${TEMPLATE_FILENAME}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET() {
  const res = await resolveRoomsForTemplate();
  if (res.errorResponse) return res.errorResponse;
  const buffer = await buildAssetImportTemplateBuffer(res.rooms || []);
  return createTemplateResponse(buffer);
}

export async function POST(request: NextRequest) {
  let clientRooms: RoomLookupRef[] | undefined;
  if (!isServerSupabaseConfigured()) {
    try {
      const body = (await request.json()) as { rooms?: RoomLookupRef[] };
      clientRooms = body.rooms;
    } catch {
      clientRooms = undefined;
    }
  }

  const res = await resolveRoomsForTemplate(clientRooms);
  if (res.errorResponse) return res.errorResponse;
  const buffer = await buildAssetImportTemplateBuffer(res.rooms || []);
  return createTemplateResponse(buffer);
}
