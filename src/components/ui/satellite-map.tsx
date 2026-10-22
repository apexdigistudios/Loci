"use client";

import React, { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

interface SatelliteMapProps {
  latitude: number;
  longitude: number;
  nickname?: string;
  avatarUrl?: string;
  interactive?: boolean;
  manuallyPicked?: boolean;
  onLocationChange?: (coords: { latitude: number; longitude: number }) => void;
  showDirections?: boolean;
  receiverLocation?: { latitude: number; longitude: number };
  className?: string;
}

export function SatelliteMap({
  latitude,
  longitude,
  nickname = "User",
  avatarUrl,
  interactive = false,
  manuallyPicked = false,
  onLocationChange,
  showDirections = false,
  receiverLocation,
  className = "h-64 w-full rounded-2xl overflow-hidden shadow-md",
}: SatelliteMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const receiverMarkerRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);

  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const LRef = useRef<any>(null);

  // Load Leaflet dynamically on the client side to prevent SSR "window is not defined" error
  useEffect(() => {
    let isMounted = true;
    import("leaflet").then((L) => {
      if (!isMounted) return;
      LRef.current = L;
      setLeafletLoaded(true);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Initialize map with Google Hybrid / Labeled Satellite Layer & Resize observer
  useEffect(() => {
    if (!leafletLoaded || !mapRef.current || mapInstanceRef.current) return;
    const L = LRef.current;
    if (!L) return;

    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([latitude, longitude], 15);

    // Google Labeled Hybrid Satellite tile layer[cite: 5]
    L.tileLayer("https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", {
      maxZoom: 20,
    }).addTo(map);

    L.control.zoom({ position: "topright" }).addTo(map);
    mapInstanceRef.current = map;

    const handleResize = () => {
      map.invalidateSize();
    };
    window.addEventListener("resize", handleResize);

    const resizeTimer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", handleResize);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [leafletLoaded]);

  // Invalidate map size whenever className or showDirections changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => clearTimeout(timer);
  }, [className, showDirections]);

  // Update sender marker with name + avatar layout & center map
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = LRef.current;
    if (!map || !L) return;

    if (!showDirections) {
      map.setView([latitude, longitude], map.getZoom(), { animate: true });
    }

    // Custom HTML marker displaying sender name alongside the avatar image (similar to your Loci style)
    const customIcon = L.divIcon({
      className: "loci-leaflet-marker",
      html: `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; width: 160px; left: -80px; bottom: 42px; pointer-events: none;">
          <div style="display: flex; align-items: center; background: #18181b; padding: 2px 8px 2px 2px; border-radius: 9999px; border: 1px solid rgba(250,204,21,0.5); margin-bottom: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.6); gap: 6px; pointer-events: auto;">
            ${
              avatarUrl
                ? `<img src="${avatarUrl}" style="width: 22px; height: 22px; border-radius: 50%; object-fit: cover; border: 1px solid #facc15;" />`
                : `<div style="width: 22px; height: 22px; border-radius: 50%; background: #3f3f46; color: #facc15; font-size: 9px; font-weight: 900; display: flex; align-items: center; justify-content: center; text-transform: uppercase;">${(nickname || "U").slice(0, 2)}</div>`
            }
            <span style="color: #facc15; font-size: 10px; font-weight: 900; white-space: nowrap; padding-right: 4px;">${nickname || "User"}</span>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="42" fill="#facc15" stroke="#111827" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.6));"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5" fill="#111827" stroke="none"/></svg>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });

    if (markerRef.current) {
      markerRef.current.setLatLng([latitude, longitude]);
      markerRef.current.setIcon(customIcon);
    } else {
      markerRef.current = L.marker([latitude, longitude], { icon: customIcon }).addTo(map);
      markerRef.current.bindPopup(`<b>${nickname}</b>`);
    }
  }, [latitude, longitude, nickname, avatarUrl, showDirections, leafletLoaded]);

  // Handle interactive map clicks for manual pin dropping
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !interactive) return;

    const handleMapClick = (e: any) => {
      const { lat, lng } = e.latlng;
      onLocationChange?.({ latitude: lat, longitude: lng });
    };

    map.on("click", handleMapClick);
    return () => {
      map.off("click", handleMapClick);
    };
  }, [interactive, onLocationChange, leafletLoaded]);

  // Handle Directions & Route Calculation (Displaying both user and sender markers + polyline)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = LRef.current;
    if (!map || !L) return;

    if (receiverMarkerRef.current) {
      receiverMarkerRef.current.remove();
      receiverMarkerRef.current = null;
    }
    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }

    if (!showDirections || !receiverLocation) {
      setRouteInfo(null);
      return;
    }

    // Custom marker for YOU (the user viewing the route)
    const receiverIcon = L.divIcon({
      className: "loci-leaflet-receiver-marker",
      html: `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; width: 140px; left: -70px; bottom: 42px; pointer-events: none;">
          <div style="display: flex; align-items: center; background: #18181b; padding: 2px 8px 2px 2px; border-radius: 9999px; border: 1px solid rgba(59,130,246,0.5); margin-bottom: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.6); gap: 6px; pointer-events: auto;">
            <div style="width: 22px; height: 22px; border-radius: 50%; background: #3b82f6; color: #fff; font-size: 9px; font-weight: 900; display: flex; align-items: center; justify-content: center;">YOU</div>
            <span style="color: #3b82f6; font-size: 10px; font-weight: 900; white-space: nowrap; padding-right: 4px;">My Location</span>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="42" fill="#3b82f6" stroke="#111827" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.6));"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5" fill="#111827" stroke="none"/></svg>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });

    receiverMarkerRef.current = L.marker([receiverLocation.latitude, receiverLocation.longitude], { icon: receiverIcon }).addTo(map);
    receiverMarkerRef.current.bindPopup("<b>Your Location (Receiver)</b>");

    async function fetchRoute() {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${receiverLocation!.longitude},${receiverLocation!.latitude};${longitude},${latitude}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch route");
        const data = await res.json();

        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const coords = route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);

          const polyline = L.polyline(coords, {
            color: "#3b82f6",
            weight: 5,
            opacity: 0.85,
          }).addTo(map);

          routeLayerRef.current = polyline;
          map.fitBounds(polyline.getBounds(), { padding: [60, 60] });

          const distKm = (route.distance / 1000).toFixed(1);
          const durMins = Math.round(route.duration / 60);
          setRouteInfo({
            distance: `${distKm} km`,
            duration: `${durMins} mins`,
          });
        }
      } catch (err) {
        console.error("OSRM routing error:", err);
        const latlngs: [number, number][] = [
          [receiverLocation!.latitude, receiverLocation!.longitude],
          [latitude, longitude],
        ];
        const polyline = L.polyline(latlngs, { color: "#facc15", weight: 4, dashArray: "5, 5" }).addTo(map);
        routeLayerRef.current = polyline;
        map.fitBounds(polyline.getBounds(), { padding: [60, 60] });
        setRouteInfo({ distance: "Direct route", duration: "~" });
      }
    }

    void fetchRoute();
  }, [showDirections, receiverLocation, latitude, longitude, leafletLoaded]);

  return (
    <div className="relative h-full w-full">
      <div ref={mapRef} className={className} />
      {routeInfo && showDirections && (
        <div className="absolute bottom-3 left-3 right-3 bg-black/85 backdrop-blur-md text-white px-4 py-3 rounded-2xl border border-zinc-700 flex items-center justify-between text-xs shadow-2xl z-999">
          <div>
            <p className="text-[9px] text-zinc-400 uppercase font-black tracking-wider">Route Distance</p>
            <p className="font-extrabold text-yellow-400 text-sm mt-0.5">{routeInfo.distance}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] text-zinc-400 uppercase font-black tracking-wider">Est. Travel Time</p>
            <p className="font-extrabold text-emerald-400 text-sm mt-0.5">{routeInfo.duration}</p>
          </div>
        </div>
      )}
    </div>
  );
}