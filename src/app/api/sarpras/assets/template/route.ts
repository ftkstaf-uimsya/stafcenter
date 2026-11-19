import { NextRequest, NextResponse } from "next/server";
import { getVerifiedServerSession } from "@/lib/auth/session";
import {
  getSupabaseServerClient,
  isServerSupabaseConfigured,
} from "@/lib/supabase/server";
import {
  INITIAL_ASSET_CATEGORIES,
  INITIAL_FUNDING_SOURCES,
  INITIAL_ROOMS,
} from "@/lib/supabase/seed-data";
import { buildAssetImportTemplateBuffer } from "@/lib/sarpras/asset-excel";
import {
  AssetCategoryRef,
  DEFAULT_ASSET_CATEGORY_REFS,
  FundingSourceRef,
  RoomLookupRef,
} from "@/lib/sarpras/asset-import-shared";

export const dynamic = "force-dynamic";

const TEMPLATE_FILENAME = "Template_Import_Inventaris_StafCenter.xlsx";

async function resolveReferencesForTemplate(clientData?: {
  rooms?: RoomLookupRef[];
  categories?: AssetCategoryRef[];
  fundingSources?: FundingSourceRef[];
}): Promise<{
  rooms?: RoomLookupRef[];
  categories?: AssetCategoryRef[];
  fundingSources?: FundingSourceRef[];
  errorResponse?: NextResponse;
}> {
  if (!isServerSupabaseConfigured()) {
    const rooms =
      Array.isArray(clientData?.rooms) && clientData.rooms.length > 0
        ? clientData.rooms
        : INITIAL_ROOMS.map((r) => ({ id: r.id, code: r.code, name: r.name }));
    const categories =
      Array.isArray(clientData?.categories) && clientData.categories.length > 0
        ? clientData.categories
        : INITIAL_ASSET_CATEGORIES.filter((c) => c.is_active).map((c) => ({
            code: c.code,
            name: c.name,
          }));
    const fundingSources =
      Array.isArray(clientData?.fundingSources) &&
      clientData.fundingSources.length > 0
        ? clientData.fundingSources
        : INITIAL_FUNDING_SOURCES.filter((f) => f.is_active).map((f) => ({
            id: f.id,
            code: f.code,
            name: f.name,
          }));
    return { rooms, categories, fundingSources };
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

  const [roomsRes, catRes, fundRes] = await Promise.all([
    supabase.from("rooms").select("id, code, name").order("code"),
    supabase
      .from("asset_categories")
      .select("code, name")
      .eq("is_active", true)
      .order("code"),
    supabase
      .from("funding_sources")
      .select("id, code, name")
      .eq("is_active", true)
      .order("code"),
  ]);

  if (roomsRes.error) {
    return {
      errorResponse: NextResponse.json(
        { error: roomsRes.error.message },
        { status: 500 }
      ),
    };
  }

  const categories = catRes.error
    ? DEFAULT_ASSET_CATEGORY_REFS
    : ((catRes.data || []) as AssetCategoryRef[]);
  const fundingSources = fundRes.error
    ? INITIAL_FUNDING_SOURCES.map((f) => ({
        id: f.id,
        code: f.code,
        name: f.name,
      }))
    : ((fundRes.data || []) as FundingSourceRef[]);

  return {
    rooms: (roomsRes.data || []) as RoomLookupRef[],
    categories,
    fundingSources,
  };
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
  const res = await resolveReferencesForTemplate();
  if (res.errorResponse) return res.errorResponse;
  const buffer = await buildAssetImportTemplateBuffer(
    res.rooms || [],
    res.categories || DEFAULT_ASSET_CATEGORY_REFS,
    res.fundingSources || []
  );
  return createTemplateResponse(buffer);
}

export async function POST(request: NextRequest) {
  let clientData:
    | {
        rooms?: RoomLookupRef[];
        categories?: AssetCategoryRef[];
        fundingSources?: FundingSourceRef[];
      }
    | undefined;
  if (!isServerSupabaseConfigured()) {
    try {
      clientData = (await request.json()) as {
        rooms?: RoomLookupRef[];
        categories?: AssetCategoryRef[];
        fundingSources?: FundingSourceRef[];
      };
    } catch {
      clientData = undefined;
    }
  }

  const res = await resolveReferencesForTemplate(clientData);
  if (res.errorResponse) return res.errorResponse;
  const buffer = await buildAssetImportTemplateBuffer(
    res.rooms || [],
    res.categories || DEFAULT_ASSET_CATEGORY_REFS,
    res.fundingSources || []
  );
  return createTemplateResponse(buffer);
}
