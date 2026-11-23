/**
 * Mengompres foto kamera beresolusi tinggi sebelum diunggah ke Supabase Storage
 * agar berada jauh di bawah batas 5 MB sekaligus menjaga kejelasan foto serah terima.
 */
export async function compressPhotoIfNeeded(
  file: File,
  maxDimension = 1600,
  quality = 0.82
): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= 1.2 * 1024 * 1024) {
    return file;
  }

  try {
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("Gagal memuat gambar"));
        el.src = objectUrl;
      });

      const longestSide = Math.max(img.naturalWidth || 1, img.naturalHeight || 1);
      const scale = longestSide > maxDimension ? maxDimension / longestSide : 1;
      const targetWidth = Math.max(1, Math.round((img.naturalWidth || maxDimension) * scale));
      const targetHeight = Math.max(1, Math.round((img.naturalHeight || maxDimension) * scale));

      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;

      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality)
      );
      if (!blob || blob.size >= file.size) {
        return file;
      }

      const baseName = file.name.replace(/\.[^.]+$/, "") || "foto-pinjam";
      return new File([blob], `${baseName}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return file;
  }
}
