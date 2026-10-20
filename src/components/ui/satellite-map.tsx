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
  nickname?: string;
  avatarUrl?: string;
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
  nickname,
  avatarUrl,
  onLocationChange,
}: SatelliteMapProps) {
  return (
    <div className={`relative isolate z-0 w-full overflow-hidden border border-zinc-200/70 dark:border-zinc-800 bg-zinc-200 dark:bg-zinc-900 ${className}`}>
      <LeafletSatelliteMap
        latitude={latitude}
        longitude={longitude}
        interactive={interactive}
        nickname={nickname}
        avatarUrl={avatarUrl}
        onLocationChange={onLocationChange}
      />
      {manuallyPicked && (
        <div className="absolute top-2 left-2 z-1000 rounded-full bg-black/80 px-2.5 py-1 text-[9px] font-bold text-white shadow-sm pointer-events-none">
          📍 Pin set manually - Drag to adjust
        </div>
      )}
      <div className="absolute bottom-0 inset-x-0 z-1000 bg-black/70 backdrop-blur-md px-2 py-1 text-[8px] leading-tight text-zinc-300 pointer-events-none">
        Tiles &copy; Esri &mdash; Sources: Esri, DeLorme, NAVTEQ, USGS
      </div>
    </div>
  );
}