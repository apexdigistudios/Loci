"use client";

import { useEffect } from "react";
import { divIcon, type LeafletMouseEvent } from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface LeafletSatelliteMapProps extends Coordinates {
  interactive?: boolean;
  nickname?: string;
  avatarUrl?: string;
  onLocationChange?: (coordinates: Coordinates) => void;
}

const getMarkerIcon = (nickname?: string, avatarUrl?: string) =>
  divIcon({
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

function RecenterMap({ coordinates }: { coordinates: Coordinates }) {
  const map = useMap();

  useEffect(() => {
    map.setView([coordinates.latitude, coordinates.longitude], map.getZoom(), { animate: true });
  }, [coordinates.latitude, coordinates.longitude, map]);

  return null;
}

function MapPicker({ onPick }: { onPick?: (coordinates: Coordinates) => void }) {
  useMapEvents({
    click(event: LeafletMouseEvent) {
      onPick?.({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    },
  });

  return null;
}

export function LeafletSatelliteMap({
  latitude,
  longitude,
  interactive = false,
  nickname,
  avatarUrl,
  onLocationChange,
}: LeafletSatelliteMapProps) {
  const coordinates = { latitude, longitude };
  const markerIcon = getMarkerIcon(nickname, avatarUrl);

  return (
    <MapContainer
      center={[latitude, longitude]}
      zoom={16}
      minZoom={2}
      maxZoom={20}
      scrollWheelZoom
      doubleClickZoom
      touchZoom
      dragging
      zoomControl
      attributionControl={false}
      className="h-full w-full"
    >
      {/* Google Hybrid Satellite & Dense Labels Layer */}
      <TileLayer
        url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
        maxZoom={20}
      />
      <RecenterMap coordinates={coordinates} />
      <MapPicker onPick={interactive ? onLocationChange : undefined} />
      <Marker
        position={[latitude, longitude]}
        icon={markerIcon}
        draggable={interactive}
        eventHandlers={
          interactive && onLocationChange
            ? {
                dragend: (event) => {
                  const position = event.target.getLatLng();
                  onLocationChange({ latitude: position.lat, longitude: position.lng });
                },
              }
            : undefined
        }
      />
    </MapContainer>
  );
}