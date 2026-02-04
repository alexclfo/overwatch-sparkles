const STEAM_API_KEY = process.env.STEAM_WEB_API_KEY;

export interface SteamPlayerSummary {
  steamid: string;
  personaname: string;
  avatarfull: string;
  profileurl: string;
}

export async function getPlayerSummaries(
  steamIds: string[]
): Promise<SteamPlayerSummary[]> {
  if (!STEAM_API_KEY) {
    console.warn("STEAM_WEB_API_KEY not configured");
    return [];
  }

  const ids = steamIds.join(",");
  const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_API_KEY}&steamids=${ids}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data.response?.players || [];
  } catch (error) {
    console.error("Failed to fetch Steam player summaries:", error);
    return [];
  }
}

export async function resolveVanityURL(vanityUrl: string): Promise<string | null> {
  if (!STEAM_API_KEY) {
    console.warn("STEAM_WEB_API_KEY not configured");
    return null;
  }

  const url = `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${STEAM_API_KEY}&vanityurl=${vanityUrl}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.response?.success === 1) {
      return data.response.steamid;
    }
    return null;
  } catch (error) {
    console.error("Failed to resolve vanity URL:", error);
    return null;
  }
}

export function extractSteamId64FromUrl(url: string): string | null {
  // Match /profiles/<steamid64>
  const profileMatch = url.match(/steamcommunity\.com\/profiles\/(\d{17})/);
  if (profileMatch) {
    return profileMatch[1];
  }
  return null;
}

export function extractVanityFromUrl(url: string): string | null {
  // Match /id/<vanity>
  const vanityMatch = url.match(/steamcommunity\.com\/id\/([^\/\?]+)/);
  if (vanityMatch) {
    return vanityMatch[1];
  }
  return null;
}

export interface SteamBanInfo {
  SteamId: string;
  CommunityBanned: boolean;
  VACBanned: boolean;
  NumberOfVACBans: number;
  DaysSinceLastBan: number;
  NumberOfGameBans: number;
  EconomyBan: string;
}

export async function getPlayerBans(steamIds: string[]): Promise<SteamBanInfo[]> {
  if (!STEAM_API_KEY) {
    console.warn("STEAM_WEB_API_KEY not configured");
    return [];
  }

  const ids = steamIds.join(",");
  const url = `https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key=${STEAM_API_KEY}&steamids=${ids}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data.players || [];
  } catch (error) {
    console.error("Failed to fetch Steam player bans:", error);
    return [];
  }
}

export async function resolveSteamProfileUrl(url: string): Promise<string | null> {
  // Try direct SteamID64 first
  const steamId64 = extractSteamId64FromUrl(url);
  if (steamId64) {
    return steamId64;
  }

  // Try vanity URL
  const vanity = extractVanityFromUrl(url);
  if (vanity) {
    return await resolveVanityURL(vanity);
  }

  // Check if it's just a raw SteamID64
  if (/^\d{17}$/.test(url.trim())) {
    return url.trim();
  }

  return null;
}
