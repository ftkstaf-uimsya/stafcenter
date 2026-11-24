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

    const bulkDeleteBtn = page.getByRole("button", { name: /Hapus Massal/i });
    await expect(bulkDeleteBtn).toBeVisible();
    await expect(bulkDeleteBtn).toBeDisabled();
    const firstRowCheck = page.locator("tbody input[type='checkbox']").first();
    if (await firstRowCheck.isVisible()) {
      await firstRowCheck.check();
      await expect(
        page.getByRole("button", { name: /Hapus Massal \(1\)/i })
      ).toBeEnabled();
      await page.getByRole("button", { name: /Hapus Massal \(1\)/i }).click();
      await expect(
        page.getByText("Konfirmasi Hapus Massal Aset Inventaris")
      ).toBeVisible();
      await page.getByRole("button", { name: "Batal", exact: true }).click();
      await firstRowCheck.uncheck();
    }
  });

  test("6. Sirkulasi Invent: Kartu Board Ringkas, Hapus Massal Katalog, Riwayat & Rekap, Auto Pola A, Scan & Kamera Live", async ({
    page,
  }) => {
    await loginAsMasterAdmin(page);
    await page.goto("/sarpras/sirkulasi-invent");

    // 6a. Switch Board -> Tabel & verifikasi kartu ringkas tanpa progress bar 50%
    await page.getByRole("button", { name: "Board" }).click();
    await expect(page.getByText("Sedang Dipinjam").first()).toBeVisible();
    await expect(page.getByText("Dikembalikan").first()).toBeVisible();
    await expect(page.getByText("50%")).toHaveCount(0);
    const firstBoardCardBtn = page
      .locator("article button")
      .filter({ hasNotText: /Tandai Dikembalikan|Terima Kembali|Ubah ke Dipinjam/ })
      .first();
    if (await firstBoardCardBtn.isVisible()) {
      await firstBoardCardBtn.click();
      await expect(
        page.getByRole("heading", { name: /Sirkulasi Kelas/i })
      ).toBeVisible();
      await page.keyboard.press("Escape");
    }
    await page.getByRole("button", { name: "Tabel" }).click();

    // 6b. Tab Riwayat & Rekap (Master Admin)
    await page.getByRole("tab", { name: /Riwayat & Rekap/i }).click();
    await expect(page.getByText(/Rekap Kelas/i).first()).toBeVisible();

    // 6c. Tab Katalog Barang Kantor Staf: Resequence Preview, Cetak QR & Hapus Massal
    await page
      .getByRole("tab", { name: /Katalog Barang Kantor Staf/i })
      .click();

    const bulkDeleteKitBtn = page.getByRole("button", { name: /Hapus Massal/i });
    await expect(bulkDeleteKitBtn).toBeVisible();
    await expect(bulkDeleteKitBtn).toBeDisabled();
    const firstKitCheck = page.locator("tbody input[type='checkbox']").first();
    if (await firstKitCheck.isVisible()) {
      await firstKitCheck.check();
      await expect(
        page.getByRole("button", { name: /Hapus Massal \(1\)/i })
      ).toBeEnabled();
      await page.getByRole("button", { name: /Hapus Massal \(1\)/i }).click();
      await expect(
        page.getByText("Konfirmasi Hapus Massal Barang Kantor Staf")
      ).toBeVisible();
      await page.getByRole("button", { name: "Batal", exact: true }).click();
      await firstKitCheck.uncheck();
    }

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

  test("7. Sub-menu Pinjam Cepat: Split Layout 2 Kolom, Pencarian Fleksibel, Mobile 375px & Tema Gelap", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      consoleErrors.push(err.message);
    });

    await loginAsMasterAdmin(page);
    await page.goto("/sarpras/sirkulasi-invent");

    // Navigasi melalui sub-menu sidebar Pinjam Cepat
    const desktopSidebar = page.getByRole("complementary", {
      name: "Navigasi Utama StafCenter",
    });
    const pinjamCepatLink = desktopSidebar.getByRole("link", {
      name: "Pinjam Cepat",
    });
    await expect(pinjamCepatLink).toBeVisible();
    await pinjamCepatLink.click();
    await page.waitForURL(/\/sarpras\/sirkulasi-invent\/pinjam-cepat/);

    // Pastikan hanya Pinjam Cepat yang berstatus aria-current="page" (bukan Meja & Katalog)
    await expect(pinjamCepatLink).toHaveAttribute("aria-current", "page");
    await expect(
      desktopSidebar.getByRole("link", { name: "Meja & Katalog" })
    ).not.toHaveAttribute("aria-current", "page");

    await expect(
      page.getByRole("heading", { name: /Pinjam Cepat Alat Kantor Staf/i })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Pinjamkan Alat Kantor Staf ke Kelas/i })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "SEDANG DIPINJAM" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "DIKEMBALIKAN" })
    ).toBeVisible();

    // Pastikan kotak review kelas dan input Tanggal/Jam Ambil tidak ada lagi, sementara tombol WA & preset lebar tersedia
    await expect(page.getByText(/WA DPM:/i)).toHaveCount(0);
    await expect(page.getByLabel("Tanggal *")).toHaveCount(0);
    await expect(page.getByLabel("Jam Ambil *")).toHaveCount(0);
    await expect(page.getByRole("separator")).toBeVisible();
    await expect(page.getByRole("button", { name: "Fokus Form" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Seimbang" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Fokus Antrean" })
    ).toBeVisible();

    const waBtn = page.getByRole("button", { name: /^WA/i }).first();
    await expect(waBtn).toBeVisible();
    await expect(
      page.getByLabel(/Nomor WhatsApp \/ Telepon Aktif/i)
    ).toHaveCount(0);
    await waBtn.click();
    await expect(
      page.getByLabel(/Nomor WhatsApp \/ Telepon Aktif/i)
    ).toBeVisible();
    await waBtn.click();
    await expect(
      page.getByLabel(/Nomor WhatsApp \/ Telepon Aktif/i)
    ).toHaveCount(0);

    // Uji pencarian fleksibel di dropdown Pilih Kelas Mahasiswa tanpa tanda hubung
    const classCombo = page.getByRole("combobox", {
      name: /Pilih Kelas Mahasiswa/i,
    });
    await classCombo.click();
    const firstOptionText =
      (await page.getByRole("option").first().textContent()) || "";
    const firstCodeMatch = firstOptionText.match(/^([A-Z]+-\d+[A-Z]+)/);
    if (firstCodeMatch) {
      const hyphenCode = firstCodeMatch[1];
      const noHyphen = hyphenCode.replace(/-/g, "");
      const spaced = hyphenCode.replace(/-/g, " ");

      await classCombo.fill(noHyphen);
      await expect(
        page.getByRole("option", { name: new RegExp(hyphenCode) }).first()
      ).toBeVisible();

      await classCombo.fill(spaced);
      await expect(
        page.getByRole("option", { name: new RegExp(hyphenCode) }).first()
      ).toBeVisible();
    }
    await page.keyboard.press("Escape");

    // Uji toggle tema Gelap -> Terang
    const themeToggle = page.getByRole("button", {
      name: /Aktifkan tema gelap|Gelap/i,
    });
    await themeToggle.click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page
      .getByRole("button", { name: /Aktifkan tema terang|Terang/i })
      .click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);

    // Uji responsif tablet 820px dan mobile 375px tanpa horizontal overflow
    await page.setViewportSize({ width: 820, height: 1180 });
    const hasTabletOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
    );
    expect(hasTabletOverflow).toBe(false);

    await page.setViewportSize({ width: 375, height: 812 });
    const hasOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
    );
    expect(hasOverflow).toBe(false);

    await page.getByRole("tab", { name: /Dipinjam/i }).click();
    await expect(
      page.getByRole("heading", { name: "SEDANG DIPINJAM" })
    ).toBeVisible();
    await page.getByRole("tab", { name: /Kembali/i }).click();
    await expect(
      page.getByRole("heading", { name: "DIKEMBALIKAN" })
    ).toBeVisible();
    await page.getByRole("tab", { name: /Form Pinjam/i }).click();
    await expect(
      page.getByRole("heading", { name: /Pinjamkan Alat Kantor Staf ke Kelas/i })
    ).toBeVisible();

    // Switch mode ke Ruangan & Alat Portabel di Pinjam Cepat
    await page.setViewportSize({ width: 1280, height: 720 });
    await page
      .getByRole("button", { name: /Ruangan & Alat Portabel/i })
      .click();
    await expect(
      page.getByRole("heading", { name: /Pinjam Cepat Ruangan & Alat Portabel/i })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /ANTREAN & SEDANG DIPINJAM/i })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /SELESAI \/ DIKEMBALIKAN/i })
    ).toBeVisible();

    // Uji modal Peminjaman & Reservasi juga memiliki tombol foto bukti & kamera live
    await page.goto("/sarpras/peminjaman");
    await page
      .getByRole("button", { name: /Ajukan Peminjaman Baru/i })
      .click();
    await expect(
      page.getByText(/Foto Bukti Peminjaman \(Opsional\)/i)
    ).toBeVisible();
    await page.getByRole("button", { name: /Ambil Foto/i }).click();
    await expect(page.locator("video")).toBeVisible();
    await page
      .getByRole("button", { name: "Batal", exact: true })
      .last()
      .click();
    await page.getByRole("button", { name: "Batal", exact: true }).click();

    expect(consoleErrors).toEqual([]);
  });
});
