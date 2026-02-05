"use client";

// CS2 Premier rank badge - Parallelogram/Skewed design with double stripes
// Cyber/Esports aesthetic with exact CS2 color palette

export const RANK_TIERS = {
  gray: { 
    min: 0, max: 4999, 
    accent: "#9ca3af", bg: "#374151",
    label: "0,000 - 4,999", upperLabel: "4,999",
    value: "0-4999"
  },
  lightBlue: { 
    min: 5000, max: 9999, 
    accent: "#60a5fa", bg: "#1e3a8a",
    label: "5,000 - 9,999", upperLabel: "9,999",
    value: "5000-9999"
  },
  blue: { 
    min: 10000, max: 14999, 
    accent: "#3b82f6", bg: "#1d4ed8",
    label: "10,000 - 14,999", upperLabel: "14,999",
    value: "10000-14999"
  },
  purple: { 
    min: 15000, max: 19999, 
    accent: "#a855f7", bg: "#581c87",
    label: "15,000 - 19,999", upperLabel: "19,999",
    value: "15000-19999"
  },
  pink: { 
    min: 20000, max: 24999, 
    accent: "#e879f9", bg: "#86198f",
    label: "20,000 - 24,999", upperLabel: "24,999",
    value: "20000-24999"
  },
  red: { 
    min: 25000, max: 29999, 
    accent: "#ef4444", bg: "#7f1d1d",
    label: "25,000 - 29,999", upperLabel: "29,999",
    value: "25000-29999"
  },
  gold: { 
    min: 30000, max: 99999, 
    accent: "#facc15", bg: "#713f12",
    label: "30,000+", upperLabel: "30,000+",
    value: "30000+"
  },
} as const;

export type TierKey = keyof typeof RANK_TIERS;

const TIER_ORDER: TierKey[] = ["gray", "lightBlue", "blue", "purple", "pink", "red", "gold"];

export function getTierFromValue(value: string | number | null): typeof RANK_TIERS[TierKey] {
  if (!value) return RANK_TIERS.gray;
  
  const str = String(value);
  
  // Check if it's a tier value like "10000-14999"
  for (const tier of Object.values(RANK_TIERS)) {
    if (tier.value === str) return tier;
  }
  
  // Try parsing as number
  const num = parseInt(str);
  if (!isNaN(num)) {
    for (const tier of Object.values(RANK_TIERS)) {
      if (num >= tier.min && num <= tier.max) return tier;
    }
  }
  
  return RANK_TIERS.gray;
}

interface RankBadgeProps {
  rating: string | null;
  size?: "sm" | "md" | "lg";
  showFaceit?: boolean;
}

export function RankBadge({ rating, size = "md", showFaceit = false }: RankBadgeProps) {
  if (!rating) return null;

  // Check if it's a Faceit level
  if (rating.toLowerCase().includes("level")) {
    const sizeClasses = {
      sm: "px-2 py-0.5 text-xs",
      md: "px-3 py-1 text-sm",
      lg: "px-4 py-1.5 text-base",
    };
    return (
      <span className={`bg-orange-500 text-white rounded font-bold ${sizeClasses[size]}`}>
        {rating}
      </span>
    );
  }

  const tier = getTierFromValue(rating);
  
  const sizeConfig = {
    sm: { height: "h-7", text: "text-xs", stripeH: "h-5", stripeW: "w-[3px]", px: "px-3", py: "py-1" },
    md: { height: "h-9", text: "text-sm", stripeH: "h-6", stripeW: "w-1", px: "px-4", py: "py-1.5" },
    lg: { height: "h-11", text: "text-base", stripeH: "h-7", stripeW: "w-1", px: "px-5", py: "py-2" },
  };
  
  const config = sizeConfig[size];

  return (
    <div 
      className={`inline-flex items-center ${config.height} relative`}
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
        {tier.upperLabel}
      </span>
    </div>
  );
}

interface RankSelectorProps {
  value: string;
  onChange: (value: string) => void;
  source: "premier" | "faceit";
}

const FACEIT_OPTIONS = [
  { label: "Level 1 (0 - 500 ELO)", value: "Level 1" },
  { label: "Level 2 (501 - 750)", value: "Level 2" },
  { label: "Level 3 (751 - 900)", value: "Level 3" },
  { label: "Level 4 (901 - 1050)", value: "Level 4" },
  { label: "Level 5 (1051 - 1200)", value: "Level 5" },
  { label: "Level 6 (1201 - 1350)", value: "Level 6" },
  { label: "Level 7 (1351 - 1530)", value: "Level 7" },
  { label: "Level 8 (1531 - 1750)", value: "Level 8" },
  { label: "Level 9 (1751 - 2000)", value: "Level 9" },
  { label: "Level 10 (2001+)", value: "Level 10" },
];

export function RankSelector({ value, onChange, source }: RankSelectorProps) {
  if (source === "faceit") {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-2">Faceit Level</label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white"
        >
          <option value="">Select level</option>
          {FACEIT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-400 mb-3">Select Rank</label>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {TIER_ORDER.map((tierKey) => {
          const tier = RANK_TIERS[tierKey];
          const isSelected = value === tier.value;
          
          return (
            <button
              key={tierKey}
              type="button"
              onClick={() => onChange(tier.value)}
              className={`relative flex items-center h-10 transition-all duration-200 ${
                isSelected 
                  ? "ring-2 ring-white/60 scale-105 z-10" 
                  : "opacity-50 hover:opacity-100 hover:scale-105"
              }`}
              style={{ 
                transform: `skewX(-12deg) ${isSelected ? "scale(1.05)" : ""}`,
                backgroundColor: tier.bg,
                boxShadow: isSelected 
                  ? `inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.4)`
                  : `inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.2)`
              }}
            >
              {/* Double stripe accent on left edge */}
              <div className="flex gap-[2px] pl-2 pr-1">
                <div 
                  className="w-[3px] h-6 rounded-[1px]"
                  style={{ backgroundColor: tier.accent }}
                />
                <div 
                  className="w-[3px] h-6 rounded-[1px]"
                  style={{ backgroundColor: tier.accent }}
                />
              </div>
              {/* Counter-skew text */}
              <span 
                className="text-xs font-bold tracking-tight tabular-nums px-2 whitespace-nowrap"
                style={{ 
                  transform: "skewX(12deg)",
                  color: tier.accent,
                  fontFamily: "'Teko', 'Barlow Condensed', 'Oswald', sans-serif"
                }}
              >
                {tier.upperLabel}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
