import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Layers,
  MapPin,
  Package,
  QrCode,
  Tag,
  Wrench,
} from "lucide-react";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { formatCurrencyIDR } from "@/lib/supabase/client";
import {
  INITIAL_ASSETS,
  INITIAL_BUILDINGS,
  INITIAL_OFFICE_KIT_ITEMS,
  INITIAL_OFFICE_KIT_LOANS,
  INITIAL_ROOMS,
} from "@/lib/supabase/seed-data";
import { Asset, OfficeKitItem } from "@/types/sarpras";

export const dynamic = "force-dynamic";

interface ActiveLoanPublicInfo {
  class_code: string;
  expected_return_time: string;
}

interface PublicScanResult {
  kind: "office_kit" | "asset";
  code: string;
  name: string;
  category: string;
  brandSpec: string;
  locationPrimary: string;
  locationSecondary: string;
  condition: string;
  statusLabel: string;
  statusTone: "success" | "warning" | "danger" | "neutral";
  activeLoan: ActiveLoanPublicInfo | null;
  procurementYear: number | null;
  acquisitionCost: number;
  fundingOrSerial: string | null;
  notes: string;
  imageUrl: string | null;
  manageHref: string;
}

function getConditionTone(
  condition: string
): "success" | "warning" | "danger" | "neutral" {
  switch (condition) {
    case "Baik":
      return "success";
    case "Rusak Ringan":
      return "warning";
    case "Rusak Berat":
    case "Hilang":
      return "danger";
    default:
      return "neutral";
  }
}

function toneClasses(tone: "success" | "warning" | "danger" | "neutral"): string {
  switch (tone) {
    case "success":
      return "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200";
    case "warning":
      return "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200";
    case "danger":
      return "border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950/60 dark:text-red-200";
    default:
      return "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200";
  }
}

