"use client";

// CS2 map icons from MurkyYT/cs2-map-icons GitHub repository
// URL pattern: https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/{map_name}.png
const MAP_ICON_BASE = "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images";

function getMapIconUrl(mapName: string): string {
  return `${MAP_ICON_BASE}/${mapName}.png`;
}

// Friendly display names
const MAP_NAMES: Record<string, string> = {
  de_dust2: "Dust 2",
  de_mirage: "Mirage",
  de_inferno: "Inferno",
  de_nuke: "Nuke",
  de_overpass: "Overpass",
  de_vertigo: "Vertigo",
  de_ancient: "Ancient",
  de_anubis: "Anubis",
  de_train: "Train",
  de_cache: "Cache",
  de_cobblestone: "Cobble",
  cs_office: "Office",
  cs_italy: "Italy",
};

interface MapIconProps {
  map: string;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  className?: string;
}

export function MapIcon({ map, size = "sm", showName = false, className = "" }: MapIconProps) {
  const mapKey = map.toLowerCase();
  const iconUrl = getMapIconUrl(mapKey);
  const displayName = MAP_NAMES[mapKey] || map.replace("de_", "").replace("cs_", "");
  
  const sizeConfig = {
    sm: { icon: 20, text: "text-xs" },
    md: { icon: 28, text: "text-sm" },
    lg: { icon: 36, text: "text-base" },
  };
  
  const config = sizeConfig[size];
  
  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`} title={displayName}>
      <img
        src={iconUrl}
        alt={displayName}
        className="flex-shrink-0 object-contain"
        style={{ width: config.icon, height: config.icon }}
        onError={(e) => {
          // Hide broken image
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
      {showName && (
        <span className={`text-gray-400 ${config.text}`}>
          {displayName}
        </span>
      )}
    </div>
  );
}
