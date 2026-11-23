import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import {
  getVerifiedServerSession,
  verifySameOriginRequest,
} from "@/lib/auth/session";
import { canAccessPage, ENTITY_TYPE_TO_PAGE_KEY } from "@/lib/auth/permissions";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { SarprasEntityType } from "@/types/sarpras";

const BUCKET_NAME = "sarpras-files";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf"]);
const ENTITY_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

function matchesFileSignature(buf: Buffer, mimeType: string): boolean {
  if (mimeType === "image/jpeg") {
    return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return (
      buf.length >= 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a
    );
  }
  if (mimeType === "image/webp") {
    return (
      buf.length >= 12 &&
      buf.subarray(0, 4).toString("ascii") === "RIFF" &&
      buf.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  if (mimeType === "application/pdf") {
    return buf.length >= 5 && buf.subarray(0, 5).toString("ascii") === "%PDF-";
  }
  return false;
}

export async function POST(request: NextRequest) {
  const csrf = verifySameOriginRequest(request);
  if (!csrf.ok) {
    return NextResponse.json({ error: csrf.error }, { status: 403 });
  }

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

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const entityType = formData.get("entityType") as SarprasEntityType | null;
    const entityId = formData.get("entityId") as string | null;

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Berkas tidak ditemukan pada permintaan unggahan." },
        { status: 400 }
      );
    }

    if (
      !entityType ||
      ![
        "booking",
        "maintenance",
        "asset",
        "room",
        "consumable",
        "lecturer",
        "course",
        "official",
        "unit",
        "vendor",
        "class",
        "office_kit",
        "office_loan",
      ].includes(entityType) ||
      !entityId ||
      !ENTITY_ID_PATTERN.test(entityId)
    ) {
      return NextResponse.json(
        { error: "Target entitas lampiran tidak valid." },
        { status: 400 }
      );
    }

    const uploadPageKey = ENTITY_TYPE_TO_PAGE_KEY[entityType];
    if (!uploadPageKey || !canAccessPage(session, uploadPageKey)) {
      return NextResponse.json(
        { error: "Anda tidak memiliki otoritas untuk mengunggah lampiran pada modul ini." },
        { status: 403 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "Berkas tidak boleh kosong." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Ukuran berkas maksimal 5 MB." },
        { status: 400 }
      );
    }

    const mimeType = (file.type || "application/octet-stream").toLowerCase();
    const ext = path.extname(file.name || "").toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(mimeType) || !ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        {
          error:
            "Format berkas tidak valid. Hanya mendukung gambar JPG, PNG, WebP, atau dokumen PDF asli.",
        },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!matchesFileSignature(buffer, mimeType)) {
      return NextResponse.json(
        {
          error:
            "Format berkas tidak valid. Isi berkas tidak cocok dengan signature JPG, PNG, WebP, atau PDF.",
        },
        { status: 400 }
      );
    }

    // Pastikan bucket tersedia
    await supabase.storage
      .createBucket(BUCKET_NAME, { public: true })
      .catch(() => null);

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${entityType}/${entityId}/${Date.now()}-${safeName}`;

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadErr) {
      return NextResponse.json(
        { error: `Gagal mengunggah berkas: ${uploadErr.message}` },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);
    const fileUrl = urlData.publicUrl;

    const attachmentId = crypto.randomUUID();
    const uploadedBy = session.fullName || session.username;

    const { error: insertErr } = await supabase
      .from("sarpras_attachments")
      .insert({
        id: attachmentId,
        entity_type: entityType,
        entity_id: entityId,
        file_name: file.name,
        file_path: filePath,
        file_url: fileUrl,
        mime_type: mimeType,
        file_size_bytes: file.size,
        uploaded_by: uploadedBy,
      });

    if (insertErr) {
      return NextResponse.json(
        {
          error: insertErr.message.includes("sarpras_attachments")
            ? "Tabel lampiran belum dibuat. Jalankan migrasi supabase/migrations/003_notes_and_attachments.sql di SQL Editor Supabase."
            : insertErr.message,
        },
        { status: 400 }
      );
    }

    // Jika ini foto pemeliharaan, simpan juga ke photo_url tiket bila masih kosong
    if (entityType === "maintenance" && mimeType.startsWith("image/")) {
      await supabase
        .from("maintenance_logs")
        .update({ photo_url: fileUrl, updated_at: new Date().toISOString() })
        .eq("id", entityId)
        .is("photo_url", null);
    }

    return NextResponse.json(
      {
        attachment: {
          id: attachmentId,
          entity_type: entityType,
          entity_id: entityId,
          file_name: file.name,
          file_path: filePath,
          file_url: fileUrl,
          mime_type: mimeType,
          file_size_bytes: file.size,
          uploaded_by: uploadedBy,
          created_at: new Date().toISOString(),
        },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Terjadi gangguan saat memproses unggahan berkas." },
      { status: 500 }
    );
  }
}
