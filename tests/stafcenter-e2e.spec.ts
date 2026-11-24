import { test, expect, type Page } from "@playwright/test";

async function loginAsMasterAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Username *").fill("staf");
  await page.getByLabel("Kata Sandi *").fill("st@feftek@");
  await page.getByRole("button", { name: /Masuk ke StafCenter|Masuk/i }).click();
  await page.waitForURL(/\/(sarpras|tugas-akhir)/, { timeout: 20_000 });
}

test.describe("StafCenter E2E Verification (Non-Destructive)", () => {
  test("1. Login staf & verifikasi topbar bersih tanpa badge DB/Master Admin", async ({
    page,
  }) => {
    await loginAsMasterAdmin(page);
    const header = page.getByRole("banner");
    await expect(page.getByText("[DB: SUPABASE]")).toHaveCount(0);
    await expect(header.getByText("staf (Master Admin)")).toHaveCount(0);
  });

  test("2. Halaman Tugas Akhir (Skripsi & Artikel Jurnal) tampil 4 kolom berurutan", async ({
    page,
  }) => {
    await loginAsMasterAdmin(page);

    await page.goto("/tugas-akhir/skripsi/proposal");
    await expect(
      page.getByRole("heading", { name: "Berkas Daftar" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Bikin Jadwal" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Bikin Surat" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Selesai / Arsip" })
    ).toBeVisible();

    await page.goto("/tugas-akhir/artikel-jurnal/sidang");
    await expect(
      page.getByRole("heading", { name: "Berkas Daftar" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Selesai / Arsip" })
    ).toBeVisible();
  });

  test("3. Manajemen Akun Staf menampilkan Otoritas Akses Halaman", async ({
    page,
  }) => {
    await loginAsMasterAdmin(page);
    await page.goto("/sarpras/akun");
    await page.getByRole("button", { name: /Tambah Akun Staf/i }).click();
    await expect(page.getByText(/Otoritas Akses Halaman/i)).toBeVisible();
    await expect(page.getByText("Skripsi: Proposal")).toBeVisible();
    await page.getByRole("button", { name: "Batal", exact: true }).click();
  });

  test("4. Pemeliharaan & Kerusakan mendukung pelaporan Alat Kantor Staf", async ({
    page,
  }) => {
    await loginAsMasterAdmin(page);
    await page.goto("/sarpras/pemeliharaan");
    await page
      .getByRole("button", { name: "Buat Tiket Laporan Kerusakan" })
      .click();
    await expect(page.getByText(/Alat Kantor Staf/i).first()).toBeVisible();
    await page.getByRole("button", { name: "Batal", exact: true }).click();
  });

  test("5. Inventaris Aset menggunakan Cetak QR Massal tanpa Barcode 1D", async ({
    page,
  }) => {
    await loginAsMasterAdmin(page);
    await page.goto("/sarpras/inventaris");
    const cetakBtn = page.getByRole("button", {
      name: /Cetak (QR|Barcode) Massal/i,
    });
    await expect(cetakBtn).toBeVisible();
    if (await cetakBtn.isEnabled()) {
      await cetakBtn.click();
      await expect(page.getByText(/Barcode 1D Saja/i)).toHaveCount(0);
      await expect(page.getByText(/Kombinasi \(QR \+ Barcode\)/i)).toHaveCount(
        0
      );
      await page.getByRole("button", { name: "Tutup", exact: true }).click();
    }
  });

  test("6. Sirkulasi Invent: Board/Tabel, Riwayat & Rekap, Auto Pola A, Resequence Preview, QR Only, Scan & Kamera Live", async ({
    page,
  }) => {
    await loginAsMasterAdmin(page);
    await page.goto("/sarpras/sirkulasi-invent");

    // 6a. Switch Board -> Tabel
    await page.getByRole("button", { name: "Board" }).click();
    await expect(page.getByText("Sedang Dipinjam").first()).toBeVisible();
    await expect(page.getByText("Dikembalikan").first()).toBeVisible();
    await page.getByRole("button", { name: "Tabel" }).click();

    // 6b. Tab Riwayat & Rekap (Master Admin)
    await page.getByRole("tab", { name: /Riwayat & Rekap/i }).click();
    await expect(page.getByText(/Rekap Kelas/i).first()).toBeVisible();

    // 6c. Tab Katalog Barang Kantor Staf: Resequence Preview & QR Only
    await page
      .getByRole("tab", { name: /Katalog Barang Kantor Staf/i })
      .click();

    await page
      .getByRole("button", { name: /Rapikan Kode & Nama Unit/i })
      .click();
    await expect(
      page.getByText("Rapikan Kode Unit & Nama Barang Kantor Staf")
    ).toBeVisible();
    await page.getByRole("button", { name: "Batal", exact: true }).click();

    const cetakKitQrBtn = page.getByRole("button", { name: /Cetak QR Massal/i });
    if ((await cetakKitQrBtn.isVisible()) && (await cetakKitQrBtn.isEnabled())) {
      await cetakKitQrBtn.click();
      await expect(page.getByText(/Barcode 1D Saja/i)).toHaveCount(0);
      await expect(page.getByText(/Kombinasi \(QR \+ Barcode\)/i)).toHaveCount(
        0
      );
      await page.getByRole("button", { name: "Tutup", exact: true }).click();
    }

    // 6d. Tambah Barang Kantor Staf: Auto Kode Pola A & Auto Nama
    await page
      .getByRole("button", { name: /Tambah Barang Kantor Staf/i })
      .click();
    const kodeInput = page.getByLabel(/Kode Unit Barang \*/i);
    const namaInput = page.getByLabel(/Nama Barang \*/i);
    await expect(kodeInput).toHaveValue(/^1\d{3,}$/);
    await expect(namaInput).toHaveValue(/^Kabel HDMI \d+$/);

    const kategoriInput = page.getByRole("combobox", {
      name: /Kategori Peralatan/i,
    });
    await kategoriInput.click();
    await kategoriInput.fill("Stop Kontak");
    await page.getByRole("option", { name: "Stop Kontak" }).click();
    await expect(kodeInput).toHaveValue(/^2\d{3,}$/);
    await expect(namaInput).toHaveValue(/^Stop Kontak \d+$/);
    await page.getByRole("button", { name: "Batal", exact: true }).click();

    // 6e. Pinjamkan Alat ke Kelas: Scan Kamera & Ambil Foto Live
    await page
      .getByRole("button", { name: /Pinjamkan Alat ke Kelas/i })
      .click();

    await page.getByRole("button", { name: /Scan Kamera/i }).click();
    await expect(
      page.getByText(/Scan QR Code Barang Kantor Staf/i)
    ).toBeVisible();
    await page.getByRole("button", { name: /Selesai Scan/i }).click();

    await page.getByRole("button", { name: /Ambil Foto/i }).click();
    const videoEl = page.locator("video");
    await expect(videoEl).toBeVisible();
    await page
      .getByRole("button", { name: "Batal", exact: true })
      .last()
      .click();
    await page.getByRole("button", { name: "Batal", exact: true }).click();
  });
});
