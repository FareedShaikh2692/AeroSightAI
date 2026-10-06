import type { WeatherAssessment } from "@/lib/types";
import { Badge } from "./ui";

export function WeatherSummary({ w, compact }: { w: WeatherAssessment | null; compact?: boolean }) {
  if (!w) return <span className="text-xs text-ink-3">Forecast not available (more than 15 days ahead or service unreachable).</span>;
  const tone = w.verdict === "go" ? "ok" : w.verdict === "marginal" ? "warn" : "bad";
  return (
    <div className="text-xs">
      <Badge tone={tone}>{w.verdict === "no_go" ? "no-go" : w.verdict}</Badge>
      <span className="ml-2 font-mono">{w.windMps} m/s · gusts {w.gustMps} · {w.precipProbPct}% rain · {Math.round(w.tempC)} °C</span>
      {!compact && <div className="mt-1 text-ink-3">{w.reasons.join("; ")} · Open-Meteo forecast for {w.at.slice(0, 16).replace("T", " ")} UTC</div>}
    </div>
  );
}
