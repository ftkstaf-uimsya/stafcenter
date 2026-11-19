import { NextRequest, NextResponse } from "next/server";
import { getVerifiedServerSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { SarprasEntityType } from "@/types/sarpras";

const BUCKET_NAME = "sarpras-files";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_PREFIXES = ["image/", "application/pdf"];

export async function POST(request: NextRequest) {
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
      ].includes(entityType) ||
      !entityId
    ) {
      return NextResponse.json(
        { error: "Target entitas lampiran tidak valid." },
        { status: 400 }
      );
    }

    if (
      ["room", "lecturer", "course", "official"].includes(entityType) &&
      session.role !== "master_admin"
    ) {
      return NextResponse.json(
        { error: "Hanya Master Admin yang berhak mengunggah lampiran Data Master." },
        { status: 403 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Ukuran berkas maksimal 5 MB." },
        { status: 400 }
      );
    }

    const mimeType = file.type || "application/octet-stream";
    if (!ALLOWED_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix))) {
      return NextResponse.json(
        { error: "Format berkas hanya mendukung gambar (JPG/PNG/WebP) atau PDF." },
        { status: 400 }
      );
    }

    // Pastikan bucket tersedia
    await supabase.storage
      .createBucket(BUCKET_NAME, { public: true })
      .catch(() => null);

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${entityType}/${entityId}/${Date.now()}-${safeName}`;
    const buffer = Buffer.from(await file.arrayBuffer());

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
