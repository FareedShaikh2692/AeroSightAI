"use client";
// Client-only wrapper so server components can render maps without SSR of WebGL code.
import dynamic from "next/dynamic";
import type { MapViewProps } from "./MapView";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="grid-bg h-full min-h-40 w-full animate-pulse rounded-xl border border-line" aria-label="Loading map" />,
});

export function MapClient(props: MapViewProps) {
  return <MapView {...props} />;
}
