import { NextRequest, NextResponse } from "next/server";
import { getVerifiedServerSession } from "@/lib/auth/session";
import { isServerSupabaseConfigured } from "@/lib/supabase/server";
import { mapWmoWeatherCode, WeatherSnapshot } from "@/lib/workspace/holidays";

export const dynamic = "force-dynamic";

const WEATHER_CACHE_TTL_MS = 20 * 60 * 1000;

const weatherCache = new Map<
  string,
  { snapshot: WeatherSnapshot; expiresAt: number }
>();

function buildFallbackSnapshot(
  city: string,
  lat: number,
  lon: number
): WeatherSnapshot {
  const hourWib = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      hour12: false,
    }).format(new Date())
  );
  const isDay = hourWib >= 6 && hourWib < 18;
  return {
    city,
    lat,
    lon,
    temperatureC: isDay ? 29 : 25,
    weatherCode: 2,
    condition: "partly_cloudy",
    label: "Cerah Berawan",
    isDay,
    windKmh: 8,
    fetchedAt: new Date().toISOString(),
    fallback: true,
  };
}

export async function GET(request: NextRequest) {
  if (isServerSupabaseConfigured()) {
    const session = await getVerifiedServerSession();
    if (!session) {
      return NextResponse.json(
        { error: "Autentikasi staf diperlukan." },
        { status: 401 }
      );
    }
  }

  const { searchParams } = request.nextUrl;
  const rawLat = Number(searchParams.get("lat"));
  const rawLon = Number(searchParams.get("lon"));
  const city = (
    searchParams.get("city") ||
    process.env.NEXT_PUBLIC_CAMPUS_CITY ||
    "Jakarta"
  )
    .trim()
    .slice(0, 80);

  const lat =
    Number.isFinite(rawLat) && rawLat >= -90 && rawLat <= 90
      ? rawLat
      : Number(process.env.NEXT_PUBLIC_CAMPUS_LAT) || -6.2088;
  const lon =
    Number.isFinite(rawLon) && rawLon >= -180 && rawLon <= 180
      ? rawLon
      : Number(process.env.NEXT_PUBLIC_CAMPUS_LON) || 106.8456;

  const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const now = Date.now();
  const cached = weatherCache.get(cacheKey);
  if (cached && now < cached.expiresAt) {
    return NextResponse.json(
      { ...cached.snapshot, city },
      { status: 200 }
    );
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const upstreamUrl = new URL("https://api.open-meteo.com/v1/forecast");
    upstreamUrl.searchParams.set("latitude", String(lat));
    upstreamUrl.searchParams.set("longitude", String(lon));
    upstreamUrl.searchParams.set(
      "current",
      "temperature_2m,weather_code,is_day,wind_speed_10m"
    );
    upstreamUrl.searchParams.set("timezone", "Asia/Jakarta");

    const res = await fetch(upstreamUrl.toString(), {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`Open-Meteo HTTP ${res.status}`);
    }

    const json = (await res.json()) as {
      current?: {
        temperature_2m?: number;
        weather_code?: number;
        is_day?: number;
        wind_speed_10m?: number;
      };
    };

    const current = json.current || {};
    const weatherCode = Number(current.weather_code ?? 2);
    const mapped = mapWmoWeatherCode(weatherCode);

    const snapshot: WeatherSnapshot = {
      city,
      lat,
      lon,
      temperatureC: Math.round(Number(current.temperature_2m ?? 28)),
      weatherCode,
      condition: mapped.condition,
      label: mapped.label,
      isDay: Number(current.is_day ?? 1) === 1,
      windKmh: Math.round(Number(current.wind_speed_10m ?? 0)),
      fetchedAt: new Date().toISOString(),
      fallback: false,
    };

    weatherCache.set(cacheKey, {
      snapshot,
      expiresAt: now + WEATHER_CACHE_TTL_MS,
    });

    return NextResponse.json(snapshot, { status: 200 });
  } catch {
    return NextResponse.json(buildFallbackSnapshot(city, lat, lon), {
      status: 200,
    });
  }
}
