import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SarprasProvider } from "@/lib/supabase/sarpras-context";
import { AppShell } from "@/components/layout/app-shell";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "StafCenter | Sistem Administrasi & Sarana Prasarana Kampus",
  description:
    "Portal operasional terpadu untuk manajemen gedung, ruangan, inventaris aset, sirkulasi peminjaman, pemeliharaan fasilitas, dan barang habis pakai kampus.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${plusJakartaSans.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans">
        <SarprasProvider>
          <AppShell>{children}</AppShell>
        </SarprasProvider>
      </body>
    </html>
  );
}
