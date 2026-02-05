"use client";

// Premier rank tier colors - CS2 parallelogram style with accent/bg colors
const PREMIER_TIERS = [
  { min: 0, max: 4999, accent: "#9ca3af", bg: "#374151" },           // Grey
  { min: 5000, max: 9999, accent: "#60a5fa", bg: "#1e3a8a" },        // Light Blue
  { min: 10000, max: 14999, accent: "#3b82f6", bg: "#1d4ed8" },      // Blue
  { min: 15000, max: 19999, accent: "#a855f7", bg: "#581c87" },      // Purple
  { min: 20000, max: 24999, accent: "#e879f9", bg: "#86198f" },      // Pink
  { min: 25000, max: 29999, accent: "#ef4444", bg: "#7f1d1d" },      // Red
  { min: 30000, max: 99999, accent: "#facc15", bg: "#713f12" },      // Gold
];

function getPremierTier(rating: number) {
  for (const tier of PREMIER_TIERS) {
    if (rating >= tier.min && rating <= tier.max) return tier;
  }
  return PREMIER_TIERS[0];
}

// FACEIT level colors - official colors
const FACEIT_COLORS: Record<number, string> = {
  1: "#b0b0b0",   // Grey
  2: "#b0b0b0",   // Grey
  3: "#b0b0b0",   // Grey
  4: "#ffaa00",   // Yellow/Orange
  5: "#ffaa00",   // Yellow/Orange
  6: "#ffaa00",   // Yellow/Orange
  7: "#ffaa00",   // Yellow/Orange
  8: "#ff5500",   // Dark Orange
  9: "#ff5500",   // Dark Orange
  10: "#ff0000",  // Bright Red
};

// FACEIT level colors (official colors)
const FACEIT_LEVEL_COLORS: Record<number, { bg: string; text: string }> = {
  1: { bg: "bg-gray-600", text: "text-white" },
  2: { bg: "bg-green-700", text: "text-white" },
  3: { bg: "bg-green-500", text: "text-white" },
  4: { bg: "bg-yellow-500", text: "text-black" },
  5: { bg: "bg-yellow-400", text: "text-black" },
  6: { bg: "bg-orange-500", text: "text-white" },
  7: { bg: "bg-orange-600", text: "text-white" },
  8: { bg: "bg-orange-700", text: "text-white" },
  9: { bg: "bg-red-600", text: "text-white" },
  10: { bg: "bg-red-500", text: "text-white" },
};

interface PremierRankProps {
  rating: number | string | null;
  size?: "sm" | "md";
  className?: string;
}

