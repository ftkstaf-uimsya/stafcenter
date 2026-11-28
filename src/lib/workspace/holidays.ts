export interface IndonesianHoliday {
  date: string; // YYYY-MM-DD
  name: string;
  type: "libur" | "cuti";
}

export interface WeatherCityPreset {
  city: string;
  lat: number;
  lon: number;
}

export type PixelWeatherCondition =
  | "clear"
  | "partly_cloudy"
  | "cloudy"
  | "rain"
  | "storm"
  | "fog";

export interface WeatherSnapshot {
  city: string;
  lat: number;
  lon: number;
  temperatureC: number;
  weatherCode: number;
  condition: PixelWeatherCondition;
  label: string;
  isDay: boolean;
  windKmh: number;
  fetchedAt: string;
  fallback?: boolean;
}

export const WEATHER_CITY_PRESETS: WeatherCityPreset[] = [
  { city: "Jakarta", lat: -6.2088, lon: 106.8456 },
  { city: "Bandung", lat: -6.9175, lon: 107.6191 },
  { city: "Yogyakarta", lat: -7.7956, lon: 110.3695 },
  { city: "Semarang", lat: -6.9667, lon: 110.4167 },
  { city: "Surabaya", lat: -7.2575, lon: 112.7521 },
  { city: "Malang", lat: -7.9666, lon: 112.6326 },
  { city: "Banda Aceh", lat: 5.5483, lon: 95.3238 },
  { city: "Medan", lat: 3.5952, lon: 98.6722 },
  { city: "Padang", lat: -0.9471, lon: 100.4172 },
  { city: "Palembang", lat: -2.9761, lon: 104.7754 },
  { city: "Pontianak", lat: -0.0263, lon: 109.3425 },
  { city: "Banjarmasin", lat: -3.3194, lon: 114.5908 },
  { city: "Makassar", lat: -5.1477, lon: 119.4327 },
  { city: "Denpasar", lat: -8.6705, lon: 115.2126 },
  { city: "Mataram", lat: -8.5833, lon: 116.1167 },
];

/**
 * Daftar Hari Libur Nasional & Cuti Bersama Indonesia (2025-2027).
 */
