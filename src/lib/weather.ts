// Flight weather go/no-go (docs/13-Product/Future-Scope.md §2 "Weather integration"). Forecast from Open-Meteo
// (free, no API key). Wind is forecast at 10 m; it is scaled to flight altitude with the 1/7 power law.
import "server-only";
import { safeFetch } from "./net";
import type { WeatherAssessment } from "./types";

export const LIMITS = { windMps: 10, gustMps: 12, precipProbPct: 60, precipMm: 0.3, minTempC: -10, maxTempC: 45, minVisibilityM: 3000 };

interface Hourly { time: string[]; wind_speed_10m: number[]; wind_gusts_10m: number[]; precipitation_probability: (number | null)[]; precipitation: number[]; temperature_2m: number[]; visibility?: (number | null)[] }
const cache = new Map<string, { at: number; hourly: Hourly }>();

export function assess(h: { wind10: number; gust10: number; precipProb: number; precipMm: number; tempC: number; visibilityM?: number }, altitudeM = 80): Omit<WeatherAssessment, "at" | "source" | "fetchedAt"> {
  const k = Math.pow(Math.max(10, altitudeM) / 10, 1 / 7);
  const wind = +(h.wind10 * k).toFixed(1), gust = +(h.gust10 * k).toFixed(1);
  const noGo: string[] = [], marginal: string[] = [];
  if (wind > LIMITS.windMps) noGo.push(`Wind ${wind} m/s at ${altitudeM} m exceeds ${LIMITS.windMps} m/s`); else if (wind > LIMITS.windMps * 0.8) marginal.push(`Wind ${wind} m/s close to limit`);
  if (gust > LIMITS.gustMps) noGo.push(`Gusts ${gust} m/s exceed ${LIMITS.gustMps} m/s`); else if (gust > LIMITS.gustMps * 0.8) marginal.push(`Gusts ${gust} m/s close to limit`);
  if (h.precipMm > LIMITS.precipMm) noGo.push(`Precipitation ${h.precipMm} mm/h`); else if (h.precipProb > LIMITS.precipProbPct) marginal.push(`${h.precipProb}% chance of precipitation`);
  if (h.tempC < LIMITS.minTempC || h.tempC > LIMITS.maxTempC) noGo.push(`Temperature ${h.tempC} °C outside battery limits`);
  else if (h.tempC > 40) marginal.push(`High temperature ${h.tempC} °C — reduced battery endurance`);
  if (h.visibilityM !== undefined && h.visibilityM < LIMITS.minVisibilityM) marginal.push(`Visibility ${Math.round(h.visibilityM)} m`);
  return { verdict: noGo.length ? "no_go" : marginal.length ? "marginal" : "go", windMps: wind, gustMps: gust, precipProbPct: h.precipProb, precipMm: h.precipMm,
    tempC: h.tempC, visibilityM: h.visibilityM, reasons: noGo.length ? noGo : marginal.length ? marginal : ["Within limits"] };
}

/** Assessment for the hour of `atIso` at a location. Returns null if the forecast is unavailable or out of range. */
export async function flightWeather(lng: number, lat: number, atIso: string, altitudeM = 80): Promise<WeatherAssessment | null> {
  const t = Date.parse(atIso);
  if (t < Date.now() - 3_600_000 || t > Date.now() + 15 * 86_400_000) return null;
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  let hit = cache.get(key);
  if (!hit || Date.now() - hit.at > 30 * 60_000) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&hourly=wind_speed_10m,wind_gusts_10m,precipitation_probability,precipitation,temperature_2m,visibility&wind_speed_unit=ms&forecast_days=16&timezone=UTC`;
    try {
      const r = await safeFetch(url, { maxBytes: 400_000, timeoutMs: 6000, headers: { accept: "application/json" } });
      if (!r.ok) return null;
      hit = { at: Date.now(), hourly: (JSON.parse(await r.text()) as { hourly: Hourly }).hourly };
      cache.set(key, hit);
    } catch {
      return null;
    }
  }
  const h = hit.hourly;
  const hourIso = new Date(Math.floor(t / 3_600_000) * 3_600_000).toISOString().slice(0, 13) + ":00";
  const i = h.time.indexOf(hourIso);
  if (i < 0) return null;
  const a = assess({ wind10: h.wind_speed_10m[i], gust10: h.wind_gusts_10m[i], precipProb: h.precipitation_probability[i] ?? 0, precipMm: h.precipitation[i] ?? 0,
    tempC: h.temperature_2m[i], visibilityM: h.visibility?.[i] ?? undefined }, altitudeM);
  return { ...a, at: new Date(t).toISOString(), source: "open-meteo", fetchedAt: new Date(hit.at).toISOString() };
}
