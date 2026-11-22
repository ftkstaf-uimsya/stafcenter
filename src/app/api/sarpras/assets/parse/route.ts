import { NextRequest, NextResponse } from "next/server";
import {
  getVerifiedServerSession,
  verifySameOriginRequest,
} from "@/lib/auth/session";
import {
  getSupabaseServerClient,
  isServerSupabaseConfigured,
} from "@/lib/supabase/server";
import {
  INITIAL_ASSET_CATEGORIES,
  INITIAL_ASSETS,
  INITIAL_FUNDING_SOURCES,
  INITIAL_ROOMS,
} from "@/lib/supabase/seed-data";
import { parseAssetImportWorkbook } from "@/lib/sarpras/asset-excel";
import {
  AssetCategoryRef,
  DEFAULT_ASSET_CATEGORY_REFS,
  ExistingAssetRef,
  FundingSourceRef,
  MAX_IMPORT_FILE_BYTES,
  RoomLookupRef,
} from "@/lib/sarpras/asset-import-shared";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const csrf = verifySameOriginRequest(request);
  if (!csrf.ok) {
    return NextResponse.json({ error: csrf.error }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Berkas Excel tidak ditemukan pada permintaan." },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json(
        { error: "Format berkas harus Excel (.xlsx) sesuai template." },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "Berkas Excel kosong." },
        { status: 400 }
      );
    }

    if (file.size > MAX_IMPORT_FILE_BYTES) {
      return NextResponse.json(
        { error: "Ukuran berkas maksimal 5 MB." },
        { status: 400 }
      );
    }

    let rooms: RoomLookupRef[] = [];
    let existingAssets: ExistingAssetRef[] = [];
    let categories: AssetCategoryRef[] = DEFAULT_ASSET_CATEGORY_REFS;
    let fundingSources: FundingSourceRef[] | undefined;

    if (isServerSupabaseConfigured()) {
      const session = await getVerifiedServerSession();
      if (!session) {
        return NextResponse.json(
          { error: "Sesi staf tidak valid. Silakan masuk kembali." },
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

      const [roomsRes, assetsRes, catRes, fundRes] = await Promise.all([
        supabase.from("rooms").select("id, code, name").order("code"),
        supabase.from("assets").select("id, inventory_code, serial_number"),
        supabase.from("asset_categories").select("code, name").order("code"),
        supabase.from("funding_sources").select("id, code, name").order("code"),
      ]);

      if (roomsRes.error || assetsRes.error) {
        return NextResponse.json(
          {
            error:
              roomsRes.error?.message ||
              assetsRes.error?.message ||
              "Gagal membaca referensi ruangan dan aset.",
          },
          { status: 500 }
        );
      }

      rooms = (roomsRes.data || []) as RoomLookupRef[];
      existingAssets = (assetsRes.data || []) as ExistingAssetRef[];
      if (!catRes.error && Array.isArray(catRes.data) && catRes.data.length > 0) {
        categories = catRes.data as AssetCategoryRef[];
      }
      if (!fundRes.error && Array.isArray(fundRes.data)) {
        fundingSources = fundRes.data as FundingSourceRef[];
      }
    } else {
      const roomsJson = formData.get("roomsJson");
      const assetsJson = formData.get("assetsJson");
      const categoriesJson = formData.get("categoriesJson");
      const fundingSourcesJson = formData.get("fundingSourcesJson");

      try {
        rooms =
          typeof roomsJson === "string"
            ? (JSON.parse(roomsJson) as RoomLookupRef[])
            : INITIAL_ROOMS.map((r) => ({ id: r.id, code: r.code, name: r.name }));
      } catch {
        rooms = INITIAL_ROOMS.map((r) => ({ id: r.id, code: r.code, name: r.name }));
      }

      try {
        existingAssets =
          typeof assetsJson === "string"
            ? (JSON.parse(assetsJson) as ExistingAssetRef[])
            : INITIAL_ASSETS.map((a) => ({
                id: a.id,
                inventory_code: a.inventory_code,
                serial_number: a.serial_number,
              }));
      } catch {
        existingAssets = INITIAL_ASSETS.map((a) => ({
          id: a.id,
          inventory_code: a.inventory_code,
          serial_number: a.serial_number,
        }));
      }

      try {
        categories =
          typeof categoriesJson === "string"
            ? (JSON.parse(categoriesJson) as AssetCategoryRef[])
            : INITIAL_ASSET_CATEGORIES.map((c) => ({ code: c.code, name: c.name }));
      } catch {
        categories = INITIAL_ASSET_CATEGORIES.map((c) => ({
          code: c.code,
          name: c.name,
        }));
      }

      try {
        fundingSources =
          typeof fundingSourcesJson === "string"
            ? (JSON.parse(fundingSourcesJson) as FundingSourceRef[])
            : INITIAL_FUNDING_SOURCES.map((f) => ({
                id: f.id,
                code: f.code,
                name: f.name,
              }));
      } catch {
        fundingSources = INITIAL_FUNDING_SOURCES.map((f) => ({
          id: f.id,
          code: f.code,
          name: f.name,
        }));
      }
    }

    const buffer = await file.arrayBuffer();
    const nodeBuf = Buffer.from(buffer);
    const hasZipSignature =
      nodeBuf.length >= 4 &&
      nodeBuf[0] === 0x50 &&
      nodeBuf[1] === 0x4b &&
      nodeBuf[2] === 0x03 &&
      nodeBuf[3] === 0x04;
    if (!hasZipSignature) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Berkas tidak valid. Pastikan Anda mengunggah dokumen Excel (.xlsx) asli.",
        },
        { status: 400 }
      );
    }

    const result = await parseAssetImportWorkbook(
      nodeBuf,
      rooms,
      existingAssets,
      categories,
      fundingSources
    );

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Terjadi gangguan saat membaca berkas Excel." },
      { status: 500 }
    );
  }
}
