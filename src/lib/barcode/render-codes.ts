import QRCode from "qrcode";

export type LabelPrintLayout = "a4_small" | "a4_medium" | "thermal_50x30";

export interface PrintableBarcodeItem {
  id: string;
  code: string;
  title: string;
  subtitle?: string;
  meta?: string;
  headerTag?: string;
}

export interface PrintableLabelEntry {
  item: PrintableBarcodeItem;
  copies: number;
  qrDataUrl: string;
}

export async function generateQrDataUrl(value: string): Promise<string> {
  const clean = value.trim();
  if (!clean) return "";
  try {
    const svg = await QRCode.toString(clean, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
      color: {
        dark: "#0F172A",
        light: "#FFFFFF",
      },
    });
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  } catch {
    return "";
  }
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildStickerHtml(
  entry: PrintableLabelEntry,
  layout: LabelPrintLayout
): string {
  const { item, qrDataUrl } = entry;
  const tag = escapeHtml(item.headerTag || "BIRO SARPRAS • STAFCENTER");
  const code = escapeHtml(item.code);
  const title = escapeHtml(item.title);
  const subtitle = item.subtitle ? escapeHtml(item.subtitle) : "";
  const meta = item.meta ? escapeHtml(item.meta) : "";

  const isThermal = layout === "thermal_50x30";
  const qrSize = isThermal
    ? "18mm"
    : layout === "a4_medium"
    ? "24mm"
    : "18mm";

  return `
    <div class="sticker">
      <div class="tag">${tag}</div>
      <div class="combo-row">
        ${
          qrDataUrl
            ? `<img class="qr-img" src="${qrDataUrl}" alt="QR ${code}" style="width:${qrSize};height:${qrSize};" />`
            : ""
        }
        <div class="info-col">
          <div class="code">${code}</div>
          <div class="title">${title}</div>
          ${subtitle ? `<div class="sub">${subtitle}</div>` : ""}
          ${meta ? `<div class="meta">${meta}</div>` : ""}
        </div>
      </div>
    </div>
  `;
}

export function printBarcodeLabelsIsolated(
  entries: PrintableLabelEntry[],
  layout: LabelPrintLayout
): void {
  if (typeof document === "undefined" || entries.length === 0) return;

  const expandedStickers: string[] = [];
  for (const entry of entries) {
    const safeCopies = Math.max(1, Math.min(50, Math.round(entry.copies || 1)));
    for (let i = 0; i < safeCopies; i++) {
      expandedStickers.push(buildStickerHtml(entry, layout));
    }
  }
  if (expandedStickers.length === 0) return;

  const pageCss =
    layout === "thermal_50x30"
      ? `@page { size: 50mm 30mm; margin: 1.5mm; }`
      : layout === "a4_medium"
      ? `@page { size: A4 portrait; margin: 10mm; }`
      : `@page { size: A4 portrait; margin: 8mm; }`;

  const gridCss =
    layout === "thermal_50x30"
      ? `
        .sheet { display: block; }
        .sticker {
          width: 47mm;
          height: 27mm;
          padding: 1.4mm 1.8mm;
          border: 0.3mm solid #0F172A;
          page-break-after: always;
          break-after: page;
          overflow: hidden;
        }
        .sticker:last-child {
          page-break-after: auto;
          break-after: auto;
        }
      `
      : layout === "a4_medium"
      ? `
        .sheet {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 5mm;
        }
        .sticker {
          border: 0.35mm dashed #64748B;
          border-radius: 2mm;
          padding: 3.5mm;
          break-inside: avoid;
          page-break-inside: avoid;
        }
      `
      : `
        .sheet {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 3mm;
        }
        .sticker {
          border: 0.3mm dashed #64748B;
          border-radius: 1.5mm;
          padding: 2.5mm;
          break-inside: avoid;
          page-break-inside: avoid;
        }
      `;

  const isThermal = layout === "thermal_50x30";
  const html = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Cetak Label QR StafCenter</title>
  <style>
    ${pageCss}
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Plus Jakarta Sans", Arial, sans-serif;
      color: #0F172A;
      background: #FFFFFF;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    ${gridCss}
    .tag {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: ${isThermal ? "5.5pt" : "6.5pt"};
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #475569;
      margin-bottom: ${isThermal ? "1mm" : "1.6mm"};
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .combo-row {
      display: flex;
      align-items: center;
      gap: ${isThermal ? "1.8mm" : "2.6mm"};
    }
    .qr-img {
      display: block;
      flex-shrink: 0;
      border: 0.25mm solid #CBD5E1;
      background: #FFFFFF;
    }
    .info-col {
      min-width: 0;
      flex: 1;
    }
    .code {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: ${isThermal ? "9.5pt" : layout === "a4_medium" ? "12pt" : "10.5pt"};
      font-weight: 800;
      color: #0F172A;
      line-height: 1.15;
      word-break: break-all;
    }
    .title {
      font-size: ${isThermal ? "7pt" : layout === "a4_medium" ? "9pt" : "7.8pt"};
      font-weight: 700;
      color: #0F172A;
      line-height: 1.2;
      margin-top: 0.5mm;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .sub, .meta {
      font-size: ${isThermal ? "5.8pt" : "6.8pt"};
      color: #334155;
      line-height: 1.2;
      margin-top: 0.4mm;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  </style>
</head>
<body>
  <div class="sheet">${expandedStickers.join("")}</div>
</body>
</html>`;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  document.body.appendChild(iframe);

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    setTimeout(() => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    }, 300);
  };

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    cleanup();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const triggerPrint = () => {
    const win = iframe.contentWindow;
    if (!win) {
      cleanup();
      return;
    }
    win.onafterprint = cleanup;
    setTimeout(() => {
      win.focus();
      win.print();
    }, 120);
    setTimeout(cleanup, 60000);
  };

  const images = Array.from(doc.images || []);
  if (images.length === 0) {
    triggerPrint();
    return;
  }

  Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })
    )
  ).then(triggerPrint);
}
