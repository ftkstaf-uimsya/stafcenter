# DESIGN.md: StafCenter (Sistem Administrasi & Sarana Prasarana Kampus)

## 1. Identitas & Karakter Produk
- **Nama Produk:** StafCenter (Modul Utama: Sarana Prasarana)
- **Target Pengguna:** Kepala Bagian Umum & Sarpras, Staf Inventaris Kampus, Teknisi Pemeliharaan Gedung, serta Dosen/Staf/Ormawa peminjam fasilitas.
- **Karakter Visual:** *Institutional Operations Console*. Tegas, terstruktur seperti lembar kendali teknik sipil/arsitektur kampus, bersih dari dekorasi AI generik, dan memprioritaskan kecepatan pemindaian kode ruang serta status aset.
- **Dial Liveliness:** `Dial: ENERGY 2 / RHYTHM 2 / MOTION 1`

## 2. Alasan Keputusan Visual (R-31 Purpose Log)
- **Warna (R-01, R-25, R-29):** Menggunakan palet 2 warna inti + 1 aksen: Navy Akademik (`#1E3A5F`), Netral Kertas Kerja (`#F8FAFC` / `#0F172A`), dan Aksen Okra Operasional (`#B45309`). Alasan: membedakan navigasi institusional dari area kerja tabel padat sekaligus menjamin rasio kontras teks minimum 4.5:1 (WCAG AA) di mode terang maupun gelap.
- **Tipografi (R-06):** `Plus Jakarta Sans` untuk antarmuka dan `JetBrains Mono` khusus untuk kode inventaris (`INV-ELK-2026-0001`), kode ruang (`1-SM6`), serta nomor tiket. Alasan: mencegah salah baca karakter `0`/`O` dan `1`/`I` ketika staf mencocokkan label QR fisik di lapangan.
- **Layout & Komposisi (R-05, R-14):** Dashboard disusun mengikuti urutan keputusan harian petugas sarpras (tindakan darurat & konflik jadwal di atas, diikuti panel asimetris okupansi ruangan aktif dan tiket pemeliharaan, lalu ringkasan inventaris per gedung). Alasan: menempatkan item yang membutuhkan persetujuan atau perbaikan segera pada titik fokus pertama.
- **Kartu & Elevasi (R-11, R-12, R-14):** Kartu menggunakan batas tegas `1px` (`#CBD5E1` pada terang, `#334155` pada gelap) dengan radius terukur (`rounded-lg` untuk kontainer utama, `rounded-md` untuk kontrol input/tombol) dan bayangan tipis hanya pada modal/drawer yang melayang di atas halaman. Alasan: menjaga hierarki permukaan datar vs elemen overlay tanpa efek mengambang berlebihan.
- **Ikonografi (R-04):** Setiap ikon `lucide-react` dipetakan langsung ke objek fisik kampus (`Building2` untuk gedung, `DoorOpen` untuk ruangan, `MonitorSpeaker` untuk aset, `CalendarClock` untuk jadwal pinjam, `Wrench` untuk teknisi, `Boxes` untuk stok ATK) dan disembunyikan dari screen reader (`aria-hidden="true"`) saat mendampingi label teks. Alasan: mempercepat pengenalan kategori modul tanpa memakai ikon dekoratif AI.
- **Gerakan / Motion (R-19):** Dial `MOTION 1` (transisi warna/fokus 150ms pada hover dan buka-tutup sidebar/modal, tanpa animasi loop/pulse tanpa henti). Alasan: aplikasi administrasi digunakan berjam-jam sehingga gerakan berulang akan mengganggu konsentrasi operator.
- **Transparansi Data Simulasi (R-17, R-23, R-38):** Ketika variabel lingkungan Supabase belum terhubung ke database produksi, antarmuka menampilkan indikator eksplisit `[MODE DATA SEED KAMPUS]` beserta pengalih simulasi *State UI* (Normal, Kosong/Empty, Memuat/Loading, Gangguan/Error) untuk menguji ketahanan tampilan sesuai standar R-27.
