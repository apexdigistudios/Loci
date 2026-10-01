"use client";

import dynamic from "next/dynamic";

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface SatelliteMapProps {
  latitude: number;
  longitude: number;
  className?: string;
  interactive?: boolean;
  manuallyPicked?: boolean;
  onLocationChange?: (coordinates: Coordinates) => void;
}

const LeafletSatelliteMap = dynamic(
  () => import("@/components/ui/leaflet-satellite-map").then((module) => module.LeafletSatelliteMap),
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse bg-zinc-200 dark:bg-zinc-900" />,
  }
);

export function SatelliteMap({
  latitude,
  longitude,
  className = "h-52 rounded-2xl",
  interactive = false,
  manuallyPicked = false,
  onLocationChange,
}: SatelliteMapProps) {
  return (
    <div className={`relative isolate z-0 w-full overflow-hidden border border-zinc-200/70 dark:border-zinc-800 bg-zinc-200 dark:bg-zinc-900 ${className}`}>
      <LeafletSatelliteMap
        latitude={latitude}
        longitude={longitude}
        interactive={interactive}
        onLocationChange={onLocationChange}
      />
      {manuallyPicked && <div className="absolute top-2 left-2 z-1000 rounded-full bg-black/80 px-2.5 py-1 text-[9px] font-bold text-white shadow-sm pointer-events-none">📍 Pin set manually - Drag to adjust</div>}
      <div className="absolute bottom-0 inset-x-0 z-1000 bg-white/85 px-2 py-1 text-[8px] leading-tight text-zinc-700 pointer-events-none">
        © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline pointer-events-auto">OpenStreetMap</a> contributors
      </div>
    </div>
  );
}
