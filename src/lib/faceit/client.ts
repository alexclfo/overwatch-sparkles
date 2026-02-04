const FACEIT_API_BASE = "https://open.faceit.com/data/v4";

export interface FaceitPlayerData {
  faceit_id: string;
  nickname: string;
  skill_level: number;
  elo: number;
  region: string;
  avatar_url: string | null;
}

export interface FaceitResult {
  found: boolean;
  data: FaceitPlayerData | null;
  error: string | null;
}

export async function getFaceitPlayer(steamId64: string): Promise<FaceitResult> {
  const apiKey = process.env.FACEIT_SERVER_KEY;
  
  if (!apiKey) {
    return { found: false, data: null, error: "FACEIT API key not configured" };
  }

  try {
    const url = `${FACEIT_API_BASE}/players?game=cs2&game_player_id=${steamId64}`;
    
    const res = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json",
      },
      cache: "no-store",
    });

    if (res.status === 404) {
      return { found: false, data: null, error: null };
    }

    if (!res.ok) {
      const text = await res.text();
      console.error(`FACEIT API error: ${res.status}`, text.substring(0, 200));
      return { found: false, data: null, error: `FACEIT API error: ${res.status}` };
    }

    const json = await res.json();
    
    // Extract CS2 game data
    const cs2Data = json.games?.cs2;
    
    if (!cs2Data) {
      return { found: false, data: null, error: null };
    }

    return {
      found: true,
      data: {
        faceit_id: json.player_id,
        nickname: json.nickname,
        skill_level: cs2Data.skill_level || 0,
        elo: cs2Data.faceit_elo || 0,
        region: cs2Data.region || json.country || "Unknown",
        avatar_url: json.avatar || null,
      },
      error: null,
    };
  } catch (err) {
    console.error("FACEIT fetch error:", err);
    return { found: false, data: null, error: "Failed to fetch FACEIT data" };
  }
}