// Premier: CS2-style parallelogram badge with double stripes
export function PremierRank({ rating, size = "md", className = "" }: PremierRankProps) {
  if (!rating) return null;
  
  const numRating = typeof rating === "string" ? parseInt(rating) : rating;
  if (isNaN(numRating)) return null;
  
  const tier = getPremierTier(numRating);
  const isSmall = size === "sm";
  
  const sizeConfig = {
    sm: { height: "h-7", stripeH: "h-5", stripeW: "w-[3px]", text: "text-xs", px: "px-3" },
    md: { height: "h-9", stripeH: "h-6", stripeW: "w-1", text: "text-sm", px: "px-4" },
  };
  const config = sizeConfig[size];
  
  return (
    <div 
      className={`inline-flex items-center ${config.height} relative ${className}`}
      style={{ 
        transform: "skewX(-12deg)",
        backgroundColor: tier.bg,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.3)`
      }}
    >
      {/* Double stripe accent on left edge */}
      <div className="flex gap-[2px] pl-2 pr-1">
        <div 
          className={`${config.stripeW} ${config.stripeH} rounded-[1px]`}
          style={{ backgroundColor: tier.accent }}
        />
        <div 
          className={`${config.stripeW} ${config.stripeH} rounded-[1px]`}
          style={{ backgroundColor: tier.accent }}
        />
      </div>
      {/* Counter-skew text so it's upright */}
      <span 
        className={`${config.text} font-bold tracking-tight tabular-nums ${config.px}`}
        style={{ 
          transform: "skewX(12deg)",
          color: tier.accent,
          fontFamily: "'Teko', 'Barlow Condensed', 'Oswald', sans-serif",
          letterSpacing: "0.02em"
        }}
      >
        {numRating.toLocaleString()}
      </span>
    </div>
  );
}

interface FaceitRankProps {
  level: number;
  elo?: number | null;
  size?: "sm" | "md";
  className?: string;
}

// FACEIT: Circular badge with level number
export function FaceitRank({ level, elo, size = "md", className = "" }: FaceitRankProps) {
  const color = FACEIT_COLORS[level] || FACEIT_COLORS[1];
  const isSmall = size === "sm";
  
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {/* Circular level badge */}
      <div 
        className={`${isSmall ? "w-6 h-6 text-xs" : "w-8 h-8 text-sm"} rounded-full flex items-center justify-center font-bold text-white`}
        style={{ 
          backgroundColor: color,
          boxShadow: `0 0 0 2px ${color}40, inset 0 1px 0 rgba(255,255,255,0.3)`
        }}
      >
        {level}
      </div>
      {/* Elo */}
      {elo && (
        <span className={`font-medium text-orange-400 ${isSmall ? "text-xs" : "text-sm"}`}>
          {elo.toLocaleString()}
        </span>
      )}
    </div>
  );
}

// Combined rank display that handles both platforms
interface UnifiedRankProps {
  source: "premier" | "faceit";
  premierRating?: number | string | null;
  faceitLevel?: number | null;
  faceitElo?: number | null;
  size?: "sm" | "md";
  className?: string;
}

export function UnifiedRank({ source, premierRating, faceitLevel, faceitElo, size = "md", className = "" }: UnifiedRankProps) {
  if (source === "premier" && premierRating) {
    return <PremierRank rating={premierRating} size={size} className={className} />;
  }
  if (source === "faceit" && faceitLevel) {
    return <FaceitRank level={faceitLevel} elo={faceitElo} size={size} className={className} />;
  }
  return null;
}

// Legacy exports for backwards compatibility
interface BadgeProps {
  className?: string;
  size?: "sm" | "md";
}

export function PremierBadge({ className = "", size = "md" }: BadgeProps) {
  const isSmall = size === "sm";
  return (
    <div 
      className={`relative inline-flex items-center ${isSmall ? "h-5" : "h-6"} bg-gradient-to-r from-indigo-950 via-indigo-900 to-indigo-950 rounded overflow-hidden ${className}`}
    >
      <div className="flex h-full">
        <div className={`${isSmall ? "w-0.5" : "w-1"} h-full bg-yellow-400`} />
        <div className={`${isSmall ? "w-0.5" : "w-1"} h-full bg-cyan-400`} />
        <div className={`${isSmall ? "w-0.5" : "w-1"} h-full bg-purple-500`} />
        <div className={`${isSmall ? "w-0.5" : "w-1"} h-full bg-indigo-800`} />
      </div>
      <span className={`${isSmall ? "px-1.5 text-[10px]" : "px-2 text-xs"} text-white font-bold tracking-wider uppercase`}>
        PREMIER
      </span>
    </div>
  );
}

export function FaceitBadge({ className = "", size = "md" }: BadgeProps) {
  const isSmall = size === "sm";
  return (
    <div 
      className={`inline-flex items-center ${isSmall ? "h-5 px-1.5" : "h-6 px-2"} bg-orange-500 rounded ${className}`}
    >
      <span className={`font-bold uppercase text-white tracking-tight ${isSmall ? "text-[10px]" : "text-xs"}`}>
        FACEIT
      </span>
    </div>
  );
}

interface SourceBadgeProps {
  source: "PREMIER" | "FACEIT";
  className?: string;
  size?: "sm" | "md";
}

export function SourceBadge({ source, className = "", size = "md" }: SourceBadgeProps) {
  if (source === "PREMIER") {
    return <PremierBadge className={className} size={size} />;
  }
  return <FaceitBadge className={className} size={size} />;
}
