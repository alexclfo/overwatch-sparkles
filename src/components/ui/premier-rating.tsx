"use client";

// CS2 Premier tier configuration with Gold 30,000+
const PREMIER_TIERS = [
  { min: 0, max: 4999, name: "Grey", color: "bg-gray-500", textColor: "text-gray-300", borderColor: "border-gray-500", value: "0-4999" },
  { min: 5000, max: 9999, name: "Cyan", color: "bg-cyan-400", textColor: "text-cyan-300", borderColor: "border-cyan-400", value: "5000-9999" },
  { min: 10000, max: 14999, name: "Blue", color: "bg-blue-500", textColor: "text-blue-300", borderColor: "border-blue-500", value: "10000-14999" },
  { min: 15000, max: 19999, name: "Purple", color: "bg-purple-500", textColor: "text-purple-300", borderColor: "border-purple-500", value: "15000-19999" },
  { min: 20000, max: 24999, name: "Pink", color: "bg-pink-400", textColor: "text-pink-300", borderColor: "border-pink-400", value: "20000-24999" },
  { min: 25000, max: 29999, name: "Red", color: "bg-red-500", textColor: "text-red-300", borderColor: "border-red-500", value: "25000-29999" },
  { min: 30000, max: 99999, name: "Gold", color: "bg-yellow-500", textColor: "text-yellow-300", borderColor: "border-yellow-500", value: "30000+" },
];

// Dropdown options for Premier rating selection - store value as the range string
const PREMIER_OPTIONS = [
  { label: "0 - 4,999", value: "0-4999", color: "bg-gray-500" },
  { label: "5,000 - 9,999", value: "5000-9999", color: "bg-cyan-400" },
  { label: "10,000 - 14,999", value: "10000-14999", color: "bg-blue-500" },
  { label: "15,000 - 19,999", value: "15000-19999", color: "bg-purple-500" },
  { label: "20,000 - 24,999", value: "20000-24999", color: "bg-pink-400" },
  { label: "25,000 - 29,999", value: "25000-29999", color: "bg-red-500" },
  { label: "30,000+", value: "30000+", color: "bg-yellow-500" },
];

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

export function getTierForRating(rating: number | string) {
  const str = String(rating);
  // Check if it's a range value like "10000-14999"
  const tier = PREMIER_TIERS.find((t) => t.value === str);
  if (tier) return tier;
  
  const num = typeof rating === "string" ? parseInt(rating) : rating;
  if (isNaN(num)) {
    // Check if it's a tier name (legacy)
    const tierByName = PREMIER_TIERS.find((t) => t.name.toLowerCase() === str.toLowerCase());
    return tierByName || PREMIER_TIERS[0];
  }
  return PREMIER_TIERS.find((t) => num >= t.min && num <= t.max) || PREMIER_TIERS[0];
}

export function getTierByName(name: string) {
  return PREMIER_TIERS.find((t) => t.name.toLowerCase() === name.toLowerCase()) || PREMIER_TIERS[0];
}

interface PremierRatingInputProps {
  value: string;
  onChange: (value: string) => void;
  source: "premier" | "faceit";
}

export function PremierRatingInput({ value, onChange, source }: PremierRatingInputProps) {
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

  // Get the tier for the current value
  const currentTier = value ? getTierForRating(value) : null;
  const currentOption = PREMIER_OPTIONS.find(o => o.value === value);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-400 mb-2">Rank</label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {PREMIER_OPTIONS.map((opt) => {
          const isSelected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${
                isSelected 
                  ? `${opt.color} border-white/50 text-white` 
                  : "bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-500"
              }`}
            >
              <div className={`w-3 h-3 rounded ${opt.color}`} />
              <span className="text-sm font-medium">{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface PremierRatingBadgeProps {
  rating: string | null;
  size?: "sm" | "md" | "lg";
}

export function PremierRatingBadge({ rating, size = "md" }: PremierRatingBadgeProps) {
  if (!rating) return null;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
    lg: "px-4 py-1.5 text-base",
  };

  // Check if it's a Faceit level
  if (rating.toLowerCase().includes("level")) {
    return (
      <span className={`bg-orange-500 text-white rounded-full font-bold ${sizeClasses[size]}`}>
        {rating}
      </span>
    );
  }

  // Get tier info and display CS2-style rank bars
  const tier = getTierForRating(rating);
  
  // Parse upper bound from tier value
  const isGold = tier.value === "30000+";
  const upperBound = isGold ? "30,000+" : parseInt(tier.value.split("-")[1]).toLocaleString();
  
  return (
    <div className={`inline-flex items-center rounded overflow-hidden border-l-4 ${tier.borderColor}`}>
      <span className={`px-2 py-1 text-sm font-bold text-white tabular-nums ${tier.color}`}>
        {upperBound}
      </span>
    </div>
  );
}
