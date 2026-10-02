"use client";

import createGlobe from "cobe";
import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

interface GlobeProps {
  className?: string;
  showBadge?: boolean;
}

export function Globe({ className, showBadge = true }: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme } = useTheme();

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
      markers: [],
      onRender: (state) => {
        state.phi = phi;
        phi += 0.004;
      },
    });

    return () => {
      globe.destroy();
    };
  }, [resolvedTheme]);

  return (
    <div className={`relative w-65 h-65 sm:w-70 sm:h-70 shrink-0 flex flex-col items-center justify-center ${className}`}>
      {/* Floating Badge (Shown on homepage, hidden on session page) */}
      {showBadge && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 w-max max-w-62.5 transition-all duration-500 ease-out">
          <div className="bg-black/90 dark:bg-white/90 text-white dark:text-black border border-zinc-800 dark:border-zinc-200 px-3 py-1.5 rounded-full shadow-lg text-[11px] font-medium flex items-center space-x-2 backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span className="truncate">Déloci safety network is active</span>
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