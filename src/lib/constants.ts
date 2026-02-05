// CS2 Maps
export const CS2_MAPS = [
  "de_ancient",
  "de_anubis", 
  "de_dust2",
  "de_inferno",
  "de_mirage",
  "de_nuke",
  "de_overpass",
  "de_vertigo",
  "de_train",
  "Other",
] as const;

export type CS2Map = typeof CS2_MAPS[number];

// Cheat Types
export const CHEAT_TYPES = [
  { id: "wallhack", label: "Wallhack" },
  { id: "aimbot", label: "Aimbot" },
  { id: "external", label: "External Assist" },
] as const;

export type CheatTypeId = typeof CHEAT_TYPES[number]["id"];

// Demo Sources
export const DEMO_SOURCES = ["premier", "faceit"] as const;
export type DemoSource = typeof DEMO_SOURCES[number];

// Submission Status
export const SUBMISSION_STATUSES = ["new", "reviewed"] as const;
export type SubmissionStatus = typeof SUBMISSION_STATUSES[number];

// Submission Verdicts
export const SUBMISSION_VERDICTS = ["cheater", "clean", "inconclusive"] as const;
export type SubmissionVerdict = typeof SUBMISSION_VERDICTS[number];

// Rate Limiting
export const MAX_ACTIVE_SUBMISSIONS = 3;
export const COOLDOWN_SECONDS = 20;
export const MAX_FILE_SIZE_MB = 500;

// Premier Rank Tiers
export const PREMIER_TIERS = [
  { min: 0, max: 4999, accent: "#9ca3af", bg: "#374151", label: "0 - 4,999" },
  { min: 5000, max: 9999, accent: "#60a5fa", bg: "#1e3a8a", label: "5,000 - 9,999" },
  { min: 10000, max: 14999, accent: "#3b82f6", bg: "#1d4ed8", label: "10,000 - 14,999" },
  { min: 15000, max: 19999, accent: "#a855f7", bg: "#581c87", label: "15,000 - 19,999" },
  { min: 20000, max: 24999, accent: "#e879f9", bg: "#86198f", label: "20,000 - 24,999" },
  { min: 25000, max: 29999, accent: "#ef4444", bg: "#7f1d1d", label: "25,000 - 29,999" },
  { min: 30000, max: 99999, accent: "#facc15", bg: "#713f12", label: "30,000+" },
] as const;

// FACEIT Levels
export const FACEIT_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export type FaceitLevel = typeof FACEIT_LEVELS[number];
