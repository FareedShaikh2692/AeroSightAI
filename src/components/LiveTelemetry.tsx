"use client";
// Live telemetry consumer: EventSource with automatic reconnection, stale detection and HUD.
import { useEffect, useRef, useState } from "react";
import { MapClient } from "./MapClient";
import type { MapData } from "./MapView";
import type { LngLat } from "@/lib/types";
import { Battery, Gauge, Compass, Satellite, Signal, Timer, Mountain, TriangleAlert } from "lucide-react";

interface T { latitude: number; longitude: number; altitude: number; relativeAltitude: number; speed: number; heading: number; battery: number; satellites: number; gpsSignal: string; signalStrength: number; flightTime: number; flightMode: string; timestamp: string; simulated: boolean }
interface A { type: string; severity: "warning" | "critical"; message: string }

export function LiveTelemetry({ missionId, data, fitTo, height = 520, compact = false }: { missionId: string; data: MapData; fitTo: LngLat[]; height?: number; compact?: boolean }) {
  const [t, setT] = useState<T | null>(null);
  const [trail, setTrail] = useState<LngLat[]>([]);
  const [alerts, setAlerts] = useState<(A & { at: number })[]>([]);
  const [conn, setConn] = useState<"connecting" | "live" | "reconnecting" | "ended" | "no-provider">("connecting");
  const [now, setNow] = useState(Date.now());
  const lastAt = useRef(0);

  useEffect(() => {
    setTrail([]); setT(null); setAlerts([]);
    const es = new EventSource(`/api/v1/missions/${missionId}/telemetry/stream`);
    es.addEventListener("welcome", (e) => { const w = JSON.parse((e as MessageEvent).data); setConn(w.simulated ? "live" : "no-provider"); });
    es.addEventListener("telemetry", (e) => {
      const d = JSON.parse((e as MessageEvent).data) as T;
      lastAt.current = Date.now();
      setT(d); setConn("live");
      setTrail((tr) => [...tr.slice(-400), [d.longitude, d.latitude]]);
    });
    es.addEventListener("alert", (e) => {
      const list = JSON.parse((e as MessageEvent).data) as A[];
      setAlerts((a) => [...list.map((x) => ({ ...x, at: Date.now() })), ...a].slice(0, 6));
    });
    es.addEventListener("mission_state", () => { setConn("ended"); es.close(); });
    es.onerror = () => setConn((c) => (c === "ended" ? c : "reconnecting"));
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => { es.close(); clearInterval(iv); };
  }, [missionId]);

  const ageS = t ? Math.round((now - lastAt.current) / 1000) : 0;
  const stale = !!t && ageS >= 3;
  const state = conn === "live" && stale ? (ageS >= 10 ? "offline" : "stale") : conn;
  const label: Record<string, [string, string]> = {
    connecting: ["Connecting…", "text-ink-2"], live: ["Live", "text-ok"], reconnecting: ["Reconnecting…", "text-warn"], stale: [`Delayed · ${ageS}s`, "text-warn"],
    offline: ["Signal lost", "text-bad"], ended: ["Mission no longer in progress", "text-ink-2"], "no-provider": ["No provider connected", "text-ink-2"],
  };

  return (
    <div className="relative">
      {t?.simulated && <div className="sim-stripes mb-2 rounded-md px-3 py-1 text-xs font-semibold text-accent">SIMULATED TELEMETRY — not a real flight</div>}
      <div className="relative">
        <MapClient height={height} fitTo={fitTo} initialBasemap="satellite" data={data} trail={trail}
          drone={t ? { lng: t.longitude, lat: t.latitude, heading: t.heading, stale } : null} />
        <div className="glass mt-3 rounded-xl p-3 text-xs sm:pointer-events-none sm:absolute sm:right-3 sm:top-3 sm:mt-0 sm:w-56">
          <div className="mb-2 flex items-center justify-between"><span className="font-semibold">Telemetry</span><span className={`flex items-center gap-1.5 ${label[state][1]}`}>
            <span className={`h-1.5 w-1.5 rounded-full bg-current ${state === "live" ? "animate-pulse" : ""}`} />{label[state][0]}</span></div>
          {conn === "no-provider" ? <p className="text-ink-2">This drone has no live provider integration. Connect a provider (Phase 2) to stream telemetry.</p> : (
            <div className={`grid grid-cols-2 gap-2 ${stale ? "opacity-50" : ""}`}>
              <Hud icon={<Mountain size={12} />} label="Alt AGL" value={t ? `${t.relativeAltitude.toFixed(1)} m` : "—"} />
              <Hud icon={<Gauge size={12} />} label="Speed" value={t ? `${t.speed.toFixed(1)} m/s` : "—"} />
              <Hud icon={<Compass size={12} />} label="Heading" value={t ? `${Math.round(t.heading)}°` : "—"} />
              <Hud icon={<Battery size={12} />} label="Battery" value={t ? `${t.battery.toFixed(0)}%` : "—"} tone={t && t.battery <= 20 ? "bad" : t && t.battery <= 30 ? "warn" : undefined} />
              <Hud icon={<Satellite size={12} />} label="GPS" value={t ? `${t.satellites} sats` : "—"} />
              <Hud icon={<Signal size={12} />} label="Link" value={t ? `${t.signalStrength}%` : "—"} />
              <Hud icon={<Timer size={12} />} label="Flight" value={t ? `${Math.floor(t.flightTime / 60)}:${String(t.flightTime % 60).padStart(2, "0")}` : "—"} />
              <Hud label="Mode" value={t ? t.flightMode : "—"} />
            </div>
          )}
          {t && !compact && <div className="mt-2 font-mono text-[10px] text-ink-3">{t.latitude.toFixed(6)}, {t.longitude.toFixed(6)}</div>}
        </div>
      </div>
      <div aria-live="polite" className="mt-3 space-y-2">
        {alerts.slice(0, compact ? 2 : 4).map((a, i) => (
          <div key={i} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${a.severity === "critical" ? "border-bad/40 bg-bad/10 text-bad" : "border-warn/40 bg-warn/10 text-warn"}`}>
            <TriangleAlert size={16} />{a.message}<span className="ml-auto text-xs opacity-70">{new Date(a.at).toLocaleTimeString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Hud({ icon, label, value, tone }: { icon?: React.ReactNode; label: string; value: string; tone?: "warn" | "bad" }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-ink-3">{icon}{label}</div>
      <div className={`font-mono text-sm ${tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : ""}`}>{value}</div>
    </div>
  );
}
