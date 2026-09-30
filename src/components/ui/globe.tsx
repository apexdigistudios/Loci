"use client";

import createGlobe from "cobe";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";

interface PinnedLocation {
  id: string;
  user: string;
  location: string;
  time: string;
  lat: number;
  lng: number;
}

const LOCATIONS: PinnedLocation[] = [
  { id: "1", user: "Sam", location: "Texas", time: "11:45pm", lat: 31.9686, lng: -99.9018 },
  { id: "2", user: "Kwame", location: "Labadi", time: "3:05pm", lat: 5.556, lng: -0.1503 },
  { id: "3", user: "Elena", location: "London", time: "8:20pm", lat: 51.5074, lng: -0.1278 },
  { id: "4", user: "Aiko", location: "Tokyo", time: "4:12am", lat: 35.6762, lng: 139.6503 },
  { id: "5", user: "Mateo", location: "Madrid", time: "9:15pm", lat: 40.4168, lng: -3.7038 },
  { id: "6", user: "Zainab", location: "Dubai", time: "12:00am", lat: 25.2048, lng: 55.2708 },
  { id: "7", user: "Lucas", location: "São Paulo", time: "6:40pm", lat: -23.5505, lng: -46.6333 },
  { id: "8", user: "Aarav", location: "Mumbai", time: "1:30am", lat: 19.076, lng: 72.8777 },
];

interface GlobeProps {
  className?: string;
  showBadge?: boolean;
}

export function Globe({ className, showBadge = true }: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme } = useTheme();
  const [activePinIndex, setActivePinIndex] = useState(0);

  useEffect(() => {
    if (!showBadge) return;
    const interval = setInterval(() => {
      setActivePinIndex((prev) => (prev + 1) % LOCATIONS.length);
    }, 3200);
    return () => clearInterval(interval);
  }, [showBadge]);

  const currentPin = LOCATIONS[activePinIndex];

  useEffect(() => {
    let phi = 0;
    if (!canvasRef.current) return;

    const isDark = resolvedTheme === "dark";

    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: 280 * 2,
      height: 280 * 2,
      phi: 0,
      theta: 0,
      dark: isDark ? 1 : 0,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: isDark ? 6 : 2,
      baseColor: isDark ? [0.2, 0.2, 0.2] : [0.9, 0.9, 0.9],
      markerColor: [1, 0.6, 0],
      glowColor: isDark ? [0.15, 0.15, 0.15] : [0.95, 0.95, 0.95],
      markers: LOCATIONS.map((loc) => ({
        location: [loc.lat, loc.lng],
        size: loc.id === currentPin.id ? 0.08 : 0.04,
      })),
      onRender: (state) => {
        state.phi = phi;
        phi += 0.004;
      },
    });

    return () => {
      globe.destroy();
    };
  }, [resolvedTheme, currentPin.id]);

  return (
    <div className={`relative w-65 h-65 sm:w-70 sm:h-70 shrink-0 flex flex-col items-center justify-center ${className}`}>
      {/* Floating Badge (Shown on homepage, hidden on session page) */}
      {showBadge && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 w-max max-w-62.5 transition-all duration-500 ease-out">
          <div className="bg-black/90 dark:bg-white/90 text-white dark:text-black border border-zinc-800 dark:border-zinc-200 px-3 py-1.5 rounded-full shadow-lg text-[11px] font-medium flex items-center space-x-2 backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span className="truncate">
              <strong className="font-semibold">{currentPin.user}</strong> is in{" "}
              <span className="underline decoration-zinc-500">{currentPin.location}</span> &bull;{" "}
              <span className="opacity-70">{currentPin.time}</span>
            </span>
          </div>
        </div>
      )}

      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain pointer-events-none"
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}