export const INDONESIAN_HOLIDAYS: IndonesianHoliday[] = [
  // 2025
  { date: "2025-01-01", name: "Tahun Baru 2025 Masehi", type: "libur" },
  { date: "2025-01-27", name: "Isra Mikraj Nabi Muhammad SAW", type: "libur" },
  { date: "2025-01-28", name: "Cuti Bersama Imlek", type: "cuti" },
  { date: "2025-01-29", name: "Tahun Baru Imlek 2576", type: "libur" },
  { date: "2025-03-28", name: "Cuti Bersama Hari Suci Nyepi", type: "cuti" },
  { date: "2025-03-29", name: "Hari Suci Nyepi Tahun Baru Saka 1947", type: "libur" },
  { date: "2025-03-31", name: "Hari Raya Idul Fitri 1446 H", type: "libur" },
  { date: "2025-04-01", name: "Hari Raya Idul Fitri 1446 H", type: "libur" },
  { date: "2025-04-02", name: "Cuti Bersama Idul Fitri", type: "cuti" },
  { date: "2025-04-03", name: "Cuti Bersama Idul Fitri", type: "cuti" },
  { date: "2025-04-04", name: "Cuti Bersama Idul Fitri", type: "cuti" },
  { date: "2025-04-07", name: "Cuti Bersama Idul Fitri", type: "cuti" },
  { date: "2025-04-18", name: "Wafat Yesus Kristus", type: "libur" },
  { date: "2025-05-01", name: "Hari Buruh Internasional", type: "libur" },
  { date: "2025-05-12", name: "Hari Raya Waisak 2569 BE", type: "libur" },
  { date: "2025-05-29", name: "Kenaikan Yesus Kristus", type: "libur" },
  { date: "2025-06-01", name: "Hari Lahir Pancasila", type: "libur" },
  { date: "2025-06-06", name: "Hari Raya Idul Adha 1446 H", type: "libur" },
  { date: "2025-06-27", name: "Tahun Baru Islam 1447 H", type: "libur" },
  { date: "2025-08-17", name: "Hari Kemerdekaan RI", type: "libur" },
  { date: "2025-09-05", name: "Maulid Nabi Muhammad SAW", type: "libur" },
  { date: "2025-12-25", name: "Hari Raya Natal", type: "libur" },
  { date: "2025-12-26", name: "Cuti Bersama Natal", type: "cuti" },

  // 2026
  { date: "2026-01-01", name: "Tahun Baru 2026 Masehi", type: "libur" },
  { date: "2026-01-16", name: "Isra Mikraj Nabi Muhammad SAW", type: "libur" },
  { date: "2026-02-16", name: "Cuti Bersama Imlek", type: "cuti" },
  { date: "2026-02-17", name: "Tahun Baru Imlek 2577", type: "libur" },
  { date: "2026-03-18", name: "Cuti Bersama Hari Suci Nyepi", type: "cuti" },
  { date: "2026-03-19", name: "Hari Suci Nyepi Tahun Baru Saka 1948", type: "libur" },
  { date: "2026-03-20", name: "Cuti Bersama Idul Fitri 1447 H", type: "cuti" },
  { date: "2026-03-21", name: "Hari Raya Idul Fitri 1447 H", type: "libur" },
  { date: "2026-03-22", name: "Hari Raya Idul Fitri 1447 H", type: "libur" },
  { date: "2026-03-23", name: "Cuti Bersama Idul Fitri 1447 H", type: "cuti" },
  { date: "2026-03-24", name: "Cuti Bersama Idul Fitri 1447 H", type: "cuti" },
  { date: "2026-04-03", name: "Wafat Yesus Kristus", type: "libur" },
  { date: "2026-04-05", name: "Hari Paskah", type: "libur" },
  { date: "2026-05-01", name: "Hari Buruh Internasional", type: "libur" },
  { date: "2026-05-14", name: "Kenaikan Yesus Kristus", type: "libur" },
  { date: "2026-05-15", name: "Cuti Bersama Kenaikan Yesus Kristus", type: "cuti" },
  { date: "2026-05-27", name: "Hari Raya Idul Adha 1447 H", type: "libur" },
  { date: "2026-05-28", name: "Cuti Bersama Idul Adha 1447 H", type: "cuti" },
  { date: "2026-05-31", name: "Hari Raya Waisak 2570 BE", type: "libur" },
  { date: "2026-06-01", name: "Hari Lahir Pancasila", type: "libur" },
  { date: "2026-06-16", name: "Tahun Baru Islam 1448 H", type: "libur" },
  { date: "2026-08-17", name: "Hari Kemerdekaan RI", type: "libur" },
  { date: "2026-08-25", name: "Maulid Nabi Muhammad SAW", type: "libur" },
  { date: "2026-12-24", name: "Cuti Bersama Natal", type: "cuti" },
  { date: "2026-12-25", name: "Hari Raya Natal", type: "libur" },

  // 2027
  { date: "2027-01-01", name: "Tahun Baru 2027 Masehi", type: "libur" },
  { date: "2027-01-05", name: "Isra Mikraj Nabi Muhammad SAW", type: "libur" },
  { date: "2027-02-06", name: "Tahun Baru Imlek 2578", type: "libur" },
  { date: "2027-03-08", name: "Hari Suci Nyepi Tahun Baru Saka 1949", type: "libur" },
  { date: "2027-03-10", name: "Hari Raya Idul Fitri 1448 H", type: "libur" },
  { date: "2027-03-11", name: "Hari Raya Idul Fitri 1448 H", type: "libur" },
  { date: "2027-03-26", name: "Wafat Yesus Kristus", type: "libur" },
  { date: "2027-05-01", name: "Hari Buruh Internasional", type: "libur" },
  { date: "2027-05-06", name: "Kenaikan Yesus Kristus", type: "libur" },
  { date: "2027-05-17", name: "Hari Raya Idul Adha 1448 H", type: "libur" },
  { date: "2027-05-20", name: "Hari Raya Waisak 2571 BE", type: "libur" },
  { date: "2027-06-01", name: "Hari Lahir Pancasila", type: "libur" },
  { date: "2027-06-06", name: "Tahun Baru Islam 1449 H", type: "libur" },
  { date: "2027-08-15", name: "Maulid Nabi Muhammad SAW", type: "libur" },
  { date: "2027-08-17", name: "Hari Kemerdekaan RI", type: "libur" },
  { date: "2027-12-25", name: "Hari Raya Natal", type: "libur" },
];

export function getHolidayOnDate(dateIso: string): IndonesianHoliday | null {
  return INDONESIAN_HOLIDAYS.find((h) => h.date === dateIso) || null;
}

export function getNextUpcomingHoliday(
  fromDateIso: string
): { holiday: IndonesianHoliday; daysAway: number } | null {
  const next = INDONESIAN_HOLIDAYS.find((h) => h.date >= fromDateIso);
  if (!next) return null;
  const fromMs = Date.parse(`${fromDateIso}T00:00:00Z`);
  const nextMs = Date.parse(`${next.date}T00:00:00Z`);
  if (Number.isNaN(fromMs) || Number.isNaN(nextMs)) return null;
  const daysAway = Math.max(0, Math.round((nextMs - fromMs) / 86_400_000));
  return { holiday: next, daysAway };
}

export function mapWmoWeatherCode(code: number): {
  condition: PixelWeatherCondition;
  label: string;
} {
  if (code === 0) return { condition: "clear", label: "Cerah" };
  if (code === 1 || code === 2) {
    return { condition: "partly_cloudy", label: "Cerah Berawan" };
  }
  if (code === 3) return { condition: "cloudy", label: "Mendung" };
  if (code === 45 || code === 48) return { condition: "fog", label: "Berkabut" };
  if (
    (code >= 51 && code <= 67) ||
    (code >= 80 && code <= 82)
  ) {
    return { condition: "rain", label: "Hujan" };
  }
  if (code >= 95 && code <= 99) {
    return { condition: "storm", label: "Badai Petir" };
  }
  return { condition: "cloudy", label: "Berawan" };
}
