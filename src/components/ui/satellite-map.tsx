import { MapPin } from "lucide-react";

interface SatelliteMapProps {
  latitude: number;
  longitude: number;
  className?: string;
}

const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const MAX_ZOOM = 19;

export function SatelliteMap({ latitude, longitude, className = "h-52 rounded-2xl" }: SatelliteMapProps) {
  const zoom = Math.min(16, MAX_ZOOM);
  const tileCount = 2 ** zoom;
  const latitudeRadians = (latitude * Math.PI) / 180;
  const centerX = ((longitude + 180) / 360) * tileCount;
  const centerY = ((1 - Math.asinh(Math.tan(latitudeRadians)) / Math.PI) / 2) * tileCount;
  const centerTileX = Math.floor(centerX);
  const centerTileY = Math.floor(centerY);
  const tileOffsetX = (centerX - centerTileX) * 256;
  const tileOffsetY = (centerY - centerTileY) * 256;
  const tiles = [];

  for (let tileY = centerTileY - 2; tileY <= centerTileY + 2; tileY += 1) {
    if (tileY < 0 || tileY >= tileCount) continue;
    for (let tileX = centerTileX - 2; tileX <= centerTileX + 2; tileX += 1) {
      const wrappedX = (tileX % tileCount + tileCount) % tileCount;
      const subdomain = ["a", "b", "c"][(wrappedX + tileY) % 3];
      tiles.push(
        <img
          key={`${tileX}-${tileY}`}
          alt=""
          draggable={false}
          className="absolute h-64 w-64 max-w-none select-none"
          style={{
            left: `calc(50% + ${(tileX - centerTileX) * 256 - tileOffsetX}px)`,
            top: `calc(50% + ${(tileY - centerTileY) * 256 - tileOffsetY}px)`,
          }}
          src={TILE_URL
            .replace("{s}", subdomain)
            .replace("{z}", String(zoom))
            .replace("{x}", String(wrappedX))
            .replace("{y}", String(tileY))}
        />
      );
    }
  }

  return (
    <div className={`relative w-full overflow-hidden border border-zinc-200/70 dark:border-zinc-800 bg-zinc-200 dark:bg-zinc-900 ${className}`}>
      {tiles}
      <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-full drop-shadow-md">
        <MapPin className="h-8 w-8 fill-yellow-400 text-black" />
      </div>
      <div className="absolute bottom-0 inset-x-0 z-20 bg-white/85 px-2 py-1 text-[8px] leading-tight text-zinc-700">
        <span>
          © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap</a> contributors
        </span>
      </div>
    </div>
  );
}