async function resolvePublicScanItem(rawCode: string): Promise<PublicScanResult | null> {
  const code = rawCode.trim();
  if (!code) return null;

  const supabase = getSupabaseServerClient();

  if (supabase) {
    const { data: kitRow } = await supabase
      .from("office_kit_items")
      .select(
        "id, kit_code, name, category, brand_spec, storage_tray, linked_room_id, procurement_year, acquisition_cost, condition, status, notes"
      )
      .ilike("kit_code", code)
      .maybeSingle();

    if (kitRow) {
      const kit = kitRow as unknown as OfficeKitItem;
      const [roomRes, activeLoanRes, imgRes] = await Promise.all([
        kit.linked_room_id
          ? supabase
              .from("rooms")
              .select("code, name")
              .eq("id", kit.linked_room_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        kit.status === "Dipinjam"
          ? supabase
              .from("office_kit_loans")
              .select("class_code, expected_return_time")
              .eq("status", "Dipinjam")
              .contains("kit_item_ids", [kit.id])
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        supabase
          .from("entity_attachments")
          .select("file_url, mime_type")
          .eq("entity_type", "office_kit")
          .eq("entity_id", kit.id)
          .ilike("mime_type", "image/%")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const linkedRoom = roomRes.data as { code: string; name: string } | null;
      const loanInfo = activeLoanRes.data as ActiveLoanPublicInfo | null;
      const imageUrl =
        (imgRes.data as { file_url?: string } | null)?.file_url || null;

      return {
        kind: "office_kit",
        code: kit.kit_code,
        name: kit.name,
        category: kit.category,
        brandSpec: kit.brand_spec || "-",
        locationPrimary: kit.storage_tray || "Kantor Staf",
        locationSecondary: linkedRoom
          ? `Khusus Ruang ${linkedRoom.code} (${linkedRoom.name})`
          : "Universal (Semua Ruang)",
        condition: kit.condition,
        statusLabel:
          kit.status === "Tersedia"
            ? "Tersedia di Kantor Staf"
            : kit.status === "Dipinjam"
            ? "Sedang Dipinjam"
            : "Dalam Perbaikan / Tidak Tersedia",
        statusTone:
          kit.status === "Tersedia"
            ? "success"
            : kit.status === "Dipinjam"
            ? "warning"
            : "danger",
        activeLoan: loanInfo,
        procurementYear:
          typeof kit.procurement_year === "number" ? kit.procurement_year : null,
        acquisitionCost: Number(kit.acquisition_cost || 0),
        fundingOrSerial: null,
        notes: kit.notes || "",
        imageUrl,
        manageHref: "/sarpras/sirkulasi-invent",
      };
    }

    const { data: assetRow } = await supabase
      .from("assets")
      .select(
        "id, inventory_code, name, category, category_label, brand_model, serial_number, room_id, procurement_year, acquisition_cost, condition, funding_source, notes"
      )
      .ilike("inventory_code", code)
      .maybeSingle();

    if (assetRow) {
      const asset = assetRow as unknown as Asset;
      const [roomRes, imgRes] = await Promise.all([
        asset.room_id
          ? supabase
              .from("rooms")
              .select("code, name, building_id")
              .eq("id", asset.room_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        supabase
          .from("entity_attachments")
          .select("file_url, mime_type")
          .eq("entity_type", "asset")
          .eq("entity_id", asset.id)
          .ilike("mime_type", "image/%")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const room = roomRes.data as {
        code: string;
        name: string;
        building_id?: string | null;
      } | null;

      let buildingName = "";
      if (room?.building_id) {
        const { data: bld } = await supabase
          .from("buildings")
          .select("name")
          .eq("id", room.building_id)
          .maybeSingle();
        buildingName = (bld as { name?: string } | null)?.name || "";
      }

      const imageUrl =
        (imgRes.data as { file_url?: string } | null)?.file_url || null;

      return {
        kind: "asset",
        code: asset.inventory_code,
        name: asset.name,
        category: `${asset.category_label} (${asset.category})`,
        brandSpec: asset.brand_model || "-",
        locationPrimary: room ? `${room.code} - ${room.name}` : "Belum ditetapkan",
        locationSecondary: buildingName || "Inventaris Kampus",
        condition: asset.condition,
        statusLabel:
          asset.condition === "Baik"
            ? "Kondisi Baik / Siap Pakai"
            : `Kondisi: ${asset.condition}`,
        statusTone: getConditionTone(asset.condition),
        activeLoan: null,
        procurementYear: asset.procurement_year || null,
        acquisitionCost: Number(asset.acquisition_cost || 0),
        fundingOrSerial: `Sumber Dana: ${asset.funding_source}${
          asset.serial_number && asset.serial_number !== "-"
            ? ` • SN: ${asset.serial_number}`
            : ""
        }`,
        notes: asset.notes || "",
        imageUrl,
        manageHref: "/sarpras/inventaris",
      };
    }

    return null;
  }

  // Fallback mode seed lokal (saat SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi)
  const lower = code.toLowerCase();
  const seedKit = INITIAL_OFFICE_KIT_ITEMS.find(
    (k) => k.kit_code.toLowerCase() === lower
  );
  if (seedKit) {
    const linkedRoom = INITIAL_ROOMS.find(
      (r) => r.id === seedKit.linked_room_id
    );
    const activeLoan =
      seedKit.status === "Dipinjam"
        ? INITIAL_OFFICE_KIT_LOANS.find(
            (l) =>
              l.status === "Dipinjam" && l.kit_item_ids.includes(seedKit.id)
          ) || null
        : null;

    return {
      kind: "office_kit",
      code: seedKit.kit_code,
      name: seedKit.name,
      category: seedKit.category,
      brandSpec: seedKit.brand_spec || "-",
      locationPrimary: seedKit.storage_tray || "Kantor Staf",
      locationSecondary: linkedRoom
        ? `Khusus Ruang ${linkedRoom.code} (${linkedRoom.name})`
        : "Universal (Semua Ruang)",
      condition: seedKit.condition,
      statusLabel:
        seedKit.status === "Tersedia"
          ? "Tersedia di Kantor Staf"
          : seedKit.status === "Dipinjam"
          ? "Sedang Dipinjam"
          : "Dalam Perbaikan / Tidak Tersedia",
      statusTone:
        seedKit.status === "Tersedia"
          ? "success"
          : seedKit.status === "Dipinjam"
          ? "warning"
          : "danger",
      activeLoan: activeLoan
        ? {
            class_code: activeLoan.class_code,
            expected_return_time: activeLoan.expected_return_time,
          }
        : null,
      procurementYear: seedKit.procurement_year ?? null,
      acquisitionCost: Number(seedKit.acquisition_cost || 0),
      fundingOrSerial: null,
      notes: seedKit.notes || "",
      imageUrl: null,
      manageHref: "/sarpras/sirkulasi-invent",
    };
  }

  const seedAsset = INITIAL_ASSETS.find(
    (a) => a.inventory_code.toLowerCase() === lower
  );
  if (seedAsset) {
    const room = INITIAL_ROOMS.find((r) => r.id === seedAsset.room_id);
    const building = room
      ? INITIAL_BUILDINGS.find((b) => b.id === room.building_id)
      : null;
    return {
      kind: "asset",
      code: seedAsset.inventory_code,
      name: seedAsset.name,
      category: `${seedAsset.category_label} (${seedAsset.category})`,
      brandSpec: seedAsset.brand_model || "-",
      locationPrimary: room ? `${room.code} - ${room.name}` : "Belum ditetapkan",
      locationSecondary: building?.name || "Inventaris Kampus",
      condition: seedAsset.condition,
      statusLabel:
        seedAsset.condition === "Baik"
          ? "Kondisi Baik / Siap Pakai"
          : `Kondisi: ${seedAsset.condition}`,
      statusTone: getConditionTone(seedAsset.condition),
      activeLoan: null,
      procurementYear: seedAsset.procurement_year || null,
      acquisitionCost: Number(seedAsset.acquisition_cost || 0),
      fundingOrSerial: `Sumber Dana: ${seedAsset.funding_source}${
        seedAsset.serial_number && seedAsset.serial_number !== "-"
          ? ` • SN: ${seedAsset.serial_number}`
          : ""
      }`,
      notes: seedAsset.notes || "",
      imageUrl: null,
      manageHref: "/sarpras/inventaris",
    };
  }

  return null;
}

export default async function PublicScanDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: rawParam } = await params;
  const decodedCode = decodeURIComponent(rawParam || "").trim();
  const item = await resolvePublicScanItem(decodedCode);

  return (
    <main className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 px-4 py-6 sm:py-10">
      <div className="w-full max-w-lg mx-auto space-y-4">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#1E3A5F] text-white dark:bg-sky-500 dark:text-slate-950 flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                STAFCENTER • INFO QR BARANG
              </p>
              <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Kartu Identitas Barang Kampus
              </h1>
            </div>
          </div>
          <Link
            href={item?.manageHref || "/sarpras"}
            className="min-h-[40px] px-3 py-1.5 inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0"
          >
            <span>Buka StafCenter</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </header>

        {!item ? (
          <section className="rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center space-y-3 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" aria-hidden="true" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Kode Barang Tidak Ditemukan
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Kode{" "}
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                {decodedCode || "-"}
              </span>{" "}
              belum terdaftar atau sudah dihapus dari katalog Alat Kantor Staf
              maupun Inventaris Aset.
            </p>
          </section>
        ) : (
          <article className="rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="px-2.5 py-1 text-xs font-mono font-bold rounded-md bg-[#1E3A5F] text-white dark:bg-sky-400 dark:text-slate-950">
                  {item.code}
                </span>
                <span className="px-2.5 py-1 text-[11px] font-semibold rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {item.kind === "office_kit"
                    ? "Alat Kantor Staf"
                    : "Aset Inventaris"}
                </span>
              </div>

              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-snug">
                  {item.name}
                </h2>
                <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{item.category}</span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-bold ${toneClasses(
                    item.statusTone
                  )}`}
                >
                  {item.statusTone === "success" ? (
                    <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                  ) : item.statusTone === "warning" ? (
                    <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                  ) : (
                    <Wrench className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  <span>{item.statusLabel}</span>
                </span>

                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold ${toneClasses(
                    getConditionTone(item.condition)
                  )}`}
                >
                  <span>Kondisi: {item.condition}</span>
                </span>
              </div>

              {item.activeLoan ? (
                <div className="p-3 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40 text-xs text-amber-950 dark:text-amber-200">
                  Dipinjam oleh{" "}
                  <strong className="font-mono">{item.activeLoan.class_code}</strong>
                  , est. kembali{" "}
                  <strong className="font-mono">
                    {item.activeLoan.expected_return_time} WIB
                  </strong>
                </div>
              ) : null}
            </div>

            {item.imageUrl ? (
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
                <img
                  src={item.imageUrl}
                  alt={`Foto ${item.name}`}
                  className="w-full max-h-60 object-contain rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                />
              </div>
            ) : null}

            <dl className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <dt className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Merek / Spesifikasi</span>
                </dt>
                <dd className="font-semibold text-slate-900 dark:text-slate-100">
                  {item.brandSpec}
                </dd>
              </div>

              <div className="space-y-1">
                <dt className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Lokasi Penyimpanan</span>
                </dt>
                <dd className="font-semibold text-slate-900 dark:text-slate-100">
                  {item.locationPrimary}
                </dd>
              </div>

              <div className="space-y-1">
                <dt className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Keterkaitan Ruang</span>
                </dt>
                <dd className="font-semibold text-slate-900 dark:text-slate-100">
                  {item.locationSecondary}
                </dd>
              </div>

              <div className="space-y-1">
                <dt className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Tahun Pengadaan</span>
                </dt>
                <dd className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {item.procurementYear || "-"}
                </dd>
              </div>

              <div className="space-y-1">
                <dt className="text-slate-600 dark:text-slate-400">
                  Harga Perolehan
                </dt>
                <dd className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {item.acquisitionCost > 0
                    ? formatCurrencyIDR(item.acquisitionCost)
                    : "-"}
                </dd>
              </div>

              {item.fundingOrSerial ? (
                <div className="space-y-1">
                  <dt className="text-slate-600 dark:text-slate-400">
                    Detail Pengadaan
                  </dt>
                  <dd className="font-semibold text-slate-900 dark:text-slate-100">
                    {item.fundingOrSerial}
                  </dd>
                </div>
              ) : null}

              {item.notes ? (
                <div className="sm:col-span-2 space-y-1 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <dt className="text-slate-600 dark:text-slate-400">
                    Catatan
                  </dt>
                  <dd className="text-slate-800 dark:text-slate-200 leading-relaxed">
                    {item.notes}
                  </dd>
                </div>
              ) : null}
            </dl>
          </article>
        )}
      </div>
    </main>
  );
}
