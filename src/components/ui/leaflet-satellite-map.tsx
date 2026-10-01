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
  onLocationChange?: (coordinates: Coordinates) => void;
}

const markerIcon = divIcon({
  className: "loci-leaflet-marker",
  html: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="42" fill="#facc15" stroke="#111827" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5" fill="#111827" stroke="none"/></svg>',
  iconSize: [36, 42],
  iconAnchor: [18, 42],
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

export function LeafletSatelliteMap({ latitude, longitude, interactive = false, onLocationChange }: LeafletSatelliteMapProps) {
  const coordinates = { latitude, longitude };

  return (
    <MapContainer
      center={[latitude, longitude]}
      zoom={16}
      minZoom={2}
      maxZoom={19}
      scrollWheelZoom
      doubleClickZoom
      touchZoom
      dragging
      zoomControl
      attributionControl={false}
      className="h-full w-full"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
      />
      <RecenterMap coordinates={coordinates} />
      <MapPicker onPick={interactive ? onLocationChange : undefined} />
      <Marker
        position={[latitude, longitude]}
        icon={markerIcon}
        draggable={interactive}
        eventHandlers={interactive && onLocationChange ? {
          dragend: (event) => {
            const position = event.target.getLatLng();
            onLocationChange({ latitude: position.lat, longitude: position.lng });
          },
        } : undefined}
      />
    </MapContainer>
  );
}
